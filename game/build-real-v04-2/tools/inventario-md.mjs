// Gera "build real/integracao/INVENTARIO-CRIATURAS-V04.md" a partir de data/gameplay-provisorio-v04.json,
// data/biomas-v04.json e do inventário bruto (tools/inventario-criaturas.mjs).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), V04 = path.resolve(HERE, ".."), REPO = path.resolve(V04, "../..");
execFileSync("node", [path.join(HERE, "inventario-criaturas.mjs"), "--out", path.join(V04, "bench/inventario-criaturas-bruto.json")]);
const inv = JSON.parse(fs.readFileSync(path.join(V04, "bench/inventario-criaturas-bruto.json"), "utf8"));
const gp = JSON.parse(fs.readFileSync(path.join(V04, "data/gameplay-provisorio-v04.json"), "utf8"));
const bio = JSON.parse(fs.readFileSync(path.join(V04, "data/biomas-v04.json"), "utf8"));
const esp = gp.especies, ids = Object.keys(esp);
const testadas = new Set(JSON.parse(process.env.TESTADAS ?? "[]"));
const L = [];
L.push("# Inventário de criaturas — Build Real V04", "");
L.push(`Gerado por \`game/build-real-v04/tools/inventario-md.mjs\` em ${new Date().toISOString().slice(0, 10)}. Fontes: \`assets/models/creatures/\` (GLBs lidos um a um), \`creatures/species/\` (fichas), \`labs/ia-criaturas/config/eco/especies/\` (configs do laboratório) e \`game/build-real-v04/data/gameplay-provisorio-v04.json\` (dados de jogo gerados, **todos provisórios**).`, "");
L.push("## Totais", "");
L.push(`| Encontradas (pastas de espécie) | Com GLB animado | Integradas na V04 | Pendentes |`, `| ---: | ---: | ---: | ---: |`);
const especiesPastas = inv.itens.filter(o => o.tipo === "especie");
L.push(`| ${especiesPastas.length} | ${especiesPastas.filter(o => o.glbsAnimados).length} | ${ids.length} | ${gp.pendentes.length} |`, "");
L.push(`Pastas de pacote/variante (otimizações, pilotos, pacotes de savana/neve): ${inv.itens.length - especiesPastas.length}. Nenhuma delas virou espécie nova sem ficha: os pacotes de neve só têm fonte (scripts e tarballs), sem GLB publicado.`, "");
L.push("## Integradas por classe de bioma", "");
for (const [k, c] of Object.entries(bio.classes)) {
  const lista = ids.filter(i => (esp[i].classesBioma ?? []).includes(k) || (!esp[i].classesBioma && (esp[i].biomas ?? []).some(b => (bio.rotulos[b] ?? []).includes(k))));
  L.push(`### ${c.nome} (\`${k}\`) — ${lista.length} espécie(s)`, "");
  if (!lista.length) { L.push("Nenhuma espécie integrável: não há GLB animado com ficha para este bioma (ver pendências).", ""); continue; }
  L.push("| Espécie | Papel | Massa (kg) | Locomoção | Clipes | LODs | Retrato | Fonte dos dados | Aprovação |", "| --- | --- | ---: | --- | ---: | ---: | --- | --- | --- |");
  for (const i of lista) { const e = esp[i]; L.push(`| ${e.nome} | ${e.papel} | ${e.massaKg} | ${e.locomocao ?? "terrestre"} | ${e.clipes ?? "—"} | ${(e.lods ?? []).length || 1} | ${e.retrato ? "sim" : "—"} | ${e.fonte ?? "—"} | ${e.aprovacao ?? "—"} |`); }
  L.push("");
}
L.push("## Pendentes (com motivo)", "", "| Espécie | Motivo |", "| --- | --- |");
for (const p of gp.pendentes) L.push(`| ${p.id} | ${p.motivo} |`);
L.push("", "## Regras usadas", "", "- **Integrada** = GLB **animado** publicado + ficha (`creatures/species`) ou config do laboratório. Nada de modelo genérico no lugar de criatura complexa.", "- **Locomoção**: contrato do laboratório (`src/eco/capacidades.js`): `subsolo` no config → subterrânea na areia; `voo` → voadora; senão inferida dos clipes.", "- **Biomas**: habitats da ficha → classes de `data/biomas-v04.json` → rótulos do manifesto. Espécies só do laboratório: palavras-chave do README/fonte (registradas em `habitats`).", "- **Números** (hp, dano, densidade, itens): fórmulas provisórias da V02; parâmetros fora do código, em `gameplay-provisorio-v04.json`.", "- **Testadas**: ver `AUDITORIA-CONTINENTE-V04.md` e `bench/continente-*.json` (censo por bioma nas viagens longas).");
fs.writeFileSync(path.join(REPO, "build real/integracao/INVENTARIO-CRIATURAS-V04.md"), L.join("\n") + "\n");
console.log("ok", ids.length, gp.pendentes.length);
