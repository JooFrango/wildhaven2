// Troca do Hunter seguido para um Hunter em outro hex (V04): mede quanto tempo a região leva para ficar pronta,
// se a tela "Carregando terrenos da região" abre e FECHA, e fotografa antes/depois.
//   node tools/test/troca-hunter-distante.mjs http://127.0.0.1:8796/ <pasta> hunter-004
import { createRequire } from "node:module"; import fs from "node:fs";
const require = createRequire(import.meta.url); const pw = require("playwright");
const [url, dir, alvo] = process.argv.slice(2); fs.mkdirSync(dir, { recursive: true });
const b = await pw.chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on("pageerror", e => errs.push(e.message));
await p.goto(url + "?perfil=medio");
await p.waitForFunction(() => window.__wildhavenPerf?.drawCalls > 0, null, { timeout: 240000 });
await p.waitForTimeout(15000);
const antes = await p.evaluate(() => { const s = window.__wildhavenScene; return { tile: s.S?.snap.hunters.find(h => h.id === s.S.follow)?.tile_id }; }).catch(() => ({}));
await p.screenshot({ path: `${dir}/antes.png` });
const snap = await (await fetch(url + "api/v1/snapshot")).json();
const i = snap.hunters.findIndex(h => h.id === alvo);
await p.locator(".hcard").nth(i).click();
const t0 = Date.now(), linha = [];
let abriu = false, fechouEm = null;
while (Date.now() - t0 < 120000) {
  await p.waitForTimeout(500);
  const st = await p.evaluate(() => ({ dbg: window.__wildhavenDbg(), stall: window.__wildhavenScene.regionStalledMs(), rel: window.__wildhavenPerf.streaming?.relevo }));
  if (st.dbg.visivel) abriu = true;
  linha.push({ s: (Date.now() - t0) / 1000, tela: st.dbg.visivel, travadoMs: Math.round(st.stall), fila: st.rel?.fila, desenhados: st.rel?.desenhados });
  if (abriu && !st.dbg.visivel && fechouEm === null) fechouEm = (Date.now() - t0) / 1000;
  if (st.stall === 0 && !st.dbg.visivel && (Date.now() - t0) > 5000 && (st.rel?.fila ?? 0) === 0) break;
}
await p.waitForTimeout(2000);
await p.screenshot({ path: `${dir}/depois-${alvo}.png` });
const res = { alvo, hexAlvo: snap.hunters[i].tile_id, telaAbriu: abriu, telaFechouEmS: fechouEm, prontoEmS: linha.at(-1).s, amostras: linha, errosPagina: errs };
fs.writeFileSync(`${dir}/troca-hunter.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ ...res, amostras: undefined }));
await b.close();
