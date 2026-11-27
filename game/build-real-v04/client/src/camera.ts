// Câmera estratégica inspirada em Kenshi, adaptada ao Wildhaven: segue o Hunter selecionado com
// amortecimento crítico, zoom suave com limites, rotação (botão direito/meio, Q/E), inclinação,
// deslocamento livre (WASD/setas; F volta a seguir), colisão com o relevo e enquadramento de
// combate (abre o zoom para mostrar Hunter e alvo). A câmera nunca comanda o Hunter.
import * as THREE from "three";

export class StrategyCamera {
  yaw = Math.PI * 0.25;
  pitch = 0.5;
  dist = 22;
  private wantDist = 22;
  wantYaw = this.yaw;
  wantPitch = this.pitch;
  readonly target = new THREE.Vector3();
  private wantTarget = new THREE.Vector3();
  private follow = true;
  private keys = new Set<string>();
  private drag: { x: number; y: number; btn: number } | null = null;
  minDist = 6;
  maxDist = 900;
  /** Fator de quanto a câmera se afasta além do mínimo para enquadrar o combate. */
  private combatFrame = 0;
  velocity = new THREE.Vector3();
  private lastTarget = new THREE.Vector3();

  constructor(readonly camera: THREE.PerspectiveCamera, private dom: HTMLElement, private ground: (x: number, z: number) => number | null) {
    dom.addEventListener("contextmenu", e => e.preventDefault());
    dom.addEventListener("pointerdown", e => { if (e.button === 1 || e.button === 2) { this.drag = { x: e.clientX, y: e.clientY, btn: e.button }; dom.setPointerCapture(e.pointerId); } });
    dom.addEventListener("pointermove", e => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y; this.drag.x = e.clientX; this.drag.y = e.clientY;
      this.wantYaw -= dx * 0.005; this.wantPitch = THREE.MathUtils.clamp(this.wantPitch + dy * 0.004, 0.18, 1.38);
    });
    dom.addEventListener("pointerup", () => (this.drag = null));
    dom.addEventListener("wheel", e => { e.preventDefault(); this.wantDist = THREE.MathUtils.clamp(this.wantDist * Math.exp(e.deltaY * 0.0012), this.minDist, this.maxDist); }, { passive: false });
    addEventListener("keydown", e => { if ((e.target as HTMLElement)?.tagName === "INPUT") return; this.keys.add(e.key.toLowerCase()); if (e.key.toLowerCase() === "f") this.follow = true; });
    addEventListener("keyup", e => this.keys.delete(e.key.toLowerCase()));
    addEventListener("blur", () => this.keys.clear());
  }

  /** Troca de Hunter: a câmera desliza até o novo alvo (sem corte). */
  focusOn() { this.follow = true; }
  get following() { return this.follow; }
  zoomTo(d: number) { this.wantDist = THREE.MathUtils.clamp(d, this.minDist, this.maxDist); }

  update(dt: number, focus: THREE.Vector3 | null, combatWith: THREE.Vector3 | null) {
    const k = this.keys;
    const pan = new THREE.Vector3();
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    if (k.has("w") || k.has("arrowup")) pan.add(fwd);
    if (k.has("s") || k.has("arrowdown")) pan.sub(fwd);
    if (k.has("d") || k.has("arrowright")) pan.add(right);
    if (k.has("a") || k.has("arrowleft")) pan.sub(right);
    if (k.has("q")) this.wantYaw += dt * 1.4;
    if (k.has("e")) this.wantYaw -= dt * 1.4;
    if (k.has("+") || k.has("=")) this.wantDist = Math.max(this.minDist, this.wantDist * (1 - dt * 1.5));
    if (k.has("-")) this.wantDist = Math.min(this.maxDist, this.wantDist * (1 + dt * 1.5));
    if (pan.lengthSq() > 0) { this.follow = false; this.wantTarget.addScaledVector(pan.normalize(), dt * (20 + this.dist * 1.2)); }
    if (this.follow && focus) this.wantTarget.copy(focus);
    // enquadramento de combate: alvo no meio do caminho e zoom mínimo que mostra os dois
    const want = this.wantTarget.clone();
    let frameDist = 0;
    if (this.follow && focus && combatWith) {
      want.lerp(combatWith, 0.35);
      frameDist = focus.distanceTo(combatWith) * 1.6 + 10;
    }
    this.combatFrame += ((frameDist > 0 ? 1 : 0) - this.combatFrame) * Math.min(1, dt * 1.5);
    // amortecimento crítico (sem tremer quando o snapshot chega)
    const a = 1 - Math.exp(-dt * 5.5);
    this.target.lerp(want, a);
    this.yaw += (this.wantYaw - this.yaw) * (1 - Math.exp(-dt * 9));
    this.pitch += (this.wantPitch - this.pitch) * (1 - Math.exp(-dt * 9));
    const d = Math.max(this.wantDist, frameDist * this.combatFrame);
    this.dist += (d - this.dist) * (1 - Math.exp(-dt * 6));
    // terreno sob o alvo quando solto (não afunda nem flutua)
    if (!this.follow) { const g = this.ground(this.target.x, this.target.z); if (g !== null) this.target.y += (g - this.target.y) * Math.min(1, dt * 4); }
    const off = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)).multiplyScalar(this.dist);
    const pos = this.target.clone().add(off);
    // colisão com o relevo ao longo do braço: nunca atravessa o terreno
    for (let s = 1; s <= 6; s++) {
      const p = this.target.clone().addScaledVector(off, s / 6);
      const g = this.ground(p.x, p.z);
      if (g !== null && p.y < g + 2.5) { const lift = g + 2.5 - p.y; pos.y += lift * (s / 6); }
    }
    const gc = this.ground(pos.x, pos.z);
    if (gc !== null && pos.y < gc + 2.5) pos.y = gc + 2.5;
    this.camera.position.copy(pos);
    this.camera.lookAt(this.target.x, this.target.y + 1.2, this.target.z);
    this.velocity.subVectors(this.target, this.lastTarget).divideScalar(Math.max(dt, 1e-3));
    this.lastTarget.copy(this.target);
    // plano distante acompanha o zoom (horizonte sempre visível, precisão de profundidade preservada)
    const far = 60000, near = Math.max(0.3, Math.min(4, this.dist * 0.02));
    if (Math.abs(this.camera.far - far) > 1 || Math.abs(this.camera.near - near) > 0.05) { this.camera.far = far; this.camera.near = near; this.camera.updateProjectionMatrix(); }
  }
}
