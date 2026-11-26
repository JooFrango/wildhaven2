#!/usr/bin/env node
// Gera game/playable-v01/dist/: a build de distribuição, com os caminhos do repositório preservados
// (os módulos do laboratório se importam por caminho relativo e os GLBs vêm de /repo/…).
// Só entra o que a página usa: módulos, configs, three.js local, os GLBs reais da região e o manifesto com SHA-256.
// Servir: node tools/servir.mjs --dir dist   (qualquer servidor estático que mapeie /repo/ para a raiz também serve).
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DIST = join(RAIZ, 'game/playable-v01/dist');
const json = async (p) => JSON.parse(await readFile(join(RAIZ, p), 'utf8'));
await rm(DIST, { recursive: true, force: true });
const copiar = async (p, filtro) => { await mkdir(dirname(join(DIST, p)), { recursive: true }); await cp(join(RAIZ, p), join(DIST, p), { recursive: true, filter: filtro }); };

const N3 = 'game/playable-v01/node_modules/three/';
const fixos = [
  'game/playable-v01/index.html', 'game/playable-v01/src', 'game/playable-v01/public',
  N3 + 'build/three.module.js', N3 + 'LICENSE', N3 + 'examples/jsm/loaders/GLTFLoader.js', N3 + 'examples/jsm/utils/BufferGeometryUtils.js',
  N3 + 'examples/jsm/utils/SkeletonUtils.js', N3 + 'examples/jsm/controls/OrbitControls.js',
  'labs/ia-criaturas/src', 'labs/hunters/src', 'labs/hunters/config', 'labs/hunters-codex/src/geometry.js',
  'labs/hunters/assets/hunter-rig-v13/hunter_rig_v13_blockout.glb',
  'assets/models/creatures/varrisco/v11/varrisco-animated-v11-LOD0.glb',
  'world/hunters-village-v01/site.json', 'world/hunters-village-v01/runtime.mjs',
  ...['hv_01_terrain', 'hv_01_forest', 'phase_1', 'phase_1_inside'].map((f) => `world/hunters-village-v01/models/${f}.glb`),
  'world/playable-eastern-range-v01/play/region.json',
];
for (const p of fixos) await copiar(p);
await copiar('labs/ia-criaturas/config/eco', (src) => !src.includes(sep + 'terrenos'));

// Hexágonos que o streaming pode pedir: centro a até (raio do preset alto + margem) de algum ponto da janela jogável.
const regiao = await json('world/playable-eastern-range-v01/play/region.json');
const o = (await json('game/playable-v01/public/data/regiao-v01-sim.json')).origem;
const RAIO = 9000;
const ate = (t) => Math.hypot(Math.max(o.x0 - t.center_x, 0, t.center_x - (o.x0 + 800)), Math.max(o.z0 - t.center_z, 0, t.center_z - (o.z0 + 3100)));
const tiles = regiao.tiles.filter((t) => ate(t) < RAIO);
for (const t of tiles) await copiar(t.model_path);

// Manifesto: cada arquivo com bytes e SHA-256.
const arquivos = [];
async function varrer(d) { for (const e of await readdir(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) await varrer(p); else arquivos.push(p); } }
await varrer(DIST);
// Todo import relativo dos módulos copiados precisa existir em dist/ (um 404 de módulo derruba a página inteira).
const faltando = [];
for (const p of arquivos.filter((f) => /\.m?js$/.test(f))) {
  for (const [, alvo] of (await readFile(p, 'utf8')).matchAll(/(?:^|[;\n])\s*(?:import|export)[^'"`;]*?from\s*['"](\.{1,2}\/[^'"?]+)/g)) {
    if (!(await stat(join(dirname(p), alvo)).catch(() => null))) faltando.push(`${relative(DIST, p)} → ${alvo}`);
  }
}
if (faltando.length) throw Error('imports ausentes em dist/:\n' + faltando.join('\n'));
const manifesto = { build: 'Wildhaven — Playable Build V01', geradoEm: new Date().toISOString(), hexagonosDesenhaveis: ['HV_01', ...tiles.map((t) => t.id)], arquivos: [] };
let total = 0;
for (const p of arquivos.sort()) { const b = await readFile(p); total += b.length; manifesto.arquivos.push({ caminho: relative(DIST, p).split(sep).join('/'), bytes: b.length, sha256: createHash('sha256').update(b).digest('hex') }); }
manifesto.totalBytes = total;
await writeFile(join(DIST, 'MANIFESTO.json'), JSON.stringify(manifesto, null, 1));
console.log(`dist/: ${arquivos.length} arquivos, ${(total / 1e6).toFixed(1)} MB, ${manifesto.hexagonosDesenhaveis.length} hexágonos desenháveis`);
