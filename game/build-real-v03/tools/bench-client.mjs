// Benchmark headless do cliente (V01 ou V02): coleta draw calls, triângulos e tempo de quadro.
// Uso: node bench-client.mjs <url> <saida.json> [segundos] [rótulo]
// ATENÇÃO: neste ambiente o Chromium renderiza por SOFTWARE (SwiftShader). Draw calls e
// triângulos independem do hardware; FPS/tempo de quadro aqui NÃO representam GPU real.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
import fs from "node:fs";
const [url, out, secs = "40", label = "cena"] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const logs = [];
page.on("console", m => logs.push(m.type() + ": " + m.text()));
page.on("pageerror", e => logs.push("pageerror: " + e.message));
const t0 = Date.now();
await page.goto(url, { waitUntil: "domcontentloaded" });
const samples = [];
for (let i = 0; i < Number(secs); i += 5) {
  await page.waitForTimeout(5000);
  const p = await page.evaluate(() => (window).__wildhavenPerf ?? null);
  if (p) samples.push({ t: (Date.now() - t0) / 1000, ...p });
}
const shot = out.replace(/\.json$/, ".png");
await page.screenshot({ path: shot });
const last = samples.at(-1) ?? null;
const max = k => Math.max(0, ...samples.map(s => s[k] ?? 0));
const res = { label, url, renderer: "Chromium headless + SwiftShader (software) — FPS não representa GPU", viewport: "1280x720@1", last, maxDrawCalls: max("drawCalls"), maxTriangles: max("triangles"), samples, logs: logs.slice(-30), screenshot: shot };
fs.writeFileSync(out, JSON.stringify(res, null, 2));
console.log(label, "drawCalls", last?.drawCalls, "max", res.maxDrawCalls, "tri", last?.triangles, "max", res.maxTriangles, "frameMs", last?.frameMs?.toFixed?.(1), "fps", last?.fps?.toFixed?.(1));
await browser.close();
