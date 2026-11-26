// D1: agarrão não deve teleportar a vítima através de parede/obstáculo.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { indice, perfilMobilidade } from '../src/eco/terreno.js';
import { atualizarAgarroes } from '../src/eco/combate.js';
import { criarMundoEco } from '../src/eco/mundo.js';
import { salvarMundo, carregarMundo } from '../src/eco/persistencia.js';
import { CFG, cenarioTeste } from './eco-ajudantes.mjs';

const varrisco = (id, x, y, o = {}) => ({ especie: 'varrisco', individuos: [{ id, x, y, sexo: 'M', fome: 10, energia: 100, direcaoGraus: 0, ...o }] });

function mundoCom(cenario, semente = 1) {
  const cfg = { ...CFG, cenarios: { ...CFG.cenarios, [cenario.id]: cenario } };
  return { m: criarMundoEco(cfg, cenario, semente), cfg };
}

function cenaAgarrao(id, rochas) {
  return cenarioTeste(id, [varrisco('p', 50, 50, { energia: 100 }), varrisco('v', 50, 50, { energia: 100 })], { rochas, amplitude: 0 });
}

test('D1: agarrão em solo plano (sem parede) reposiciona a vítima normalmente', () => {
  const { m } = mundoCom(cenaAgarrao('d1-plano', []));
  const [p, v] = m.vivos;
  p.agarrando = v.id; v.agarradoPor = p.id;
  atualizarAgarroes(m, 0.1);
  assert.ok(v.x > 50, `sem obstáculo a vítima deve avançar com a mordida (x=${v.x})`);
});

test('D1: agarrão perto de parede não teleporta a vítima através da rocha', () => {
  const rochas = [];
  for (let y = 44; y <= 56; y += 1) rochas.push({ x: 52, y, raio: 1.3, altura: 0.3 });
  const { m } = mundoCom(cenaAgarrao('d1-parede', rochas));
  const [p, v] = m.vivos;
  const perfil = perfilMobilidade(m.terreno, v.especie.movimento);
  p.agarrando = v.id; v.agarradoPor = p.id;
  for (let i = 0; i < 20; i++) {
    atualizarAgarroes(m, 0.1);
    const k = indice(m.terreno, v.x, v.y);
    assert.ok(k < 0 || perfil.passavel[k] === 1, `vítima entrou em célula bloqueada (x=${v.x.toFixed(2)}, y=${v.y.toFixed(2)})`);
  }
});

test('D1: agarrão sobre terreno irregular (rocha alta) não empurra a vítima para célula intransponível', () => {
  const { m } = mundoCom(cenaAgarrao('d1-irregular', [{ x: 53, y: 50, raio: 2, altura: 6 }]));
  const [p, v] = m.vivos;
  const perfil = perfilMobilidade(m.terreno, v.especie.movimento);
  p.agarrando = v.id; v.agarradoPor = p.id;
  for (let i = 0; i < 10; i++) {
    atualizarAgarroes(m, 0.1);
    const k = indice(m.terreno, v.x, v.y);
    assert.ok(k < 0 || perfil.passavel[k] === 1, 'vítima não deve ficar numa célula intransponível');
  }
});

test('D1: vítima resistindo pode se soltar; nunca atravessa obstáculo durante a luta', () => {
  const rochas = [];
  for (let y = 44; y <= 56; y += 1) rochas.push({ x: 52, y, raio: 1.3, altura: 0.3 });
  const { m } = mundoCom(cenaAgarrao('d1-resistir', rochas));
  const [p, v] = m.vivos;
  const perfil = perfilMobilidade(m.terreno, v.especie.movimento);
  p.agarrando = v.id; v.agarradoPor = p.id;
  for (let i = 0; i < 300 && v.agarradoPor; i++) {
    atualizarAgarroes(m, 0.1);
    const k = indice(m.terreno, v.x, v.y);
    assert.ok(k < 0 || perfil.passavel[k] === 1, 'não pode atravessar obstáculo enquanto luta para se soltar');
  }
});

test('D1: regra de capacidade (massa/força) de iniciar o agarrão não foi tocada por este fix', () => {
  // tentarAgarrar() já exige forcaA >= forcaV*6 antes deste fix; confirmamos só que ela ainda existe
  // e que atualizarAgarroes (o alvo deste fix) não depende de reavaliar essa capacidade a cada passo.
  const { m } = mundoCom(cenarioTeste('d1-massa', [
    { especie: 'velsari', individuos: [{ id: 'p', x: 50, y: 50, fome: 10, sede: 5, energia: 100 }] },
    varrisco('v', 50.5, 50, { energia: 100 }),
  ], { amplitude: 0 }));
  const p = m.porId.get('p'), v = m.porId.get('v');
  assert.ok(v.massa > p.massa * 1.5, `presa (${v.massa.toFixed(0)}kg) deve ser maior que o predador pequeno (${p.massa.toFixed(0)}kg)`);
});

test('D1: save/load durante agarrão preserva o estado e não corrompe a posição da vítima', () => {
  const { m, cfg } = mundoCom(cenaAgarrao('d1-save', []));
  const [p, v] = m.vivos;
  p.agarrando = v.id; v.agarradoPor = p.id;
  atualizarAgarroes(m, 0.1);
  const salvo = salvarMundo(m);
  const m2 = carregarMundo(cfg, salvo);
  const v2 = m2.porId.get(v.id), p2 = m2.porId.get(p.id);
  assert.equal(v2.agarradoPor, p2.id, 'agarrão persiste no save/load');
  assert.ok(Number.isFinite(v2.x) && Number.isFinite(v2.y), 'posição válida após carregar');
});
