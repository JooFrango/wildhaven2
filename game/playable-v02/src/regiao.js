// Regiões detalhadas móveis (V02.3-pré): grade de simulação construída sob demanda a partir dos GLBs reais dos
// hexágonos. Mesmo código no Node e no navegador (só recebe bytes de GLB), para que observar ou não um Hunter não
// mude o terreno que ele usa.
//
// Regras de rasterização = as de labs/ia-criaturas/scripts/lib-hex-glb.mjs (`rasterizar`, `montarTerreno`), portadas
// para arrays tipados: a versão do laboratório leva ~2 s por km² (listas de arrays); esta precisa rodar durante o jogo.
// Diferença deliberada: a altura é relativa a uma BASE GLOBAL fixa (e não ao ponto mais baixo da janela), para todas as
// regiões compartilharem o mesmo referencial vertical.
import { criarTerreno, marcarDisco } from '../../../labs/ia-criaturas/src/eco/terreno.js';
import { CATEGORIAS_MUNDO, local, mul } from '../../../labs/ia-criaturas/scripts/lib-hex-glb.mjs';

export const CATEGORIAS = { ...CATEGORIAS_MUNDO, HV_01_Terreno: 'terreno', conifer_canopy: 'copa' };
const CATS = ['terreno', 'agua', 'rocha', 'tronco', 'arbusto', 'copa'];

// ------------------------------------------------------------------ leitura do GLB (ArrayBuffer ou Uint8Array)
function lerGlb(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const lj = dv.getUint32(12, true), json = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + lj)));
  return { json, bin: u8.subarray(20 + lj + 8) };
}
function acessor(g, i) {
  const a = g.json.accessors[i], bv = g.json.bufferViews[a.bufferView], comp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const Tipo = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
  const ini = g.bin.byteOffset + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0), passo = bv.byteStride ?? comp * Tipo.BYTES_PER_ELEMENT;
  // Dados contíguos e alinhados: vista direta, sem cópia elemento a elemento.
  if (passo === comp * Tipo.BYTES_PER_ELEMENT && ini % Tipo.BYTES_PER_ELEMENT === 0) return new Tipo(g.bin.buffer, ini, a.count * comp);
  const out = new Tipo(a.count * comp), dv = new DataView(g.bin.buffer);
  for (let n = 0; n < a.count; n++) for (let c = 0; c < comp; c++) {
    const o = ini + n * passo + c * Tipo.BYTES_PER_ELEMENT;
    out[n * comp + c] = Tipo === Float32Array ? dv.getFloat32(o, true) : Tipo === Uint32Array ? dv.getUint32(o, true) : Tipo === Uint16Array ? dv.getUint16(o, true) : dv.getUint8(o);
  }
  return out;
}

// Triângulos de um hexágono por categoria, em metros do MUNDO (X, Y, Z), 9 números por triângulo (Float64Array).
export function extrairHex(bytes, { cx, cz }) {
  const g = lerGlb(bytes), partes = Object.fromEntries(CATS.map((c) => [c, []]));
  const visitar = (i, pai) => {
    const no = g.json.nodes[i], m = mul(pai, local(no));
    const cat = no.mesh !== undefined ? CATEGORIAS[no.name] : null;
    if (cat) for (const p of g.json.meshes[no.mesh].primitives) {
      const pos = acessor(g, p.attributes.POSITION), idx = p.indices !== undefined ? acessor(g, p.indices) : null;
      const n = idx ? idx.length : pos.length / 3, out = new Float64Array(n * 3);
      for (let k = 0; k < n; k++) {
        const v = (idx ? idx[k] : k) * 3, x = pos[v], y = pos[v + 1], z = pos[v + 2];
        out[k * 3] = m[0] * x + m[4] * y + m[8] * z + m[12] + cx;
        out[k * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
        out[k * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14] + cz;
      }
      partes[cat].push(out);
    }
    for (const c of no.children ?? []) visitar(c, m);
  };
  const cena = g.json.scenes[g.json.scene ?? 0];
  for (const i of cena.nodes) visitar(i, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const tris = {};
  for (const c of CATS) { const tot = partes[c].reduce((s, a) => s + a.length, 0), out = new Float64Array(tot); let o = 0; for (const a of partes[c]) { out.set(a, o); o += a.length; } tris[c] = out; }
  return tris;
}

// Maior altura por célula (centro da célula), como `rasterizar` do laboratório.
function rasterizar(listas, x0, z0, nx, nz, res, out) {
  const x1 = x0 + nx * res, z1 = z0 + nz * res;
  for (const b of listas) for (let t = 0; t < b.length; t += 9) {
    const ax = b[t], ay = b[t + 1], az = b[t + 2], bx = b[t + 3], by = b[t + 4], bz = b[t + 5], cx = b[t + 6], cy = b[t + 7], cz = b[t + 8];
    const minX = Math.min(ax, bx, cx), maxX = Math.max(ax, bx, cx), minZ = Math.min(az, bz, cz), maxZ = Math.max(az, bz, cz);
    if (maxX < x0 || minX > x1 || maxZ < z0 || minZ > z1) continue;
    const i0 = Math.max(0, Math.floor((minX - x0) / res - 0.5)), i1 = Math.min(nx - 1, Math.ceil((maxX - x0) / res - 0.5));
    const j0 = Math.max(0, Math.floor((minZ - z0) / res - 0.5)), j1 = Math.min(nz - 1, Math.ceil((maxZ - z0) / res - 0.5));
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(d) < 1e-12) continue;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = x0 + (i + 0.5) * res, pz = z0 + (j + 0.5) * res;
      const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const y = l1 * ay + l2 * by + l3 * cy, k = j * nx + i;
      if (!(out[k] >= y)) out[k] = y;
    }
  }
  return out;
}

// Região retangular em metros do mundo [X0, X0+L] × [Z0, Z0+P], com a mesma classificação de `montarTerreno`:
// rocha bloqueia acima de 1,2 m do chão, tronco sempre bloqueia, arbusto dá cobertura 65 e copa 15. Sem terreno = bloqueio.
export function montarRegiao(hexes, { X0, Z0, L, P, res = 2, base, extras = [] }) {
  const nx = Math.round(L / res), nz = Math.round(P / res), n = nx * nz;
  const ras = (cat) => rasterizar(hexes.map((h) => h.tris[cat]), X0, Z0, nx, nz, res, new Float64Array(n).fill(NaN));
  const alt = ras('terreno'), aguaS = ras('agua'), rocha = ras('rocha'), tronco = ras('tronco'), arbusto = ras('arbusto'), copa = ras('copa');
  const g = { alturas: new Float32Array(n), agua: new Float32Array(n).fill(-1e9), cobertura: new Uint8Array(n), bloqueio: new Uint8Array(n), vegetacao: new Float32Array(n), vegetacaoMax: new Float32Array(n) };
  const cont = { semAltura: 0, agua: 0, rocha: 0, tronco: 0, arbusto: 0, copa: 0 };
  for (let k = 0; k < n; k++) {
    const tem = Number.isFinite(alt[k]), h = tem ? alt[k] - base : (cont.semAltura++, 0);
    g.alturas[k] = h;
    if (!tem) g.bloqueio[k] = 1;
    if (Number.isFinite(aguaS[k]) && aguaS[k] - base > h + 0.02) { g.agua[k] = aguaS[k] - base; cont.agua++; }
    if (Number.isFinite(rocha[k]) && rocha[k] - base > h + 1.2) { g.bloqueio[k] = 1; g.alturas[k] = Math.max(h, rocha[k] - base); cont.rocha++; }
    if (Number.isFinite(tronco[k])) { g.bloqueio[k] = 1; cont.tronco++; }
    if (Number.isFinite(arbusto[k])) { g.cobertura[k] = 65; cont.arbusto++; } else if (Number.isFinite(copa[k])) { g.cobertura[k] = Math.max(g.cobertura[k], 15); cont.copa++; }
    const veg = g.agua[k] > -1e8 || g.bloqueio[k] ? 0 : g.cobertura[k] >= 60 ? 75 : 55;
    g.vegetacao[k] = veg; g.vegetacaoMax[k] = veg;
  }
  // Extras (pisos e paredes da vila) antes de criarTerreno, que calcula a inclinação a partir das alturas finais.
  for (const ex of extras) ex({ nx, ny: nz, res, ...g }, { X0, Z0, base });
  return { t: criarTerreno({ largura: L, profundidade: P, res, ...g }), cont };
}

// Extras da Vila dos Hunters (fase 1): paredes e pisos de progression.json pelas funções do runtime da vila, e troncos
// das árvores publicadas em site.json — as mesmas regras de game/playable-v01/tools/derivar-regiao.mjs.
export function extraVila(site, fase, { walkingHeight, blocked }) {
  const [HVX, , HVZ] = site.worldCoord;
  return (t, { X0, Z0, base }) => {
    for (let j = 0; j < t.ny; j++) for (let i = 0; i < t.nx; i++) {
      const lx = X0 + (i + 0.5) * t.res - HVX, lz = Z0 + (j + 0.5) * t.res - HVZ;
      if (Math.abs(lx) > 90 || Math.abs(lz) > 90) continue;
      const k = j * t.nx + i, chao = t.alturas[k] + base, h = walkingHeight([{ height: () => chao }], fase, lx, lz);
      if (h > chao + 0.05) t.alturas[k] = h - base;
      if (blocked(fase, lx, lz, h, t.res / 2)) { t.bloqueio[k] = 1; t.vegetacao[k] = t.vegetacaoMax[k] = 0; }
    }
    for (const a of site.trees) marcarDisco(t, a.source_root[0] + HVX - X0, a.source_root[2] + HVZ - Z0, 0.6, (k) => { t.bloqueio[k] = 1; });
  };
}
