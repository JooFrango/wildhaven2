#!/usr/bin/env node
// Deriva o terreno de simulação da região de caça da Playable Build V01 a partir dos GLBs reais
// (somente leitura): HV_01 (Vila dos Hunters, PR #99), FX_20 e ER_18 — os três hexágonos que se
// encontram no canto norte de HV_01. Reaproveita a rasterização do laboratório (lib-hex-glb.mjs)
// e a colisão da vila (world/hunters-village-v01/runtime.mjs) sem alterar nenhum dos dois.
//
// Uso: node game/playable-v01/tools/derivar-regiao.mjs   (a partir da raiz do repositório)
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIAS_MUNDO, categoriasVazias, coletarTriangulos, lerGlb, montarTerreno } from '../../../labs/ia-criaturas/scripts/lib-hex-glb.mjs';
import { serializarTerreno, marcarDisco } from '../../../labs/ia-criaturas/src/eco/terreno.js';
import { walkingHeight, blocked } from '../../../world/hunters-village-v01/runtime.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ler = (p) => readFile(join(RAIZ, p));
const json = async (p) => JSON.parse(await ler(p));

const site = await json('world/hunters-village-v01/site.json');
const progresso = await json('world/hunters-village-v01/progression.json');
const regiao = await json('world/playable-eastern-range-v01/play/region.json');
const [HVX, , HVZ] = site.worldCoord;
const vizinho = (id) => regiao.tiles.find((t) => t.id === id);

// Peças da simulação. As outras vizinhas de HV_01 entram só no desenho (ver regiao.json do jogo).
const pecas = [
  { id: 'HV_01', center_x: HVX, center_z: HVZ, model_path: 'world/hunters-village-v01/models/hv_01_terrain.glb' },
  vizinho('FX_20'),
  vizinho('ER_18'),
];
// Nomes de nó que a tabela do laboratório não conhece: o terreno da vila e as coníferas da família ER/FX.
const CATEGORIAS = { ...CATEGORIAS_MUNDO, HV_01_Terreno: 'terreno', conifer_canopy: 'copa' };

// Janela: 800 m de largura, da vila (sul) até 400 m além do canto norte comum a HV_01, FX_20 e ER_18.
const R = 2500, RES = 2, LARGURA = 800;
const x0 = HVX - LARGURA / 2, z0 = HVZ - R - 400, PROF = Math.round(R + 400 + 200);
const banda = { x0: x0 - 10, x1: x0 + LARGURA + 10, z0: z0 - 10, z1: z0 + PROF + 10 };

const tris = categoriasVazias();
const hexes = [];
for (const p of pecas) {
  const buf = await ler(p.model_path);
  coletarTriangulos(lerGlb(buf), { categorias: CATEGORIAS, desloc: { x: p.center_x, z: p.center_z }, limites: banda, tris });
  hexes.push({ id: p.id, glb: p.model_path, sha256: createHash('sha256').update(buf).digest('hex'), bytes: buf.length, center_x: p.center_x, center_z: p.center_z });
}
const { t, cont, base } = montarTerreno(tris, { x0, z0, largura: LARGURA, profundidade: PROF, res: RES, bloquearSemTerreno: true });

// Vila, fase 1 (raio de meia célula: paredes de 0,68 m não escapam da grade de 2 m): colisão de prédios e pisos de praça/pontes/escadas, pelas mesmas funções do runtime da vila.
const fase = progresso.phases.find((f) => f.phase === 1);
let vilaBloq = 0, vilaPiso = 0;
for (let j = 0; j < t.ny; j++) for (let i = 0; i < t.nx; i++) {
  const lx = x0 + (i + 0.5) * RES - HVX, lz = z0 + (j + 0.5) * RES - HVZ;
  if (Math.abs(lx) > 90 || Math.abs(lz) > 90) continue;
  const k = j * t.nx + i, chao = t.alturas[k] + base;
  const h = walkingHeight([{ height: () => chao }], fase, lx, lz);
  if (h > chao + 0.05) { t.alturas[k] = h - base; vilaPiso++; }
  if (blocked(fase, lx, lz, h, RES / 2)) { t.bloqueio[k] = 1; t.vegetacao[k] = t.vegetacaoMax[k] = 0; vilaBloq++; }
}
// Árvores da vila (hv_01_forest.glb): tronco como disco de 0,6 m na raiz publicada em site.json.
for (const a of site.trees) marcarDisco(t, a.source_root[0] + HVX - x0, a.source_root[2] + HVZ - z0, 0.6, (k) => { t.bloqueio[k] = 1; });

const saida = 'game/playable-v01/public/data/regiao-v01-sim.json';
const dados = {
  ...serializarTerreno(t),
  origem: {
    tipo: 'regiao-caca-v01', x0, z0, alturaBase: +base.toFixed(3), res: RES, hexes,
    nota: 'Derivado (somente leitura). x = X − x0, y = Z − z0 (metros do mundo); altura relativa a alturaBase. Colisão da vila: fase 1 de progression.json.',
    contagens: { ...cont, vilaBloqueio: vilaBloq, vilaPiso },
  },
};
await mkdir(dirname(join(RAIZ, saida)), { recursive: true });
await writeFile(join(RAIZ, saida), JSON.stringify(dados));
console.log(saida, `${LARGURA}×${PROF} m res ${RES}`, JSON.stringify(dados.origem.contagens), 'base', base.toFixed(2));
