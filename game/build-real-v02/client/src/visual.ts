// Mundo visual da V02: streaming de hexes já subdivididos pelo pipeline offline (folhas de 256 m,
// blocos de 1 km, hex inteiro), escolha de LOD pelo ERRO EM PIXELS na tela (tamanho projetado),
// frustum culling hierárquico (hex → bloco → folha), distance culling por categoria, oclusão
// conservadora pelo relevo (grade de alturas MÍNIMAS de 32 m, raios distribuídos entre quadros)
// e horizonte continental de 1 draw call por região. Nada disto altera a física do servidor.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { patchMaterial } from "./atmosphere";
import type { GraphicsSettings } from "./settings";

const R = 2500;
export function latticeCenter(x: number, z: number) {
  const r = Math.round(z / (1.5 * R)), q = Math.round(x / (Math.sqrt(3) * R) - r / 2);
  return { x: Math.sqrt(3) * R * (q + r / 2), z: 1.5 * R * r };
}
type B6 = [number, number, number, number, number, number];
interface LeafJ { i: number; j: number; cat: string; b: B6; lods: { node: string; tris: number; err: number }[] }
interface BlockJ { i: number; j: number; cat: string; b: B6; node: string; tris: number; err: number }
interface StaticJ { tile: string; chunk: number; leaves: LeafJ[]; blocks: BlockJ[]; tile3: { cat: string; b: B6; node: string; tris: number; err: number }[]; heights: { cell: number; x0: number; z0: number; nx: number; nz: number } }
interface LeafE { cat: string; box: THREE.Box3; l0: THREE.Mesh; l1: THREE.Mesh; err1: number; lod: number }
interface BlockE { box: THREE.Box3; parts: { cat: string; mesh: THREE.Mesh; err: number }[]; leaves: LeafE[]; err: number }

export interface Heights { x0: number; z0: number; cell: number; nx: number; nz: number; min: Float32Array; max: Float32Array; ox: number; oz: number }

export class TileVis {
  readonly group = new THREE.Group();
  box = new THREE.Box3();
  blocks = new Map<string, BlockE>();
  tile3: { cat: string; mesh: THREE.Mesh; err: number }[] = [];
  err3 = 0;
  heights!: Heights;
  level: "tile" | "blocks" | "hidden" = "hidden";
  bytes = 0;
  disposed = false;
  constructor(readonly id: string, readonly ox: number, readonly oz: number) { this.group.name = "hex:" + id; this.group.position.set(ox, 0, oz); }
  dispose() {
    this.disposed = true;
    this.group.removeFromParent();
    const mats = new Set<THREE.Material>(), texs = new Set<THREE.Texture>();
    this.group.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      for (const mt of Array.isArray(m.material) ? m.material : [m.material]) { mats.add(mt); for (const v of Object.values(mt)) if ((v as THREE.Texture)?.isTexture) texs.add(v as THREE.Texture); }
    });
    mats.forEach(m => m.dispose()); texs.forEach(t => t.dispose());
  }
}

export interface VisualStats { tiles: number; leavesDrawn: number; blocksDrawn: number; tilesAsOne: number; frustumCulled: number; distanceCulled: number; occlusionCulled: number; horizonHidden: number; loading: number; bytes: number }

export class VisualWorld {
  readonly group = new THREE.Group();
  readonly tiles = new Map<string, TileVis>();
  private loading = new Map<string, Promise<void>>();
  private missing = new Set<string>();
  private loader = new GLTFLoader();
  private frustum = new THREE.Frustum();
  private projView = new THREE.Matrix4();
  private tmpV = new THREE.Vector3();
  private horizon: Horizon | null = null;
  private occl = new Map<THREE.Object3D, { t: number; hidden: boolean }>();
  private occlQueue: { obj: THREE.Object3D; box: THREE.Box3 }[] = [];
  stats: VisualStats = { tiles: 0, leavesDrawn: 0, blocksDrawn: 0, tilesAsOne: 0, frustumCulled: 0, distanceCulled: 0, occlusionCulled: 0, horizonHidden: 0, loading: 0, bytes: 0 };
  /** Materiais de água trocados pelo material de água V02. */
  waterMaterial: THREE.Material | null = null;

  constructor(private origin: { x: number; z: number }, private continent: { id: string; x: number; z: number; biome: string }[], private settings: GraphicsSettings) {
    this.group.name = "mundo-visual";
  }

  async loadHorizon(url: string) {
    this.horizon = await Horizon.load(url, this.origin, this.continent.map(t => t.id));
    this.group.add(this.horizon.group);
  }

  /** Hexes cujo centro está a menos de `radius` do foco: carrega (mais perto primeiro); descarrega além de radius+1,2 km. */
  stream(focus: THREE.Vector3, velocity: THREE.Vector3) {
    const radius = Math.max(2600, Math.min(this.settings.viewDistance, 7600));
    const ahead = focus.clone().addScaledVector(velocity, 12); // pré-carga na direção do movimento
    const want: { id: string; d: number }[] = [];
    for (const t of this.continent) {
      const c = latticeCenter(t.x, t.z), x = c.x - this.origin.x, z = c.z - this.origin.z;
      const d = Math.min(Math.hypot(x - focus.x, z - focus.z), Math.hypot(x - ahead.x, z - ahead.z));
      if (d < radius + R) want.push({ id: t.id, d });
      else if (d > radius + R + 1200 && this.tiles.has(t.id)) { this.tiles.get(t.id)!.dispose(); this.tiles.delete(t.id); this.horizon?.setHidden(t.id, false); }
    }
    want.sort((a, b) => a.d - b.d);
    for (const w of want) {
      if (this.loading.size >= 2) break;
      if (this.tiles.has(w.id) || this.loading.has(w.id) || this.missing.has(w.id)) continue;
      const p = this.loadTile(w.id).catch(() => { this.missing.add(w.id); }).finally(() => this.loading.delete(w.id));
      this.loading.set(w.id, p);
    }
    this.stats.loading = this.loading.size;
  }

  private async loadTile(id: string) {
    const t = this.continent.find(x => x.id === id)!;
    const meta = await fetch(`/visual/${id}/static.json`);
    if (!meta.ok) throw new Error("sem visual " + id);
    const j: StaticJ = await meta.json();
    const [glbRes, hRes] = await Promise.all([fetch(`/visual/${id}/static.glb`), fetch(`/visual/${id}/heights.bin`)]);
    const buf = await glbRes.arrayBuffer();
    const gltf = await this.loader.parseAsync(buf, "");
    const c = latticeCenter(t.x, t.z);
    const tv = new TileVis(id, c.x - this.origin.x, c.z - this.origin.z);
    tv.bytes = buf.byteLength;
    const nodes = new Map<string, THREE.Mesh>();
    gltf.scene.traverse(o => { if ((o as THREE.Mesh).isMesh) nodes.set(o.name, o as THREE.Mesh); });
    const prep = (name: string, cat: string) => {
      const m = nodes.get(name);
      if (!m) return null;
      m.removeFromParent();
      m.matrixAutoUpdate = false; m.updateMatrix();
      m.visible = false;
      m.receiveShadow = cat !== "water";
      m.castShadow = false;
      if (cat === "water" && this.waterMaterial) m.material = this.waterMaterial;
      else patchMaterial(m.material as THREE.Material);
      tv.group.add(m);
      return m;
    };
    const box = (b: B6) => new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5]));
    for (const b of j.blocks) {
      const k = `${b.i},${b.j}`;
      let e = tv.blocks.get(k);
      if (!e) { e = { box: new THREE.Box3(), parts: [], leaves: [], err: 0 }; tv.blocks.set(k, e); }
      const mesh = prep(b.node, b.cat); if (!mesh) continue;
      e.parts.push({ cat: b.cat, mesh, err: b.err }); e.box.union(box(b.b)); e.err = Math.max(e.err, b.err);
    }
    for (const l of j.leaves) {
      const k = `${Math.floor(l.i / 4)},${Math.floor(l.j / 4)}`;
      const e = tv.blocks.get(k); if (!e) continue;
      const l0 = prep(l.lods[0].node, l.cat), l1 = prep(l.lods[1].node, l.cat);
      if (!l0 || !l1) continue;
      e.leaves.push({ cat: l.cat, box: box(l.b), l0, l1, err1: l.lods[1].err, lod: -1 });
    }
    for (const t3 of j.tile3) { const mesh = prep(t3.node, t3.cat); if (mesh) { tv.tile3.push({ cat: t3.cat, mesh, err: t3.err }); tv.err3 = Math.max(tv.err3, t3.err); } }
    for (const e of tv.blocks.values()) tv.box.union(e.box);
    const hb = new Float32Array(await hRes.arrayBuffer()), n = j.heights.nx * j.heights.nz;
    tv.heights = { ...j.heights, min: hb.subarray(0, n), max: hb.subarray(n, 2 * n), ox: tv.ox, oz: tv.oz };
    if (this.tiles.has(id)) return;
    this.tiles.set(id, tv);
    this.group.add(tv.group);
    this.horizon?.setHidden(id, true);
  }

  /** Altura (render) do relevo pela grade de 32 m: `max` para colisão de câmera, `min` para oclusão. */
  heightAt(x: number, z: number, kind: "min" | "max" = "max"): number | null {
    for (const tv of this.tiles.values()) {
      const h = tv.heights; if (!h) continue;
      const i = Math.floor((x - h.ox - h.x0) / h.cell), j = Math.floor((z - h.oz - h.z0) / h.cell);
      if (i < 0 || j < 0 || i >= h.nx || j >= h.nz) continue;
      const v = (kind === "min" ? h.min : h.max)[j * h.nx + i];
      if (Number.isFinite(v)) return v;
    }
    return null;
  }

  /** Raio de visada câmera → ponto bloqueado pelo relevo? (conservador: alturas mínimas e margem). */
  private rayBlocked(from: THREE.Vector3, to: THREE.Vector3) {
    const d = from.distanceTo(to);
    if (d < 160) return false;
    const steps = Math.min(40, Math.ceil(d / 48));
    for (let s = 1; s < steps; s++) {
      const t = s / steps, x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t, z = from.z + (to.z - from.z) * t;
      const h = this.heightAt(x, z, "min");
      if (h !== null && h > y + 3) return true;
    }
    return false;
  }
  /** Oclusão de um volume: só oculto se o topo central e os dois cantos superiores estiverem bloqueados. */
  occluded(cam: THREE.Vector3, box: THREE.Box3) {
    const top = box.max.y + 1, c = box.getCenter(this.tmpV);
    const pts = [new THREE.Vector3(c.x, top, c.z), new THREE.Vector3(box.min.x, top, box.min.z), new THREE.Vector3(box.max.x, top, box.max.z)];
    return pts.every(p => this.rayBlocked(cam, p));
  }
  /** Fila de oclusão compartilhada (atores, células de vegetação): orçamento de raios por quadro, resultado reaproveitado. */
  occlusionTest(obj: THREE.Object3D, box: THREE.Box3) {
    const r = this.occl.get(obj);
    if (!r || performance.now() - r.t > 600) this.occlQueue.push({ obj, box });
    return r?.hidden ?? false;
  }
  private runOcclusion(cam: THREE.Vector3, budget: number) {
    let n = 0;
    while (this.occlQueue.length && n < budget) {
      const { obj, box } = this.occlQueue.shift()!;
      this.occl.set(obj, { t: performance.now(), hidden: this.occluded(cam, box) });
      n += 3;
    }
    if (this.occlQueue.length > 4000) this.occlQueue.length = 0;
    if (this.occl.size > 20000) this.occl.clear();
  }

  update(camera: THREE.PerspectiveCamera, viewportH: number) {
    const s = this.stats;
    Object.assign(s, { tiles: this.tiles.size, leavesDrawn: 0, blocksDrawn: 0, tilesAsOne: 0, frustumCulled: 0, distanceCulled: 0, occlusionCulled: 0, bytes: 0 });
    this.projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projView);
    const K = viewportH / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const tau = this.settings.terrainErrorPx;
    const cam = camera.position, vd = this.settings.viewDistance || 6000;
    const rockMax = Math.min(vd, 3500);
    const wb = new THREE.Box3();
    const dist = (b: THREE.Box3) => b.distanceToPoint(cam);
    for (const tv of this.tiles.values()) {
      s.bytes += tv.bytes;
      wb.copy(tv.box).translate(tv.group.position);
      const dT = dist(wb);
      const hide = () => { for (const t of tv.tile3) t.mesh.visible = false; for (const e of tv.blocks.values()) { for (const p of e.parts) p.mesh.visible = false; for (const l of e.leaves) { l.l0.visible = l.l1.visible = false; } } };
      if (dT > vd) { hide(); s.distanceCulled++; tv.level = "hidden"; this.horizon?.setHidden(tv.id, false); continue; }
      this.horizon?.setHidden(tv.id, true);
      if (!this.frustum.intersectsBox(wb)) { hide(); s.frustumCulled++; tv.level = "hidden"; continue; }
      const useTile = tv.tile3.length > 0 && dT > 600 && (tv.err3 * K) / dT < tau * (tv.level === "tile" ? 1.25 : 1);
      if (useTile) {
        hide(); tv.level = "tile"; s.tilesAsOne++;
        for (const t of tv.tile3) t.mesh.visible = true;
        continue;
      }
      tv.level = "blocks";
      for (const t of tv.tile3) t.mesh.visible = false;
      for (const e of tv.blocks.values()) {
        wb.copy(e.box).translate(tv.group.position);
        const dB = dist(wb);
        const off = () => { for (const p of e.parts) p.mesh.visible = false; for (const l of e.leaves) l.l0.visible = l.l1.visible = false; };
        if (!this.frustum.intersectsBox(wb)) { off(); s.frustumCulled++; continue; }
        if (dB > 900 && this.occlusionTest(e.parts[0]?.mesh ?? e as any, wb.clone())) { off(); s.occlusionCulled++; continue; }
        const blockOk = dB > 350 && (e.err * K) / Math.max(1, dB) < tau;
        if (blockOk) {
          for (const l of e.leaves) l.l0.visible = l.l1.visible = false;
          for (const p of e.parts) { const far = p.cat === "rock" && dB > rockMax; p.mesh.visible = !far; if (far) s.distanceCulled++; }
          s.blocksDrawn++;
          continue;
        }
        for (const p of e.parts) p.mesh.visible = false;
        for (const l of e.leaves) {
          wb.copy(l.box).translate(tv.group.position);
          if (!this.frustum.intersectsBox(wb)) { l.l0.visible = l.l1.visible = false; s.frustumCulled++; continue; }
          const dL = dist(wb);
          if (l.cat === "rock" && dL > rockMax) { l.l0.visible = l.l1.visible = false; s.distanceCulled++; continue; }
          if (dL > 500 && this.occlusionTest(l.l0, wb.clone())) { l.l0.visible = l.l1.visible = false; s.occlusionCulled++; continue; }
          const want1 = (l.err1 * K) / Math.max(1, dL) < tau * (l.lod === 1 ? 1.2 : 1);
          l.lod = want1 ? 1 : 0;
          l.l0.visible = !want1; l.l1.visible = want1;
          s.leavesDrawn++;
        }
      }
    }
    this.runOcclusion(cam, 72);
    if (this.horizon) { this.horizon.update(); s.horizonHidden = this.horizon.hiddenCount; }
  }
}

/** Horizonte: os 272 hexes simplificados, fundidos em poucas regiões (1 draw call cada). */
class Horizon {
  readonly group = new THREE.Group();
  private hiddenTex: THREE.DataTexture;
  private data: Uint8Array;
  private index = new Map<string, number>();
  hiddenCount = 0;
  private dirty = true;
  static async load(url: string, origin: { x: number; z: number }, ids: string[]) {
    const h = new Horizon(ids);
    const gltf = await new GLTFLoader().loadAsync(url);
    const buckets = new Map<string, { pos: number[]; col: number[]; tile: number[]; idx: number[] }>();
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const id = /^H_(.+)_(terrain|water)_\d+_L3$/.exec(m.name)?.[1]; if (!id) return;
      const ti = h.index.get(id) ?? 0;
      const g = m.geometry, P = g.getAttribute("position"), C = g.getAttribute("color"), I = g.getIndex();
      const wx = m.matrixWorld.elements[12] - origin.x, wz = m.matrixWorld.elements[14] - origin.z;
      const key = `${Math.floor(wx / 15000)},${Math.floor(wz / 15000)}`;
      let b = buckets.get(key); if (!b) { b = { pos: [], col: [], tile: [], idx: [] }; buckets.set(key, b); }
      const base = b.pos.length / 3;
      for (let i = 0; i < P.count; i++) { b.pos.push(P.getX(i) + wx, P.getY(i), P.getZ(i) + wz); b.col.push(C ? C.getX(i) : 0.4, C ? C.getY(i) : 0.5, C ? C.getZ(i) : 0.3); b.tile.push(ti); }
      if (I) for (let i = 0; i < I.count; i++) b.idx.push(base + I.getX(i));
      g.dispose();
    });
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    patchMaterial(mat);
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, r) => {
      prev.call(mat, shader, r);
      shader.uniforms.uHidden = { value: h.hiddenTex };
      shader.uniforms.uTileCount = { value: ids.length };
      shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute float aTile; uniform sampler2D uHidden; uniform float uTileCount;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nif (texture2D(uHidden, vec2((aTile + 0.5) / uTileCount, 0.5)).r > 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);");
    };
    mat.customProgramCacheKey = () => "wh-horizon";
    for (const b of buckets.values()) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(b.col, 3));
      g.setAttribute("aTile", new THREE.Float32BufferAttribute(b.tile, 1));
      g.setIndex(b.idx); g.computeVertexNormals(); g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat); mesh.name = "horizonte"; mesh.receiveShadow = false; mesh.matrixAutoUpdate = false;
      h.group.add(mesh);
    }
    // mar ao redor do continente (nível 0)
    const sea = new THREE.Mesh(new THREE.CircleGeometry(160000, 48).rotateX(-Math.PI / 2), patchMaterial(new THREE.MeshLambertMaterial({ color: 0x1c4a66 })));
    sea.position.set(0, -1.2, 0); sea.name = "mar"; h.group.add(sea);
    return h;
  }
  private constructor(ids: string[]) {
    ids.forEach((id, i) => this.index.set(id, i));
    this.data = new Uint8Array(ids.length * 4);
    this.hiddenTex = new THREE.DataTexture(this.data, ids.length, 1, THREE.RGBAFormat);
    this.hiddenTex.needsUpdate = true;
    this.group.name = "horizonte";
  }
  setHidden(id: string, hidden: boolean) {
    const i = this.index.get(id); if (i === undefined) return;
    const v = hidden ? 255 : 0;
    if (this.data[i * 4] !== v) { this.data[i * 4] = v; this.dirty = true; }
  }
  update() {
    if (!this.dirty) return;
    this.dirty = false; this.hiddenTex.needsUpdate = true;
    let n = 0; for (let i = 0; i < this.data.length; i += 4) if (this.data[i]) n++;
    this.hiddenCount = n;
  }
}
