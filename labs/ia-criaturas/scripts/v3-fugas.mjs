#!/usr/bin/env node
// Fugas durante disputas entre carnívoros: por semente, se houve disputa pela presa, oportunidades, tentativas
// (corrida, abrigo, esconder), fugas efetivas (fora da vista dos dois predadores por 10 s, viva) e recapturas.
// Uso: node scripts/v3-fugas.mjs [--cenarios disputa-presa,disputa-presa-cobertura,bebedouro-real] [--sementes 1-40]
import { mkdir, writeFile } from 'node:fs/promises';
import { carregarConfigEcoNode } from '../src/node/eco-node.js';
import { rodarCenario } from '../src/eco/analise.js';
import { interpretarSementes } from '../src/core/simulacao.js';
import { lerArgs } from './simular-args.mjs';

const args = lerArgs(process.argv.slice(2));
const sementes = interpretarSementes(String(args.sementes ?? '1-40'));
const cenarios = String(args.cenarios ?? 'disputa-presa,disputa-presa-cobertura,bebedouro-real,bebedouro').split(',');
const cfg = await carregarConfigEcoNode();
const out = { sementes: String(args.sementes ?? '1-40'), cenarios: {} };
const conta = (l) => l.reduce((o, k) => ((o[k] = (o[k] ?? 0) + 1), o), {});
for (const id of cenarios) {
  const linhas = [];
  for (const s of sementes) {
    const { mundo, resumo } = rodarCenario(cfg, id, s, {});
    const ev = mundo.eventos;
    const tipo = (t) => ev.filter((e) => e.tipo === t);
    const disputasPresa = tipo('conflito_inicio').filter((e) => e.motivo === 'presa');
    linhas.push({
      semente: s, disputas: tipo('conflito_inicio').length, disputasPelaPresa: disputasPresa.length,
      fasesFinais: tipo('conflito_fim').map((e) => e.faseFinal),
      oportunidades: tipo('oportunidade_fuga').length, tentativas: tipo('tentativa_fuga').map((e) => e.modo),
      efetivas: tipo('fuga_efetiva').length, recapturas: tipo('recaptura').length,
      predacoes: mundo.metricas.predacoes, perseguicoes: resumo.perseguicoes, escapesDuranteDisputaV2: mundo.metricas.escapesDuranteDisputa,
      primeiraFuga: tipo('fuga_efetiva')[0] ? { t: tipo('fuga_efetiva')[0].t, presa: tipo('fuga_efetiva')[0].id, modo: tipo('fuga_efetiva')[0].modo } : null,
    });
  }
  const soma = (k) => linhas.reduce((x, l) => x + (Array.isArray(l[k]) ? l[k].length : l[k]), 0);
  const r = {
    sementes: linhas.length,
    comDisputa: linhas.filter((l) => l.disputas).length, comDisputaPelaPresa: linhas.filter((l) => l.disputasPelaPresa).length,
    disputas: soma('disputas'), fasesFinais: conta(linhas.flatMap((l) => l.fasesFinais)),
    oportunidades: soma('oportunidades'), tentativas: soma('tentativas'), tentativasPorTipo: conta(linhas.flatMap((l) => l.tentativas)),
    fugasEfetivas: soma('efetivas'), recapturas: soma('recapturas'), sementesComFugaEfetiva: linhas.filter((l) => l.efetivas).length,
    predacoes: soma('predacoes'),
    exemplos: linhas.filter((l) => l.primeiraFuga).slice(0, 5).map((l) => ({ semente: l.semente, ...l.primeiraFuga })),
  };
  out.cenarios[id] = { resumo: r, porSemente: linhas };
  console.log(id, JSON.stringify(r));
}
await mkdir('resultados/v3', { recursive: true });
await writeFile('resultados/v3/fugas-disputa.json', JSON.stringify(out, null, 1));
