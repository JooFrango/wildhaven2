// Teste do protocolo incremental CONTRA O SERVIDOR REAL: a conexão A reconstrói o estado só com diffs;
// a conexão B pede ressincronização repetidamente e recebe snapshots completos. Para cada seq em comum,
// o estado reconstruído deve ser IGUAL ao completo (listas sem ordem comparadas como conjunto).
//   node --experimental-strip-types tools/test/wire-ao-vivo.mjs ws://127.0.0.1:8791/api/v1/stream 40
import { WireState } from "../../client/src/wire.ts";
const [url = "ws://127.0.0.1:8791/api/v1/stream", secs = "30"] = process.argv.slice(2);
const A = new WireState(), recon = new Map();
const canon = v => { if (Array.isArray(v)) return v.map(canon); if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v).sort()) o[k] = canon(v[k]); return o; } return v; };
const norm = s => { const c = structuredClone(s); for (const k of ["tracks", "creatures"]) c.game?.[k]?.sort((a, b) => String(a.id).localeCompare(String(b.id))); return JSON.stringify(canon(c)); };
let ok = 0, bad = 0, bytesA = 0, msgsA = 0;
const a = new WebSocket(url), b = new WebSocket(url);
const FOCO = process.env.FOCO; // com foco: ambas as conexões recebem a visão filtrada do mesmo Hunter
if (FOCO) { a.onopen = () => a.send(JSON.stringify({ foco: FOCO })); b.onopen = () => b.send(JSON.stringify({ foco: FOCO })); }
a.onmessage = e => { bytesA += e.data.length; msgsA++; const s = A.receive(e.data); if (s) { recon.set(A.seq, norm(s)); if (recon.size > 400) recon.delete(recon.keys().next().value); } if (A.needResync) { console.error("A pediu ressincronização"); a.send(JSON.stringify({ resync: true })); } };
b.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.$t === "full") { const seq = m.$seq; delete m.$t; delete m.$seq; const r = recon.get(seq); if (r !== undefined) { if (r === norm(m)) ok++; else { bad++; console.error("DIVERGE em seq", seq); } } }
  setTimeout(() => b.readyState === 1 && b.send(JSON.stringify({ resync: true })), 450);
};
setTimeout(() => {
  console.log(JSON.stringify({ comparacoes_iguais: ok, divergencias: bad, completosA: A.fulls, deltasA: A.deltas, bytes_por_msg_A: Math.round(bytesA / Math.max(1, msgsA)) }));
  process.exit(bad === 0 && ok > 5 ? 0 : 1);
}, Number(secs) * 1000);
