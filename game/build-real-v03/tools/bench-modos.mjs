// Benchmark reproduzível do cliente por MODO (V02 ou V03, mesmas condições):
//   node tools/bench-modos.mjs --url http://127.0.0.1:8790/ --modo 3d|economico|oculto --secs 60 --out x.json [--server-pid N] [--perfil baixo]
// Mede: CPU de TODOS os processos do navegador (/proc, % de UM núcleo) e do servidor; intervalos reais de
// requestAnimationFrame (p50/p95/p99, 1% low, travamentos > 50 ms e > 100 ms) gravados por um script
// injetado antes do jogo (independe do código medido); quadros efetivamente desenhados (contador do jogo,
// quando existe); heap JS; RSS somado; bytes e mensagens WebSocket recebidos por segundo; long tasks.
// ATENÇÃO: neste contêiner o Chromium renderiza por SOFTWARE (SwiftShader): CPU do modo 3D inclui a
// rasterização que numa GPU real não pesa na CPU. Econômico e oculto não dependem disso.
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const A = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith("--") ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const url = new URL(A.url ?? "http://127.0.0.1:8790/");
if (A.perfil) url.searchParams.set("perfil", A.perfil);
const modo = A.modo ?? "3d", secs = Number(A.secs ?? 60), warm = Number(A.warm ?? 25);
const HZ = 100; // ticks de CPU por segundo (Linux)
const procStat = pid => { try { const s = fs.readFileSync(`/proc/${pid}/stat`, "utf8"); const f = s.slice(s.lastIndexOf(")") + 2).split(" "); return { ppid: +f[1], t: +f[11] + +f[12] }; } catch { return null; } };
const rss = pid => { try { return +/VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${pid}/status`, "utf8"))[1] / 1024; } catch { return 0; } };
const tree = root => { const all = fs.readdirSync("/proc").filter(d => /^\d+$/.test(d)).map(Number); const out = new Set([root]); let grew = true; while (grew) { grew = false; for (const p of all) { const s = procStat(p); if (s && out.has(s.ppid) && !out.has(p)) { out.add(p); grew = true; } } } return [...out]; };
const cpuOf = pids => pids.reduce((a, p) => a + (procStat(p)?.t ?? 0), 0);

const cmd = pid => { try { return fs.readFileSync(`/proc/${pid}/cmdline`, "utf8"); } catch { return ""; } };
const chromePids = () => fs.readdirSync("/proc").filter(d => /^\d+$/.test(d)).map(Number).filter(p => /chrom|headless_shell/.test(cmd(p)));
const before = new Set(chromePids());
const browser = await pw.chromium.launch({ channel: process.env.BENCH_CHANNEL ?? "chromium", headless: !process.env.DISPLAY, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
if (A["sem-raf"]) await page.addInitScript(() => { (window).__semRaf = true; });
await page.addInitScript(() => {
  const w = window; w.__bench = { frames: [], long: 0, longMs: 0 };
  if ((window).__semRaf) return;
  let last = 0; const f = t => { if (last) w.__bench.frames.push(t - last); last = t; if (w.__bench.frames.length > 200000) w.__bench.frames.splice(0, 100000); requestAnimationFrame(f); }; requestAnimationFrame(f);
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) { w.__bench.long++; w.__bench.longMs += e.duration; } }).observe({ type: "longtask", buffered: true }); } catch { /* sem long tasks */ }
});
let wsBytes = 0, wsMsgs = 0;
page.on("websocket", ws => ws.on("framereceived", f => { wsMsgs++; wsBytes += typeof f.payload === "string" ? Buffer.byteLength(f.payload) : f.payload.length; }));
const logs = []; page.on("console", m => logs.push(m.type() + ": " + m.text())); page.on("pageerror", e => logs.push("pageerror: " + e.message));
const t0 = Date.now();
await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => (window).__wildhavenPerf && Object.keys((window).__wildhavenPerf).length > 0, null, { timeout: 120000 }).catch(() => logs.push("bench: __wildhavenPerf não apareceu"));
const loadS = (Date.now() - t0) / 1000;
let other = null;
if (modo === "economico") await page.evaluate(() => (window).__wildhavenSetMode?.(true));
await page.waitForTimeout(warm * 1000);
if (modo === "oculto") {
  // Emulação de aba oculta/minimizada: outra aba vai para frente (o Chromium estrangula rAF e timers como
  // em segundo plano real) e document.visibilityState passa a "hidden" com o evento visibilitychange
  // (o Chromium headless não altera a visibilidade sozinho). A V02 ignora esse evento; a V03 reage a ele.
  other = await ctx.newPage(); await other.goto("about:blank"); await other.bringToFront();
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(3000);
}
const vis = await page.evaluate(() => document.visibilityState);
const pids = chromePids().filter(p => !before.has(p));
const spid = A["server-pid"] ? Number(A["server-pid"]) : null;
await page.evaluate(() => { (window).__bench.frames.length = 0; (window).__bench.long = 0; (window).__bench.longMs = 0; (window).__bench.drawn0 = (window).__wildhavenPerf?.framesDrawn ?? null; });
const c0 = cpuOf(pids), s0 = spid ? procStat(spid)?.t ?? 0 : 0, w0 = wsBytes, m0 = wsMsgs, tm0 = Date.now();
const series = [];
for (let i = 0; i < secs; i += 5) {
  const a = cpuOf(pids), sa = spid ? procStat(spid)?.t ?? 0 : 0, ta = Date.now();
  await new Promise(r => setTimeout(r, 5000));
  const dt = (Date.now() - ta) / 1000;
  series.push({ t: Math.round((Date.now() - tm0) / 1000), cpuNavegadorPct: ((cpuOf(pids) - a) / HZ / dt) * 100, cpuServidorPct: spid ? (((procStat(spid)?.t ?? 0) - sa) / HZ / dt) * 100 : null, rssNavegadorMB: pids.reduce((s, p) => s + rss(p), 0) });
}
const wall = (Date.now() - tm0) / 1000;
const b = await page.evaluate(() => { const B = (window).__bench, p = (window).__wildhavenPerf ?? {}; return { frames: B.frames.slice(), long: B.long, longMs: B.longMs, heapMB: (performance).memory ? (performance).memory.usedJSHeapSize / 1048576 : null, perf: p, drawn: p.framesDrawn != null && B.drawn0 != null ? p.framesDrawn - B.drawn0 : null }; });
const fr = b.frames.slice().sort((x, y) => x - y), q = p => (fr.length ? fr[Math.min(fr.length - 1, Math.floor((fr.length - 1) * p))] : null);
const worst = fr.slice(-Math.max(1, Math.floor(fr.length / 100)));
const res = {
  schema: "wildhaven.bench.cliente.v1", url: url.toString(), modo, visibilityState: vis, segundos: wall, carregamento_s: loadS,
  renderer: "Chromium headless + SwiftShader (software) — CPU do 3D inclui rasterização por software; não representa GPU real",
  cpu_navegador_pct_nucleo: ((cpuOf(pids) - c0) / HZ / wall) * 100,
  cpu_servidor_pct_nucleo: spid ? ((((procStat(spid)?.t ?? 0) - s0) / HZ) / wall) * 100 : null,
  rss_navegador_mb: pids.reduce((s, p) => s + rss(p), 0), rss_servidor_mb: spid ? rss(spid) : null, heap_js_mb: b.heapMB,
  raf: { quadros: fr.length, por_s: fr.length / wall, p50_ms: q(0.5), p95_ms: q(0.95), p99_ms: q(0.99), max_ms: fr.at(-1) ?? null, low1_fps: worst.length ? 1000 / (worst.reduce((s, x) => s + x, 0) / worst.length) : null, travamentos_50ms: fr.filter(x => x > 50).length, travamentos_100ms: fr.filter(x => x > 100).length },
  quadros_desenhados_jogo: b.drawn, long_tasks: b.long, long_tasks_ms: b.longMs,
  ws: { bytes_por_s: (wsBytes - w0) / wall, msgs_por_s: (wsMsgs - m0) / wall },
  perf_jogo: b.perf, serie: series, logs: logs.slice(-20),
};
fs.writeFileSync(A.out ?? `bench-${modo}.json`, JSON.stringify(res, null, 2));
console.log(modo, vis, "cpu nav %", res.cpu_navegador_pct_nucleo.toFixed(1), "srv %", res.cpu_servidor_pct_nucleo?.toFixed?.(1), "rss MB", res.rss_navegador_mb.toFixed(0), "heap", b.heapMB?.toFixed?.(0), "raf/s", res.raf.por_s.toFixed(1), "p95", res.raf.p95_ms?.toFixed?.(1), "ws B/s", res.ws.bytes_por_s.toFixed(0));
await browser.close();
