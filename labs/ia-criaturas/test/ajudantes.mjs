// Utilitários de teste: monta cenários sob medida com as espécies reais + variantes de teste.
import { montarConfig } from '../src/core/config.js';
import { passo } from '../src/core/mundo.js';
import { carregarConfigNode } from '../src/node/carregar-node.js';

const base = await carregarConfigNode();
const clonar = (o) => JSON.parse(JSON.stringify(o));
export const ESPECIES = base.especies;

// Variantes só para testes: presa/predador "bonecos" com rota fixa (não reagem a nada).
function variantes() {
  const h = clonar(base.especies['herbivoro-exemplo']);
  const p = clonar(base.especies['predador-exemplo']);
  const presaRota = { ...clonar(h), id: 'presa-rota', comportamento: 'estatico' };
  const predadorParado = { ...clonar(p), id: 'predador-parado', comportamento: 'estatico' };
  h.relacoes.teme = ['predador-exemplo', 'predador-parado'];
  p.relacoes.presas = ['herbivoro-exemplo', 'presa-rota'];
  return [h, p, presaRota, predadorParado, clonar(base.especies['boneco-teste'])];
}

export function configCom(...cenarios) {
  return montarConfig({ especies: variantes(), cenarios });
}

export function cenario(id, criaturas, extra = {}) {
  return { id, nome: id, duracaoSeg: 60, dt: 0.1, terreno: { largura: 60, altura: 40 }, obstaculos: [], alimentos: [], criaturas, ...extra };
}

export function rodarAte(mundo, condicao, tMax = 60) {
  while (!mundo.fim && mundo.t < tMax) {
    passo(mundo);
    if (condicao(mundo)) return true;
  }
  return false;
}

export const criatura = (mundo, id) => mundo.criaturas.find((c) => c.id === id);
export const eventos = (mundo, tipo, id) => mundo.eventos.filter((e) => e.tipo === tipo && (!id || e.id === id));
