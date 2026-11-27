#!/usr/bin/env node
/**
 * Gera vetores de paridade EXECUTANDO o TypeScript original da Alpha
 * (game/alpha01, somente leitura) para o porte em Rust (wh-core::rng, wh-core::combat).
 * Uso: node --experimental-strip-types --no-warnings tools/gen-parity-fixtures.mjs
 */
import {register} from "node:module";
import {writeFile, readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
register("./ts-resolve-hook.mjs", import.meta.url);
const alpha = new URL("../../alpha01/src/", import.meta.url);
const {random, hash, clamp} = await import(new URL("core/random.ts", alpha));
const {strike, hunterDamage} = await import(new URL("combat/combat.ts", alpha));
const {SPECIES} = await import(new URL("creatures/species.ts", alpha));
const srcHash = async p => createHash("sha256").update(await readFile(new URL(p, alpha))).digest("hex");

const seeds = [1, 7, 42, 1337, 20261126, 0x9e3779b9, 0xffffffff];
const rngVectors = seeds.map(seed => { const w = {rng: seed}; return {seed, values: Array.from({length: 64}, () => random(w)), finalState: w.rng}; });
const hashVectors = [];
for (const seed of [0, 3, 99991, -5, 2 ** 31 + 17]) for (let i = 0; i < 40; i++) {
  const w = {rng: seed + i + 1};
  const x = (random(w) - 0.5) * 2e5, z = (random(w) - 0.5) * 2e5;
  hashVectors.push({x, z, seed, value: hash(x, z, seed)});
}
const clampVectors = [[-3, 0, 1], [0.5, 0, 1], [9, -2, 4], [NaN, 0, 1]].map(([n, a, b]) => ({n: Number.isNaN(n) ? null : n, a, b, value: Number.isNaN(clamp(n, a, b)) ? null : clamp(n, a, b)}));

// Combate: cenários sorteados por seed, executando strike() real sobre um World mínimo.
const strikeScenarios = [];
for (const seed of [11, 23, 5813, 777777]) {
  const w = {rng: seed, time: 0, items: [], hunters: [], creatures: []};
  for (let k = 0; k < 30; k++) {
    const species = Object.keys(SPECIES)[Math.floor(random(w) * 3)];
    const h = {id: "h", x: 0, z: 0, cooldown: random(w) < 0.25 ? 0.4 : 0, natural: {força: Math.floor(random(w) * 20)},
      equipment: "w1", kills: 0, haul: 0, history: [], status: "expedição", phase: "", target: "c"};
    const attack = Math.floor(random(w) * 12);
    w.items = [{id: "w1", equippedBy: "h", attack}];
    const c = {id: "c", species, x: (random(w) - 0.5) * 6, z: (random(w) - 0.5) * 6, hp: Math.floor(random(w) * SPECIES[species].hp) + 1, state: "explorar"};
    const before = {hunter: {x: h.x, z: h.z, cooldown: h.cooldown, forca: h.natural.força, equippedAttack: attack, kills: 0, haul: 0},
      creature: {x: c.x, z: c.z, hp: c.hp, food: SPECIES[species].food}};
    const damage = hunterDamage(w, h);
    strike(w, h, c);
    strikeScenarios.push({seed, k, before, damage, after: {cooldown: h.cooldown, kills: h.kills, haul: h.haul, hp: c.hp}});
  }
}
const out = {schema: "wildhaven.parity.alpha01.v1",
  source: {path: "game/alpha01/src", files: {"core/random.ts": await srcHash("core/random.ts"), "combat/combat.ts": await srcHash("combat/combat.ts"), "creatures/species.ts": await srcHash("creatures/species.ts")}},
  rng: rngVectors, hash: hashVectors, clamp: clampVectors, strike: strikeScenarios};
await writeFile(new URL("../data/parity/alpha01-rng-combat.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log("paridade: rng=" + rngVectors.length + " seeds, hash=" + hashVectors.length + ", strike=" + strikeScenarios.length);
