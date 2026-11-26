// Wildhaven — Build V02: simulador idle. Esta página só desenha, lê cliques e dá ORDENS; decisão, movimento e
// combate são do Hunter Lab (labs/hunters) via src/jogo.js. Nenhuma tecla move Hunter ou dispara golpe.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { carregarModelos as carregarModelosGlb, clonarEsqueleto, gltfs, rigs } from '../../../labs/ia-criaturas/src/web3d/modelos3d.js';
import { Animal3D } from '../../../labs/ia-criaturas/src/web3d/animador.js';
import { carregarConfigEco } from '../../../labs/ia-criaturas/src/eco/config.js';
import { altura } from '../../../labs/ia-criaturas/src/eco/terreno.js';
import { estadoHunter } from '../../../labs/hunters/src/mundo-hunters.js';
import { instalarVisualHunter } from '../../../labs/hunters/src/visual-hunter.js';
import { instalarVisualMonstro } from '../../../labs/hunters/src/visual-monstro.js';
import { amostrarArma, segmentoMundo, trajetoriaPve } from '../../../labs/hunters/src/trajetoria-arma.js';
import { criarApresentacao } from '../../../labs/hunters/src/apresentacao-combate.js';
import { disposeGroup } from '../../../world/hunters-village-v01/runtime.mjs';
import { prepararConfig } from '../../playable-v01/src/cacada.js';
import { criarGrafo, hexEm } from './estrategico.js';
import { criarJogo, passoJogo, ordenar, rotulo, situacao, posicao, atorDe, salvarJogo, carregarJogo, ESPECIES_CACA, definirPerfil, regiaoDe, varrisco as varriscoDe, janelasDoSave, JANELA_INICIAL } from './jogo.js';
import { QUADRO, hexesDaJanela, ox, oy } from './regioes.js';
import { fontesHex } from './fontes.js';
import { provedorWeb } from './provedor-web.js';
import { PERFIS, REGRAS, prioridade } from './regras.js';

const $ = (id) => document.getElementById(id);
const lerJson = async (url) => { const r = await fetch(url); if (!r.ok) throw Error(`HTTP ${r.status} em ${url}`); return r.json(); };
const guardado = (k, d) => { try { return localStorage.getItem('wildhaven.v02.' + k) ?? d; } catch { return d; } };
const guardar = (k, v) => { try { localStorage.setItem('wildhaven.v02.' + k, v); } catch { /* só não lembra a preferência */ } };
const carga = (t) => { $('carga').textContent = t; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ------------------------------------------------------------------ cena e câmera estratégica
const PRESETS = { baixa: { pr: 0.75, sombra: 0, raio: 5200, nevoa: 3200 }, media: { pr: 1, sombra: 1024, raio: 7000, nevoa: 5500 }, alta: { pr: Math.min(devicePixelRatio, 1.5), sombra: 2048, raio: 9000, nevoa: 8000 } };
let qualidade = guardado('qualidade', null);
const renderer = new THREE.WebGLRenderer({ antialias: qualidade !== 'baixa', powerPreference: 'high-performance' });
const dbg = renderer.getContext().getExtension('WEBGL_debug_renderer_info');
const gpu = dbg ? renderer.getContext().getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'desconhecida';
qualidade ??= /swiftshader|llvmpipe|software|basic render|intel/i.test(gpu) ? 'baixa' : 'media';
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('palco').appendChild(renderer.domElement);
const cena = new THREE.Scene(); cena.background = new THREE.Color(0xb9c8c5); cena.fog = new THREE.Fog(0xb9c8c5, 600, 5500);
const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 14000);
cena.add(new THREE.HemisphereLight(0xfffaeb, 0x788975, 1.7));
const sol = new THREE.DirectionalLight(0xffe4bb, 2.4);
Object.assign(sol.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 }); sol.shadow.bias = -0.0003; sol.shadow.normalBias = 0.05;
cena.add(sol, sol.target);
const orbit = new OrbitControls(camera, renderer.domElement);
Object.assign(orbit, { enableDamping: true, minDistance: 6, maxDistance: 3000, minPolarAngle: 0.35, maxPolarAngle: 1.2, screenSpacePanning: false });
orbit.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
function aplicarQualidade(q) {
  qualidade = q; guardar('qualidade', q); $('qualidade').value = q;
  const p = PRESETS[q]; renderer.setPixelRatio(p.pr); sol.castShadow = p.sombra > 0;
  if (p.sombra) { sol.shadow.mapSize.set(p.sombra, p.sombra); sol.shadow.map?.dispose(); sol.shadow.map = null; }
  cena.fog.far = p.nevoa; camera.far = p.nevoa + 1000; camera.updateProjectionMatrix(); redimensionar();
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
carga('Carregando o grafo de Auralis…');
const grafoBruto = await lerJson('public/data/auralis-grafo.json');
const regiaoLeste = await lerJson('/world/playable-eastern-range-v01/play/region.json');
const site = await lerJson('/world/hunters-village-v01/site.json');
const progressao = await lerJson('/world/hunters-village-v01/progression.json');
// Cena: mesma origem da V02 (centro da antiga janela 800 × 3 100 m), para o jogo e as capturas serem comparáveis.
const W = 400, D = 1550, OX = QUADRO.x0 + W, OZ = QUADRO.z0 + D, OY = QUADRO.alturaBase;
const FONTES = fontesHex(regiaoLeste, site);
const provedor = provedorWeb({ fontes: FONTES, site, progressao });
const DETALHADOS = new Set(FONTES.keys());   // hexágonos com navegação detalhada possível nesta build
const novoGrafo = () => criarGrafo(structuredClone(grafoBruto), { x0: QUADRO.x0, z0: QUADRO.z0 });
const G = novoGrafo();
const cenaDeJogo = (x, y, h) => new THREE.Vector3(x - W, h, y - D);   // jogo (x, y, altura relativa) → cena

// ------------------------------------------------------------------ hexágonos desenhados: streaming pela posição da CÂMERA
const [HVX, , HVZ] = site.worldCoord;
const pecas = [...FONTES].map(([id, f]) => ({ id, x: f.cx, z: f.cz, arquivos: f.render }));
const loader = new GLTFLoader(), carregados = new Map(), solo = [];
let carregando = null, falhaTile = null;
const distPeca = (p, X, Z) => Math.hypot(p.x - X, p.z - Z);
async function carregarPeca(p) {
  const grupo = new THREE.Group(); grupo.position.set(p.x - OX, -OY, p.z - OZ); grupo.name = p.id;
  try {
    for (const arq of p.arquivos) {
      const g = await loader.parseAsync((await provedor.baixar(arq)).slice(0), '');
      g.scene.traverse((o) => { if (/side_cut/.test(o.name)) o.visible = false; if (o.isMesh) { o.receiveShadow = true; if (/terrain|terreno/i.test(o.name)) { o.userData.tile = p.id; solo.push(o); } } });
      grupo.add(g.scene);
    }
  } catch (e) { disposeGroup(grupo); throw e; }
  cena.add(grupo); carregados.set(p.id, grupo);
}
function stream(X, Z, raio) {
  if (carregando) return;
  carregando = (async () => {
    for (const [id, g] of carregados) if (distPeca(pecas.find((q) => q.id === id), X, Z) > raio + 2500) {
      g.traverse((o) => { const i = solo.indexOf(o); if (i >= 0) solo.splice(i, 1); }); disposeGroup(g); carregados.delete(id);
      for (const arq of pecas.find((q) => q.id === id).arquivos) provedor.esquecer(arq);   // os triângulos da simulação ficam no Worker
    }
    const p = pecas.filter((q) => !carregados.has(q.id) && distPeca(q, X, Z) < raio).sort((a, b) => distPeca(a, X, Z) - distPeca(b, X, Z))[0];
    if (p) await carregarPeca(p);
  })().catch((e) => { falhaTile = e; console.error(e); }).finally(() => { carregando = null; });
}
const raio = new THREE.Raycaster();
function alturaCena(x, z) {   // altura do GLB carregado sob (x, z) da cena, ou null
  raio.set(new THREE.Vector3(x, 5000, z), new THREE.Vector3(0, -1, 0));
  const id = hexEm(G, x + W, z + D)?.id, alvo = solo.filter((o) => o.userData.tile === id);   // só o terreno do hexágono sob o ponto
  const h = raio.intersectObjects(alvo, false)[0]; return h ? h.point.y : null;
}

// ------------------------------------------------------------------ modelos, vistas e marcadores
const est = { jogo: null, vistas: new Map(), marcas: new Map(), acum: 0, ultimo: performance.now(), vel: 1, velAntes: 1, sel: new Set(), seguido: null, modoOrdem: null,
  fps: 60, ms: 0, quadros: [], passosPerdidos: 0, filtro: 'todos', logVisto: 0, retratos: new Map(), ultimoSave: null };
const fachadas = new Map();
function fachada(R) {
  const k = `${R.id}:${R.X0}:${R.Z0}`;
  if (!fachadas.has(k)) { for (const c of fachadas.keys()) if (c.startsWith(R.id + ':')) fachadas.delete(c); fachadas.set(k, { largura: 2 * (W - ox(R)), profundidade: 2 * (D - oy(R)), m: Object.assign(Object.create(R.m), { terreno: { ...R.m.terreno, largura: 2 * (W - ox(R)), profundidade: 2 * (D - oy(R)) } }) }); }
  return fachadas.get(k);
}
const alturaDe = (id) => (x, y) => { const R = regiaoDe(est.jogo, id); return R ? altura(R.m.terreno, x, y) : 0; };
function criarVista(a) {
  const g = gltfs.get(a.especie.id); if (!g) return null;
  const v = new Animal3D(THREE, clonarEsqueleto, g, perfis[a.especie.id], a.especie, a, rigs.get(a.especie.id));
  if (a.hunter) instalarVisualHunter(v, g, a, { tempo: () => est.jogo.t, alturaEm: alturaDe(a.id), terreno: () => fachada(regiaoDe(est.jogo, a.id)) });
  if (a.monstro) instalarVisualMonstro(v, { tempo: () => est.jogo.t });
  v.raiz.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  cena.add(v.raiz); est.vistas.set(a.id, v); return v;
}
function descartarVista(v) {
  const doGlb = new Set();
  for (const g of gltfs.values()) g.scene.traverse((o) => { for (const mat of [o.material].flat().filter(Boolean)) { doGlb.add(mat); for (const x of Object.values(mat)) if (x?.isTexture) doGlb.add(x); } });
  const esqueletos = new Set();
  v.raiz.traverse((o) => { if (o.isSkinnedMesh) esqueletos.add(o.skeleton); for (const mat of [o.material].flat().filter(Boolean)) { if (doGlb.has(mat)) continue; for (const x of Object.values(mat)) if (x?.isTexture && !doGlb.has(x)) x.dispose(); mat.dispose(); } });
  esqueletos.forEach((e) => e.dispose()); cena.remove(v.raiz);
}
const mortosEm = new Map();
// Todas as regiões, inclusive as sem Hunter (criaturas paradas continuam visíveis). Ao mudar de região ou recentrar,
// a interpolação recomeça no ponto atual (as coordenadas locais mudaram; a posição no mundo, não).
function sincronizarVistas() {
  const j = est.jogo, vivos = new Set();
  for (const R of j.regioes.values()) for (const a of R.m.vivos) {
    vivos.add(a.id);
    const v = est.vistas.get(a.id) ?? criarVista(a); if (!v) continue;
    const chave = `${R.id}:${R.X0}:${R.Z0}`;
    if (v.regiaoChave !== chave) { v.regiaoChave = chave; v.passoSimulacao(a); }
    v.passoSimulacao(a);
  }
  for (const [id, v] of est.vistas) {
    if (vivos.has(id)) continue;
    const R = regiaoDe(j, id), morto = R?.m.mortos.get(id);
    if (morto && !mortosEm.has(id)) { mortosEm.set(id, j.t); v.passoSimulacao(morto); }
    if (!morto || j.t - mortosEm.get(id) > 120) { descartarVista(v); est.vistas.delete(id); }
  }
}
// Marcador de seleção/viagem: anel no chão + haste. Hunters em viagem estratégica só têm marcador (sem modelo).
// Cor por posição no esquadrão (sem depender dos ids da demonstração).
const PALETA = [0xe3c27a, 0x7fb0d6, 0x8fd18a, 0xd98fd1, 0xe0896b, 0x9fd6d0, 0xc7b2f0, 0xd6c46b];
const corDe = (id) => PALETA[Math.max(0, [...(est.jogo?.hunters.keys() ?? [])].indexOf(id)) % PALETA.length];
function marcador(id) {
  if (est.marcas.has(id)) return est.marcas.get(id);
  const g = new THREE.Group(), cor = corDe(id);
  const anel = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 32), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.9, depthTest: false }));
  anel.rotation.x = -Math.PI / 2; anel.renderOrder = 5;
  const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 30, 6), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.75 }));
  haste.position.y = 15; g.add(anel, haste); g.userData = { anel, haste }; cena.add(g); est.marcas.set(id, g); return g;
}
const apresentacao = criarApresentacao({ THREE, scene: cena, camera, orbit: null, canvas: renderer.domElement, trajetoria: (a, t) => {
  const action = a.hunter?.action; if (!action || t < action.start || t > action.end) return null;
  const s = segmentoMundo(a, amostrarArma(action, t, { arma: a.hunter.equipamento.arma, altura: a.especie.corpo.alturaM * a.escala }));
  const ph = action.clip ? trajetoriaPve(action.clip)?.phases : null, c = action.clipeInicio ?? action.start;
  return { base: s.grip, tip: s.tip, active: (ph?.activeStart != null && t >= c + (ph.anticipation ?? ph.activeStart) && t <= c + (ph.recovery ?? ph.activeEnd)) || s.active };
} });
async function retratos() {
  // Miniatura real: o GLB do Hunter renderizado uma vez num canvas pequeno (todos usam o mesmo modelo nesta build).
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); r.setSize(96, 64); r.outputColorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Scene(), modelo = SkeletonUtils.clone(gltfs.get('hunter').scene); s.add(modelo, new THREE.HemisphereLight(0xffffff, 0x445544, 2.2));
  const caixa = new THREE.Box3().setFromObject(modelo), tam = caixa.getSize(new THREE.Vector3()), topo = caixa.max.y;
  const c = new THREE.PerspectiveCamera(30, 96 / 64, 0.01, 100); c.position.set(caixa.getCenter(new THREE.Vector3()).x, topo - tam.y * 0.18, caixa.max.z + tam.y * 0.9); c.lookAt(c.position.x, topo - tam.y * 0.22, 0);
  r.render(s, c); const url = r.domElement.toDataURL('image/png'); r.dispose(); r.forceContextLoss();
  for (const id of est.jogo.hunters.keys()) est.retratos.set(id, url);
}

// ------------------------------------------------------------------ sessão, save (IndexedDB) e congelamento
const DB = () => new Promise((ok, erro) => { const q = indexedDB.open('wildhaven-v02', 1); q.onupgradeneeded = () => q.result.createObjectStore('saves'); q.onsuccess = () => ok(q.result); q.onerror = () => erro(q.error); });
async function lerSave() { try { const db = await DB(); return await new Promise((ok) => { const r = db.transaction('saves').objectStore('saves').get('demo'); r.onsuccess = () => ok(r.result ?? null); r.onerror = () => ok(null); }); } catch { return null; } }
async function gravarSave() {
  if (!est.jogo) return false;
  try {
    const s = salvarJogo(est.jogo), db = await DB();
    await new Promise((ok, erro) => { const tx = db.transaction('saves', 'readwrite'); tx.objectStore('saves').put(s, 'demo'); tx.oncomplete = ok; tx.onerror = () => erro(tx.error); });
    est.ultimoSave = s.salvoEm; $('salvoEm').textContent = `salvo ${new Date(s.salvoEm).toLocaleTimeString('pt-BR')}`; return true;
  } catch (e) { aviso('Falha ao salvar: ' + e.message); return false; }
}
async function apagarSave() { try { const db = await DB(); await new Promise((ok) => { const tx = db.transaction('saves', 'readwrite'); tx.objectStore('saves').delete('demo'); tx.oncomplete = ok; tx.onerror = ok; }); } catch { /* nada salvo */ } }
function montar(jogo) {
  for (const v of est.vistas.values()) descartarVista(v); est.vistas.clear(); mortosEm.clear();
  est.jogo = jogo; est.logVisto = jogo.log.length; est.sel = new Set([[...jogo.hunters.keys()][0]]); est.seguido = null;
  sincronizarVistas();
  const R = regiaoDe(jogo, [...jogo.hunters.keys()][0]), vl = { x: jogo.vila.x - ox(R), y: jogo.vila.y - oy(R) };
  const p = cenaDeJogo(jogo.vila.x, jogo.vila.y, altura(R.m.terreno, vl.x, vl.y));
  orbit.target.copy(p); camera.position.set(p.x + 45, p.y + 55, p.z + 45); orbit.update();
  desenharEsquadrao(); desenharPainel();
}
// Sair = salvar e congelar. Sem progresso offline: o relógio da simulação só anda com a página aberta e visível.
document.addEventListener('visibilitychange', () => {
  if (!est.jogo) return;
  if (document.hidden) { est.velAntes = est.vel; velocidade(0); gravarSave(); } else velocidade(est.velAntes);
});
addEventListener('pagehide', () => { if (est.jogo) gravarSave(); });
setInterval(() => { if (est.jogo && est.vel > 0) gravarSave(); }, 30000);

// ------------------------------------------------------------------ interface
function aviso(txt, classe = '') { const d = document.createElement('div'); d.textContent = txt; d.className = classe; $('avisos').append(d); setTimeout(() => d.remove(), 4000); while ($('avisos').childElementCount > 4) $('avisos').firstChild.remove(); }
function velocidade(v) { est.vel = v; for (const b of document.querySelectorAll('[data-vel]')) b.classList.toggle('ativo', Number(b.dataset.vel) === v); }
const vivo = (id) => situacao(est.jogo, id) !== 'morto';
function selecionar(id, multi = false) {
  if (multi) { if (est.sel.has(id)) est.sel.delete(id); else est.sel.add(id); } else est.sel = new Set([id]);
  est.regrasPara = null; desenharEsquadrao(); desenharPainel();
}
function observar(id) { est.seguido = est.seguido === id ? null : id; if (est.seguido) { const p = posicao(est.jogo, id); const R = regiaoDe(est.jogo, id), h = est.jogo.hunters.get(id).modo === 'detalhado' && R ? altura(R.m.terreno, p.x - ox(R), p.y - oy(R)) : (alturaCena(p.x - W, p.y - D) ?? orbit.target.y); const alvo = cenaDeJogo(p.x, p.y, h); camera.position.add(alvo.clone().sub(orbit.target)); orbit.target.copy(alvo); } desenharEsquadrao(); }
// Cartões criados uma vez e atualizados no lugar: recriar o HTML a cada 250 ms engolia cliques e duplos cliques.
function desenharEsquadrao() {
  const j = est.jogo, nav = $('esquadrao');
  if (nav.childElementCount !== j.hunters.size) {
    nav.innerHTML = [...j.hunters.keys()].map((id) => `<button class="cartao" data-id="${id}" title="Clique: selecionar · Ctrl/Shift+clique: seleção múltipla · duplo clique: observar">
      <img alt="" style="border-bottom:3px solid #${(corDe(id)).toString(16).padStart(6, '0')}"><span class="n"></span><div class="barra"><i></i></div><span class="tag"></span><span class="tc"></span><span class="alerta" hidden>!</span></button>`).join('');
    for (const b of nav.children) {
      b.onclick = (e) => selecionar(b.dataset.id, e.ctrlKey || e.shiftKey || e.metaKey);
      b.ondblclick = () => { selecionar(b.dataset.id); est.seguido = null; observar(b.dataset.id); };
    }
  }
  for (const b of nav.children) {
    const id = b.dataset.id, a = atorDe(j, id), s = situacao(j, id), nome = a.hunter.nome ?? id, img = b.querySelector('img'), tag = b.querySelector('.tag');
    b.className = `cartao${est.sel.has(id) ? ' sel' : ''}${est.seguido === id ? ' seguido' : ''}${s === 'morto' ? ' morto' : ''}`;
    b.setAttribute('aria-pressed', String(est.sel.has(id)));
    if (est.retratos.has(id) && img.getAttribute('src') !== est.retratos.get(id)) img.src = est.retratos.get(id);
    img.alt = 'Retrato de ' + nome; b.querySelector('.n').textContent = nome;
    b.querySelector('.barra i').style.width = `${(Math.max(0, a.saude.hp / a.saude.hpMax) * 100).toFixed(0)}%`;
    tag.textContent = s; tag.className = 'tag ' + s.replace(' ', '');
    const e = j.hunters.get(id); b.querySelector('.tc').textContent = s === 'morto' ? '' : rotulo(j, e.atual);
    const alerta = b.querySelector('.alerta'); alerta.hidden = !['defesa', 'evitar'].includes(e.regraAtiva) && !(a.saude.hp < a.saude.hpMax * 0.4 && s !== 'morto');
    alerta.title = e.regraAtiva === 'defesa' ? 'em combate' : e.regraAtiva === 'evitar' ? 'evitando ameaça' : 'ferido gravemente';
  }
}
function desenharPainel() {
  const j = est.jogo, ids = [...est.sel], id = ids[0];
  if (!id) { $('detalhe').innerHTML = '<p class="nota">Selecione um Hunter no esquadrão.</p>'; return; }
  const a = atorDe(j, id), e = j.hunters.get(id), s = situacao(j, id), h = estadoHunter(a), p = posicao(j, id);
  const t = e.atual, alvo = t?.alvo ?? (t?.pontos ? t.pontos[t.i % t.pontos.length] : null) ?? e.estrat?.destino;
  const dist = alvo ? Math.hypot(alvo.x - p.x, alvo.y - p.y) : null, hex = hexEm(j.G, p.x, p.y);
  const perigos = e.modo === 'detalhado' ? (a.contatos ?? []).filter((c) => c.especie === 'varrisco').map((c) => `${c.especie} a ${c.distancia.toFixed(0)} m (${c.via})`) : ['não simulados durante a viagem simplificada'];
  const fer = a.saude.ferimentos.length ? a.saude.ferimentos.map((f) => `${f.regiao}${f.fratura ? ' (fratura)' : ''}${f.sangramento > 0 ? ' sangrando' : ''}`).join(', ') : 'nenhum';
  const barra = (v, c = '') => `<div class="barra ${c}"><i style="width:${Math.max(0, Math.min(1, v)) * 100}%"></i></div>`;
  $('detalhe').innerHTML = `<h3>${esc(h.nome)} ${ids.length > 1 ? `<small>+${ids.length - 1} selecionado(s) — ordens valem para o grupo</small>` : ''}</h3>
    <dl class="campo"><dt>Situação</dt><dd><span class="tag ${s.replace(' ', '')}">${s}</span> ${e.modo === 'estrategico' ? '<small>simulação simplificada</small>' : '<small>simulação detalhada</small>'}</dd>
    <dt>Decisão da IA</dt><dd>${e.modo === 'estrategico' ? 'em viagem pela rota; IA detalhada suspensa até voltar à região detalhada' : `${esc(h.estado)} — ${esc(h.motivo)}`}</dd>
    <dt>Vida</dt><dd>${barra(h.hp / h.hpMax)}${Math.max(0, h.hp).toFixed(0)} / ${h.hpMax.toFixed(0)}</dd>
    <dt>Resistência</dt><dd>${barra(h.energia / 100, 'res')}${h.energia.toFixed(0)} <small>(PvE v02: sem fadiga na simulação)</small></dd>
    <dt>Condição</dt><dd>dor ${h.dor.toFixed(2)} · ferimentos: ${esc(fer)}</dd>
    <dt>Atributos</dt><dd>${Object.entries(a.atributos ?? {}).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(' · ')}</dd>
    <dt>Equipamento</dt><dd>${esc(h.equipamento.arma)} · armadura ${esc(h.equipamento.armadura ?? '—')} · habilidade ${(a.hunter.habilidade ?? 0).toFixed(2)}</dd>
    <dt>Tarefa</dt><dd>${esc(rotulo(j, t))}${t ? barra(t.progresso ?? 0, 'prog') + `<small>${esc(t.estado)}</small>` : ''}</dd>
    <dt>Destino</dt><dd>${alvo ? `${hexEm(j.G, alvo.x, alvo.y)?.id ?? '—'} · ${dist.toFixed(0)} m` : '—'}</dd>
    <dt>Rota</dt><dd>${e.estrat?.hexes ? esc(e.estrat.hexes.join(' → ')) : e.saida ? esc(e.saida.hexes.join(' → ')) : hex?.id ?? '—'}</dd>
    <dt>Fila</dt><dd>${e.fila.length ? e.fila.map((x) => esc(rotulo(j, x))).join(' · ') : '—'}</dd>
    <dt>Perigos</dt><dd>${perigos.length ? esc(perigos.join(' · ')) : 'nenhum à vista'}</dd></dl>`;
  $('btnObservar').textContent = est.seguido === id ? 'Parar de acompanhar' : 'Observar (acompanhar)';
  desenharIA(id, e, a);
  const morto = s === 'morto';
  for (const b of document.querySelectorAll('[data-ordem]')) b.disabled = morto && ids.length === 1;
}
function desenharIA(id, e, a) {
  const p = PERFIS[e.perfil];
  if (document.activeElement !== $('perfil')) $('perfil').value = e.perfil;
  $('perfilDesc').textContent = `${p.descricao} Tolera risco ${p.toleranciaRisco}× (o dobro contra a presa da missão), recua abaixo de ${p.retiradaHp * 100}% de vida, retoma ${p.esperaRetomarSeg} s após a ameaça sumir${Number.isFinite(p.maxInterrupcoes) ? `, abandona após ${p.maxInterrupcoes} interrupções` : ''}, descansa até ${p.descansoAte * 100}%. Personalidade: agressividade ${a.hunter.personalidade.agressividade.toFixed(2)}, cautela ${a.hunter.personalidade.cautela.toFixed(2)}.`;
  const r = REGRAS.find((x) => x.id === e.regraAtiva);
  $('regraAtiva').textContent = r ? `Regra ativa: ${r.nome}${e.interrupcao ? ' · missão interrompida' : ''}` : e.interrupcao ? 'Missão interrompida, aguardando a ameaça sumir' : 'Nenhuma regra assumindo: seguindo a tarefa';
  if (est.regrasPara !== id) {
    est.regrasPara = id;
    $('regras').innerHTML = '<tr><th>Ativa</th><th>Regra</th><th>Prioridade</th></tr>' + REGRAS.map((x) => `<tr><td><input type="checkbox" data-regra="${x.id}" ${x.fixa ? 'disabled checked title="sobrevivência: não pode ser desligada"' : e.regrasDesligadas[x.id] ? '' : 'checked'} aria-label="${esc(x.nome)}"></td><td>${esc(x.nome)}</td><td><input type="number" class="prio" data-prio="${x.id}" value="${prioridade(e, x)}" ${x.fixa ? 'disabled' : ''} aria-label="Prioridade de ${esc(x.nome)}"></td></tr>`).join('');
    for (const c of $('regras').querySelectorAll('[data-regra]')) c.onchange = () => { for (const h of est.sel) est.jogo.hunters.get(h).regrasDesligadas[c.dataset.regra] = !c.checked; };
    for (const c of $('regras').querySelectorAll('[data-prio]')) c.onchange = () => { const v = Number(c.value); for (const h of est.sel) { const st = est.jogo.hunters.get(h); if (c.value !== '' && Number.isFinite(v)) st.prioridades[c.dataset.prio] = v; else delete st.prioridades[c.dataset.prio]; } };
  }
  $('decisoes').innerHTML = e.decisoes.slice(-12).reverse().map((d) => `<li><small>${fmtT(d.t)}</small> ${esc(d.motivo)}</li>`).join('') || '<li class="nota">nenhuma decisão registrada ainda</li>';
}
function desenharRegistro() {
  const j = est.jogo, itens = j.log.filter((r) => est.filtro === 'todos' || r.tipo === est.filtro || (est.filtro === 'perigo' && r.tipo === 'morte')).slice(-120);
  $('eventos').innerHTML = itens.map((r) => `<li class="${r.tipo}"><small>${fmtT(r.t)}</small> <b>${esc(atorDe(j, r.id)?.hunter?.nome ?? r.id)}</b> ${esc(r.texto)}</li>`).join('');
  $('registro').scrollTop = $('registro').scrollHeight;
  for (const r of j.log.slice(est.logVisto)) if (r.tipo === 'morte' || (r.tipo === 'perigo' && /incapacitado/.test(r.texto))) aviso(`${atorDe(j, r.id)?.hunter?.nome ?? r.id}: ${r.texto}`);
    else if (/abatido|localizado/.test(r.texto)) aviso(`${atorDe(j, r.id)?.hunter?.nome ?? r.id}: ${r.texto}`, 'bom');
  est.logVisto = j.log.length;
}
const fmtT = (t) => `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
$('btnObservar').onclick = () => { const id = [...est.sel][0]; if (id) observar(id); };
$('perfil').innerHTML = Object.entries(PERFIS).map(([k, p]) => `<option value="${k}">${p.nome}</option>`).join('');
// Perfil vale para todos os selecionados; tarefa, fila e interrupção ficam como estão.
$('perfil').onchange = () => { for (const id of [...est.sel].filter(vivo)) definirPerfil(est.jogo, id, $('perfil').value); desenharPainel(); };

for (const b of document.querySelectorAll('[data-f]')) b.onclick = () => { est.filtro = b.dataset.f; for (const x of document.querySelectorAll('[data-f]')) x.classList.toggle('ativo', x === b); desenharRegistro(); };
$('especie').innerHTML = ESPECIES_CACA.map((e) => `<option value="${e.id}">${e.nome}</option>`).join('') + Object.values(CFG.especies).filter((e) => e.id !== 'hunter' && e.id !== 'varrisco').slice(0, 12).map((e) => `<option value="${e.id}">${esc(e.nome)} — fora da região simulada</option>`).join('');

// Ordens. Ir até ponto: próximo clique no terreno. Hexágono: escolha no mapa.
function darOrdem(tarefa, fila) {
  const ids = [...est.sel].filter(vivo); if (!ids.length) return;
  ordenar(est.jogo, ids, tarefa, { fila: fila || $('naFila').checked });
  $('dicaOrdem').textContent = `${ids.length > 1 ? ids.length + ' Hunters' : atorDe(est.jogo, ids[0]).hunter.nome}: ${rotulo(est.jogo, tarefa)}${fila || $('naFila').checked ? ' (na fila)' : ''}`;
  est.modoOrdem = null; desenharPainel(); desenharEsquadrao();
}
for (const b of document.querySelectorAll('[data-ordem]')) b.onclick = (ev) => {
  const o = b.dataset.ordem, fila = ev.shiftKey, ids = [...est.sel];
  if (!ids.length) return;
  const p = posicao(est.jogo, ids[0]);
  if (o === 'ir-ponto') { est.modoOrdem = { tipo: 'ponto', fila }; $('dicaOrdem').textContent = 'Clique no terreno para marcar o destino (Esc cancela).'; }
  else if (o === 'ir-hex' || o === 'explorar') { est.modoOrdem = { tipo: o, fila }; abrirMapa(o === 'ir-hex' ? 'Escolha o hexágono de destino' : 'Escolha o hexágono a explorar'); }
  else if (o === 'patrulhar') darOrdem({ tipo: 'patrulhar', centro: { x: p.x, y: p.y }, raio: 120 }, fila);
  else if (o === 'cacar') darOrdem({ tipo: 'cacar', especie: $('especie').value }, fila);
  else darOrdem({ tipo: o }, fila);
};
// Clique no terreno: ordem "ir até ponto" ou seleção do Hunter mais próximo do clique.
const ponteiro = new THREE.Vector2(); let arrasto = null;
renderer.domElement.addEventListener('pointerdown', (e) => { arrasto = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!arrasto || Math.hypot(e.clientX - arrasto[0], e.clientY - arrasto[1]) > 5 || e.button !== 0) return;
  ponteiro.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); raio.setFromCamera(ponteiro, camera);
  const hit = raio.intersectObjects(solo, false)[0]; if (!hit) return;
  const x = hit.point.x + W, y = hit.point.z + D;
  if (est.modoOrdem?.tipo === 'ponto') { darOrdem({ tipo: 'ir', alvo: { x, y }, hex: hexEm(est.jogo.G, x, y)?.id }, est.modoOrdem.fila || e.shiftKey); return; }
  let melhor = null, dm = 4;
  for (const id of est.jogo.hunters.keys()) { const p = posicao(est.jogo, id), d = Math.hypot(p.x - x, p.y - y); if (d < dm) { dm = d; melhor = id; } }
  if (melhor) selecionar(melhor, e.ctrlKey || e.shiftKey);
});
// Câmera: WASD/setas deslocam o alvo, Q/E giram. Nenhuma tecla comanda Hunter.
const teclas = new Set();
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.code === 'KeyM') { $('mapa').hidden ? abrirMapa() : fecharMapa(); return; }
  if (e.code === 'Escape') { est.modoOrdem = null; $('dicaOrdem').textContent = ''; fecharMapa(); return; }
  if (e.code === 'Space') { e.preventDefault(); if (est.vel) { est.velAntes = est.vel; velocidade(0); } else velocidade(est.velAntes || 1); return; }
  if (/^Digit[1-4]$/.test(e.code)) { const id = [...est.jogo.hunters.keys()][Number(e.code.slice(5)) - 1]; if (id) selecionar(id, e.ctrlKey || e.shiftKey); return; }
  if (e.code === 'KeyF' && est.sel.size) { observar([...est.sel][0]); return; }
  teclas.add(e.code);
});
addEventListener('keyup', (e) => teclas.delete(e.code));
addEventListener('blur', () => teclas.clear());
function moverCamera(dt) {
  const f = (teclas.has('KeyW') || teclas.has('ArrowUp')) - (teclas.has('KeyS') || teclas.has('ArrowDown')), r = (teclas.has('KeyD') || teclas.has('ArrowRight')) - (teclas.has('KeyA') || teclas.has('ArrowLeft'));
  const gira = teclas.has('KeyQ') - teclas.has('KeyE');
  if (f || r) {
    const dir = new THREE.Vector3().subVectors(orbit.target, camera.position).setY(0).normalize(), lado = new THREE.Vector3(-dir.z, 0, dir.x);
    const v = dir.multiplyScalar(f).add(lado.multiplyScalar(r)).multiplyScalar(dt * Math.max(15, camera.position.distanceTo(orbit.target) * 0.9));
    orbit.target.add(v); camera.position.add(v); est.seguido = null;
  }
  if (gira) { const off = camera.position.clone().sub(orbit.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), gira * dt * 1.4); camera.position.copy(orbit.target).add(off); }
}

// ------------------------------------------------------------------ mapa continental (clicável)
const corBioma = (b) => /ice|glacial|snow|iceberg/i.test(b) ? '#d6e3ea' : /jungle|tropical|swamp/i.test(b) ? '#3f7d3a' : /savanna/i.test(b) ? '#b59a45' : /dune|desert|erg|dunas|deserto|arco|oásis|mesas|torres|cânion|arenito/i.test(b) ? '#d4a35f'
  : /ice|glacial|snow|iceberg/i.test(b) ? '#d6e3ea' : /mountain|maciço/i.test(b) ? '#8a8378' : /praia/i.test(b) ? '#e6d49b' : /falesia/i.test(b) ? '#9d8f7d'
  : /plains|prairie|grassland/i.test(b) ? '#9fbf6a' : /forest/i.test(b) ? '#4f8a4a' : '#7d8f84';
let escalaMapa = null;
function hexagono(ctx, x, y, r) { ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; ctx[k ? 'lineTo' : 'moveTo'](x + r * Math.cos(a), y + r * Math.sin(a)); } ctx.closePath(); }
function desenharMapa(destaque = null) {
  const c = $('mapaCanvas'), ctx = c.getContext('2d'), ts = G.tiles;
  const xs = ts.map((t) => t.cx), ys = ts.map((t) => t.cy), minX = Math.min(...xs) - 3000, maxX = Math.max(...xs) + 3000, minY = Math.min(...ys) - 3000, maxY = Math.max(...ys) + 3000;
  const s = Math.min(c.width / (maxX - minX), c.height / (maxY - minY)), px = (x) => (x - minX) * s, py = (y) => (y - minY) * s;
  escalaMapa = { s, minX, minY };
  ctx.fillStyle = '#16303f'; ctx.fillRect(0, 0, c.width, c.height);
  for (const t of ts) {
    hexagono(ctx, px(t.cx), py(t.cy), 2500 * s); ctx.fillStyle = corBioma(t.bioma); ctx.fill();
    ctx.setLineDash(DETALHADOS.has(t.id) ? [] : [2, 2]); ctx.lineWidth = DETALHADOS.has(t.id) || t.id === destaque ? 3 : 0.6;
    ctx.strokeStyle = t.id === destaque ? '#ffffff' : DETALHADOS.has(t.id) ? '#e3c27a' : '#0007'; ctx.stroke(); ctx.setLineDash([]);
    if (t.custo === null) { ctx.fillStyle = '#300'; ctx.font = '10px sans-serif'; ctx.fillText('✕', px(t.cx) - 3, py(t.cy) + 3); }
  }
  const j = est.jogo;
  for (const [id, e] of j.hunters) {
    const rota = e.estrat?.pontos ?? (e.saida ? [posicao(j, id), e.saida.ponto] : null);
    if (rota) { ctx.strokeStyle = '#' + (corDe(id)).toString(16).padStart(6, '0'); ctx.lineWidth = 2; ctx.beginPath(); rota.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](px(p.x), py(p.y))); ctx.stroke(); }
    const p = posicao(j, id); ctx.fillStyle = '#' + (corDe(id)).toString(16).padStart(6, '0'); ctx.beginPath(); ctx.arc(px(p.x), py(p.y), est.sel.has(id) ? 6 : 4, 0, 7); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
  }
}
function abrirMapa(titulo = 'Auralis — 272 hexágonos') { $('mapaTitulo').textContent = titulo; $('mapa').hidden = false; desenharMapa(); }
function fecharMapa() { $('mapa').hidden = true; if (est.modoOrdem?.tipo !== 'ponto') est.modoOrdem = null; }
$('fecharMapa').onclick = fecharMapa; $('btnMapa').onclick = () => abrirMapa();
const hexDoMapa = (e) => { const c = $('mapaCanvas'), r = c.getBoundingClientRect(), k = c.width / r.width; return hexEm(G, (e.clientX - r.left) * k / escalaMapa.s + escalaMapa.minX, (e.clientY - r.top) * k / escalaMapa.s + escalaMapa.minY); };
$('mapaCanvas').onmousemove = (e) => { const t = escalaMapa && hexDoMapa(e); $('mapaHex').textContent = t ? `${t.id} · ${t.bioma} · ${t.custo === null ? 'intransponível' : 'custo ' + t.custo}${DETALHADOS.has(t.id) ? ' · região detalhada' : ''}` : ''; };
$('mapaCanvas').onclick = (e) => {
  const t = hexDoMapa(e); if (!t || !est.modoOrdem) return;
  if (t.custo === null) { $('mapaHex').textContent = `${t.id}: intransponível`; return; }
  const m = est.modoOrdem; fecharMapa();
  darOrdem(m.tipo === 'explorar' ? { tipo: 'explorar', hex: t.id } : { tipo: 'ir', alvo: { x: t.cx, y: t.cy }, hex: t.id }, m.fila || e.shiftKey);
};

// ------------------------------------------------------------------ laço
for (const b of document.querySelectorAll('[data-vel]')) b.onclick = () => velocidade(Number(b.dataset.vel));
$('qualidade').onchange = () => aplicarQualidade($('qualidade').value);
$('btnSalvar').onclick = async () => { if (await gravarSave()) aviso('Sessão salva', 'bom'); };
$('btnReiniciar').onclick = async () => {
  if (!confirm('Reiniciar a demonstração? A sessão salva será apagada e os quatro Hunters voltam à vila. Esta opção existe só no modo de demonstração.')) return;
  await apagarSave(); montar(await novoJogo(Date.now() % 1000)); aviso('Demonstração reiniciada', 'bom');
};
async function novoJogo(semente) {
  const G = novoGrafo(), terreno = await provedor.montarAsync({ ...JANELA_INICIAL, hexes: hexesDaJanela(G, JANELA_INICIAL).filter((id) => provedor.disponivel(id)) });
  return criarJogo(CFG, semente, { fichaHunter, equipamentos, G, provedor, terreno });
}
async function restaurar(salvo) {
  const G = novoGrafo(), terrenos = new Map();
  for (const w of janelasDoSave(salvo)) terrenos.set(w.id, await provedor.montarAsync({ ...w, hexes: hexesDaJanela(G, w).filter((id) => provedor.disponivel(id)) }));
  return carregarJogo(CFG, salvo, { fichaHunter, equipamentos, G, provedor, terrenos });
}
let ultimoPainel = 0;
function laco(agora) {
  requestAnimationFrame(laco);
  const dt = Math.min(0.1, (agora - est.ultimo) / 1000); est.ultimo = agora;
  est.fps = est.fps * 0.95 + (1 / Math.max(1e-3, dt)) * 0.05;
  const j = est.jogo; if (!j) return;
  const t0 = performance.now();
  if (est.vel > 0 && !apresentacao.congelado()) {
    est.acum += dt * est.vel; let n = 0;
    const dtSim = j.cen.dt;
    while (est.acum >= dtSim && n < 60) { passoJogo(j); est.acum -= dtSim; n++; sincronizarVistas(); }
    if (est.acum > dtSim * 4) { est.passosPerdidos += Math.floor(est.acum / dtSim); est.acum = 0; }   // sem recuperar atraso: a aceleração cede ao custo
    for (const R of j.regioes.values()) if (R.m.historicoComandos?.length > 2000) R.m.historicoComandos.splice(0, 1000);
  }
  const alfa = Math.min(1, est.acum / j.cen.dt), dv = est.vel > 0 ? dt * Math.min(est.vel, 4) : 0;
  for (const [id, v] of est.vistas) { const R = regiaoDe(j, id), a = R && (R.m.porId.get(id) ?? R.m.mortos.get(id) ?? R.m.animais.find((x) => x.id === id)); if (a) v.quadro(alfa, dv, a, fachada(R), alturaDe(id), null); }
  // Efeitos de combate: só da região do Hunter observado (é onde a câmera está).
  const foco = est.seguido ?? [...est.sel][0], Rf = foco && regiaoDe(j, foco);
  if (Rf) apresentacao.update(fachada(Rf).m, dv, { sons: false, efeitos: true, selected: foco });
  // Marcadores: seleção e Hunters em viagem simplificada.
  for (const id of j.hunters.keys()) {
    const e = j.hunters.get(id), mk = marcador(id), p = posicao(j, id), v = est.vistas.get(id);
    // Em viagem: altura do GLB por raycast só a cada 10 m andados (o raio contra terrenos inteiros custa dezenas de ms).
    const pos = v && e.modo === 'detalhado' ? v.raiz.position : (() => { const x = p.x - W, z = p.y - D, u = mk.userData; if (!u.h || Math.hypot(u.h.x - x, u.h.z - z) > 10) u.h = { x, z, y: alturaCena(x, z) ?? u.h?.y ?? orbit.target.y }; return new THREE.Vector3(x, u.h.y, z); })();
    mk.position.set(pos.x, pos.y + 0.05, pos.z);
    mk.userData.haste.visible = e.modo === 'estrategico' || camera.position.distanceTo(pos) > 250;
    mk.userData.anel.visible = est.sel.has(id) || e.modo === 'estrategico'; mk.visible = situacao(j, id) !== 'morto';
    const esc = Math.max(1, camera.position.distanceTo(pos) / 60); mk.scale.setScalar(esc);
  }
  // Acompanhar sem prender a câmera ao Hunter: só desloca alvo e câmera pelo mesmo vetor (zoom e ângulo ficam com o jogador).
  if (est.seguido) { const mk = est.marcas.get(est.seguido); if (mk) { const d = mk.position.clone().sub(orbit.target).multiplyScalar(Math.min(1, dt * 6)); orbit.target.add(d); camera.position.add(d); } }
  moverCamera(dt); orbit.update();
  sol.target.position.copy(orbit.target); sol.position.set(orbit.target.x - 80, orbit.target.y + 150, orbit.target.z + 60);
  stream(orbit.target.x + OX, orbit.target.z + OZ, PRESETS[qualidade].raio);
  renderer.render(cena, camera);
  est.ms = est.ms * 0.9 + (performance.now() - t0) * 0.1; est.quadros.push(dt); if (est.quadros.length > 600) est.quadros.shift();
  if (agora - ultimoPainel > 250) {
    ultimoPainel = agora; desenharEsquadrao(); desenharPainel(); desenharRegistro(); if (!$('mapa').hidden) desenharMapa();
    const r = [...j.regioes.values()][0]?.m.relogio, i = renderer.info;
    $('relogio').textContent = `dia ${Math.floor(r?.diaInteiro ?? 0)} · ${fmtT(j.t)} · ${est.vel ? est.vel + '×' : 'pausa'}`;
    $('perf').textContent = `${est.fps.toFixed(0)} fps · ${est.ms.toFixed(1)} ms · ${i.render.calls} dc · ${(i.render.triangles / 1e6).toFixed(2)} Mtri · ${carregados.size} hex · ${j.regioes.size} regiões${est.passosPerdidos ? ' · passos cedidos ' + est.passosPerdidos : ''}`;
  }
}

// ------------------------------------------------------------------ API dos testes de navegador (sem controle de Hunter)
window.wildhaven2 = {
  get jogo() { return est.jogo; },
  selecionar: (ids) => { est.sel = new Set(ids); desenharEsquadrao(); desenharPainel(); },
  observar: (id) => { est.seguido = null; observar(id); },
  seguido: () => est.seguido,
  velocidade, gravarSave, lerSave,
  estado: (id) => { const j = est.jogo, e = j.hunters.get(id), p = posicao(j, id), a = atorDe(j, id); return { id, situacao: situacao(j, id), modo: e.modo, x: p.x, y: p.y, hp: a.saude.hp, tarefa: e.atual ? { tipo: e.atual.tipo, i: e.atual.i ?? null, progresso: e.atual.progresso, inicio: e.atual.inicio, estado: e.atual.estado } : null, fila: e.fila.length, controle: a.hunter.controle, ia: estadoHunter(a).estado, log: e.log.length }; },
  todos: () => [...est.jogo.hunters.keys()].map((id) => window.wildhaven2.estado(id)),
  varrisco: () => { const v = varriscoDe(est.jogo); return { hp: v.a.saude.hp, hpMax: v.a.saude.hpMax, vivo: v.vivo, x: v.a.x + ox(v.R), y: v.a.y + oy(v.R), regiao: v.R.id }; },
  regioes: () => [...est.jogo.regioes.values()].map((R) => ({ id: R.id, X0: R.X0, Z0: R.Z0, hunters: R.m.hunters.filter((a) => R.m.porId.has(a.id)).map((a) => a.id), vivos: R.m.vivos.length, hexes: hexesDaJanela(est.jogo.G, R).filter((h) => DETALHADOS.has(h)) })),
  regiaoDe: (id) => regiaoDe(est.jogo, id)?.id ?? null,
  vistaDe: (id) => { const v = est.vistas.get(id); if (!v) return null; v.raiz.updateMatrixWorld(true); const p = v.raiz.getWorldPosition(new THREE.Vector3()); return { cena: p.toArray().map((x) => +x.toFixed(2)), jogo: { x: +(p.x + W).toFixed(2), y: +(p.z + D).toFixed(2) }, clip: v.controladorTatico?.clip ?? v.nomeAtual ?? null, visivel: v.raiz.visible }; },
  hexesDesenhados: () => [...carregados.keys()],
  provedor: () => ({ hex: provedor.medidas.hex, grade: provedor.medidas.grade, erro: provedor.erro() }),
  camera: () => ({ alvo: orbit.target.toArray().map((v) => +v.toFixed(1)), pos: camera.position.toArray().map((v) => +v.toFixed(1)), polar: +orbit.getPolarAngle().toFixed(3) }),
  medir() { const q = [...est.quadros].sort((a, b) => a - b); return { qualidade, gpu, fpsMedio: +(q.length / q.reduce((s, x) => s + x, 0)).toFixed(1), msP95: +((q[Math.floor(q.length * 0.95)] ?? 0) * 1000).toFixed(1), drawCalls: renderer.info.render.calls, triangulos: renderer.info.render.triangles, geometrias: renderer.info.memory.geometries, texturas: renderer.info.memory.textures, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1e6).toFixed(0) : null, hexes: carregados.size, passosCedidos: est.passosPerdidos, falhaTile: falhaTile?.message ?? null }; },
  log: () => est.jogo.log,
  decisoes: (id) => est.jogo.hunters.get(id).decisoes,
  perfil: (id) => est.jogo.hunters.get(id).perfil,
  regraAtiva: (id) => est.jogo.hunters.get(id).regraAtiva,
  interrupcao: (id) => est.jogo.hunters.get(id).interrupcao,
  // Só para testes: a mesma chamada que os botões de ordem fazem, com um destino exato (cenário reproduzível).
  ordenarTeste: (ids, tarefa) => ordenar(est.jogo, ids, tarefa),
  // Ponto do jogo → pixel da tela (para o teste clicar no terreno como uma pessoa).
  paraTela(x, y) { const R = regiaoDe(est.jogo, [...est.sel][0]), v = cenaDeJogo(x, y, R ? altura(R.m.terreno, x - ox(R), y - oy(R)) : orbit.target.y).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; },
};

// ------------------------------------------------------------------ início
aplicarQualidade(qualidade);
await carregarModelosGlb(THREE, [fichaHunter, CFG.especies.varrisco], carga, perfis);
{ const p = perfis.hunter; if (p && !p.ajustadoHumano) { const eixo = p.frente.endsWith('X') ? 0 : 2; p.extensao[eixo] = fichaHunter.corpo.comprimentoM * p.extensao[1] / fichaHunter.corpo.alturaM; p.ajustadoHumano = true; } }
carga('Carregando HV_01 (vila)…');
await carregarPeca(pecas.find((p) => p.id === 'HV_01'));
const salvo = await lerSave();
const entrar = async (jogo, vel = 1) => {
  montar(jogo); await retratos(); desenharEsquadrao();
  for (const id of ['tela']) $(id).hidden = true; for (const id of ['topo', 'painel', 'registro', 'esquadrao']) $(id).hidden = false;
  velocidade(vel); if (!vel) aviso('Sessão restaurada e pausada: escolha a velocidade para continuar', 'bom'); requestAnimationFrame(laco);
};
// Saves de versões anteriores (grade fixa) não são compatíveis com regiões móveis: só nova demonstração.
const compativel = salvo?.versao === 'wildhaven-v023-1';
carga(salvo ? (compativel ? `Sessão salva em ${new Date(salvo.salvoEm).toLocaleString('pt-BR')} (tempo de jogo ${fmtT(salvo.t)}).` : 'Há uma sessão salva de uma versão anterior (grade fixa): não é compatível com as regiões móveis.') : 'Pronto.');
if (compativel) { $('continuarSave').hidden = false; $('continuarSave').onclick = async () => { carga('Montando as regiões salvas…'); entrar(await restaurar(salvo), 0); }; }
$('novaDemo').hidden = false; $('novaDemo').onclick = async () => { await apagarSave(); carga('Montando a região inicial…'); entrar(await novoJogo(Number(new URLSearchParams(location.search).get('semente')) || 1)); };
(compativel ? $('continuarSave') : $('novaDemo')).focus();
