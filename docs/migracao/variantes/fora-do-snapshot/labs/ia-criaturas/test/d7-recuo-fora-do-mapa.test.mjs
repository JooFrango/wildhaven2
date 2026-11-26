// D7: ao ceder uma disputa perto da borda do mapa, encerrar() não pode mandar a criatura recuar para um
// ponto fora da grade — reproduzido de verdade no Hunter Lab (hunter_combat_v05, cenário jogador-espada,
// semente 1): um Varrisco ficava ~40s parado tentando fugir para (x=-8.55,y=60.94) num mapa 100×100
// (fora do intervalo [0,100]), porque afastar() soma uma distância fixa na direção oposta ao rival sem
// olhar a borda do terreno — e esse destino de recuo (diferente de contagio_fuga, que se recalcula a cada
// quadro) fica fixo por até 6 s (recuarDe.ate), então a criatura nunca tenta de novo.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mover } from '../src/eco/locomocao.js';
import { abrirConflito, encerrar } from '../src/eco/combate.js';
import { cenarioTeste, mundoTeste } from './eco-ajudantes.mjs';

const varrisco = (id, x, y) => ({ especie: 'varrisco', individuos: [{ id, x, y, sexo: 'M', fome: 10, energia: 100, direcaoGraus: 0 }] });

test('D7: ceder uma disputa perto da borda do mapa não trava a criatura tentando fugir para fora da grade', () => {
  const m = mundoTeste(cenarioTeste('d7-borda', [varrisco('perdedor', 5, 50), varrisco('vencedor', 20, 50)], { largura: 100, profundidade: 100, amplitude: 0 }), 1);
  const perdedor = m.porId.get('perdedor'), vencedor = m.porId.get('vencedor');
  const c = abrirConflito(m, perdedor, vencedor, 'territorio', null);
  const intent = encerrar(m, c, perdedor, 'cedeu');
  assert.equal(intent.codigo, 'recuo_cedeu');
  // Pré-condição: sem o clamp, afastar(perdedor, vencedor, 25) miraria x = 5 - 25*(15/15) = -20 (fora do mapa).
  assert.ok(intent.destino.x >= 1 && intent.destino.x <= 99, `destino deve ficar dentro do mapa (x=${intent.destino.x})`);

  let velocidadeMax = 0;
  for (let i = 0; i < 40; i++) { mover(perdedor, intent, m, 0.1); velocidadeMax = Math.max(velocidadeMax, perdedor.velocidade); }
  assert.ok(velocidadeMax > 1, `deve ter andado tentando recuar, não ficado parado (velocidade máx=${velocidadeMax.toFixed(2)})`);
  assert.ok(perdedor.x < 3, `deve ter avançado para perto da borda oeste, não ficado parado em x=5 (x final=${perdedor.x.toFixed(2)})`);
});
