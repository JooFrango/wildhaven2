// Capim e flores perto da câmera (vida no chão): tufos procedurais low-poly instanciados (1 InstancedMesh
// para capim, 1 para flores), nascidos num anel de células de 12 m ao redor do foco. A altura vem de
// raycast no relevo REAL carregado (folhas LOD0); a cor acompanha a cor do chão no ponto, e encostas
// fortes, água, rocha e caminhos de terra ficam sem capim. Distância e densidade seguem o perfil gráfico.
// É decoração de apresentação: não existe no servidor e não afeta simulação.
import * as THREE from "three";
import { patchMaterial } from "./atmosphere";
import type { GraphicsSettings } from "./settings";
import type { VisualWorld } from "./visual";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";

const CELL = 12, MAX = 9000;
function tuft(blades: number, h: number, flower: boolean) {
  const pos: number[] = [], col: number[] = [];
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + b * 0.7, r = 0.08 + (b % 3) * 0.05, lean = 0.18 + (b % 2) * 0.12;
    const bx = Math.cos(a) * r, bz = Math.sin(a) * r, w = 0.05;
    const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    const tip = [bx + Math.cos(a) * lean, h * (0.75 + (b % 3) * 0.15), bz + Math.sin(a) * lean];
    pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, ...tip);
    col.push(0.55, 0.62, 0.45, 0.55, 0.62, 0.45, 1.15, 1.18, 0.9);
  }
  if (flower) {
    const fc = [[1.4, 1.25, 0.35], [1.35, 1.35, 1.3], [0.95, 0.6, 1.35], [1.4, 0.55, 0.4]][Math.floor(Math.random() * 4)];
    for (let p = 0; p < 4; p++) {
      const a = (p / 4) * Math.PI * 2, y = h * 1.05;
      pos.push(0, y, 0, Math.cos(a) * 0.09, y + 0.02, Math.sin(a) * 0.09, Math.cos(a + 0.9) * 0.09, y + 0.02, Math.sin(a + 0.9) * 0.09);
      col.push(...fc, ...fc, ...fc);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

interface Cell { k: string; items: Float32Array } // x,y,z,yaw,scale,r,g,b,flower

export class GrassField {
  readonly group = new THREE.Group();
  private grass: THREE.InstancedMesh;
  private flowers: THREE.InstancedMesh;
  private fadeG: THREE.InstancedBufferAttribute;
  private fadeF: THREE.InstancedBufferAttribute;
  private cells = new Map<string, Cell>();
  private last = new THREE.Vector3(1e9, 0, 0);
  private ray = new THREE.Raycaster();
  stats = { tufts: 0, flowers: 0, cells: 0, ms: 0 };
  private retryAt = 0;
  constructor(private world: VisualWorld, private settings: GraphicsSettings) {
    this.group.name = "capim";
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    patchMaterial(mat, { wind: true, fade: true });
    const mk = (g: THREE.BufferGeometry, n: number) => {
      const fade = new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1); fade.setUsage(THREE.DynamicDrawUsage); g.setAttribute("aFade", fade);
      const im = new THREE.InstancedMesh(g, mat, n); im.count = 0; im.frustumCulled = false; im.receiveShadow = true;
      im.setColorAt(0, new THREE.Color(1, 1, 1)); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      return { im, fade };
    };
    const a = mk(tuft(7, 0.55, false), MAX), b = mk(tuft(5, 0.45, true), MAX / 4);
    this.grass = a.im; this.fadeG = a.fade; this.flowers = b.im; this.fadeF = b.fade;
    this.grass.name = "capim"; this.flowers.name = "flores";
    this.group.add(this.grass, this.flowers);
  }

  /** V03: as folhas LOD0 chegam sob demanda; sem a malha ainda, a célula é refeita depois (não fica vazia). */
  private pending = false;
  // V04.1: o raio contra a malha L0 inteira (~6.300 triângulos por folha, sem estrutura de aceleração) custava
  // 165–176 ms para montar 16 células num único quadro (`tools/lab` — capim). Agora cada folha L0 ganha uma BVH
  // (three-mesh-bvh, MIT) na primeira consulta e o raio usa `firstHitOnly`: o MESMO ponto mais próximo que o
  // raycast padrão devolvia (sem mudança visual), em microssegundos. Vetores e cor reaproveitados (sem lixo).
  private rayO = new THREE.Vector3(); private rayD = new THREE.Vector3(0, -1, 0); private hits: THREE.Intersection[] = [];
  private gcol = new THREE.Color(); private gout = { y: 0, nY: 0, col: this.gcol };
  bvhMs = 0; bvhBuilt = 0;
  private groundAt(x: number, z: number): { y: number; nY: number; col: THREE.Color } | null {
    for (const tv of this.world.tiles.values()) {
      const lx = x - tv.ox, lz = z - tv.oz;
      const e = tv.blocks.get(`${Math.floor(lx / 1024)},${Math.floor(lz / 1024)}`);
      if (!e) continue;
      let leaf = null;
      for (const l of e.leaves) if (l.cat === "terrain" && lx >= l.box.min.x && lx <= l.box.max.x && lz >= l.box.min.z && lz <= l.box.max.z) { leaf = l; break; }
      if (!leaf) continue;
      const l0 = leaf.l0.mesh;
      if (!l0) { this.pending = true; return null; }
      const geo = l0.geometry as THREE.BufferGeometry & { boundsTree?: MeshBVH };
      if (!geo.boundsTree) { const t = performance.now(); geo.boundsTree = new MeshBVH(geo); this.bvhMs += performance.now() - t; this.bvhBuilt++; }
      if (l0.raycast !== acceleratedRaycast) l0.raycast = acceleratedRaycast;
      tv.group.updateMatrixWorld(true);
      this.ray.set(this.rayO.set(x, leaf.box.max.y + 50, z), this.rayD);
      (this.ray as any).firstHitOnly = true;
      this.hits.length = 0;
      const hit = this.ray.intersectObject(l0, false, this.hits)[0];
      if (!hit || !hit.face) return null;
      const c = l0.geometry.getAttribute("color");
      const col = this.gcol.setRGB(1, 1, 1);
      if (c) { const f = hit.face; col.setRGB((c.getX(f.a) + c.getX(f.b) + c.getX(f.c)) / 3, (c.getY(f.a) + c.getY(f.b) + c.getY(f.c)) / 3, (c.getZ(f.a) + c.getZ(f.b) + c.getZ(f.c)) / 3); }
      this.gout.y = hit.point.y; this.gout.nY = hit.face.normal.y;
      return this.gout;
    }
    return null;
  }

  private makeCell(ci: number, cj: number): Cell | null {
    const items: number[] = [];
    this.pending = false;
    let seed = (ci * 73856093) ^ (cj * 19349663);
    const rnd = () => { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 0) % 100000) / 100000; };
    const n = Math.round(26 * this.settings.vegetationDensity);
    for (let k = 0; k < n; k++) {
      const x = (ci + rnd()) * CELL, z = (cj + rnd()) * CELL;
      const g = this.groundAt(x, z);
      if (!g || g.nY < 0.82) continue;
      const c = g.col;
      // terra/caminho (vermelho > verde) e chão muito claro (areia/neve) ficam sem capim
      if (c.r > c.g * 1.05 || c.r + c.g + c.b > 2.2) continue;
      const flower = rnd() < 0.14;
      const tint = [c.r * 1.25 + 0.04, c.g * 1.3 + 0.05, c.b * 1.1];
      items.push(x, g.y - 0.03, z, rnd() * Math.PI * 2, 0.7 + rnd() * 0.8, ...tint, flower ? 1 : 0);
    }
    if (this.pending) return null;
    return { k: `${ci},${cj}`, items: Float32Array.from(items) };
  }

  update(focus: THREE.Vector3, camera: THREE.Camera, now: number) {
    const R = this.settings.smallDistance * 0.7;
    if (R <= 0 || this.settings.vegetationDensity <= 0) { this.grass.count = this.flowers.count = 0; return; }
    if (focus.distanceTo(this.last) < 4) return;
    if (now < this.retryAt) return;
    const t0 = performance.now();
    this.last.copy(focus);
    const c0 = Math.floor(focus.x / CELL), c1 = Math.floor(focus.z / CELL), rc = Math.ceil(R / CELL);
    const want = new Set<string>();
    let built = 0, incomplete = false;
    for (let i = -rc; i <= rc; i++) for (let j = -rc; j <= rc; j++) {
      const k = `${c0 + i},${c1 + j}`;
      if (Math.hypot(i * CELL, j * CELL) > R + CELL) continue;
      want.add(k);
      if (!this.cells.has(k) && built < 24) { const c = this.makeCell(c0 + i, c1 + j); built++; if (c) this.cells.set(k, c); else incomplete = true; } // orçamento por atualização
    }
    for (const k of this.cells.keys()) if (!want.has(k)) this.cells.delete(k);
    if (built >= 24 || incomplete) { this.last.set(1e9, 0, 0); this.retryAt = now + 300; } // faltam células: continua depois
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    let ng = 0, nf = 0;
    for (const cell of this.cells.values()) {
      const a = cell.items;
      for (let o = 0; o < a.length; o += 9) {
        const d = Math.hypot(a[o] - focus.x, a[o + 2] - focus.z);
        if (d > R) continue;
        const flower = a[o + 8] > 0.5, im = flower ? this.flowers : this.grass, n = flower ? nf : ng;
        if (n >= im.instanceMatrix.count) continue;
        p.set(a[o], a[o + 1], a[o + 2]); q.setFromAxisAngle(up, a[o + 3]); s.setScalar(a[o + 4]);
        m.compose(p, q, s); im.setMatrixAt(n, m); col.setRGB(a[o + 5], a[o + 6], a[o + 7]); im.setColorAt(n, col);
        (flower ? this.fadeF : this.fadeG).setX(n, Math.min(1, (R - d) / (R * 0.2)));
        if (flower) nf++; else ng++;
      }
    }
    this.grass.count = ng; this.flowers.count = nf;
    for (const [im, f] of [[this.grass, this.fadeG], [this.flowers, this.fadeF]] as const) { im.instanceMatrix.needsUpdate = true; im.instanceColor!.needsUpdate = true; f.needsUpdate = true; im.visible = im.count > 0; }
    this.stats = { tufts: ng, flowers: nf, cells: this.cells.size, ms: performance.now() - t0 };
    void camera; void now;
  }
}
