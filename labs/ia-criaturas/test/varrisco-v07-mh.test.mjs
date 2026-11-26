import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Varrisco v07 (linha MH): v06 aprovada inteira + reações de dano hit_side_l/r, hit_heavy_l/r, hit_head.
const root = new URL('../../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root));
const DIR = 'assets/models/creatures/varrisco/';
const v06 = read(DIR + 'v06/varrisco-animated-v06-LOD0.glb'), v07 = read(DIR + 'v07/varrisco-animated-v07-LOD0.glb');
const manifest = JSON.parse(read(DIR + 'v07/manifest.json'));
const NOVOS = ['hit_side_l', 'hit_side_r', 'hit_heavy_l', 'hit_heavy_r', 'hit_head'];
const parse = (b) => {const n = b.readUInt32LE(12); return {gltf: JSON.parse(b.subarray(20, 20 + n)), bin: b.subarray(28 + n, 28 + n + b.readUInt32LE(20 + n))};};
function floats({gltf, bin}, i) {
  const a = gltf.accessors[i], v = gltf.bufferViews[a.bufferView], w = {SCALAR: 1, VEC3: 3, VEC4: 4}[a.type], o = (v.byteOffset || 0) + (a.byteOffset || 0);
  return Array.from({length: a.count * w}, (_, k) => bin.readFloatLE(o + k * 4));
}
const A = parse(v06), B = parse(v07);

test('v07: SHA do manifesto, 54 clipes, v06 preservada (BIN prefixo, nós, malha, 49 clipes)', () => {
  assert.equal(createHash('sha256').update(v07).digest('hex'), manifest.glb.sha256);
  assert.equal(B.gltf.animations.length, 54); assert.equal(new Set(B.gltf.animations.map((x) => x.name)).size, 54);
  assert.ok(B.bin.subarray(0, A.bin.length).equals(A.bin));
  assert.deepEqual(B.gltf.meshes, A.gltf.meshes); assert.deepEqual(B.gltf.skins, A.gltf.skins); assert.deepEqual(B.gltf.nodes, A.gltf.nodes);
  assert.deepEqual(B.gltf.animations.slice(0, 49), A.gltf.animations);
});

test('v07: reações com keyframes finitos, duração certa e amplitude real', () => {
  for (const nome of NOVOS) {
    const c = B.gltf.animations.find((x) => x.name === nome);
    assert.equal(c.extras.category, 'reaction');
    let maxAng = 0;
    for (const ch of c.channels) {
      const s = c.samplers[ch.sampler], t = floats(B, s.input), v = floats(B, s.output);
      assert.ok(t.every((x, i) => i === 0 || x > t[i - 1]) && v.every(Number.isFinite), nome);
      assert.ok(Math.abs(t.at(-1) - c.extras.durationSeconds) < 1e-4, nome);
      if (ch.target.path === 'rotation') for (let k = 3; k < v.length; k += 4) maxAng = Math.max(maxAng, 2 * Math.acos(Math.min(1, Math.abs(v[k]))));
    }
    assert.ok(maxAng > 0.3, `${nome}: ${maxAng.toFixed(2)} rad`);
  }
});
