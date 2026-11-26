// Carregamento único (Node e navegador passam só a função de leitura de JSON) — mesma configuração nos dois modos.
import { validarEspecies } from './especies.js';

export async function carregarConfigEco(lerJson, opcoes = {}) {
  const indice = await lerJson('config/eco/indice.json');
  const especies = [];
  for (const f of indice.especies) especies.push(await lerJson(`config/eco/especies/${f}`));
  const erros = validarEspecies(especies);
  if (erros.length) throw new Error(`Espécies inválidas:\n- ${erros.join('\n- ')}`);
  // V3: anatomia de combate medida nos GLBs reais (scripts/anatomia-glb.mjs → modelos.json). Sem o arquivo,
  // o combate usa os alcances/preparos da ficha (comportamento V2).
  const modelos = await lerJson('config/eco/modelos.json').catch(() => null);
  for (const e of especies) {
    const p = modelos?.perfis?.[e.id];
    if (!p?.anatomia) continue;
    const eixo = p.frente.endsWith('X') ? 0 : 2;
    e.anatomia = p.anatomia;
    e.escalaModelo = e.corpo.comprimentoM / p.extensao[eixo];
  }
  const doencas = (await lerJson('config/eco/doencas.json')).doencas;
  const cenarios = {};
  for (const f of indice.cenarios) { const c = await lerJson(`config/eco/cenarios/${f}`); cenarios[c.id] = c; }
  // Terrenos derivados são grandes (um corredor de hexágonos passa de 7 MB). Com `preCarregarTerrenos: false`
  // só o cenário escolhido paga esse custo — quem abre a página chama `garantirTerreno` antes de criar o mundo.
  if (opcoes.preCarregarTerrenos !== false) for (const c of Object.values(cenarios)) await garantirTerreno(c, lerJson);
  return { especies: Object.fromEntries(especies.map((e) => [e.id, e])), doencas, cenarios, ordemCenarios: indice.cenarios.map((f) => f.replace(/\.json$/, '')) };
}

export async function garantirTerreno(cenario, lerJson) {
  if (cenario.terreno?.tipo === 'derivado' && cenario.terreno.arquivo && !cenario.terreno.dados) {
    cenario.terreno.dados = await lerJson(cenario.terreno.arquivo);
  }
  return cenario;
}
