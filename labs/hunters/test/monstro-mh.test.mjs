// Linha MH (?pve1=1&pve2=1&mh=1): Varrisco como monstro de caçada. Desligado não instala nada; ligado ataca com
// ritmo, varia golpes, fere o Hunter, nunca cede no conflito ecológico e abre janelas de punição.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {carregarHunterLab} from '../src/node-hunters.mjs';
import {criarMundoHunters, passoHunters} from '../src/mundo-hunters.js';
import {usarPve1, usarPve2} from '../src/trajetoria-arma.js';
import {usarMonstro, monstroLigado, GLB_MONSTRO} from '../src/monstro-varrisco.js';

const lj = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8'));
const LAB = await carregarHunterLab();
const CEN = (await lj('../config/cenarios.json')).find((c) => c.id === 'jogador-espada');
CEN.terreno.dados = await lj('../../hunters-codex/assets/terrain-nav.json');
CEN.geometriaPrecisa = await lj('../../hunters-codex/assets/terrain-geometry.json');
const mundo = (semente) => criarMundoHunters(LAB.cfg, structuredClone(CEN), semente, {fichaHunter: LAB.fichaHunter, equipamentos: LAB.equipamentos});

test('sem mh: Varrisco do lab segue com a ficha e a IA ecológica', () => {
  usarPve1(true); usarPve2(true); usarMonstro(false);
  const m = mundo(7), v = m.animais.find((a) => a.especie.id === 'varrisco');
  assert.equal(v.monstro, undefined); assert.equal(v.comandoTeste, undefined);
  assert.deepEqual(v.especie.combate.ataques.map((x) => x.nome), ['mordida', 'garra_foice', 'bote']);
  assert.match(v.especie.modelo.glb, /v02/);
});

test('com mh: 90 s de caçada na semente 7 com ritmo, variedade, dano e janelas', () => {
  usarPve1(true); usarPve2(true); usarMonstro(true);
  assert.equal(monstroLigado(), true);
  const m = mundo(7), v = m.animais.find((a) => a.especie.id === 'varrisco'), h = m.hunters[0];
  assert.equal(v.especie.modelo.glb, GLB_MONSTRO);
  assert.equal(v.especie.modelo.clipes.chicotada_cauda, 'tail_sweep');
  while (m.t < 90 && !m.resultado) passoHunters(m);
  const de = (tipo, f = () => true) => m.eventos.filter((e) => e.tipo === tipo && f(e));
  const golpes = de('monstro_golpe', (e) => e.id === v.id), aggro = de('monstro_aggro', (e) => e.id === v.id)[0];
  assert.ok(aggro, 'avistou o Hunter');
  const porMin = golpes.length / ((m.t - aggro.t) / 60);
  assert.ok(porMin >= 8, `ataques/min ${porMin.toFixed(1)}`);
  assert.ok(new Set(golpes.map((e) => e.ataque)).size >= 5, 'variedade de golpes');
  assert.ok(de('ferimento', (e) => e.atacante === v.id && e.id === h.id).length >= 3, 'fere o Hunter');
  assert.equal(de('conflito_fim', (e) => e.id === v.id && e.motivo === 'cedeu').length, 0, 'nunca cede');
  assert.ok(de('monstro_rugido', (e) => e.id === v.id).length >= 1, 'rugido');
  const foraEm = de('hunter_rendicao', (e) => e.id === h.id).concat(de('hunter_incapacitado', (e) => e.id === h.id))[0]?.t;
  assert.ok(foraEm === undefined || foraEm >= 60, `Hunter fora em ${foraEm}`);
  for (const e of golpes) assert.ok(e.janela[1] > e.janela[0], 'janela de punição depois do impacto');
  usarMonstro(false);
});

test('com mh: estados do monstro pedem clipes que existem no GLB v06 (rugido, queda, levantar)', async () => {
  const {clipeMonstro} = await import('../src/visual-monstro.js');
  const clipes = new Set((await lj('../../../assets/models/creatures/varrisco/v06/manifest.json')).clips.map((c) => c.name));
  usarPve1(true); usarPve2(true); usarMonstro(true);
  const m = mundo(23), v = m.animais.find((a) => a.especie.id === 'varrisco'), vistos = new Set();
  while (m.t < 90 && !m.resultado) {passoHunters(m); const c = clipeMonstro(v, m.t); if (c) vistos.add(c.nome);}
  for (const n of ['roar', 'fall', 'get_up']) assert.ok(vistos.has(n), n);
  for (const n of vistos) assert.ok(clipes.has(n), `${n} no GLB v06`);
  for (const nome of Object.values(v.especie.modelo.clipes)) assert.ok(clipes.has(nome), `${nome} mapeado e presente`);
  usarMonstro(false);
});
