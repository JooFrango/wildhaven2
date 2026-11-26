#!/usr/bin/env node
// Reproduz um encontro específico e imprime a trilha de decisões.
// Uso: npm run reproduzir -- --cenario obstaculo --semente 7 [--eventos] [--json]
import { rodarEncontro } from '../src/core/simulacao.js';
import { carregarConfigNode } from '../src/node/carregar-node.js';
import { lerArgs } from './simular-args.mjs';

const args = lerArgs(process.argv.slice(2));
const cenario = args.cenario ?? 'campo-aberto';
const semente = Number(args.semente ?? 1);
const config = await carregarConfigNode();
const { mundo, resumo } = rodarEncontro(config, cenario, semente);

if (args.json) {
  console.log(JSON.stringify({ resumo, decisoes: mundo.decisoes, eventos: mundo.eventos }, null, 2));
} else {
  console.log(`Cenário ${cenario} · semente ${semente} · resultado ${resumo.resultado} · fim ${resumo.fim} em t=${resumo.duracaoEncontro}s`);
  console.log(`Hash da trilha: ${resumo.hash}  (a página mostra o mesmo hash ao fim do encontro)`);
  console.log(`Página: http://localhost:5180/?cenario=${cenario}&semente=${semente}\n`);
  console.log('Decisões:');
  for (const d of mundo.decisoes) {
    console.log(`  t=${d.t.toFixed(1).padStart(5)}s  ${d.id.padEnd(10)} ${d.estado.padEnd(20)} ${String(d.alvo ?? '-').padEnd(14)} E=${d.energia.toFixed(0).padStart(3)}  ${d.motivo}`);
  }
  if (args.eventos) {
    console.log('\nEventos:');
    for (const e of mundo.eventos) {
      const { tick, t, tipo, id, ...resto } = e;
      console.log(`  t=${t.toFixed(1).padStart(5)}s  ${String(id ?? '').padEnd(10)} ${tipo.padEnd(20)} ${JSON.stringify(resto)}`);
    }
  }
  console.log(`\nPerseguições: ${resumo.perseguicoes.map((p) => `${p.duracao}s→${p.motivo}`).join(', ') || 'nenhuma'}`);
  if (resumo.falhas.length) console.log('FALHAS:', resumo.falhas);
}
