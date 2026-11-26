#!/usr/bin/env node
// Simulador sem interface: roda N sementes por cenário, agrega métricas e grava o relatório.
// Uso: node scripts/simular.mjs [--cenario id|todos] [--sementes 1-30] [--saida resultados]
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RESULTADOS, interpretarSementes, rodarEncontro } from '../src/core/simulacao.js';
import { RAIZ_LAB, carregarConfigNode } from '../src/node/carregar-node.js';
import { lerArgs } from './simular-args.mjs';

const args = lerArgs(process.argv.slice(2));
const config = await carregarConfigNode();
const cenarios = !args.cenario || args.cenario === 'todos' ? config.ordemCenarios : args.cenario.split(',');
const sementes = interpretarSementes(args.sementes ?? '1-30');
const saida = join(RAIZ_LAB, args.saida ?? 'resultados');

const inicio = Date.now();
const porCenario = {};
for (const id of cenarios) {
  const encontros = sementes.map((s) => rodarEncontro(config, id, s).resumo);
  porCenario[id] = { nome: config.cenarios[id].nome, agregado: agregar(encontros), encontros };
  const a = porCenario[id].agregado;
  console.log(`${id.padEnd(18)} n=${a.encontros}  sem_deteccao=${a.semDeteccao}  perseguicoes=${a.encontrosComPerseguicao}  fugas=${a.encontrosComFuga}  desist_cansaco=${a.desistenciasCansaco}  perda_rastro=${a.desistenciasPerdaRastro}  capturas=${a.capturas}  falhas=${a.sementesComFalha.length}`);
}
const resumo = {
  geradoEm: new Date().toISOString(),
  sementes: args.sementes ?? '1-30',
  tempoExecucaoMs: Date.now() - inicio,
  cenarios: porCenario,
};
await mkdir(saida, { recursive: true });
await writeFile(join(saida, 'resumo.json'), JSON.stringify(resumo, null, 2));
await writeFile(join(saida, 'relatorio.md'), relatorio(resumo, config));
console.log(`\nRelatório: ${join(args.saida ?? 'resultados', 'relatorio.md')}  (${resumo.tempoExecucaoMs} ms)`);
const totalFalhas = Object.values(porCenario).reduce((n, c) => n + c.agregado.sementesComFalha.length, 0);
if (args.falharSeErro && totalFalhas) process.exitCode = 1;

function agregar(encontros) {
  const dur = encontros.flatMap((e) => e.perseguicoes.map((p) => p.duracao));
  const exemplosPor = (campo) => {
    const out = {};
    for (const r of RESULTADOS) {
      const e = encontros.find((x) => x[campo] === r);
      if (e) out[r] = { semente: e.semente, contagem: encontros.filter((x) => x[campo] === r).length };
    }
    return out;
  };
  const soma = (k) => encontros.reduce((n, e) => n + e[k], 0);
  return {
    encontros: encontros.length,
    semDeteccao: encontros.filter((e) => !e.detectou).length,
    encontrosComPerseguicao: encontros.filter((e) => e.perseguicoesIniciadas > 0).length,
    perseguicoesIniciadas: soma('perseguicoesIniciadas'),
    encontrosComFuga: encontros.filter((e) => e.fugas > 0).length,
    fugas: soma('fugas'),
    desistenciasCansaco: soma('desistenciasCansaco'),
    desistenciasPerdaRastro: soma('desistenciasPerdaRastro'),
    capturas: soma('capturas'),
    duracaoPerseguicao: dur.length ? {
      media: +(dur.reduce((a, b) => a + b, 0) / dur.length).toFixed(2),
      min: Math.min(...dur), max: Math.max(...dur), amostras: dur.length,
    } : null,
    furtividade: agregarFurtividade(encontros),
    resultados: exemplosPor('resultado'),
    resultadosFinais: exemplosPor('resultadoFinal'),
    sementesComFalha: encontros.filter((e) => e.falhas.length).map((e) => ({ semente: e.semente, falhas: e.falhas })),
  };
}

function agregarFurtividade(encontros) {
  const media = (xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : null);
  const primeiro = {};
  for (const e of encontros) if (e.quemDetectouPrimeiro) primeiro[e.quemDetectouPrimeiro] = (primeiro[e.quemDetectouPrimeiro] ?? 0) + 1;
  const distDet = {};
  for (const e of encontros) for (const [id, d] of Object.entries(e.primeiraDeteccao)) if (d) (distDet[id] ??= []).push(d.distancia);
  const despercebidos = {}, ocultoSeg = {};
  for (const e of encontros) {
    for (const [m, n] of Object.entries(e.despercebidos)) despercebidos[m] = (despercebidos[m] ?? 0) + n;
    for (const [id, porMotivo] of Object.entries(e.ocultoSeg)) for (const [m, s] of Object.entries(porMotivo)) {
      ocultoSeg[id] ??= {}; ocultoSeg[id][m] = +((ocultoSeg[id][m] ?? 0) + s).toFixed(1);
    }
  }
  const semDet = encontros.filter((e) => !e.detectou);
  // Quase-encontro: ninguém detectou ninguém, mas chegaram a ficar a menos de 20 m.
  const quase = semDet.filter((e) => e.distanciaMinima < 20).sort((a, b) => a.distanciaMinima - b.distanciaMinima);
  return {
    quemDetectouPrimeiro: primeiro,
    distanciaDeteccaoMedia: Object.fromEntries(Object.entries(distDet).map(([id, xs]) => [id, media(xs)])),
    distanciaMinimaMediaSemDeteccao: media(semDet.map((e) => e.distanciaMinima).filter(Number.isFinite)),
    quaseEncontros: quase.length,
    exemploQuaseEncontro: quase[0] ? { semente: quase[0].semente, distanciaMinima: quase[0].distanciaMinima } : null,
    episodiosDespercebido: despercebidos,
    ocultoNoAlcanceSeg: ocultoSeg,
  };
}

function relatorio(r, config) {
  const l = [];
  l.push('# Relatório — laboratório de IA das criaturas', '');
  l.push(`Gerado em ${r.geradoEm} · sementes \`${r.sementes}\` por cenário · ${r.tempoExecucaoMs} ms.`, '');
  l.push('Gerado por `npm run simular`. Cada linha é reproduzível com `npm run reproduzir -- --cenario <id> --semente <n>`.', '');
  l.push('## Visão geral', '');
  l.push('| Cenário | Encontros | Sem detecção | Com perseguição | Com fuga | Desist. cansaço | Perda de rastro | Capturas | Duração perseg. (média / mín–máx s) | Sementes com falha |');
  l.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const [id, c] of Object.entries(r.cenarios)) {
    const a = c.agregado, d = a.duracaoPerseguicao;
    l.push(`| ${c.nome} (\`${id}\`) | ${a.encontros} | ${a.semDeteccao} | ${a.encontrosComPerseguicao} (${a.perseguicoesIniciadas} perseg.) | ${a.encontrosComFuga} | ${a.desistenciasCansaco} | ${a.desistenciasPerdaRastro} | ${a.capturas} | ${d ? `${d.media} / ${d.min}–${d.max}` : '—'} | ${a.sementesComFalha.length} |`);
  }
  l.push('', 'Desistências e capturas são contadas como eventos: depois de desistir, o predador pode recuperar energia e tentar de novo no mesmo encontro. Perseguições de 0,1 s são as que começaram no último passo antes do fim do tempo.', '');
  l.push('## Semente de exemplo por resultado', '');
  l.push('**Resultado do encontro** = desfecho da primeira perseguição (ou, sem perseguição: fuga sem perseguição / detectado sem perseguição / sem detecção). Resultados que não aparecem na tabela não foram observados nessas sementes.', '');
  l.push('| Cenário | Resultado | Encontros | Semente de exemplo | Reproduzir |');
  l.push('|---|---|---|---|---|');
  for (const [id, c] of Object.entries(r.cenarios)) {
    for (const [res, ex] of Object.entries(c.agregado.resultados)) {
      l.push(`| \`${id}\` | ${res} | ${ex.contagem} | ${ex.semente} | \`npm run reproduzir -- --cenario ${id} --semente ${ex.semente}\` |`);
    }
  }
  l.push('', '**Resultado ao fim do tempo** (prioridade: captura > desistência por cansaço > perda de rastro > perseguição em andamento > sem perseguição):', '');
  l.push('| Cenário | Resultado final | Encontros | Semente de exemplo |');
  l.push('|---|---|---|---|');
  for (const [id, c] of Object.entries(r.cenarios)) {
    for (const [res, ex] of Object.entries(c.agregado.resultadosFinais)) l.push(`| \`${id}\` | ${res} | ${ex.contagem} | ${ex.semente} |`);
  }
  l.push('', '## Furtividade, camuflagem e encontros que não acontecem', '');
  l.push('Visão com reconhecimento gradual (`visao.tempoReconhecimentoSeg`), alcance efetivo reduzido por `furtividade.camuflagem`, imobilidade (`fatorParado`) e vegetação com `ocultacao`. **Despercebido** = um animal relevante (presa/ameaça) dentro do alcance nominal de visão do outro sem ser visto, com o motivo. **Quase-encontro** = encontro sem nenhuma detecção em que a distância mínima entre eles ficou abaixo de 20 m.', '');
  l.push('| Cenário | Sem detecção | Quase-encontros (ex.: semente @ dist. mín.) | Dist. mín. média sem detecção (m) | Quem detectou primeiro | Dist. média da 1ª detecção (m) | Episódios despercebidos por motivo |');
  l.push('|---|---|---|---|---|---|---|');
  for (const [id, c] of Object.entries(r.cenarios)) {
    const f = c.agregado.furtividade;
    const ex = f.exemploQuaseEncontro ? `${f.quaseEncontros} (semente ${f.exemploQuaseEncontro.semente} @ ${f.exemploQuaseEncontro.distanciaMinima} m)` : `${f.quaseEncontros}`;
    const kv = (o) => Object.entries(o).map(([k, v]) => `${k}: ${v}`).join(', ') || '—';
    l.push(`| \`${id}\` | ${c.agregado.semDeteccao}/${c.agregado.encontros} | ${ex} | ${f.distanciaMinimaMediaSemDeteccao ?? '—'} | ${kv(f.quemDetectouPrimeiro)} | ${kv(f.distanciaDeteccaoMedia)} | ${kv(f.episodiosDespercebido)} |`);
  }
  l.push('', 'Tempo total (s, somando as 30 sementes) em que cada animal teve o outro dentro do alcance nominal de visão sem vê-lo:', '');
  l.push('| Cenário | Observador | sem linha de visão | fora do cone | camuflagem/cobertura | reconhecendo |');
  l.push('|---|---|---|---|---|---|');
  for (const [id, c] of Object.entries(r.cenarios)) {
    for (const [obs, m] of Object.entries(c.agregado.furtividade.ocultoNoAlcanceSeg)) {
      l.push(`| \`${id}\` | ${obs} | ${m.sem_linha_de_visao ?? 0} | ${m.fora_do_cone ?? 0} | ${m.camuflagem_cobertura ?? 0} | ${m.reconhecendo ?? 0} |`);
    }
  }
  l.push('', '## Falhas', '');
  const falhas = Object.entries(r.cenarios).flatMap(([id, c]) => c.agregado.sementesComFalha.map((f) => ({ id, ...f })));
  if (!falhas.length) l.push('Nenhuma falha de invariante (colisão, fora do terreno, NaN, reação sem percepção) nas sementes rodadas.');
  else for (const f of falhas) l.push(`- \`${f.id}\` semente ${f.semente}: ${f.falhas.map((x) => `${x.tipo} (${x.id}, t=${x.t}s: ${x.detalhe})`).join('; ')}`);
  l.push('', '## Valores provisórios de balanceamento', '');
  for (const e of Object.values(config.especies)) {
    if (e.balanceamento?.provisorios?.length) l.push(`- **${e.nome}** (\`${e.id}\`): ${e.balanceamento.provisorios.map((x) => `\`${x}\``).join(', ')}`);
  }
  l.push('');
  return l.join('\n');
}

