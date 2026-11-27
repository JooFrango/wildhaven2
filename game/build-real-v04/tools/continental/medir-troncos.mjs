// V04 — Mede, na geometria REAL dos GLBs costeiros, o raio de base de cada nó de vegetação instanciada na GPU
// (EXT_mesh_gpu_instancing) que a classificação V01 deixou sem regra (Folhosa_*, Dossel_*, Arbusto_*, Palmeira_*,
// Emergente_*, Figueira_de_varzea_*, Juncos, Moita de savana *). Raio = maior distância horizontal ao eixo do
// mesh entre os vértices dos 8% mais baixos da altura (o tronco/base que bloqueia a passagem). Sem estimativa:
// só o que está na malha. Saída: regras de árvore por nó (raio medido, não cortável) + evidência por hex.
//   node medir-troncos.mjs --sources .generated/sources --out game/build-real-v04/data/regras-vegetacao-costeira-v04.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, "../../../..");
const require = createRequire(path.join(REPO, "game/build-real-v04/tools/visual/package.json"));
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith("--") ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const man = JSON.parse(fs.readFileSync(path.join(REPO, "build real/continental/data/continent-272.manifest.json"), "utf8"));
const rel = JSON.parse(fs.readFileSync(path.join(REPO, "build real/integracao/relatorio-continental-272.json"), "utf8"));
const alvo = new Set(rel.tiles.filter(t => t.status === "nao-certificado").map(t => t.id));
const SRC = path.resolve(REPO, args.sources ?? ".generated/sources");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const VEG = JSON.parse(fs.readFileSync(path.join(REPO, "game/build-real-v04/data/vegetacao-provisoria-v02.json"), "utf8"));
const regras = {}, evid = {};
for (const t of man.tiles.filter(t => alvo.has(t.id))) {
  const file = path.join(SRC, t.source.repository === "carioca1111/wildhaven" ? "old-root" : "new-root", t.source.path);
  const doc = await io.read(file);
  for (const node of doc.getRoot().listNodes()) {
    if (!node.getExtension("EXT_mesh_gpu_instancing") || !node.getMesh()) continue;
    const name = node.getName();
    let minY = Infinity, maxY = -Infinity; const pts = [];
    for (const p of node.getMesh().listPrimitives()) {
      const a = p.getAttribute("POSITION"); if (!a) continue;
      const v = [0, 0, 0];
      for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); pts.push([v[0], v[1], v[2]]); if (v[1] < minY) minY = v[1]; if (v[1] > maxY) maxY = v[1]; }
    }
    // tronco = a seção MAIS ESTREITA entre faixas de 2% da altura nos 40% inferiores (raízes e galhos baixos
    // alargam a base; o tronco é o gargalo). Cada faixa precisa de ≥ 6 vértices para contar.
    const h = maxY - minY;
    let r = Infinity, base = [];
    for (let b = 0; b < 20; b++) {
      const lo = minY + b * 0.02 * h, hi = lo + 0.02 * h;
      const band = pts.filter(p => p[1] >= lo && p[1] < hi);
      if (band.length < 6) continue;
      const cx = band.reduce((s, p) => s + p[0], 0) / band.length, cz = band.reduce((s, p) => s + p[2], 0) / band.length;
      const rb = Math.max(...band.map(p => Math.hypot(p[0] - cx, p[2] - cz)));
      if (rb < r) { r = rb; base = band; }
    }
    if (!Number.isFinite(r) || r <= 0) {
      // arbustos/moitas baixos: faixas esparsas — usa a base inteira (10% inferiores)
      const b2 = pts.filter(p => p[1] <= minY + 0.1 * h);
      const cx = b2.reduce((s, p) => s + p[0], 0) / b2.length, cz = b2.reduce((s, p) => s + p[2], 0) / b2.length;
      r = Math.max(...b2.map(p => Math.hypot(p[0] - cx, p[2] - cz))); base = b2;
    }
    // escala física = mesma correção visual APROVADA (altura-alvo da família / altura medida desta malha)
    const fam = Object.keys(VEG.familias).find(f => name.startsWith(f)) ?? null;
    const alvoH = fam ? VEG.familias[fam].alturaAlvoM : null;
    const fator = alvoH && h > alvoH ? alvoH / h : 1;
    const prev = regras[name];
    // o mesmo nome em hexes diferentes: fica o MAIOR raio medido (conservador: bloqueia mais)
    const rf = Math.max(0.15, r * fator);
    if (!prev || rf > prev.radius) regras[name] = { radius: +rf.toFixed(3), cuttable: false };
    (evid[name] ??= []).push({ hex: t.id, alturaOriginalM: +h.toFixed(2), raioTroncoOriginalM: +r.toFixed(3), familia: fam, alturaAlvoVisualM: alvoH, fatorEscala: +fator.toFixed(4), raioFisicoM: +rf.toFixed(3), verticesBase: base.length });
  }
}
const out = { schema: "wildhaven.regras-vegetacao-costeira.v04", status: "PROPOSTA TÉCNICA — raio do tronco MEDIDO na malha original e escalado pelo MESMO fator da correção visual aprovada (altura-alvo da família / altura original), para o colisor coincidir com a árvore desenhada; obstáculo NÃO cortável. Pendente de revisão do diretor.", fonteEscala: "game/build-real-v04/data/vegetacao-provisoria-v02.json (familias.*.alturaAlvoM)", metodo: "raio = menor, entre faixas de 2% da altura nos 40% inferiores, da maior distância horizontal ao centro da faixa (seção mais estreita = tronco) (unidades do GLB, multiplicado pela escala de cada instância no compilador)", hexes: [...alvo].sort(), trees: regras, evidencia: evid };
fs.writeFileSync(path.resolve(REPO, args.out ?? "game/build-real-v04/data/regras-vegetacao-costeira-v04.json"), JSON.stringify(out, null, 1));
console.log(Object.entries(regras).map(([k, v]) => `${k}: r=${v.radius}`).join("\n"));
