// Modo Econômico: troca SÓ o apresentador. O WebGL para; um canvas 2D em baixa resolução
// desenha em pixel art a MESMA simulação (mesmos snapshots do servidor): terreno da janela
// física, Hunters, criaturas, carroças, acampamentos, pegadas azuis. Atualiza a 8 Hz.
import type { SnapshotFull } from "./contracts";

const W = 320, H = 180, M_PER_PX = 1.5;
const SPR: Record<string, string[]> = {
  hunter: ["..aa..", "..aa..", ".bbbb.", "b.bb.b", "..cc..", ".c..c."],
  socorrista: ["..aa..", "..aa..", ".dddd.", "d.dd.d", "..cc..", ".c..c."],
  folhisco: ["..e.", ".eee", "eee.", ".f.."],
  lobrapedra: [".g...g", "gggggg", ".gggg.", ".g..g."],
  wagon: ["hhhhhhh", "hhhhhhh", ".i...i."],
  camp: ["...j...", "..jjj..", ".jjjjj.", "jjjjjjj"],
};
const PAL: Record<string, string> = { a: "#e8c39e", b: "#3b6fb6", c: "#2b2b2b", d: "#d9772b", e: "#a65a2a", f: "#f2d36b", g: "#7d8590", h: "#8b5a2b", i: "#222", j: "#d8c39a" };

export class EconomicView {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private last = 0;
  frameMsAvg = 0;
  constructor(host: HTMLElement, private heightAt: (gx: number, gz: number) => { h: number; water: boolean; blocked: boolean } | null) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = W; this.canvas.height = H;
    this.canvas.className = "pixel";
    this.canvas.hidden = true;
    host.append(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
  }

  private sprite(name: string, cx: number, cy: number) {
    const rows = SPR[name];
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
      const c = rows[y][x];
      if (c === ".") continue;
      this.ctx.fillStyle = PAL[c];
      this.ctx.fillRect(Math.round(cx - rows[y].length / 2 + x), Math.round(cy - rows.length + y), 1, 1);
    }
  }

  draw(s: SnapshotFull, focus: { x: number; z: number }, now: number) {
    if (now - this.last < 125) return;
    this.last = now;
    const t0 = performance.now();
    const g = this.ctx;
    // terreno: amostra o heightfield WHP1 já carregado no cliente (mesma janela autoritativa)
    const img = g.createImageData(W, H);
    for (let py = 0; py < H; py += 2) for (let px = 0; px < W; px += 2) {
      const gx = focus.x + (px - W / 2) * M_PER_PX, gz = focus.z + (py - H / 2) * M_PER_PX;
      const c = this.heightAt(gx, gz);
      let r = 20, gg = 24, b = 30;
      if (c) {
        if (c.water) { r = 46; gg = 106; b = 184; }
        else if (c.blocked) { r = 82; gg = 72; b = 66; }
        else { const v = Math.max(0, Math.min(1, (c.h % 40) / 40)); r = 70 + 40 * v; gg = 110 + 40 * v; b = 60; }
      }
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const k = ((py + dy) * W + px + dx) * 4; img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255; }
    }
    g.putImageData(img, 0, 0);
    const P = (x: number, z: number) => [W / 2 + (x - focus.x) / M_PER_PX, H / 2 + (z - focus.z) / M_PER_PX];
    g.fillStyle = "#38bdf8";
    for (const f of s.game.tracks) { const [x, y] = P(f.x, f.z); g.fillRect(Math.round(x), Math.round(y), 1, 1); }
    for (const c of s.game.camps) { const [x, y] = P(c.x, c.z); this.sprite("camp", x, y); }
    for (const w of s.game.wagons) { const [x, y] = P(w.x, w.z); this.sprite("wagon", x, y); }
    for (const c of s.game.creatures) { if (!c.alive) continue; const [x, y] = P(c.x, c.z); this.sprite(c.species === "lobrapedra" ? "lobrapedra" : "folhisco", x, y); }
    for (const h of s.hunters) { if (h.activity === "embarcado") continue; const [x, y] = P(h.x, h.z); this.sprite(h.role === "socorrista" ? "socorrista" : "hunter", x, y); if (!h.alive) { g.fillStyle = "#f85149"; g.fillRect(Math.round(x) - 1, Math.round(y) - 7, 3, 1); } }
    const dt = performance.now() - t0;
    this.frameMsAvg = this.frameMsAvg ? this.frameMsAvg * 0.9 + dt * 0.1 : dt;
  }
}
