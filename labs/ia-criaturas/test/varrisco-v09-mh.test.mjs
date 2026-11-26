import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Varrisco v09: forma e cores da arte conceitual sobre o rig e os 54 clipes da v08 (que não podem mudar).
const root = new URL('../../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root));
const DIR = 'assets/models/creatures/varrisco/';
const v08 = read(DIR + 'v08/varrisco-animated-v08-LOD0.glb'), v09 = read(DIR + 'v09/varrisco-animated-v09-LOD0.glb');
const manifest = JSON.parse(read(DIR + 'v09/manifest.json'));
const parse = (b) => {const n = b.readUInt32LE(12); return {gltf: JSON.parse(b.subarray(20, 20 + n)), bin: b.subarray(28 + n, 28 + n + b.readUInt32LE(20 + n))};};
const CT = {5126: ['readFloatLE', 4], 5121: ['readUInt8', 1], 5123: ['readUInt16LE', 2], 5125: ['readUInt32LE', 4]};
function values({gltf, bin}, i) {
  const a = gltf.accessors[i], v = gltf.bufferViews[a.bufferView], [fn, size] = CT[a.componentType];
  const w = {SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16}[a.type], stride = v.byteStride || size * w, o = (v.byteOffset || 0) + (a.byteOffset || 0);
  return Array.from({length: a.count * w}, (_, k) => bin[fn](o + Math.floor(k / w) * stride + (k % w) * size));
}
const A = parse(v08), B = parse(v09);
const pa = A.gltf.meshes[0].primitives[0], pb = B.gltf.meshes[0].primitives[0];

test('v09: SHA do manifesto; nós, skin, matrizes de bind e os 54 clipes idênticos aos da v08', () => {
  assert.equal(createHash('sha256').update(v09).digest('hex'), manifest.glb.sha256);
  assert.deepEqual(B.gltf.nodes, A.gltf.nodes); assert.deepEqual(B.gltf.skins, A.gltf.skins);
  assert.deepEqual(values(B, B.gltf.skins[0].inverseBindMatrices), values(A, A.gltf.skins[0].inverseBindMatrices));
  assert.equal(B.gltf.animations.length, 54);
  B.gltf.animations.forEach((cb, i) => {
    const ca = A.gltf.animations[i];
    assert.equal(cb.name, ca.name); assert.deepEqual(cb.extras, ca.extras); assert.deepEqual(cb.channels, ca.channels);
    cb.samplers.forEach((s, j) => {
      assert.equal(s.interpolation, ca.samplers[j].interpolation);
      assert.deepEqual(values(B, s.input), values(A, ca.samplers[j].input), cb.name);
      assert.deepEqual(values(B, s.output), values(A, ca.samplers[j].output), cb.name);
    });
  });
});

test('v09: malha do lado certo, pesos da v08 preservados e peças novas rígidas', () => {
  const P = values(B, pb.attributes.POSITION), I = values(B, pb.indices), tri = I.length / 3;
  assert.equal(tri, manifest.glb.triangles); assert.ok(tri > 2754);
  let vol = 0;
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]].map((i) => [P[3 * i], P[3 * i + 1], P[3 * i + 2]]);
    vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  assert.ok(vol > .3, `volume ${vol}`);
  const Ja = values(A, pa.attributes.JOINTS_0), Wa = values(A, pa.attributes.WEIGHTS_0), Jb = values(B, pb.attributes.JOINTS_0), Wb = values(B, pb.attributes.WEIGHTS_0);
  assert.deepEqual(Jb.slice(0, Ja.length), Ja); assert.deepEqual(Wb.slice(0, Wa.length), Wa);
  const joints = B.gltf.skins[0].joints.map((j) => B.gltf.nodes[j].name);
  for (let k = Ja.length / 4; k < Jb.length / 4; k++) {
    assert.equal(Wb[4 * k], 1); assert.ok(['head', 'neck', 'footL', 'footR'].includes(joints[Jb[4 * k]]));
  }
  assert.deepEqual(values(B, pb.indices).slice(0, values(A, pa.indices).length), values(A, pa.indices));
});

test('v09: cores por face com a paleta da prancha (cauda com faixas escuras, ventre creme)', () => {
  const P = values(B, pb.attributes.POSITION), C = values(B, pb.attributes.COLOR_0);
  const cor = (k) => [C[4 * k], C[4 * k + 1], C[4 * k + 2]];
  let escuras = 0, claras = 0;
  for (let k = 0; k < P.length / 3; k++) {
    if (P[3 * k] < -1.0) {const c = cor(k); if (Math.max(...c) < 20) escuras++; else if (c[0] > 120) claras++;}
  }
  assert.ok(escuras > 100 && claras > 100, `faixas da cauda: ${escuras} escuras, ${claras} claras`);
});
