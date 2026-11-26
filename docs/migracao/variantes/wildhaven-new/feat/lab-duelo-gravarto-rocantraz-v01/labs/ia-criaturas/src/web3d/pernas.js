// Patas no chão para GLBs reais: IK analítico de duas articulações (coxa→canela→pé) + travamento do pé na fase
// de apoio (anti-deslize) + ajuste ao relevo + abaixamento do quadril quando a perna não alcança o chão.
// Não inventa animação: a fase de apoio de cada pé vem da própria animação do GLB, amostrada ao carregar.

// Cadeias de perna: [articulação superior, articulação do meio, extremidade]. Detecção pelos nomes do rig:
// Varrisco (skin): thighL → shinL → footL. Velsari (nós): *_HipOrShoulder → *_Knee → *_Ankle.
export function detectarCadeias(raiz) {
  const fins = [];
  raiz.traverse((o) => {
    const n = o.name ?? '';
    if (/(^|_)(foot|ankle|paw)[LR]?$/i.test(n)) fins.push(o);
  });
  // Tarruco: *_ShoulderHip → (joelho sem nome padrão) → *_Paw. Exige só que a cadeia não suba até o corpo.
  const cadeias = [];
  for (const fim of fins) {
    const meio = fim.parent, sup = meio?.parent;
    if (!meio || !sup || sup === raiz || /(body|pelvis|root|torso|corpo)$/i.test(sup.name) || /(body|pelvis|root)$/i.test(meio.name)) continue;
    cadeias.push([sup.name, meio.name, fim.name]);
  }
  return cadeias;
}

// Amostra cada clipe num clone dedicado: altura de cada pé (espaço do modelo) por fase → tabela de apoio.
export function analisarPassadas(THREE, modelo, clipes, cadeias, frente = '+X') {
  const mixer = new THREE.AnimationMixer(modelo);
  const raizInv = new THREE.Matrix4();
  const v = new THREE.Vector3();
  modelo.updateMatrixWorld(true);
  const caixa = new THREE.Box3().setFromObject(modelo);
  const fins = cadeias.map((c) => modelo.getObjectByName(c[2]));
  raizInv.copy(modelo.matrixWorld).invert();
  const alturaRepouso = fins.map((f) => f.getWorldPosition(v).applyMatrix4(raizInv).y - caixa.min.y);
  const pos = (o) => o.getWorldPosition(new THREE.Vector3()).applyMatrix4(raizInv);
  const comprimentos = fins.map((f) => pos(f.parent.parent).distanceTo(pos(f.parent)) + pos(f.parent).distanceTo(pos(f)));
  const N = 32;
  const tabelas = {};
  for (const clipe of clipes) {
    const acao = mixer.clipAction(clipe);
    acao.play();
    const ys = fins.map(() => []), xs = fins.map(() => []);
    for (let i = 0; i < N; i++) {
      mixer.setTime((i / N) * clipe.duration);
      modelo.updateMatrixWorld(true);
      raizInv.copy(modelo.matrixWorld).invert();
      fins.forEach((f, k) => { f.getWorldPosition(v).applyMatrix4(raizInv); ys[k].push(v.y - caixa.min.y); xs[k].push(v.clone()); });
    }
    acao.stop();
    const eixo = frente[1] === 'X' ? 'x' : 'z', sinal = frente[0] === '-' ? -1 : 1;
    const dtq = clipe.duration / N;
    tabelas[clipe.name] = fins.map((_, k) => {
      const mn = Math.min(...ys[k]), mx = Math.max(...ys[k]);
      // Velocidade do pé ao longo da frente (diferença central, ciclo fechado).
      const vf = ys[k].map((_, i) => ((xs[k][(i + 1) % N][eixo] - xs[k][(i + N - 1) % N][eixo]) * sinal) / (2 * dtq));
      const varre = Math.max(...vf.map(Math.abs)) > 0.08;
      // Apoio: ciclo de locomoção → pé na metade baixa da trajetória E indo para trás (pernas em pêndulo ficam
      // mais baixas no meio do balanço, então só a altura engana). Clipe parado → pé baixo.
      const apoio = varre
        ? ys[k].map((y, i) => vf[i] < 0 && y <= mn + 0.6 * (mx - mn))
        : ys[k].map((y) => y <= mn + Math.max(0.012, 0.22 * (mx - mn)));
      // Velocidade do pé para trás no apoio (unidades do modelo/s) = velocidade do corpo em que o pé apoiado
      // fica parado no chão — base da sincronização animação × deslocamento.
      const vs = vf.filter((_, i) => apoio[i]).map((v) => -v).sort((a, b) => a - b);
      const vApoio = varre && vs.length ? vs[Math.floor(vs.length / 2)] : 0;
      // Clipes em que o pé desce bem abaixo do repouso (deitar, morrer) ficam sem IK.
      return { apoio, yMin: mn, yMax: mx, vApoio, semIK: mn < alturaRepouso[k] * 0.55 && alturaRepouso[k] - mn > 0.15 * comprimentos[k] };
    });
    // Mediana entre os pés (positiva = ciclo de locomoção para a frente).
    const vs = tabelas[clipe.name].map((x) => x.vApoio).sort((a, b) => a - b);
    tabelas[clipe.name].vNatural = vs[Math.floor(vs.length / 2)];
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(modelo);
  return { N, tabelas, alturaRepouso };
}

const tmp = {};
function vetores(THREE) {
  if (!tmp.ok) Object.assign(tmp, { ok: true, A: new THREE.Vector3(), B: new THREE.Vector3(), C: new THREE.Vector3(), T: new THREE.Vector3(), d: new THREE.Vector3(), p: new THREE.Vector3(), u: new THREE.Vector3(), w: new THREE.Vector3(), q: new THREE.Quaternion(), qa: new THREE.Quaternion(), qp: new THREE.Quaternion() });
  return tmp;
}

// D3: distância hipo-pé (d) permitida pelo ângulo do joelho [min,max] (lei dos cossenos), intersectada com o
// alcance puramente geométrico (|l1-l2|..l1+l2). Pura/sem THREE para poder ser testada isoladamente.
export function clampDistanciaJoelho(l1, l2, d, joelhoMinRad, joelhoMaxRad) {
  const l1l2 = 2 * l1 * l2;
  const dMin = Math.max(Math.abs(l1 - l2) + 1e-4, Math.sqrt(Math.max(0, l1 * l1 + l2 * l2 - l1l2 * Math.cos(joelhoMinRad))));
  const dMax = Math.min(l1 + l2 - 1e-4, Math.sqrt(Math.max(0, l1 * l1 + l2 * l2 - l1l2 * Math.cos(joelhoMaxRad))));
  return Math.min(dMax, Math.max(dMin, d));
}

// Gira um osso (no espaço do mundo) para levar a direção `de` à direção `para`.
function girarOsso(THREE, osso, de, para) {
  const s = vetores(THREE);
  if (de.lengthSq() < 1e-10 || para.lengthSq() < 1e-10) return;
  s.q.setFromUnitVectors(de.clone().normalize(), para.clone().normalize());
  osso.getWorldQuaternion(s.qa);
  osso.parent.getWorldQuaternion(s.qp);
  osso.quaternion.copy(s.qp.invert().multiply(s.q.multiply(s.qa)));
  osso.updateMatrixWorld(true);
}

export class ControlePernas {
  // `limites`: { joelhoMinGraus, joelhoMaxGraus } — ângulo interno do joelho (0°=totalmente dobrado,
  // 180°=perna reta). Padrão genérico de quadrúpede (nunca usar faixas humanas); espécie/rig pode
  // sobrescrever passando `limites` ao construir.
  constructor(THREE, modelo, cadeias, analise, limites = {}) {
    this.THREE = THREE;
    this.analise = analise;
    // Padrão calibrado contra o GLB real do Velsari (walk/run/leap, pernas dianteira e traseira):
    // joelho varia ~139°–178° — bem mais reto que um palpite "humano". 15°/179° dá margem sem travar
    // nenhum clipe real observado; espécie com rig muito diferente pode sobrescrever via `limites`.
    const { joelhoMinGraus = 15, joelhoMaxGraus = 179 } = limites;
    this.joelhoMinRad = (joelhoMinGraus * Math.PI) / 180;
    this.joelhoMaxRad = (joelhoMaxGraus * Math.PI) / 180;
    this.pernas = cadeias.map((c, k) => {
      const sup = modelo.getObjectByName(c[0]), meio = modelo.getObjectByName(c[1]), fim = modelo.getObjectByName(c[2]);
      return { nome: c[2], sup, meio, fim, k, repouso: [sup.quaternion.clone(), meio.quaternion.clone(), fim.quaternion.clone()], trava: null, peso: 0, apoioAnt: false, fkAnt: null, finalAnt: null };
    }).filter((p) => p.sup && p.meio && p.fim);
    this.queda = 0;
    this.ligado = true;
    this.met = { quadros: 0, apoioQuadros: 0, deslizeFK: 0, deslizeFinal: 0, erroAlturaFK: 0, erroAlturaFinal: 0, liberacoes: 0 };
  }

  // Antes do mixer: devolve as articulações ao repouso (o mixer só sobrescreve o que o clipe anima).
  restaurar() {
    for (const p of this.pernas) { p.sup.quaternion.copy(p.repouso[0]); p.meio.quaternion.copy(p.repouso[1]); p.fim.quaternion.copy(p.repouso[2]); }
  }

  // Depois do mixer. `acao` = AnimationAction dominante; alturaChao(Xmundo, Zmundo) → Y do chão; escala do modelo.
  atualizar(dt, acao, alturaChao, escala, pivo) {
    const T = this.THREE, s = vetores(T);
    const nomeClipe = acao?.getClip().name;
    const tab = nomeClipe ? this.analise.tabelas[nomeClipe] : null;
    const ativo = this.ligado && tab && !tab.some((x) => x.semIK);
    // Queda do quadril (suavizada) aplicada antes de resolver, no pivô (filho da inclinação).
    pivo.position.y += (-this.queda - pivo.position.y) * Math.min(1, dt * 12);
    pivo.updateMatrixWorld(true);
    if (!ativo) { this.queda += (0 - this.queda) * Math.min(1, dt * 8); for (const p of this.pernas) { p.trava = null; p.peso = 0; p.fkAnt = null; } return; }
    const fase = acao.time / acao.getClip().duration;
    const idx = Math.min(this.analise.N - 1, Math.max(0, Math.floor(fase * this.analise.N)));
    let quedaNecessaria = 0;
    this.met.quadros++;
    for (const p of this.pernas) {
      const info = tab[p.k];
      const apoio = info.apoio[idx];
      const fk = p.fim.getWorldPosition(new T.Vector3());
      const h = this.analise.alturaRepouso[p.k] * escala;
      const chaoFK = alturaChao(fk.x, fk.z);
      const alvo = new T.Vector3();
      if (apoio) {
        if (!p.trava) p.trava = new T.Vector3(fk.x, 0, fk.z);
        const comp = p.sup.getWorldPosition(s.A).distanceTo(p.meio.getWorldPosition(s.B)) + s.B.distanceTo(fk);
        // Animação e corpo muito descompassados: solta o pé (evita esticar a perna) — conta como deslize.
        if (Math.hypot(p.trava.x - fk.x, p.trava.z - fk.z) > comp * 0.35) { p.trava.set(fk.x, 0, fk.z); this.met.liberacoes++; }
        alvo.set(p.trava.x, alturaChao(p.trava.x, p.trava.z) + h, p.trava.z);
        p.peso = Math.min(1, p.peso + dt * 10);
      } else {
        p.trava = null;
        // Balanço: mantém a altura animada do pé acima do chão local (relevo sob o pé, não sob o corpo).
        const base = pivo.parent.getWorldPosition(s.u).y;
        alvo.set(fk.x, chaoFK + Math.max(h, fk.y - base + this.queda), fk.z);
        p.peso = Math.min(1, p.peso + dt * 10);
      }
      // Métricas: deslize horizontal do pé durante o apoio (FK puro × resultado final) e erro de altura no apoio.
      if (apoio && p.fkAnt && p.apoioAnt) {
        this.met.apoioQuadros++;
        this.met.deslizeFK += Math.hypot(fk.x - p.fkAnt.x, fk.z - p.fkAnt.z) / Math.max(1e-3, dt);
        this.met.erroAlturaFK += Math.abs(fk.y - (chaoFK + h));
      }
      p.fkAnt = fk; p.alvo = alvo; p.apoio = apoio;
      // Alcance: se o alvo está além do comprimento da perna, o quadril precisa descer.
      const A = p.sup.getWorldPosition(new T.Vector3());
      const l1 = A.distanceTo(p.meio.getWorldPosition(s.B)), l2 = s.B.distanceTo(fk);
      const falta = A.distanceTo(alvo) - (l1 + l2) * 0.985;
      if (falta > 0) quedaNecessaria = Math.max(quedaNecessaria, falta);
    }
    this.queda += (Math.min(0.25 * escala, quedaNecessaria) - this.queda) * Math.min(1, dt * 6);
    for (const p of this.pernas) {
      const fq = p.fim.getWorldQuaternion(new T.Quaternion());
      const fkPos = p.fim.getWorldPosition(new T.Vector3());
      const alvo = fkPos.clone().lerp(p.alvo, p.peso);
      this.resolver(p, alvo);
      // O pé mantém a orientação animada (só a posição é corrigida).
      p.fim.parent.getWorldQuaternion(s.qp);
      p.fim.quaternion.copy(s.qp.invert().multiply(fq));
      p.fim.updateMatrixWorld(true);
      const fin = p.fim.getWorldPosition(new T.Vector3());
      if (p.apoio && p.finalAnt && p.apoioAntFinal) {
        this.met.deslizeFinal += Math.hypot(fin.x - p.finalAnt.x, fin.z - p.finalAnt.z) / Math.max(1e-3, dt);
        this.met.erroAlturaFinal += Math.abs(fin.y - (alturaChao(fin.x, fin.z) + this.analise.alturaRepouso[p.k] * escala));
      }
      p.finalAnt = fin; p.apoioAntFinal = p.apoio; p.apoioAnt = p.apoio;
    }
  }

  // IK analítico de duas articulações no plano definido pelo joelho animado (preserva a direção da dobra).
  resolver(p, alvo) {
    const T = this.THREE, s = vetores(T);
    const A = p.sup.getWorldPosition(s.A.clone()), B = p.meio.getWorldPosition(s.B.clone()), C = p.fim.getWorldPosition(s.C.clone());
    const l1 = A.distanceTo(B), l2 = B.distanceTo(C);
    const AT = alvo.clone().sub(A);
    // D3: o alvo nunca força o joelho a dobrar/esticar além do limite anatômico da espécie/rig.
    const d = clampDistanciaJoelho(l1, l2, AT.length(), this.joelhoMinRad, this.joelhoMaxRad);
    const dir = AT.normalize();
    const perp = B.clone().sub(A);
    perp.sub(dir.clone().multiplyScalar(perp.dot(dir)));
    if (perp.lengthSq() < 1e-10) return;
    perp.normalize();
    const cosA = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
    const Bn = A.clone().add(dir.clone().multiplyScalar(l1 * cosA)).add(perp.multiplyScalar(l1 * Math.sqrt(1 - cosA * cosA)));
    girarOsso(T, p.sup, B.clone().sub(A), Bn.clone().sub(A));
    const B2 = p.meio.getWorldPosition(new T.Vector3()), C2 = p.fim.getWorldPosition(new T.Vector3());
    const Tn = A.clone().add(dir.multiplyScalar(d));
    girarOsso(T, p.meio, C2.clone().sub(B2), Tn.sub(B2));
  }

  metricas() {
    const m = this.met, n = Math.max(1, m.apoioQuadros);
    return { quadros: m.quadros, amostrasApoio: m.apoioQuadros, deslizeApoioFK_ms: +(m.deslizeFK / n).toFixed(3), deslizeApoioIK_ms: +(m.deslizeFinal / n).toFixed(3), erroAlturaFK_m: +(m.erroAlturaFK / n).toFixed(3), erroAlturaIK_m: +(m.erroAlturaFinal / n).toFixed(3), liberacoes: m.liberacoes };
  }
}
