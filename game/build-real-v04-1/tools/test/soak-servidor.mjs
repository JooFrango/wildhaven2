// V04.1 (MET-03): o JSON traz SEMPRE a duração realmente executada (`minutosExecutados`), `concluido` (só vira true
// ao cumprir os minutos pedidos), a última amostra válida e o custo por fase do servidor (passos, visão publicada,
// mensagens por cliente). Um arquivo interrompido nunca se passa por um teste completo.
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
const res = { schema: "wildhaven.teste.soak-servidor.v2", inicio: new Date().toISOString(), minutosPedidos: min, minutosExecutados: 0, concluido: false, ultimaAmostraValida: null, erros: 0, ordens: [await order({ type: "explorar", hunters: ids })], amostras: [] };
// opcional: um cliente WebSocket leve no modo pedido (eco/3d/fundo), seguindo o 1º Hunter, para medir o custo das
// mensagens por cliente no servidor; reconecta se cair
let wsBytes = 0, wsMsgs = 0, wsReconexoes = 0;
const wsModo = A["cliente-ws"];
const abrirWs = () => {
  const ws = new WebSocket(base.replace(/^http/, "ws") + "/api/v1/stream");
  ws.onopen = () => { ws.send(JSON.stringify({ modo: wsModo })); ws.send(JSON.stringify({ foco: ids[0] })); };
  ws.onmessage = e => { wsBytes += typeof e.data === "string" ? Buffer.byteLength(e.data) : e.data.byteLength ?? 0; wsMsgs++; };
  ws.onclose = () => { wsReconexoes++; setTimeout(abrirWs, 2000); };
};
if (wsModo) { res.clienteWs = wsModo; abrirWs(); }
const t0 = Date.now();
while (Date.now() - t0 < min * 60000) {
  await new Promise(r => setTimeout(r, iv * 1000));
  try { s = await snap(); } catch (e) { res.erros++; res.amostras.push({ min: (Date.now() - t0) / 60000, erro: String(e) }); res.minutosExecutados = +((Date.now() - t0) / 60000).toFixed(2); fs.writeFileSync(A.out ?? "soak-servidor.json", JSON.stringify(res, null, 1)); continue; }
  const sv = s.server ?? {};
  // a cada 30 min, Hunters de volta na vila partem de novo (mundo sempre em movimento)
  if (res.amostras.length % 30 === 29) { const livres = s.hunters.filter(h => h.alive && h.role === "hunter" && h.activity === "na_vila").map(h => h.id); if (livres.length) res.ordens.push(await order({ type: "explorar", hunters: livres })); }
  res.amostras.push({ min: +((Date.now() - t0) / 60000).toFixed(2), simS: s.sim_time_s, cpu: sv.processo?.cpu_pct, rssMB: sv.processo?.rss_mb, p99: sv.intervalo_ms?.p99, max: sv.intervalo_ms?.max, escala: sv.escala_efetiva, divida: sv.divida_passos, descartados: sv.passos_descartados, criaturas: s.game?.metrics?.creatures_total, chunks: sv.terreno?.resident_chunks, chunksMB: (sv.terreno?.resident_bytes ?? 0) / 1048576, hexes: sv.pacotes?.presentes, vivos: s.hunters.filter(h => h.alive).length, eventos: s.game?.events?.[0]?.seq, custoMsPorS: sv.custo_ms_por_s ?? null, ws: sv.ws ?? null, perto: s.game?.metrics?.near, medio: s.game?.metrics?.mid, longe: s.game?.metrics?.far, congeladas: s.game?.metrics?.frozen, clienteWs: wsModo ? { bytes: wsBytes, msgs: wsMsgs, reconexoes: wsReconexoes } : null });
  res.minutosExecutados = res.amostras.at(-1).min; res.ultimaAmostraValida = res.amostras.at(-1).min;
  res.fim = new Date().toISOString();
  fs.writeFileSync(A.out ?? "soak-servidor.json", JSON.stringify(res, null, 1));
}
res.concluido = res.minutosExecutados >= min - iv / 60; res.fim = new Date().toISOString();
fs.writeFileSync(A.out ?? "soak-servidor.json", JSON.stringify(res, null, 1));
console.log("fim", res.minutosExecutados, "min executados de", min); process.exit(0);
