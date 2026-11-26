// Ajudantes dos testes V2: cenários pequenos e controlados com as espécies reais.
import { criarMundoEco, passoEco } from '../src/eco/mundo.js';
import { carregarConfigEcoNode } from '../src/node/eco-node.js';

export const CFG = await carregarConfigEcoNode();

export function cenarioTeste(id, populacoes, terreno = {}, extra = {}) {
  return {
    id, nome: id, dt: 0.1, duracaoSeg: 120,
    relogio: { segundosPorDia: 600, diaInicial: 12, horaInicial: 8 },
    clima: { chanceIncendio: 0 },
    terreno: { tipo: 'procedural', largura: 160, profundidade: 120, res: 1, amplitude: 0.2, capim: 60, ...terreno },
    populacoes, ...extra,
  };
}

export function mundoTeste(cenario, semente = 1, opcoes = {}) {
  const cfg = { ...CFG, cenarios: { ...CFG.cenarios, [cenario.id]: cenario } };
  return criarMundoEco(cfg, cenario, semente, opcoes);
}

export function rodar(m, ate, parar = () => false) {
  while (m.t < ate - 1e-9) { passoEco(m); if (parar(m)) return true; }
  return false;
}

export const ev = (m, tipo, id) => m.eventos.filter((e) => e.tipo === tipo && (!id || e.id === id));
export const animal = (m, id) => m.porId.get(id) ?? m.mortos.get(id);
