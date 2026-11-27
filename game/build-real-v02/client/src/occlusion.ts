// Occlusion culling conservador para atores (Hunters, criaturas, carroças) contra o RELEVO:
// raios da câmera ao topo e ao centro do ator, amostrados no heightfield WHP1 já decodificado.
// Só esconde se TODOS os raios cruzam terreno acima da linha. Sem consultas de GPU síncronas.
// Afeta apenas a apresentação; a simulação é do servidor.
import * as THREE from "three";

export type HeightAt = (x: number, z: number) => number | null; // coordenadas de render (origem local)

export class TerrainOcclusion {
  culled = 0;
  tested = 0;
  private lastRun = 0;
  constructor(private heightAt: HeightAt, private stepM = 6, private intervalMs = 200) {}

  private blocked(cam: THREE.Vector3, p: THREE.Vector3): boolean {
    const d = cam.distanceTo(p);
    if (d < 30) return false; // perto da câmera: nunca descartar
    const n = Math.ceil(d / this.stepM);
    for (let i = 1; i < n; i++) {
      const f = i / n;
      const x = cam.x + (p.x - cam.x) * f, y = cam.y + (p.y - cam.y) * f, z = cam.z + (p.z - cam.z) * f;
      const h = this.heightAt(x, z);
      if (h !== null && h > y + 0.5) return true; // margem de 0,5 m: conservador
    }
    return false;
  }

  update(camera: THREE.Camera, objects: THREE.Object3D[], now: number) {
    if (now - this.lastRun < this.intervalMs) return;
    this.lastRun = now;
    const cam = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    let culled = 0;
    for (const o of objects) {
      if (!o.userData.wantVisible) { o.visible = false; continue; }
      const base = o.position.clone();
      const top = base.clone().add(new THREE.Vector3(0, 2.0, 0));
      const mid = base.clone().add(new THREE.Vector3(0, 1.0, 0));
      const hidden = this.blocked(cam, top) && this.blocked(cam, mid) && this.blocked(cam, base.clone().add(new THREE.Vector3(0, 0.2, 0)));
      o.visible = !hidden;
      if (hidden) culled++;
    }
    this.culled = culled;
    this.tested = objects.length;
  }
}
