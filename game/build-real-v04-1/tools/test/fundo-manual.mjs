// V04.1 — segundo plano manual (BG-01): suspensão e retomada pelo botão, eventos preservados, troca de região e
// descarte do 3D durante a suspensão, reconexão com o servidor reiniciado, suspensão no meio do carregamento
// inicial e ausência longa (velocidade ×50). Grava cada etapa em --out.
//   node tools/test/fundo-manual.mjs --url http://127.0.0.1:8812/ --server-cmd "<comando que sobe o servidor>" --out bench/fundo-manual.json
import { createRequire } from "node:module";
import fs from "node:fs";
import { spawn } from "node:child_process";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const A = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith("--") ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const url = A.url ?? "http://127.0.0.1:8812/", base = url.replace(/\/$/, ""), longMin = Number(A["longo-min"] ?? 10);
const out = { url, inicio: new Date().toISOString(), etapas: [], errosPagina: [] };
const save = () => fs.writeFileSync(A.out, JSON.stringify(out, null, 1));
const step = (nome, ok, dados = {}) => { out.etapas.push({ nome, ok, t: new Date().toISOString(), ...dados }); save(); console.log((ok ? "ok   " : "FALHA"), nome, JSON.stringify(dados)); };
const api = async (p, body) => (await fetch(base + p, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {})).json();
let server = null;
const startServer = async () => {
  if (!A["server-cmd"]) return;
  server = spawn("bash", ["-c", "exec " + A["server-cmd"]], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) { try { if ((await (await fetch(base + "/api/v1/health")).text()).trim() === "ok") return; } catch {} await new Promise(r => setTimeout(r, 500)); }
  throw new Error("servidor não subiu");
};
await startServer();
const b = await pw.chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage();
p.on("pageerror", e => out.errosPagina.push(e.message));
let ws = 0; p.on("websocket", w => w.on("framereceived", f => { ws += typeof f.payload === "string" ? Buffer.byteLength(f.payload) : f.payload.length; }));
const dbg = () => p.evaluate(() => ({ ...window.__wildhavenDbg(), modo: window.__wildhavenPerf?.mode, aviso: getComputedStyle(document.getElementById("fundo-manual")).display, rede: window.__wildhavenPerf?.rede }));
const rate = async ms => { const q0 = (await dbg()).quadros, w0 = ws; await p.waitForTimeout(ms); const d = await dbg(); return { quadrosPorS: +((d.quadros - q0) / (ms / 1000)).toFixed(2), wsBps: Math.round((ws - w0) / (ms / 1000)), ...d }; };

// 1) suspensão no meio do carregamento inicial (Shift+F8 assim que a página responde)
await p.goto(url + "?perfil=baixo", { waitUntil: "domcontentloaded" });
await p.waitForFunction(() => document.readyState !== "loading");
await p.keyboard.press("Shift+F8");
await p.waitForFunction(() => window.__wildhavenDbg, null, { timeout: 180000 });
let d = await rate(5000);
step("suspensão durante o carregamento inicial: sem quadros", d.quadrosPorS === 0 && d.laco !== "3d", d);
await p.click("#fundo-manual");
await p.waitForFunction(() => window.__wildhavenDbg().laco === "3d", null, { timeout: 180000 });
d = await rate(5000);
step("retomada após suspensão no carregamento: 3D desenhando", d.quadrosPorS > 0 && d.laco === "3d", d);

// 2) suspensão pelo botão do relógio; tráfego reduzido e nenhum quadro
const ativo = await rate(10000);
await p.click(".relogio .fundo-btn");
await p.waitForTimeout(1500);
d = await rate(10000);
step("botão do relógio suspende: 0 quadros, aviso visível, tráfego menor", d.quadrosPorS === 0 && d.aviso === "flex" && d.wsBps < ativo.wsBps, { ativoWsBps: ativo.wsBps, ...d });

// 3) eventos e troca de região durante a suspensão (3D descartado após 60 s), ×50
const s0 = await api("/api/v1/snapshot");
const h = s0.hunters.find(x => x.role === "hunter" && x.activity !== "morto");
const ev0 = (s0.game?.events ?? []).length;
const rota = await api(`/api/v1/rota?tile=ER_21&hunter=${h.id}`);
await api("/api/v1/orders", { type: "viajar", hunters: [h.id], tile: rota.ok ? "ER_21" : "ER_18" });
await api("/api/v1/tempo", { escala: 50 });
await p.waitForTimeout(75000);
d = await dbg();
step("após 75 s suspenso: 3D descartado, 0 quadros", !d.cena && d.modo === "suspenso", d);
await api("/api/v1/tempo", { escala: 1 });
const s1 = await api("/api/v1/snapshot");
await p.click("#fundo-manual");
await p.waitForFunction(() => window.__wildhavenDbg().laco === "3d" && !window.__wildhavenDbg().visivel, null, { timeout: 240000 });
d = await rate(5000);
const feed = await p.evaluate(() => document.querySelectorAll(".feed > *").length);
const h1 = s1.hunters.find(x => x.id === h.id);
step("retomada após troca de região: 3D recriado, tela de carregamento fechada", d.laco === "3d" && d.quadrosPorS > 0 && !d.visivel, { hunter: h.id, hexAntes: h.tile_id, hexDepois: h1?.tile_id, atividade: h1?.activity, ...d });
step("eventos do servidor preservados durante a suspensão", (s1.game?.events ?? []).length >= ev0, { eventosAntes: ev0, eventosDepois: (s1.game?.events ?? []).length, linhasNoFeed: feed });

// 4) reconexão: servidor reiniciado enquanto suspenso
if (A["server-cmd"]) {
  await p.click(".relogio .fundo-btn"); await p.waitForTimeout(1500);
  const r0 = (await dbg()).rede?.reconexoes ?? 0;
  server.kill("SIGTERM"); await new Promise(r => server.once("exit", r));
  await p.waitForTimeout(4000);
  await startServer();
  await p.waitForFunction(r0 => window.__wildhavenPerf?.rede?.conectado && window.__wildhavenPerf.rede.reconexoes > r0, r0, { timeout: 120000 }).catch(() => {});
  await p.click("#fundo-manual");
  await p.waitForFunction(() => window.__wildhavenDbg().laco === "3d" && !window.__wildhavenDbg().visivel, null, { timeout: 240000 }).catch(() => {});
  d = await rate(5000);
  step("reconexão durante a suspensão e retomada", d.rede?.conectado && d.rede.reconexoes > r0 && d.quadrosPorS > 0, d);
}

// 5) ausência longa: `longo-min` minutos reais suspenso em ×50 (≈ longo-min × 50 min de jogo)
await p.click(".relogio .fundo-btn"); await p.waitForTimeout(1500);
const t0 = (await api("/api/v1/snapshot")).sim_time_s;
await api("/api/v1/tempo", { escala: 50 });
const q0 = (await dbg()).quadros;
await p.waitForTimeout(longMin * 60000);
await api("/api/v1/tempo", { escala: 1 });
const t1 = (await api("/api/v1/snapshot")).sim_time_s;
d = await dbg();
const qLong = d.quadros - q0;
await p.click("#fundo-manual");
await p.waitForFunction(() => window.__wildhavenDbg().laco === "3d" && !window.__wildhavenDbg().visivel, null, { timeout: 240000 }).catch(() => {});
const d2 = await rate(5000);
step(`ausência de ${longMin} min reais em ×50 (${((t1 - t0) / 3600).toFixed(1)} h de jogo): 0 quadros e retomada`, qLong === 0 && d2.laco === "3d" && d2.quadrosPorS > 0, { horasDeJogo: +((t1 - t0) / 3600).toFixed(2), quadrosDuranteAusencia: qLong, ...d2 });

out.fim = new Date().toISOString(); out.errosPagina = out.errosPagina; save();
await b.close(); server?.kill("SIGTERM");
console.log("erros de página:", out.errosPagina.length);
