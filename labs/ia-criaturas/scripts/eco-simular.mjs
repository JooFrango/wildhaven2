#!/usr/bin/env node
// Relatório do ecossistema V2: encontros no bebedouro (várias sementes) + dinâmica populacional de longo prazo + custos.
// Uso: npm run eco [-- --sementes 1-20 --segundos 300 --anos 2]
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { rodarCenario } from '../src/eco/analise.js';
import { criarMundoEco, passoEco, hashMundo } from '../src/eco/mundo.js';
import { interpretarSementes } from '../src/core/simulacao.js';
import { carregarConfigEcoNode } from '../src/node/eco-node.js';
import { RAIZ_LAB } from '../src/node/carregar-node.js';
import { lerArgs } from './simular-args.mjs';

const args = lerArgs(process.argv.slice(2));
const cfg = await carregarConfigEcoNode();
const sementes = interpretarSementes(String(args.sementes ?? '1-20'));
const segundos = Number(args.segundos ?? 300);
const anos = Number(args.anos ?? 2);
const out = { geradoEm: new Date().toISOString(), sementes: String(args.sementes ?? '1-20'), segundos, encontros: {}, populacao: null };

for (const id of ['bebedouro-real', 'bebedouro']) {
  const res = sementes.map((s) => rodarCenario(cfg, id, s, { segundos }).resumo);
  const rot = {}, ex = {};
  for (const r of res) for (const k of r.rotulos) { rot[k] = (rot[k] ?? 0) + 1; ex[k] ??= r.semente; }
  const soma = (f) => res.reduce((s, r) => s + f(r), 0);
  const persegs = res.flatMap((r) => Object.entries(r.perseguicoesPorDesfecho));
  const porDesfecho = {}; for (const [k, v] of persegs) porDesfecho[k] = (porDesfecho[k] ?? 0) + v;
  const fases = {}; for (const r of res) for (const [k, v] of Object.entries(r.conflitosPorFaseFinal)) fases[k] = (fases[k] ?? 0) + v;
  const motivos = {}; for (const r of res) for (const [k, v] of Object.entries(r.conflitosPorMotivo)) motivos[k] = (motivos[k] ?? 0) + v;
  const falhas = res.filter((r) => r.falhas).map((r) => ({ semente: r.semente, falhas: r.primeirasFalhas }));
  out.encontros[id] = {
    nome: cfg.cenarios[id].nome, n: res.length, rotulos: rot, exemplos: ex,
    predacoes: soma((r) => r.predacoes), presasFeridasVivas: soma((r) => r.presasFeridasVivas),
    perseguicoes: soma((r) => r.perseguicoes), perseguicoesPorDesfecho: porDesfecho,
    ataques: soma((r) => r.ataques), golpesQueFeriram: soma((r) => r.golpes), esquivas: soma((r) => r.esquivas), golpesErrados: soma((r) => r.errados),
    alarmes: soma((r) => r.alarmes), alarmesOuvidos: soma((r) => r.alarmesOuvidos), protecaoFilhote: soma((r) => r.protecaoFilhote),
    conflitos: soma((r) => r.conflitos), conflitosPorFaseFinal: fases, conflitosPorMotivo: motivos,
    oportunidadesFuga: soma((r) => r.oportunidadesFuga), escapesDuranteDisputa: soma((r) => r.escapesDuranteDisputa),
    mortesCombate: soma((r) => r.mortes.combate ?? 0), colisoes: soma((r) => r.colisoes), falhas,
    msPorAnimalSegundo: +(res.reduce((s, r) => s + r.custo.msPorAnimalSegundo, 0) / res.length).toFixed(4),
    hashes: res.map((r) => `${r.semente}:${r.hash}`),
  };
  console.log(id, JSON.stringify(rot));
}

// Dinâmica populacional: savana grande, cinco bandos + tarrucos + cromáteis + 1 varrisco (proporção viável), nível 3, vários anos.
const cenPop = {
  id: 'savana-populacao', nome: 'Savana (população, níveis 2/3)', dt: 4,
  relogio: { segundosPorDia: 240, diaInicial: 1, horaInicial: 8 }, clima: { chanceIncendio: 0.004 },
  terreno: { tipo: 'procedural', largura: 640, profundidade: 520, res: 4, amplitude: 3, capim: 70, lago: { x: 320, y: 260, raio: 28, fundo: 5 }, rochas: [{ x: 200, y: 120, raio: 8, altura: 2 }, { x: 470, y: 380, raio: 7, altura: 2 }], arbustos: [{ x: 150, y: 400, raio: 25, ocultacao: 70, alimento: 25 }, { x: 500, y: 140, raio: 30, ocultacao: 70, alimento: 25 }] },
  populacoes: [
    { especie: 'velsari', grupos: [{ x: 180, y: 180, raio: 8, adultos: 8, fome: 20 }, { x: 460, y: 330, raio: 8, adultos: 8, fome: 20 }, { x: 300, y: 430, raio: 8, adultos: 8, fome: 20 }, { x: 520, y: 120, raio: 8, adultos: 8, fome: 20 }, { x: 110, y: 300, raio: 8, adultos: 8, fome: 20 }] },
    { especie: 'tarruco', individuos: [{ x: 360, y: 140, sexo: 'F' }, { x: 380, y: 160, sexo: 'M' }, { x: 120, y: 420, sexo: 'F' }, { x: 140, y: 380, sexo: 'M' }] },
    { especie: 'cromatil', individuos: [{ x: 205, y: 130, sexo: 'F' }, { x: 210, y: 112, sexo: 'M' }, { x: 465, y: 372, sexo: 'F' }] },
    { especie: 'varrisco', individuos: [{ id: 'v1', x: 300, y: 300, sexo: 'M', fome: 50, territorio: { x: 300, y: 300, raio: 350 } }] },
  ],
};
const cfgPop = { ...cfg, cenarios: { ...cfg.cenarios, [cenPop.id]: cenPop } };
const ini = Date.now();
const m = criarMundoEco(cfgPop, cenPop, 1, { nivelPadrao: 3, eventosDetalhados: false });
const inicial = {}; for (const a of m.vivos) inicial[a.especie.id] = (inicial[a.especie.id] ?? 0) + 1;
while (m.t < 240 * 365 * anos) passoEco(m);
const serie = m.metricas.serie.filter((_, i) => i % 15 === 0).map((s) => ({ dia: s.dia, estacao: s.estacao, populacao: s.populacao, vegetacao: s.vegetacao, fomeMedia: s.fomeMedia, sedeMedia: s.sedeMedia, celulasAgua: s.celulasAgua, feridos: s.feridos, doentes: s.doentes }));
const ev = (t) => m.eventos.filter((e) => e.tipo === t).length;
out.populacao = {
  anos, inicial, final: m.metricas.serie.at(-1)?.populacao ?? {}, mortes: m.metricas.mortes, nascimentos: ev('nascimento') + ev('eclosao'),
  migracoes: m.metricas.migracoes, incendios: m.metricas.incendios, refeicoesMicrofauna: m.metricas.microfauna ?? 0, microfaunaConsumidaKg: +m.microfauna.consumidoKg.toFixed(1), microfaunaKg: +m.microfauna.kg.toFixed(1), microfaunaMax: +m.microfauna.max.toFixed(1), contagios: m.metricas.contagios, predacoes: m.metricas.predacoes,
  ms: Date.now() - ini, custo: m.custo, hash: hashMundo(m), serie,
};
out.populacao.desequilibrios = diagnosticar(out.populacao);
console.log('populacao', JSON.stringify(out.populacao.final), JSON.stringify(out.populacao.mortes), 'microfauna', out.populacao.refeicoesMicrofauna, out.populacao.microfaunaKg, '/', out.populacao.microfaunaMax, 'nasc', out.populacao.nascimentos);

const dir = join(RAIZ_LAB, 'resultados', 'eco');
await mkdir(dir, { recursive: true });
await writeFile(join(dir, 'resumo.json'), JSON.stringify(out, null, 1));
await writeFile(join(dir, 'relatorio.md'), relatorio(out));
console.log('Relatório: resultados/eco/relatorio.md');

function diagnosticar(p) {
  const d = [];
  for (const [esp, n0] of Object.entries(p.inicial)) {
    const nf = p.final[esp] ?? 0;
    if (nf === 0) d.push(`${esp}: extinto localmente (${n0} → 0). Causas a investigar: ${causas(esp, p)}.`);
    else if (nf > n0 * 2.5) d.push(`${esp}: crescimento forte (${n0} → ${nf}); pressão de predação ou capacidade de suporte podem estar baixas.`);
    else if (nf < n0 * 0.4) d.push(`${esp}: queda acentuada (${n0} → ${nf}); ${causas(esp, p)}.`);
  }
  // Balanço energético: demanda anual dos predadores (kg de carne) vs. produção anual de presas (nascimentos × carne aproveitável).
  const dem = Object.entries(p.inicial).filter(([e]) => cfg.especies[e].papel === 'carnivoro').reduce((s, [e, n]) => {
    const esp = cfg.especies[e], massa = (esp.corpo.massaKg[0] + esp.corpo.massaKg[1]) / 2;
    return s + n * esp.necessidades.fomePorDia * 365 * massa * 0.08 / 100;
  }, 0);
  const presas = Object.entries(p.inicial).filter(([e]) => cfg.especies[e].papel === 'herbivoro');
  const carneMedia = presas.reduce((s, [e, n]) => s + n * ((cfg.especies[e].corpo.massaKg[0] + cfg.especies[e].corpo.massaKg[1]) / 2) * 0.55, 0) / Math.max(1, presas.reduce((s, [, n]) => s + n, 0));
  const producao = (p.nascimentos / p.anos) * carneMedia + (p.microfaunaConsumidaKg ?? 0) / p.anos;
  if (dem > producao * 1.2) d.push(`Predadores consomem mais do que as presas repõem: demanda ≈ ${dem.toFixed(0)} kg/ano vs. produção ≈ ${producao.toFixed(0)} kg/ano (${(p.nascimentos / p.anos).toFixed(1)} nascimentos/ano × ${carneMedia.toFixed(1)} kg). Na natureza esse predador também come vertebrados terrestres e carniça fora deste cenário; a área precisaria de muito mais presas para sustentar ${Object.entries(p.inicial).filter(([e]) => cfg.especies[e].papel === 'carnivoro').reduce((s, [, n]) => s + n, 0)} carnívoro(s). Desequilíbrio do cenário, não do motor.`);
  if ((p.mortes.fome ?? 0) > (p.mortes.predacao ?? 0) * 2) d.push('Fome supera muito a predação: verificar pasto/água acessíveis e deslocamento no nível 3.');
  if ((p.mortes.sede ?? 0) > 0) d.push(`Mortes por sede (${p.mortes.sede}): verificar seca prolongada e conhecimento de pontos de água.`);
  return d.length ? d : ['Nenhum desequilíbrio forte nesta execução (populações dentro de 0,4×–2,5× do inicial).'];
}
function causas(esp, p) { return Object.entries(p.mortes).map(([k, v]) => `${k} ${v}`).join(', ') || 'sem mortes registradas'; }

function relatorio(r) {
  const L = [];
  const kv = (o) => Object.entries(o).map(([k, v]) => `${k}: ${v}`).join(', ') || '—';
  L.push('# Relatório — ecossistema V2', '', `Gerado em ${r.geradoEm} por \`npm run eco\` · sementes \`${r.sementes}\` · ${r.segundos} s por encontro.`, '');
  L.push('## Encontros no bebedouro (nível 1, GLB/IA reais)', '');
  L.push('| Cenário | Sementes | Predações | Presas feridas vivas | Perseguições (desfecho) | Disputas (fase final) | Fugas durante disputa | Mortes em combate | Falhas | Colisões | Custo (ms/animal/s) |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [id, e] of Object.entries(r.encontros)) L.push(`| \`${id}\` | ${e.n} | ${e.predacoes} | ${e.presasFeridasVivas} | ${e.perseguicoes} (${kv(e.perseguicoesPorDesfecho)}) | ${e.conflitos} (${kv(e.conflitosPorFaseFinal)}) | ${e.escapesDuranteDisputa} | ${e.mortesCombate} | ${e.falhas.length} | ${e.colisoes} | ${e.msPorAnimalSegundo} |`);
  L.push('', 'Resultados observados por semente (rótulos não exclusivos) e uma semente de exemplo de cada:', '');
  L.push('| Cenário | Resultado | Sementes | Exemplo | Reproduzir |', '|---|---|---|---|---|');
  for (const [id, e] of Object.entries(r.encontros)) for (const [k, v] of Object.entries(e.rotulos)) L.push(`| \`${id}\` | ${k} | ${v}/${e.n} | ${e.exemplos[k]} | \`ecossistema.html?cenario=${id}&semente=${e.exemplos[k]}\` |`);
  L.push('', 'Motivos das disputas: ' + Object.entries(r.encontros).map(([id, e]) => `\`${id}\` ${kv(e.conflitosPorMotivo)}`).join(' · '), '');
  L.push('Comunicação: ' + Object.entries(r.encontros).map(([id, e]) => `\`${id}\` ${e.alarmes} alarmes, ${e.alarmesOuvidos} recepções, ${e.protecaoFilhote} proteções de filhote`).join(' · '), '');
  L.push('Ataques: ' + Object.entries(r.encontros).map(([id, e]) => `\`${id}\` ${e.ataques} iniciados, ${e.golpesQueFeriram} feriram, ${e.esquivas} esquivas, ${e.golpesErrados} erraram`).join(' · '), '');
  const p = r.populacao;
  L.push(`## Dinâmica populacional (${p.anos} anos, níveis 2/3, savana procedural 640×520 m)`, '');
  L.push(`Inicial: ${kv(p.inicial)} · Final: ${kv(p.final)}`, '', `Nascimentos ${p.nascimentos} · predações ${p.predacoes} · mortes ${kv(p.mortes)} · migrações ${p.migracoes} · incêndios ${p.incendios} · contágios ${p.contagios} · ${p.ms} ms de execução`, '');
  L.push('| Dia | Estação | População | Vegetação | Fome média | Sede média | Células de água |', '|---|---|---|---|---|---|---|');
  for (const s of p.serie) L.push(`| ${s.dia} | ${s.estacao} | ${kv(s.populacao)} | ${s.vegetacao} | ${s.fomeMedia} | ${s.sedeMedia} | ${s.celulasAgua} |`);
  L.push('', '### Desequilíbrios identificados (não são automaticamente bugs)', '', ...p.desequilibrios.map((d) => `- ${d}`), '');
  L.push('### Custo por nível', '', `Nível 1: ${p.custo.n1.toFixed(0)} ms em ${p.custo.passosN1} passos-animal · Nível 2: ${p.custo.n2.toFixed(0)} ms em ${p.custo.passosN2} · Nível 3: ${p.custo.n3.toFixed(0)} ms em ${p.custo.passosN3}.`, '');
  return L.join('\n');
}
