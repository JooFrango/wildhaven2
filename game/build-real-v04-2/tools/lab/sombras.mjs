// V04.2 — experimento isolado de sombras (não muda o jogo): mesma cena e câmera fixa, quatro modos alternados
// A/B/C/D/D/C/B/A, mediana do intervalo de quadro em cada janela e captura PNG de cada modo para comparar o visual.
//   atual       — mapa de sombra atualizado a 30 Hz (como o jogo)
//   congelado   — mapa renderizado uma vez e reaproveitado (teto de ganho de um cache estático perfeito; perde a
//                 sombra dos Hunters/criaturas em movimento)
//   15hz        — metade da frequência atual
//   sem         — sombras desligadas (piso: o custo total do passe)
//   node tools/lab/sombras.mjs --url http://127.0.0.1:8860/ --out bench/v04-2/sombras.json --png-dir bench/v04-2/sombras
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const A = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith("--") ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const url = new URL(A.url ?? "http://127.0.0.1:8860/"); url.searchParams.set("perfil", A.perfil ?? "medio");
fs.mkdirSync(A["png-dir"], { recursive: true });
const b = await pw.chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(url.toString());
await p.waitForFunction(() => window.__wildhavenDbg?.().laco === "3d" && window.__wildhavenPerf?.drawCalls > 0, null, { timeout: 240000 });
await p.waitForTimeout(25000);
await p.evaluate(() => {
  const s = window.__wildhavenScene; s.settings.dynamicResolution = false;
  const sm = s.renderer.shadowMap; window.__modoSombra = "atual"; window.__forcar = false;
  // intercepta os pedidos de atualização do jogo (30 Hz) conforme o modo
  let v = false, k = 0;
  Object.defineProperty(sm, "needsUpdate", { configurable: true, get: () => v, set: x => {
    const m = window.__modoSombra;
    if (window.__forcar) { v = x; return; }
    if (m === "atual") v = x; else if (m === "15hz") { if (x) { k++; v = k % 2 === 0; } else v = false; } else v = false;
  } });
  const orig = s.frame.bind(s);
  s.frame = u => { sm.enabled = window.__modoSombra !== "sem"; orig(u); };
});
const janela = async modo => {
  await p.evaluate(m => { window.__modoSombra = m; window.__forcar = true; window.__wildhavenScene.renderer.shadowMap.needsUpdate = true; window.__forcar = false; }, modo);
  await p.waitForTimeout(2500);
  const med = await p.evaluate(async () => { const t = []; let a = performance.now(); for (let i = 0; i < 31; i++) { await new Promise(r => requestAnimationFrame(r)); const b2 = performance.now(); t.push(b2 - a); a = b2; } t.sort((x, y) => x - y); return t[15]; });
  return med;
};
const ordem = ["atual", "congelado", "15hz", "sem", "sem", "15hz", "congelado", "atual"];
const res = { url: url.toString(), modos: {} };
for (const m of ordem) { const v = await janela(m); (res.modos[m] ??= []).push(+v.toFixed(1)); console.log(m, v.toFixed(1)); }
for (const m of ["atual", "congelado", "15hz", "sem"]) { await p.evaluate(x => { window.__modoSombra = x; window.__forcar = true; window.__wildhavenScene.renderer.shadowMap.needsUpdate = true; window.__forcar = false; }, m); await p.waitForTimeout(1500); await p.screenshot({ path: `${A["png-dir"]}/${m}.png` }); }
res.medianaMs = Object.fromEntries(Object.entries(res.modos).map(([k, v]) => [k, +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(1)]));
fs.writeFileSync(A.out, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res.medianaMs));
await b.close();
