#!/usr/bin/env node
// Pipeline visual offline da Build Real V02.
//
// Gera, a partir dos GLBs ORIGINAIS dos hexes (que não são alterados):
//   1. chunks visuais do relevo, água e rochas (folhas de C m, blocos de 4×4 folhas e o hex inteiro),
//      cada nível com LOD simplificado por erro geométrico ABSOLUTO (metros) e bordas travadas
//      (LockBorder), para que níveis vizinhos nunca abram frestas;
//   2. vegetação como INSTÂNCIAS de protótipos compartilhados (InstancedMesh no cliente), com
//      4 LODs por protótipo, organizadas por célula espacial para culling;
//   3. o horizonte continental de baixíssimo custo (todos os hexes informados, com cor média).
//
// A física (WHP1) e o servidor Rust NÃO usam nada disto. A correção de escala da vegetação
// e o adensamento são PROVISÓRIOS e vêm de data/vegetacao-provisoria-v02.json.
//
// Uso:
//   node build-visual.mjs --sources .generated/sources --out .generated/visual-v02 [--around HV_01 | --tiles A,B]
//        [--chunk 256] [--horizon <saida.glb>] [--stats-only]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { NodeIO, Document, Accessor } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import { PNG } from "pngjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../../..");
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]);
  return a;
}, []));
const SOURCES = path.resolve(REPO, args.sources ?? ".generated/sources");
const OUT = path.resolve(REPO, args.out ?? ".generated/visual-v02");
const CHUNK = Number(args.chunk ?? 256);
const BLOCK = CHUNK * 4;
const CFG = JSON.parse(fs.readFileSync(path.resolve(REPO, args.config ?? "game/build-real-v02/data/vegetacao-provisoria-v02.json"), "utf8"));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(REPO, "build real/continental/data/continent-272.manifest.json"), "utf8"));
await MeshoptSimplifier.ready;
MeshoptSimplifier.useExperimentalFeatures = true; // flag Prune (remove ilhas pequenas nos LODs de protótipo)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const R = 2500, SQ3 = Math.sqrt(3);
function latticeCenter(x, z) {
  const r = Math.round(z / (1.5 * R)), q = Math.round(x / (SQ3 * R) - r / 2);
  return { x: SQ3 * R * (q + r / 2), z: 1.5 * R * r };
}
/** Hexágono pointy-top de raio R centrado na origem local. */
function insideHex(x, z, margin = 0) {
  const ax = Math.abs(x), az = Math.abs(z), r = R - margin;
  return az <= r && ax <= (SQ3 / 2) * r && SQ3 * ax + az <= SQ3 * r * 1.0000001 + 1e-6 && (ax * 0.5 + az * SQ3 / 2) <= r * SQ3 / 2 + 1e-6;
}
function hash01(...k) {
  const h = crypto.createHash("sha1").update(k.join("|")).digest();
  return h.readUInt32LE(0) / 4294967296;
}
function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ----------------------------------------------------------------- classificação dos nós
const RX = {
  drop: /hex_side_cut/i,
  treePart: /trunk|branch|canopy|conifer|pine|crown|buttress|liana|scaffold/i,
  small: /shrub|flower|scrub|cact|junco|grass|moita|arbust|reed|capim/i,
  water: /sea_level|l[âa]mina|foz|water|[áa]gua|lago|\brio\b/i,
  rock: /boulder|rock|stone|escarp|cliff|bedrock|fault|ruin|forma[çc]|afloram|arco|fossil|debris/i,
  vegInst: /folhosa|conifera|emergente|dossel|figueira|palmeira|arbusto|junco|moita|tree|arvore|árvore|shrub|bush|cact/i,
};
function classify(name, instanced) {
  if (RX.drop.test(name)) return "drop";
  if (instanced) return RX.vegInst.test(name) ? "vegInst" : "rockInst";
  if (RX.treePart.test(name)) return "treePart";
  if (RX.small.test(name)) return "small";
  if (RX.water.test(name)) return "water";
  if (RX.rock.test(name)) return "rock";
  return "terrain";
}
const familyOfInst = name => name.replace(/[_ ]?\d+$/, "").trim();

// ----------------------------------------------------------------- utilidades de geometria
function mat4MulPoint(m, x, y, z) {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}
function mat4MulDir(m, x, y, z) {
  const v = [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
  const l = Math.hypot(...v) || 1; return v.map(a => a / l);
}
const isIdentity = m => m.every((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) < 1e-9);

/** Lê um primitivo como "sopa" indexada com atributos em arrays planos (cópias, já transformadas). */
function readPrim(prim, world) {
  const attrs = {};
  for (const sem of prim.listSemantics()) {
    const acc = prim.getAttribute(sem);
    const n = acc.getCount(), size = acc.getElementSize(), out = new Float32Array(n * size), el = [];
    for (let i = 0; i < n; i++) { acc.getElement(i, el); out.set(el, i * size); }
    attrs[sem] = { size, data: out };
  }
  const pos = attrs.POSITION.data;
  if (!isIdentity(world)) {
    for (let i = 0; i < pos.length; i += 3) { const p = mat4MulPoint(world, pos[i], pos[i + 1], pos[i + 2]); pos.set(p, i); }
    for (const s of ["NORMAL"]) if (attrs[s]) { const d = attrs[s].data; for (let i = 0; i < d.length; i += 3) d.set(mat4MulDir(world, d[i], d[i + 1], d[i + 2]), i); }
    if (attrs.TANGENT) { const d = attrs.TANGENT.data; for (let i = 0; i < d.length; i += 4) { const t = mat4MulDir(world, d[i], d[i + 1], d[i + 2]); d[i] = t[0]; d[i + 1] = t[1]; d[i + 2] = t[2]; } }
  }
  const nv = pos.length / 3;
  let idx;
  const ia = prim.getIndices();
  if (ia) { idx = new Uint32Array(ia.getCount()); for (let i = 0; i < idx.length; i++) idx[i] = ia.getScalar(i); }
  else idx = Uint32Array.from({ length: nv }, (_, i) => i);
  return { attrs, idx, nv, material: prim.getMaterial() };
}

/** Sub-malha com os triângulos `tris` (índices de triângulo) — vértices remapeados. */
function subMesh(soup, tris) {
  const map = new Int32Array(soup.nv).fill(-1);
  const order = [];
  const idx = new Uint32Array(tris.length * 3);
  let k = 0;
  for (const t of tris) for (let c = 0; c < 3; c++) {
    const v = soup.idx[t * 3 + c];
    if (map[v] < 0) { map[v] = order.length; order.push(v); }
    idx[k++] = map[v];
  }
  const attrs = {};
  for (const [sem, a] of Object.entries(soup.attrs)) {
    const d = new Float32Array(order.length * a.size);
    for (let i = 0; i < order.length; i++) for (let c = 0; c < a.size; c++) d[i * a.size + c] = a.data[order[i] * a.size + c];
    attrs[sem] = { size: a.size, data: d };
  }
  return { attrs, idx, nv: order.length, material: soup.material };
}

function simplify(sm, ratio, errorM, lockBorder = true) {
  if (sm.idx.length < 300) return { idx: sm.idx, err: 0 };
  const target = Math.max(3, Math.floor((sm.idx.length * ratio) / 3) * 3);
  const flags = ["ErrorAbsolute"]; if (lockBorder) flags.push("LockBorder");
  const [out, err] = MeshoptSimplifier.simplify(sm.idx, sm.attrs.POSITION.data, 3, target, errorM, flags);
  return { idx: out, err };
}

function bounds(pos, idx) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const v of idx) for (let c = 0; c < 3; c++) { const x = pos[v * 3 + c]; if (x < b[c]) b[c] = x; if (x > b[c + 3]) b[c + 3] = x; }
  return b.map(v => Math.round(v * 100) / 100);
}

// ----------------------------------------------------------------- escrita (documento novo)
const SEM_TYPE = { 1: Accessor.Type.SCALAR, 2: Accessor.Type.VEC2, 3: Accessor.Type.VEC3, 4: Accessor.Type.VEC4 };
class Writer {
  constructor() {
    this.doc = new Document();
    this.buf = this.doc.createBuffer();
    this.scene = this.doc.createScene("visual");
    this.matCache = new Map();
  }
  material(src) {
    if (!src) return null;
    if (this.matCache.has(src)) return this.matCache.get(src);
    const m = this.doc.createMaterial(src.getName())
      .setBaseColorFactor(src.getBaseColorFactor()).setRoughnessFactor(src.getRoughnessFactor())
      .setMetallicFactor(src.getMetallicFactor()).setDoubleSided(false).setAlphaMode(src.getAlphaMode());
    const copyTex = (t, set, info) => {
      if (!t) return;
      const tex = this.doc.createTexture(t.getName()).setImage(t.getImage()).setMimeType(t.getMimeType());
      set(tex);
      if (info) for (const [k, v] of Object.entries(info)) if (v !== undefined) m[k]?.(v);
    };
    copyTex(src.getBaseColorTexture(), t => m.setBaseColorTexture(t));
    copyTex(src.getNormalTexture(), t => m.setNormalTexture(t));
    const bi = src.getBaseColorTextureInfo(), mi = m.getBaseColorTextureInfo();
    if (bi && mi) { mi.setTexCoord(bi.getTexCoord()).setWrapS(bi.getWrapS()).setWrapT(bi.getWrapT()); }
    const ni = src.getNormalTextureInfo(), mni = m.getNormalTextureInfo();
    if (ni && mni) { mni.setTexCoord(ni.getTexCoord()).setWrapS(ni.getWrapS()).setWrapT(ni.getWrapT()); m.setNormalScale(src.getNormalScale()); }
    this.matCache.set(src, m);
    return m;
  }
  attrAccessors(sm) {
    const out = {};
    for (const [sem, a] of Object.entries(sm.attrs)) {
      out[sem] = this.doc.createAccessor().setType(SEM_TYPE[a.size]).setArray(a.data).setBuffer(this.buf);
    }
    return out;
  }
  /** Um nó por LOD; os LODs de uma mesma sub-malha compartilham os mesmos atributos. */
  addLods(name, sm, lods, material, translation) {
    const acc = this.attrAccessors(sm);
    const mat = material ?? this.material(sm.material);
    return lods.map((l, k) => {
      const prim = this.doc.createPrimitive().setMaterial(mat)
        .setIndices(this.doc.createAccessor().setType(Accessor.Type.SCALAR).setArray(sm.nv > 65535 ? l.idx : Uint16Array.from(l.idx)).setBuffer(this.buf));
      for (const [sem, a] of Object.entries(acc)) prim.setAttribute(sem, a);
      const node = this.doc.createNode(`${name}_L${l.lod ?? k}`).setMesh(this.doc.createMesh(`${name}_L${l.lod ?? k}`).addPrimitive(prim));
      if (translation) node.setTranslation(translation);
      this.scene.addChild(node);
      return node.getName();
    });
  }
  async write(file) {
    await this.doc.transform(prune());
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const bin = await io.writeBinary(this.doc);
    fs.writeFileSync(file, bin);
    return bin.byteLength;
  }
}

// ----------------------------------------------------------------- raster de altura / água
class Raster {
  constructor(res = 4) {
    this.res = res; this.x0 = -2200; this.z0 = -2520;
    this.nx = Math.ceil(4400 / res); this.nz = Math.ceil(5040 / res);
    this.h = new Float32Array(this.nx * this.nz).fill(NaN);
    this.water = new Float32Array(this.nx * this.nz).fill(NaN);
  }
  raster(soup, target) {
    const p = soup.attrs.POSITION.data, I = soup.idx, res = this.res;
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ax = p[a], az = p[a + 2], bx = p[b], bz = p[b + 2], cx = p[c], cz = p[c + 2];
      const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(den) < 1e-9) continue;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - this.x0) / res)), i1 = Math.min(this.nx - 1, Math.floor((Math.max(ax, bx, cx) - this.x0) / res));
      const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - this.z0) / res)), j1 = Math.min(this.nz - 1, Math.floor((Math.max(az, bz, cz) - this.z0) / res));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = this.x0 + (i + 0.5) * res, z = this.z0 + (j + 0.5) * res;
        const w0 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den, w1 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den, w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const y = w0 * p[a + 1] + w1 * p[b + 1] + w2 * p[c + 1], k = j * this.nx + i;
        if (!(target[k] >= y)) target[k] = y;
      }
    }
  }
  at(arr, x, z) {
    const i = Math.floor((x - this.x0) / this.res), j = Math.floor((z - this.z0) / this.res);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return NaN;
    return arr[j * this.nx + i];
  }
  slopeDeg(x, z) {
    const r = this.res, hx = this.at(this.h, x + r, z) - this.at(this.h, x - r, z), hz = this.at(this.h, x, z + r) - this.at(this.h, x, z - r);
    return (Math.atan(Math.hypot(hx, hz) / (2 * r)) * 180) / Math.PI;
  }
}

// ----------------------------------------------------------------- componentes (árvores fundidas)
function components(soup) {
  const p = soup.attrs.POSITION.data, n = soup.nv, par = new Int32Array(n);
  for (let i = 0; i < n; i++) par[i] = i;
  const f = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const key = new Map();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(p[i * 3] * 100)},${Math.round(p[i * 3 + 1] * 100)},${Math.round(p[i * 3 + 2] * 100)}`;
    const o = key.get(k); if (o !== undefined) par[f(i)] = f(o); else key.set(k, i);
  }
  for (let t = 0; t < soup.idx.length; t += 3) { const a = f(soup.idx[t]); par[f(soup.idx[t + 1])] = a; par[f(soup.idx[t + 2])] = a; }
  const comps = new Map();
  for (let t = 0; t < soup.idx.length / 3; t++) {
    const r = f(soup.idx[t * 3]);
    let c = comps.get(r);
    if (!c) { c = { tris: [], b: [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity] }; comps.set(r, c); }
    c.tris.push(t);
    for (let k = 0; k < 3; k++) { const v = soup.idx[t * 3 + k]; for (let q = 0; q < 3; q++) { const x = p[v * 3 + q]; if (x < c.b[q]) c.b[q] = x; if (x > c.b[q + 3]) c.b[q + 3] = x; } }
  }
  return [...comps.values()].map(c => ({ ...c, cx: (c.b[0] + c.b[3]) / 2, cz: (c.b[2] + c.b[5]) / 2 }));
}
function meanColor(soup, tris) {
  const col = soup.attrs.COLOR_0; if (!col) return [1, 1, 1];
  const s = [0, 0, 0]; let n = 0;
  for (const t of tris) for (let k = 0; k < 3; k++) { const v = soup.idx[t * 3 + k]; for (let c = 0; c < 3; c++) s[c] += col.data[v * col.size + c]; n++; }
  return n ? s.map(x => x / n) : [1, 1, 1];
}

// ----------------------------------------------------------------- protótipos (globais)
const protos = []; // {id, family, kind, height, crown, geom:{pos,nor,col,idx}, mean}
const protoByKey = new Map();
function addProto(key, family, kind, geom) {
  if (protoByKey.has(key)) return protoByKey.get(key);
  let y0 = Infinity, y1 = -Infinity, rx = 0;
  for (let i = 0; i < geom.pos.length; i += 3) { y0 = Math.min(y0, geom.pos[i + 1]); y1 = Math.max(y1, geom.pos[i + 1]); rx = Math.max(rx, Math.hypot(geom.pos[i], geom.pos[i + 2])); }
  const s = [0, 0, 0]; for (let i = 0; i < geom.col.length; i += 3) for (let c = 0; c < 3; c++) s[c] += geom.col[i + c];
  const nv = geom.col.length / 3 || 1;
  const p = { id: protos.length, key, family, kind, height: y1 - Math.min(0, y0), crown: rx, geom, mean: s.map(x => x / nv) };
  protos.push(p); protoByKey.set(key, p);
  return p;
}
/** Junta componentes de uma sopa num protótipo com base (x0,y0,z0) na origem. Cor RGB em float. */
function geomFromParts(parts, x0, y0, z0) {
  const pos = [], nor = [], col = [], idx = [];
  for (const { soup, tris } of parts) {
    const sm = subMesh(soup, tris), base = pos.length / 3;
    const P = sm.attrs.POSITION.data, N = sm.attrs.NORMAL?.data, C = sm.attrs.COLOR_0;
    for (let i = 0; i < sm.nv; i++) {
      pos.push(P[i * 3] - x0, P[i * 3 + 1] - y0, P[i * 3 + 2] - z0);
      nor.push(...(N ? [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]] : [0, 1, 0]));
      const f = soup.material?.getBaseColorFactor() ?? [1, 1, 1, 1];
      col.push(...(C ? [0, 1, 2].map(c => C.data[i * C.size + c] * f[c]) : [f[0], f[1], f[2]]));
    }
    for (const v of sm.idx) idx.push(base + v);
  }
  return { pos: Float32Array.from(pos), nor: Float32Array.from(nor), col: Float32Array.from(col), idx: Uint32Array.from(idx) };
}

// ----------------------------------------------------------------- processamento de um hex
function tileSourcePath(t) {
  const root = t.source.repository === "carioca1111/wildhaven" ? "old-root" : "new-root";
  return path.join(SOURCES, root, t.source.path);
}
const extraSources = tile => (CFG.fontesExtras?.[tile] ?? []).map(p => path.resolve(REPO, p));

async function scanTile(tile) {
  const files = [tileSourcePath(tile), ...extraSources(tile.id)];
  const statics = []; // {cat, soup, name}
  const raws = { treePart: [], small: [], inst: [] };
  for (const f of files) {
    const doc = await io.read(f);
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh(); if (!mesh) continue;
      const ext = node.getExtension("EXT_mesh_gpu_instancing");
      const name = node.getName() || "node";
      const cat = classify(name, !!ext);
      if (cat === "drop") continue;
      const world = node.getWorldMatrix();
      if (ext) { raws.inst.push({ name, node, ext, mesh, world, cat }); continue; }
      for (const prim of mesh.listPrimitives()) {
        const soup = readPrim(prim, world);
        if (cat === "treePart") raws.treePart.push({ name, soup });
        else if (cat === "small") raws.small.push({ name, soup });
        else statics.push({ cat, soup, name });
      }
    }
  }
  return { statics, raws };
}

function buildRaster(statics) {
  const ras = new Raster(4);
  for (const s of statics) if (s.cat === "terrain") ras.raster(s.soup, ras.h);
  for (const s of statics) if (s.cat === "water") ras.raster(s.soup, ras.water);
  return ras;
}

/** Instâncias "originais" do hex (posição, altura original, protótipo, tinta). */
function extractInstances(tileId, raws) {
  const out = [];
  // --- árvores fundidas (v12): troncos ancoram; galhos/copas vão para o tronco mais próximo em XZ
  const trunkParts = raws.treePart.filter(p => /trunk/i.test(p.name));
  const otherParts = raws.treePart.filter(p => !/trunk/i.test(p.name));
  const trees = [];
  const grid = new Map(), G = 24;
  for (const tp of trunkParts) for (const c of components(tp.soup)) {
    const t = { x: c.cx, z: c.cz, y0: c.b[1], y1: c.b[4], crown: Math.max(c.b[3] - c.b[0], c.b[5] - c.b[2]) / 2, parts: [{ soup: tp.soup, tris: c.tris }], canopyTris: { conifer: 0, broadleaf: 0 }, canopy: [] };
    trees.push(t);
    const k = `${Math.floor(t.x / G)},${Math.floor(t.z / G)}`; (grid.get(k) ?? grid.set(k, []).get(k)).push(t);
  }
  for (const op of otherParts) {
    const fam = /conifer|pine/i.test(op.name) ? "conifer" : "broadleaf";
    for (const c of components(op.soup)) {
      let best = null, bd = Infinity;
      const gi = Math.floor(c.cx / G), gj = Math.floor(c.cz / G);
      for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) for (const t of grid.get(`${gi + di},${gj + dj}`) ?? []) {
        const d = Math.hypot(t.x - c.cx, t.z - c.cz); if (d < bd) { bd = d; best = t; }
      }
      const w = Math.max(c.b[3] - c.b[0], c.b[5] - c.b[2]);
      if (best && bd < Math.max(12, w * 0.75)) {
        best.parts.push({ soup: op.soup, tris: c.tris });
        best.y1 = Math.max(best.y1, c.b[4]); best.crown = Math.max(best.crown, w / 2 + bd);
        if (/canopy|crown|pine|conifer/i.test(op.name)) { best.canopyTris[fam] += c.tris.length; best.canopy.push({ soup: op.soup, tris: c.tris }); }
      } else if (/canopy|crown|pine|conifer/i.test(op.name) && trunkParts.length === 0) {
        // sem troncos (ex.: pinheiros num só nó): o componente é a árvore inteira
        trees.push({ x: c.cx, z: c.cz, y0: c.b[1], y1: c.b[4], crown: w / 2, parts: [{ soup: op.soup, tris: c.tris }], canopyTris: { [fam]: 1 }, canopy: [{ soup: op.soup, tris: c.tris }] });
      }
    }
  }
  const famTrees = { "v12:broadleaf": [], "v12:conifer": [] };
  for (const t of trees) {
    if (!t.canopy.length) continue;
    const fam = (t.canopyTris.conifer ?? 0) > (t.canopyTris.broadleaf ?? 0) ? "v12:conifer" : "v12:broadleaf";
    t.h = t.y1 - t.y0; t.fam = fam; t.col = meanColor(t.canopy[0].soup, t.canopy.flatMap(c => c.tris));
    famTrees[fam].push(t);
  }
  for (const [fam, list] of Object.entries(famTrees)) {
    if (!list.length) continue;
    const famProtos = protos.filter(p => p.family === fam);
    if (!famProtos.length) {
      const sorted = [...list].sort((a, b) => a.h - b.h);
      for (const q of [0.2, 0.45, 0.7, 0.9]) {
        const t = sorted[Math.floor(q * (sorted.length - 1))];
        famProtos.push(addProto(`${fam}:${tileId}:${q}`, fam, "tree", geomFromParts(t.parts, t.x, t.y0, t.z)));
      }
    }
    for (const t of list) {
      const p = famProtos.reduce((a, b) => Math.abs(b.crown / b.height - t.crown / t.h) < Math.abs(a.crown / a.height - t.crown / t.h) ? b : a);
      out.push({ fam, kind: "tree", x: t.x, y: t.y0, z: t.z, yaw: hash01(tileId, t.x, t.z) * Math.PI * 2, h: t.h, crown: t.crown, proto: p.id, scale: t.h / p.height, tint: t.col.map((c, i) => c / Math.max(1e-3, p.mean[i])) });
    }
  }
  // --- plantas pequenas fundidas: cada componente é uma planta
  for (const sp of raws.small) {
    const fam = "v12:" + sp.name.replace(/^[A-Z0-9]+_[A-Z]*_?/, "").replace(/[_ ]?\d+$/, "");
    const comps = components(sp.soup).filter(c => c.tris.length >= 2);
    if (!comps.length) continue;
    let famProtos = protos.filter(p => p.family === fam);
    if (!famProtos.length) {
      const sorted = [...comps].sort((a, b) => (a.b[4] - a.b[1]) - (b.b[4] - b.b[1]));
      famProtos = [0.3, 0.6, 0.85].map(q => { const c = sorted[Math.floor(q * (sorted.length - 1))]; return addProto(`${fam}:${tileId}:${q}`, fam, "small", geomFromParts([{ soup: sp.soup, tris: c.tris }], c.cx, c.b[1], c.cz)); });
    }
    for (const c of comps) {
      const h = c.b[4] - c.b[1], p = famProtos[Math.floor(hash01(fam, c.cx, c.cz) * famProtos.length)];
      out.push({ fam, kind: "small", x: c.cx, y: c.b[1], z: c.cz, yaw: hash01(c.cz, c.cx) * Math.PI * 2, h, crown: Math.max(c.b[3] - c.b[0], c.b[5] - c.b[2]) / 2, proto: p.id, scale: p.height > 0.05 ? h / p.height : 1, tint: meanColor(sp.soup, c.tris).map((v, i) => v / Math.max(1e-3, p.mean[i])) });
    }
  }
  // --- instanciados (EXT_mesh_gpu_instancing): o protótipo é a própria malha
  for (const r of raws.inst) {
    const fam = familyOfInst(r.name), kind = r.cat === "rockInst" ? "rock" : /arbusto|junco|moita|shrub|bush/i.test(r.name) ? "small" : "tree";
    const parts = r.mesh.listPrimitives().map(pr => { const soup = readPrim(pr, IDENT); return { soup, tris: Array.from({ length: soup.idx.length / 3 }, (_, i) => i) }; });
    const vcount = parts.reduce((s, p) => s + p.soup.nv, 0);
    const p = addProto(`inst:${r.name}:${vcount}`, fam, kind, geomFromParts(parts, 0, 0, 0));
    const T = r.ext.getAttribute("TRANSLATION"), Q = r.ext.getAttribute("ROTATION"), S = r.ext.getAttribute("SCALE");
    const t = [], q = [0, 0, 0, 1], s = [1, 1, 1];
    for (let i = 0; i < T.getCount(); i++) {
      T.getElement(i, t); if (Q) Q.getElement(i, q); if (S) S.getElement(i, s);
      const w = mat4MulPoint(r.world, t[0], t[1], t[2]);
      const yaw = Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[1] * q[1] + q[2] * q[2]));
      out.push({ fam, kind, x: w[0], y: w[1], z: w[2], yaw, h: p.height * s[1], crown: p.crown * s[0], proto: p.id, scale: s[1], tint: [1, 1, 1] });
    }
  }
  return out;
}
const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// ----------------------------------------------------------------- escala provisória e adensamento
function familyRule(fam, kind) {
  const r = CFG.familias?.[fam] ?? CFG.padrao?.[kind] ?? {};
  return { alvo: r.alturaAlvoM ?? null, fator: r.fator ?? null, preencher: r.preenchimento ?? 0, max: r.maxPorOriginal ?? 0, distanciaM: r.distanciaM ?? null };
}
function computeFactors(allInstances) {
  const byFam = new Map();
  for (const i of allInstances) (byFam.get(i.fam) ?? byFam.set(i.fam, { kind: i.kind, hs: [] }).get(i.fam)).hs.push(i.h);
  const factors = {};
  for (const [fam, { kind, hs }] of byFam) {
    hs.sort((a, b) => a - b);
    const med = hs[Math.floor(hs.length / 2)], rule = familyRule(fam, kind);
    // famílias planas (decalques de chão, altura < 0,2 m) não têm escala vertical a corrigir
    const f = kind === "rock" || med < 0.2 ? 1 : rule.fator ?? (rule.alvo ? rule.alvo / med : 1);
    factors[fam] = { kind, n: hs.length, medianaOriginalM: +med.toFixed(2), alvoM: rule.alvo, fator: +f.toFixed(4), medianaFinalM: +(med * f).toFixed(2) };
  }
  return factors;
}
function densify(tileId, inst, factors, ras) {
  const out = [];
  const excl = (CFG.exclusoes ?? []).filter(e => e.tile === tileId);
  const blocked = (x, z) => excl.some(e => Math.hypot(x - e.x, z - e.z) < e.raioM);
  for (const o of inst) {
    const f = factors[o.fam]?.fator ?? 1, rule = familyRule(o.fam, o.kind);
    // altura final limitada a [0,5; 1,8] × alvo: evita mudas de 1 m onde o original já era pequeno
    const clampH = h => rule.alvo && o.kind !== "rock" ? Math.min(rule.alvo * 1.8, Math.max(rule.alvo * 0.5, h)) : h;
    const base = { ...o, scale: o.scale * f * (clampH(o.h * f) / Math.max(1e-6, o.h * f)), rank: hash01(tileId, "r", o.x, o.z), origem: 1 };
    out.push(base);
    if (!rule.preencher || f >= 1) continue;
    const want = Math.min(rule.max, Math.round(rule.preencher / (f * f)) - 1);
    const rnd = mulberry(Math.floor(hash01(tileId, o.x, o.z, o.fam) * 2 ** 31));
    const Rd = Math.max(o.crown, 3) * 0.95;
    for (let n = 0; n < want; n++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * Rd;
      const x = o.x + Math.cos(a) * rr, z = o.z + Math.sin(a) * rr;
      if (!insideHex(x, z, 4) || blocked(x, z)) continue;
      const y = ras.at(ras.h, x, z);
      if (!Number.isFinite(y)) continue;
      const w = ras.at(ras.water, x, z);
      if (Number.isFinite(w) && w > y - 0.3) continue;
      if (ras.slopeDeg(x, z) > (o.kind === "tree" ? 36 : 42)) continue;
      const pp = protos.filter(p => p.family === o.fam);
      const pr = pp[Math.floor(rnd() * pp.length)] ?? protos[o.proto];
      if (!(pr.height > 0.05)) continue;
      const jit = 0.8 + rnd() * 0.35;
      const hh = clampH(o.h * f * jit);
      out.push({ ...o, x, y: y - 0.15, z, yaw: rnd() * Math.PI * 2, proto: pr.id, scale: hh / pr.height, tint: o.tint.map(c => c * (0.94 + rnd() * 0.12)), rank: rnd(), origem: 0 });
    }
  }
  // em hexes "fundidos" (sem raster de terreno próprio) o y original é mantido
  return out;
}

// ----------------------------------------------------------------- AO assada e grades de altura
/** AO por ângulo de horizonte (8 direções, 2 raios) + sombra de copa; multiplica COLOR_0 do relevo. */
function bakeTerrainShade(soup, ras, canopy) {
  const P = soup.attrs.POSITION.data, n = soup.nv;
  let C = soup.attrs.COLOR_0;
  if (!C) { C = { size: 3, data: new Float32Array(n * 3).fill(1) }; soup.attrs.COLOR_0 = C; }
  const dirs = Array.from({ length: 8 }, (_, k) => [Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)]);
  for (let v = 0; v < n; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    let occ = 0;
    for (const [dx, dz] of dirs) {
      let best = 0;
      for (const r of [14, 40, 110]) { const h = ras.at(ras.h, x + dx * r, z + dz * r); if (Number.isFinite(h)) best = Math.max(best, Math.atan((h - y) / r)); }
      occ += best / (Math.PI / 2);
    }
    let shade = Math.min(1, Math.max(0.55, 1 - 0.9 * (occ / 8)));
    const cv = canopy.get(`${Math.floor(x / 8)},${Math.floor(z / 8)}`);
    if (cv) shade *= 1 - Math.min(0.32, cv * 0.16);
    for (let c = 0; c < 3; c++) C.data[v * C.size + c] *= shade;
  }
}
function canopyGrid(inst) {
  const g = new Map();
  for (const o of inst) {
    if (o.kind !== "tree") continue;
    const r = Math.max(1.5, (protos[o.proto]?.crown ?? 3) * o.scale * 0.8), r8 = Math.ceil(r / 8);
    const ci = Math.floor(o.x / 8), cj = Math.floor(o.z / 8);
    for (let di = -r8; di <= r8; di++) for (let dj = -r8; dj <= r8; dj++) if (di * di + dj * dj <= r8 * r8) { const k = `${ci + di},${cj + dj}`; g.set(k, (g.get(k) ?? 0) + 1); }
  }
  return g;
}
/** Grades de 32 m (mín./máx. do relevo) para oclusão conservadora e colisão de câmera no cliente. */
function writeHeights(ras, dir) {
  const S = 32, nx = Math.ceil(4400 / S), nz = Math.ceil(5040 / S), mn = new Float32Array(nx * nz).fill(NaN), mx = new Float32Array(nx * nz).fill(NaN);
  const k = S / ras.res;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    let a = Infinity, b = -Infinity;
    for (let jj = 0; jj < k; jj++) for (let ii = 0; ii < k; ii++) {
      const ri = i * k + ii, rj = j * k + jj; if (ri >= ras.nx || rj >= ras.nz) continue;
      const h = ras.h[rj * ras.nx + ri]; if (Number.isFinite(h)) { a = Math.min(a, h); b = Math.max(b, h); }
    }
    if (a <= b) { mn[j * nx + i] = a; mx[j * nx + i] = b; }
  }
  const buf = Buffer.concat([Buffer.from(mn.buffer), Buffer.from(mx.buffer)]);
  fs.writeFileSync(path.join(dir, "heights.bin"), buf);
  return { cell: S, x0: ras.x0, z0: ras.z0, nx, nz, layout: "Float32 min[nx*nz] seguido de Float32 max[nx*nz]; NaN = fora do relevo" };
}

// ----------------------------------------------------------------- saída estática (relevo/água/rocha)
async function writeStatic(tileId, statics, dir, ras, canopy) {
  const w = new Writer();
  for (const st of statics) if (st.cat === "terrain") bakeTerrainShade(st.soup, ras, canopy);
  const index = { tile: tileId, chunk: CHUNK, block: BLOCK, leaves: [], blocks: [], tile3: [] };
  const LOD = CFG.lodRelevo ?? { L1: [0.35, 0.6], L2: [0.1, 2.5], L3: [0.025, 8] };
  for (let s = 0; s < statics.length; s++) {
    const { cat, soup } = statics[s];
    const nt = soup.idx.length / 3, P = soup.attrs.POSITION.data;
    const cell = (size, t) => {
      let x = 0, z = 0; for (let k = 0; k < 3; k++) { const v = soup.idx[t * 3 + k]; x += P[v * 3]; z += P[v * 3 + 2]; }
      return `${Math.floor(x / 3 / size)},${Math.floor(z / 3 / size)}`;
    };
    const group = size => { const g = new Map(); for (let t = 0; t < nt; t++) { const k = cell(size, t); (g.get(k) ?? g.set(k, []).get(k)).push(t); } return g; };
    for (const [k, tris] of group(CHUNK)) {
      const [i, j] = k.split(",").map(Number), sm = subMesh(soup, tris), l1 = simplify(sm, ...LOD.L1);
      const names = w.addLods(`leaf_${i}_${j}_${cat}_${s}`, sm, [{ idx: sm.idx, lod: 0 }, { idx: l1.idx, lod: 1 }]);
      index.leaves.push({ i, j, cat, b: bounds(sm.attrs.POSITION.data, sm.idx), lods: [{ node: names[0], tris: sm.idx.length / 3, err: 0 }, { node: names[1], tris: l1.idx.length / 3, err: +l1.err.toFixed(3) }] });
    }
    for (const [k, tris] of group(BLOCK)) {
      const [i, j] = k.split(",").map(Number), sm = subMesh(soup, tris), l2 = simplify(sm, ...LOD.L2);
      // o bloco precisa travar a borda das folhas internas? Não: só a borda do bloco encosta em outro nível.
      const names = w.addLods(`block_${i}_${j}_${cat}_${s}`, sm, [{ idx: l2.idx, lod: 2 }]);
      index.blocks.push({ i, j, cat, b: bounds(sm.attrs.POSITION.data, sm.idx), node: names[0], tris: l2.idx.length / 3, err: +l2.err.toFixed(3) });
    }
    if (cat !== "rock") {
      const all = Array.from({ length: nt }, (_, t) => t), sm = subMesh(soup, all), l3 = simplify(sm, ...LOD.L3);
      const names = w.addLods(`tile_${cat}_${s}`, sm, [{ idx: l3.idx, lod: 3 }]);
      index.tile3.push({ cat, b: bounds(sm.attrs.POSITION.data, sm.idx), node: names[0], tris: l3.idx.length / 3, err: +l3.err.toFixed(3) });
    }
  }
  const bytes = await w.write(path.join(dir, "static.glb"));
  index.bytes = bytes;
  fs.writeFileSync(path.join(dir, "static.json"), JSON.stringify(index));
  return index;
}

function writeVeg(tileId, inst, dir) {
  inst.sort((a, b) => a.cellK - b.cellK || a.rank - b.rank);
  const F = 11, arr = new Float32Array(inst.length * F), cells = [];
  let cur = null;
  inst.forEach((o, n) => {
    arr.set([o.x, o.y, o.z, o.yaw, o.scale, o.proto, o.tint[0], o.tint[1], o.tint[2], o.rank, o.origem], n * F);
    if (!cur || cur.k !== o.cellK) { cur = { k: o.cellK, i: o.ci, j: o.cj, start: n, count: 0, maxH: 0 }; cells.push(cur); }
    cur.count++; cur.maxH = Math.max(cur.maxH, o.y + protos[o.proto].height * o.scale);
  });
  fs.writeFileSync(path.join(dir, "veg.bin"), Buffer.from(arr.buffer));
  const meta = { tile: tileId, floatsPerInstance: F, layout: "x,y,z,yaw,scale,proto,tintR,tintG,tintB,rank,original", cell: CHUNK, count: inst.length, cells: cells.map(({ k, ...c }) => c) };
  fs.writeFileSync(path.join(dir, "veg.json"), JSON.stringify(meta));
  return meta;
}

async function writeProtos(file) {
  const w = new Writer();
  const vegMat = w.doc.createMaterial("VegetacaoV02").setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.92).setMetallicFactor(0).setDoubleSided(true);
  const meta = [];
  const L = CFG.lodPrototipo ?? { L1: 0.35, L2: 0.1, L3: 0.02 };
  for (const p of protos) {
    const sm = { attrs: { POSITION: { size: 3, data: p.geom.pos }, NORMAL: { size: 3, data: p.geom.nor }, COLOR_0: { size: 3, data: p.geom.col } }, idx: p.geom.idx, nv: p.geom.pos.length / 3 };
    const H = Math.max(1, p.height), lods = [{ idx: sm.idx, lod: 0 }];
    for (const [k, r, e] of [[1, L.L1, 0.01], [2, L.L2, 0.04], [3, L.L3, 0.15]]) {
      const [idx, err] = sm.idx.length < 30 ? [sm.idx, 0] : MeshoptSimplifier.simplify(sm.idx, sm.attrs.POSITION.data, 3, Math.max(12, Math.floor(sm.idx.length * r / 3) * 3), e * H, ["ErrorAbsolute", "Prune"]);
      lods.push({ idx, lod: k, err });
    }
    const names = w.addLods(`P${p.id}`, sm, lods, vegMat);
    meta.push({ id: p.id, family: p.family, kind: p.kind, height: +p.height.toFixed(3), crown: +p.crown.toFixed(3), nodes: names, tris: lods.map(l => l.idx.length / 3), source: p.key });
  }
  const bytes = await w.write(file);
  fs.writeFileSync(file.replace(/\.glb$/, ".json"), JSON.stringify({ schema: "wildhaven.visual.prototypes.v1", count: meta.length, bytes, prototypes: meta }, null, 1));
  return meta;
}

// ----------------------------------------------------------------- horizonte
function textureMean(tex) {
  if (!tex || tex.getMimeType() !== "image/png") return [1, 1, 1];
  try {
    const png = PNG.sync.read(Buffer.from(tex.getImage()));
    const s = [0, 0, 0]; const n = png.width * png.height;
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) s[c] += Math.pow(png.data[i * 4 + c] / 255, 2.2);
    return s.map(x => x / n);
  } catch { return [1, 1, 1]; }
}
async function buildHorizon(tiles, file) {
  const w = new Writer();
  const mat = w.doc.createMaterial("HorizonteV02").setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(1).setMetallicFactor(0);
  const meta = [];
  for (const t of tiles) {
    const f = tileSourcePath(t);
    if (!fs.existsSync(f)) { meta.push({ id: t.id, missing: true }); continue; }
    const doc = await io.read(f);
    const parts = [];
    let treeCover = null;
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh(); if (!mesh) continue;
      const cat = classify(node.getName() || "", !!node.getExtension("EXT_mesh_gpu_instancing"));
      if (cat === "treePart" && /canopy|pine/i.test(node.getName())) {
        for (const prim of mesh.listPrimitives()) { const s = readPrim(prim, node.getWorldMatrix()); treeCover = treeCover ?? { col: meanColor(s, Array.from({ length: Math.min(4000, s.idx.length / 3) }, (_, i) => i)), soups: [] }; treeCover.soups.push(s); }
      }
      if (cat !== "terrain" && cat !== "water") continue;
      for (const prim of mesh.listPrimitives()) {
        const soup = readPrim(prim, node.getWorldMatrix()), m = prim.getMaterial();
        const tm = textureMean(m?.getBaseColorTexture()), bf = m?.getBaseColorFactor() ?? [1, 1, 1, 1];
        parts.push({ soup, cat, tint: tm.map((v, i) => v * bf[i]) });
      }
    }
    if (!parts.length) { meta.push({ id: t.id, empty: true }); continue; }
    // cobertura de copa por célula de 32 m (para tingir de verde onde há floresta)
    const cov = new Map();
    for (const s of treeCover?.soups ?? []) { const P = s.attrs.POSITION.data; for (let v = 0; v < s.nv; v += 7) cov.set(`${Math.floor(P[v * 3] / 32)},${Math.floor(P[v * 3 + 2] / 32)}`, 1); }
    const c = latticeCenter(t.x, t.z);
    const sum = { tris: 0 };
    for (const [k, p] of parts.entries()) {
      const sm = { ...p.soup };
      const l = simplify(sm, p.cat === "water" ? 0.05 : 0.02, p.cat === "water" ? 6 : 10, true);
      // remonta a sub-malha a partir dos índices simplificados
      const map = new Map(); const pos = [], col = [], idx = [];
      const P = sm.attrs.POSITION.data, C = sm.attrs.COLOR_0;
      for (const v of l.idx) {
        if (!map.has(v)) {
          map.set(v, pos.length / 3);
          pos.push(P[v * 3], P[v * 3 + 1] - (p.cat === "water" ? 0.4 : 0.6), P[v * 3 + 2]);
          let rgb = [0, 1, 2].map(ch => (C ? C.data[v * C.size + ch] : 1) * p.tint[ch]);
          if (p.cat === "water") rgb = [0.05, 0.16, 0.24];
          else if (treeCover && cov.has(`${Math.floor(P[v * 3] / 32)},${Math.floor(P[v * 3 + 2] / 32)}`)) rgb = rgb.map((x, ch) => x * 0.25 + treeCover.col[ch] * 0.75);
          col.push(...rgb);
        }
        idx.push(map.get(v));
      }
      const out = { attrs: { POSITION: { size: 3, data: Float32Array.from(pos) }, COLOR_0: { size: 3, data: Float32Array.from(col) } }, idx: Uint32Array.from(idx), nv: pos.length / 3 };
      w.addLods(`H_${t.id}_${p.cat}_${k}`, out, [{ idx: out.idx, lod: 3 }], mat, [c.x, 0, c.z]);
      sum.tris += out.idx.length / 3;
    }
    meta.push({ id: t.id, x: c.x, z: c.z, biome: t.biome, tris: sum.tris });
    process.stderr.write(`horizonte ${t.id} ${sum.tris} tri\n`);
  }
  const bytes = await w.write(file);
  const sha = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const m = { schema: "wildhaven.visual.horizon.v1", file: path.basename(file), bytes, sha256: sha, tiles: meta, totalTris: meta.reduce((s, x) => s + (x.tris ?? 0), 0), note: "Derivado dos GLBs originais (não alterados). Só apresentação: o servidor não usa." };
  fs.writeFileSync(file.replace(/\.glb$/, ".json"), JSON.stringify(m, null, 1));
  return m;
}

// ----------------------------------------------------------------- principal
const allTiles = MANIFEST.tiles;
let selected = allTiles;
if (args.around) { const s = new Set([args.around, ...MANIFEST.edges.filter(e => e.includes(args.around)).flat()]); selected = allTiles.filter(t => s.has(t.id)); }
if (args.tiles) { const s = new Set(String(args.tiles).split(",")); selected = allTiles.filter(t => s.has(t.id)); }

if (args.horizon) {
  const m = await buildHorizon(selected, path.resolve(REPO, args.horizon));
  console.log(JSON.stringify({ horizon: m.file, bytes: m.bytes, sha256: m.sha256, tiles: m.tiles.length, totalTris: m.totalTris }));
  process.exit(0);
}

const t0 = Date.now();
const scans = [];
for (const t of selected) {
  if (!fs.existsSync(tileSourcePath(t))) { console.error("ausente:", t.id); continue; }
  const sc = await scanTile(t);
  const inst = extractInstances(t.id, sc.raws);
  scans.push({ t, sc, inst });
  process.stderr.write(`varredura ${t.id}: ${sc.statics.length} estáticos, ${inst.length} instâncias originais\n`);
}
const factors = computeFactors(scans.flatMap(s => s.inst));
const report = { schema: "wildhaven.visual.build.v1", chunk: CHUNK, block: BLOCK, config: path.relative(REPO, path.resolve(REPO, args.config ?? "game/build-real-v02/data/vegetacao-provisoria-v02.json")), familias: factors, tiles: [] };
for (const { t, sc, inst } of scans) {
  const dir = path.join(OUT, t.id);
  fs.mkdirSync(dir, { recursive: true });
  const ras = buildRaster(sc.statics);
  const dense = densify(t.id, inst, factors, ras).filter(o => insideHex(o.x, o.z, -2));
  for (const o of dense) { o.ci = Math.floor(o.x / CHUNK); o.cj = Math.floor(o.z / CHUNK); o.cellK = (o.ci + 64) * 256 + (o.cj + 64); }
  const st = args["stats-only"] ? null : await writeStatic(t.id, sc.statics, dir, ras, canopyGrid(dense));
  if (st) st.heights = writeHeights(ras, dir), fs.writeFileSync(path.join(dir, "static.json"), JSON.stringify(st));
  const vm = args["stats-only"] ? { count: dense.length } : writeVeg(t.id, dense, dir);
  const tri = k => st ? st.leaves.reduce((s, l) => s + l.lods[k].tris, 0) : 0;
  const row = { id: t.id, leaves: st?.leaves.length, blocks: st?.blocks.length, trisL0: tri(0), trisL1: tri(1), trisL2: st?.blocks.reduce((s, b) => s + b.tris, 0), trisL3: st?.tile3.reduce((s, b) => s + b.tris, 0), staticBytes: st?.bytes, vegInstances: vm.count, vegOriginal: inst.length };
  report.tiles.push(row);
  process.stderr.write(`gerado ${t.id}: ${JSON.stringify(row)}\n`);
}
if (!args["stats-only"]) {
  const pm = await writeProtos(path.join(OUT, "prototypes.glb"));
  report.prototypes = pm.length;
}
report.seconds = (Date.now() - t0) / 1000;
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, `build-report-${CHUNK}.json`), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ tiles: report.tiles.length, prototypes: report.prototypes, seconds: report.seconds, familias: Object.fromEntries(Object.entries(factors).map(([k, v]) => [k, `${v.medianaOriginalM}→${v.medianaFinalM} m (n=${v.n})`])) }, null, 1));
