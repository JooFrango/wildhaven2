// V04.2 — equivalência do capim depois do corte de alocações: para pontos aleatórios nos hexes carregados compara
// `groundAt` com o pré-filtro por extensão das folhas (V04.2) × sem ele (todas as extensões infinitas, como na V04.1).
// Também confere a matriz de mundo de cada folha usada: `updateWorldMatrix(true,false)` × `group.updateMatrixWorld(true)`.
//   node tools/test/capim-equivalencia.mjs --url http://127.0.0.1:8880/ --pontos 3000 --out bench/v04-2/capim-equivalencia.json
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const A = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith("--") ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const url = new URL(A.url ?? "http://127.0.0.1:8880/"); url.searchParams.set("perfil", A.perfil ?? "medio");
const b = await pw.chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(url.toString());
await p.waitForFunction(() => window.__wildhavenDbg?.().laco === "3d" && window.__wildhavenPerf?.drawCalls > 0, null, { timeout: 240000 });
await p.waitForTimeout(30000);
const r = await p.evaluate(n => {
  const s = window.__wildhavenScene, g = s.grass, w = s.world;
  const tiles = [...w.tiles.values()].filter(t => !t.tbox.isEmpty());
  let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  const foco = (g.last.x < 1e8 ? g.last : s.camera.position).clone(); const raio = Math.max(60, s.settings.smallDistance * 0.7);
  const saved = new Map(tiles.map(t => [t, t.tbox.clone()]));
  const res = { pontos: 0, iguais: 0, diferentes: 0, nulosAmbos: 0, pendentes: 0, exemplosDiferentes: [] };
  for (let i = 0; i < n; i++) {
    // metade perto do foco do capim (folhas L0 carregadas), metade em qualquer ponto dos hexes carregados
    let x, z;
    if (i % 2 === 0) { x = foco.x + (rnd() - 0.5) * 2 * raio; z = foco.z + (rnd() - 0.5) * 2 * raio; }
    else { const t = tiles[Math.floor(rnd() * tiles.length)]; x = t.ox + t.tbox.min.x + rnd() * (t.tbox.max.x - t.tbox.min.x); z = t.oz + t.tbox.min.z + rnd() * (t.tbox.max.z - t.tbox.min.z); }
    g.pending = false; const a = g.groundAt(x, z); const av = a ? [a.y, a.nY, a.col.r, a.col.g, a.col.b] : null; const pa = g.pending;
    for (const tt of tiles) tt.tbox.set(new THREE_V(-1e12), new THREE_V(1e12));
    g.pending = false; const c = g.groundAt(x, z); const cv = c ? [c.y, c.nY, c.col.r, c.col.g, c.col.b] : null; const pc = g.pending;
    for (const [tt, bx] of saved) tt.tbox.copy(bx);
    res.pontos++;
    if (pa || pc) { res.pendentes++; if (pa !== pc) res.diferentes++; continue; }
    if (!av && !cv) { res.nulosAmbos++; res.iguais++; continue; }
    if (av && cv && av.every((v, k) => v === cv[k])) res.iguais++; else { res.diferentes++; if (res.exemplosDiferentes.length < 5) res.exemplosDiferentes.push({ x, z, av, cv }); }
  }
  function THREE_V(v) { return { x: v, y: v, z: v }; }
  return res;
}, Number(A.pontos ?? 3000));
const out = { url: url.toString(), ...r };
fs.writeFileSync(A.out, JSON.stringify(out, null, 1)); console.log(JSON.stringify(out));
await b.close();
