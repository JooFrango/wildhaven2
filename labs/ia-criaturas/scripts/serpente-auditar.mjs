#!/usr/bin/env node
// Auditoria da coluna de uma serpente num GLB real: mede, quadro a quadro, se o corpo está estendido ou
// enrolado, se o comprimento se conserva, qual a curvatura por junta e se segmentos distantes se aproximam
// (auto-interseção). Somente leitura — nunca escreve no GLB.
// uso: node scripts/serpente-auditar.mjs <arquivo.glb> [--quadros 16] [--json saida.json]
import { writeFile } from 'node:fs/promises';
import { abrirGlb, canaisDoClipe, duracaoClipe, poseMundial } from './lib-glb.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const arquivo = process.argv[2];
if (!arquivo) { console.error('uso: serpente-auditar.mjs <arquivo.glb>'); process.exit(1); }
const N = Number(arg('quadros', 16));

const glb = await abrirGlb(arquivo);
const g = glb.g;
const pos = (m) => [m[12], m[13], m[14]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// ---------- cadeia da coluna: o caminho mais longo pai→filho dentro das juntas do skin ----------
const skin = g.skins?.[0];
if (!skin) { console.error('GLB sem skin: não há coluna para auditar.'); process.exit(2); }
const juntas = skin.joints, setJ = new Set(juntas);
const nome = (i) => g.nodes[i].name ?? `node${i}`;
const maisLongo = (j) => {
  const fs = (g.nodes[j].children ?? []).filter((f) => setJ.has(f) && !FACIAL.test(nome(f)));
  let melhor = [];
  for (const f of fs) { const c = maisLongo(f); if (c.length > melhor.length) melhor = c; }
  return [j, ...melhor];
};
// Juntas faciais (mandíbula, língua) não são coluna: entram como elo gigante e falseiam a curvatura.
const FACIAL = /mandible|tongue|jaw|fang|teeth|eye/i;
let coluna = [];
for (const r of juntas.filter((j) => !setJ.has(glb.pais.get(j)))) { const c = maisLongo(r); if (c.length > coluna.length) coluna = c; }

// Raio do corpo: metade da menor extensão lateral da malha com pele (lido do accessor de posição).
const malha = g.meshes[g.nodes.find((n) => n.skin !== undefined)?.mesh ?? 0];
const acc = g.accessors[malha.primitives[0].attributes.POSITION];
const ext = acc.min && acc.max ? acc.max.map((v, i) => v - acc.min[i]) : [1, 1, 1];
const RAIO = Math.min(...ext.slice().sort((a, b) => a - b).slice(0, 2)) / 2;
const CURV_MAX_GRAUS = Number(arg('curvatura', 35));

function medir(canais, t) {
  const de = poseMundial(glb, canais, t);
  const p = coluna.map((j) => pos(de(j)));
  let caminho = 0;
  for (let i = 1; i < p.length; i++) caminho += dist(p[i - 1], p[i]);
  let curvMax = 0, curvSoma = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const a = [p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1], p[i][2] - p[i - 1][2]];
    const b = [p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1], p[i + 1][2] - p[i][2]];
    const la = Math.hypot(...a) || 1e-9, lb = Math.hypot(...b) || 1e-9;
    const ang = (Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb)))) * 180) / Math.PI;
    curvMax = Math.max(curvMax, ang); curvSoma += ang;
  }
  // Auto-interseção: juntas afastadas na cadeia (≥6 elos) e a menos de um diâmetro no espaço.
  let cruzamentos = 0, folga = Infinity;
  for (let i = 0; i < p.length; i++) for (let k = i + 6; k < p.length; k++) {
    const d = dist(p[i], p[k]);
    if (d < RAIO * 2) cruzamentos++;
    folga = Math.min(folga, d - RAIO * 2);
  }
  const pontaAPonta = dist(p[0], p[p.length - 1]);
  return {
    caminho: +caminho.toFixed(3), pontaAPonta: +pontaAPonta.toFixed(3),
    retidao: +(pontaAPonta / caminho).toFixed(3), // 1 = reta; perto de 0 = enrolado sobre si
    curvMaxGraus: +curvMax.toFixed(1), curvMediaGraus: +(curvSoma / Math.max(1, p.length - 2)).toFixed(1),
    cruzamentos, folgaMinima: +folga.toFixed(3),
    cabeca: p[0].map((v) => +v.toFixed(2)), cauda: p[p.length - 1].map((v) => +v.toFixed(2)),
    alturaMin: +Math.min(...p.map((q) => q[1])).toFixed(3),
    pontos: p,
  };
}

// A onda do corpo é medida junta a junta, não pela retidão: uma onda que viaja mantém a retidão constante.
// `amplitude` = quanto cada junta se afasta da posição que tinha no primeiro quadro (média das juntas).
// `atraso` = de quantos quadros é a defasagem entre a onda na frente e a onda atrás do corpo; > 0 significa
// que o movimento se propaga da cabeça para a cauda, como numa serpente real.
function ondulacao(qs) {
  const n = qs[0].pontos.length;
  const desl = [];
  for (let j = 0; j < n; j++) desl.push(Math.max(...qs.map((q) => dist(q.pontos[j], qs[0].pontos[j]))));
  const serie = (j) => qs.map((q) => { // deslocamento lateral assinado em relação ao quadro 0
    const d = [q.pontos[j][0] - qs[0].pontos[j][0], q.pontos[j][2] - qs[0].pontos[j][2]];
    return d[0] * 0 + d[1]; // o corpo corre no eixo X; a onda é em Z
  });
  // Correlação cruzada entre o terço da frente e o terço de trás, para achar a defasagem.
  const a = serie(Math.floor(n * 0.75)), b = serie(Math.floor(n * 0.25)); // 0 = cauda, n = cabeça
  const med = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  const ma = med(a), mb = med(b);
  let melhor = { k: 0, c: -Infinity };
  for (let k = 0; k < qs.length; k++) {
    let c = 0;
    for (let i = 0; i < qs.length; i++) c += (a[i] - ma) * (b[(i + k) % qs.length] - mb);
    if (c > melhor.c) melhor = { k, c };
  }
  return {
    amplitudeMediaM: +(med(desl)).toFixed(3),
    amplitudeMaxM: +Math.max(...desl).toFixed(3),
    amplitudeCaudaM: +desl[0].toFixed(3),
    amplitudeCabecaM: +desl[n - 1].toFixed(3),
    atrasoQuadros: melhor.k > qs.length / 2 ? melhor.k - qs.length : melhor.k,
  };
}

const repouso = medir(null, 0);
const saida = { arquivo, ossos: juntas.length, colunaJuntas: coluna.length, raioCorpoM: +RAIO.toFixed(3), limiteCurvaturaGraus: CURV_MAX_GRAUS, repouso, clipes: [] };
console.log(arquivo);
console.log(`  juntas ${juntas.length} · coluna ${coluna.length} (${nome(coluna[0])} → ${nome(coluna.at(-1))}) · raio do corpo ${RAIO.toFixed(2)} m`);
console.log(`  REPOUSO: comprimento ${repouso.caminho} m · ponta a ponta ${repouso.pontaAPonta} m · retidão ${repouso.retidao} · curvatura máx ${repouso.curvMaxGraus}° · cruzamentos ${repouso.cruzamentos}`);

for (const anim of g.animations ?? []) {
  const canais = canaisDoClipe(glb, anim), dur = duracaoClipe(glb, anim);
  const qs = Array.from({ length: N }, (_, k) => medir(canais, (k / (N - 1)) * dur));
  const col = (k) => qs.map((q) => q[k]);
  const min = (k) => Math.min(...col(k)), max = (k) => Math.max(...col(k));
  const r = {
    nome: anim.name, duracao: +dur.toFixed(2), quadros: N,
    retidaoMin: +min('retidao').toFixed(3), retidaoMax: +max('retidao').toFixed(3),
    comprimentoMin: +min('caminho').toFixed(2), comprimentoMax: +max('caminho').toFixed(2),
    variacaoComprimento: +(((max('caminho') - min('caminho')) / repouso.caminho) * 100).toFixed(1),
    curvMaxGraus: +max('curvMaxGraus').toFixed(1), excedeCurvatura: max('curvMaxGraus') > CURV_MAX_GRAUS,
    cruzamentosMax: max('cruzamentos'), folgaMinima: +min('folgaMinima').toFixed(3),
    amplitudeForma: +(max('retidao') - min('retidao')).toFixed(3),
    deslocamentoCabeca: +Math.max(...qs.map((q) => dist(q.cabeca, qs[0].cabeca))).toFixed(2),
    abaixoDoSolo: +min('alturaMin').toFixed(3),
    ...ondulacao(qs),
  };
  saida.clipes.push(r);
  const alerta = [r.excedeCurvatura && `CURV ${r.curvMaxGraus}°`, r.cruzamentosMax && `CRUZA ${r.cruzamentosMax}`,
    Math.abs(r.variacaoComprimento) > 3 && `ESTICA ${r.variacaoComprimento}%`, r.amplitudeMaxM < 0.02 && 'SEM MOVIMENTO',
    r.abaixoDoSolo < -0.05 && `SOB O SOLO ${r.abaixoDoSolo} m`].filter(Boolean).join(' ');
  console.log(`  ${anim.name.padEnd(15)} ${String(r.duracao).padStart(4)}s · retidão ${String(r.retidaoMin).padStart(5)}–${String(r.retidaoMax).padEnd(5)} · onda méd ${String(r.amplitudeMediaM).padStart(5)} m máx ${String(r.amplitudeMaxM).padStart(5)} m (cauda ${r.amplitudeCaudaM} cabeça ${r.amplitudeCabecaM}) · atraso ${String(r.atrasoQuadros).padStart(3)} q · curv ${String(r.curvMaxGraus).padStart(5)}° ${alerta}`);
}
if (arg('json')) await writeFile(arg('json'), JSON.stringify(saida, null, 1));
