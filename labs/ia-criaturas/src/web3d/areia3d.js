// Efeitos de areia e diagnóstico subterrâneo (experimentais, fora da Alpha).
//
// Dois objetos, ambos com pool fixo — nada é alocado por quadro:
//   EfeitosDeAreia  partículas de mergulho/emergência, esteira de quem passa raso e marca de escavação;
//   InspecaoSubsolo marcadores de profundidade, linhas de rota e de estímulo, e corte visual do terreno.
//
// Os efeitos seguem o estado físico real (fase, profundidade, velocidade). Nenhum deles esconde colisão
// ou falha de animação: quando o corpo está parado, não há partícula.

const AREIA = 0xd8b584;

export class EfeitosDeAreia {
  constructor(THREE, { maximo = 420, lado = 0.35 } = {}) {
    this.THREE = THREE; this.max = maximo;
    const geo = new THREE.PlaneGeometry(lado, lado);
    const mat = new THREE.MeshBasicMaterial({ color: AREIA, transparent: true, opacity: 0.7, depthWrite: false });
    this.malha = new THREE.InstancedMesh(geo, mat, maximo);
    this.malha.frustumCulled = false;
    this.malha.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.malha.count = maximo;
    // Pool: cada partícula guarda posição, velocidade e vida. Reciclada, nunca recriada.
    this.p = Array.from({ length: maximo }, () => ({ v: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 1 }));
    this.prox = 0;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Vector3();
    this.esconder();
  }

  esconder() {
    const m = new this.THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.max; i++) this.malha.setMatrixAt(i, m);
    this.malha.instanceMatrix.needsUpdate = true;
  }

  // n partículas saindo de (x, y, z) com dispersão `espalha` e empuxo `subida`.
  emitir(x, y, z, n, { espalha = 1.6, subida = 2.4, escala = 1, vida = 0.9 } = {}) {
    for (let i = 0; i < n; i++) {
      const p = this.p[this.prox]; this.prox = (this.prox + 1) % this.max;
      const a = Math.random() * Math.PI * 2, r = Math.random() * espalha;
      p.x = x + Math.cos(a) * r * 0.3; p.y = y; p.z = z + Math.sin(a) * r * 0.3;
      p.vx = Math.cos(a) * r; p.vz = Math.sin(a) * r; p.vy = subida * (0.5 + Math.random());
      p.v = vida * (0.7 + 0.6 * Math.random()); p.vida0 = p.v; p.s = escala * (0.6 + 0.8 * Math.random());
    }
  }

  atualizar(dt, camera) {
    const T = this.THREE;
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (p.v <= 0) { this.malha.setMatrixAt(i, this.m.makeScale(0, 0, 0)); continue; }
      p.v -= dt;
      p.vy -= 9.8 * dt * 0.45; // grãos pesados: caem rápido
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vx *= 1 - dt * 2.2; p.vz *= 1 - dt * 2.2;
      const k = Math.max(0, p.v / p.vida0);
      const s = p.s * (0.4 + 0.6 * k);
      this.m.compose(this.e.set(p.x, p.y, p.z), camera ? camera.quaternion : this.q, new T.Vector3(s, s, s));
      this.malha.setMatrixAt(i, this.m);
    }
    this.malha.instanceMatrix.needsUpdate = true;
  }

  descartar() { this.malha.geometry.dispose(); this.malha.material.dispose(); }
}

// Marcadores de diagnóstico. Não alteram o terreno físico nem deixam as criaturas atravessar nada:
// são linhas e caixas desenhadas por cima, ligadas/desligadas pelo painel.
export class InspecaoSubsolo {
  constructor(THREE, { maximo = 24 } = {}) {
    this.THREE = THREE;
    this.grupo = new THREE.Group();
    this.grupo.visible = false;
    this.max = maximo;
    const matProf = new THREE.LineBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.9 });
    const matRota = new THREE.LineBasicMaterial({ color: 0x9effa0, transparent: true, opacity: 0.8 });
    const matEst = new THREE.LineBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.8 });
    this.prof = this.linhas(maximo, 2, matProf);
    this.rota = this.linhas(maximo, 64, matRota);
    this.estimulo = this.linhas(maximo * 3, 2, matEst);
  }

  linhas(n, pontos, material) {
    const T = this.THREE, out = [];
    for (let i = 0; i < n; i++) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(new Float32Array(pontos * 3), 3));
      const l = new T.Line(g, material);
      l.frustumCulled = false; l.visible = false;
      this.grupo.add(l); out.push(l);
    }
    return out;
  }

  // animais: [{ x, z, ySuperficie, yCorpo, rota: [{x,z}], estimulos: [{x,z,y}] }] em coordenadas da cena.
  atualizar(animais) {
    if (!this.grupo.visible) return;
    let iProf = 0, iRota = 0, iEst = 0;
    for (const a of animais) {
      if (iProf < this.prof.length) {
        const l = this.prof[iProf++], pos = l.geometry.attributes.position.array;
        pos[0] = a.x; pos[1] = a.ySuperficie; pos[2] = a.z;
        pos[3] = a.x; pos[4] = a.yCorpo; pos[5] = a.z;
        l.geometry.attributes.position.needsUpdate = true; l.visible = true;
      }
      if (a.rota?.length > 1 && iRota < this.rota.length) {
        const l = this.rota[iRota++], pos = l.geometry.attributes.position.array, n = Math.min(a.rota.length, pos.length / 3);
        for (let i = 0; i < n; i++) { pos[i * 3] = a.rota[i].x; pos[i * 3 + 1] = a.rota[i].y; pos[i * 3 + 2] = a.rota[i].z; }
        for (let i = n; i < pos.length / 3; i++) { pos[i * 3] = a.rota[n - 1].x; pos[i * 3 + 1] = a.rota[n - 1].y; pos[i * 3 + 2] = a.rota[n - 1].z; }
        l.geometry.attributes.position.needsUpdate = true; l.visible = true;
      }
      for (const e of a.estimulos ?? []) {
        if (iEst >= this.estimulo.length) break;
        const l = this.estimulo[iEst++], pos = l.geometry.attributes.position.array;
        pos[0] = a.x; pos[1] = a.yCorpo; pos[2] = a.z;
        pos[3] = e.x; pos[4] = e.y; pos[5] = e.z;
        l.geometry.attributes.position.needsUpdate = true; l.visible = true;
      }
    }
    for (let i = iProf; i < this.prof.length; i++) this.prof[i].visible = false;
    for (let i = iRota; i < this.rota.length; i++) this.rota[i].visible = false;
    for (let i = iEst; i < this.estimulo.length; i++) this.estimulo[i].visible = false;
  }

  descartar() { this.grupo.traverse((o) => { o.geometry?.dispose?.(); }); }
}

// Reação visual às transições e ao deslocamento sob a areia. Chamado uma vez por quadro por animal.
// `v` é o Animal3D; `a` o animal do núcleo; `alturaEm` devolve a altura do terreno na cena.
export function reagirAreia(efeitos, v, a, dtReal, alturaEm) {
  const s = a.subsolo;
  if (!s || !efeitos) return;
  const p = v.raiz.position;
  const ySup = alturaEm(a.x, a.y);
  const escala = Math.max(0.6, Math.min(4, a.especie.corpo.comprimentoM * (a.escala ?? 1) * 0.18));
  // Sombra só quando o corpo está fora da areia (inclui a transição, em que parte dele aparece).
  v.projetarSombra(s.fase !== 'submerso');
  const anterior = v.faseAreia;
  v.faseAreia = s.fase;
  // Mergulho e emergência: jato de areia proporcional ao tamanho do corpo.
  if (anterior !== s.fase && (s.fase === 'mergulhando' || s.fase === 'emergindo'))
    efeitos.emitir(p.x, ySup, p.z, s.fase === 'emergindo' ? 44 : 30, { espalha: 2.2 * escala, subida: s.fase === 'emergindo' ? 4.4 : 2.0, escala, vida: 1.1 });
  // Transição em curso: poeira contínua, mais fraca.
  if (s.fase === 'mergulhando' || s.fase === 'emergindo') {
    v.acumAreia = (v.acumAreia ?? 0) + dtReal;
    if (v.acumAreia > 0.07) { v.acumAreia = 0; efeitos.emitir(p.x, ySup, p.z, 3, { espalha: 1.2 * escala, subida: 1.4, escala: escala * 0.7, vida: 0.7 }); }
    return;
  }
  // Submerso e raso: crista de areia deslocada, só quando o corpo está de fato andando.
  if (s.fase === 'submerso' && a.velocidade > 0.4 && s.prof < (a.especie.subsolo?.alturaCorpoM ?? 1) * 1.6) {
    v.acumAreia = (v.acumAreia ?? 0) + dtReal;
    if (v.acumAreia > 0.1) { v.acumAreia = 0; efeitos.emitir(p.x, ySup + 0.1, p.z, 2, { espalha: 0.9 * escala, subida: 0.9, escala: escala * 0.6, vida: 0.55 }); }
  }
  // Ataque na superfície: poeira levantada no instante do golpe.
  if (a.golpe && a.golpe !== v.ultimoGolpeAreia) { v.ultimoGolpeAreia = a.golpe; if (s.fase === 'superficie') efeitos.emitir(p.x, ySup, p.z, 10, { espalha: 1.4 * escala, subida: 1.6, escala: escala * 0.8, vida: 0.6 }); }
}
