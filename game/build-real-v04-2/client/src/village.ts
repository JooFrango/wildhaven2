// Vila dos Hunters (HV_01): usa os GLBs reais de world/hunters-village-v01 (4 fases de evolução,
// cada uma com LOD de distância). A fase ativa é uma escolha de apresentação ainda SEM regra
// econômica aprovada: padrão = fase 1; o menu do desenvolvedor permite comparar as fases.
// Lanternas acendem à noite (luzes pontuais baratas, sem sombra, só perto da câmera).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { patchMaterial } from "./atmosphere";
import type { Actors } from "./actors";

export class Village {
  readonly group = new THREE.Group();
  phase = Number(new URLSearchParams(location.search).get("fase") ?? 1);
  private near: THREE.Object3D | null = null;
  private far: THREE.Object3D | null = null;
  lamps: THREE.PointLight[] = [];
  private loader = new GLTFLoader();
  night = 0;
  constructor(private origin: { x: number; z: number }, _actors: Actors) {
    this.group.name = "vila-HV_01";
    // os GLBs da vila usam alturas absolutas e só a translação horizontal do hex (README da vila)
    this.group.position.set(28145.825623 - origin.x, 0, -3750 - origin.z);
  }
  async load(phase = this.phase) {
    this.phase = Math.min(4, Math.max(1, phase));
    const [n, f] = await Promise.all([
      this.loader.loadAsync(`/world/hunters-village-v01/models/phase_${this.phase}.glb`),
      this.loader.loadAsync(`/world/hunters-village-v01/models/phase_${this.phase}_lod1.glb`),
    ]);
    for (const o of [this.near, this.far]) o?.removeFromParent();
    this.near = n.scene; this.far = f.scene;
    for (const s of [this.near, this.far]) s.traverse(o => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      m.castShadow = s === this.near; m.receiveShadow = true;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) { (mat as THREE.MeshStandardMaterial).side = THREE.FrontSide; patchMaterial(mat); }
    });
    this.group.add(this.near, this.far);
    // V04.1: a vila é estática — matrizes calculadas uma vez (antes, ~centenas de nós recalculados a cada quadro)
    for (const sc of [this.near, this.far]) { sc.updateMatrixWorld(true); sc.traverse(o => { o.matrixAutoUpdate = false; }); }
    // lanternas: pontos de luz junto às construções (provisório até haver marcadores no GLB)
    for (const l of this.lamps) l.removeFromParent();
    this.lamps = [];
    const box = new THREE.Box3().setFromObject(this.near);
    const c = box.getCenter(new THREE.Vector3());
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2, l = new THREE.PointLight(0xffb060, 0, 22, 2);
      l.position.set(c.x - this.group.position.x + Math.cos(a) * 24, box.min.y + 3.2, c.z - this.group.position.z + Math.sin(a) * 24);
      this.group.add(l); this.lamps.push(l);
    }
  }
  update(camera: THREE.Camera, _dt: number) {
    if (!this.near || !this.far) return;
    const d = camera.position.distanceTo(new THREE.Vector3(this.group.position.x, 930, this.group.position.z));
    this.near.visible = d < 450;
    this.far.visible = d >= 450 && d < 6000;
    for (const l of this.lamps) { l.intensity = this.near.visible ? this.night * 7 : 0; l.visible = l.intensity > 0.05; }
  }
}
