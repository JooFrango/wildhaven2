#!/usr/bin/env node
// Gera os cenários integrados C–H da V7 (A e B são arquivos escritos à mão). Todos experimentais, em terreno
// procedural do laboratório — nenhum toca mapa ou hexágono oficial.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RAIZ_LAB } from '../src/node/carregar-node.js';

const dir = join(RAIZ_LAB, 'config', 'eco', 'cenarios');
const relogio = (hora, segundosPorDia = 600) => ({ segundosPorDia, diaInicial: 30, horaInicial: hora, diasPorAno: 365 });
const seco = { fracaoChuvosa: 0.4, chanceChuvaChuvosa: 0, chanceChuvaSeca: 0, chanceIncendio: 0 };
const nec = { fome: [10, 20], sede: [10, 20], energia: [90, 98] };
const faminto = { fome: [75, 85], sede: [10, 20], energia: [92, 98] };

const savanaCaca = (id, nome, descricao, eventos) => ({
  id, nome, descricao, dt: 0.1, duracaoSeg: 240, relogio: relogio(16.8), clima: { ...seco, temperaturaC: 24, ...(eventos ? { eventos } : {}) },
  terreno: { tipo: 'procedural', largura: 200, profundidade: 150, res: 1, amplitude: 2, capim: 45,
    rochas: [{ x: 120, y: 60, raio: 2.4, altura: 1.8 }, { x: 78, y: 104, raio: 2.2, altura: 1.6 }],
    arbustos: [{ x: 70, y: 80, raio: 7, ocultacao: 75, alimento: 25 }, { x: 96, y: 62, raio: 5, ocultacao: 70, alimento: 20 }, { x: 132, y: 96, raio: 7, ocultacao: 80, alimento: 25 }, { x: 150, y: 60, raio: 6, ocultacao: 75, alimento: 20 }] },
  populacoes: [
    { especie: 'velsari', grupos: [{ x: 112, y: 80, raio: 6, adultos: 5, raioCasa: 40 }] },
    { especie: 'varrisco', individuos: [{ id: 'varrisco-1', x: 66, y: 82, direcaoGraus: 0, ...faminto }] },
  ],
});

const CENARIOS = [
  {
    id: 'v7-c-bandos-no-ceu', nome: 'V7·C — Bandos no céu',
    descricao: 'EXPERIMENTAL. Doze Carnirocas (GLB real com clipes de decolagem, voo, planeio e pouso): metade no ar, metade pousada num terreno com morros de 18–30 m. Um Varrisco passa pelo grupo pousado. Mostra voo 3D, coesão, desvio de relevo, fuga, dispersão e pouso.',
    dt: 0.1, duracaoSeg: 240, relogio: relogio(10), clima: { ...seco, temperaturaC: 22 },
    terreno: { tipo: 'procedural', largura: 420, profundidade: 320, res: 2, amplitude: 5, capim: 30,
      rochas: [{ x: 250, y: 150, raio: 24, altura: 30 }, { x: 150, y: 230, raio: 16, altura: 18 }, { x: 320, y: 90, raio: 14, altura: 22 }],
      arbustos: [{ x: 120, y: 120, raio: 8, ocultacao: 70, alimento: 20 }, { x: 200, y: 80, raio: 7, ocultacao: 70, alimento: 20 }] },
    populacoes: [
      { especie: 'carniroca', individuos: [
        ...Array.from({ length: 6 }, (_, i) => ({ id: `ar-${i + 1}`, x: 130 + (i % 3) * 10, y: 150 + Math.floor(i / 3) * 10, direcaoGraus: 0, altitudeInicialM: 18 + i * 2, ...nec })),
        ...Array.from({ length: 6 }, (_, i) => ({ id: `chao-${i + 1}`, x: 150 + (i % 3) * 4, y: 110 + Math.floor(i / 3) * 4, direcaoGraus: i * 60, ...nec })),
      ] },
      { especie: 'varrisco', individuos: [{ id: 'ameaca', x: 100, y: 108, direcaoGraus: 0, casa: { x: 160, y: 112, raio: 30 }, territorio: { x: 160, y: 112, raio: 60 }, fome: [20, 30], sede: [10, 20], energia: [90, 98] }] },
    ],
  },
  {
    id: 'v7-d-tempestade-de-areia', nome: 'V7·D — Tempestade de areia',
    descricao: 'EXPERIMENTAL. Dunas procedurais do laboratório. Um Varrisco caça um Velsari; um Serracórion (percepção por vibração) está na área. Aos 25 s começa uma tempestade de areia de 110 s: a visão dos animais cai para 15%, a locomoção fica mais lenta e eles procuram abrigo.',
    dt: 0.1, duracaoSeg: 200, relogio: relogio(15), clima: { ...seco, temperaturaC: 34, eventos: [{ tipo: 'tempestade_areia', inicioSeg: 25, duracaoSeg: 110, intensidade: 1 }] },
    terreno: { tipo: 'procedural', largura: 220, profundidade: 160, res: 1, amplitude: 4, capim: 5, areia: true,
      rochas: [{ x: 130, y: 70, raio: 3, altura: 2.6 }, { x: 90, y: 110, raio: 2.6, altura: 2.2 }],
      arbustos: [{ x: 150, y: 96, raio: 5, ocultacao: 70, alimento: 15 }, { x: 108, y: 60, raio: 4, ocultacao: 65, alimento: 10 }] },
    populacoes: [
      { especie: 'varrisco', individuos: [{ id: 'predador', x: 70, y: 84, direcaoGraus: 0, ...faminto }] },
      { especie: 'velsari', individuos: [{ id: 'presa', x: 112, y: 82, direcaoGraus: 30, raioCasa: 30, fome: [55, 70], sede: [10, 20], energia: [80, 95] }] },
      { especie: 'serracorion', individuos: [{ id: 'serracorion', x: 120, y: 100, direcaoGraus: 180, fome: [40, 55], sede: [10, 20], energia: [85, 95] }] },
    ],
  },
  savanaCaca('v7-e-chuva-e-caca', 'V7·E — Chuva e caça', 'EXPERIMENTAL. Um Varrisco faminto e cinco Velsaris na savana, sob chuva intensa do segundo 5 ao 235. Par do cenário de controle: mesma posição inicial, mesma semente, só o clima muda.', [{ tipo: 'chuva_intensa', inicioSeg: 5, duracaoSeg: 230, intensidade: 1 }]),
  savanaCaca('v7-e-controle-sem-chuva', 'V7·E — controle sem chuva', 'EXPERIMENTAL. Controle do cenário de chuva: idêntico, com céu limpo.', null),
  {
    id: 'v7-f-cupinzeiro', nome: 'V7·F — Cupinzeiro',
    descricao: 'EXPERIMENTAL. Dois cupinzeiros do laboratório (cone PROXY; nenhum é acrescentado ao mapa oficial). Um Ferrunco, que abre a casca, e uma Pica-Termita, que só alcança a superfície, competem pela colônia maior. A população de cupins é finita e se recupera devagar.',
    dt: 0.1, duracaoSeg: 300, relogio: relogio(9), clima: { ...seco, temperaturaC: 25 },
    terreno: { tipo: 'procedural', largura: 180, profundidade: 130, res: 1, amplitude: 1.5, capim: 35, arbustos: [{ x: 60, y: 40, raio: 6, ocultacao: 70, alimento: 20 }, { x: 130, y: 96, raio: 6, ocultacao: 70, alimento: 20 }] },
    cupinzeiros: [{ id: 'colonia-grande', x: 96, y: 66, populacaoMax: 3500, alturaM: 1.9 }, { id: 'colonia-pequena', x: 128, y: 50, populacao: 500, populacaoMax: 1500, alturaM: 1.1 }],
    populacoes: [
      { especie: 'ferrunco', individuos: [{ id: 'ferrunco', x: 60, y: 70, direcaoGraus: 0, fome: [80, 88], sede: [5, 12], energia: [90, 98] }] },
      { especie: 'pica-termita', individuos: [{ id: 'pica-termita', x: 80, y: 96, direcaoGraus: -40, fome: [80, 88], sede: [5, 12], energia: [90, 98] }] },
    ],
  },
  {
    id: 'v7-g-ciclo-da-carcaca', nome: 'V7·G — Ciclo de uma carcaça',
    descricao: 'EXPERIMENTAL. Um Varrisco abate um Velsari com a perna ferida. Três Carnirocas (necrófagas do catálogo) chegam pelo ar; insetos Dunébrio (detritívoro do catálogo que consome restos orgânicos) acumulam conforme o odor. A decomposição está acelerada no cenário (ossos em ~0,45 dia) para o ciclo caber numa sessão: carne → restos → ossos (PROXY procedural) → reciclagem.',
    dt: 0.1, duracaoSeg: 900, relogio: relogio(9), clima: { ...seco, temperaturaC: 29 },
    decomposicao: { diasAteOssos: 0.45, ossosDias: 0.4, maxCarcacas: 8, necrofagos: { especie: 'dunebrio', glb: 'assets/models/creatures/detritivoros/dunebrio-optimized-v02-LOD0.glb', maxPorCarcaca: 24, comePorSegKg: 0.0012, chegadaPorSeg: 0.25 } },
    terreno: { tipo: 'procedural', largura: 220, profundidade: 160, res: 1, amplitude: 1.5, capim: 40, arbustos: [{ x: 70, y: 60, raio: 6, ocultacao: 70, alimento: 20 }, { x: 150, y: 110, raio: 7, ocultacao: 75, alimento: 25 }] },
    populacoes: [
      { especie: 'velsari', individuos: [{ id: 'presa', x: 106, y: 80, raioCasa: 30, fome: [45, 60], sede: [10, 20], energia: [60, 80], ferimentos: [{ regiao: 'pernas', gravidade: 0.7, origem: 'cenario' }] }] },
      { especie: 'varrisco', individuos: [{ id: 'predador', x: 86, y: 78, direcaoGraus: 0, ...faminto }] },
      { especie: 'carniroca', individuos: Array.from({ length: 3 }, (_, i) => ({ id: `carniroca-${i + 1}`, x: 150 + i * 8, y: 40 + i * 6, direcaoGraus: 180, altitudeInicialM: 24 + i * 3, fome: [70, 85], sede: [5, 15], energia: [90, 98] })) },
    ],
  },
  {
    id: 'v7-h-emboscada-e-ferimentos', nome: 'V7·H — Emboscada e ferimentos',
    descricao: 'EXPERIMENTAL. Uma Boscaranha embosca na cobertura por onde um bando de Folhiscos se alimenta. Mostra aproximação da cobertura, espera, disparo, contato real, sangue no osso da região atingida, veneno e fuga ou morte.',
    dt: 0.1, duracaoSeg: 600, relogio: relogio(17.3), clima: { ...seco, temperaturaC: 19 },
    terreno: { tipo: 'procedural', largura: 150, profundidade: 110, res: 1, amplitude: 1, capim: 20,
      rochas: [{ x: 60, y: 44, raio: 2, altura: 1.5 }],
      arbustos: [{ x: 78, y: 56, raio: 5, ocultacao: 85, alimento: 35 }, { x: 90, y: 62, raio: 5, ocultacao: 85, alimento: 35 }, { x: 84, y: 48, raio: 4, ocultacao: 80, alimento: 30 }] },
    populacoes: [
      { especie: 'boscaranha', individuos: [{ id: 'boscaranha', x: 74, y: 60, direcaoGraus: 0, ...faminto }] },
      { especie: 'folhisco', grupos: [{ x: 88, y: 58, raio: 4, adultos: 6, raioCasa: 14 }] },
    ],
  },
];

for (const c of CENARIOS) { await writeFile(join(dir, `${c.id}.json`), JSON.stringify(c, null, 1) + '\n'); console.log('cenário', c.id); }
const arqIndice = join(RAIZ_LAB, 'config', 'eco', 'indice.json');
const indice = JSON.parse(await readFile(arqIndice, 'utf8'));
const v7 = ['v7-a-cacador-camuflado', 'v7-b-mordedura-venenosa', ...CENARIOS.map((c) => c.id)].map((id) => `${id}.json`);
indice.cenarios = [...v7, ...indice.cenarios.filter((f) => !v7.includes(f))];
await writeFile(arqIndice, JSON.stringify(indice, null, 2) + '\n');
