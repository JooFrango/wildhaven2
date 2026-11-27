// Modo Econômico V03 — mesma arte da V02 (384×216, 1,25 m/px, mesmas paletas, sombreamento, faixas de cota a
// cada 20 m, água, árvores, sprites, nuvens, poeira, chuva/neve/areia, noite), com outra ARQUITETURA:
// - camada ESTÁTICA pré-renderizada em regiões de 96×96 px ancoradas no mundo (relevo a meia resolução
//   ampliado 2×, como na V02; árvores numa camada própria), guardadas em cache LRU e refeitas só quando a
//   normalização de cor da vista muda de verdade (troca em bloco, sem costura) ou o bioma muda;
// - camada DINÂMICA (pegadas, acampamentos, carroças, criaturas, Hunters, nuvens, partículas) desenhada a
//   cada quadro com drawImage de um ATLAS de sprites pré-renderizados (antes: um fillRect por pixel);
// - relevo da grade compacta `heights.bin` (HeightIndex), INDEPENDENTE dos GLBs: nada de 3D é carregado;
// - quadro limitado a 12, 15 ou 20 FPS pelo laço do main; sem alocações por quadro no caminho quente.
import type { SnapshotFull } from "./contracts";
import type { HeightIndex } from "./heights";

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

const WAGON0 = WAGON(0), WAGON1 = WAGON(1);
// V04: mais espécies no pixel art — classes por papel, massa e meio (sprites próprios por espécie: pendência)
const HERB = LOBRA.map(s => S(s.rows, { ...s.pal, g: "#9a7a52", r: "#d9c49a", d: "#4a3826", e: "#f0e0a0" }));
const BIRD = [S(["c...c", ".c.c.", "..b.."], { c: "#3a3a3a", b: "#e2553a" }), S([".....", "cc.cc", "..b.."], { c: "#3a3a3a", b: "#e2553a" })];
const RIPPLE = [S([".s.s.s.", "s.s.s.s"], { s: "#c8a46a" }), S(["s.s.s.s", ".s.s.s."], { s: "#c8a46a" })];
export const ECO_CAT: Record<string, { kg: number; pred: boolean; loc: string }> = {};
export function setEcoCatalog(g: any) { for (const [id, sp] of Object.entries<any>(g?.especies ?? {})) ECO_CAT[id] = { kg: sp.massaKg ?? 20, pred: sp.papel === "predador", loc: sp.locomocao ?? "terrestre" }; }
const TILE = 96; // px por região (120 m)
const PAD = 8; // margem da camada de árvores (sprites que cruzam a borda)
interface Region { gx: number; gy: number; gen: number; ground: HTMLCanvasElement; trees: HTMLCanvasElement | null; treeKey: string; used: number }

export interface EcoStats { frameMs: number; regions: number; rendered: number; genSwaps: number; atlas: number; heightsMB: number }

export class EconomicView {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private last = 0;
  private clouds = Array.from({ length: 7 }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, r: 22 + Math.random() * 30, s: 0.4 + Math.random() * 0.5, i }));
  private cloudSpr: HTMLCanvasElement[] = [];
  private dust = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: Math.random() }));
  private atlas = new Map<Spr, [HTMLCanvasElement, HTMLCanvasElement]>();
  private treeSprites = new Map<string, { tree: Spr; pine: Spr }>();
  private pool: Region[] = [];
  private regions = new Map<number, Region>();
  private norm = { hmin: 0, span: 30, pal: "", gen: 0 };
  private pending: { hmin: number; span: number; pal: string; gen: number } | null = null;
  private img48: ImageData;
  private scratch: HTMLCanvasElement;
  private hs = new Float32Array(49 * 49);
  private frameNo = 0;
  frameMsAvg = 0;
  biomeKey = "floresta";
  stats: EcoStats = { frameMs: 0, regions: 0, rendered: 0, genSwaps: 0, atlas: 0, heightsMB: 0 };
  constructor(host: HTMLElement, private heights: HeightIndex) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = W; this.canvas.height = H;
    this.canvas.className = "pixel"; this.canvas.hidden = true;
    host.append(this.canvas);
    this.ctx = this.canvas.getContext("2d", { alpha: false })!;
    this.ctx.imageSmoothingEnabled = false;
    this.scratch = document.createElement("canvas"); this.scratch.width = this.scratch.height = TILE / 2;
    this.img48 = this.scratch.getContext("2d")!.createImageData(TILE / 2, TILE / 2);
    for (const c of this.clouds) this.cloudSpr[c.i] = this.blobSprite(c.r);
  }
  /** Libera as regiões em cache (ex.: ao voltar ao 3D por muito tempo). */
  clear() { this.regions.clear(); this.atlas.clear(); this.treeSprites.clear(); this.pool.length = 0; this.stats.regions = 0; }

  // ------------------------------------------------------------ atlas (sprites pré-renderizados)
  private sprite(s: Spr, flip: boolean): HTMLCanvasElement {
    let e = this.atlas.get(s);
    if (!e) {
      const w = s.rows[0].length, h = s.rows.length;
      const mk = (fl: boolean) => {
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const g = c.getContext("2d")!;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ch = s.rows[y][fl ? w - 1 - x : x]; if (ch === ".") continue; g.fillStyle = s.pal[ch]; g.fillRect(x, y, 1, 1); }
        return c;
      };
      e = [mk(false), mk(true)]; this.atlas.set(s, e); this.stats.atlas = this.atlas.size;
    }
    return e[flip ? 1 : 0];
  }
  private spr(g: CanvasRenderingContext2D, s: Spr, cx: number, cy: number, flip = false) {
    const w = s.rows[0].length;
    g.drawImage(this.sprite(s, flip), Math.round(cx - w / 2), Math.round(cy - s.rows.length));
  }
  private shadow(g: CanvasRenderingContext2D, cx: number, cy: number, w: number) { g.fillStyle = "rgba(0,0,0,0.28)"; g.fillRect(Math.round(cx - w / 2), Math.round(cy), w, 1); }
  private blobSprite(r: number) {
    const c = document.createElement("canvas"); c.width = Math.ceil(r) + 4; c.height = Math.ceil(r) + 4;
    const g = c.getContext("2d")!; g.fillStyle = "#fff";
    const ox = c.width / 2, oy = c.height / 2;
    for (let dy = -r / 2; dy < r / 2; dy += 2) { const w = Math.sqrt(1 - (dy / (r / 2)) ** 2) * r; g.fillRect(Math.round(ox - w / 2), Math.round(oy + dy), Math.round(w), 2); }
    return c;
  }

  // ------------------------------------------------------------ camada estática por região
  private renderGround(r: Region, n: { hmin: number; span: number; pal: string }) {
    const pal = BIOME[n.pal] ?? BIOME.floresta, D = this.img48.data, hs = this.hs, half = TILE / 2;
    const x0 = r.gx * TILE * MPP, z0 = r.gy * TILE * MPP;
    for (let j = 0; j <= half; j++) for (let i = 0; i <= half; i++) hs[j * 49 + i] = this.heights.heightSmooth(x0 + i * 2 * MPP, z0 + j * 2 * MPP) ?? NaN;
    for (let y = 0; y < half; y++) for (let x = 0; x < half; x++) {
      const h = hs[y * 49 + x];
      let rr = 28, gg = 46, b = 70;
      if (h === h) {
        const t = (h - n.hmin) / n.span;
        const hx = hs[y * 49 + x + 1], hy = hs[(y + 1) * 49 + x];
        const sl = ((hx === hx ? hx : h) - h) + ((hy === hy ? hy : h) - h);
        const shade = Math.max(0.55, Math.min(1.25, 1 - sl * 0.06));
        const band = 1 - 0.035 * Math.max(0, 1 - Math.abs(((h % 20) + 20) % 20 - 10) / 1.2);
        rr = (pal.low[0] + (pal.high[0] - pal.low[0]) * t) * shade * band; gg = (pal.low[1] + (pal.high[1] - pal.low[1]) * t) * shade * band; b = (pal.low[2] + (pal.high[2] - pal.low[2]) * t) * shade * band;
        if (h < 1.5) { rr = 40; gg = 96; b = 150; }
      }
      const k = (y * half + x) * 4; D[k] = rr; D[k + 1] = gg; D[k + 2] = b; D[k + 3] = 255;
    }
    this.scratch.getContext("2d")!.putImageData(this.img48, 0, 0);
    const g = r.ground.getContext("2d")!; g.imageSmoothingEnabled = false;
    g.drawImage(this.scratch, 0, 0, TILE, TILE);
    this.stats.rendered++;
  }
  private renderTrees(r: Region, palKey: string) {
    const pal = BIOME[palKey] ?? BIOME.floresta;
    const c = r.trees ?? document.createElement("canvas"); c.width = TILE + 2 * PAD; c.height = TILE + 2 * PAD; r.trees = c;
    const g = c.getContext("2d")!; g.clearRect(0, 0, c.width, c.height);
    const x0 = r.gx * TILE * MPP, z0 = r.gy * TILE * MPP, x1 = x0 + TILE * MPP, z1 = z0 + TILE * MPP;
    // sprites de árvore por paleta criados UMA vez (antes: objetos novos por região → o atlas crescia sem fim)
    let tp = this.treeSprites.get(palKey);
    if (!tp) { tp = { tree: TREE(...pal.tree), pine: PINE(...pal.tree) }; this.treeSprites.set(palKey, tp); }
    const { tree, pine } = tp;
    // mesmas árvores da V02: célula de 12 m, semente pela célula, só onde há relevo e não é água
    for (let wz = Math.floor(z0 / 12) - 1; wz <= Math.floor(z1 / 12) + 1; wz++) for (let wx = Math.floor(x0 / 12) - 1; wx <= Math.floor(x1 / 12) + 1; wx++) {
      const hsh = Math.sin(wx * 12.9898 + wz * 78.233) * 43758.5453, rr = hsh - Math.floor(hsh);
      if (rr > 0.34) continue;
      const tx = wx * 12 + rr * 10, tz = wz * 12 + (rr * 7) % 10;
      if (tx < x0 || tx >= x1 || tz < z0 || tz >= z1) continue; // âncora nesta região
      const h = this.heights.heightSmooth(tx, tz); if (h === null || h < 2) continue;
      if (palKey === "deserto" && !(rr < 0.05)) continue;
      const px = (tx - x0) / MPP + PAD, py = (tz - z0) / MPP + PAD;
      this.shadow(g, px, py, 5);
      this.spr(g, rr < 0.17 ? pine : tree, px, py);
    }
    r.treeKey = palKey;
  }
  /** Normalização de cor (mín./máx. da vista), como a V02 — amostrada a cada 16 m. */
  private viewNorm(fx: number, fz: number) {
    let hmin = Infinity, hmax = -Infinity;
    for (let y = 0; y <= H * MPP; y += 16) for (let x = 0; x <= W * MPP; x += 16) {
      const h = this.heights.heightSmooth(fx - (W / 2) * MPP + x, fz - (H / 2) * MPP + y);
      if (h !== null) { if (h < hmin) hmin = h; if (h > hmax) hmax = h; }
    }
    if (hmin === Infinity) return { hmin: 0, span: 30 };
    return { hmin, span: Math.max(30, hmax - hmin) };
  }
  private region(gx: number, gy: number): Region {
    const k = (gx + 32768) * 65536 + (gy + 32768);
    let r = this.regions.get(k);
    if (!r) {
      // canvases reaproveitados das regiões descartadas (sem depender do coletor de lixo para a memória nativa)
      const pooled = this.pool.pop();
      const ground = pooled?.ground ?? document.createElement("canvas"); ground.width = ground.height = TILE;
      // `used` já no quadro atual: com `used: 0` o LRU (> 140) descartava a própria região recém-criada e ela era
      // refeita a cada consulta, redesenhando o relevo dezenas de vezes por segundo (CPU 10% → 30% no teste de 2 h).
      r = { gx, gy, gen: -1, ground, trees: pooled?.trees ?? null, treeKey: "", used: this.frameNo };
      this.regions.set(k, r);
      if (this.regions.size > 140) { // LRU: descarta as menos usadas
        let oldK = -1, oldU = Infinity; for (const [kk, rr] of this.regions) if (rr.used < oldU) { oldU = rr.used; oldK = kk; }
        const old = this.regions.get(oldK); this.regions.delete(oldK);
        if (old) this.pool.push(old);
      }
    }
    r.used = this.frameNo;
    return r;
  }

  draw(s: SnapshotFull, focus: { x: number; z: number }, now: number, origin: { x: number; z: number }, followId = "", minIntervalMs = 80) {
    if (now - this.last < minIntervalMs - 1) return false;
    this.last = now; this.frameNo++;
    const t0 = performance.now();
    const g = this.ctx;
    const fx = focus.x - origin.x, fz = focus.z - origin.z;
    const night = s.clock.phase === "night" ? 0.55 : 0;
    const weather = ((s.game as any).weather?.[followId] ?? { kind: "limpo", intensity: 0, cloud: 0.2, wind: [0.6, 0.2] }) as { kind: string; intensity: number; cloud: number; wind: [number, number] };
    // normalização: troca de "geração" só quando a vista muda de verdade (> 3 m no mínimo, > 6 m no intervalo)
    const vn = this.viewNorm(fx, fz);
    const target = this.pending ?? this.norm;
    if (this.norm.gen === 0 || Math.abs(vn.hmin - target.hmin) > 3 || Math.abs(vn.span - target.span) > 6 || this.biomeKey !== target.pal) {
      this.pending = { ...vn, pal: this.biomeKey, gen: Math.max(this.norm.gen, this.pending?.gen ?? 0) + 1 };
      if (this.norm.gen === 0) { this.norm = this.pending; this.pending = null; }
    }
    // regiões visíveis (+ margem): orçamento de 4 renderizações por quadro; a geração nova entra de uma vez
    const left = fx / MPP - W / 2, top = fz / MPP - H / 2;
    const gx0 = Math.floor(left / TILE) - 1, gx1 = Math.floor((left + W) / TILE) + 1, gy0 = Math.floor(top / TILE) - 1, gy1 = Math.floor((top + H) / TILE) + 1;
    let budget = 4, pendingReady = true;
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const r = this.region(gx, gy);
      const inView = gx > gx0 && gx < gx1 && gy > gy0 && gy < gy1;
      if (r.gen === -1) { this.renderGround(r, this.norm); r.gen = this.norm.gen; }
      if (this.pending && r.gen !== this.pending.gen) { if (budget > 0) { this.renderGround(r, this.pending); r.gen = this.pending.gen; budget--; } else if (inView) pendingReady = false; }
    }
    if (this.pending && pendingReady) { this.norm = this.pending; this.pending = null; this.stats.genSwaps++; }
    const offX = Math.round(left), offY = Math.round(top);
    g.fillStyle = "rgb(28,46,70)"; g.fillRect(0, 0, W, H);
    for (let gy = gy0 + 1; gy < gy1; gy++) for (let gx = gx0 + 1; gx < gx1; gx++) {
      const r = this.region(gx, gy);
      if (r.gen !== this.norm.gen && !this.pending) this.renderGround(r, this.norm), (r.gen = this.norm.gen);
      g.drawImage(r.ground, gx * TILE - offX, gy * TILE - offY);
    }
    // noite: mesmo fator da V02 sobre o relevo (r,g ×0,45; b ×0,67), aplicado como multiplicação
    if (night) { g.globalCompositeOperation = "multiply"; g.fillStyle = `rgb(${Math.round(255 * (1 - night))},${Math.round(255 * (1 - night))},${Math.round(255 * (1 - night * 0.6))})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = "source-over"; }
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const r = this.region(gx, gy);
      if (r.treeKey !== this.biomeKey || !r.trees) this.renderTrees(r, this.biomeKey);
      g.drawImage(r.trees!, gx * TILE - offX - PAD, gy * TILE - offY - PAD);
    }
    // ---- camada dinâmica
    const px = (x: number) => W / 2 + (x - focus.x) / MPP, py = (z: number) => H / 2 + (z - focus.z) / MPP;
    const frame = Math.floor(now / 220) % 2;
    g.fillStyle = "#5fd4ff";
    for (const f of s.game.tracks) g.fillRect(Math.round(px(f.x)), Math.round(py(f.z)), 1, 1);
    for (const c of s.game.camps) { const x = px(c.x + 4), y = py(c.z + 4); this.spr(g, TENT, x, y); this.spr(g, FIRE[frame], x + 8, y + 1); }
    for (const w of s.game.wagons) { const x = px(w.x), y = py(w.z); const fl = Math.sin(w.heading) < 0; this.shadow(g, x, y, 12); this.spr(g, frame ? WAGON1 : WAGON0, x, y, fl); this.spr(g, DODO[frame], x + (fl ? -9 : 9), y, fl); }
    for (const c of s.game.creatures) {
      const x = px(c.x), y = py(c.z); if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
      const moving = c.clip === "walk" || c.clip === "run", f = moving ? frame : 0, fl = Math.sin(c.heading) < 0;
      if (!c.alive) { g.fillStyle = "#6a6f78"; g.fillRect(Math.round(x) - 3, Math.round(y) - 1, 6, 2); continue; }
      const cat = ECO_CAT[c.species], meio = (c as any).meio as string | undefined;
      if (meio === "areia") { this.spr(g, RIPPLE[frame], x, y); continue; }
      if (meio === "ar") { this.spr(g, BIRD[frame], x, y - Math.min(12, ((c as any).alt ?? 0) / MPP / 3), fl); continue; }
      if (c.species === "lobrapedra" || c.species === "folhisco" || !cat) {
        this.shadow(g, x, y, c.species === "lobrapedra" ? 12 : 7);
        this.spr(g, c.species === "lobrapedra" ? LOBRA[f] : FOLHISCO[f], x, y, fl);
      } else {
        const spr = cat.pred ? LOBRA[f] : cat.kg < 30 ? FOLHISCO[f] : HERB[f];
        const k = cat.kg > 1500 ? 3 : cat.kg > 300 ? 2 : 1;
        this.shadow(g, x, y, (cat.kg < 30 ? 7 : 12) * k);
        if (k === 1) this.spr(g, spr, x, y, fl);
        else { const im = this.sprite(spr, fl), w = im.width * k, h = im.height * k; g.drawImage(im, Math.round(x - w / 2), Math.round(y - h), w, h); }
      }
    }
    for (const h of s.hunters) {
      if (h.activity === "embarcado") continue;
      const x = px(h.x), y = py(h.z); if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
      if (!h.alive || h.activity === "caido" || h.activity === "carregado") { this.spr(g, DOWN, x, y); if (!h.alive) { g.fillStyle = "#f85149"; g.fillRect(Math.round(x) - 1, Math.round(y) - 6, 3, 1); } continue; }
      const moving = h.state === "caminhando", set = h.role === "socorrista" ? RESCUER : HUNTER;
      this.shadow(g, x, y, 6);
      this.spr(g, set[moving ? frame : 0], x, y + (h.crouched ? 1 : 0), Math.sin(h.heading) < 0);
      if (h.activity === "combatendo") { g.fillStyle = frame ? "#ffe070" : "#ffffff"; g.fillRect(Math.round(x) + 4, Math.round(y) - 8, 1, 1); }
    }
    const cover = weather.cloud;
    for (const c of this.clouds) {
      c.x += weather.wind[0] * c.s; c.y += weather.wind[1] * c.s * 0.5;
      if (c.x > W + 60) c.x = -60; if (c.x < -60) c.x = W + 60; if (c.y > H + 40) c.y = -40; if (c.y < -40) c.y = H + 40;
      if (c.i / this.clouds.length > cover + 0.15) continue;
      const spr = this.cloudSpr[c.i], hw = spr.width / 2, hh = spr.height / 2;
      g.globalAlpha = 0.10; g.filter = "none"; g.drawImage(this.darkBlob(c.i), Math.round(c.x + 14 - hw), Math.round(c.y + 18 - hh));
      g.globalAlpha = 0.35 + 0.25 * cover; g.drawImage(spr, Math.round(c.x - hw), Math.round(c.y - hh));
      g.globalAlpha = 1;
    }
    const k = weather.kind;
    const n = k === "limpo" || k === "nublado" ? 18 : Math.floor(this.dust.length * Math.max(0.3, weather.intensity));
    const rain = k === "chuva" || k === "tempestade", snow = k === "neve" || k === "nevasca";
    g.fillStyle = rain ? "rgba(170,200,230,0.7)" : snow ? "#ffffff" : k === "areia" ? "rgba(214,168,104,0.8)" : "rgba(240,230,200,0.35)";
    for (let i = 0; i < n; i++) {
      const d = this.dust[i];
      const vx = k === "areia" ? 3 : weather.wind[0] * 1.5, vy = rain ? 5 : snow ? 0.8 : 0.1;
      d.x = (d.x + vx * (0.5 + d.v) + W) % W; d.y = (d.y + vy * (0.5 + d.v) + H) % H;
      g.fillRect(Math.round(d.x), Math.round(d.y), 1, rain ? 3 : 1);
    }
    if (k === "areia" || k === "nevasca" || k === "tempestade") { g.fillStyle = k === "areia" ? `rgba(200,150,90,${0.3 * weather.intensity})` : `rgba(200,210,225,${0.25 * weather.intensity})`; g.fillRect(0, 0, W, H); }
    if (night) { g.fillStyle = "rgba(10,18,40,0.25)"; g.fillRect(0, 0, W, H); }
    const dt = performance.now() - t0;
    this.frameMsAvg = this.frameMsAvg ? this.frameMsAvg * 0.9 + dt * 0.1 : dt;
    this.stats.frameMs = this.frameMsAvg; this.stats.regions = this.regions.size; this.stats.heightsMB = this.heights.bytes / 1048576;
    return true;
  }
  /** Sombra da nuvem: o mesmo blob em preto (mesma forma; alfa 0,10 como na V02). */
  private dark: HTMLCanvasElement[] = [];
  private darkBlob(i: number) {
    if (!this.dark[i]) {
      const src = this.cloudSpr[i], c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
      const g = c.getContext("2d")!; g.drawImage(src, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
      this.dark[i] = c;
    }
    return this.dark[i];
  }
}
