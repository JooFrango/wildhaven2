// V04.2 — custo de publicação do servidor por cenário de clientes, sem navegador (60 s cada). Uso: node tools/test/publicacao-por-cliente.mjs http://127.0.0.1:PORTA
// custo de publicação por cenário de clientes (sem navegador): sem cliente, 1 eco, 1 fundo, 1 3d — 60 s cada
const [base] = process.argv.slice(2);
const snap = async () => (await fetch(base + "/api/v1/snapshot")).json();
const s0 = await snap(); const ids = s0.hunters.filter(h => h.role === "hunter").map(h => h.id);
await fetch(base + "/api/v1/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "explorar", hunters: ids }) });
await new Promise(r => setTimeout(r, 20000));
const out = {};
for (const modo of [null, "eco", "fundo", "3d"]) {
  let ws = null, bytes = 0;
  if (modo) { ws = new WebSocket(base.replace(/^http/, "ws") + "/api/v1/stream"); ws.onopen = () => { ws.send(JSON.stringify({ modo })); ws.send(JSON.stringify({ foco: ids[0] })); }; ws.onmessage = e => { bytes += e.data.length ?? 0; }; }
  await new Promise(r => setTimeout(r, 8000));
  const acc = { visao: 0, msgs: 0, passos: 0, n: 0 };
  for (let i = 0; i < 10; i++) { await new Promise(r => setTimeout(r, 5000)); const c = (await snap()).server?.custo_ms_por_s; if (c) { acc.visao += c.visao_publicada; acc.msgs += c.mensagens_clientes; acc.passos += c.passos; acc.n++; } }
  ws?.close();
  out[modo ?? "sem_cliente"] = { visaoMsPorS: +(acc.visao / acc.n).toFixed(2), mensagensMsPorS: +(acc.msgs / acc.n).toFixed(2), threadSimMsPorS: +(acc.passos / acc.n).toFixed(2), bytesRecebidosPorS: Math.round(bytes / 58) };
  console.log(modo ?? "sem_cliente", JSON.stringify(out[modo ?? "sem_cliente"]));
}
console.log(JSON.stringify(out));
