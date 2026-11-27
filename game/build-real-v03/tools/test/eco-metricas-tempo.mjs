// Diagnóstico do Modo Econômico ao longo do tempo: CPU por processo + métricas do Blink por CDP (nós do DOM,
// layouts, recálculos de estilo, ouvintes, documentos) a cada minuto, na mesma página aberta por `--minutos`.
import fs from "node:fs";
import { createRequire } from "node:module";
import { browserTree, ticks } from "./proc.mjs";
const require = createRequire(import.meta.url);
const pw = require("playwright");
const A = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith("--") ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const url = new URL(A.url ?? "http://127.0.0.1:8792/"); url.searchParams.set("perfil", "economico");
const PROFILE = fs.mkdtempSync("/tmp/claude-0/prof/m-");
const ctx = await pw.chromium.launchPersistentContext(PROFILE, { viewport: { width: 1280, height: 720 }, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = ctx.pages()[0] ?? await ctx.newPage();
await page.goto(url.toString());
await page.waitForFunction(() => window.__wildhavenPerf && Object.keys(window.__wildhavenPerf).length > 0, null, { timeout: 180000 });
const cdp = await ctx.newCDPSession(page); await cdp.send("Performance.enable");
const cmd = p => { try { return fs.readFileSync(`/proc/${p}/cmdline`, "utf8"); } catch { return ""; } };
const kind = p => (/--type=([\w-]+)/.exec(cmd(p)) ?? [, "browser"])[1];
const out = { url: url.toString(), inicio: new Date().toISOString(), amostras: [] };
let prev = null, pm0 = null, tPrev = Date.now();
const t0 = Date.now();
while (Date.now() - t0 < Number(A.minutos ?? 45) * 60000) {
  const pids = browserTree(PROFILE), now = Date.now();
  const cur = {}; for (const p of pids) cur[kind(p)] = (cur[kind(p)] ?? 0) + ticks(p);
  const m = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(x => [x.name, x.value]));
  const dom = await page.evaluate(() => ({ nos: document.getElementsByTagName("*").length, iframes: document.querySelectorAll("iframe").length, canvases: document.querySelectorAll("canvas").length, notas: document.querySelectorAll(".nota").length, anim: document.getAnimations().length, eco: window.__wildhavenPerf?.economico, ws: window.__wildhavenPerf?.rede?.bytesRecebidos }));
  if (prev) {
    const dt = (now - tPrev) / 1000, cpu = {}; for (const k in cur) cpu[k] = +(((cur[k] - (prev[k] ?? 0)) / dt)).toFixed(1);
    const d = k => +((m[k] - pm0[k]) / dt).toFixed(2);
    out.amostras.push({ min: +((now - t0) / 60000).toFixed(1), cpu, layoutsPorS: d("LayoutCount"), estilosPorS: d("RecalcStyleCount"), layoutMsPorS: +(d("LayoutDuration") * 1000).toFixed(1), estiloMsPorS: +(d("RecalcStyleDuration") * 1000).toFixed(1), scriptMsPorS: +(d("ScriptDuration") * 1000).toFixed(1), tarefaMsPorS: +(d("TaskDuration") * 1000).toFixed(1), nosBlink: m.Nodes, ouvintes: m.JSEventListeners, documentos: m.Documents, frames: m.Frames, heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), ...dom });
    fs.writeFileSync(A.out, JSON.stringify(out, null, 1));
  }
  prev = cur; pm0 = m; tPrev = now;
  await new Promise(r => setTimeout(r, 60000));
}
await ctx.close();
