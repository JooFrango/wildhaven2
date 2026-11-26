#!/usr/bin/env node
// Estatísticas de combate V3 em N sementes: golpes iniciados, acertos, erros (membro não alcança), esquivas,
// contra-ataques, empurrões/desequilíbrios/quedas, agarrões, regiões atingidas, atordoamentos, fraturas, mortes.
// Uso: node scripts/v3-combate.mjs [--cenarios bebedouro,bebedouro-real] [--sementes 1-30] [--segundos 300]
import { mkdir, writeFile } from 'node:fs/promises';
import { carregarConfigEcoNode } from '../src/node/eco-node.js';
import { rodarCenario } from '../src/eco/analise.js';
import { interpretarSementes } from '../src/core/simulacao.js';
import { lerArgs } from './simular-args.mjs';

const args = lerArgs(process.argv.slice(2));
const sementes = interpretarSementes(String(args.sementes ?? '1-30'));
const segundos = Number(args.segundos ?? 300);
const cenarios = String(args.cenarios ?? 'bebedouro,bebedouro-real').split(',');
const cfg = await carregarConfigEcoNode();
const out = { sementes: String(args.sementes ?? '1-30'), segundos, cenarios: {} };
const conta = (l) => l.reduce((o, k) => ((o[k] = (o[k] ?? 0) + 1), o), {});
for (const id of cenarios) {
  const ev = [];
  let predacoes = 0, mortesCombate = 0;
  for (const s of sementes) {
    const { mundo } = rodarCenario(cfg, id, s, { segundos });
    ev.push(...mundo.eventos.map((e) => ({ ...e, semente: s })));
    predacoes += mundo.metricas.predacoes; mortesCombate += mundo.metricas.mortes.combate ?? 0;
  }
  const tipo = (t) => ev.filter((e) => e.tipo === t);
  const fer = tipo('ferimento');
  out.cenarios[id] = {
    golpesIniciados: tipo('ataque_inicio').length,
    porAtaque: conta(tipo('ataque_inicio').map((e) => e.ataque)),
    acertos: fer.length, acertosPorAtaque: conta(fer.map((e) => e.ataque)),
    erros: tipo('golpe_errou').length, errosPorMotivo: conta(tipo('golpe_errou').map((e) => e.motivo)),
    esquivas: tipo('esquiva').length, contraAtaques: tipo('contra_ataque').length,
    empurroes: tipo('empurrao').length, desequilibrios: tipo('desequilibrio').length, quedas: tipo('queda').length,
    agarroes: tipo('agarrao').length, escapesDeAgarrao: tipo('escapou_agarrao').length, soltou: conta(tipo('soltou').map((e) => e.motivo)),
    regioes: conta(fer.map((e) => e.regiao)), atordoamentos: fer.filter((e) => e.atordoado).length, fraturas: fer.filter((e) => e.fratura).length,
    conflitosPorFaseFinal: conta(tipo('conflito_fim').map((e) => e.faseFinal)), conflitosPorDesfecho: conta(tipo('conflito_fim').map((e) => e.motivo)),
    predacoes, mortesCombate,
  };
  console.log(id, JSON.stringify(out.cenarios[id]));
}
await mkdir('resultados/v3', { recursive: true });
await writeFile('resultados/v3/combate.json', JSON.stringify(out, null, 1));
