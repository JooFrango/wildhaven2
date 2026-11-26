#!/usr/bin/env node
// Inspeção do rig de um GLB real (somente leitura): árvore de ossos, posição de repouso e, por clipe,
// altura de cada pé ao longo do ciclo (contato com o chão), alcance da cabeça/garras nos ataques e
// quais ossos cada clipe anima. Uso: node scripts/inspecionar-rig.mjs <glb> [--json saida.json]
import { writeFile } from 'node:fs/promises';
import { abrirGlb, canaisDoClipe, duracaoClipe, poseMundial } from './lib-glb.mjs';

const [arq, ...resto] = process.argv.slice(2);
const iJson = resto.indexOf('--json');
const glb = await abrirGlb(arq);
const { g } = glb;
const ossos = g.skins?.[0]?.joints ?? g.nodes.map((_, i) => i);
const nome = (i) => g.nodes[i].name ?? `no${i}`;
const repouso = poseMundial(glb, null, 0);
const p = (m) => [m[12], m[13], m[14]].map((v) => +v.toFixed(3));

const filhos = (i) => (g.nodes[i].children ?? []).filter((c) => ossos.includes(c));
const raizes = ossos.filter((j) => !ossos.includes(glb.pais.get(j)));
const linhas = [];
const arvore = (i, d) => { linhas.push(`${'  '.repeat(d)}${nome(i)} ${JSON.stringify(p(repouso(i)))}`); filhos(i).forEach((c) => arvore(c, d + 1)); };
raizes.forEach((r) => arvore(r, 0));

const pes = ossos.filter((i) => /(foot|toe|hoof|paw|talon)/i.test(nome(i)) && !filhos(i).some((c) => /(foot|toe|paw)/i.test(nome(c))));
const cab = ossos.find((i) => /head/i.test(nome(i)));
const garras = ossos.filter((i) => /(front|fore|arm|hand).*(foot|paw|toe)|(foot|paw).*(f|front)/i.test(nome(i)));

const clipes = (g.animations ?? []).map((an) => {
  const dur = duracaoClipe(glb, an);
  const can = canaisDoClipe(glb, an);
  const animados = [...new Set(an.channels.map((c) => nome(c.target.node)))];
  const N = 48;
  const alturas = pes.map(() => []);
  let cabMax = -Infinity, cabMin = Infinity, cabYmin = Infinity;
  for (let a = 0; a <= N; a++) {
    const de = poseMundial(glb, can, (a / N) * dur);
    pes.forEach((pe, k) => alturas[k].push(de(pe)[13]));
    if (cab !== undefined) { const c = de(cab); cabMax = Math.max(cabMax, c[12]); cabMin = Math.min(cabMin, c[12]); cabYmin = Math.min(cabYmin, c[13]); }
  }
  const pesInfo = pes.map((pe, k) => {
    const h = alturas[k]; const mn = Math.min(...h), mx = Math.max(...h);
    const contato = h.filter((v) => v - mn < 0.02 + 0.1 * (mx - mn)).length / h.length;
    return { pe: nome(pe), yMin: +mn.toFixed(3), yMax: +mx.toFixed(3), fracContato: +contato.toFixed(2) };
  });
  return { nome: an.name, duracao: +dur.toFixed(3), canais: an.channels.length, ossosAnimados: animados.length, pes: pesInfo,
    cabeca: cab !== undefined ? { xMin: +cabMin.toFixed(3), xMax: +cabMax.toFixed(3), yMin: +cabYmin.toFixed(3) } : null };
});

const rel = { arquivo: arq, ossos: ossos.length, raizes: raizes.map(nome), pes: pes.map(nome), cabeca: cab !== undefined ? nome(cab) : null, garras: garras.map(nome), arvore: linhas, clipes };
if (iJson >= 0) await writeFile(resto[iJson + 1], JSON.stringify(rel, null, 1));
console.log(linhas.join('\n'));
console.log(`pés: ${rel.pes.join(', ')} | cabeça: ${rel.cabeca}`);
for (const c of clipes) console.log(`${c.nome} ${c.duracao}s ossos=${c.ossosAnimados} cab x[${c.cabeca?.xMin},${c.cabeca?.xMax}] | ${c.pes.map((q) => `${q.pe}:y${q.yMin}..${q.yMax} c${q.fracContato}`).join(' ')}`);
