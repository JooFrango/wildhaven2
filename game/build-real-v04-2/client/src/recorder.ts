/**
 * V04.1 — gravador de quadros para o computador do diretor (F3 → "Gravar quadros").
 *
 * Grava CADA quadro por N segundos: intervalo, tempo do quadro no thread principal, último tempo de GPU medido e o
 * que mudou naquele quadro (programas de shader compilados, geometrias/texturas enviadas, nós de relevo carregados,
 * atores criados, compilações do portão de luzes, tarefas longas do navegador). No fim calcula FPS, 1% e 0,1% low,
 * p50/p95/p99 e quantos quadros passaram de 33/50/100 ms, e lista cada pico com as causas observadas no mesmo
 * quadro. É o mesmo método do laboratório (`tools/lab/picos.mjs`), mas na GPU real do jogador.
 * Não muda nada na cena: só lê contadores.
 */
export interface FrameCounters { prog: number; geo: number; tex: number; nodes: number; created: number; gate: number; drawCalls: number; triangles: number }
interface Rec { t: number; iv: number | null; cpu: number; gpu: number | null; d: Partial<FrameCounters>; dc: number }

export class FrameRecorder {
  private graphics: { t: number; kind: string; values: number[] }[] = [];
  event(kind: string, values: number[] = []) {
    if (this.active && this.graphics.length < 512) this.graphics.push({ t: performance.now(), kind, values });
  }
  private frames: Rec[] = [];
  private long: { t: number; d: number }[] = [];
  private obs: PerformanceObserver | null = null;
  private last = 0;
  private prev: FrameCounters | null = null;
  private until = 0;
  private done: ((r: unknown) => void) | null = null;
  get active() { return this.until > 0; }

  start(seconds: number, done: (r: unknown) => void) {
    this.graphics = []; this.frames = []; this.long = []; this.last = 0; this.prev = null; this.done = done;
    this.until = performance.now() + seconds * 1000;
    try { this.obs = new PerformanceObserver(l => { for (const e of l.getEntries()) this.long.push({ t: e.startTime, d: e.duration }); }); this.obs.observe({ type: "longtask" }); } catch { this.obs = null; }
  }

  /** Chamado no fim de cada quadro desenhado. */
  sample(t0: number, cpuMs: number, gpuMs: number | null, c: FrameCounters) {
    if (!this.until) return;
    const d: Partial<FrameCounters> = {};
    if (this.prev) for (const k of ["prog", "geo", "tex", "nodes", "created", "gate"] as const) if (c[k] !== this.prev[k]) d[k] = c[k] - this.prev[k];
    this.frames.push({ t: t0, iv: this.last ? t0 - this.last : null, cpu: +cpuMs.toFixed(2), gpu: gpuMs === null ? null : +gpuMs.toFixed(2), d, dc: c.drawCalls });
    this.last = t0; this.prev = { ...c };
    if (t0 >= this.until) this.finish();
  }

  private finish() {
    this.until = 0; this.obs?.disconnect(); this.obs = null;
    const fr = this.frames, iv = fr.map(f => f.iv).filter((x): x is number => x !== null).sort((a, b) => a - b);
    const n = iv.length, q = (p: number) => (n ? iv[Math.min(n - 1, Math.ceil(n * p) - 1)] : null);
    const low = (p: number) => { if (!n) return null; const k = Math.max(1, Math.ceil(n * p)); const worst = iv.slice(-k); return +(1000 * worst.length / worst.reduce((s, x) => s + x, 0)).toFixed(2); };
    const med = q(0.5) ?? 16.7, lim = Math.max(33, 2.5 * med);
    const picos = fr.filter(f => f.iv !== null && f.iv > lim).map(f => {
      const causas: string[] = [];
      if (f.d.prog && f.d.prog > 0) causas.push(`compilação de shader: +${f.d.prog}`);
      if (f.d.gate) causas.push(`portão de luzes: ${f.d.gate} compilação(ões) em paralelo`);
      if (f.d.geo && f.d.geo > 0) causas.push(`envio de geometria: +${f.d.geo}`);
      if (f.d.tex && f.d.tex > 0) causas.push(`envio de textura: +${f.d.tex}`);
      if (f.d.nodes && f.d.nodes > 0) causas.push(`relevo: +${f.d.nodes} bloco(s)`);
      if (f.d.created && f.d.created > 0) causas.push(`atores criados: +${f.d.created}`);
      const lt = this.long.filter(l => l.t <= f.t && l.t + l.d >= f.t - (f.iv ?? 0)).map(l => Math.round(l.d));
      if (lt.length) causas.push(`tarefa longa no thread principal: ${lt.join(", ")} ms`);
      if (!causas.length) causas.push(f.cpu > 0.6 * (f.iv ?? 0) ? "trabalho do quadro no thread principal" : "fora do quadro (GC, rede, interface, compositor ou GPU)");
      return { s: +((f.t - fr[0].t) / 1000).toFixed(2), intervaloMs: Math.round(f.iv ?? 0), cpuQuadroMs: f.cpu, gpuMs: f.gpu, causas };
    });
    const porCausa: Record<string, number> = {};
    for (const p of picos) for (const c of p.causas) { const k = c.replace(/[+-]?\d+(\.\d+)?/g, "N"); porCausa[k] = (porCausa[k] ?? 0) + 1; }
    const tot = (k: keyof FrameCounters) => fr.reduce((s, f) => s + Math.max(0, f.d[k] ?? 0), 0);
    const cpu = fr.map(f => f.cpu).sort((a, b) => a - b), gpu = fr.map(f => f.gpu).filter((x): x is number => x !== null).sort((a, b) => a - b);
    const r = {
      graphics: this.graphics, quadros: fr.length, segundos: fr.length ? +((fr.at(-1)!.t - fr[0].t) / 1000).toFixed(1) : 0,
      fpsMedio: n ? +(1000 * n / iv.reduce((s, x) => s + x, 0)).toFixed(2) : null, low1: low(0.01), low01: n >= 1000 ? low(0.001) : null,
      intervaloMs: { p50: q(0.5), p95: q(0.95), p99: q(0.99), max: n ? iv[n - 1] : null },
      acima33ms: iv.filter(x => x > 33).length, acima50ms: iv.filter(x => x > 50).length, acima100ms: iv.filter(x => x > 100).length,
      cpuQuadroMs: { p50: cpu[cpu.length >> 1] ?? null, p95: cpu[Math.floor(cpu.length * 0.95)] ?? null },
      gpuMs: gpu.length ? { p50: gpu[gpu.length >> 1], p95: gpu[Math.floor(gpu.length * 0.95)] } : "indisponível (sem EXT_disjoint_timer_query_webgl2)",
      eventos: { shadersCompilados: tot("prog"), compilacoesPortaoLuzes: tot("gate"), geometriasEnviadas: tot("geo"), texturasEnviadas: tot("tex"), blocosDeRelevo: tot("nodes"), atoresCriados: tot("created") },
      tarefasLongas: this.long.length, limiarPicoMs: Math.round(lim), picos: picos.length, porCausa, detalhePicos: picos.slice(0, 300),
    };
    const cb = this.done; this.done = null; cb?.(r);
  }
}
