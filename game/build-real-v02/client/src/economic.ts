// Modo Econômico V02: troca SÓ o apresentador. O loop WebGL é DESLIGADO (setAnimationLoop(null)),
// não há render 3D escondido atrás do canvas. Um canvas 2D de 384×216 desenha em pixel art a MESMA
// simulação (mesmos snapshots): relevo sombreado (grade de alturas do pipeline), paleta por bioma,
// água, árvores, Hunters e criaturas animados (2–4 quadros), carroça com rodas, acampamento com
// fogo, pegadas azuis, nuvens com sombra, poeira e chuva/neve/areia. Atualiza a ~12 Hz.
import type { SnapshotFull } from "./contracts";
import type { VisualWorld } from "./visual";

const W = 384, H = 216, MPP = 1.25; // metros por pixel
type Spr = { rows: string[]; pal: Record<string, string> };
const S = (rows: string[], pal: Record<string, string>): Spr => ({ rows, pal });
const SK = "#e6b98f", HR = "#4a2e1c", LE = "#5b3a24", FUR = "#d8d0c0", ST = "#c8ccd4";
const HUNTER = [
  S(["...hh...", "..hssh..", "..ssss..", ".fttttf.", "fttttttw", ".tttttw.", "..tttw..", "..l..l..", "..l..l..", ".bb..bb."], { h: HR, s: SK, f: FUR, t: "#3b5f8a", w: ST, l: LE, b: "#2a1d14" }),
  S(["...hh...", "..hssh..", "..ssss..", ".fttttf.", "fttttttw", ".tttttw.", "..tttw..", "..l.l...", ".l...l..", "bb....bb"], { h: HR, s: SK, f: FUR, t: "#3b5f8a", w: ST, l: LE, b: "#2a1d14" }),
];
const RESCUER = HUNTER.map(s => S(s.rows, { ...s.pal, t: "#b5652a" }));
const DOWN = S(["..........", "hss.......", "hssttttll.", ".fttttttlb", ".........."], { h: HR, s: SK, f: FUR, t: "#3b5f8a", l: LE, b: "#2a1d14" });
const FOLHISCO = [
  S(["....cc..", "...cyyb.", "..eeee..", ".eeeeee.", "eeeeee..", "..y..y.."], { c: "#e2553a", y: "#f2d36b", b: "#222", e: "#b0662f" }),
  S(["....cc..", "...cyyb.", "..eeee..", ".eeeeee.", "eeeeee..", ".y....y."], { c: "#e2553a", y: "#f2d36b", b: "#222", e: "#b0662f" }),
];
const LOBRA = [
  S(["..r.r.r.....", ".rgrgrgr..ee", "gggggggggggg", ".gggggggggg.", ".gg..gg..gg.", ".d...d...d.."], { r: "#c9b48a", g: "#7d8590", e: "#e8d27a", d: "#3d3f45" }),
  S(["..r.r.r.....", ".rgrgrgr..ee", "gggggggggggg", ".gggggggggg.", "..gg..gg..g.", "..d...d...d."], { r: "#c9b48a", g: "#7d8590", e: "#e8d27a", d: "#3d3f45" }),
];
const WAGON = (f: number) => S(["...cccccc...", "..cccccccc..", ".wwwwwwwwww.", ".wwwwwwwwww.", f ? "..o....o...." : "..x....x...."], { c: "#e9dcb8", w: "#8b5a2b", o: "#3a2a1a", x: "#5a4030" });
const DODO = [S(["..rr.", ".rwk.", "bbbbo", "bbbb.", ".l.l."], { r: "#d4483a", w: "#f2e9d8", k: "#111", b: "#e7d9b6", o: "#e0a040", l: "#e0a040" }), S(["..rr.", ".rwk.", "bbbbo", "bbbb.", "l...l"], { r: "#d4483a", w: "#f2e9d8", k: "#111", b: "#e7d9b6", o: "#e0a040", l: "#e0a040" })];
const TENT = S(["....t....", "...ttt...", "..ttdtt..", ".tttdttt.", "ttttdtttt"], { t: "#d8c39a", d: "#5a4030" });
const FIRE = [S([".o.", "oyo", "rrr"], { o: "#ff8a2a", y: "#ffe070", r: "#6a3a1a" }), S(["o..", ".yo", "rrr"], { o: "#ff8a2a", y: "#ffe070", r: "#6a3a1a" })];
const TREE = (c: string, d: string) => S(["..cc..", ".cccc.", "ccdccc", "cccccd", ".cddc.", "..tt..", "..tt.."], { c, d, t: "#5a3a20" });
const PINE = (c: string, d: string) => S(["..c..", ".ccc.", ".cdc.", "ccccc", "cdccd", "..t.."], { c, d, t: "#5a3a20" });

const BIOME: Record<string, { low: [number, number, number]; high: [number, number, number]; tree: [string, string] }> = {
  floresta: { low: [86, 128, 62], high: [130, 132, 110], tree: ["#3f7a3a", "#2c5a2a"] },
  temperado: { low: [110, 150, 70], high: [150, 150, 120], tree: ["#4f8a3e", "#376a2e"] },
  montanha: { low: [96, 120, 80], high: [196, 200, 206], tree: ["#3a6a44", "#28503a"] },
  selva: { low: [52, 112, 50], high: [92, 120, 80], tree: ["#2f8a3a", "#1f6a2a"] },
  savana: { low: [190, 170, 96], high: [170, 150, 110], tree: ["#7a8a3a", "#5a6a2a"] },
  deserto: { low: [222, 190, 130], high: [196, 150, 100], tree: ["#7a8a4a", "#5a6a3a"] },
  neve: { low: [214, 222, 232], high: [240, 244, 250], tree: ["#3a5a50", "#2a4a40"] },
  pantano: { low: [70, 96, 60], high: [96, 110, 80], tree: ["#3e6a3a", "#2a4a2a"] },
  costa: { low: [200, 190, 150], high: [150, 150, 130], tree: ["#4f8a3e", "#376a2e"] },
};

export class EconomicView {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private last = 0;
  private img: ImageData;
  private clouds = Array.from({ length: 7 }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, r: 22 + Math.random() * 30, s: 0.4 + Math.random() * 0.5, i }));
  private dust = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: Math.random() }));
  frameMsAvg = 0;
  biomeKey = "floresta";
  constructor(host: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = W; this.canvas.height = H;
    this.canvas.className = "pixel"; this.canvas.hidden = true;
    host.append(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    this.img = this.ctx.createImageData(W, H);
  }
  private spr(s: Spr, cx: number, cy: number, flip = false) {
    const g = this.ctx, rows = s.rows, w = rows[0].length;
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < w; x++) {
      const c = rows[y][flip ? w - 1 - x : x]; if (c === ".") continue;
      g.fillStyle = s.pal[c]; g.fillRect(Math.round(cx - w / 2 + x), Math.round(cy - rows.length + y), 1, 1);
    }
  }
  private shadow(cx: number, cy: number, w: number) { this.ctx.fillStyle = "rgba(0,0,0,0.28)"; this.ctx.fillRect(Math.round(cx - w / 2), Math.round(cy), w, 1); }

  draw(s: SnapshotFull, focus: { x: number; z: number }, now: number, world: VisualWorld, origin: { x: number; z: number }) {
    if (now - this.last < 80) return;
    this.last = now;
    const t0 = performance.now();
    const g = this.ctx, D = this.img.data;
    const pal = BIOME[this.biomeKey] ?? BIOME.floresta;
    const fx = focus.x - origin.x, fz = focus.z - origin.z;
    const hAt = (px: number, py: number) => world.heightAt(fx + (px - W / 2) * MPP, fz + (py - H / 2) * MPP, "max");
    const night = s.clock.phase === "night" ? 0.55 : 0;
    const weather = ((s.game as any).weather ?? { kind: "limpo", intensity: 0, cloud: 0.2, wind: [0.6, 0.2] }) as { kind: string; intensity: number; cloud: number; wind: [number, number] };
    // relevo: altura → cor (baixo/alto), sombreamento por luz NO e faixas de cota a cada 20 m
    let hmin = Infinity, hmax = -Infinity;
    const hs = new Float32Array((W / 2) * (H / 2));
    for (let y = 0; y < H / 2; y++) for (let x = 0; x < W / 2; x++) { const h = hAt(x * 2, y * 2) ?? NaN; hs[y * (W / 2) + x] = h; if (h === h) { hmin = Math.min(hmin, h); hmax = Math.max(hmax, h); } }
    const span = Math.max(30, hmax - hmin);
    for (let y = 0; y < H / 2; y++) for (let x = 0; x < W / 2; x++) {
      const h = hs[y * (W / 2) + x];
      let r = 28, gg = 46, b = 70;
      if (h === h) {
        const t = (h - hmin) / span;
        const hx = hs[y * (W / 2) + Math.min(W / 2 - 1, x + 1)], hy = hs[Math.min(H / 2 - 1, y + 1) * (W / 2) + x];
        const sl = ((hx === hx ? hx : h) - h) + ((hy === hy ? hy : h) - h);
        const shade = Math.max(0.55, Math.min(1.25, 1 - sl * 0.06));
        const band = Math.floor(h / 20) % 2 === 0 ? 1 : 0.96;
        r = (pal.low[0] + (pal.high[0] - pal.low[0]) * t) * shade * band; gg = (pal.low[1] + (pal.high[1] - pal.low[1]) * t) * shade * band; b = (pal.low[2] + (pal.high[2] - pal.low[2]) * t) * shade * band;
        if (h < 1.5) { r = 40; gg = 96; b = 150; }
      }
      r *= 1 - night; gg *= 1 - night; b *= 1 - night * 0.6;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const k = ((y * 2 + dy) * W + x * 2 + dx) * 4; D[k] = r; D[k + 1] = gg; D[k + 2] = b; D[k + 3] = 255; }
    }
    g.putImageData(this.img, 0, 0);
    const P = (x: number, z: number) => [W / 2 + (x - focus.x) / MPP, H / 2 + (z - focus.z) / MPP];
    const frame = Math.floor(now / 220) % 2;
    // árvores procedurais fixas (semente pela célula de 12 m), só onde o relevo existe e não é água
    for (let gy = -1; gy < H / 9 + 1; gy++) for (let gx = -1; gx < W / 9 + 1; gx++) {
      const wx = Math.floor((focus.x - (W / 2) * MPP) / 12) + gx, wz = Math.floor((focus.z - (H / 2) * MPP) / 12) + gy;
      const hsh = Math.sin(wx * 12.9898 + wz * 78.233) * 43758.5453, r = hsh - Math.floor(hsh);
      if (r > 0.34) continue;
      const [px, py] = P(wx * 12 + r * 10, wz * 12 + (r * 7) % 10);
      const h = hAt(px, py); if (h === null || h < 2) continue;
      const ty = this.biomeKey === "deserto" ? r < 0.05 : true; if (!ty) continue;
      this.shadow(px, py, 5);
      this.spr(r < 0.17 ? PINE(...pal.tree) : TREE(...pal.tree), px, py);
    }
    g.fillStyle = "#5fd4ff";
    for (const f of s.game.tracks) { const [x, y] = P(f.x, f.z); g.fillRect(Math.round(x), Math.round(y), 1, 1); }
    for (const c of s.game.camps) { const [x, y] = P(c.x + 4, c.z + 4); this.spr(TENT, x, y); this.spr(FIRE[frame], x + 8, y + 1); }
    for (const w of s.game.wagons) { const [x, y] = P(w.x, w.z); const fl = Math.sin(w.heading) < 0; this.shadow(x, y, 12); this.spr(WAGON(frame), x, y, fl); this.spr(DODO[frame], x + (fl ? -9 : 9), y, fl); }
    for (const c of s.game.creatures) {
      const [x, y] = P(c.x, c.z); if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
      const moving = c.clip === "walk" || c.clip === "run", f = moving ? frame : 0, fl = Math.sin(c.heading) < 0;
      if (!c.alive) { g.fillStyle = "#6a6f78"; g.fillRect(Math.round(x) - 3, Math.round(y) - 1, 6, 2); continue; }
      this.shadow(x, y, c.species === "lobrapedra" ? 12 : 7);
      this.spr(c.species === "lobrapedra" ? LOBRA[f] : FOLHISCO[f], x, y, fl);
    }
    for (const h of s.hunters) {
      if (h.activity === "embarcado") continue;
      const [x, y] = P(h.x, h.z); if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
      if (!h.alive || h.activity === "caido" || h.activity === "carregado") { this.spr(DOWN, x, y); if (!h.alive) { g.fillStyle = "#f85149"; g.fillRect(Math.round(x) - 1, Math.round(y) - 6, 3, 1); } continue; }
      const moving = h.state === "caminhando", set = h.role === "socorrista" ? RESCUER : HUNTER;
      this.shadow(x, y, 6);
      this.spr(set[moving ? frame : 0], x, y + (h.crouched ? 1 : 0), Math.sin(h.heading) < 0);
      if (h.activity === "combatendo") { g.fillStyle = frame ? "#ffe070" : "#ffffff"; g.fillRect(Math.round(x) + 4, Math.round(y) - 8, 1, 1); }
    }
    // nuvens: corpo translúcido + sombra deslocada no chão, movidas pelo vento do servidor
    const cover = weather.cloud;
    for (const c of this.clouds) {
      c.x += weather.wind[0] * c.s; c.y += weather.wind[1] * c.s * 0.5;
      if (c.x > W + 60) c.x = -60; if (c.x < -60) c.x = W + 60; if (c.y > H + 40) c.y = -40; if (c.y < -40) c.y = H + 40;
      if (c.i / this.clouds.length > cover + 0.15) continue;
      g.fillStyle = "rgba(0,0,0,0.10)"; this.blob(c.x + 14, c.y + 18, c.r);
      g.fillStyle = `rgba(255,255,255,${0.35 + 0.25 * cover})`; this.blob(c.x, c.y, c.r);
    }
    // poeira / chuva / neve / areia
    const k = weather.kind;
    const n = k === "limpo" || k === "nublado" ? 18 : Math.floor(this.dust.length * Math.max(0.3, weather.intensity));
    for (let i = 0; i < n; i++) {
      const d = this.dust[i];
      const vx = k === "areia" ? 3 : weather.wind[0] * 1.5, vy = k === "chuva" || k === "tempestade" ? 5 : k === "neve" || k === "nevasca" ? 0.8 : 0.1;
      d.x = (d.x + vx * (0.5 + d.v) + W) % W; d.y = (d.y + vy * (0.5 + d.v) + H) % H;
      g.fillStyle = k === "chuva" || k === "tempestade" ? "rgba(170,200,230,0.7)" : k === "neve" || k === "nevasca" ? "#ffffff" : k === "areia" ? "rgba(214,168,104,0.8)" : "rgba(240,230,200,0.35)";
      g.fillRect(Math.round(d.x), Math.round(d.y), 1, k === "chuva" || k === "tempestade" ? 3 : 1);
    }
    if (k === "areia" || k === "nevasca" || k === "tempestade") { g.fillStyle = k === "areia" ? `rgba(200,150,90,${0.3 * weather.intensity})` : `rgba(200,210,225,${0.25 * weather.intensity})`; g.fillRect(0, 0, W, H); }
    if (night) { g.fillStyle = "rgba(10,18,40,0.25)"; g.fillRect(0, 0, W, H); }
    const dt = performance.now() - t0;
    this.frameMsAvg = this.frameMsAvg ? this.frameMsAvg * 0.9 + dt * 0.1 : dt;
  }
  private blob(x: number, y: number, r: number) {
    const g = this.ctx;
    for (let dy = -r / 2; dy < r / 2; dy += 2) { const w = Math.sqrt(1 - (dy / (r / 2)) ** 2) * r; g.fillRect(Math.round(x - w / 2), Math.round(y + dy), Math.round(w), 2); }
  }
}
