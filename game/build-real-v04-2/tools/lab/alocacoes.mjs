// V04.1 — laboratório de alocação e coleta de lixo na cena 3D: quanto lixo cada quadro cria, ONDE ele é criado
// (amostragem do HeapProfiler por função/linha do bundle) e quanto o GC pausa (trace do Chrome, eventos V8).
// Não altera o jogo. Renderização por SOFTWARE (SwiftShader): os tempos de quadro não valem para GPU real, mas
// alocação e pausas de GC são trabalho de CPU do processo da página e se transferem.
//   node tools/lab/alocacoes.mjs --url http://127.0.0.1:8810/ --assentar 40 --segundos 20 --out bench/v04-1/alocacoes.json [--perfil medio]
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const A = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith("--") ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const url = new URL(A.url ?? "http://127.0.0.1:8810/"); url.searchParams.set("perfil", A.perfil ?? "medio");
const settle = Number(A.assentar ?? 40), secs = Number(A.segundos ?? 20);
const b = await pw.chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info", "--js-flags=--expose-gc"] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on("pageerror", e => errs.push(e.message));
await p.goto(url.toString());
await p.waitForFunction(() => window.__wildhavenDbg?.().laco === "3d" && window.__wildhavenPerf?.drawCalls > 0, null, { timeout: 240000 });
await p.waitForTimeout(settle * 1000);
const cdp = await p.context().newCDPSession(p);
await cdp.send("HeapProfiler.enable");
const frames0 = await p.evaluate(() => window.__wildhavenPerf.framesDrawn);
const heap0 = await cdp.send("Runtime.getHeapUsage");
await b.startTracing(p, { categories: ["v8", "v8.gc", "disabled-by-default-v8.gc", "devtools.timeline"] });
await cdp.send("HeapProfiler.startSampling", { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
const t0 = Date.now();
await p.waitForTimeout(secs * 1000);
const { profile } = await cdp.send("HeapProfiler.stopSampling");
const trace = JSON.parse((await b.stopTracing()).toString());
const wall = (Date.now() - t0) / 1000;
const frames = (await p.evaluate(() => window.__wildhavenPerf.framesDrawn)) - frames0;
const perfNow = await p.evaluate(() => { const f = window.__wildhavenPerf; return { fps: f.fps, drawCalls: f.drawCalls, triangles: f.triangles, heapMB: f.heapMB, mode: f.mode, resScale: f.resScale }; });
// alocação por função (amostras do perfil de heap, incluindo objetos já coletados = lixo)
const byFn = new Map(); let total = 0;
const walk = (n, stack) => {
  const cf = n.callFrame, k = `${cf.functionName || "(anônima)"} ${cf.url.split("/").pop()}:${cf.lineNumber + 1}:${cf.columnNumber + 1}`;
  if (n.selfSize) { byFn.set(k, (byFn.get(k) ?? 0) + n.selfSize); total += n.selfSize; }
  for (const c of n.children ?? []) walk(c, stack);
};
walk(profile.head, []);
const top = [...byFn].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([fn, bytes]) => ({ fn, MB: +(bytes / 1048576).toFixed(2), KBporQuadro: +(bytes / 1024 / Math.max(1, frames)).toFixed(1), pct: +(100 * bytes / total).toFixed(1) }));
// pausas de GC no thread principal da página (eventos completos "X" com nome de GC)
const evs = (trace.traceEvents ?? []).filter(e => e.ph === "X" && /^(MinorGC|MajorGC|V8\.GC_SCAVENGER|V8\.GC_MARK_COMPACTOR|V8\.GCScavenger|V8\.GCFinalizeMC|V8\.GCIncrementalMarking|V8\.GC_MC_INCREMENTAL|V8\.GC_MINOR_MARK_SWEEPER|V8\.GCCompactor)$/.test(e.name));
const gc = {};
for (const e of evs) { const g = (gc[e.name] ??= { n: 0, ms: 0, maxMs: 0 }); g.n++; g.ms += e.dur / 1000; g.maxMs = Math.max(g.maxMs, e.dur / 1000); }
for (const g of Object.values(gc)) { g.ms = +g.ms.toFixed(1); g.maxMs = +g.maxMs.toFixed(1); }
const res = { url: url.toString(), segundos: +wall.toFixed(1), quadros: frames, perf: perfNow, heapInicialMB: +(heap0.usedSize / 1048576).toFixed(1),
  alocadoMB: +(total / 1048576).toFixed(1), MBporS: +(total / 1048576 / wall).toFixed(2), KBporQuadro: +(total / 1024 / Math.max(1, frames)).toFixed(1), gc, topAlocacoes: top, errosPagina: errs };
fs.mkdirSync(A.out.split("/").slice(0, -1).join("/") || ".", { recursive: true });
fs.writeFileSync(A.out, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ ...res, topAlocacoes: top.slice(0, 15) }, null, 1));
await b.close();
