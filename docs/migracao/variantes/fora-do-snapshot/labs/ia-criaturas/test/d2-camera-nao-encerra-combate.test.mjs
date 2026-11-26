// D2: a câmera (nível de detalhe por distância ao foco de observação) não pode encerrar um conflito ativo.
// Nota: com `tatica` (padrão true em criarMundoEco), atribuirNiveis já prendia os combatentes em nível 1 —
// o bug só é alcançável com `tatica:false`, modo que nenhum chamador real deste repositório usa hoje.
// O fix generaliza a proteção para qualquer modo, sem depender de tática ligada.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { atribuirNiveis } from '../src/eco/niveis.js';
import { abrirConflito } from '../src/eco/combate.js';
import { criarMundoEco } from '../src/eco/mundo.js';
import { CFG, cenarioTeste } from './eco-ajudantes.mjs';

const varrisco = (id, x, y) => ({ especie: 'varrisco', individuos: [{ id, x, y, sexo: 'M', fome: 10, energia: 100 }] });

function mundoComConflito(tatica) {
  const cen = cenarioTeste('d2', [varrisco('a', 50, 50), varrisco('b', 51, 50)], { amplitude: 0 }, { observacao: { x: 500, y: 500, raioN1: 5, raioN2: 15 } });
  const cfg = { ...CFG, cenarios: { ...CFG.cenarios, [cen.id]: cen } };
  const m = criarMundoEco(cfg, cen, 1, { tatica });
  const a = m.porId.get('a'), b = m.porId.get('b');
  abrirConflito(m, a, b, 'territorio', null);
  return { m, a, b };
}

test('D2: com tática ligada (padrão), câmera longe não encerra o conflito', () => {
  const { m, a, b } = mundoComConflito(true);
  atribuirNiveis(m);
  assert.equal(a.nivel, 1, 'combatente fica em nível 1 mesmo com a câmera longe');
  assert.ok(a.conflito && !m.conflitos.find((c) => c.id === a.conflito.id).resultado, 'conflito continua ativo');
});

test('D2: com tática desligada, câmera longe NÃO encerra o conflito (fix aplicado ao caso geral)', () => {
  const { m, a, b } = mundoComConflito(false);
  atribuirNiveis(m);
  assert.equal(a.nivel, 1, 'combatente permanece em nível 1 sem depender de tática');
  const c = m.conflitos.find((c) => c.id === a.conflito?.id);
  assert.ok(c && !c.resultado, 'conflito não foi encerrado por fora_de_foco');
});

test('D2: conflito já resolvido (sem combatente mais lutando) pode ser rebaixado de nível normalmente', () => {
  const { m, a, b } = mundoComConflito(false);
  const c = m.conflitos.find((x) => x.id === a.conflito.id);
  c.resultado = { perdedor: b.id, vencedor: a.id, motivo: 'vitoria', faseFinal: 'confronto', duracao: 1, golpes: 3, t: m.t };
  a.conflito = null; b.conflito = null;
  atribuirNiveis(m);
  assert.equal(a.nivel, 3, 'sem conflito ativo, a distância da câmera volta a decidir o nível');
});
