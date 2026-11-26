import assert from 'node:assert/strict';
import { test } from 'node:test';
import { indice } from '../src/eco/terreno.js';
import { animal, cenarioTeste, ev, mundoTeste, rodar } from './eco-ajudantes.mjs';

const lago = { lago: { x: 40, y: 60, raio: 10, fundo: 2 } };

test('alimentação, sede e descanso no nível 1', () => {
  const m = mundoTeste(cenarioTeste('e1', [{ especie: 'velsari', individuos: [
    { id: 'faminto', x: 100, y: 60, fome: 80, sede: 10, energia: 90 },
    { id: 'sedento', x: 70, y: 60, fome: 10, sede: 90, energia: 90 },
    { id: 'cansado', x: 120, y: 90, fome: 10, sede: 10, energia: 10 },
  ] }], lago), 1);
  const k = indice(m.terreno, 100, 60), veg0 = m.terreno.vegetacao[k];
  rodar(m, 40);
  assert.ok(animal(m, 'faminto').fome < 60, `fome caiu (${animal(m, 'faminto').fome.toFixed(1)})`);
  assert.ok(m.metricas.vegetacaoConsumida > 10 && m.terreno.vegetacao[k] <= veg0);
  assert.ok(animal(m, 'sedento').sede < 50, `sede caiu (${animal(m, 'sedento').sede.toFixed(1)})`);
  assert.ok(animal(m, 'cansado').energia > 40, `energia recuperou (${animal(m, 'cansado').energia.toFixed(1)})`);
});

// Mundo só em nível 3 (populacional), dia curto e passo maior para simular meses/anos em segundos.
const ecoLongo = (populacoes, extra = {}) => cenarioTeste('eco', populacoes, { largura: 240, profundidade: 200, res: 2, amplitude: 1, capim: 70, ...lago, ...(extra.terreno ?? {}) }, { dt: 2, relogio: { segundosPorDia: 240, diaInicial: 1, horaInicial: 8 }, ...extra });

test('reprodução, nascimentos com herança dentro dos limites e envelhecimento (nível 3)', () => {
  const m = mundoTeste(ecoLongo([{ especie: 'velsari', grupos: [{ x: 120, y: 100, raio: 8, adultos: 8, fome: 20, sede: 10 }] }]), 3, { nivelPadrao: 3, eventosDetalhados: false });
  const idade0 = m.vivos[0].idadeDias;
  rodar(m, 240 * 300);
  const nasc = ev(m, 'nascimento');
  assert.ok(nasc.length > 0, 'houve nascimentos');
  const e = m.config.especies.velsari;
  for (const n of nasc) {
    const f = animal(m, n.id);
    assert.ok(f.massaAdulta >= e.corpo.massaKg[0] && f.massaAdulta <= e.corpo.massaKg[1], 'massa herdada dentro da faixa');
    for (const v of Object.values(f.atributos)) assert.ok(v >= 0.85 && v <= 1.15);
  }
  assert.ok(m.vivos.some((a) => a.idadeDias >= idade0 + 290) || m.mortos.size, 'idade avança');
  assert.ok(ev(m, 'acasalamento').length > 0 && ev(m, 'acasalamento').length <= nasc.length * 2, 'acasalamentos coerentes com nascimentos');
});

test('morte natural por velhice', () => {
  const m = mundoTeste(ecoLongo([{ especie: 'velsari', individuos: [{ id: 'idoso', x: 120, y: 100, idadeAnos: 10.5, fome: 10, sede: 10 }] }]), 4, { nivelPadrao: 3 });
  rodar(m, 240 * 200, (mm) => !mm.porId.has('idoso'));
  assert.equal(animal(m, 'idoso').causaMorte, 'velhice');
});

test('doença: só existe a partir de caso índice, contagia parte do bando e há recuperação', () => {
  const pop = [{ especie: 'velsari', grupos: [{ x: 120, y: 100, raio: 2, adultos: 8, fome: 20, sede: 10 }] }];
  const controle = mundoTeste(cenarioTeste('d0', pop, lago), 5);
  rodar(controle, 240);
  assert.equal(controle.vivos.filter((a) => a.saude.doencas.length).length, 0, 'sem caso índice, ninguém adoece');
  const cen = cenarioTeste('d1', pop, { lago: { x: 110, y: 90, raio: 8, fundo: 2 } }, { casoIndice: { id: 'velsari-1', doenca: 'febre-de-bando' }, relogio: { segundosPorDia: 120, diaInicial: 12, horaInicial: 9 } });
  const m = mundoTeste(cen, 5, { eventosDetalhados: false });
  rodar(m, 120 * 25);
  const contagios = ev(m, 'doenca_contagio').length;
  assert.ok(contagios >= 1, `contágios: ${contagios}`);
  assert.ok(contagios < 8, 'não contagia todos automaticamente');
  assert.ok(ev(m, 'doenca_curada').length >= 1, 'há recuperação');
});

test('migração na seca: a água seca, o grupo muda de área andando (sem teleporte)', () => {
  const cen = ecoLongo([{ especie: 'velsari', grupos: [{ x: 60, y: 60, raio: 4, adultos: 5, fome: 20, sede: 20 }] }], {
    terreno: { lago: { x: 50, y: 70, raio: 6, fundo: 0.8 } },
    relogio: { segundosPorDia: 240, diaInicial: 200, horaInicial: 8 },
    clima: { fracaoChuvosa: 0.4, chanceChuvaSeca: 0, evaporacaoM: 0.08, chanceIncendio: 0 },
  });
  const m = mundoTeste(cen, 6, { nivelPadrao: 2 });
  let maxPasso = 0;
  const pos = new Map(m.vivos.map((a) => [a.id, { x: a.x, y: a.y }]));
  rodar(m, 240 * 20, (mm) => {
    for (const a of mm.vivos) { const p = pos.get(a.id); if (p) maxPasso = Math.max(maxPasso, Math.sqrt((a.x - p.x) ** 2 + (a.y - p.y) ** 2)); pos.set(a.id, { x: a.x, y: a.y }); }
    return false;
  });
  assert.ok(ev(m, 'migracao').length >= 1, 'houve migração');
  assert.ok(maxPasso <= m.config.especies.velsari.movimento.corrida * m.dt * 1.1 + 0.01, `maior deslocamento por passo ${maxPasso.toFixed(2)} m`);
});

test('carcaça: consumida, decomposta e reciclada (enriquece a vegetação local)', () => {
  const m = mundoTeste(cenarioTeste('k', [{ especie: 'varrisco', individuos: [{ id: 'v', x: 60, y: 60, fome: 80, sexo: 'M' }] }]), 7);
  const k = indice(m.terreno, 64, 60), max0 = m.terreno.vegetacaoMax[k];
  m.carcacas.push({ id: 'k1', especie: 'velsari', x: 64, y: 60, carneInicial: 12, carne: 12, decomposicao: 0, dono: null, donoDesde: null, morteT: 0, consumo: {} });
  rodar(m, 30);
  const c = m.carcacas.find((x) => x.id === 'k1');
  assert.ok(!c || c.consumo.v > 1, 'predador comeu da carcaça');
  rodar(m, 600 * 3);
  assert.ok(!m.carcacas.some((x) => x.id === 'k1'), 'carcaça decomposta');
  assert.ok(m.terreno.vegetacaoMax[k] > max0, 'nutrientes reciclados');
});

test('regeneração de vegetação após pastejo', () => {
  const m = mundoTeste(ecoLongo([]), 8, { nivelPadrao: 3 });
  const k = indice(m.terreno, 120, 100);
  m.terreno.vegetacao[k] = 2;
  rodar(m, 240 * 10);
  assert.ok(m.terreno.vegetacao[k] > 20, `rebrotou (${m.terreno.vegetacao[k].toFixed(1)})`);
});

test('dinâmica populacional plausível: 2 anos, presas variadas e um predador (nível 3)', () => {
  const m = mundoTeste(cenarioTeste('pop', [
    { especie: 'velsari', grupos: [{ x: 150, y: 150, raio: 8, adultos: 8, fome: 20 }, { x: 420, y: 300, raio: 8, adultos: 8, fome: 20 }, { x: 250, y: 380, raio: 8, adultos: 7, fome: 20 }] },
    { especie: 'tarruco', individuos: [{ x: 300, y: 120, sexo: 'F' }, { x: 320, y: 140, sexo: 'M' }, { x: 100, y: 350, sexo: 'F' }] },
    { especie: 'varrisco', individuos: [{ id: 'v1', x: 260, y: 250, sexo: 'M', fome: 50 }] },
  ], { largura: 520, profundidade: 440, res: 4, amplitude: 2, capim: 70, lago: { x: 260, y: 220, raio: 18, fundo: 2.5 } }, { dt: 4, relogio: { segundosPorDia: 240, diaInicial: 1, horaInicial: 8 } }), 9, { nivelPadrao: 3, eventosDetalhados: false });
  const inicial = m.vivos.filter((a) => a.especie.papel === 'herbivoro').length;
  const dias = 365;
  rodar(m, 240 * dias);
  const serie = m.metricas.serie.map((s) => (s.populacao.velsari ?? 0) + (s.populacao.tarruco ?? 0));
  const max = Math.max(...serie);
  const predacoes = m.metricas.mortes.predacao ?? 0;
  // Plausibilidade (não "ausência de erro"): sem explosão, predação ocorre a uma taxa compatível com um carnívoro
  // de ~70 kg que se empanturra (uma presa pequena a cada vários dias) e há reposição por nascimentos.
  assert.ok(max <= inicial * 3, `presas sem explosão (máx ${max}, inicial ${inicial})`);
  assert.ok(predacoes > 0, 'predação ocorre');
  assert.ok(predacoes / dias <= 0.3, `taxa de predação plausível (${(predacoes / dias).toFixed(2)}/dia para 1 predador)`);
  assert.ok(ev(m, 'nascimento').length > 0, 'reposição por nascimentos');
  assert.ok((m.metricas.mortes.fome ?? 0) <= inicial * 0.25, `fome não dizima as presas com pasto disponível (${m.metricas.mortes.fome ?? 0})`);
});
