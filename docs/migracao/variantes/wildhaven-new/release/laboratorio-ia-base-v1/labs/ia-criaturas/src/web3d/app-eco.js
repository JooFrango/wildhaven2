// Demo 3D do ecossistema V2. Mesma IA do CLI (src/eco); a página só desenha e anima.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { carregarModelos as carregarModelosGlb, clonarEsqueleto, gltfs, rigs } from './modelos3d.js';
import { HexesReais } from './hexes3d.js';
import { carregarConfigEco, garantirTerreno } from '../eco/config.js';
import { criarExperimento, criarFichaExperimental } from '../eco/oficina.js';
import { diagnosticarAnimacoes } from '../eco/diagnostico-animacoes.js';
import { criarOficina } from './oficina-ui.js';
import { criarMundoEco, passoEco, hashMundo, retrato } from '../eco/mundo.js';
import { altura } from '../eco/terreno.js';
import { fatorMobilidade } from '../eco/saude.js';
import { Animal3D } from './animador.js';
import { Camadas, criarTerreno3D, TapeteDeSombra } from './cena.js';
import { EfeitosDeAreia, InspecaoSubsolo, reagirAreia } from './areia3d.js';
import { espessuraAreia, volumeAreia } from '../eco/areia.js';
import { CenaV7, fichaV7, instalarControlesV7, painelMundoV7 } from './v7-3d.js';

const $ = (id) => document.getElementById(id);
const aviso = (txt, erro = false) => { $('aviso').textContent = txt; $('aviso').className = erro ? 'erro' : ''; };

const lerJson = async (rel) => { const r = await fetch(rel, { cache: 'no-store' }); if (!r.ok) throw new Error(`Não foi possível ler ${rel} (HTTP ${r.status}).`); return r.json(); };
// Terrenos derivados só são buscados quando o cenário é escolhido: abrir a Savana Viva não paga os
// megabytes do corredor de hexágonos.
const cfg = await carregarConfigEco(lerJson, { preCarregarTerrenos: false });
const perfis = (await lerJson('config/eco/modelos.json')).perfis;

// ---------- Three.js ----------
const palco = $('palco');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
palco.appendChild(renderer.domElement);
const cena = new THREE.Scene();
// Céu e névoa: além do recorte de terreno a cena não fica preta.
cena.background = new THREE.Color(0xcfd8d6);
cena.fog = new THREE.Fog(0xcfd8d6, 160, 520);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true; orbit.maxPolarAngle = Math.PI * 0.48;
const hemi = new THREE.HemisphereLight(0xe8efd8, 0x6b5232, 1.6); cena.add(hemi);
const sol = new THREE.DirectionalLight(0xffe2b0, 2.4); sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048);
cena.add(sol);
const camadas = new Camadas(THREE, cena);
function redimensionar() { const w = palco.clientWidth, h = palco.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', redimensionar); redimensionar();

// ---------- Modelos (GLBs reais, carregados uma vez por espécie; rig das pernas analisado ao carregar) ----------
const carregarModelos = (especies) => carregarModelosGlb(THREE, especies, aviso, perfis);

// ---------- Estado ----------
const est = { mundo: null, animais: new Map(), terreno3d: null, rodando: false, vel: 1, acum: 0, ultimo: performance.now(), sel: null, eventosVistos: 0 };
// Efeitos de areia e marcadores de diagnóstico: criados uma vez e reciclados (nada alocado por quadro).
const efeitosAreia = new EfeitosDeAreia(THREE);
const cenaV7 = new CenaV7(THREE, cena, carregarModelosGlb, gltfs);
cena.add(efeitosAreia.malha);
const inspecao = new InspecaoSubsolo(THREE);
cena.add(inspecao.grupo);
const oficina = criarOficina({ config: cfg, onApply: () => reiniciar(), onAudit: auditarGlbCatalogo });
async function auditarGlbCatalogo(modelo, entrada) {
  // Auditoria de asset em memória; proxy aqui serve apenas para aceitar os dados no adaptador,
  // NÃO executa nenhuma IA nem finge movimento subterrâneo.
  const ficha = criarFichaExperimental(modelo,
    { ...entrada, permitirProxySuperficie: true },
    cfg.especies.velsari, cfg.especies.varrisco);
  if (perfis[ficha.id]) perfis[ficha.id].frente = ficha.modelo.frente;
  await carregarModelos([ficha]);
  const glb = gltfs.get(ficha.id);
  if (!glb) throw new Error('GLB não carregado.');
  const caixa = new THREE.Box3().setFromObject(glb.scene);
  const tamanho = new THREE.Vector3(); caixa.getSize(tamanho);
  let malhas = 0, skinned = 0, ossos = 0;
  glb.scene.traverse((n) => {
    if (n.isMesh) malhas++;
    if (n.isSkinnedMesh) { skinned++; ossos = Math.max(ossos, n.skeleton?.bones.length ?? 0); }
  });
  return {
    glb: modelo.glb,
    nome: ficha.nome,
    geometria: { malhas, malhasComSkin: skinned, ossos, dimensoesModeloM: tamanho.toArray().map((x) => +x.toFixed(3)) },
    ...diagnosticarAnimacoes({
      clipes: glb.animations, mapa: ficha.modelo.clipes, modo: ficha.capacidades.modo,
      perfil: perfis[ficha.id], velocidade: ficha.movimento.corrida,
      escala: ficha.corpo.comprimentoM / Math.max(0.001, tamanho[ficha.modelo.frente.endsWith('X') ? 'x' : 'z'])
    }),
    nota: 'Apenas estrutura/compatibilidade. Não comprova colisão, cinemática, IK, voo ou natação subterrânea.'
  };
}
for (const id of cfg.ordemCenarios) { const o = document.createElement('option'); o.value = id; o.textContent = cfg.cenarios[id].nome; $('cenario').append(o); }
const q = new URLSearchParams(location.search);
if (q.get('cenario') && cfg.cenarios[q.get('cenario')]) $('cenario').value = q.get('cenario');
if (q.get('semente')) $('semente').value = parseInt(q.get('semente'), 10) || 0;
if (q.get('velocidade')) $('velocidade').value = q.get('velocidade');
est.vel = Number($('velocidade').value);
est.ik = q.get('ik') !== '0';

async function reiniciar() {
  est.rodando = false; $('tocar').textContent = 'Iniciar';
  const original = cfg.cenarios[$('cenario').value];
  if (original.terreno?.tipo === 'derivado' && !original.terreno.dados) {
    aviso('Carregando terreno derivado…');
    await garantirTerreno(original, lerJson);
  }
  // Original intacto. Sobrepõe fichas e populações apenas neste reinício do experimento.
  const experimento = oficina.getSelecao().length
    ? criarExperimento(cfg, original, oficina.getSelecao(), oficina.getCatalogo())
    : { config: cfg, cenario: original };
  const cen = experimento.cenario;
  const especies = [...new Set(cen.populacoes.map((p) => p.especie))].map((id) => experimento.config.especies[id]);
  for (const e of especies) if (e.balanceamento?.origem === 'oficina-laboratorio' && perfis[e.id]) perfis[e.id].frente = e.modelo.frente;
  try { await carregarModelos(especies); } catch (e) { aviso(e.message, true); throw e; }
  for (const a of est.animais.values()) cena.remove(a.raiz);
  est.animais.clear();
  if (est.terreno3d) { cena.remove(est.terreno3d); est.terreno3d = null; }
  if (est.hexes) { est.hexes.descartar(); cena.remove(est.hexes.grupo); est.hexes = null; }
  if (est.tapete) { cena.remove(est.tapete.malha); est.tapete.descartar(); est.tapete = null; }
  est.mundo = criarMundoEco(experimento.config, cen, parseInt($('semente').value, 10) || 0, { guardarDecisoes: true });
  const t = est.mundo.terreno;
  // Corredor de hexágonos reais: o chão é a malha dos GLBs oficiais (a grade da IA saiu deles).
  // Qualquer outro cenário desenha o relevo a partir da própria grade.
  if (t.origem?.hexes?.length) {
    est.hexes = new HexesReais(THREE, t.origem, t, { aviso });
    cena.add(est.hexes.grupo);
    est.tapete = new TapeteDeSombra(THREE);
    cena.add(est.tapete.malha);
  } else {
    est.terreno3d = criarTerreno3D(THREE, t); cena.add(est.terreno3d);
  }
  const W = t.largura, D = t.profundidade;
  // Névoa: num recorte de 240 m ela fecha o horizonte; num corredor de peças inteiras precisa alcançar o outro hexágono,
  // senão o relevo do lado de lá some atrás de uma parede branca.
  cena.fog.near = est.hexes ? 500 : 160; cena.fog.far = est.hexes ? 2600 : 520;
  camera.far = est.hexes ? 6000 : 2000; camera.updateProjectionMatrix();
  // Sombras: num corredor grande, acompanhar o alvo da câmera com um mapa curto rende sombra de pata nítida.
  // Duna de areia pura: sem rocha nem vegetação para dar contraste, luz do alto achata o relevo.
  // Com o sol rasante e a hemisférica baixa, a crista e a face de sotavento aparecem.
  est.duna = !!t.areia;
  hemi.intensity = est.duna ? 0.55 : 1.6;
  sol.intensity = est.duna ? 3.0 : 2.4;
  const raioSombra = est.hexes ? 90 : Math.max(W, D) / 1.6;
  sol.position.set(W * 0.4, 120, -D * 0.3); sol.shadow.camera.left = -raioSombra; sol.shadow.camera.right = raioSombra; sol.shadow.camera.top = raioSombra; sol.shadow.camera.bottom = -raioSombra; sol.shadow.camera.far = 400;
  sol.shadow.camera.updateProjectionMatrix();
  if (est.hexes && !sol.target.parent) cena.add(sol.target);
  if (!est.cameraPosta) { camera.position.set(0, Math.max(W, D) * 0.55, D * 0.75); orbit.target.set(0, 0, 0); est.cameraPosta = true; }
  for (const a of est.mundo.vivos) adicionarAnimal(a);
  await cenaV7.reiniciar(est.mundo, alturaEm);
  // Peça sob o primeiro animal antes do primeiro quadro; as vizinhas entram por proximidade no laço.
  if (est.hexes) {
    const a = est.mundo.vivos[0];
    if (a) { await est.hexes.atualizar(a.x, a.y, 0); est.tapete.atualizar(a.x, a.y, alturaEm, t); }
  }
  est.diagTransparente = null;
  est.sel = null; est.eventosVistos = 0; $('eventos').innerHTML = '';
  history.replaceState(null, '', `?cenario=${encodeURIComponent(cen.id)}&semente=${est.mundo.semente}`);
  aviso(`${est.mundo.vivos.length} animais · ${especies.map((e) => e.nome).join(', ')} · GLBs originais`);
  atualizarPaineis();
}

function adicionarAnimal(a) {
  const g = gltfs.get(a.especie.id);
  const v = new Animal3D(THREE, clonarEsqueleto, g, perfis[a.especie.id], a.especie, a, est.ik ? rigs.get(a.especie.id) : null);
  est.animais.set(a.id, v); cena.add(v.raiz);
  v.passoSimulacao(a);
}

// Nível de detalhe: IK das patas só perto da câmera (longe, o deslize do pé não é visível e o custo é alto).
const IK_DIST = 45;
const lodIK = (v) => { v.ikLigado = est.ik && v.raiz.position.distanceToSquared(camera.position) < IK_DIST * IK_DIST && (est.ikForcado ?? true); };
const posAlvo = (id) => { const o = est.mundo.porId.get(id) ?? est.mundo.mortos.get(id), v = est.animais.get(id); return o && v ? v.raiz.position.clone().add(new THREE.Vector3(0, o.especie.corpo.alturaM * o.escala * 0.6, 0)) : null; };
const alturaEm = (x, y) => { const t = est.mundo.terreno; return altura(t, Math.min(t.largura - 0.01, Math.max(0, x)), Math.min(t.profundidade - 0.01, Math.max(0, y))); };

function passoSim() {
  passoEco(est.mundo);
  const ev = est.mundo.eventos;
  for (; est.eventosVistos < ev.length; est.eventosVistos++) {
    const e = ev[est.eventosVistos];
    if ((e.tipo === 'nascimento' || e.tipo === 'eclosao') && est.mundo.porId.get(e.id)) adicionarAnimal(est.mundo.porId.get(e.id));
    if (e.tipo === 'ferimento') est.animais.get(e.id)?.reagirImpacto();
    if (IMPORTANTES[e.tipo]) registrarEvento(e);
  }
  for (const a of est.mundo.animais) est.animais.get(a.id)?.passoSimulacao(a);
}

const IMPORTANTES = { alarme: 'alarme', perseguicao_inicio: 'perseguição', perseguicao_fim: 'fim da perseguição', ferimento: 'ferimento', esquiva: 'esquiva', morte: 'morte', conflito_inicio: 'disputa', conflito_fase: 'escalada', conflito_fim: 'fim da disputa', oportunidade_fuga: 'oportunidade de fuga', presa_escapou_durante_disputa: 'presa escapou na disputa', protege_filhote: 'protege filhote', reivindica_carcaca: 'carcaça reivindicada', abandona_carcaca: 'carcaça abandonada', nascimento: 'nascimento', sentinela: 'nova sentinela', migracao: 'migração', seguro: 'perigo passou' };
function registrarEvento(e) {
  const li = document.createElement('li');
  const forte = ['morte', 'ferimento', 'conflito_inicio', 'presa_escapou_durante_disputa', 'oportunidade_fuga'].includes(e.tipo);
  const extra = e.tipo === 'ferimento' ? ` ${e.regiao} ← ${e.atacante} (${e.ataque})` : e.tipo === 'morte' ? ` (${e.causa}${e.por ? ` por ${e.por}` : ''})` : e.tipo === 'conflito_inicio' ? ` × ${e.rival} (${e.motivo})` : e.tipo === 'conflito_fase' ? ` → ${e.fase}` : e.tipo === 'conflito_fim' ? `: ${e.perdedor ?? '—'} ${e.motivo} na fase ${e.faseFinal}` : e.tipo === 'perseguicao_inicio' ? ` → ${e.presa}` : e.tipo === 'perseguicao_fim' ? `: ${e.motivo} (${e.duracao}s)` : '';
  li.innerHTML = `<span class="t">${e.t.toFixed(1)}s</span> <span class="${forte ? 'forte' : ''}">${IMPORTANTES[e.tipo]}</span> ${e.id ?? ''}${extra}`;
  $('eventos').prepend(li);
  while ($('eventos').children.length > 60) $('eventos').lastChild.remove();
}

// ---------- Painéis ----------
const pct = (v) => Math.max(0, Math.min(100, v));
// Nomes editados pelo usuário nunca podem virar HTML no painel de população.
const escaparHtml = (v) => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
// Bloco da ficha para as espécies das dunas: meio, profundidade, areia do ponto, estímulos e decisões.
function fichaSubsolo(a, m) {
  const s = a.subsolo;
  const esp = espessuraAreia(m.terreno, a.x, a.y);
  const pistas = [...(a.memoria.vibracoes?.values() ?? [])].sort((x, y) => y.intensidade - x.intensidade).slice(0, 3);
  const lista = pistas.map((p) => `${[...p.tipos].join('/')} a ${Math.hypot(p.x - a.x, p.y - a.y).toFixed(0)} m (±${p.erroM.toFixed(1)} m, ${p.especie ?? 'espécie desconhecida'})`).join('; ') || 'nenhum';
  const ultimas = (m.decisoes ?? []).filter((d) => d.id === a.id).slice(-3).reverse().map((d) => `${d.t.toFixed(0)} s ${d.codigo}`).join(' · ') || '—';
  return `<dt>Meio</dt><dd>${s.fase.replaceAll('_', ' ')} · profundidade ${s.prof.toFixed(2)} m (máx ${s.profMax.toFixed(2)} m)</dd>
      <dt>Areia aqui</dt><dd>${esp.toFixed(1)} m de espessura · ${s.mergulhos} mergulhos, ${s.emergencias} emergências, ${s.bloqueios} bloqueios</dd>
      <dt>Vibrações</dt><dd>${escaparHtml(lista)}</dd>
      <dt>Decisões</dt><dd>${escaparHtml(ultimas)}</dd>`;
}

function atualizarPaineis() {
  const m = est.mundo; if (!m) return;
  const r = m.relogio;
  $('relogio').textContent = `t ${m.t.toFixed(1)} s · dia ${r.diaInteiro} ${String(Math.floor(r.hora)).padStart(2, '0')}h${String(Math.floor((r.hora % 1) * 60)).padStart(2, '0')} · ${r.estacao}${r.chovendo ? ', chuva' : ''} · hash ${hashMundo(m)}`;
  const rt = retrato(m);
  const mortes = Object.entries(m.metricas.mortes).map(([k, v]) => `${k} ${v}`).join(', ') || 'nenhuma';
  const conflitos = m.metricas.eventos.conflito_inicio ?? 0;
  const hx = est.hexes ? `<br>peças carregadas: ${est.hexes.carregadas.join(', ') || 'nenhuma'}${est.hexes.pendentes.length ? ` · faltam ${est.hexes.pendentes.join(', ')}` : ''}` : '';
  $('pop').innerHTML = `${Object.entries(rt.populacao).map(([k, v]) => `${escaparHtml(m.config.especies[k]?.nome ?? k)} ${v}`).join(' · ')}<br>mortes: ${mortes} · disputas: ${conflitos} · fugas na disputa: ${m.metricas.escapesDuranteDisputa}<br>carcaças ${rt.carcacas} · grupos ${rt.grupos} (média ${rt.tamanhoMedioGrupo}) · fome média ${rt.fomeMedia} · sede média ${rt.sedeMedia}${hx}`;
  $('pop').insertAdjacentHTML('beforeend', painelMundoV7(m, cenaV7));
  const a = est.sel && (m.porId.get(est.sel) ?? m.mortos.get(est.sel));
  if (!a) return;
  const s = a.saude, v = est.animais.get(a.id);
  const fer = s.ferimentos.filter((f) => f.gravidade > 0.01).map((f) => `<span class="chip ${f.gravidade > 0.25 ? 'perigo' : ''}">${f.regiao}${f.fratura ? ' fratura' : ''} ${(f.gravidade * 100).toFixed(0)}%${f.sangramento > 0.05 ? ' sangra' : ''}${f.infeccao > 0 ? ' infec.' : ''}</span>`).join('') || '<span class="chip ok">sem ferimentos</span>';
  const doe = s.doencas.map((d) => `<span class="chip perigo">${d.id} ${(d.intensidade * 100).toFixed(0)}%</span>`).join('');
  const g = a.grupoId ? m.grupos.get(a.grupoId) : null;
  const mem = [...a.memoria.criaturas.values()].filter((x) => x.especie !== a.especie.id || a.especie.papel === 'carnivoro').slice(0, 5).map((x) => `<li>${x.id} via ${x.via}, há ${(m.t - x.t).toFixed(1)} s</li>`).join('') || '<li>ninguém</li>';
  const aval = a.mente.ultimaAvaliacao && m.t - a.mente.ultimaAvaliacao.t < 3 ? `<dt>Rival</dt><dd>vantagem ${a.mente.ultimaAvaliacao.vantagem.toFixed(2)} · disposição ${a.mente.ultimaAvaliacao.disposicao.toFixed(2)}</dd>` : '';
  $('ficha').innerHTML = `
    <div class="ficha-nome">${a.especie.nome}</div>
    <div class="sub">${a.id} · ${a.sexo === 'F' ? 'fêmea' : 'macho'} · ${a.idadeAnos.toFixed(1)} anos · ${a.massa.toFixed(1)} kg${a.juvenil ? ' · filhote' : ''}</div>
    <span class="chip">${a.vivo ? a.estado.replaceAll('_', ' ') : `morto (${a.causaMorte})`}</span>${g ? `<span class="chip">${a.papel} · grupo ${g.membros.length}</span>` : ''}${a.conflito ? `<span class="chip perigo">disputa com ${a.conflito.rival}</span>` : ''}
    <div class="motivo">${a.motivo}</div>
    <dl class="vals">
      <dt>Vida</dt><dd>${s.hp.toFixed(0)}/${s.hpMax.toFixed(0)}<div class="barra vida"><i style="width:${pct((100 * s.hp) / s.hpMax)}%"></i></div></dd>
      <dt>Energia</dt><dd>${a.energia.toFixed(0)} · fôlego ${a.folego.toFixed(1)} s<div class="barra"><i style="width:${pct(a.energia)}%"></i></div></dd>
      <dt>Fome</dt><dd>${a.fome.toFixed(0)}<div class="barra fome"><i style="width:${pct(a.fome)}%"></i></div></dd>
      <dt>Sede</dt><dd>${a.sede.toFixed(0)}<div class="barra sede"><i style="width:${pct(a.sede)}%"></i></div></dd>
      <dt>Alvo</dt><dd>${a.alvo ? `${a.alvo.tipo} ${a.alvo.id ?? ''}` : '—'}</dd>
      ${est.hexes ? `<dt>Peça</dt><dd>${est.hexes.pecaEm(a.x, a.y)?.id ?? '—'} · divisa ${est.hexes.distanciaDaDivisa(a.x, a.y)?.toFixed(1) ?? '—'} m</dd>` : ''}
      ${a.subsolo ? fichaSubsolo(a, m) : ''}
      ${fichaV7(a, m)}
      <dt>Velocidade</dt><dd>${a.velocidade.toFixed(2)} m/s · mobilidade ${(fatorMobilidade(a) * 100).toFixed(0)}%</dd>
      <dt>Clipe</dt><dd>${v?.nomeAtual ?? '—'} ×${v?.atual?.timeScale?.toFixed(2) ?? '1'} · desliza ${v?.deslize?.toFixed(2) ?? 0} m/s</dd>
      <dt>Percebe</dt><dd>${a.contatos.filter((k) => k.via !== 'som').map((k) => `${k.id} (${k.via})`).join(', ') || 'nada'}</dd>
      ${aval}
    </dl>
    <h2>Saúde</h2><div>${fer}${doe}</div>
    <h2 style="margin-top:8px">Memória</h2><ul class="mini">${mem}</ul>`;
}

// ---------- Interação ----------
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
renderer.domElement.addEventListener('click', (ev) => {
  const r = renderer.domElement.getBoundingClientRect();
  ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects([...est.animais.values()].map((v) => v.raiz), true).find((h) => h.object.userData.animalId);
  if (hit) { est.sel = hit.object.userData.animalId; atualizarPaineis(); }
});
$('tocar').onclick = () => { est.rodando = !est.rodando; $('tocar').textContent = est.rodando ? 'Pausar' : 'Continuar'; est.ultimo = performance.now(); };
$('reiniciar').onclick = () => reiniciar();
$('cenario').onchange = () => { est.cameraPosta = false; reiniciar(); };
$('semente').onchange = () => reiniciar();
$('sortear').onclick = () => { $('semente').value = Math.floor(Math.random() * 100000); reiniciar(); };
$('velocidade').onchange = () => { est.vel = Number($('velocidade').value);
est.ik = q.get('ik') !== '0'; };
document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !['INPUT', 'SELECT'].includes(e.target.tagName)) { e.preventDefault(); $('tocar').click(); } });

// Transparência diagnóstica: no modo de inspeção o chão fica translúcido para mostrar o corpo enterrado.
// É só material — a grade física, as colisões e o volume de areia continuam exatamente os mesmos.
function transparenciaDiagnostica(ligado) {
  // Peça nova carregada depois da troca: o material dela ainda é opaco, então reaplica.
  const n = est.hexes?.carregadas.length ?? 0;
  if (est.diagTransparente === ligado && est.diagPecas === n) return;
  est.diagPecas = n;
  est.diagTransparente = ligado;
  const aplicar = (o) => {
    if (!o.isMesh || !o.material) return;
    o.material.transparent = ligado;
    o.material.opacity = ligado ? 0.42 : 1;
    o.material.depthWrite = !ligado;
    o.material.needsUpdate = true;
  };
  est.hexes?.grupo.traverse(aplicar);
  est.terreno3d?.traverse(aplicar);
}

// Marcadores do modo de inspeção subterrânea: linha da superfície até o corpo, rota planejada no volume de
// areia e linhas até os estímulos de vibração que o animal sentiu. Só desenho — não muda nada na simulação.
function marcadoresSubsolo(m) {
  if (!inspecao.grupo.visible) return [];
  const t = m.terreno, W = t.largura / 2, D = t.profundidade / 2;
  const out = [];
  for (const a of m.vivos) {
    if (!a.subsolo) continue;
    if (est.sel && a.id !== est.sel) continue;
    const ySup = alturaEm(a.x, a.y);
    const base = { x: a.x - W, z: a.y - D, ySuperficie: ySup, yCorpo: ySup - a.subsolo.prof };
    const rota = (a.caminhoAreia?.pontos ?? []).slice(a.caminhoAreia?.i ?? 0, (a.caminhoAreia?.i ?? 0) + 60)
      .map((p) => ({ x: p.x - W, z: p.y - D, y: alturaEm(p.x, p.y) - a.subsolo.prof }));
    const estimulos = [...(a.memoria.vibracoes?.values() ?? [])].slice(0, 3)
      .map((v) => ({ x: v.x - W, z: v.y - D, y: alturaEm(v.x, v.y) - (v.prof ?? 0) }));
    out.push({ ...base, rota: rota.length > 1 ? [{ x: base.x, z: base.z, y: base.yCorpo }, ...rota] : null, estimulos });
  }
  return out;
}

// ---------- Laço ----------
let ultimoPainel = 0, ultimoHex = 0;
function quadro(agora) {
  requestAnimationFrame(quadro);
  const dtReal = Math.min(0.1, (agora - est.ultimo) / 1000); est.ultimo = agora;
  const m = est.mundo;
  if (m && est.rodando) {
    est.acum += dtReal * est.vel;
    let n = 0;
    while (est.acum >= m.dt && n++ < 60) { passoSim(); est.acum -= m.dt; }
  }
  if (m) {
    const alfa = est.rodando ? Math.min(1, est.acum / m.dt) : 1;
    const dtAnim = est.rodando ? dtReal * est.vel : 0;
    for (const a of m.animais) { const v = est.animais.get(a.id); if (v) { lodIK(v); v.quadro(alfa, dtAnim, a, m.terreno, alturaEm, posAlvo); if (a.subsolo) reagirAreia(efeitosAreia, v, a, dtAnim, alturaEm); } }
    cenaV7.quadro(m, est, dtReal, camera, alturaEm);
    efeitosAreia.atualizar(dtReal, camera);
    inspecao.grupo.visible = !!$('ver-subsolo')?.checked;
    transparenciaDiagnostica(inspecao.grupo.visible);
    inspecao.atualizar(marcadoresSubsolo(m));
    camadas.desenhar(m, alturaEm, est.sel, { percepcao: $('ver-percepcao').checked, memoria: $('ver-memoria').checked, territorios: $('ver-territorios').checked, grupos: $('ver-grupos').checked });
    // Seguir: a câmera anda junto com o alvo (só mover o alvo deixaria o animal para trás na travessia).
    if ($('seguir').checked && est.sel) {
      const v = est.animais.get(est.sel);
      if (v) { const antes = orbit.target.clone(); orbit.target.lerp(v.raiz.position, 0.08); camera.position.add(orbit.target.clone().sub(antes)); }
    }
    // Peças do mundo: carrega a vizinhança do que está sendo olhado, antes de a criatura chegar na divisa.
    if (est.hexes) {
      sol.target.position.copy(orbit.target);
      if (est.duna) sol.position.set(orbit.target.x + 190, orbit.target.y + 65, orbit.target.z - 130);
      else sol.position.set(orbit.target.x + 90, orbit.target.y + 140, orbit.target.z - 70);
      const alvoX = orbit.target.x + m.terreno.largura / 2, alvoY = orbit.target.z + m.terreno.profundidade / 2;
      est.tapete?.atualizar(alvoX, alvoY, alturaEm, m.terreno);
      if (agora - ultimoHex > 500) { ultimoHex = agora; est.hexes.atualizar(alvoX, alvoY); }
    }
    if (agora - ultimoPainel > 250) { ultimoPainel = agora; atualizarPaineis(); }
  }
  orbit.update();
  renderer.render(cena, camera);
}

instalarControlesV7([$('ficha'), $('pop')], est);

// API para testes no navegador e automação.
window.ecoDemo = {
  get mundo() { return est.mundo; },
  get cena() { return cena; },
  get camera() { return camera; },
  get hexes() { return est.hexes; },
  get oficina() { return { selecionados: oficina.getSelecao(), totalModelos: oficina.getCatalogo().length }; },
  alturaEm,
  // Imersão REAL da malha: percorre os vértices do GLB já deformados pelo esqueleto (applyBoneTransform),
  // leva cada um para o mundo e compara com a superfície do terreno naquele x,z.
  // Aproximação declarada: é fração de VÉRTICES, não de volume — a malha do Arenoceto é quase uniforme,
  // mas regiões mais densas (cabeça) pesam mais que o volume que ocupam.
  imersao(id) {
    const v = est.animais.get(id), a = est.mundo?.porId.get(id);
    if (!v || !a) return null;
    const t = est.mundo.terreno, W = t.largura / 2, D = t.profundidade / 2;
    const p = new THREE.Vector3();
    let total = 0, dentro = 0, maisAlto = -Infinity, maisBaixo = Infinity;
    v.modelo.updateMatrixWorld(true);
    v.modelo.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i);
        if (o.isSkinnedMesh) o.applyBoneTransform(i, p);
        o.localToWorld(p);
        const h = alturaEm(p.x + W, p.z + D);
        const rel = p.y - h;
        total++;
        if (rel < 0) dentro++;
        if (rel > maisAlto) maisAlto = rel;
        if (rel < maisBaixo) maisBaixo = rel;
      }
    });
    return {
      id, vertices: total, fracaoEnterrada: total ? +(dentro / total).toFixed(4) : 0,
      acimaDaSuperficieM: +maisAlto.toFixed(2), abaixoDaSuperficieM: +maisBaixo.toFixed(2),
      fase: a.subsolo?.fase ?? 'superficie', progresso: +(a.subsolo?.progresso ?? 0).toFixed(3),
      profCentroM: +(a.subsolo?.prof ?? 0).toFixed(2), t: +est.mundo.t.toFixed(2),
      metodo: 'fracao-de-vertices-com-skinning',
    };
  },
  hash: () => hashMundo(est.mundo),
  async reiniciar(cenario, semente) { if (cenario) $('cenario').value = cenario; if (semente != null) $('semente').value = semente; await reiniciar(); },
  avancar(seg) { const fim = est.mundo.t + seg; while (est.mundo.t < fim - 1e-9) passoSim(); for (const a of est.mundo.animais) { const v = est.animais.get(a.id); if (v) v.quadro(1, 0.016, a, est.mundo.terreno, alturaEm, posAlvo); } atualizarPaineis(); return est.mundo.t; },
  // Avança simulação + animação quadro a quadro com passo fixo (independe do requestAnimationFrame; serve para
  // medir as patas e capturar quadros reproduzíveis mesmo com a aba em segundo plano).
  quadros(segundos, fps = 60, aCada = null) {
    const m = est.mundo, dtq = 1 / fps;
    for (let q = 0; q < Math.round(segundos * fps); q++) {
      est.acum += dtq;
      while (est.acum >= m.dt) { passoSim(); est.acum -= m.dt; }
      const alfa = Math.min(1, est.acum / m.dt);
      for (const a of m.animais) { const v = est.animais.get(a.id); if (v) { lodIK(v); v.quadro(alfa, dtq, a, m.terreno, alturaEm, posAlvo); if (a.subsolo) reagirAreia(efeitosAreia, v, a, dtq, alturaEm); } }
      cenaV7.quadro(m, est, dtq, camera, alturaEm);
      efeitosAreia.atualizar(dtq, camera);
      // Mesmo diagnóstico do laço normal: a captura mostra o que a tela mostra.
      inspecao.grupo.visible = !!$('ver-subsolo')?.checked;
      transparenciaDiagnostica(inspecao.grupo.visible);
      inspecao.atualizar(marcadoresSubsolo(m));
      if (aCada) aCada(q);
    }
    renderer.render(cena, camera);
    return m.t;
  },
  // GIF real do renderizador (servidor do laboratório): passo fixo, câmera opcional seguindo um ou dois animais.
  async gravarGif(nome, segundos, { fps = 10, largura = 400, altura = 225, seguir = null, com = null, dist = 9, ang = 30, alturaRel = 0.4 } = {}) {
    const w0 = renderer.domElement.width, h0 = renderer.domElement.height, pr = renderer.getPixelRatio();
    renderer.setPixelRatio(1); renderer.setSize(largura * 2, altura * 2, false); camera.aspect = largura / altura; camera.updateProjectionMatrix();
    const cv = document.createElement('canvas'); cv.width = largura; cv.height = altura;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const id = `e${Date.now()}`;
    for (let q = 0; q < Math.round(segundos * fps); q++) {
      this.quadros(1 / fps, fps * 6);
      if (seguir && est.animais.get(seguir)) this.focar(seguir, dist, ang, { com: com && est.animais.get(com) ? com : null, alturaRel });
      renderer.render(cena, camera);
      ctx.drawImage(renderer.domElement, 0, 0, largura, altura);
      await fetch(`/__gif/quadro?id=${id}`, { method: 'POST', body: ctx.getImageData(0, 0, largura, altura).data });
    }
    const r = await fetch(`/__gif/fim?id=${id}&w=${largura}&h=${altura}&fps=${fps}&nome=${encodeURIComponent(nome)}`, { method: 'POST' });
    renderer.setPixelRatio(pr); renderer.setSize(w0 / pr, h0 / pr, false); redimensionar();
    return r.ok ? r.json() : null;
  },
  // Desempenho real: N quadros com simulação + animação + IK + renderização (1280×720). Devolve ms por quadro.
  medirDesempenho(quadros = 300, fps = 60) {
    const w0 = renderer.domElement.width, h0 = renderer.domElement.height, pr = renderer.getPixelRatio();
    renderer.setPixelRatio(1); renderer.setSize(1280, 720, false); camera.aspect = 1280 / 720; camera.updateProjectionMatrix();
    const m = est.mundo, dtq = 1 / fps, partes = { sim: 0, anim: 0, render: 0 };
    for (let q = 0; q < quadros; q++) {
      let t0 = performance.now();
      est.acum += dtq;
      while (est.acum >= m.dt) { passoSim(); est.acum -= m.dt; }
      let t1 = performance.now(); partes.sim += t1 - t0;
      const alfa = Math.min(1, est.acum / m.dt);
      for (const a of m.animais) { const v = est.animais.get(a.id); if (v) { lodIK(v); v.quadro(alfa, dtq, a, m.terreno, alturaEm, posAlvo); } }
      t0 = performance.now(); partes.anim += t0 - t1;
      renderer.render(cena, camera); renderer.getContext().finish?.();
      partes.render += performance.now() - t0;
    }
    renderer.setPixelRatio(pr); renderer.setSize(w0 / pr, h0 / pr, false); redimensionar();
    const r = (v) => +(v / quadros).toFixed(2);
    return { animais: m.vivos.length, quadros, msSim: r(partes.sim), msAnimacaoIK: r(partes.anim), msRender: r(partes.render), msTotal: r(partes.sim + partes.anim + partes.render), fpsEstimado: +(1000 / ((partes.sim + partes.anim + partes.render) / quadros)).toFixed(1) };
  },
  selecionar(id) { est.sel = id; atualizarPaineis(); },
  // Auditoria da divisa: dispara raios de cima sobre a malha REAL das peças, de um lado ao outro da emenda,
  // e compara com a altura que a IA consulta. Acusa fresta (raio sem acerto), salto de altura entre peças
  // e desencontro entre o chão visível e a grade de navegação.
  // Cada raio testa a malha inteira da peça (dezenas de milhares de triângulos): passoY largo mantém o custo baixo.
  auditarTravessia({ passoX = 2, passoY = 20, margem = 40, alturaRaio = 400 } = {}) {
    if (!est.hexes) return { erro: 'cenário sem peças de hexágono' };
    const t = est.mundo.terreno, o = t.origem;
    if (!o.divisa) return { erro: 'corredor de uma peça só: não há divisa para auditar' };
    const dv = o.divisa.local;
    est.hexes.grupo.updateMatrixWorld(true); // o raio usa matrixWorld: a peça pode ter acabado de entrar na cena
    const raio = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, alturaRaio * 2);
    const umRaio = (x, y) => {
      raio.ray.origin.set(x - t.largura / 2, alturaRaio, y - t.profundidade / 2);
      const hit = raio.intersectObject(est.hexes.grupo, true).find((h) => ['terrain', 'dry_streambed'].includes(h.object.name) || ['terrain', 'dry_streambed'].includes(h.object.parent?.name));
      return hit ? hit.point.y : null;
    };
    // Um raio lançado exatamente sobre a aresta compartilhada passa entre os dois triângulos por arredondamento
    // do teste de interseção. Isso é limitação do raio, não buraco no mundo: 1 mm para o lado já acerta.
    // `resgatados` conta quantas vezes foi preciso esse desvio.
    const r = { pontos: 0, semChao: 0, resgatados: 0, distanciasSemChao: [], maxDifGradeM: 0, somaDif: 0, maxDegrauM: 0, ondeDegrau: null, divisaLocal: dv, pecas: est.hexes.carregadas };
    const chao = (x, y) => {
      const direto = umRaio(x, y);
      if (direto !== null) return direto;
      for (const [dx, dy] of [[0.001, 0], [-0.001, 0], [0, 0.001], [0, -0.001]]) {
        const h = umRaio(x + dx, y + dy);
        if (h !== null) { r.resgatados++; return h; }
      }
      return null;
    };
    for (let y = passoY; y < t.profundidade; y += passoY) {
      let anterior = null;
      for (let x = dv - margem; x <= dv + margem; x += passoX) {
        const h = chao(x, y);
        r.pontos++;
        if (h === null) { r.semChao++; if (!r.distanciasSemChao.includes(+(x - dv).toFixed(2))) r.distanciasSemChao.push(+(x - dv).toFixed(2)); anterior = null; continue; }
        const dif = Math.abs(h - alturaEm(x, y));
        r.somaDif += dif;
        if (dif > r.maxDifGradeM) r.maxDifGradeM = dif;
        if (anterior !== null && Math.abs(h - anterior) > r.maxDegrauM) { r.maxDegrauM = Math.abs(h - anterior); r.ondeDegrau = { x: +x.toFixed(1), y: +y.toFixed(1) }; }
        anterior = h;
      }
    }
    r.medDifGradeM = +(r.somaDif / Math.max(1, r.pontos - r.semChao)).toFixed(4);
    r.maxDifGradeM = +r.maxDifGradeM.toFixed(4); r.maxDegrauM = +r.maxDegrauM.toFixed(4);
    delete r.somaDif;
    return r;
  },
  tocar() { if (!est.rodando) $('tocar').click(); },
  pausar() { if (est.rodando) $('tocar').click(); },
  // Ângulo entre a frente visual de cada modelo e o rumo do animal (0° = anda para a frente).
  verificarOrientacao: () => [...est.animais.entries()].filter(([id]) => est.mundo.porId.has(id)).map(([id, v]) => ({ id, especie: v.especie.id, desvioGraus: +v.desvioFrente().toFixed(2), clipe: v.nomeAtual, timeScale: +(v.atual?.timeScale ?? 1).toFixed(2), deslize: +v.deslize.toFixed(2) })),
  // Patas: deslize horizontal no apoio e erro de altura, só animação (FK) × com IK, por animal.
  metricasPernas: () => [...est.animais.entries()].filter(([, v]) => v.pernas).map(([id, v]) => ({ id, especie: v.especie.id, ...v.pernas.metricas() })),
  ligarIK(on) { est.ikForcado = on; for (const v of est.animais.values()) v.ikLigado = on && est.ik; },
  modelosCarregados: () => [...gltfs.entries()].map(([id, g]) => ({ id, clipes: g.animations.length })),
  // Enquadra um animal (distância em metros, ângulo de visão opcional em graus).
  // `com`: segundo animal para enquadrar junto (ponto médio). `alturaRel`: altura da câmera relativa à distância.
  focar(id, dist = 12, angGraus = 35, { com = null, alturaRel = 0.55 } = {}) {
    const v = est.animais.get(id); if (!v) return false;
    const w = com ? est.animais.get(com) : null;
    const p = w ? v.raiz.position.clone().add(w.raiz.position).multiplyScalar(0.5) : v.raiz.position.clone();
    const r = (angGraus * Math.PI) / 180;
    p.y += 0.6;
    orbit.target.copy(p); camera.position.set(p.x + dist * Math.cos(r), p.y + dist * alturaRel, p.z + dist * Math.sin(r));
    if (est.hexes) {
      const t = est.mundo.terreno;
      sol.target.position.copy(orbit.target);
      if (est.duna) sol.position.set(orbit.target.x + 190, orbit.target.y + 65, orbit.target.z - 130);
      else sol.position.set(orbit.target.x + 90, orbit.target.y + 140, orbit.target.z - 70);
      est.tapete?.atualizar(orbit.target.x + t.largura / 2, orbit.target.z + t.profundidade / 2, alturaEm, t);
    }
    orbit.update(); renderer.render(cena, camera); return true;
  },
  // Captura real do canvas (renderiza e lê no mesmo quadro). No servidor do laboratório grava em resultados/capturas.
  async capturar(nome) {
    camadas.desenhar(est.mundo, alturaEm, est.sel, { percepcao: $('ver-percepcao').checked, memoria: $('ver-memoria').checked, territorios: $('ver-territorios').checked, grupos: $('ver-grupos').checked });
    // A captura desenha fora do laço de quadros: o tapete de sombra precisa estar sob o que a câmera olha.
    est.tapete?.atualizar(orbit.target.x + est.mundo.terreno.largura / 2, orbit.target.z + est.mundo.terreno.profundidade / 2, alturaEm, est.mundo.terreno);
    // Resolução fixa (1280×720) independente do painel; restaura depois.
    const w0 = renderer.domElement.width, h0 = renderer.domElement.height, pr = renderer.getPixelRatio();
    renderer.setPixelRatio(1); renderer.setSize(1280, 720, false); camera.aspect = 1280 / 720; camera.updateProjectionMatrix();
    renderer.render(cena, camera);
    const dados = renderer.domElement.toDataURL('image/png');
    renderer.setPixelRatio(pr); renderer.setSize(w0 / pr, h0 / pr, false); redimensionar();
    try { const r = await fetch('/__captura', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome, dados }) }); if (r.ok) return (await r.json()).caminho; } catch { /* sem servidor */ }
    return dados.length;
  },
};

await reiniciar();
requestAnimationFrame(quadro);
if (q.get('tocar') === '1') $('tocar').click();
