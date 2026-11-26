// Atores 3D: Hunters (GLB do workshop), criaturas (GLBs das espécies), carroças
// (Dodarro blockout + marcador técnico da carroça, que não tem asset), acampamentos,
// armadilhas e pegadas descobertas (azuis, instanciadas).
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { CampSnap, CreatureSnap, FootprintSnap, HunterFull, TrapSnap, WagonSnap } from "./contracts";

const ASSETS: Record<string, string> = {
  hunter: "/glb/hunter.glb",
  folhisco: "/assets/models/creatures/folhisco/folhisco_animated_v01.glb",
  lobrapedra: "/assets/models/creatures/lobrapedra/v02/lobrapedra-animated-v02.glb",
  dodo: "/assets/models/creatures/dodarro/dodarro_montaria_v02_blockout.glb",
};

export interface Animated { obj: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>; current?: string; label?: HTMLDivElement; }

export class Entities {
  readonly group = new THREE.Group();
  private loader = new GLTFLoader();
  private templates = new Map<string, Promise<GLTF>>();
  readonly hunters = new Map<string, Animated>();
  readonly creatures = new Map<number, Animated>();
  private wagons = new Map<string, THREE.Object3D>();
  private camps = new Map<number, THREE.Object3D>();
  private traps = new Map<number, THREE.Object3D>();
  private prints: THREE.InstancedMesh;
  /** Auditoria de backface culling: materiais doubleSided por asset (não alterados). */
  readonly materialAudit: Record<string, { total: number; doubleSided: number }> = {};

  constructor(private origin: { x: number; z: number }) {
    this.group.name = "atores";
    const disc = new THREE.CircleGeometry(0.22, 10);
    disc.rotateX(-Math.PI / 2);
    this.prints = new THREE.InstancedMesh(disc, new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 }), 800);
    this.prints.count = 0;
    this.prints.frustumCulled = false; // instâncias espalhadas: bounding próprio não cobre todas
    this.group.add(this.prints);
  }

  private template(kind: string) {
    if (!this.templates.has(kind)) {
      const p = this.loader.loadAsync(ASSETS[kind]).then(g => {
        const a = { total: 0, doubleSided: 0 };
        g.scene.traverse(o => {
          const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
          for (const mat of m ? (Array.isArray(m) ? m : [m]) : []) { a.total++; if (mat.side === THREE.DoubleSide) a.doubleSided++; }
        });
        this.materialAudit[kind] = a;
        return g;
      });
      this.templates.set(kind, p);
    }
    return this.templates.get(kind)!;
  }

  private spawnAnimated(kind: string, onReady: (a: Animated) => void) {
    this.template(kind).then(g => {
      const obj = skeletonClone(g.scene);
      obj.traverse(o => {
        const sm = o as THREE.SkinnedMesh;
        if (sm.isSkinnedMesh) {
          // frustum culling conservador para malha animada: esfera ampliada (2×), em vez de desligar
          sm.geometry.computeBoundingSphere();
          if (sm.geometry.boundingSphere) sm.geometry.boundingSphere.radius *= 2;
          sm.frustumCulled = true;
        }
      });
      this.group.add(obj);
      const mixer = new THREE.AnimationMixer(obj);
      onReady({ obj, mixer, actions: new Map(g.animations.map(c => [c.name, mixer.clipAction(c)])) });
    });
  }

  private play(a: Animated, clip: string | undefined, rate = 1) {
    const want = clip && a.actions.has(clip) ? clip : a.actions.has("idle") ? "idle" : undefined;
    if (want !== a.current) {
      if (a.current) a.actions.get(a.current)?.fadeOut(0.2);
      if (want) a.actions.get(want)?.reset().fadeIn(0.2).play();
      a.current = want;
    }
    if (want) a.actions.get(want)!.timeScale = rate;
  }

  syncHunters(list: HunterFull[], prev: Map<string, HunterFull>, alpha: number, dt: number) {
    for (const h of list) {
      if (!this.hunters.has(h.id)) {
        this.hunters.set(h.id, { obj: new THREE.Group(), mixer: new THREE.AnimationMixer(new THREE.Group()), actions: new Map() });
        this.spawnAnimated("hunter", a => {
          const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.3, 28), new THREE.MeshBasicMaterial({ color: h.role === "socorrista" ? 0xf0883e : 0x58a6ff, side: THREE.DoubleSide }));
          ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.name = "anel";
          a.obj.add(ring);
          this.hunters.set(h.id, a);
        });
        continue;
      }
      const a = this.hunters.get(h.id)!;
      const p = prev.get(h.id) ?? h;
      a.obj.position.set(p.x + (h.x - p.x) * alpha - this.origin.x, p.y + (h.y - p.y) * alpha, p.z + (h.z - p.z) * alpha - this.origin.z);
      a.obj.rotation.set(0, h.heading, 0);
      // caído/morto: deitado (não há clipe de queda no GLB do workshop)
      if (h.activity === "caido" || h.activity === "morto" || h.activity === "carregado") a.obj.rotation.set(-Math.PI / 2, h.heading, 0);
      a.obj.scale.setScalar(h.crouched ? 0.8 : 1);
      a.obj.visible = h.activity !== "embarcado";
      const rate = h.crouched ? 0.5 : 1;
      this.play(a, h.clip === "Walking" ? "Walking" : undefined, rate);
      a.mixer.update(dt);
    }
  }

  syncCreatures(list: CreatureSnap[], prev: Map<number, CreatureSnap>, alpha: number, dt: number) {
    const seen = new Set<number>();
    for (const c of list) {
      seen.add(c.id);
      if (!this.creatures.has(c.id)) {
        this.creatures.set(c.id, { obj: new THREE.Group(), mixer: new THREE.AnimationMixer(new THREE.Group()), actions: new Map() });
        this.spawnAnimated(c.species, a => this.creatures.set(c.id, a));
        continue;
      }
      const a = this.creatures.get(c.id)!;
      const p = prev.get(c.id) ?? c;
      a.obj.position.set(p.x + (c.x - p.x) * alpha - this.origin.x, p.y + (c.y - p.y) * alpha, p.z + (c.z - p.z) * alpha - this.origin.z);
      a.obj.rotation.y = c.heading;
      this.play(a, c.alive ? c.clip : "death");
      a.mixer.update(dt);
    }
    for (const [id, a] of this.creatures) if (!seen.has(id)) { this.group.remove(a.obj); this.creatures.delete(id); }
  }

  syncWagons(list: WagonSnap[]) {
    for (const w of list) {
      let o = this.wagons.get(w.id);
      if (!o) {
        o = new THREE.Group();
        // carroça: SEM asset — marcador técnico identificado (caixa + rodas)
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 3.2), new THREE.MeshLambertMaterial({ color: 0x8b5a2b }));
        box.position.y = 1.0; box.name = "carroca-marcador-tecnico";
        o.add(box);
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.15, 14), new THREE.MeshLambertMaterial({ color: 0x3a2a1a }));
          wheel.rotation.z = Math.PI / 2; wheel.position.set(x * 0.95, 0.45, z * 1.1); o.add(wheel);
        }
        const oo = o;
        this.template("dodo").then(g => { const d = g.scene.clone(); d.position.set(0, 0, 3.6); d.scale.setScalar(0.9); oo.add(d); });
        this.group.add(o);
        this.wagons.set(w.id, o);
      }
      o.position.set(w.x - this.origin.x, w.y, w.z - this.origin.z);
      o.rotation.y = w.heading;
    }
  }

  syncCamps(list: CampSnap[], heightAt: (x: number, z: number) => number | null) {
    for (const c of list) {
      if (this.camps.has(c.id)) continue;
      const tent = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.2, 6), new THREE.MeshLambertMaterial({ color: 0xd8c39a }));
      const y = heightAt(c.x, c.z) ?? 0;
      tent.position.set(c.x - this.origin.x + 3, y + 1.1, c.z - this.origin.z + 3);
      tent.name = "acampamento-marcador-tecnico";
      this.group.add(tent);
      this.camps.set(c.id, tent);
    }
  }

  syncTraps(list: TrapSnap[], heightAt: (x: number, z: number) => number | null) {
    for (const t of list) {
      let o = this.traps.get(t.id);
      if (!o) {
        o = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 6, 18), new THREE.MeshBasicMaterial({ color: 0xe3b341 }));
        o.rotation.x = -Math.PI / 2;
        this.group.add(o);
        this.traps.set(t.id, o);
      }
      o.position.set(t.x - this.origin.x, (heightAt(t.x, t.z) ?? 0) + 0.08, t.z - this.origin.z);
      ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(t.armed ? 0xe3b341 : t.caught ? 0xf85149 : 0x6e7681);
    }
  }

  syncTracks(list: FootprintSnap[], heightAt: (x: number, z: number) => number | null) {
    const m = new THREE.Matrix4();
    let n = 0;
    for (const f of list) {
      if (n >= 800) break;
      const y = heightAt(f.x, f.z);
      if (y === null) continue;
      m.makeTranslation(f.x - this.origin.x, y + 0.06, f.z - this.origin.z);
      this.prints.setMatrixAt(n++, m);
    }
    this.prints.count = n;
    this.prints.instanceMatrix.needsUpdate = true;
  }
}
