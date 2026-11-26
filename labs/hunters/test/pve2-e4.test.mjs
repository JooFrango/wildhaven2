// E4, lote 1 (locomoção com espada no rig v13): campos do contrato no GLB e portões medidos sobre este mesmo arquivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const u = (p) => new URL(p, import.meta.url);
const glb = readFileSync(u('../assets/hunter-rig-v13/hunter_rig_v13_blockout.glb'));
const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)));
const anims = Object.fromEntries(gltf.animations.map((a) => [a.name, a.extras ?? {}]));
const portoes = JSON.parse(readFileSync(u('../resultados/pve2-e4/portoes-e4.json'), 'utf8'));
const GAITS = ['pve2_a_sword_walk', 'pve2_a_sword_jog', 'pve2_a_sword_run'];
const noChao = (iv, t) => iv.some(([a, b]) => t >= a - 1e-6 && t <= b + 1e-6);

test('portões medidos neste GLB, sem violação', () => {
  assert.equal(portoes.glb.sha256, createHash('sha256').update(glb).digest('hex'));
  assert.deepEqual(portoes.violacoes, []);
  for (const n of [...GAITS, 'pve2_b_sword_guard']) assert.ok(portoes.clips[n], n);
});

test('extras do contrato em cada clipe', () => {
  for (const n of [...GAITS, 'pve2_b_sword_guard']) {
    const ex = anims[n]; assert.ok(ex, n);
    assert.equal(ex.contract, 'hunter-pve-v02'); assert.equal(ex.loop, true); assert.equal(ex.fps, 60);
    assert.ok(Number.isInteger(Math.round(ex.duration * 60)) && Math.abs(ex.duration * 60 - Math.round(ex.duration * 60)) < 1e-6, 'quadros inteiros');
    assert.ok(ex.footContacts?.left?.length && ex.footContacts?.right?.length);
  }
  for (const n of GAITS) assert.ok(Math.abs(anims[n].stride - anims[n].speedMs * anims[n].duration) < 1e-6, `${n}: stride = velocidade × duração`);
});

test('andar tem apoio duplo; corrida tem voo', () => {
  const fase = (n, pred) => { const ex = anims[n], T = ex.duration; for (let k = 0; k < Math.round(T * 60); k++) if (pred(ex.footContacts, k / 60)) return true; return false; };
  assert.ok(fase('pve2_a_sword_walk', (fc, t) => noChao(fc.left, t) && noChao(fc.right, t)));
  assert.ok(fase('pve2_a_sword_run', (fc, t) => !noChao(fc.left, t) && !noChao(fc.right, t)));
  assert.ok(!fase('pve2_a_sword_walk', (fc, t) => !noChao(fc.left, t) && !noChao(fc.right, t)), 'andar nunca tem voo');
});

test('corrida com pegada reversa (decisão do diretor): lâmina para trás e para baixo, longe do chão', () => {
  const bc = anims.pve2_a_sword_run.bladeCarry;
  assert.equal(bc.grip, 'reverse'); assert.ok(bc.errorDeg < 5);
  assert.ok(bc.targetDir[1] > 0 && bc.targetDir[2] < 0, 'para trás (+Y no Blender) e para baixo');
  for (const n of ['pve2_a_sword_walk', 'pve2_a_sword_jog']) assert.equal(anims[n].bladeCarry.grip, 'normal');
  assert.ok(portoes.clips.pve2_a_sword_run.pontaAcimaDoChaoM >= 0.05);
});
