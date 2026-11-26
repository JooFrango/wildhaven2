// Dano através da areia: o teste resolve o golpe de verdade e confere HP, não só o evento.
// Mesma bancada em várias posições e profundidades, e o controle positivo (mesmo meio → dano sai).
import test from 'node:test';
import assert from 'node:assert/strict';
import { cenarioTeste, mundoTeste } from './eco-ajudantes.mjs';
import { iniciarAtaque, resolverGolpe } from '../src/eco/combate.js';
import { separadosNaVertical } from '../src/eco/subsolo.js';

const terreno = { largura: 300, profundidade: 200, res: 1, amplitude: 4, capim: 20, areia: true };

// Dois corpos lado a lado; `profAtacante`/`profAlvo` põem cada um no seu meio.
function bancada(x, y, profAtacante, profAlvo, semente = 11) {
  const m = mundoTeste(cenarioTeste('areia-combate', [
    { especie: 'serracorion', individuos: [{ id: 'pred', x, y, direcaoGraus: 0 }] },
    { especie: 'arraia-de-areia', individuos: [{ id: 'presa', x: x + 2, y, direcaoGraus: 0 }] },
  ], terreno), semente);
  const pred = m.porId.get('pred'), presa = m.porId.get('presa');
  // Posiciona à mão: a bancada testa a regra do golpe, não a navegação até o alvo.
  pred.x = x; pred.y = y; presa.x = x + 2; presa.y = y;
  pred.subsolo.fase = profAtacante > 0 ? 'submerso' : 'superficie';
  presa.subsolo.fase = profAlvo > 0 ? 'submerso' : 'superficie';
  pred.subsolo.prof = profAtacante; presa.subsolo.prof = profAlvo;
  pred.tAtual = m.t; presa.tAtual = m.t;
  return { m, pred, presa };
}

// Executa o golpe até o instante de impacto e devolve quanto de HP saiu.
function golpear(m, pred, presa) {
  const ataque = pred.especie.combate.ataques.find((x) => x.nome === 'pinca');
  const hp0 = presa.saude.hp;
  const eventos0 = m.eventos.length;
  iniciarAtaque(pred, presa, ataque, m);
  m.t = pred.golpe.impacto;
  resolverGolpe(pred, m);
  const novos = m.eventos.slice(eventos0);
  // Os dados do evento são espalhados no próprio objeto (ver mundo.evento).
  return { dano: +(hp0 - presa.saude.hp).toFixed(3), eventos: novos.map((e) => `${e.tipo}:${e.motivo ?? ''}`) };
}

test('combate: areia sólida entre os corpos impede o dano, em várias posições e profundidades', () => {
  const casos = [
    { x: 100, y: 100, pred: 0, alvo: 6 },    // predador em cima, presa funda
    { x: 150, y: 80, pred: 7, alvo: 0 },     // predador enterrado, presa na superfície
    { x: 200, y: 120, pred: 1.2, alvo: 9 },  // os dois enterrados, longe na vertical
    { x: 60, y: 60, pred: 10, alvo: 0.2 },   // extremos
  ];
  for (const c of casos) {
    const { m, pred, presa } = bancada(c.x, c.y, c.pred, c.alvo);
    assert.equal(separadosNaVertical(pred, presa), true, `caso ${JSON.stringify(c)} deveria estar separado`);
    const r = golpear(m, pred, presa);
    assert.equal(r.dano, 0, `caso ${JSON.stringify(c)}: saiu ${r.dano} de dano através da areia`);
    assert.equal(presa.saude.ferimentos.length, 0, 'nenhum ferimento registrado');
    assert.ok(r.eventos.some((e) => e === 'golpe_errou:areia_entre_os_corpos'), `evento de bloqueio ausente: ${r.eventos.join(', ')}`);
  }
});

test('combate: no mesmo meio o contato válido continua causando dano (controle positivo)', () => {
  // Mesma profundidade: nada separa os corpos. Sem esquiva (rng fixo), o golpe tem de sair.
  const casos = [{ pred: 0, alvo: 0 }, { pred: 2, alvo: 2 }, { pred: 1.5, alvo: 2.2 }];
  let comDano = 0;
  for (const c of casos) {
    const { m, pred, presa } = bancada(120, 100, c.pred, c.alvo);
    assert.equal(separadosNaVertical(pred, presa), false, `caso ${JSON.stringify(c)} não deveria estar separado`);
    const r = golpear(m, pred, presa);
    assert.ok(!r.eventos.some((e) => e === 'golpe_errou:areia_entre_os_corpos'), 'não pode ser bloqueado pela areia no mesmo meio');
    if (r.dano > 0) comDano++;
  }
  assert.ok(comDano > 0, 'em nenhum caso do mesmo meio o golpe causou dano — a regra está bloqueando demais');
});

// Continuidade vertical: o corpo nunca fica abaixo do leito rochoso do ponto onde está.
// Antes desta correção, o Arenoceto chegava a 4,86 m abaixo do leito ao entrar numa célula mais rasa.
test('física: o corpo nunca atravessa o leito rochoso durante a natação subterrânea', async () => {
  const { CFG } = await import('./eco-ajudantes.mjs');
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { RAIZ_LAB } = await import('../src/node/carregar-node.js');
  const { faixaProfundidade } = await import('../src/eco/areia.js');
  const { rodar } = await import('./eco-ajudantes.mjs');
  for (const id of ['dunas-f-travessia', 'dunas-e-ecossistema']) {
    const cen = CFG.cenarios[id];
    if (!cen.terreno.dados) cen.terreno.dados = JSON.parse(await readFile(join(RAIZ_LAB, cen.terreno.arquivo), 'utf8'));
    for (const s of [1, 2, 3]) {
      const m = mundoTeste(cen, s);
      rodar(m, 240, (mm) => {
        for (const a of mm.vivos) {
          if (a.subsolo?.fase !== 'submerso') continue;
          const f = faixaProfundidade(mm.terreno, a.x, a.y, a.subsolo.perfil.alturaCorpoM);
          assert.ok(f, `${a.id} (${id} s${s}) submerso onde não há areia navegável`);
          assert.ok(a.subsolo.prof <= f.max + 1e-6, `${a.id} (${id} s${s}) ${(a.subsolo.prof - f.max).toFixed(2)} m abaixo do leito`);
        }
        return false;
      });
    }
  }
});

test('combate: a regra vale nos dois sentidos (presa enterrada não fere quem está em cima)', () => {
  const { m, pred, presa } = bancada(140, 90, 8, 0);
  const ataque = presa.especie.combate.ataques[0];
  const hp0 = pred.saude.hp;
  iniciarAtaque(presa, pred, ataque, m);
  m.t = presa.golpe.impacto;
  resolverGolpe(presa, m);
  assert.equal(+(hp0 - pred.saude.hp).toFixed(3), 0, 'a presa enterrada feriu quem estava na superfície');
});
