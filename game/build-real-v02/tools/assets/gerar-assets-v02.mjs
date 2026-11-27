#!/usr/bin/env node
// Gera os GLBs PROPOSTOS da V02 que não existem no repositório: carroça (rodas como nós próprios,
// lona, banco do condutor, varais para o Dodarro, estandarte), acampamento (barracas, fogueira,
// caixas, barris, área de descanso, suporte de equipamentos) e as armadilhas Presa de Ferro e
// Laço de Raiz com clipes "acionar" e "rearmar". Low-poly facetado com cores por vértice.
// STATUS: proposta técnica da V02 — SEM aprovação artística. Não substitui nenhum asset aprovado.
// Uso: node tools/assets/gerar-assets-v02.mjs  (gera em game/build-real-v02/assets/models/ + manifest)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(path.join(path.dirname(new URL(import.meta.url).pathname), "../visual/package.json"));
const { Document, NodeIO, Accessor } = require("@gltf-transform/core");

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.resolve(HERE, "../../assets/models");

// ------------------------------------------------------------------ construtor de malhas facetadas
class Mesh {
  constructor() { this.pos = []; this.col = []; this.nor = []; }
  tri(a, b, c, color) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n) || 1; n = n.map(x => x / l);
    for (const p of [a, b, c]) { this.pos.push(...p); this.nor.push(...n); this.col.push(...color); }
  }
  quad(a, b, c, d, color) { this.tri(a, b, c, color); this.tri(a, c, d, color); }
  /** caixa orientada: centro, meias-dimensões, rotação Y/X/Z (rad) */
  box(cx, cy, cz, hx, hy, hz, color, rot = [0, 0, 0], shade = true) {
    const v = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) v.push(xf([sx * hx, sy * hy, sz * hz], rot, [cx, cy, cz]));
    const P = i => v[i];
    const c = (k) => shade ? color.map(x => x * k) : color;
    this.quad(P(0), P(1), P(3), P(2), c(0.82)); // -x
    this.quad(P(4), P(6), P(7), P(5), c(0.9)); // +x
    this.quad(P(0), P(4), P(5), P(1), c(0.7)); // -y
    this.quad(P(2), P(3), P(7), P(6), c(1.0)); // +y
    this.quad(P(0), P(2), P(6), P(4), c(0.86)); // -z
    this.quad(P(1), P(5), P(7), P(3), c(0.94)); // +z
  }
  /** cilindro com eixo local Y, transformado por rot/pos */
  cyl(r0, r1, h, seg, color, rot, pos, caps = true) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p = (r, a, y) => xf([Math.cos(a) * r, y, Math.sin(a) * r], rot, pos);
      const k = 0.78 + 0.22 * Math.abs(Math.cos((a0 + a1) / 2 - 0.8));
      this.quad(p(r0, a0, 0), p(r1, a0, h), p(r1, a1, h), p(r0, a1, 0), color.map(x => x * k));
      if (caps) { this.tri(p(0, 0, h), p(r1, a1, h), p(r1, a0, h), color); this.tri(p(0, 0, 0), p(r0, a0, 0), p(r0, a1, 0), color.map(x => x * 0.7)); }
    }
  }
}
function xf(p, [ry, rx, rz], [tx, ty, tz]) {
  let [x, y, z] = p;
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  return [x + tx, y + ty, z + tz];
}
const C = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255].map(v => Math.pow(v, 2.2)); // sRGB → linear
const WOOD = C(0x8a5a32), WOOD_D = C(0x5a3a22), WOOD_L = C(0xa8763f), CANVAS = C(0xe6dcc0), CANVAS_D = C(0xc9b991), IRON = C(0x4a4c50), RED = C(0xa3262a), GOLD = C(0xd9a441), ROPE = C(0xb59a62), STONE = C(0x77736c), LEAF = C(0x4f7a32), ROOT = C(0x6a4a2c), FIRE = C(0xff8a2a), FIRE_Y = C(0xffd34a);

// ------------------------------------------------------------------ escrita GLB
async function writeGlb(file, parts, anims = []) {
  const doc = new Document(); const buf = doc.createBuffer(); const scene = doc.createScene("cena");
  const mats = {
    madeira: doc.createMaterial("V02_madeira_lona").setRoughnessFactor(0.85).setMetallicFactor(0),
    ferro: doc.createMaterial("V02_ferro").setRoughnessFactor(0.45).setMetallicFactor(0.65),
    brilho: doc.createMaterial("V02_emissivo").setRoughnessFactor(0.6).setEmissiveFactor([1, 0.55, 0.2]),
  };
  const nodes = {};
  let tris = 0;
  for (const p of parts) {
    const node = doc.createNode(p.name);
    if (p.translation) node.setTranslation(p.translation);
    if (p.mesh && p.mesh.pos.length) {
      const prim = doc.createPrimitive().setMaterial(mats[p.mat ?? "madeira"])
        .setAttribute("POSITION", doc.createAccessor().setType(Accessor.Type.VEC3).setArray(new Float32Array(p.mesh.pos)).setBuffer(buf))
        .setAttribute("NORMAL", doc.createAccessor().setType(Accessor.Type.VEC3).setArray(new Float32Array(p.mesh.nor)).setBuffer(buf))
        .setAttribute("COLOR_0", doc.createAccessor().setType(Accessor.Type.VEC3).setArray(new Float32Array(p.mesh.col)).setBuffer(buf));
      node.setMesh(doc.createMesh(p.name).addPrimitive(prim));
      tris += p.mesh.pos.length / 9;
    }
    (p.parent ? nodes[p.parent] : scene).addChild(node);
    nodes[p.name] = node;
  }
  for (const a of anims) {
    const anim = doc.createAnimation(a.name);
    for (const ch of a.channels) {
      const s = doc.createAnimationSampler().setInterpolation("LINEAR")
        .setInput(doc.createAccessor().setType(Accessor.Type.SCALAR).setArray(new Float32Array(ch.times)).setBuffer(buf))
        .setOutput(doc.createAccessor().setType(ch.path === "rotation" ? Accessor.Type.VEC4 : Accessor.Type.VEC3).setArray(new Float32Array(ch.values.flat())).setBuffer(buf));
      anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(nodes[ch.node]).setTargetPath(ch.path).setSampler(s));
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const bin = await new NodeIO().writeBinary(doc);
  fs.writeFileSync(file, bin);
  return { file: path.relative(path.resolve(HERE, "../../../.."), file), bytes: bin.byteLength, sha256: crypto.createHash("sha256").update(bin).digest("hex"), triangles: tris, nodes: parts.map(p => p.name), clips: anims.map(a => ({ name: a.name, duration: Math.max(...a.channels.map(c => c.times.at(-1))) })) };
}
const qx = a => [Math.sin(a / 2), 0, 0, Math.cos(a / 2)];

// ------------------------------------------------------------------ carroça
function carroca() {
  const corpo = new Mesh();
  corpo.box(0, 0.92, 0, 0.86, 0.07, 1.7, WOOD);                 // assoalho
  for (const s of [-1, 1]) { corpo.box(s * 0.84, 1.18, 0, 0.05, 0.22, 1.7, WOOD_L); corpo.box(s * 0.84, 1.03, 0, 0.055, 0.02, 1.72, WOOD_D); }
  corpo.box(0, 1.18, -1.68, 0.86, 0.22, 0.05, WOOD_L); corpo.box(0, 1.18, 1.68, 0.86, 0.22, 0.05, WOOD_L);
  for (const z of [-1.2, -0.4, 0.4, 1.2]) for (const s of [-1, 1]) corpo.box(s * 0.89, 1.15, z, 0.03, 0.26, 0.04, WOOD_D); // montantes
  corpo.box(0, 0.78, 0, 0.12, 0.08, 1.75, WOOD_D);               // longarina
  for (const z of [-1.15, 1.15]) corpo.cyl(0.05, 0.05, 2.0, 8, IRON, [0, 0, Math.PI / 2], [1.0, 0.55, z]); // eixos
  corpo.box(0, 1.34, 1.52, 0.7, 0.05, 0.18, WOOD);               // banco do condutor
  corpo.box(0, 1.16, 1.62, 0.7, 0.2, 0.03, WOOD_D);
  for (const s of [-1, 1]) corpo.box(s * 0.45, 0.82, 2.55, 0.035, 0.035, 0.95, WOOD_D, [0, -0.12, 0]); // varais
  corpo.box(0, 0.7, 3.42, 0.48, 0.035, 0.035, WOOD_D);            // travessa do arreio
  // carga: barris e caixas
  corpo.cyl(0.22, 0.24, 0.55, 10, WOOD_L, [0, 0, 0], [0.45, 0.99, -1.2]);
  corpo.cyl(0.22, 0.24, 0.55, 10, WOOD_L, [0, 0, 0], [-0.4, 0.99, -1.25]);
  corpo.box(0.35, 1.15, -0.4, 0.25, 0.2, 0.25, WOOD, [0.2, 0, 0]);
  corpo.box(-0.35, 1.12, -0.2, 0.22, 0.17, 0.22, WOOD_D, [-0.3, 0, 0]);
  const ferragem = new Mesh();
  for (const z of [-1.69, 1.69]) for (const s of [-1, 1]) ferragem.box(s * 0.84, 1.18, z, 0.06, 0.24, 0.02, IRON);
  ferragem.box(0, 1.55, 1.62, 0.05, 0.05, 0.05, IRON); // gancho da lanterna
  const lona = new Mesh();
  const R = 0.86, L = 1.45, segs = 9;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI, a1 = ((i + 1) / segs) * Math.PI;
    const p = (a, z) => [Math.cos(a) * R, 1.38 + Math.sin(a) * R * 0.95, z];
    const sh = 0.8 + 0.2 * Math.sin((a0 + a1) / 2);
    lona.quad(p(a0, -L), p(a1, -L), p(a1, L), p(a0, L), CANVAS.map(x => x * sh));
    lona.quad(p(a0, L), p(a1, L), p(a1, L), p(a0, L), CANVAS); // (degenerado: mantém a frente aberta)
  }
  for (const z of [-L, -0.5, 0.5, L]) for (let i = 0; i < segs; i++) { // arcos
    const a0 = (i / segs) * Math.PI, a1 = ((i + 1) / segs) * Math.PI;
    const p = (a, r, dz) => [Math.cos(a) * r, 1.38 + Math.sin(a) * r * 0.95, z + dz];
    lona.quad(p(a0, R + 0.03, -0.04), p(a1, R + 0.03, -0.04), p(a1, R + 0.03, 0.04), p(a0, R + 0.03, 0.04), WOOD_D);
  }
  // estandarte vermelho com emblema (como na arte de referência do diretor)
  const est = new Mesh();
  est.cyl(0.025, 0.025, 1.6, 6, WOOD_D, [0, 0, 0], [-0.8, 1.1, -1.55]);
  est.box(-0.8, 2.35, -1.3, 0.015, 0.34, 0.24, RED);
  est.box(-0.81, 2.38, -1.3, 0.017, 0.12, 0.09, GOLD);
  const lanterna = new Mesh(); lanterna.box(0, 1.42, 1.72, 0.07, 0.1, 0.07, FIRE_Y, [0, 0, 0], false);
  const parts = [
    { name: "carroca", mesh: corpo },
    { name: "ferragens", mesh: ferragem, mat: "ferro", parent: "carroca" },
    { name: "lona", mesh: lona, parent: "carroca" },
    { name: "estandarte", mesh: est, parent: "carroca" },
    { name: "lanterna", mesh: lanterna, mat: "brilho", parent: "carroca" },
  ];
  // rodas: nó próprio com pivô no eixo (o cliente gira pela distância percorrida)
  for (const [n, x, z] of [["roda_DE", 1.0, 1.15], ["roda_DD", -1.0, 1.15], ["roda_TE", 1.0, -1.15], ["roda_TD", -1.0, -1.15]]) {
    const w = new Mesh(), r = 0.55, seg = 14;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p = (a, rr, x0) => [x0, Math.sin(a) * rr, Math.cos(a) * rr];
      for (const s of [-1, 1]) w.quad(p(a0, r, s * 0.06), p(a1, r, s * 0.06), p(a1, r - 0.08, s * 0.06), p(a0, r - 0.08, s * 0.06), WOOD_D);
      w.quad(p(a0, r, -0.06), p(a0, r, 0.06), p(a1, r, 0.06), p(a1, r, -0.06), IRON); // aro de ferro
    }
    for (let k = 0; k < 6; k++) w.box(0, 0, 0, 0.025, 0.47, 0.025, WOOD, [0, (k / 6) * Math.PI, 0]); // raios (eixo X)
    w.cyl(0.09, 0.09, 0.18, 8, WOOD_D, [0, 0, Math.PI / 2], [0.09, 0, 0]);
    parts.push({ name: n, mesh: w, parent: "carroca", translation: [x, 0.55, z] });
  }
  return writeGlb(path.join(OUT, "carroca/carroca_v02.glb"), parts);
}

// ------------------------------------------------------------------ acampamento
function acampamento() {
  const m = new Mesh();
  const tenda = (cx, cz, ry) => {
    const h = 1.5, w = 1.25, l = 1.4;
    const P = (x, y, z) => xf([x, y, z], [ry, 0, 0], [cx, 0, cz]);
    m.quad(P(-w, 0, -l), P(0, h, -l), P(0, h, l), P(-w, 0, l), CANVAS);
    m.quad(P(w, 0, l), P(0, h, l), P(0, h, -l), P(w, 0, -l), CANVAS_D);
    m.tri(P(-w, 0, -l), P(w, 0, -l), P(0, h, -l), CANVAS.map(x => x * 0.9));
    for (const z of [-l - 0.05, l + 0.05]) m.box(...P(0, h / 2 + 0.1, z), 0.025, h / 2 + 0.12, 0.025, WOOD_D);
  };
  tenda(-3.2, -1.5, 0.4); tenda(-0.8, -3.6, -0.2);
  // fogueira: pedras, lenha e chama
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; m.box(Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55, 0.13, 0.09, 0.1, STONE, [a, 0.2, 0.1]); }
  for (let i = 0; i < 3; i++) m.box(0, 0.12, 0, 0.06, 0.06, 0.45, WOOD_D, [(i / 3) * Math.PI, 0.25, 0]);
  const chama = new Mesh();
  chama.cyl(0.28, 0.0, 0.75, 7, FIRE, [0, 0, 0], [0, 0.12, 0], false);
  chama.cyl(0.16, 0.0, 1.0, 6, FIRE_Y, [0.4, 0, 0], [0.04, 0.12, 0.02], false);
  // área de descanso: esteiras e troncos-assento
  for (const [x, z, r] of [[1.6, 1.0, 0.3], [2.0, -0.6, -0.2], [0.6, 2.0, 1.2]]) m.box(x, 0.04, z, 0.32, 0.04, 0.9, RED.map(v => v * 0.8 + 0.05), [r, 0, 0]);
  m.cyl(0.22, 0.22, 1.3, 8, WOOD, [0.3, 0, Math.PI / 2], [-1.2, 0.22, 1.2]);
  m.cyl(0.2, 0.2, 1.1, 8, WOOD, [-0.9, 0, Math.PI / 2], [1.4, 0.2, -1.6]);
  // caixas e barris de suprimentos
  m.box(-2.4, 0.3, 1.0, 0.3, 0.3, 0.3, WOOD, [0.3, 0, 0]); m.box(-2.4, 0.78, 1.05, 0.22, 0.18, 0.22, WOOD_L, [0.8, 0, 0]);
  m.box(-1.8, 0.25, 1.6, 0.25, 0.25, 0.25, WOOD_D, [-0.2, 0, 0]);
  m.cyl(0.24, 0.26, 0.62, 10, WOOD_L, [0, 0, 0], [-3.0, 0, 0.4]);
  // suporte de equipamentos (lanças e escudo)
  m.box(2.6, 0.7, 1.9, 0.6, 0.04, 0.04, WOOD_D); for (const s of [-1, 1]) m.box(2.6 + s * 0.55, 0.45, 1.9, 0.04, 0.45, 0.04, WOOD_D);
  for (const s of [-0.3, 0.1, 0.45]) { m.cyl(0.018, 0.018, 1.9, 5, WOOD, [0, 0.15, 0], [2.6 + s, 0, 1.95]); m.cyl(0.05, 0.0, 0.18, 4, IRON, [0, 0.15, 0], [2.6 + s, 1.88, 2.24]); }
  return writeGlb(path.join(OUT, "acampamento/acampamento_v02.glb"), [{ name: "acampamento", mesh: m }, { name: "chama", mesh: chama, mat: "brilho", parent: "acampamento" }]);
}

// ------------------------------------------------------------------ Presa de Ferro
function presaDeFerro() {
  const base = new Mesh();
  base.cyl(0.32, 0.32, 0.04, 14, IRON, [0, 0, 0], [0, 0.0, 0]);
  base.cyl(0.08, 0.08, 0.06, 8, IRON.map(v => v * 1.3), [0, 0, 0], [0, 0.03, 0]); // gatilho
  for (const s of [-1, 1]) base.box(s * 0.36, 0.04, 0, 0.06, 0.04, 0.1, IRON); // molas
  base.box(0.55, 0.02, 0, 0.18, 0.015, 0.015, IRON); // corrente
  base.cyl(0.03, 0.01, 0.35, 5, WOOD_D, [0, 0, 0], [0.75, -0.25, 0]); // estaca
  const jaw = (sign) => {
    const j = new Mesh(); const r = 0.3, seg = 9;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI; const x = Math.cos(a) * r, z = Math.sin(a) * r * sign;
      j.box(x, 0, z, 0.03, 0.025, 0.03, IRON);
      if (i % 2 === 0 && i > 0 && i < seg) j.cyl(0.025, 0.0, 0.09, 4, IRON.map(v => v * 1.4), [0, 0, 0], [x * 0.92, 0, z * 0.92]); // dentes
    }
    return j;
  };
  const open = Math.PI / 2 * 0.98;
  const parts = [
    { name: "presa_de_ferro", mesh: base, mat: "ferro" },
    { name: "mandibula_a", mesh: jaw(1), mat: "ferro", parent: "presa_de_ferro", translation: [0, 0.04, 0] },
    { name: "mandibula_b", mesh: jaw(-1), mat: "ferro", parent: "presa_de_ferro", translation: [0, 0.04, 0] },
  ];
  // armada: mandíbulas abertas, deitadas (rotação ±90° em X); acionada: fechadas, de pé
  const anims = [
    { name: "acionar", channels: [{ node: "mandibula_a", path: "rotation", times: [0, 0.18, 0.24], values: [qx(open), qx(-0.08), qx(0)] }, { node: "mandibula_b", path: "rotation", times: [0, 0.18, 0.24], values: [qx(-open), qx(0.08), qx(0)] }] },
    { name: "rearmar", channels: [{ node: "mandibula_a", path: "rotation", times: [0, 0.9, 1.2], values: [qx(0), qx(open * 0.9), qx(open)] }, { node: "mandibula_b", path: "rotation", times: [0, 0.9, 1.2], values: [qx(0), qx(-open * 0.9), qx(-open)] }] },
  ];
  return writeGlb(path.join(OUT, "armadilhas/presa_de_ferro_v02.glb"), parts, anims);
}

// ------------------------------------------------------------------ Laço de Raiz
function lacoDeRaiz() {
  const base = new Mesh();
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; base.box(Math.cos(a) * 0.25, 0.04, Math.sin(a) * 0.25, 0.05, 0.04, 0.28, ROOT, [a, 0, 0.2]); } // raízes
  base.cyl(0.07, 0.05, 0.25, 6, ROOT, [0, 0, 0], [0, 0, 0]);
  base.box(0.2, 0.05, 0.0, 0.05, 0.05, 0.05, WOOD_D); // gatilho
  const galho = new Mesh();
  for (let i = 0; i < 6; i++) galho.box(0, 0.12 + i * 0.24, 0, 0.035 - i * 0.004, 0.13, 0.035 - i * 0.004, ROOT, [0, 0, 0]);
  for (let i = 0; i < 3; i++) galho.box(0.06, 1.2 + i * 0.12, 0.04, 0.09, 0.02, 0.05, LEAF, [i, 0.3, 0.4]);
  galho.box(0, 1.46, 0, 0.008, 0.008, 0.008, ROPE);
  const laco = new Mesh();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; laco.box(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22, 0.015, 0.015, 0.06, ROPE, [-a, 0, 0]); }
  laco.box(0, 0.35, 0, 0.01, 0.35, 0.01, ROPE);
  const bend = -1.2;
  const parts = [
    { name: "laco_de_raiz", mesh: base },
    { name: "galho", mesh: galho, parent: "laco_de_raiz", translation: [-0.1, 0.2, 0] },
    { name: "laco", mesh: laco, parent: "laco_de_raiz", translation: [0.3, 0.03, 0] },
  ];
  const qz = a => [0, 0, Math.sin(a / 2), Math.cos(a / 2)];
  const anims = [
    { name: "acionar", channels: [
      { node: "galho", path: "rotation", times: [0, 0.25, 0.4], values: [qz(bend), qz(0.15), qz(0)] },
      { node: "laco", path: "translation", times: [0, 0.25, 0.4], values: [[0.3, 0.03, 0], [0.05, 1.2, 0], [0.0, 1.05, 0]] },
    ] },
    { name: "rearmar", channels: [
      { node: "galho", path: "rotation", times: [0, 1.0, 1.5], values: [qz(0), qz(bend * 0.8), qz(bend)] },
      { node: "laco", path: "translation", times: [0, 1.0, 1.5], values: [[0.0, 1.05, 0], [0.25, 0.3, 0], [0.3, 0.03, 0]] },
    ] },
  ];
  return writeGlb(path.join(OUT, "armadilhas/laco_de_raiz_v02.glb"), parts, anims);
}

const items = [await carroca(), await acampamento(), await presaDeFerro(), await lacoDeRaiz()];
const manifest = {
  schema: "wildhaven.assets.v02.manifest.v1",
  status: "PROPOSTA TÉCNICA V02 — sem aprovação artística; criados porque não existiam no repositório (carroça, acampamento, Presa de Ferro, Laço de Raiz)",
  gerador: "game/build-real-v02/tools/assets/gerar-assets-v02.mjs (fonte editável: este script)",
  ossos: 0,
  items,
};
fs.writeFileSync(path.join(OUT, "manifest-assets-v02.json"), JSON.stringify(manifest, null, 1));
for (const i of items) console.log(i.file, i.bytes, "bytes", i.triangles, "tri", i.clips.map(c => c.name).join(","), i.sha256.slice(0, 12));
