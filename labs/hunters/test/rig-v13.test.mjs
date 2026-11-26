// Rig v13 (plano PvE, E0/E1): o GLB publicado bate com o manifesto e passa nos portões de pele e empunhadura.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const u = (p) => new URL(p, import.meta.url);
const A = '../assets/hunter-rig-v13/';
const manifest = JSON.parse(readFileSync(u(A + 'manifest.json'), 'utf8'));
const glbBytes = readFileSync(u(A + 'hunter_rig_v13_blockout.glb'));

function parse(buf) {
  const jl = buf.readUInt32LE(12), g = JSON.parse(buf.subarray(20, 20 + jl)), off = 20 + jl + 8;
  const read = (i) => {
    const a = g.accessors[i], bv = g.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const sz = { 5126: 4, 5123: 2, 5121: 1 }[a.componentType], st = bv.byteStride || sz * n, base = off + (bv.byteOffset || 0) + (a.byteOffset || 0);
    const rd = { 5126: (o) => buf.readFloatLE(o), 5123: (o) => buf.readUInt16LE(o), 5121: (o) => buf.readUInt8(o) }[a.componentType];
    const div = a.normalized ? (a.componentType === 5121 ? 255 : 65535) : 1;
    return Array.from({ length: a.count }, (_, k) => Array.from({ length: n }, (_, c) => rd(base + k * st + c * sz) / div));
  };
  const skinned = g.meshes[g.nodes.find((x) => x.skin !== undefined).mesh].primitives[0];
  return { g, P: read(skinned.attributes.POSITION), J: read(skinned.attributes.JOINTS_0), W: read(skinned.attributes.WEIGHTS_0) };
}
const v13 = parse(glbBytes);
const jointNames = v13.g.skins[0].joints.map((j) => v13.g.nodes[j].name);

test('GLB igual ao manifesto', () => {
  assert.equal(glbBytes.length, manifest.model.bytes);
  assert.equal(createHash('sha256').update(glbBytes).digest('hex'), manifest.model.sha256);
  assert.equal(jointNames.length, manifest.model.joints);
});

test('esqueleto: os 19 nomes da base continuam e os ossos novos existem', () => {
  const base = ['Hips', 'Spine02', 'Spine', 'neck', 'Head'];
  for (const s of ['Left', 'Right']) base.push(...['Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot'].map((b) => s + b));
  const novos = ['root', 'SpineMid', 'WeaponSocket_R', 'WeaponSocket_L', 'Sheath_Back'];
  for (const s of ['Left', 'Right']) novos.push(...['ArmTwist', 'ForeArmTwist1', 'ForeArmTwist2', 'UpLegTwist', 'ToeBase', 'Thumb1', 'Thumb2', 'Fingers1', 'Fingers2', 'ElbowHelper', 'KneeHelper'].map((b) => s + b));
  for (const n of [...base, ...novos]) assert.ok(jointNames.includes(n), n);
  assert.ok(!jointNames.some((n) => n.startsWith('CTRL_')), 'controle não exportado');
});

test('pesos: até 4 influências, soma 1', () => {
  for (const w of v13.W) assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 0.01);
});

test('cabeça da base intacta (cabelos da oficina)', () => {
  const base = parse(readFileSync(u('../../../assets/hunters/hunter-workshop/base/hunter-masculino-1000v/hunter_masculino_1000v.glb')));
  const head = base.g.skins[0].joints.indexOf(base.g.nodes.findIndex((x) => x.name === 'Head'));
  const key = (p) => p.map((x) => x.toFixed(4)).join(',');
  const have = new Set(v13.P.map(key));
  const cabeca = base.P.filter((_, i) => base.J[i].reduce((s, j, c) => s + (j === head ? base.W[i][c] : 0), 0) > 0.5);
  assert.ok(cabeca.length > 100);
  assert.equal(cabeca.filter((p) => !have.has(key(p))).length, 0);
});

test('espada presa ao socket direito', () => {
  const sock = v13.g.nodes.findIndex((x) => x.name === 'WeaponSocket_R');
  const filhos = (v13.g.nodes[sock].children ?? []).map((i) => v13.g.nodes[i]);
  assert.ok(filhos.some((x) => x.mesh !== undefined && /Espada|Sword/.test(x.name ?? '')));
});

test('portões de deformação e empunhadura', () => {
  const def = JSON.parse(readFileSync(u('../resultados/rig-v13/deformacao-v13.json'), 'utf8'));
  assert.deepEqual(def.violacoes, []);
  assert.equal(def.glb.sha256, manifest.model.sha256, 'medidas feitas sobre este GLB');
  const grip = JSON.parse(readFileSync(u(A + 'grip-v13.json'), 'utf8'));
  for (const s of ['Right', 'Left']) {
    assert.ok(grip[s].coberturaSetores >= 9, `${s}: cabo envolvido pelo punho`);
    assert.ok(grip[s].folgaMinM >= 0.013, `${s}: dedos não atravessam o cabo`);
  }
});
