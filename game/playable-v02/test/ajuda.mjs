// Criação e recarga de jogos para os testes (provedor de GLBs síncrono, mesma construção de grade do navegador).
import { readFile } from 'node:fs/promises';
import { carregarHunterLab } from '../../../labs/hunters/src/node-hunters.mjs';
import { prepararConfig } from '../../playable-v01/src/cacada.js';
import { criarGrafo } from '../src/estrategico.js';
import { criarJogo, carregarJogo, salvarJogo, janelasDoSave, JANELA_INICIAL } from '../src/jogo.js';
import { QUADRO, hexesDaJanela } from '../src/regioes.js';
import { provedorNode } from './provedor-node.mjs';

export const grafo = JSON.parse(await readFile(new URL('../public/data/auralis-grafo.json', import.meta.url), 'utf8'));
export const LAB = await carregarHunterLab();
export const cfg = prepararConfig(LAB.cfg, LAB.fichaHunter);
export const provedor = provedorNode();
export const novoG = () => criarGrafo(structuredClone(grafo), { x0: QUADRO.x0, z0: QUADRO.z0 });
const G0 = novoG();
const terreno0 = provedor.montar({ ...JANELA_INICIAL, hexes: hexesDaJanela(G0, JANELA_INICIAL) });
export const novo = (semente = 1) => criarJogo(cfg, semente, { ...LAB, G: novoG(), provedor, terreno: terreno0 });
export function recarregar(j) {
  const salvo = JSON.parse(JSON.stringify(salvarJogo(j))), G = novoG();
  const terrenos = new Map(janelasDoSave(salvo).map((w) => [w.id, provedor.montar({ ...w, hexes: hexesDaJanela(G, w) })]));
  return { salvo, jogo: carregarJogo(cfg, salvo, { ...LAB, G, provedor, terrenos }) };
}
