#!/usr/bin/env node
// Roda os cenários das dunas com várias sementes e grava o relatório (JSON + Markdown) exigido na entrega:
// espécies, GLBs e hashes, sementes, profundidades, distâncias, tempo dentro e fora da areia, mergulhos,
// emergências, estímulos, investigações, perseguições, ataques, ferimentos, fugas, mortes, colisões
// bloqueadas e custo de CPU.
//
// Uso: node scripts/dunas-relatorio.mjs [--cenarios dunas-a-natacao,...] [--sementes 1-3] [--saida resultados/dunas]
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { criarMundoEco, passoEco } from '../src/eco/mundo.js';
import { carregarConfigEcoNode } from '../src/node/eco-node.js';
import { RAIZ_LAB } from '../src/node/carregar-node.js';
import { volumeAreia } from '../src/eco/areia.js';
import { lerArgs } from './simular-args.mjs';

const RAIZ_REPO = resolve(RAIZ_LAB, '../..');
const args = lerArgs(process.argv.slice(2));
const CFG = await carregarConfigEcoNode();
const cenarios = String(args.cenarios ?? 'dunas-a-natacao,dunas-b-arraia,dunas-c-vibracoes,dunas-d-emboscada,dunas-e-ecossistema,dunas-f-travessia').split(',');
const sementes = faixa(String(args.sementes ?? '1-3'));
const saida = args.saida ?? 'resultados/dunas';

const glbs = {};
for (const e of Object.values(CFG.especies)) {
  if (!e.subsolo || glbs[e.id]) continue;
  const buf = await readFile(join(RAIZ_REPO, e.modelo.glb)).catch(() => null);
  glbs[e.id] = buf ? { glb: e.modelo.glb, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') } : { glb: e.modelo.glb, erro: 'arquivo ausente' };
}

const linhas = [];
for (const id of cenarios) {
  const cen = CFG.cenarios[id];
  if (!cen) throw new Error(`cenário desconhecido: ${id}`);
  for (const s of sementes) linhas.push(rodar(cen, s));
}

// Linha de base de CPU: o mesmo motor sem nenhuma espécie das dunas, para comparar o custo por passo.
const base = [];
for (const s of sementes) { const c = CFG.cenarios['savana-viva']; if (c) { const l = rodar(c, s); base.push({ cenario: c.id, semente: s, msPorPasso: l.msPorPasso, passos: l.passos }); } }
const relatorio = { geradoEm: new Date().toISOString(), glbs, sementes, linhaDeBase: base, execucoes: linhas };
await mkdir(join(RAIZ_LAB, saida), { recursive: true });
await writeFile(join(RAIZ_LAB, saida, 'dunas.json'), JSON.stringify(relatorio, null, 1));
await writeFile(join(RAIZ_LAB, saida, 'RELATORIO-DUNAS.md'), markdown(relatorio));
console.log('gravado em', saida);
for (const l of linhas) console.log(l.cenario, 'semente', l.semente, '|', JSON.stringify(l.resumo));

function rodar(cen, semente) {
  const m = criarMundoEco(CFG, cen, semente, { guardarDecisoes: true });
  volumeAreia(m.terreno); // fora do cronômetro: derivação do volume é feita uma vez por terreno
  const t0 = process.hrtime.bigint();
  const passos = Math.round(cen.duracaoSeg / cen.dt);
  for (let i = 0; i < passos; i++) passoEco(m);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const porAnimal = [];
  for (const a of [...m.animais]) {
    if (!a.subsolo) continue;
    const s = a.subsolo;
    porAnimal.push({
      id: a.id, especie: a.especie.id, vivo: a.vivo, causaMorte: a.causaMorte,
      profundidadeMaxM: +(s.profMax ?? 0).toFixed(2), profundidadeFinalM: +s.prof.toFixed(2),
      metrosSubsolo: +s.metrosSubsolo.toFixed(1), tempoSubsoloSeg: +s.tempoSubsolo.toFixed(1), tempoSuperficieSeg: +s.tempoSuperficie.toFixed(1),
      mergulhos: s.mergulhos, emergencias: s.emergencias, colisoesBloqueadas: s.bloqueios,
      estimulosSentidos: a.totalVibracoes ?? 0, pistasNaMemoria: a.memoria.vibracoes?.size ?? 0,
      energiaFinal: +a.energia.toFixed(1), fomeFinal: +a.fome.toFixed(1), estadoFinal: a.estado,
    });
  }
  const ev = (t) => m.eventos.filter((e) => e.tipo === t).length;
  return {
    cenario: cen.id, semente, terreno: m.terreno.origem?.hexes?.map((h) => h.id) ?? null,
    hash: m.hash, cpuMs: +ms.toFixed(0), msPorPasso: +(ms / passos).toFixed(3), passos,
    resumo: {
      mergulhos: porAnimal.reduce((x, a) => x + a.mergulhos, 0),
      emergencias: porAnimal.reduce((x, a) => x + a.emergencias, 0),
      metrosSubsolo: +porAnimal.reduce((x, a) => x + a.metrosSubsolo, 0).toFixed(0),
      colisoesBloqueadas: porAnimal.reduce((x, a) => x + a.colisoesBloqueadas, 0),
      investigacoes: m.eventos.filter((e) => e.tipo === 'investigacao_vibracao').length, perseguicoes: ev('perseguicao_inicio'),
      ataques: ev('ataque_inicio'), ferimentos: ev('ferimento'),
      // A fuga das espécies das dunas é uma decisão (mergulho ou afastamento), não um evento do motor terrestre.
      fugas: (m.decisoes ?? []).filter((x) => x.codigo.startsWith('fuga') || x.codigo === 'mergulho_de_fuga').length,
      mortes: ev('morte'), msPorPasso: +(ms / passos).toFixed(3),
    },
    animais: porAnimal,
  };
}

function markdown(r) {
  const l = [`# Relatório — IA das dunas e simulação subterrânea`, '', `Gerado em ${r.geradoEm}. Sementes: ${r.sementes.join(', ')}.`, '', '## GLBs reais usados', '', '| Espécie | GLB | bytes | SHA-256 |', '|---|---|---:|---|'];
  for (const [id, g] of Object.entries(r.glbs)) l.push(`| ${id} | \`${g.glb}\` | ${g.bytes ?? '—'} | \`${g.sha256 ?? g.erro}\` |`);
  l.push('', '## Execuções', '', '| Cenário | Semente | Hexágonos | Mergulhos | Emergências | m sob a areia | Colisões bloqueadas | Ataques | Mortes | ms/passo |', '|---|---:|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const e of r.execucoes) {
    const s = e.resumo;
    l.push(`| ${e.cenario} | ${e.semente} | ${e.terreno?.join('+') ?? '—'} | ${s.mergulhos} | ${s.emergencias} | ${s.metrosSubsolo} | ${s.colisoesBloqueadas} | ${s.ataques} | ${s.mortes} | ${s.msPorPasso} |`);
  }
  if (r.linhaDeBase?.length) { l.push('', '## Linha de base de CPU (savana-viva, sem espécies das dunas)', '', '| Semente | ms/passo |', '|---:|---:|'); for (const b of r.linhaDeBase) l.push(`| ${b.semente} | ${b.msPorPasso} |`); }
  l.push('', '## Por indivíduo', '', '| Cenário | Semente | Animal | Espécie | prof. máx (m) | m sob a areia | t sob a areia (s) | t na superfície (s) | mergulhos | emergências | estímulos | pistas | estado final |', '|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const e of r.execucoes) for (const a of e.animais)
    l.push(`| ${e.cenario} | ${e.semente} | ${a.id} | ${a.especie} | ${a.profundidadeMaxM} | ${a.metrosSubsolo} | ${a.tempoSubsoloSeg} | ${a.tempoSuperficieSeg} | ${a.mergulhos} | ${a.emergencias} | ${a.estimulosSentidos} | ${a.pistasNaMemoria} | ${a.estadoFinal}${a.vivo ? '' : ` (morto: ${a.causaMorte})`} |`);
  return l.join('\n') + '\n';
}

function faixa(s) {
  const out = [];
  for (const p of s.split(',')) {
    const [a, b] = p.split('-').map(Number);
    for (let i = a; i <= (b ?? a); i++) out.push(i);
  }
  return out;
}
