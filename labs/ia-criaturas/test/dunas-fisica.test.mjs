// Física do volume de areia: profundidade, passagem, colisão com rocha e leito, transições sem teletransporte.
// Usa um terreno procedural de dunas (cenário auxiliar, claramente identificado) e também o hexágono REAL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CFG, cenarioTeste, mundoTeste, rodar } from './eco-ajudantes.mjs';
import { RAIZ_LAB } from '../src/node/carregar-node.js';
import { altura, desserializarTerreno, indice } from '../src/eco/terreno.js';
import { areiaNavegavel, cabeEm, espessuraAreia, faixaProfundidade, perfilAreia, volumeAreia } from '../src/eco/areia.js';
import { moverSubsolo, podeEmergir, podeMergulhar, pontoDeEmergencia, separadosNaVertical } from '../src/eco/subsolo.js';

const terrenoDunas = (extra = {}) => ({ largura: 240, profundidade: 180, res: 1, amplitude: 14, capim: 20, areia: true, ...extra });

// Cenário auxiliar: duna procedural com uma rocha. NÃO substitui a validação nos GLBs reais (ver abaixo).
function mundoDunas(especie, individuos, terreno = {}, semente = 1) {
  return mundoTeste(cenarioTeste('dunas-teste', [{ especie, individuos }], terrenoDunas(terreno)), semente);
}

test('areia: o volume vem do relevo e o leito rochoso limita a profundidade', () => {
  const m = mundoDunas('arraia-de-areia', [{ id: 'a1', x: 120, y: 90 }]);
  const v = volumeAreia(m.terreno);
  assert.equal(v.espessura.length, m.terreno.nx * m.terreno.ny);
  for (let k = 0; k < v.espessura.length; k++) {
    assert.ok(v.espessura[k] >= 0, 'espessura nunca é negativa');
    assert.ok(v.espessura[k] <= v.espessuraMaxM + 1e-6, 'espessura respeita o teto');
    // O leito nunca fica acima da superfície.
    assert.ok(v.base[k] <= m.terreno.alturas[k] + 1e-4, `leito acima do relevo em ${k}`);
  }
});

test('areia: água e rocha não são areia navegável (areia nunca é tratada como água)', () => {
  const m = mundoTeste(cenarioTeste('dunas-agua', [{ especie: 'arraia-de-areia', individuos: [{ id: 'a1', x: 120, y: 60 }] }],
    terrenoDunas({ lago: { x: 60, y: 90, raio: 14, fundo: 4 }, rochas: [{ x: 180, y: 90, raio: 8, altura: 4 }] })), 2);
  const t = m.terreno;
  assert.equal(areiaNavegavel(t, 60, 90), false, 'lago não é areia navegável');
  assert.equal(areiaNavegavel(t, 180, 90), false, 'rocha não é areia navegável');
  assert.equal(espessuraAreia(t, 180, 90), 0);
});

test('física: a criatura não atravessa rocha pelo subsolo', () => {
  const m = mundoTeste(cenarioTeste('dunas-rocha', [{ especie: 'arraia-de-areia', individuos: [{ id: 'a1', x: 100, y: 90, profundidadeInicialM: 1.5, direcaoGraus: 0 }] }],
    terrenoDunas({ rochas: [{ x: 130, y: 90, raio: 10, altura: 5 }] })), 3);
  const a = m.porId.get('a1');
  // Empurra o animal contra a rocha por 30 s, ignorando a IA.
  const intencao = { estado: 'teste', codigo: 'teste', ritmo: 'corrida', destino: { x: 200, y: 90 }, subsolo: null, profundidade: 1.5 };
  for (let i = 0; i < 300; i++) {
    moverSubsolo(a, intencao, m, 0.1);
    const k = indice(m.terreno, a.x, a.y);
    assert.notEqual(m.terreno.bloqueio[k], 1, `entrou em célula de rocha em t=${(i * 0.1).toFixed(1)} s (x=${a.x.toFixed(1)})`);
  }
  assert.ok(a.subsolo.bloqueios > 0, 'o leito/rocha chegou a bloquear o avanço');
});

test('física: a criatura não ultrapassa a profundidade máxima da espécie', () => {
  const m = mundoDunas('arenoceto', [{ id: 'g1', x: 120, y: 90, profundidadeInicialM: 4 }]);
  const a = m.porId.get('g1');
  const max = a.especie.subsolo.profundidadeMaxM;
  const intencao = { estado: 'teste', codigo: 'teste', ritmo: 'andar', destino: { x: 130, y: 90 }, subsolo: null, profundidade: max * 10 };
  for (let i = 0; i < 400; i++) { moverSubsolo(a, intencao, m, 0.1); assert.ok(a.subsolo.prof <= max + 1e-6, `prof ${a.subsolo.prof} > ${max}`); }
});

test('física: o corpo grande não passa onde o pequeno passa (passagem estreita)', async () => {
  const t = await terrenoReal();
  const pequeno = perfilAreia(t, CFG.especies['arraia-de-areia'].subsolo.alturaCorpoM);
  const grande = perfilAreia(t, CFG.especies.arenoceto.subsolo.alturaCorpoM);
  let soPequeno = 0, ambos = 0;
  for (let k = 0; k < pequeno.passavel.length; k++) {
    assert.ok(!(grande.passavel[k] === 1 && pequeno.passavel[k] === 0), 'nenhuma célula aceita só o corpo grande');
    if (pequeno.passavel[k] && !grande.passavel[k]) soPequeno++;
    if (pequeno.passavel[k] && grande.passavel[k]) ambos++;
  }
  assert.ok(soPequeno > 0, 'existem passagens estreitas que só o corpo pequeno atravessa');
  assert.ok(ambos > 0, 'existe areia funda o bastante para o corpo grande');
});


// Garantia visual/física da baleia: metade enterrada ATÉ a metade do mergulho.
// O GLB é apoiado pela base na superfície; a profundidade desloca a malha real para baixo.
test('Arenoceto: mergulho enterra metade do corpo antes de 50% da animação, sem deslizar', async () => {
  const m = await mundoReal('dunas-a-natacao', 1);
  const a = m.porId.get('arenoceto-1');
  const alturaCorpo = a.especie.corpo.alturaM * a.escala;
  assert.ok(podeMergulhar(a, m), 'o início do cenário tem areia para enterrar o Arenoceto');
  const x0 = a.x, y0 = a.y;
  const intencao = { estado: 'explorando', codigo: 'teste-mergulho', ritmo: 'andar', destino: null, subsolo: 'mergulhar', profundidade: 12 };
  moverSubsolo(a, intencao, m, m.dt);
  assert.equal(a.subsolo.fase, 'mergulhando');
  for (let i = 0; i < 20; i++) moverSubsolo(a, intencao, m, m.dt);
  assert.ok(a.subsolo.progresso >= 0.49 && a.subsolo.progresso <= 0.51, 'metade da duração do mergulho');
  assert.ok(a.subsolo.prof >= alturaCorpo / 2, 'metade da altura do GLB deve estar sob a areia no meio do mergulho');
  assert.ok(Math.hypot(a.x - x0, a.y - y0) < alturaCorpo, 'não pode deslizar uma baleia inteira sobre a duna antes de afundar');
  for (let i = 0; i < 20; i++) moverSubsolo(a, intencao, m, m.dt);
  assert.equal(a.subsolo.fase, 'submerso', 'o mergulho termina com a baleia dentro da areia');
  assert.ok(a.subsolo.prof >= alturaCorpo, 'ao completar o mergulho a baleia deve ficar completamente sob a superfície');
  const h = altura(m.terreno, a.x, a.y);
  assert.ok(Math.abs(a.z - (h - a.subsolo.prof)) < 1e-6, 'a posição 3D deve usar a profundidade física');
});

test('física: a posição vertical acompanha o relevo real do hexágono', async () => {
  const m = await mundoReal('dunas-a-natacao', 1);
  const a = m.porId.get('arenoceto-1');
  rodar(m, 60, (mm) => {
    const h = altura(mm.terreno, a.x, a.y);
    assert.ok(Math.abs(a.z - (h - a.subsolo.prof)) < 1e-6, 'z = superfície − profundidade');
    return false;
  });
});

test('física: região sem areia navegável impede a natação subterrânea', async () => {
  const t = await terrenoReal();
  let semAreia = null;
  for (let j = 0; j < t.ny && !semAreia; j += 3) for (let i = 0; i < t.nx; i += 3) {
    const x = i * t.res, y = j * t.res;
    if (!areiaNavegavel(t, x, y)) { semAreia = { x, y }; break; }
  }
  assert.ok(semAreia, 'o hexágono real tem regiões de leito aflorado');
  assert.equal(faixaProfundidade(t, semAreia.x, semAreia.y, 1.3), null);
  assert.equal(cabeEm(t, semAreia.x, semAreia.y, 1, 1.3), false);
});

test('física: a transição superfície↔subsolo não teletransporta', async () => {
  const m = await mundoReal('dunas-d-emboscada', 1);
  const limite = {};
  // Teto do passo: a maior velocidade que a espécie alcança em qualquer meio (na areia a arraia é mais
  // rápida que na superfície), com 50% de folga para aceleração e impulso.
  for (const a of m.vivos) if (a.subsolo) limite[a.id] = Math.max(a.especie.movimento.corrida, a.especie.subsolo.arranque) * m.dt * 1.5 + 0.05;
  const ant = new Map(m.vivos.map((a) => [a.id, { x: a.x, y: a.y, prof: a.subsolo?.prof ?? 0 }]));
  rodar(m, 180, (mm) => {
    for (const a of mm.vivos) {
      if (!a.subsolo) continue;
      const p = ant.get(a.id);
      if (p) {
        const passo = Math.hypot(a.x - p.x, a.y - p.y);
        assert.ok(passo <= limite[a.id], `${a.id} saltou ${passo.toFixed(2)} m num passo (${a.subsolo.fase})`);
        const dz = Math.abs(a.subsolo.prof - p.prof);
        const maxDz = Math.max(a.subsolo.perfil.subidaMs, a.subsolo.perfil.descidaMs) * mm.dt
          + (a.subsolo.perfil.profundidadeMaxM / Math.min(a.subsolo.perfil.mergulhoSeg, a.subsolo.perfil.emergenciaSeg)) * mm.dt + 0.05;
        assert.ok(dz <= maxDz, `${a.id} mudou ${dz.toFixed(2)} m de profundidade num passo`);
      }
      ant.set(a.id, { x: a.x, y: a.y, prof: a.subsolo.prof });
    }
    return false;
  });
});

test('física: só emerge onde a emergência é possível', async () => {
  const m = await mundoReal('dunas-b-arraia', 2);
  rodar(m, 120, (mm) => {
    for (const a of mm.vivos) {
      if (a.subsolo?.fase !== 'emergindo') continue;
      assert.ok(podeEmergir(a, mm), `${a.id} emergindo em ponto inválido (${a.x.toFixed(1)}, ${a.y.toFixed(1)})`);
    }
    return false;
  });
});

test('física: pontoDeEmergencia devolve um ponto realmente válido ou null', async () => {
  const m = await mundoReal('dunas-a-natacao', 1);
  const a = m.porId.get('arenoceto-1');
  const p = pontoDeEmergencia(a, m, { x: a.x + 20, y: a.y + 20 }, 40);
  if (p) {
    const salvo = { x: a.x, y: a.y };
    a.x = p.x; a.y = p.y;
    assert.ok(podeEmergir(a, m), 'o ponto devolvido permite emergir');
    a.x = salvo.x; a.y = salvo.y;
  }
});

test('física: areia sólida entre dois corpos separa os meios', () => {
  const m = mundoDunas('arraia-de-areia', [{ id: 'a1', x: 100, y: 90, profundidadeInicialM: 1.2 }, { id: 'a2', x: 101, y: 90 }]);
  const [a, b] = ['a1', 'a2'].map((id) => m.porId.get(id));
  b.subsolo.prof = 0;
  a.subsolo.prof = 8;
  assert.equal(separadosNaVertical(a, b), true, 'oito metros de areia separam os corpos');
  a.subsolo.prof = 0.4;
  assert.equal(separadosNaVertical(a, b), false, 'quase na superfície, os corpos se tocam');
});

// ---------- apoio ----------
let cacheTerreno = null;
async function terrenoReal() {
  if (!cacheTerreno) {
    const dados = JSON.parse(await readFile(join(RAIZ_LAB, 'config/eco/terrenos/dunas-dn19-interior.json'), 'utf8'));
    cacheTerreno = desserializarTerreno(dados);
    volumeAreia(cacheTerreno);
  }
  return cacheTerreno;
}

async function mundoReal(id, semente) {
  const cen = CFG.cenarios[id];
  if (!cen.terreno.dados) cen.terreno.dados = JSON.parse(await readFile(join(RAIZ_LAB, cen.terreno.arquivo), 'utf8'));
  return mundoTeste(cen, semente);
}
export { mundoReal };
