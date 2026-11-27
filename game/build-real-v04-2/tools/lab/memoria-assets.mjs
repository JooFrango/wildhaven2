// V04.2 — varredura de memória dos assets em runtime (cena 3D carregada): geometrias, materiais e texturas
// duplicados por conteúdo, bytes de vértices ainda mantidos na CPU × só na GPU, atributos que nenhum material usa
// (ex.: uv/tangente sem mapa) e o heap V8 real (Runtime.getHeapUsage) × o "heap" do performance.memory.
//   node tools/lab/memoria-assets.mjs --url http://127.0.0.1:8860/ --assentar 40 --out bench/v04-2/memoria-assets.json
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const A = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith("--") ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const url = new URL(A.url ?? "http://127.0.0.1:8860/"); url.searchParams.set("perfil", A.perfil ?? "medio");
const b = await pw.chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info"] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(url.toString());
await p.waitForFunction(() => window.__wildhavenDbg?.().laco === "3d" && window.__wildhavenPerf?.drawCalls > 0, null, { timeout: 240000 });
await p.waitForTimeout(Number(A.assentar ?? 40) * 1000);
const cdp = await p.context().newCDPSession(p);
await cdp.send("HeapProfiler.collectGarbage");
const heap = await cdp.send("Runtime.getHeapUsage");
const r = await p.evaluate(() => {
  const s = window.__wildhavenScene;
  const geos = new Map(), mats = new Map(), texs = new Map();
  const hashArr = a => { if (!a) return "sem-array"; const v = a; let h = 2166136261 >>> 0; const step = Math.max(1, Math.floor(v.length / 512)); for (let i = 0; i < v.length; i += step) { h = Math.imul(h ^ (v[i] * 1000 | 0), 16777619) >>> 0; } return `${v.constructor.name}:${v.length}:${h}`; };
  const roots = [s.scene, ...(s.actors.loadedTemplates?.() ?? [])];
  for (const root of roots) root.traverse(o => {
    if (!o.geometry) return;
    const g = o.geometry; if (!geos.has(g)) {
      let cpu = 0, gpuOnly = 0, unused = [];
      for (const [k, at] of Object.entries(g.attributes)) { const bytes = at.array?.byteLength ?? at.__whBytes ?? 0; if (at.array) cpu += bytes; else gpuOnly += bytes; }
      if (g.index) { const bytes = g.index.array?.byteLength ?? g.index.__whBytes ?? 0; if (g.index.array) cpu += bytes; else gpuOnly += bytes; }
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      const usesMap = ms.some(m => m?.map || m?.normalMap || m?.roughnessMap || m?.aoMap);
      if (g.attributes.uv && !usesMap) unused.push("uv"); if (g.attributes.tangent && !ms.some(m => m?.normalMap)) unused.push("tangent");
      if (g.attributes.color && !ms.some(m => m?.vertexColors)) unused.push("color");
      const key = Object.entries(g.attributes).map(([k, a]) => k + "=" + hashArr(a.array)).join("|") + "|i=" + hashArr(g.index?.array);
      geos.set(g, { key, cpu, gpuOnly, unused, nome: o.name });
    }
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m || mats.has(m)) continue;
      const key = [m.type, m.color?.getHexString?.(), m.roughness, m.metalness, m.vertexColors, m.flatShading, m.side, m.transparent, m.map?.uuid, m.onBeforeCompile?.toString().length].join(",");
      mats.set(m, key);
      for (const v of Object.values(m)) if (v?.isTexture && !texs.has(v)) { const img = v.image; texs.set(v, `${img?.width}x${img?.height}:${img?.src ?? img?.currentSrc ?? ""}`); }
    }
  });
  const dup = m => { const c = new Map(); for (const k of m.values()) { const kk = typeof k === "string" ? k : k.key; c.set(kk, (c.get(kk) ?? 0) + 1); } return [...c.values()].filter(n => n > 1).reduce((s, n) => s + n - 1, 0); };
  let cpu = 0, gpuOnly = 0; const unused = {}; const dupBytes = new Map();
  for (const g of geos.values()) { cpu += g.cpu; gpuOnly += g.gpuOnly; for (const u of g.unused) unused[u] = (unused[u] ?? 0) + 1; }
  const seenKey = new Set(); let bytesDuplicados = 0;
  for (const g of geos.values()) { if (g.key.includes("sem-array")) continue; if (seenKey.has(g.key)) bytesDuplicados += g.cpu; else seenKey.add(g.key); }
  const pm = performance.memory;
  return { geometrias: geos.size, geometriasDuplicadasPorConteudo: dup(new Map([...geos].map(([k, v]) => [k, v.key]))), bytesDuplicadosCPU_MB: +(bytesDuplicados / 1048576).toFixed(2),
    verticesNaCPU_MB: +(cpu / 1048576).toFixed(1), verticesSoNaGPU_MB: +(gpuOnly / 1048576).toFixed(1), atributosSemUso: unused,
    materiais: mats.size, materiaisIdenticos: dup(mats), texturas: texs.size, texturasIdenticas: dup(texs),
    performanceMemoryMB: pm ? +(pm.usedJSHeapSize / 1048576).toFixed(1) : null, relevoCpuLiberados: s.world.stats.cpuLiberados ?? null,
    programas: s.renderer.info.programs.length, rendererInfo: { ...s.renderer.info.memory } };
});
const res = { url: url.toString(), heapV8AposGC_MB: +(heap.usedSize / 1048576).toFixed(1), ...r };
fs.mkdirSync(A.out.split("/").slice(0, -1).join("/") || ".", { recursive: true });
fs.writeFileSync(A.out, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
await b.close();
