// V7 — clima adverso, cupinzeiros e ciclo da carcaça. Medidas tiradas do passo normal da simulação.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cenarioTeste, mundoTeste, rodar, ev } from './eco-ajudantes.mjs';
import { alcances } from '../src/eco/percepcao.js';
import { CLIMAS, climaPermitido, temperaturaAmbiente } from '../src/eco/clima.js';
import { acessoCupins } from '../src/eco/cupins.js';
import { estagioCarcaca } from '../src/eco/carcaca.js';
import { noAr } from '../src/eco/voo.js';

const PLANO = { largura: 200, profundidade: 120, amplitude: 0, capim: 0 };
const parado = (olhar) => () => ({ estado: 'vigiando', codigo: 'teste', motivo: 'bancada', alvo: null, destino: null, ritmo: 'parado', olharPara: olhar });

// ---------------------------------------------------------------- clima
// Presa parada olhando para um Varrisco que anda na direção dela: a que distância ela o reconhece?
function distanciaDeDeteccao(clima, terreno = {}) {
  const ds = [];
  for (let s = 1; s <= 6; s++) {
    const m = mundoTeste(cenarioTeste('v7-clima', [
      { especie: 'varrisco', individuos: [{ id: 'pred', x: 30, y: 60, direcaoGraus: 0 }] },
      { especie: 'velsari', individuos: [{ id: 'presa', x: 110, y: 60, direcaoGraus: 180 }] },
    ], { ...PLANO, ...terreno }, { clima: { chanceIncendio: 0, eventos: clima ? [{ tipo: clima, inicioSeg: 0, duracaoSeg: 600, intensidade: 1 }] : undefined } }), s);
    const p = m.porId.get('pred'), o = m.porId.get('presa');
    o.comandoTeste = parado({ x: 30, y: 60 });
    p.comandoTeste = () => (m.t < 10 ? parado({ x: 110, y: 60 })() : { estado: 'espreitando', codigo: 'teste', motivo: 'bancada', alvo: null, destino: { x: 110, y: 60 }, ritmo: 'andar' });
    rodar(m, 120, () => o.contatos.some((k) => k.id === 'pred' && k.via === 'visao') || o.x - p.x < 1.5);
    ds.push(o.x - p.x);
  }
  return ds.reduce((a, b) => a + b, 0) / ds.length;
}

test('clima: tempestade de areia e chuva reduzem a visão DOS ANIMAIS, não só a da câmera', () => {
  const limpo = distanciaDeDeteccao(null, { areia: true });
  const chuva = distanciaDeDeteccao('chuva_intensa');
  const areia = distanciaDeDeteccao('tempestade_areia', { areia: true });
  console.log(`    presa reconhece o predador a: céu limpo ${limpo.toFixed(1)} m | chuva intensa ${chuva.toFixed(1)} m | tempestade de areia ${areia.toFixed(1)} m`);
  assert.ok(chuva < limpo * 0.8, `chuva ${chuva} × limpo ${limpo}`);
  assert.ok(areia < limpo * 0.4, `areia ${areia} × limpo ${limpo}`);
  assert.ok(areia < chuva);
});

test('clima: cada evento só acontece no bioma que o comporta', () => {
  const savana = mundoTeste(cenarioTeste('v7-bioma', [{ especie: 'velsari', individuos: [{ id: 'a', x: 50, y: 50 }] }], PLANO), 1);
  assert.equal(climaPermitido(savana, 'tempestade_areia').motivo, 'bioma_sem_areia');
  assert.equal(climaPermitido(savana, 'nevasca').motivo, 'bioma_sem_frio');
  assert.equal(savana.iniciarClima('nevasca'), false);
  assert.equal(ev(savana, 'clima_recusado').length, 1);
  assert.equal(savana.iniciarClima('chuva_intensa'), true);
  const frio = mundoTeste(cenarioTeste('v7-frio', [{ especie: 'velsari', individuos: [{ id: 'a', x: 50, y: 50 }] }], PLANO, { clima: { chanceIncendio: 0, temperaturaMediaC: -2 } }), 1);
  assert.equal(climaPermitido(frio, 'nevasca').ok, true);
});

test('clima: nevasca esfria, custa energia e deixa a locomoção mais lenta; começa e termina', () => {
  const corre = (nevasca) => {
    const m = mundoTeste(cenarioTeste('v7-nevasca', [{ especie: 'velsari', individuos: [{ id: 'a', x: 20, y: 60, direcaoGraus: 0, energia: 90 }] }], PLANO,
      { clima: { chanceIncendio: 0, temperaturaMediaC: -2, amplitudeTermicaC: 3, eventos: nevasca ? [{ tipo: 'nevasca', inicioSeg: 0, duracaoSeg: 40, intensidade: 1 }] : undefined } }), 1);
    const a = m.porId.get('a');
    a.comandoTeste = () => ({ estado: 'vagando', codigo: 'teste', motivo: 'bancada', alvo: null, destino: { x: 190, y: 60 }, ritmo: 'trote' });
    rodar(m, 30);
    return { m, a, x: a.x, energia: a.energia, t: temperaturaAmbiente(m) };
  };
  const sem = corre(false), com = corre(true);
  console.log(`    30 s de trote: sem nevasca ${(sem.x - 20).toFixed(1)} m, energia ${sem.energia.toFixed(1)}, ar ${sem.t.toFixed(1)} °C | com nevasca ${(com.x - 20).toFixed(1)} m, energia ${com.energia.toFixed(1)}, ar ${com.t.toFixed(1)} °C`);
  assert.ok(com.x - 20 < (sem.x - 20) * 0.8, 'nevasca não reduziu o deslocamento');
  assert.ok(com.energia < sem.energia - 1, 'nevasca não custou energia');
  assert.ok(com.t < sem.t - 8, 'nevasca não esfriou');
  rodar(com.m, 60);
  assert.equal(com.m.climaAtivo, null, 'o evento deveria ter terminado');
  assert.equal(ev(com.m, 'clima_fim').length, 1);
});

test('clima: sob tempestade de areia os animais procuram abrigo e a perseguição se perde', () => {
  const m = mundoTeste(cenarioTeste('v7-abrigo', [
    { especie: 'velsari', individuos: [{ id: 'presa', x: 80, y: 60, fome: 20, sede: 10 }] },
  ], { ...PLANO, areia: true, arbustos: [{ x: 95, y: 66, raio: 5, ocultacao: 80, alimento: 10 }] }, { clima: { chanceIncendio: 0, eventos: [{ tipo: 'tempestade_areia', inicioSeg: 5, duracaoSeg: 60, intensidade: 1 }] } }), 1);
  const a = m.porId.get('presa');
  let abrigou = false;
  rodar(m, 50, () => { abrigou ||= a.estado === 'abrigado'; return false; });
  assert.equal(ev(m, 'busca_abrigo', 'presa').length, 1);
  assert.equal(abrigou, true, `não chegou ao abrigo (estado ${a.estado})`);
  const al = alcances(a, m.relogio.hora, m.climaAtivo), limpo = alcances(a, m.relogio.hora, null);
  assert.ok(al.visao < limpo.visao * 0.25, 'o próprio animal deveria enxergar muito menos');
});

test('clima: voador em tempestade de areia desce; sem tempestade continua no ar', () => {
  const voa = (tempestade) => {
    const m = mundoTeste(cenarioTeste('v7-voo-clima', [{ especie: 'carniroca', individuos: [{ id: 'ave', x: 60, y: 60, altitudeInicialM: 22, energia: 95, fome: 10, sede: 10 }] }],
      { ...PLANO, largura: 400, profundidade: 300, areia: true }, { clima: { chanceIncendio: 0, eventos: tempestade ? [{ tipo: 'tempestade_areia', inicioSeg: 3, duracaoSeg: 200, intensidade: 1 }] : undefined } }), 1);
    const a = m.porId.get('ave');
    rodar(m, 60);
    return { m, a };
  };
  const calmo = voa(false), temp = voa(true);
  assert.equal(noAr(calmo.a), true, 'sem tempestade deveria seguir voando');
  assert.equal(noAr(temp.a), false, `com tempestade deveria ter pousado (alt ${temp.a.voo.alt.toFixed(1)})`);
  assert.equal(ev(temp.m, 'pouso_por_clima', 'ave').length, 1);
  assert.equal(temp.a.voo.quedas, 0, 'desceu caindo');
});

test('clima: fatores declarados para os três eventos', () => {
  for (const [k, c] of Object.entries(CLIMAS)) for (const f of ['visao', 'audicao', 'olfato', 'locomocao', 'voo']) assert.ok(c[f] > 0 && c[f] <= 1, `${k}.${f}`);
});

// ---------------------------------------------------------------- cupins
function savanaCupins(pops, cupinzeiros, extra = {}) {
  return mundoTeste(cenarioTeste('v7-cupins', pops, { ...PLANO, capim: 10 }, { cupinzeiros, duracaoSeg: 600, ...extra }), extra.semente ?? 1);
}

test('cupins: o animal só come depois de localizar a colônia; comer retira população e mata a fome', () => {
  const m = savanaCupins([{ especie: 'ferrunco', individuos: [{ id: 'f', x: 40, y: 60, direcaoGraus: 0, fome: 80, sede: 5, energia: 95 }] }], [{ id: 'c1', x: 90, y: 62, populacaoMax: 3000 }]);
  const f = m.porId.get('f'), c = m.cupinzeiros[0];
  assert.equal(f.memoria.cupinzeiros, undefined);
  let comeuSemConhecer = false, tAchou = null, tComeu = null, abriu = false;
  rodar(m, 240, () => {
    if (ev(m, 'cupinzeiro_achado', 'f').length && tAchou === null) tAchou = m.t;
    if (c.consumido > 0 && tComeu === null) { tComeu = m.t; if (tAchou === null) comeuSemConhecer = true; }
    abriu ||= f.estado === 'abrindo_cupinzeiro';
    return false;
  });
  assert.equal(comeuSemConhecer, false);
  assert.ok(tAchou !== null && tComeu !== null && tComeu > tAchou, `achou em ${tAchou}, comeu em ${tComeu}`);
  assert.equal(abriu, true, 'o Ferrunco deveria abrir a casca antes de comer');
  assert.ok(Math.abs(3000 - c.populacao - c.consumido) < 60, 'população não bate com o consumo (descontado o crescimento)');
  assert.ok(f.fome < 80, 'a fome não caiu');
  assert.ok(Math.abs(f.cupinsComidos - c.consumoPor.f) < 1e-6);
  console.log(`    achou em ${tAchou.toFixed(1)} s, primeira boca em ${tComeu.toFixed(1)} s; comeu ${c.consumido.toFixed(0)} cupins, fome 80 → ${f.fome.toFixed(1)}`);
});

test('cupins: sem colônia à vista nem ao faro o animal procura e não ganha energia do nada', () => {
  const m = savanaCupins([{ especie: 'pica-termita', individuos: [{ id: 'p', x: 30, y: 60, fome: 80, sede: 5, energia: 95 }] }], []);
  const p = m.porId.get('p');
  let procurou = false;
  rodar(m, 60, () => { procurou ||= p.estado === 'procurando_cupins'; return false; });
  assert.equal(procurou, true);
  assert.ok(p.fome >= 80, 'a fome caiu sem haver alimento');
  assert.equal(m.metricas.cupinsConsumidos ?? 0, 0);
});

test('cupins: colônia esgota e é abandonada; colônia poupada se recupera', () => {
  const m = savanaCupins([{ especie: 'ferrunco', individuos: [{ id: 'f', x: 84, y: 62, direcaoGraus: 0, fome: 95, sede: 5, energia: 95 }] }], [{ id: 'pequena', x: 90, y: 62, populacao: 120, populacaoMax: 3000 }]);
  rodar(m, 200, () => m.cupinzeiros[0].extinta);
  assert.equal(m.cupinzeiros[0].extinta, true, `não esgotou (${m.cupinzeiros[0].populacao.toFixed(0)} restantes)`);
  assert.equal(ev(m, 'cupinzeiro_esgotado').length, 1);
  rodar(m, m.t + 30);
  assert.equal(ev(m, 'cupinzeiro_abandonado', 'f').length, 1);
  const total = m.cupinzeiros[0].consumido;
  rodar(m, m.t + 60);
  assert.equal(m.cupinzeiros[0].consumido, total, 'consumo infinito de colônia extinta');
  // Recuperação: ninguém come; a população sobe em direção ao máximo e não passa dele.
  const r = savanaCupins([{ especie: 'velsari', individuos: [{ id: 'v', x: 20, y: 20 }] }], [{ id: 'c', x: 90, y: 62, populacao: 800, populacaoMax: 3000, crescimentoPorDia: 2 }]);
  rodar(r, 600);
  assert.ok(r.cupinzeiros[0].populacao > 900 && r.cupinzeiros[0].populacao <= 3000, `população ${r.cupinzeiros[0].populacao.toFixed(0)}`);
});

test('cupins: dois especialistas no mesmo monte — o menor cede ao maior', () => {
  const m = savanaCupins([
    { especie: 'ferrunco', individuos: [{ id: 'grande', x: 86, y: 62, direcaoGraus: 0, fome: 90, sede: 5, energia: 95 }] },
    { especie: 'pica-termita', individuos: [{ id: 'pequeno', x: 70, y: 66, direcaoGraus: 0, fome: 90, sede: 5, energia: 95 }] },
  ], [{ id: 'c1', x: 90, y: 62, populacaoMax: 4000 }]);
  let esperou = false;
  rodar(m, 150, () => { esperou ||= m.porId.get('pequeno')?.codigo === 'cede_ao_maior'; return false; }); // chega voando: a espera pode ser no pouso
  const c = m.cupinzeiros[0];
  console.log(`    consumo: Ferrunco ${(c.consumoPor.grande ?? 0).toFixed(0)}, Pica-Termita ${(c.consumoPor.pequeno ?? 0).toFixed(0)}; cedeu ${ev(m, 'cupinzeiro_cedido', 'pequeno').length}×`);
  assert.ok((c.consumoPor.grande ?? 0) > 0, 'o maior não comeu');
  assert.equal(esperou, true, 'o menor não esperou');
  assert.ok(ev(m, 'cupinzeiro_cedido', 'pequeno').length >= 1);
});

test('cupins: chuva aumenta a atividade na superfície; tempestade de areia recolhe a colônia', () => {
  const acesso = (clima, areia) => {
    const m = mundoTeste(cenarioTeste('v7-cupins-clima', [{ especie: 'velsari', individuos: [{ id: 'v', x: 20, y: 20 }] }], { ...PLANO, areia }, { cupinzeiros: [{ id: 'c', x: 90, y: 60 }], clima: { chanceIncendio: 0, temperaturaC: 24, eventos: clima ? [{ tipo: clima, inicioSeg: 0, duracaoSeg: 100, intensidade: 1 }] : undefined } }), 1);
    rodar(m, 20);
    return acessoCupins(m.cupinzeiros[0]);
  };
  const seco = acesso(null, false), chuva = acesso('chuva_intensa', false), areia = acesso('tempestade_areia', true);
  console.log(`    fração ao alcance (monte fechado): normal ${seco.toFixed(3)}, chuva ${chuva.toFixed(3)}, tempestade de areia ${areia.toFixed(3)}`);
  assert.ok(chuva > seco && areia < seco);
});

// ---------------------------------------------------------------- carcaça
function comCarcaca({ temperaturaC = 26, necrofagos = true, comedor = false, segundosPorDia = 60, massaEsp = 'velsari' } = {}) {
  const pops = [{ especie: massaEsp, individuos: [{ id: 'morto', x: 60, y: 60 }] }];
  if (comedor) pops.push({ especie: 'carniroca', individuos: [{ id: 'ave', x: 75, y: 62, fome: 85, sede: 5, energia: 95 }] });
  const cen = cenarioTeste('v7-carcaca', pops, PLANO, {
    relogio: { segundosPorDia, diaInicial: 12, horaInicial: 8 }, clima: { chanceIncendio: 0, temperaturaC },
    decomposicao: { diasAteOssos: 2, ossosDias: 3, maxCarcacas: 6, necrofagos: necrofagos ? { especie: 'dunebrio', maxPorCarcaca: 24, comePorSegKg: 0.002, chegadaPorSeg: 0.3 } : null },
  });
  const m = mundoTeste(cen, 1);
  m.matar(m.porId.get('morto'), 'ferimentos', null);
  return { m, c: m.carcacas[0] };
}
const contas = (c) => c.carne + Object.values(c.consumo).reduce((s, v) => s + v, 0) + c.consumoInsetos + c.perdaDecomposicao;

test('carcaça: passa pelos estágios em ordem, deixa ossos e é reciclada; a carne nunca é criada', () => {
  const { m, c } = comCarcaca();
  const inicial = c.carneInicial;
  let maxCarne = c.carne;
  rodar(m, 60 * 9, () => { if (m.carcacas[0]) { maxCarne = Math.max(maxCarne, m.carcacas[0].carne); assert.ok(Math.abs(contas(m.carcacas[0]) - inicial) < 1e-6, 'carne apareceu ou sumiu sem registro'); } return !m.carcacas.length; });
  const est = ev(m, 'carcaca_estagio').map((e) => e.para);
  console.log(`    estágios: fresca → ${est.join(' → ')} → reciclada (${m.t.toFixed(0)} s = ${(m.t / 60).toFixed(1)} dias)`);
  assert.equal(maxCarne, inicial, 'a carne aumentou');
  assert.deepEqual(est.filter((e) => ['decomposicao', 'restos', 'ossos'].includes(e)), ['decomposicao', 'restos', 'ossos']);
  assert.equal(m.carcacas.length, 0, 'deveria ter sido reciclada');
  const fim = ev(m, 'ossos_reciclados')[0];
  assert.ok(fim && Math.abs(fim.animaisKg + fim.insetosKg + fim.apodreceuKg - inicial) < 0.05, 'o balanço final não fecha com a carne inicial');
  assert.ok(ev(m, 'necrofagos_chegaram').length === 1 && ev(m, 'necrofagos_dispersaram').length === 1);
});

test('carcaça: calor acelera, frio retarda e segura os insetos', () => {
  const ate = (temperaturaC) => { const { m } = comCarcaca({ temperaturaC }); rodar(m, 60 * 12, () => m.carcacas[0]?.carne <= 0.05 || !m.carcacas.length); return { t: m.t, insetos: ev(m, 'necrofagos_chegaram').length }; };
  const quente = ate(34), ameno = ate(20), frio = ate(4);
  console.log(`    até os ossos: 34 °C ${quente.t.toFixed(0)} s | 20 °C ${ameno.t.toFixed(0)} s | 4 °C ${frio.t.toFixed(0)} s (insetos chegaram: ${frio.insetos})`);
  assert.ok(quente.t < ameno.t && ameno.t < frio.t);
  assert.equal(frio.insetos, 0, 'insetos ativos a 4 °C');
});

test('carcaça: necrófago do catálogo consome o recurso e ele é finito', () => {
  const { m, c } = comCarcaca({ comedor: true, necrofagos: false, segundosPorDia: 600 });
  const ave = m.porId.get('ave');
  let comeu = false;
  rodar(m, 300, () => { comeu ||= ave.estado === 'comendo_carcaca'; return false; });
  const kg = c.consumo.ave ?? 0;
  console.log(`    Carniroca comeu ${kg.toFixed(2)} kg de ${c.carneInicial} kg; estágio ${estagioCarcaca(c)}`);
  assert.equal(comeu, true, `a ave não chegou a comer (estado ${ave.estado})`);
  assert.ok(kg > 0 && kg <= c.carneInicial);
  assert.ok(Math.abs(contas(c) - c.carneInicial) < 1e-6);
});

test('carcaça: limite de objetos persistentes é respeitado', () => {
  const pops = [{ especie: 'cromatil', individuos: Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, x: 30 + i * 8, y: 60 })) }];
  const m = mundoTeste(cenarioTeste('v7-limite', pops, PLANO, { clima: { chanceIncendio: 0, temperaturaC: 5 }, decomposicao: { maxCarcacas: 4, necrofagos: null } }), 1);
  for (let i = 0; i < 10; i++) m.matar(m.porId.get(`m${i}`), 'ferimentos', null);
  rodar(m, 2);
  assert.equal(m.carcacas.length, 4);
  assert.equal(ev(m, 'ossos_reciclados').filter((e) => e.porLimite).length, 6);
});

test('carcaça: cenário sem `decomposicao` mantém o comportamento antigo', () => {
  const m = mundoTeste(cenarioTeste('v7-antigo', [{ especie: 'velsari', individuos: [{ id: 'a', x: 50, y: 50 }] }], PLANO), 1);
  m.matar(m.porId.get('a'), 'ferimentos', null);
  rodar(m, 5);
  assert.equal(m.carcacas[0].estagio, undefined);
  assert.equal(m.carcacas[0].insetos, undefined);
});
