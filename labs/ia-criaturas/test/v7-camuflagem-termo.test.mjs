// V7 — camuflagem óptica ativa e termorrecepção. As distâncias são MEDIDAS na simulação, não fixadas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cenarioTeste, mundoTeste, rodar, ev } from './eco-ajudantes.mjs';
import { passoEco } from '../src/eco/mundo.js';
import { iniciarAtaque } from '../src/eco/combate.js';

const PLANO = { largura: 200, profundidade: 80, amplitude: 0, capim: 0 };
const parado = (olhar) => () => ({ estado: 'vigiando', codigo: 'teste', motivo: 'bancada', alvo: null, destino: null, ritmo: 'parado', olharPara: olhar });

// Caçador a `d` metros de um Velsari que olha para ele. `camo` força a camuflagem; `ritmo` move o caçador.
function encontro({ d, camo, ritmo = 'parado', semente = 1, energia = 95, observador = 'velsari', clima = {}, terreno = {}, alvoEsp = 'proto-cacador-camuflado', deCostas = false }) {
  const m = mundoTeste(cenarioTeste('v7-camo', [
    { especie: alvoEsp, individuos: [{ id: 'pred', x: 30, y: 40, direcaoGraus: 0, energia }] },
    { especie: observador, individuos: [{ id: 'obs', x: 30 + d, y: 40, direcaoGraus: deCostas ? 0 : 180 }] },
  ], { ...PLANO, ...terreno }, { clima: { chanceIncendio: 0, ...clima } }), semente);
  const p = m.porId.get('pred'), o = m.porId.get('obs');
  p.x = 30; p.y = 40; o.x = 30 + d; o.y = 40; o.direcao = deCostas ? 0 : Math.PI;
  if (p.camuflagem) { p.camuflagem.forcar = camo; if (camo) p.camuflagem.intensidade = 1; }
  o.comandoTeste = parado(deCostas ? { x: o.x + 10, y: 40 } : { x: 30, y: 40 });
  p.comandoTeste = ritmo === 'parado' ? parado({ x: o.x, y: 40 })
    : () => ({ estado: 'espreitando', codigo: 'teste', motivo: 'bancada', alvo: null, destino: { x: o.x, y: 40 }, ritmo });
  return { m, p, o };
}
const viu = (o, via) => o.contatos.some((k) => k.id === 'pred' && k.via === via);

// Maior distância (grade de 2 m) em que o observador reconhece o caçador PARADO em até 8 s.
function alcanceParado(camo) {
  let max = 0;
  for (let d = 2; d <= 60; d += 2) {
    const { m, o } = encontro({ d, camo });
    if (rodar(m, 8, () => viu(o, 'visao'))) max = d;
  }
  return max;
}
// Distância em que o observador reconhece o caçador que se APROXIMA a partir de 70 m (média de sementes).
function alcanceAproximando(camo, ritmo) {
  const ds = [];
  for (let s = 1; s <= 8; s++) {
    const { m, p, o } = encontro({ d: 70, camo, ritmo, semente: s });
    rodar(m, 80, () => viu(o, 'visao') || o.x - p.x < 2);
    ds.push(o.x - p.x);
  }
  return ds.reduce((a, b) => a + b, 0) / ds.length;
}

test('camuflagem: reduz a distância de detecção visual; correr denuncia mais que andar', () => {
  const semP = alcanceParado(false), comP = alcanceParado(true);
  const semA = alcanceAproximando(false, 'andar'), comA = alcanceAproximando(true, 'andar'), comC = alcanceAproximando(true, 'corrida');
  console.log(`    parado: ${semP} m sem → ${comP} m com | andando: ${semA.toFixed(1)} → ${comA.toFixed(1)} m | correndo camuflado: ${comC.toFixed(1)} m`);
  assert.ok(comP < semP * 0.5, `parado: ${comP} m com × ${semP} m sem`);
  assert.ok(comA < semA * 0.7, `andando: ${comA} com × ${semA} sem`);
  assert.ok(comC > comA, `correr camuflado (${comC}) deveria denunciar mais que andar (${comA})`);
  assert.ok(comP > 0, 'camuflado não pode ser invisível: de perto o corpo é visto');
});

test('camuflagem: gasta energia por segundo, desliga sem energia e só religa acima do limiar', () => {
  const { m, p } = encontro({ d: 60, camo: true });
  const cfg = p.especie.camuflagemAtiva;
  const e0 = p.energia;
  rodar(m, 20);
  assert.ok(Math.abs(p.camuflagem.energiaGasta - cfg.custoPorSeg * 20) < 1, `gasto ${p.camuflagem.energiaGasta.toFixed(2)} em 20 s parado`);
  assert.ok(p.energia < e0, 'a energia do animal não caiu');
  // Correndo custa mais por segundo que parado.
  const corr = encontro({ d: 150, camo: true, ritmo: 'corrida' });
  rodar(corr.m, 5);
  assert.ok(corr.p.camuflagem.energiaGasta / 5 > cfg.custoPorSeg * 1.5, 'correr camuflado deveria custar mais');
  // Energia baixa: desliga e entra em recarga, mesmo com o controle pedindo ligada.
  const baixa = encontro({ d: 60, camo: true, energia: cfg.energiaReativar + 3 });
  rodar(baixa.m, 80, () => ev(baixa.m, 'camuflagem_quebrou', 'pred').length > 0);
  assert.equal(ev(baixa.m, 'camuflagem_quebrou', 'pred')[0]?.motivo, 'energia', 'deveria ter desligado por energia');
  assert.equal(baixa.p.camuflagem.ligada, false);
  // Com o controle ainda pedindo "ligada": só volta depois da recarga E com energia acima do limiar.
  const tQuebra = baixa.m.t;
  rodar(baixa.m, tQuebra + 120, () => {
    if (baixa.p.camuflagem.ligada) {
      assert.ok(baixa.p.energia >= cfg.energiaReativar - 1, `religou com energia ${baixa.p.energia.toFixed(1)}`);
      assert.ok(baixa.m.t - tQuebra >= cfg.recargaSeg - 0.2, `religou ${(baixa.m.t - tQuebra).toFixed(1)} s após quebrar`);
      return true;
    }
    return false;
  });
});

test('camuflagem: atacar quebra o efeito e impõe recarga', () => {
  const { m, p, o } = encontro({ d: 1.2, camo: null });
  p.camuflagem.ligada = true; p.camuflagem.intensidade = 1; p.estado = 'espreitando';
  iniciarAtaque(p, o, p.especie.combate.ataques[0], m);
  passoEco(m);
  assert.equal(p.camuflagem.ligada, false);
  assert.equal(ev(m, 'camuflagem_quebrou', 'pred')[0].motivo, 'ataque');
  assert.ok(p.camuflagem.bloqueadaAte > m.t + p.especie.camuflagemAtiva.recargaSeg - 1);
});

test('camuflagem: não esconde som — correndo às costas da presa, o caçador camuflado é ouvido', () => {
  const { m, o } = encontro({ d: 25, camo: true, ritmo: 'corrida', deCostas: true });
  const ouviu = rodar(m, 10, () => viu(o, 'audicao'));
  assert.equal(ouviu, true, 'a presa deveria ouvir a corrida');
  assert.equal(viu(o, 'visao'), false, 'de costas, não viu');
});

test('camuflagem: espécie sem a capacidade não ganha estado', () => {
  const { p } = encontro({ d: 20, camo: false, alvoEsp: 'varrisco' });
  assert.equal(p.camuflagem, undefined);
});

// ---------------------------------------------------------------- termorrecepção
const termico = (o) => o.contatos.find((k) => k.id === 'pred' && k.via === 'termico');
function alcanceTermicoMedido(opcoes) {
  let max = 0;
  for (let d = 3; d <= 40; d += 1) {
    const { m, o } = encontro({ observador: 'proto-serpente-termica', camo: true, ...opcoes, d });
    if (rodar(m, 5, () => !!termico(o))) max = d;
  }
  return max;
}

test('termorrecepção: percebe o caçador camuflado que a visão não reconhece, sem saber a espécie', () => {
  const { m, o } = encontro({ d: 12, camo: true, observador: 'proto-serpente-termica', clima: { temperaturaC: 22 } });
  let visao = false;
  const sentiu = rodar(m, 6, () => { visao ||= viu(o, 'visao'); return !!termico(o); });
  assert.equal(sentiu, true, 'não sentiu o calor a 12 m');
  assert.equal(visao, false, 'a visão comum não deveria ter reconhecido o camuflado a 12 m');
  const k = termico(o);
  assert.equal(k.especie, null, 'calor não identifica a espécie');
  assert.ok(k.x !== 30 || k.y !== 40, 'posição deveria ser aproximada');
  assert.ok(!o.memoria.criaturas.has('pred'), 'pista térmica não vira identificação na memória');
  // O animal reage: registra a detecção e orienta-se para a fonte (ou foge/imobiliza, conforme o porte estimado).
  o.comandoTeste = null;
  rodar(m, m.t + 3);
  assert.equal(ev(m, 'calor_detectado', 'obs').length >= 1, true);
});

test('termorrecepção: depende do contraste com o ambiente e do esforço do alvo', () => {
  const frio = alcanceTermicoMedido({ clima: { temperaturaC: 8 } });
  const ameno = alcanceTermicoMedido({ clima: { temperaturaC: 26 } });
  const quente = alcanceTermicoMedido({ clima: { temperaturaC: 36.5 } });
  console.log(`    alcance térmico medido: ar a 8 °C ${frio} m | 26 °C ${ameno} m | 36,5 °C ${quente} m`);
  assert.ok(frio > ameno && ameno > quente, `frio ${frio} > ameno ${ameno} > quente ${quente}`);
  assert.equal(quente, 0, 'sem contraste não há sinal');
  // Ectotérmico parado tem a temperatura do ar: invisível ao calor. A Boscaranha é ectotérmica na ficha.
  assert.equal(alcanceTermicoMedido({ alvoEsp: 'boscaranha', camo: null, clima: { temperaturaC: 22 } }), 0);
});

test('termorrecepção: rocha bloqueia; fora do cone não detecta', () => {
  const rocha = { rochas: [{ x: 36, y: 40, raio: 2.5, altura: 3 }] };
  const livre = encontro({ d: 12, camo: true, observador: 'proto-serpente-termica', clima: { temperaturaC: 22 } });
  const tapado = encontro({ d: 12, camo: true, observador: 'proto-serpente-termica', clima: { temperaturaC: 22 }, terreno: rocha });
  assert.equal(rodar(livre.m, 6, () => !!termico(livre.o)), true);
  assert.equal(rodar(tapado.m, 6, () => !!termico(tapado.o)), false, 'sentiu calor através da rocha');
  const costas = encontro({ d: 8, camo: true, observador: 'proto-serpente-termica', clima: { temperaturaC: 22 }, deCostas: true });
  assert.equal(rodar(costas.m, 6, () => !!termico(costas.o)), false, 'sentiu calor fora do cone');
});

test('termorrecepção: espécie sem o sentido nunca recebe contato térmico', () => {
  const { m, o } = encontro({ d: 6, camo: true, clima: { temperaturaC: 10 } });
  let teve = false;
  rodar(m, 6, () => { teve ||= o.contatos.some((k) => k.via === 'termico'); return false; });
  assert.equal(teve, false);
});
