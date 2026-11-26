#!/usr/bin/env node
// Mede os cenários V7 em várias sementes: contagem de eventos, mortes por causa e custo por passo.
// uso: node scripts/v7-medir.mjs [--sementes 1-10] [--cenarios id,id] [--json arquivo]
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { criarMundoEco, passoEco, hashMundo } from '../src/eco/mundo.js';
import { carregarConfigEcoNode } from '../src/node/eco-node.js';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const [s0, s1] = arg('sementes', '1-10').split('-').map(Number);
const cfg = await carregarConfigEcoNode();
const ids = arg('cenarios', Object.keys(cfg.cenarios).filter((c) => c.startsWith('v7-')).join(',')).split(',').filter(Boolean);
const EVENTOS = ['inoculacao', 'mordida_seca', 'veneno_expirou', 'camuflagem_ligou', 'camuflagem_quebrou', 'calor_detectado', 'caca_inicio', 'ferimento', 'golpe_errou',
  'decolagem', 'pouso', 'queda', 'bando_dispersou', 'bando_reagrupou', 'emboscada_armada', 'emboscada_disparou', 'emboscada_desistiu', 'cupinzeiro_achado', 'cupinzeiro_esgotado',
  'clima_inicio', 'clima_fim', 'busca_abrigo', 'carcaca_estagio', 'ossos_reciclados'];
const saida = {};
for (const id of ids) {
  const cen = cfg.cenarios[id];
  const linhas = [];
  for (let s = s0; s <= (s1 ?? s0); s++) {
    const m = criarMundoEco(cfg, cen, s);
    const tempos = [];
    const estados = {};
    while (m.t < cen.duracaoSeg - 1e-9) {
      const t0 = performance.now(); passoEco(m); tempos.push(performance.now() - t0);
      for (const a of m.vivos) (estados[a.id] ??= new Set()).add(a.estado);
    }
    tempos.sort((a, b) => a - b);
    const q = (p) => +tempos[Math.min(tempos.length - 1, Math.floor(tempos.length * p))].toFixed(3);
    const ev = Object.fromEntries(EVENTOS.map((e) => [e, m.metricas.eventos[e] ?? 0]).filter(([, n]) => n));
    linhas.push({ semente: s, hash: hashMundo(m), mortes: { ...m.metricas.mortes }, eventos: ev, vivos: m.vivos.length, cpuMs: { p50: q(0.5), p95: q(0.95), p99: q(0.99), pior: q(1) },
      estados: Object.fromEntries(Object.entries(estados).map(([k, v]) => [k, [...v]])) });
    console.log(`${id} s${s} hash ${hashMundo(m)} | mortes ${JSON.stringify(m.metricas.mortes)} | ${JSON.stringify(ev)} | p95 ${q(0.95)} ms, pior ${q(1)} ms`);
  }
  saida[id] = linhas;
}
if (arg('json')) await writeFile(arg('json'), JSON.stringify(saida, null, 1));
