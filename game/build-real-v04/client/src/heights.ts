// V03 — Grade de alturas compacta (32 m, mín./máx.) por hex, INDEPENDENTE dos GLBs: `heights.json` + `heights.bin`.
// Usada pelo Modo Econômico (relevo pixel art), pela câmera (colisão) e pela oclusão do 3D. Nada aqui
// carrega malhas, materiais ou texturas.
export interface Heights { tile: string; x0: number; z0: number; cell: number; nx: number; nz: number; min: Float32Array; max: Float32Array; ox: number; oz: number }

const R = 2500;
export function latticeCenter(x: number, z: number) {
  const r = Math.round(z / (1.5 * R)), q = Math.round(x / (Math.sqrt(3) * R) - r / 2);
  return { x: Math.sqrt(3) * R * (q + r / 2), z: 1.5 * R * r };
}

export class HeightIndex {
  readonly tiles = new Map<string, Heights>();
  private loading = new Map<string, Promise<Heights | null>>();
  private missing = new Set<string>();
  bytes = 0;
  /** Hexes com visual/altura no disco (visual/index.json); null = desconhecido (tenta todos). */
  available: Set<string> | null = null;
  constructor(private origin: { x: number; z: number }, private continent: { id: string; x: number; z: number }[]) {}

  /** Carrega a grade de um hex (uma vez). */
  load(id: string): Promise<Heights | null> {
    const have = this.tiles.get(id); if (have) return Promise.resolve(have);
    if (this.missing.has(id) || (this.available && !this.available.has(id))) return Promise.resolve(null);
    let p = this.loading.get(id);
    if (!p) {
      const t = this.continent.find(x => x.id === id);
      p = (async () => {
        if (!t) return null;
        const [m, b] = await Promise.all([fetch(`/visual/${id}/heights.json`), fetch(`/visual/${id}/heights.bin`)]);
        if (!m.ok || !b.ok) { this.missing.add(id); return null; }
        const j = await m.json(), buf = new Float32Array(await b.arrayBuffer()), n = j.nx * j.nz;
        const c = latticeCenter(t.x, t.z);
        const h: Heights = { tile: id, x0: j.x0, z0: j.z0, cell: j.cell, nx: j.nx, nz: j.nz, min: buf.subarray(0, n), max: buf.subarray(n, 2 * n), ox: c.x - this.origin.x, oz: c.z - this.origin.z };
        this.tiles.set(id, h); this.bytes += buf.byteLength;
        return h;
      })().catch(() => { this.missing.add(id); return null; }).finally(() => this.loading.delete(id));
      this.loading.set(id, p);
    }
    return p;
  }
  /** Hexes cujo centro está a menos de `radius` de (x,z) (coordenadas locais à origem). */
  near(x: number, z: number, radius: number) {
    const out: { id: string; d: number }[] = [];
    for (const t of this.continent) { const c = latticeCenter(t.x, t.z), d = Math.hypot(c.x - this.origin.x - x, c.z - this.origin.z - z); if (d < radius) out.push({ id: t.id, d }); }
    return out.sort((a, b) => a.d - b.d);
  }
  drop(id: string) { const h = this.tiles.get(id); if (h) { this.bytes -= h.min.byteLength * 2; this.tiles.delete(id); } }

  private last: Heights | null = null;
  private find(x: number, z: number, pad = 0): Heights | null {
    const inside = (h: Heights) => { const i = (x - h.ox - h.x0) / h.cell, j = (z - h.oz - h.z0) / h.cell; return i >= pad && j >= pad && i < h.nx - pad && j < h.nz - pad; };
    if (this.last && inside(this.last)) return this.last;
    for (const h of this.tiles.values()) if (inside(h)) { this.last = h; return h; }
    return null;
  }
  /** Altura pela grade de 32 m: `max` para colisão de câmera, `min` para oclusão. */
  heightAt(x: number, z: number, kind: "min" | "max" = "max"): number | null {
    const f = this.find(x, z, 1);
    if (f) { const v = this.at(f, x, z, kind); if (v !== null) return v; }
    for (const h of this.tiles.values()) { if (h === f) continue; const v = this.at(h, x, z, kind); if (v !== null) return v; }
    return null;
  }
  private at(h: Heights, x: number, z: number, kind: "min" | "max"): number | null {
    {
      const i = Math.floor((x - h.ox - h.x0) / h.cell), j = Math.floor((z - h.oz - h.z0) / h.cell);
      if (i < 0 || j < 0 || i >= h.nx || j >= h.nz) return null;
      const v = (kind === "min" ? h.min : h.max)[j * h.nx + i];
      return Number.isFinite(v) ? v : null;
    }
  }
  /** Altura suavizada (bilinear na grade máx. de 32 m) — mesma função da V02 para o Modo Econômico. */
  heightSmooth(x: number, z: number): number | null {
    const f = this.find(x, z, 1);
    if (f) { const v = this.smooth(f, x, z); if (v !== null) return v; }
    for (const h of this.tiles.values()) { if (h === f) continue; const v = this.smooth(h, x, z); if (v !== null) return v; }
    return null;
  }
  private smooth(h: Heights, x: number, z: number): number | null {
    {
      const fx = (x - h.ox - h.x0) / h.cell - 0.5, fz = (z - h.oz - h.z0) / h.cell - 0.5;
      const i = Math.floor(fx), j = Math.floor(fz);
      if (i < 0 || j < 0 || i + 1 >= h.nx || j + 1 >= h.nz) return null;
      const M = h.max, n = h.nx;
      const v00 = M[j * n + i], v10 = M[j * n + i + 1], v01 = M[(j + 1) * n + i], v11 = M[(j + 1) * n + i + 1];
      if (!(Number.isFinite(v00) && Number.isFinite(v10) && Number.isFinite(v01) && Number.isFinite(v11))) {
        if (Number.isFinite(v00)) return v00; if (Number.isFinite(v10)) return v10; if (Number.isFinite(v01)) return v01; if (Number.isFinite(v11)) return v11;
        return null;
      }
      const tx = fx - i, tz = fz - j;
      return (v00 * (1 - tx) + v10 * tx) * (1 - tz) + (v01 * (1 - tx) + v11 * tx) * tz;
    }
  }
}
