// V04.1 — rastreador de picos de quadro: para CADA quadro grava intervalo, tempo do frame no thread principal e o
// que mudou nele (programas de shader novos, geometrias/texturas enviadas, nós de relevo carregados, criaturas e
// atores criados, tarefas longas). Os quadros acima de `--fator` × mediana viram "picos" e recebem as causas
// observadas no MESMO quadro. Cenários: vila (parada), zoom (65 ↔ 700 m a cada 5 s), noite (força o ciclo para a
// noite e faz o zoom atravessar o raio de 450 m da vila), troca (alterna o Hunter seguido), viagem (×10 até ER_21).
//   node tools/lab/picos.mjs --url http://127.0.0.1:8813/ --cenario zoom --segundos 40 --out bench/v04-1/picos-zoom.json
// SwiftShader: os tempos absolutos não valem para GPU real; a CORRELAÇÃO pico ↔ causa vale (compilação de shader e
// upload acontecem igualmente, só mais rápido na GPU).
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const A = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith("--") ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const url = new URL(A.url ?? "http://127.0.0.1:8813/"); url.searchParams.set("perfil", A.perfil ?? "medio");
const base = `${url.protocol}//${url.host}`, cen = A.cenario ?? "vila", secs = Number(A.segundos ?? 40), fator = Number(A.fator ?? 2.5);
const api = async (p, body) => (await fetch(base + p, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {})).json().catch(() => null);
const b = await pw.chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info"] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on("pageerror", e => errs.push(e.message));
await p.goto(url.toString());
await p.waitForFunction(() => window.__wildhavenDbg?.().laco === "3d" && window.__wildhavenPerf?.drawCalls > 0, null, { timeout: 240000 });
await p.waitForTimeout(Number(A.assentar ?? 20) * 1000);
// instrumentação: embrulha Scene3D.frame (só leitura de contadores; não muda o jogo)
await p.evaluate(() => {
  const s = window.__wildhavenScene, r = s.renderer, info = r.info;
  const st = () => ({ prog: info.programs?.length ?? 0, geo: info.memory.geometries, tex: info.memory.textures, nodes: s.world.stats.nodesRam ?? 0, loading: s.world.stats.loading ?? 0,
    created: s.actors.stats.created ?? 0, cri: s.actors.creatures.size, vegMB: s.veg.bytes ?? 0, cells: s.veg.stats?.cells ?? s.veg.stats?.celulas ?? null });
  window.__picos = []; window.__long = [];
  new PerformanceObserver(l => { for (const e of l.getEntries()) window.__long.push({ t: e.startTime, d: e.duration }); }).observe({ type: "longtask" });
  const orig = s.frame.bind(s); let last = 0, prev = st();
  s.frame = function (ui) {
    const t0 = performance.now(); orig(ui); const t1 = performance.now(); const c = st();
    const d = {}; for (const k of Object.keys(c)) if (c[k] !== prev[k] && typeof c[k] === "number") d[k] = +(c[k] - prev[k]).toFixed(3);
    window.__picos.push({ t: t0, intervalo: last ? t0 - last : null, cpuMs: +(t1 - t0).toFixed(2), d }); last = t0; prev = c;
  };
});
const t0 = Date.now(); const acoes = [];
const hunters = (await api("/api/v1/snapshot"))?.hunters?.filter(h => h.role === "hunter" && h.activity !== "morto").map(h => h.id) ?? [];
if (cen === "noite") { await api("/api/v1/tempo", { escala: 50 }); acoes.push({ s: 0, a: "×50 até a noite" }); }
if (cen === "viagem" && hunters[0]) { await api("/api/v1/orders", { type: "viajar", hunters: [hunters[0]], tile: "ER_21" }); await api("/api/v1/tempo", { escala: 10 }); acoes.push({ s: 0, a: "viajar ER_21 ×10" }); }
for (let i = 0; Date.now() - t0 < secs * 1000; i++) {
  if (cen === "noite") { const sn = await api("/api/v1/snapshot"); if (sn?.clock?.phase === "night") { await api("/api/v1/tempo", { escala: 1 }); } }
  if ((cen === "zoom" || cen === "noite") && i % 5 === 0) { const z = i % 10 === 0 ? 65 : 700; await p.evaluate(z => window.__wildhavenCamera.zoomTo(z), z); acoes.push({ s: (Date.now() - t0) / 1000, a: "zoom " + z }); }
  if (cen === "troca" && i % 6 === 0 && hunters.length > 1) { const id = hunters[(i / 6) % hunters.length]; await p.evaluate(n => { const c = document.querySelectorAll(".hcard")[n]; c?.click(); }, (i / 6) % hunters.length); acoes.push({ s: (Date.now() - t0) / 1000, a: "troca " + id }); }
  await p.waitForTimeout(1000);
}
if (cen === "noite" || cen === "viagem") await api("/api/v1/tempo", { escala: 1 });
const { fr, long, clock } = await p.evaluate(() => ({ fr: window.__picos, long: window.__long, clock: window.__wildhavenScene.S.snap.clock }));
const iv = fr.map(f => f.intervalo).filter(x => x).sort((a, b) => a - b), med = iv[Math.floor(iv.length / 2)];
const q = f => iv[Math.min(iv.length - 1, Math.ceil(iv.length * f) - 1)];
const picos = fr.filter(f => f.intervalo && f.intervalo > fator * med).map(f => {
  const lt = long.filter(l => l.t <= f.t && l.t + l.d >= f.t - f.intervalo).map(l => Math.round(l.d));
  const causas = [];
  if (f.d.prog > 0) causas.push(`shader: +${f.d.prog} programa(s)`);
  if (f.d.geo > 0) causas.push(`upload de geometria: +${f.d.geo}`);
  if (f.d.tex > 0) causas.push(`upload de textura: +${f.d.tex}`);
  if (f.d.nodes > 0) causas.push(`relevo: +${f.d.nodes} nó(s)`);
  if (f.d.created > 0) causas.push(`atores criados: +${f.d.created}`);
  if (f.d.vegMB) causas.push(`vegetação: ${f.d.vegMB > 0 ? "+" : ""}${(f.d.vegMB / 1048576).toFixed(1)} MB`);
  if (!causas.length) causas.push(f.cpuMs > 0.6 * f.intervalo ? "thread principal (sem mudança de recurso)" : "fora do frame (GC, rede, interface ou GPU)");
  return { s: +((f.t - fr[0].t) / 1000).toFixed(2), intervaloMs: Math.round(f.intervalo), cpuFrameMs: f.cpuMs, tarefasLongas: lt, causas, d: f.d };
});
// eventos de recurso por quadro (independem da velocidade da GPU): cada um custa também numa GPU real
const EV = ["prog", "geo", "tex", "nodes", "created"];
const eventos = fr.filter(f => EV.some(k => f.d[k])).map(f => ({ s: +((f.t - fr[0].t) / 1000).toFixed(2), intervaloMs: Math.round(f.intervalo ?? 0), xMediana: +((f.intervalo ?? 0) / med).toFixed(2), cpuFrameMs: f.cpuMs, d: Object.fromEntries(EV.filter(k => f.d[k]).map(k => [k, f.d[k]])) }));
const totais = Object.fromEntries(EV.map(k => [k, fr.reduce((s, f) => s + Math.max(0, f.d[k] ?? 0), 0)]));
const porCausa = {}; for (const k of picos) for (const c of k.causas) { const key = c.replace(/[+-]?\d+(\.\d+)?/g, "N"); porCausa[key] = (porCausa[key] ?? 0) + 1; }
const res = { cenario: cen, url: url.toString(), segundos: secs, relogio: clock, quadros: fr.length, mediaFps: +(1000 * fr.length / (fr.at(-1).t - fr[0].t)).toFixed(2),
  intervalos: { p50: med, p95: q(0.95), p99: q(0.99), max: iv.at(-1) }, limiarPico: Math.round(fator * med), picos: picos.length, porCausa, totaisDeEventos: totais, quadrosComEvento: eventos.length, eventos, acoes, detalhe: picos, errosPagina: errs };
fs.mkdirSync(A.out.split("/").slice(0, -1).join("/") || ".", { recursive: true });
fs.writeFileSync(A.out, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ ...res, eventos: eventos.slice(0, 40), detalhe: picos.slice(0, 25) }, null, 1));
await b.close();
