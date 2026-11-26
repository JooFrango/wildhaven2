import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Varrisco v11: a v10 com a orientação das faces coerente em cada parte. Só índices e normais mudam.
const root = new URL('../../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root));
const DIR = 'assets/models/creatures/varrisco/';
const v10 = read(DIR + 'v10/varrisco-animated-v10-LOD0.glb'), v11 = read(DIR + 'v11/varrisco-animated-v11-LOD0.glb');
const manifest = JSON.parse(read(DIR + 'v11/manifest.json'));
const parse = (b) => {const n = b.readUInt32LE(12); return {gltf: JSON.parse(b.subarray(20, 20 + n)), bin: b.subarray(28 + n, 28 + n + b.readUInt32LE(20 + n))};};
const CT = {5126: ['readFloatLE', 4], 5125: ['readUInt32LE', 4]};
function values({gltf, bin}, i) {
  const a = gltf.accessors[i], v = gltf.bufferViews[a.bufferView], [fn, size] = CT[a.componentType];
  const w = {SCALAR: 1, VEC3: 3}[a.type], o = (v.byteOffset || 0) + (a.byteOffset || 0);
  return Array.from({length: a.count * w}, (_, k) => bin[fn](o + k * size));
}
const A = parse(v10), B = parse(v11), p = B.gltf.meshes[0].primitives[0];

test('v11: SHA do manifesto; JSON idêntico ao da v10 e BIN só difere em índices e normais', () => {
  assert.equal(createHash('sha256').update(v11).digest('hex'), manifest.glb.sha256);
  const {asset: _a, ...ja} = A.gltf, {asset: _b, ...jb} = B.gltf;
  assert.deepEqual(jb, ja);
  const vistas = [p.indices, p.attributes.NORMAL].map((i) => A.gltf.bufferViews[A.gltf.accessors[i].bufferView]);
  const dentro = (o) => vistas.some((v) => o >= (v.byteOffset || 0) && o < (v.byteOffset || 0) + v.byteLength);
  for (let i = 0; i < A.bin.length; i++) if (A.bin[i] !== B.bin[i]) assert.ok(dentro(i), `byte ${i}`);
});

test('v11: cada parte fechada com orientação coerente e volume positivo; normais seguem a ordem', () => {
  const P = values(B, p.attributes.POSITION), N = values(B, p.attributes.NORMAL), I = values(B, p.indices);
  const id = new Map(), V = [];
  for (let k = 0; k < P.length / 3; k++) {const key = [0, 1, 2].map((c) => Math.round(P[3 * k + c] * 1e4)).join(','); if (!id.has(key)) id.set(key, id.size); V.push(id.get(key));}
  const pai = [...Array(id.size).keys()], raiz = (x) => (pai[x] === x ? x : (pai[x] = raiz(pai[x])));
  for (let t = 0; t < I.length; t += 3) {const r = raiz(V[I[t]]); pai[raiz(V[I[t + 1]])] = r; pai[raiz(V[I[t + 2]])] = r;}
  const vol = new Map(), arestas = new Map();
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]].map((i) => [P[3 * i], P[3 * i + 1], P[3 * i + 2]]);
    const r = raiz(V[I[t]]);
    vol.set(r, (vol.get(r) ?? 0) + (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6);
    const u = b.map((x, k) => x - a[k]), w = c.map((x, k) => x - a[k]), f = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    assert.ok(f[0] * N[3 * I[t]] + f[1] * N[3 * I[t] + 1] + f[2] * N[3 * I[t] + 2] > 0, 'normal segue a ordem');
    for (const [x, y] of [[I[t], I[t + 1]], [I[t + 1], I[t + 2]], [I[t + 2], I[t]]]) {
      const ux = V[x], uy = V[y], k = ux < uy ? ux + '_' + uy : uy + '_' + ux, e = arestas.get(k) ?? {n: 0, s: 0};
      e.n++; e.s += ux < uy ? 1 : -1; arestas.set(k, e);
    }
  }
  assert.equal(vol.size, manifest.glb.parts);
  for (const v of vol.values()) assert.ok(v > 0, `parte com volume ${v}`);
  for (const e of arestas.values()) {assert.equal(e.n, 2, 'sem borda aberta'); assert.equal(e.s, 0, 'aresta percorrida em sentidos opostos');}
});
