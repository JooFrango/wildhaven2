// Inventário de criaturas (para a V04): varre assets/models/creatures/** e creatures/species/*, abre cada GLB
// (cabeçalho JSON: animações, esqueletos, triângulos, texturas) e cruza com fichas, manifestos e artes.
//   node tools/inventario-criaturas.mjs --out inventario.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith("--") ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const ROOT = path.join(REPO, "assets/models/creatures"), FICHAS = path.join(REPO, "creatures/species");
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
function glbInfo(f) {
  try {
    const fd = fs.openSync(f, "r"), h = Buffer.alloc(20); fs.readSync(fd, h, 0, 20, 0);
    if (h.readUInt32LE(0) !== 0x46546c67) { fs.closeSync(fd); return null; }
    const jl = h.readUInt32LE(12), jb = Buffer.alloc(jl); fs.readSync(fd, jb, 0, jl, 20); fs.closeSync(fd);
    const j = JSON.parse(jb.toString("utf8"));
    let tris = 0; for (const m of j.meshes ?? []) for (const p of m.primitives) { const a = j.accessors[p.indices ?? p.attributes.POSITION]; tris += a ? a.count / 3 : 0; }
    return { bytes: fs.statSync(f).size, animacoes: (j.animations ?? []).map(a => a.name), ossos: (j.skins ?? []).reduce((s, k) => s + k.joints.length, 0), triangulos: Math.round(tris), texturas: (j.images ?? []).length, malhas: (j.meshes ?? []).length };
  } catch { return null; }
}
const verOf = f => { const m = /(?:^|[-_/])v(\d{1,2})(?:[-_/.]|$)/i.exec(f); return m ? Number(m[1]) : 0; };
const fichas = new Map();
for (const f of fs.readdirSync(FICHAS)) {
  if (!f.endsWith(".json") || f === "schema.json") continue;
  try { const j = JSON.parse(fs.readFileSync(path.join(FICHAS, f), "utf8")); fichas.set(j.id ?? f.replace(/\.json$/, ""), { arquivo: `creatures/species/${f}`, ...j }); } catch { /* ficha inválida */ }
}
const out = [];
for (const dir of fs.readdirSync(ROOT).sort()) {
  const full = path.join(ROOT, dir); if (!fs.statSync(full).isDirectory()) continue;
  const files = walk(full).map(f => path.relative(REPO, f));
  const glbs = files.filter(f => f.endsWith(".glb")).map(f => ({ arquivo: f, versao: verOf(path.relative(`assets/models/creatures/${dir}`, f)), ...glbInfo(path.join(REPO, f)) }));
  const artes = files.filter(f => /\.(png|webp|jpe?g)$/i.test(f) && /conceit|refer|concept|arte/i.test(f));
  const previews = files.filter(f => /\.(png|webp|jpe?g)$/i.test(f)).length;
  const manifestos = files.filter(f => /manifest.*\.json$|\.manifest\.json$/i.test(f));
  const ficha = fichas.get(dir) ?? fichas.get(dir.replace(/-/g, "_"));
  const pacote = /optimization|fauna-v|herbivores|megafauna|reptiles|wildlife|specialists|detritivoros|threejs-source|pilot|^rocantraz-v|^talvero-v|^rambrel_chapadas/.test(dir);
  const anim = glbs.filter(g => g.animacoes?.length);
  const ultimo = (anim.length ? anim : glbs).slice().sort((a, b) => b.versao - a.versao || (b.animacoes?.length ?? 0) - (a.animacoes?.length ?? 0) || /LOD0/i.test(b.arquivo) - /LOD0/i.test(a.arquivo))[0] ?? null;
  out.push({
    id: dir, tipo: pacote ? "pacote/variante" : "especie", nome: ficha?.name ?? ficha?.nome ?? null, status: ficha?.status ?? null,
    habitats: ficha?.habitats ?? ficha?.biomas ?? null, dieta: ficha?.diet ?? ficha?.dieta ?? null, porte: ficha?.body ?? ficha?.porte ?? null, categoria: ficha?.category ?? null,
    ficha: ficha?.arquivo ?? null, glbs: glbs.length, glbsAnimados: anim.length, ultimoGlb: ultimo, artesConceituais: artes, imagens: previews, manifestos: manifestos.length,
  });
}
const resumo = { pastas: out.length, especies: out.filter(o => o.tipo === "especie").length, comGlb: out.filter(o => o.glbs).length, comAnimacao: out.filter(o => o.glbsAnimados).length, comFicha: out.filter(o => o.ficha).length, fichasSemPasta: [...fichas.keys()].filter(k => !out.some(o => o.id === k || o.id.replace(/-/g, "_") === k)) };
fs.writeFileSync(args.out ?? "inventario-criaturas.json", JSON.stringify({ schema: "wildhaven.inventario.criaturas.v1", geradoEm: new Date().toISOString(), resumo, itens: out }, null, 1));
console.log(JSON.stringify(resumo));
