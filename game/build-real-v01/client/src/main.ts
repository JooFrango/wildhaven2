// Cliente 3D da Build Real v01: visualiza a simulação autoritativa do servidor Rust.
// NÃO existe controle direto do Hunter: o cliente só recebe snapshots.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SNAPSHOT_SCHEMA, type ContinentSummary, type Snapshot, type HunterSnap } from "./contracts";
import { TerrainView, latticeCenter } from "./terrain";
import { drawMinimap } from "./minimap";

const view = document.getElementById("view")!;
const statsEl = document.getElementById("stats")!;
const logEl = document.getElementById("log")!;
const mapEl = document.getElementById("map") as HTMLCanvasElement;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
view.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.5, 20000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a3326, 0.8);
scene.add(sun, hemi);
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const log = (s: string) => { const d = document.createElement("div"); d.textContent = s; logEl.prepend(d); };

async function main() {
  const continent: ContinentSummary = await (await fetch("/api/v1/continent")).json();
  const tiles = new Map(continent.tiles.map(t => [t.id, t]));
  const first: Snapshot = await (await fetch("/api/v1/snapshot")).json();
  if (first.schema !== SNAPSHOT_SCHEMA) throw new Error("contrato inesperado: " + first.schema);
  const h0 = first.hunters[0];
  const origin = latticeCenter(h0.x, h0.z); // origem de render fixa (precisão float32 ~mm a 10 km)
  const terrain = new TerrainView(origin, tiles);
  scene.add(terrain.physicsGroup, terrain.visualGroup);
  // Camada física (malha dos chunks WHP1) é depuração: tecla F alterna. Desligada por padrão
  // para não brigar em profundidade com os GLBs visuais. Não afeta a simulação.
  terrain.physicsGroup.visible = new URLSearchParams(location.search).has("fisica");
  addEventListener("keydown", ev => { if (ev.key === "f" || ev.key === "F") terrain.physicsGroup.visible = !terrain.physicsGroup.visible; });
  log(`Conectado. ${continent.summary.certified ?? "?"} hexes certificados de ${continent.summary.inCatalog ?? "?"}.`);

  // Hunter real do workshop com os clipes do próprio GLB.
  const gltf = await new GLTFLoader().loadAsync("/glb/hunter.glb");
  type HunterEntry = { obj: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>; current?: string; seenCrossings: number };
  const hunters = new Map<string, HunterEntry>();
  const ensureHunter = (h: HunterSnap) => {
    if (hunters.has(h.id)) return hunters.get(h.id)!;
    const obj = skeletonClone(gltf.scene);
    obj.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) o.frustumCulled = false; });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.6, 32), new THREE.MeshBasicMaterial({ color: 0x58a6ff, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; obj.add(ring);
    scene.add(obj);
    const mixer = new THREE.AnimationMixer(obj);
    const actions = new Map(gltf.animations.map(a => [a.name, mixer.clipAction(a)]));
    const e: HunterEntry = { obj, mixer, actions, seenCrossings: 0 };
    hunters.set(h.id, e);
    return e;
  };

  let snap = first, prev = first, recvAt = performance.now(), prevAt = recvAt;
  const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/v1/stream`);
  ws.onmessage = ev => {
    const s: Snapshot = JSON.parse(ev.data);
    if (s.schema !== SNAPSHOT_SCHEMA || s.tick === snap.tick) return;
    prev = snap; prevAt = recvAt; snap = s; recvAt = performance.now();
    terrain.syncPhysics(s.window);
    terrain.syncVisual(s.hunters);
  };
  ws.onclose = () => log("Conexão com o servidor encerrada.");
  terrain.syncPhysics(first.window);
  terrain.syncVisual(first.hunters);

  let frames = 0, fpsT = performance.now(), fps = 0;
  const clock = new THREE.Clock();
  let camInit = false;
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    // interpolação entre os dois últimos snapshots (somente visual)
    const span = Math.max(1, recvAt - prevAt), a = Math.min(1, (performance.now() - recvAt) / span);
    for (const h of snap.hunters) {
      const e = ensureHunter(h);
      const p = prev.hunters.find(x => x.id === h.id) ?? h;
      const x = p.x + (h.x - p.x) * a, y = p.y + (h.y - p.y) * a, z = p.z + (h.z - p.z) * a;
      e.obj.position.set(x - origin.x, y, z - origin.z);
      e.obj.rotation.y = h.heading;
      const want = h.clip === "Walking" ? "Walking" : undefined;
      if (want !== e.current) {
        if (e.current) e.actions.get(e.current)?.fadeOut(0.2);
        if (want) e.actions.get(want)?.reset().fadeIn(0.2).play();
        e.current = want;
      }
      e.mixer.update(dt);
      if (h.crossings.length > e.seenCrossings) {
        for (const c of h.crossings.slice(e.seenCrossings)) log(`${h.name}: ${c.from} → ${c.to} em (${c.x.toFixed(1)}, ${c.z.toFixed(1)}), passo ${c.step_m.toFixed(3)} m`);
        e.seenCrossings = h.crossings.length;
      }
    }
    const f = hunters.get(snap.hunters[0]?.id ?? "");
    if (f) {
      // a câmera segue o Hunter mantendo o deslocamento orbital escolhido pelo jogador
      if (!camInit) { controls.target.copy(f.obj.position); camera.position.copy(f.obj.position).add(new THREE.Vector3(18, 12, 18)); camInit = true; }
      const before = controls.target.clone();
      controls.target.lerp(f.obj.position, 0.15);
      camera.position.add(controls.target.clone().sub(before));
    }
    controls.update();
    // dia 2 h / noite 40 min a partir do relógio global
    const night = snap.clock.phase === "night";
    sun.intensity = night ? 0.15 : 2.2; hemi.intensity = night ? 0.25 : 0.8;
    scene.background = new THREE.Color(night ? 0x0b1020 : 0x8fb7d9);
    const ang = (snap.clock.phase === "day" ? snap.clock.phase_elapsed_s / 7200 : 1) * Math.PI;
    if (f) sun.position.set(f.obj.position.x + Math.cos(ang) * 800, Math.sin(ang) * 800 + 50, f.obj.position.z + 300);
    renderer.render(scene, camera);
    frames++;
    const now = performance.now();
    if (now - fpsT > 1000) { fps = frames * 1000 / (now - fpsT); frames = 0; fpsT = now; renderHud(); }
  });

  const renderHud = () => {
    const h = snap.hunters[0];
    const st = terrain.streamStats();
    const rows: [string, string][] = [
      ["Relógio", `${snap.clock.phase === "day" ? "Dia" : "Noite"} · ciclo ${snap.clock.cycle} · faltam ${(snap.clock.phase_remaining_s / 60).toFixed(1)} min`],
      ["Hunter", h ? `${h.name} — ${h.state}` : "—"],
      ["Hex", h?.tile_id ?? "—"],
      ["Posição global", h ? `${h.x.toFixed(2)}, ${h.y.toFixed(2)}, ${h.z.toFixed(2)}` : "—"],
      ["Velocidade", h ? `${h.speed_mps} m/s (clipe Walking)` : "—"],
      ["Travessias", String(h?.crossings.length ?? 0)],
      ["Distância", h ? `${h.distance_walked_m.toFixed(1)} m` : "—"],
      ["Servidor", `tick ${snap.tick} · ${snap.streaming.resident_chunks} chunks (${(snap.streaming.resident_bytes / 1048576).toFixed(1)} MiB), ${snap.streaming.pinned_chunks} pinned`],
      ["Cliente", `${st.physics.cached} chunks · ${st.visual.cached} GLBs de hex · ${fps.toFixed(0)} FPS medidos aqui`],
    ];
    statsEl.innerHTML = "";
    for (const [k, v] of rows) { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = k; dd.textContent = v; statsEl.append(dt, dd); }
    drawMinimap(mapEl, continent, snap.hunters);
  };
}
main().catch(e => { log("Erro: " + (e?.message ?? e)); console.error(e); });
