#!/usr/bin/env node
/**
 * Wildhaven — validação de portais de fronteira e certificação técnica por hex.
 *
 * Para cada uma das 738 arestas do grafo:
 *   1. confere que os centros estão à distância geométrica de vizinhos (4.330,127 m);
 *   2. amostra a aresta compartilhada a cada --step metros;
 *   3. EMENDA: altura da malha de terreno REAL de cada GLB no ponto da aresta (1 cm para
 *      dentro de cada lado), mesma regra de "máximo" do compilador; |ΔA−ΔB| ≤ 0,03 m;
 *   4. INCLINAÇÃO: entre as células WHP1 a 4 m para dentro de cada lado ≤ tan(--max-slope);
 *   5. ÁGUA e BLOQUEIO: lidos dos pacotes WHP1 compilados (sem água, sem bloqueio);
 *   6. portal = trecho contínuo de amostras aprovadas com largura ≥ --min-width.
 * Hexes 'iceberg-sea' são EXCEÇÃO MARÍTIMA registrada (sem travessia terrestre).
 * Não cria terreno nem collider; amostra sem dado é falha 'sem-cobertura'.
 *
 * Uso:
 *   node tools/validate-portals.mjs --physics .generated/physics-272 \
 *     --old-root .generated/sources/old-root --new-root .generated/sources/new-root \
 *     --node-classes "build real/continental/compiler/node-classes-v01.json" \
 *     --out "build real/integracao/relatorio-continental-272.json"
 */
import {readFile, writeFile, mkdir} from "node:fs/promises";
import {join, resolve, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {gunzipSync} from "node:zlib";
import {createHash} from "node:crypto";
import {parseGlb, traverseMeshes, forEachTriangle} from "../compiler/glb.mjs";
import {NODE_CLASSES, decodePhysicsChunk} from "../compiler/physics.mjs";

const argv = process.argv.slice(2), opts = {};
for (let i = 0; i < argv.length; i++) opts[argv[i].replace(/^--/, "")] = argv[++i];
for (const k of ["physics", "old-root", "new-root", "out"]) if (!opts[k]) throw Error("--" + k + " é obrigatório");
const STEP = Number(opts.step ?? 2), TOL = Number(opts.tolerance ?? 0.03);
const MAX_SLOPE_DEG = Number(opts["max-slope"] ?? 35), MIN_WIDTH = Number(opts["min-width"] ?? 4);
const INSET = 4, SEAM_EPS = 0.01, R = 2500, APOTHEM = R * Math.sqrt(3) / 2, STEP_CENTERS = 2 * APOTHEM;
const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(join(here, "../data/continent-272.manifest.json"), "utf8"));
const tiles = new Map(manifest.tiles.map(t => [t.id, t]));
const physicsDir = resolve(opts.physics);
const compileReport = JSON.parse(await readFile(join(physicsDir, "compile-report.json"), "utf8"));
const compiled = new Map(compileReport.items.map(i => [i.id, i]));
let nodeClassSpec = null, patterns = [];
if (opts["node-classes"]) {
  nodeClassSpec = JSON.parse(await readFile(resolve(opts["node-classes"]), "utf8"));
  patterns = (nodeClassSpec.nodeClassPatterns ?? []).map(p => ({re: new RegExp(p.pattern, "u"), cls: p.class}));
}
const classOf = (name, id) => (nodeClassSpec?.nodeClasses?.[name]) ?? NODE_CLASSES[name] ?? (name === id ? "terrain" : null)
  ?? patterns.find(p => p.re.test(name))?.cls ?? null;
const isSea = t => t.biome === "iceberg-sea";

// ---------- emenda pela malha real ----------
const BUCKET = 16;
async function seamIndex(tile) {
  const root = tile.source.repository === "carioca1111/wildhaven" ? opts["old-root"] : opts["new-root"];
  const bytes = await readFile(resolve(root, tile.source.path));
  const glb = parseGlb(bytes);
  const buckets = new Map();
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  let terrainTris = 0;
  traverseMeshes(glb, ({node, nodeIndex, mesh, world}) => {
    if (node.extensions?.EXT_mesh_gpu_instancing) return;
    if (classOf(node.name ?? "node#" + nodeIndex, tile.id) !== "terrain") return;
    forEachTriangle(glb, mesh, world, tri => {
      terrainTris++;
      const t = tri.map(v => [v[0] + tile.x, v[1], v[2] + tile.z]);
      for (const v of tri) { bbox[0] = Math.min(bbox[0], v[0]); bbox[1] = Math.min(bbox[1], v[2]); bbox[2] = Math.max(bbox[2], v[0]); bbox[3] = Math.max(bbox[3], v[2]); }
      // só triângulos que tocam a faixa de 6 m junto à borda do hex
      const near = tri.some(v => hexEdgeDistance(v[0], v[2]) < 6);
      if (!near) return;
      const xs = t.map(v => v[0]), zs = t.map(v => v[2]);
      for (let bx = Math.floor(Math.min(...xs) / BUCKET); bx <= Math.floor(Math.max(...xs) / BUCKET); bx++)
        for (let bz = Math.floor(Math.min(...zs) / BUCKET); bz <= Math.floor(Math.max(...zs) / BUCKET); bz++) {
          const k = bx + ":" + bz; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(t);
        }
    });
  });
  return {buckets, terrainTris, bbox, sourceSha256: createHash("sha256").update(bytes).digest("hex")};
}
function hexEdgeDistance(x, z) { // distância (local) até a borda de hex pointy-top com raio R
  const ax = Math.abs(x), az = Math.abs(z);
  const d1 = APOTHEM - ax;                                // faces verticais (±X)
  const d2 = APOTHEM - (ax * 0.5 + az * Math.sqrt(3) / 2); // faces inclinadas
  return Math.min(d1, d2);
}
function meshHeight(idx, x, z) {
  const list = idx.buckets.get(Math.floor(x / BUCKET) + ":" + Math.floor(z / BUCKET));
  if (!list) return null;
  let best = null;
  for (const [a, b, c] of list) {
    const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(den) < 1e-12) continue;
    const l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den;
    const l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den, l3 = 1 - l1 - l2;
    if (l1 < -1e-7 || l2 < -1e-7 || l3 < -1e-7) continue;
    const y = l1 * a[1] + l2 * b[1] + l3 * c[1];
    if (best === null || y > best) best = y;
  }
  return best;
}

// ---------- amostragem WHP1 ----------
const chunkCache = new Map(), CACHE_MAX = 256;
const indexCache = new Map();
async function tileIndex(id) {
  if (!indexCache.has(id)) {
    const idx = JSON.parse(await readFile(join(physicsDir, id + "-physics-v01", "index.json"), "utf8"));
    idx.byKey = new Map(idx.chunks.map(c => [c.ix + ":" + c.iz, c]));
    indexCache.set(id, idx);
  }
  return indexCache.get(id);
}
async function raster(id, x, z) {
  const idx = await tileIndex(id), cm = idx.chunkMeters;
  const ix = Math.floor(x / cm), iz = Math.floor(z / cm), meta = idx.byKey.get(ix + ":" + iz);
  if (!meta) return null;
  const key = id + "/" + meta.url;
  let ch = chunkCache.get(key);
  if (!ch) {
    const packed = await readFile(join(physicsDir, id + "-physics-v01", meta.url));
    if (createHash("sha256").update(packed).digest("hex") !== meta.sha256) throw Error("SHA-256 de chunk divergente: " + key);
    ch = decodePhysicsChunk(gunzipSync(packed));
    chunkCache.set(key, ch);
    if (chunkCache.size > CACHE_MAX) chunkCache.delete(chunkCache.keys().next().value);
  } else { chunkCache.delete(key); chunkCache.set(key, ch); }
  const i = Math.floor((x - ch.x0) / ch.res), j = Math.floor((z - ch.z0) / ch.res), k = j * ch.nx + i;
  if (i < 0 || j < 0 || i >= ch.nx || j >= ch.nz) return null;
  return {h: ch.heights[k] + ch.baseY, water: Number.isFinite(ch.water[k]), blocked: ch.blocked[k] === 1};
}

// ---------- execução ----------
const seam = new Map(), tileInfo = new Map();
const landIds = manifest.tiles.filter(t => compiled.get(t.id)?.ok).map(t => t.id);
let n = 0;
for (const id of landIds) {
  const t = tiles.get(id), s = await seamIndex(t);
  seam.set(id, s);
  const w = s.bbox[2] - s.bbox[0], d = s.bbox[3] - s.bbox[1];
  tileInfo.set(id, {terrainTris: s.terrainTris, widthX: Number(w.toFixed(3)), depthZ: Number(d.toFixed(3)),
    scaleOk: Math.abs(w - STEP_CENTERS) <= 1 && Math.abs(d - 2 * R) <= 1, sourceSha256: s.sourceSha256});
  if (++n % 25 === 0) console.log("[portais] malhas de emenda " + n + "/" + landIds.length);
}
const tanMax = Math.tan(MAX_SLOPE_DEG * Math.PI / 180);
const edges = [];
for (const [a, b] of manifest.edges) {
  const A = tiles.get(a), B = tiles.get(b);
  const e = {a, b};
  const dx = B.x - A.x, dz = B.z - A.z, dist = Math.hypot(dx, dz);
  e.centerDistance = Number(dist.toFixed(3));
  if (Math.abs(dist - STEP_CENTERS) > 1) { e.status = "aresta-nao-geometrica"; edges.push(e); continue; }
  if (isSea(A) || isSea(B)) { e.status = "excecao-maritima"; e.reason = "iceberg-sea sem travessia terrestre"; edges.push(e); continue; }
  if (!seam.has(a) || !seam.has(b)) { e.status = "sem-pacote"; e.reason = "GLB não compilado: " + [a, b].filter(x => !seam.has(x)).join(","); edges.push(e); continue; }
  const ux = dx / dist, uz = dz / dist, tx = -uz, tz = ux, mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2;
  const half = R / 2, fails = {semCobertura: 0, emenda: 0, inclinacao: 0, agua: 0, bloqueio: 0};
  const gaps = [], okFlags = [];
  let hydroMismatch = 0;
  for (let s = -half + STEP; s <= half - STEP + 1e-9; s += STEP) {
    const px = mx + tx * s, pz = mz + tz * s;
    const sa = meshHeight(seam.get(a), px - ux * SEAM_EPS, pz - uz * SEAM_EPS);
    const sb = meshHeight(seam.get(b), px + ux * SEAM_EPS, pz + uz * SEAM_EPS);
    const ra = await raster(a, px - ux * INSET, pz - uz * INSET), rb = await raster(b, px + ux * INSET, pz + uz * INSET);
    let ok = true;
    if (sa === null || sb === null || !ra || !rb || !Number.isFinite(ra.h) || !Number.isFinite(rb.h)) { fails.semCobertura++; okFlags.push(false); continue; }
    const gap = Math.abs(sa - sb); gaps.push(gap);
    if (gap > TOL) { fails.emenda++; ok = false; }
    if (Math.abs(rb.h - ra.h) / (2 * INSET) > tanMax) { fails.inclinacao++; ok = false; }
    if (ra.water || rb.water) { fails.agua++; ok = false; }
    if (ra.water !== rb.water) hydroMismatch++;
    if (ra.blocked || rb.blocked) { fails.bloqueio++; ok = false; }
    okFlags.push(ok);
  }
  const portals = [];
  let run = 0;
  for (let i = 0; i <= okFlags.length; i++) {
    if (i < okFlags.length && okFlags[i]) { run++; continue; }
    if (run * STEP >= MIN_WIDTH) {
      const sEnd = -half + STEP * i, sStart = sEnd - run * STEP, sMid = (sStart + sEnd) / 2;
      portals.push({widthMeters: run * STEP, centerX: Number((mx + tx * sMid).toFixed(2)), centerZ: Number((mz + tz * sMid).toFixed(2)),
        fromS: sStart, toS: sEnd});
    }
    run = 0;
  }
  gaps.sort((x, y) => x - y);
  const q = p => gaps.length ? Number(gaps[Math.min(gaps.length - 1, Math.floor(p * gaps.length))].toFixed(4)) : null;
  Object.assign(e, {samples: okFlags.length, coveredSamples: gaps.length, approvedSamples: okFlags.filter(Boolean).length,
    seamGapMeters: {p50: q(0.5), p95: q(0.95), max: gaps.length ? Number(gaps.at(-1).toFixed(4)) : null},
    failures: fails, hydrologyMismatchSamples: hydroMismatch,
    portals: portals.sort((x, y) => y.widthMeters - x.widthMeters).slice(0, 12), portalCount: portals.length,
    portalWidthMeters: portals.reduce((s, p) => s + p.widthMeters, 0),
    status: portals.length ? "validado" : "reprovado"});
  edges.push(e);
}
// certificação técnica por hex
const perTile = [];
for (const t of manifest.tiles) {
  const c = compiled.get(t.id), info = tileInfo.get(t.id);
  const my = edges.filter(e => e.a === t.id || e.b === t.id);
  const landEdges = my.filter(e => e.status !== "excecao-maritima");
  const row = {id: t.id, biome: t.biome, family: t.source.path.split("/")[1], inCatalog: true, glbAccessible: true,
    compiled: !!c?.ok, compileError: c?.ok ? undefined : c?.error,
    unknownNodes: c?.ok ? c.unknownMeshes : undefined, scale: info,
    edges: my.length, landEdges: landEdges.length, validatedEdges: my.filter(e => e.status === "validado").length};
  const reasons = [];
  if (isSea(t)) { row.status = "excecao-maritima"; }
  else {
    if (!row.compiled) reasons.push("não compilado");
    if (row.compiled && row.unknownNodes > 0) reasons.push("geometria não classificada (" + row.unknownNodes + " nós/instâncias)");
    if (info && !info.scaleOk) reasons.push("escala fora de 4330,127×5000 m ±1 m");
    if (row.validatedEdges === 0) reasons.push("nenhum portal validado");
    row.status = reasons.length ? "nao-certificado" : "certificado-tecnico";
  }
  row.reasons = reasons;
  perTile.push(row);
}
const count = f => perTile.filter(f).length;
const report = {schema: "wildhaven.continental.portal-report.v1", generatedAt: new Date().toISOString(),
  parameters: {stepMeters: STEP, seamToleranceMeters: TOL, maxSlopeDeg: MAX_SLOPE_DEG, minPortalWidthMeters: MIN_WIDTH,
    insetMeters: INSET, hexPointToPointMeters: 2 * R, hexFlatToFlatMeters: STEP_CENTERS,
    nodeClassification: nodeClassSpec ? {version: nodeClassSpec.version, status: nodeClassSpec.status} : null,
    proposalNote: "Inclinação máxima, largura mínima de portal e 'água bloqueia travessia a pé' são PROPOSTAS técnicas desta build, não regras aprovadas pelo diretor; a tolerância de 0,03 m vem do guia."},
  summary: {
    inCatalog: manifest.tiles.length, glbAccessible: count(r => r.glbAccessible), compiled: count(r => r.compiled),
    scaleVerified: count(r => r.scale?.scaleOk), withValidatedPortal: count(r => r.validatedEdges > 0),
    certified: count(r => r.status === "certificado-tecnico"), maritimeException: count(r => r.status === "excecao-maritima"),
    edges: edges.length, edgesValidated: edges.filter(e => e.status === "validado").length,
    edgesRejected: edges.filter(e => e.status === "reprovado").length,
    edgesMaritime: edges.filter(e => e.status === "excecao-maritima").length,
    edgesWithoutPackage: edges.filter(e => e.status === "sem-pacote").length,
    edgesNonGeometric: edges.filter(e => e.status === "aresta-nao-geometrica").length},
  tiles: perTile, edges};
await mkdir(dirname(resolve(opts.out)), {recursive: true});
await writeFile(resolve(opts.out), JSON.stringify(report, null, 1) + "\n");
console.log("[portais] " + JSON.stringify(report.summary));
