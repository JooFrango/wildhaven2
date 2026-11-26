#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContinent } from "../src/graph.mjs";

const data = new URL("../data/", import.meta.url);
const load = f => JSON.parse(readFileSync(new URL(f, data), "utf8"));
const graphSource = load("auralis-grafo-original.json");
const manifest = load("continent-272.manifest.json");
const world = createContinent(manifest);
const terrain = manifest.tiles.filter(t => t.travelCost !== null);
const sea = manifest.tiles.filter(t => t.travelCost === null);
assert.equal(world.byId.size, 272);
assert.equal(world.edgeCount, 738);
assert.equal(terrain.length, 266);
assert.deepEqual(sea.map(t => t.id), ["WG_15","WG_16","WG_17","WG_18","WG_19","WG_20"]);
assert.equal(graphSource.tiles.length, manifest.tiles.length);
assert.equal(graphSource.arestas.length, manifest.edges.length);
const old = new Map(graphSource.tiles.map(t => [t.id, t]));
let bytes = 0;
for (const tile of manifest.tiles) {
  const baseline = old.get(tile.id);
  assert.ok(baseline, "Unmapped tile: " + tile.id);
  assert.equal(tile.x, baseline.x);
  assert.equal(tile.z, baseline.z);
  assert.equal(tile.biome, baseline.bioma);
  assert.equal(tile.travelCost, baseline.custo ?? null);
  assert.equal(tile.source.path, baseline.glb);
  assert.equal(tile.runtime.physics, "not-built");
  assert.equal(tile.runtime.gameplay, "not-certified");
  assert.ok(tile.source.bytes > 0);
  assert.match(tile.source.gitBlobSha1, /^[0-9a-f]{40}$/i);
  bytes += tile.source.bytes;
}
assert.equal(bytes, 1371999692);
assert.equal(bytes, manifest.counts.sourceBytes);
assert.equal(manifest.counts.certifiedPhysicalTiles, 0);
const seen = new Set(["HV_01"]), queue = ["HV_01"];
for (let i = 0; i < queue.length; i++) {
  for (const next of world.neighbors.get(queue[i])) {
    if (seen.has(next) || world.byId.get(next).travelCost === null) continue;
    seen.add(next); queue.push(next);
  }
}
assert.equal(seen.size, 266);
assert.ok(world.findRoute("HV_01", "FX_20"));
assert.equal(world.findRoute("HV_01", "WG_15"), null);
assert.equal(world.findRoute("HV_01", "FX_20", { portalOpen: () => false }), null);
console.log(JSON.stringify({
  status: "PASS", sourceTiles: 272, graphEdges: 738,
  terrestrialGraphReachable: 266, maritimeGraphBlocked: 6,
  sourceBytes: bytes, physicallyCertifiedTiles: 0,
  note: "Inventory/topology ONLY; terrain and gameplay still need validation"
}, null, 2));
