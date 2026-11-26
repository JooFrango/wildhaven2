import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { carregarConfig } from '../src/core/carregar.js';
import { validarConfig } from '../src/core/config.js';
import { rodarEncontro } from '../src/core/simulacao.js';
import { RAIZ_LAB, carregarConfigNode } from '../src/node/carregar-node.js';

const config = await carregarConfigNode();

test('mesma semente => mesma trilha de decisões', () => {
  for (const id of config.ordemCenarios) {
    for (const s of [1, 7, 23]) {
      const a = rodarEncontro(config, id, s), b = rodarEncontro(config, id, s);
      assert.equal(a.resumo.hash, b.resumo.hash);
      assert.deepEqual(a.mundo.decisoes, b.mundo.decisoes);
    }
  }
});

test('sementes diferentes produzem encontros diferentes', () => {
  const hashes = new Set([1, 2, 3, 4, 5].map((s) => rodarEncontro(config, 'campo-aberto', s).resumo.hash));
  assert.ok(hashes.size >= 4);
});

test('30 sementes por cenário sem falhas de invariante', () => {
  for (const id of config.ordemCenarios) {
    for (let s = 1; s <= 30; s++) {
      const { resumo, mundo } = rodarEncontro(config, id, s);
      assert.deepEqual(resumo.falhas, [], `${id} semente ${s}`);
      const alcance = config.especies['predador-exemplo'].ataque.alcance;
      for (const e of mundo.eventos.filter((x) => x.tipo === 'ataque')) assert.ok(e.distancia <= alcance + 1e-9);
    }
  }
});

test('interpretarSementes aceita faixas e listas', async () => {
  const { interpretarSementes } = await import('../src/core/simulacao.js');
  assert.deepEqual(interpretarSementes('5'), [5]);
  assert.deepEqual(interpretarSementes('1-3,9'), [1, 2, 3, 9]);
});

test('validação aponta configuração inválida', () => {
  const erros = validarConfig({
    especies: [{ id: 'x', comportamento: 'inexistente', relacoes: { presas: ['fantasma'] } }],
    cenarios: [{ id: 'c', terreno: { largura: 10, altura: 10 }, criaturas: [{ id: 'a', especie: 'y', x: 1, y: 1 }] }],
  });
  assert.ok(erros.some((e) => e.includes('comportamento')));
  assert.ok(erros.some((e) => e.includes('fantasma')));
  assert.ok(erros.some((e) => e.includes('espécie inexistente "y"')));
});

// Paridade com a página: carrega as configs por HTTP do servidor do laboratório (como o navegador faz)
// e confere que o hash da trilha é idêntico ao do modo sem interface.
let servidor, porta;
before(async () => {
  porta = 5300 + Math.floor(Math.random() * 500);
  servidor = spawn(process.execPath, [join(RAIZ_LAB, 'scripts', 'servidor.mjs'), '--porta', String(porta)], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok, erro) => {
    servidor.stdout.on('data', (d) => String(d).includes('http://') && ok());
    servidor.on('exit', (c) => erro(new Error(`servidor saiu (${c})`)));
  });
});
after(() => servidor?.kill());

test('configs servidas por HTTP (modo página) == configs lidas do disco (modo CLI)', async () => {
  const lerHttp = async (rel) => (await fetch(`http://127.0.0.1:${porta}/${rel}`)).json();
  const web = await carregarConfig(lerHttp);
  assert.deepEqual(web, config);
  for (const id of config.ordemCenarios) {
    for (const s of [1, 2, 3]) assert.equal(rodarEncontro(web, id, s).resumo.hash, rodarEncontro(config, id, s).resumo.hash);
  }
  const pagina = await (await fetch(`http://127.0.0.1:${porta}/`)).text();
  assert.match(pagina, /src\/web\/app\.js/);
});
