// E4, lote 2 (combate com espada no rig v13): portões medidos no GLB e trajetorias-pve2.js coerente com o contrato.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import TRAJ from '../src/trajetorias-pve2.js';

const u = (p) => new URL(p, import.meta.url);
const glb = readFileSync(u('../assets/hunter-rig-v13/hunter_rig_v13_blockout.glb'));
const anims = Object.fromEntries(JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12))).animations.map((a) => [a.name, a.extras ?? {}]));
const portoes = JSON.parse(readFileSync(u('../resultados/pve2-e4/portoes-e4-combate.json'), 'utf8'));
const GOLPES = ['pve2_c_sword_combo_1', 'pve2_c_sword_combo_2', 'pve2_c_sword_combo_3', 'pve2_c_sword_charge_release'];
const TODOS = [...GOLPES, 'pve2_c_sword_charge_loop', 'pve2_b_sword_roll_left', 'pve2_b_sword_roll_right'];

test('portões medidos neste GLB, sem violação; exceções só nos rolamentos', () => {
  assert.equal(portoes.glb.sha256, createHash('sha256').update(glb).digest('hex'));
  assert.deepEqual(portoes.violacoes, []);
  for (const n of TODOS) {
    const c = portoes.clips[n]; assert.ok(c, n);
    if (!n.includes('_roll_')) assert.deepEqual(c.excecoes, [], `${n}: sem exceção`);
  }
});

test('anatomia e deformação em todos os clipes de combate (inclusive rolamentos)', () => {
  const G = portoes.gates;
  for (const n of TODOS) {
    const c = portoes.clips[n];
    assert.ok(c.joelhoMinGraus >= -G.joelhoHiperextensaoGraus, `${n}: joelho não dobra para a frente (${c.joelhoMinGraus}°)`);
    assert.ok(c.quadrilExtensaoMaxGraus <= G.quadrilExtensaoGraus, `${n}: quadril ${c.quadrilExtensaoMaxGraus}°`);
    assert.ok(c.triangulosRuins <= G.triangulosRuins && c.triangulosRuinsCoxa <= G.triangulosRuinsCoxa, `${n}: deformação`);
    assert.ok(c.bracoCabecaM >= G.bracoCabecaM, `${n}: braço longe da cabeça`);
  }
});

test('golpes: fases crescentes, contato calculado dentro da janela ativa, cotovelo estendido no contato', () => {
  for (const n of GOLPES) {
    const t = TRAJ[n], ph = t.phases;
    const ordem = ['guard', 'anticipation', 'activeStart', 'contact', 'activeEnd', 'recovery', 'guardReturn'].map((k) => ph[k]);
    assert.ok(ordem.every((x, i) => i === 0 || x >= ordem[i - 1]), `${n}: fases crescentes ${ordem}`);
    assert.equal(t.impact, ph.contact);
    assert.equal(t.frames.length, Math.round(t.duration * 60) + 1, `${n}: um quadro de lâmina por quadro`);
    assert.ok(portoes.clips[n].cotoveloNoContatoGraus >= 140);
    for (const w of t.interrupts) assert.ok(w.from >= 0 && w.to <= t.duration + 1e-9 && w.from < w.to, `${n}: janela dentro do clipe`);
  }
});

test('deslocamento: curva por quadro, eixo do contrato e coerente com o fim do clipe', () => {
  for (const n of TODOS) {
    const rm = TRAJ[n].rootMotion; if (rm.mode === 'none') continue;
    assert.ok(['z', 'x'].includes(rm.axis)); assert.equal(rm.curve.length, Math.round(TRAJ[n].duration * 60) + 1);
    assert.equal(rm.curve.at(-1), rm.distanceM); assert.equal(rm.curve[0], 0);
  }
  assert.equal(TRAJ.pve2_b_sword_roll_left.rootMotion.axis, 'x');
  assert.ok(TRAJ.pve2_b_sword_roll_left.rootMotion.distanceM > 1 && TRAJ.pve2_b_sword_roll_right.rootMotion.distanceM < -1);
});

test('a liberação parte da pose do laço de carga; o laço fecha nele mesmo', () => {
  assert.equal(TRAJ.pve2_c_sword_charge_release.startPose, 'pve2_c_sword_charge_loop');
  assert.equal(portoes.clips.pve2_c_sword_charge_loop.costuraSaida <= 0.5, true);
  assert.deepEqual(TRAJ.pve2_c_sword_charge_release.frames[0], TRAJ.pve2_c_sword_charge_loop.frames[0]);
});

test('extras do GLB e trajetórias contam a mesma história', () => {
  for (const n of TODOS) {
    assert.equal(anims[n].contract, 'hunter-pve-v02');
    assert.equal(anims[n].duration, TRAJ[n].duration);
    assert.deepEqual(TRAJ[n].footContacts, anims[n].footContacts);
  }
});
