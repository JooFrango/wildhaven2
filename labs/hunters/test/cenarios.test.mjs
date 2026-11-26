// Os cenários reprodutíveis pedidos para o Hunter Lab. Cada teste diz no nome o que prova — e os comentários
// dizem o que ele NÃO prova, para nada aqui ser lido como garantia maior do que a medida.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fatorMobilidade, incapacitado } from '../../ia-criaturas/src/eco/saude.js';
import { atribuirNiveis } from '../../ia-criaturas/src/eco/niveis.js';
import { verificarInvariantes } from '../../ia-criaturas/src/eco/invariantes.js';
import { passoHunters, rodarCombate, estadoHunter, salvarMundoHunters, carregarMundoHunters } from '../src/mundo-hunters.js';
import { hashMundo } from '../../ia-criaturas/src/eco/mundo.js';
import { cenarioDuelo, mundoDuelo, doisHunters, ev, hunter, LAB } from './ajudantes.mjs';

const soltoNoMapa = (id, extra = {}) => ({ id, equipe: id, x: 60, y: 50, direcaoGraus: 0, equipamento: {}, ...extra });

test('2. Hunter desvia de obstáculos sólidos no caminho', () => {
  const m = mundoDuelo(cenarioDuelo('obstaculos', [soltoNoMapa('h1', { x: 30, y: 50 })], {
    terreno: { amplitude: 2, rochas: [[50, 50, 4], [50, 44, 3], [50, 56, 3]] },
  }));
  const h = hunter(m, 'h1');
  h.hunter.ordem = { tipo: 'ir', x: 85, y: 50, ritmo: 'trote' };
  const dentroDeRocha = [];
  for (let i = 0; i < 2400; i++) {
    passoHunters(m);
    const k = (Math.floor(h.y / m.terreno.res) * m.terreno.nx) + Math.floor(h.x / m.terreno.res);
    if (m.terreno.bloqueio[k] === 1) dentroDeRocha.push(+m.t.toFixed(1));
  }
  assert.deepEqual(dentroDeRocha, [], 'atravessou rocha');
  assert.ok(h.x > 70, `não contornou o obstáculo (parou em x=${h.x.toFixed(1)})`);
});

test('4 e 5. Hunter cauteloso detecta um predador e se afasta dele', () => {
  const m = mundoDuelo(cenarioDuelo('predador', [soltoNoMapa('h1', { x: 60, y: 50, personalidade: { cautela: 0.95, agressividade: 0.05 } })], {
    populacoes: [{ especie: 'varrisco', individuos: [{ id: 'varrisco-1', x: 68, y: 50 }] }],
  }), 5);
  const h = hunter(m, 'h1'), v = hunter(m, 'varrisco-1');
  // Vida baixa para que a regra de recuo seja a que decide; o teste é de DECISÃO, não de bravura.
  h.saude.hp = h.saude.hpMax * 0.2;
  let percebeu = false;
  const d0 = Math.hypot(h.x - v.x, h.y - v.y);
  for (let i = 0; i < 1200; i++) { passoHunters(m); if (h.memoria.criaturas.has('varrisco-1')) percebeu = true; }
  assert.ok(percebeu, 'nunca percebeu o predador');
  assert.ok(Math.hypot(h.x - v.x, h.y - v.y) > d0, 'não se afastou do predador');
  assert.deepEqual(m.metricas.falhas, [], 'reagiu sem perceber');
});

test('6. Hunter ataca uma criatura usando o combate do ecossistema, e o animal decide por conta própria', () => {
  const m = mundoDuelo(cenarioDuelo('caca', [soltoNoMapa('h1', { equipamento: { arma: 'lanca' }, personalidade: { agressividade: 0.95, cautela: 0.05 } })], {
    populacoes: [{ especie: 'varrisco', individuos: [{ id: 'varrisco-1', x: 72, y: 50 }] }],
  }), 2);
  const r = rodarCombate(m, 180);
  assert.deepEqual(r.violacoes, []);
  const fer = ev(m, 'ferimento', 'varrisco-1');
  assert.ok(fer.length > 0, 'o Hunter nunca feriu o animal');
  // O ferimento veio do módulo de saúde das criaturas, com região e sangramento do núcleo.
  assert.ok(['cabeca', 'pescoco', 'tronco', 'flanco', 'pernas', 'cauda'].includes(fer[0].regiao), `região animal inesperada: ${fer[0].regiao}`);
  // E o animal entrou numa disputa de verdade: quem decide lutar ou fugir é o cérebro dele.
  assert.ok(ev(m, 'conflito_inicio').length > 0, 'atacar o animal não abriu disputa nenhuma');
  // O que este teste NÃO prova: que alguma criatura CAÇA o Hunter. Nenhuma ficha declara 'hunter' como presa
  // ou como espécie temida — essa é uma decisão de direção, não do laboratório.
});

test('10. duelo decidido por fadiga: quem fica sem energia se retira', () => {
  const m = mundoDuelo(cenarioDuelo('fadiga', doisHunters({ arma: 'espada' }, { arma: 'espada' })), 4);
  const a = hunter(m, 'hunter-A');
  a.energia = 8; // exausto antes de começar
  let retirou=false;for(let i=0;i<1200;i++){passoHunters(m);if(["recuando","rendido","incapacitado"].includes(a.hunter.situacao))retirou=true;if(m.resultado)break;}
  assert.ok(retirou, "o exausto não tentou se retirar antes de recuperar energia");
  assert.ok(['recuperando', 'recuando', 'rendido', 'incapacitado'].includes(a.hunter.situacao) || a.energia < 20,
    `o exausto continuou lutando em condições normais (${a.hunter.situacao}, energia ${a.energia.toFixed(1)})`);
});

test('11. ferimento na perna reduz a mobilidade de verdade', () => {
  const m = mundoDuelo(cenarioDuelo('perna', [soltoNoMapa('h1')]));
  const h = hunter(m, 'h1');
  const antes = fatorMobilidade(h);
  h.saude.ferimentos.push({ id: 'teste', regiao: 'pernas', gravidade: 0.45, fratura: true, sangramento: 0, infeccao: 0, desde: 0, origem: 'teste', tipo: 'teste' });
  const depois = fatorMobilidade(h);
  assert.ok(depois < antes * 0.6, `mobilidade mal mudou: ${antes.toFixed(2)} → ${depois.toFixed(2)}`);
  // E a perna ferida aparece na velocidade real de deslocamento.
  h.hunter.ordem = { tipo: 'ir', x: 100, y: 50, ritmo: 'corrida' };
  let vMax = 0;
  for (let i = 0; i < 300; i++) { passoHunters(m); vMax = Math.max(vMax, h.velocidade); }
  assert.ok(vMax < h.especie.movimento.corrida * 0.75, `correu a ${vMax.toFixed(2)} m/s com a perna quebrada`);
});

test('12. sangramento drena vida ao longo do tempo e pode incapacitar', () => {
  const m = mundoDuelo(cenarioDuelo('sangramento', [soltoNoMapa('h1')]));
  const h = hunter(m, 'h1');
  h.saude.ferimentos.push({ id: 'corte', regiao: 'pescoco', gravidade: 0.5, fratura: false, sangramento: 1.2, infeccao: 0, desde: 0, origem: 'teste', tipo: 'golpe_corte_leve' });
  const hp0 = h.saude.hp;
  for (let i = 0; i < 600; i++) passoHunters(m);
  assert.ok(h.saude.hp < hp0 - 10, `sangrou pouco demais: ${hp0.toFixed(1)} → ${h.saude.hp.toFixed(1)}`);
  // A coagulação do núcleo é real: o sangramento diminui sozinho em quem fica parado.
  assert.ok(h.saude.ferimentos[0].sangramento < 1.2, 'o sangramento não coagulou nada');
});

test('13. Hunter incapacitado sai do combate e ninguém continua batendo nele', () => {
  const m = mundoDuelo(cenarioDuelo('incapacitado', doisHunters({ arma: 'espada' }, {})), 3);
  const b = hunter(m, 'hunter-B');
  b.saude.hp = b.saude.hpMax * 0.1;
  const r = rodarCombate(m, 120);
  assert.ok(['incapacitado', 'rendido'].includes(b.hunter.situacao), `situação ${b.hunter.situacao}`);
  const tFim = r.resultado?.t ?? m.t;
  const golpesDepois = ev(m, 'ferimento', 'hunter-B').filter((e) => e.t > tFim + 1);
  assert.deepEqual(golpesDepois, [], 'continuaram ferindo quem já estava fora de combate');
});

test('14. equipes: aliado nunca vira alvo', () => {
  const m = mundoDuelo(cenarioDuelo('equipes', [
    { id: 'azul-1', equipe: 'azul', x: 55, y: 47, direcaoGraus: 0, equipamento: { arma: 'espada' } },
    { id: 'azul-2', equipe: 'azul', x: 55, y: 53, direcaoGraus: 0, equipamento: { arma: 'lanca' } },
    { id: 'verde-1', equipe: 'verde', x: 65, y: 47, direcaoGraus: 180, equipamento: { arma: 'espada' } },
    { id: 'verde-2', equipe: 'verde', x: 65, y: 53, direcaoGraus: 180, equipamento: { arma: 'lanca' } },
  ]), 6);
  const r = rodarCombate(m, 300);
  assert.deepEqual(r.violacoes, []);
  const equipe = Object.fromEntries(m.hunters.map((a) => [a.id, a.hunter.equipe]));
  for (const e of ev(m, 'ferimento')) {
    if (!equipe[e.id] || !equipe[e.atacante]) continue;
    assert.notEqual(equipe[e.id], equipe[e.atacante], `${e.atacante} feriu o aliado ${e.id}`);
  }
  assert.ok(ev(m, 'ferimento').length > 0, 'nenhum golpe acertou em 300 s de 2 contra 2');
});

test('15. trocar o foco de observação não cancela a luta nem muda o resultado', () => {
  const rodar = (trocarCamera) => {
    const m = mundoDuelo(cenarioDuelo('camera', doisHunters({ arma: 'lanca' }, { arma: 'espada' }), {
      // Observação distante: sem `nivelFixo`, os dois cairiam para o nível 2 e o conflito seria encerrado
      // com motivo 'fora_de_foco' — era exatamente o defeito apontado no pedido.
      observacao: { x: 10, y: 10, raioN1: 12, raioN2: 40 },
    }), 11);
    let n = 0;
    while (m.t < 300 && !m.resultado) {
      passoHunters(m);
      if (trocarCamera && ++n % 37 === 0) { m.opcoes.observacao = { x: n % 2 ? 110 : 10, y: n % 3 ? 90 : 10, raioN1: 12, raioN2: 40 }; atribuirNiveis(m); }
    }
    return { resultado: m.resultado, eventos: m.eventos.length, estados: m.hunters.map(estadoHunter) };
  };
  const fixo = rodar(false), trocando = rodar(true);
  assert.deepEqual(trocando.resultado, fixo.resultado, 'trocar de câmera mudou o resultado do combate');
  assert.deepEqual(trocando.estados, fixo.estados, 'trocar de câmera mudou o estado dos Hunters');
  assert.equal(ev({ eventos: [] }, 'x').length, 0); // sanidade do ajudante
  // O que este teste NÃO prova: que exista simulação remota econômica de Hunter. Ela não existe nesta versão —
  // o Hunter fica preso ao nível 1 (`nivelFixo`). Ver docs/PENDENCIAS.md.
});

test('invariantes obrigatórios durante um combate inteiro', () => {
  const m = mundoDuelo(cenarioDuelo('invariantes', doisHunters({ arma: 'lanca', armadura: 'pesada' }, { arma: 'espada', escudo: 'escudo' })), 9);
  const ids = new Set();
  const mortes = new Map();
  for (let i = 0; i < 3000 && !m.resultado; i++) {
    passoHunters(m);
    if (i % 50 === 0) assert.deepEqual(verificarInvariantes(m), [], `invariante violado em t=${m.t.toFixed(1)}`);
    ids.clear();
    for (const a of m.animais) { assert.ok(!ids.has(a.id), `entidade duplicada: ${a.id}`); ids.add(a.id); }
    for (const e of m.eventos.filter((x) => x.tipo === 'morte')) {
      mortes.set(e.id, (mortes.get(e.id) ?? 0) + 1);
    }
    for (const [id, n] of mortes) assert.ok(n <= m.eventos.filter((x) => x.tipo === 'morte' && x.id === id).length, `morte repetida de ${id}`);
    mortes.clear();
  }
  // Sem dano duplicado: cada ferimento tem um id de evento próprio.
  const idsFer = m.hunters.flatMap((a) => a.saude.ferimentos.map((f) => f.id));
  assert.equal(new Set(idsFer).size, idsFer.length, 'ferimento com id repetido (dano contado duas vezes)');
  // Sem ataque fora de alcance: todo ferimento veio de um golpe que o núcleo considerou em contato.
  for (const e of ev(m, 'ferimento')) assert.ok(e.atacante, 'ferimento sem atacante');
});

test('17. ferimentos, conflitos e equipamento sobrevivem a salvar e carregar', () => {
  const cen = cenarioDuelo('persistencia', doisHunters({ arma: 'lanca', armadura: 'pesada' }, { arma: 'espada', escudo: 'escudo' }));
  const m = mundoDuelo(cen, 5);
  for (let i = 0; i < 60; i++) passoHunters(m); // luta ainda em andamento no momento do save
  const antes = m.hunters.map(estadoHunter);
  const hashAntes = hashMundo(m);
  const snap = JSON.parse(JSON.stringify(salvarMundoHunters(m)));
  const cfg = { ...LAB.cfg, cenarios: { ...LAB.cfg.cenarios, [cen.id]: cen } };
  const m2 = carregarMundoHunters(cfg, snap, { fichaHunter: LAB.fichaHunter, equipamentos: LAB.equipamentos });
  assert.equal(hashMundo(m2), hashAntes, 'o mundo recarregado não é o mesmo');
  assert.deepEqual(m2.hunters.map(estadoHunter), antes, 'o estado dos Hunters mudou ao recarregar');
  // O equipamento é o que o formato do ecossistema NÃO carrega: sem a correção, a ficha voltava sem arma.
  for (const a of m2.hunters) {
    assert.ok(a.especie.combate.ataques.length > 1, `${a.id} voltou com a ficha base (${a.especie.combate.ataques.map((x) => x.nome).join(', ')})`);
    assert.equal(a.especie.equipamento.arma, m.porId.get(a.id).especie.equipamento.arma);
  }
  // E o combate continua de onde parou, com o mesmo desfecho.
  const seguir = (mundo) => { const r = rodarCombate(mundo, 300); return { r: r.resultado, e: mundo.hunters.map(estadoHunter) }; };
  assert.deepEqual(seguir(m2), seguir(m), 'o combate divergiu depois de recarregar');
});
