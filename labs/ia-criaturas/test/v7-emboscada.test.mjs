// V7 — emboscada. A tática depende de cobertura e de presa PERCEBIDA; pode falhar e desistir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cenarioTeste, mundoTeste, rodar, ev, CFG } from './eco-ajudantes.mjs';
import { criarMundoEco } from '../src/eco/mundo.js';

const MATO = { largura: 160, profundidade: 120, amplitude: 0, capim: 10, arbustos: [{ x: 80, y: 60, raio: 5, ocultacao: 85, alimento: 20 }] };
// Boscaranha faminta perto do arbusto; um Folhisco passa andando em linha reta a `afastamento` metros do arbusto.
function cena({ afastamento, terreno = MATO, semente = 1, comPresa = true, especies = null, duracao = 200 } = {}) {
  const pops = [{ especie: 'boscaranha', individuos: [{ id: 'pred', x: 74, y: 60, direcaoGraus: 0, fome: 80, sede: 5, energia: 95 }] }];
  if (comPresa) pops.push({ especie: 'folhisco', individuos: [{ id: 'presa', x: 40, y: 60 + afastamento, direcaoGraus: 0, fome: 10, sede: 5 }] });
  const cen = cenarioTeste('v7-emboscada', pops, terreno, { duracaoSeg: duracao });
  const m = especies ? criarMundoEco({ ...CFG, especies, cenarios: { [cen.id]: cen } }, cen, semente) : mundoTeste(cen, semente);
  const presa = m.porId.get('presa');
  // A presa só anda em linha enquanto não percebeu nada; ao perceber o predador, a IA dela assume (pode fugir).
  if (presa) presa.comandoTeste = (a) => (a.contatos.some((k) => k.id === 'pred') || a.mente.atingidoPor ? null : { estado: 'vagando', codigo: 'teste', motivo: 'bancada', alvo: null, destino: { x: 130, y: 60 + afastamento }, ritmo: 'andar' });
  return { m, pred: m.porId.get('pred'), presa };
}

test('emboscada: vai até a cobertura, espera imóvel e só dispara com a presa vista dentro do alcance', () => {
  let disparos = 0, golpes = 0, acertos = 0;
  for (let s = 1; s <= 12; s++) {
    const { m, pred } = cena({ afastamento: 1.5, semente: s });
    const cfg = pred.especie.taticasDeEmboscada;
    let esperou = false, fases = new Set();
    rodar(m, 120, () => { fases.add(pred.estado); if (pred.estado === 'emboscado' && pred.velocidade < 0.05) esperou = true; return false; });
    assert.equal(ev(m, 'emboscada_armada', 'pred').length >= 1, true, `s${s}: não armou a emboscada`);
    assert.equal(esperou, true, `s${s}: nunca ficou imóvel emboscado`);
    for (const d of ev(m, 'emboscada_disparou', 'pred')) { disparos++; assert.ok(d.distancia <= cfg.distanciaDisparoM * 2 + 1e-9, `s${s}: disparou a ${d.distancia} m`); }
    golpes += ev(m, 'ataque_inicio', 'pred').length; acertos += ev(m, 'ferimento', 'presa').length;
  }
  console.log(`    presa passando a 1,5 m: ${disparos} disparos, ${golpes} golpes, ${acertos} acertos em 12 sementes`);
  assert.ok(disparos > 0, 'nenhuma emboscada disparou com a presa passando a 1,5 m da cobertura');
});

test('emboscada: presa que passa longe não é atacada — e ele desiste depois do tempo máximo', () => {
  const { m, pred } = cena({ afastamento: 25, duracao: 200 });
  rodar(m, 200);
  assert.equal(ev(m, 'emboscada_disparou', 'pred').length, 0, 'disparou contra presa fora do alcance');
  assert.equal(ev(m, 'ferimento', 'presa').length, 0);
  assert.ok(ev(m, 'emboscada_desistiu', 'pred').length >= 1, 'deveria desistir após a espera máxima');
  assert.ok(ev(m, 'emboscada_desistiu', 'pred')[0].esperou >= pred.especie.taticasDeEmboscada.esperaMaxSeg);
});

test('emboscada: sem presa nenhuma no mundo, nunca dispara (não conhece posições ocultas)', () => {
  const { m } = cena({ comPresa: false });
  rodar(m, 200);
  assert.equal(ev(m, 'emboscada_disparou', 'pred').length, 0);
  assert.equal(ev(m, 'ataque_inicio', 'pred').length, 0);
});

test('emboscada: sem cobertura não há emboscada; sem a capacidade na ficha, também não', () => {
  const pelado = cena({ afastamento: 1.5, terreno: { ...MATO, arbustos: [] } });
  let emboscou = false;
  rodar(pelado.m, 80, () => { emboscou ||= pelado.pred.estado === 'emboscado'; return false; });
  assert.equal(emboscou, false, 'emboscou em campo aberto');
  const especies = { ...CFG.especies, boscaranha: { ...CFG.especies.boscaranha } };
  delete especies.boscaranha.taticasDeEmboscada;
  const sem = cena({ afastamento: 1.5, especies });
  emboscou = false;
  rodar(sem.m, 80, () => { emboscou ||= sem.pred.estado === 'emboscado' || sem.pred.estado === 'indo_emboscada'; return false; });
  assert.equal(emboscou, false, 'usou a tática sem tê-la na ficha');
});

test('presa: quem tem memória de perigo deixa de escolher destinos perto de onde foi atacada', () => {
  const m = mundoTeste(cenarioTeste('v7-perigo', [{ especie: 'folhisco', individuos: [{ id: 'f', x: 80, y: 60, fome: 5, sede: 5 }] }], { largura: 160, profundidade: 120, amplitude: 0, capim: 0 }, { duracaoSeg: 400 }), 1);
  const f = m.porId.get('f');
  const cfg = f.especie.memoriaDePerigo;
  f.memoria.perigos = [{ x: 80, y: 60, t: 0 }];
  let destinos = 0, perto = 0;
  rodar(m, 300, () => {
    const d = f.mente.vagar?.p;
    if (d && f.estado === 'vagando' && (d.x !== f.x || d.y !== f.y)) { destinos++; if (Math.hypot(d.x - 80, d.y - 60) < cfg.raioM) perto++; }
    return false;
  });
  assert.ok(destinos > 50, `poucos destinos observados (${destinos})`);
  assert.equal(perto, 0, `${perto} destinos dentro de ${cfg.raioM} m da área de ataque`);
});
