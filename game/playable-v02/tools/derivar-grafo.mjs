#!/usr/bin/env node
// Grafo estratégico de Auralis (272 hexágonos) para a navegação entre hexágonos da V02.
// Vizinhança: centros a 2·R·√3/2 = 4 330 m (a mesma regra geométrica que gera `shared_edges` de composition_195.json
// e `contacts` do litoral; conferido por test/v02.test.mjs). Custo por bioma: REGRA PROVISÓRIA desta build — o
// projeto não publica tabela de travessia entre hexágonos. Mar com icebergs é intransponível a pé.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ler = async (p) => JSON.parse(await readFile(join(RAIZ, p), 'utf8'));
const cont = await ler('game/playable-v01/public/data/continente-272.json');
const base = await ler('world/tropical-south-v01/composition_195.json');
const relevo = new Map(base.tiles.filter((t) => Number.isFinite(t.ground_max_m)).map((t) => [t.id, t.ground_max_m - t.ground_min_m]));

// Multiplicador do tempo de marcha (1 = planície). Primeira regra que casa vale.
const REGRAS = [
  [/iceberg-sea/i, Infinity], [/mountain|maciço/i, 2.5], [/falesia|ice|glacial|snow/i, 2], [/jungle|swamp/i, 1.6],
  [/dune|erg|dunas|deserto|arco|oásis|mesas|torres|cânion|arenito/i, 1.5], [/forest/i, 1.3], [/savanna/i, 1.1], [/praia/i, 1.1], [/./, 1],
];
const R = 2500, PASSO = 2 * R * Math.sqrt(3) / 2;
const tiles = cont.tiles.map((t) => {
  const custo = REGRAS.find(([re]) => re.test(t.bioma))[1] + (relevo.get(t.id) ?? 0) / 1000;
  return { ...t, custo: Number.isFinite(custo) ? +custo.toFixed(2) : null };
});
const arestas = [];
for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++)
  if (Math.abs(Math.hypot(tiles[i].x - tiles[j].x, tiles[i].z - tiles[j].z) - PASSO) < 2) arestas.push([tiles[i].id, tiles[j].id]);
await mkdir(join(RAIZ, 'game/playable-v02/public/data'), { recursive: true });
await writeFile(join(RAIZ, 'game/playable-v02/public/data/auralis-grafo.json'), JSON.stringify({
  fonte: 'game/playable-v01/public/data/continente-272.json + relevo de composition_195.json', regraCusto: 'provisória (bioma + relevo/1000); null = intransponível',
  passoM: +PASSO.toFixed(3), tiles, arestas }));
console.log(`auralis-grafo.json: ${tiles.length} hexágonos, ${arestas.length} arestas, ${tiles.filter((t) => t.custo === null).length} intransponíveis`);
