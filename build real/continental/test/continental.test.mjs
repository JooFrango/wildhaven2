import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContinent, ContinentError } from "../src/graph.mjs";
import { TileStreamer, UnpreparedTileError } from "../src/streamer.mjs";
import { HunterRegionManager } from "../src/regions.mjs";
import { makeHttpProvider } from "../src/provider.mjs";

const manifest = JSON.parse(readFileSync(new URL("../data/continent-272.manifest.json", import.meta.url)));
const world = createContinent(manifest);

test("272 hexes, 738 logical borders and 6 marine tiles", () => {
  assert.equal(world.byId.size, 272);
  assert.equal(world.edgeCount, 738);
  assert.equal(world.tiles.filter(x => x.travelCost === null).length, 6);
  assert.equal(world.findRoute("HV_01", "WG_15"), null);
  assert.ok(world.findRoute("HV_01", "FX_20"));
});
test("terrestrial graph is fully connected without claiming physical passages", () => {
  const seen = new Set(["HV_01"]), queue = ["HV_01"];
  for (let i = 0; i < queue.length; i++) for (const id of world.neighbors.get(queue[i])) {
    if (world.byId.get(id).travelCost === null || seen.has(id)) continue;
    seen.add(id); queue.push(id);
  }
  assert.equal(seen.size, 266);
  assert.equal(world.findRoute("HV_01","FX_20",{ portalOpen:()=>false }),null);
});
test("source manifest rejects duplicates and invalid edges", () => {
  assert.throws(() => createContinent({ ...manifest, tiles: [...manifest.tiles, manifest.tiles[0]] }), ContinentError);
  assert.throws(() => createContinent({ ...manifest, edges: [...manifest.edges, ["BAD", "HV_01"]] }), ContinentError);
});
test("request deduplicates in-flight asset and LRU protects pinned chunks", async () => {
  let count = 0;
  const s = new TileStreamer({ maxBytes: 20, maxConcurrent: 2, loader: async id => {
    count++;
    await Promise.resolve();
    return { value: { id }, bytes: 10 };
  }});
  s.pin("A");
  const [a,b] = await Promise.all([s.ensure("A"),s.ensure("A")]);
  assert.deepEqual(a,b);
  assert.equal(count,1);
  await s.ensure("B");
  await s.ensure("C");
  assert.deepEqual(s.get("A"), { id:"A" });
  assert.equal(s.get("B"), null);
  assert.ok(s.stats().bytes <= 20);
  s.release("A");
  s.clearUnused();
  assert.equal(s.stats().bytes, 0);
});
test("region swap preserves previous Hunter residency on missing physics", async () => {
  const a = "HV_01";
  const b = [...world.neighbors.get(a)].find(id => world.byId.get(id).travelCost !== null);
  assert.ok(b);
  const s = new TileStreamer({ loader: async id => {
    if(id === b) throw new UnpreparedTileError(id,"physics");
    return { value:{id}, bytes:5 };
  }});
  const manager = new HunterRegionManager({ graph: world, streamer:s, canCross:()=>true });
  assert.equal((await manager.place("arvo",a)).ok,true);
  const result = await manager.cross("arvo",b);
  assert.equal(result.ok,false);
  assert.equal(manager.snapshot().arvo,a);
  assert.ok(s.get(a));
  manager.remove("arvo");
});
test("unvalidated physical border is blocked even if graph has an edge", async () => {
  const s = new TileStreamer({ loader: async id => ({value:{id},bytes:5}) });
  const manager = new HunterRegionManager({graph:world,streamer:s});
  assert.equal((await manager.place("brena","HV_01")).ok,true);
  const next = [...world.neighbors.get("HV_01")].find(id => world.byId.get(id).travelCost!==null);
  assert.equal((await manager.cross("brena",next)).reason,"border-not-certified");
  assert.equal(manager.snapshot().brena,"HV_01");
});
test("provider refuses to invent missing physical GLB packets", async () => {
  const provider = makeHttpProvider(manifest);
  await assert.rejects(provider("HV_01","physics"), UnpreparedTileError);
});

test("simultaneous Hunter crossings serialize instead of double-changing region", async () => {
  const old = "HV_01";
  const next = [...world.neighbors.get(old)].find(id => world.byId.get(id).travelCost !== null);
  let finish;
  const pending = new Promise(resolve => finish = resolve);
  const s = new TileStreamer({ loader: id => id === old
    ? Promise.resolve({ value: {id}, bytes: 5 })
    : pending.then(() => ({ value: {id}, bytes: 5 }))
  });
  const m = new HunterRegionManager({ graph: world, streamer: s, canCross: () => true });
  assert.equal((await m.place("hunter", old)).ok, true);
  const first = m.cross("hunter", next);
  assert.equal((await m.cross("hunter", next)).reason, "transition-in-progress");
  finish();
  assert.equal((await first).ok, true);
  assert.equal(m.snapshot().hunter, next);
});
