import * as THREE from "three";

/**
 * V04.1 — portão das luzes locais (lanternas da vila e fogueiras dos acampamentos).
 *
 * No three.js o número de luzes pontuais VISÍVEIS faz parte da chave de cada programa de shader: quando ele muda,
 * todo material iluminado ganha um programa novo, compilado de forma síncrona no quadro seguinte. Medido na vila
 * (`tools/lab/picos.mjs` e o teste das lanternas): acender as 6 lanternas à noite criou 15 programas de uma vez
 * (21 → 36) e 12 quadros levaram 10,4 s no SwiftShader em vez de ~4 s; numa GPU real isso é um travamento visível.
 * Manter as 6 luzes sempre contadas (intensidade 0) evitaria a compilação, mas custou +30% no tempo de quadro.
 *
 * Solução sem mudar o visual: quando a contagem desejada muda, o portão compila a configuração NOVA em paralelo
 * (`renderer.compileAsync`, que usa KHR_parallel_shader_compile quando disponível) e continua desenhando com a
 * contagem ANTIGA até os programas ficarem prontos:
 *  - luzes que acabaram de acender ficam apagadas por esses poucos quadros;
 *  - luzes que apagaram ou saíram da cena (acampamento desfeito) são substituídas por luzes-fantasma de intensidade 0.
 * Depois a contagem nova entra de uma vez e nada é compilado no meio do jogo. Cada material guarda os programas já
 * usados, então idas e voltas entre as mesmas contagens não recompilam.
 */
export class LocalLightGate {
  private applied = 0;
  private ready = new Set<number>();
  private compiling: number | null = null;
  private phantoms: THREE.PointLight[] = [];
  private readyAt = new Map<number, number>();
  /** Programas criados pelo renderizador até agora: se mudou desde a compilação, há materiais novos na cena. */
  private sceneVersion() { return (this.renderer.info as any).programs?.length ?? 0; }
  readonly stats = { compilacoes: 0, quadrosSegurados: 0, ultimaCompilacaoMs: 0 };

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, initialCount = 0) {
    this.applied = initialCount; this.ready.add(initialCount);
  }

  /** Chame depois que os sistemas decidiram `visible` das luzes locais e antes do render. */
  private on: THREE.PointLight[] = [];
  gate(groups: Iterable<THREE.PointLight>[], camera: THREE.Camera) {
    for (const p of this.phantoms) p.visible = false;
    const on = this.on; on.length = 0; // V04.2: sem arrays novos por quadro
    for (const g of groups) for (const l of g) if (l.visible && l.parent) on.push(l);
    const want = on.length;
    if (want === this.applied) return;
    // contagem já compilada pelo portão e nada pendente: aplica (materiais novos desde então ainda passam pelo
    // compileAsync abaixo na próxima mudança; aqui só se evita segurar quadros à toa)
    if (this.ready.has(want) && this.compiling === null && this.readyAt.get(want) === this.sceneVersion()) { this.applied = want; return; }
    if (this.compiling === null) {
      // compila com a configuração desejada (o estado atual da cena), sem esperar
      const t0 = performance.now(); this.compiling = want; this.stats.compilacoes++;
      this.renderer.compileAsync(this.scene, camera).catch(() => {}).then(() => {
        this.ready.add(want); this.readyAt.set(want, this.sceneVersion()); this.compiling = null; this.stats.ultimaCompilacaoMs = Math.round(performance.now() - t0);
      });
    }
    // enquanto isso, desenha com a contagem aplicada: apaga as excedentes ou completa com fantasmas
    this.stats.quadrosSegurados++;
    if (want > this.applied) {
      for (let i = this.applied; i < on.length; i++) on[i].visible = false;
    } else {
      for (let i = 0; i < this.applied - want; i++) this.phantom(i).visible = true;
    }
  }

  /**
   * Pré-compilação síncrona (só atrás da tela de carregamento): para cada contagem de luzes locais, liga fantasmas
   * nessa quantidade e compila todos os materiais visíveis da cena. As luzes reais ficam desligadas durante isso.
   */
  prewarm(camera: THREE.Camera, counts: number[], groups: Iterable<THREE.PointLight>[]) {
    const local: THREE.PointLight[] = []; for (const g of groups) for (const l of g) local.push(l);
    const t0 = performance.now(), keep = local.map(l => l.visible);
    for (const l of local) l.visible = false;
    // LODs e objetos ocultos agora (vila próxima/distante, níveis de vegetação) também entram: o compile() do
    // three.js só percorre o que está visível
    const hidden: THREE.Object3D[] = [];
    this.scene.traverse(o => { if (!o.visible && !(o as THREE.Light).isLight) { hidden.push(o); o.visible = true; } });
    for (const c of counts) {
      for (let i = 0; i < c; i++) this.phantom(i).visible = true;
      this.renderer.compile(this.scene, camera);
      for (const p of this.phantoms) p.visible = false;
      this.ready.add(c);
    }
    for (const o of hidden) o.visible = false;
    local.forEach((l, i) => (l.visible = keep[i]));
    for (const c of counts) this.readyAt.set(c, this.sceneVersion());
    return Math.round(performance.now() - t0);
  }

  private phantom(i: number) {
    let p = this.phantoms[i];
    if (!p) { p = new THREE.PointLight(0x000000, 0, 0.01, 2); p.name = "luz-fantasma"; p.visible = false; this.scene.add(p); this.phantoms[i] = p; }
    return p;
  }

  dispose() { for (const p of this.phantoms) p.removeFromParent(); this.phantoms = []; }
}
