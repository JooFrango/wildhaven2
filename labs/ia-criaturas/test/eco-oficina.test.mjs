import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { descobrirCatalogo } from '../scripts/catalogo-criaturas.mjs';
import { criarExperimento, criarFichaExperimental, mapearClipes } from '../src/eco/oficina.js';
import { validarEspecies } from '../src/eco/especies.js';
import { criarMundoEco, passoEco } from '../src/eco/mundo.js';

const ler = async (p) => JSON.parse(await readFile(new URL('../' + p, import.meta.url), 'utf8'));
test('catálogo detecta GLBs reais sem depender do índice de cinco espécies', async () => {
  const raiz = await mkdtemp(join(tmpdir(), 'wildhaven-catalogo-'));
  try {
    const glb = 'assets/models/creatures/teste/v02/teste-v02.glb';
    await mkdir(join(raiz, dirname(glb)), { recursive: true });
    await mkdir(join(raiz, 'creatures/species'), { recursive: true });
    await writeFile(join(raiz, glb), Buffer.from('glb'));
    await writeFile(join(raiz, 'creatures/species/teste.json'), JSON.stringify({
      id: 'teste', name: 'Criatura de Teste', status: 'approved',
      assets: { model: glb, animations: ['idle', 'walk'] }, body: { massMinKg: 10, massMaxKg: 30 }
    }));
    const c = await descobrirCatalogo(raiz);
    assert.equal(c.length, 1);
    assert.equal(c[0].nome, 'Criatura de Teste');
    assert.equal(c[0].massaSugerida, 20);
    assert.deepEqual(c[0].animacoesDeclaradas, ['idle', 'walk']);
    assert.match(c[0].id, /^cat_[a-f0-9]{14}$/);
  } finally { await rm(raiz, { recursive: true, force: true }); }
});

test('oficina mapeia apenas clipes que existem, inclusive nado na areia', () => {
  const mapa = mapearClipes(['idle', 'swim_sand', 'swim_fast', 'dive', 'death']);
  assert.equal(mapa.andar, 'swim_sand');
  assert.equal(mapa.corrida, 'swim_fast');
  assert.equal(mapa.morte, 'death');
  assert.equal(mapa.mordida, undefined);
});

test('adaptação experimental não altera fichas oficiais e aceita necessidades', async () => {
  const [v, c] = await Promise.all([ler('config/eco/especies/velsari.json'), ler('config/eco/especies/varrisco.json')]);
  const modelo = { id: 'cat_teste', glb: 'assets/models/creatures/teste/v02/teste.glb', nome: 'Teste', animacoesDeclaradas: ['idle', 'walk', 'run'] };
  const ficha = criarFichaExperimental(modelo, { id: modelo.id, glb: modelo.glb, papel: 'carnivoro', massa: 42, velocidade: 7, fome: 60, sede: 50, vida: 250, alcance: 90, presas: ['velsari'] }, v, c);
  assert.equal(ficha.modelo.glb, modelo.glb);
  assert.equal(ficha.necessidades.fomePorDia, 60);
  assert.equal(ficha.saude.max, 250);
  assert.equal(ficha.dieta.presas[0], 'velsari');
  assert.notEqual(v.saude.max, 250);
  assert.equal(c.modelo.glb.includes('teste'), false);
});

test('encontro misto cria animais novos e preserva cenário original', async () => {
  const indice = await ler('config/eco/indice.json');
  const fichas = await Promise.all(indice.especies.map((f) => ler('config/eco/especies/' + f)));
  const config = { especies: Object.fromEntries(fichas.map((x) => [x.id, x])), doencas: [] };
  const cenario = await ler('config/eco/cenarios/bebedouro.json');
  const antiga = cenario.populacoes.length;
  const modelo = { id: 'cat_fake1', glb: 'assets/models/creatures/teste/v02/teste.glb', nome: 'Predador experimental', animacoesDeclaradas: ['idle', 'run'] };
  const escolha = [{ id: modelo.id, glb: modelo.glb, nome: modelo.nome, papel: 'carnivoro', quantidade: 2, presas: ['velsari'], massa: 50, velocidade: 6 }];
  const e = criarExperimento(config, cenario, escolha, [modelo]);
  assert.deepEqual(validarEspecies(Object.values(e.config.especies)), []);
  assert.equal(cenario.populacoes.length, antiga);
  assert.equal(config.especies.velsari.teme.includes(modelo.id), false);
  assert.equal(e.cenario.populacoes.length, antiga + 1);
  assert.equal(e.config.especies.velsari.teme.includes(modelo.id), true);
  const mundo = criarMundoEco(e.config, e.cenario, 13);
  assert.equal(mundo.vivos.filter((x) => x.especie.id === modelo.id).length, 2);
  for (let i = 0; i < 5; i++) passoEco(mundo);
  assert.ok(mundo.t > 0);
});
