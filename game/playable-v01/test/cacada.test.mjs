// Caçada no terreno real derivado: o Varrisco percebe, persegue, ataca e fere; o Hunter fere e o combate termina.
// Três sementes, Hunter na IA do laboratório (o jogador é testado no navegador: tools/navegador.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { carregarHunterLab } from '../../../labs/hunters/src/node-hunters.mjs';
import { passoHunters } from '../../../labs/hunters/src/mundo-hunters.js';
import { desserializarTerreno, indice } from '../../../labs/ia-criaturas/src/eco/terreno.js';
import { prepararConfig, criarCacada, decidirJogador } from '../src/cacada.js';

const dados = JSON.parse(await readFile(new URL('../public/data/regiao-v01-sim.json', import.meta.url), 'utf8'));
const LAB = await carregarHunterLab();
const cfg = prepararConfig(LAB.cfg, LAB.fichaHunter);
const nova = (semente, vidaMonstro) => criarCacada(cfg, dados, semente, { ...LAB, terreno: desserializarTerreno(dados), vidaMonstro });

test('terreno derivado cobre os três hexágonos sem buracos', () => {
  assert.deepEqual(dados.origem.hexes.map((h) => h.id), ['HV_01', 'FX_20', 'ER_18']);
  assert.equal(dados.origem.contagens.semAltura, 0);
  assert.ok(dados.origem.contagens.vilaBloqueio > 50, 'paredes da vila entram na grade');
});

for (const semente of [1, 2, 3]) test(`semente ${semente}: Varrisco ataca e o combate termina`, () => {
  const m = nova(semente), h = m.hunters[0], v = m.animais.find((a) => a.especie.id === 'varrisco');
  // A IA do Hunter vai até a toca (o jogador faria isso andando); depois a caçada segue sozinha.
  h.hunter.ordem = { tipo: 'ir', x: m.pontos.toca.x, y: m.pontos.toca.y + 25, ritmo: 'corrida' };
  while (m.t < 600 && !m.resultado) passoHunters(m);
  const de = (tipo, f = () => true) => m.eventos.filter((e) => e.tipo === tipo && f(e));
  const golpes = de('monstro_golpe', (e) => e.id === v.id);
  const noHunter = de('ferimento', (e) => e.id === h.id), noMonstro = de('ferimento', (e) => e.id === v.id);
  console.log(`semente ${semente}: t ${m.t.toFixed(1)} s · golpes do Varrisco ${golpes.length} (${new Set(golpes.map((e) => e.ataque)).size} tipos) · ferimentos no Hunter ${noHunter.length} · no Varrisco ${noMonstro.length} · ${m.resultado?.motivo ?? 'sem desfecho'}`);
  assert.ok(de('monstro_aggro', (e) => e.id === v.id).length, 'Varrisco percebeu o Hunter');
  assert.ok(golpes.length >= 5, 'Varrisco executa ataques');
  assert.ok(noHunter.length >= 1, 'Varrisco fere o Hunter');
  assert.ok(noMonstro.length >= 1, 'Hunter fere o Varrisco');
  assert.ok(m.resultado, 'combate termina em vitória ou derrota');
});

test('preset da demonstração (vida 0,5): o Varrisco pode ser derrotado', () => {
  const m = nova(5, 0.5), h = m.hunters[0], v = m.animais.find((a) => a.especie.id === 'varrisco');
  h.hunter.ordem = { tipo: 'ir', x: m.pontos.toca.x, y: m.pontos.toca.y + 25, ritmo: 'corrida' };
  while (m.t < 600 && !m.resultado) passoHunters(m);
  assert.equal(m.resultado?.motivo, 'criatura derrotada');
  assert.equal(v.vivo, false);
});

test('jogador sem inimigo: WASD relativo à câmera move o Hunter e respeita o terreno', () => {
  const m = nova(9), h = m.hunters[0];
  h.comandoTeste = decidirJogador; h.hunter.controle = 'manual';
  const x0 = h.x, y0 = h.y;
  h.hunter.comando = { frente: true, correr: true, rumo: -Math.PI / 2 };   // norte = −y
  while (m.t < 10) passoHunters(m);
  assert.ok(y0 - h.y > 20, `andou para o norte (${(y0 - h.y).toFixed(1)} m)`);
  assert.ok(Math.abs(h.x - x0) < 15);
  const k = indice(m.terreno, h.x, h.y);
  assert.ok(k >= 0 && !m.terreno.bloqueio[k], 'não atravessou bloqueio');
});
