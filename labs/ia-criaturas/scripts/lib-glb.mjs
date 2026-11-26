// Leitura mínima de GLB em Node (somente leitura): JSON, accessors, matrizes e amostragem de clipes.
import { readFile } from 'node:fs/promises';

export async function abrirGlb(f) {
  const buf = await readFile(f);
  if (buf.toString('ascii', 0, 4) !== 'glTF') throw new Error('não é GLB');
  const lenJ = buf.readUInt32LE(12);
  const g = JSON.parse(buf.toString('utf8', 20, 20 + lenJ));
  const binIni = 20 + lenJ + 8;
  const pais = new Map();
  (g.nodes ?? []).forEach((n, i) => (n.children ?? []).forEach((c) => pais.set(c, i)));
  return { g, buf, pais, ler: (ai) => lerAccessor(g, buf, binIni, ai) };
}

export function canaisDoClipe(glb, an) {
  const canais = new Map();
  for (const ch of an.channels) {
    const s = an.samplers[ch.sampler];
    canais.set(`${ch.target.node}:${ch.target.path}`, { t: glb.ler(s.input), v: glb.ler(s.output), interp: s.interpolation ?? 'LINEAR', comp: ch.target.path === 'rotation' ? 4 : 3 });
  }
  return canais;
}

export function duracaoClipe(glb, an) {
  let dur = 0;
  for (const ch of an.channels) {
    const s = an.samplers[ch.sampler];
    const a = glb.g.accessors[s.input];
    const mx = Array.isArray(a.max) ? a.max[0] : a.max;
    if (Number.isFinite(mx)) dur = Math.max(dur, mx);
    else { const t = glb.ler(s.input); if (t.length) dur = Math.max(dur, t[t.length - 1]); }
  }
  return dur;
}

// Matriz mundial de cada nó no instante t do clipe (canais = null → pose de repouso).
export function poseMundial(glb, canais, t) {
  const nos = glb.g.nodes;
  const cache = new Map();
  const de = (i) => {
    if (cache.has(i)) return cache.get(i);
    const n = nos[i];
    const trs = {
      translation: (canais && amostrar(canais.get(`${i}:translation`), t)) ?? n.translation,
      rotation: (canais && amostrar(canais.get(`${i}:rotation`), t)) ?? n.rotation,
      scale: (canais && amostrar(canais.get(`${i}:scale`), t)) ?? n.scale,
    };
    const m = local(n.matrix ? n : trs);
    const r = glb.pais.has(i) ? mul(de(glb.pais.get(i)), m) : m;
    cache.set(i, r); return r;
  };
  return de;
}

export function amostrar(c, t) {
  if (!c || !c.t.length) return null;
  const { t: ts, v, comp, interp } = c;
  const cub = interp === 'CUBICSPLINE';
  const passo = cub ? comp * 3 : comp;
  const off = cub ? comp : 0;
  const val = (i) => Array.from(v.slice(i * passo + off, i * passo + off + comp));
  if (t <= ts[0]) return val(0);
  const n = ts.length;
  if (t >= ts[n - 1]) return val(n - 1);
  let i = 0; while (i < n - 2 && ts[i + 1] < t) i++;
  if (interp === 'STEP') return val(i);
  const u = (t - ts[i]) / (ts[i + 1] - ts[i]);
  const a = val(i), b = val(i + 1);
  if (comp === 4) {
    const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    const s = d < 0 ? -1 : 1;
    const q = a.map((x, k) => x * (1 - u) + s * b[k] * u);
    const len = Math.sqrt(q.reduce((acc, x) => acc + x * x, 0)) || 1;
    return q.map((x) => x / len);
  }
  return a.map((x, k) => x * (1 - u) + b[k] * u);
}

export function lerAccessor(g, buf, binIni, ai) {
  const a = g.accessors[ai];
  const bv = g.bufferViews[a.bufferView];
  const comp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  if (a.componentType !== 5126) return new Float32Array(0);
  const ini = binIni + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const passo = bv.byteStride ?? comp * 4;
  const out = new Float32Array(a.count * comp);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < comp; k++) out[i * comp + k] = buf.readFloatLE(ini + i * passo + k * 4);
  return out;
}
export function local(n) {
  if (n.matrix) return n.matrix.slice();
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale ?? [1, 1, 1];
  const [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
export function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
