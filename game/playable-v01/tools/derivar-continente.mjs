#!/usr/bin/env node
// Mapa continental da build: os 272 hexágonos documentados (195 de world/tropical-south-v01/composition_195.json,
// PR #100, + 77 do litoral em world/coast-v01/viewer/continente/composition.json, PR #101). Só centro, id e bioma:
// o mapa geral é desenhado em 2D; nenhum GLB continental é carregado por ele.
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ler = async (p) => JSON.parse(await readFile(join(RAIZ, p), 'utf8'));
const base = await ler('world/tropical-south-v01/composition_195.json');
const costa = await ler('world/coast-v01/viewer/continente/composition.json');
const tiles = [
  ...base.tiles.map((t) => ({ id: t.id, x: +t.center_x.toFixed(1), z: +t.center_z.toFixed(1), bioma: t.biome ?? t.label ?? '', glb: t.model_path })),
  ...costa.tiles.map((t) => ({ id: t.id, x: +t.center_xz[0].toFixed(1), z: +t.center_xz[1].toFixed(1), bioma: t.kind, glb: 'world/coast-v01/' + t.model })),
];
if (tiles.length !== costa.total || new Set(tiles.map((t) => t.id)).size !== tiles.length) throw Error(`esperado ${costa.total} ids únicos, obtido ${tiles.length}`);
await writeFile(join(RAIZ, 'game/playable-v01/public/data/continente-272.json'), JSON.stringify({ fontes: ['world/tropical-south-v01/composition_195.json', 'world/coast-v01/viewer/continente/composition.json'], escalaM: 5000, tiles }));
console.log('continente-272.json', tiles.length, 'hexágonos');
