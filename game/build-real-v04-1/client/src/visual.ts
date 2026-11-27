// Mundo visual da V03 — STREAMING POR VISIBILIDADE. Mesmas malhas, mesmos LODs e a mesma seleção da V02
// (erro em pixels na tela, frustum hierárquico hex → bloco → folha, distância por categoria, oclusão pelo
// relevo), mas cada nó (folha LOD0, folha LOD1, parte de bloco, parte do hex inteiro) é um GLB próprio
// baixado por HTTP Range do pacote `chunks.bin` SÓ quando a seleção o pede (ou para pré-carga próxima).
// - fila por prioridade (distância ao foco + direção de movimento), poucas requisições simultâneas,
//   orçamento de malhas novas por quadro, cancelamento (AbortController) do que perdeu relevância;
// - enquanto um nó carrega, desenha o nível mais grosso já carregado (bloco → hex inteiro → horizonte),
//   nunca buracos; blocos e suas folhas nunca aparecem juntos (sem sobreposição);
// - histerese: nó não usado por 30 s é descartado (geometria liberada da RAM e da VRAM); teto de memória
//   por perfil com descarte LRU dos nós não usados; materiais/texturas do hex compartilhados (1 por hex);
// - sem recalcular nada se a câmera não se moveu e nenhum nó novo ficou pronto.
// Nada disto altera a física do servidor (as colisões e a IA usam os pacotes WHP1 no Rust).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { patchMaterial } from "./atmosphere";
import type { GraphicsSettings } from "./settings";
import { latticeCenter, type HeightIndex } from "./heights";
export { latticeCenter } from "./heights";

const R = 2500;
type B6 = [number, number, number, number, number, number];
interface LeafJ { i: number; j: number; cat: string; b: B6; lods: { node: string; tris: number; err: number }[] }
interface BlockJ { i: number; j: number; cat: string; b: B6; node: string; tris: number; err: number }
interface ChunksJ { tile: string; chunk: number; leaves: LeafJ[]; blocks: BlockJ[]; tile3: { cat: string; b: B6; node: string; tris: number; err: number }[]; pack: Record<string, [number, number, number, number]> }

/** Um nó do pacote: carregado sob demanda, com estado e estatísticas. */
class NodeRes {
  mesh: THREE.Mesh | null = null;
  state: "none" | "queued" | "loading" | "ready" | "failed" = "none";
  lastWanted = 0;
  prio = 1e9;
  abort: AbortController | null = null;
  bytes = 0;
  drawnOnce = false;
  constructor(readonly tile: TileVis, readonly name: string, readonly cat: string, readonly off: number, readonly len: number, readonly tris: number, readonly mat: number) {}
  get ready() { return this.state === "ready" && !!this.mesh; }
}
interface LeafE { cat: string; box: THREE.Box3; l0: NodeRes; l1: NodeRes; err1: number; lod: number; wbox?: THREE.Box3 }
interface BlockE { box: THREE.Box3; parts: { cat: string; node: NodeRes; err: number }[]; leaves: LeafE[]; err: number; wbox: THREE.Box3 }

export class TileVis {
  readonly group = new THREE.Group();
  box = new THREE.Box3();
  wbox = new THREE.Box3();
  blocks = new Map<string, BlockE>();
  tile3: { cat: string; node: NodeRes; err: number }[] = [];
  nodes: NodeRes[] = [];
  err3 = 0;
  level: "tile" | "blocks" | "hidden" = "hidden";
  materials: THREE.Material[] = [];
  variants = new Map<number, THREE.Material>();
  disposed = false;
  constructor(readonly id: string, readonly ox: number, readonly oz: number) { this.group.name = "hex:" + id; this.group.position.set(ox, 0, oz); this.group.matrixAutoUpdate = false; this.group.updateMatrix(); }
}

export interface VisualStats {
  tiles: number; leavesDrawn: number; blocksDrawn: number; tilesAsOne: number; frustumCulled: number; distanceCulled: number; occlusionCulled: number; horizonHidden: number; loading: number; bytes: number;
  // V03: contagens do streaming por visibilidade
  nodesTotal: number; nodesRam: number; nodesVram: number; nodesDrawn: number; nodesHidden: number; nodesUnloaded: number; queue: number; inflight: number; canceled: number; fallbacks: number; loadedBytes: number; updatesSkipped: number;
}

const BUDGET_MB: Record<string, number> = { economico: 0, baixo: 120, medio: 220, alto: 360 };

export class VisualWorld {
  readonly group = new THREE.Group();
  readonly tiles = new Map<string, TileVis>();
  readonly heights: HeightIndex;
  private loadingTiles = new Map<string, Promise<void>>();
  private missing = new Set<string>();
  private loader = new GLTFLoader();
  private frustum = new THREE.Frustum();
  private projView = new THREE.Matrix4();
  private tmpV = new THREE.Vector3();
  private horizon: Horizon | null = null;
  private occl = new Map<object, { t: number; hidden: boolean; gen: number; queued?: boolean }>();
  /** V04.1: incrementa quando a câmera se move; resultados de oclusão só expiram se a câmera mudou desde o teste. */
  private camGen = 0;
  private evictT = 0;
  private occlQueue: { obj: object; box: THREE.Box3 }[] = [];
  private queue: NodeRes[] = [];
  private inflight = 0;
  private parsedThisFrame = 0;
  private lastCamPos = new THREE.Vector3(1e9, 0, 0);
  private lastCamQ = new THREE.Quaternion();
  private dirty = true;
  private now = 0;
  private focus = new THREE.Vector3();
  private ahead = new THREE.Vector3();
  private wb = new THREE.Box3();
  stats: VisualStats = { tiles: 0, leavesDrawn: 0, blocksDrawn: 0, tilesAsOne: 0, frustumCulled: 0, distanceCulled: 0, occlusionCulled: 0, horizonHidden: 0, loading: 0, bytes: 0, nodesTotal: 0, nodesRam: 0, nodesVram: 0, nodesDrawn: 0, nodesHidden: 0, nodesUnloaded: 0, queue: 0, inflight: 0, canceled: 0, fallbacks: 0, loadedBytes: 0, updatesSkipped: 0 };
  waterMaterial: THREE.Material | null = null;
  /** Carregamento inicial: callback de progresso real (nós prontos / pedidos). */
  onProgress: ((ready: number, wanted: number) => void) | null = null;

  constructor(private origin: { x: number; z: number }, private continent: { id: string; x: number; z: number; biome: string }[], private settings: GraphicsSettings, heights: HeightIndex) {
    this.group.name = "mundo-visual";
    this.heights = heights;
  }

  async loadHorizon(url: string, onBytes?: (got: number, total: number) => void) {
    this.horizon = await Horizon.load(url, this.origin, this.continent.map(t => t.id), onBytes);
    this.group.add(this.horizon.group);
  }

  /** Hexes perto do foco: carrega só os METADADOS (índice, grade de alturas, materiais) — as malhas vêm sob demanda. */
  stream(focus: THREE.Vector3, velocity: THREE.Vector3) {
    this.focus.copy(focus);
    this.ahead.copy(focus).addScaledVector(velocity, 12);
    const radius = Math.max(2600, Math.min(this.settings.viewDistance, 7600));
    const want: { id: string; d: number }[] = [];
    for (const t of this.continent) {
      const c = latticeCenter(t.x, t.z), x = c.x - this.origin.x, z = c.z - this.origin.z;
      const d = Math.min(Math.hypot(x - focus.x, z - focus.z), Math.hypot(x - this.ahead.x, z - this.ahead.z));
      if (d < radius + R) want.push({ id: t.id, d });
      else if (d > radius + R + 1200 && this.tiles.has(t.id)) this.dropTile(t.id);
    }
    want.sort((a, b) => a.d - b.d);
    for (const w of want) {
      if (this.loadingTiles.size >= 2) break;
      if (this.tiles.has(w.id) || this.loadingTiles.has(w.id) || this.missing.has(w.id)) continue;
      if (this.heights.available && !this.heights.available.has(w.id)) continue; // sem visual detalhado: fica o horizonte
      const p = this.loadTile(w.id).catch(() => { this.missing.add(w.id); }).finally(() => this.loadingTiles.delete(w.id));
      this.loadingTiles.set(w.id, p);
    }
    this.stats.loading = this.loadingTiles.size;
  }

  private dropTile(id: string) {
    const tv = this.tiles.get(id); if (!tv) return;
    tv.disposed = true;
    for (const n of tv.nodes) this.unload(n);
    for (const m of [...tv.materials, ...tv.variants.values()]) { for (const v of Object.values(m)) if ((v as THREE.Texture)?.isTexture) (v as THREE.Texture).dispose(); m.dispose(); }
    tv.group.removeFromParent();
    this.tiles.delete(id); this.heights.unpin(id);
    this.horizon?.setHidden(id, false);
    this.dirty = true;
  }

  private async loadTile(id: string) {
    const t = this.continent.find(x => x.id === id)!;
    const [meta, mats] = await Promise.all([fetch(`/visual/${id}/chunks.json`), fetch(`/visual/${id}/materials.glb`), this.heights.load(id)]);
    if (!meta.ok) throw new Error("sem visual " + id);
    const j: ChunksJ = await meta.json();
    const c = latticeCenter(t.x, t.z);
    const tv = new TileVis(id, c.x - this.origin.x, c.z - this.origin.z);
    if (mats.ok) {
      const g = await this.loader.parseAsync(await mats.arrayBuffer(), "");
      tv.materials = (await g.parser.getDependencies("material")) as THREE.Material[];
    }
    const node = (name: string, cat: string) => {
      const p = j.pack[name]; if (!p) return null;
      const n = new NodeRes(tv, name, cat, p[0], p[1], p[2], p[3] ?? 0); tv.nodes.push(n); return n;
    };
    const box = (b: B6) => new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5]));
    for (const b of j.blocks) {
      const k = `${b.i},${b.j}`;
      let e = tv.blocks.get(k);
      if (!e) { e = { box: new THREE.Box3(), parts: [], leaves: [], err: 0, wbox: new THREE.Box3() }; tv.blocks.set(k, e); }
      const n = node(b.node, b.cat); if (!n) continue;
      e.parts.push({ cat: b.cat, node: n, err: b.err }); e.box.union(box(b.b)); e.err = Math.max(e.err, b.err);
    }
    for (const l of j.leaves) {
      const e = tv.blocks.get(`${Math.floor(l.i / 4)},${Math.floor(l.j / 4)}`); if (!e) continue;
      const l0 = node(l.lods[0].node, l.cat), l1 = node(l.lods[1].node, l.cat);
      if (!l0 || !l1) continue;
      e.leaves.push({ cat: l.cat, box: box(l.b), l0, l1, err1: l.lods[1].err, lod: -1 });
    }
    for (const t3 of j.tile3) { const n = node(t3.node, t3.cat); if (n) { tv.tile3.push({ cat: t3.cat, node: n, err: t3.err }); tv.err3 = Math.max(tv.err3, t3.err); } }
    for (const e of tv.blocks.values()) { tv.box.union(e.box); e.wbox.copy(e.box).translate(tv.group.position); }
    tv.wbox.copy(tv.box).translate(tv.group.position);
    if (this.tiles.has(id)) return;
    this.tiles.set(id, tv); this.heights.pin(id); // V04.1 (RAM-02): relevo 3D carregado prende a grade de alturas
    this.group.add(tv.group);
    this.dirty = true;
  }

  // ---------------------------------------------------------------- fila de carregamento por nó
  private want(n: NodeRes, prio: number) {
    n.lastWanted = this.now;
    if (n.state === "ready" || n.state === "failed") return;
    n.prio = Math.min(n.state === "queued" || n.state === "loading" ? n.prio : 1e9, prio);
    if (n.state === "none") { n.state = "queued"; this.queue.push(n); }
  }
  private pump() {
    const maxInflight = 6;
    if (this.queue.length > 1) this.queue.sort((a, b) => a.prio - b.prio);
    // cancela o que perdeu relevância (não pedido há 2 s)
    for (let i = this.queue.length - 1; i >= 0; i--) { const n = this.queue[i]; if (this.now - n.lastWanted > 2000 || n.tile.disposed) { n.state = "none"; this.queue.splice(i, 1); this.stats.canceled++; } }
    while (this.inflight < maxInflight && this.queue.length) {
      const n = this.queue.shift()!;
      n.state = "loading"; this.inflight++;
      const ac = new AbortController(); n.abort = ac;
      fetch(`/visual/${n.tile.id}/chunks.bin`, { headers: { Range: `bytes=${n.off}-${n.off + n.len - 1}` }, signal: ac.signal })
        .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); })
        .then(buf => this.waitBudget().then(() => this.loader.parseAsync(buf.byteLength === n.len ? buf : buf.slice(n.off, n.off + n.len), "")))
        .then(g => {
          if (n.tile.disposed || n.state !== "loading") return;
          let m: THREE.Mesh | null = null; g.scene.traverse(o => { if ((o as THREE.Mesh).isMesh) m = o as THREE.Mesh; });
          if (!m) { n.state = "failed"; return; }
          const mesh = m as THREE.Mesh;
          mesh.removeFromParent(); mesh.matrixAutoUpdate = false; mesh.updateMatrix(); mesh.visible = false;
          mesh.receiveShadow = n.cat !== "water"; mesh.castShadow = false;
          (mesh.material as THREE.Material).dispose();
          if (n.cat === "water" && this.waterMaterial) mesh.material = this.waterMaterial;
          // mesmo patch da V02 (relevo com detalhe de solo; rochas sem), aplicado uma vez por material do hex
          else mesh.material = patchMaterial(this.materialFor(n, mesh.geometry), { ground: n.cat === "terrain" });
          n.tile.group.add(mesh);
          n.mesh = mesh; n.state = "ready";
          n.bytes = Object.values(mesh.geometry.attributes).reduce((s, a) => s + (a as THREE.BufferAttribute).array.byteLength, 0) + (mesh.geometry.index?.array.byteLength ?? 0);
          this.stats.loadedBytes += n.bytes;
          this.dirty = true;
        })
        .catch(e => { if (n.state === "loading") n.state = (e?.name === "AbortError") ? "none" : "failed"; })
        .finally(() => { this.inflight--; n.abort = null; });
    }
  }
  /** Mesma regra do GLTFLoader: primitiva com COLOR_0 usa uma variante do material com cores de vértice
   *  (o materials.glb não tem primitivas, então o loader não pôde decidir sozinho). Uma variante por material do hex. */
  private materialFor(n: NodeRes, g: THREE.BufferGeometry): THREE.Material {
    const vc = !!g.getAttribute("color"), flat = !g.getAttribute("normal");
    const key = n.mat * 4 + (vc ? 1 : 0) + (flat ? 2 : 0);
    let m = n.tile.variants.get(key);
    if (m) return m;
    const base = (n.tile.materials[n.mat] ?? n.tile.materials[0]) as THREE.MeshStandardMaterial | undefined;
    if (!base) m = new THREE.MeshStandardMaterial({ vertexColors: vc, flatShading: flat, roughness: 0.94 });
    // Variante nos dois sentidos para as cores de vértice (malha sem COLOR_0 num material com vertexColors lê cor 0).
    // Sem NORMAL (50 dos 272 GLBs originais: planícies, savanas, selva, deserto central), o glTF manda o cliente usar
    // normais PLANAS; sem isso a iluminação dava zero e o relevo saía preto. flatShading = o facetado do próprio asset.
    else if (base.vertexColors !== vc || base.flatShading !== flat) { m = base.clone(); (m as THREE.MeshStandardMaterial).vertexColors = vc; (m as THREE.MeshStandardMaterial).flatShading = flat; }
    else m = base;
    n.tile.variants.set(key, m);
    return m;
  }
  /** Orçamento de malhas novas por quadro (evita picos ao girar a câmera). */
  private waiters: (() => void)[] = [];
  private waitBudget(): Promise<void> {
    if (this.parsedThisFrame < 6) { this.parsedThisFrame++; return Promise.resolve(); }
    return new Promise(r => this.waiters.push(r));
  }
  private unload(n: NodeRes) {
    if (n.abort) { n.abort.abort(); n.abort = null; }
    if (n.mesh) { n.mesh.removeFromParent(); n.mesh.geometry.dispose(); this.stats.loadedBytes -= n.bytes; n.mesh = null; this.stats.nodesUnloaded++; }
    n.state = "none"; n.drawnOnce = false;
  }
  /** Descarte: não usado há 30 s, ou (acima do teto do perfil) os menos recentes primeiro. */
  private evict() {
    const budget = (BUDGET_MB[this.settings.profile] ?? 220) * 1048576;
    const idle: NodeRes[] = [];
    for (const tv of this.tiles.values()) for (const n of tv.nodes) if (n.mesh && !n.mesh.visible && this.now - n.lastWanted > 2000) idle.push(n);
    for (const n of idle) if (this.now - n.lastWanted > 30000) this.unload(n);
    if (this.stats.loadedBytes > budget) {
      idle.sort((a, b) => a.lastWanted - b.lastWanted);
      for (const n of idle) { if (this.stats.loadedBytes <= budget * 0.9) break; if (n.mesh) this.unload(n); }
    }
  }

  // ---------------------------------------------------------------- consultas de altura (grade compacta)
  heightAt(x: number, z: number, kind: "min" | "max" = "max") { return this.heights.heightAt(x, z, kind); }
  heightSmooth(x: number, z: number) { return this.heights.heightSmooth(x, z); }

  private rayBlocked(from: THREE.Vector3, tx: number, ty: number, tz: number) {
    const d = Math.hypot(tx - from.x, ty - from.y, tz - from.z);
    if (d < 160) return false;
    const steps = Math.min(40, Math.ceil(d / 48));
    for (let s = 1; s < steps; s++) {
      const t = s / steps, x = from.x + (tx - from.x) * t, y = from.y + (ty - from.y) * t, z = from.z + (tz - from.z) * t;
      const h = this.heights.heightAt(x, z, "min");
      if (h !== null && h > y + 3) return true;
    }
    return false;
  }
  /** Oclusão de um volume: só oculto se o topo central e os dois cantos superiores estiverem bloqueados. */
  occluded(cam: THREE.Vector3, box: THREE.Box3) {
    const top = box.max.y + 1, c = box.getCenter(this.tmpV);
    return this.rayBlocked(cam, c.x, top, c.z) && this.rayBlocked(cam, box.min.x, top, box.min.z) && this.rayBlocked(cam, box.max.x, top, box.max.z);
  }
  /** Fila de oclusão compartilhada (atores, células de vegetação): orçamento de raios por quadro, resultado reaproveitado. */
  occlusionTest(obj: object, box: THREE.Box3) {
    const r = this.occl.get(obj);
    // V04.1: antes, todo resultado expirava em 600 ms e voltava à fila mesmo com a câmera parada — o terreno nunca
    // pulava a atualização (e cada folha alocava uma caixa nova por quadro). O relevo é estático: só a câmera muda.
    if (!r || (this.now - r.t > 600 && r.gen !== this.camGen && !r.queued)) { this.occlQueue.push({ obj, box }); if (r) r.queued = true; }
    return r?.hidden ?? false;
  }
  private runOcclusion(cam: THREE.Vector3, budget: number) {
    let n = 0;
    while (this.occlQueue.length && n < budget) {
      const { obj, box } = this.occlQueue.shift()!;
      const was = this.occl.get(obj)?.hidden;
      const hidden = this.occluded(cam, box);
      this.occl.set(obj, { t: this.now, hidden, gen: this.camGen });
      if (was !== hidden) this.dirty = true;
      n += 3;
    }
    if (this.occlQueue.length > 4000) { for (const q of this.occlQueue) { const r = this.occl.get(q.obj); if (r) r.queued = false; } this.occlQueue.length = 0; }
    if (this.occl.size > 20000) this.occl.clear();
  }

  /** Seleção por quadro (mesmas regras da V02) + pedidos de carregamento + fallback sem buracos. */
  update(camera: THREE.PerspectiveCamera, viewportH: number) {
    this.now = performance.now();
    this.parsedThisFrame = 0;
    while (this.waiters.length && this.parsedThisFrame < 6) { this.parsedThisFrame++; this.waiters.shift()!(); }
    const moved = camera.position.distanceToSquared(this.lastCamPos) > 0.25 || camera.quaternion.angleTo(this.lastCamQ) > 0.004;
    const s = this.stats;
    if (!moved && !this.dirty && !this.occlQueue.length) { s.updatesSkipped++; this.pump(); return; }
    if (moved) this.camGen++;
    this.lastCamPos.copy(camera.position); this.lastCamQ.copy(camera.quaternion); this.dirty = false;
    Object.assign(s, { tiles: this.tiles.size, leavesDrawn: 0, blocksDrawn: 0, tilesAsOne: 0, frustumCulled: 0, distanceCulled: 0, occlusionCulled: 0, bytes: this.stats.loadedBytes, fallbacks: 0 });
    this.projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projView);
    const K = viewportH / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const tau = this.settings.terrainErrorPx;
    const cam = camera.position, vd = this.settings.viewDistance || 6000;
    const rockMax = Math.min(vd, 3500);
    const wb = this.wb;
    const prio = (b: THREE.Box3) => Math.min(b.distanceToPoint(this.focus), b.distanceToPoint(this.ahead), b.distanceToPoint(cam));
    const show = (n: NodeRes, on: boolean) => { if (n.mesh) { n.mesh.visible = on; if (on) n.drawnOnce = true; } };
    for (const tv of this.tiles.values()) {
      const dT = tv.wbox.distanceToPoint(cam);
      const hide = () => { for (const t of tv.tile3) show(t.node, false); for (const e of tv.blocks.values()) { for (const p of e.parts) show(p.node, false); for (const l of e.leaves) { show(l.l0, false); show(l.l1, false); } } };
      if (dT > vd) { hide(); s.distanceCulled++; tv.level = "hidden"; this.horizon?.setHidden(tv.id, false); continue; }
      // o hex inteiro (LOD3) é sempre pedido para os hexes no alcance: é o fallback sem buracos
      for (const t of tv.tile3) this.want(t.node, prio(tv.wbox) + 4000);
      const tileReady = tv.tile3.length > 0 && tv.tile3.every(t => t.node.ready);
      if (!this.frustum.intersectsBox(tv.wbox)) { hide(); s.frustumCulled++; tv.level = "hidden"; this.horizon?.setHidden(tv.id, tileReady); continue; }
      const useTile = tv.tile3.length > 0 && dT > 600 && (tv.err3 * K) / dT < tau * (tv.level === "tile" ? 1.25 : 1);
      const showTile = () => { hide(); for (const t of tv.tile3) show(t.node, true); this.horizon?.setHidden(tv.id, tileReady); if (!tileReady) for (const t of tv.tile3) show(t.node, false); };
      if (useTile) { showTile(); tv.level = "tile"; s.tilesAsOne++; continue; }
      // modo blocos: decide cada bloco; se algum bloco visível não tiver NADA pronto, o hex inteiro vira fallback
      let blockMissing = false;
      const plan: { e: BlockE; mode: "off" | "block" | "leaves" }[] = [];
      for (const e of tv.blocks.values()) {
        const dB = e.wbox.distanceToPoint(cam);
        if (!this.frustum.intersectsBox(e.wbox)) {
          plan.push({ e, mode: "off" }); s.frustumCulled++;
          // pré-carga preventiva: blocos próximos fora da tela (girar a câmera não deve travar nem mostrar buracos);
          // perto, também as folhas LOD1 (o giro mostra folhas, não o bloco grosso)
          if (dB < 700) for (const p of e.parts) this.want(p.node, prio(e.wbox) + 2500);
          if (dB < 450) for (const l of e.leaves) this.want(l.l1, prio(e.wbox) + 3000);
          continue;
        }
        if (dB > 900 && this.occlusionTest(e, e.wbox)) { plan.push({ e, mode: "off" }); s.occlusionCulled++; continue; }
        for (const p of e.parts) this.want(p.node, prio(e.wbox) + 1000);
        const blockOk = dB > 350 && (e.err * K) / Math.max(1, dB) < tau;
        const partsReady = e.parts.every(p => p.node.ready);
        if (blockOk) { plan.push({ e, mode: "block" }); if (!partsReady) blockMissing = true; continue; }
        // folhas: pede o LOD escolhido; se faltar alguma folha visível, o bloco inteiro fica no nível de bloco
        let leavesReady = true;
        for (const l of e.leaves) {
          const wb = (l.wbox ??= l.box.clone().translate(tv.group.position));
          if (!this.frustum.intersectsBox(wb)) continue;
          const dL = wb.distanceToPoint(cam);
          if (l.cat === "rock" && dL > rockMax) continue;
          if (dL > 500 && this.occlusionTest(l, wb)) continue;
          const want1 = (l.err1 * K) / Math.max(1, dL) < tau * (l.lod === 1 ? 1.2 : 1);
          const n = want1 ? l.l1 : l.l0;
          this.want(n, prio(wb));
          if (!n.ready && !(want1 ? false : l.l1.ready)) leavesReady = false;
        }
        if (leavesReady) plan.push({ e, mode: "leaves" });
        else { plan.push({ e, mode: "block" }); s.fallbacks++; if (!partsReady) blockMissing = true; }
      }
      if (blockMissing && tileReady) { showTile(); tv.level = "tile"; s.tilesAsOne++; s.fallbacks++; continue; }
      tv.level = "blocks";
      this.horizon?.setHidden(tv.id, true);
      for (const t of tv.tile3) show(t.node, false);
      for (const { e, mode } of plan) {
        if (mode === "off") { for (const p of e.parts) show(p.node, false); for (const l of e.leaves) { show(l.l0, false); show(l.l1, false); } continue; }
        const dB = e.wbox.distanceToPoint(cam);
        if (mode === "block") {
          for (const l of e.leaves) { show(l.l0, false); show(l.l1, false); }
          for (const p of e.parts) { const far = p.cat === "rock" && dB > rockMax; show(p.node, !far); if (far) s.distanceCulled++; }
          s.blocksDrawn++;
          continue;
        }
        for (const p of e.parts) show(p.node, false);
        for (const l of e.leaves) {
          const wb = (l.wbox ??= l.box.clone().translate(tv.group.position));
          if (!this.frustum.intersectsBox(wb)) { show(l.l0, false); show(l.l1, false); s.frustumCulled++; continue; }
          const dL = wb.distanceToPoint(cam);
          if (l.cat === "rock" && dL > rockMax) { show(l.l0, false); show(l.l1, false); s.distanceCulled++; continue; }
          if (dL > 500 && this.occlusionTest(l, wb)) { show(l.l0, false); show(l.l1, false); s.occlusionCulled++; continue; }
          let want1 = (l.err1 * K) / Math.max(1, dL) < tau * (l.lod === 1 ? 1.2 : 1);
          if (!want1 && !l.l0.ready) want1 = true; // L0 ainda chegando: mostra L1 (já pronto)
          l.lod = want1 ? 1 : 0;
          show(l.l0, !want1); show(l.l1, want1);
          s.leavesDrawn++;
        }
      }
    }
    this.runOcclusion(cam, 72);
    if (this.horizon) { this.horizon.update(); s.horizonHidden = this.horizon.hiddenCount; }
    this.pump();
    if (this.now - this.evictT > 1000) { this.evictT = this.now; this.evict(); }
    let total = 0, ram = 0, vram = 0, drawn = 0;
    for (const tv of this.tiles.values()) for (const n of tv.nodes) { total++; if (n.mesh) { ram++; if (n.drawnOnce) vram++; if (n.mesh.visible) drawn++; } }
    Object.assign(s, { nodesTotal: total, nodesRam: ram, nodesVram: vram, nodesDrawn: drawn, nodesHidden: ram - drawn, queue: this.queue.length, inflight: this.inflight, bytes: this.stats.loadedBytes });
    this.onProgress?.(ram, ram + this.queue.length + this.inflight);
  }

  /** Para o carregamento inicial: nós pedidos ainda pendentes. */
  pending() { return this.queue.length + this.inflight + this.loadingTiles.size; }

  /** Descarta tudo (Modo Econômico prolongado): RAM e VRAM liberadas. */
  dispose() {
    for (const id of [...this.tiles.keys()]) this.dropTile(id);
    this.horizon?.dispose();
    this.group.removeFromParent();
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
  private mat: THREE.Material | null = null;
  static async load(url: string, origin: { x: number; z: number }, ids: string[], onBytes?: (got: number, total: number) => void) {
    const h = new Horizon(ids);
    // download com progresso real (bytes recebidos / Content-Length)
    const res = await fetch(url);
    const total = Number(res.headers.get("content-length") ?? 0);
    const reader = res.body?.getReader();
    let buf: ArrayBuffer;
    if (reader) {
      const parts: Uint8Array[] = []; let got = 0;
      for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); got += value.length; onBytes?.(got, total || got); }
      const all = new Uint8Array(got); let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
      buf = all.buffer;
    } else buf = await res.arrayBuffer();
    const gltf = await new GLTFLoader().parseAsync(buf, "");
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
    h.mat = mat;
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
  dispose() {
    this.group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    this.hiddenTex.dispose();
  }
}
