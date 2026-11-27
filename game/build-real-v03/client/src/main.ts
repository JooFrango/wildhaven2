// Cliente da Build Real V03: apresenta a simulação autoritativa do servidor Rust (o jogador só COMANDA e OBSERVA).
// Mesma aparência e interface da V02; arquitetura de execução nova:
// - UM laço por vez (3D, pixel art ou nenhum), controlado por `Loops`; a interface atualiza num temporizador
//   próprio de 4 Hz (desacoplado do quadro), com retorno imediato de cliques e ordens;
// - Segundo Plano: aba oculta/minimizada ⇒ nenhum quadro (3D e pixel art parados), sem streaming, sem
//   partículas, sem interface; o servidor passa a enviar diferenças a cada 5 s ou em acontecimento importante;
//   ao voltar, ressincronização completa;
// - Modo Econômico sem NENHUM recurso 3D: não cria renderizador, não baixa GLBs; vindo do 3D, o 3D é suspenso
//   na hora e DESCARTADO (RAM e VRAM) após 60 s contínuos no Econômico;
// - WebSocket incremental (wire.ts) com ressincronização; o servidor ajusta a frequência ao modo;
// - telas de carregamento originais (build real/loading-screen/v02) com progresso REAL por etapa.
import * as THREE from "three";
import { SNAPSHOT_SCHEMA, type ContinentSummary, type CreatureSnap, type HunterFull, type SnapshotFull } from "./contracts";
import { paletteKey } from "./atmosphere";
import { HeightIndex, latticeCenter } from "./heights";
import { loadCreatureCatalog } from "./actors";
import { StrategyCamera } from "./camera";
import { EconomicView } from "./economic";
import { Ui } from "./ui";
import { loadSettings, saveSettings, type GraphicsSettings } from "./settings";
import { Perf, buildReport, downloadJson } from "./perf";
import { WireState } from "./wire";
import { Loading, sceneForBiome } from "./loading";
import type { Scene3D } from "./scene3d";

const params = new URLSearchParams(location.search);
const settings: GraphicsSettings = loadSettings();
const view = document.getElementById("view")!;
const loading = new Loading(document.body, params.get("cena"));
const ECO_DISPOSE_MS = 60_000;
const ECO_FPS = [12, 15, 20];

/** Estado de apresentação compartilhado pelos laços. */
export interface Shared {
  snap: SnapshotFull; prev: SnapshotFull; recvAt: number; prevAt: number;
  prevH: Map<string, HunterFull>; prevC: Map<number, CreatureSnap>;
  follow: string; origin: { x: number; z: number }; continent: ContinentSummary;
}

async function waitHealth(onTry: (n: number) => void) {
  for (let n = 1; ; n++) {
    onTry(n);
    try { const r = await fetch("/api/v1/health", { cache: "no-store" }); if (r.ok && (await r.text()).trim() === "ok") return; } catch { /* servidor ainda subindo */ }
    await new Promise(r => setTimeout(r, Math.min(1000, 150 * n)));
  }
}

async function main() {
  const t0 = performance.now();
  // ---------------------------------------------------------------- 1. servidor
  loading.stage(0, null, "Inicializando servidor");
  await waitHealth(n => n > 1 && loading.stage(0, null, `Inicializando servidor (tentativa ${n})`));
  // ---------------------------------------------------------------- 2. mundo (continente, catálogo, 1º snapshot pelo WebSocket)
  loading.stage(1, 0, "Carregando mundo");
  const continent: ContinentSummary = await (await fetch("/api/v1/continent")).json();
  loading.stage(1, 1 / 3, "Carregando mundo: catálogo de espécies");
  const gameplay = await loadCreatureCatalog().catch(() => null);
  void gameplay;
  loading.stage(1, 2 / 3, "Carregando mundo: estado da simulação");
  const wire = new WireState();
  const net = { ws: null as WebSocket | null, connected: false, lostAt: 0, reconnects: 0 };
  let onSnap: (s: SnapshotFull) => void = () => {};
  const firstSnap = new Promise<SnapshotFull>(resolve => { onSnap = resolve; });
  const modeName = () => (document.hidden ? "fundo" : economic ? "eco" : "3d");
  const send = (o: unknown) => { if (net.ws?.readyState === WebSocket.OPEN) net.ws.send(JSON.stringify(o)); };
  let economic = params.get("modo") === "economico" || settings.profile === "economico";
  let focusId = "";
  const connect = () => {
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/v1/stream`);
    net.ws = ws;
    ws.onopen = () => { net.connected = true; send({ modo: modeName() }); if (focusId) send({ foco: focusId }); if (wire.state) send({ resync: true }); };
    ws.onmessage = ev => {
      const s = wire.receive(ev.data);
      if (wire.needResync) { wire.needResync = false; wire.resyncs++; send({ resync: true }); return; }
      if (s) onSnap(s as SnapshotFull);
    };
    ws.onclose = () => {
      net.connected = false; net.lostAt = performance.now(); net.reconnects++;
      // recuperação de sessão: tela de carregamento se a queda passar de 1,5 s
      setTimeout(() => { if (!net.connected) { loading.show(sceneForBiome(currentBiome()), "Recuperando a sessão com o servidor"); loading.reason = "sessao"; } }, 1500);
      setTimeout(connect, Math.min(5000, 500 * net.reconnects));
    };
  };
  connect();
  const first = await firstSnap;
  if (first.schema !== SNAPSHOT_SCHEMA) throw new Error("contrato inesperado: " + first.schema);
  const origin = latticeCenter(first.game.village[0], first.game.village[1]);
  const heights = new HeightIndex(origin, continent.tiles);
  heights.available = await fetch("/visual/index.json").then(r => (r.ok ? r.json() : null)).then(j => (j ? new Set<string>(j.tiles) : null)).catch(() => null);
  focusId = first.hunters[0]?.id ?? ""; send({ foco: focusId });
  const S: Shared = { snap: first, prev: first, recvAt: performance.now(), prevAt: performance.now(), prevH: new Map(), prevC: new Map(), follow: first.hunters[0]?.id ?? "", origin, continent };
  onSnap = s => {
    if (s.tick === S.snap.tick) return;
    S.prev = S.snap; S.prevAt = S.recvAt; S.snap = s; S.recvAt = performance.now();
    // mapas do quadro anterior montados UMA vez por mensagem (a V02 montava a cada quadro)
    S.prevH = new Map(S.prev.hunters.map(h => [h.id, h as HunterFull]));
    S.prevC = new Map(S.prev.game.creatures.map(c => [c.id, c as CreatureSnap]));
    // só a tela da sessão termina com a chegada de dados; a de região espera o relevo (antes o motivo era zerado
    // a cada mensagem e a tela "Carregando terrenos da região" nunca mais se fechava)
    if (loading.reason === "sessao") { loading.hide(); loading.reason = ""; }
  };
  const currentBiome = () => { const fh = S.snap.hunters.find(h => h.id === S.follow); return continent.tiles.find(t => t.id === fh?.tile_id)?.biome ?? ""; };
  loading.remember(currentBiome());

  // ---------------------------------------------------------------- câmera persistente (sobrevive ao descarte do 3D)
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 60000);
  const ground = (x: number, z: number) => heights.heightAt(x, z, "max");
  const cam = new StrategyCamera(camera, view, ground);
  const f0 = first.hunters.find(h => h.id === S.follow) ?? first.hunters[0];
  cam.target.set((f0?.x ?? origin.x) - origin.x, f0?.y ?? 900, (f0?.z ?? origin.z) - origin.z);
  const cp = params.get("cam")?.split(",").map(Number);
  if (cp && cp.length >= 2) { cam.zoomTo(cp[0]); (cam as any).wantPitch = (cam as any).pitch = (cp[1] * Math.PI) / 180; if (cp[2] !== undefined) (cam as any).wantYaw = (cam as any).yaw = (cp[2] * Math.PI) / 180; (cam as any).dist = cp[0]; }

  const perf = new Perf();
  const eco = new EconomicView(document.body, heights);
  let scene3d: Scene3D | null = null;
  let scene3dLoading: Promise<Scene3D> | null = null;
  let ecoSince = 0;
  const loops = { kind: "none" as "none" | "3d" | "pixel", ecoTimer: 0, ecoNext: 0 };
  const uiState = { timer: 0 };

  /** Cria e inicializa a cena 3D (relevo, horizonte, vegetação, Hunters) com progresso real. */
  const ensure3D = async (initial: boolean): Promise<Scene3D> => {
    if (scene3d) return scene3d;
    if (scene3dLoading) return scene3dLoading;
    scene3dLoading = (async () => {
      const { Scene3D } = await import("./scene3d");
      const s = new Scene3D(view, camera, cam, heights, S, settings, perf, params);
      let slow = 0;
      if (!initial) slow = window.setTimeout(() => loading.show(sceneForBiome(currentBiome()), "Preparando o mundo 3D"), 400);
      await s.init((stage, frac, label) => loading.stage(stage, frac, label), initial);
      clearTimeout(slow);
      if (!initial) loading.hide();
      scene3d = s; scene3dLoading = null;
      ui.setPortrait(s.portraitUrl);
      return s;
    })();
    return scene3dLoading;
  };

  // ---------------------------------------------------------------- laços (nunca simultâneos)
  const stopLoops = () => {
    scene3d?.stopLoop();
    clearTimeout(loops.ecoTimer); loops.ecoTimer = 0;
    loops.kind = "none";
  };
  const ecoInterval = () => 1000 / (ECO_FPS.includes(settings.ecoFps) ? settings.ecoFps : 15);
  const ecoTick = () => {
    loops.ecoTimer = 0;
    if (loops.kind !== "pixel" || document.hidden) return;
    const tf = performance.now();
    const fh = S.snap.hunters.find(h => h.id === S.follow) ?? S.snap.hunters[0];
    if (fh) {
      // relevo compacto do hex do Hunter e vizinhos (sem GLB)
      if (tf - ecoStreamAt > 1000) { ecoStreamAt = tf; for (const t of heights.near(fh.x - origin.x, fh.z - origin.z, 4200)) heights.load(t.id); const t = continent.tiles.find(x => x.id === fh.tile_id); if (t) eco.biomeKey = paletteKey(t.biome); }
      if (eco.draw(S.snap, { x: fh.x, z: fh.z }, tf, origin, fh.id, 0)) perf.frame(performance.now() - tf, null);
    }
    // descarte do 3D após 60 s contínuos no Econômico
    if (scene3d && ecoSince && tf - ecoSince > ECO_DISPOSE_MS) { scene3d.dispose(); scene3d = null; perf.attach(null); ui.log("Recursos 3D descartados da memória (Modo Econômico há mais de 60 s)."); }
    loops.ecoNext = Math.max(loops.ecoNext + ecoInterval(), tf + 1);
    loops.ecoTimer = window.setTimeout(ecoTick, Math.max(0, loops.ecoNext - performance.now()));
  };
  let ecoStreamAt = 0;
  const startLoop = () => {
    stopLoops();
    if (document.hidden) { perf.mode = "suspenso"; return; }
    if (economic) {
      document.body.classList.add("economico");
      loops.kind = "pixel"; perf.mode = "pixel"; perf.targetMs = ecoInterval(); perf.pause(); loops.ecoNext = performance.now();
      view.hidden = true; eco.canvas.hidden = false;
      ecoTick();
    } else if (scene3d) {
      document.body.classList.remove("economico");
      loops.kind = "3d"; perf.mode = "3d"; perf.targetMs = 1000 / 60; perf.pause();
      view.hidden = false; eco.canvas.hidden = true;
      scene3d.startLoop(() => ui);
    }
  };
  const setMode = async (on: boolean) => {
    if (on === economic && (on || scene3d)) { startLoop(); return; }
    economic = on;
    send({ modo: modeName() });
    if (on) {
      ecoSince = performance.now();
      scene3d?.suspend();
      ui.log("Modo Econômico: pixel art; renderização 3D SUSPENSA (descartada após 60 s; simulação idêntica no servidor).");
      startLoop();
    } else {
      ecoSince = 0;
      stopLoops(); eco.canvas.hidden = true;
      await ensure3D(false);
      if (!economic) { scene3d!.resume(); startLoop(); ui.log("Modo 3D retomado."); }
    }
  };
  (window as any).__wildhavenSetMode = setMode;
  (window as any).__wildhavenCamera = cam;

  // ---------------------------------------------------------------- interface (temporizador próprio, 4 Hz)
  const ui = new Ui({
    continent, settings, perf,
    select: id => { S.follow = id; focusId = id; send({ foco: id }); cam.focusOn(); scene3d?.actors.setSelected(id); loading.remember(currentBiome()); },
    setEconomic: on => { void setMode(on); },
    applySettings: (s: GraphicsSettings) => {
      const needRenderer = s.antialias !== settings.antialias;
      Object.assign(settings, s); saveSettings(settings);
      scene3d?.applySettings();
      if (needRenderer) ui.toast("Antisserrilhado muda ao recarregar a página.");
      if (settings.profile === "economico" && !economic) void setMode(true);
      if (loops.kind === "pixel") { loops.ecoNext = performance.now(); }
    },
    camera: cam,
    portrait: async () => scene3d?.portraitUrl ?? cachedPortrait(),
    setVillagePhase: n => { scene3d?.village.load(n).then(() => ui.toast(`Vila: fase ${n} (apresentação; regra econômica pendente)`)).catch(() => {}); },
    focusVillage: () => { cam.focusOn(); const v = S.snap.hunters.find(h => h.activity === "na_vila"); if (v) { S.follow = v.id; focusId = v.id; send({ foco: v.id }); ui.selected = v.id; scene3d?.actors.setSelected(v.id); } },
    exportReport: () => downloadJson(`wildhaven-desempenho-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, buildReport(perf, (S.snap as any).server ?? null, settings, { rede: wireStats(), carregamento_s: perf.loadSeconds })),
  });
  ui.selected = S.follow;
  const uiTick = () => { if (!document.hidden) ui.frame(S.snap, performance.now()); };
  const startUi = () => { clearInterval(uiState.timer); uiState.timer = window.setInterval(uiTick, 250); uiTick(); };
  const wireStats = () => ({ conectado: net.connected, reconexoes: net.reconnects, completos: wire.fulls, deltas: wire.deltas, ressincronizacoes: wire.resyncs, bytesRecebidos: wire.bytes, ultimaMensagemBytes: wire.lastBytes });
  perf.extra = () => ({
    loops: { ativo: loops.kind, tresD: scene3d ? (loops.kind === "3d" ? "rodando" : "suspenso") : "descartado", pixel: loops.kind === "pixel" ? "rodando" : "parado", interface: document.hidden ? "suspensa" : "4 Hz", visibilidade: document.visibilityState },
    rede: wireStats(),
    economico: eco.stats,
    streaming: scene3d?.streamingStats() ?? null,
    alturasMB: heights.bytes / 1048576,
    tarefas: scene3d?.tasks() ?? { carregando: 0 },
  });
  // em Segundo Plano o `perf` não recebe quadros: publica por temporizador lento (sem custo visual)
  setInterval(() => { if (loops.kind === "none") perf.publish(); }, 2000);

  // ---------------------------------------------------------------- segundo plano
  // Segundo Plano > 60 s: o 3D suspenso também é DESCARTADO (RAM/VRAM), como no Econômico; volta com a tela de carregamento
  let hiddenSince = 0;
  const HIDDEN_DISPOSE_MS = 60_000;
  setInterval(() => { if (document.hidden && hiddenSince && scene3d && performance.now() - hiddenSince > HIDDEN_DISPOSE_MS) { scene3d.dispose(); scene3d = null; perf.attach(null); } }, 5000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenSince = performance.now();
      stopLoops(); scene3d?.suspend(); clearInterval(uiState.timer);
      perf.mode = "suspenso"; perf.pause();
      send({ modo: "fundo" });
    } else {
      hiddenSince = 0;
      send({ modo: modeName() }); send({ resync: true }); // estado completo ao voltar
      startUi();
      if (!economic) {
        if (scene3d) { scene3d.resume(); startLoop(); }
        else void ensure3D(false).then(s => { if (!economic && !document.hidden) { s.resume(); startLoop(); } });
      } else startLoop();
    }
  });

  // ---------------------------------------------------------------- carregamento inicial
  if (economic) {
    loading.stage(2, 0, "Carregando terrenos (grade de alturas)");
    const near = heights.near(f0.x - origin.x, f0.z - origin.z, 4200);
    let done = 0;
    await Promise.all(near.map(t => heights.load(t.id).then(() => loading.stage(2, ++done / near.length, `Carregando terrenos: ${done}/${near.length} hexes`))));
    loading.stage(3, 1, "Preparando criaturas: não se aplica no Modo Econômico (sem modelos 3D)");
    loading.stage(4, 1, "Sincronizando Hunters");
  } else {
    await ensure3D(true);
  }
  loading.stage(5, 0.5, "Preparando interface");
  startUi();
  loading.stage(5, 1, "Pronto");
  perf.loadSeconds = (performance.now() - t0) / 1000;
  loading.hide();
  startLoop();
  if (economic) ecoSince = performance.now();
  (window as any).__wildhavenPerf = perf.public;
  perf.publish();

  // carregamentos prolongados de região (ex.: Hunter seguido chega a um hex sem relevo pronto): tela de carregamento
  setInterval(() => {
    if (document.hidden || economic || !scene3d || loops.kind !== "3d") return;
    const slow = scene3d.regionStalledMs();
    if (slow > 1500 && !loading.visible) { loading.show(sceneForBiome(currentBiome()), "Carregando terrenos da região"); loading.reason = "regiao"; }
    else if (slow === 0 && loading.reason === "regiao") { loading.hide(); loading.reason = ""; }
  }, 500);
}

function cachedPortrait(): string | null {
  try { return localStorage.getItem("wildhaven.v03.retrato"); } catch { return null; }
}

main().catch(e => { console.error(e); loading.error("Erro: " + (e?.message ?? e)); });
