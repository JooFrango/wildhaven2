#!/usr/bin/env node
/**
 * Extrai a velocidade de locomoção de clipes glTF IN-PLACE (sem root motion)
 * pelo método do pé plantado: durante o apoio, o pé mais baixo fica parado no
 * chão, então a velocidade horizontal dele em relação ao corpo é igual, com sinal
 * invertido, à velocidade de avanço do personagem.
 *
 * Nada é inventado: a cinemática direta (FK) é calculada a partir das curvas reais do
 * GLB (interpolação LINEAR/STEP, slerp em rotações) e a escala vem dos nós.
 *
 * Uso: node tools/clip-speed.mjs <hunter.glb> [--out clip-speeds.json]
 */
import {readFile, writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {parseGlb, readAccessor, multiplyMatrix, nodeMatrix} from "../../../build real/continental/compiler/glb.mjs";

const args = process.argv.slice(2);
const file = args[0];
if (!file) throw Error("uso: clip-speed.mjs <glb> [--out arquivo.json]");
const outIdx = args.indexOf("--out");
const bytes = await readFile(file);
const glb = parseGlb(bytes);
const g = glb.json;

const parents = new Map();
g.nodes.forEach((n, i) => (n.children ?? []).forEach(c => parents.set(c, i)));
const nodeByName = name => g.nodes.findIndex(n => n.name === name);

function sampleChannel(anim, ch, t) {
  const s = anim.samplers[ch.sampler];
  const n = g.accessors[s.input].count;
  const times = Array.from({length: n}, (_, i) => readAccessor(glb, s.input, i)[0]);
  const val = i => readAccessor(glb, s.output, i);
  if (t <= times[0]) return val(0);
  if (t >= times[n - 1]) return val(n - 1);
  let k = 0;
  while (k < n - 2 && times[k + 1] < t) k++;
  if (s.interpolation === "STEP") return val(k);
  if (s.interpolation && s.interpolation !== "LINEAR") throw Error("Interpolação não suportada: " + s.interpolation);
  const u = (t - times[k]) / (times[k + 1] - times[k]);
  const a = val(k), b = val(k + 1);
  if (ch.target.path === "rotation") return slerp(a, b, u);
  return a.map((x, i) => x + (b[i] - x) * u);
}
function slerp(a, b, u) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (d < 0) { b = b.map(x => -x); d = -d; }
  if (d > 0.9995) {
    const r = a.map((x, i) => x + (b[i] - x) * u), l = Math.hypot(...r);
    return r.map(x => x / l);
  }
  const th = Math.acos(d), s = Math.sin(th);
  const wa = Math.sin((1 - u) * th) / s, wb = Math.sin(u * th) / s;
  return a.map((x, i) => wa * x + wb * b[i]);
}
function worldPositions(anim, t) {
  const local = g.nodes.map(n => ({translation: n.translation, rotation: n.rotation, scale: n.scale, matrix: n.matrix}));
  for (const ch of anim.channels) {
    const p = ch.target.path;
    if (p === "weights") continue;
    local[ch.target.node] = {...local[ch.target.node], matrix: undefined, [p]: sampleChannel(anim, ch, t)};
  }
  const cache = new Map();
  const world = i => {
    if (cache.has(i)) return cache.get(i);
    const m = parents.has(i) ? multiplyMatrix(world(parents.get(i)), nodeMatrix(local[i])) : nodeMatrix(local[i]);
    cache.set(i, m);
    return m;
  };
  return name => { const m = world(nodeByName(name)); return [m[12], m[13], m[14]]; };
}
function median(a) { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; }

const result = {schema: "wildhaven.clip-speed.v1", source: file, bytes: bytes.byteLength,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  note: "speedMetersPerSecond é o valor usado; se agreement > 0.10 os dois métodos divergem e o clipe precisa de revisão antes de dirigir gameplay",
  method: "foot-plant: mediana de -v_horizontal do pé mais baixo nas amostras em que ele está a ≤2 cm da altura mínima do clipe",
  clips: []};
for (const anim of g.animations ?? []) {
  let duration = 0;
  for (const s of anim.samplers) duration = Math.max(duration, g.accessors[s.input].max[0]);
  const N = 240, dt = duration / N, samples = [];
  for (let i = 0; i <= N; i++) {
    const pos = worldPositions(anim, i * dt);
    samples.push({t: i * dt, L: pos("LeftFoot"), R: pos("RightFoot"), H: pos("Hips")});
  }
  // eixo de avanço = eixo horizontal com maior excursão dos pés
  const ext = ax => { const v = samples.flatMap(s => [s.L[ax], s.R[ax]]); return Math.max(...v) - Math.min(...v); };
  const fwd = ext(0) > ext(2) ? 0 : 2;
  const minY = Math.min(...samples.flatMap(s => [s.L[1], s.R[1]]));
  const vel = [];
  for (let i = 0; i < N; i++) {
    for (const f of ["L", "R"]) {
      const a = samples[i][f], b = samples[i + 1][f];
      const lowest = f === "L" ? a[1] <= samples[i].R[1] : a[1] < samples[i].L[1];
      if (lowest && a[1] - minY <= 0.02) vel.push((b[fwd] - a[fwd]) / dt);
    }
  }
  const footSpeed = Math.abs(median(vel));
  const strideLen = Math.max(...samples.map(s => s.L[fwd])) - Math.min(...samples.map(s => s.L[fwd]));
  const hipsDrift = samples[N].H[fwd] - samples[0].H[fwd];
  result.clips.push({name: anim.name, durationSeconds: duration, forwardAxis: fwd === 0 ? "x" : "z",
    stanceSamples: vel.length, speedMetersPerSecond: Number(footSpeed.toFixed(4)),
    footExcursionMeters: Number(strideLen.toFixed(4)),
    // estimativa independente: 2 passos por ciclo × excursão do pé / duração do ciclo
    strideEstimateMetersPerSecond: Number((2 * strideLen / duration).toFixed(4)),
    agreement: Number((Math.abs(footSpeed - 2 * strideLen / duration) / footSpeed).toFixed(3)), hipsRootDriftMeters: Number(hipsDrift.toFixed(4)),
    rootMotion: Math.abs(hipsDrift) > 0.05 ? "present" : "in-place"});
}
const json = JSON.stringify(result, null, 2) + "\n";
if (outIdx >= 0) await writeFile(args[outIdx + 1], json);
process.stdout.write(json);
