// V03 — Streaming por visibilidade: divide o `static.glb` de cada hex (gerado pelo pipeline da V02) em
// um GLB INDEPENDENTE por nó (folha LOD0, folha LOD1, parte de bloco, parte do hex inteiro), concatenados
// num pacote `chunks.bin` com índice de deslocamentos em `chunks.json`. O cliente baixa por HTTP Range só
// os nós que a seleção de visibilidade/LOD pede, cada nível de LOD independentemente.
// A geometria é copiada BYTE A BYTE dos acessores originais (sem reprocessar, sem simplificar): mesma malha,
// mesmo material, mesma cor de vértice. Também grava `heights.json` (grade de alturas compacta, sem GLB),
// usada pelo Modo Econômico e pela câmera, e copia veg.* / heights.bin / prototypes.*.
//
//   node split-chunks.mjs --in .generated/visual-v02 --out .generated/visual-v03
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith("--") ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const IN = path.resolve(REPO, args.in ?? ".generated/visual-v02");
const OUT = path.resolve(REPO, args.out ?? ".generated/visual-v03");
const COMP = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error("não é GLB: " + file);
  const jl = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + jl).toString("utf8"));
  const bo = 20 + jl, bl = b.readUInt32LE(bo);
  return { json, bin: b.subarray(bo + 8, bo + 8 + bl) };
}

/** Bytes compactos (sem stride) de um acessor. */
function accessorBytes(g, ai) {
  const a = g.json.accessors[ai], v = g.json.bufferViews[a.bufferView];
  const el = COMP[a.componentType] * NC[a.type], stride = v.byteStride ?? el;
  const start = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  if (stride === el) return Buffer.from(g.bin.subarray(start, start + el * a.count));
  const out = Buffer.alloc(el * a.count);
  for (let i = 0; i < a.count; i++) g.bin.copy(out, i * el, start + i * stride, start + i * stride + el);
  return out;
}

function glbForNode(g, ni) {
  const node = g.json.nodes[ni], mesh = g.json.meshes[node.mesh];
  const parts = [], accessors = [], views = [];
  let off = 0;
  const take = ai => {
    const a = g.json.accessors[ai], data = accessorBytes(g, ai);
    const pad = (4 - (off % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
    views.push({ buffer: 0, byteOffset: off, byteLength: data.length, ...(a.type !== "SCALAR" || mesh.primitives.every(p => p.indices !== ai) ? {} : {}) });
    parts.push(data); off += data.length;
    const na = { bufferView: views.length - 1, componentType: a.componentType, count: a.count, type: a.type };
    for (const k of ["normalized", "min", "max"]) if (a[k] !== undefined) na[k] = a[k];
    accessors.push(na);
    return accessors.length - 1;
  };
  const prims = mesh.primitives.map(p => {
    const attributes = {};
    for (const [k, ai] of Object.entries(p.attributes)) attributes[k] = take(ai);
    const np = { attributes, material: 0 };
    if (p.indices !== undefined) np.indices = take(p.indices);
    if (p.mode !== undefined) np.mode = p.mode;
    return np;
  });
  const n = { name: node.name, mesh: 0 };
  for (const k of ["translation", "rotation", "scale", "matrix"]) if (node[k]) n[k] = node[k];
  // o material (com texturas) é do hex inteiro e fica em materials.glb; o chunk leva só o índice
  const matIdx = mesh.primitives[0].material ?? 0;
  const json = { asset: { version: "2.0", generator: "wildhaven split-chunks v03" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [n], meshes: [{ name: mesh.name, primitives: prims }], materials: [{ name: g.json.materials?.[matIdx]?.name ?? "material" }], accessors, bufferViews: views, buffers: [{ byteLength: off }] };
  const bin = Buffer.concat(parts);
  let js = Buffer.from(JSON.stringify(json), "utf8"); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const binP = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + binP.length, 8);
  const ch = (len, type) => { const c = Buffer.alloc(8); c.writeUInt32LE(len, 0); c.writeUInt32LE(type, 4); return c; };
  const tris = prims.reduce((s, p) => s + (p.indices !== undefined ? accessors[p.indices].count : accessors[p.attributes.POSITION].count) / 3, 0);
  return { glb: Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(binP.length, 0x004e4942), binP]), tris, mat: matIdx };
}

function writeGlb(json, bin) {
  let js = Buffer.from(JSON.stringify(json), "utf8"); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const binP = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + (binP.length ? 8 + binP.length : 0), 8);
  const ch = (len, type) => { const c = Buffer.alloc(8); c.writeUInt32LE(len, 0); c.writeUInt32LE(type, 4); return c; };
  return Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ...(binP.length ? [ch(binP.length, 0x004e4942), binP] : [])]);
}

/** materials.glb: materiais, texturas, amostradores e imagens do hex (bytes das imagens copiados sem alteração). */
function materialsGlb(g) {
  const parts = [], views = []; let off = 0;
  const images = (g.json.images ?? []).map(im => {
    if (im.bufferView === undefined) return im;
    const v = g.json.bufferViews[im.bufferView], data = g.bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    const pad = (4 - (off % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
    views.push({ buffer: 0, byteOffset: off, byteLength: data.length }); parts.push(Buffer.from(data)); off += data.length;
    return { ...im, bufferView: views.length - 1 };
  });
  const json = { asset: { version: "2.0", generator: "wildhaven split-chunks v03" }, materials: g.json.materials ?? [] };
  if (images.length) Object.assign(json, { images, textures: g.json.textures, samplers: g.json.samplers, bufferViews: views, buffers: [{ byteLength: off }] });
  if (!json.samplers) delete json.samplers;
  return writeGlb(json, Buffer.concat(parts));
}

fs.mkdirSync(OUT, { recursive: true });
const report = { schema: "wildhaven.visual.chunks.v1", origem: path.relative(REPO, IN), tiles: [] };
for (const f of ["prototypes.glb", "prototypes.json", "build-report-256.json"]) if (fs.existsSync(path.join(IN, f))) fs.copyFileSync(path.join(IN, f), path.join(OUT, f));
for (const id of fs.readdirSync(IN).filter(d => fs.statSync(path.join(IN, d)).isDirectory()).sort()) {
  const src = path.join(IN, id), dst = path.join(OUT, id);
  if (!fs.existsSync(path.join(src, "static.glb"))) continue;
  fs.mkdirSync(dst, { recursive: true });
  const g = readGlb(path.join(src, "static.glb"));
  const meta = JSON.parse(fs.readFileSync(path.join(src, "static.json"), "utf8"));
  const pack = {}, chunks = [];
  let off = 0, nodes = 0, srcTris = 0, outTris = 0;
  g.json.nodes.forEach((node, ni) => {
    if (node.mesh === undefined) return;
    const { glb, tris, mat } = glbForNode(g, ni);
    pack[node.name] = [off, glb.length, tris, mat];
    chunks.push(glb); off += glb.length; nodes++; outTris += tris;
    srcTris += g.json.meshes[node.mesh].primitives.reduce((s, p) => s + g.json.accessors[p.indices].count / 3, 0);
  });
  const bin = Buffer.concat(chunks);
  fs.writeFileSync(path.join(dst, "chunks.bin"), bin);
  fs.writeFileSync(path.join(dst, "materials.glb"), materialsGlb(g));
  fs.writeFileSync(path.join(dst, "chunks.json"), JSON.stringify({ ...meta, schema: "wildhaven.visual.chunks.tile.v1", pack, packBytes: bin.length, packSha256: crypto.createHash("sha256").update(bin).digest("hex") }));
  fs.writeFileSync(path.join(dst, "heights.json"), JSON.stringify({ tile: id, ...meta.heights }));
  for (const f of ["heights.bin", "veg.bin", "veg.json"]) fs.copyFileSync(path.join(src, f), path.join(dst, f));
  if (srcTris !== outTris) throw new Error(`${id}: triângulos divergentes ${srcTris} != ${outTris}`);
  report.tiles.push({ id, nos: nodes, triangulos: outTris, bytes_glb_original: fs.statSync(path.join(src, "static.glb")).size, bytes_pacote: bin.length, maior_no: Math.max(...Object.values(pack).map(p => p[1])) });
  console.log(id, nodes, "nós", outTris, "tri", (bin.length / 1048576).toFixed(2), "MB");
}
fs.writeFileSync(path.join(OUT, "chunks-report.json"), JSON.stringify(report, null, 2));
// índice dos hexes com visual detalhado: o cliente não pede (nem recebe 404 de) hexes ausentes
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ schema: "wildhaven.visual.index.v1", tiles: report.tiles.map(t => t.id) }));
