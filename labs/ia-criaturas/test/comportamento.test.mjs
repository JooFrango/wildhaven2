import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distancia, penetracaoCirculoRetangulo } from '../src/core/geometria.js';
import { criarMundo, passo } from '../src/core/mundo.js';
import { cenario, configCom, criatura, eventos, rodarAte } from './ajudantes.mjs';

test('alimentação: herbívoro faminto vai até o capim, come e a fome cai', () => {
  const cfg = configCom(cenario('t', [{ id: 'h', especie: 'herbivoro-exemplo', x: 10, y: 20, fome: 80 }], {
    alimentos: [{ id: 'capim', x: 18, y: 20, raio: 2, quantidade: 50 }],
  }));
  const m = criarMundo(cfg, 't', 1);
  assert.ok(rodarAte(m, (mm) => criatura(mm, 'h').estado === 'comendo', 15), 'deveria começar a comer');
  const fomeAntes = criatura(m, 'h').fome;
  rodarAte(m, () => false, m.t + 3);
  assert.ok(criatura(m, 'h').fome < fomeAntes - 5, 'fome deveria cair');
  assert.ok(m.alimentos[0].quantidade < 50, 'capim deveria diminuir');
  assert.equal(eventos(m, 'comer_inicio', 'h').length, 1);
});

test('fuga: herbívoro vê predador, foge, e volta à atividade quando seguro', () => {
  const cfg = configCom(cenario('t', [
    { id: 'h', especie: 'herbivoro-exemplo', x: 20, y: 20, direcaoGraus: 0, fome: 30 },
    { id: 'p', especie: 'predador-parado', x: 29, y: 20 },
  ]));
  const m = criarMundo(cfg, 't', 2);
  assert.ok(rodarAte(m, (mm) => criatura(mm, 'h').estado === 'fugindo', 1.5), 'deveria reconhecer e fugir');
  rodarAte(m, () => false, 3);
  assert.ok(distancia(criatura(m, 'h'), criatura(m, 'p')) > 20, 'deveria se afastar');
  assert.ok(rodarAte(m, (mm) => eventos(mm, 'fuga_fim', 'h').length > 0, 30), 'deveria encerrar a fuga');
  assert.ok(rodarAte(m, (mm) => ['vagando', 'procurando_alimento', 'indo_comer', 'comendo', 'descansando'].includes(criatura(mm, 'h').estado), 40), 'deveria voltar à atividade');
});

test('perseguição e perda de contato: presa some atrás da rocha, predador vai à última posição e desiste', () => {
  const rocha = { id: 'rocha', x: 40, y: 0, w: 4, h: 40, bloqueiaVisao: true, bloqueiaMovimento: true };
  const cfg = configCom(cenario('t', [
    { id: 'p', especie: 'predador-exemplo', x: 8, y: 20, direcaoGraus: 0, fome: 70 },
    { id: 'presa', especie: 'presa-rota', x: 20, y: 20 },
  ], { obstaculos: [rocha] }));
  const m = criarMundo(cfg, 't', 4);
  assert.ok(rodarAte(m, (mm) => criatura(mm, 'p').estado === 'perseguindo', 5));
  // A presa "se esconde": vai para trás da rocha, parada e em silêncio.
  const presa = criatura(m, 'presa');
  const vistaEm = { x: presa.x, y: presa.y };
  presa.x = 55; presa.y = 20;
  passo(m);
  const pred = criatura(m, 'p');
  assert.ok(['investigando', 'farejando'].includes(pred.estado), `esperava investigar, está ${pred.estado}`);
  assert.deepEqual({ x: pred.alvo.x, y: pred.alvo.y }, vistaEm, 'alvo deve ser a última posição vista, não a real');
  assert.ok(rodarAte(m, (mm) => eventos(mm, 'desistencia', 'p').length > 0, 30));
  assert.equal(eventos(m, 'desistencia', 'p')[0].motivo, 'perda_rastro');
  assert.ok(m.decisoes.some((d) => d.id === 'p' && d.estado === 'farejando'), 'deveria farejar na última posição');
  assert.equal(m.perseguicoes[0].motivo, 'desistiu_perda_rastro');
});

test('cansaço: predador com pouca energia persegue e desiste', () => {
  const cfg = configCom(cenario('t', [
    { id: 'p', especie: 'predador-exemplo', x: 8, y: 20, direcaoGraus: 0, energia: 30, fome: 90 },
    { id: 'presa', especie: 'presa-rota', x: 18, y: 20, patrulha: [[58, 20], [58, 38]], ritmo: 'corrida' },
  ]));
  const m = criarMundo(cfg, 't', 5);
  assert.ok(rodarAte(m, (mm) => eventos(mm, 'desistencia', 'p').length > 0, 30), 'deveria desistir');
  const d = eventos(m, 'desistencia', 'p')[0];
  assert.equal(d.motivo, 'cansaco');
  assert.ok(eventos(m, 'perseguicao_inicio', 'p').length >= 1);
  assert.ok(criatura(m, 'p').energia <= criatura(m, 'p').especie.decisao.energiaDesistir + 1);
  rodarAte(m, () => false, m.t + 2);
  assert.equal(criatura(m, 'p').estado, 'descansando');
  assert.ok(criatura(m, 'p').velocidade < 0.5);
});

test('alcance de ataque: só ataca dentro do alcance e captura presa parada', () => {
  const cfg = configCom(cenario('t', [
    { id: 'p', especie: 'predador-exemplo', x: 10, y: 20, direcaoGraus: 0, fome: 70, patrulha: [[30, 20]] },
    { id: 'presa', especie: 'presa-rota', x: 16, y: 20 },
  ]));
  const m = criarMundo(cfg, 't', 6);
  rodarAte(m, () => false, 20);
  const alcance = criatura(m, 'p').especie.ataque.alcance;
  const ataques = eventos(m, 'ataque', 'p');
  assert.ok(ataques.length >= 1);
  for (const a of ataques) assert.ok(a.distancia <= alcance + 1e-9, `ataque a ${a.distancia} m`);
  assert.equal(eventos(m, 'ataque_fora_alcance').length, 0);
  assert.equal(m.fim?.motivo, 'captura');
  assert.equal(criatura(m, 'presa').vivo, false);
});

test('colisão: criatura contorna a rocha e nunca a atravessa', () => {
  const rocha = { id: 'rocha', x: 25, y: 12, w: 6, h: 16, bloqueiaVisao: true, bloqueiaMovimento: true };
  const cfg = configCom(cenario('t', [
    { id: 'b', especie: 'presa-rota', x: 10, y: 20, patrulha: [[45, 20]], ritmo: 'corrida' },
  ], { obstaculos: [rocha] }));
  const m = criarMundo(cfg, 't', 7);
  let maxPen = 0;
  rodarAte(m, (mm) => {
    const b = criatura(mm, 'b');
    maxPen = Math.max(maxPen, penetracaoCirculoRetangulo(b, b.especie.corpo.raio, rocha));
    return distancia(b, { x: 45, y: 20 }) < 0.6;
  }, 30);
  assert.ok(distancia(criatura(m, 'b'), { x: 45, y: 20 }) < 0.6, 'deveria chegar do outro lado');
  assert.ok(maxPen <= 0.02, `penetrou ${maxPen} m`);
  assert.equal(m.falhas.length, 0);
});

test('moita bloqueia visão mas não movimento', () => {
  const moita = { id: 'moita', x: 25, y: 15, w: 6, h: 10, bloqueiaVisao: true, bloqueiaMovimento: false };
  const cfg = configCom(cenario('t', [
    { id: 'b', especie: 'presa-rota', x: 10, y: 20, patrulha: [[45, 20]], ritmo: 'trote' },
  ], { obstaculos: [moita] }));
  const m = criarMundo(cfg, 't', 8);
  let passouPorDentro = false;
  rodarAte(m, (mm) => { const b = criatura(mm, 'b'); if (b.x > 26 && b.x < 30 && Math.abs(b.y - 20) < 0.5) passouPorDentro = true; return b.x > 44; }, 20);
  assert.ok(passouPorDentro, 'deveria atravessar a moita em linha reta');
});

test('cérebro recebe apenas sentidos, nunca o mundo', async () => {
  const { COMPORTAMENTOS } = await import('../src/core/comportamentos/index.js');
  const original = COMPORTAMENTOS.predador.decidir;
  const vistos = new Set();
  COMPORTAMENTOS.predador.decidir = function (s, mente) { for (const k of Object.keys(s)) vistos.add(k); return original.call(this, s, mente); };
  try {
    const cfg = configCom(cenario('t', [
      { id: 'p', especie: 'predador-exemplo', x: 10, y: 20, direcaoGraus: 0, fome: 70 },
      { id: 'presa', especie: 'presa-rota', x: 30, y: 20 },
    ]));
    const m = criarMundo(cfg, 't', 9);
    rodarAte(m, () => false, 2);
  } finally {
    COMPORTAMENTOS.predador.decidir = original;
  }
  assert.deepEqual([...vistos].sort(), ['contatos', 'dt', 'eu', 'memoria', 'rng', 't', 'terreno']);
});
