// Cliente da Build Real V02: apresenta a simulação autoritativa do servidor Rust.
// O jogador só COMANDA e OBSERVA; não move Hunters nem dá golpes. A qualidade gráfica e a câmera
// nunca alteram a simulação (o servidor simula todos os Hunters e criaturas fora da câmera).
import * as THREE from "three";
import { SNAPSHOT_SCHEMA, type ContinentSummary, type CreatureSnap, type HunterFull, type SnapshotFull } from "./contracts";
import { Atmosphere, CLEAR, paletteKey, type WeatherView } from "./atmosphere";
import { VisualWorld, latticeCenter } from "./visual";
import { Vegetation } from "./vegetation";
import { Actors, loadCreatureCatalog } from "./actors";
import { StrategyCamera } from "./camera";
import { WeatherFx, waterMaterial } from "./weatherfx";
import { Village } from "./village";
import { GrassField } from "./grass";
import { EconomicView } from "./economic";
import { Ui } from "./ui";
import { loadSettings, saveSettings, PROFILES, type GraphicsSettings } from "./settings";
import { Perf } from "./perf";

const params = new URLSearchParams(location.search);
const settings: GraphicsSettings = loadSettings();
const view = document.getElementById("view")!;
const loading = document.getElementById("carregando")!;
const setLoading = (txt: string, frac: number) => { loading.querySelector(".msg")!.textContent = txt; (loading.querySelector(".barra i") as HTMLElement).style.width = `${Math.round(frac * 100)}%`; };

let renderer: THREE.WebGLRenderer;
function makeRenderer() {
  const r = new THREE.WebGLRenderer({ antialias: settings.antialias, powerPreference: "high-performance", reversedDepthBuffer: true, stencil: false });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  r.shadowMap.enabled = settings.shadows !== "off";
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.info.autoReset = false;
  return r;
}
renderer = makeRenderer();
view.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87a9c8);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 60000);
let resScale = settings.resolutionScale;
const applySize = () => {
  renderer.setPixelRatio(Math.min(settings.maxPixelRatio, devicePixelRatio) * resScale);
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
};
applySize();
addEventListener("resize", applySize);

async function main() {
  const t0 = performance.now();
  setLoading("Conectando ao servidor autoritativo…", 0.05);
  const continent: ContinentSummary = await (await fetch("/api/v1/continent")).json();
  const first: SnapshotFull = await (await fetch("/api/v1/snapshot")).json();
  if (first.schema !== SNAPSHOT_SCHEMA) throw new Error("contrato inesperado: " + first.schema);
  const origin = latticeCenter(first.game.village[0], first.game.village[1]);
  const atm = new Atmosphere(scene, settings);
  const world = new VisualWorld(origin, continent.tiles, settings);
  world.waterMaterial = waterMaterial();
  const veg = new Vegetation(origin, settings, world);
  const actors = new Actors(origin, settings);
  const village = new Village(origin, actors);
  const fx = new WeatherFx();
  const grass = new GrassField(world, settings);
  scene.add(world.group, veg.group, grass.group, actors.group, village.group, fx.points);
  const ground = (x: number, z: number) => world.heightAt(x, z, "max");
  const cam = new StrategyCamera(camera, renderer.domElement, ground);
  const gameplay = await loadCreatureCatalog().catch(() => null);
  setLoading("Carregando horizonte do continente (272 hexes)…", 0.15);
  await world.loadHorizon("/v02/horizon/horizonte-272-v01.glb").catch(e => console.warn("horizonte", e));
  setLoading("Carregando vegetação e protótipos…", 0.3);
  await veg.init().catch(e => console.warn("vegetação", e));
  village.load().catch(e => console.warn("vila", e));

  let snap = first, prev = first, recvAt = performance.now(), prevAt = recvAt;
  let follow = first.hunters[0]?.id ?? "";
  const eco = new EconomicView(document.body);
  let economic = false;
  const perf = new Perf(renderer);
  (renderer as any).__whScene = scene;
  const ui = new Ui({
    continent, settings, perf,
    select: id => { follow = id; cam.focusOn(); actors.setSelected(id); },
    setEconomic: on => setMode(on),
    applySettings: (s: GraphicsSettings) => {
      const needRenderer = s.antialias !== settings.antialias;
      Object.assign(settings, s); saveSettings(settings); resScale = settings.resolutionScale;
      atm.applyShadows(); renderer.shadowMap.enabled = settings.shadows !== "off"; applySize();
      if (needRenderer) ui.toast("Antisserrilhado muda ao recarregar a página.");
      if (settings.profile === "economico" && !economic) setMode(true);
    },
    camera: cam,
    portrait: () => renderPortrait(renderer, actors),
    setVillagePhase: n => { village.load(n).then(() => ui.toast(`Vila: fase ${n} (apresentação; regra econômica pendente)`)).catch(() => {}); },
    focusVillage: () => { cam.focusOn(); const v = snap.hunters.find(h => h.activity === "na_vila"); if (v) { follow = v.id; ui.selected = v.id; actors.setSelected(v.id); } },
  });
  ui.selected = follow; actors.setSelected(follow);
  const setMode = (on: boolean) => {
    economic = on;
    renderer.domElement.hidden = on;
    eco.canvas.hidden = !on;
    perf.mode = on ? "pixel" : "3d";
    ui.log(on ? "Modo Econômico: apresentação pixel art; renderização 3D SUSPENSA (simulação idêntica no servidor)." : "Modo 3D retomado.");
    if (on) { renderer.setAnimationLoop(null); ecoLoop(); } else { cancelAnimationFrame(ecoRaf); renderer.setAnimationLoop(frame); }
  };
  (window as any).__wildhavenSetMode = setMode;
  (window as any).__wildhavenCamera = cam;

  const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/v1/stream`);
  ws.onmessage = ev => {
    const s: SnapshotFull = JSON.parse(ev.data);
    if (s.schema !== SNAPSHOT_SCHEMA || s.tick === snap.tick) return;
    prev = snap; prevAt = recvAt; snap = s; recvAt = performance.now();
  };
  ws.onclose = () => ui.log("Conexão com o servidor encerrada.");

  // primeira carga: espera o hex do Hunter seguido e vizinhos
  setLoading("Carregando o hex inicial e vizinhos…", 0.45);
  const f0 = first.hunters.find(h => h.id === follow) ?? first.hunters[0];
  const focus0 = new THREE.Vector3((f0?.x ?? origin.x) - origin.x, f0?.y ?? 900, (f0?.z ?? origin.z) - origin.z);
  cam.target.copy(focus0);
  // parâmetros de captura/benchmark: ?cam=distância,inclinação,rumo (graus)
  const cp = params.get("cam")?.split(",").map(Number);
  if (cp && cp.length >= 2) { cam.zoomTo(cp[0]); (cam as any).wantPitch = (cam as any).pitch = (cp[1] * Math.PI) / 180; if (cp[2] !== undefined) (cam as any).wantYaw = (cam as any).yaw = (cp[2] * Math.PI) / 180; (cam as any).dist = cp[0]; }
  for (let i = 0; i < 60 && world.tiles.size < Math.min(3, continent.tiles.length); i++) { world.stream(focus0, new THREE.Vector3()); await new Promise(r => setTimeout(r, 250)); setLoading(`Carregando hexes… ${world.tiles.size}`, 0.45 + 0.08 * world.tiles.size); }
  veg.stream();
  perf.loadSeconds = (performance.now() - t0) / 1000;
  loading.classList.add("fim"); setTimeout(() => (loading.hidden = true), 900);
  if (params.get("modo") === "economico" || settings.profile === "economico") setMode(true);

  const clock = new THREE.Clock();
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4();
  let streamT = 0, dynT = 0, ecoRaf = 0;
  const weatherOf = (s: SnapshotFull): WeatherView => ((s.game as any).weather?.[follow] as WeatherView | undefined) ?? CLEAR;

  const frame = () => {
    const tf = performance.now();
    const dt = Math.min(0.1, clock.getDelta());
    const span = Math.max(1, recvAt - prevAt), a = Math.min(1, (tf - recvAt) / span);
    const simNow = snap.sim_time_s + Math.min(1, (tf - recvAt) / 1000) * ((snap.sim_time_s - prev.sim_time_s) / Math.max(0.001, span / 1000));
    const fh = snap.hunters.find(h => h.id === follow) ?? snap.hunters[0];
    const fa = fh ? actors.hunters.get(fh.id) : undefined;
    const focus = fa?.ready ? fa.obj.position.clone() : fh ? new THREE.Vector3(fh.x - origin.x, fh.y, fh.z - origin.z) : null;
    // enquadramento de combate: criatura-alvo do Hunter seguido
    const tgt = fh?.target_creature != null && fh.activity === "combatendo" ? actors.creatures.get(fh.target_creature)?.obj.position ?? null : null;
    cam.update(dt, focus, tgt);
    camera.updateMatrixWorld();
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pv);
    if (tf - streamT > 400) {
      streamT = tf;
      // os hexes de TODOS os Hunters fora da vila ficam carregados; a câmera prioriza o seguido
      world.stream(cam.target, cam.velocity);
      veg.stream();
      const tile = continent.tiles.find(t => t.id === fh?.tile_id);
      if (tile) atm.setBiome(tile.biome, fh!.y);
    }
    const w = weatherOf(snap);
    atm.weather = w;
    atm.update(dt, snap.clock, cam.target, camera);
    world.update(camera, renderer.domElement.height);
    veg.update(camera, renderer.domElement.height, tf);
    grass.update(cam.target, camera, tf);
    const prevH = new Map(prev.hunters.map(h => [h.id, h as HunterFull]));
    const prevC = new Map(prev.game.creatures.map(c => [c.id, c as CreatureSnap]));
    actors.simTime = simNow;
    actors.sync(snap.hunters, prevH, snap.game.creatures, prevC, a, dt, simNow, camera.position, ground, (o, b) => world.occlusionTest(o, b), frustum);
    actors.syncWagons(snap.game.wagons, snap.hunters, dt, camera.position);
    actors.syncCamps(snap.game.camps, ground);
    actors.syncTraps(snap.game.traps, ground, dt);
    actors.syncTracks(snap.game.tracks, ground, tf);
    village.update(camera, dt);
    fx.update(camera.position, w.kind, w.intensity, settings.particles);
    village.night = atm.night;
    renderer.info.reset();
    perf.beginGpu();
    renderer.render(scene, camera);
    perf.endGpu();
    perf.frame(performance.now() - tf, { world: world.stats, veg: veg.stats, actors: actors.stats, grass: grass.stats });
    // resolução dinâmica: busca 60 FPS (16,7 ms) sem descer de 50% da resolução
    if (settings.dynamicResolution && tf - dynT > 1500) {
      dynT = tf;
      const ms = perf.gpuOrFrameMs();
      const next = ms > 19 ? Math.max(0.5, resScale - 0.1) : ms < 12 ? Math.min(settings.resolutionScale, resScale + 0.05) : resScale;
      if (Math.abs(next - resScale) > 0.01) { resScale = next; applySize(); }
      perf.resScale = resScale;
    }
    ui.frame(snap, tf);
  };
  const ecoLoop = () => {
    const tf = performance.now();
    const fh = snap.hunters.find(h => h.id === follow) ?? snap.hunters[0];
    if (tf - streamT > 1000 && fh) { streamT = tf; world.stream(new THREE.Vector3(fh.x - origin.x, fh.y, fh.z - origin.z), new THREE.Vector3()); const t = continent.tiles.find(x => x.id === fh.tile_id); if (t) eco.biomeKey = paletteKey(t.biome); }
    if (fh) eco.draw(snap, { x: fh.x, z: fh.z }, tf, world, origin, fh.id);
    perf.frame(performance.now() - tf, null);
    ui.frame(snap, tf);
    ecoRaf = requestAnimationFrame(ecoLoop);
  };
  renderer.setAnimationLoop(frame);
  (window as any).__wildhavenPerf = perf.public;
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
  // a caixa inclui a espada erguida: a cabeça fica pela altura do osso Head
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
main().catch(e => { console.error(e); setLoading("Erro: " + (e?.message ?? e), 1); });
void PROFILES;
