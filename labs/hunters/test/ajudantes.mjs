// Cenários pequenos e determinísticos para os testes do Hunter Lab.
import { carregarHunterLab } from '../src/node-hunters.mjs';
import { criarMundoHunters } from '../src/mundo-hunters.js';

export const LAB = await carregarHunterLab();

export function cenarioDuelo(id, hunters, { terreno = {}, modoCombate = 'treino', populacoes = [], ...extra } = {}) {
  return {
    id, nome: id, dt: 0.1, duracaoSeg: 120,
    relogio: { segundosPorDia: 600, diaInicial: 12, horaInicial: 10 },
    clima: { chanceIncendio: 0 },
    terreno: { tipo: 'procedural', largura: 120, profundidade: 100, res: 1, amplitude: 0.2, capim: 40, ...terreno },
    modoCombate, hunters, populacoes, ...extra,
  };
}

export function mundoDuelo(cenario, semente = 1, opcoes = {}) {
  const cfg = { ...LAB.cfg, cenarios: { ...LAB.cfg.cenarios, [cenario.id]: cenario } };
  return criarMundoHunters(cfg, cenario, semente, { fichaHunter: LAB.fichaHunter, equipamentos: LAB.equipamentos, ...opcoes });
}

// Dois Hunters frente a frente, a `dist` metros, no meio do mapa.
export function doisHunters(equipA, equipB, { dist = 10, personalidadeA = {}, personalidadeB = {} } = {}) {
  return [
    { id: 'hunter-A', nome: 'A', equipe: 'azul', x: 60 - dist / 2, y: 50, direcaoGraus: 0, equipamento: equipA, personalidade: personalidadeA },
    { id: 'hunter-B', nome: 'B', equipe: 'verde', x: 60 + dist / 2, y: 50, direcaoGraus: 180, equipamento: equipB, personalidade: personalidadeB },
  ];
}

export const ev = (m, tipo, id) => m.eventos.filter((e) => e.tipo === tipo && (!id || e.id === id));
export const hunter = (m, id) => m.porId.get(id) ?? m.mortos.get(id);
