#!/usr/bin/env node
/**
 * Escolhe, de forma reprodutível, o ponto de partida do Hunter da Fase 2 a partir do
 * relatório N/N e dos pacotes WHP1 REAIS: prefere a Vila (HV_01) se ela tiver portal
 * validado para um vizinho certificado; senão, a aresta validada mais larga entre dois
 * hexes certificados. O ponto fica a ~150 m do portal, dentro do hex de origem, numa
 * célula com chão, sem água e sem bloqueio.
 *
 * Uso (na raiz do repo):
 *   node game/build-real-v02/tools/pick-spawn.mjs --report "build real/integracao/relatorio-continental-272.json" \
 *     --physics .generated/physics-272 --out game/build-real-v02/data/spawn-v01.json
 */
import {readFile, writeFile} from "node:fs/promises";
import {join, resolve} from "node:path";
import {gunzipSync} from "node:zlib";
import {decodePhysicsChunk} from "../../../build real/continental/compiler/physics.mjs";

const a = process.argv.slice(2), o = {};
for (let i = 0; i < a.length; i += 2) o[a[i].slice(2)] = a[i + 1];
const report = JSON.parse(await readFile(resolve(o.report), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../../../build real/continental/data/continent-272.manifest.json", import.meta.url), "utf8"));
const R = 2500, lattice = t => { const r = Math.round(t.z / (1.5 * R)), q = Math.round(t.x / (Math.sqrt(3) * R) - r / 2); return {x: Math.sqrt(3) * R * (q + r / 2), z: 1.5 * R * r}; };
const tiles = new Map(manifest.tiles.map(t => [t.id, {...t, ...lattice(t)}]));
const cert = new Set(report.tiles.filter(t => t.status === "certificado-tecnico").map(t => t.id));
const edges = report.edges.filter(e => e.status === "validado" && cert.has(e.a) && cert.has(e.b));
const pick = (list) => list.sort((x, y) => (y.portals[0]?.widthMeters ?? 0) - (x.portals[0]?.widthMeters ?? 0) || (x.a + x.b).localeCompare(y.a + y.b))[0];
let edge = pick(edges.filter(e => e.a === "HV_01" || e.b === "HV_01")), why = "Vila dos Hunters (HV_01) tem portal validado para vizinho certificado";
if (!edge) { edge = pick(edges); why = "HV_01 sem portal validado para vizinho certificado; escolhida a aresta validada mais larga entre dois hexes certificados"; }
if (!edge) throw Error("nenhuma aresta validada entre hexes certificados");
const from = edge.a === "HV_01" || !(edge.b === "HV_01") ? edge.a : edge.b, to = from === edge.a ? edge.b : edge.a;
const A = tiles.get(from), B = tiles.get(to), portal = edge.portals[0];
const d = Math.hypot(B.x - A.x, B.z - A.z), ux = (B.x - A.x) / d, uz = (B.z - A.z) / d;

const cache = new Map();
async function cell(tile, x, z) {
  const dir = join(resolve(o.physics), tile + "-physics-v01");
  if (!cache.has(tile)) cache.set(tile, JSON.parse(await readFile(join(dir, "index.json"), "utf8")));
  const idx = cache.get(tile), ix = Math.floor(x / idx.chunkMeters), iz = Math.floor(z / idx.chunkMeters);
  const meta = idx.chunks.find(c => c.ix === ix && c.iz === iz);
  if (!meta) return null;
  const ch = decodePhysicsChunk(gunzipSync(await readFile(join(dir, meta.url))));
  const i = Math.floor((x - ch.x0) / ch.res), j = Math.floor((z - ch.z0) / ch.res), k = j * ch.nx + i;
  return {h: ch.heights[k] + ch.baseY, water: Number.isFinite(ch.water[k]), blocked: ch.blocked[k] === 1};
}
let spawn = null;
outer: for (const back of [150, 120, 180, 100, 220, 260]) for (const side of [0, 8, -8, 16, -16, 32, -32]) {
  const x = portal.centerX - ux * back - uz * side, z = portal.centerZ - uz * back + ux * side;
  const c = await cell(from, x, z);
  if (c && Number.isFinite(c.h) && !c.water && !c.blocked) { spawn = {x: Number(x.toFixed(3)), z: Number(z.toFixed(3)), y: Number(c.h.toFixed(3)), back, side}; break outer; }
}
if (!spawn) throw Error("nenhuma célula caminhável perto do portal escolhido");
const out = {schema: "wildhaven.spawn.v1", worldId: "auralis-v01", seed: 20261126,
  rationale: why, edge: {from, to, portalWidthMeters: portal.widthMeters, portalCenter: [portal.centerX, portal.centerZ]},
  note: "Ponto de partida técnico da Fase 2 (validação de travessia). Não é decisão de design de onde os Hunters nascem.",
  hunters: [{id: "hunter-001", name: "Hunter do Workshop", tile: from, x: spawn.x, z: spawn.z, groundY: spawn.y,
    asset: "assets/hunters/hunter-workshop/base/hunter-masculino-1000v/hunter_masculino_1000v.glb"}]};
await writeFile(resolve(o.out), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
