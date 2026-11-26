import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Varrisco v08: a v07 aprovada com a malha do lado certo. Só os índices (ordem dos triângulos) e as normais mudam.
const root = new URL('../../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root));
const DIR = 'assets/models/creatures/varrisco/';
const v07 = read(DIR + 'v07/varrisco-animated-v07-LOD0.glb'), v08 = read(DIR + 'v08/varrisco-animated-v08-LOD0.glb');
const manifest = JSON.parse(read(DIR + 'v08/manifest.json'));
const parse = (b) => {const n = b.readUInt32LE(12); return {gltf: JSON.parse(b.subarray(20, 20 + n)), bin: b.subarray(28 + n, 28 + n + b.readUInt32LE(20 + n))};};
const CT = {5126: ['readFloatLE', 4], 5123: ['readUInt16LE', 2], 5125: ['readUInt32LE', 4]};
function values({gltf, bin}, i) {
  const a = gltf.accessors[i], v = gltf.bufferViews[a.bufferView], [fn, size] = CT[a.componentType];
  const w = {SCALAR: 1, VEC3: 3}[a.type], stride = v.byteStride || size * w, o = (v.byteOffset || 0) + (a.byteOffset || 0);
  return Array.from({length: a.count * w}, (_, k) => bin[fn](o + Math.floor(k / w) * stride + (k % w) * size));
}
function medir(g) {
  const p = g.gltf.meshes[0].primitives[0], P = values(g, p.attributes.POSITION), N = values(g, p.attributes.NORMAL), I = values(g, p.indices);
  let vol = 0, concorda = 0;
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]].map((i) => [P[3 * i], P[3 * i + 1], P[3 * i + 2]]);
    vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    const u = b.map((x, k) => x - a[k]), v = c.map((x, k) => x - a[k]), f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const n = [0, 1, 2].map((k) => N[3 * I[t] + k] + N[3 * I[t + 1] + k] + N[3 * I[t + 2] + k]);
    if (f[0] * n[0] + f[1] * n[1] + f[2] * n[2] > 0) concorda++;
  }
  return {vol, concorda, tri: I.length / 3, P, N, I};
}
const A = parse(v07), B = parse(v08);

test('v08: SHA do manifesto e JSON idêntico ao da v07 (fora asset.generator)', () => {
  assert.equal(createHash('sha256').update(v08).digest('hex'), manifest.glb.sha256);
  const {asset: _a, ...ja} = A.gltf, {asset: _b, ...jb} = B.gltf;
  assert.deepEqual(jb, ja);
  assert.equal(B.bin.length, A.bin.length);
});

test('v08: malha do lado certo — volume positivo, ordem e normais para fora; resto do BIN idêntico', () => {
  const ma = medir(A), mb = medir(B);
  assert.ok(ma.vol < 0, 'v07 estava do avesso');
  assert.ok(mb.vol > 0 && Math.abs(mb.vol + ma.vol) < 1e-6, `volume ${mb.vol}`);
  assert.equal(mb.concorda, mb.tri);
  assert.deepEqual(mb.P, ma.P);
  assert.deepEqual(mb.N, ma.N.map((x) => -x));
  for (let t = 0; t < ma.I.length; t += 3) assert.deepEqual([mb.I[t], mb.I[t + 1], mb.I[t + 2]], [ma.I[t], ma.I[t + 2], ma.I[t + 1]]);
  const p = A.gltf.meshes[0].primitives[0], vistas = [p.indices, p.attributes.NORMAL].map((i) => A.gltf.bufferViews[A.gltf.accessors[i].bufferView]);
  const dentro = (o) => vistas.some((v) => o >= (v.byteOffset || 0) && o < (v.byteOffset || 0) + v.byteLength);
  for (let i = 0; i < A.bin.length; i++) if (A.bin[i] !== B.bin[i]) assert.ok(dentro(i), `byte ${i} fora de índices/normais`);
});
