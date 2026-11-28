// V04.1/V04.2 — lanternas da vila: força a noite, põe a câmera sobre a vila e alterna o zoom 65 ↔ 700 m (atravessa o
// raio em que as lanternas acendem). Registra programas de shader antes/depois de cada troca, o maior quadro e o
// estado do portão de luzes. Não muda o jogo (só instrumenta a página).
//   node tools/lab/lanternas.mjs http://127.0.0.1:8860/ bench/v04-2/labs/lanternas-v04-2.json
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const b = await pw.chromium.launch({ args: ["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(process.argv[2] + "?perfil=medio");
await p.waitForFunction(() => window.__wildhavenDbg?.().laco === "3d" && window.__wildhavenPerf?.drawCalls > 0, null, { timeout: 240000 });
await p.waitForTimeout(15000);
const r = await p.evaluate(async () => {
  const s = window.__wildhavenScene, info = s.renderer.info, cam = window.__wildhavenCamera;
  Object.defineProperty(s.atm, "night", { configurable: true, get: () => 1, set: () => {} });
  const g = s.village.group.position; s.S.livre = { x: g.x, y: 930, z: g.z };
  const errs = []; const of = s.frame.bind(s); s.frame = u => { try { of(u); } catch (e) { errs.push(String(e)); } };
  const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const out = []; let t = performance.now();
  const lampsOn = () => s.village.lamps.filter(l => l.visible).length;
  for (const z of [65, 700, 65, 700, 65]) {
    cam.zoomTo(z); const p0 = info.programs.length, t0 = performance.now();
    // espera a câmera chegar (8 quadros) e registra programas e tempo
    const iv = []; let a = performance.now();
    for (let i = 0; i < 12; i++) { await new Promise(r => requestAnimationFrame(r)); const b2 = performance.now(); iv.push(Math.round(b2 - a)); a = b2; }
    out.push({ zoom: z, lamparinasVisiveis: lampsOn(), programasAntes: p0, programasDepois: info.programs.length, ms12Quadros: Math.round(performance.now() - t0), maiorQuadroMs: Math.max(...iv), portao: s.lightGate ? { ...s.lightGate.stats } : null, ext: !!s.renderer.extensions.get("KHR_parallel_shader_compile") });
  }
  return { out, errs: errs.slice(0, 3), nErros: errs.length };
});
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify({ url: process.argv[2], ...r }, null, 1));
console.log(JSON.stringify(r, null, 1)); await b.close();
