// V7 no navegador: o que o inspetor mostra e o que a cena desenha para as capacidades experimentais.
// Tudo aqui é PROTÓTIPO de laboratório — nenhum efeito, osso ou cupinzeiro é asset aprovado. A arte
// definitiva de VFX é do Agente 04; ferimentos permanentes em textura, dos Agentes 02 e 04.
import { intensidadeVeneno, resistenciaVeneno, sintomasVeneno } from '../eco/veneno.js';
import { CLIMAS, temperaturaAmbiente } from '../eco/clima.js';
import { temperaturaCorporal } from '../eco/termo.js';
import { acessoCupins } from '../eco/cupins.js';
import { fatorAsas } from '../eco/voo.js';
import { EfeitosDeAreia } from './areia3d.js';
import { dobrarSerpente } from './serpente3d.js';

const chip = (txt, cls = '') => `<span class="chip ${cls}">${txt}</span>`;
const linha = (dt, dd) => `<dt>${dt}</dt><dd>${dd}</dd>`;
const barra = (f) => `<div class="barra"><i style="width:${Math.max(0, Math.min(100, f * 100))}%"></i></div>`;

// Linhas extras do inspetor. Só aparecem para quem tem a capacidade ou está sob o efeito.
export function fichaV7(a, m) {
  const e = a.especie, out = [];
  const caps = e.experimental?.capacidades ?? [];
  if (e.experimental) out.push(linha('V7', `${e.experimental.hipotetica ? chip('espécie hipotética', 'perigo') : chip('ficha experimental')}${caps.map((c) => chip(c, 'ok')).join('')}${e.experimental.proxyVisual ? `<div class="sub">corpo: ${e.experimental.proxyVisual}</div>` : ''}`));
  if (!a.vivo) {
    const c = m.carcacas.find((x) => x.animal === a.id);
    if (c?.estagio) out.push(linha('Carcaça', `${chip(c.estagio, c.estagio === 'ossos' ? '' : 'perigo')} carne ${c.carne.toFixed(2)}/${c.carneInicial} kg · decomposição ${(c.decomposicao * 100).toFixed(0)}%${barra(c.carne / c.carneInicial)}insetos ${Math.floor(c.insetos)} · comido por animais ${Object.values(c.consumo).reduce((s, v) => s + v, 0).toFixed(2)} kg · por insetos ${c.consumoInsetos.toFixed(2)} kg · apodreceu ${c.perdaDecomposicao.toFixed(2)} kg · ossos ${c.ossosKg.toFixed(2)} kg`));
    else if (!c) out.push(linha('Carcaça', 'reciclada'));
    return out.join('');
  }
  if (a.veneno) out.push(linha('Glândula', `${a.veneno.reserva.toFixed(1)}/${e.veneno.reservaMg} mg · ${e.veneno.tipo} · inoculou ${a.veneno.inoculacoes}× · secas ${a.veneno.secas}${barra(a.veneno.reserva / e.veneno.reservaMg)}`));
  const iv = intensidadeVeneno(a, m.t);
  if (iv > 0.005) {
    const carga = a.saude.venenos.reduce((s, v) => s + v.carga, 0);
    out.push(linha('Veneno', `carga ${carga.toFixed(2)} · efeito ${iv.toFixed(2)} · resistência ${(resistenciaVeneno(a) * 100).toFixed(0)}% · dano ${(a.saude.veneno?.danoPorSeg ?? 0).toFixed(2)}/s<div>${sintomasVeneno(a).map((s) => chip(s, 'perigo')).join('') || chip('em absorção')}</div>`));
  }
  if (a.camuflagem) {
    const c = a.camuflagem;
    const b = (v, r) => `<button data-v7="camo:${v}" class="${String(c.forcar) === v ? 'ativo' : ''}">${r}</button>`;
    out.push(linha('Camuflagem', `${c.ligada ? chip('ligada', 'ok') : chip('desligada')} ${(c.intensidade * 100).toFixed(0)}% · ${c.motivo} · gastou ${c.energiaGasta.toFixed(1)} de energia${barra(c.intensidade)}<div>${b('null', 'IA decide')}${b('true', 'forçar ligada')}${b('false', 'forçar desligada')}</div>`));
  }
  if (a.voo) {
    const v = a.voo;
    out.push(linha('Voo', `${chip(v.fase, v.fase === 'solo' ? '' : 'ok')} ${v.fase === 'solo' ? '' : `${v.modo} · `}altitude ${v.alt.toFixed(1)} m · vertical ${v.vz.toFixed(1)} m/s · horizontal ${a.velocidade.toFixed(1)} m/s · asas ${(fatorAsas(a) * 100).toFixed(0)}%<div class="sub">decolagens ${v.decolagens} · pousos ${v.pousos} · quedas ${v.quedas} · desvios ${v.desvios} · ${v.metros.toFixed(0)} m voados · energia de voo ${v.energiaGasta.toFixed(1)}${v.negado ? ` · não decola: ${v.negado}` : ''}</div>`));
    const viz = a.contatos.filter((k) => k.via === 'visao' && k.especie === e.id && k.noAr);
    if (e.voo.bando) out.push(linha('Bando', viz.length ? `${viz.length} vizinhos no ar · mais próximo a ${Math.min(...viz.map((k) => k.distancia)).toFixed(1)} m` : 'sem vizinhos no ar à vista'));
  }
  if (e.taticasDeEmboscada) {
    const em = a.mente.emboscada;
    out.push(linha('Tática', em ? `emboscada · ${em.fase} há ${(m.t - em.desde).toFixed(0)} s · dispara a ${e.taticasDeEmboscada.distanciaDisparoM} m` : a.mente.caca ? 'caça ativa' : m.t < (a.mente.semEmboscadaAte ?? 0) ? 'entre emboscadas' : 'procurando cobertura'));
  } else if (e.papel === 'carnivoro' && a.mente.caca) out.push(linha('Tática', a.estado === 'espreitando' ? 'espreita' : a.estado === 'acompanhando_presa' ? 'aguarda o veneno' : 'perseguição'));
  if (e.dieta.cupins) {
    const mem = [...(a.memoria.cupinzeiros?.values() ?? [])];
    out.push(linha('Cupins', `comeu ${(a.cupinsComidos ?? 0).toFixed(0)} · conhece ${mem.length ? mem.map((c) => { const r = m.cupinzeiros.find((x) => x.id === c.id); return `${c.id}${c.vazio ? ' (esgotado)' : r ? ` (${Math.round(r.populacao)}, ${Math.round(acessoCupins(r) * 100)}% ao alcance)` : ''}`; }).join(', ') : 'nenhum cupinzeiro'}`));
  }
  const tAmb = temperaturaAmbiente(m);
  if (e.percepcao.termorrecepcao) {
    const q = a.contatos.filter((k) => k.via === 'termico');
    out.push(linha('Calor', `ar ${tAmb.toFixed(1)} °C · ${q.length ? q.map((k) => `fonte a ${k.distancia.toFixed(1)} m (+${k.contrasteC} °C, sinal ${k.sinal})`).join('; ') : 'nenhuma fonte'}`));
  } else out.push(linha('Temp.', `corpo ${temperaturaCorporal(a, tAmb).toFixed(1)} °C · ar ${tAmb.toFixed(1)} °C`));
  return out.join('');
}

// Linha do mundo (clima, cupinzeiros, carcaças, efeitos ativos) + controles de clima do laboratório.
export function painelMundoV7(m, cenaV7) {
  const at = m.climaAtivo, tAmb = temperaturaAmbiente(m);
  const bot = (tipo) => `<button data-v7="clima:${tipo}">${CLIMAS[tipo].nome}</button>`;
  const clima = at ? `${chip(at.nome, 'perigo')} ${(at.intensidade * 100).toFixed(0)}% · visão dos animais ×${at.visao.toFixed(2)} · audição ×${at.audicao.toFixed(2)} · locomoção ×${at.locomocao.toFixed(2)} · voo ×${at.voo.toFixed(2)} · resta ${at.restaSeg.toFixed(0)} s <button data-v7="clima:fim">encerrar</button>` : `céu limpo ${Object.keys(CLIMAS).map(bot).join('')}`;
  const cup = m.cupinzeiros.length ? `<br>cupinzeiros: ${m.cupinzeiros.map((c) => `${c.id} ${c.extinta ? 'extinto' : Math.round(c.populacao)}${c.aberto > 0.05 ? ` (aberto ${Math.round(c.aberto * 100)}%)` : ''}`).join(' · ')}` : '';
  const car = m.cenario.decomposicao && m.carcacas.length ? `<br>carcaças: ${m.carcacas.map((c) => `${c.animal} ${c.estagio} ${c.carne.toFixed(1)} kg${c.insetos >= 1 ? ` · ${Math.floor(c.insetos)} insetos` : ''}`).join(' · ')}` : '';
  const fx = cenaV7 ? `<br>efeitos V7: ${cenaV7.sangue.ativas()} partículas de sangue · ${cenaV7.manchasAtivas()} marcas no chão · ${cenaV7.particulasClima()} partículas de clima` : '';
  return `<br>ar ${tAmb.toFixed(1)} °C · ${clima}${cup}${car}${fx}`;
}

// Cliques nos controles experimentais. Mexem só nesta simulação; nenhuma ficha é alterada.
export function instalarControlesV7(elementos, est) {
  for (const el of elementos) el.addEventListener('click', (ev) => {
    const cmd = ev.target.closest?.('[data-v7]')?.dataset.v7;
    const m = est.mundo;
    if (!cmd || !m) return;
    const [qual, valor] = cmd.split(':');
    const a = est.sel && m.porId.get(est.sel);
    if (qual === 'camo' && a?.camuflagem) a.camuflagem.forcar = valor === 'null' ? null : valor === 'true';
    if (qual === 'clima') { if (valor === 'fim') m.encerrarClima(); else m.iniciarClima(valor, { intensidade: 1, duracaoSeg: 90 }); }
  });
}

// Osso do rig mais próximo da região ferida. Sem osso reconhecível, usa o centro do corpo (declarado no retorno).
const OSSO_REGIAO = { cabeca: /head|jaw|beak|skull/i, pescoco: /neck/i, tronco: /spine|chest|torso|body|cephalo/i, flanco: /wing|hip|pelvis|abdomen|flank/i, pernas: /thigh|shank|calf|knee|leg|foot/i, cauda: /tail/i };
function pontoDaRegiao(THREE, v, regiao, a) {
  const cache = (v.ossosRegiao ??= {});
  if (!(regiao in cache)) {
    let achado = null;
    v.modelo.traverse((o) => { if (!achado && (o.isBone || o.type === 'Object3D') && OSSO_REGIAO[regiao]?.test(o.name)) achado = o; });
    cache[regiao] = achado;
  }
  const p = new THREE.Vector3();
  if (cache[regiao]) { cache[regiao].getWorldPosition(p); return { p, exato: true }; }
  p.copy(v.raiz.position); p.y += a.especie.corpo.alturaM * a.escala * 0.55;
  return { p, exato: false };
}

const MAX_MANCHAS = 80, VIDA_MANCHA = 90, MAX_CLIMA = 1400, MAX_INSETOS_VISIVEIS = 12;

export class CenaV7 {
  constructor(THREE, cena, carregarModelos, gltfs) {
    this.T = THREE; this.cena = cena; this.carregarModelos = carregarModelos; this.gltfs = gltfs;
    this.grupo = new THREE.Group(); this.grupo.name = 'V7_PROTOTIPOS'; cena.add(this.grupo);
    // Sangue: mesmo pool de partículas da areia, com outro material. Nada é criado por golpe.
    this.sangue = new EfeitosDeAreia(THREE, { maximo: 260, lado: 0.09 });
    this.sangue.malha.material.color.set(0x6d0a0a); this.sangue.malha.material.opacity = 0.92;
    this.sangue.ativas = () => this.sangue.p.reduce((s, p) => s + (p.v > 0 ? 1 : 0), 0);
    cena.add(this.sangue.malha);
    // Marcas de sangue no chão: discos instanciados que encolhem e somem.
    const gm = new THREE.CircleGeometry(0.5, 10); gm.rotateX(-Math.PI / 2);
    this.manchas = new THREE.InstancedMesh(gm, new THREE.MeshBasicMaterial({ color: 0x4a0808, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), MAX_MANCHAS);
    this.manchas.frustumCulled = false; this.listaManchas = Array.from({ length: MAX_MANCHAS }, () => ({ v: 0 })); this.proxMancha = 0;
    cena.add(this.manchas);
    // Clima: partículas num volume em volta da câmera.
    this.clima = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }), MAX_CLIMA);
    this.clima.frustumCulled = false; this.clima.count = 0; this.gotas = Array.from({ length: MAX_CLIMA }, () => ({ x: Math.random(), y: Math.random(), z: Math.random(), s: 0.5 + Math.random() }));
    cena.add(this.clima);
    this.m4 = new THREE.Matrix4(); this.v3 = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.e3 = new THREE.Vector3();
    this.cupins = new Map(); this.ossos = new Map(); this.insetos = new Map();
  }

  manchasAtivas() { return this.listaManchas.reduce((s, p) => s + (p.v > 0 ? 1 : 0), 0); }
  particulasClima() { return this.clima.count; }

  async reiniciar(m, alturaEm) {
    for (const mapa of [this.cupins, this.ossos, this.insetos]) { for (const o of mapa.values()) this.grupo.remove(o); mapa.clear(); }
    for (const p of this.listaManchas) p.v = 0;
    for (const p of this.sangue.p) p.v = 0;
    this.sangue.esconder(); this.evVistos = 0; this.fogBase = null; this.fundoBase = null; this.modeloInseto = null;
    const T = this.T, W = m.terreno.largura / 2, D = m.terreno.profundidade / 2;
    // Cupinzeiro PROXY: cone de terra. Não existe GLB de cupinzeiro no catálogo.
    for (const c of m.cupinzeiros) {
      const g = new T.Mesh(new T.ConeGeometry(0.9, c.alturaM, 7), new T.MeshStandardMaterial({ color: 0x8a6240, roughness: 1, flatShading: true }));
      g.castShadow = true; g.receiveShadow = true; g.userData.proxy = 'cupinzeiro experimental';
      g.position.set(c.x - W, alturaEm(c.x, c.y) + c.alturaM / 2, c.y - D);
      this.cupins.set(c.id, g); this.grupo.add(g);
    }
    const nec = m.cenario.decomposicao?.necrofagos;
    if (nec?.glb) {
      // Inseto necrófago: GLB real do catálogo (detritívoros), lido como está.
      try { await this.carregarModelos(T, [{ id: nec.especie, nome: nec.especie, corpo: { comprimentoM: 0.14 }, modelo: { glb: nec.glb, clipes: {} } }], () => {}, {}); this.modeloInseto = this.gltfs.get(nec.especie)?.scene ?? null; } catch { this.modeloInseto = null; }
    }
  }

  // Esqueleto PROXY procedural (espinha, costelas, crânio), dimensionado pelo corpo da espécie.
  // Não é o esqueleto anatômico da criatura.
  criarOssos(especie) {
    const T = this.T, g = new T.Group(), mat = new T.MeshStandardMaterial({ color: 0xe6dfcd, roughness: 0.9, flatShading: true });
    const L = especie.corpo.comprimentoM, H = especie.corpo.alturaM, r = Math.max(0.015, H * 0.03);
    const esp = new T.Mesh(new T.CylinderGeometry(r, r, L * 0.7, 5), mat); esp.rotation.z = Math.PI / 2; esp.position.y = r; g.add(esp);
    const n = Math.max(3, Math.min(9, Math.round(L * 3)));
    for (let i = 0; i < n; i++) {
      const c = new T.Mesh(new T.TorusGeometry(H * 0.22, r * 0.6, 4, 8, Math.PI), mat);
      c.position.set(-L * 0.05 + (i / n) * L * 0.4, r, 0); c.rotation.y = Math.PI / 2; g.add(c);
    }
    const cr = new T.Mesh(new T.BoxGeometry(L * 0.16, H * 0.14, H * 0.16), mat); cr.position.set(L * 0.42, H * 0.07, 0); g.add(cr);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.userData.proxy = 'ossos procedurais experimentais';
    return g;
  }

  quadro(m, est, dtReal, camera, alturaEm) {
    const T = this.T, W = m.terreno.largura / 2, D = m.terreno.profundidade / 2;
    // ---- Sangue: nasce do FERIMENTO registrado, no osso da região atingida. Golpe que erra não gera evento.
    for (; this.evVistos < m.eventos.length; this.evVistos++) {
      const e = m.eventos[this.evVistos];
      if (e.tipo !== 'ferimento') continue;
      const a = m.porId.get(e.id) ?? m.mortos.get(e.id), v = est.animais.get(e.id);
      if (!a || !v) continue;
      const { p } = pontoDaRegiao(T, v, e.regiao, a);
      const n = Math.round(4 + 46 * Math.min(1, e.gravidade * 2.5));
      this.sangue.emitir(p.x, p.y, p.z, n, { espalha: 0.9 + e.gravidade * 2, subida: 1 + e.gravidade * 3, escala: 0.7 + e.gravidade * 2, vida: 0.7 });
      this.mancha(p.x, alturaEm(p.x + W, p.z + D), p.z, 0.25 + e.gravidade * 1.6);
    }
    // Sangramento ativo: goteja enquanto o ferimento sangra (e para quando coagula).
    if (est.rodando) for (const a of m.vivos) {
      const v = est.animais.get(a.id);
      if (!v || a.subsolo?.fase === 'submerso') continue;
      for (const f of a.saude.ferimentos) {
        if (f.sangramento <= 0.05 || Math.random() > dtReal * 5 * Math.min(1, f.sangramento * 2)) continue;
        const { p } = pontoDaRegiao(T, v, f.regiao, a);
        this.sangue.emitir(p.x, p.y, p.z, 1, { espalha: 0.15, subida: 0.2, escala: 0.6, vida: 0.8 });
        if (Math.random() < 0.25) this.mancha(p.x, alturaEm(p.x + W, p.z + D), p.z, 0.12 + f.sangramento * 0.25);
      }
    }
    this.sangue.atualizar(dtReal, camera);
    for (let i = 0; i < MAX_MANCHAS; i++) {
      const p = this.listaManchas[i];
      if (p.v > 0 && est.rodando) p.v -= dtReal * est.vel;
      const s = p.v > 0 ? p.r * Math.min(1, p.v / (VIDA_MANCHA * 0.3)) : 0;
      this.manchas.setMatrixAt(i, this.m4.compose(this.v3.set(p.x ?? 0, (p.y ?? 0) + 0.03, p.z ?? 0), this.q.identity(), this.e3.set(s, 1, s)));
    }
    this.manchas.instanceMatrix.needsUpdate = true;

    // ---- Camuflagem, voo e carcaça por animal.
    for (const a of m.animais) {
      const v = est.animais.get(a.id);
      if (!v) continue;
      if (a.camuflagem) v.camuflar(a.camuflagem.intensidade, Math.min(1, a.velocidade / a.especie.movimento.corrida), m.t);
      // Corpo longo: a coluna do GLB é dobrada ao longo do corpo simulado, depois do clipe.
      if (a.serpente) dobrarSerpente(T, v, a, W, D);
      if (!a.vivo && m.cenario.decomposicao) {
        const c = m.carcacas.find((x) => x.animal === a.id);
        v.decompor(c ? c.decomposicao : 1, !c || c.estagio === 'ossos');
        let o = this.ossos.get(a.id);
        if (c?.estagio === 'ossos' && !o) { o = this.criarOssos(a.especie); o.position.copy(v.raiz.position); o.rotation.y = v.raiz.rotation.y; this.ossos.set(a.id, o); this.grupo.add(o); }
        if (o) { if (!c) { this.grupo.remove(o); this.ossos.delete(a.id); } else o.scale.setScalar(Math.max(0.35, c.ossosKg / (c.ossosKg0 ?? c.ossosKg))); }
        this.enxame(a.id, c, v.raiz.position, a.especie.corpo.comprimentoM, m.t);
      }
    }
    // ---- Cupinzeiros: a casca aberta aparece como monte mais baixo e escuro.
    for (const c of m.cupinzeiros) {
      const g = this.cupins.get(c.id); if (!g) continue;
      g.scale.set(1 + c.aberto * 0.25, 1 - c.aberto * 0.45, 1 + c.aberto * 0.25);
      g.material.color.setHex(c.extinta ? 0x5a5148 : 0x8a6240).multiplyScalar(1 - c.aberto * 0.3);
    }
    // ---- Clima: a névoa da cena usa o MESMO fator de visão que limita os animais.
    this.desenharClima(m, est, dtReal, camera);
  }

  mancha(x, y, z, r) { const p = this.listaManchas[this.proxMancha]; this.proxMancha = (this.proxMancha + 1) % MAX_MANCHAS; Object.assign(p, { x, y, z, r, v: VIDA_MANCHA }); }

  // Insetos sobre a carcaça: até 12 visíveis por carcaça (a simulação pode contar mais).
  enxame(id, c, pos, comprimento, t) {
    const T = this.T, n = c ? Math.min(MAX_INSETOS_VISIVEIS, Math.floor(c.insetos)) : 0;
    let g = this.insetos.get(id);
    if (!n) { if (g) { this.grupo.remove(g); this.insetos.delete(id); } return; }
    if (!g) { g = new T.Group(); g.position.copy(pos); this.insetos.set(id, g); this.grupo.add(g); }
    while (g.children.length < n) {
      let o;
      if (this.modeloInseto) { o = this.modeloInseto.clone(true); const cx = new T.Box3().setFromObject(o), tam = cx.getSize(new T.Vector3()); o.scale.setScalar(0.14 / Math.max(tam.x, tam.z, 1e-6)); }
      else { o = new T.Mesh(new T.BoxGeometry(0.14, 0.05, 0.08), new T.MeshStandardMaterial({ color: 0x2a221c, flatShading: true })); o.userData.proxy = 'inseto necrófago experimental'; }
      o.userData.fase = Math.random() * 6.28; o.userData.raio = 0.15 + Math.random() * Math.max(0.3, comprimento * 0.45);
      g.add(o);
    }
    while (g.children.length > n) g.remove(g.children[g.children.length - 1]);
    for (const o of g.children) { const ang = o.userData.fase + t * 0.35; o.position.set(Math.cos(ang) * o.userData.raio, 0.02, Math.sin(ang) * o.userData.raio * 0.6); o.rotation.y = -ang - Math.PI / 2; }
  }

  desenharClima(m, est, dtReal, camera) {
    const at = m.climaAtivo, fog = this.cena.fog;
    this.fogBase ??= { near: fog.near, far: fog.far, cor: fog.color.getHex() };
    this.fundoBase ??= this.cena.background.getHex();
    if (!at) { fog.near = this.fogBase.near; fog.far = this.fogBase.far; fog.color.setHex(this.fogBase.cor); this.cena.background.setHex(this.fundoBase); this.clima.count = 0; return; }
    const COR = { chuva_intensa: 0x7d8a93, tempestade_areia: 0xc9a56a, nevasca: 0xe9eef2 }[at.tipo];
    const k = at.intensidade;
    // Alcance visual da cena acompanha o dos animais: referência de 60 m com céu limpo.
    fog.far = this.fogBase.far + (Math.max(8, 60 * at.visao * 1.6) - this.fogBase.far) * k;
    fog.near = Math.min(this.fogBase.near, fog.far * 0.08);
    fog.color.setHex(this.fogBase.cor).lerp(new this.T.Color(COR), k);
    this.cena.background.setHex(this.fundoBase).lerp(new this.T.Color(COR), k);
    const n = Math.round(MAX_CLIMA * k * (at.tipo === 'chuva_intensa' ? 1 : 0.8));
    this.clima.count = n;
    const mat = this.clima.material;
    mat.color.setHex(at.tipo === 'tempestade_areia' ? 0xd6b47c : at.tipo === 'nevasca' ? 0xffffff : 0xb8c6d2);
    const caixa = 46, t = performance.now() / 1000;
    const vel = at.tipo === 'chuva_intensa' ? { x: 2, y: -26 } : at.tipo === 'tempestade_areia' ? { x: 22, y: -1 } : { x: 6, y: -3 };
    const sx = at.tipo === 'chuva_intensa' ? 0.03 : at.tipo === 'tempestade_areia' ? 0.5 : 0.1, sy = at.tipo === 'chuva_intensa' ? 0.7 : at.tipo === 'tempestade_areia' ? 0.12 : 0.1;
    for (let i = 0; i < n; i++) {
      const g = this.gotas[i];
      const px = ((g.x * caixa + vel.x * t * g.s) % caixa + caixa) % caixa - caixa / 2;
      const py = ((g.y * 26 + vel.y * t * g.s) % 26 + 26) % 26 - 6;
      const pz = (g.z - 0.5) * caixa + Math.sin(t * 0.7 + i) * (at.tipo === 'nevasca' ? 1.2 : 0.2);
      this.m4.compose(this.v3.set(camera.position.x + px, camera.position.y + py - 6, camera.position.z + pz), camera.quaternion, this.e3.set(sx * g.s, sy * g.s, 1));
      this.clima.setMatrixAt(i, this.m4);
    }
    this.clima.instanceMatrix.needsUpdate = true;
  }
}
