#!/usr/bin/env node
// Benchmark do Hunter Lab, sem navegador: custo de simulação por número de Hunters.
//
//   node scripts/bench-hunters.mjs [--niveis 1,2,5,10,20,50] [--segundos 60] [--semente 1] [--json saida.json]
//
// O que cada número separa, e o que ele NÃO separa:
// - `msPasso*`: tempo de um passo de simulação inteiro (decisão + percepção + locomoção + colisão + combate).
// - `msSemDecisao`: a MESMA corrida com a decisão trocada por uma intenção fixa. ATENÇÃO: isto NÃO é o custo
//   da IA. Sem decidir, os Hunters ficam parados e amontoados, e a resolução de sobreposição fica mais cara —
//   nas medidas feitas, a corrida sem decisão chegou a ser MAIS LENTA que a com decisão. O número está aqui
//   como referência de um mundo com os mesmos corpos e sem escolha, e é assim que deve ser lido.
// - Separar colisão, física e percepção exigiria instrumentar o núcleo, e este laboratório não altera o núcleo
//   para medir a si mesmo. Para isso existe `node --cpu-prof`, usado no laboratório de criaturas.
// - Nada aqui é FPS. Desenho e animação são medidos no navegador (scripts/testar-hunter-lab-navegador.mjs).
import { writeFile } from 'node:fs/promises';
import { carregarHunterLab } from '../src/node-hunters.mjs';
import { criarMundoHunters, passoHunters } from '../src/mundo-hunters.js';
import { hashMundo } from '../../ia-criaturas/src/eco/mundo.js';
import { verificarInvariantes } from '../../ia-criaturas/src/eco/invariantes.js';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((s) => {
  const [k, ...v] = s.trim().split(/\s+/);
  return [k, v.join(' ') || true];
}));
const niveis = String(args.niveis ?? '1,2,5,10,20,50').split(',').map(Number);
const segundos = Number(args.segundos ?? 60);
const semente = Number(args.semente ?? 1);

const LAB = await carregarHunterLab();
const ARMAS = ['lanca', 'espada', 'maos'];
const ARMADURAS = [null, 'leve', 'pesada'];

// Hunters espalhados num anel, metade em cada equipe: todos se encontram, ninguém nasce dentro do outro.
function cenario(n) {
  const hunters = [];
  const cx = 150, cy = 150, raio = Math.max(8, 2.2 * Math.sqrt(n) + 6);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    hunters.push({
      id: `h${i}`, nome: `H${i}`, equipe: i % 2 ? 'azul' : 'verde',
      x: cx + Math.cos(ang) * raio, y: cy + Math.sin(ang) * raio,
      direcaoGraus: (ang * 180) / Math.PI + 180,
      equipamento: { arma: ARMAS[i % 3], armadura: ARMADURAS[i % 3] },
      personalidade: { agressividade: 0.4 + (i % 5) * 0.12, cautela: 0.6 - (i % 5) * 0.1 },
    });
  }
  return {
    id: `bench-${n}`, nome: `bench ${n}`, dt: 0.1, duracaoSeg: segundos, modoCombate: 'treino',
    relogio: { segundosPorDia: 900, diaInicial: 20, horaInicial: 10 },
    clima: { chanceIncendio: 0 },
    terreno: { tipo: 'procedural', largura: 300, profundidade: 300, res: 1, amplitude: 1, capim: 40 },
    populacoes: [], hunters,
  };
}

const quantil = (v, q) => (v.length ? v[Math.min(v.length - 1, Math.floor(v.length * q))] : 0);

function medir(n, { decisao = true } = {}) {
  const cen = cenario(n);
  const cfg = { ...LAB.cfg, cenarios: { ...LAB.cfg.cenarios, [cen.id]: cen } };
  const m = criarMundoHunters(cfg, cen, semente, { fichaHunter: LAB.fichaHunter, equipamentos: LAB.equipamentos });
  if (!decisao) for (const a of m.hunters) a.comandoTeste = () => ({ estado: 'parado', codigo: 'sem_decisao', motivo: 'medida sem decisão', ritmo: 'parado' });
  const passos = Math.round(segundos / m.dt);
  const tempos = [];
  const mem0 = process.memoryUsage().heapUsed;
  for (let i = 0; i < passos; i++) {
    const t0 = performance.now();
    passoHunters(m);
    tempos.push(performance.now() - t0);
  }
  tempos.sort((a, b) => a - b);
  const total = tempos.reduce((s, v) => s + v, 0);
  return {
    hunters: n, passos, decisao,
    msPassoP50: +quantil(tempos, 0.5).toFixed(3), msPassoP95: +quantil(tempos, 0.95).toFixed(3),
    msPassoP99: +quantil(tempos, 0.99).toFixed(3), msPassoPior: +tempos[tempos.length - 1].toFixed(3),
    msPorHunterSeg: +(total / passos / m.dt / Math.max(1, n)).toFixed(4),
    fatorTempoReal: +((segundos * 1000) / total).toFixed(1),
    memoriaMB: +((process.memoryUsage().heapUsed - mem0) / 1048576).toFixed(1),
    vivos: m.vivos.length, hash: hashMundo(m), resultado: m.resultado?.motivo ?? 'em andamento',
    invariantes: verificarInvariantes(m).length,
    eventos: { ataques: m.metricas.eventos.ataque_inicio ?? 0, ferimentos: m.metricas.eventos.ferimento ?? 0 },
  };
}

const linhas = [];
for (const n of niveis) {
  const com = medir(n, { decisao: true });
  const sem = medir(n, { decisao: false });
  const linha = { ...com, msSemDecisaoP50: sem.msPassoP50 };
  linhas.push(linha);
  console.log(`${String(n).padStart(3)} Hunters | passo p50 ${linha.msPassoP50} p95 ${linha.msPassoP95} p99 ${linha.msPassoP99} pior ${linha.msPassoPior} ms`
    + ` | sem decisão ${linha.msSemDecisaoP50} ms (ver nota no cabeçalho)`
    + ` | ${linha.msPorHunterSeg} ms por Hunter·s | ${linha.fatorTempoReal}× tempo real`
    + ` | ${linha.eventos.ataques} ataques, ${linha.eventos.ferimentos} ferimentos | invariantes ${linha.invariantes} | ${linha.memoriaMB} MB`);
  if (linha.invariantes) console.log('  ATENÇÃO: invariantes violados nesta medida.');
}
if (args.json) await writeFile(String(args.json), JSON.stringify({ semente, segundos, linhas }, null, 1));
