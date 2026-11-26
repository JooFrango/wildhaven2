import assert from 'node:assert/strict';
import { test } from 'node:test';
import { velocidadeMaxima } from '../src/eco/locomocao.js';
import { fatorMobilidade, ferir, processarSaudeDia } from '../src/eco/saude.js';
import { Rng } from '../src/eco/rng.js';
import { animal, cenarioTeste, ev, mundoTeste, rodar } from './eco-ajudantes.mjs';

const bando = (extra = {}) => ({ especie: 'velsari', grupos: [{ x: 80, y: 60, raio: 3, adultos: 6, filhotes: 0, fome: 20, sede: 10, ...extra }] });
const varrisco = (id, x, y, o = {}) => ({ especie: 'varrisco', individuos: [{ id, x, y, sexo: 'M', fome: 85, energia: 100, ...o }] });

// ------------------------------------------------------------ social
test('bando: grupo criado com líder dominante e sentinela que vigia', () => {
  const m = mundoTeste(cenarioTeste('s1', [bando()]), 1);
  const g = [...m.grupos.values()][0];
  assert.equal(g.membros.length, 6);
  const membros = g.membros.map((id) => animal(m, id));
  const dom = (a) => a.massa * (0.5 + a.temperamento.agressividade) + a.idadeAnos * 0.5;
  assert.equal(g.lider, [...membros].sort((a, b) => dom(b) - dom(a))[0].id, 'líder é o mais dominante');
  assert.ok(g.sentinela && g.sentinela !== g.lider);
  rodar(m, 5);
  assert.equal(animal(m, g.sentinela).estado, 'vigiando');
});

test('alarme: só quem vê o predador sabe onde ele está; os outros recebem a posição de quem chamou', () => {
  // Rocha entre o predador e a maior parte do bando: só o animal exposto vê.
  // Predador com fome (aproxima-se e acaba sendo visto por quem está exposto atrás da rocha).
  const m = mundoTeste(cenarioTeste('s2', [bando(), varrisco('v', 45, 62, { direcaoGraus: 0, fome: 70 })], { rochas: [{ x: 70, y: 60, raio: 3, altura: 3 }] }), 2);
  rodar(m, 30, (mm) => ev(mm, 'alarme').length > 0 && ev(mm, 'alarme_ouvido').length > 0);
  const alarme = ev(m, 'alarme')[0];
  assert.ok(alarme, 'alguém deu o alarme');
  const ouvintes = ev(m, 'alarme_ouvido');
  assert.ok(ouvintes.length >= 1);
  for (const o of ouvintes) {
    assert.equal(o.de, alarme.id, 'o som vem de quem chamou');
    // No instante em que ouviu, o ouvinte não tinha o predador na memória por percepção própria? Se tinha, foi por visão/audição dele.
    const ouvinte = animal(m, o.id);
    const lemb = ouvinte.memoria.criaturas.get('v');
    if (lemb) assert.notEqual(lemb.via, 'som', 'conhecimento do predador nunca vem do alarme');
  }
});

test('proteção de filhotes: adulto corajoso se põe entre o predador e o filhote', () => {
  let protegeu = 0;
  for (let s = 1; s <= 6; s++) {
    const m = mundoTeste(cenarioTeste('s3', [{ especie: 'velsari', grupos: [{ x: 80, y: 60, raio: 3, adultos: 5, filhotes: 3, fome: 20, sede: 10, atributos: { temperamento: { coragem: 0.9 } } }] }, varrisco('v', 40, 60, { direcaoGraus: 0, fome: 90 })]), s);
    rodar(m, 40, (mm) => ev(mm, 'protege_filhote').length > 0);
    if (ev(m, 'protege_filhote').length) protegeu++;
  }
  assert.ok(protegeu >= 2, `proteção em ${protegeu}/6`);
});

test('separação e reagrupamento: depois do perigo o bando se reagrupa', () => {
  const m = mundoTeste(cenarioTeste('s4', [bando(), varrisco('v', 50, 60, { direcaoGraus: 0, fome: 90, energia: 70 })]), 3, { guardarDecisoes: true });
  rodar(m, 240);
  assert.ok(ev(m, 'seguro').length > 0, 'houve fim de perigo');
  assert.ok(m.decisoes.some((d) => d.estado === 'reagrupando'), 'houve comportamento de reagrupamento');
  const g = [...m.grupos.values()][0];
  const vivos = g.membros.map((id) => animal(m, id)).filter((a) => a.vivo);
  // Maior aglomerado: quantos membros estão a até 20 m de algum membro de referência.
  const maior = Math.max(...vivos.map((r) => vivos.filter((a) => Math.sqrt((a.x - r.x) ** 2 + (a.y - r.y) ** 2) <= 20).length));
  assert.ok(maior >= vivos.length - 1, `maior aglomerado ${maior}/${vivos.length}`);
});

// ------------------------------------------------------------ combate
test('dano localizado: ferida na perna reduz a velocidade; fratura deixa sequela persistente', () => {
  const m = mundoTeste(cenarioTeste('c1', [bando()]), 1);
  const a = animal(m, [...m.grupos.values()][0].membros[0]);
  const antes = velocidadeMaxima(a, 'corrida');
  ferir(a, { dano: a.saude.hpMax * 0.4, regiao: 'pernas', origem: 'teste', tipo: 'teste', t: 0, idEvento: 'f1' });
  assert.ok(a.saude.ferimentos[0].fratura);
  assert.ok(velocidadeMaxima(a, 'corrida') < antes * 0.6, 'corre bem mais devagar');
  for (let d = 0; d < 60 && a.saude.ferimentos.length; d++) processarSaudeDia(a, new Rng(d + 7), d, {});
  assert.ok(a.saude.sequelaMobilidade > 0, 'fratura consolidada deixa sequela');
  assert.ok(fatorMobilidade(a) < 1, 'sequela persiste depois da cura');
});

test('maior intimida menor: disputa por carcaça termina sem combate na maioria das sementes', () => {
  let semCombate = 0, perdeuMenor = 0, total = 0;
  for (let s = 1; s <= 8; s++) {
    const m = mundoTeste(cenarioTeste('c2', [
      varrisco('grande', 60, 60, { massaKg: 85, fome: 20, temperamento: { agressividade: 0.8, coragem: 0.8, medo: 0.1 } }),
      varrisco('pequeno', 85, 60, { massaKg: 55, fome: 80, direcaoGraus: 180, temperamento: { agressividade: 0.3, coragem: 0.3, medo: 0.6 } }),
    ]), s);
    // Carcaça do grande (presa já abatida).
    m.carcacas.push({ id: 'k1', especie: 'velsari', x: 62, y: 60, carneInicial: 12, carne: 12, decomposicao: 0, dono: 'grande', donoDesde: 0, morteT: 0, consumo: {} });
    rodar(m, 60, (mm) => ev(mm, 'conflito_fim').length > 0);
    const fim = ev(m, 'conflito_fim')[0];
    if (!fim) continue;
    total++;
    if (fim.faseFinal !== 'combate') semCombate++;
    if (fim.perdedor === 'pequeno') perdeuMenor++;
  }
  assert.ok(total >= 5, `disputas ocorreram (${total})`);
  assert.ok(perdeuMenor / total >= 0.7, `menor cedeu em ${perdeuMenor}/${total}`);
  assert.ok(semCombate / total >= 0.6, `sem luta física em ${semCombate}/${total}`);
});

test('território: intruso que permanece provoca disputa territorial (não só proximidade)', () => {
  const m = mundoTeste(cenarioTeste('c3', [
    varrisco('dono', 60, 60, { fome: 10, territorio: { x: 60, y: 60, raio: 80 } }),
    varrisco('intruso', 90, 62, { fome: 10, direcaoGraus: 180 }),
  ]), 4);
  rodar(m, 90, (mm) => ev(mm, 'conflito_inicio').length > 0);
  const c = ev(m, 'conflito_inicio')[0];
  assert.ok(c, 'houve disputa');
  assert.equal(c.motivo, 'territorio');
  const primeiraVisao = m.eventos.find((e) => e.tipo === 'conflito_inicio').t;
  assert.ok(primeiraVisao > 8, 'não foi imediata: exigiu permanência');
});

test('predador ferido evita combate; predador exausto desiste da perseguição', () => {
  const m = mundoTeste(cenarioTeste('c4', [
    varrisco('ferido', 60, 60, { fome: 90, hpFracao: 0.3 }),
    varrisco('dono', 70, 60, { fome: 10, direcaoGraus: 180 }),
  ]), 5);
  m.carcacas.push({ id: 'k1', especie: 'velsari', x: 71, y: 60, carneInicial: 12, carne: 12, decomposicao: 0, dono: 'dono', donoDesde: 0, morteT: 0, consumo: {} });
  rodar(m, 30);
  const lutou = ev(m, 'conflito_fase').some((e) => e.fase === 'combate');
  assert.ok(!lutou, 'ferido não chega à luta física');
  // Exausto: faminto (caça por desespero) com pouca energia diante de um bando; o fôlego acaba e ele desiste.
  const m2 = mundoTeste(cenarioTeste('c5', [bando(), varrisco('cansado', 62, 60, { direcaoGraus: 0, fome: 95, energia: 45 })]), 6);
  rodar(m2, 120, (mm) => mm.perseguicoes.some((p) => p.motivo === 'desistiu_cansaco'));
  assert.ok(m2.perseguicoes.some((p) => p.motivo === 'desistiu_cansaco'), 'desistiu por cansaço');
});

test('V3: presa aproveita a distração da disputa (cenário disputa-presa-cobertura, 12 sementes; nada automático)', async () => {
  const { rodarCenario } = await import('../src/eco/analise.js');
  const { CFG } = await import('./eco-ajudantes.mjs');
  let disputasPresa = 0, oport = 0, tent = 0, efetivas = 0, semDisputa = 0;
  for (let s = 1; s <= 12; s++) {
    const { mundo: m } = rodarCenario(CFG, 'disputa-presa-cobertura', s, {});
    const d = ev(m, 'conflito_inicio').filter((e) => e.motivo === 'presa').length;
    disputasPresa += d; if (!d) semDisputa++;
    oport += ev(m, 'oportunidade_fuga').length; tent += ev(m, 'tentativa_fuga').length; efetivas += ev(m, 'fuga_efetiva').length;
    // Toda tentativa nasce de uma oportunidade percebida (a presa viu um predador ocupado com o rival).
    for (const e of ev(m, 'tentativa_fuga')) assert.ok(ev(m, 'oportunidade_fuga', e.id).some((o) => o.t <= e.t), 'tentativa sem oportunidade');
  }
  assert.ok(disputasPresa >= 2, `disputas pela presa: ${disputasPresa}`);
  assert.ok(semDisputa >= 1, 'há sementes sem disputa (o encontro não é roteirizado)');
  assert.ok(efetivas >= 1, `fugas efetivas: ${efetivas}`);
  assert.ok(efetivas <= tent && tent <= oport, `efetivas ${efetivas} ≤ tentativas ${tent} ≤ oportunidades ${oport}`);
  assert.ok(efetivas < tent || oport > efetivas, 'fuga não é automática');
});

test('conflitos raramente terminam em morte no bebedouro', async () => {
  const { rodarCenario } = await import('../src/eco/analise.js');
  const { CFG } = await import('./eco-ajudantes.mjs');
  let mortesCombate = 0, conflitos = 0;
  for (let s = 1; s <= 6; s++) { const r = rodarCenario(CFG, 'bebedouro', s, { segundos: 200 }).resumo; mortesCombate += r.mortes.combate ?? 0; conflitos += r.conflitos; }
  assert.ok(conflitos >= 3, `houve disputas (${conflitos})`);
  assert.ok(mortesCombate <= 1, `mortes em combate: ${mortesCombate}`);
});
