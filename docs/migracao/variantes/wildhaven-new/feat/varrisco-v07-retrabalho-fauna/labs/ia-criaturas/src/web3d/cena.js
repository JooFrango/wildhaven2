// Cena 3D do terreno (relevo, água, arbustos, rochas) e camadas de depuração (percepção, memória, território, grupos).
import { altura } from '../eco/terreno.js';

export function criarTerreno3D(THREE, t) {
  const W = t.largura, D = t.profundidade;
  const passo = Math.max(1, Math.round(t.res));
  const sx = Math.round(W / passo), sz = Math.round(D / passo);
  const geo = new THREE.PlaneGeometry(W, D, sx, sz);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, cores = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + W / 2, y = pos.getZ(i) + D / 2;
    pos.setY(i, altura(t, Math.min(W - 0.01, Math.max(0, x)), Math.min(D - 0.01, Math.max(0, y))));
    const k = Math.min(t.ny - 1, Math.floor(y / t.res)) * t.nx + Math.min(t.nx - 1, Math.floor(x / t.res));
    const inc = t.inclinacao[k] / 45, veg = t.vegetacaoMax[k] ? t.vegetacao[k] / t.vegetacaoMax[k] : 0;
    if (t.bloqueio[k]) c.setRGB(0.42, 0.4, 0.37);
    else if (t.agua[k] > t.alturas[k]) c.setRGB(0.36, 0.33, 0.24);
    else c.setRGB(0.55 + 0.2 * inc - 0.15 * veg, 0.52 + 0.12 * veg - 0.1 * inc, 0.27 - 0.05 * veg);
    cores.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  geo.computeVertexNormals();
  const malha = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  malha.receiveShadow = true;
  const grupo = new THREE.Group();
  grupo.add(malha);
  // Água: mesma grade, com a superfície onde há água (e abaixo do chão no resto).
  // Nível VISUAL: no recorte real o mesh river_water do hexágono fica ~8 m acima do terreno das margens; desenhar
  // nessa altura cria uma "parede" de água sobre a planície. Desenha no nível da margem (terreno seco vizinho − 0,15 m),
  // propagado da borda para o meio do rio. A simulação continua usando t.agua (rio fundo, intransponível).
  const nivelVis = new Float32Array(t.nx * t.ny).fill(NaN);
  let fila = [];
  for (let k = 0; k < t.nx * t.ny; k++) {
    if (!(t.agua[k] > -1e8)) continue;
    const i0 = k % t.nx, j0 = Math.floor(k / t.nx);
    let margem = -Infinity;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i = i0 + a, j = j0 + b; if (i < 0 || j < 0 || i >= t.nx || j >= t.ny) continue; const q = j * t.nx + i; if (!(t.agua[q] > -1e8)) margem = Math.max(margem, t.alturas[q]); }
    if (margem > -Infinity) { nivelVis[k] = Math.min(t.agua[k], margem - 0.15); fila.push(k); }
  }
  while (fila.length) {
    const prox = [];
    for (const k of fila) {
      const i0 = k % t.nx, j0 = Math.floor(k / t.nx);
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i = i0 + a, j = j0 + b; if (i < 0 || j < 0 || i >= t.nx || j >= t.ny) continue; const q = j * t.nx + i; if (t.agua[q] > -1e8 && Number.isNaN(nivelVis[q])) { nivelVis[q] = Math.min(t.agua[q], nivelVis[k]); prox.push(q); } }
    }
    fila = prox;
  }
  const ga = geo.clone();
  const pa = ga.attributes.position;
  let temAgua = false;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i) + W / 2, y = pa.getZ(i) + D / 2;
    const ci = Math.min(t.nx - 1, Math.floor(x / t.res)), cj = Math.min(t.ny - 1, Math.floor(y / t.res));
    const k = cj * t.nx + ci;
    if (t.agua[k] > -1e8) { pa.setY(i, Number.isNaN(nivelVis[k]) ? t.agua[k] : nivelVis[k]); temAgua = true; continue; }
    // Vértice seco: abaixo do chão E abaixo do nível da água vizinha (senão o triângulo que liga a margem
    // íngreme ao espelho d'água vira uma "parede" de água sobre o barranco).
    let nivelViz = Infinity;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const a = ci + di, b = cj + dj;
      if (a < 0 || b < 0 || a >= t.nx || b >= t.ny) continue;
      const q = b * t.nx + a;
      if (t.agua[q] > -1e8) nivelViz = Math.min(nivelViz, Number.isNaN(nivelVis[q]) ? t.agua[q] : nivelVis[q]);
    }
    pa.setY(i, Math.min(pa.getY(i) - 0.6, nivelViz - 0.3));
  }
  ga.computeVertexNormals();
  if (temAgua) {
    const agua = new THREE.Mesh(ga, new THREE.MeshStandardMaterial({ color: 0x3f7f9a, transparent: true, opacity: 0.78, roughness: 0.25, metalness: 0.05 }));
    agua.name = 'agua';
    grupo.add(agua);
  }
  // Arbustos e rochas (amostrados), instanciados.
  const arb = [], roc = [];
  for (let j = 0; j < t.ny; j += 2) for (let i = 0; i < t.nx; i += 2) {
    const k = j * t.nx + i, x = (i + 0.5) * t.res, y = (j + 0.5) * t.res;
    if (t.bloqueio[k]) roc.push([x, y]);
    else if (t.cobertura[k] >= 50 && ((i * 7 + j * 13) % 3 === 0)) arb.push([x, y, t.cobertura[k]]);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  if (arb.length) {
    const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x5c7a3c, roughness: 1, flatShading: true }), arb.length);
    arb.forEach(([x, y, cob], n) => {
      const h = 0.6 + (cob / 100) * 0.9 + ((n * 37) % 10) / 25;
      m4.compose(p.set(x - W / 2, altura(t, x, y) + h * 0.5, y - D / 2), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), n), s.set(1.3, h, 1.3));
      im.setMatrixAt(n, m4);
    });
    im.castShadow = true; im.receiveShadow = true; grupo.add(im);
  }
  if (roc.length) {
    const im = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 1, flatShading: true }), roc.length);
    roc.forEach(([x, y], n) => { m4.compose(p.set(x - W / 2, altura(t, x, y) - 0.3, y - D / 2), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), n * 0.7), s.set(1.4, 1.2, 1.4)); im.setMatrixAt(n, m4); });
    im.castShadow = true; im.receiveShadow = true; grupo.add(im);
  }
  return grupo;
}

// Tapete de sombra: um retalho pequeno do relevo, sem cor própria, que recebe a sombra das criaturas.
// Por que existe: a malha de um hexágono tem 4330×5000 m em triângulos de ~24 m. Nessa escala a coordenada de
// sombra interpolada pelo vértice perde precisão e a sombra simplesmente não aparece — medido no navegador com
// planos de teste no mesmo lugar: 14 m recebe sombra, 5000 m não. O retalho acompanha o alvo da câmera e tira a
// altura da MESMA grade que a IA consulta, então encosta no chão visível (que saiu dos mesmos GLBs).
export class TapeteDeSombra {
  constructor(THREE, { lado = 70, divisoes = 28, opacidade = 0.33 } = {}) {
    this.THREE = THREE; this.lado = lado;
    const geo = new THREE.PlaneGeometry(lado, lado, divisoes, divisoes);
    geo.rotateX(-Math.PI / 2);
    this.malha = new THREE.Mesh(geo, new THREE.ShadowMaterial({ opacity: opacidade, transparent: true, depthWrite: false }));
    this.malha.receiveShadow = true;
    this.malha.name = 'tapete-de-sombra';
    this.centro = null;
  }

  // x, y em metros do terreno; `alturaEm(x, y)` é a altura da grade; `t` é o terreno (para centralizar a cena).
  atualizar(x, y, alturaEm, t) {
    if (this.centro && Math.hypot(x - this.centro.x, y - this.centro.y) < this.lado / 4) return false;
    this.centro = { x, y };
    const pos = this.malha.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const wx = Math.min(t.largura - 0.01, Math.max(0, x + pos.getX(i)));
      const wy = Math.min(t.profundidade - 0.01, Math.max(0, y + pos.getZ(i)));
      pos.setY(i, alturaEm(wx, wy) + 0.03); // 3 cm acima do chão: sem briga de profundidade com a malha da peça
    }
    pos.needsUpdate = true;
    this.malha.geometry.computeVertexNormals();
    this.malha.position.set(x - t.largura / 2, 0, y - t.profundidade / 2);
    return true;
  }

  descartar() { this.malha.geometry.dispose(); this.malha.material.dispose(); }
}

// Camadas de depuração redesenhadas a cada quadro (poucos objetos, reaproveitados).
export class Camadas {
  constructor(THREE, cena) {
    this.THREE = THREE; this.g = new THREE.Group(); cena.add(this.g);
    this.mat = {
      visao: new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
      audicao: new THREE.LineBasicMaterial({ color: 0x9cc8ff, transparent: true, opacity: 0.7 }),
      memoria: new THREE.LineBasicMaterial({ color: 0xff9d3c }),
      territorio: new THREE.LineBasicMaterial({ color: 0xd2553a, transparent: true, opacity: 0.6 }),
      grupo: new THREE.LineBasicMaterial({ color: 0x8fd18b, transparent: true, opacity: 0.8 }),
      carcaca: new THREE.MeshStandardMaterial({ color: 0x7a1f1f, roughness: 0.8 }),
      alvo: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }),
    };
  }
  limpar() { for (const o of [...this.g.children]) { this.g.remove(o); o.geometry?.dispose(); } }
  desenhar(mundo, alturaEm, sel, op) {
    const T = this.THREE, t = mundo.terreno, W = t.largura / 2, D = t.profundidade / 2;
    this.limpar();
    const P = (x, y, dz = 0.25) => new T.Vector3(x - W, alturaEm(x, y) + dz, y - D);
    const circulo = (x, y, r, mat, n = 48) => { const pts = []; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; pts.push(P(x + Math.cos(a) * r, y + Math.sin(a) * r, 0.35)); } this.g.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), mat)); };
    if (op.territorios) for (const a of mundo.vivos) if (a.territorio) circulo(a.territorio.x, a.territorio.y, a.territorio.raio, this.mat.territorio, 96);
    if (op.grupos) for (const g of mundo.grupos.values()) {
      const ms = g.membros.map((id) => mundo.porId.get(id)).filter(Boolean);
      const lider = mundo.porId.get(g.lider);
      if (!lider) continue;
      for (const m of ms) if (m !== lider) this.g.add(new T.Line(new T.BufferGeometry().setFromPoints([P(lider.x, lider.y, 0.6), P(m.x, m.y, 0.6)]), this.mat.grupo));
    }
    // Com o ciclo V7 ligado a carcaça é o próprio corpo (e depois os ossos): o marcador esférico esconderia os dois.
    for (const c of mundo.cenario.decomposicao ? [] : mundo.carcacas) {
      const s = 0.25 + Math.sqrt(c.carne) * 0.12;
      const m = new T.Mesh(new T.SphereGeometry(s, 8, 6), this.mat.carcaca);
      m.position.copy(P(c.x, c.y, s * 0.5)); this.g.add(m);
    }
    const a = sel && (mundo.porId.get(sel) ?? null);
    if (!a) return;
    if (op.percepcao) {
      const p = a.especie.percepcao, alc = p.visao.alcance * a.atributos.sentidos, ang = (p.visao.anguloGraus * Math.PI) / 180 * (a.foco ? 0.55 : 1);
      const geo = new T.CircleGeometry(alc, 40, -ang / 2, ang);
      geo.rotateX(-Math.PI / 2);
      const cone = new T.Mesh(geo, this.mat.visao);
      cone.position.copy(P(a.x, a.y, 0.4)); cone.rotation.y = -a.direcao;
      this.g.add(cone);
      circulo(a.x, a.y, p.audicao.alcance * a.atributos.sentidos, this.mat.audicao, 64);
    }
    if (op.memoria) for (const m of a.memoria.criaturas.values()) {
      const vis = a.contatos.some((k) => k.id === m.id && k.via === 'visao');
      if (vis) continue;
      const r = 0.8, c = P(m.x, m.y, 0.5);
      this.g.add(new T.Line(new T.BufferGeometry().setFromPoints([c.clone().add(new T.Vector3(-r, 0, -r)), c.clone().add(new T.Vector3(r, 0, r))]), this.mat.memoria));
      this.g.add(new T.Line(new T.BufferGeometry().setFromPoints([c.clone().add(new T.Vector3(-r, 0, r)), c.clone().add(new T.Vector3(r, 0, -r))]), this.mat.memoria));
      this.g.add(new T.Line(new T.BufferGeometry().setFromPoints([P(a.x, a.y, 0.5), c]), this.mat.memoria));
    }
    if (a.alvo && a.alvo.x != null) this.g.add(new T.Line(new T.BufferGeometry().setFromPoints([P(a.x, a.y, 0.8), P(a.alvo.x, a.alvo.y, 0.8)]), this.mat.alvo));
  }
}
