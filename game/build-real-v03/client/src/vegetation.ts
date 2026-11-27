// Vegetação V02: protótipos compartilhados (prototypes.glb, 4 LODs cada) desenhados com InstancedMesh
// por (protótipo × LOD). As instâncias vêm do pipeline, organizadas em células de 256 m por hex.
// A cada atualização (orçamento, não a cada quadro) as células passam por frustum, distância,
// oclusão pelo relevo e densidade por distância; cada instância escolhe o LOD pelo TAMANHO
// PROJETADO na tela; o fade de aparecimento usa dithering (sem transparência).
// V03 (mesmo resultado visual, menos CPU): matrizes e cores de cada instância calculadas UMA vez por hex
// (antes: compose() por instância a cada atualização, 4×/s mesmo com a câmera parada); atualização só quando
// a câmera anda/gira ou há fade de aparecimento em curso; dados de um hex só carregados quando ele entra no
// alcance das árvores e descartados quando sai (com folga).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { patchMaterial } from "./atmosphere";
import type { GraphicsSettings } from "./settings";
import type { VisualWorld } from "./visual";

interface ProtoJ { id: number; family: string; kind: "tree" | "small" | "rock"; height: number; crown: number; nodes: string[]; tris: number[] }
interface CellJ { i: number; j: number; start: number; count: number; maxH: number }
interface TileVeg { id: string; data: Float32Array; F: number; cells: (CellJ & { box: THREE.Box3; key: object })[]; ox: number; oz: number; mats: Float32Array; cols: Float32Array; born: Float64Array; wbox: THREE.Box3 }

const MAXI = [6000, 9000, 14000, 26000];

export interface VegStats { candidates: number; drawn: number; perLod: number[]; cellsFrustum: number; cellsDistance: number; cellsOcclusion: number; drawCallsMax: number; updateMs: number }

export class Vegetation {
  readonly group = new THREE.Group();
  private protos: ProtoJ[] = [];
  private meshes: THREE.InstancedMesh[][] = []; // [proto][lod]
  private fades: THREE.InstancedBufferAttribute[][] = [];
  private tiles = new Map<string, TileVeg>();
  private loading = new Set<string>();
  private lastCam = new THREE.Vector3(1e9, 0, 0);
  private lastDir = new THREE.Vector3();
  private lastUpdate = 0;
  private fading = false;
  private dirty = true;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private col = new THREE.Color();
  stats: VegStats = { candidates: 0, drawn: 0, perLod: [0, 0, 0, 0], cellsFrustum: 0, cellsDistance: 0, cellsOcclusion: 0, drawCallsMax: 0, updateMs: 0 };
  ready = false;

  constructor(private origin: { x: number; z: number }, private settings: GraphicsSettings, private world: VisualWorld) { this.group.name = "vegetacao"; }

  async init() {
    const meta = await (await fetch("/visual/prototypes.json")).json();
    this.protos = meta.prototypes;
    const gltf = await new GLTFLoader().loadAsync("/visual/prototypes.glb");
    const byName = new Map<string, THREE.Mesh>();
    gltf.scene.traverse(o => { if ((o as THREE.Mesh).isMesh) byName.set(o.name, o as THREE.Mesh); });
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    patchMaterial(mat, { wind: true, fade: true });
    const matFar = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    patchMaterial(matFar, { wind: false, fade: true });
    for (const p of this.protos) {
      const row: THREE.InstancedMesh[] = [], frow: THREE.InstancedBufferAttribute[] = [];
      p.nodes.forEach((n, lod) => {
        const src = byName.get(n); if (!src) return;
        const g = src.geometry.clone();
        const cap = p.kind === "small" ? Math.min(MAXI[lod], 9000) : MAXI[lod];
        const fade = new THREE.InstancedBufferAttribute(new Float32Array(cap).fill(1), 1);
        fade.setUsage(THREE.DynamicDrawUsage);
        g.setAttribute("aFade", fade);
        const im = new THREE.InstancedMesh(g, lod >= 2 ? matFar : mat, cap);
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.setColorAt(0, new THREE.Color(1, 1, 1));
        im.instanceColor!.setUsage(THREE.DynamicDrawUsage);
        im.count = 0; im.frustumCulled = false; // o culling é feito por célula aqui
        im.castShadow = lod <= 1 && p.kind === "tree"; im.receiveShadow = lod === 0;
        im.name = `veg:${p.family}:${p.id}:L${lod}`;
        this.group.add(im); row[lod] = im; frow[lod] = fade;
      });
      this.meshes[p.id] = row; this.fades[p.id] = frow;
    }
    this.ready = true;
  }

  stream(focus: THREE.Vector3) {
    const reach = this.settings.treeDistance;
    if (reach <= 0 || this.settings.vegetationDensity <= 0) { if (this.tiles.size) { this.tiles.clear(); this.dirty = true; } return; }
    for (const tv of this.world.tiles.values()) {
      if (this.tiles.has(tv.id) || this.loading.has(tv.id)) continue;
      if (tv.wbox.distanceToPoint(focus) > reach + 600) continue; // fora do alcance das árvores: nem baixa
      this.loading.add(tv.id);
      Promise.all([fetch(`/visual/${tv.id}/veg.json`).then(r => r.json()), fetch(`/visual/${tv.id}/veg.bin`).then(r => r.arrayBuffer())]).then(([j, b]) => {
        const data = new Float32Array(b), F = j.floatsPerInstance;
        const cells = (j.cells as CellJ[]).map(c => {
          let y0 = Infinity;
          for (let n = c.start; n < c.start + c.count; n++) y0 = Math.min(y0, data[n * F + 1]);
          return { ...c, box: new THREE.Box3(new THREE.Vector3(c.i * 256 - 20 + tv.ox, y0 - 2, c.j * 256 - 20 + tv.oz), new THREE.Vector3(c.i * 256 + 276 + tv.ox, c.maxH + 2, c.j * 256 + 276 + tv.oz)), key: {} };
        });
        // pré-cálculo (uma vez): matriz e cor de cada instância
        const N = Math.floor(data.length / F), mats = new Float32Array(N * 16), cols = new Float32Array(N * 3);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
        for (let n = 0; n < N; n++) {
          const o = n * F;
          q.setFromAxisAngle(yAxis, data[o + 3]); sc.setScalar(data[o + 4]); p.set(data[o] + tv.ox, data[o + 1], data[o + 2] + tv.oz);
          m4.compose(p, q, sc); m4.toArray(mats, n * 16);
          cols[n * 3] = Math.min(1.6, data[o + 6]); cols[n * 3 + 1] = Math.min(1.6, data[o + 7]); cols[n * 3 + 2] = Math.min(1.6, data[o + 8]);
        }
        this.tiles.set(tv.id, { id: tv.id, data, F, cells, ox: tv.ox, oz: tv.oz, mats, cols, born: new Float64Array(N).fill(-1), wbox: tv.wbox.clone() });
        this.dirty = true;
      }).catch(() => {}).finally(() => this.loading.delete(tv.id));
    }
    for (const [id, t] of [...this.tiles]) if (!this.world.tiles.has(id) || t.wbox.distanceToPoint(focus) > reach + 1800) { this.tiles.delete(id); this.dirty = true; }
  }
  /** Bytes dos dados de vegetação residentes (RAM). */
  get bytes() { let b = 0; for (const t of this.tiles.values()) b += t.data.byteLength + t.mats.byteLength + t.cols.byteLength + t.born.byteLength; return b; }

  /** Recalcula as instâncias visíveis quando a câmera anda/gira o bastante ou a cada 250 ms (fade). */
  update(camera: THREE.PerspectiveCamera, viewportH: number, now: number) {
    if (!this.ready) return;
    const dir = camera.getWorldDirection(this.p);
    const moved = camera.position.distanceTo(this.lastCam) > 3 || dir.angleTo(this.lastDir) > 0.03;
    // V02 recalculava a cada 250 ms mesmo parada; aqui só se andou/girou, se chegou hex novo ou se há fade em curso
    if (!moved && !this.dirty && !(this.fading && now - this.lastUpdate >= 100)) return;
    const t0 = performance.now();
    this.lastCam.copy(camera.position); this.lastDir.copy(dir); this.lastUpdate = now; this.dirty = false;
    let fading = false;
    const st = this.stats; st.candidates = 0; st.drawn = 0; st.perLod = [0, 0, 0, 0]; st.cellsFrustum = 0; st.cellsDistance = 0; st.cellsOcclusion = 0; st.drawCallsMax = 0;
    for (const row of this.meshes) for (const im of row ?? []) if (im) im.count = 0;
    const set = this.settings;
    if (set.vegetationDensity <= 0) { this.finish(t0); return; }
    this.m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.m4);
    const K = viewportH / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const cam = camera.position, treeMax = set.treeDistance, smallMax = set.smallDistance;
    // limiares de LOD por tamanho projetado (px de altura na tela)
    const lodPx = set.profile === "alto" ? [150, 60, 18] : set.profile === "medio" ? [190, 80, 24] : [260, 110, 34];
    const minPx = set.profile === "alto" ? 1.2 : 2;
    for (const tv of this.tiles.values()) {
      const F = tv.F, D = tv.data;
      for (const c of tv.cells) {
        const dC = c.box.distanceToPoint(cam);
        if (dC > treeMax) { st.cellsDistance++; continue; }
        if (!this.frustum.intersectsBox(c.box)) { st.cellsFrustum++; continue; }
        if (dC > 400 && this.world.occlusionTest(c.key as any, c.box)) { st.cellsOcclusion++; continue; }
        for (let n = c.start; n < c.start + c.count; n++) {
          const o = n * F, proto = this.protos[D[o + 5]];
          if (!proto) continue;
          const small = proto.kind === "small";
          const x = D[o] + tv.ox, y = D[o + 1], z = D[o + 2] + tv.oz;
          const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const maxD = small ? smallMax : treeMax;
          if (d > maxD) continue;
          st.candidates++;
          // densidade por distância: originais sempre; adensadas rareiam com a distância
          const rank = D[o + 9], original = D[o + 10] > 0.5;
          const keep = original ? 1 : set.vegetationDensity * (d < maxD * 0.35 ? 1 : 1 - 0.85 * ((d - maxD * 0.35) / (maxD * 0.65)));
          if (rank > keep) continue;
          const h = proto.height * D[o + 4], px = (h * K) / Math.max(1, d);
          if (px < minPx) continue;
          const lod = px > lodPx[0] ? 0 : px > lodPx[1] ? 1 : px > lodPx[2] ? 2 : 3;
          const im = this.meshes[proto.id]?.[lod];
          if (!im || im.count >= im.instanceMatrix.count) continue;
          // fade suave na borda de distância e ao aparecer
          const edge = Math.min(1, (maxD - d) / (maxD * 0.12));
          let born = tv.born[n]; if (born < 0) { born = now; tv.born[n] = now; }
          const appear = (now - born) / 600 + 0.15;
          if (appear < 1) fading = true;
          const fade = Math.min(edge, Math.min(1, appear));
          const k = im.count++;
          im.instanceMatrix.array.set(tv.mats.subarray(n * 16, n * 16 + 16), k * 16);
          (im.instanceColor!.array as Float32Array).set(tv.cols.subarray(n * 3, n * 3 + 3), k * 3);
          this.fades[proto.id][lod].setX(k, fade);
          st.drawn++; st.perLod[lod]++;
        }
      }
    }
    this.fading = fading;
    this.finish(t0);
  }

  private finish(t0: number) {
    for (const [pid, row] of this.meshes.entries()) for (const [lod, im] of (row ?? []).entries()) {
      if (!im) continue;
      im.visible = im.count > 0;
      if (im.count) { this.stats.drawCallsMax++; im.instanceMatrix.needsUpdate = true; im.instanceColor!.needsUpdate = true; this.fades[pid][lod].needsUpdate = true; im.instanceMatrix.clearUpdateRanges(); im.instanceMatrix.addUpdateRange(0, im.count * 16); }
    }
    this.stats.updateMs = performance.now() - t0;
  }
}
