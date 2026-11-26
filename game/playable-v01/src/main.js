// Wildhaven — Playable Build V01. Esta página só desenha e lê o teclado: simulação, combate, IA do Varrisco,
// animação e efeitos são os módulos do Hunter Lab (labs/hunters, labs/ia-criaturas) sem alteração.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { carregarModelos as carregarModelosGlb, clonarEsqueleto, gltfs, rigs } from '../../../labs/ia-criaturas/src/web3d/modelos3d.js';
import { Animal3D } from '../../../labs/ia-criaturas/src/web3d/animador.js';
import { carregarConfigEco } from '../../../labs/ia-criaturas/src/eco/config.js';
import { altura, desserializarTerreno } from '../../../labs/ia-criaturas/src/eco/terreno.js';
import { passoHunters, estadoHunter, enfileirarComando } from '../../../labs/hunters/src/mundo-hunters.js';
import { instalarVisualHunter } from '../../../labs/hunters/src/visual-hunter.js';
import { instalarVisualMonstro } from '../../../labs/hunters/src/visual-monstro.js';
import { amostrarArma, segmentoMundo, trajetoriaPve } from '../../../labs/hunters/src/trajetoria-arma.js';
import { criarApresentacao } from '../../../labs/hunters/src/apresentacao-combate.js';
import { disposeGroup } from '../../../world/hunters-village-v01/runtime.mjs';
import { prepararConfig, criarCacada, decidirJogador } from './cacada.js';

const $ = (id) => document.getElementById(id);
const lerJson = async (url) => { const r = await fetch(url); if (!r.ok) throw Error(`HTTP ${r.status} em ${url}`); return r.json(); };
const guardado = (k, d) => { try { return localStorage.getItem('wildhaven.v01.' + k) ?? d; } catch { return d; } };
const guardar = (k, v) => { try { localStorage.setItem('wildhaven.v01.' + k, v); } catch { /* sem armazenamento: só não lembra */ } };
const carga = (txt) => { $('carga').textContent = txt; };

// ------------------------------------------------------------------ renderizador e cena
const PRESETS = {
  baixa: { pr: 0.75, sombra: 0, raio: 5200, nevoa: 2600 },
  media: { pr: 1, sombra: 1024, raio: 7000, nevoa: 4500 },
  alta: { pr: Math.min(devicePixelRatio, 1.5), sombra: 2048, raio: 9000, nevoa: 7000 },
};
let qualidade = guardado('qualidade', null);
const renderer = new THREE.WebGLRenderer({ antialias: qualidade !== 'baixa', powerPreference: 'high-performance' });
const info = renderer.getContext().getExtension('WEBGL_debug_renderer_info');
const gpu = info ? renderer.getContext().getParameter(info.UNMASKED_RENDERER_WEBGL) : 'desconhecida';
qualidade ??= /swiftshader|llvmpipe|software|basic render|intel/i.test(gpu) ? 'baixa' : 'media';
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('palco').appendChild(renderer.domElement);
const cena = new THREE.Scene();
cena.background = new THREE.Color(0xb9c8c5);
cena.fog = new THREE.Fog(0xb9c8c5, 300, 4500);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 12000);
cena.add(new THREE.HemisphereLight(0xfffaeb, 0x788975, 1.7));
const sol = new THREE.DirectionalLight(0xffe4bb, 2.4);
Object.assign(sol.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
sol.shadow.bias = -0.0003; sol.shadow.normalBias = 0.04;
cena.add(sol, sol.target);
function aplicarQualidade(q) {
  qualidade = q; guardar('qualidade', q); $('qualidade').value = q;
  const p = PRESETS[q];
  renderer.setPixelRatio(p.pr);
  sol.castShadow = p.sombra > 0;
  if (p.sombra) { sol.shadow.mapSize.set(p.sombra, p.sombra); sol.shadow.map?.dispose(); sol.shadow.map = null; }
  cena.fog.far = p.nevoa; camera.far = p.nevoa + 500; camera.updateProjectionMatrix();
  redimensionar();
}
function redimensionar() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', redimensionar);

// ------------------------------------------------------------------ dados
carga('Carregando configurações do Hunter Lab…');
const LAB_IA = '/labs/ia-criaturas/';
const cfgEco = await carregarConfigEco((rel) => lerJson(LAB_IA + rel), { preCarregarTerrenos: false });
const perfis = (await lerJson(LAB_IA + 'config/eco/modelos.json')).perfis;
const fichaHunter = await lerJson('/labs/hunters/config/hunter.json');
const equipamentos = await lerJson('/labs/hunters/config/equipamento.json');
const CFG = prepararConfig(cfgEco, fichaHunter);
carga('Carregando o terreno de simulação da região real…');
const dados = await lerJson('public/data/regiao-v01-sim.json');
const continente = await lerJson('public/data/continente-272.json');
const regiaoLeste = await lerJson('/world/playable-eastern-range-v01/play/region.json');
const site = await lerJson('/world/hunters-village-v01/site.json');
const ORIG = dados.origem, W = dados.largura / 2, D = dados.profundidade / 2;
const OX = ORIG.x0 + W, OZ = ORIG.z0 + D, OY = ORIG.alturaBase;   // origem da cena = centro da janela de simulação
const JOGAVEIS = new Set(ORIG.hexes.map((h) => h.id));

// ------------------------------------------------------------------ hexágonos desenhados (streaming por proximidade)
const [HVX, , HVZ] = site.worldCoord;
const pecas = [
  { id: 'HV_01', x: HVX, z: HVZ, arquivos: ['world/hunters-village-v01/models/hv_01_terrain.glb', 'world/hunters-village-v01/models/hv_01_forest.glb',
    'world/hunters-village-v01/models/phase_1.glb', 'world/hunters-village-v01/models/phase_1_inside.glb'] },
  ...regiaoLeste.tiles.map((t) => ({ id: t.id, x: t.center_x, z: t.center_z, arquivos: [t.model_path] })),
];
const loader = new GLTFLoader(), carregados = new Map();
let carregando = null, falhaTile = null;
const distPeca = (p, X, Z) => Math.hypot(p.x - X, p.z - Z);
async function carregarPeca(p) {
  const grupo = new THREE.Group();
  grupo.position.set(p.x - OX, -OY, p.z - OZ);
  grupo.name = p.id;
  try {
    for (const arq of p.arquivos) {
      const g = await loader.loadAsync('/' + arq);
      g.scene.traverse((o) => {
        if (/side_cut/.test(o.name)) o.visible = false;   // saia lateral do hexágono: parede de borda, não chão
        if (o.isMesh) { o.receiveShadow = true; o.castShadow = /phase_|forest/.test(arq) && qualidade === 'alta'; }
      });
      grupo.add(g.scene);
    }
  } catch (e) { disposeGroup(grupo); throw e; }
  cena.add(grupo);
  carregados.set(p.id, grupo);
}
async function stream(X, Z, raio) {
  if (carregando) return carregando;
  carregando = (async () => {
    for (const [id, g] of carregados) {
      const p = pecas.find((q) => q.id === id);
      if (distPeca(p, X, Z) > raio + 2500 && !JOGAVEIS.has(id)) { disposeGroup(g); carregados.delete(id); }
    }
    const faltam = pecas.filter((p) => !carregados.has(p.id) && (JOGAVEIS.has(p.id) || distPeca(p, X, Z) < raio)).sort((a, b) => distPeca(a, X, Z) - distPeca(b, X, Z));
    if (faltam[0]) await carregarPeca(faltam[0]);
  })().catch((e) => { falhaTile = e; console.error(e); }).finally(() => { carregando = null; });
  return carregando;
}

// ------------------------------------------------------------------ modelos e vistas
async function carregarModelos() {
  await carregarModelosGlb(THREE, [fichaHunter, CFG.especies.varrisco], carga, perfis);
  // Mesma correção do Hunter Lab: Animal3D escala pelo comprimento; num humano vale a altura (1,75 m).
  const p = perfis.hunter;
  if (p && !p.ajustadoHumano) { const eixo = p.frente.endsWith('X') ? 0 : 2; p.extensao[eixo] = fichaHunter.corpo.comprimentoM * p.extensao[1] / fichaHunter.corpo.alturaM; p.ajustadoHumano = true; }
}
const est = { m: null, vistas: new Map(), acum: 0, ultimo: performance.now(), pausado: true, fase: 'carregando', lastN: -1, semente: 1, mortosEm: new Map(),
  vigor: 100, cansado: false, teclas: {}, yaw: 0, pitch: 0.32, dist: 6.5, mouseEm: 0, fps: 60, ms: 0, registro: null, quadros: [] };
const alturaEm = (x, y) => altura(est.m.terreno, x, y);
function criarVista(a) {
  const g = gltfs.get(a.especie.id);
  if (!g) return null;
  const v = new Animal3D(THREE, clonarEsqueleto, g, perfis[a.especie.id], a.especie, a, rigs.get(a.especie.id));
  if (a.hunter) instalarVisualHunter(v, g, a, { tempo: () => est.m.t, alturaEm, terreno: () => est.m.terreno });
  if (a.monstro) instalarVisualMonstro(v, { tempo: () => est.m.t });
  v.raiz.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  cena.add(v.raiz);
  est.vistas.set(a.id, v);
  return v;
}
// Remove uma vista e libera o que ela criou (materiais/texturas clonados); o que é do GLB carregado fica, pois é compartilhado.
function descartarVista(v) {
  const doGlb = new Set();
  for (const g of gltfs.values()) g.scene.traverse((o) => { for (const mat of [o.material].flat().filter(Boolean)) { doGlb.add(mat); for (const x of Object.values(mat)) if (x?.isTexture) doGlb.add(x); } });
  const esqueletos = new Set();
  v.raiz.traverse((o) => { if (o.isSkinnedMesh) esqueletos.add(o.skeleton); for (const mat of [o.material].flat().filter(Boolean)) { if (doGlb.has(mat)) continue; for (const x of Object.values(mat)) if (x?.isTexture && !doGlb.has(x)) x.dispose(); mat.dispose(); } });
  esqueletos.forEach((e) => e.dispose());   // boneTexture: uma textura por esqueleto clonado
  cena.remove(v.raiz);
}
function sincronizarVistas() {
  const m = est.m;
  for (const a of m.vivos) (est.vistas.get(a.id) ?? criarVista(a))?.passoSimulacao(a);
  for (const [id, v] of est.vistas) {
    if (m.porId.has(id)) continue;
    const morto = m.mortos.get(id);
    if (morto && !est.mortosEm.has(id)) { est.mortosEm.set(id, m.t); v.passoSimulacao(morto); }
    if (!morto || m.t - est.mortosEm.get(id) > 60) { descartarVista(v); est.vistas.delete(id); }
  }
}
const apresentacao = criarApresentacao({ THREE, scene: cena, camera, orbit: null, canvas: renderer.domElement, trajetoria: (a, t) => {
  const action = a.hunter?.action; if (!action || t < action.start || t > action.end) return null;
  const s = segmentoMundo(a, amostrarArma(action, t, { arma: a.hunter.equipamento.arma, altura: a.especie.corpo.alturaM * a.escala }));
  const ph = action.clip ? trajetoriaPve(action.clip)?.phases : null, c = action.clipeInicio ?? action.start;
  const arco = ph?.activeStart != null && t >= c + (ph.anticipation ?? ph.activeStart) && t <= c + (ph.recovery ?? ph.activeEnd);
  return { base: s.grip, tip: s.tip, active: arco || s.active };
} });

// ------------------------------------------------------------------ sessão
const hunter = () => est.m.porId.get('hunter-A') ?? est.m.mortos.get('hunter-A');
const varrisco = () => est.m.porId.get('varrisco-real') ?? est.m.mortos.get('varrisco-real');
function novaSessao(semente) {
  for (const v of est.vistas.values()) descartarVista(v);
  est.vistas.clear(); est.mortosEm.clear();
  const m = criarCacada(CFG, dados, semente, { fichaHunter, equipamentos, terreno: desserializarTerreno(dados), vidaMonstro: Number($('dificuldade').value) });
  m.opcoes.maxEventos = 20000;
  const h = m.porId.get('hunter-A');
  h.comandoTeste = decidirJogador; h.hunter.controle = 'manual'; h.hunter.comando = {};
  Object.assign(est, { m, semente, acum: 0, fase: 'explorar', lastN: -1, vigor: 100, cansado: false, teclas: {}, avistado: false,
    registro: { inicio: 0, golpesDados: 0, acertos: 0, ferimentos: 0, danoSofrido: 0, golpesMonstro: 0 } });
  for (const a of m.vivos) criarVista(a)?.passoSimulacao(a);
  est.yaw = 0; est.pitch = 0.32;   // câmera ao sul (+Z), olhando para o norte (onde está o Varrisco)
  objetivo('Encontre o Varrisco ao norte da vila');
  $('monstro').hidden = true;
}

// ------------------------------------------------------------------ entrada
const TECLAS = { KeyW: 'frente', KeyS: 'tras', KeyA: 'esquerda', KeyD: 'direita', ShiftLeft: 'correr', ShiftRight: 'correr', KeyJ: 'atacar', KeyK: 'defender', KeyH: 'pesado', Space: 'esquivar' };
function enviar(campos) { if (est.m) enfileirarComando(est.m, 'input', 'hunter-A', campos); }
function tecla(e, valor) {
  if (e.code === 'KeyM' && valor && !e.repeat) { alternarMapa(); return; }
  if (e.code === 'Escape' && valor && est.fase !== 'fim' && $('mapa').hidden) { if (!est.pausado) pausar(true); return; }
  if (e.code === 'KeyP' && valor && est.fase !== 'fim' && $('mapa').hidden) { pausar(!est.pausado); return; }
  const campo = TECLAS[e.code];
  if (!campo || est.pausado) return;
  e.preventDefault();
  if (e.repeat || est.teclas[campo] === valor) return;
  est.teclas[campo] = valor;
  if (campo === 'correr' && valor && est.cansado) return;   // sem resistência: Shift não corre até recuperar
  if (campo === 'esquivar' && valor) { if (est.vigor < 20) { aviso('Sem fôlego para rolar', 'ruim'); return; } est.vigor -= 20; }
  if ((campo === 'atacar' || campo === 'pesado') && valor) est.registro.golpesDados++;
  enviar({ [campo]: valor });
}
addEventListener('keydown', (e) => tecla(e, true));
addEventListener('keyup', (e) => tecla(e, false));
addEventListener('blur', () => { const solta = Object.fromEntries(Object.values(TECLAS).map((c) => [c, false])); est.teclas = {}; enviar(solta); });
const canvas = renderer.domElement;
canvas.addEventListener('click', () => { if (!est.pausado) canvas.requestPointerLock?.()?.catch?.(() => {}); });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && !est.pausado && est.fase !== 'fim' && $('mapa').hidden) pausar(true); });
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  const s = Number($('sensibilidade').value) * 0.0024;
  est.yaw -= e.movementX * s; est.pitch = Math.min(1.15, Math.max(-0.15, est.pitch + e.movementY * s)); est.mouseEm = performance.now();
});
addEventListener('wheel', (e) => { est.dist = Math.min(16, Math.max(3, est.dist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: true });

// ------------------------------------------------------------------ interface
function objetivo(txt) { $('objetivoTxt').textContent = txt; }
function aviso(txt, classe = '') { const d = document.createElement('div'); d.textContent = txt; d.className = classe; $('avisos').append(d); setTimeout(() => d.remove(), 1600); while ($('avisos').childElementCount > 4) $('avisos').firstChild.remove(); }
function flashDano() { $('dano').style.opacity = 0.55; setTimeout(() => { $('dano').style.opacity = 0; }, 160); }
function pausar(sim) {
  est.pausado = sim; $('pausa').hidden = !sim;
  if (sim) { document.exitPointerLock?.(); const solta = Object.fromEntries(Object.values(TECLAS).map((c) => [c, false])); est.teclas = {}; enviar(solta); }
  else canvas.requestPointerLock?.()?.catch?.(() => {});
}
function alternarMapa() { const abrir = $('mapa').hidden; $('mapa').hidden = !abrir; if (abrir) { desenharMapa(); document.exitPointerLock?.(); est.pausado = true; } else if ($('pausa').hidden) est.pausado = false; }
function fim(vitoria) {
  est.fase = 'fim'; est.pausado = true; document.exitPointerLock?.();
  const m = est.m, r = est.registro, h = estadoHunter(hunter());
  $('fimTitulo').textContent = vitoria ? 'Caçada concluída' : 'O Hunter caiu';
  $('fimTexto').textContent = vitoria ? 'O Varrisco foi derrotado e Arvo voltou à vila em segurança.'
    : 'Modo de demonstração: a sessão recomeça na vila. Esta regra não altera a morte permanente dos Hunters no jogo.';
  $('registro').innerHTML = [['Duração', `${Math.floor(m.t / 60)} min ${Math.round(m.t % 60)} s`], ['Golpes comandados', r.golpesDados],
    ['Ferimentos no Varrisco', r.acertos], ['Golpes do Varrisco', r.golpesMonstro], ['Ferimentos sofridos', r.ferimentos],
    ['Vida final', `${h.hp.toFixed(0)} / ${h.hpMax.toFixed(0)}`], ['Recompensa', 'sem tabela de materiais do Varrisco publicada (registro da caçada apenas)']]
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  $('fim').hidden = false;
}
$('qualidade').onchange = () => aplicarQualidade($('qualidade').value);
$('dificuldade').value = guardado('dificuldade', '0.5');
$('dificuldade').onchange = () => guardar('dificuldade', $('dificuldade').value);
$('sons').checked = guardado('sons', '0') === '1';
$('sons').onchange = () => { guardar('sons', $('sons').checked ? '1' : '0'); if ($('sons').checked) apresentacao.unlockAudio(); };
$('continuar').onclick = () => pausar(false);
$('reiniciarPausa').onclick = () => { novaSessao(est.semente + 1); pausar(false); };
$('novaSessao').onclick = () => { $('fim').hidden = true; novaSessao(est.semente + 1); est.pausado = false; canvas.requestPointerLock?.()?.catch?.(() => {}); };

// ------------------------------------------------------------------ eventos da simulação → HUD
function lerEventos() {
  const m = est.m, ev = m.eventos, novos = [];
  for (let i = ev.length - 1; i >= 0 && ev[i].n > est.lastN; i--) novos.push(ev[i]);
  if (ev.length) est.lastN = ev[ev.length - 1].n;
  const r = est.registro;
  for (const e of novos.reverse()) {
    if (e.tipo === 'ferimento' && e.id === 'hunter-A') { r.ferimentos++; r.danoSofrido += e.dano ?? 0; flashDano(); aviso(`−${Math.round(e.dano ?? 0)} ${e.regiao ?? ''}`, 'ruim'); }
    if (e.tipo === 'ferimento' && e.id === 'varrisco-real') { r.acertos++; aviso(`Acerto · ${e.regiao ?? ''}`, 'bom'); }
    if (e.tipo === 'monstro_golpe' && e.id === 'varrisco-real') r.golpesMonstro++;
    if (e.tipo === 'monstro_aggro' && !est.avistado) { est.avistado = true; aviso('O Varrisco avistou você!', 'ruim'); objetivo('Derrote o Varrisco'); }
  }
}

// ------------------------------------------------------------------ laço
const alvoCam = new THREE.Vector3(), desejada = new THREE.Vector3();
function cenaDe(a) { return new THREE.Vector3(a.x - W, a.z, a.y - D); }
function laco(agora) {
  requestAnimationFrame(laco);
  const dt = Math.min(0.1, (agora - est.ultimo) / 1000); est.ultimo = agora;
  est.fps = est.fps * 0.95 + (1 / Math.max(1e-3, dt)) * 0.05;
  const m = est.m; if (!m) return;
  const t0 = performance.now(), h = hunter(), v = varrisco();
  if (!est.pausado) {
    // Resistência do jogador (a simulação PvE v02 mantém a energia cheia; o custo de correr é desta build).
    const correndo = est.teclas.correr && !est.cansado && (est.teclas.frente || est.teclas.tras || est.teclas.esquerda || est.teclas.direita);
    est.vigor = Math.max(0, Math.min(100, est.vigor + (correndo ? -16 : 20) * dt));
    if (!est.cansado && est.vigor <= 0) { est.cansado = true; enviar({ correr: false }); aviso('Sem fôlego', 'ruim'); }
    if (est.cansado && est.vigor > 30) { est.cansado = false; if (est.teclas.correr) enviar({ correr: true }); }
    // Rumo da câmera no plano da simulação: lido pelo controle de exploração (cacada.js).
    h.hunter.comando = { ...h.hunter.comando, rumo: Math.atan2(-Math.cos(est.yaw), -Math.sin(est.yaw)) };
    if (!apresentacao.congelado()) {
      est.acum += dt; let n = 0;
      while (est.acum >= m.dt && n < 40) { passoHunters(m); est.acum -= m.dt; n++; sincronizarVistas(); }
      if (m.historicoComandos?.length > 2000) m.historicoComandos.splice(0, 1000);
    }
    lerEventos();
    fases(h, v);
  }
  const alfa = Math.min(1, est.acum / m.dt);
  for (const [id, vista] of est.vistas) { const a = m.porId.get(id) ?? m.mortos.get(id); if (a) vista.quadro(alfa, est.pausado ? 0 : dt, a, m.terreno, alturaEm, null); }
  apresentacao.update(m, est.pausado ? 0 : dt, { sons: $('sons').checked, efeitos: true, selected: 'hunter-A' });
  // Câmera em terceira pessoa. Com o Varrisco perto, ela gira devagar para enquadrar o alvo (o mouse manda por 1,5 s).
  const hv = est.vistas.get('hunter-A'), pos = hv ? hv.raiz.position : cenaDe(h);
  if (v?.vivo && Math.hypot(v.x - h.x, v.y - h.y) < 28 && performance.now() - est.mouseEm > 1500) {
    const alvo = Math.atan2(-(v.x - h.x), -(v.y - h.y));
    let d = alvo - est.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); est.yaw += d * Math.min(1, dt * 2.5);
  }
  alvoCam.lerp(desejada.set(pos.x, pos.y + 1.55, pos.z), Math.min(1, dt * 12));
  camera.position.set(alvoCam.x + Math.sin(est.yaw) * Math.cos(est.pitch) * est.dist, alvoCam.y + Math.sin(est.pitch) * est.dist, alvoCam.z + Math.cos(est.yaw) * Math.cos(est.pitch) * est.dist);
  const cx = camera.position.x + W, cy = camera.position.z + D;
  if (cx > 0 && cy > 0 && cx < m.terreno.largura && cy < m.terreno.profundidade) camera.position.y = Math.max(camera.position.y, alturaEm(cx, cy) + 0.6);
  camera.lookAt(alvoCam);
  sol.target.position.copy(alvoCam); sol.position.set(alvoCam.x - 60, alvoCam.y + 110, alvoCam.z + 45);
  // Streaming por proximidade, a partir da posição continental do Hunter.
  if (!carregando) stream(h.x + ORIG.x0, h.y + ORIG.z0, PRESETS[qualidade].raio);
  renderer.render(cena, camera);
  est.ms = est.ms * 0.9 + (performance.now() - t0) * 0.1;
  est.quadros.push(dt); if (est.quadros.length > 600) est.quadros.shift();
  hud(h, v);
}
function fases(h, v) {
  const m = est.m;
  if (est.fase === 'explorar' && m.resultado) {
    if (m.resultado.motivo === 'criatura derrotada') { est.fase = 'voltar'; aviso('Varrisco derrotado!', 'bom'); objetivo('Volte à vila (ponto seguro)'); }
    else if (m.resultado.motivo === 'Hunter fora de combate') fim(false);
  }
  if (est.fase === 'voltar' && Math.hypot(h.x - m.pontos.vila.x, h.y - m.pontos.vila.y) < 20) fim(true);
}
let ultimoHud = 0;
function hud(h, v) {
  const agora = performance.now(); if (agora - ultimoHud < 100) return; ultimoHud = agora;
  const e = estadoHunter(h), m = est.m;
  $('vida').style.width = `${Math.max(0, (100 * e.hp) / e.hpMax)}%`; $('vidaTxt').textContent = `${Math.max(0, e.hp).toFixed(0)}/${e.hpMax.toFixed(0)}`;
  $('vigor').style.width = `${est.vigor}%`; $('vigor').style.opacity = est.cansado ? 0.45 : 1;
  const perto = v && Math.hypot(v.x - h.x, v.y - h.y) < 45;
  $('monstro').hidden = !(v && (perto || est.avistado) && est.fase === 'explorar');
  if (v) $('vidaMonstro').style.width = `${Math.max(0, (100 * v.saude.hp) / v.saude.hpMax)}%`;
  const alvo = est.fase === 'voltar' ? m.pontos.vila : v?.vivo ? v : null;
  if (alvo) {
    const dx = alvo.x - h.x, dy = alvo.y - h.y, dist = Math.hypot(dx, dy);
    const rel = Math.atan2(dy, dx) - Math.atan2(-Math.cos(est.yaw), -Math.sin(est.yaw)), setas = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
    $('bussola').textContent = `${setas[((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8]} ${dist.toFixed(0)} m`;
  } else $('bussola').textContent = '';
  const tris = renderer.info.render.triangles, calls = renderer.info.render.calls, mem = renderer.info.memory;
  $('perf').textContent = `${est.fps.toFixed(0)} fps · ${est.ms.toFixed(1)} ms · ${qualidade}\n${calls} draw calls · ${(tris / 1e6).toFixed(2)} M tri\n${mem.geometries} geometrias · ${mem.textures} texturas · ${carregados.size} hex`;
  desenharMini(h, v);
}

// ------------------------------------------------------------------ mapas
const corBioma = (b) => /ice|glacial|snow|iceberg/i.test(b) ? '#d6e3ea' : /jungle|tropical|swamp/i.test(b) ? '#3f7d3a' : /savanna/i.test(b) ? '#b59a45' : /dune|desert|erg|dunas|deserto|arco|oásis|mesas|torres|cânion|arenito/i.test(b) ? '#d4a35f'
  : /ice|glacial|snow|iceberg/i.test(b) ? '#d6e3ea' : /mountain|maciço/i.test(b) ? '#8a8378' : /praia/i.test(b) ? '#e6d49b' : /falesia/i.test(b) ? '#9d8f7d'
  : /plains|prairie|grassland/i.test(b) ? '#9fbf6a' : /forest/i.test(b) ? '#4f8a4a' : '#7d8f84';
function hexagono(ctx, x, y, r) { ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; ctx[k ? 'lineTo' : 'moveTo'](x + r * Math.cos(a), y + r * Math.sin(a)); } ctx.closePath(); }
function desenharMapa() {
  const c = $('mapaCanvas'), ctx = c.getContext('2d'), ts = continente.tiles;
  const xs = ts.map((t) => t.x), zs = ts.map((t) => t.z), minX = Math.min(...xs) - 3000, maxX = Math.max(...xs) + 3000, minZ = Math.min(...zs) - 3000, maxZ = Math.max(...zs) + 3000;
  const s = Math.min(c.width / (maxX - minX), c.height / (maxZ - minZ)), px = (x) => (x - minX) * s, pz = (z) => (z - minZ) * s;
  ctx.fillStyle = '#16303f'; ctx.fillRect(0, 0, c.width, c.height);
  for (const t of ts) {
    hexagono(ctx, px(t.x), pz(t.z), 2500 * s); ctx.fillStyle = corBioma(t.bioma); ctx.fill();
    ctx.lineWidth = JOGAVEIS.has(t.id) ? 3 : carregados.has(t.id) ? 2 : 0.5;
    ctx.strokeStyle = JOGAVEIS.has(t.id) ? '#e3c27a' : carregados.has(t.id) ? '#7fb0d6' : '#0006'; ctx.stroke();
  }
  const h = hunter(), X = h.x + ORIG.x0, Z = h.y + ORIG.z0;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px(X), pz(Z), 4, 0, 7); ctx.fill();
}
function desenharMini(h, v) {
  const c = $('mini'), ctx = c.getContext('2d'), R = 450, s = c.width / (2 * R);
  const X = h.x + ORIG.x0, Z = h.y + ORIG.z0, p = (x, z) => [c.width / 2 + (x - X) * s, c.height / 2 + (z - Z) * s];
  ctx.clearRect(0, 0, c.width, c.height);
  for (const id of ['HV_01', 'FX_20', 'ER_18']) { const t = pecas.find((q) => q.id === id); const [a, b] = p(t.x, t.z); hexagono(ctx, a, b, 2500 * s); ctx.fillStyle = id === 'HV_01' ? '#4f8a4a55' : '#3f6d3a55'; ctx.fill(); ctx.strokeStyle = '#e3c27a88'; ctx.stroke(); }
  const [ja, jb] = p(ORIG.x0, ORIG.z0); ctx.strokeStyle = '#ffffff55'; ctx.setLineDash([4, 4]); ctx.strokeRect(ja, jb, dados.largura * s, dados.profundidade * s); ctx.setLineDash([]);
  const ponto = (x, y, cor, r = 4) => { const [a, b] = p(x + ORIG.x0, y + ORIG.z0); ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(a, b, r, 0, 7); ctx.fill(); };
  ponto(est.m.pontos.vila.x, est.m.pontos.vila.y, '#e3c27a', 5);
  if (v?.vivo) ponto(v.x, v.y, '#d0453b', 5);
  const ang = Math.atan2(-Math.cos(est.yaw), -Math.sin(est.yaw));
  ctx.save(); ctx.translate(c.width / 2, c.height / 2); ctx.rotate(ang); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, 4); ctx.lineTo(-5, -4); ctx.fill(); ctx.restore();
}

// ------------------------------------------------------------------ API para os testes de navegador
window.wildhaven = {
  get mundo() { return est.m; },
  estado: () => ({ fase: est.fase, pausado: est.pausado, t: est.m?.t, hunter: est.m && estadoHunter(hunter()), varrisco: est.m && { hp: varrisco().saude.hp, hpMax: varrisco().saude.hpMax, vivo: varrisco().vivo },
    distancia: est.m && Math.hypot(varrisco().x - hunter().x, varrisco().y - hunter().y), vigor: est.vigor, registro: est.registro, resultado: est.m?.resultado ?? null, hexes: [...carregados.keys()], falhaTile: falhaTile?.message ?? null,
    clipes: [...est.vistas].map(([id, v]) => ({ id, clip: v.controladorTatico?.clip ?? v.nomeAtual ?? null })) }),
  medir() { const q = [...est.quadros].sort((a, b) => a - b), med = q[Math.floor(q.length / 2)] ?? 0, p95 = q[Math.floor(q.length * 0.95)] ?? 0;
    return { qualidade, gpu, fpsMedio: +(q.length / q.reduce((s, x) => s + x, 0)).toFixed(1), msMediano: +(med * 1000).toFixed(1), msP95: +(p95 * 1000).toFixed(1), quadros: q.length,
      drawCalls: renderer.info.render.calls, triangulos: renderer.info.render.triangles, geometrias: renderer.info.memory.geometries, texturas: renderer.info.memory.textures,
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1e6).toFixed(0) : null, hexes: carregados.size }; },
  qualidade: (q) => aplicarQualidade(q),
  // Leva o Hunter para perto do Varrisco sem andar 500 m (só para os testes automáticos).
  teleportar(dx = 0, dy = 22) { const h = hunter(), v = varrisco(); h.x = v.x + dx; h.y = v.y + dy; h.z = altura(est.m.terreno, h.x, h.y); est.vistas.get('hunter-A')?.passoSimulacao(h); est.vistas.get('hunter-A')?.passoSimulacao(h); },
  // Gira a câmera para que W ande até (x, y) da simulação (os testes não têm mouse).
  olharPara(x, y) { const h = hunter(); est.yaw = Math.atan2(-(x - h.x), -(y - h.y)); est.mouseEm = performance.now(); },
  novaSessao: (s) => { $('fim').hidden = true; novaSessao(s); est.pausado = false; },
  pausar,
};

// ------------------------------------------------------------------ início
aplicarQualidade(qualidade);
await carregarModelos();
carga('Carregando os hexágonos HV_01, FX_20 e ER_18…');
for (const id of JOGAVEIS) await carregarPeca(pecas.find((p) => p.id === id));
novaSessao(Number(new URLSearchParams(location.search).get('semente')) || 1);
requestAnimationFrame(laco);
carga('Pronto.');
$('entrar').hidden = false; $('entrar').focus();
$('entrar').onclick = () => { $('tela').hidden = true; $('hud').hidden = false; est.pausado = false; if ($('sons').checked) apresentacao.unlockAudio(); canvas.requestPointerLock?.()?.catch?.(() => {}); };
