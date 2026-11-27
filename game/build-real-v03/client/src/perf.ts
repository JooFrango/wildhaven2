// Métricas do apresentador (nada é estimado sem dizer): FPS médio, 1% low, tempo de CPU por quadro,
// tempo de GPU (EXT_disjoint_timer_query_webgl2, quando o navegador expõe), draw calls, triângulos,
// RAM (performance.memory, só Chromium), VRAM ESTIMADA (soma de buffers e texturas enviados),
// tempo de carregamento e descartes por técnica de culling.
import type * as THREE from "three";

export class Perf {
  mode: "3d" | "pixel" = "3d";
  loadSeconds = 0;
  resScale = 1;
  private times: number[] = [];
  private cpu: number[] = [];
  private last = performance.now();
  private gl: WebGL2RenderingContext;
  private ext: any;
  private queries: { q: WebGLQuery; t: number }[] = [];
  private gpuMs: number | null = null;
  private culling: any = null;
  public: Record<string, unknown> = {};
  constructor(private renderer: THREE.WebGLRenderer) {
    this.gl = renderer.getContext() as WebGL2RenderingContext;
    this.ext = this.gl.getExtension("EXT_disjoint_timer_query_webgl2");
  }
  beginGpu() {
    if (!this.ext || this.queries.length > 4) return;
    const q = this.gl.createQuery()!; this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q); this.queries.push({ q, t: performance.now() });
  }
  endGpu() {
    if (!this.ext || !this.queries.length) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
  }
  private pollGpu() {
    if (!this.ext) return;
    const disjoint = this.gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    while (this.queries.length) {
      const { q } = this.queries[0];
      if (!this.gl.getQueryParameter(q, this.gl.QUERY_RESULT_AVAILABLE)) break;
      const ns = this.gl.getQueryParameter(q, this.gl.QUERY_RESULT);
      if (!disjoint) this.gpuMs = this.gpuMs === null ? ns / 1e6 : this.gpuMs * 0.9 + (ns / 1e6) * 0.1;
      this.gl.deleteQuery(q); this.queries.shift();
    }
  }
  gpuOrFrameMs() { return this.gpuMs ?? this.avg(this.times); }
  private avg(a: number[]) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; }
  frame(cpuMs: number, culling: any) {
    const now = performance.now(), dt = now - this.last; this.last = now;
    this.times.push(dt); this.cpu.push(cpuMs);
    if (this.times.length > 600) { this.times.shift(); this.cpu.shift(); }
    if (culling) this.culling = culling;
    this.pollGpu();
    if (this.times.length % 30 === 0) this.publish();
  }
  publish() {
    const sorted = [...this.times].sort((a, b) => b - a);
    const worst = sorted.slice(0, Math.max(1, Math.floor(sorted.length / 100)));
    const info = this.renderer.info;
    const mem = (performance as any).memory;
    this.public = {
      mode: this.mode,
      fps: 1000 / Math.max(0.001, this.avg(this.times)),
      low1: 1000 / Math.max(0.001, this.avg(worst)),
      frameMs: this.avg(this.times),
      cpuMs: this.avg(this.cpu),
      gpuMs: this.gpuMs,
      gpuTimer: !!this.ext,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      heapMB: mem ? mem.usedJSHeapSize / 1048576 : null,
      vramEstMB: estimateVram(this.renderer),
      loadSeconds: this.loadSeconds,
      resScale: this.resScale,
      culling: this.culling,
    };
    (window as any).__wildhavenPerf = this.public;
  }
}

/** VRAM estimada: bytes dos atributos/índices de todas as geometrias e das texturas vivas na cena. */
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
