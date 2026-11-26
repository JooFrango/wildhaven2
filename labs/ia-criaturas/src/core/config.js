// Montagem e validação das configurações (espécies e cenários) — independente de Node ou navegador.
import { COMPORTAMENTOS } from './comportamentos/index.js';
import { congelar } from './mundo.js';

const CAMPOS_ESPECIE = [
  'id', 'nome', 'comportamento', 'corpo.raio',
  'movimento.andar', 'movimento.trote', 'movimento.corrida', 'movimento.aceleracao', 'movimento.giroGrausSeg',
  'percepcao.visao.alcance', 'percepcao.visao.anguloGraus', 'percepcao.audicao.alcance', 'percepcao.memoriaSeg',
  'necessidades.energiaMax', 'necessidades.custoBasePorSeg', 'necessidades.custoCorridaPorSeg',
  'necessidades.recuperacaoPorSeg', 'necessidades.fomePorSeg', 'necessidades.limiteExaustao',
  'relacoes', 'decisao',
];

const ler = (obj, caminho) => caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

export function validarConfig({ especies, cenarios }) {
  const erros = [];
  const ids = new Set(especies.map((e) => e.id));
  for (const e of especies) {
    for (const c of CAMPOS_ESPECIE) if (ler(e, c) === undefined) erros.push(`espécie ${e.id ?? '?'}: campo obrigatório ausente "${c}"`);
    if (e.comportamento && !COMPORTAMENTOS[e.comportamento]) erros.push(`espécie ${e.id}: comportamento "${e.comportamento}" não registrado`);
    if (e.comportamento === 'predador' && !e.ataque) erros.push(`espécie ${e.id}: predador sem bloco "ataque"`);
    for (const rel of ['teme', 'presas']) for (const alvo of e.relacoes?.[rel] ?? []) if (!ids.has(alvo)) erros.push(`espécie ${e.id}: relacoes.${rel} cita espécie inexistente "${alvo}"`);
    for (const campo of e.balanceamento?.provisorios ?? []) if (ler(e, campo) === undefined) erros.push(`espécie ${e.id}: balanceamento.provisorios cita campo inexistente "${campo}"`);
  }
  for (const c of cenarios) {
    if (!c.id || !c.terreno?.largura || !c.terreno?.altura) erros.push(`cenário ${c.id ?? '?'}: id/terreno inválido`);
    for (const cr of c.criaturas ?? []) {
      if (!ids.has(cr.especie)) erros.push(`cenário ${c.id}: criatura ${cr.id} usa espécie inexistente "${cr.especie}"`);
      if (cr.x < 0 || cr.y < 0 || cr.x > c.terreno.largura || cr.y > c.terreno.altura) erros.push(`cenário ${c.id}: criatura ${cr.id} fora do terreno`);
    }
    for (const o of c.obstaculos ?? []) {
      if (!(o.w > 0 && o.h > 0)) erros.push(`cenário ${c.id}: obstáculo ${o.id ?? '?'} com tamanho inválido`);
      if (o.x < 0 || o.y < 0 || o.x + o.w > c.terreno.largura || o.y + o.h > c.terreno.altura) erros.push(`cenário ${c.id}: obstáculo ${o.id ?? '?'} fora do terreno`);
    }
    const idsCr = (c.criaturas ?? []).map((x) => x.id);
    if (new Set(idsCr).size !== idsCr.length) erros.push(`cenário ${c.id}: ids de criaturas repetidos`);
  }
  return erros;
}

export function montarConfig({ especies, cenarios }) {
  const erros = validarConfig({ especies, cenarios });
  if (erros.length) throw new Error(`Configuração inválida:\n- ${erros.join('\n- ')}`);
  const cfg = {
    especies: Object.fromEntries(especies.map((e) => [e.id, e])),
    cenarios: Object.fromEntries(cenarios.map((c) => [c.id, c])),
    ordemCenarios: cenarios.map((c) => c.id),
  };
  return congelar(cfg);
}
