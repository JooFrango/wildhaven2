#!/usr/bin/env node
// Build: valida as configurações e gera dist/ estático (página + núcleo + configs), pronto para hospedar.
import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { rodarEncontro } from '../src/core/simulacao.js';
import { RAIZ_LAB, carregarConfigNode, lerJsonNode } from '../src/node/carregar-node.js';

const dist = join(RAIZ_LAB, 'dist');
const avisos = [];

// 1. Validação (montarConfig lança erro detalhado se algo estiver inválido).
const config = await carregarConfigNode();
const indice = await lerJsonNode('config/indice.json');
for (const [pasta, lista] of [['especies', indice.especies], ['cenarios', indice.cenarios]]) {
  const noDisco = (await readdir(join(RAIZ_LAB, 'config', pasta))).filter((f) => f.endsWith('.json'));
  for (const f of noDisco) if (!lista.includes(f)) avisos.push(`config/${pasta}/${f} existe mas não está em config/indice.json`);
}
// 2. Fumaça: cada cenário roda uma semente sem falhas.
for (const id of config.ordemCenarios) {
  const { resumo } = rodarEncontro(config, id, 1);
  if (resumo.falhas.length) throw new Error(`Cenário ${id} semente 1 com falhas: ${JSON.stringify(resumo.falhas)}`);
}
// 3. Cópia.
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(join(RAIZ_LAB, 'index.html'), join(dist, 'index.html'));
await cp(join(RAIZ_LAB, 'src', 'core'), join(dist, 'src', 'core'), { recursive: true });
await cp(join(RAIZ_LAB, 'src', 'web'), join(dist, 'src', 'web'), { recursive: true });
await cp(join(RAIZ_LAB, 'config'), join(dist, 'config'), { recursive: true });
await writeFile(join(dist, 'build-info.json'), JSON.stringify({
  geradoEm: new Date().toISOString(),
  especies: Object.keys(config.especies), cenarios: config.ordemCenarios,
}, null, 2));

for (const a of avisos) console.warn(`aviso: ${a}`);
console.log(`Build ok → dist/ (${Object.keys(config.especies).length} espécies, ${config.ordemCenarios.length} cenários). Prévia: npm run preview`);
