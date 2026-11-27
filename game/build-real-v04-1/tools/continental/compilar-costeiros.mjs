// V04 — Recompila a física WHP1 SÓ dos hexes não certificados por vegetação instanciada sem regra, com as regras
// de árvore medidas (data/regras-vegetacao-costeira-v04.json → formato wildhaven.tree-rules.v1, por hex), usando o
// compilador ORIGINAL (build real/continental/compiler/cli.mjs, sem alteração) e as mesmas opções do lote 272.
// Os demais hexes são reaproveitados por link simbólico. Saída: .generated/physics-272-v04 + compile-report mesclado.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const SRC = path.join(REPO, ".generated/physics-272"), DST = path.join(REPO, ".generated/physics-272-v04");
const regras = JSON.parse(fs.readFileSync(path.join(REPO, "game/build-real-v04/data/regras-vegetacao-costeira-v04.json"), "utf8"));
const man = JSON.parse(fs.readFileSync(path.join(REPO, "build real/continental/data/continent-272.manifest.json"), "utf8"));
// regras por hex: só os nós que aparecem naquele hex (evidência da medição)
const byTile = {};
for (const [node, ev] of Object.entries(regras.evidencia)) for (const e of ev) ((byTile[e.hex] ??= { trees: {}, nodeClasses: {} }).trees[node] = regras.trees[node]);
const treeRulesFile = path.join(REPO, "game/build-real-v04/data/tree-rules-costeiros-v04.json");
fs.writeFileSync(treeRulesFile, JSON.stringify({ schema: "wildhaven.tree-rules.v1", _origem: "gerado de data/regras-vegetacao-costeira-v04.json (raios medidos na malha, escala visual aprovada) — PROPOSTA TÉCNICA", byTile }, null, 1));
fs.mkdirSync(DST, { recursive: true });
const alvo = new Set(regras.hexes);
for (const d of fs.readdirSync(SRC)) {
  if (!d.endsWith("-physics-v01")) continue;
  const id = d.replace(/-physics-v01$/, ""), link = path.join(DST, d);
  if (!alvo.has(id) && !fs.existsSync(link)) fs.symlinkSync(path.join("..", "physics-272", d), link);
}
const base = JSON.parse(fs.readFileSync(path.join(SRC, "compile-report.json"), "utf8"));
const items = new Map(base.items.map(i => [i.id, i]));
for (const id of [...alvo].sort()) {
  const t = man.tiles.find(x => x.id === id);
  const glb = path.join(REPO, ".generated/sources", t.source.repository === "carioca1111/wildhaven" ? "old-root" : "new-root", t.source.path);
  const tmp = fs.mkdtempSync("/tmp/claude-0/whp-");
  execFileSync("node", [path.join(REPO, "build real/continental/compiler/cli.mjs"), "--tile", id, "--glb", glb, "--out", tmp, "--res", "2", "--chunk", "256",
    "--node-classes", path.join(REPO, "build real/continental/compiler/node-classes-v01.json"), "--snap-centers", "lattice", "--tree-rules", treeRulesFile], { stdio: "pipe" });
  const rep = JSON.parse(fs.readFileSync(path.join(tmp, "compile-report.json"), "utf8")).items[0];
  const dst = path.join(DST, `${id}-physics-v01`);
  fs.rmSync(dst, { recursive: true, force: true });
  fs.renameSync(path.join(tmp, `${id}-physics-v01`), dst);
  rep.output = dst; items.set(id, rep);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(id, rep.ok ? "ok" : "FALHOU", "não classificados:", rep.unknownMeshes, "árvores:", rep.trees ?? "");
}
fs.writeFileSync(path.join(DST, "compile-report.json"), JSON.stringify({ ...base, items: [...items.values()], v04: "43 hexes costeiros recompilados com regras de árvore medidas (tree-rules-costeiros-v04.json)" }, null, 2));
