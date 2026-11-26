// Transição por inércia (plano PvE, E3): contínua na troca, sem salto de velocidade, termina em 0,20 s.
import test from 'node:test';
import assert from 'node:assert/strict';
import { iniciarRotacao, iniciarPosicao, aplicarRotacao, aplicarPosicao, desvio, paraVetor, deVetor, peNoChao, DURACAO } from '../src/inercia.js';
import TRAJ from '../src/trajetorias-pve1.js';

const eixo = (v, a) => { const n = Math.hypot(...v), s = Math.sin(a / 2) / n; return [v[0] * s, v[1] * s, v[2] * s, Math.cos(a / 2)]; };
const ang = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])));

test('vetor de rotação ida e volta', () => {
  for (const q of [eixo([1, 2, 3], .7), eixo([0, 0, 1], 3.0), [0, 0, 0, 1]]) assert.ok(ang(deVetor(paraVetor(q)), q) < 1e-9);
});

test('no quadro da troca a tela mostra a pose anterior (sem salto)', () => {
  const q0 = eixo([1, 0, 0], .30), q1 = eixo([1, 0, 0], .35), qn = eixo([0, 1, 0], 1.2);
  const st = iniciarRotacao(q0, q1, 1 / 60, qn);
  assert.ok(ang(aplicarRotacao(st, 0, qn), q1) < 1e-9);
  const ps = iniciarPosicao([0, .9, 0], [0, .91, 0], 1 / 60, [0, .7, .2]);
  assert.deepEqual(aplicarPosicao(ps, 0, [0, .7, .2]).map((x) => +x.toFixed(9)), [0, .91, 0]);
});

test('a velocidade inicial é a da pose anterior (C1)', () => {
  const x0 = [.4, 0, 0], v0 = [3, 0, 0], h = 1e-7;   // diferença finita de um lado: erro ~ h·|x''|/2
  assert.ok(Math.abs((desvio(x0, v0, h)[0] - x0[0]) / h - v0[0]) < 1e-3);
});

test('o desvio some até 0,20 s e não passa de 2% antes disso', () => {
  const x0 = [1, -.5, .2], v0 = [0, 0, 0];
  assert.ok(Math.abs(desvio(x0, v0, DURACAO - 1e-3)[0]) < .02);
  assert.deepEqual(desvio(x0, v0, DURACAO), [0, 0, 0]);
  let prev = Infinity;   // sem velocidade inicial, o desvio só diminui
  for (let t = 0; t < DURACAO; t += .01) { const m = Math.hypot(...desvio(x0, v0, t)); assert.ok(m <= prev + 1e-12); prev = m; }
});

test('contato de pé lido do clipe (corrida PvE v01)', () => {
  const run = TRAJ.clips?.pve1_a_sword_run ?? TRAJ.pve1_a_sword_run, fc = run.footContacts, T = run.duration;
  assert.ok(fc?.left?.length && fc?.right?.length);
  const [a, b] = fc.left[0];
  assert.equal(peNoChao(fc.left, (a + b) / 2, T), true);
  assert.equal(peNoChao(fc.left, (a + b) / 2 + T, T), true, 'em laço');
  // na corrida há fase de voo: em algum instante nenhum dos pés está no chão
  let voo = false; for (let t = 0; t < T; t += 1 / 60) voo ||= !peNoChao(fc.left, t, T) && !peNoChao(fc.right, t, T);
  assert.ok(voo);
  assert.equal(peNoChao(undefined, 0, 1), null, 'sem metadado, o chamador usa a regra antiga');
});
