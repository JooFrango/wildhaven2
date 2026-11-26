// V02: Hunters autônomos com ordens, quatro ao mesmo tempo, viagem estratégica e salvar/restaurar.
// Atualizado para as regiões detalhadas móveis: só hexágonos SEM GLB disponível usam viagem simplificada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decidirMonstro } from '../../../labs/hunters/src/monstro-varrisco.js';
import { hexEm, rota } from '../src/estrategico.js';
import { passoJogo, ordenar, situacao, posicao, atorDe, todosEventos, varrisco, regiaoDe } from '../src/jogo.js';
import { grafo, novo, novoG, provedor, recarregar } from './ajuda.mjs';

const lj = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8'));
const rodar = (j, seg, cada) => { const fim = j.t + seg; while (j.t < fim) { passoJogo(j); cada?.(j); } };
// Hexágono sem GLB nesta build mais próximo da vila (e transponível).
const semGlb = (G) => G.tiles.filter((t) => !provedor.disponivel(t.id) && t.custo).sort((a, b) => Math.hypot(a.cx - 402, a.cy - 2910) - Math.hypot(b.cx - 402, b.cy - 2910))[0];

test('grafo: 272 hexágonos; vizinhança igual às shared_edges da composição 195 e aos contacts do litoral', async () => {
  const c195 = await lj('../../../world/tropical-south-v01/composition_195.json'), costa = await lj('../../../world/coast-v01/viewer/continente/composition.json');
  const G = novoG(), par = (a, b) => [a, b].sort().join('|'), arestas = new Set(grafo.arestas.map(([a, b]) => par(a, b)));
  assert.equal(G.tiles.length, 272);
  for (const e of c195.shared_edges) assert.ok(arestas.has(par(e.a, e.b)), `${e.a}|${e.b}`);
  for (const t of costa.tiles) for (const o of t.contacts) assert.ok(arestas.has(par(t.id, o)));
  assert.deepEqual(['HV_01', 'FX_20', 'ER_18'].map((id) => hexEm(G, G.porId.get(id).cx + 10, G.porId.get(id).cy).id), ['HV_01', 'FX_20', 'ER_18']);
  assert.ok(rota(G, 'HV_01', 'ER_25').length >= 2);
});

test('quatro Hunters com tarefas independentes, sem controle manual: caçada, exploração e vila', () => {
  const j = novo(1);
  ordenar(j, ['arvo', 'brena'], { tipo: 'cacar', especie: 'varrisco' });
  ordenar(j, ['caio'], { tipo: 'explorar', hex: 'HV_01' });
  ordenar(j, ['dara'], { tipo: 'vila' });
  let maxDaraVila = 0;
  const situacoes = new Map(), alvoCaio = { ...j.hunters.get('caio').atual.pontos[0] }, d0 = Math.hypot(posicao(j, 'caio').x - alvoCaio.x, posicao(j, 'caio').y - alvoCaio.y);
  rodar(j, 360, () => {
    const d = posicao(j, 'dara'); maxDaraVila = Math.max(maxDaraVila, Math.hypot(d.x - j.vila.x, d.y - j.vila.y));
    for (const id of ['arvo', 'brena', 'caio', 'dara']) (situacoes.get(id) ?? situacoes.set(id, new Set()).get(id)).add(situacao(j, id));
  });
  for (const id of ['arvo', 'brena', 'caio', 'dara']) assert.equal(atorDe(j, id).hunter.controle, 'ia');
  const ev = todosEventos(j), v = varrisco(j).a;
  const golpesHunters = ev.filter((e) => e.tipo === 'ferimento' && e.id === v.id && ['arvo', 'brena'].includes(e.atacante)).length;
  const golpesVarrisco = ev.filter((e) => e.tipo === 'monstro_golpe' && e.id === v.id).length;
  console.log({ golpesHunters, golpesVarrisco, varriscoHp: +v.saude.hp.toFixed(0), regioes: j.regioes.size, caio: j.hunters.get('caio').atual?.i ?? 'concluída', maxDaraVila: +maxDaraVila.toFixed(1), situacoes: Object.fromEntries([...situacoes].map(([k, s]) => [k, [...s]])) });
  assert.ok(golpesHunters >= 3, 'os caçadores ferem o Varrisco sozinhos');
  assert.ok(golpesVarrisco >= 3, 'o Varrisco ataca');
  assert.ok(situacoes.get('caio').has('explorando'));
  // Explorar agora usa o hexágono inteiro (antes só a janela fixa): em 360 s basta ele ter avançado rumo ao 1º ponto.
  const e = j.hunters.get('caio'), dc = e.atual ? Math.hypot(posicao(j, 'caio').x - alvoCaio.x, posicao(j, 'caio').y - alvoCaio.y) : 0;
  assert.ok(e.atual?.i >= 1 || d0 - dc > 300, `explorador avançou (de ${d0.toFixed(0)} para ${dc.toFixed(0)} m do 1º ponto)`);
  assert.ok(maxDaraVila < 40, 'Dara permaneceu na vila');
  assert.ok(j.hunters.get('arvo').log.some((r) => /localizado/.test(r.texto)));
});

test('viagem simplificada só no trecho sem GLB, e volta ao terreno detalhado, sem saltos de posição', () => {
  const j = novo(2), alvoHex = semGlb(j.G), alvo = { x: alvoHex.cx, y: alvoHex.cy };
  ordenar(j, ['caio'], { tipo: 'ir', alvo, hex: alvoHex.id });
  let ant = posicao(j, 'caio'), maxSalto = 0, saiu = false;
  const passo = () => { const p = posicao(j, 'caio'); maxSalto = Math.max(maxSalto, Math.hypot(p.x - ant.x, p.y - ant.y)); ant = { x: p.x, y: p.y }; if (j.hunters.get('caio').modo === 'estrategico') saiu = true; };
  for (let k = 0; k < 400000 && j.hunters.get('caio').atual; k++) { passoJogo(j); passo(); }
  assert.ok(saiu, `passou à viagem simplificada ao entrar em hexágono sem GLB (${alvoHex.id})`);
  assert.equal(hexEm(j.G, posicao(j, 'caio').x, posicao(j, 'caio').y).id, alvoHex.id);
  ordenar(j, ['caio'], { tipo: 'voltar' });
  for (let k = 0; k < 400000 && j.hunters.get('caio').atual; k++) { passoJogo(j); passo(); }
  assert.equal(j.hunters.get('caio').modo, 'detalhado', 'voltou ao terreno detalhado');
  assert.ok(Math.hypot(posicao(j, 'caio').x - j.vila.x, posicao(j, 'caio').y - j.vila.y) < 5);
  assert.ok(maxSalto < 2, `sem teletransporte (maior deslocamento num passo: ${maxSalto.toFixed(2)} m)`);
  assert.ok(j.hunters.get('caio').log.some((r) => /viagem simplificada/.test(r.texto)));
});

test('salvar e restaurar: várias regiões, Hunter em viagem, Varrisco com IA de monstro; a simulação continua', () => {
  const j = novo(3), alvoHex = semGlb(j.G);
  ordenar(j, ['arvo'], { tipo: 'cacar', especie: 'varrisco' });
  ordenar(j, ['caio'], { tipo: 'ir', alvo: { x: alvoHex.cx, y: alvoHex.cy }, hex: alvoHex.id });
  for (let k = 0; k < 400000 && j.hunters.get('caio').modo !== 'estrategico'; k++) passoJogo(j);
  rodar(j, 20);
  const { salvo, jogo: r } = recarregar(j);
  console.log('save', (JSON.stringify(salvo).length / 1e6).toFixed(2), 'MB', 'regiões', salvo.regioes.length);
  assert.ok(JSON.stringify(salvo).length < 4e6, 'save sem o terreno');
  assert.equal(r.t, j.t); assert.equal(r.regioes.size, j.regioes.size);
  for (const id of ['arvo', 'brena', 'caio', 'dara']) {
    const a = posicao(j, id), b = posicao(r, id);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-6, id);
    assert.equal(r.hunters.get(id).atual?.tipo, j.hunters.get(id).atual?.tipo);
    assert.equal(atorDe(r, id).saude.hp, atorDe(j, id).saude.hp);
    assert.equal(regiaoDe(r, id)?.id, regiaoDe(j, id)?.id);
  }
  assert.equal(r.hunters.get('caio').modo, 'estrategico');
  const v = varrisco(r); if (v.vivo && v.R.m.porId.has(v.a.id)) assert.equal(v.a.comandoTeste, decidirMonstro);
  const antes = posicao(r, 'caio');
  rodar(r, 10);
  assert.ok(Math.hypot(posicao(r, 'caio').x - antes.x, posicao(r, 'caio').y - antes.y) > 1, 'viagem continua após restaurar');
});
