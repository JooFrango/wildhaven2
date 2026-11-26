// Hunter Lab: rendering only, local v04 skeletal clips and view-only foot support.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { carregarModelos as carregarModelosGlb, clonarEsqueleto, gltfs, rigs } from '../../../ia-criaturas/src/web3d/modelos3d.js';
import {instalarVisualHunter} from '../visual-hunter.js?revision=epic1';
import { Animal3D } from '../../../ia-criaturas/src/web3d/animador.js';
import { Camadas, criarTerreno3D, TapeteDeSombra } from '../../../ia-criaturas/src/web3d/cena.js';
import { carregarConfigEco, garantirTerreno } from '../../../ia-criaturas/src/eco/config.js';
import { altura } from '../../../ia-criaturas/src/eco/terreno.js';
import { hashMundo } from '../../../ia-criaturas/src/eco/mundo.js';
import { verificarInvariantes } from '../../../ia-criaturas/src/eco/invariantes.js';
import { criarMundoHunters, passoHunters, estadoHunter, resultadoCombate, salvarMundoHunters, carregarMundoHunters, enfileirarComando } from '../mundo-hunters.js';
import { criarHunter, montarFicha, REGIOES_HUMANAS } from '../hunter.js';
import { decidirHunter } from '../cerebro-hunter.js';

import {amostrarArma,segmentoMundo,usarGuardaFechada,usarPve1,usarPve2} from '../trajetoria-arma.js';
import {criarApresentacao} from '../apresentacao-combate.js';
import {usarMonstro,modeloMonstro} from '../monstro-varrisco.js';
import {instalarVisualMonstro} from '../visual-monstro.js';

const $ = (id) => document.getElementById(id);
const aviso = (txt, erro = false) => { $('aviso').textContent = txt; $('aviso').className = erro ? 'erro' : ''; };
const LAB_IA = '../ia-criaturas/';
const lerJsonIa = async (rel) => { const r = await fetch(LAB_IA + rel, { cache: 'no-store' }); if (!r.ok) throw new Error(`Não foi possível ler ${rel} (HTTP ${r.status}).`); return r.json(); };
const lerJson = async (rel) => { const r = await fetch(rel, { cache: 'no-store' }); if (!r.ok) throw new Error(`Não foi possível ler ${rel} (HTTP ${r.status}).`); return r.json(); };

aviso('Carregando configurações…');
const cfgEco = await carregarConfigEco(lerJsonIa, { preCarregarTerrenos: false });
const perfis = (await lerJsonIa('config/eco/modelos.json')).perfis;
const fichaHunter = await lerJson('config/hunter.json');
// ?pvp12=1 troca o GLB pela biblioteca PvP v12 (os 83 clipes antigos continuam dentro, mas o PvP não os usa).
usarGuardaFechada(new URLSearchParams(location.search).has('pvp12'));
// ?pve1=1 usa a biblioteca PvE v01 (contrato hunter-pve-v01). Sem a flag nada muda.
usarPve1(new URLSearchParams(location.search).has('pve1'));   // IA PvE: tempo, lâmina e esquiva vêm de trajetorias-pve1.js
// ?pve1=1&pve2=1 usa o rig v13 e a biblioteca PvE v02 (contrato hunter-pve-v02): 12 clipes, combo de 3, carga e
// rolamentos. É o modo experimental: sem as duas flags, PvP, Alpha e PvE v01 seguem pelo caminho anterior.
const PVE2=new URLSearchParams(location.search).has('pve1')&&new URLSearchParams(location.search).has('pve2');
usarPve2(PVE2);
fichaHunter.modelo.glb=PVE2?'labs/hunters/assets/hunter-rig-v13/hunter_rig_v13_blockout.glb'
 :new URLSearchParams(location.search).has('pve1')?'labs/hunters/assets/hunter-pve-v01/hunter_pve_v01.glb'
 :new URLSearchParams(location.search).has('pvp12')
 ?'labs/hunters/assets/hunter-pvp-v12/hunter_pvp_v12.glb'
 :'labs/hunters/assets/hunter-v05/hunter_combat_v05.glb';
const equipamentos = await lerJson('config/equipamento.json');
const cenarios = await lerJson('config/cenarios.json');
const especiesLab=structuredClone(cfgEco.especies);if(!especiesLab.varrisco.dieta.presas.includes('hunter'))especiesLab.varrisco.dieta.presas.push('hunter');
// ?pve1=1&pve2=1&mh=1: Varrisco como monstro de caçada (monstro-varrisco.js) com o GLB v05. Sem mh nada muda.
const MH=PVE2&&new URLSearchParams(location.search).has('mh');
usarMonstro(MH);if(MH)especiesLab.varrisco.modelo=modeloMonstro(especiesLab.varrisco.modelo);
const CFG = { ...cfgEco, especies: { ...especiesLab, hunter: fichaHunter } };

// ---------------------------------------------------------------- cena
const palco = $('palco');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
palco.appendChild(renderer.domElement);
const cena = new THREE.Scene();
cena.background = new THREE.Color(0xc9d3d2);
cena.fog = new THREE.Fog(0xc9d3d2, 140, 460);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true; orbit.maxPolarAngle = Math.PI * 0.49;
cena.add(new THREE.HemisphereLight(0xe8efd8, 0x6b5232, 1.6));
const sol = new THREE.DirectionalLight(0xffe2b0, 2.3); sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048); cena.add(sol);
const camadas = new Camadas(THREE, cena);
const marcadores = new THREE.Group(); cena.add(marcadores);
function redimensionar() { const w = palco.clientWidth, h = palco.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', redimensionar); redimensionar();

const est = {
  mundo: null, vistas: new Map(), terreno3d: null, tapete: null, rodando: false, vel: 1, acum: 0,
  ultimo: performance.now(), sel: null, eventosVistos: 0, seguir: false, verMarcadores: false, iaLigada: true,
  fps: 60, msQuadro: 0, impactos: [], violacoes: [],
};

const apresentacao=criarApresentacao({THREE,scene:cena,camera,orbit,canvas:renderer.domElement,trajetoria:(a,t)=>{
 const action=a.hunter?.action;if(!action||t<action.start||t>action.end)return null;
 const sample=segmentoMundo(a,amostrarArma(action,t,{arma:a.hunter.equipamento.arma,altura:a.especie.corpo.alturaM*a.escala}));return{base:sample.grip,tip:sample.tip,active:sample.active};
}});
addEventListener('pagehide',()=>apresentacao.dispose(),{once:true});
$('sonsCombate').onchange=()=>{if($('sonsCombate').checked)apresentacao.unlockAudio();};
// ---------------------------------------------------------------- marcadores de depuração
// Não são animação. Cada um mostra um número do núcleo: alcance do golpe, instante do impacto, região atingida.
const MAT = {
  azul: new THREE.LineBasicMaterial({ color: 0x4e9bd6 }),
  verde: new THREE.LineBasicMaterial({ color: 0x63b86a }),
  golpe: new THREE.LineBasicMaterial({ color: 0xd9a441 }),
  pesado: new THREE.LineBasicMaterial({ color: 0xe8632d }),
  defesa: new THREE.LineBasicMaterial({ color: 0x8fd0ff }),
  fora: new THREE.LineBasicMaterial({ color: 0x8a8f94 }),
};
const CORES_EQUIPE = ['azul', 'verde'];
function anel(raio, mat, segmentos = 40) {
  const p = [];
  for (let i = 0; i <= segmentos; i++) { const a = (i / segmentos) * Math.PI * 2; p.push(new THREE.Vector3(Math.cos(a) * raio, 0, Math.sin(a) * raio)); }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), mat);
}
const esferaImpacto = new THREE.SphereGeometry(0.1, 8, 6);
const matImpacto = new THREE.MeshBasicMaterial({ color: 0xd2544c });

// ---------------------------------------------------------------- mundo
function cenarioAtual() { return cenarios.find((c) => c.id === $('cenario').value) ?? cenarios[0]; }

async function reiniciar() {
  est.rodando = false; $('rodar').textContent = 'Iniciar'; $('rodar').classList.remove('ativo');
  const cen = JSON.parse(JSON.stringify(cenarioAtual()));
  aviso('Montando o mundo…');
  if(cen.terreno?.recorteCodex){cen.terreno.dados=await lerJson('../hunters-codex/assets/terrain-nav.json');cen.geometriaPrecisa=await lerJson('../hunters-codex/assets/terrain-geometry.json');}
  else if (cen.terreno?.tipo === 'derivado') { aviso('Carregando o terreno real do hexágono (pode levar alguns segundos)…'); cen.terreno.dados = await lerJsonIa(cen.terreno.arquivo); }
  const semente = parseInt($('semente').value, 10) || 0;
  const cfg = { ...CFG, cenarios: { ...CFG.cenarios, [cen.id]: cen } };
  const m = criarMundoHunters(cfg, cen, semente, { fichaHunter, equipamentos });
  // GLBs: as espécies realmente presentes neste cenário, mais o Hunter.
  const presentes = [...new Set(m.animais.map((a) => a.especie.id))].map((id) => (id === 'hunter' ? fichaHunter : CFG.especies[id]));
  await carregarModelos(presentes);
  for (const [, v] of est.vistas) cena.remove(v.raiz);
  est.vistas.clear(); marcadores.clear(); est.impactos.length = 0;
  if (est.terreno3d) cena.remove(est.terreno3d);
  est.terreno3d = criarTerreno3D(THREE, m.terreno);
  if(cen.terreno.recorteCodex){const gltf=await new GLTFLoader().loadAsync('../hunters-codex/assets/hex52-crop.glb');est.terreno3d=gltf.scene;est.terreno3d.position.set(-50,0,-50);}
  cena.add(est.terreno3d);
  est.tapete = new TapeteDeSombra(THREE);
  est.mundo = m; est.eventosVistos = 0; est.violacoes = []; est.sel = m.hunters[0]?.id ?? null;
  for (const a of m.vivos) criarVista(a)?.passoSimulacao(a);
  const c = cen.camera ?? { x: m.terreno.largura / 2, y: m.terreno.profundidade / 2, distancia: 20 };
  olharPara(c.x, c.y, c.distancia);
  $('eventos').textContent = '';
  aviso(`${m.hunters.length} Hunters, ${m.vivos.length - m.hunters.length} criaturas. Terreno ${m.terreno.largura}×${m.terreno.profundidade} m.`);
  // Painel das animações: as opções são os clipes que estão de fato no GLB carregado.
  if(PVE2)$('clipePve2').innerHTML=Object.keys(est.vistas.get(est.sel)?.controladorTatico?.actions??{}).sort().map((c)=>`<option>${c}</option>`).join('');
  desenharFichas();
}

// Painel de teste: toca um clipe do rig v13 no Hunter selecionado, em laço e no relógio real, sem a IA.
function forcarClipe(nome){
  const c=est.vistas.get(est.sel)?.controladorTatico;
  if(!c)return;
  c.forcado=nome||null;c.forcadoT=0;
  aviso(nome?`Clipe forçado no Hunter selecionado: ${nome}. "Soltar" devolve a escolha à simulação.`:'Clipe liberado: a simulação volta a escolher.');
}

const carregarModelos = async (especies) => {
  await carregarModelosGlb(THREE, especies, aviso, perfis);
  // Animal3D escala pelo COMPRIMENTO ao longo do eixo da frente — regra pensada para quadrúpedes. Num humano a
  // medida que importa é a altura, então o perfil do Hunter é corrigido para que a escala final dê 1,75 m.
  const p = perfis.hunter;
  if (p && !p.ajustadoHumano) {
    const eixo = p.frente.endsWith('X') ? 0 : 2;
    p.extensao[eixo] = fichaHunter.corpo.comprimentoM * p.extensao[1] / fichaHunter.corpo.alturaM;
    p.ajustadoHumano = true;
  }
};

const reachFor=h=>equipamentos.armas[h.equipamento.arma]?.alcanceM??.75;
function criarVista(a) {
  const g = gltfs.get(a.especie.id);
  if (!g) return;
  const v = new Animal3D(THREE, clonarEsqueleto, g, perfis[a.especie.id], a.especie, a, rigs.get(a.especie.id));
  if(a.hunter)instalarVisualHunter(v,g,a,{tempo:()=>est.mundo.t,alturaEm,terreno:()=>est.mundo.terreno});
  if(a.monstro)instalarVisualMonstro(v,{tempo:()=>est.mundo.t}); // linha MH: só existe com ?mh=1
  if(a.hunter){
    const gear=new THREE.Group();v.pivo.add(gear);v.gear=gear;
    const base=v.quadro.bind(v);v.quadro=(...args)=>{
      base(...args);const actor=args[2],h=actor.hunter,key=JSON.stringify(h.equipamento);
      if(v.gearKey!==key){
        gear.traverse(x=>{x.geometry?.dispose();x.material?.dispose();});gear.clear();v.weaponMesh=null;v.shield=null;
        const eq=h.equipamento,reach=reachFor(h),length=Math.max(.28,reach-actor.especie.corpo.alturaM*.235);v.weaponLength=length;
        if(eq.arma!=='maos'){
          const weapon=new THREE.Group();gear.add(weapon);v.weaponMesh=weapon;
          const metal=new THREE.MeshStandardMaterial({color:0xa5b6b5,metalness:.65,roughness:.42});
          const shaft=new THREE.Mesh(new THREE.BoxGeometry(eq.arma==='lanca'?.035:eq.arma==='montante'?.14:.075,.035,length),eq.arma==='lanca'?new THREE.MeshStandardMaterial({color:0x795235,roughness:.85}):metal);shaft.position.z=length/2;weapon.add(shaft);
          if(eq.arma==='lanca'){const tip=new THREE.Mesh(new THREE.ConeGeometry(.065,.20,4),metal);tip.rotation.x=Math.PI/2;tip.position.z=length-.10;weapon.add(tip);}
          else{const cross=new THREE.Mesh(new THREE.BoxGeometry(.24,.045,.045),metal);cross.position.z=.08;weapon.add(cross);}
        }
        if(eq.escudo){v.shield=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.065,12),new THREE.MeshStandardMaterial({color:0x718886,roughness:.6}));v.shield.rotation.x=Math.PI/2;gear.add(v.shield);}
        v.gearKey=key;
      }
      v.modelo.updateMatrixWorld(true);const hand=v.modelo.getObjectByName('RightHand'),left=v.modelo.getObjectByName('LeftHand');
      if(v.weaponMesh)v.weaponMesh.visible=!v.controladorTatico?.pve1;   // PvE v01: a espada desenhada é a do GLB
      if(v.weaponMesh&&hand){
        let grip=v.pivo.worldToLocal(hand.getWorldPosition(new THREE.Vector3())),direction=new THREE.Vector3(0,0,1);
        const attack=h.action,guard=h.guarda,t=est.mundo.t;
        const action=attack&&t>=attack.start&&t<attack.end?attack:guard&&t>=guard.start&&t<guard.end?guard:null;
        if(action){
          const sample=amostrarArma(action,t,{arma:h.equipamento.arma,altura:actor.especie.corpo.alturaM*actor.escala});
          grip=new THREE.Vector3(...sample.grip);direction=new THREE.Vector3(...sample.tip).sub(grip).normalize();
          // O braço é levado até o punho por `alinharMao` em visual-hunter.js, no mesmo quadro.
        }
        // Fora de um golpe, a lâmina apontava sempre para a frente a partir da mão. Com a guarda fechada
        // da v12 isso a deixava deitada, fora da pose: quando o GLB traz um socket de arma, a direção em
        // repouso sai dele, que é a pose autorada.
        if(!action){
          let socket=null;v.modelo.traverse(x=>{if(!socket&&/^WeaponSocket_Right_/.test(x.name??''))socket=x;});
          if(socket){
            grip=v.pivo.worldToLocal(socket.getWorldPosition(new THREE.Vector3()));
            direction=new THREE.Vector3(0,0,1).applyQuaternion(socket.getWorldQuaternion(new THREE.Quaternion()))
              .applyQuaternion(v.pivo.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
          }
        }
        v.weaponMesh.position.copy(grip);v.weaponMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
      }
      if(v.shield&&left)v.shield.position.copy(v.pivo.worldToLocal(left.getWorldPosition(new THREE.Vector3())));
    };
  }
  cena.add(v.raiz);
  est.vistas.set(a.id, v);
  if (a.hunter) {
    const cor = CORES_EQUIPE[[...new Set(est.mundo.hunters.map((h) => h.hunter.equipe))].indexOf(a.hunter.equipe) % 2] ?? 'fora';
    const m = { base: anel(0.45, MAT[cor]), alcance: anel(1, MAT.fora), golpe: new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), MAT.golpe) };
    m.alcance.visible = false; m.golpe.visible = false;
    marcadores.add(m.base, m.alcance, m.golpe);
    v.marcas = m;
  }
  return v;
}

const alturaEm = (x, y) => altura(est.mundo.terreno, x, y);
// `azimute` in radians around the target; the default reproduces the original three-quarter framing exactly.
function olharPara(x, y, dist, azimute = 2.3561944901923448) {
  const t = est.mundo.terreno, W = t.largura / 2, D = t.profundidade / 2;
  const h = alturaEm(x, y), r = dist * 0.98994949366116654;
  orbit.target.set(x - W, h + 1, y - D);
  camera.position.set(x - W + Math.cos(azimute) * r, h + dist * 0.75, y - D + Math.sin(azimute) * r);
  orbit.update();
}

// ---------------------------------------------------------------- laço
let alfa = 1;
function laco(agora) {
  requestAnimationFrame(laco);
  const dtReal = Math.min(0.1, (agora - est.ultimo) / 1000);
  est.ultimo = agora;
  est.fps = est.fps * 0.9 + (1 / Math.max(1e-3, dtReal)) * 0.1;
  const m = est.mundo;
  if (!m) return;
  const t0 = performance.now();
  if (est.rodando && !m.resultado) {
    est.acum += dtReal * est.vel;
    let n = 0;
    while (est.acum >= m.dt && n < 40) { passoHunters(m); est.acum -= m.dt; n++; sincronizarVistas(); }
    if (n) { const v = verificarInvariantes(m); if (v.length) est.violacoes = v; }
  }
  alfa = Math.min(1, est.acum / m.dt);
  for (const a of m.vivos) {
    const v = est.vistas.get(a.id);
    if (v) v.quadro(alfa, dtReal, a, m.terreno, alturaEm, null);
  }
  atualizarMarcadores(dtReal);
  camadas.desenhar(m, alturaEm, m.porId.get(est.sel) ?? null, {});
  if (est.seguir && est.sel) { const a = m.porId.get(est.sel); if (a) { const t = m.terreno; const next=new THREE.Vector3(a.x-t.largura/2,a.z+1,a.y-t.profundidade/2),delta=next.sub(orbit.target).multiplyScalar(.15);orbit.target.add(delta);camera.position.add(delta); } }
  orbit.update();
  const s = sol.position, t = m.terreno;
  sol.position.set(orbit.target.x + 60, 90, orbit.target.z + 40); sol.target.position.copy(orbit.target); sol.target.updateMatrixWorld();
  apresentacao.update(m,dtReal,{cinematica:$('cinematicaCombate').checked,sons:$('sonsCombate').checked,efeitos:$('efeitosCombate').checked,selected:est.sel});
  renderer.render(cena, camera);
  est.msQuadro = est.msQuadro * 0.9 + (performance.now() - t0) * 0.1;
  atualizarPainel();
}

// Depois de CADA passo do núcleo: `passoSimulacao` move o alvo da interpolação (posição anterior → atual).
// Sem ela o corpo fica parado no lugar onde nasceu enquanto o agente anda — os marcadores, que leem a posição
// real, ficavam metros longe do modelo.
function sincronizarVistas() {
  const m = est.mundo;
  for (const a of m.vivos) (est.vistas.get(a.id) ?? criarVista(a))?.passoSimulacao(a);
  for (const [id, v] of est.vistas) if (!m.porId.has(id)) { cena.remove(v.raiz); if (v.marcas) for (const k of Object.values(v.marcas)) marcadores.remove(k); est.vistas.delete(id); }
}

function atualizarMarcadores(dtReal) {
  const m = est.mundo, t = m.terreno, W = t.largura / 2, D = t.profundidade / 2;
  marcadores.visible = est.verMarcadores;
  if (!est.verMarcadores) return;
  for (const a of m.hunters) {
    const v = est.vistas.get(a.id);
    if (!v?.marcas) continue;
    const z = alturaEm(a.x, a.y) + 0.05;
    v.marcas.base.position.set(a.x - W, z, a.y - D);
    v.marcas.base.material = a.hunter.situacao === 'lutando' ? v.marcas.base.material : v.marcas.base.material;
    // Círculo de alcance da arma: aparece no selecionado, porque é a medida que explica acerto e erro.
    const sel = a.id === est.sel;
    v.marcas.alcance.visible = sel;
    if (sel) {
      const alc = Math.max(...a.especie.combate.ataques.map((x) => x.alcance));
      v.marcas.alcance.position.set(a.x - W, z, a.y - D);
      v.marcas.alcance.scale.set(alc, 1, alc);
    }
    // Golpe em preparo: a haste mostra ONDE o membro vai chegar e quando. Some no instante do impacto.
    const g = a.golpe;
    v.marcas.golpe.visible = !!g;
    if (g) {
      const alc = g.ataque.alcance;
      const p = v.marcas.golpe.geometry.attributes.position;
      const h = z + (a.especie.anatomia.ataques[g.nome]?.alturaImpacto ?? 1.3);
      p.setXYZ(0, a.x - W, h, a.y - D);
      p.setXYZ(1, a.x - W + Math.cos(a.direcao) * alc, h, a.y - D + Math.sin(a.direcao) * alc);
      p.needsUpdate = true;
      v.marcas.golpe.geometry.computeBoundingSphere();
      v.marcas.golpe.material = g.ataque.peso === 'pesado' ? MAT.pesado : MAT.golpe;
    }
    // Postura de defesa: o anel da base engrossa trocando de cor (sem clipe de bloqueio no GLB).
    v.marcas.base.visible = true;
    v.marcas.base.material = a.hunter.postura === 'defesa' ? MAT.defesa : (a.hunter.situacao === 'rendido' || a.hunter.situacao === 'incapacitado' || !a.vivo) ? MAT.fora : MAT[CORES_EQUIPE[[...new Set(m.hunters.map((h) => h.hunter.equipe))].indexOf(a.hunter.equipe) % 2]] ?? MAT.fora;
  }
  // Pontos de impacto: um por ferimento, apagando em 1,2 s.
  for (let i = est.impactos.length - 1; i >= 0; i--) {
    const p = est.impactos[i];
    p.vida -= dtReal;
    if (p.vida <= 0) { marcadores.remove(p.malha); p.malha.geometry === esferaImpacto || p.malha.geometry.dispose(); est.impactos.splice(i, 1); continue; }
    p.malha.scale.setScalar(0.5 + (1.2 - p.vida) * 2);
    p.malha.material.opacity = Math.max(0, p.vida / 1.2);
  }
}

const ALTURA_REGIAO = { cabeca: 1.62, pescoco: 1.45, torax: 1.2, bracos: 1.15, abdomen: 0.95, pernas: 0.5 };
function marcarImpacto(id, regiao) {
  const a = est.mundo.porId.get(id) ?? est.mundo.mortos.get(id);
  if (!a) return;
  const t = est.mundo.terreno;
  const malha = new THREE.Mesh(esferaImpacto, matImpacto.clone());
  malha.material.transparent = true;
  malha.position.set(a.x - t.largura / 2, alturaEm(a.x, a.y) + (ALTURA_REGIAO[regiao] ?? 1.2), a.y - t.profundidade / 2);
  marcadores.add(malha);
  est.impactos.push({ malha, vida: 1.2 });
}

// ---------------------------------------------------------------- painéis
function barra(v, max, cor) { return `<div class="barra"><i style="width:${Math.max(0, Math.min(100, (v / max) * 100)).toFixed(0)}%;background:${cor}"></i></div>`; }

function desenharFichas() {
  const m = est.mundo;
  if(est.controlsWorld!==m||est.controlsId!==est.sel){const a=m.porId.get(est.sel),h=a?.hunter;if(h){$('habilidadeJogador').value=h.habilidade??.65;for(const [key,id] of [['agressividade','agressividadeTatica'],['cautela','cautelaTatica'],['disciplina','disciplinaTatica']])$(id).value=h.personalidade[key];for(const k of ['forca','velocidade','resistencia','sentidos'])$(k+'Tatica').value=a.atributos[k];$('arma').value=h.equipamento.arma;$('armadura').value=h.equipamento.armadura??'';$('escudo').value=h.equipamento.escudo??'';}est.controlsWorld=m;est.controlsId=est.sel;}
  $('fichas').innerHTML = m.hunters.map((a) => {
    const e = estadoHunter(a);
    const fer = e.ferimentos.length ? e.ferimentos.map((f) => `${f.regiao}${f.fratura ? ' (fratura)' : ''}`).join(', ') : 'nenhum';
    return `<div class="ficha ${a.id === est.sel ? 'sel' : ''}" data-id="${a.id}">
      <div class="topo"><span class="nome">${e.nome}</span><span class="tag ${e.situacao}">${e.situacao}</span></div>
      <div class="eq">${e.equipe} · ${e.equipamento.arma}${e.equipamento.escudo ? ' + escudo' : ''}${e.equipamento.armadura ? ' · armadura ' + e.equipamento.armadura : ''} · ${e.controle}</div>
      ${barra(e.hp, e.hpMax, 'var(--perigo)')}${barra(e.energia, 100, 'var(--alerta)')}
      <div class="eq">vida ${e.hp.toFixed(0)}/${e.hpMax.toFixed(0)} · energia ${e.energia.toFixed(0)} · dor ${e.dor.toFixed(2)} · postura ${e.postura}</div>
      <div class="eq">ferimentos: ${fer}</div>
      <div class="eq">${e.estado} — ${e.motivo}</div><div class="eq">Alvo anatômico: ${e.combateJogador.parte??'—'} · sequência ${e.combateJogador.sequencia}</div>
    </div>`;
  }).join('');
  for (const el of $('fichas').children) el.onclick = () => { est.sel = el.dataset.id; desenharFichas(); };
  const equipes = [...new Set(m.hunters.map((h) => h.hunter.equipe))];
  $('equipe').innerHTML = equipes.concat(equipes.includes('azul') ? [] : ['azul']).map((e) => `<option>${e}</option>`).join('');
}

let ultimoPainel = 0;
function atualizarPainel() {
  const m = est.mundo, agora = performance.now();
  if (agora - ultimoPainel < 180) return;
  ultimoPainel = agora;
  desenharFichas();
  const contatos = m.hunters.reduce((s, a) => s + a.contatos.length, 0);
  const ev = m.metricas.eventos;
  $('hud').textContent = `t ${m.t.toFixed(1)} s   ${est.fps.toFixed(0)} fps   quadro ${est.msQuadro.toFixed(1)} ms\n`
    + `${m.vivos.length} vivos (${m.hunters.length} Hunters)   hash ${hashMundo(m)}`
    + (m.resultado ? `\nFIM: ${m.resultado.vencedor ?? 'sem vencedor'} — ${m.resultado.motivo}` : '');
  $('diag').innerHTML = [
    ['tempo', `${m.t.toFixed(1)} s (passo ${m.dt} s)`],
    ['entidades', `${m.vivos.length} vivas, ${m.mortos.size} mortas`],
    ['contatos percebidos', contatos],
    ['ataques iniciados', ev.ataque_inicio ?? 0],
    ['golpes que erraram', ev.golpe_errou ?? 0],
    ['ferimentos', ev.ferimento ?? 0],
    ['esquivas', ev.esquiva ?? 0],
    ['desequilíbrio / queda', `${ev.desequilibrio ?? 0} / ${ev.queda ?? 0}`],
    ['colisões resolvidas', m.metricas.sobreposicoes?.toFixed?.(0) ?? '—'],
    ['reagiu sem perceber', m.metricas.falhas.length],
    ['invariantes', est.violacoes.length ? `${est.violacoes.length} violações` : 'sem violação'],
    ['semente', m.semente],
  ].map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  // Histórico reproduzível: os eventos do núcleo, na ordem em que aconteceram.
  const novos = m.eventos.slice(est.eventosVistos);
  est.eventosVistos = m.eventos.length;
  const INTERESSA = new Set(['ataque_inicio', 'ferimento', 'golpe_errou', 'esquiva', 'queda', 'desequilibrio', 'hunter_rendicao', 'hunter_incapacitado', 'hunter_poupado_treino', 'combate_fim', 'morte']);
  for (const e of novos) {
    if (!INTERESSA.has(e.tipo)) continue;
    if (e.tipo === 'ferimento') marcarImpacto(e.id, e.regiao);
    const d = document.createElement('div');
    d.textContent = `${e.t.toFixed(1)}s ${e.id} ${e.tipo}` + (e.regiao ? ` ${e.regiao} ${e.dano}` : '') + (e.ataque ? ` (${e.ataque})` : '') + (e.motivo ? ` ${e.motivo}` : '');
    $('eventos').append(d);
  }
  while ($('eventos').childElementCount > 160) $('eventos').firstChild.remove();
  $('eventos').scrollTop = $('eventos').scrollHeight;
}

$('limites').textContent = 'Clipes esqueléticos atuais; trajetória física da arma, reações proporcionais e recuperação de fôlego; leitura de sinais, aberturas e sequências por arma. Habilidade e personalidade independentes. IK de pés apenas visual no rig original; estados e impactos seguem o simulador. Nenhum dano e aplicado pela animacao.';

// ---------------------------------------------------------------- controles
for (const c of cenarios) { const o = document.createElement('option'); o.value = c.id; o.textContent = c.nome; $('cenario').append(o); }
$('arma').innerHTML = Object.entries(equipamentos.armas).map(([k, v]) => `<option value="${k}">${v.nome}</option>`).join('');
$('armadura').innerHTML = '<option value="">nenhuma</option>' + Object.entries(equipamentos.armaduras).map(([k, v]) => `<option value="${k}">${v.nome}</option>`).join('');

const q = new URLSearchParams(location.search);
if (q.get('cenario') && cenarios.some((c) => c.id === q.get('cenario'))) $('cenario').value = q.get('cenario');
if(!q.has('cenario'))$('cenario').value='jogador-lanca';
if (q.get('semente')) $('semente').value = parseInt(q.get('semente'), 10) || 0;

$('cenario').onchange = reiniciar;
$('reiniciar').onclick = reiniciar;
$('rodar').onclick = () => { est.rodando = !est.rodando; $('rodar').textContent = est.rodando ? 'Pausar' : 'Iniciar'; $('rodar').classList.toggle('ativo', est.rodando); };
$('passo').onclick = () => { passoHunters(est.mundo); sincronizarVistas(); };
$('vel').oninput = () => { est.vel = Number($('vel').value); $('velTxt').textContent = est.vel.toFixed(2).replace('.', ',') + '×'; };
$('marcadores').classList.remove('ativo');
$('cinematicaCombate').onchange=()=>{if($('cinematicaCombate').checked){est.seguir=false;$('camera').classList.remove('ativo');}};
$('camera').onclick = () => { $('cinematicaCombate').checked=false; est.seguir = !est.seguir; $('camera').textContent = est.seguir ? 'Seguir Hunter' : 'Câmera livre'; $('camera').classList.toggle('ativo', est.seguir); };
$('marcadores').onclick = () => { est.verMarcadores = !est.verMarcadores; $('marcadores').classList.toggle('ativo', est.verMarcadores); };
// Desligar a IA deixa o Hunter parado e reagindo só ao físico: serve para medir o custo da decisão e para
// comparar um corpo inerte com um Hunter que decide.
$('ia').onclick = () => {
  est.iaLigada = !est.iaLigada;
  $('ia').textContent = est.iaLigada ? 'IA ligada' : 'IA desligada';
  $('ia').classList.toggle('ativo', est.iaLigada);
  for (const a of est.mundo.hunters) a.comandoTeste = est.iaLigada ? decidirHunter : () => ({ estado: 'parado', codigo: 'ia_desligada', motivo: 'IA desligada na interface', ritmo: 'parado' });
};
$('manual').onclick = () => {
  const a = est.mundo.porId.get(est.sel);
  if (!a?.hunter) return;
  a.hunter.controle = a.hunter.controle === 'manual' ? 'ia' : 'manual';
  a.hunter.comando = {};
  $('manual').classList.toggle('ativo', a.hunter.controle === 'manual');
  desenharFichas();
};
$('adicionar').onclick = () => {
  const m = est.mundo;
  const equip = { arma: $('arma').value, armadura: $('armadura').value || null, escudo: $('escudo').value || null };
  const ficha = montarFicha(fichaHunter, equipamentos, equip);
  const base = m.hunters[0] ?? { x: m.terreno.largura / 2, y: m.terreno.profundidade / 2 };
  const a = criarHunter(m, ficha, {
    id: `hunter-${m.hunters.length + 1}-${m.tick}`, nome: `Hunter ${m.hunters.length + 1}`,
    equipe: $('equipe').value, modo: m.modoCombate,
    x: base.x + (m.hunters.length % 2 ? 6 : -6), y: base.y + 4,
    personalidade: { agressividade: Number($('agressividade').value), cautela: Number($('cautela').value) },
  });
  a.hunter.habilidade=Number($('habilidadeJogador').value);a.comandoTeste = est.iaLigada ? decidirHunter : null;
  m.resultado = null;
  carregarModelos([fichaHunter]).then(() => { criarVista(a); desenharFichas(); });
};
$('remover').onclick = () => {
  const m = est.mundo, a = m.porId.get(est.sel);
  if (!a?.hunter) return;
  // Remoção é de bancada: o Hunter sai do mundo sem virar carcaça nem contar como morte.
  m.vivos = m.vivos.filter((x) => x !== a); m.animais = m.animais.filter((x) => x !== a);
  m.porId.delete(a.id); m.hunters = m.hunters.filter((x) => x !== a);
  const v = est.vistas.get(a.id);
  if (v) { cena.remove(v.raiz); if (v.marcas) for (const k of Object.values(v.marcas)) marcadores.remove(k); est.vistas.delete(a.id); }
  est.sel = m.hunters[0]?.id ?? null;
  m.resultado = null;
  desenharFichas();
};

const TECLAS = { KeyW: 'frente', KeyS: 'tras', KeyA: 'esquerda', KeyD: 'direita', ShiftLeft: 'correr', KeyJ: 'atacar', KeyK: 'defender',KeyH:'pesado',Space:'esquivar' };
for (const [evento, valor] of [['keydown', true], ['keyup', false]]) {
  addEventListener(evento, (e) => {
    if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement)return;
    const campo = TECLAS[e.code];
    if (!campo) return;
    const a = est.mundo?.porId.get(est.sel);
    if (!a?.hunter || a.hunter.controle !== 'manual') return;
    if(!e.repeat)enfileirarComando(est.mundo,'input',a.id,{[campo]:valor});
    e.preventDefault();
  });
}

// ---------------------------------------------------------------- API para os testes de navegador
window.hunterLab = {
  apresentacao:()=>apresentacao.stats(),
  audioCaptura:()=>{if(!apresentacao.audio)return null;const dest=apresentacao.audio.createMediaStreamDestination();apresentacao.master.connect(dest);return dest.stream;},
  get mundo() { return est.mundo; },
  estado: () => est.mundo.hunters.map(estadoHunter),
  resultado: () => resultadoCombate(est.mundo),
  hash: () => hashMundo(est.mundo),
  modelosCarregados: () => [...gltfs.keys()],
  medirEmpunhadura(id){const a=est.mundo.porId.get(id),v=est.vistas.get(id),hand=v?.modelo.getObjectByName('RightHand');if(!hand||!v.weaponMesh)return null;const ref=hand.children.find(x=>/^WeaponSocket_Right_/.test(x.name??''))??hand;return{erroM:ref.getWorldPosition(new THREE.Vector3()).distanceTo(v.weaponMesh.getWorldPosition(new THREE.Vector3())),referencia:ref===hand?'pulso':'socket',clip:v.controladorTatico.clip};},
  medirPose(id) {
    const v=est.vistas.get(id);if(!v)return null;v.modelo.updateMatrixWorld(true);
    const pos=name=>{const b=v.modelo.getObjectByName(name);return b?v.modelo.worldToLocal(b.getWorldPosition(new THREE.Vector3())).toArray():null;};
    const arms=['Left','Right'].map(side=>({side,shoulder:pos(side+'Arm'),hand:pos(side+'Hand')}));
    const tPose=arms.every(({shoulder:p,hand:q})=>p&&q&&Math.abs(p[1]-q[1])<.10&&Math.abs(p[0]-q[0])>.40&&Math.abs(p[2]-q[2])<.10);
    return {clip:v.controladorTatico?.clip,tPose,arms,result:v.controladorTatico?.lastResult??null};
  },
  invariantes: () => verificarInvariantes(est.mundo),
  regioes: () => REGIOES_HUMANAS,
  comando:(tipo,id,dados,tick)=>enfileirarComando(est.mundo,tipo,id,dados,tick),
  salvar:()=>salvarMundoHunters(est.mundo),
  clipes:()=>[...est.vistas].map(([id,v])=>({id,clip:v.controladorTatico?.clip??(v.monstroVisual?v.nomeAtual:undefined),pes:!!v.controladorTatico?.footLocks,pegada:v.controladorTatico?.pegada??null})),
  // Painel de teste, para o teste de navegador: força e solta um clipe no Hunter selecionado.
  forcarClipe:(nome)=>forcarClipe(nome),
  clipesDisponiveis:()=>Object.keys(est.vistas.get(est.sel)?.controladorTatico?.actions??{}).sort(),
  // Avança a simulação sem depender do relógio real: o teste de navegador precisa ser reprodutível.
  // Sincroniza a cada passo, não só no fim: a interpolação guarda a posição anterior e a atual, e um único
  // `passoSimulacao` depois de centenas de passos deixaria o corpo desenhado no ponto de partida.
  avancar(segundos) { const m = est.mundo, fim = m.t + segundos; while (m.t < fim - 1e-9 && !m.resultado) { passoHunters(m); sincronizarVistas(); } est.acum = m.dt; return resultadoCombate(m); },
  medirQuadro: () => ({ fps: +est.fps.toFixed(1), msQuadro: +est.msQuadro.toFixed(2), desenhos: renderer.info.render.calls, triangulos: renderer.info.render.triangles }),
  enquadrar: (x, y, d, azimute) => olharPara(x, y, d, azimute),
  // Altura do corpo DESENHADO, para conferir contra a ficha: um humano de 1,75 m não pode entrar na cena com
  // 2,3 m só porque o escalonamento foi pensado para quadrúpedes.
  medirCorpo(id) {
    const v = est.vistas.get(id);
    if (!v) return null;
    const c = new THREE.Box3().setFromObject(v.modelo), t = new THREE.Vector3();
    c.getSize(t);
    return { alturaM: +t.y.toFixed(3), larguraM: +t.x.toFixed(3), profundidadeM: +t.z.toFixed(3) };
  },
};

$('exportarTatico').onclick=()=>{const blob=new Blob([JSON.stringify(salvarMundoHunters(est.mundo))],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='wildhaven-hunter-save.json';a.click();URL.revokeObjectURL(url);};
$('importarTatico').onchange=async e=>{try{const salvo=JSON.parse(await e.target.files[0].text()),m=carregarMundoHunters({...CFG,cenarios:Object.fromEntries(cenarios.map(c=>[c.id,c]))},salvo,{fichaHunter,equipamentos});est.rodando=false;for(const v of est.vistas.values())cena.remove(v.raiz);est.vistas.clear();marcadores.clear();if(est.terreno3d)cena.remove(est.terreno3d);est.terreno3d=criarTerreno3D(THREE,m.terreno);cena.add(est.terreno3d);est.mundo=m;est.sel=m.hunters[0]?.id;est.acum=m.dt;await carregarModelos([...new Set(m.animais.map(a=>a.especie.id))].map(id=>CFG.especies[id]));for(const a of m.animais)criarVista(a)?.passoSimulacao(a);desenharFichas();aviso('Estado e comandos restaurados.');}catch(err){aviso(err.message,true);}};
$('aplicarTatico').onclick=()=>{const m=est.mundo,id=est.sel;if(!id)return;enfileirarComando(m,'equipamento',id,{arma:$('arma').value,escudo:$('escudo').value||null,armadura:$('armadura').value||null});enfileirarComando(m,'habilidade',id,{valor:Number($('habilidadeJogador').value)});enfileirarComando(m,'personalidade',id,{agressividade:Number($('agressividadeTatica').value),cautela:Number($('cautelaTatica').value),disciplina:Number($('disciplinaTatica').value)});enfileirarComando(m,'atributos',id,{forca:Number($('forcaTatica').value),velocidade:Number($('velocidadeTatica').value),resistencia:Number($('resistenciaTatica').value),sentidos:Number($('sentidosTatica').value)});aviso('Alterações agendadas para o próximo passo.');};
if(PVE2){
  for(const id of ['tituloPve2','painelPve2','notaPve2'])$(id).hidden=false;
  $('tocarPve2').onclick=()=>forcarClipe($('clipePve2').value);
  $('soltarPve2').onclick=()=>forcarClipe(null);
}
$('rendirTatico').onclick=()=>enfileirarComando(est.mundo,'rendir',est.sel);
$('estabilizarTatico').onclick=()=>enfileirarComando(est.mundo,'estabilizar',est.sel);
await reiniciar();
requestAnimationFrame(laco);
