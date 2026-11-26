import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Varrisco v05 (linha MH): 33 clipes da v04 intactos, 8 ataques refeitos e roar/tail_sweep/limp novos.
const root = new URL('../../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root));
const DIR = 'assets/models/creatures/varrisco/';
const v04 = read(DIR + 'v04/varrisco-animated-v04-LOD0.glb'), v05 = read(DIR + 'v05/varrisco-animated-v05-LOD0.glb');
const manifest = JSON.parse(read(DIR + 'v05/manifest.json'));
const REFEITOS = ['bite', 'bite_heavy', 'claw_slash', 'claw_right', 'double_claw', 'pounce', 'jump_land', 'body_slam'];
const NOVOS = ['roar', 'tail_sweep', 'limp'];

function parse(b) {
  assert.equal(b.toString('ascii', 0, 4), 'glTF'); assert.equal(b.readUInt32LE(8), b.length);
  const n = b.readUInt32LE(12), gltf = JSON.parse(b.subarray(20, 20 + n));
  return {gltf, bin: b.subarray(28 + n, 28 + n + b.readUInt32LE(20 + n))};
}
const CT = {5126: ['readFloatLE', 4], 5121: ['readUInt8', 1], 5123: ['readUInt16LE', 2], 5125: ['readUInt32LE', 4]};
function values({gltf, bin}, i) {
  const a = gltf.accessors[i], v = gltf.bufferViews[a.bufferView], [fn, size] = CT[a.componentType];
  const w = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16}[a.type], stride = v.byteStride || size * w, o = (v.byteOffset || 0) + (a.byteOffset || 0);
  const out = [];
  for (let k = 0; k < a.count; k++) for (let j = 0; j < w; j++) out.push(bin[fn](o + k * stride + j * size));
  return out;
}
const A = parse(v04), B = parse(v05);
const clip = (g, nome) => g.gltf.animations.find((x) => x.name === nome);

test('v05: SHA e bytes do manifesto, 44 clipes únicos, min/max sempre arrays', () => {
  assert.equal(createHash('sha256').update(v05).digest('hex'), manifest.glb.sha256);
  assert.equal(v05.length, manifest.glb.bytes);
  const nomes = B.gltf.animations.map((x) => x.name);
  assert.equal(nomes.length, 44); assert.equal(new Set(nomes).size, 44);
  for (const n of [...REFEITOS, ...NOVOS]) assert.ok(nomes.includes(n), n);
  for (const a of B.gltf.accessors) for (const k of ['min', 'max']) if (k in a) assert.ok(Array.isArray(a[k]), k);
});

test('v05: malha, índices, matrizes de bind e os 33 clipes mantidos idênticos à v04', () => {
  const pa = A.gltf.meshes[0].primitives[0], pb = B.gltf.meshes[0].primitives[0];
  for (const k of ['POSITION', 'NORMAL']) assert.deepEqual(values(B, pb.attributes[k]), values(A, pa.attributes[k]), k);
  assert.deepEqual(values(B, pb.indices), values(A, pa.indices));
  assert.deepEqual(values(B, B.gltf.skins[0].inverseBindMatrices), values(A, A.gltf.skins[0].inverseBindMatrices));
  const mantidos = A.gltf.animations.filter((x) => !REFEITOS.includes(x.name));
  assert.equal(mantidos.length, 33);
  for (const ca of mantidos) {
    const cb = clip(B, ca.name);
    assert.equal(cb.channels.length, ca.channels.length, ca.name);
    ca.channels.forEach((ch, i) => {
      assert.deepEqual(cb.channels[i].target, ch.target);
      const sa = ca.samplers[ch.sampler], sb = cb.samplers[cb.channels[i].sampler];
      assert.deepEqual(values(B, sb.input), values(A, sa.input), ca.name);
      assert.deepEqual(values(B, sb.output), values(A, sa.output), ca.name);
    });
  }
});

test('v05: pesos somam 1 e placas da cauda deixam de seguir só o thorax', () => {
  const p = B.gltf.meshes[0].primitives[0], pos = values(B, p.attributes.POSITION), j = values(B, p.attributes.JOINTS_0), w = values(B, p.attributes.WEIGHTS_0);
  const thorax = B.gltf.skins[0].joints.indexOf(B.gltf.nodes.findIndex((n) => n.name === 'thorax'));
  let presas = 0;
  for (let k = 0; k < pos.length / 3; k++) {
    const s = w[4 * k] + w[4 * k + 1] + w[4 * k + 2] + w[4 * k + 3];
    assert.ok(Math.abs(s - 1) < 1e-3, 'soma dos pesos');
    if (pos[3 * k] < -0.7 && [0, 1, 2, 3].some((c) => j[4 * k + c] === thorax && w[4 * k + c] > .99)) presas++;
  }
  assert.equal(presas, 0);
});

test('v05: clipes refeitos e novos com janelas, keyframes finitos e corpo em movimento', () => {
  for (const nome of [...REFEITOS, ...NOVOS]) {
    const c = clip(B, nome), e = c.extras;
    assert.equal(e.stage, 'experimental_v05_mh', nome);
    assert.ok(c.channels.length >= 8, nome);
    let maxAng = 0;
    for (const ch of c.channels) {
      const s = c.samplers[ch.sampler], t = values(B, s.input), v = values(B, s.output);
      assert.ok(t.every((x, i) => i === 0 || x > t[i - 1]), nome + ' tempos crescentes');
      assert.ok(v.every(Number.isFinite), nome);
      assert.ok(Math.abs(t.at(-1) - e.durationSeconds) < 1e-4, nome + ' duração');
      if (ch.target.path === 'rotation') for (let k = 3; k < v.length; k += 4) maxAng = Math.max(maxAng, 2 * Math.acos(Math.min(1, Math.abs(v[k]))));
    }
    assert.ok(maxAng > 0.35, `${nome}: amplitude ${maxAng.toFixed(2)} rad`);
    if (e.category === 'combat' && nome !== 'jump_land') {
      const {aviso, ativo, punicao} = e.janelasSeg;
      assert.ok(aviso[1] <= ativo[0] && ativo[1] <= punicao[0] && punicao[1] <= e.durationSeconds + 1e-6, nome + ' ordem das janelas');
    }
  }
  assert.equal(clip(B, 'limp').extras.loop, true);
});
