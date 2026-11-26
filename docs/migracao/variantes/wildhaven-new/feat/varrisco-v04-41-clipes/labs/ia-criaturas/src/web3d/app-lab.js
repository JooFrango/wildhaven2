// Laboratório do Varrisco (GLB real). Bateria de testes visuais e medidos sobre o mesmo núcleo da simulação:
// os comandos de teste só escolhem destino/olhar/golpe; locomoção, IK, acertos, esquivas e quedas são do núcleo.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { carregarConfigEco } from '../eco/config.js';
import { criarMundoEco, passoEco, hashMundo } from '../eco/mundo.js';
import { altura } from '../eco/terreno.js';
import { capsula, contatoGolpe, iniciarAtaque, perfilGolpe } from '../eco/combate.js';
import { ferir } from '../eco/saude.js';
import { Animal3D } from './animador.js';
import { criarTerreno3D } from './cena.js';
import { carregarModelos, clonarEsqueleto, gltfs, rigs } from './modelos3d.js';

const $ = (id) => document.getElementById(id);
const lerJson = async (rel) => { const r = await fetch(rel, { cache: 'no-store' }); if (!r.ok) throw new Error(`HTTP ${r.status} em ${rel}`); return r.json(); };
const cfg = await carregarConfigEco(lerJson);
const perfis = (await lerJson('config/eco/modelos.json')).perfis;
// A/B/C visual: v02 (17 clipes), v03 (29 clipes) ou v04 (41 clipes).
// Nenhuma selecao modifica a ficha oficial nem a IA da simulacao.
const solicitado = new URLSearchParams(location.search).get('modelo');
const varianteVarrisco = ['v02','v03','v04'].includes(solicitado) ? solicitado : 'v02';
if (varianteVarrisco !== 'v02') {
  const e = cfg.especies.varrisco;
  e.modelo.glb = `assets/models/creatures/varrisco/${varianteVarrisco}/varrisco-animated-${varianteVarrisco}-LOD0.glb`;
  // Fuga/recuo sao escolhas do nucleo, nao golpes novos da IA.
  e.modelo.clipes = { ...e.modelo.clipes, fuga: 'sprint', recuar: 'backstep' };
  const manifest = await lerJson(`/repo/assets/models/creatures/varrisco/${varianteVarrisco}/manifest.json`);
  perfis.varrisco.glb = e.modelo.glb;
  perfis.varrisco.sha256 = manifest.glb.sha256;
  perfis.varrisco.bytes = manifest.glb.bytes;
}

await carregarModelos(THREE, [cfg.especies.varrisco, cfg.especies.velsari], (t) => { $('estado').textContent = t; }, perfis);

// ---------- cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('palco').appendChild(renderer.domElement);
const cena = new THREE.Scene();
cena.background = new THREE.Color(0xcfd8d6);
cena.fog = new THREE.Fog(0xcfd8d6, 90, 260);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true; orbit.maxPolarAngle = Math.PI * 0.49;
cena.add(new THREE.HemisphereLight(0xe8efd8, 0x6b5232, 1.5));
const sol = new THREE.DirectionalLight(0xffe2b0, 2.6); sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048); cena.add(sol, sol.target);
const redimensionar = () => { const w = $('palco').clientWidth, h = $('palco').clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
addEventListener('resize', redimensionar); redimensionar();

// ---------- cenário-base (terreno irregular, campo de rochas, lago) ----------
const BASE = {
  id: 'laboratorio-varrisco', nome: 'Laboratório do Varrisco', dt: 0.1, duracaoSeg: 600,
  relogio: { segundosPorDia: 600, diaInicial: 20, horaInicial: 17.0 },
  clima: { chanceChuvaChuvosa: 0, chanceChuvaSeca: 0, chanceIncendio: 0 },
  terreno: {
    tipo: 'procedural', largura: 140, profundidade: 100, res: 1, amplitude: 3.2, capim: 45,
    lago: { x: 118, y: 78, raio: 7, fundo: 1.5 },
    rochas: [{ x: 66, y: 46, raio: 1.6, altura: 1.5 }, { x: 72, y: 52, raio: 1.4, altura: 1.3 }, { x: 68, y: 57, raio: 1.2, altura: 1.2 }, { x: 75, y: 45, raio: 1.5, altura: 1.4 }, { x: 62, y: 53, raio: 1.3, altura: 1.2 }, { x: 70, y: 41, raio: 1.2, altura: 1.1 }],
    arbustos: [{ x: 30, y: 78, raio: 5, ocultacao: 70, alimento: 20 }, { x: 98, y: 22, raio: 4, ocultacao: 65, alimento: 20 }],
  },
  populacoes: [],
};
const ind = (especie, id, x, y, o = {}) => ({ especie, individuos: [{ id, x, y, ...o }] });

// ---------- estado ----------
const est = { mundo: null, vis: new Map(), terreno3d: null, teste: null, acum: 0, cam: 'seguir', ator: 'v', log: [] };
const alturaEm = (x, y) => { const t = est.mundo.terreno; return altura(t, Math.min(t.largura - 0.01, Math.max(0, x)), Math.min(t.profundidade - 0.01, Math.max(0, y))); };
// Corpo de outro animal no mundo (60% da altura): alvo da mira de cabeça durante mordida/bote/agarrão.
const posAlvo = (id) => { const o = est.mundo.porId.get(id) ?? est.mundo.mortos.get(id), v = est.vis.get(id); return o && v ? v.raiz.position.clone().add(new THREE.Vector3(0, o.especie.corpo.alturaM * o.escala * 0.6, 0)) : null; };
const P = (x, y, dz = 0) => new THREE.Vector3(x - est.mundo.terreno.largura / 2, alturaEm(x, y) + dz, y - est.mundo.terreno.profundidade / 2);

function montar(populacoes, semente = 7) {
  for (const v of est.vis.values()) cena.remove(v.raiz);
  est.vis.clear();
  const cen = { ...BASE, populacoes };
  const cfgT = { ...cfg, cenarios: { ...cfg.cenarios, [cen.id]: cen } };
  const recriar = !est.mundo;
  est.mundo = criarMundoEco(cfgT, cen, semente, {});
  if (recriar || !est.terreno3d) { if (est.terreno3d) cena.remove(est.terreno3d); est.terreno3d = criarTerreno3D(THREE, est.mundo.terreno); cena.add(est.terreno3d); }
  const t = est.mundo.terreno;
  sol.position.set(30, 90, -40); sol.target.position.set(0, 0, 0);
  Object.assign(sol.shadow.camera, { left: -t.largura / 1.6, right: t.largura / 1.6, top: t.profundidade / 1.6, bottom: -t.profundidade / 1.6, far: 300 });
  sol.shadow.camera.updateProjectionMatrix();
  for (const a of est.mundo.vivos) {
    const v = new Animal3D(THREE, clonarEsqueleto, gltfs.get(a.especie.id), perfis[a.especie.id], a.especie, a, rigs.get(a.especie.id));
    v.ikLigado = $('ik').checked;
    est.vis.set(a.id, v); cena.add(v.raiz); v.passoSimulacao(a);
  }
  est.acum = 0;
}

// Um quadro: simulação a 10 Hz, animação a cada quadro (IK, interpolação), câmera.
function quadro(dt, render = true) {
  const m = est.mundo;
  est.acum += dt;
  while (est.acum >= m.dt) {
    est.teste?.passo?.();
    passoEco(m);
    for (const e of m.eventos.slice(-12)) if (e.tipo === 'ferimento' && e.t === +m.t.toFixed(2) && !e._visto) { e._visto = true; est.vis.get(e.id)?.reagirImpacto(); }
    for (const a of m.animais) est.vis.get(a.id)?.passoSimulacao(a);
    est.acum -= m.dt;
  }
  const alfa = Math.min(1, est.acum / m.dt);
  for (const a of m.animais) est.vis.get(a.id)?.quadro(alfa, dt, a, m.terreno, alturaEm, posAlvo);
  est.teste?.medir?.(dt);
  posicionarCamera(dt);
  if (render) renderer.render(cena, camera);
}

function posicionarCamera(dt) {
  const v = est.vis.get(est.ator), a = est.mundo.porId.get(est.ator) ?? est.mundo.mortos.get(est.ator);
  if (!v || !a) return;
  const p = v.raiz.position.clone();
  const fx = Math.cos(a.direcao), fz = Math.sin(a.direcao);
  let alvoCam;
  if (est.cam === 'lateral') alvoCam = p.clone().add(new THREE.Vector3(-fz * 5.2, 0.75, fx * 5.2));
  else if (est.cam === 'patas') alvoCam = p.clone().add(new THREE.Vector3(-fz * 3.4 + fx * 0.2, 0.35, fx * 3.4 + fz * 0.2));
  else if (est.cam === 'cima') alvoCam = p.clone().add(new THREE.Vector3(0.1, 24, 0.1));
  else if (est.cam === 'duelo') {
    // Enquadra atacante e alvo: ponto médio, câmera ao lado da linha entre os dois.
    const idAlvo = a.golpe?.alvo ?? a.agarrando ?? (a.alvo?.tipo === 'criatura' ? a.alvo.id : null) ?? est.alvoCam;
    const o = idAlvo && (est.mundo.porId.get(idAlvo) ?? est.mundo.mortos.get(idAlvo));
    const vo = o && est.vis.get(o.id);
    if (vo) {
      est.alvoCam = o.id;
      const q = vo.raiz.position, mid = p.clone().add(q).multiplyScalar(0.5);
      const lx = q.x - p.x, lz = q.z - p.z, n = Math.hypot(lx, lz) || 1;
      const dd = Math.max(5.5, n * 1.4);
      alvoCam = mid.clone().add(new THREE.Vector3((-lz / n) * dd, 1.4, (lx / n) * dd));
      const k0 = dt > 0 ? Math.min(1, dt * 3) : 1;
      camera.position.lerp(alvoCam, k0); orbit.target.lerp(mid.add(new THREE.Vector3(0, 0.7, 0)), k0); orbit.update();
      return;
    }
    alvoCam = p.clone().add(new THREE.Vector3(-fz * 6, 1.2, fx * 6));
  }
  else if (est.cam === 'seguir') alvoCam = p.clone().add(new THREE.Vector3(-fx * 5 - fz * 3.2, 2.4, -fz * 5 + fx * 3.2));
  else return;
  const k = dt > 0 ? Math.min(1, dt * 3) : 1;
  camera.position.lerp(alvoCam, k);
  orbit.target.lerp(p.clone().add(new THREE.Vector3(0, est.cam === 'patas' ? 0.35 : est.cam === 'lateral' ? 0.7 : 0.9, 0)), k);
  orbit.update();
}

// ---------- comandos de teste ----------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const irPara = (x, y, ritmo = 'andar') => (a) => ({ estado: ritmo === 'corrida' ? 'correndo' : 'andando', codigo: 'teste_ir', motivo: `teste: ir a (${x.toFixed(0)}, ${y.toFixed(0)}) em ${ritmo}`, alvo: null, destino: { x, y }, ritmo });
const parar = (olhar = null) => (a) => ({ estado: 'parado_teste', codigo: 'teste_parar', motivo: 'teste: parado', alvo: null, destino: null, ritmo: 'parado', olharPara: olhar });
const olharAng = (graus) => (a) => ({ estado: 'parado_teste', codigo: 'teste_girar', motivo: `teste: virar para ${graus}°`, alvo: null, destino: null, ritmo: 'parado', olharPara: { x: a.x + Math.cos((graus * Math.PI) / 180) * 20, y: a.y + Math.sin((graus * Math.PI) / 180) * 20 } });
const erroAng = (a, graus) => Math.abs(Math.atan2(Math.sin(a.direcao - (graus * Math.PI) / 180), Math.cos(a.direcao - (graus * Math.PI) / 180))) * 57.3;

// Golpe pedido: aproxima (velocidade limitada) até o membro alcançar o corpo do alvo; então inicia o golpe do
// núcleo (que decide acerto, esquiva, região, impacto). Bote: dispara a ~4 m, o salto leva o corpo à frente.
function golpear(nome, alvoId) {
  let iniciado = false;
  const cmd = (a, m) => {
    const alvo = m.porId.get(alvoId); if (!alvo) return parar()(a);
    const atq = a.especie.combate.ataques.find((x) => x.nome === nome);
    const pg = perfilGolpe(a, atq);
    const ang = Math.atan2(alvo.y - a.y, alvo.x - a.x);
    const erro = Math.abs(Math.atan2(Math.sin(ang - a.direcao), Math.cos(ang - a.direcao)));
    const salto = nome === 'bote' ? a.especie.movimento.corrida * 0.55 * pg.preparo : 0;
    const alcanca = contatoGolpe(a, { ...pg, alcance: pg.alcance + salto * 0.85 }, capsula(alvo), nome).d <= 0.05 && erro < 0.25;
    if (!iniciado && !a.golpe && alcanca && (a.recargas[nome] ?? 0) <= 0) { a.tAtual = m.t; iniciarAtaque(a, alvo, atq, m); iniciado = true; est.log.push(`${m.t.toFixed(1)}s ${a.id} inicia ${nome} (alcance medido ${pg.alcance.toFixed(2)} m)`); }
    if (iniciado) return { estado: 'atacando', codigo: nome, motivo: `teste: ${nome} em ${alvoId}`, alvo: { tipo: 'criatura', id: alvoId, x: alvo.x, y: alvo.y }, destino: nome === 'bote' ? null : { x: alvo.x, y: alvo.y }, ritmo: 'andar', velMax: 0.6, olharPara: { x: alvo.x, y: alvo.y } };
    // Para na distância do alcance (de frente para o alvo), sem encostar o corpo.
    const d = dist(a, alvo), ux = (alvo.x - a.x) / (d || 1), uy = (alvo.y - a.y) / (d || 1);
    const parada = Math.max(0.5, pg.alcance + salto * 0.85 - 0.25);
    const ponto = { x: alvo.x - ux * parada, y: alvo.y - uy * parada };
    const longe = d > (nome === 'bote' ? 8 : 4);
    if (Math.hypot(ponto.x - a.x, ponto.y - a.y) < 0.4) return { estado: 'parado_teste', codigo: 'teste_mirar', motivo: `teste: mira ${nome}`, alvo: null, destino: null, ritmo: 'parado', olharPara: { x: alvo.x, y: alvo.y } };
    return { estado: 'andando', codigo: 'teste_aproximar', motivo: `teste: aproximar para ${nome}`, alvo: null, destino: ponto, ritmo: longe ? 'trote' : 'andar', velMax: longe ? null : 0.9, olharPara: { x: alvo.x, y: alvo.y } };
  };
  cmd.feito = (a) => iniciado && !a.golpe;
  return cmd;
}

// ---------- testes ----------
const C = { x: 38, y: 50 };
const oito = [];
for (let k = 0; k < 8; k++) { const g = k * 45; oito.push({ rotulo: `direção ${g}°`, cmd: irPara(C.x + Math.cos((g * Math.PI) / 180) * 11, C.y + Math.sin((g * Math.PI) / 180) * 11), fim: (a) => dist(a, { x: C.x + Math.cos((g * Math.PI) / 180) * 11, y: C.y + Math.sin((g * Math.PI) / 180) * 11 }) < 1.6, max: 20 }); oito.push({ rotulo: 'volta ao centro', cmd: irPara(C.x, C.y), fim: (a) => dist(a, C) < 1.6, max: 20 }); }

const TESTES = {
  'clipes': { nome: 'Todos os clipes do GLB', tipo: 'clipes', pop: [ind('varrisco', 'v', 40, 50, { fome: 10, energia: 100, sexo: 'M', direcaoGraus: 0 })] },
  'oito-direcoes': { nome: 'Caminhar nas 8 direções', pop: [ind('varrisco', 'v', C.x, C.y, { fome: 10, energia: 100, sexo: 'M', direcaoGraus: 0 })], passos: oito },
  'curvas-giros': { nome: 'Curvas, giro de 90° e 180°', pop: [ind('varrisco', 'v', 20, 30, { fome: 10, energia: 100, sexo: 'M', direcaoGraus: 0 })], passos: [
    { rotulo: 'zigue-zague 1', cmd: irPara(32, 40, 'trote'), fim: (a) => dist(a, { x: 32, y: 40 }) < 2, max: 15 },
    { rotulo: 'zigue-zague 2', cmd: irPara(44, 28, 'trote'), fim: (a) => dist(a, { x: 44, y: 28 }) < 2, max: 15 },
    { rotulo: 'zigue-zague 3', cmd: irPara(56, 40, 'trote'), fim: (a) => dist(a, { x: 56, y: 40 }) < 2, max: 15 },
    { rotulo: 'frear', cmd: parar(), fim: (a) => a.velocidade < 0.05, max: 5 },
    { rotulo: 'giro de 90° no lugar', cmd: (a) => olharAng(Math.round(a.mente.ang0 ?? 0))(a), ini: (a) => { a.mente.ang0 = (a.direcao * 57.3 + 90); }, fim: (a) => erroAng(a, a.mente.ang0) < 4 && Math.abs(a.velAngular ?? 0) < 0.05, max: 6 },
    { rotulo: 'giro de 180° no lugar', cmd: (a) => olharAng(Math.round(a.mente.ang0 ?? 0))(a), ini: (a) => { a.mente.ang0 = (a.direcao * 57.3 + 180); }, fim: (a) => erroAng(a, a.mente.ang0) < 4 && Math.abs(a.velAngular ?? 0) < 0.05, max: 6 },
    { rotulo: 'arrancar após o giro', cmd: (a) => irPara(a.mente.sx, a.mente.sy, 'andar')(a), ini: (a) => { a.mente.sx = a.x + Math.cos(a.direcao) * 10; a.mente.sy = a.y + Math.sin(a.direcao) * 10; }, fim: (a) => dist(a, { x: a.mente.sx, y: a.mente.sy }) < 1.6, max: 12 },
  ] },
  'corrida-irregular': { nome: 'Correr em terreno irregular', pop: [ind('varrisco', 'v', 12, 18, { fome: 10, energia: 100, sexo: 'M', direcaoGraus: 30 })], passos: [
    { rotulo: 'acelerar e correr', cmd: irPara(120, 34, 'corrida'), fim: (a) => dist(a, { x: 120, y: 34 }) < 3, max: 25 },
    { rotulo: 'desacelerar', cmd: parar(), fim: (a) => a.velocidade < 0.05, max: 6 },
  ] },
  'obstaculos': { nome: 'Navegar entre rochas', pop: [ind('varrisco', 'v', 50, 49, { fome: 10, energia: 100, sexo: 'M', direcaoGraus: 0 })], passos: [
    { rotulo: 'atravessar o campo de rochas', cmd: irPara(88, 50, 'trote'), fim: (a) => dist(a, { x: 88, y: 50 }) < 1.8, max: 30 },
    { rotulo: 'voltar pelo meio', cmd: irPara(54, 47, 'andar'), fim: (a) => dist(a, { x: 54, y: 47 }) < 1.8, max: 40 },
  ] },
  'ataques': { nome: 'Bote, mordida e garra (Velsari manequim)', pop: [ind('varrisco', 'v', 40, 50, { fome: 95, energia: 100, sexo: 'M', direcaoGraus: 0 }), ind('velsari', 'alvo', 52, 50, { fome: 10, sede: 5, direcaoGraus: 0 })], manequim: 'alvo', passos: [
    { rotulo: 'aproximar por trás', cmd: irPara(44, 50, 'andar'), fim: (a) => dist(a, { x: 44, y: 50 }) < 1.2, max: 15 },
    { rotulo: 'bote', cmdF: () => golpear('bote', 'alvo'), max: 8 },
    { rotulo: 'mordida', cmdF: () => golpear('mordida', 'alvo'), max: 8 },
    { rotulo: 'garra (alvo caído ou preso)', cmdF: () => golpear('garra_foice', 'alvo'), max: 6 },
    { rotulo: 'mordida 2', cmdF: () => golpear('mordida', 'alvo'), max: 8 },
  ] },
  'caca-real': { nome: 'Caça real: Varrisco × Velsaris (IA livre)', livre: 70, pop: [ind('varrisco', 'v', 30, 30, { fome: 95, energia: 100, sexo: 'M', direcaoGraus: 20 }), { especie: 'velsari', grupos: [{ x: 58, y: 50, raio: 4, adultos: 4, filhotes: 1, fome: 40, sede: 10 }] }] },
  'disputa': { nome: 'Dois Varriscos e uma carcaça (IA livre)', livre: 70, carcaca: { x: 60, y: 50 }, pop: [ind('varrisco', 'v', 58, 50, { fome: 70, energia: 90, sexo: 'M', direcaoGraus: 0, territorio: { x: 60, y: 50, raio: 60 } }), ind('varrisco', 'rival', 92, 60, { fome: 92, energia: 100, sexo: 'M', direcaoGraus: 180, territorio: { x: 95, y: 60, raio: 60 } })] },
  'dano-descanso': { nome: 'Ferimento na perna, recuo e descanso', pop: [ind('varrisco', 'v', 24, 40, { fome: 10, energia: 100, sexo: 'M', direcaoGraus: 0 })], passos: [
    { rotulo: 'trote saudável', cmd: irPara(44, 40, 'trote'), fim: (a) => dist(a, { x: 44, y: 40 }) < 1.6, max: 15 },
    { rotulo: 'golpe na perna (ferimento real do núcleo)', ini: (a, m) => { const f = ferir(a, { dano: a.saude.hpMax * 0.22, regiao: 'pernas', origem: 'teste', tipo: 'garra_foice', t: m.t, idEvento: 'teste-perna' }); m.evento('ferimento', a.id, { atacante: 'teste', ataque: 'garra_foice', regiao: 'pernas', dano: +f.efetivo.toFixed(1), gravidade: f.gravidade, fratura: f.fratura, hp: +a.saude.hp.toFixed(1) }); }, cmd: parar(), fim: () => true, max: 1.2 },
    { rotulo: 'recuar mancando', cmd: irPara(28, 46, 'trote'), fim: (a) => dist(a, { x: 28, y: 46 }) < 1.6, max: 20 },
    { rotulo: 'exausto → descansa (IA)', ini: (a) => { a.energia = 12; }, cmd: null, fim: (a) => a.estado === 'descansando' || a.estado === 'ferido', max: 8 },
    { rotulo: 'descanso', cmd: null, fim: () => false, max: 5, duracao: true },
  ] },
};

// ---------- execução ----------
function iniciarTeste(id) {
  const T = TESTES[id];
  montar(T.pop, 7);
  const m = est.mundo, a = m.porId.get('v');
  est.ator = 'v';
  for (const b of document.querySelectorAll('#lista button')) b.classList.toggle('ativo', b.dataset.id === id);
  if (T.carcaca) m.carcacas.push({ id: 'carc-lab', especie: 'velsari', animal: 'x', x: T.carcaca.x, y: T.carcaca.y, carneInicial: 12, carne: 12, decomposicao: 0, dono: 'v', donoDesde: 0, morteT: 0, consumo: {} });
  if (T.manequim) { const d = m.porId.get(T.manequim); d.comandoTeste = parar(); }
  const r = { id, nome: T.nome, inicio: performance.now(), passos: [], desvioMax: 0, desvioSoma: 0, desvioN: 0, clipes: new Set(), vMax: 0, giroNoLugar: 0, eventos: {}, colisoes0: a.colisoes, contatos0: m.metricas.contatosObstaculo, pernas0: est.vis.get('v').pernas?.metricas() };
  let i = -1, tPasso = 0, cmdAtual = null;
  const proximo = () => {
    i++; tPasso = 0;
    if (!T.passos || i >= T.passos.length) { cmdAtual = null; a.comandoTeste = null; return; }
    const p = T.passos[i];
    p.ini?.(a, m);
    cmdAtual = p.cmdF ? p.cmdF() : p.cmd;
    a.comandoTeste = cmdAtual ? (aa, mm) => cmdAtual(aa, mm) : null;
    r.passos.push({ rotulo: p.rotulo, t0: m.t });
  };
  est.teste = {
    id, T, r, fim: false,
    passo() {
      if (T.tipo === 'clipes' || this.fim) return;
      if (T.livre) { if (m.t >= T.livre) this.concluir(); return; }
      tPasso += m.dt;
      const p = T.passos[i];
      if (!p) { this.concluir(); return; }
      const feito = p.cmdF ? cmdAtual?.feito?.(a) && tPasso > 0.8 : p.fim(a, m);
      // Passo de duração fixa (só observa): conta como cumprido ao fim do tempo.
      if (feito || tPasso >= p.max) { const reg = r.passos[r.passos.length - 1]; reg.t1 = m.t; reg.ok = !!feito || !!p.duracao; proximo(); }
    },
    medir() {
      const v = est.vis.get('v'), ag = m.porId.get('v');
      if (!v || !ag) return;
      r.clipes.add(v.nomeAtual);
      if (ag.velocidade > 0.4 && !ag.girandoNoLugar) { const d = v.desvioFrente(); r.desvioMax = Math.max(r.desvioMax, d); r.desvioSoma += d; r.desvioN++; }
      r.vMax = Math.max(r.vMax, ag.velocidade);
      if (ag.girandoNoLugar) r.giroNoLugar++;
    },
    concluir() {
      if (this.fim) return;
      this.fim = true;
      const ag = m.porId.get('v') ?? m.mortos.get('v');
      for (const e of m.eventos) if (!['nivel', 'sentinela'].includes(e.tipo)) r.eventos[e.tipo] = (r.eventos[e.tipo] ?? 0) + 1;
      const pern = est.vis.get('v')?.pernas?.metricas();
      r.resultado = {
        teste: id, nome: T.nome, semente: m.semente, tSim: +m.t.toFixed(1), hash: hashMundo(m),
        passos: r.passos.map((p) => ({ ...p, t0: +p.t0.toFixed(1), t1: p.t1 != null ? +p.t1.toFixed(1) : null })),
        passosOk: r.passos.filter((p) => p.ok).length, passosTotal: T.passos?.length ?? 0,
        desvioFrenteMaxGraus: +r.desvioMax.toFixed(2), desvioFrenteMedioGraus: +(r.desvioSoma / Math.max(1, r.desvioN)).toFixed(2),
        velocidadeMax: +r.vMax.toFixed(2), quadrosGiroNoLugar: r.giroNoLugar, clipes: [...r.clipes].filter(Boolean),
        colisoes: (ag?.colisoes ?? 0) - r.colisoes0, contatosObstaculo: m.metricas.contatosObstaculo - r.contatos0,
        pernas: pern, eventos: r.eventos, registro: est.log.slice(-20),
        golpes: m.eventos.filter((e) => ['ataque_inicio', 'ferimento', 'golpe_errou', 'esquiva', 'queda', 'desequilibrio', 'empurrao', 'agarrao', 'soltou', 'escapou_agarrao', 'contra_ataque', 'conflito_fase', 'conflito_fim', 'perseguicao_inicio', 'perseguicao_fim', 'morte'].includes(e.tipo)).slice(0, 40).map((e) => ({ t: e.t, tipo: e.tipo, id: e.id, ataque: e.ataque, regiao: e.regiao, motivo: e.motivo, fase: e.fase, folga: e.folga })),
      };
      mostrarResultado(r.resultado);
    },
  };
  est.log = [];
  proximo();
  return est.teste;
}

// Teste de clipes: toca cada clipe do GLB isolado e mede quantos ossos realmente se movem.
async function testeClipes(render = true) {
  iniciarTeste('clipes');
  const v = est.vis.get('v');
  const ossos = []; v.modelo.traverse((o) => { if (o.isBone || o.type === 'Bone') ossos.push(o); });
  const linhas = [];
  for (const clip of gltfs.get('varrisco').animations) {
    v.mixer.stopAllAction();
    const ac = v.mixer.clipAction(clip); ac.reset(); ac.setLoop(THREE.LoopOnce, 1); ac.clampWhenFinished = true; ac.play();
    v.atual = ac; v.nomeAtual = clip.name; v.umaVez = { ate: Infinity };
    const q0 = new Map(); v.mixer.update(0); for (const b of ossos) q0.set(b, b.quaternion.clone());
    const maxAng = new Map(ossos.map((b) => [b, 0]));
    const passos = Math.ceil(clip.duration * 30);
    for (let k = 0; k < passos; k++) {
      v.mixer.update(1 / 30);
      for (const b of ossos) maxAng.set(b, Math.max(maxAng.get(b), b.quaternion.angleTo(q0.get(b)) * 57.3));
      if (render && k % 3 === 0) { posicionarCamera(0); renderer.render(cena, camera); await new Promise((ok) => setTimeout(ok, 0)); }
    }
    const movidos = [...maxAng.entries()].filter(([, g]) => g > 2).map(([b]) => b.name);
    linhas.push({ clipe: clip.name, duracao: +clip.duration.toFixed(2), ossosMovidos: movidos.length, ossos: movidos.slice(0, 8), ok: movidos.length > 0 });
  }
  v.umaVez = null;
  const resultado = { teste: 'clipes', nome: 'Todos os clipes do GLB', glb: perfis.varrisco.glb, sha256: perfis.varrisco.sha256, clipes: linhas, todosAnimam: linhas.every((l) => l.ok), total: linhas.length };
  est.teste.fim = true; mostrarResultado(resultado);
  return resultado;
}

function mostrarResultado(res) {
  est.ultimo = res;
  const tr = document.createElement('tr');
  const ok = res.teste === 'clipes' ? res.todosAnimam : (res.passosTotal ? res.passosOk === res.passosTotal : true);
  const resumo = res.teste === 'clipes' ? `${res.total} clipes; ${res.clipes.filter((c) => c.ok).length} movem ossos`
    : `${res.passosOk ?? 0}/${res.passosTotal ?? 0} passos · desvio méd ${res.desvioFrenteMedioGraus}° máx ${res.desvioFrenteMaxGraus}° · v máx ${res.velocidadeMax} m/s · colisões ${res.colisoes}${res.pernas ? ` · deslize apoio ${res.pernas.deslizeApoioFK_ms}→${res.pernas.deslizeApoioIK_ms} m/s` : ''}`;
  tr.innerHTML = `<td>${res.nome}</td><td class="${ok ? 'ok' : 'falha'}">${resumo}</td>`;
  $('resultados').prepend(tr);
  fetch('/__resultado', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: `lab-varrisco-${res.teste}.json`, dados: res }) }).catch(() => {});
}

// ---------- painel ----------
for (const [id, T] of Object.entries(TESTES)) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = T.nome; b.dataset.id = id;
  b.onclick = () => { if (est.automacao) return; if (T.tipo === 'clipes') testeClipes(); else iniciarTeste(id); };
  $('lista').append(b);
}
$('cam-lateral').onclick = () => { est.cam = 'lateral'; };
$('cam-seguir').onclick = () => { est.cam = 'seguir'; };
$('cam-cima').onclick = () => { est.cam = 'cima'; };
$('ik').onchange = () => { for (const v of est.vis.values()) v.ikLigado = $('ik').checked; };
renderer.domElement.addEventListener('pointerdown', () => { est.cam = 'livre'; });

function painelVivo() {
  const a = est.mundo?.porId.get(est.ator) ?? est.mundo?.mortos.get(est.ator), v = est.vis.get(est.ator);
  if (!a || !v) return;
  const p = v.pernas?.metricas();
  $('vivo').innerHTML = `<dt>Teste</dt><dd>${est.teste?.T.nome ?? '—'}</dd><dt>Estado</dt><dd>${a.estado} · ${a.motivo}</dd><dt>Clipe</dt><dd>${v.nomeAtual} ×${(v.atual?.timeScale ?? 1).toFixed(2)}</dd>
    <dt>Velocidade</dt><dd>${a.velocidade.toFixed(2)} m/s · giro ${((a.velAngular ?? 0) * 57.3).toFixed(0)}°/s</dd><dt>Frente × rumo</dt><dd>${v.desvioFrente().toFixed(1)}°</dd>
    <dt>Patas (apoio)</dt><dd>${p ? `deslize ${p.deslizeApoioFK_ms}→${p.deslizeApoioIK_ms} m/s · altura ${p.erroAlturaFK_m}→${p.erroAlturaIK_m} m` : '—'}</dd>
    <dt>Vida</dt><dd>${a.saude.hp.toFixed(0)}/${a.saude.hpMax.toFixed(0)} · energia ${a.energia.toFixed(0)} · fôlego ${a.folego.toFixed(1)} s</dd>`;
  $('estado').textContent = `t ${est.mundo.t.toFixed(1)} s · hash ${hashMundo(est.mundo)} · ${est.teste?.fim ? 'concluído' : 'em andamento'}`;
}

// ---------- laço interativo ----------
let ultimo = performance.now(), ultPainel = 0;
function laco(agora) {
  requestAnimationFrame(laco);
  const dt = Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora;
  if (!est.mundo || !$('rodar').checked || est.automacao) return;
  if (est.teste && est.teste.T.tipo !== 'clipes') quadro(dt);
  else renderer.render(cena, camera);
  if (agora - ultPainel > 200) { ultPainel = agora; painelVivo(); }
}

// ---------- API de automação (passo fixo; funciona com a aba em segundo plano) ----------
const esperarQuadro = () => new Promise((ok) => setTimeout(ok, 0));
window.lab = {
  testes: Object.keys(TESTES),
  get mundo() { return est.mundo; },
  async rodar(id, { fps = 60, maxSeg = 200 } = {}) {
    est.automacao = true;
    if (TESTES[id].tipo === 'clipes') { const r = await testeClipes(false); est.automacao = false; return r; }
    const teste = iniciarTeste(id);
    let n = 0;
    while (!teste.fim && est.mundo.t < maxSeg) { quadro(1 / fps, false); if (++n % 240 === 0) await esperarQuadro(); }
    if (!teste.fim) teste.concluir();
    renderer.render(cena, camera); painelVivo(); est.automacao = false;
    return teste.r.resultado;
  },
  // Avança só até um instante (para capturar um momento específico do teste em andamento).
  async avancarAte(cond, { fps = 60, maxSeg = 60 } = {}) {
    est.automacao = true; const t0 = est.mundo.t; let n = 0;
    while (!cond(est.mundo) && est.mundo.t - t0 < maxSeg) { quadro(1 / fps, false); if (++n % 240 === 0) await esperarQuadro(); }
    renderer.render(cena, camera); est.automacao = false; return est.mundo.t;
  },
  iniciar: (id) => { iniciarTeste(id); return true; },
  camera(modo) { est.cam = modo; posicionarCamera(0); renderer.render(cena, camera); },
  ator(id) { est.ator = id; },
  ik(on) { $('ik').checked = on; for (const v of est.vis.values()) v.ikLigado = on; },
  async capturar(nome, { largura = 1280, altura = 720 } = {}) {
    // Captura em resolução fixa (independe do tamanho do painel): câmera no lugar exato, renderiza e restaura.
    posicionarCamera(0);
    const w0 = renderer.domElement.width, h0 = renderer.domElement.height, pr = renderer.getPixelRatio();
    renderer.setPixelRatio(1); renderer.setSize(largura, altura, false); camera.aspect = largura / altura; camera.updateProjectionMatrix();
    renderer.render(cena, camera);
    const dados = renderer.domElement.toDataURL('image/png');
    renderer.setPixelRatio(pr); renderer.setSize(w0 / pr, h0 / pr, false); redimensionar();
    const r = await fetch('/__captura', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome, dados }) });
    return r.ok ? (await r.json()).caminho : null;
  },
  // GIF real do renderizador: avança a simulação em passo fixo e grava cada quadro reduzido.
  async gravarGif(nome, segundos, { fps = 10, largura = 400, altura = 225, sub = 6 } = {}) {
    est.automacao = true;
    // Renderiza em 16:9 (2× o GIF) e reduz: sem distorção, independe do tamanho do painel.
    const w0 = renderer.domElement.width, h0 = renderer.domElement.height, pr = renderer.getPixelRatio();
    renderer.setPixelRatio(1); renderer.setSize(largura * 2, altura * 2, false); camera.aspect = largura / altura; camera.updateProjectionMatrix();
    const cv = document.createElement('canvas'); cv.width = largura; cv.height = altura;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const id = `g${Date.now()}`;
    for (let q = 0; q < Math.round(segundos * fps); q++) {
      for (let s = 0; s < sub; s++) quadro(1 / (fps * sub), false);
      renderer.render(cena, camera);
      ctx.drawImage(renderer.domElement, 0, 0, largura, altura);
      const px = ctx.getImageData(0, 0, largura, altura).data;
      await fetch(`/__gif/quadro?id=${id}`, { method: 'POST', body: px });
      if (est.teste?.fim && q > fps) break;
    }
    const r = await fetch(`/__gif/fim?id=${id}&w=${largura}&h=${altura}&fps=${fps}&nome=${encodeURIComponent(nome)}`, { method: 'POST' });
    renderer.setPixelRatio(pr); renderer.setSize(w0 / pr, h0 / pr, false); redimensionar();
    est.automacao = false;
    return r.ok ? r.json() : null;
  },
  metricas: () => ({ pernas: [...est.vis.entries()].filter(([, v]) => v.pernas).map(([id, v]) => ({ id, ...v.pernas.metricas() })), ultimo: est.ultimo }),
};

iniciarTeste('oito-direcoes');
requestAnimationFrame(laco);
$('estado').textContent = 'Pronto. Escolha um teste.';
