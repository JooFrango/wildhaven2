// Atores 3D da V02: Hunters (GLB PvE v01 com 105 clipes reais), criaturas (GLBs animados das espécies),
// carroças com rodas animadas, Dodarro e condutor, acampamentos, armadilhas e pegadas azuis instanciadas.
// Regras: nada de "postura T" (sempre há um clipe ativo), nada de escala para agachar nem rotação do
// modelo inteiro para cair. Poses que não existem como clipe (agachar, sentar, descansar) são POSES
// ESQUELETAIS PROVISÓRIAS criadas aqui (rotação de ossos), registradas como pendência de animação.
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { patchMaterial } from "./atmosphere";
import type { CampSnap, CreatureSnap, FootprintSnap, HunterFull, TrapSnap, WagonSnap } from "./contracts";
import type { GraphicsSettings } from "./settings";

export const HUNTER_URL = "/glb/hunter.glb";
/** LODs reais por espécie (LOD0/1/2 com os mesmos clipes), vindos de /api/v1/gameplay (especies[*].lods). */
export const CREATURE_LODS: Record<string, string[]> = {};
export async function loadCreatureCatalog() {
  const g = await (await fetch("/api/v1/gameplay")).json();
  for (const [id, sp] of Object.entries<any>(g.especies ?? {})) { CREATURE_LODS[id] = (sp.lods ?? [sp.asset]).filter(Boolean).map((p: string) => "/" + p.replace(/^\//, "")); sizeFromMass(id, sp.massaKg ?? 20); }
  return g;
}
const LOD_DIST = [28, 75]; // m (com histerese de 15%) — trocas de LOD de criatura
/** Altura aproximada (m) para o critério de tamanho projetado na criação preguiçosa (engenharia, PROVISÓRIO). */
const CREATURE_SIZE: Record<string, number> = { lobrapedra: 3, torvalho: 3, nharuk: 3, silvarano: 2, cavoru: 2, boscaranha: 1.5, folhisco: 1, tufrilo: 1 };
/** V04: altura das demais espécies estimada pela massa da ficha (catálogo de gameplay), PROVISÓRIO. */
export function sizeFromMass(id: string, kg: number) { if (!(id in CREATURE_SIZE)) CREATURE_SIZE[id] = Math.max(0.5, Math.min(6, 0.45 * Math.cbrt(kg))); }
const DODO_URL = "/assets/models/creatures/dodarro/dodarro_montaria_v02_blockout.glb";
const WAGON_URL = "/v02/models/carroca/carroca_v02.glb";
const CAMP_URL = "/v02/models/acampamento/acampamento_v02.glb";
const TRAP_URLS: Record<string, string> = { presa_de_ferro: "/v02/models/armadilhas/presa_de_ferro_v02.glb", laco_de_raiz: "/v02/models/armadilhas/laco_de_raiz_v02.glb" };

// ------------------------------------------------------------------ poses esqueléticas provisórias
type PoseSpec = Record<string, [number, number, number]>; // delta Euler (rad) no espaço local do osso
export const POSES: Record<string, { bones: PoseSpec; hipsDrop: number }> = {
  agachar: { hipsDrop: 0.32, bones: { LeftUpLeg: [-1.05, 0, 0], RightUpLeg: [-1.05, 0, 0], LeftLeg: [1.55, 0, 0], RightLeg: [1.55, 0, 0], LeftFoot: [-0.45, 0, 0], RightFoot: [-0.45, 0, 0], Spine: [0.38, 0, 0], Spine02: [0.22, 0, 0], neck: [-0.35, 0, 0] } },
  sentar: { hipsDrop: 0.42, bones: { LeftUpLeg: [-1.5, 0, 0.08], RightUpLeg: [-1.5, 0, -0.08], LeftLeg: [1.5, 0, 0], RightLeg: [1.5, 0, 0], Spine: [0.05, 0, 0], LeftArm: [0, 0, 1.1], RightArm: [0, 0, -1.1], LeftForeArm: [0, -0.6, 0], RightForeArm: [0, 0.6, 0] } },
  descansar: { hipsDrop: 0.55, bones: { LeftUpLeg: [-1.45, 0, 0.35], RightUpLeg: [-1.45, 0, -0.35], LeftLeg: [2.2, 0, 0], RightLeg: [2.2, 0, 0], Spine: [0.25, 0, 0], neck: [0.25, 0, 0], LeftArm: [0, 0, 1.2], RightArm: [0, 0, -1.2] } },
};
function poseClip(name: string, root: THREE.Object3D, spec: { bones: PoseSpec; hipsDrop: number }, breathe = true) {
  const tracks: THREE.KeyframeTrack[] = [];
  const times = breathe ? [0, 1.6, 3.2] : [0, 1];
  root.traverse(o => {
    const b = o as THREE.Bone;
    if (!b.isBone) return;
    const d = spec.bones[b.name];
    if (b.name === "Hips") {
      const p = b.position.clone();
      // a malha do workshop está em centímetros×0,01 no osso? usamos fração da altura do quadril
      const drop = p.y * spec.hipsDrop;
      const v: number[] = []; for (const t of times) { const k = breathe ? Math.sin((t / 3.2) * Math.PI * 2) * 0.004 * p.y : 0; v.push(p.x, p.y - drop + k, p.z); }
      tracks.push(new THREE.VectorKeyframeTrack(`${b.name}.position`, times, v));
    }
    if (!d) return;
    const q = b.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...d)));
    const v: number[] = []; for (const _ of times) v.push(q.x, q.y, q.z, q.w);
    tracks.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, v));
  });
  return new THREE.AnimationClip(name, times[times.length - 1], tracks);
}

// ------------------------------------------------------------------ mapeamento atividade → clipe
const WALK_MPS = 1.1733; // medido no clipe Walking (data/hunter-pve-v01-clip-speeds.json)
interface HunterAnimState { base: string; rate: number; once?: boolean }
function hunterBase(h: HunterFull, speed: number): HunterAnimState {
  if (!h.alive || h.activity === "morto") return { base: "combat_death", rate: 1, once: true };
  if (h.activity === "caido" || h.activity === "carregado") return { base: "combat_knockdown", rate: 1, once: true };
  if (h.activity === "embarcado" || h.activity === "conduzindo") return { base: "pose_sentar", rate: 1 };
  if (speed > 2.2) return { base: "hunter_run", rate: speed / 3.72 };
  if (speed > 0.15) return { base: "Walking", rate: speed / WALK_MPS };
  if (h.activity === "combatendo" || h.activity === "socorrendo") return { base: "pve1_b_sword_guard", rate: 1 };
  if (h.activity === "armando_armadilha") return { base: "pose_agachar", rate: 1 };
  if (h.activity === "descansando" || h.activity === "na_vila") return { base: h.activity === "descansando" ? "pose_descansar" : "pvp12_guard", rate: 1 };
  return { base: "pvp12_guard", rate: 1 };
}
const GESTURES: Record<string, string> = {
  golpe_leve: "pve1_c_sword_light", golpe_pesado: "pve1_c_sword_heavy", desvio_1: "pve1_b_sword_dodge_left", desvio_5: "pve1_b_sword_dodge_right", atingido: "combat_hit_light",
};

export interface Actor {
  obj: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>; base?: string; gesture?: { name: string; t: number };
  crouch?: THREE.AnimationAction; lastPos: THREE.Vector3; speed: number; box: THREE.Box3; ready: boolean; kind: string; accum: number; label?: string;
  lod?: number; swapping?: boolean;
}

export class Actors {
  readonly group = new THREE.Group();
  private loader = new GLTFLoader();
  private templates = new Map<string, Promise<GLTF>>();
  readonly hunters = new Map<string, Actor>();
  readonly creatures = new Map<number, Actor>();
  private wagons = new Map<string, { obj: THREE.Object3D; wheels: THREE.Object3D[]; last: THREE.Vector3; dodo?: Actor; driver?: Actor; cover?: THREE.Object3D }>();
  private camps = new Map<number, THREE.Object3D>();
  private traps = new Map<number, { obj: THREE.Object3D; mixer?: THREE.AnimationMixer; armed?: boolean; actions?: Map<string, THREE.AnimationAction> }>();
  private prints: THREE.InstancedMesh;
  private blobs: THREE.InstancedMesh;
  readonly materialAudit: Record<string, { total: number; doubleSided: number }> = {};
  stats = { mixersUpdated: 0, mixersSkipped: 0, actorsCulled: 0, creatureLods: [0, 0, 0], simulated: 0, created: 0, notCreated: 0, released: 0, visible: 0 };
  simTime = 0;
  /** V03: fator de projeção (px por metro a 1 m) do quadro atual — decide criação preguiçosa dos modelos. */
  viewK = 800;
  private farSince = new Map<number, number>();
  private sv = new THREE.Vector3();
  private sv2 = new THREE.Vector3();
  private sq = new THREE.Quaternion();
  private sm4 = new THREE.Matrix4();
  private boxSize = new THREE.Vector3(3, 3, 3);

  constructor(private origin: { x: number; z: number }, private settings: GraphicsSettings) {
    this.group.name = "atores";
    // pegadas: brilho azul (só as DESCOBERTAS chegam do servidor); somem sobre água (servidor não gera)
    const pg = new THREE.PlaneGeometry(0.34, 0.5).rotateX(-Math.PI / 2);
    const pm = new THREE.MeshBasicMaterial({ color: 0x4cc9ff, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, map: footprintTexture() });
    this.prints = new THREE.InstancedMesh(pg, pm, 900);
    this.prints.count = 0; this.prints.frustumCulled = false; this.prints.renderOrder = 2; this.prints.name = "pegadas";
    // sombra de contato barata (blob) sob cada ator
    const bm = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, color: 0x000000, opacity: 0.55 });
    this.blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), bm, 512);
    this.blobs.count = 0; this.blobs.frustumCulled = false; this.blobs.renderOrder = 1; this.blobs.name = "sombras-de-contato";
    this.group.add(this.prints, this.blobs);
  }

  /** V03: pré-carrega os modelos (todos os LODs) de uma espécie — usado na tela de carregamento. */
  preload(species: string) { return Promise.all((CREATURE_LODS[species] ?? []).map(u => this.template(u))); }

  template(url: string) {
    if (!this.templates.has(url)) {
      this.templates.set(url, this.loader.loadAsync(url).then(g => {
        const a = { total: 0, doubleSided: 0 };
        g.scene.traverse(o => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.castShadow = true; m.receiveShadow = true;
          for (const mat of Array.isArray(m.material) ? m.material : [m.material]) { a.total++; if (mat.side === THREE.DoubleSide) a.doubleSided++; patchMaterial(mat); }
        });
        this.materialAudit[url.split("/").pop()!] = a;
        return g;
      }));
    }
    return this.templates.get(url)!;
  }

  private spawn(url: string, kind: string, onReady: (a: Actor) => void, extraClips: (root: THREE.Object3D) => THREE.AnimationClip[] = () => []) {
    const a: Actor = { obj: new THREE.Group(), mixer: new THREE.AnimationMixer(new THREE.Group()), actions: new Map(), lastPos: new THREE.Vector3(), speed: 0, box: new THREE.Box3(), ready: false, kind, accum: 0 };
    this.template(url).then(g => {
      const obj = skeletonClone(g.scene);
      obj.traverse(o => {
        const sm = o as THREE.SkinnedMesh;
        if (sm.isSkinnedMesh) { sm.geometry.computeBoundingSphere(); if (sm.geometry.boundingSphere) sm.geometry.boundingSphere.radius *= 2; sm.frustumCulled = true; }
      });
      const mixer = new THREE.AnimationMixer(obj);
      const clips = [...g.animations, ...extraClips(obj)];
      a.obj = obj; a.mixer = mixer; a.actions = new Map(clips.map(c => [c.name, mixer.clipAction(c)])); a.ready = true;
      this.group.add(obj);
      onReady(a);
    }).catch(() => {});
    return a;
  }

  private hunterClips(root: THREE.Object3D) {
    const out = Object.entries(POSES).map(([n, s]) => poseClip("pose_" + n, root, s));
    // camada aditiva de agachamento sobre a caminhada (aproximação furtiva)
    const add = poseClip("pose_agachar_add", root, POSES.agachar, false);
    THREE.AnimationUtils.makeClipAdditive(add, 0, bindClip(root));
    out.push(add);
    return out;
  }

  /** Base contínua + gesto de combate por cima (golpe/desvio/impacto), com transições suaves. */
  private playHunter(a: Actor, st: HunterAnimState, h: HunterFull, simNow: number) {
    const want = a.actions.has(st.base) ? st.base : "pvp12_guard";
    if (want !== a.base) {
      const next = a.actions.get(want)!;
      next.reset(); next.setLoop(st.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); next.clampWhenFinished = !!st.once;
      next.enabled = true; next.setEffectiveWeight(1).fadeIn(0.25).play();
      if (a.base) a.actions.get(a.base)?.fadeOut(0.25);
      a.base = want;
    }
    a.actions.get(want)!.timeScale = THREE.MathUtils.clamp(st.rate, 0.3, 2.2);
    // agachado: camada aditiva (dobra joelhos e tronco), nunca escala do modelo
    if (!a.crouch) { a.crouch = a.actions.get("pose_agachar_add"); a.crouch?.setLoop(THREE.LoopRepeat, Infinity); a.crouch?.play(); a.crouch?.setEffectiveWeight(0); (a.crouch as any).blendMode = THREE.AdditiveAnimationBlendMode; }
    if (a.crouch) { const w = h.crouched && h.alive && h.activity !== "caido" ? 1 : 0; const cur = a.crouch.getEffectiveWeight(); a.crouch.setEffectiveWeight(cur + (w - cur) * 0.15); }
    // gesto disparado pelo servidor (anim/anim_t): toca uma vez se for recente
    const hx = h as HunterFull & { anim?: string; anim_t?: number };
    if (hx.anim && hx.anim_t !== undefined && simNow - hx.anim_t < 1.2 && (!a.gesture || a.gesture.t !== hx.anim_t)) {
      const clip = GESTURES[hx.anim];
      const act = clip ? a.actions.get(clip) : undefined;
      if (act && h.alive && h.activity !== "caido") {
        a.gesture = { name: clip, t: hx.anim_t };
        act.reset(); act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = false; act.setEffectiveWeight(1); act.fadeIn(0.08).play();
        a.actions.get(want)?.crossFadeTo(act, 0.08, false);
        const back = () => { a.mixer.removeEventListener("finished", back as any); if (a.base) { const b = a.actions.get(a.base)!; b.enabled = true; b.setEffectiveWeight(1); act.crossFadeTo(b, 0.2, false); } };
        a.mixer.addEventListener("finished", back as any);
      }
    }
  }

  private place(a: Actor, x: number, y: number, z: number, heading: number, dt: number) {
    const p = new THREE.Vector3(x - this.origin.x, y, z - this.origin.z);
    const sp = a.lastPos.lengthSq() ? a.lastPos.distanceTo(p) / Math.max(dt, 1e-3) : 0;
    a.speed += (Math.min(sp, 8) - a.speed) * Math.min(1, dt * 6);
    a.lastPos.copy(p);
    a.obj.position.copy(p);
    // rotação suave (sem estalo quando o servidor muda o rumo)
    const cur = a.obj.rotation.y, d = Math.atan2(Math.sin(heading - cur), Math.cos(heading - cur));
    a.obj.rotation.set(0, cur + d * Math.min(1, dt * 8), 0);
  }

  /** LOD de animação: mixers longe (ou ocultos) atualizam com menos frequência. */
  private tickMixer(a: Actor, dt: number, camPos: THREE.Vector3) {
    const d = a.obj.position.distanceTo(camPos);
    const q = this.settings.animationQuality;
    const every = !a.obj.visible ? 0.5 : d < (q === "alta" ? 80 : 50) ? 0 : d < 200 ? 1 / 20 : d < 600 ? 1 / 8 : 1 / 3;
    a.accum += dt;
    if (a.accum >= every) { a.mixer.update(a.accum); a.accum = 0; this.stats.mixersUpdated++; } else this.stats.mixersSkipped++;
  }

  sync(hunters: HunterFull[], prevH: Map<string, HunterFull>, creatures: CreatureSnap[], prevC: Map<number, CreatureSnap>, alpha: number, dt: number, simNow: number, camPos: THREE.Vector3, ground: (x: number, z: number) => number | null, occluded: (o: THREE.Object3D, b: THREE.Box3) => boolean, frustum: THREE.Frustum) {
    this.stats.mixersUpdated = 0; this.stats.mixersSkipped = 0; this.stats.actorsCulled = 0;
    const m4 = this.sm4; let nb = 0;
    const blob = (o: THREE.Object3D, r: number) => {
      if (nb >= this.blobs.instanceMatrix.count || !o.visible) return;
      const y = ground(o.position.x, o.position.z) ?? o.position.y;
      this.sq.identity(); this.sv.set(o.position.x, Math.max(y, o.position.y - 0.4) + 0.04, o.position.z); this.sv2.set(r, 1, r);
      m4.compose(this.sv, this.sq, this.sv2);
      this.blobs.setMatrixAt(nb++, m4);
    };
    const visibleTest = (a: Actor) => {
      a.box.setFromCenterAndSize(this.sv.copy(a.obj.position).setY(a.obj.position.y + 1), this.boxSize);
      const inF = frustum.intersectsBox(a.box);
      const occ = inF && a.obj.position.distanceTo(camPos) > 150 && occluded(a.obj, a.box);
      if (!inF || occ) this.stats.actorsCulled++;
      return inF && !occ;
    };
    for (const h of hunters) {
      let a = this.hunters.get(h.id);
      if (!a) { a = this.spawn(HUNTER_URL, "hunter", x => this.decorateHunter(x, h), r => this.hunterClips(r)); this.hunters.set(h.id, a); continue; }
      if (!a.ready) continue;
      const p = prevH.get(h.id) ?? h;
      this.place(a, p.x + (h.x - p.x) * alpha, p.y + (h.y - p.y) * alpha, p.z + (h.z - p.z) * alpha, h.heading, dt);
      const inside = h.activity === "embarcado";
      a.obj.visible = !inside && visibleTest(a);
      this.playHunter(a, hunterBase(h, a.speed), h, simNow);
      this.tickMixer(a, dt, camPos);
      blob(a.obj, 1.1);
    }
    const seen = new Set<number>();
    const now = performance.now();
    this.stats.simulated = creatures.length; this.stats.notCreated = 0;
    for (const c of creatures) {
      seen.add(c.id);
      let a = this.creatures.get(c.id);
      const lods = CREATURE_LODS[c.species];
      if (!lods?.length) continue;
      const d = Math.hypot(camPos.x - (c.x - this.origin.x), camPos.y - c.y, camPos.z - (c.z - this.origin.z));
      // V03: o modelo (esqueleto + mixer) só existe se a criatura ocupar ≥ 1,5 px na tela; some com histerese (10 s)
      const reach = (CREATURE_SIZE[c.species] ?? 1.2) * this.viewK / 1.5;
      if (!a) {
        if (d > reach) { this.stats.notCreated++; continue; }
        const lod = d < LOD_DIST[0] ? 0 : d < LOD_DIST[1] ? 1 : 2; a = this.spawn(lods[Math.min(lod, lods.length - 1)], c.species, () => {}); a.lod = lod; this.creatures.set(c.id, a); this.stats.created++; continue;
      }
      if (d > reach * 1.3) {
        const since = this.farSince.get(c.id) ?? now; this.farSince.set(c.id, since);
        if (now - since > 10000 && !a.swapping) { this.release(c.id, a); continue; }
      } else this.farSince.delete(c.id);
      if (!a.ready) continue;
      // LOD de criatura pela distância (histerese): troca a malha mantendo posição e o tempo do clipe
      const want = d < LOD_DIST[0] * (a.lod === 0 ? 1.15 : 1) ? 0 : d < LOD_DIST[1] * (a.lod === 1 ? 1.15 : 1) ? 1 : 2;
      if (want !== a.lod && !a.swapping && lods.length > 1) {
        a.swapping = true;
        const old = a;
        const t = old.base ? old.actions.get(old.base)?.time ?? 0 : 0;
        const nu = this.spawn(lods[Math.min(want, lods.length - 1)], c.species, n => {
          n.obj.position.copy(old.obj.position); n.obj.rotation.copy(old.obj.rotation); n.lastPos.copy(old.lastPos); n.speed = old.speed;
          if (old.base && n.actions.has(old.base)) { const act = n.actions.get(old.base)!; act.play(); act.time = t; n.base = old.base; }
          old.obj.removeFromParent();
          n.lod = want;
          this.creatures.set(c.id, n);
        });
        void nu;
        continue;
      }
      const p = prevC.get(c.id) ?? c;
      // V04: submersa na areia — o corpo afunda (até 75% da altura; o dorso ainda corta a areia); em voo o servidor já manda y com a altitude
      const cx = c as CreatureSnap & { meio?: string; alt?: number };
      const sink = cx.meio === "areia" ? Math.max(-(CREATURE_SIZE[c.species] ?? 1.2) * 0.75, cx.alt ?? 0) : 0;
      this.place(a, p.x + (c.x - p.x) * alpha, p.y + (c.y - p.y) * alpha + sink, p.z + (c.z - p.z) * alpha, c.heading, dt);
      a.obj.visible = visibleTest(a);
      const clip = creatureClip(a, c);
      if (clip !== a.base) {
        const next = a.actions.get(clip);
        if (next) { next.reset().setLoop(c.alive ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); next.clampWhenFinished = !c.alive; next.fadeIn(0.25).play(); if (a.base) a.actions.get(a.base)?.fadeOut(0.25); a.base = clip; }
      }
      if (a.base && c.alive && (c.clip === "walk" || c.clip === "run")) a.actions.get(a.base)!.timeScale = THREE.MathUtils.clamp(a.speed / (c.clip === "run" ? 6 : 1.6), 0.4, 2);
      this.tickMixer(a, dt, camPos);
      blob(a.obj, c.species === "lobrapedra" || c.species === "torvalho" || c.species === "nharuk" ? 2.2 : c.species === "silvarano" || c.species === "cavoru" ? 1.6 : 0.9);
    }
    for (const [id, a] of this.creatures) if (!seen.has(id)) this.release(id, a);
    this.stats.creatureLods = [0, 0, 0];
    let vis = 0;
    for (const a of this.creatures.values()) if (a.ready && a.obj.visible) { this.stats.creatureLods[a.lod ?? 0]++; vis++; }
    this.stats.visible = vis;
    this.blobs.count = nb; this.blobs.instanceMatrix.needsUpdate = true;
  }

  /** Libera o ator: para as ações e o mixer (o esqueleto clonado deixa de ser referenciado). */
  private release(id: number, a: Actor) {
    a.obj.removeFromParent();
    a.mixer.stopAllAction();
    a.mixer.uncacheRoot(a.obj);
    this.creatures.delete(id); this.farSince.delete(id);
    this.stats.released++;
  }

  private decorateHunter(a: Actor, h: HunterFull) {
    a.label = h.id;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.9, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: h.role === "socorrista" ? 0xf0a050 : 0xf2d27a, transparent: true, opacity: 0.0, depthWrite: false }));
    ring.position.y = 0.06; ring.name = "anel-selecao"; ring.renderOrder = 3;
    a.obj.add(ring);
  }
  setSelected(id: string) {
    for (const [hid, a] of this.hunters) { const r = a.obj.getObjectByName("anel-selecao") as THREE.Mesh | undefined; if (r) (r.material as THREE.MeshBasicMaterial).opacity = hid === id ? 0.85 : 0; }
  }

  syncWagons(list: WagonSnap[], hunters: HunterFull[], dt: number, camPos: THREE.Vector3) {
    for (const w of list) {
      let e = this.wagons.get(w.id);
      if (!e) {
        const obj = new THREE.Group(); obj.name = "carroca:" + w.id;
        const ent = { obj, wheels: [] as THREE.Object3D[], last: new THREE.Vector3() } as NonNullable<ReturnType<typeof this.wagons.get>>;
        this.template(WAGON_URL).then(g => {
          const m = g.scene.clone(true); obj.add(m);
          m.traverse(o => { if (/^roda/i.test(o.name)) ent.wheels.push(o); if (/lona/i.test(o.name)) ent.cover = o; });
        }).catch(() => {});
        // o blockout do Dodarro olha para +X (perfil publicado: bico à direita) — gira para +Z, à frente dos varais
        ent.dodo = this.spawn(DODO_URL, "dodarro", a => { a.obj.removeFromParent(); a.obj.rotation.y = -Math.PI / 2; a.obj.position.set(0, 0, 5.05); obj.add(a.obj); });
        // condutor (Chad/Nailon) sentado no banco — pose provisória "sentar"
        ent.driver = this.spawn(HUNTER_URL, "condutor", a => { a.obj.removeFromParent(); a.obj.position.set(0, 1.05, 1.25); obj.add(a.obj); const act = a.actions.get("pose_sentar"); act?.play(); }, r => this.hunterClips(r));
        this.group.add(obj); this.wagons.set(w.id, ent); e = ent;
      }
      const p = new THREE.Vector3(w.x - this.origin.x, w.y, w.z - this.origin.z);
      const moved = e.last.lengthSq() ? e.last.distanceTo(p) : 0;
      e.last.copy(p);
      e.obj.position.copy(p);
      const cur = e.obj.rotation.y, d = Math.atan2(Math.sin(w.heading - cur), Math.cos(w.heading - cur));
      e.obj.rotation.y = cur + d * Math.min(1, dt * 4);
      for (const wh of e.wheels) wh.rotation.x += moved / 0.55; // rodas giram com a distância percorrida (raio 0,55 m)
      if (e.dodo?.ready && !e.dodo.actions.size) {
        // blockout sem rig/clipes (pendência registrada): só um balanço leve de passada enquanto puxa
        e.dodo.obj.position.y = moved > 0.002 ? Math.abs(Math.sin(performance.now() * 0.009)) * 0.07 : 0;
      }
      if (e.dodo?.ready && e.dodo.actions.size) {
        const walk = e.dodo.actions.get("walk") ?? e.dodo.actions.get("Walk") ?? [...e.dodo.actions.values()][0];
        const idle = e.dodo.actions.get("idle") ?? e.dodo.actions.get("Idle");
        const want = moved > 0.002 ? walk : idle ?? walk;
        if (want && e.dodo.base !== want.getClip().name) { want.reset().fadeIn(0.3).play(); if (e.dodo.base) e.dodo.actions.get(e.dodo.base)?.fadeOut(0.3); e.dodo.base = want.getClip().name; }
        this.tickMixer(e.dodo, dt, camPos);
      }
      if (e.driver?.ready) {
        const drv = hunters.find(h => h.id === w.driver);
        e.driver.obj.visible = !!drv && (drv.activity === "conduzindo");
        this.tickMixer(e.driver, dt, camPos);
      }
    }
  }

  syncCamps(list: CampSnap[], ground: (x: number, z: number) => number | null) {
    for (const c of list) {
      if (this.camps.has(c.id)) continue;
      const g = new THREE.Group(); g.name = "acampamento:" + c.id;
      const y = ground(c.x - this.origin.x, c.z - this.origin.z) ?? 0;
      g.position.set(c.x - this.origin.x + 4, y, c.z - this.origin.z + 4);
      this.template(CAMP_URL).then(t => g.add(t.scene.clone(true))).catch(() => {});
      // fogueira: luz pontual pequena e barata (sem sombra)
      const fire = new THREE.PointLight(0xff8a3a, 6, 18, 2); fire.position.set(0, 0.8, 0); fire.name = "fogueira"; g.add(fire);
      this.group.add(g); this.camps.set(c.id, g);
    }
    for (const [id, g] of this.camps) {
      if (!list.some(c => c.id === id)) { g.removeFromParent(); this.camps.delete(id); continue; }
      const f = g.getObjectByName("fogueira") as THREE.PointLight | undefined;
      if (f) f.intensity = 5 + Math.sin(performance.now() * 0.013) * 0.8 + Math.sin(performance.now() * 0.031) * 0.6;
    }
  }

  syncTraps(list: TrapSnap[], ground: (x: number, z: number) => number | null, dt: number) {
    for (const t of list) {
      let e = this.traps.get(t.id);
      if (!e) {
        const g = new THREE.Group(); g.name = "armadilha:" + t.id;
        const ent: NonNullable<ReturnType<typeof this.traps.get>> = { obj: g };
        this.template(TRAP_URLS[t.kind] ?? TRAP_URLS.rede).then(tp => {
          const m = skeletonClone(tp.scene); g.add(m);
          if (tp.animations.length) { ent.mixer = new THREE.AnimationMixer(m); ent.actions = new Map(tp.animations.map(c => [c.name, ent.mixer!.clipAction(c)])); }
        }).catch(() => {});
        this.group.add(g); this.traps.set(t.id, ent); e = ent;
      }
      const y = ground(t.x - this.origin.x, t.z - this.origin.z) ?? 0;
      e.obj.position.set(t.x - this.origin.x, y + 0.02, t.z - this.origin.z);
      // acionamento ao prender, rearme ao armar de novo
      if (e.actions && e.armed !== t.armed) {
        const name = t.armed ? "rearmar" : "acionar";
        const act = e.actions.get(name);
        if (act) { e.actions.forEach(a => a.stop()); act.reset(); act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; act.play(); }
        e.armed = t.armed;
      }
      e.mixer?.update(dt);
    }
    for (const [id, e] of this.traps) if (!list.some(t => t.id === id)) { e.obj.removeFromParent(); this.traps.delete(id); }
  }

  /** Pegadas: base (posição no chão, rumo) recalculada só quando a LISTA muda (o protocolo incremental
   *  preserva a identidade da lista sem mudanças); por quadro, só o pulso de brilho (escrita direta na matriz). */
  private trackList: FootprintSnap[] | null = null;
  private trackBase = new Float32Array(900 * 5);
  private trackN = 0;
  syncTracks(list: FootprintSnap[], ground: (x: number, z: number) => number | null, now: number) {
    if (list !== this.trackList) {
      this.trackList = list;
      let n = 0, prev: FootprintSnap | null = null;
      for (const f of list) {
        if (n >= 900) break;
        const x = f.x - this.origin.x, z = f.z - this.origin.z, y = ground(x, z);
        if (y === null) { prev = f; continue; }
        const dir = prev && prev.creature === f.creature ? Math.atan2(f.x - prev.x, f.z - prev.z) : 0;
        const B = this.trackBase, o = n * 5;
        B[o] = x + (f.seq % 2 ? 0.18 : -0.18); B[o + 1] = y + 0.05; B[o + 2] = z; B[o + 3] = dir; B[o + 4] = f.seq;
        n++; prev = f;
      }
      this.trackN = n;
    }
    const E = this.prints.instanceMatrix.array as Float32Array, B = this.trackBase;
    for (let n = 0; n < this.trackN; n++) {
      const o = n * 5, c = Math.cos(B[o + 3]), si = Math.sin(B[o + 3]), p = 1 + 0.06 * Math.sin(now * 0.004 + B[o + 4]), e = n * 16;
      E[e] = c * p; E[e + 1] = 0; E[e + 2] = -si * p; E[e + 3] = 0; E[e + 4] = 0; E[e + 5] = 1; E[e + 6] = 0; E[e + 7] = 0;
      E[e + 8] = si * p; E[e + 9] = 0; E[e + 10] = c * p; E[e + 11] = 0; E[e + 12] = B[o]; E[e + 13] = B[o + 1]; E[e + 14] = B[o + 2]; E[e + 15] = 1;
    }
    this.prints.count = this.trackN; this.prints.instanceMatrix.needsUpdate = this.trackN > 0;
  }

}

function creatureClip(a: Actor, c: CreatureSnap) {
  if (!c.alive) return pick(a, ["death", "Death", "die"]);
  const want = c.clip;
  const alias: Record<string, string[]> = {
    idle: ["idle", "Idle", "breathe"], walk: ["walk", "Walk", "walking"], run: ["run", "Run", "gallop", "walk"], peck: ["peck", "eat", "graze", "idle"], bite: ["bite", "attack", "Attack", "idle"],
    eat: ["eat", "graze", "browse", "forage", "nibble", "peck", "idle"], feed: ["feed", "eat", "bite", "idle"], drink: ["drink", "eat", "graze", "idle"], sleep: ["sleep", "rest", "lie", "idle"], rest: ["rest", "sleep", "breathing", "idle"], flee: ["run", "sprint", "walk"],
    growl: ["growl", "threat", "alert", "defensive_idle", "idle"],
    // V04: voo e subsolo (nomes dos clipes reais variam por espécie)
    fly: ["fly", "flying", "fly_loop", "glide", "flap", "walk"], takeoff: ["takeoff", "take_off", "fly", "flying", "walk"], land: ["land", "landing", "fly", "idle"],
    swim_sand: ["swim_sand", "glide_shallow", "sand_swim", "burrow_move", "swim", "walk"], swim_fast: ["swim_fast", "glide_fast", "swim_sand", "glide_shallow", "run"],
    breach: ["breach", "emerge", "surface", "attack", "bite"], dive: ["dive", "burrow", "submerge", "sand_dig", "idle"],
  };
  return pick(a, alias[want] ?? [want, "idle"]);
}
function pick(a: Actor, names: string[]) { for (const n of names) if (a.actions.has(n)) return n; return [...a.actions.keys()][0] ?? ""; }

function bindClip(root: THREE.Object3D) {
  const tracks: THREE.KeyframeTrack[] = [];
  root.traverse(o => {
    const b = o as THREE.Bone; if (!b.isBone) return;
    tracks.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, [0], [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]));
    if (b.name === "Hips") tracks.push(new THREE.VectorKeyframeTrack(`${b.name}.position`, [0], [b.position.x, b.position.y, b.position.z]));
  });
  return new THREE.AnimationClip("bind", 0, tracks);
}

function footprintTexture() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 96;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 40, 2, 32, 48, 40); grd.addColorStop(0, "rgba(180,240,255,1)"); grd.addColorStop(0.45, "rgba(70,190,255,0.85)"); grd.addColorStop(1, "rgba(30,120,255,0)");
  g.fillStyle = grd;
  // pegada de três dedos + almofada
  for (const [x, y, r] of [[32, 62, 16], [16, 30, 8], [32, 22, 8], [48, 30, 8]] as const) { g.beginPath(); g.ellipse(x, y, r, r * 1.25, 0, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function blobTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!, grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grd.addColorStop(0, "rgba(255,255,255,0.9)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); return t;
}
