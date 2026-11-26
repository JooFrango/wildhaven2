// Streaming de terreno no cliente.
// - Camada FÍSICA: chunks WHP1 da janela autoritativa (snapshot.window), que o servidor
//   calcula em torno de CADA Hunter — o cliente espelha essa janela, nunca a câmera.
// - Camada VISUAL: GLBs reais dos hexes perto dos Hunters (LRU por bytes).
// Ambas usam o TileStreamer (LRU com pinning) de build real/continental/src/streamer.mjs.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TileStreamer } from "@continental/streamer.mjs";
import { makePhysicsChunkLoader } from "@continental/physics-loader.mjs";
import type { WindowChunk, ContinentTile } from "./contracts";

const R = 2500;
export function latticeCenter(x: number, z: number) {
  const r = Math.round(z / (1.5 * R)), q = Math.round(x / (Math.sqrt(3) * R) - r / 2);
  return { x: Math.sqrt(3) * R * (q + r / 2), z: 1.5 * R * r };
}

interface ChunkMeta { ix: number; iz: number; url: string; bytes: number; sha256: string; uncompressedBytes: number; rawSha256?: string; x0: number; z0: number; res: number; }
interface Decoded { nx: number; nz: number; x0: number; z0: number; res: number; baseY: number; heights: Float32Array; water: Float32Array; blocked: Uint8Array; cover: Uint8Array; }

export class TerrainView {
  readonly physicsGroup = new THREE.Group();
  readonly visualGroup = new THREE.Group();
  private indexes = new Map<string, Promise<{ base: URL; index: { chunks: ChunkMeta[] } }>>();
  // Os pacotes vêm só de tiles que o SERVIDOR liberou (certificado técnico); o índice
  // WHP1 em si é sempre certified:false, por isso allowUnverified fica restrito a isso.
  private loader = makePhysicsChunkLoader({ allowUnverified: true });
  private physics = new TileStreamer({ loader: (id: string) => this.loadChunk(id), maxBytes: 96 * 1024 * 1024, maxConcurrent: 6 });
  private visual = new TileStreamer({ loader: (id: string) => this.loadGlb(id), maxBytes: 160 * 1024 * 1024, maxConcurrent: 2 });
  private pinnedPhysics = new Set<string>();
  private pinnedVisual = new Set<string>();
  private gltf = new GLTFLoader();
  stats = { chunkErrors: 0, glbErrors: 0 };
  /** Chunks decodificados por célula de chunk global (vários hexes podem dividir a mesma). */
  private decoded = new Map<string, Decoded[]>();

  /** Amostra a física WHP1 já carregada (coordenadas GLOBAIS). Só apresentação. */
  sampleGlobal(x: number, z: number): { h: number; water: boolean; blocked: boolean } | null {
    const list = this.decoded.get(`${Math.floor(x / 256)}/${Math.floor(z / 256)}`);
    if (!list) return null;
    for (const d of list) {
      const i = Math.floor((x - d.x0) / d.res), j = Math.floor((z - d.z0) / d.res);
      if (i < 0 || j < 0 || i >= d.nx || j >= d.nz) continue;
      const k = j * d.nx + i, h = d.heights[k] + d.baseY;
      if (Number.isFinite(h)) return { h, water: Number.isFinite(d.water[k]), blocked: d.blocked[k] === 1 };
    }
    return null;
  }
  /** Mesma amostra em coordenadas de render (origem local). */
  heightLocal = (x: number, z: number) => this.sampleGlobal(x + this.origin.x, z + this.origin.z)?.h ?? null;

  constructor(private origin: { x: number; z: number }, private tiles: Map<string, ContinentTile>) {
    this.physicsGroup.name = "physics";
    this.visualGroup.name = "visual";
  }

  private tileIndex(tile: string) {
    if (!this.indexes.has(tile)) this.indexes.set(tile, this.loader.loadIndex(`/physics/${tile}-physics-v01/index.json`));
    return this.indexes.get(tile)!;
  }

  private async loadChunk(key: string) {
    const [tile, ix, iz] = key.split("/");
    const idx = await this.tileIndex(tile);
    const meta = idx.index.chunks.find(c => c.ix === Number(ix) && c.iz === Number(iz));
    if (!meta) throw new Error("chunk fora do índice " + key);
    const d: Decoded = await this.loader.loadChunk(idx, meta);
    const mesh = this.chunkMesh(d);
    mesh.name = key;
    this.physicsGroup.add(mesh);
    const ck = `${ix}/${iz}`;
    this.decoded.set(ck, [...(this.decoded.get(ck) ?? []), d]);
    return { value: mesh, bytes: d.heights.length * 10, dispose: (m: THREE.Mesh) => {
      this.physicsGroup.remove(m); m.geometry.dispose();
      const rest = (this.decoded.get(ck) ?? []).filter(x => x !== d);
      if (rest.length) this.decoded.set(ck, rest); else this.decoded.delete(ck);
    } };
  }

  private chunkMesh(d: Decoded) {
    const step = 2; // 1 vértice a cada 2 células (4 m); a física continua a 2 m no servidor
    const vx = Math.floor(d.nx / step) + 1, vz = Math.floor(d.nz / step) + 1;
    const pos = new Float32Array(vx * vz * 3), col = new Float32Array(vx * vz * 3);
    const valid = new Uint8Array(vx * vz);
    const c = new THREE.Color();
    for (let j = 0; j < vz; j++) for (let i = 0; i < vx; i++) {
      const ci = Math.min(d.nx - 1, i * step), cj = Math.min(d.nz - 1, j * step), k = cj * d.nx + ci, v = j * vx + i;
      const h = d.heights[k] + d.baseY;
      valid[v] = Number.isFinite(h) ? 1 : 0;
      pos[v * 3] = d.x0 + (ci + 0.5) * d.res - this.origin.x;
      pos[v * 3 + 1] = Number.isFinite(h) ? h : 0;
      pos[v * 3 + 2] = d.z0 + (cj + 0.5) * d.res - this.origin.z;
      if (Number.isFinite(d.water[k])) c.setRGB(0.18, 0.42, 0.72);
      else if (d.blocked[k]) c.setRGB(0.32, 0.28, 0.26);
      else if (d.cover[k] > 30) c.setRGB(0.26, 0.48, 0.24);
      else c.setRGB(0.55, 0.52, 0.40);
      col.set([c.r, c.g, c.b], v * 3);
    }
    const idx: number[] = [];
    for (let j = 0; j < vz - 1; j++) for (let i = 0; i < vx - 1; i++) {
      const a = j * vx + i, b = a + 1, e = a + vx, f = e + 1;
      if (valid[a] && valid[b] && valid[e] && valid[f]) idx.push(a, e, b, b, e, f);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.computeBoundingSphere(); // frustum culling correto por chunk
    return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.FrontSide }));
  }

  private async loadGlb(tile: string) {
    const t = this.tiles.get(tile);
    if (!t) throw new Error("tile desconhecido " + tile);
    const res = await fetch(`/glb/terrain/${tile}`);
    if (!res.ok) throw new Error("GLB HTTP " + res.status);
    const buf = await res.arrayBuffer();
    const gltf = await this.gltf.parseAsync(buf, "");
    const c = latticeCenter(t.x, t.z);
    gltf.scene.position.set(c.x - this.origin.x, 0, c.z - this.origin.z);
    gltf.scene.name = "glb:" + tile;
    gltf.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.frustumCulled = true; m.geometry.computeBoundingSphere(); } });
    this.visualGroup.add(gltf.scene);
    return { value: gltf.scene, bytes: buf.byteLength * 3, dispose: (s: THREE.Object3D) => { this.visualGroup.remove(s); s.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); }); } };
  }

  /** Espelha a janela autoritativa: pin no que está nela, libera o que saiu. */
  syncPhysics(window: WindowChunk[]) {
    const want = new Set(window.map(w => `${w.tile}/${w.ix}/${w.iz}`));
    for (const k of this.pinnedPhysics) if (!want.has(k)) { this.physics.release(k, "physics"); this.pinnedPhysics.delete(k); }
    for (const k of want) if (!this.pinnedPhysics.has(k)) {
      this.physics.pin(k, "physics"); this.pinnedPhysics.add(k);
      this.physics.ensure(k, "physics").catch(() => { this.stats.chunkErrors++; });
    }
  }

  /** GLBs visuais: hex de cada Hunter + vizinhos a menos de `radius` m do Hunter. */
  syncVisual(hunters: { x: number; z: number }[], radius = 2600) {
    const want = new Set<string>();
    for (const h of hunters) for (const t of this.tiles.values()) {
      const c = latticeCenter(t.x, t.z);
      if (Math.hypot(c.x - h.x, c.z - h.z) < radius + R) want.add(t.id);
    }
    for (const k of this.pinnedVisual) if (!want.has(k)) { this.visual.release(k, "visual"); this.pinnedVisual.delete(k); }
    for (const k of want) if (!this.pinnedVisual.has(k)) {
      this.visual.pin(k, "visual"); this.pinnedVisual.add(k);
      this.visual.ensure(k, "visual").catch(() => { this.stats.glbErrors++; });
    }
  }

  streamStats() { return { physics: this.physics.stats(), visual: this.visual.stats() }; }
}
