#!/usr/bin/env node
// Auditoria do mapa continental de Auralis (272 hexagonos).
//
// Le o manifesto `build real/continental/data/continent-272.manifest.json` e os
// GLBs de terreno em assets/world/continental-272/. Verifica, por hexagono:
// presenca do GLB, hash do objeto git, container glTF valido, triangulos contra
// o manifesto e caixa envolvente (escala e faixa de altura). Verifica, no grafo:
// nos inexistentes, simetria, grau, componentes conexos e area total.
//
// A caixa envolvente sai dos campos min/max dos acessores POSITION, que ficam no
// bloco JSON do GLB. O script nao decodifica o bloco binario, portanto NAO
// afere a continuidade de 3 cm vertice a vertice entre fronteiras. O proprio
// manifesto declara `certifiedPhysicalTiles: 0` e escopo
// "not-physical-integration": a integracao fisica nao foi feita, logo nao existe
// malha continua para medir. Quando ela existir, essa checagem precisa decodificar
// POSITION das bordas de cada par vizinho.
//
// Uso: node tools/auditar-mapa-272.mjs [--json]

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const MANIFESTO = 'build real/continental/data/continent-272.manifest.json';
const RAIZ = 'assets/world/continental-272';

if (!existsSync(MANIFESTO)) {
  console.error(`manifesto nao encontrado: ${MANIFESTO}`);
  process.exit(1);
}
const man = JSON.parse(readFileSync(MANIFESTO, 'utf8'));

const hashGit = (buf) =>
  createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');

function lerGlbJson(buf) {
  if (buf.length < 12 || buf.slice(0, 4).toString('ascii') !== 'glTF') return { erro: 'nao e GLB' };
  const total = buf.readUInt32LE(8);
  if (total !== buf.length) return { erro: `tamanho declarado ${total} difere de ${buf.length}` };
  let off = 12, json = null, temBin = false;
  while (off + 8 <= buf.length) {
    const tam = buf.readUInt32LE(off);
    const tipo = buf.slice(off + 4, off + 8).toString('ascii');
    const ini = off + 8, fim = ini + tam;
    if (fim > buf.length) return { erro: `chunk ${tipo.trim()} passa do fim` };
    if (tipo === 'JSON') { try { json = JSON.parse(buf.slice(ini, fim).toString('utf8')); } catch (e) { return { erro: 'JSON invalido' }; } }
    else if (tipo.startsWith('BIN')) temBin = true;
    off = fim + ((4 - (tam % 4)) % 4);
  }
  return json ? { json, temBin } : { erro: 'sem chunk JSON' };
}

function medir(json) {
  const ac = json.accessors || [];
  let tris = 0, min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const m of json.meshes || []) {
    for (const p of m.primitives || []) {
      const modo = p.mode ?? 4;
      const n = p.indices != null ? (ac[p.indices]?.count ?? 0) : (ac[p.attributes?.POSITION]?.count ?? 0);
      if (modo === 4) tris += Math.floor(n / 3);
      else if (modo === 5 || modo === 6) tris += Math.max(0, n - 2);
      const pos = ac[p.attributes?.POSITION];
      if (pos?.min && pos?.max) {
        for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], pos.min[i]); max[i] = Math.max(max[i], pos.max[i]); }
      }
    }
  }
  const temBox = Number.isFinite(min[0]);
  return {
    triangulos: tris,
    caixa: temBox ? { min, max, tamanho: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] } : null,
    nos: (json.nodes || []).length,
    malhas: (json.meshes || []).length,
    imagens: (json.images || []).length,
    animacoes: (json.animations || []).length,
  };
}

// indice id -> arquivo no repositorio
const arquivos = {};
if (existsSync(RAIZ)) {
  for (const id of readdirSync(RAIZ)) {
    const dir = `${RAIZ}/${id}`;
    try {
      const fs = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.glb'));
      if (fs.length) arquivos[id] = `${dir}/${fs[0]}`;
    } catch { /* nao e diretorio */ }
  }
}

const porId = new Map(man.tiles.map((t) => [t.id, t]));
const res = [];
for (const t of man.tiles) {
  const r = { id: t.id, bioma: t.biome, x: t.x, z: t.z, custoViagem: t.travelCost, arquivo: arquivos[t.id] ?? null };
  r.manifesto = {
    repositorio: t.source.repository,
    commit: t.source.commit,
    caminhoOriginal: t.source.path,
    bytes: t.source.bytes,
    shaGit: t.source.gitBlobSha1,
    sha256: t.source.sha256,
    triangulos: t.source.triangles,
  };
  r.revisaoArtistica = t.artReview ?? null;
  r.runtime = t.runtime ?? null;
  if (!r.arquivo) { r.ok = false; r.erro = 'GLB ausente no repositorio'; res.push(r); continue; }
  const buf = readFileSync(r.arquivo);
  r.bytes = buf.length;
  r.shaGit = hashGit(buf);
  r.sha256 = createHash('sha256').update(buf).digest('hex');
  // O manifesto nao declara sha256 nem triangulos para todos os hexagonos.
  // Campo ausente nao e divergencia: fica registrado como nao declarado.
  r.hashConfere = r.shaGit === r.manifesto.shaGit;
  r.sha256Confere = r.manifesto.sha256 == null ? null : r.sha256 === r.manifesto.sha256;
  const g = lerGlbJson(buf);
  if (g.erro) { r.ok = false; r.erro = g.erro; res.push(r); continue; }
  Object.assign(r, medir(g.json));
  r.temChunkBin = g.temBin;
  r.triangulosConferem = r.manifesto.triangulos == null ? null : r.triangulos === r.manifesto.triangulos;
  r.ok = r.hashConfere && r.sha256Confere !== false && r.triangulosConferem !== false;
  if (!r.ok) r.erro = [!r.hashConfere && 'sha git diverge', r.sha256Confere === false && 'sha256 diverge', r.triangulosConferem === false && `triangulos ${r.triangulos} != manifesto ${r.manifesto.triangulos}`].filter(Boolean).join('; ');
  r.camposNaoDeclaradosNoManifesto = [r.manifesto.sha256 == null && 'sha256', r.manifesto.triangulos == null && 'triangulos'].filter(Boolean);
  res.push(r);
}

// grafo
const ids = new Set(man.tiles.map((t) => t.id));
const adj = new Map([...ids].map((i) => [i, new Set()]));
let arestasInvalidas = 0;
for (const [a, b] of man.edges) {
  if (!ids.has(a) || !ids.has(b)) { arestasInvalidas++; continue; }
  adj.get(a).add(b);
  adj.get(b).add(a);
}
const graus = [...adj.values()].map((s) => s.size);
const isolados = [...adj.entries()].filter(([, s]) => s.size === 0).map(([i]) => i);
// componentes conexos
const vistos = new Set();
const componentes = [];
for (const i of ids) {
  if (vistos.has(i)) continue;
  const pilha = [i], comp = [];
  vistos.add(i);
  while (pilha.length) {
    const c = pilha.pop();
    comp.push(c);
    for (const v of adj.get(c)) if (!vistos.has(v)) { vistos.add(v); pilha.push(v); }
  }
  componentes.push(comp);
}
componentes.sort((a, b) => b.length - a.length);

// escala e area
const p2p = man.geometry.hexPointToPointMeters;
const passo = man.geometry.stepMeters;
const lado = p2p / 2;
const areaHex = (3 * Math.sqrt(3) / 2) * lado * lado / 1e6; // km2
const comGlb = res.filter((r) => r.arquivo);
const caixas = comGlb.filter((r) => r.caixa).map((r) => r.caixa.tamanho);
const medXZ = caixas.length
  ? [caixas.reduce((s, c) => s + c[0], 0) / caixas.length, caixas.reduce((s, c) => s + c[2], 0) / caixas.length]
  : null;
const alturas = comGlb.filter((r) => r.caixa).map((r) => r.caixa.tamanho[1]);

const falhas = res.filter((r) => !r.ok);
const dupSha = {};
for (const r of comGlb) dupSha[r.shaGit] = (dupSha[r.shaGit] || []).concat(r.id);
const duplicados = Object.entries(dupSha).filter(([, v]) => v.length > 1);

const resumo = {
  gerado_em: new Date().toISOString(),
  manifesto: { schema: man.schema, geradoEm: man.generatedAt, escopo: man.scope },
  hexagonos_no_manifesto: man.tiles.length,
  hexagonos_com_glb_no_repo: comGlb.length,
  hexagonos_sem_glb: res.length - comGlb.length,
  hexagonos_com_falha: falhas.length,
  terrenos_duplicados: duplicados.length,
  arestas: man.edges.length,
  arestas_invalidas: arestasInvalidas,
  grau_min: Math.min(...graus),
  grau_max: Math.max(...graus),
  nos_isolados: isolados.length,
  componentes_conexos: componentes.length,
  maior_componente: componentes[0]?.length ?? 0,
  tiles_terrestres_manifesto: man.counts.landGraphTiles,
  tiles_maritimos_manifesto: man.counts.seaGraphTiles,
  tiles_fisicos_certificados: man.counts.certifiedPhysicalTiles,
  biomas_distintos: new Set(man.tiles.map((t) => t.biome)).size,
  geometria: { hexPointToPointMeters: p2p, stepMeters: passo, ladoMetros: lado },
  area_por_hexagono_km2: Number(areaHex.toFixed(3)),
  area_total_km2: Number((areaHex * man.tiles.length).toFixed(1)),
  area_terrestre_km2: Number((areaHex * man.counts.landGraphTiles).toFixed(1)),
  caixa_media_xz_metros: medXZ ? medXZ.map((v) => Number(v.toFixed(1))) : null,
  altura_minima_metros: alturas.length ? Number(Math.min(...alturas).toFixed(2)) : null,
  altura_maxima_metros: alturas.length ? Number(Math.max(...alturas).toFixed(2)) : null,
  triangulos_totais: comGlb.reduce((s, r) => s + (r.triangulos || 0), 0),
  continuidade_3cm: 'NAO VERIFICADA — ver comentario no topo deste script',
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ resumo, hexagonos: res, componentes: componentes.map((c) => c.length) }, null, 1));
} else {
  for (const [k, v] of Object.entries(resumo)) console.log(String(k).padEnd(32), typeof v === 'object' ? JSON.stringify(v) : v);
  if (falhas.length) {
    console.log('\nfalhas:');
    for (const f of falhas.slice(0, 40)) console.log(` ${f.id}  ${f.erro}`);
  }
  if (duplicados.length) {
    console.log('\nterrenos duplicados (mesmo sha em hexagonos diferentes):');
    for (const [sha, ids2] of duplicados) console.log(` ${sha.slice(0, 10)}  ${ids2.join(', ')}`);
  }
}

process.exit(falhas.length ? 1 : 0);
