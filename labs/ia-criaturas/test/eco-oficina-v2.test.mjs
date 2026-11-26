import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inferirModoLocomocao, normalizarCapacidades, validarSuporteLocomocao, separarMeiosFisicos } from '../src/eco/capacidades.js';
import { diagnosticarAnimacoes } from '../src/eco/diagnostico-animacoes.js';
import { criarPreset, validarPreset, converterPresets } from '../src/eco/presets.js';
import { descobrirCatalogo } from '../scripts/catalogo-criaturas.mjs';

const raizRepo = fileURLToPath(new URL('../../../', import.meta.url));
test('modos distinguem areia de água e nunca ativam física especial sem controlador', () => {
  assert.equal(inferirModoLocomocao(['idle', 'swim_sand', 'dive']), 'subterraneo_areia');
  const areia = normalizarCapacidades({ modo: 'subterraneo_areia', habilidades: ['detectar_vibracoes'] });
  assert.equal(areia.meio, 'areia_solida');
  assert.equal(separarMeiosFisicos(areia).agua, false);
  assert.equal(separarMeiosFisicos(areia).areia, true);
  assert.deepEqual(areia.habilidades, ['detectar_vibracoes', 'nadar_areia']);
  assert.throws(() => validarSuporteLocomocao(areia), /controlador físico/);
  const proxy = normalizarCapacidades({ modo: 'subterraneo_areia', permitirProxySuperficie: true });
  assert.equal(validarSuporteLocomocao(proxy), 'proxy_superficie');
  assert.equal(separarMeiosFisicos(proxy).agua, false);
  assert.equal(separarMeiosFisicos(proxy).solo, true);
  assert.equal(normalizarCapacidades({ modo: 'terrestre' }).simulacao, 'terrestre');
  assert.throws(() => normalizarCapacidades({ modo: 'areia_como_agua' }), /inválido/);
});
test('diagnóstico identifica clipes em falta, duração inválida e animações compatíveis', () => {
  const val = diagnosticarAnimacoes({ modo: 'subterraneo_areia', clipes: [
    { name: 'idle', duration: 4, tracks: Array.from({ length: 3 }) },
    { name: 'swim_sand', duration: 3, tracks: [{}] },
    { name: 'dive', duration: 2, tracks: [{}] }, { name: 'surface', duration: 3, tracks: [{}] }
  ], mapa: { parado: 'idle', andar: 'swim_sand' } });
  assert.equal(val.validoEstrutural, true);
  assert.equal(val.alertas.some((s) => s.startsWith('Nenhum clipe')), false);
  assert.equal(val.fisicaEspecialValidada, false);
  const ruim = diagnosticarAnimacoes({ modo: 'voador', clipes: [
    { name: 'fly', duration: 0, tracks: [] }
  ], mapa: { parado: 'idle' } });
  assert.equal(ruim.validoEstrutural, false);
  assert.ok(ruim.problemas.some((x) => x.includes('Duração inválida')));
  assert.ok(ruim.problemas.some((x) => x.includes('ausente')));
});
test('presets guardam cenário, terreno via cenário, seed e seleção; importação rejeita arquivos obsoletos', () => {
  const modelo = { id: 'cat_xyz', glb: 'assets/models/creatures/x/v01/x.glb' };
  const config = { cenarios: { 'travessia-divisa': { id: 'travessia-divisa' } }, catalogo: [modelo] };
  const p = criarPreset({ nome: 'Dunas A', cenario: 'travessia-divisa', semente: 42,
    selecao: [{ ...modelo, nome: 'X', papel: 'carnivoro', modo: 'subterraneo_areia', quantidade: 2, habilidades: ['nadar_areia'] }] });
  assert.equal(validarPreset(JSON.parse(JSON.stringify(p)), config).semente, 42);
  assert.deepEqual(converterPresets(JSON.stringify([p])), [p]);
  assert.throws(() => validarPreset({ ...p, cenario: 'inexistente' }, config), /indisponível/);
  assert.throws(() => validarPreset({ ...p, selecao: [{ ...p.selecao[0], glb: 'outro.glb' }] }, config), /GLB/);
  assert.throws(() => validarPreset({ ...p, versao: 0 }, config), /versão/);
  assert.throws(() => validarPreset({ ...p, selecao: [p.selecao[0], p.selecao[0]] }, config), /duplicado/);
});
test('manifests reais da Arraia-de-Areia e Arenoceto são vinculados ao GLB do catálogo', async () => {
  const modelos = await descobrirCatalogo(raizRepo);
  for (const especie of ['arenoceto', 'arraia-de-areia']) {
    const x = modelos.find((m) => m.origemEspecie === especie && m.manifest?.endsWith('manifest.json'));
    assert.ok(x, 'asset real não encontrado: ' + especie);
    assert.ok(x.animacoesDeclaradas.includes('swim_sand'));
    assert.ok(x.animacoesDeclaradas.includes('dive'));
    assert.equal(x.modoSugerido, 'subterraneo_areia');
  }
});
test('arquivos GLB reais possuem header glTF2 e clipes nomeados (sem prévia falsa)', async () => {
  for (const caminho of [
    'assets/models/creatures/arenoceto/v02/arenoceto-v02-skinned-animated-LOD0.glb',
    'assets/models/creatures/arraia-de-areia/v03/arraia-de-areia-v03-rig-animated-LOD0.glb'
  ]) {
    const bin = await readFile(join(raizRepo, caminho));
    assert.equal(bin.toString('ascii', 0, 4), 'glTF');
    assert.equal(bin.readUInt32LE(4), 2);
    assert.equal(bin.readUInt32LE(8), bin.length);
    assert.equal(bin.toString('ascii', 16, 20), 'JSON');
    const json = JSON.parse(bin.toString('utf8', 20, 20 + bin.readUInt32LE(12)));
    const clipes = (json.animations ?? []).map((x) => x.name);
    for (const necessario of ['idle', 'swim_sand', 'dive', 'surface'])
      assert.ok(clipes.includes(necessario), caminho + ' sem ' + necessario);
    assert.ok((json.skins ?? []).length > 0);
  }
});
