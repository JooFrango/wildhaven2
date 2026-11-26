// Leitura dos GLBs oficiais de hexágono (somente leitura) e rasterização do relevo numa grade regular.
// Compartilhado por derivar-terreno-hex.mjs (um hexágono) e derivar-corredor-hex.mjs (vários hexágonos).
// Coordenadas: X leste, Y cima, Z sul — como no GLB. O chamador aplica o deslocamento do hexágono
// (center_x/center_z da composição) para trabalhar em metros do mundo.
import { criarTerreno } from '../src/eco/terreno.js';

// Malhas por categoria. Nomes dos nós dos hexágonos oficiais. A saia lateral da peça (hex_side_cut) fica de fora
// de propósito: é uma parede vertical na borda do hexágono, não chão.
export const CATEGORIAS_MUNDO = {
  terrain: 'terreno', dry_streambed: 'terreno',
  river_water: 'agua', oasis_water: 'agua',
  boulders: 'rocha', rock_escarpments: 'rocha', loose_rocks: 'rocha', sandstone_cliffs: 'rocha',
  sandstone_mesas: 'rocha', angular_escarpments: 'rocha', stratified_cliff_faces: 'rocha',
  erosion_spires: 'rocha', rock_arches: 'rocha', natural_stone_arch: 'rocha',
  trunks: 'tronco', palm_trunks: 'tronco', biome_blend_trunks: 'tronco', ecotone_broadleaf_trunks: 'tronco',
  shrubs: 'arbusto', low_scrub: 'arbusto', cacti: 'arbusto',
  broadleaf_canopy: 'copa', conifers: 'copa', palm_fronds: 'copa', biome_blend_conifers: 'copa', ecotone_broadleaf_canopy: 'copa',
};

export const categoriasVazias = () => ({ terreno: [], agua: [], rocha: [], tronco: [], arbusto: [], copa: [] });

export function lerGlb(b) {
  const lj = b.readUInt32LE(12);
  const json = JSON.parse(b.toString('utf8', 20, 20 + lj));
  return { json, bin: b.subarray(20 + lj + 8) };
}

export function acessor(g, i) {
  const a = g.json.accessors[i], bv = g.json.bufferViews[a.bufferView];
  const comp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const ini = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const Tipo = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
  const bytes = Tipo.BYTES_PER_ELEMENT;
  const passo = bv.byteStride ?? comp * bytes;
  const out = new Tipo(a.count * comp);
  const dv = new DataView(g.bin.buffer, g.bin.byteOffset);
  for (let n = 0; n < a.count; n++) for (let c = 0; c < comp; c++) {
    const o = ini + n * passo + c * bytes;
    out[n * comp + c] = Tipo === Float32Array ? dv.getFloat32(o, true) : Tipo === Uint32Array ? dv.getUint32(o, true) : Tipo === Uint16Array ? dv.getUint16(o, true) : dv.getUint8(o);
  }
  return out;
}

export function percorrer(g, f) {
  const cena = g.json.scenes[g.json.scene ?? 0];
  const visitar = (i, pai) => { const no = g.json.nodes[i]; const m = mul(pai, local(no)); f(no, m); for (const c of no.children ?? []) visitar(c, m); };
  for (const i of cena.nodes) visitar(i, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function local(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1], [sx, sy, sz] = n.scale ?? [1, 1, 1], [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0, 2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
}
export function mul(a, b) { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; }
export function aplicar(m, p) { return [0, 1, 2].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]); }

// Triângulos por categoria, nas coordenadas do GLB mais `desloc` (metros) — com o center_x/center_z da composição,
// isso dá metros do mundo. `limites` = { x0, x1, z0, z1 }: descarta triângulos fora da janela (um hexágono inteiro
// de 4330×5000 m não precisa ficar na memória). `tris` acumula entre chamadas: vários hexágonos na mesma grade.
export function coletarTriangulos(g, { categorias = CATEGORIAS_MUNDO, desloc = { x: 0, z: 0 }, limites = null, tris = categoriasVazias() } = {}) {
  percorrer(g, (no, mundo) => {
    if (no.mesh === undefined) return;
    const cat = categorias[no.name];
    if (!cat) return;
    for (const p of g.json.meshes[no.mesh].primitives) {
      const pos = acessor(g, p.attributes.POSITION);
      const idx = p.indices !== undefined ? acessor(g, p.indices) : null;
      const v = (i) => { const q = aplicar(mundo, [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]); q[0] += desloc.x; q[2] += desloc.z; return q; };
      const n = idx ? idx.length : pos.length / 3;
      for (let i = 0; i < n; i += 3) {
        const a = v(idx ? idx[i] : i), b = v(idx ? idx[i + 1] : i + 1), c = v(idx ? idx[i + 2] : i + 2);
        if (limites && (Math.max(a[0], b[0], c[0]) < limites.x0 || Math.min(a[0], b[0], c[0]) > limites.x1
          || Math.max(a[2], b[2], c[2]) < limites.z0 || Math.min(a[2], b[2], c[2]) > limites.z1)) continue;
        tris[cat].push([a, b, c]);
      }
    }
  });
  return tris;
}

// Rasteriza triângulos (projeção no plano XZ) guardando a maior altura Y por célula (centro da célula).
export function rasterizar(lista, x0, z0, nx, nz, res) {
  const out = new Float32Array(nx * nz).fill(NaN);
  const x1 = x0 + nx * res, z1 = z0 + nz * res;
  for (const [a, b, c] of lista) {
    const minX = Math.min(a[0], b[0], c[0]), maxX = Math.max(a[0], b[0], c[0]);
    const minZ = Math.min(a[2], b[2], c[2]), maxZ = Math.max(a[2], b[2], c[2]);
    if (maxX < x0 || minX > x1 || maxZ < z0 || minZ > z1) continue;
    const i0 = Math.max(0, Math.floor((minX - x0) / res - 0.5)), i1 = Math.min(nx - 1, Math.ceil((maxX - x0) / res - 0.5));
    const j0 = Math.max(0, Math.floor((minZ - z0) / res - 0.5)), j1 = Math.min(nz - 1, Math.ceil((maxZ - z0) / res - 0.5));
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(d) < 1e-12) continue;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = x0 + (i + 0.5) * res, pz = z0 + (j + 0.5) * res;
      const l1 = ((b[2] - c[2]) * (px - c[0]) + (c[0] - b[0]) * (pz - c[2])) / d;
      const l2 = ((c[2] - a[2]) * (px - c[0]) + (a[0] - c[0]) * (pz - c[2])) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const y = l1 * a[1] + l2 * b[1] + l3 * c[1];
      const k = j * nx + i;
      if (!(out[k] >= y)) out[k] = y;
    }
  }
  return out;
}

// Grades por categoria → terreno do ecossistema. Altura relativa ao ponto mais baixo da janela.
// Mesmas regras do recorte de um hexágono: rocha bloqueia quando sobe > 1,2 m do chão; tronco sempre bloqueia;
// arbusto dá 65 de cobertura e copa 15; capim 75 sob arbusto, 55 no aberto, 0 em água e em bloqueio.
export function montarTerreno(tris, { x0, z0, largura, profundidade, res }) {
  const nx = Math.round(largura / res), nz = Math.round(profundidade / res);
  const altura = rasterizar(tris.terreno, x0, z0, nx, nz, res);
  const aguaS = rasterizar(tris.agua, x0, z0, nx, nz, res);
  const rocha = rasterizar(tris.rocha, x0, z0, nx, nz, res);
  const tronco = rasterizar(tris.tronco, x0, z0, nx, nz, res);
  const arbusto = rasterizar(tris.arbusto, x0, z0, nx, nz, res);
  const copa = rasterizar(tris.copa, x0, z0, nx, nz, res);
  let base = Infinity;
  for (const v of altura) if (Number.isFinite(v)) base = Math.min(base, v);
  const n = nx * nz;
  // Arrays montados antes do terreno: criarTerreno calcula a inclinação a partir das alturas que recebe.
  const g = { alturas: new Float32Array(n), agua: new Float32Array(n).fill(-1e9), cobertura: new Uint8Array(n), bloqueio: new Uint8Array(n), vegetacao: new Float32Array(n), vegetacaoMax: new Float32Array(n) };
  const cont = { semAltura: 0, agua: 0, rocha: 0, tronco: 0, arbusto: 0, copa: 0 };
  for (let k = 0; k < n; k++) {
    const h = Number.isFinite(altura[k]) ? altura[k] - base : (cont.semAltura++, 0);
    g.alturas[k] = h;
    if (Number.isFinite(aguaS[k]) && aguaS[k] - base > h + 0.02) { g.agua[k] = aguaS[k] - base; cont.agua++; }
    if (Number.isFinite(rocha[k]) && rocha[k] - base > h + 1.2) { g.bloqueio[k] = 1; g.alturas[k] = Math.max(h, rocha[k] - base); cont.rocha++; }
    if (Number.isFinite(tronco[k])) { g.bloqueio[k] = 1; cont.tronco++; }
    if (Number.isFinite(arbusto[k])) { g.cobertura[k] = 65; cont.arbusto++; }
    else if (Number.isFinite(copa[k])) { g.cobertura[k] = Math.max(g.cobertura[k], 15); cont.copa++; }
    const veg = g.agua[k] > -1e8 || g.bloqueio[k] ? 0 : g.cobertura[k] >= 60 ? 75 : 55;
    g.vegetacao[k] = veg; g.vegetacaoMax[k] = veg;
  }
  return { t: criarTerreno({ largura, profundidade, res, ...g }), cont, base };
}
