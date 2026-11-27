// Perfil de CPU do Modo Econômico num servidor já em andamento (ex.: após 2 h de exploração):
// CPU por processo do navegador (renderizador, GPU, navegador), estatísticas da vista econômica e perfil JS por CDP.
//   node tools/test/perfil-economico.mjs --url http://127.0.0.1:8792/ --segundos 40 --out perfil.json
import fs from "node:fs";
import { createRequire } from "node:module";
import { browserTree } from "./proc.mjs";
const require = createRequire(import.meta.url);
const pw = require("playwright");
const A = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith("--") ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const url = new URL(A.url ?? "http://127.0.0.1:8792/"); url.searchParams.set("perfil", "economico");
const secs = Number(A.segundos ?? 40);
const PROFILE = fs.mkdtempSync("/tmp/claude-0/prof/p-");
const ctx = await pw.chromium.launchPersistentContext(PROFILE, { viewport: { width: 1280, height: 720 }, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = ctx.pages()[0] ?? await ctx.newPage();
await page.goto(url.toString());
await page.waitForFunction(() => window.__wildhavenPerf && Object.keys(window.__wildhavenPerf).length > 0, null, { timeout: 180000 });
await page.waitForTimeout(20000);
const cmd = p => { try { return fs.readFileSync(`/proc/${p}/cmdline`, "utf8").replace(/\0/g, " "); } catch { return ""; } };
const st = p => { try { const s = fs.readFileSync(`/proc/${p}/stat`, "utf8"); const f = s.slice(s.lastIndexOf(")") + 2).split(" "); return +f[11] + +f[12]; } catch { return 0; } };
const pids = browserTree(PROFILE);
const kind = p => (/--type=(\S+)/.exec(cmd(p)) ?? [, "browser"])[1] + (/utility-sub-type=(\S+)/.exec(cmd(p)) ? ":" + /utility-sub-type=(\S+)/.exec(cmd(p))[1] : "");
const cdp = await ctx.newCDPSession(page);
await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 500 }); await cdp.send("Profiler.start");
const c0 = new Map(pids.map(p => [p, st(p)])), t0 = Date.now();
const eco0 = await page.evaluate(() => JSON.parse(JSON.stringify(window.__wildhavenPerf)));
await page.waitForTimeout(secs * 1000);
const dt = (Date.now() - t0) / 1000;
const { profile } = await cdp.send("Profiler.stop");
const eco1 = await page.evaluate(() => JSON.parse(JSON.stringify(window.__wildhavenPerf)));
const porProc = {}; for (const p of pids) { const k = kind(p); porProc[k] = (porProc[k] ?? 0) + ((st(p) - c0.get(p)) / dt); }
// tempo próprio por função (amostras)
const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
const dts = profile.timeDeltas; profile.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) ?? 0) + (dts[i] ?? 0) / 1000); });
const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, ms]) => ({ fn: k, msPorS: +(ms / dt).toFixed(2) }));
const out = { url: url.toString(), segundos: dt, cpuPorProcessoPct: porProc, cpuTotalPct: Object.values(porProc).reduce((a, b) => a + b, 0), eco0, eco1, topJS: top };
fs.writeFileSync(A.out ?? "perfil-economico.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify({ cpu: out.cpuPorProcessoPct, total: out.cpuTotalPct, top: top.slice(0, 15) }, null, 1));
await ctx.close();
