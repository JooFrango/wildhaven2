#!/usr/bin/env node
// Auditoria compacta de GLBs (somente leitura): clipes, esqueleto, extensão, eixo anatômico "para frente"
// (cabeça vs. cauda na pose de repouso) e root motion por clipe (deslocamento do osso raiz).
// Uso: node scripts/auditar-glb.mjs <glb|pasta> [...] [--json]
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';

const LOCOMOCAO = /^(walk|run|trot|scurry|gallop|flee|stalk|hop)$/i;
const PE = /(foot|toe|hoof|paw|talon|_pe\b|pata)/i;
const args = process.argv.slice(2);
const comoJson = args.includes('--json');
const alvos = args.filter((a) => !a.startsWith('--'));
const raizRepo = resolve(new URL('../../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const arquivos = [];
for (const a of alvos) {
  const info = await stat(a).catch(() => null);
  if (!info) continue;
  if (info.isDirectory()) arquivos.push(...(await listar(a))); else arquivos.push(resolve(a));
}
const saida = [];
for (const f of arquivos) {
  try { saida.push(await auditar(f)); } catch (e) { saida.push({ arquivo: relative(raizRepo, f), erro: e.message }); }
}
if (comoJson) console.log(JSON.stringify(saida, null, 1));
else for (const s of saida) {
  if (s.erro) { console.log(`${s.arquivo} | ERRO ${s.erro}`); continue; }
  console.log(`${s.arquivo} | ${s.bytes}B | ossos ${s.ossos} | ext ${s.extensao.map((v) => v.toFixed(2)).join('x')} | frente ${s.frente} (${s.evidenciaFrente}) | clipes: ${s.clipes.map((c) => `${c.nome}:${c.duracao}s${c.rootMotion > 0.05 ? `(rm ${c.rootMotion}m)` : ''}${c.velNatural ? `[v≈${c.velNatural}m/s,pés ${c.pes}]` : ''}`).join(' ')}`);
}

async function auditar(f) {
  const buf = await readFile(f);
  if (buf.toString('ascii', 0, 4) !== 'glTF') throw new Error('não é GLB');
  const lenJ = buf.readUInt32LE(12);
  const g = JSON.parse(buf.toString('utf8', 20, 20 + lenJ));
  const binIni = 20 + lenJ + 8;
  const ler = (ai) => lerAccessor(g, buf, binIni, ai);

  // Matrizes mundiais em repouso.
  const pais = new Map();
  (g.nodes ?? []).forEach((n, i) => (n.children ?? []).forEach((c) => pais.set(c, i)));
  const mundo = new Map();
  const matDe = (i) => {
    if (mundo.has(i)) return mundo.get(i);
    const m = local(g.nodes[i]);
    const r = pais.has(i) ? mul(matDe(pais.get(i)), m) : m;
    mundo.set(i, r); return r;
  };
  const pos = (i) => { const m = matDe(i); return [m[12], m[13], m[14]]; };

  // Extensão aproximada: min/max dos POSITION transformados pelo nó da malha.
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  (g.nodes ?? []).forEach((n, i) => {
    if (n.mesh === undefined) return;
    for (const p of g.meshes[n.mesh].primitives) {
      const a = g.accessors[p.attributes.POSITION];
      if (!a.min) continue;
      const m = n.skin !== undefined ? ident() : matDe(i);
      for (const c of cantos(a.min, a.max)) {
        const w = aplicar(m, c);
        for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], w[k]); max[k] = Math.max(max[k], w[k]); }
      }
    }
  });
  const extensao = max.map((v, k) => v - min[k]);

  // Eixo anatômico: cabeça (head/cabeca/skull/jaw) vs. cauda (tail/cauda) ou raiz.
  const skin = g.skins?.[0];
  const ossos = skin?.joints ?? [];
  const nome = (i) => (g.nodes[i].name ?? '').toLowerCase();
  const achar = (re) => ossos.find((j) => re.test(nome(j))) ?? (g.nodes ?? []).map((_, i) => i).find((i) => re.test(nome(i)));
  const cab = achar(/head|cabe|skull|cranio|jaw|snout|focinho/);
  const cauda = achar(/tail|cauda/);
  let frente = 'indeterminado', evidenciaFrente = 'sem ossos nomeados';
  if (cab !== undefined) {
    const pc = pos(cab);
    const ref = cauda !== undefined ? pos(cauda) : ossos.length ? pos(ossos[0]) : [0, 0, 0];
    const d = [pc[0] - ref[0], pc[2] - ref[2]];
    const eixo = Math.abs(d[0]) > Math.abs(d[1]) ? (d[0] > 0 ? '+X' : '-X') : (d[1] > 0 ? '+Z' : '-Z');
    frente = eixo;
    evidenciaFrente = `${g.nodes[cab].name}→${cauda !== undefined ? g.nodes[cauda].name : 'raiz'} Δ=(${d[0].toFixed(2)},${d[1].toFixed(2)})`;
  }

  // Root motion: deslocamento horizontal do primeiro ao último quadro na translação do osso raiz.
  const raizOsso = ossos.length ? ossos.find((j) => !ossos.includes(pais.get(j))) : undefined;
  const clipes = (g.animations ?? []).map((an) => {
    let dur = 0, rm = 0;
    for (const ch of an.channels) {
      const s = an.samplers[ch.sampler];
      const ain = g.accessors[s.input];
      // Alguns exportadores do projeto gravam min/max como escalar (fora do padrão glTF): aceita os dois.
      const mx = Array.isArray(ain.max) ? ain.max[0] : ain.max;
      if (Number.isFinite(mx)) dur = Math.max(dur, mx);
      else { const t = ler(s.input); if (t.length) dur = Math.max(dur, t[t.length - 1]); }
      if (ch.target.node === raizOsso && ch.target.path === 'translation') {
        const v = ler(s.output);
        const n = v.length / 3;
        if (n > 1) rm = Math.hypot(v[(n - 1) * 3] - v[0], v[(n - 1) * 3 + 2] - v[2]);
      }
    }
    const c = { nome: an.name, duracao: +dur.toFixed(3), rootMotion: +rm.toFixed(3) };
    if (LOCOMOCAO.test(an.name) && frente !== 'indeterminado') Object.assign(c, velocidadeNatural(g, an, dur, frente, ler, pais));
    return c;
  });
  return { arquivo: relative(raizRepo, f).replace(/\\/g, '/'), bytes: buf.length, ossos: ossos.length, extensao, frente, evidenciaFrente, clipes };
}

// ---- Velocidade natural de ciclos no lugar (anti-deslizamento) ----
// Amostra o clipe, calcula a posição mundial de cada "pé" e mede quanto ele varre ao longo do eixo da frente.
// Em um ciclo no lugar, o pé apoiado recua à velocidade do corpo: v ≈ varredura / (fração de apoio × duração).
function velocidadeNatural(g, an, dur, frente, ler, pais) {
  const nos = g.nodes;
  let pes = nos.map((n, i) => i).filter((i) => PE.test(nos[i].name ?? ''));
  // Sem nomes de pé: usa as folhas das cadeias de perna.
  if (!pes.length) {
    const perna = nos.map((n, i) => i).filter((i) => /(leg|perna|thigh|shin|calf)/i.test(nos[i].name ?? ''));
    pes = perna.filter((i) => !(nos[i].children ?? []).some((c) => perna.includes(c)));
  }
  if (!pes.length || dur <= 0) return { velNatural: null, pes: 0 };
  const canais = new Map();
  for (const ch of an.channels) {
    const s = an.samplers[ch.sampler];
    const k = `${ch.target.node}:${ch.target.path}`;
    canais.set(k, { t: ler(s.input), v: ler(s.output), interp: s.interpolation ?? 'LINEAR', comp: ch.target.path === 'rotation' ? 4 : 3 });
  }
  const eixo = frente[1] === 'X' ? 0 : 2;
  const amostras = 40;
  const faixas = pes.map(() => [Infinity, -Infinity]);
  for (let a = 0; a <= amostras; a++) {
    const t = (a / amostras) * dur;
    const cache = new Map();
    const mundoDe = (i) => {
      if (cache.has(i)) return cache.get(i);
      const n = nos[i];
      const trs = {
        translation: amostrar(canais.get(`${i}:translation`), t) ?? n.translation,
        rotation: amostrar(canais.get(`${i}:rotation`), t) ?? n.rotation,
        scale: amostrar(canais.get(`${i}:scale`), t) ?? n.scale,
      };
      const m = local(n.matrix ? n : trs);
      const r = pais.has(i) ? mul(mundoDe(pais.get(i)), m) : m;
      cache.set(i, r); return r;
    };
    pes.forEach((p, k) => {
      const w = mundoDe(p)[12 + eixo];
      faixas[k][0] = Math.min(faixas[k][0], w); faixas[k][1] = Math.max(faixas[k][1], w);
    });
  }
  const varreduras = faixas.map(([a, b]) => b - a).filter((v) => v > 1e-4).sort((x, y) => x - y);
  if (!varreduras.length) return { velNatural: null, pes: pes.length };
  const mediana = varreduras[Math.floor(varreduras.length / 2)];
  const apoio = /run|gallop|flee|scurry|hop/i.test(an.name) ? 0.4 : 0.6;
  return { velNatural: +(mediana / (apoio * dur)).toFixed(3), varreduraPe: +mediana.toFixed(3), pes: pes.length };
}
function amostrar(c, t) {
  if (!c || !c.t.length) return null;
  const { t: ts, v, comp, interp } = c;
  const cub = interp === 'CUBICSPLINE';
  const passo = cub ? comp * 3 : comp;
  const off = cub ? comp : 0;
  const val = (i) => Array.from(v.slice(i * passo + off, i * passo + off + comp));
  if (t <= ts[0]) return val(0);
  const n = ts.length;
  if (t >= ts[n - 1]) return val(n - 1);
  let i = 0; while (i < n - 2 && ts[i + 1] < t) i++;
  if (interp === 'STEP') return val(i);
  const u = (t - ts[i]) / (ts[i + 1] - ts[i]);
  const a = val(i), b = val(i + 1);
  if (comp === 4) { // nlerp com correção de hemisfério
    const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    const s = d < 0 ? -1 : 1;
    const q = a.map((x, k) => x * (1 - u) + s * b[k] * u);
    const len = Math.sqrt(q.reduce((acc, x) => acc + x * x, 0)) || 1;
    return q.map((x) => x / len);
  }
  return a.map((x, k) => x * (1 - u) + b[k] * u);
}

function lerAccessor(g, buf, binIni, ai) {
  const a = g.accessors[ai];
  const bv = g.bufferViews[a.bufferView];
  const comp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  if (a.componentType !== 5126) return new Float32Array(0);
  const ini = binIni + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const passo = bv.byteStride ?? comp * 4;
  const out = new Float32Array(a.count * comp);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < comp; k++) out[i * comp + k] = buf.readFloatLE(ini + i * passo + k * 4);
  return out;
}
function ident() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
function local(n) {
  if (n.matrix) return n.matrix.slice();
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale ?? [1, 1, 1];
  const [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function aplicar(m, p) { return [0, 1, 2].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]); }
function cantos(a, b) { const o = []; for (const x of [a[0], b[0]]) for (const y of [a[1], b[1]]) for (const z of [a[2], b[2]]) o.push([x, y, z]); return o; }
async function listar(p) {
  const out = [];
  for (const e of await readdir(p, { withFileTypes: true })) {
    const q = join(p, e.name);
    if (e.isDirectory()) out.push(...(await listar(q))); else if (extname(e.name).toLowerCase() === '.glb') out.push(resolve(q));
  }
  return out;
}
