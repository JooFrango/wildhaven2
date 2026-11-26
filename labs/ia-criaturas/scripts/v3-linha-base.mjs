#!/usr/bin/env node
// Mede, nas mesmas sementes, as métricas de locomoção e de fuga usadas na comparação antes/depois da V3.
// Uso: node scripts/v3-linha-base.mjs --rotulo antes|depois [--sementes 1-20] [--segundos 300] [--cenarios a,b]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { carregarConfigEcoNode } from '../src/node/eco-node.js';
import { rodarCenario } from '../src/eco/analise.js';
import { interpretarSementes } from '../src/core/simulacao.js';
import { lerArgs } from './simular-args.mjs';

const args = lerArgs(process.argv.slice(2));
const rotulo = String(args.rotulo ?? 'depois');
const sementes = interpretarSementes(String(args.sementes ?? '1-20'));
const segundos = Number(args.segundos ?? 300);
const cenarios = String(args.cenarios ?? 'bebedouro,bebedouro-real').split(',');
const cfg = await carregarConfigEcoNode();
const out = { rotulo, sementes: String(args.sementes ?? '1-20'), segundos, cenarios: {} };
for (const id of cenarios) {
  const t0 = performance.now();
  const rs = sementes.map((s) => rodarCenario(cfg, id, s, { segundos }));
  const soma = (f) => rs.reduce((x, r) => x + (f(r) ?? 0), 0);
  const presosPorEstado = {};
  for (const r of rs) for (const d of r.mundo.decisoesPreso ?? []) presosPorEstado[d] = (presosPorEstado[d] ?? 0) + 1;
  out.cenarios[id] = {
    colisoes: soma((r) => r.resumo.colisoes),
    contatosObstaculo: soma((r) => r.mundo.metricas.contatosObstaculo),
    sobreposicaoParesSeg: +soma((r) => r.mundo.metricas.sobreposicoes).toFixed(1),
    presos: soma((r) => r.mundo.metricas.presos),
    presosPorEstado,
    buscasCaminho: soma((r) => r.mundo.metricas.buscasCaminho),
    predacoes: soma((r) => r.resumo.predacoes),
    oportunidadesFuga: soma((r) => r.resumo.oportunidadesFuga),
    escapesDuranteDisputa: soma((r) => r.resumo.escapesDuranteDisputa),
    ms: Math.round(performance.now() - t0),
  };
  console.log(id, JSON.stringify(out.cenarios[id]));
}
await mkdir('resultados/v3', { recursive: true });
const arq = 'resultados/v3/locomocao-comparacao.json';
const prev = JSON.parse(await readFile(arq, 'utf8').catch(() => '{}'));
prev[rotulo] = out;
await writeFile(arq, JSON.stringify(prev, null, 1));
