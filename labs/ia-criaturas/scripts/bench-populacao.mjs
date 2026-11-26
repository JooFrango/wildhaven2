#!/usr/bin/env node
// Benchmark de população: quantos animais o núcleo aguenta num hexágono real, sem desligar sistema nenhum.
// Mede o passo da simulação pura (sem renderizador) e checa os invariantes durante a execução.
//
//   node scripts/bench-populacao.mjs --populacoes 25,50,100,200 --segundos 120 --sementes 1-3
//   node scripts/bench-populacao.mjs --cenario laboratorio-populacao-hex-5km --modo estresse --json saida.json
//
// `--modo ecologico` espalha a população por todo o hexágono; `--modo estresse` concentra a mesma
// contagem numa fração da área, para achar o limite técnico sem fingir que aquela densidade é plausível.
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { criarMundoEco, passoEco, hashMundo } from '../src/eco/mundo.js';
import { verificarInvariantes } from '../src/eco/invariantes.js';
import { carregarConfigEcoNode } from '../src/node/eco-node.js';
import { gerarPopulacoes } from '../src/eco/populacao.js';

import { lerArgs } from './simular-args.mjs';

// Quantis em ms, sobre a lista já ordenada.
const quantil = (ord, p) => +ord[Math.min(ord.length - 1, Math.floor(ord.length * p))].toFixed(3);

export function medirPopulacao(cfg, cenarioBase, total, { semente = 1, segundos = 120, modo = 'ecologico', checarInvariantes = true } = {}) {
  const terrenoBase = criarMundoEco(cfg, { ...cenarioBase, populacoes: [] }, semente).terreno;
  const populacoes = gerarPopulacoes(cfg, terrenoBase, total, { semente, modo });
  const cen = { ...cenarioBase, populacoes };
  const t0 = performance.now();
  const m = criarMundoEco(cfg, cen, semente);
  const msCriar = performance.now() - t0;
  const tempos = [];
  let violacoes = [];
  const periodo = Math.round(20 / cen.dt);
  const memIni = process.memoryUsage();
  while (m.t < segundos - 1e-9) {
    const a = performance.now();
    passoEco(m);
    tempos.push(performance.now() - a);
    if (checarInvariantes && m.tick % periodo === 0 && !violacoes.length) violacoes = verificarInvariantes(m).slice(0, 3);
  }
  const mem = process.memoryUsage();
  // Os primeiros passos pagam a montagem do mundo e a primeira rota de cada animal; ficam fora dos
  // quantis de regime, mas o pior passo absoluto continua reportado.
  const regime = tempos.slice(Math.min(10, tempos.length - 1));
  const ord = [...regime].sort((x, y) => x - y);
  const piorAbsoluto = +Math.max(...tempos).toFixed(3);
  const somaMs = tempos.reduce((s, v) => s + v, 0);
  const vivos = m.vivos.length;
  return {
    pedido: total, criados: m.animais.length, vivos, semente, modo,
    msCriar: +msCriar.toFixed(1),
    passo: { p50: quantil(ord, 0.5), p95: quantil(ord, 0.95), p99: quantil(ord, 0.99), pior: quantil(ord, 1), piorAbsoluto, media: +(somaMs / tempos.length).toFixed(3) },
    // Fator de tempo real: quantos segundos simulados por segundo de parede. < 1 = a simulação atrasa.
    fatorTempoReal: +(segundos / (somaMs / 1000)).toFixed(2),
    msPorAnimalSeg: +(somaMs / Math.max(1, m.animais.length) / segundos).toFixed(4),
    buscasCaminho: m.metricas.buscasCaminho,
    custo: { n1: +m.custo.n1.toFixed(0), n2: +m.custo.n2.toFixed(0), n3: +m.custo.n3.toFixed(0), passosN1: m.custo.passosN1, passosN2: m.custo.passosN2, passosN3: m.custo.passosN3 },
    mortes: { ...m.metricas.mortes }, nascimentos: m.metricas.eventos.maturidade ?? 0,
    eventos: Object.keys(m.metricas.eventos).length,
    falhas: m.metricas.falhas.length, violacoes,
    heapMB: +(mem.heapUsed / 1048576).toFixed(1), rssMB: +(mem.rss / 1048576).toFixed(1), heapCresceuMB: +((mem.heapUsed - memIni.heapUsed) / 1048576).toFixed(1),
    hash: hashMundo(m),
  };
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('bench-populacao.mjs')) {
  const args = lerArgs(process.argv.slice(2));
  const cfg = await carregarConfigEcoNode();
  const cenarioId = args.cenario ?? 'laboratorio-populacao-hex-5km';
  const cenarioBase = cfg.cenarios[cenarioId];
  if (!cenarioBase) throw new Error('cenário desconhecido: ' + cenarioId);
  const populacoes = String(args.populacoes ?? '25,50,100,200,400,800').split(',').map(Number);
  const [s0, s1] = String(args.sementes ?? '1').split('-').map(Number);
  const segundos = Number(args.segundos ?? 120);
  const modo = args.modo ?? 'ecologico';
  const limiteMs = Number(args.limitePasso ?? 200); // segurança: acima disso, para de subir a população
  const linhas = [];
  console.log(`cenário ${cenarioId} · modo ${modo} · ${segundos} s simulados · sementes ${s0}-${s1 ?? s0}`);
  for (const total of populacoes) {
    let parar = false;
    for (let s = s0; s <= (s1 ?? s0); s++) {
      const r = medirPopulacao(cfg, cenarioBase, total, { semente: s, segundos, modo });
      linhas.push(r);
      console.log(`${String(total).padStart(5)} animais s${s} | vivos ${r.vivos} | passo p50 ${r.passo.p50} p95 ${r.passo.p95} p99 ${r.passo.p99} pior ${r.passo.pior} ms`
        + ` | tempo real ${r.fatorTempoReal}x | ${r.msPorAnimalSeg} ms/animal/s | buscas ${r.buscasCaminho} | rss ${r.rssMB} MB`
        + ` | mortes ${JSON.stringify(r.mortes)} | falhas ${r.falhas}${r.violacoes.length ? ' | VIOLAÇÃO ' + r.violacoes[0] : ''}`);
      if (r.passo.p95 > limiteMs) parar = true;
    }
    if (parar) { console.log(`parando: p95 passou de ${limiteMs} ms em ${total} animais`); break; }
  }
  if (args.json) await writeFile(args.json, JSON.stringify({ cenario: cenarioId, modo, segundos, linhas }, null, 1));
}
