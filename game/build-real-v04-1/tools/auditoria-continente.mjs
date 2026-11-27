// V04 — Auditoria dos 272 hexes: fonte (repositório, caminho, SHA-256 do manifesto), física WHP1 compilada,
// certificação técnica e portais (relatório continental), visual da V04 gerado (chunks/LOD/vegetação), classe de
// bioma (data/biomas-v04.json) e espécies previstas. Saída: JSON completo + resumo Markdown.
//   node tools/auditoria-continente.mjs --out bench/auditoria-continente.json --md "../../build real/integracao/AUDITORIA-CONTINENTE-V04.md"
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, "../../.."), V04 = path.resolve(HERE, "..");
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith("--") ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const man = JSON.parse(fs.readFileSync(path.join(REPO, "build real/continental/data/continent-272.manifest.json"), "utf8"));
const rel = JSON.parse(fs.readFileSync(path.join(V04, "data/relatorio-continental-272-v04.json"), "utf8"));
const bio = JSON.parse(fs.readFileSync(path.join(V04, "data/biomas-v04.json"), "utf8"));
const gp = JSON.parse(fs.readFileSync(path.join(V04, "data/gameplay-provisorio-v04.json"), "utf8"));
const VIS = path.join(REPO, ".generated/visual-272"), PHY = path.join(REPO, ".generated/physics-272-v04"), SRC = path.join(REPO, ".generated/sources");
const relTile = new Map(rel.tiles.map(t => [t.id, t]));
const edges = rel.edges ?? [];
const out = [];
for (const t of man.tiles) {
  const r = relTile.get(t.id) ?? {};
  const vis = path.join(VIS, t.id, "chunks.json");
  let visual = null;
  if (fs.existsSync(vis)) {
    const j = JSON.parse(fs.readFileSync(vis, "utf8"));
    const veg = fs.existsSync(path.join(VIS, t.id, "veg.json")) ? JSON.parse(fs.readFileSync(path.join(VIS, t.id, "veg.json"), "utf8")) : null;
    visual = { nos: Object.keys(j.pack).length, folhas: j.leaves.length, blocos: j.blocks.length, triangulosL0: j.leaves.reduce((s, l) => s + (l.lods[0]?.tris ?? 0), 0), pacoteBytes: j.packBytes, vegetacaoInstancias: veg ? veg.cells.reduce((s, c) => s + c.count, 0) : 0 };
  }
  const root = t.source.repository === "carioca1111/wildhaven" ? "old-root" : "new-root";
  const src = path.join(SRC, root, t.source.path);
  const classes = bio.rotulos[t.biome] ?? [];
  const especies = Object.entries(gp.especies).filter(([, e]) => (e.biomas ?? []).includes(t.biome)).map(([k]) => k);
  const viz = edges.filter(e => e.a === t.id || e.b === t.id);
  const emendaMax = Math.max(0, ...viz.map(e => e.seamGapMeters?.max ?? 0));
  out.push({
    id: t.id, bioma: t.biome, classes, fonte: { repositorio: t.source.repository, caminho: t.source.path, sha256: t.source.sha256, bytes: t.source.bytes, triangulosOriginais: t.source.triangles, presente: fs.existsSync(src) && fs.statSync(src).size === t.source.bytes },
    fisica: fs.existsSync(path.join(PHY, `${t.id}-physics-v01`, "index.json")), status: r.status ?? null, arestasValidadas: r.validatedEdges ?? null, arestasTerrestres: r.landEdges ?? null, arestas: r.edges ?? viz.length, emendaMaxM: emendaMax, motivos: r.reasons ?? [], escalaOk: r.scale?.scaleOk ?? null,
    visual, especiesPrevistas: especies,
  });
}
const by = (k, f) => out.reduce((m, o) => { const key = f(o); m[key] = (m[key] ?? 0) + 1; return m; }, {});
const resumo = {
  hexes: out.length, fontePresenteComTamanhoConferido: out.filter(o => o.fonte.presente).length, fisicaCompilada: out.filter(o => o.fisica).length,
  visualGerado: out.filter(o => o.visual).length, porStatus: by("s", o => o.status), porClasse: out.reduce((m, o) => { for (const c of o.classes) m[c] = (m[c] ?? 0) + 1; return m; }, {}),
  emendaMaxContinenteM: Math.max(...out.map(o => o.emendaMaxM)), escalaConferida: out.filter(o => o.escalaOk).length,
  motivosNaoCertificados: out.filter(o => o.status !== "certificado-tecnico").reduce((m, o) => { for (const r of o.motivos) { const k = String(r).slice(0, 60); m[k] = (m[k] ?? 0) + 1; } return m; }, {}),
  semFauna: out.filter(o => !o.especiesPrevistas.length).map(o => `${o.id} (${o.bioma})`),
  triangulosL0Total: out.reduce((s, o) => s + (o.visual?.triangulosL0 ?? 0), 0), vegetacaoTotal: out.reduce((s, o) => s + (o.visual?.vegetacaoInstancias ?? 0), 0),
  resumoRelatorioContinental: rel.summary,
};
fs.writeFileSync(path.resolve(V04, args.out ?? "bench/auditoria-continente.json"), JSON.stringify({ schema: "wildhaven.auditoria.continente.v04", geradoEm: new Date().toISOString(), resumo, hexes: out }, null, 1));
console.log(JSON.stringify({ ...resumo, semFauna: resumo.semFauna.length }, null, 1));
