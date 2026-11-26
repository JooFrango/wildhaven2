// Percepção por vibrações: alcance, atenuação, obstáculos, identidade desconhecida e decaimento da memória.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG, cenarioTeste, mundoTeste, rodar } from './eco-ajudantes.mjs';
import { consolidar, FONTES, instalarVibracoes, intensidade, intensidadePercebida, melhorPista, perceberVibracoes, VIDA_MEMORIA_SEG } from '../src/eco/vibracoes.js';

// Duna procedural suave (cenário auxiliar): encosta sob 32°, para o Serracórion conseguir entrar na areia.
const terreno = (extra = {}) => ({ largura: 300, profundidade: 200, res: 1, amplitude: 4, capim: 20, areia: true, ...extra });

function bancada(extra = {}, semente = 7) {
  const m = mundoTeste(cenarioTeste('vib', [
    { especie: 'escarvao', individuos: [{ id: 'sensor', x: 150, y: 100, profundidadeInicialM: 0.9 }] },
    { especie: 'velsari', individuos: [{ id: 'emissor', x: 150, y: 100 }] },
  ], terreno(extra)), semente);
  instalarVibracoes(m);
  return m;
}

const emitirEm = (m, x, y, tipo, massaKg, prof = 0) => {
  m.vibracoes.push({ id: 'v1', emissor: 'emissor', especie: 'velsari', x, y, prof, tipo, intensidade: intensidade(massaKg, tipo), t: m.t });
  m.vibracoesAnteriores = m.vibracoes;
};

test('vibração: estímulo forte dentro do alcance é detectado', () => {
  const m = bancada();
  const a = m.porId.get('sensor');
  emitirEm(m, 170, 100, 'corrida', 300);
  const e = perceberVibracoes(a, m);
  assert.equal(e.length, 1, 'corrida de 300 kg a 20 m é sentida');
  assert.ok(e[0].intensidade >= a.especie.percepcao.vibracao.limiar);
});

test('vibração: estímulo fraco e distante pode não ser detectado', () => {
  const m = bancada();
  const a = m.porId.get('sensor');
  emitirEm(m, 150 + a.especie.percepcao.vibracao.alcance - 2, 100, 'passo', 6);
  assert.equal(perceberVibracoes(a, m).length, 0, 'um passo de 6 kg na borda do alcance não chega');
});

test('vibração: fora do alcance nunca é detectado', () => {
  const m = bancada();
  const a = m.porId.get('sensor');
  emitirEm(m, 150 + a.especie.percepcao.vibracao.alcance + 5, 100, 'combate', 2000);
  assert.equal(perceberVibracoes(a, m).length, 0);
});

test('vibração: a intensidade cai com a distância', () => {
  const m = bancada();
  const a = m.porId.get('sensor');
  const i = (d) => intensidadePercebida(a, { x: 150 + d, y: 100, prof: 0, intensidade: intensidade(300, 'corrida'), tipo: 'corrida' }, m);
  const perto = i(5), medio = i(20), longe = i(50);
  assert.ok(perto > medio && medio > longe, `${perto} > ${medio} > ${longe}`);
});

test('vibração: rocha no caminho atenua o estímulo', () => {
  const comRocha = bancada({ rochas: [{ x: 160, y: 100, raio: 6, altura: 4 }] });
  const sem = bancada();
  const alvo = { x: 180, y: 100, prof: 0, intensidade: intensidade(300, 'corrida'), tipo: 'corrida' };
  const iCom = intensidadePercebida(comRocha.porId.get('sensor'), alvo, comRocha);
  const iSem = intensidadePercebida(sem.porId.get('sensor'), alvo, sem);
  assert.ok(iCom < iSem, `rocha atenua: ${iCom} < ${iSem}`);
});

test('vibração: a profundidade entre emissor e receptor atenua', () => {
  const m = bancada();
  const a = m.porId.get('sensor');
  const base = { x: 165, y: 100, intensidade: intensidade(300, 'corrida'), tipo: 'corrida' };
  const mesmaFaixa = intensidadePercebida(a, { ...base, prof: 0.9 }, m);
  const fundo = intensidadePercebida(a, { ...base, prof: 20 }, m);
  assert.ok(fundo < mesmaFaixa, `${fundo} < ${mesmaFaixa}`);
});

test('vibração: quem sente não conhece a espécie da fonte', () => {
  const m = bancada();
  const a = m.porId.get('sensor');
  emitirEm(m, 165, 100, 'corrida', 300);
  const e = perceberVibracoes(a, m);
  assert.equal(e[0].especie, null, 'o contato de vibração não traz espécie');
  const mem = consolidar(a, e, m);
  assert.equal([...mem.values()][0].especie, null, 'a pista também não nasce identificada');
});

test('vibração: a posição estimada tem erro, não é exata', () => {
  const m = bancada();
  const a = m.porId.get('sensor');
  let algumErro = false;
  for (let i = 0; i < 20; i++) {
    m.vibracoes = [];
    emitirEm(m, 190, 100, 'corrida', 300);
    const e = perceberVibracoes(a, m);
    if (e.length && (Math.abs(e[0].x - 190) > 1e-6 || Math.abs(e[0].y - 100) > 1e-6)) algumErro = true;
    assert.ok(!e.length || e[0].erroM > 0, 'o erro declarado é positivo');
  }
  assert.ok(algumErro, 'a posição sentida difere da real');
});

test('vibração: a memória de estímulos antigos decai', () => {
  const m = bancada();
  const a = m.porId.get('sensor');
  emitirEm(m, 165, 100, 'corrida', 300);
  consolidar(a, perceberVibracoes(a, m), m);
  assert.equal(a.memoria.vibracoes.size, 1);
  m.t += VIDA_MEMORIA_SEG + 1;
  consolidar(a, [], m);
  assert.equal(a.memoria.vibracoes.size, 0, 'a pista some depois da vida útil');
});

test('vibração: estímulos repetidos no mesmo lugar viram uma pista mais forte', () => {
  const m = bancada();
  const a = m.porId.get('sensor');
  for (let i = 0; i < 5; i++) { m.vibracoes = []; emitirEm(m, 165, 100, 'corrida', 300); consolidar(a, perceberVibracoes(a, m), m); m.t += 0.5; }
  const p = [...a.memoria.vibracoes.values()][0];
  const total = [...a.memoria.vibracoes.values()].reduce((x, q) => x + q.contagem, 0);
  assert.ok(total >= 4, `as pistas somam ${total} estímulos`);
  assert.ok(p.contagem >= 2, `a pista principal acumulou ${p.contagem} estímulos`);
  assert.ok(melhorPista(a, m), 'há uma pista a investigar');
});

test('vibração: ações mais violentas sacodem mais o substrato', () => {
  assert.ok(FONTES.combate > FONTES.corrida);
  assert.ok(FONTES.corrida > FONTES.trote);
  assert.ok(FONTES.trote > FONTES.passo);
  assert.ok(intensidade(2000, 'passo') > intensidade(50, 'passo'), 'massa maior, estímulo maior');
});

test('vibração: não substitui os outros sentidos — na superfície a visão continua funcionando', () => {
  const m = mundoTeste(cenarioTeste('vib-sup', [
    { especie: 'serracorion', individuos: [{ id: 'pred', x: 100, y: 100, direcaoGraus: 0 }] },
    { especie: 'velsari', individuos: [{ id: 'presa', x: 112, y: 100 }] },
  ], terreno()), 5);
  rodar(m, 4);
  const pred = m.porId.get('pred');
  assert.ok(pred.contatos.some((k) => k.via !== 'vibracao' && k.id === 'presa'), 'na superfície percebe a presa por visão, audição ou olfato');
});

test('vibração: sob a areia não há visão, audição nem olfato', () => {
  const m = mundoTeste(cenarioTeste('vib-sub', [
    { especie: 'arraia-de-areia', individuos: [{ id: 'pred', x: 100, y: 100, profundidadeInicialM: 2, direcaoGraus: 0 }] },
    { especie: 'velsari', individuos: [{ id: 'presa', x: 110, y: 100 }] },
  ], terreno()), 5);
  const pred = m.porId.get('pred');
  assert.equal(pred.subsolo.fase, 'submerso', 'começa enterrado');
  // Enquanto estiver submerso (ele pode decidir emergir a qualquer momento), nenhum contato vem dos outros sentidos.
  let passosSubmerso = 0;
  rodar(m, 6, (mm) => {
    if (pred.subsolo.fase !== 'submerso') return true;
    passosSubmerso++;
    assert.equal(pred.contatos.filter((k) => k.via !== 'vibracao').length, 0, 'enterrado só percebe vibração');
    return false;
  });
  assert.ok(passosSubmerso > 5, `ficou ${passosSubmerso} passos submerso`);
});
