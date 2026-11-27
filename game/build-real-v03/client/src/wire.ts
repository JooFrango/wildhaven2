// V03 — aplicação do protocolo incremental (espelho de `wh_core::wire::apply`, servidor Rust).
// Mensagens: {"$t":"full","$seq":n, ...snapshot} e {"$t":"d","$seq":n,"$base":m,"p":patch}.
// Se `$base` não for o `$seq` que este cliente tem, o estado está inconsistente: pede ressincronização.
const MARK = "§";
type J = any;
const keyOf = (v: J): string | null => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const k = v.id ?? v.seq;
  return k === undefined || k === null ? null : String(k);
};
export function apply(target: J, patch: J): J {
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) return patch;
  const m = patch[MARK];
  if (m === "a") {
    const old: J[] = Array.isArray(target) ? target : [];
    const del = new Set<string>((patch.del ?? []).map(String));
    const upd: Record<string, J> = patch.upd ?? {};
    const out: J[] = [], have = new Set<string>();
    for (const v of old) {
      const k = keyOf(v) ?? "";
      if (del.has(k)) continue;
      out.push(k in upd ? apply(v, upd[k]) : v); have.add(k);
    }
    for (const k of Object.keys(upd)) if (!have.has(k)) out.push(apply(null, upd[k]));
    if (Array.isArray(patch.ord)) { const by = new Map(out.map(v => [keyOf(v) ?? "", v])); return patch.ord.map((k: J) => by.get(String(k))).filter((v: J) => v !== undefined); }
    return out;
  }
  if (m === "i") {
    const old: J[] = Array.isArray(target) ? target.slice(0, patch.n) : [];
    while (old.length < patch.n) old.push(null);
    for (const [i, d] of Object.entries(patch.set ?? {})) { const n = Number(i); if (n < old.length) old[n] = apply(old[n], d); }
    return old;
  }
  // objeto: mescla campo a campo, preservando a identidade dos objetos não alterados (menos trabalho no apresentador)
  const out: J = target && typeof target === "object" && !Array.isArray(target) ? { ...target } : {};
  for (const [k, d] of Object.entries(patch)) {
    if (d && typeof d === "object" && !Array.isArray(d) && (d as J)[MARK] === "x") delete out[k];
    else out[k] = apply(out[k], d);
  }
  return out;
}

/** Estado do fio de um cliente: aplica mensagens e detecta perda de estado. */
export class WireState {
  seq = 0;
  state: J = null;
  fulls = 0;
  deltas = 0;
  resyncs = 0;
  bytes = 0;
  /** Devolve o estado novo, ou null se a mensagem foi descartada (e `needResync` ficou true). */
  needResync = false;
  receive(text: string): J | null {
    this.bytes += text.length;
    let msg: J;
    try { msg = JSON.parse(text); } catch { this.needResync = true; return null; }
    if (msg.$t === "full") {
      const s = msg; this.seq = s.$seq; delete s.$t; delete s.$seq;
      this.state = s; this.fulls++; this.needResync = false; return s;
    }
    if (msg.$t === "d") {
      if (this.state === null || msg.$base !== this.seq) { this.needResync = true; return null; }
      this.state = apply(this.state, msg.p); this.seq = msg.$seq; this.deltas++; return this.state;
    }
    return null;
  }
}
