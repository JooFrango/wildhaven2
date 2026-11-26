// Testes V3: locomoção com margem corporal, combate anatômico medido no GLB, impactos, agarrão e socialização.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buscarCaminho, folga, indice, perfilMobilidade, segmentoPassavel } from '../src/eco/terreno.js';
import { capsula, pontoNaCapsula, perfilGolpe, resolverGolpe } from '../src/eco/combate.js';
import { fatorMobilidade, ferir } from '../src/eco/saude.js';
import { velocidadeMaxima } from '../src/eco/locomocao.js';
import { salvarMundo, carregarMundo } from '../src/eco/persistencia.js';
import { passoEco, hashMundo } from '../src/eco/mundo.js';
import { CFG, animal, cenarioTeste, ev, mundoTeste, rodar } from './eco-ajudantes.mjs';

const varrisco = (id, x, y, o = {}) => ({ especie: 'varrisco', individuos: [{ id, x, y, sexo: 'M', fome: 10, energia: 100, ...o }] });
const velsari = (id, x, y, o = {}) => ({ especie: 'velsari', individuos: [{ id, x, y, fome: 10, sede: 5, energia: 100, ...o }] });

// ------------------------------------------------------------ locomoção
test('V3 locomoção: segmento não escapa pela quina entre duas células bloqueadas na diagonal', () => {
  const m = mundoTeste(cenarioTeste('q', [velsari('v', 10, 10)], { rochas: [] }), 1);
  const t = m.terreno, p = perfilMobilidade(t, CFG.especies.velsari.movimento);
  // Bloqueia as células (50,50) e (51,51); (51,50) e (50,51) ficam livres. Um segmento entre essas duas livres
  // cruza a quina comum — fisicamente o corpo não passa entre duas rochas que se tocam na diagonal.
  const pass = p.passavel.slice();
  pass[indice(t, 50.5, 50.5)] = 0; pass[indice(t, 51.5, 51.5)] = 0;
  assert.equal(segmentoPassavel(t, pass, { x: 50.3, y: 51.7 }, { x: 51.7, y: 50.3 }), false, 'diagonal pela quina bloqueada');
  assert.equal(segmentoPassavel(t, pass, { x: 50.2, y: 51.6 }, { x: 51.9, y: 50.45 }), false, 'diagonal quase pela quina');
  assert.equal(segmentoPassavel(t, pass, { x: 40.5, y: 40.5 }, { x: 45.5, y: 40.5 }), true);
});

test('V3 locomoção: margem corporal — Velsari passa na fresta estreita; Varrisco (mais largo) usa a passagem larga', () => {
  // Muro de rochas baixas em x=80 com uma fresta de ~2 m (y≈60) e uma passagem de ~7 m (y≈82).
  const rochas = [];
  for (let y = 20; y <= 100; y += 2) if (y !== 60 && !(y >= 80 && y <= 84)) rochas.push({ x: 80, y, raio: 1, altura: 0.3 });
  const m = mundoTeste(cenarioTeste('m', [velsari('v', 40, 60)], { rochas, amplitude: 0 }), 1);
  const t = m.terreno;
  const rota = (esp) => {
    const p = perfilMobilidade(t, CFG.especies[esp].movimento), f = folga(t, p);
    const r = buscarCaminho(t, p, { x: 60, y: 60 }, { x: 100, y: 60 }, { raio: CFG.especies[esp].corpo.raio });
    assert.ok(r?.completo, `${esp}: caminho completo`);
    let mn = Infinity, yMuro = null;
    for (let i = 1; i < r.pontos.length; i++) {
      const a = r.pontos[i - 1], b = r.pontos[i];
      for (let s = 0; s <= 40; s++) { const x = a.x + (b.x - a.x) * s / 40, y = a.y + (b.y - a.y) * s / 40; mn = Math.min(mn, f[indice(t, x, y)]); if (Math.abs(x - 80) < 0.6) yMuro = y; }
    }
    return { mn, yMuro };
  };
  const vs = rota('velsari'), vr = rota('varrisco');
  assert.ok(Math.abs(vs.yMuro - 60.5) < 2, `Velsari cruza pela fresta (y=${vs.yMuro?.toFixed(1)})`);
  assert.ok(vr.yMuro > 78, `Varrisco contorna pela passagem larga (y=${vr.yMuro?.toFixed(1)})`);
  assert.ok(vr.mn >= CFG.especies.varrisco.corpo.raio - 0.05, `Varrisco mantém a própria largura de folga (${vr.mn.toFixed(2)} m)`);
});

test('V3 locomoção: bebedouro procedural — quase sem bloqueios, corpos não se sobrepõem e ninguém entra em célula intransponível', async () => {
  const { rodarCenario } = await import('../src/eco/analise.js');
  let colisoes = 0, sobre = 0, fora = 0;
  for (const s of [1, 2]) {
    const { mundo: m } = rodarCenario(CFG, 'bebedouro', s, { segundos: 120 });
    colisoes += m.animais.reduce((x, a) => x + a.colisoes, 0);
    sobre += m.metricas.sobreposicoes;
    for (const a of m.vivos) { const p = perfilMobilidade(m.terreno, a.especie.movimento); if (p.passavel[indice(m.terreno, a.x, a.y)] !== 1) fora++; }
  }
  // V2 (mesmas sementes, 300 s): 8.754 bloqueios em 20 sementes ≈ 437/semente.
  assert.ok(colisoes <= 10, `bloqueios: ${colisoes}`);
  assert.ok(sobre < 1, `pares sobrepostos × s: ${sobre}`);
  assert.equal(fora, 0);
});

// ------------------------------------------------------------ combate anatômico
test('V3 combate: alcance e impacto vêm do GLB (Varrisco: garra curta, mordida longa) e golpe fora do alcance erra', () => {
  const m = mundoTeste(cenarioTeste('c', [varrisco('v', 60, 60, { direcaoGraus: 0 }), velsari('p', 62.2, 60, { direcaoGraus: 0 })]), 1);
  const v = animal(m, 'v'), p = animal(m, 'p');
  const garra = v.especie.combate.ataques.find((x) => x.nome === 'garra_foice');
  const mordida = v.especie.combate.ataques.find((x) => x.nome === 'mordida');
  const pg = perfilGolpe(v, garra), pm = perfilGolpe(v, mordida);
  assert.ok(pg.anatomico && pm.anatomico, 'perfil medido no GLB');
  assert.ok(pg.alcance < 0.7 && pm.alcance > 1.0, `garra ${pg.alcance.toFixed(2)} m, mordida ${pm.alcance.toFixed(2)} m`);
  assert.ok(Math.abs(pm.preparo - 0.69) < 0.05, 'impacto da mordida no instante medido no clipe bite');
  // Presa a 2,2 m: a garra (≈0,52 m) não alcança — o golpe é registrado como erro, sem dano.
  p.velocidade = 0; v.velocidade = 0;
  v.golpe = { nome: 'garra_foice', alvo: 'p', inicio: 0, impacto: m.t, ataque: garra, surpresa: true };
  const hp0 = p.saude.hp;
  resolverGolpe(v, m);
  assert.equal(p.saude.hp, hp0);
  assert.equal(ev(m, 'golpe_errou').at(-1).motivo, 'membro_nao_alcanca');
  // Mordida com a presa logo à frente (focinho a ~1,17 m da raiz) acerta (sem esquiva: presa não percebeu).
  p.x = 61.3;
  p.especie = { ...p.especie, combate: { ...p.especie.combate, esquiva: 0 } };
  v.golpe = { nome: 'mordida', alvo: 'p', inicio: 0, impacto: m.t, ataque: mordida, surpresa: true };
  resolverGolpe(v, m);
  assert.ok(p.saude.hp < hp0, 'mordida ao alcance fere');
});

test('V3 saúde: região importa — cabeça atordoa, perna reduz corrida, pescoço sangra mais; carapaça protege', () => {
  const m = mundoTeste(cenarioTeste('s', [velsari('a', 50, 50), velsari('b', 60, 50), velsari('c', 70, 50), { especie: 'tarruco', individuos: [{ id: 't', x: 80, y: 50 }] }]), 1);
  const a = animal(m, 'a'), b = animal(m, 'b'), c = animal(m, 'c'), tt = animal(m, 't');
  ferir(a, { dano: 12, regiao: 'cabeca', origem: 'x', tipo: 'mordida', t: 1 });
  assert.ok(a.saude.atordoadoAte > 1, 'atordoado');
  const v0 = velocidadeMaxima(b, 'corrida');
  ferir(b, { dano: 25, regiao: 'pernas', origem: 'x', tipo: 'garra_foice', t: 1 });
  assert.ok(velocidadeMaxima(b, 'corrida') < v0 * 0.85, 'perna ferida reduz corrida');
  const fn = ferir(c, { dano: 12, regiao: 'pescoco', origem: 'x', tipo: 'mordida', t: 1 });
  const ft = ferir(c, { dano: 12, regiao: 'flanco', origem: 'x', tipo: 'mordida', t: 1 });
  assert.ok(fn.sangramento > ft.sangramento, 'pescoço sangra mais');
  const vel = ferir(animal(m, 'a'), { dano: 10, regiao: 'tronco', origem: 'x', tipo: 'mordida', t: 1 });
  const tar = ferir(tt, { dano: 10, regiao: 'tronco', origem: 'x', tipo: 'mordida', t: 1 });
  assert.ok(tar.efetivo < vel.efetivo * 0.8, 'carapaça dorsal do Tarruco absorve parte do dano');
});

test('V3 combate: bote de um Varrisco derruba um Velsari; mordida no pescoço pode agarrar e imobilizar', () => {
  let quedas = 0, agarroes = 0, presoParado = true;
  for (let s = 1; s <= 6; s++) {
    const m = mundoTeste(cenarioTeste('b', [varrisco('v', 60, 60, { direcaoGraus: 0 }), velsari('p', 61.4, 60, { direcaoGraus: 0 })]), s);
    const v = animal(m, 'v'), p = animal(m, 'p');
    p.especie = { ...p.especie, combate: { ...p.especie.combate, esquiva: 0 } };
    v.velocidade = 9; v.direcao = 0;
    const bote = v.especie.combate.ataques.find((x) => x.nome === 'bote');
    v.golpe = { nome: 'bote', alvo: 'p', inicio: 0, impacto: m.t, ataque: bote, surpresa: true };
    resolverGolpe(v, m);
    if (ev(m, 'queda').length) quedas++;
    if (v.agarrando === 'p') {
      agarroes++;
      const x0 = p.x;
      for (let i = 0; i < 5; i++) passoEco(m);
      if (p.agarradoPor && Math.abs(p.x - (v.x + Math.cos(v.direcao) * perfilGolpe(v, v.especie.combate.ataques[0]).alcance)) > 0.05) presoParado = false;
      void x0;
    }
  }
  assert.ok(quedas >= 1, `quedas: ${quedas}`);
  assert.ok(agarroes >= 1, `agarrões: ${agarroes}`);
  assert.ok(presoParado, 'presa agarrada fica presa à boca do predador');
});

test('V3 combate: cápsula do corpo — ponto atrás da cauda está fora; ponto no meio do corpo está dentro', () => {
  const m = mundoTeste(cenarioTeste('k', [varrisco('v', 60, 60, { direcaoGraus: 0 })]), 1);
  const v = animal(m, 'v'), k = capsula(v);
  assert.ok(pontoNaCapsula(60, 60, k).d < 0);
  assert.ok(pontoNaCapsula(57, 60, k).d > 0, 'atrás da ponta da cauda');
  assert.ok(pontoNaCapsula(61, 60, k).s > pontoNaCapsula(59, 60, k).s, 's cresce da traseira para a frente');
});

// ------------------------------------------------------------ socialização
test('V3 social: bando cumprimenta, faz limpeza mútua e filhotes brincam; memórias sociais persistem ao salvar', () => {
  const m = mundoTeste(cenarioTeste('so', [{ especie: 'velsari', grupos: [{ x: 80, y: 60, raio: 4, adultos: 6, filhotes: 2, fome: 10, sede: 5 }] }]), 3);
  rodar(m, 240);
  const tipos = new Set(m.eventos.map((e) => e.tipo));
  assert.ok(tipos.has('limpeza_mutua'), 'limpeza mútua');
  assert.ok(tipos.has('brincadeira'), 'brincadeira de filhotes');
  const a = m.vivos.find((x) => x.juvenil);
  assert.equal(a.relacoes.get(a.maeId)?.tipo, 'mae', 'filhote reconhece a mãe');
  const s = salvarMundo(m), m2 = carregarMundo(m.config, s);
  assert.deepEqual([...m2.porId.get(a.id).relacoes.entries()], [...a.relacoes.entries()]);
  for (let i = 0; i < 300; i++) { passoEco(m); passoEco(m2); }
  assert.equal(hashMundo(m2), hashMundo(m), 'continua idêntico após carregar');
});

test('V3 social: alarme de outra espécie deixa em alerta (não dispara fuga)', () => {
  const m = mundoTeste(cenarioTeste('al', [velsari('v', 60, 60), { especie: 'cromatil', individuos: [{ id: 'c', x: 66, y: 60 }] }]), 1);
  const c = animal(m, 'c');
  rodar(m, 1);
  m.som(c, 'alarme', 50);
  rodar(m, 1.3);
  assert.ok(ev(m, 'alarme_outra_especie', 'v').length >= 1);
  assert.notEqual(animal(m, 'v').estado, 'fugindo');
});
