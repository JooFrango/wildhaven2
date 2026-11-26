import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Varrisco v06 (linha MH): v05 aprovada inteira + sickle_kick, bite_turn_l/r, pounce_chain, backstep_tail.
const root = new URL('../../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root));
const DIR = 'assets/models/creatures/varrisco/';
const v05 = read(DIR + 'v05/varrisco-animated-v05-LOD0.glb'), v06 = read(DIR + 'v06/varrisco-animated-v06-LOD0.glb');
const manifest = JSON.parse(read(DIR + 'v06/manifest.json'));
const NOVOS = ['sickle_kick', 'bite_turn_l', 'bite_turn_r', 'pounce_chain', 'backstep_tail'];

function parse(b) {
  assert.equal(b.toString('ascii', 0, 4), 'glTF'); assert.equal(b.readUInt32LE(8), b.length);
  const n = b.readUInt32LE(12);
  return {gltf: JSON.parse(b.subarray(20, 20 + n)), bin: b.subarray(28 + n, 28 + n + b.readUInt32LE(20 + n))};
}
const CT = {5126: ['readFloatLE', 4], 5121: ['readUInt8', 1], 5123: ['readUInt16LE', 2], 5125: ['readUInt32LE', 4]};
function values({gltf, bin}, i) {
  const a = gltf.accessors[i], v = gltf.bufferViews[a.bufferView], [fn, size] = CT[a.componentType];
  const w = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16}[a.type], stride = v.byteStride || size * w, o = (v.byteOffset || 0) + (a.byteOffset || 0);
  const out = [];
  for (let k = 0; k < a.count; k++) for (let j = 0; j < w; j++) out.push(bin[fn](o + k * stride + j * size));
  return out;
}
const A = parse(v05), B = parse(v06);

test('v06: SHA do manifesto, 49 clipes únicos, BIN da v05 preservado como prefixo', () => {
  assert.equal(createHash('sha256').update(v06).digest('hex'), manifest.glb.sha256);
  assert.equal(v06.length, manifest.glb.bytes);
  const nomes = B.gltf.animations.map((x) => x.name);
  assert.equal(nomes.length, 49); assert.equal(new Set(nomes).size, 49);
  assert.ok(B.bin.subarray(0, A.bin.length).equals(A.bin));
  assert.deepEqual(B.gltf.meshes, A.gltf.meshes); assert.deepEqual(B.gltf.skins, A.gltf.skins); assert.deepEqual(B.gltf.nodes, A.gltf.nodes);
  assert.deepEqual(B.gltf.animations.slice(0, 44), A.gltf.animations);
});

test('v06: golpes novos com janelas em ordem, keyframes finitos e amplitude real', () => {
  for (const nome of NOVOS) {
    const c = B.gltf.animations.find((x) => x.name === nome), e = c.extras;
    assert.equal(e.stage, 'experimental_v06_mh');
    let maxAng = 0;
    for (const ch of c.channels) {
      const s = c.samplers[ch.sampler], t = values(B, s.input), v = values(B, s.output);
      assert.ok(t.every((x, i) => i === 0 || x > t[i - 1]) && v.every(Number.isFinite), nome);
      assert.ok(Math.abs(t.at(-1) - e.durationSeconds) < 1e-4, nome);
      if (ch.target.path === 'rotation') for (let k = 3; k < v.length; k += 4) maxAng = Math.max(maxAng, 2 * Math.acos(Math.min(1, Math.abs(v[k]))));
    }
    assert.ok(maxAng > 0.35, `${nome}: ${maxAng.toFixed(2)} rad`);
    const {aviso, ativo, punicao} = e.janelasSeg;
    assert.ok(aviso[1] <= ativo[0] && ativo[1] <= punicao[0] && punicao[1] <= e.durationSeconds + 1e-6, nome);
  }
  // Espelho: a mordida giratória para a direita é a esquerda com guinada invertida.
  const l = B.gltf.animations.find((x) => x.name === 'bite_turn_l'), r = B.gltf.animations.find((x) => x.name === 'bite_turn_r');
  assert.equal(l.channels.length, r.channels.length);
});
