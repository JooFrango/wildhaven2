// Capturas reais do cliente V02 em sequência (headless). Uso:
//   node capturas.mjs <url> <pasta> '<json: [{"espera":ms}|{"tecla":"m"}|{"js":"..."}|{"foto":"nome"}]>'
// Renderização por SOFTWARE neste ambiente (SwiftShader): imagens valem como evidência visual, não de FPS.
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const [url, dir, stepsJson] = process.argv.slice(2);
fs.mkdirSync(dir, { recursive: true });
const browser = await pw.chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const logs = [];
page.on("pageerror", e => logs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/404/.test(m.text())) logs.push(m.text()); });
await page.goto(url, { waitUntil: "domcontentloaded" });
for (const s of JSON.parse(stepsJson)) {
  if (s.espera) await page.waitForTimeout(s.espera);
  if (s.tecla) await page.keyboard.press(s.tecla);
  if (s.js) console.log("js:", String(JSON.stringify(await page.evaluate(s.js))).slice(0, 400));
  if (s.foto) { await page.screenshot({ path: `${dir}/${s.foto}.png` }); console.log("foto", s.foto); }
}
console.log(logs.slice(-10).join("\n"));
await browser.close();
