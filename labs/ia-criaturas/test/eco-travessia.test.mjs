// Travessia entre hexágonos reais: o corredor derivado das peças oficiais é contínuo na divisa e
// a simulação atravessa sem quebra (sem salto de posição nem reinício de comportamento).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscarCaminho, desserializarTerreno, perfilMobilidade, transitavel } from '../src/eco/terreno.js';
import { criarMundoEco, passoEco } from '../src/eco/mundo.js';
import { CFG } from './eco-ajudantes.mjs';

const CEN = CFG.cenarios['travessia-divisa'];
const DADOS = CEN.terreno.dados;
const T = desserializarTerreno(DADOS);
const DV = DADOS.origem.divisa.local;

test('corredor sai das peças oficiais da composição, nas posições dela', () => {
  const o = DADOS.origem;
  assert.equal(o.tipo, 'corredor-hexes');
  assert.deepEqual(o.hexes.map((h) => h.id), ['SE', 'X7']);
  // Peças vizinhas no mesmo Z: a divisa é o X do meio entre os centros, e cai dentro do corredor.
  assert.equal(o.divisa.eixo, 'x');
  assert.ok(Math.abs(o.divisa.mundo - (o.hexes[0].center_x + o.hexes[1].center_x) / 2) < 1e-3);
  assert.ok(DV > 10 && DV < T.largura - 10, `divisa em x=${DV} deve ficar dentro do corredor`);
  assert.equal(o.contagens.semAltura, 0, 'toda célula do corredor tem altura de alguma peça');
});

test('na divisa não há fresta nem salto de altura', () => {
  const i = Math.floor(DV);
  let saltoDivisa = 0, saltoCorredor = 0;
  for (let j = 0; j < T.ny; j++) {
    const a = T.alturas[j * T.nx + i - 1], b = T.alturas[j * T.nx + i], c = T.alturas[j * T.nx + i + 1];
    saltoDivisa = Math.max(saltoDivisa, Math.abs(b - a), Math.abs(c - b));
  }
  for (let j = 0; j < T.ny; j++) for (let q = 1; q < T.nx; q++) saltoCorredor = Math.max(saltoCorredor, Math.abs(T.alturas[j * T.nx + q] - T.alturas[j * T.nx + q - 1]));
  assert.ok(saltoDivisa < 0.5, `salto de 1 m na coluna da divisa: ${saltoDivisa.toFixed(3)} m`);
  assert.ok(saltoDivisa <= saltoCorredor, 'a divisa não é mais acidentada que o resto do corredor');
});

test('as duas espécies cruzam a divisa a pé, nos dois sentidos', () => {
  const z = T.profundidade / 2;
  for (const id of ['velsari', 'varrisco']) {
    const e = CFG.especies[id];
    const p = perfilMobilidade(T, e.movimento);
    assert.ok(transitavel(T, p, DV - 60, z) && transitavel(T, p, DV + 60, z), `${id}: os dois lados da divisa são transitáveis`);
    for (const [de, para] of [[DV - 60, DV + 60], [DV + 60, DV - 60]]) {
      const c = buscarCaminho(T, p, { x: de, y: z }, { x: para, y: z }, { raio: e.corpo.raio });
      assert.ok(c?.completo, `${id}: caminho ${de.toFixed(0)}→${para.toFixed(0)} completo`);
    }
  }
});

test('atravessar não reinicia a criatura nem teleporta', () => {
  const m = criarMundoEco(CFG, CEN, 5);
  const lado = new Map(m.vivos.map((a) => [a.id, a.x < DV ? -1 : 1]));
  const antes = new Map(m.vivos.map((a) => [a.id, { x: a.x, y: a.y, estado: a.estado }]));
  const cruzamentos = [];
  while (m.t < 300) {
    passoEco(m);
    for (const a of m.vivos) {
      const ant = antes.get(a.id);
      if (!ant) { antes.set(a.id, { x: a.x, y: a.y, estado: a.estado }); lado.set(a.id, a.x < DV ? -1 : 1); continue; }
      const passo = Math.hypot(a.x - ant.x, a.y - ant.y);
      // Nenhum passo maior que a corrida da espécie no dt (com folga): sem salto de posição.
      assert.ok(passo <= a.especie.movimento.corrida * m.dt * 1.5 + 0.01, `${a.id} andou ${passo.toFixed(2)} m em ${m.dt} s`);
      const l = a.x < DV ? -1 : 1;
      if (l !== lado.get(a.id)) {
        cruzamentos.push({ id: a.id, t: m.t, sentido: l > 0 ? 'oeste→leste' : 'leste→oeste', estado: a.estado, estadoAntes: ant.estado, passo });
        lado.set(a.id, l);
      }
      antes.set(a.id, { x: a.x, y: a.y, estado: a.estado });
    }
  }
  assert.ok(cruzamentos.length > 0, 'alguma criatura cruzou a divisa em 300 s');
  assert.ok(cruzamentos.some((c) => c.sentido === 'oeste→leste'), 'houve travessia oeste→leste');
  for (const c of cruzamentos) {
    assert.notEqual(c.estado, 'inicio', `${c.id} não volta ao estado inicial ao cruzar (t=${c.t.toFixed(1)}s)`);
    assert.ok(c.passo < 2, `${c.id} cruzou a divisa andando (passo ${c.passo.toFixed(2)} m)`);
  }
});
