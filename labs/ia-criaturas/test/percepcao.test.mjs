import assert from 'node:assert/strict';
import { test } from 'node:test';
import { segmentoCruzaRetangulo } from '../src/core/geometria.js';
import { criarMundo, passo } from '../src/core/mundo.js';
import { linhaDeVisaoLivre } from '../src/core/percepcao.js';
import { montarConfig } from '../src/core/config.js';
import { ESPECIES, cenario, configCom, criatura, eventos, rodarAte } from './ajudantes.mjs';

const parede = { id: 'parede', x: 28, y: 5, w: 3, h: 30, bloqueiaVisao: true, bloqueiaMovimento: true };

test('linha de visão: rocha bloqueia, campo aberto não', () => {
  assert.equal(linhaDeVisaoLivre({ x: 10, y: 20 }, { x: 45, y: 20 }, [parede]), false);
  assert.equal(linhaDeVisaoLivre({ x: 10, y: 20 }, { x: 45, y: 20 }, []), true);
  assert.equal(linhaDeVisaoLivre({ x: 10, y: 2 }, { x: 45, y: 2 }, [parede]), true);
  assert.equal(segmentoCruzaRetangulo(0, 0, 10, 0, { x: 4, y: -1, w: 1, h: 2 }), true);
});

test('detecção: predador reconhece presa à frente (após o tempo de reconhecimento) e reage', () => {
  const cfg = configCom(cenario('t', [
    { id: 'predador', especie: 'predador-exemplo', x: 10, y: 20, direcaoGraus: 0, fome: 70, patrulha: [[40, 20]] },
    { id: 'presa', especie: 'presa-rota', x: 20, y: 20 },
  ]));
  const m = criarMundo(cfg, 't', 1);
  passo(m);
  assert.equal(eventos(m, 'deteccao', 'predador').length, 0, 'não reconhece no primeiro instante');
  assert.ok(rodarAte(m, (mm) => eventos(mm, 'deteccao', 'predador').length > 0, 1.5));
  assert.equal(eventos(m, 'deteccao', 'predador')[0].via, 'visao');
  passo(m);
  assert.ok(['aproximando', 'perseguindo', 'atacando'].includes(criatura(m, 'predador').estado));
});

const presaParada = (x, extra = {}) => configCom(cenario('t', [
  { id: 'predador', especie: 'predador-exemplo', x: 10, y: 20, direcaoGraus: 0, fome: 70, patrulha: [[10.5, 20]] },
  { id: 'presa', especie: 'presa-rota', x, y: 20 },
], extra));
const detectouEm = (cfg, t = 4) => {
  const m = criarMundo(cfg, 't', 1);
  rodarAte(m, (mm) => eventos(mm, 'deteccao', 'predador').length > 0, t);
  return { m, det: eventos(m, 'deteccao', 'predador')[0] };
};

test('camuflagem + imobilidade: presa parada só é vista dentro do alcance efetivo', () => {
  // predador vê 26 m; presa: camuflagem 0.25, parada ×0.6 → alcance efetivo 11.7 m.
  assert.ok(detectouEm(presaParada(20)).det, 'a 10 m deveria ver');
  const longe = detectouEm(presaParada(24));
  assert.equal(longe.det, undefined, 'a 14 m, parada e camuflada, não deveria ver');
  assert.ok(eventos(longe.m, 'despercebido', 'predador').some((e) => e.motivo === 'camuflagem_cobertura'));
});

test('presa em movimento é vista mais longe que parada', () => {
  const cfg = configCom(cenario('t', [
    { id: 'predador', especie: 'predador-exemplo', x: 10, y: 20, direcaoGraus: 0, fome: 70, patrulha: [[10.5, 20]] },
    { id: 'presa', especie: 'presa-rota', x: 26, y: 12, patrulha: [[26, 28]], ritmo: 'andar' },
  ]));
  assert.ok(detectouEm(cfg, 6).det, 'andando a ~16 m deveria ser vista (alcance efetivo 19.5 m)');
});

test('capim alto oculta: mesma distância, dentro do capim não é vista', () => {
  const capim = { id: 'capim', tipo: 'capim-alto', x: 18, y: 14, w: 8, h: 12, bloqueiaVisao: false, bloqueiaMovimento: false, ocultacao: 0.6 };
  assert.ok(detectouEm(presaParada(20)).det);
  const m = detectouEm(presaParada(20, { obstaculos: [capim] }));
  assert.equal(m.det, undefined, 'no capim: alcance efetivo 4.7 m < 10 m');
  assert.ok(detectouEm(presaParada(14, { obstaculos: [capim] })).det, 'a 4 m, mesmo no capim, é vista');
});

test('reconhecimento é mais rápido perto do que longe', () => {
  const t = (x) => detectouEm(presaParada(x)).det.t;
  assert.ok(t(14) < t(21), `perto ${t(14)} s, longe ${t(21)} s`);
});

test('patas macias (ruidoPassos): o mesmo trote às costas é ouvido ou não', () => {
  // Presa olha para leste; o predador trota para norte a 5 m atrás dela (ponto cego), então só pode ser ouvido.
  // Alcance auditivo: 14 m × (trote 4 / corrida 9) × ruidoPassos → 0.7: 4.4 m (não ouve); 1.0: 6.2 m (ouve).
  const comPassos = (ruido) => {
    const especies = Object.values(ESPECIES).map((e) => JSON.parse(JSON.stringify(e)));
    const predador = especies.find((e) => e.id === 'predador-exemplo');
    Object.assign(predador, { comportamento: 'estatico', furtividade: { ...predador.furtividade, ruidoPassos: ruido } });
    // Ouvinte imóvel (não se vira): ponto cego de 60° às costas.
    especies.find((e) => e.id === 'herbivoro-exemplo').comportamento = 'estatico';
    const cfg = montarConfig({ especies, cenarios: [cenario('t', [
      { id: 'h', especie: 'herbivoro-exemplo', x: 30, y: 20, direcaoGraus: 0 },
      { id: 'p', especie: 'predador-exemplo', x: 25, y: 18.2, direcaoGraus: 90, patrulha: [[25, 21.8]], ritmo: 'trote' },
    ])] });
    const m = criarMundo(cfg, 't', 1);
    rodarAte(m, () => false, 1.5);
    return eventos(m, 'deteccao', 'h');
  };
  assert.equal(comPassos(0.7).length, 0, 'patas macias: não deveria ouvir');
  const ouviu = comPassos(1);
  assert.ok(ouviu.length > 0 && ouviu[0].via === 'audicao', 'passos normais: deveria ouvir');
});

test('territórios separados: há encontros em que ninguém percebe ninguém', async () => {
  const { rodarEncontro } = await import('../src/core/simulacao.js');
  const { carregarConfigNode } = await import('../src/node/carregar-node.js');
  const cfg = await carregarConfigNode();
  const resumos = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => rodarEncontro(cfg, 'territorios-separados', s).resumo);
  const sem = resumos.filter((r) => r.resultado === 'sem_deteccao');
  assert.ok(sem.length >= 3, `esperava encontros sem detecção, houve ${sem.length}`);
  for (const r of sem) {
    assert.equal(r.fugas, 0);
    assert.equal(r.perseguicoesIniciadas, 0);
  }
});

test('só reage ao que percebeu: presa parada e silenciosa às costas não é notada', () => {
  const cfg = configCom(cenario('t', [
    { id: 'predador', especie: 'predador-exemplo', x: 20, y: 20, direcaoGraus: 0, fome: 70, patrulha: [[40, 20]] },
    { id: 'presa', especie: 'presa-rota', x: 14, y: 20 },
  ]));
  const m = criarMundo(cfg, 't', 1);
  rodarAte(m, () => false, 3);
  assert.equal(eventos(m, 'deteccao', 'predador').length, 0);
  assert.ok(m.decisoes.filter((d) => d.id === 'predador').every((d) => d.alvo !== 'presa'));
  assert.equal(criatura(m, 'predador').estado, 'patrulhando');
});

test('obstáculo bloqueia a visão: presa atrás da rocha não é vista', () => {
  const cfg = configCom(cenario('t', [
    { id: 'predador', especie: 'predador-exemplo', x: 15, y: 20, direcaoGraus: 0, fome: 70, patrulha: [[15, 21]] },
    { id: 'presa', especie: 'presa-rota', x: 36, y: 20 },
  ], { obstaculos: [parede] }));
  const m = criarMundo(cfg, 't', 1);
  rodarAte(m, () => false, 3);
  assert.equal(eventos(m, 'deteccao', 'predador').length, 0);
});

test('audição: corrida é ouvida atrás de si; rocha abafa o som', () => {
  const corredor = (obstaculos) => configCom(cenario('t', [
    { id: 'predador', especie: 'predador-exemplo', x: 30, y: 20, direcaoGraus: 0, fome: 70, patrulha: [[31, 20]] },
    { id: 'presa', especie: 'presa-rota', x: 20, y: 6, patrulha: [[20, 36]], ritmo: 'corrida' },
  ], { obstaculos }));
  const aberto = criarMundo(corredor([]), 't', 3);
  rodarAte(aberto, (m) => eventos(m, 'deteccao', 'predador').length > 0, 4);
  const det = eventos(aberto, 'deteccao', 'predador');
  assert.ok(det.length > 0 && det[0].via === 'audicao', 'deveria ouvir a presa correndo');

  const paredao = { id: 'p', x: 23, y: 2, w: 3, h: 36, bloqueiaVisao: true, bloqueiaMovimento: true };
  const comRocha = criarMundo(corredor([paredao]), 't', 3);
  rodarAte(comRocha, () => false, 4);
  assert.equal(eventos(comRocha, 'deteccao', 'predador').length, 0, 'rocha deveria abafar o som a 10 m');
});

test('memória: guarda a última posição vista e esquece após memoriaSeg', () => {
  const cfg = configCom(cenario('t', [
    { id: 'predador', especie: 'predador-exemplo', x: 10, y: 20, direcaoGraus: 0, fome: 0, patrulha: [[10.5, 20]] },
    { id: 'presa', especie: 'presa-rota', x: 20, y: 20 },
  ]));
  const m = criarMundo(cfg, 't', 1);
  assert.ok(rodarAte(m, (mm) => criatura(mm, 'predador').memoria.criaturas.has('presa'), 2));
  const presa = criatura(m, 'presa');
  presa.x = 55; presa.y = 38; // some da vista (fora do alcance), sem fazer barulho
  passo(m);
  const lembr = criatura(m, 'predador').memoria.criaturas.get('presa');
  assert.ok(lembr, 'deve lembrar');
  assert.equal(lembr.x, 20, 'lembra onde viu, não onde a presa está');
  rodarAte(m, () => false, m.t + criatura(m, 'predador').especie.percepcao.memoriaSeg + 0.5);
  assert.equal(criatura(m, 'predador').memoria.criaturas.has('presa'), false);
});
