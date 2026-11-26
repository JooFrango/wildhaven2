// População de teste do laboratório: mistura de espécies reais e distribuição por células navegáveis.
// Fica em src/eco (e não em scripts/) porque o navegador também monta os níveis de população com isto.
import { Rng } from './rng.js';

// Mistura fixa, em partes por 100. Espécies reais do laboratório, todas de savana.
const MISTURA = [
  { especie: 'velsari', partes: 26, grupo: true },   // herbívoro médio social (grupos com filhotes)
  { especie: 'cromatil', partes: 14 },               // herbívoro pequeno
  { especie: 'tarruco', partes: 12 },                // herbívoro médio
  { especie: 'folhisco', partes: 12 },               // presa pequena
  { especie: 'frutavil', partes: 10 },               // herbívoro pequeno, sem capacidade especial
  { especie: 'ferrunco', partes: 6 },                // herbívoro grande, come cupins
  { especie: 'varrisco', partes: 6 },                // predador
  { especie: 'boscaranha', partes: 4 },              // predador com veneno e emboscada
  { especie: 'proto-cacador-camuflado', partes: 2 }, // predador com camuflagem óptica
  { especie: 'carniroca', partes: 5, voador: true }, // voador necrófago
  { especie: 'pica-termita', partes: 3, voador: true }, // voador especialista em cupins
];

export function celulasNavegaveis(t) {
  const livres = [];
  for (let j = 0; j < t.ny; j++) for (let i = 0; i < t.nx; i++) {
    const k = j * t.nx + i;
    if (t.bloqueio[k] || t.agua[k] > t.alturas[k]) continue;
    livres.push(k);
  }
  return livres;
}

// Distribui `total` animais pela mistura, em células navegáveis sorteadas. Determinístico pela semente.
export function gerarPopulacoes(cfg, terreno, total, { semente = 1, modo = 'ecologico' } = {}) {
  const rng = new Rng(semente * 7919 + 13);
  const livres = celulasNavegaveis(terreno);
  if (!livres.length) throw new Error('terreno sem célula navegável');
  // No modo estresse a mesma contagem cabe num quadrado central de 1/9 da área: densidade artificial.
  const centro = { x: terreno.largura / 2, y: terreno.profundidade / 2 }, lado = Math.min(terreno.largura, terreno.profundidade) / 3;
  const pontos = modo === 'estresse'
    ? livres.filter((k) => {
      const x = (k % terreno.nx) * terreno.res, y = Math.floor(k / terreno.nx) * terreno.res;
      return Math.abs(x - centro.x) < lado / 2 && Math.abs(y - centro.y) < lado / 2;
    })
    : livres;
  const base = pontos.length ? pontos : livres;
  const ponto = () => {
    const k = base[Math.floor(rng.entre(0, base.length - 1e-9))];
    return { x: +((k % terreno.nx) * terreno.res + rng.entre(0, terreno.res)).toFixed(2), y: +(Math.floor(k / terreno.nx) * terreno.res + rng.entre(0, terreno.res)).toFixed(2) };
  };
  const somaPartes = MISTURA.reduce((s, m) => s + m.partes, 0);
  const populacoes = [];
  let feitos = 0;
  for (const [idx, m] of MISTURA.entries()) {
    if (!cfg.especies[m.especie]) throw new Error('espécie fora do índice: ' + m.especie);
    // O último item recebe a sobra do arredondamento para o total bater exatamente.
    const n = idx === MISTURA.length - 1 ? total - feitos : Math.round((total * m.partes) / somaPartes);
    feitos += n;
    if (n <= 0) continue;
    if (m.grupo) {
      // Grupos de 8 (6 adultos + 2 filhotes); a sobra vira um grupo menor.
      const grupos = [];
      for (let resta = n; resta > 0;) {
        const tam = Math.min(8, resta); resta -= tam;
        const p = ponto();
        grupos.push({ ...p, raio: 12, adultos: Math.max(1, tam - 2), filhotes: Math.min(2, tam - 1), raioCasa: 400, fome: [20, 70], sede: [20, 70] });
      }
      populacoes.push({ especie: m.especie, grupos });
      continue;
    }
    const individuos = [];
    for (let i = 0; i < n; i++) {
      const p = ponto();
      const o = { id: `${m.especie}-${i + 1}`, ...p, direcaoGraus: Math.round(rng.entre(0, 360)), raioCasa: 350, fome: [25, 75], sede: [20, 65], energia: [70, 98] };
      if (m.voador) o.altitudeInicialM = +rng.entre(8, 30).toFixed(1);
      individuos.push(o);
    }
    populacoes.push({ especie: m.especie, individuos });
  }
  return populacoes;
}

// Quantis em ms, já ordenado.
const quantil = (ord, p) => +ord[Math.min(ord.length - 1, Math.floor(ord.length * p))].toFixed(3);
