// Regiões detalhadas móveis: a grade acompanha cada Hunter, construída dos GLBs reais, sem teletransporte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { desserializarTerreno } from '../../../labs/ia-criaturas/src/eco/terreno.js';
import { hexEm } from '../src/estrategico.js';
import { passoJogo, ordenar, posicao, regiaoDe, situacao } from '../src/jogo.js';
import { QUADRO, hexesDaJanela } from '../src/regioes.js';
import { novo, novoG, provedor, recarregar } from './ajuda.mjs';

const centro = (j, id) => ({ x: j.G.porId.get(id).cx, y: j.G.porId.get(id).cy });
// Anda até todos os `ids` terminarem a tarefa (ou o limite), medindo o maior deslocamento num passo de cada um.
function andar(j, ids, limite = 3000) {
  const ant = new Map(ids.map((id) => [id, posicao(j, id)])), maxPasso = new Map(ids.map((id) => [id, 0])), hexes = new Map(ids.map((id) => [id, new Set()])), modos = new Map(ids.map((id) => [id, new Set()]));
  while (j.t < limite && ids.some((id) => j.hunters.get(id).atual)) {
    passoJogo(j);
    for (const id of ids) { const p = posicao(j, id), a = ant.get(id); maxPasso.set(id, Math.max(maxPasso.get(id), Math.hypot(p.x - a.x, p.y - a.y))); ant.set(id, p); hexes.get(id).add(hexEm(j.G, p.x, p.y)?.id); modos.get(id).add(j.hunters.get(id).modo); }
  }
  return { maxPasso, hexes, modos };
}

test('grade da região = grade da V01 nas mesmas coordenadas (mesmos GLBs, mesmas regras)', async () => {
  const v01 = JSON.parse(await readFile(new URL('../../playable-v01/public/data/regiao-v01-sim.json', import.meta.url), 'utf8')), o = v01.origem;
  assert.equal(o.x0, QUADRO.x0); assert.equal(o.z0, QUADRO.z0); assert.equal(o.alturaBase, QUADRO.alturaBase);
  const w = { X0: o.x0, Z0: o.z0, L: 800, P: 3100 }, t = provedor.montar({ ...w, hexes: hexesDaJanela(novoG(), w) }), ref = desserializarTerreno(v01);
  let dh = 0, db = 0, dc = 0;
  for (let k = 0; k < ref.alturas.length; k++) { dh = Math.max(dh, Math.abs(ref.alturas[k] - t.alturas[k])); db += ref.bloqueio[k] !== t.bloqueio[k]; dc += ref.cobertura[k] !== t.cobertura[k]; }
  assert.equal(db, 0); assert.equal(dc, 0); assert.ok(dh < 0.001, `altura ${dh}`);
});

test('Brena atravessa HV_01 → FX_20 andando: região recentrada, sempre detalhada, sem saltos', () => {
  const j = novo(1);
  ordenar(j, ['arvo'], { tipo: 'vila' });
  ordenar(j, ['brena'], { tipo: 'ir', alvo: centro(j, 'FX_20'), hex: 'FX_20' });
  const r = andar(j, ['brena']);
  const e = j.hunters.get('brena'), log = e.log.map((x) => x.texto);
  console.log('brena:', e.log.filter((x) => /região|entrou|concluída/.test(x.texto)).map((x) => `${x.t} ${x.texto}`));
  assert.ok(!e.atual, 'chegou'); assert.equal(e.hexAtual, 'FX_20');
  assert.deepEqual([...r.modos.get('brena')], ['detalhado']);
  assert.ok(r.maxPasso.get('brena') < 1, `maior passo ${r.maxPasso.get('brena')}`);
  assert.ok(log.some((x) => /entrou em FX_20/.test(x)));
  assert.ok(log.filter((x) => /região detalhada (recentrada|R\d)/.test(x) || /nova região/.test(x)).length >= 3, 'a região acompanhou');
  assert.notEqual(regiaoDe(j, 'brena').id, regiaoDe(j, 'arvo').id, 'distantes: regiões independentes');
});

test('quatro destinos: Arvo na vila, Brena floresta (FX_20), Caio montanha (ER_18), Dara deserto (X3, sem GLB validado)', () => {
  const j = novo(1);
  ordenar(j, ['arvo'], { tipo: 'vila' });
  ordenar(j, ['brena'], { tipo: 'ir', alvo: centro(j, 'FX_20'), hex: 'FX_20' });
  ordenar(j, ['caio'], { tipo: 'ir', alvo: centro(j, 'ER_18'), hex: 'ER_18' });
  ordenar(j, ['dara'], { tipo: 'ir', alvo: centro(j, 'X3'), hex: 'X3' });
  const r = andar(j, ['brena', 'caio'], 2400);
  // Dara anda no terreno real até o primeiro hexágono sem GLB da rota (a ~10 km) e segue em viagem simplificada.
  while (j.t < 6000 && j.hunters.get('dara').modo !== 'estrategico') passoJogo(j);
  const reg = Object.fromEntries(['arvo', 'brena', 'caio', 'dara'].map((id) => [id, regiaoDe(j, id)?.id ?? 'viagem simplificada']));
  console.log({ t: j.t, regioes: j.regioes.size, reg, situacao: Object.fromEntries(['arvo', 'brena', 'caio', 'dara'].map((id) => [id, situacao(j, id)])), maxPasso: Object.fromEntries(r.maxPasso) });
  assert.equal(j.hunters.get('brena').hexAtual, 'FX_20'); assert.equal(j.hunters.get('caio').hexAtual, 'ER_18');
  assert.ok(!j.hunters.get('brena').atual && !j.hunters.get('caio').atual, 'Brena e Caio chegaram');
  for (const id of ['brena', 'caio']) { assert.deepEqual([...r.modos.get(id)], ['detalhado'], id); assert.ok(r.maxPasso.get(id) < 1); }
  assert.ok(Math.hypot(posicao(j, 'arvo').x - j.vila.x, posicao(j, 'arvo').y - j.vila.y) < 30, 'Arvo ficou na vila');
  assert.equal(new Set([reg.arvo, reg.brena, reg.caio]).size, 3, 'três regiões independentes');
  assert.equal(j.hunters.get('dara').modo, 'estrategico');
  assert.ok(j.hunters.get('dara').log.some((x) => /sem terreno detalhado|viagem simplificada/.test(x.texto)));
});

test('determinismo e save no meio da viagem: a cópia restaurada segue idêntica à original', () => {
  const a = novo(5), b = novo(5);
  for (const j of [a, b]) { ordenar(j, ['brena'], { tipo: 'ir', alvo: centro(j, 'FX_20'), hex: 'FX_20' }); ordenar(j, ['caio'], { tipo: 'ir', alvo: centro(j, 'ER_18'), hex: 'ER_18' }); }
  while (a.t < 400) { passoJogo(a); passoJogo(b); }
  for (const id of ['arvo', 'brena', 'caio', 'dara']) assert.deepEqual(posicao(a, id), posicao(b, id), `determinismo ${id}`);
  const { jogo: r } = recarregar(a);
  while (a.t < 520) { passoJogo(a); passoJogo(r); }
  for (const id of ['arvo', 'brena', 'caio', 'dara']) {
    const p = posicao(a, id), q = posicao(r, id);
    assert.ok(Math.hypot(p.x - q.x, p.y - q.y) < 0.05, `${id}: restaurado diverge ${Math.hypot(p.x - q.x, p.y - q.y)} m`);
  }
});
