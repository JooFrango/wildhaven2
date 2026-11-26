// IA Base V1 — encerramento. Cenário integrado em 5 sementes, invariantes do núcleo verificados DURANTE a
// simulação, persistência com os estados da V7, conservação da matéria da carcaça e a prova do contrato de
// espécie. O que cada teste não mede está dito no próprio teste.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG, mundoTeste, rodar } from './eco-ajudantes.mjs';
import { passoEco, hashMundo } from '../src/eco/mundo.js';
import { verificarInvariantes } from '../src/eco/invariantes.js';
import { salvarMundo, carregarMundo } from '../src/eco/persistencia.js';
import { materiaLocalKg } from '../src/eco/carcaca.js';
import { validarEspecies } from '../src/eco/especies.js';

const SEMENTES = [1, 2, 3, 4, 5];
const SAVANA = 'ia-base-v1-integracao';
const DUNAS = 'ia-base-v1-integracao-dunas';

// Roda checando os invariantes a cada 10 s simulados (a cada passo custaria mais que a própria simulação).
// Limite declarado: uma violação que apareça e desapareça dentro da mesma janela de 10 s passa batido.
function rodarChecando(cenarioId, semente, segundos) {
  const m = mundoTeste(CFG.cenarios[cenarioId], semente);
  const periodo = Math.round(10 / m.cenario.dt);
  while (m.t < segundos - 1e-9) {
    passoEco(m);
    if (m.tick % periodo === 0) {
      const f = verificarInvariantes(m);
      assert.equal(f.length, 0, `${cenarioId} s${semente} t=${m.t.toFixed(1)}: ${f.slice(0, 3).join(' | ')}`);
    }
  }
  const f = verificarInvariantes(m);
  assert.equal(f.length, 0, `${cenarioId} s${semente} final: ${f.slice(0, 3).join(' | ')}`);
  return m;
}

const uniao = (mundos, tipo) => mundos.reduce((s, m) => s + (m.metricas.eventos[tipo] ?? 0), 0);

test('IA Base V1: cenário integrado da savana roda em 5 sementes sem violar invariante nenhum', () => {
  const mundos = SEMENTES.map((s) => rodarChecando(SAVANA, s, 180));
  for (const m of mundos) {
    assert.ok(m.animais.length >= 23, 'as 11 espécies entraram no mundo');
    assert.equal(m.metricas.falhas.length, 0);
  }
  // Comportamentos do núcleo, somados nas 5 sementes. Nada é forçado por semente: a ordem pede decisões
  // coerentes, não que todo evento aconteça em toda execução.
  assert.ok(uniao(mundos, 'caca_inicio') > 0, 'predadores iniciaram caça');
  assert.ok(uniao(mundos, 'ataque_inicio') > 0, 'houve tentativa de ataque');
  assert.ok(uniao(mundos, 'decolagem') > 0 && uniao(mundos, 'pouso') > 0, 'voadores decolam e pousam');
  assert.ok(uniao(mundos, 'emboscada_armada') > 0, 'tática de emboscada foi usada');
  assert.ok(uniao(mundos, 'clima_inicio') > 0, 'o clima adverso agendado entrou');
  assert.ok(uniao(mundos, 'cupinzeiro_achado') > 0, 'especialista em cupins achou cupinzeiro');
  const sociais = uniao(mundos, 'cumprimento') + uniao(mundos, 'limpeza_mutua') + uniao(mundos, 'sentinela');
  assert.ok(sociais > 0, 'o grupo social interagiu');
});

test('IA Base V1: cenário integrado das dunas roda em 5 sementes sem violar invariante nenhum', () => {
  const mundos = SEMENTES.map((s) => rodarChecando(DUNAS, s, 300));
  for (const m of mundos) assert.equal(m.metricas.falhas.length, 0, 'nenhuma reação sem percepção');
  assert.ok(uniao(mundos, 'mergulho_inicio') > 0, 'locomoção subterrânea foi exercitada');
  assert.ok(uniao(mundos, 'emergencia_inicio') > 0, 'emergiu da areia');
  assert.ok(uniao(mundos, 'investigacao_vibracao') > 0, 'vibração foi investigada');
  // A serpente de 14 m atravessa o cenário sem esticar nem encolher o corpo.
  for (const m of SEMENTES.map((s) => mundoTeste(CFG.cenarios[DUNAS], s))) {
    rodar(m, 60);
    const s = m.porId.get('serpaduna-int');
    assert.ok(s?.serpente?.rastro?.length > 10, 'a serpente manteve o rastro do corpo');
  }
});

test('IA Base V1: execução longa não acumula defeito (900 s, uma semente)', () => {
  const m = rodarChecando(SAVANA, 3, 900);
  assert.ok(Number.isFinite(m.hash) && m.hash >= 0, 'hash íntegro');
  assert.ok(m.carcacas.length <= (m.cenario.decomposicao.maxCarcacas ?? 24), 'carcaças dentro do limite');
  assert.ok(m.vivos.length > 0, 'o mundo não esvaziou');
  for (const a of m.animais) assert.ok(a.saude.hp <= a.saude.hpMax + 1e-6);
});

test('IA Base V1: salvar e retomar preserva identidade, memórias e estados especiais', () => {
  const direto = mundoTeste(CFG.cenarios[SAVANA], 2); rodar(direto, 300);
  const parte = mundoTeste(CFG.cenarios[SAVANA], 2); rodar(parte, 150);
  const salvo = JSON.parse(JSON.stringify(salvarMundo(parte)));
  const retomado = carregarMundo(CFG, salvo);
  rodar(retomado, 300);
  assert.equal(hashMundo(retomado), hashMundo(direto), 'retomar = nunca ter parado');
  assert.deepEqual(
    retomado.vivos.map((a) => [a.id, +a.x.toFixed(6), +a.fome.toFixed(6), a.saude.ferimentos.length]),
    direto.vivos.map((a) => [a.id, +a.x.toFixed(6), +a.fome.toFixed(6), a.saude.ferimentos.length]),
  );
  assert.equal(verificarInvariantes(retomado).length, 0);
});

test('IA Base V1: os Mapas das capacidades sobrevivem ao JSON (antes viravam {} em silêncio)', () => {
  // Cupinzeiro e termorrecepção criam Map sob demanda; a serpente guarda referência ao terreno.
  const m = mundoTeste(CFG.cenarios[SAVANA], 1); rodar(m, 120);
  const comCupins = m.animais.find((a) => a.memoria.cupinzeiros?.size);
  assert.ok(comCupins, 'alguém memorizou um cupinzeiro no cenário integrado');
  const r = carregarMundo(CFG, JSON.parse(JSON.stringify(salvarMundo(m))));
  const voltou = r.porId.get(comCupins.id) ?? r.mortos.get(comCupins.id);
  assert.ok(voltou.memoria.cupinzeiros instanceof Map, 'memória de cupinzeiro volta como Map');
  assert.equal(voltou.memoria.cupinzeiros.size, comCupins.memoria.cupinzeiros.size);
  assert.deepEqual([...r.cupinzeiros.map((c) => +c.populacao.toFixed(3))], [...m.cupinzeiros.map((c) => +c.populacao.toFixed(3))]);

  // Clima em curso: o evento e a condição ativa voltam com o mundo.
  const c = mundoTeste(CFG.cenarios[SAVANA], 1); rodar(c, 200);
  assert.ok(c.climaAtivo, 'a chuva agendada está em curso aos 200 s');
  const c2 = carregarMundo(CFG, JSON.parse(JSON.stringify(salvarMundo(c))));
  assert.equal(c2.climaAtivo?.tipo, c.climaAtivo.tipo);
  assert.equal(c2.climaEvento?.fim, c.climaEvento.fim);

  // Serpente: o corpo volta assentado no terreno, sem o relevo duplicado dentro do animal.
  const d = mundoTeste(CFG.cenarios[DUNAS], 1); rodar(d, 60);
  const salvo = salvarMundo(d);
  assert.equal(salvo.animais.find((a) => a.id === 'serpaduna-int').serpente.terreno, undefined, 'o terreno não é serializado por animal');
  const d2 = carregarMundo(CFG, JSON.parse(JSON.stringify(salvo)));
  assert.equal(d2.porId.get('serpaduna-int').serpente.terreno, d2.terreno, 'o corpo volta ligado ao terreno do mundo');
  rodar(d2, 90);
  assert.equal(verificarInvariantes(d2).length, 0);
});

test('IA Base V1: a reciclagem devolve ao solo só a matéria que ficou no local', () => {
  const c = { carneInicial: 10, carne: 0, consumo: {}, consumoInsetos: 0, perdaDecomposicao: 0 };
  assert.equal(materiaLocalKg(c), 10, 'sem animais comendo, tudo fica no local');
  c.consumo = { pred: 4 };
  assert.equal(materiaLocalKg(c), 6, 'o que o animal levou no corpo não enriquece este ponto');
  c.consumo = { pred: 4, outro: 7 };
  assert.equal(materiaLocalKg(c), 0, 'nunca negativo');
});

// Regressão do erro `computeBoundingSphere(): Computed radius is NaN` que a CI pegou no commit 2509b83:
// Pica-Termita e Ferrunco declaravam `social.territorial` sem `raioTerritorioM`, o animal nascia com
// `territorio = { x, y, raio: undefined }` e o renderizador montava um círculo de 97 vértices com NaN.
// A simulação não reclamava porque toda comparação com NaN é falsa — o território simplesmente não existia.
test('IA Base V1 (regressão): território sem raio é recusado na ficha e acusado pelo invariante', () => {
  for (const id of ['pica-termita', 'ferrunco']) {
    const e = CFG.especies[id];
    assert.equal(e.social.territorial, true);
    assert.ok(typeof e.social.raioTerritorioM === 'number' && e.social.raioTerritorioM > 0, `${id} sem raio de território`);
  }
  // Toda espécie territorial do catálogo tem raio, e uma ficha sem ele não carrega.
  const todas = Object.values(CFG.especies);
  assert.deepEqual(validarEspecies(todas).filter((x) => x.includes('raioTerritorioM')), []);
  const quebrada = { ...CFG.especies.ferrunco, social: { ...CFG.especies.ferrunco.social, raioTerritorioM: undefined } };
  assert.ok(validarEspecies([...todas.filter((e) => e.id !== 'ferrunco'), quebrada]).some((x) => x.includes('ferrunco: social.territorial exige')));

  // E, se mesmo assim algo zerar o raio em tempo de execução, o invariante acusa antes de virar NaN na tela.
  const m = mundoTeste(CFG.cenarios[SAVANA], 1);
  rodar(m, 2);
  const a = m.porId.get('ferrunco-1');
  assert.ok(Number.isFinite(a.territorio.raio), 'o animal nasce com território válido');
  assert.equal(verificarInvariantes(m).length, 0);
  a.territorio.raio = undefined;
  assert.ok(verificarInvariantes(m).some((x) => x.includes('territorio com valor inválido')));
});

test('IA Base V1: espécie nova entra só pelo contrato e não ganha capacidade nenhuma de brinde', () => {
  const e = CFG.especies.frutavil;
  assert.ok(e, 'a ficha entrou no índice');
  for (const k of ['veneno', 'camuflagemAtiva', 'voo', 'subsolo', 'serpente', 'taticasDeEmboscada']) assert.equal(e[k], undefined, `a ficha não declara ${k}`);
  const m = mundoTeste(CFG.cenarios[SAVANA], 1);
  rodar(m, 120);
  const a = m.porId.get('frutavil-1') ?? m.mortos.get('frutavil-1');
  assert.ok(a, 'o indivíduo foi criado');
  for (const k of ['veneno', 'camuflagem', 'voo', 'subsolo', 'serpente']) assert.equal(a[k], undefined, `não recebeu estado de ${k}`);
  assert.ok(a.memoria.criaturas instanceof Map && Number.isFinite(a.x), 'percepção e física valem para ela como para qualquer outra');
  assert.ok(a.estado !== 'inicio', 'o cérebro compartilhado decidiu por ela sem código próprio');
});
