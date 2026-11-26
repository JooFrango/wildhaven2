#!/usr/bin/env node
// Paridade página × CLI. Imprime a impressão digital (hash único de todas as trilhas) do lote.
// No console da página: laboratorio.impressaoDigital('1-30').hash  → deve ser igual.
// Uso: npm run paridade [-- --sementes 1-30 --cenario id --detalhes]
import { impressaoDigital } from '../src/core/simulacao.js';
import { carregarConfigNode } from '../src/node/carregar-node.js';
import { lerArgs } from './simular-args.mjs';

const args = lerArgs(process.argv.slice(2));
const config = await carregarConfigNode();
const cenarios = !args.cenario || args.cenario === 'todos' ? config.ordemCenarios : args.cenario.split(',');
const sementes = String(args.sementes ?? '1-30');
const r = impressaoDigital(config, sementes, cenarios);
if (args.detalhes) for (const l of r.linhas) console.log(l);
console.log(`Impressão digital (${r.encontros} encontros, sementes ${sementes}): ${r.hash}`);
console.log(`Na página (console): laboratorio.impressaoDigital('${sementes}'${args.cenario ? `, '${args.cenario}'` : ''}).hash`);
