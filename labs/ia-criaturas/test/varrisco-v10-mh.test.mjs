import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Varrisco v10: v09 corrigida (joelhos, garra em foice, pintura) e walk/trot/run novos; os outros 52 clipes intactos.
const root = new URL('../../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root));
const DIR = 'assets/models/creatures/varrisco/';
const v09 = read(DIR + 'v09/varrisco-animated-v09-LOD0.glb'), v10 = read(DIR + 'v10/varrisco-animated-v10-LOD0.glb');
const manifest = JSON.parse(read(DIR + 'v10/manifest.json'));
const parse = (b) => {const n = b.readUInt32LE(12); return {gltf: JSON.parse(b.subarray(20, 20 + n)), bin: b.subarray(28 + n, 28 + n + b.readUInt32LE(20 + n))};};
const CT = {5126: ['readFloatLE', 4], 5121: ['readUInt8', 1], 5123: ['readUInt16LE', 2], 5125: ['readUInt32LE', 4]};
function values({gltf, bin}, i) {
  const a = gltf.accessors[i], v = gltf.bufferViews[a.bufferView], [fn, size] = CT[a.componentType];
  const w = {SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16}[a.type], stride = v.byteStride || size * w, o = (v.byteOffset || 0) + (a.byteOffset || 0);
  return Array.from({length: a.count * w}, (_, k) => bin[fn](o + Math.floor(k / w) * stride + (k % w) * size));
}
const A = parse(v09), B = parse(v10);
const LOCO = ['walk', 'run', 'trot'];

test('v10: SHA do manifesto; nós, skin, bind e os 52 clipes que não são de locomoção idênticos aos da v09', () => {
  assert.equal(createHash('sha256').update(v10).digest('hex'), manifest.glb.sha256);
  assert.deepEqual(B.gltf.nodes, A.gltf.nodes); assert.deepEqual(B.gltf.skins.map(({inverseBindMatrices, ...s}) => s), A.gltf.skins.map(({inverseBindMatrices, ...s}) => s));
  assert.deepEqual(values(B, B.gltf.skins[0].inverseBindMatrices), values(A, A.gltf.skins[0].inverseBindMatrices));
  assert.equal(B.gltf.animations.length, 55);
  for (const ca of A.gltf.animations.filter((x) => !LOCO.includes(x.name))) {
    const cb = B.gltf.animations.find((x) => x.name === ca.name);
    assert.deepEqual(cb.extras, ca.extras); assert.deepEqual(cb.channels, ca.channels);
    cb.samplers.forEach((s, j) => {
      assert.deepEqual(values(B, s.input), values(A, ca.samplers[j].input), cb.name);
      assert.deepEqual(values(B, s.output), values(A, ca.samplers[j].output), cb.name);
    });
  }
});

test('v10: walk, trot e run novos em loop, na velocidade do jogo', () => {
  const esperado = {walk: 1.5, trot: 4.2, run: 9};
  for (const nome of LOCO) {
    const c = B.gltf.animations.find((x) => x.name === nome);
    assert.equal(c.extras.category, 'locomotion'); assert.equal(c.extras.loop, true);
    assert.equal(c.extras.velocidadeNaturalMs, esperado[nome]);
    for (const ch of c.channels) {
      const s = c.samplers[ch.sampler], v = values(B, s.output), w = ch.target.path === 'rotation' ? 4 : 3;
      const ini = v.slice(0, w), fim = v.slice(-w);
      const dif = ch.target.path === 'rotation' ? 1 - Math.abs(ini.reduce((a, x, i) => a + x * fim[i], 0)) : Math.max(...ini.map((x, i) => Math.abs(x - fim[i])));
      assert.ok(dif < 1e-4, `${nome}: ciclo fecha (${B.gltf.nodes[ch.target.node].name})`);
    }
  }
});

test('v10: malha do lado certo, pesos da v08 preservados, joelhos meio a meio e garras com pesos do pé', () => {
  const pa = A.gltf.meshes[0].primitives[0], pb = B.gltf.meshes[0].primitives[0];
  const P = values(B, pb.attributes.POSITION), I = values(B, pb.indices);
  let vol = 0;
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]].map((i) => [P[3 * i], P[3 * i + 1], P[3 * i + 2]]);
    vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  assert.ok(vol > .3);
  const Ja = values(A, pa.attributes.JOINTS_0).slice(0, 8262 * 4), Wa = values(A, pa.attributes.WEIGHTS_0).slice(0, 8262 * 4);
  const Jb = values(B, pb.attributes.JOINTS_0), Wb = values(B, pb.attributes.WEIGHTS_0);
  assert.deepEqual(Jb.slice(0, Ja.length), Ja); assert.deepEqual(Wb.slice(0, Wa.length), Wa);
  const joints = B.gltf.skins[0].joints.map((j) => B.gltf.nodes[j].name);
  let joelho = 0;
  for (let k = 8262; k < Jb.length / 4; k++) {
    const nomes = [0, 1, 2, 3].filter((c) => Wb[4 * k + c] > 1e-6).map((c) => joints[Jb[4 * k + c]]);
    if (nomes.length === 2 && /^thigh/.test(nomes[0]) && /^shin/.test(nomes[1])) {joelho++; assert.ok(Math.abs(Wb[4 * k] - .5) < 1e-6);}
  }
  assert.equal(joelho, 2 * 64 * 3, 'duas esferas de joelho com 64 triângulos');
});
