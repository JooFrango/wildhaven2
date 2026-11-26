// D3: resolver() (IK 2 ossos em pernas.js) não pode dobrar/esticar o joelho além do limite anatômico.
// clampDistanciaJoelho é a mesma função pura usada por resolver() — testável sem THREE/GLB.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampDistanciaJoelho } from '../src/web3d/pernas.js';

const GRAU = Math.PI / 180;

test('D3: alvo ao alcance e dentro dos limites não é alterado', () => {
  const l1 = 0.4, l2 = 0.35;
  // d correspondente a um ângulo de joelho de 90°, dentro de [25,170].
  const d = Math.sqrt(l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos(90 * GRAU));
  const out = clampDistanciaJoelho(l1, l2, d, 25 * GRAU, 170 * GRAU);
  assert.ok(Math.abs(out - d) < 1e-6, `não deveria alterar d dentro dos limites (d=${d}, out=${out})`);
});

test('D3: alvo muito distante não hiperestende além do limite máximo (joelho nunca passa de joelhoMaxGraus)', () => {
  const l1 = 0.4, l2 = 0.35;
  const out = clampDistanciaJoelho(l1, l2, l1 + l2, 25 * GRAU, 150 * GRAU); // pede perna totalmente reta (180°)
  const dMax150 = Math.sqrt(l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos(150 * GRAU));
  assert.ok(out <= dMax150 + 1e-6, `d não pode superar o limite de 150° (out=${out}, dMax=${dMax150})`);
  assert.ok(out < l1 + l2, 'não estica além do limite mesmo com alvo no limite geométrico puro');
});

test('D3: alvo muito próximo não dobra o joelho além do limite mínimo', () => {
  const l1 = 0.4, l2 = 0.35;
  const out = clampDistanciaJoelho(l1, l2, Math.abs(l1 - l2), 40 * GRAU, 170 * GRAU); // pede dobra total (0°)
  const dMin40 = Math.sqrt(l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos(40 * GRAU));
  assert.ok(out >= dMin40 - 1e-6, `d não pode ficar abaixo do limite de 40° (out=${out}, dMin=${dMin40})`);
});

test('D3: alvo inalcançável usa fallback estável — nunca ultrapassa l1+l2 nem fica abaixo de |l1-l2|', () => {
  const l1 = 0.4, l2 = 0.35;
  for (const d of [100, 0, -5, 0.0001]) {
    const out = clampDistanciaJoelho(l1, l2, d, 25 * GRAU, 170 * GRAU);
    assert.ok(out <= l1 + l2 && out >= Math.abs(l1 - l2), `fallback deve ficar no alcance geométrico (d=${d}, out=${out})`);
    assert.ok(Number.isFinite(out), 'resultado sempre finito, nunca NaN');
  }
});

test('D3: limite não-humano (ex.: pata de quadrúpede mais fechada) respeitado quando configurado', () => {
  const l1 = 0.3, l2 = 0.25;
  // Espécie com joelho que não hiperestende (max 140°): alvo pedindo quase reta fica preso em 140°.
  const out = clampDistanciaJoelho(l1, l2, l1 + l2, 25 * GRAU, 140 * GRAU);
  const dMax140 = Math.sqrt(l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos(140 * GRAU));
  assert.ok(Math.abs(out - dMax140) < 1e-6, `deve travar exatamente no limite configurado (out=${out}, esperado=${dMax140})`);
});
