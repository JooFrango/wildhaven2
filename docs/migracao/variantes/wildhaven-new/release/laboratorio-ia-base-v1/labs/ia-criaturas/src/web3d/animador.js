// Controlador visual de um animal (Three.js). Não decide nada: só mostra o estado do núcleo de IA.
// Hierarquia: raiz (posição + rumo) → inclinação (relevo) → pivô (alinha a frente anatômica a +X) → modelo (escala).
// Convenção da simulação: rumo d → vetor (cos d, sin d) no plano (x, y) = (X, Z) do Three; rotation.y = −d leva +X a esse vetor.
// V3: patas com IK e travamento no apoio (pernas.js), giro no lugar com os clipes turn_*, inclinação lateral em curvas.
import { ControlePernas } from './pernas.js';

const ROT_FRENTE = { '+X': 0, '-X': Math.PI, '+Z': Math.PI / 2, '-Z': -Math.PI / 2 };
const LOCOMOCAO = ['andar', 'trote', 'corrida'];
// Teto da velocidade de reprodução dos clipes de locomoção. Os clipes dos GLBs foram animados devagar: o `flee`
// do Velsari avança 1,68 m/s na escala do modelo, enquanto a espécie corre até 12,5 m/s. Com o teto antigo (2,5)
// a fuga ficava com o corpo 4,8 m/s mais rápido que as patas — o pé travado era arrastado e soltava. Em 6 a
// cadência cobre 10,1 m/s, perto do que um animal de 1 m faz de verdade (≈5 passadas/s a 9 m/s). O resto aparece
// no inspetor como `desliza`.
const TS_MAX_LOCOMOCAO = 6;
// Estado do núcleo → clipes candidatos (chaves do mapa da espécie), na ordem de preferência. Quando o GLB não tem o clipe\n// (ex.: Velsari sem 'hurt'/'groom'), usa o candidato seguinte — nunca inventa um clipe.
const ESTADO_PARA_CLIPE = {
  intimidando: ['exibicao', 'alerta'], comendo_carcaca: ['comer'], pastando: ['comer'], bebendo: ['beber', 'comer'], vigiando: ['vigiar', 'alerta'], alerta: ['alerta'],
  observando_rival: ['alerta'], farejando: ['farejar', 'alerta'], descansando: ['descansar'], escondido: ['parado'], atordoado: ['ferido', 'alerta'], cortejando: ['exibicao', 'chamar'],
  caido: ['ferido', 'alerta'], agarrado: ['ferido', 'alerta'], segurando_presa: ['comer', 'mordida'], cumprimentando: ['chamar', 'farejar', 'alerta'],
  limpando: ['comer', 'farejar'], curioso: ['farejar', 'alerta'], submissao: ['alerta', 'parado'], disputa_social: ['exibicao', 'chamar', 'alerta'],
  observando: ['alerta'], verificando_intruso: ['alerta'], recuando: ['alerta'],
};

export class Animal3D {
  constructor(THREE, clone, gltf, perfil, especie, agente, rigPernas = null) {
    this.THREE = THREE; this.perfil = perfil; this.especie = especie; this.id = agente.id;
    this.raiz = new THREE.Group(); this.inclinacao = new THREE.Group(); this.pivo = new THREE.Group();
    this.modelo = clone(gltf.scene);
    this.modelo.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.animalId = agente.id; } });
    this.pivo.rotation.y = ROT_FRENTE[perfil.frente] ?? 0;
    this.pivo.add(this.modelo); this.inclinacao.add(this.pivo); this.raiz.add(this.inclinacao);
    // Escala pelo comprimento real da ficha ao longo do eixo da frente (não pela altura do GLB).
    const ext = perfil.extensao, eixo = perfil.frente.endsWith('X') ? 0 : 2;
    this.escalaBase = especie.corpo.comprimentoM / ext[eixo];
    this.mixer = new THREE.AnimationMixer(this.modelo);
    this.clipes = new Map(gltf.animations.map((c) => [c.name, c]));
    this.acoes = new Map();
    this.atual = null; this.nomeAtual = null; this.umaVez = null;
    this.yaw = -agente.direcao; this.pitch = 0;
    // `prof` é o deslocamento vertical em relação ao terreno: profundidade na areia (+) ou altitude de voo (−).
    this.ant = { x: agente.x, y: agente.y, z: agente.z, prof: (agente.subsolo?.prof ?? 0) - (agente.voo?.alt ?? 0) }; this.cur = { ...this.ant };
    this.ultimoGolpe = null; this.deslize = 0; this.escala = -1;
    this.aplicarEscala(agente);
    this.pernas = rigPernas?.cadeias.length ? new ControlePernas(THREE, this.modelo, rigPernas.cadeias, rigPernas.analise) : null;
    this.roll = 0; this.tAnim = 0; this.choque = 0; this.queda = 0; this.pesoMira = 0; this.ultimaMira = null;
    this.mirarCabeca(null, 0); // localiza ossos
    this.repPescoco = this.ossoPescoco?.quaternion.clone(); this.repCabeca = this.ossoCabeca?.quaternion.clone();
  }

  // Corpo enterrado não projeta sombra na superfície: a areia está entre ele e o sol.
  projetarSombra(ligado) {
    if (this.sombraLigada === ligado) return;
    this.sombraLigada = ligado;
    this.modelo.traverse((o) => { if (o.isMesh) o.castShadow = ligado; });
  }

  // Camuflagem óptica (PROTÓTIPO de laboratório): o passe de transmissão do three refrata o cenário atrás do
  // corpo. A malha continua desenhada — o contorno distorce o fundo e ondula, mais ainda em movimento.
  // Os materiais do GLB não são alterados: cada malha recebe um material próprio e o original volta ao desligar.
  camuflar(i, frac, t) {
    const T = this.THREE;
    if (i <= 0.02) {
      if (this.camo) { for (const [o, c] of this.camo) { o.material = c.orig; for (const m of c.novos) m.dispose(); } this.camo = null; }
      return;
    }
    if (!this.camo) {
      this.camo = new Map();
      this.modelo.traverse((o) => {
        if (!o.isMesh) return;
        const novos = [];
        // Sem a cor do corpo: a luz transmitida é multiplicada pela cor de base, e a pintura do GLB anularia a refração.
        const conv = () => { const m = new T.MeshPhysicalMaterial({ color: 0xe8efe9, metalness: 0, attenuationDistance: 6, attenuationColor: new T.Color(0xcfe0d6), specularIntensity: 0.6 }); novos.push(m); return m; };
        const orig = o.material;
        o.material = Array.isArray(orig) ? orig.map(conv) : conv(orig);
        this.camo.set(o, { orig, novos });
      });
    }
    const onda = Math.sin(t * 5.2) * 0.5 + 0.5;
    for (const c of this.camo.values()) for (const m of c.novos) {
      m.transmission = i * (0.97 - 0.35 * frac);
      m.thickness = 0.7 + 1.1 * onda * (0.35 + frac);
      m.ior = 1.16 + 0.22 * onda * (0.3 + frac);
      m.roughness = 0.06 + 0.3 * frac;
    }
  }

  // Carcaça (PROTÓTIPO): escurece com a decomposição e some quando só restam ossos (o esqueleto procedural
  // é desenhado pela cena V7). Material próprio por malha; o do GLB não é tocado.
  decompor(fracao, soOssos) {
    if (soOssos) { this.modelo.visible = false; return; }
    if (!this.podre) {
      this.podre = [];
      this.modelo.traverse((o) => {
        if (!o.isMesh) return;
        const conv = (b) => { const m = b.clone(); m.userData.cor0 = b.color ? b.color.clone() : null; this.podre.push(m); return m; };
        o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
      });
    }
    const k = Math.min(1, fracao * 1.3);
    for (const m of this.podre) if (m.userData.cor0) m.color.copy(m.userData.cor0).lerp(new this.THREE.Color(0x2b2118), k * 0.85);
  }

  aplicarEscala(a) {
    const e = this.escalaBase * (a.escala ?? 1);
    if (Math.abs(e - this.escala) < 1e-4) return;
    this.escala = e;
    this.modelo.scale.setScalar(e);
    this.modelo.position.set(0, 0, 0);
    const caixa = new this.THREE.Box3().setFromObject(this.modelo);
    this.modelo.position.y = -caixa.min.y + this.raiz.position.y * 0; // apoia as patas no chão
    this.modelo.updateMatrixWorld(true);
  }

  acao(nomeClipe) {
    if (!nomeClipe || !this.clipes.has(nomeClipe)) return null;
    if (!this.acoes.has(nomeClipe)) this.acoes.set(nomeClipe, this.mixer.clipAction(this.clipes.get(nomeClipe)));
    return this.acoes.get(nomeClipe);
  }

  // Velocidade natural do clipe na escala aplicada (m/s); null se o GLB não permite medir.
  // Preferência: velocidade do pé no apoio medida no rig (pernas.js); senão a da auditoria (varredura do pé).
  velNatural(nome) {
    const vr = this.pernas?.analise.tabelas[nome]?.vNatural;
    if (vr && vr > 0.02) return vr * this.escala;
    const v = this.perfil.clipes[nome]?.velNatural;
    return v ? v * this.escala : null;
  }

  // Chamado a cada passo da simulação (estado novo do núcleo).
  passoSimulacao(a) {
    this.ant = { ...this.cur };
    this.cur = { x: a.x, y: a.y, z: a.z, prof: (a.subsolo?.prof ?? 0) - (a.voo?.alt ?? 0) };
    this.aplicarEscala(a);
    const mapa = this.especie.modelo.clipes;
    // Golpe novo → clipe de ataque uma vez, na velocidade que faz o quadro de impacto do clipe (medido no GLB)
    // coincidir com o instante em que o núcleo resolve o golpe.
    if (a.golpe && a.golpe !== this.ultimoGolpe) {
      this.ultimoGolpe = a.golpe;
      const preparoSim = Math.max(0.05, a.golpe.impacto - a.golpe.inicio);
      this.tocarUmaVez(mapa[a.golpe.nome] ?? mapa.mordida ?? mapa.ataque, null, (a.golpe.clipeImpacto ?? preparoSim) / preparoSim);
    }
    if (!a.vivo) { this.trocar(mapa.morte, false, 1, true); return; }
    if (this.umaVez && this.umaVez.ate > this.tAnim) return;
    this.umaVez = null;
    const [nome, locomocao] = this.escolher(a, mapa);
    let ts = 1;
    if (locomocao) {
      const vn = this.velNatural(nome);
      ts = vn ? Math.min(TS_MAX_LOCOMOCAO, Math.max(0.5, a.velocidade / vn)) : 1;
      this.deslize = vn ? Math.abs(a.velocidade - vn * ts) : 0;
    } else this.deslize = 0;
    this.trocar(nome, locomocao, ts, false);
  }

  escolher(a, mapa) {
    const e = ESTADO_PARA_CLIPE[a.estado];
    // Meio granular: os estados físicos do controlador de areia mandam nos clipes, antes de qualquer andadura.
    const s = a.subsolo;
    if (s && s.fase !== 'superficie') {
      if (s.fase === 'mergulhando' && mapa.mergulho && this.clipes.has(mapa.mergulho)) return [mapa.mergulho, false];
      if (s.fase === 'emergindo' && mapa.emergencia && this.clipes.has(mapa.emergencia)) return [mapa.emergencia, false];
      if (s.fase === 'submerso') {
        const rapido = mapa.subsoloRapido && this.clipes.has(mapa.subsoloRapido) && a.velocidade > (this.especie.subsolo?.cruzeiro ?? 1) * 1.3;
        const raso = mapa.subsoloRaso && this.clipes.has(mapa.subsoloRaso) && s.prof < (this.especie.subsolo?.profundidadePreferidaM ?? 2) * 0.8;
        const nome = rapido ? mapa.subsoloRapido : raso ? mapa.subsoloRaso : mapa.subsolo;
        // `subsolo` só é locomoção quando o clipe de fato descreve o avanço (swim_sand/glide_shallow).
        // Para o Escarvão e o Serracórion é burrow/sand_dig em ciclo: fallback PROVISÓRIO, nunca locomoção medida.
        if (nome && this.clipes.has(nome)) return [nome, (this.especie.subsolo?.cruzeiro ?? 0) >= 2];
      }
    }
    // Ar: a fase do controlador de voo escolhe o clipe (decolagem, batida, planeio, pouso).
    const vo = a.voo;
    if (vo && vo.fase !== 'solo') {
      const n = vo.fase === 'decolando' ? mapa.decolar : vo.fase === 'pousando' && vo.alt < 2.5 ? mapa.pousar
        : vo.modo === 'planeio' ? mapa.planar : vo.vz > 1.5 && mapa.voarForte ? mapa.voarForte : mapa.voar;
      if (n && this.clipes.has(n)) return [n, false];
    }
    if (a.estado === 'espreitando' && mapa.espreita && a.velocidade > 0.1) return [mapa.espreita, true];
    // Giro no lugar (núcleo marca girandoNoLugar): rumo crescente = virar à direita vista de cima (+X → +Z).
    if (a.girandoNoLugar && mapa.girarDir && mapa.girarEsq) { const n = a.velAngular > 0 ? mapa.girarDir : mapa.girarEsq; if (this.clipes.has(n)) return [n, false]; }
    if (a.velocidade > 0.15) {
      // Andadura cuja velocidade natural está mais próxima da real (com histerese simples).
      let melhor = null, dm = Infinity;
      for (const k of LOCOMOCAO) {
        const nome = mapa[k];
        if (!nome || !this.clipes.has(nome)) continue;
        const vn = this.velNatural(nome) ?? this.especie.movimento[k];
        const d = Math.abs(Math.log(Math.max(0.05, a.velocidade) / vn)) - (nome === this.nomeAtual ? 0.15 : 0);
        if (d < dm) { dm = d; melhor = nome; }
      }
      if (a.estado === 'fugindo' && mapa.fuga && a.velocidade > this.especie.movimento.trote) melhor = mapa.fuga;
      if (melhor) return [melhor, true];
    }
    for (const k of e ?? []) if (mapa[k] && this.clipes.has(mapa[k])) return [mapa[k], false];
    return [mapa.parado ?? 'idle', false];
  }

  trocar(nome, locomocao, ts, travarFim) {
    const nova = this.acao(nome) ?? this.acao(this.especie.modelo.clipes.parado);
    if (!nova) return;
    nova.timeScale = ts;
    if (nova === this.atual) return;
    const velha = this.atual;
    nova.reset();
    if (travarFim) { nova.setLoop(this.THREE.LoopOnce, 1); nova.clampWhenFinished = true; }
    else nova.setLoop(this.THREE.LoopRepeat, Infinity);
    // Transição entre andaduras preserva a fase do passo (evita "tropeço" ao trocar walk ↔ run).
    if (velha && locomocao && this.locomocaoAtual) nova.time = (velha.time / velha.getClip().duration) * nova.getClip().duration;
    nova.play();
    if (velha) velha.crossFadeTo(nova, locomocao && this.locomocaoAtual ? 0.25 : 0.3, false);
    this.atual = nova; this.nomeAtual = nome; this.locomocaoAtual = locomocao;
  }

  // segundos: duração desejada; ou escala direta (ts) quando o tempo de impacto precisa casar com o núcleo.
  tocarUmaVez(nome, segundos, ts = null) {
    const ac = this.acao(nome);
    if (!ac) return;
    ac.reset(); ac.setLoop(this.THREE.LoopOnce, 1); ac.clampWhenFinished = false;
    ac.timeScale = ts != null ? Math.max(0.5, Math.min(2.5, ts)) : Math.max(0.6, Math.min(2, ac.getClip().duration / Math.max(0.3, segundos)));
    ac.play();
    if (this.atual && this.atual !== ac) this.atual.crossFadeTo(ac, 0.12, false);
    this.atual = ac; this.nomeAtual = nome; this.locomocaoAtual = false;
    this.umaVez = { ate: this.tAnim + ac.getClip().duration / ac.timeScale, nome };
  }

  reagirImpacto() {
    this.choque = 1; // tranco do corpo no impacto (procedural, decai em ~0,3 s)
    const mapa = this.especie.modelo.clipes;
    if (this.umaVez && this.umaVez.ate > this.tAnim) return; // não corta um golpe em andamento
    if (mapa.ferido && this.clipes.has(mapa.ferido)) this.tocarUmaVez(mapa.ferido, 0.6);
  }

  // Mira do pescoço/cabeça (ossos reais neck/head): durante mordida, bote e agarrão o clipe não abaixa a cabeça até\n  // o alvo; gira o pescoço (60%) e a cabeça (40%) em torno do eixo lateral até a altura do corpo do alvo.
  mirarCabeca(alvo, peso) {
    const T = this.THREE;
    if (this.ossoPescoco === undefined) {
      this.ossoPescoco = null; this.ossoCabeca = null;
      this.modelo.traverse((o) => { if (!this.ossoPescoco && /neck/i.test(o.name) && !/taper/i.test(o.name)) this.ossoPescoco = o; if (!this.ossoCabeca && /(^|_)head$/i.test(o.name)) this.ossoCabeca = o; });
    }
    if (!this.ossoCabeca || !alvo || peso <= 0.01) return;
    const cab = this.ossoCabeca.getWorldPosition(new T.Vector3());
    const dx = alvo.x - cab.x, dz = alvo.z - cab.z, dy = alvo.y - cab.y;
    // Referência é o rumo do próprio corpo (a cabeça só sobe/desce): alvo atrás da cabeça não inverte o giro.
    const fwd = new T.Vector3(Math.cos(-this.yaw), 0, Math.sin(-this.yaw));
    const horiz = Math.max(0.3, dx * fwd.x + dz * fwd.z);
    const ang = Math.max(-1.0, Math.min(0.3, Math.atan2(dy, horiz)));
    const eixo = new T.Vector3(0, 1, 0).cross(fwd).normalize();
    const girar = (osso, theta) => {
      if (!osso) return;
      const q = new T.Quaternion().setFromAxisAngle(eixo, theta);
      const qw = osso.getWorldQuaternion(new T.Quaternion()), qp = osso.parent.getWorldQuaternion(new T.Quaternion());
      osso.quaternion.copy(qp.invert().multiply(q.multiply(qw)));
      osso.updateMatrixWorld(true);
    };
    const theta = -ang * peso;
    girar(this.ossoPescoco, theta * (this.ossoPescoco ? 0.6 : 0));
    girar(this.ossoCabeca, theta * (this.ossoPescoco ? 0.4 : 1));
  }

  // Chamado a cada quadro: interpola posição, suaviza rumo e inclinação, avança a animação.
  // posAlvo(id) (opcional): posição no mundo do corpo de outro animal (para a mira da cabeça).
  quadro(alfa, dtReal, a, terreno, alturaEm, posAlvo = null) {
    const x = this.ant.x + (this.cur.x - this.ant.x) * alfa, y = this.ant.y + (this.cur.y - this.ant.y) * alfa;
    const W = terreno.largura / 2, D = terreno.profundidade / 2;
    // Profundidade: o corpo afunda na areia pelo mesmo valor que a simulação usa (centro do corpo).
    this.prof = (this.ant.prof ?? 0) + ((this.cur.prof ?? 0) - (this.ant.prof ?? 0)) * alfa;
    this.raiz.position.set(x - W, alturaEm(x, y) - this.prof, y - D);
    // Rumo: aproxima do alvo com taxa limitada (sem estalos de 0,1 s).
    let alvo = -a.direcao, dif = alvo - this.yaw;
    while (dif > Math.PI) dif -= 2 * Math.PI;
    while (dif < -Math.PI) dif += 2 * Math.PI;
    this.yaw += Math.max(-8 * dtReal, Math.min(8 * dtReal, dif));
    this.raiz.rotation.y = this.yaw;
    // Inclinação ao longo do corpo, pelo relevo à frente e atrás (patas acompanham o chão).
    const meio = (this.especie.corpo.comprimentoM * (a.escala ?? 1)) / 2;
    const cx = Math.cos(a.direcao), cy = Math.sin(a.direcao);
    const hf = alturaEm(x + cx * meio, y + cy * meio), ht = alturaEm(x - cx * meio, y - cy * meio);
    const p = Math.max(-0.35, Math.min(0.35, Math.atan2(hf - ht, 2 * meio)));
    this.pitch += (p - this.pitch) * Math.min(1, dtReal * 6);
    this.inclinacao.rotation.z = this.pitch;
    // Inclinação lateral para dentro da curva (proporcional a v·ω, limitada).
    const r = Math.max(-0.22, Math.min(0.22, (a.velocidade ?? 0) * (a.velAngular ?? 0) * 0.05));
    this.roll += (r - this.roll) * Math.min(1, dtReal * 5);
    // Caído (golpe forte): o GLB não tem clipe de queda — o corpo tomba de lado proceduralmente e se levanta depois.
    this.queda += ((a.estado === 'caido' ? 1 : 0) - this.queda) * Math.min(1, dtReal * (a.estado === 'caido' ? 7 : 3));
    this.choque = Math.max(0, this.choque - dtReal * 3.5);
    // Voo: inclinação lateral na curva e nariz acompanhando a subida/descida (valores do controlador de voo).
    const noAr = a.voo && a.voo.fase !== 'solo';
    this.inclinacao.rotation.x = (noAr ? -a.voo.inclinacao : this.roll) + this.queda * 1.15;
    if (noAr) this.pitch = Math.max(-0.5, Math.min(0.5, Math.atan2(a.voo.vz, Math.max(1, a.velocidade))));
    // O Arenoceto entra com a frente do corpo inclinada para BAIXO; o efeito
    // acompanha a fase física e desaparece ao completar o mergulho.
    // Não é deslocamento falso: a profundidade real vem de a.subsolo.prof.
    const mergulhoArenoceto = this.especie.id === 'arenoceto' && a.subsolo?.fase === 'mergulhando'
      ? -0.19 * Math.sin(Math.PI * Math.max(0, Math.min(1, a.subsolo.progresso))) : 0;
    this.inclinacao.rotation.z = this.pitch + this.choque * 0.12 + mergulhoArenoceto;
    this.tAnim += dtReal;
    this.pernas?.restaurar();
    if (this.ossoPescoco) this.ossoPescoco.quaternion.copy(this.repPescoco); if (this.ossoCabeca) this.ossoCabeca.quaternion.copy(this.repCabeca);
    this.mixer.update(dtReal);
    // Mira: alvo do golpe em curso ou da presa segura na boca.
    const idMira = (a.golpe && /mordida|bote/.test(a.golpe.nome) ? a.golpe.alvo : null) ?? a.agarrando ?? null;
    this.pesoMira += ((idMira ? 1 : 0) - this.pesoMira) * Math.min(1, dtReal * 8);
    if (posAlvo && (idMira || this.pesoMira > 0.02)) { const p = posAlvo(idMira ?? this.ultimaMira); if (p) { this.raiz.updateMatrixWorld(true); this.mirarCabeca(p, this.pesoMira); } }
    if (idMira) this.ultimaMira = idMira;
    if (this.pernas) {
      // Sem IK quando caído de lado ou morto (as patas não devem procurar o chão).
      this.pernas.ligado = (this.ikLigado ?? true) && this.queda < 0.05 && a.vivo !== false && !(a.voo && a.voo.fase !== 'solo');
      this.raiz.updateMatrixWorld(true);
      this.pernas.atualizar(dtReal, this.atual, (X, Z) => alturaEm(Math.min(terreno.largura - 0.01, Math.max(0, X + W)), Math.min(terreno.profundidade - 0.01, Math.max(0, Z + D))), this.escala, this.pivo);
    }
  }

  // Ângulo (graus) entre a frente visual do modelo e o rumo do animal: deve ser ~0 (sem caminhada lateral).
  desvioFrente() {
    const v = new this.THREE.Vector3(1, 0, 0).applyQuaternion(this.pivo.getWorldQuaternion(new this.THREE.Quaternion()));
    const frenteModelo = this.perfil.frente;
    const local = { '+X': [1, 0, 0], '-X': [-1, 0, 0], '+Z': [0, 0, 1], '-Z': [0, 0, -1] }[frenteModelo];
    const w = new this.THREE.Vector3(...local).applyQuaternion(this.modelo.getWorldQuaternion(new this.THREE.Quaternion()));
    w.y = 0; w.normalize();
    const rumo = new this.THREE.Vector3(Math.cos(-this.yaw), 0, Math.sin(-this.yaw));
    void v;
    return (Math.acos(Math.max(-1, Math.min(1, w.dot(rumo)))) * 180) / Math.PI;
  }
}
