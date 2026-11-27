// Teste longo do SERVIDOR V04 (continente inteiro): Hunters explorando, a cada `--intervalo` s grava CPU/RSS do
// processo, custo do intervalo (p99/máx), escala efetiva, dívida/descartes, criaturas, chunks físicos residentes,
// hexes presentes e eventos. Regrava o JSON a cada amostra (sobrevive a interrupção).
//   node tools/test/soak-servidor.mjs --url http://127.0.0.1:8796 --minutos 480 --out bench/soak-servidor-8h.json
import fs from "node:fs";
const A = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith("--") ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const base = A.url ?? "http://127.0.0.1:8796", min = Number(A.minutos ?? 480), iv = Number(A.intervalo ?? 60);
const snap = async () => (await fetch(base + "/api/v1/snapshot")).json();
const order = (o) => fetch(base + "/api/v1/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(o) }).then(r => r.json()).catch(e => ({ erro: String(e) }));
let s = await snap();
const ids = s.hunters.filter(h => h.role === "hunter").map(h => h.id);
const res = { schema: "wildhaven.teste.soak-servidor.v1", inicio: new Date().toISOString(), minutosPedidos: min, ordens: [await order({ type: "explorar", hunters: ids })], amostras: [] };
const t0 = Date.now();
while (Date.now() - t0 < min * 60000) {
  await new Promise(r => setTimeout(r, iv * 1000));
  try { s = await snap(); } catch (e) { res.amostras.push({ min: (Date.now() - t0) / 60000, erro: String(e) }); continue; }
  const sv = s.server ?? {};
  // a cada 30 min, Hunters de volta na vila partem de novo (mundo sempre em movimento)
  if (res.amostras.length % 30 === 29) { const livres = s.hunters.filter(h => h.alive && h.role === "hunter" && h.activity === "na_vila").map(h => h.id); if (livres.length) res.ordens.push(await order({ type: "explorar", hunters: livres })); }
  res.amostras.push({ min: +((Date.now() - t0) / 60000).toFixed(2), simS: s.sim_time_s, cpu: sv.processo?.cpu_pct, rssMB: sv.processo?.rss_mb, p99: sv.intervalo_ms?.p99, max: sv.intervalo_ms?.max, escala: sv.escala_efetiva, divida: sv.divida_passos, descartados: sv.passos_descartados, criaturas: s.game?.metrics?.creatures_total, chunks: sv.terreno?.resident_chunks, chunksMB: (sv.terreno?.resident_bytes ?? 0) / 1048576, hexes: sv.pacotes?.presentes, vivos: s.hunters.filter(h => h.alive).length, eventos: s.game?.events?.[0]?.seq });
  res.fim = new Date().toISOString();
  fs.writeFileSync(A.out ?? "soak-servidor.json", JSON.stringify(res, null, 1));
}
console.log("fim");
