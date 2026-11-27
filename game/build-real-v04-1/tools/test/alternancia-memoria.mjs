// Alternância repetida 3D ↔ Econômico: mede heap JS, RSS do navegador e VRAM estimada ao fim de cada fase.
// Ciclo: 3D por `--tres` s, depois Econômico por `--eco` s (> 60 s para o 3D ser descartado). Critério: a
// memória ao fim de cada fase Econômica não cresce de ciclo para ciclo (estabiliza).
//   node tools/test/alternancia-memoria.mjs --url http://127.0.0.1:8791/ --ciclos 5 --tres 20 --eco 70 --out bench/v03-alternancia.json
import { createRequire } from "node:module";
import fs from "node:fs";
import { browserTree, uniqueProfile, rss as rssOf } from "./proc.mjs";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const A = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith("--") ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const ciclos = Number(A.ciclos ?? 5), tres = Number(A.tres ?? 20), eco = Number(A.eco ?? 70);
const cmd = pid => { try { return fs.readFileSync(`/proc/${pid}/cmdline`, "utf8"); } catch { return ""; } };
const rss = pid => { try { return +/VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${pid}/status`, "utf8"))[1] / 1024; } catch { return 0; } };
const chrome = () => fs.readdirSync("/proc").filter(d => /^\d+$/.test(d)).map(Number).filter(p => /chrom|headless_shell/.test(cmd(p)));
const PROFILE = uniqueProfile("alternan");
const bCtx = await pw.chromium.launchPersistentContext(PROFILE, { channel: "chromium", viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-precise-memory-info", "--js-flags=--expose-gc"] });
const b = { close: () => bCtx.close() };
const p = bCtx.pages()[0] ?? await bCtx.newPage();
await p.goto(A.url ?? "http://127.0.0.1:8791/");
await p.waitForFunction(() => (window).__wildhavenPerf?.framesDrawn > 5, null, { timeout: 180000 });
const cdp = await bCtx.newCDPSession(p);
const sample = async fase => {
  // heap exato: coleta de lixo completa e uso real (performance.memory é atrasado/arredondado)
  await cdp.send("HeapProfiler.collectGarbage");
  const hu = await cdp.send("Runtime.getHeapUsage");
  const s = await p.evaluate(() => ({ heap: 0, perf: window.__wildhavenPerf }));
  s.heap = hu.usedSize / 1048576;
  const r = browserTree(PROFILE).reduce((t, x) => t + rss(x), 0);
  return { fase, heapMB: s.heap, rssMB: r, vramEstMB: s.perf?.vramEstMB ?? null, loops: s.perf?.loops, nosRelevoRAM: s.perf?.streaming?.relevo?.emRAM ?? null, geometrias: s.perf?.geometries ?? null };
};
const out = [await sample("inicio-3d")];
for (let c = 1; c <= ciclos; c++) {
  await p.evaluate(() => window.__wildhavenSetMode(true)); await p.waitForTimeout(eco * 1000); out.push({ ciclo: c, ...(await sample("fim-eco")) });
  await p.evaluate(() => window.__wildhavenSetMode(false)); await p.waitForTimeout(tres * 1000); out.push({ ciclo: c, ...(await sample("fim-3d")) });
  console.log(JSON.stringify(out.slice(-2)));
}
const ecoHeaps = out.filter(o => o.fase === "fim-eco").map(o => o.heapMB), ecoRss = out.filter(o => o.fase === "fim-eco").map(o => o.rssMB);
const res = { schema: "wildhaven.teste.alternancia.v1", ciclos, segundos3D: tres, segundosEco: eco, amostras: out, crescimentoHeapEco_MB: ecoHeaps.at(-1) - ecoHeaps[1], crescimentoRssEco_MB: ecoRss.at(-1) - ecoRss[1], renderer: "SwiftShader (software)" };
fs.writeFileSync(A.out ?? "alternancia.json", JSON.stringify(res, null, 2));
console.log("crescimento heap (eco, ciclo 2→último):", res.crescimentoHeapEco_MB.toFixed(1), "MB; RSS:", res.crescimentoRssEco_MB.toFixed(0), "MB");
await b.close();
