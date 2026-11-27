// Métricas do apresentador V03 (nada é estimado sem dizer): intervalos reais de quadro (p50/p95/p99,
// 1% low, travamentos > max(50 ms, 2× o intervalo-alvo) e > max(100 ms, 3×)), tempo de CPU por quadro, tempo de GPU (EXT_disjoint_timer_query_webgl2,
// quando o navegador expõe), draw calls, triângulos, RAM JS (performance.memory, só Chromium), VRAM ESTIMADA
// (soma de buffers e texturas, recalculada a cada 5 s — a V02 varria a cena a cada 30 quadros), quadros
// efetivamente desenhados, estado dos laços 3D / pixel art e uma série temporal para o relatório exportável.
import type * as THREE from "three";

export type LoopState = "3d" | "pixel" | "suspenso" | "carregando";

export class Perf {
  mode: LoopState = "carregando";
  loadSeconds = 0;
  resScale = 1;
  framesDrawn = 0;
  stalls50 = 0;
  /** Intervalo-alvo do laço ativo (3D: 16,7 ms; Econômico: 1000/FPS). Travamento = intervalo > max(50 ms, 2× alvo). */
  targetMs = 1000 / 60;
  stalls100 = 0;
  private times: number[] = [];
  private cpu: number[] = [];
  private last = 0;
  private gl: WebGL2RenderingContext | null = null;
  private ext: any = null;
  private queries: { q: WebGLQuery; t: number }[] = [];
  private gpuMs: number | null = null;
  /** V04.1: último tempo de GPU medido, sem média (gravador de quadros). */
  gpuRaw: number | null = null;
  private measuringGpu = false;
  private culling: any = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private vramMB: number | null = null;
  private vramAt = 0;
  readonly series: Record<string, unknown>[] = [];
  private seriesAt = 0;
  public: Record<string, unknown> = {};
  extra: () => Record<string, unknown> = () => ({});
  attach(renderer: THREE.WebGLRenderer | null) {
    for (const { q } of this.queries) this.gl?.deleteQuery(q);
    this.measuringGpu = false;
    this.renderer = renderer; this.queries = []; this.gpuMs = null;
    this.gl = renderer ? (renderer.getContext() as WebGL2RenderingContext) : null;
    this.ext = this.gl ? this.gl.getExtension("EXT_disjoint_timer_query_webgl2") : null;
    this.times.length = 0; this.cpu.length = 0; this.last = 0;
  }
  beginGpu() {
    if (!this.ext || !this.gl || this.queries.length > 4) return;
    const q = this.gl.createQuery();
    if (!q) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.measuringGpu = true;
    this.queries.push({ q, t: performance.now() });
  }
  endGpu() {
    if (!this.measuringGpu || !this.gl) return;
    this.measuringGpu = false;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
  }
  private pollGpu() {
    if (!this.ext || !this.gl) return;
    const disjoint = this.gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    while (this.queries.length) {
      const { q } = this.queries[0];
      if (!this.gl.getQueryParameter(q, this.gl.QUERY_RESULT_AVAILABLE)) break;
      const ns = this.gl.getQueryParameter(q, this.gl.QUERY_RESULT);
      if (!disjoint) { this.gpuRaw = ns / 1e6; this.gpuMs = this.gpuMs === null ? ns / 1e6 : this.gpuMs * 0.9 + (ns / 1e6) * 0.1; }
      this.gl.deleteQuery(q); this.queries.shift();
    }
  }
  gpuOrFrameMs() { return this.gpuMs ?? this.avg(this.times); }
  private avg(a: number[]) { let s = 0; for (const x of a) s += x; return a.length ? s / a.length : 0; }
  /** Um quadro desenhado (3D ou pixel art). `culling`: estatísticas do apresentador. */
  frame(cpuMs: number, culling: any) {
    const now = performance.now();
    if (this.last) {
      const dt = now - this.last;
      this.times.push(dt);
      if (dt > Math.max(50, 2 * this.targetMs)) this.stalls50++;
      if (dt > Math.max(100, 3 * this.targetMs)) this.stalls100++;
    }
    this.last = now; this.cpu.push(cpuMs); this.framesDrawn++;
    if (this.times.length > 600) this.times.shift();
    if (this.cpu.length > 600) this.cpu.shift();
    if (culling) this.culling = culling;
    this.pollGpu();
    if (this.framesDrawn % 30 === 0) this.publish();
  }
  /** Ao suspender (segundo plano / troca de modo): o próximo intervalo não conta como travamento. */
  pause() { this.last = 0; this.publish(); }
  publish() {
    const now = performance.now();
    const sorted = this.times.slice().sort((a, b) => a - b);
    const q = (p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] : null);
    const worst = sorted.slice(-Math.max(1, Math.floor(sorted.length / 100)));
    const info = this.renderer?.info;
    const mem = (performance as any).memory;
    if (now - this.vramAt > 5000) { this.vramAt = now; this.vramMB = this.renderer ? estimateVram(this.renderer) : 0; }
    this.public = {
      mode: this.mode,
      fps: 1000 / Math.max(0.001, this.avg(this.times)),
      low1: worst.length ? 1000 / Math.max(0.001, this.avg(worst)) : null,
      frameMs: this.avg(this.times), p50Ms: q(0.5), p95Ms: q(0.95), p99Ms: q(0.99), maxMs: sorted.at(-1) ?? null,
      stalls50: this.stalls50, stalls100: this.stalls100,
      cpuMs: this.avg(this.cpu),
      gpuMs: this.gpuMs,
      gpuTimer: !!this.ext,
      drawCalls: info?.render.calls ?? 0,
      triangles: info?.render.triangles ?? 0,
      geometries: info?.memory.geometries ?? 0,
      textures: info?.memory.textures ?? 0,
      heapMB: mem ? mem.usedJSHeapSize / 1048576 : null,
      vramEstMB: this.vramMB,
      loadSeconds: this.loadSeconds,
      resScale: this.resScale,
      framesDrawn: this.framesDrawn,
      culling: this.culling,
      ...this.extra(),
    };
    (window as any).__wildhavenPerf = this.public;
    if (now - this.seriesAt > 5000) {
      this.seriesAt = now;
      const p = this.public as any;
      this.series.push({ t: Math.round(now / 1000), mode: p.mode, fps: p.fps, p95Ms: p.p95Ms, cpuMs: p.cpuMs, heapMB: p.heapMB, vramEstMB: p.vramEstMB, drawCalls: p.drawCalls, triangles: p.triangles, framesDrawn: p.framesDrawn });
      if (this.series.length > 360) this.series.shift(); // 30 min
    }
  }
}

/** VRAM estimada: bytes dos atributos/índices das geometrias e das texturas vivas na cena. */
function estimateVram(r: THREE.WebGLRenderer) {
  const scene = (r as any).__whScene as THREE.Scene | undefined;
  if (!scene) return null;
  const seen = new Set<unknown>(); let bytes = 0;
  scene.traverse(o => {
    const m = o as THREE.Mesh; if (!m.isMesh || !m.geometry) return;
    for (const a of [...Object.values(m.geometry.attributes), m.geometry.index]) if (a && !seen.has(a)) { seen.add(a); bytes += ((a as THREE.BufferAttribute).array as ArrayBufferView).byteLength; }
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) for (const v of Object.values(mat)) {
      const t = v as THREE.Texture;
      if (t?.isTexture && !seen.has(t)) { seen.add(t); const img = t.image as { width?: number; height?: number }; if (img?.width) bytes += img.width * img.height! * 4 * 1.33; }
    }
  });
  return bytes / 1048576;
}

/** Relatório de desempenho exportável (o diretor envia o JSON gerado no próprio computador). */
export function buildReport(perf: Perf, server: unknown, settings: unknown, extra: Record<string, unknown>) {
  let gpu = "indisponível";
  try {
    const c = document.createElement("canvas"), gl = c.getContext("webgl2") as WebGL2RenderingContext | null;
    const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
    if (gl && dbg) gpu = `${gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)} — ${gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)}`;
    (gl?.getExtension("WEBGL_lose_context") as any)?.loseContext?.();
  } catch { /* sem WebGL */ }
  return {
    schema: "wildhaven.relatorio.desempenho.v04-1",
    geradoEm: new Date().toISOString(),
    ambiente: { userAgent: navigator.userAgent, nucleos: navigator.hardwareConcurrency, memoriaGB: (navigator as any).deviceMemory ?? null, gpu, tela: `${screen.width}x${screen.height}@${devicePixelRatio}`, janela: `${innerWidth}x${innerHeight}`, visibilidade: document.visibilityState },
    configuracao: settings,
    cliente: perf.public,
    serieCliente30min: perf.series,
    servidor: server,
    ...extra,
  };
}
export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
