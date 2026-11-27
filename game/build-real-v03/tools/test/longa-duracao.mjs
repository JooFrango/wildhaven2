// Teste de longa duração (V03): um navegador num modo (3d | economico | oculto) por `--minutos`, com o servidor
// já rodando (pid em --server-pid). A cada `--intervalo` s grava: CPU do navegador (todos os processos) e do
// servidor (% de UM núcleo), RSS de ambos, heap JS, quadros desenhados, travamentos, tráfego WS, e do servidor:
// tick do intervalo (p50/p95/p99/máx), escala efetiva, dívida/descartes, criaturas, chunks. O JSON é regravado
// a cada amostra (sobrevive a interrupção). Ordem inicial: todos os Hunters exploram (mundo em movimento).
//   node tools/test/longa-duracao.mjs --url http://127.0.0.1:8792/ --modo economico --minutos 120 --server-pid N --out bench/longa-eco-2h.json
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const A = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith("--") ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const url = new URL(A.url ?? "http://127.0.0.1:8792/"), modo = A.modo ?? "economico", minutos = Number(A.minutos ?? 30), iv = Number(A.intervalo ?? 60);
if (modo === "economico") url.searchParams.set("perfil", "economico"); else if (A.perfil) url.searchParams.set("perfil", A.perfil);
const spid = Number(A["server-pid"]);
const cmd = p => { try { return fs.readFileSync(`/proc/${p}/cmdline`, "utf8"); } catch { return ""; } };
const st = p => { try { const s = fs.readFileSync(`/proc/${p}/stat`, "utf8"); const f = s.slice(s.lastIndexOf(")") + 2).split(" "); return +f[11] + +f[12]; } catch { return 0; } };
const rss = p => { try { return +/VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${p}/status`, "utf8"))[1] / 1024; } catch { return 0; } };
const chrome = () => fs.readdirSync("/proc").filter(d => /^\d+$/.test(d)).map(Number).filter(p => /chrom|headless_shell/.test(cmd(p)));
const before = new Set(chrome());
const base = `${url.protocol}//${url.host}`;
const snap = async () => { try { return await (await fetch(base + "/api/v1/snapshot")).json(); } catch { return null; } };
const s0 = await snap();
const ids = (s0?.hunters ?? []).filter(h => h.role === "hunter").map(h => h.id);
await fetch(base + "/api/v1/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "explorar", hunters: ids }) }).catch(() => {});
const b = await pw.chromium.launch({ channel: "chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
let wsBytes = 0; page.on("websocket", ws => ws.on("framereceived", f => { wsBytes += typeof f.payload === "string" ? Buffer.byteLength(f.payload) : f.payload.length; }));
const errors = []; page.on("pageerror", e => errors.push(e.message));
await page.goto(url.toString());
await page.waitForFunction(() => (window).__wildhavenPerf && Object.keys((window).__wildhavenPerf).length > 0, null, { timeout: 180000 });
await page.waitForTimeout(15000);
if (modo === "oculto") {
  const other = await ctx.newPage(); await other.goto("about:blank"); await other.bringToFront();
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
}
const pids = chrome().filter(p => !before.has(p));
const res = { schema: "wildhaven.teste.longo.v1", url: url.toString(), modo, minutosPedidos: minutos, inicio: new Date().toISOString(), renderer: "Chromium + SwiftShader (software)", amostras: [], errosPagina: errors };
const t0 = Date.now();
let lastC = pids.reduce((s, p) => s + st(p), 0), lastS = st(spid), lastT = Date.now(), lastWs = 0;
while (Date.now() - t0 < minutos * 60000) {
  await new Promise(r => setTimeout(r, iv * 1000));
  const now = Date.now(), dt = (now - lastT) / 1000;
  const c = pids.reduce((s, p) => s + st(p), 0), sv = st(spid);
  const pf = await page.evaluate(() => ({ p: (window).__wildhavenPerf, heap: (performance).memory?.usedJSHeapSize / 1048576 })).catch(() => ({ p: null, heap: null }));
  const sn = await snap();
  const se = sn?.server ?? {};
  res.amostras.push({
    min: +((now - t0) / 60000).toFixed(2), cpuNavegador: ((c - lastC) / 100 / dt) * 100, cpuServidor: ((sv - lastS) / 100 / dt) * 100,
    rssNavegadorMB: pids.reduce((s, p) => s + rss(p), 0), rssServidorMB: rss(spid), heapMB: pf.heap, quadros: pf.p?.framesDrawn ?? null, travamentos50: pf.p?.stalls50 ?? null, modoCliente: pf.p?.mode ?? null,
    wsBps: (wsBytes - lastWs) / dt, tickP99: se.intervalo_ms?.p99 ?? null, tickMax: se.intervalo_ms?.max ?? null, escalaEfetiva: se.escala_efetiva ?? null, divida: se.divida_passos ?? null, descartados: se.passos_descartados ?? null,
    criaturas: sn?.game?.metrics?.creatures_total ?? null, chunksFisicos: se.terreno?.resident_chunks ?? null, simTime: sn?.sim_time_s ?? null, vivos: (sn?.hunters ?? []).filter(h => h.alive).length,
  });
  lastC = c; lastS = sv; lastT = now; lastWs = wsBytes;
  res.fim = new Date().toISOString();
  fs.writeFileSync(A.out ?? `longa-${modo}.json`, JSON.stringify(res, null, 1));
}
const a = res.amostras, first = a[Math.min(2, a.length - 1)], last = a.at(-1);
res.resumo = { minutos: last?.min, cpuNavegadorMedia: a.reduce((s, x) => s + x.cpuNavegador, 0) / a.length, cpuServidorMedia: a.reduce((s, x) => s + x.cpuServidor, 0) / a.length, rssNavegadorInicioFim: [first?.rssNavegadorMB, last?.rssNavegadorMB], heapInicioFim: [first?.heapMB, last?.heapMB], rssServidorInicioFim: [first?.rssServidorMB, last?.rssServidorMB], tickMaxPior: Math.max(...a.map(x => x.tickMax ?? 0)), descartadosFim: last?.descartados, errosPagina: errors.length };
fs.writeFileSync(A.out ?? `longa-${modo}.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res.resumo));
await b.close();
