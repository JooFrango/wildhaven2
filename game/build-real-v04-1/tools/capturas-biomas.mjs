// Capturas REAIS por bioma (V04): câmera livre no centro de hexes escolhidos, mesma distância/ângulo/hora,
// relevo e vegetação dos GLBs originais carregados por streaming. Espera o streaming esvaziar antes da foto.
//   node tools/capturas-biomas.mjs http://127.0.0.1:8797/ "build real/integracao/evidencias/v04/biomas"
// Renderização por SOFTWARE (SwiftShader): evidência visual, não de FPS.
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const pw = require("playwright");
const [url, dir] = process.argv.slice(2);
fs.mkdirSync(dir, { recursive: true });
const HEXES = (process.env.HEXES ?? "ER_18,HV_01,F_N,PL_NW,SV2_C,TR_CW,J_C,PT_+3_10,DN_01,C,MW_01,WG_01,WG_10,costa_+08_-09,costa_+11_-05,costa_+02_-04").split(",");
const dist = Number(process.env.DIST ?? 320), pitch = Number(process.env.PITCH ?? 22);
const b = await pw.chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on("pageerror", e => errs.push(e.message));
await p.goto(url + "?perfil=medio&hud=0", { waitUntil: "domcontentloaded" });
await p.waitForFunction(() => window.__wildhavenPerf?.drawCalls > 0, null, { timeout: 240000 });
const res = [];
for (const id of HEXES) {
  const info = await p.evaluate(([id, d, pt]) => window.__wildhavenOlhar(id, d, pt, 35), [id, dist, pitch]);
  if (!info) { res.push({ id, erro: "hex desconhecido" }); continue; }
  const t0 = Date.now(); let st;
  // espera o streaming assentar (fila vazia por 3 leituras seguidas), até 90 s
  for (let calm = 0; Date.now() - t0 < 90000 && calm < 3;) {
    await p.waitForTimeout(2000);
    st = await p.evaluate(() => { const f = window.__wildhavenPerf; const v = f.streaming?.relevo ?? {}; return { fila: (v.fila ?? 0) + (v.baixando ?? 0) + (f.tarefas?.carregando ?? 0), dc: f.drawCalls, tri: f.triangles, s: f.streaming }; });
    const vis = await p.evaluate(() => !!document.querySelector("#tela-carregamento:not(.fim)"));
    calm = st.fila === 0 && (st.s?.relevo?.desenhados ?? 0) > 0 && !vis ? calm + 1 : 0;
  }
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${dir}/${id.replace(/[+]/g, "p")}.png` });
  res.push({ ...info, segundos: (Date.now() - t0) / 1000, drawCalls: st.dc, triangulos: st.tri, nosDesenhados: st.s?.relevo?.desenhados, vegetacaoMB: st.s?.vegetacaoMB });
  console.log(JSON.stringify(res.at(-1)));
}
fs.writeFileSync(`${dir}/capturas.json`, JSON.stringify({ url, distancia: dist, inclinacao: pitch, renderer: "SwiftShader (software)", capturas: res, errosPagina: errs }, null, 1));
await b.close();
