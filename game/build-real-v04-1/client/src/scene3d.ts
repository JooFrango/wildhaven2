// Cena 3D da V03: o apresentador 3D da V02 (mesmo céu, fog, luz, relevo, vegetação, capim, atores, clima)
// encapsulado para poder ser SUSPENSO (Econômico / Segundo Plano: nenhum quadro, nenhum streaming) e
// DESCARTADO por inteiro (geometrias, materiais, texturas e contexto WebGL liberados).
// Diferenças de execução (não de aparência): sombras atualizadas a no máximo 30 Hz; mapas do quadro anterior
// montados por mensagem; nenhuma alocação de vetores no caminho do quadro; contagem de objetos simulados,
// em RAM, em VRAM, desenhados, ocultos e descartados.
import * as THREE from "three";
import type { HunterFull } from "./contracts";
import { Atmosphere, CLEAR, type WeatherView } from "./atmosphere";
import { VisualWorld } from "./visual";
import { Vegetation } from "./vegetation";
import { Actors } from "./actors";
import type { StrategyCamera } from "./camera";
import { WeatherFx, waterMaterial } from "./weatherfx";
import { Village } from "./village";
import { GrassField } from "./grass";
import type { GraphicsSettings } from "./settings";
import type { Perf } from "./perf";
import type { HeightIndex } from "./heights";
import { latticeCenter } from "./heights";
import type { Shared } from "./main";
import type { Ui } from "./ui";

export class Scene3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly atm: Atmosphere;
  readonly world: VisualWorld;
  readonly veg: Vegetation;
  readonly actors: Actors;
  readonly village: Village;
  readonly fx: WeatherFx;
  readonly grass: GrassField;
  portraitUrl: string | null = null;
  private clock = new THREE.Clock();
  private frustum = new THREE.Frustum();
  private pv = new THREE.Matrix4();
  private focusV = new THREE.Vector3();
  private streamT = 0;
  private dynT = 0;
  private shadowT = 0;
  private resScale: number;
  private running = false;
  private suspended = false;
  private disposed = false;
  private stallSince = 0;
  private readonly ORIGINAL: boolean;
  private readonly NOFOG: boolean;
  private readonly camfix: number[] | undefined;
  private onResize = () => this.applySize();

  constructor(private host: HTMLElement, readonly camera: THREE.PerspectiveCamera, private cam: StrategyCamera, private heights: HeightIndex, private S: Shared, private settings: GraphicsSettings, private perf: Perf, params: URLSearchParams) {
    const r = new THREE.WebGLRenderer({ antialias: settings.antialias, powerPreference: "high-performance", reversedDepthBuffer: true, stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = settings.shadows !== "off";
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.shadowMap.autoUpdate = false; // V03: atualização seletiva (≤ 30 Hz), ver frame()
    r.info.autoReset = false;
    this.renderer = r;
    host.appendChild(r.domElement);
    this.scene.background = new THREE.Color(0x87a9c8);
    this.resScale = settings.resolutionScale;
    this.applySize();
    addEventListener("resize", this.onResize);
    this.ORIGINAL = params.get("comparar") === "original";
    this.NOFOG = params.get("fog") === "0" || this.ORIGINAL;
    this.camfix = params.get("camfix")?.split(",").map(Number);
    if (params.get("hud") === "0") document.getElementById("ui")!.style.display = "none";
    this.atm = new Atmosphere(this.scene, settings);
    this.world = new VisualWorld(S.origin, S.continent.tiles, settings, heights);
    this.world.waterMaterial = waterMaterial();
    this.veg = new Vegetation(S.origin, settings, this.world);
    this.actors = new Actors(S.origin, settings);
    this.village = new Village(S.origin, this.actors);
    this.fx = new WeatherFx();
    this.grass = new GrassField(this.world, settings);
    perf.attach(r);
    (r as any).__whScene = this.scene;
  }

  private applySize() {
    this.renderer.setPixelRatio(Math.min(this.settings.maxPixelRatio, devicePixelRatio) * this.resScale);
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
  }
  applySettings() {
    this.resScale = this.settings.resolutionScale;
    this.atm.applyShadows(); this.renderer.shadowMap.enabled = this.settings.shadows !== "off"; this.renderer.shadowMap.needsUpdate = true; this.applySize();
  }

  /** Etapas 2–4 do carregamento (terrenos, criaturas, Hunters), com progresso real. */
  async init(progress: (stage: number, frac: number | null, label: string) => void, initial: boolean) {
    const S = this.S, scene = this.scene;
    if (this.ORIGINAL) {
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const gl = new GLTFLoader(), orig = new THREE.Group(); orig.name = "originais"; scene.add(orig);
      const ids = new Set(["HV_01"]);
      for (const t of S.continent.tiles) { const c = latticeCenter(t.x, t.z); if (Math.hypot(c.x - S.origin.x, c.z - S.origin.z) < 6000) ids.add(t.id); }
      for (const id of ids) {
        const t = S.continent.tiles.find(x => x.id === id)!; const c = latticeCenter(t.x, t.z);
        const g = await gl.loadAsync(`/glb/terrain/${id}`).catch(() => null); if (!g) continue;
        g.scene.position.set(c.x - S.origin.x, 0, c.z - S.origin.z); g.scene.name = "original:" + id; orig.add(g.scene);
      }
      for (const f of ["phase_1.glb", "hv_01_forest.glb"]) { const g = await gl.loadAsync(`/world/hunters-village-v01/models/${f}`).catch(() => null); if (g) { g.scene.position.set(28145.825623 - S.origin.x, 0, -3750 - S.origin.z); orig.add(g.scene); } }
      (window as any).__wildhavenOriginais = [...ids];
    } else scene.add(this.world.group, this.veg.group, this.grass.group, this.village.group);
    scene.add(this.actors.group, this.fx.points);
    // ---- terrenos: horizonte (bytes reais), metadados dos hexes próximos e os nós de relevo da primeira vista
    progress(2, 0, "Carregando terrenos: horizonte do continente (272 hexes)");
    if (!this.ORIGINAL) await this.world.loadHorizon("/v02/horizon/horizonte-272-v01.glb", (got, total) => progress(2, 0.4 * (got / total), `Carregando terrenos: horizonte ${(got / 1048576).toFixed(1)}/${(total / 1048576).toFixed(1)} MB`)).catch(e => console.warn("horizonte", e));
    const fh = S.snap.hunters.find(h => h.id === S.follow) ?? S.snap.hunters[0];
    const focus0 = new THREE.Vector3((fh?.x ?? S.origin.x) - S.origin.x, fh?.y ?? 900, (fh?.z ?? S.origin.z) - S.origin.z);
    if (initial) this.cam.target.copy(focus0);
    this.cam.update(0, focus0, null); this.camera.updateMatrixWorld();
    const vel = new THREE.Vector3();
    for (let i = 0; i < 400; i++) {
      this.world.stream(this.cam.target, vel);
      this.world.update(this.camera, this.renderer.domElement.height);
      const ready = this.world.stats.nodesRam, wanted = ready + this.world.pending();
      progress(2, 0.4 + 0.6 * (wanted ? ready / wanted : 0), `Carregando terrenos: ${this.world.tiles.size} hexes, ${ready}/${wanted} blocos de relevo`);
      if (this.world.tiles.size >= Math.min(3, S.continent.tiles.length) && this.world.pending() === 0 && ready > 0) break;
      await new Promise(r => setTimeout(r, 50));
    }
    progress(2, 1, "Terrenos prontos");
    // ---- criaturas: vegetação (protótipos) e modelos das criaturas visíveis
    progress(3, 0, "Preparando criaturas e vegetação");
    await this.veg.init().catch(e => console.warn("vegetação", e));
    this.veg.stream(this.cam.target);
    const near = S.snap.game.creatures.slice(0, 64);
    const species = [...new Set(near.map(c => c.species))];
    let done = 0;
    await Promise.all(species.map(sp => this.actors.preload(sp).catch(() => {}).then(() => progress(3, ++done / Math.max(1, species.length), `Preparando criaturas: ${done}/${species.length} espécies`))));
    progress(3, 1, "Criaturas prontas");
    // ---- Hunters: modelo animado (105 clipes) e retrato
    progress(4, 0, "Sincronizando Hunters");
    await this.actors.template("/glb/hunter.glb").catch(() => null);
    progress(4, 0.6, "Sincronizando Hunters: retrato");
    this.portraitUrl = await renderPortrait(this.renderer, this.actors).catch(() => null);
    try { if (this.portraitUrl) localStorage.setItem("wildhaven.v04.retrato", this.portraitUrl); } catch { /* sem armazenamento */ }
    this.village.load().catch(e => console.warn("vila", e));
    progress(4, 1, "Hunters sincronizados");
  }

  startLoop(ui: () => Ui) {
    if (this.disposed) return;
    this.running = true; this.suspended = false;
    this.clock.getDelta();
    this.renderer.setAnimationLoop(() => this.frame(ui()));
  }
  stopLoop() { this.running = false; this.renderer.setAnimationLoop(null); }
  /** Suspensão: sem quadros e sem streaming (nada é baixado em Econômico / Segundo Plano). */
  suspend() { this.stopLoop(); this.suspended = true; }
  resume() { this.suspended = false; }

  /** Tempo que o hex do Hunter seguido está sem relevo próprio pronto (0 se pronto). */
  regionStalledMs() {
    const fh = this.S.snap.hunters.find(h => h.id === this.S.follow);
    const tid = ((this.S as any).livreTile as string | null | undefined) ?? fh?.tile_id;
    const tv = tid ? this.world.tiles.get(tid) : undefined;
    const ok = !!tv && tv.tile3.every(t => t.node.ready);
    if (ok || !fh) { this.stallSince = 0; return 0; }
    if (!this.stallSince) this.stallSince = performance.now();
    return performance.now() - this.stallSince;
  }
  tasks() { return { hexesCarregando: this.world.stats.loading, nosNaFila: this.world.stats.queue, nosBaixando: this.world.stats.inflight }; }
  streamingStats() {
    const w = this.world.stats, a = this.actors.stats;
    return {
      relevo: { nos: w.nodesTotal, emRAM: w.nodesRam, emVRAM: w.nodesVram, desenhados: w.nodesDrawn, ocultos: w.nodesHidden, descartados: w.nodesUnloaded, cancelados: w.canceled, fila: w.queue, baixando: w.inflight, fallbacks: w.fallbacks, MB: w.loadedBytes / 1048576, atualizacoesPuladas: w.updatesSkipped },
      criaturas: { simuladas: a.simulated, criadas: a.created, naoCriadas: a.notCreated, liberadas: a.released, visiveis: a.visible },
      vegetacaoMB: this.veg.bytes / 1048576,
    };
  }

  private frame(ui: Ui) {
    if (!this.running) return;
    const S = this.S, tf = performance.now(), camera = this.camera, settings = this.settings;
    const dt = Math.min(0.1, this.clock.getDelta());
    const snap = S.snap, prev = S.prev;
    const span = Math.max(1, S.recvAt - S.prevAt), a = Math.min(1, (tf - S.recvAt) / span);
    const simNow = snap.sim_time_s + Math.min(1, (tf - S.recvAt) / 1000) * ((snap.sim_time_s - prev.sim_time_s) / Math.max(0.001, span / 1000));
    const fh = snap.hunters.find(h => h.id === S.follow) ?? snap.hunters[0];
    const fa = fh ? this.actors.hunters.get(fh.id) : undefined;
    const lv = (S as any).livre as { x: number; y: number; z: number } | null | undefined;
    const focus = lv ? this.focusV.set(lv.x, lv.y, lv.z) : fa?.ready ? this.focusV.copy(fa.obj.position) : fh ? this.focusV.set(fh.x - S.origin.x, fh.y, fh.z - S.origin.z) : null;
    const tgt = fh?.target_creature != null && fh.activity === "combatendo" ? this.actors.creatures.get(fh.target_creature)?.obj.position ?? null : null;
    const cf = this.camfix;
    if (cf && cf.length === 6) { camera.position.set(cf[0], cf[1], cf[2]); camera.lookAt(cf[3], cf[4], cf[5]); camera.far = 60000; camera.near = 1; camera.updateProjectionMatrix(); this.cam.target.set(cf[3], cf[4], cf[5]); }
    else this.cam.update(dt, focus, tgt);
    camera.updateMatrixWorld();
    this.pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this.pv);
    if (tf - this.streamT > 400 && !this.suspended) {
      this.streamT = tf;
      this.world.stream(this.cam.target, this.cam.velocity);
      this.veg.stream(this.cam.target);
      const tile = S.continent.tiles.find(t => t.id === ((S as any).livreTile ?? fh?.tile_id));
      if (tile) this.atm.setBiome(tile.biome, fh!.y);
    }
    const w: WeatherView = ((snap.game as any).weather?.[S.follow] as WeatherView | undefined) ?? CLEAR;
    this.atm.weather = w;
    this.atm.update(dt, snap.clock, this.cam.target, camera);
    this.scene.fog = this.NOFOG ? null : this.atm.fog;
    const vh = this.renderer.domElement.height;
    this.world.update(camera, vh);
    this.veg.update(camera, vh, tf);
    this.grass.update(this.cam.target, camera, tf);
    this.actors.simTime = simNow;
    this.actors.viewK = vh / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const ground = (x: number, z: number) => this.heights.heightAt(x, z, "max");
    this.actors.sync(snap.hunters as HunterFull[], S.prevH, snap.game.creatures, S.prevC, a, dt, simNow, camera.position, ground, (o, b) => this.world.occlusionTest(o, b), this.frustum);
    this.actors.syncWagons(snap.game.wagons, snap.hunters as HunterFull[], dt, camera.position);
    this.actors.syncCamps(snap.game.camps, ground);
    this.actors.syncTraps(snap.game.traps, ground, dt);
    this.actors.syncTracks(snap.game.tracks, ground, tf);
    this.village.update(camera, dt);
    this.fx.update(camera.position, w.kind, w.intensity, settings.particles);
    this.village.night = this.atm.night;
    // sombras: no máximo 30 atualizações por segundo (a 60 FPS, metade dos passes de sombra)
    if (this.renderer.shadowMap.enabled && tf - this.shadowT >= 33) { this.shadowT = tf; this.renderer.shadowMap.needsUpdate = true; }
    this.renderer.info.reset();
    this.perf.beginGpu();
    this.renderer.render(this.scene, camera);
    this.perf.endGpu();
    this.perf.frame(performance.now() - tf, { world: this.world.stats, veg: this.veg.stats, actors: this.actors.stats, grass: this.grass.stats });
    if (settings.dynamicResolution && tf - this.dynT > 1500) {
      this.dynT = tf;
      const ms = this.perf.gpuOrFrameMs();
      const next = ms > 19 ? Math.max(0.5, this.resScale - 0.1) : ms < 12 ? Math.min(settings.resolutionScale, this.resScale + 0.05) : this.resScale;
      if (Math.abs(next - this.resScale) > 0.01) { this.resScale = next; this.applySize(); }
      this.perf.resScale = this.resScale;
    }
    void ui;
  }

  /** Descarte completo (RAM e VRAM): geometrias, materiais, texturas, alvos e o contexto WebGL. */
  dispose() {
    this.stopLoop(); this.disposed = true;
    removeEventListener("resize", this.onResize);
    this.world.dispose();
    const mats = new Set<THREE.Material>(), texs = new Set<THREE.Texture>();
    this.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) for (const mt of Array.isArray(m.material) ? m.material : [m.material]) { mats.add(mt); for (const v of Object.values(mt)) if ((v as THREE.Texture)?.isTexture) texs.add(v as THREE.Texture); }
    });
    mats.forEach(m => m.dispose()); texs.forEach(t => t.dispose());
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

/** Retrato do Hunter: render real do GLB (cabeça/ombros) num alvo fora da tela, uma vez. */
async function renderPortrait(r: THREE.WebGLRenderer, actors: Actors): Promise<string | null> {
  const g = await actors.template("/glb/hunter.glb");
  const { clone } = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const obj = clone(g.scene);
  const sc = new THREE.Scene();
  sc.background = new THREE.Color(0x2a2219);
  sc.add(new THREE.HemisphereLight(0xffe8c8, 0x302418, 1.4));
  const key = new THREE.DirectionalLight(0xffd7a0, 2.6); key.position.set(1.5, 2.5, 2.5); sc.add(key);
  const rim = new THREE.DirectionalLight(0x9fc4ff, 1.4); rim.position.set(-2, 2, -2); sc.add(rim);
  sc.add(obj);
  const mixer = new THREE.AnimationMixer(obj);
  const clip = g.animations.find(a => a.name === "pvp12_guard") ?? g.animations[0];
  if (clip) { mixer.clipAction(clip).play(); mixer.update(0.8); }
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj), h = box.max.y - box.min.y;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  let headBone: THREE.Object3D | undefined; obj.traverse(o => { if (o.name === "Head") headBone = o; });
  const head = headBone ? headBone.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y + h * 0.8, (box.min.z + box.max.z) / 2);
  head.y += 0.06;
  cam.position.copy(head).add(new THREE.Vector3(0.22, 0.02, 0.62)); cam.lookAt(head.x, head.y - 0.08, head.z);
  const rt = new THREE.WebGLRenderTarget(160, 160, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  r.setRenderTarget(rt); r.render(sc, cam); r.setRenderTarget(null);
  const px = new Uint8Array(160 * 160 * 4);
  r.readRenderTargetPixels(rt, 0, 0, 160, 160, px);
  rt.dispose();
  const c = document.createElement("canvas"); c.width = c.height = 160;
  const ctx = c.getContext("2d")!, img = ctx.createImageData(160, 160);
  for (let y = 0; y < 160; y++) img.data.set(px.subarray((159 - y) * 640, (160 - y) * 640), y * 640);
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}
