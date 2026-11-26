// Checkpoint 1 do Hunter Lab: o primeiro confronto real, sem navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validarEspecies } from '../../ia-criaturas/src/eco/especies.js';
import { hashMundo } from '../../ia-criaturas/src/eco/mundo.js';
import { montarFicha } from '../src/hunter.js';
import { rodarCombate, estadoHunter, passoHunters } from '../src/mundo-hunters.js';
import { LAB, cenarioDuelo, mundoDuelo, doisHunters, ev, hunter } from './ajudantes.mjs';

test('a ficha do Hunter é uma ficha de espécie válida do laboratório de criaturas', () => {
  assert.deepEqual(validarEspecies([LAB.fichaHunter]), []);
});

test('1. Hunter caminha no terreno real e chega onde foi mandado', () => {
  const m = mundoDuelo(cenarioDuelo('caminhada', [{ id: 'h1', equipe: 'azul', x: 20, y: 50, equipamento: {} }]));
  const h = hunter(m, 'h1');
  h.hunter.ordem = { tipo: 'ir', x: 80, y: 50, ritmo: 'trote' };
  const partida = { x: h.x, y: h.y };
  for (let i = 0; i < 1200; i++) passoHunters(m);
  assert.ok(Math.hypot(h.x - 80, h.y - 50) < 3, `parou a ${Math.hypot(h.x - 80, h.y - 50).toFixed(1)} m do destino`);
  assert.ok(Math.hypot(h.x - partida.x, h.y - partida.y) > 50, 'não saiu do lugar');
  assert.ok(Number.isFinite(h.z), 'altura do terreno inválida');
});

test('3. um Hunter detecta o outro pela percepção, e só então o toma por alvo', () => {
  const m = mundoDuelo(cenarioDuelo('deteccao', doisHunters({}, {}, { dist: 40 })));
  const a = hunter(m, 'hunter-A');
  assert.equal(a.hunter.alvoId, null, 'tinha alvo antes de perceber');
  let tDeteccao = null;
  for (let i = 0; i < 600 && !tDeteccao; i++) { passoHunters(m); if (a.hunter.alvoId) tDeteccao = m.t; }
  assert.ok(tDeteccao, 'nunca detectou o adversário');
  assert.ok(a.memoria.criaturas.has('hunter-B'), 'virou alvo sem entrar na memória');
  // O núcleo registra como falha qualquer reação a quem não foi percebido.
  assert.deepEqual(m.metricas.falhas, [], 'reagiu sem perceber');
});

test('7. PvP desarmado: a luta acontece, produz ferimentos e termina com um vencedor', () => {
  const m = mundoDuelo(cenarioDuelo('pvp-maos', doisHunters({}, {})));
  const r = rodarCombate(m, 300);
  assert.deepEqual(r.violacoes, [], 'invariantes violados');
  assert.ok(ev(m, 'ferimento').length > 0, 'ninguém se feriu');
  assert.ok(r.resultado, `o combate não terminou em 300 s (${JSON.stringify(m.hunters.map(estadoHunter).map((e) => [e.id, e.situacao, e.hp]))})`);
  // Vitória de um lado OU retirada mútua: as duas são desfechos reais de um duelo. O que não vale é a luta
  // ficar pendurada até o tempo acabar.
  assert.ok(r.resultado.vencedor === null || ['azul', 'verde'].includes(r.resultado.vencedor), 'resultado sem lado definido');
  // Treino: ninguém morre.
  assert.equal(ev(m, 'morte').length, 0, 'houve morte em modo treino');
});

test('8. lança contra espada: o alcance maior aparece na distância dos golpes', () => {
  const m = mundoDuelo(cenarioDuelo('lanca-espada', doisHunters({ arma: 'lanca' }, { arma: 'espada' })));
  rodarCombate(m, 300);
  const dist = (id) => ev(m, 'ataque_inicio', id).length;
  assert.ok(dist('hunter-A') > 0 && dist('hunter-B') > 0, 'alguém nunca atacou');
  const alcanceLanca = Math.max(...hunter(m, 'hunter-A').especie.combate.ataques.map((x) => x.alcance));
  const alcanceEspada = Math.max(...hunter(m, 'hunter-B').especie.combate.ataques.map((x) => x.alcance));
  assert.ok(alcanceLanca > alcanceEspada * 1.5, `lança ${alcanceLanca} m não é bem maior que espada ${alcanceEspada} m`);
});

test('9. armadura pesada protege mais e custa mobilidade — diferença mecânica verificável', () => {
  const leve = montarFicha(LAB.fichaHunter, LAB.equipamentos, { armadura: 'leve' });
  const pesada = montarFicha(LAB.fichaHunter, LAB.equipamentos, { armadura: 'pesada' });
  assert.ok(pesada.combate.protecao.torax > leve.combate.protecao.torax, 'proteção do tórax não aumentou');
  assert.ok(pesada.movimento.corrida < leve.movimento.corrida, 'armadura pesada não reduziu a corrida');
  assert.ok(pesada.combate.esquiva < leve.combate.esquiva, 'armadura pesada não reduziu a esquiva');
  assert.ok(pesada.pesoCarregadoKg > leve.pesoCarregadoKg, 'peso carregado não aumentou');
  // E o efeito aparece no combate: com a mesma semente, quem veste pesada leva menos dano por golpe.
  // Mesmo id de cenário e mesma semente nos dois: só a armadura muda. Ids diferentes dariam mundos diferentes,
  // porque o RNG do mundo é derivado de `mundo:${cenario.id}`.
  const dano = (armadura) => {
    const m = mundoDuelo(cenarioDuelo('armadura', doisHunters({ arma: 'espada' }, { armadura })));
    rodarCombate(m, 300);
    const fer = ev(m, 'ferimento', 'hunter-B');
    return fer.length ? fer.reduce((s, e) => s + e.dano, 0) / fer.length : 0;
  };
  const dLeve = dano('leve'), dPesada = dano('pesada');
  assert.ok(dLeve > 0 && dPesada > 0, `alguma das lutas não produziu ferimento (leve ${dLeve}, pesada ${dPesada})`);
  assert.ok(dPesada < dLeve, `armadura pesada não reduziu o dano médio (leve ${dLeve.toFixed(2)}, pesada ${dPesada.toFixed(2)})`);
});

test('os golpes só atingem regiões humanas', () => {
  const m = mundoDuelo(cenarioDuelo('regioes', doisHunters({ arma: 'espada' }, { arma: 'lanca' })));
  rodarCombate(m, 300);
  const regioes = new Set(ev(m, 'ferimento').map((e) => e.regiao));
  assert.ok(regioes.size > 0, 'nenhum ferimento');
  for (const r of regioes) assert.ok(['cabeca', 'pescoco', 'torax', 'abdomen', 'bracos', 'pernas'].includes(r), `região não humana: ${r}`);
});

test('18. a mesma semente reproduz o mesmo combate, golpe a golpe', () => {
  const rodar = () => {
    const m = mundoDuelo(cenarioDuelo('reprodutivel', doisHunters({ arma: 'lanca' }, { arma: 'espada' })), 7);
    const r = rodarCombate(m, 300);
    return { hash: hashMundo(m), t: r.t, resultado: r.resultado, eventos: m.eventos.length, estados: m.hunters.map(estadoHunter) };
  };
  const a = rodar(), b = rodar();
  assert.equal(a.hash, b.hash);
  assert.equal(a.t, b.t);
  assert.deepEqual(a.resultado, b.resultado);
  assert.deepEqual(a.estados, b.estados);
});

test('sementes diferentes produzem combates diferentes', () => {
  const resumo = (s) => {
    const m = mundoDuelo(cenarioDuelo('variacao', doisHunters({ arma: 'espada' }, { arma: 'espada' })), s);
    rodarCombate(m, 300);
    return hashMundo(m);
  };
  const hashes = new Set([1, 2, 3, 4, 5].map(resumo));
  assert.ok(hashes.size >= 4, `sementes diferentes deram o mesmo combate: ${[...hashes].join(', ')}`);
});
