#!/usr/bin/env node
// Deriva dados de navegação de um hexágono REAL do Wildhaven (somente leitura do GLB oficial).
// Rasteriza os nós do GLB numa grade: `terrain` → altura; `river_water` → superfície da água; `boulders`/`rock_escarpments`
// → rochas (bloqueio quando sobem > 1,2 m do chão); `trunks` → troncos (bloqueio); `shrubs`/`broadleaf_canopy` → cobertura.
// A leitura do GLB e a rasterização ficam em lib-hex-glb.mjs, compartilhadas com derivar-corredor-hex.mjs (que
// costura várias peças da composição numa grade contínua).
// Uso:
//   node scripts/derivar-terreno-hex.mjs <hex.glb> --procurar                 (lista recortes candidatos com água e pouca inclinação)
//   node scripts/derivar-terreno-hex.mjs <hex.glb> --x0 -100 --z0 300 --largura 240 --profundidade 200 --res 1 --saida config/eco/terrenos/x.json
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { serializarTerreno } from '../src/eco/terreno.js';
import { RAIZ_LAB } from '../src/node/carregar-node.js';
import { coletarTriangulos, lerGlb, montarTerreno, rasterizar } from './lib-hex-glb.mjs';
import { lerArgs } from './simular-args.mjs';

const args = lerArgs(process.argv.slice(2));
const arq = process.argv[2];
const buf = await readFile(arq);
const sha256 = createHash('sha256').update(buf).digest('hex');
const g = lerGlb(buf);

// Malhas por categoria, já em coordenadas do mundo do hexágono (X leste, Y cima, Z sul).
const CATEGORIAS = { terrain: 'terreno', river_water: 'agua', boulders: 'rocha', rock_escarpments: 'rocha', trunks: 'tronco', shrubs: 'arbusto', broadleaf_canopy: 'copa' };
const tris = coletarTriangulos(g, { categorias: CATEGORIAS });
console.log('triângulos por categoria:', Object.fromEntries(Object.entries(tris).map(([k, v]) => [k, v.length])));

if (args.procurar) {
  // Grade grossa (20 m) para achar recortes com água, margem suave e vegetação.
  const r = 20, x0 = -2160, z0 = -2480, nx = 216, nz = 248;
  const alt = rasterizar(tris.terreno, x0, z0, nx, nz, r);
  const agua = rasterizar(tris.agua, x0, z0, nx, nz, r);
  const cands = [];
  for (let j = 6; j < nz - 6; j += 3) for (let i = 6; i < nx - 6; i += 3) {
    let temAgua = 0, temSeco = 0, desnivel = 0;
    for (let b = -5; b <= 5; b++) for (let a = -5; a <= 5; a++) {
      const k = (j + b) * nx + (i + a);
      if (!Number.isFinite(alt[k])) { temSeco = -1e9; continue; }
      if (Number.isFinite(agua[k]) && agua[k] > alt[k]) temAgua++; else temSeco++;
      const k2 = (j + b) * nx + (i + a + 1);
      if (Number.isFinite(alt[k2])) desnivel = Math.max(desnivel, Math.abs(alt[k2] - alt[k]) / r);
    }
    if (temAgua > 3 && temSeco > 60) cands.push({ x0: x0 + (i - 6) * r, z0: z0 + (j - 5) * r, celulasAgua: temAgua, inclinacaoMax: +(Math.atan(desnivel) * 57.3).toFixed(1) });
  }
  cands.sort((a, b) => a.inclinacaoMax - b.inclinacaoMax);
  console.log(JSON.stringify(cands.slice(0, 8)));
  process.exit(0);
}

const res = Number(args.res ?? 1), largura = Number(args.largura ?? 240), prof = Number(args.profundidade ?? 200);
const x0 = Number(args.x0), z0 = Number(args.z0);
const { t, cont, base } = montarTerreno(tris, { x0, z0, largura, profundidade: prof, res, bloquearSemTerreno: !!args.bloquearSemTerreno });
const saida = args.saida ?? `config/eco/terrenos/recorte.json`;
const dados = {
  ...serializarTerreno(t),
  origem: {
    glb: relative(resolve(RAIZ_LAB, '../..'), resolve(arq)).replace(/\\/g, '/'), sha256, nota: 'Derivado (somente leitura). Coordenadas: x = X − x0, y = Z − z0 (metros do hexágono); altura relativa ao ponto mais baixo do recorte.',
    x0, z0, alturaBase: +base.toFixed(3), contagens: cont, bloquearSemTerreno: !!args.bloquearSemTerreno, geradoEm: new Date().toISOString(),
  },
};
await mkdir(dirname(join(RAIZ_LAB, saida)), { recursive: true });
await writeFile(join(RAIZ_LAB, saida), JSON.stringify(dados));
let desnivel = 0;
for (const h of t.alturas) if (h > desnivel) desnivel = h; // sem spread: em resolução alta a grade estoura a pilha
console.log('recorte gravado:', saida, JSON.stringify(cont), 'desnível', desnivel.toFixed(1), 'm');
