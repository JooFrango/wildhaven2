#!/usr/bin/env node
// Compara táticas de caça em situações equivalentes, em várias sementes. Mesmo terreno, mesma presa, mesma
// posição inicial; muda só o predador (ou a capacidade ligada/desligada). Nenhuma probabilidade é ajustada:
// o resultado é o que o combate físico produz.
// uso: node scripts/v7-taticas.mjs [--sementes 1-30] [--json arquivo]
import { writeFile } from 'node:fs/promises';
import { criarMundoEco, passoEco } from '../src/eco/mundo.js';
import { carregarConfigEcoNode } from '../src/node/eco-node.js';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const [s0, s1] = arg('sementes', '1-30').split('-').map(Number);
const cfg = await carregarConfigEcoNode();

const TERRENO = { tipo: 'procedural', largura: 160, profundidade: 120, res: 1, amplitude: 1.2, capim: 30,
  rochas: [{ x: 70, y: 44, raio: 2.2, altura: 1.8 }, { x: 96, y: 78, raio: 2.5, altura: 2 }],
  arbustos: [{ x: 66, y: 60, raio: 5, ocultacao: 80, alimento: 25 }, { x: 84, y: 54, raio: 5, ocultacao: 80, alimento: 25 }, { x: 78, y: 72, raio: 5, ocultacao: 75, alimento: 20 }, { x: 100, y: 62, raio: 6, ocultacao: 80, alimento: 25 }] };
const base = (id, populacoes, extra = {}) => ({ id, nome: id, dt: 0.1, duracaoSeg: 240, relogio: { segundosPorDia: 600, diaInicial: 30, horaInicial: 17.2, diasPorAno: 365 },
  clima: { chanceIncendio: 0, chanceChuvaChuvosa: 0, chanceChuvaSeca: 0, temperaturaC: 20 }, terreno: TERRENO, populacoes, ...extra });
const pred = (especie, n = 1, x0 = 52) => ({ especie, individuos: Array.from({ length: n }, (_, i) => ({ id: `pred${i + 1}`, x: x0 - i * 3, y: 60 + i * 8, direcaoGraus: 0, fome: [75, 85], sede: [10, 20], energia: [92, 98] })) });
const presaSo = (especie) => ({ especie, individuos: [{ id: 'presa1', x: 86, y: 58, raioCasa: 20, fome: [55, 70], sede: [10, 20], energia: [80, 95] }] });
const presaGrupo = (especie, n) => ({ especie, grupos: [{ x: 86, y: 58, raio: 4, adultos: n, raioCasa: 20 }] });

// `desligar`: capacidades removidas de uma CÓPIA da ficha, só nesta comparação.
const CASOS = [
  { id: 'comum (Varrisco) × Velsari isolado', pops: [pred('varrisco'), presaSo('velsari')] },
  { id: 'camuflado × Velsari isolado', pops: [pred('proto-cacador-camuflado'), presaSo('velsari')] },
  { id: 'camuflado SEM camuflagem × Velsari isolado', pops: [pred('proto-cacador-camuflado'), presaSo('velsari')], desligar: { 'proto-cacador-camuflado': ['camuflagemAtiva'] } },
  { id: 'dois Varriscos (par) × Velsari isolado', pops: [pred('varrisco', 2), presaSo('velsari')], extra: { pares: [['pred1', 'pred2']] } },
  { id: 'comum (Varrisco) × 5 Velsaris', pops: [pred('varrisco'), presaGrupo('velsari', 5)] },
  { id: 'camuflado × 5 Velsaris', pops: [pred('proto-cacador-camuflado'), presaGrupo('velsari', 5)] },
  // A Boscaranha enxerga um Folhisco a ~9 m: começa a 10 m da presa e tem 900 s (emboscada é espera).
  { id: 'venenoso com emboscada (Boscaranha) × Folhisco isolado', pops: [pred('boscaranha', 1, 76), presaSo('folhisco')] },
  { id: 'venenoso SEM emboscada × Folhisco isolado', pops: [pred('boscaranha', 1, 76), presaSo('folhisco')], desligar: { boscaranha: ['taticasDeEmboscada'] } },
  { id: 'SEM veneno com emboscada × Folhisco isolado', pops: [pred('boscaranha', 1, 76), presaSo('folhisco')], desligar: { boscaranha: ['veneno'] } },
  { id: 'venenoso com emboscada × 5 Folhiscos', pops: [pred('boscaranha', 1, 76), presaGrupo('folhisco', 5)] },
];

const saida = [];
for (const caso of CASOS) {
  const especies = { ...cfg.especies };
  for (const [esp, caps] of Object.entries(caso.desligar ?? {})) { especies[esp] = { ...especies[esp] }; for (const c of caps) delete especies[esp][c]; }
  const cen = base(caso.id, caso.pops, { ...caso.extra, ...(caso.id.includes('Folhisco') ? { duracaoSeg: 900 } : {}) });
  const r = { caso: caso.id, n: 0, cacas: 0, emboscadas: 0, golpes: 0, acertos: 0, surpresa: 0, inoculacoes: 0, mortes: 0, tAbate: [], camoGasto: 0 };
  for (let s = s0; s <= s1; s++) {
    const m = criarMundoEco({ ...cfg, especies, cenarios: { [cen.id]: cen } }, cen, s);
    while (m.t < cen.duracaoSeg - 1e-9) passoEco(m);
    r.n++;
    const ev = m.metricas.eventos;
    if (ev.caca_inicio) r.cacas++;
    r.emboscadas += ev.emboscada_disparou ?? 0;
    r.golpes += ev.ataque_inicio ?? 0; r.acertos += ev.ferimento ?? 0; r.inoculacoes += ev.inoculacao ?? 0;
    const morte = m.eventos.find((e) => e.tipo === 'morte' && !String(e.id).startsWith('pred'));
    if (morte) { r.mortes++; r.tAbate.push(morte.t ?? m.t); }
    for (const a of m.animais) r.camoGasto += a.camuflagem?.energiaGasta ?? 0;
  }
  const linha = { caso: r.caso, sementes: r.n, cacou: r.cacas, emboscadasDisparadas: r.emboscadas, golpes: r.golpes, acertos: r.acertos, inoculacoes: r.inoculacoes, presasMortas: r.mortes,
    taxaAbate: +(r.mortes / r.n).toFixed(3), energiaCamuflagemMedia: +(r.camoGasto / r.n).toFixed(1) };
  saida.push(linha);
  console.log(`${linha.caso.padEnd(58)} | caçou ${String(linha.cacou).padStart(2)}/${r.n} | emboscadas ${String(linha.emboscadasDisparadas).padStart(2)} | golpes ${String(linha.golpes).padStart(3)} acertos ${String(linha.acertos).padStart(3)} | inoc. ${String(linha.inoculacoes).padStart(2)} | abates ${String(linha.presasMortas).padStart(2)} (${(linha.taxaAbate * 100).toFixed(0)}%)${linha.energiaCamuflagemMedia ? ` | camuflagem ${linha.energiaCamuflagemMedia} en.` : ''}`);
}
if (arg('json')) await writeFile(arg('json'), JSON.stringify({ sementes: `${s0}-${s1}`, casos: saida }, null, 1));
