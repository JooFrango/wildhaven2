// Cliente da Build Real v01: apresenta a simulação autoritativa do servidor Rust.
// O jogador só COMANDA (explorar, caçar, recolher) e OBSERVA; não move Hunters nem dá golpes.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SNAPSHOT_SCHEMA, type ContinentSummary, type CreatureSnap, type HunterFull, type SnapshotFull } from "./contracts";
import { TerrainView, latticeCenter } from "./terrain";
import { drawMinimap } from "./minimap";
import { Entities } from "./entities";
import { TerrainOcclusion } from "./occlusion";
import { Hud, eventsText } from "./hud";
import { EconomicView } from "./economic";

const view = document.getElementById("view")!;
const statsEl = document.getElementById("stats")!;
const logEl = document.getElementById("log")!;
const mapEl = document.getElementById("map") as HTMLCanvasElement;
const params = new URLSearchParams(location.search);

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

const myLog: string[] = [];
const log = (s: string) => { myLog.unshift(s); myLog.length = Math.min(myLog.length, 6); };

/** Medições do apresentador ativo (para comparar 3D × pixel art; nada inventado). */
const perf = { mode: "3d", frameMs: 0, frames: 0, fps: 0, heapMB: null as number | null, drawCalls: 0, triangles: 0 };

async function main() {
  const continent: ContinentSummary = await (await fetch("/api/v1/continent")).json();
  const tiles = new Map(continent.tiles.map(t => [t.id, t]));
  const first: SnapshotFull = await (await fetch("/api/v1/snapshot")).json();
  if (first.schema !== SNAPSHOT_SCHEMA) throw new Error("contrato inesperado: " + first.schema);
  const origin = latticeCenter(first.game.village[0], first.game.village[1]);
  const terrain = new TerrainView(origin, tiles);
  const ents = new Entities(origin);
  scene.add(terrain.physicsGroup, terrain.visualGroup, ents.group);
  terrain.physicsGroup.visible = params.has("fisica");
  const occl = new TerrainOcclusion(terrain.heightLocal);
  const eco = new EconomicView(document.body, (x, z) => terrain.sampleGlobal(x, z));
  let economic = false;
  const setMode = (on: boolean) => {
    economic = on;
    renderer.domElement.hidden = on;
    eco.canvas.hidden = !on;
    perf.mode = on ? "pixel" : "3d";
    perf.frameMs = 0;
    log(on ? "Modo Econômico: apresentação pixel art (a simulação continua idêntica no servidor)" : "Modo 3D");
  };
  (document.getElementById("modo") as HTMLButtonElement).onclick = () => setMode(!economic);
  addEventListener("keydown", ev => {
    if (ev.key === "f" || ev.key === "F") terrain.physicsGroup.visible = !terrain.physicsGroup.visible;
    if (ev.key === "e" || ev.key === "E") setMode(!economic);
  });
  (window as any).__wildhavenSetMode = setMode; // usado pelo benchmark headless

  let snap = first, prev = first, recvAt = performance.now(), prevAt = recvAt;
  let follow = first.hunters[0]?.id ?? "";
  const hud = new Hud(document.getElementById("painel")!, continent, id => (follow = id), log);
  hud.selected = follow;
  hud.bindExplore(() => snap);
  const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/v1/stream`);
  ws.onmessage = ev => {
    const s: SnapshotFull = JSON.parse(ev.data);
    if (s.schema !== SNAPSHOT_SCHEMA || s.tick === snap.tick) return;
    prev = snap; prevAt = recvAt; snap = s; recvAt = performance.now();
    terrain.syncPhysics(s.window);
    if (!economic) terrain.syncVisual(s.hunters.filter(h => h.alive && h.activity !== "na_vila" || h.id === follow));
  };
  ws.onclose = () => log("Conexão com o servidor encerrada.");
  terrain.syncPhysics(first.window);
  terrain.syncVisual(first.hunters.filter(h => h.id === follow));
  if (params.get("modo") === "economico") setMode(true);

  const clock = new THREE.Clock();
  let camInit = false, fpsT = performance.now(), hudT = 0;
  renderer.setAnimationLoop(() => {
    const t0 = performance.now();
    const dt = clock.getDelta();
    const span = Math.max(1, recvAt - prevAt), a = Math.min(1, (t0 - recvAt) / span);
    const fh = snap.hunters.find(h => h.id === follow) ?? snap.hunters[0];
    if (economic) {
      if (fh) eco.draw(snap, { x: fh.x, z: fh.z }, t0);
    } else {
      const prevH = new Map(prev.hunters.map(h => [h.id, h as HunterFull]));
      const prevC = new Map(prev.game.creatures.map(c => [c.id, c as CreatureSnap]));
      ents.syncHunters(snap.hunters, prevH, a, dt);
      ents.syncCreatures(snap.game.creatures, prevC, a, dt);
      ents.syncWagons(snap.game.wagons);
      ents.syncCamps(snap.game.camps, terrain.heightLocal);
      ents.syncTraps(snap.game.traps, terrain.heightLocal);
      ents.syncTracks(snap.game.tracks, (x, z) => terrain.sampleGlobal(x, z)?.h ?? null);
      // occlusion culling conservador contra o relevo (atores animados)
      for (const h of snap.hunters) { const e = ents.hunters.get(h.id); if (e) e.obj.userData.wantVisible = h.activity !== "embarcado"; }
      for (const e of ents.creatures.values()) e.obj.userData.wantVisible = true;
      occl.update(camera, [...ents.hunters.values(), ...ents.creatures.values()].map(e => e.obj), t0);
      const f = fh && ents.hunters.get(fh.id)?.obj;
      if (f) {
        if (!camInit) { controls.target.copy(f.position); camera.position.copy(f.position).add(new THREE.Vector3(18, 12, 18)); camInit = true; }
        const before = controls.target.clone();
        controls.target.lerp(f.position, 0.15);
        camera.position.add(controls.target.clone().sub(before));
      }
      controls.update();
      const night = snap.clock.phase === "night";
      sun.intensity = night ? 0.15 : 2.2; hemi.intensity = night ? 0.25 : 0.8;
      scene.background = new THREE.Color(night ? 0x0b1020 : 0x8fb7d9);
      const ang = (snap.clock.phase === "day" ? snap.clock.phase_elapsed_s / 7200 : 1) * Math.PI;
      if (f) sun.position.set(f.position.x + Math.cos(ang) * 800, Math.sin(ang) * 800 + 50, f.position.z + 300);
      renderer.render(scene, camera);
      perf.drawCalls = renderer.info.render.calls;
      perf.triangles = renderer.info.render.triangles;
    }
    const ft = performance.now() - t0;
    perf.frameMs = perf.frameMs ? perf.frameMs * 0.95 + ft * 0.05 : ft;
    perf.frames++;
    if (t0 - fpsT > 1000) {
      perf.fps = (perf.frames * 1000) / (t0 - fpsT); perf.frames = 0; fpsT = t0;
      perf.heapMB = (performance as any).memory ? (performance as any).memory.usedJSHeapSize / 1048576 : null;
      (window as any).__wildhavenPerf = { ...perf, culled: occl.culled, tested: occl.tested, materialAudit: ents.materialAudit, ecoFrameMs: eco.frameMsAvg };
    }
    if (t0 - hudT > 500) { hudT = t0; renderHud(); }
  });

  const renderHud = () => {
    const h = snap.hunters.find(x => x.id === follow) ?? snap.hunters[0];
    const st = terrain.streamStats();
    const rows: [string, string][] = [
      ["Relógio", `${snap.clock.phase === "day" ? "Dia" : "Noite"} · ciclo ${snap.clock.cycle} · faltam ${(snap.clock.phase_remaining_s / 60).toFixed(1)} min`],
      ["Seguindo", h ? `${h.name} — ${h.tile_id} (${h.x.toFixed(1)}, ${h.z.toFixed(1)})` : "—"],
      ["Criaturas", `${snap.game.creatures.length} na janela detalhada · ${snap.game.tracks.length} pegadas azuis`],
      ["Servidor", `tick ${snap.tick} · ${snap.streaming.resident_chunks} chunks (${(snap.streaming.resident_bytes / 1048576).toFixed(1)} MiB)`],
      ["Cliente", `${perf.mode} · ${perf.fps.toFixed(0)} FPS · quadro ${perf.frameMs.toFixed(2)} ms · ${st.visual.cached} GLBs de hex`],
      ["Culling", economic ? "—" : `oclusão ${occl.culled}/${occl.tested} atores · ${perf.drawCalls} draw calls · ${(perf.triangles / 1000).toFixed(0)} k tri`],
    ];
    statsEl.innerHTML = "";
    for (const [k, v] of rows) { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = k; dd.textContent = v; statsEl.append(dt, dd); }
    logEl.innerHTML = "";
    for (const line of [...myLog, ...eventsText(snap)]) { const d = document.createElement("div"); d.textContent = line; logEl.append(d); }
    hud.render(snap);
    drawMinimap(mapEl, continent, snap.hunters);
  };
}
main().catch(e => { log("Erro: " + (e?.message ?? e)); console.error(e); });
