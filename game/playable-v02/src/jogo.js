// V02 — simulador idle de Hunters autônomos. Núcleo sem DOM (Node e navegador).
// A decisão de combate e de movimento continua sendo a do Hunter Lab (decidirHunter, controle 'ia'): esta camada
// só escolhe ORDENS (`a.hunter.ordem`, lida pelo cérebro do lab quando não há inimigo).
//
// Simulação espacial (V02.3-pré): cada Hunter vive numa REGIÃO DETALHADA MÓVEL (src/regioes.js): uma grade de
// 1 200 × 1 200 m construída a partir dos GLBs reais dos hexágonos e recentrada enquanto ele anda. Hunters próximos
// compartilham a região; distantes ganham regiões próprias. A viagem simplificada (grafo de 272 hexágonos) só é usada
// para atravessar hexágonos SEM GLB disponível nesta build.
import { criarMundoHunters, passoHunters, salvarMundoHunters, carregarMundoHunters } from '../../../labs/hunters/src/mundo-hunters.js';
import { foraDeCombate, criarHunter, montarFicha } from '../../../labs/hunters/src/hunter.js';
import { decidirHunter } from '../../../labs/hunters/src/cerebro-hunter.js';
import { fichaMonstro, decidirMonstro, instalarMonstro } from '../../../labs/hunters/src/monstro-varrisco.js';
import { indice } from '../../../labs/ia-criaturas/src/eco/terreno.js';
import { pontoLivre, PONTOS } from '../../playable-v01/src/cacada.js';
import { hexEm, caminho, avancar } from './estrategico.js';
import { iniciarEstadoRegras, passoRegras, decidir, definirPerfil as definirPerfilRegras, PERFIS } from './regras.js';
import { QUADRO, TAM, MARGEM_RECENTRO, MARGEM_INTERIOR, janela, hexesDaJanela, paraLocal, paraJogo, dentroRegiao, mundoVazio, aplicarJanela, transferir, hexDisponivel, hexDoPonto, deslocar } from './regioes.js';

export const ESQUADRAO = [
  { id: 'arvo', nome: 'Arvo', armadura: 'leve', personalidade: { agressividade: 0.72, cautela: 0.35, disciplina: 0.7 }, habilidade: 0.85, perfil: 'agressivo', dx: 0, dy: 0 },
  { id: 'brena', nome: 'Brena', armadura: 'media', personalidade: { agressividade: 0.55, cautela: 0.55, disciplina: 0.8 }, habilidade: 0.8, perfil: 'equilibrado', dx: 6, dy: 2 },
  { id: 'caio', nome: 'Caio', armadura: 'leve', personalidade: { agressividade: 0.4, cautela: 0.7, disciplina: 0.6 }, habilidade: 0.7, perfil: 'cauteloso', dx: -6, dy: 3 },
  { id: 'dara', nome: 'Dara', armadura: 'leve', personalidade: { agressividade: 0.5, cautela: 0.6, disciplina: 0.75 }, habilidade: 0.75, perfil: 'equilibrado', dx: 3, dy: 7 },
];
export const ESPECIES_CACA = [{ id: 'varrisco', nome: 'Varrisco' }];
export { QUADRO };
const AVANCO = 150;   // m à frente na rota para a próxima ordem local

// ------------------------------------------------------------------ criação
// Janela inicial: entre a vila e a toca do Varrisco (os dois na mesma região).
export const JANELA_INICIAL = janela({ x: (PONTOS.vila[0] + PONTOS.varrisco[0]) / 2 - QUADRO.x0, y: (PONTOS.vila[1] + PONTOS.varrisco[1]) / 2 - QUADRO.z0 });
export function criarJogo(cfg, semente, { fichaHunter, equipamentos, G, provedor, terreno, vidaMonstro = 0.5 }) {
  const w = JANELA_INICIAL, R = { id: 'R1', ...w };
  const loc = ([X, Z]) => pontoLivre(null, terreno, X - w.X0, Z - w.Z0);
  const vilaL = loc(PONTOS.vila), tocaL = loc(PONTOS.varrisco);
  const armaduras = new Set(Object.keys(equipamentos.armaduras));
  const cen = {
    id: 'auralis-v02', nome: 'Auralis — regiões detalhadas móveis', dt: 0.05, duracaoSeg: 1e9,
    modoCombate: 'letal', relogio: { segundosPorDia: 900, diaInicial: 20, horaInicial: 10 }, clima: { chanceIncendio: 0 },
    terreno: { tipo: 'procedural', largura: 4, profundidade: 4, res: 1, amplitude: 0, capim: 0 },
    populacoes: [], hunters: [],
  };
  // Os atores nascem DEPOIS de a grade real entrar: criarAnimal prende a posição dentro do terreno do cenário
  // (aqui uma casca 4 × 4), por isso as mesmas definições do cenário são aplicadas em seguida.
  const defs = {
    varrisco: { id: 'varrisco-real', ...tocaL, idadeAnos: 6, direcaoGraus: 90, fome: 70, sede: 0 },
    hunters: ESQUADRAO.map((h) => ({ id: h.id, nome: h.nome, equipe: 'vila', ...pontoLivre(null, terreno, vilaL.x + h.dx, vilaL.y + h.dy), direcaoGraus: 270,
      equipamento: { arma: 'espada', escudo: null, armadura: armaduras.has(h.armadura) ? h.armadura : 'leve' }, personalidade: h.personalidade, habilidade: h.habilidade })),
  };
  R.m = criarMundoHunters({ ...cfg, cenarios: { ...cfg.cenarios, [cen.id]: cen } }, cen, semente, { fichaHunter, equipamentos });
  R.m.terreno = terreno; R.m.pontosAgua = []; R.m.opcoes.maxEventos = 20000;
  // Como criarMundoEco faz com `individuos` e criarMundoHunters com `hunters`:
  const especieV = cfg.especies.varrisco, dv = defs.varrisco;
  const v = R.m.criarAnimal(especieV, { idadeDias: Math.round(dv.idadeAnos * 365), ...dv });
  v.casa = { x: dv.x, y: dv.y, raio: 80 };
  if (especieV.social.territorial) v.territorio = { x: dv.x, y: dv.y, raio: especieV.social.raioTerritorioM };
  for (const def of defs.hunters) { const a = criarHunter(R.m, montarFicha(fichaHunter, equipamentos, def.equipamento), { modo: R.m.modoCombate, ...def }); a.comandoTeste = decidirHunter; }
  instalarMonstro(R.m);
  v.saude.hpMax *= vidaMonstro; v.saude.hp = v.saude.hpMax;
  const jogo = { cfg, recursos: { fichaHunter, equipamentos }, semente, G, cen, provedor, regioes: new Map([[R.id, R]]), seq: 1, t: 0, tick: 0,
    vila: paraJogo(R, vilaL), toca: paraJogo(R, tocaL), hunters: new Map(), estrategicos: new Map(), log: [], pendentes: [] };
  R.lidoN = -1;
  for (const a of R.m.hunters) { const e = novoEstado(a.id); jogo.hunters.set(a.id, e); iniciarEstadoRegras(e, a, ESQUADRAO.find((h) => h.id === a.id)?.perfil); }
  return jogo;
}
const novoEstado = (id) => ({ id, fila: [], atual: null, modo: 'detalhado', estrat: null, hexAtual: null, log: [], visto: [] });

// ------------------------------------------------------------------ acesso
export function regiaoDe(jogo, id) { for (const R of jogo.regioes.values()) if (R.m.porId.has(id) || R.m.mortos.has(id)) return R; return null; }
export const atorDe = (jogo, id) => { const R = regiaoDe(jogo, id); return R ? R.m.porId.get(id) ?? R.m.mortos.get(id) : jogo.estrategicos.get(id) ?? null; };
export function posicao(jogo, id) {
  const e = jogo.hunters.get(id);
  if (e.modo === 'estrategico') return { x: e.estrat.x, y: e.estrat.y };
  const R = regiaoDe(jogo, id), a = R.m.porId.get(id) ?? R.m.mortos.get(id);
  return paraJogo(R, a);
}
export const morto = (jogo, id) => { const R = regiaoDe(jogo, id), a = atorDe(jogo, id); return !a || !a.vivo || !!R?.m.mortos.has(id); };
export const ativas = (jogo) => [...jogo.regioes.values()].filter((R) => R.m.hunters.some((a) => a.vivo && R.m.porId.has(a.id)));
export function situacao(jogo, id) {
  const a = atorDe(jogo, id), e = jogo.hunters.get(id);
  if (morto(jogo, id)) return 'morto';
  if (e.modo === 'estrategico') return 'viajando';
  if (foraDeCombate(a)) return 'incapacitado';
  if (e.regraAtiva === 'defesa') return 'em combate';
  if (e.regraAtiva === 'evitar') return 'evitando ameaça';
  if (e.regraAtiva === 'ajudar') return 'ajudando';
  if (a.hunter.alvoId || a.contatos?.some((c) => c.especie === 'varrisco' && c.distancia < 40)) return 'em perigo';
  if (a.saude.hp < a.saude.hpMax * 0.5) return 'ferido';
  return { cacar: 'caçando', explorar: 'explorando', patrulhar: 'patrulhando', descansar: 'descansando', vila: 'na vila', ir: 'deslocando', voltar: 'voltando' }[e.atual?.tipo] ?? 'aguardando';
}
const anotar = (jogo, id, texto, tipo = 'tarefa') => { const e = jogo.hunters.get(id), r = { t: +jogo.t.toFixed(1), tipo, texto }; e.log.push(r); if (e.log.length > 80) e.log.shift(); jogo.log.push({ id, ...r }); if (jogo.log.length > 300) jogo.log.shift(); };
// Todas as criaturas vivas do jogo (todas as regiões, inclusive dormentes).
const criaturas = (jogo) => [...jogo.regioes.values()].flatMap((R) => R.m.animais.filter((a) => !a.hunter && a.vivo && !R.m.mortos.has(a.id)).map((a) => ({ a, R })));

// ------------------------------------------------------------------ ordens
// tipo: ir {alvo:{x,y}} · explorar {hex} · cacar {especie} · voltar · descansar · patrulhar {centro, raio} · vila
export function ordenar(jogo, ids, tarefa, { fila = false } = {}) {
  for (const id of ids) {
    const e = jogo.hunters.get(id);
    if (!e || morto(jogo, id)) continue;
    const t = structuredClone(tarefa);
    if (fila && (e.atual || e.fila.length)) { e.fila.push(t); anotar(jogo, id, `na fila: ${rotulo(jogo, t)}`); continue; }
    e.fila = []; iniciar(jogo, id, t);
  }
}
export function rotulo(jogo, t) {
  if (!t) return 'aguardando ordens';
  const hx = t.hex ? ` ${t.hex}` : '';
  return { ir: `ir até${t.hex ? hx : ' o ponto marcado'}`, explorar: `explorar${hx}`, cacar: `caçar ${t.especie}`, voltar: 'voltar à vila',
    descansar: 'descansar e recuperar-se', patrulhar: `patrulhar${hx || ' a área'}`, vila: 'permanecer na vila' }[t.tipo] ?? t.tipo;
}
function iniciar(jogo, id, t) {
  const e = jogo.hunters.get(id), p = posicao(jogo, id);
  if (/^suspensa/.test(t.estado ?? '')) { e.atual = t; t.estado = 'em andamento'; decidir(jogo, id, { regra: 'retomar', acao: 'retomar', motivo: `Missão retomada após recuperação: ${rotulo(jogo, t)}` }, ctxDe(jogo)); return; }
  e.atual = t; t.inicio = jogo.t; t.progresso = 0; t.estado = 'em andamento';
  if (t.tipo === 'voltar' || t.tipo === 'descansar' || t.tipo === 'vila') t.alvo = { ...jogo.vila };
  if (t.tipo === 'explorar' || t.tipo === 'patrulhar') {
    const hex = t.hex ? jogo.G.porId.get(t.hex) : hexEm(jogo.G, p.x, p.y);
    t.hex = hex?.id;
    t.pontos = t.tipo === 'patrulhar' ? pontosDeVisita(jogo, id, hex, t.raio ?? 120, 4, t.centro ?? { x: p.x, y: p.y }) : pontosDeVisita(jogo, id, hex, 1500, 5);
    t.i = 0;
  }
  if (t.tipo === 'cacar' && !criaturas(jogo).some(({ a }) => a.especie.id === t.especie)) { t.estado = 'indisponível'; anotar(jogo, id, `${t.especie}: espécie não encontrada em Auralis simulada — caçada indisponível`, 'aviso'); }
  anotar(jogo, id, `tarefa: ${rotulo(jogo, t)}`);
}
// Pontos de visita no hexágono. Se a região do Hunter cobre o ponto, só células livres; senão o ponto fica como está
// e a navegação local resolve quando a região chegar lá.
function pontosDeVisita(jogo, id, hex, raio, n, centro = null) {
  const R = regiaoDe(jogo, id), pts = [];
  let s = [...String(id) + (hex?.id ?? '')].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let k = 0; k < 4000 && pts.length < n; k++) {
    const p = centro ? (() => { const ang = (pts.length / n) * Math.PI * 2 + rnd() * 0.8, r = raio * (0.5 + 0.5 * rnd()); return { x: centro.x + Math.cos(ang) * r, y: centro.y + Math.sin(ang) * r }; })()
      : { x: hex.cx + (rnd() - 0.5) * 2 * raio, y: hex.cy + (rnd() - 0.5) * 2 * raio };
    if (hex && hexEm(jogo.G, p.x, p.y)?.id !== hex.id) continue;
    if (R && dentroRegiao(R, p, MARGEM_INTERIOR)) { const l = paraLocal(R, p), t = R.m.terreno, q = indice(t, l.x, l.y); if (t.bloqueio[q] || t.inclinacao[q] > 25) continue; }
    if (pts.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < raio * 0.15)) continue;
    pts.push(p);
  }
  for (let i = 1; i < pts.length; i++) { let j = i; for (let k = i + 1; k < pts.length; k++) if (Math.hypot(pts[k].x - pts[i - 1].x, pts[k].y - pts[i - 1].y) < Math.hypot(pts[j].x - pts[i - 1].x, pts[j].y - pts[i - 1].y)) j = k; [pts[i], pts[j]] = [pts[j], pts[i]]; }
  return pts.length ? pts : [centro ?? { x: hex.cx, y: hex.cy }];
}

// ------------------------------------------------------------------ passo
export function ctxDe(jogo) {
  return jogo.ctx ??= {
    atorDe, foraDeCombate, anotar, iniciar, posicao: (j, id) => posicao(j, id), mundoDe: (j, id) => regiaoDe(j, id)?.m,
    // Ponto livre perto de (x, y) LOCAL da região do Hunter.
    pontoLivreLocal: (j, id, x, y) => { const R = regiaoDe(j, id); return pontoLivre(null, R.m.terreno, Math.max(MARGEM_INTERIOR, Math.min(R.L - MARGEM_INTERIOR, x)), Math.max(MARGEM_INTERIOR, Math.min(R.P - MARGEM_INTERIOR, y))); },
  };
}
export const definirPerfil = (jogo, id, perfil) => definirPerfilRegras(jogo, id, perfil, ctxDe(jogo));

export function passoJogo(jogo) {
  aplicarPendentes(jogo);
  for (const id of jogo.hunters.keys()) if (!passoRegras(jogo, id, ctxDe(jogo))) tarefa(jogo, id);
  const at = ativas(jogo);
  // Suprimentos não são modelados nesta build (V02.7): fome e sede dos Hunters ficam no nível inicial do núcleo (20).
  // Sem isso, viagens de vários dias matavam de sede — não há água nas regiões desta build.
  for (const R of at) for (const a of R.m.hunters) { if (a.fome > 20) a.fome = 20; if (a.sede > 20) a.sede = 20; }
  for (const R of at) passoHunters(R.m);
  if (at.length) { jogo.t = at[0].m.t; jogo.tick = at[0].m.tick; } else { jogo.t = Math.round((jogo.t + jogo.cen.dt) * 1e6) / 1e6; jogo.tick++; }
  viagens(jogo);
  for (const R of at) eventos(jogo, R);
  if (jogo.tick % 20 === 0) gerirRegioes(jogo);
}

// ------------------------------------------------------------------ regiões: recentrar, dividir, juntar
const livre = (jogo, a) => !a.hunter.alvoId && !a.golpe && jogo.hunters.get(a.id)?.regraAtiva !== 'defesa';
function solicitar(jogo, w, aoFicarPronta) {
  const ids = hexesDaJanela(jogo.G, w).filter((id) => hexDisponivel(jogo, id));
  if (jogo.pendentes.some((p) => p.chave === `${w.X0},${w.Z0}` && p.aoFicarPronta === aoFicarPronta)) return;
  jogo.provedor.montar({ ...w, hexes: ids }, (t) => jogo.pendentes.push({ chave: `${w.X0},${w.Z0}`, w, t, aoFicarPronta, pronta: true }));
}
function aplicarPendentes(jogo) {
  const lista = jogo.pendentes.filter((p) => p.pronta); jogo.pendentes = jogo.pendentes.filter((p) => !p.pronta);
  for (const p of lista) p.aoFicarPronta(p.w, p.t);
}
function gerirRegioes(jogo) {
  for (const R of ativas(jogo)) {
    if (R.ocupada) continue;
    const hs = R.m.hunters.filter((a) => a.vivo && R.m.porId.has(a.id)), pj = hs.map((a) => paraJogo(R, a));
    // Pré-carga: a menos de duas margens da borda, os hexágonos da próxima janela já vão para o provedor.
    for (const a of hs) if (Math.min(a.x, R.L - a.x, a.y, R.P - a.y) < 2 * MARGEM_RECENTRO) for (const h of hexesDaJanela(jogo.G, janela(paraJogo(R, a)))) if (hexDisponivel(jogo, h)) jogo.provedor.garantir?.(h);
    const perto = hs.filter((a) => Math.min(a.x, R.L - a.x, a.y, R.P - a.y) < MARGEM_RECENTRO && livre(jogo, a));
    if (!perto.length) continue;
    // Recentrar no grupo só se todos ficarem bem longe da borda depois (senão a região recentra a cada passo enquanto
    // eles se afastam); caso contrário, o Hunter da borda ganha região própria.
    const xs = pj.map((p) => p.x), ys = pj.map((p) => p.y), folga = TAM - 2 * (MARGEM_RECENTRO + 100), cabe = Math.max(...xs) - Math.min(...xs) < folga && Math.max(...ys) - Math.min(...ys) < folga;
    if (cabe) {
      // Recentrar no grupo. Criaturas que ficariam fora não somem: a região antiga continua com elas (dormente).
      const w = janela({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 });
      R.ocupada = true;
      solicitar(jogo, w, (w2, t) => { R.ocupada = false; mover(jogo, R, w2, t, hs.map((a) => a.id)); });
    } else {
      // Separar o Hunter que está na borda numa região própria.
      const a = perto[0], w = janela(paraJogo(R, a));
      R.ocupada = true;
      solicitar(jogo, w, (w2, t) => { R.ocupada = false; novaRegiao(jogo, R, w2, t, [a.id]); });
    }
  }
  juntar(jogo);
}
// Move os Hunters `ids` da região R para a janela w: no lugar se nenhuma criatura viva ficaria de fora; senão numa região nova.
function mover(jogo, R, w, t, ids) {
  const fica = R.m.vivos.filter((a) => !a.hunter && !dentroRegiao({ ...w }, paraJogo(R, a), 1));
  if (fica.length) return novaRegiao(jogo, R, w, t, ids.filter((id) => R.m.porId.has(id)));
  const desl = aplicarJanela(R, w, t);
  for (const id of ids) { const e = jogo.hunters.get(id); for (const k of ['refugio', 'ameacaUltima', 'ameacaPerto']) if (e[k]) { e[k].x -= desl.dx; e[k].y -= desl.dy; } }
  anotarRegiao(jogo, R, ids, 'região detalhada recentrada');
}
function novaRegiao(jogo, de, w, t, ids) {
  const R = { id: `R${++jogo.seq}`, ...w, lidoN: -1 };
  R.m = mundoVazio(jogo.cfg, jogo.cen, jogo.semente + jogo.seq, jogo.recursos, t, de?.m ?? { t: jogo.t, tick: jogo.tick, relogio: [...jogo.regioes.values()][0].m.relogio });
  jogo.regioes.set(R.id, R);
  for (const id of ids) { const a = de.m.porId.get(id); if (a) { transferir(a, de, R); const e = jogo.hunters.get(id); e.refugio = null; e.ameacaUltima = null; e.ameacaPerto = null; } }
  R.lidoN = R.m.contadorEventos;
  anotarRegiao(jogo, R, ids, `nova região detalhada ${R.id}`);
  return R;
}
const anotarRegiao = (jogo, R, ids, texto) => { const hx = hexesDaJanela(jogo.G, R).filter((h) => hexDisponivel(jogo, h)); for (const id of ids) anotar(jogo, id, `${texto} (${hx.join(', ')})`, 'regiao'); };
// Regiões que se sobrepõem: Hunters e criaturas da menor passam para a maior (se cabem na janela dela); regiões vazias somem.
function juntar(jogo) {
  const rs = [...jogo.regioes.values()];
  for (const A of rs) for (const B of rs) {
    if (A === B || !jogo.regioes.has(A.id) || !jogo.regioes.has(B.id) || A.ocupada || B.ocupada || B.reservada) continue;
    const ha = A.m.hunters.filter((a) => a.vivo && A.m.porId.has(a.id)).length, hb = B.m.hunters.filter((a) => a.vivo && B.m.porId.has(a.id)).length;
    if (!ha || (hb > ha)) continue;
    // Atores vivos de B que estão dentro da janela de A (com folga) mudam para A.
    for (const a of [...B.m.vivos]) { const p = paraJogo(B, a); if (dentroRegiao(A, p, MARGEM_RECENTRO + 50) && (!a.hunter || livre(jogo, a))) transferir(a, B, A); }
    for (const a of B.m.animais.filter((x) => x.dormente && x.vivo)) { const p = paraJogo(B, a); if (dentroRegiao(A, p, MARGEM_RECENTRO + 50)) { a.dormente = false; B.m.animais = B.m.animais.filter((x) => x !== a); B.m.vivos.push(a); transferir(a, B, A); } }
    if (!B.m.vivos.length && !B.m.animais.some((a) => a.dormente && a.vivo) && !B.m.mortos.size) jogo.regioes.delete(B.id);
  }
}

// ------------------------------------------------------------------ navegação
// Rota pelo grafo; a parte em hexágonos com GLB é andada no terreno real; o trecho sem GLB é viagem simplificada.
function rota(jogo, id, de, alvo) {
  const e = jogo.hunters.get(id), chave = `${alvo.x},${alvo.y}`;
  if (e.rota?.chave === chave) return e.rota;
  const c = caminho(jogo.G, de, alvo);
  if (!c) return (e.rota = { chave, pontos: null });
  // Primeiro ponto (amostras de 25 m) em hexágono sem GLB: lá termina o trecho detalhado.
  let limite = null, total = 0;
  for (let i = 1; i < c.pontos.length && !limite; i++) {
    const a = c.pontos[i - 1], b = c.pontos[i], d = Math.hypot(b.x - a.x, b.y - a.y);
    let ultimo = a;   // limite = última amostra ainda em hexágono com GLB (a seguinte já não tem terreno)
    for (let s = 0; s <= d; s += 25) { const p = { x: a.x + (b.x - a.x) * s / d, y: a.y + (b.y - a.y) * s / d }; if (!hexDisponivel(jogo, hexDoPonto(jogo, p))) { limite = { ponto: ultimo, dist: total + s - 25, hex: hexDoPonto(jogo, p) }; break; } ultimo = p; }
    total += d;
  }
  return (e.rota = { chave, pontos: c.pontos, hexes: c.hexes, limite });
}
// Ponto da polilinha AVANCO metros à frente da projeção de p.
function aFrente(pontos, p, avanco) {
  let melhor = { i: 0, s: 0, d: Infinity };
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1], b = pontos[i], vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy || 1, s = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L2));
    const d = Math.hypot(a.x + vx * s - p.x, a.y + vy * s - p.y); if (d < melhor.d) melhor = { i, s, d };
  }
  const a = pontos[melhor.i - 1], b = pontos[melhor.i];
  return avancar(pontos, { i: melhor.i - 1, x: a.x + (b.x - a.x) * melhor.s, y: a.y + (b.y - a.y) * melhor.s }, avanco);
}
function irPara(jogo, id, alvo, ritmo = 'trote') {
  const e = jogo.hunters.get(id);
  if (e.modo === 'estrategico') {
    if (e.estrat.destino.x !== alvo.x || e.estrat.destino.y !== alvo.y) planejarViagem(jogo, id, { x: e.estrat.x, y: e.estrat.y }, alvo);
    return e.estrat.fim && Math.hypot(e.estrat.x - alvo.x, e.estrat.y - alvo.y) < 3;
  }
  const R = regiaoDe(jogo, id), a = R.m.porId.get(id), p = paraJogo(R, a), d = Math.hypot(p.x - alvo.x, p.y - alvo.y);
  let q = alvo;
  if (d > AVANCO || !dentroRegiao(R, alvo, MARGEM_INTERIOR)) {
    const r = rota(jogo, id, p, alvo);
    if (!r.pontos) { anotar(jogo, id, 'sem rota transponível até o destino', 'aviso'); e.atual.estado = 'sem rota'; return true; }
    q = aFrente(r.pontos, p, AVANCO);
    // Trecho sem GLB à frente: anda até o limite e passa à viagem simplificada.
    if (r.limite) {
      const dl = Math.hypot(p.x - r.limite.ponto.x, p.y - r.limite.ponto.y);
      if (dl < AVANCO) q = r.limite.ponto;
      const naCelulaLivre = e.ordemLivre && q === r.limite.ponto && Math.hypot(a.x - e.ordemLivre.para.x, a.y - e.ordemLivre.para.y) < 2;
      if ((dl < 10 || naCelulaLivre) && livre(jogo, a)) { sairParaViagem(jogo, id, alvo); return false; }
    }
  }
  const l = paraLocal(R, q), lc = { x: Math.max(MARGEM_INTERIOR, Math.min(R.L - MARGEM_INTERIOR, l.x)), y: Math.max(MARGEM_INTERIOR, Math.min(R.P - MARGEM_INTERIOR, l.y)) };
  if (!e.ordemLivre || Math.hypot(e.ordemLivre.de.x - lc.x, e.ordemLivre.de.y - lc.y) > 4 || e.ordemLivre.R !== R.id) e.ordemLivre = { R: R.id, de: lc, para: pontoLivre(null, R.m.terreno, lc.x, lc.y) };
  a.hunter.ordem = { tipo: 'ir', x: e.ordemLivre.para.x, y: e.ordemLivre.para.y, ritmo };
  // Destino final em célula bloqueada: chegar à célula livre que o substitui também conta.
  const final = q === alvo && dentroRegiao(R, alvo, MARGEM_INTERIOR);
  return d < 3 || (final && Math.hypot(a.x - e.ordemLivre.para.x, a.y - e.ordemLivre.para.y) < 1.5);
}
function planejarViagem(jogo, id, de, alvo) {
  const e = jogo.hunters.get(id), c = caminho(jogo.G, de, alvo);
  if (!c) { anotar(jogo, id, 'sem rota transponível', 'aviso'); return; }
  e.estrat = { ...(e.estrat ?? {}), pontos: c.pontos, hexes: c.hexes, destino: { ...alvo }, i: 0, x: de.x, y: de.y, fim: false };
}
// Viagem simplificada: o ator sai da região (continua do mesmo ponto, no quadro do jogo).
function sairParaViagem(jogo, id, alvo) {
  const R = regiaoDe(jogo, id), a = R.m.porId.get(id), e = jogo.hunters.get(id), p = paraJogo(R, a);
  R.m.vivos = R.m.vivos.filter((x) => x !== a); R.m.animais = R.m.animais.filter((x) => x !== a); R.m.hunters = R.m.hunters.filter((x) => x !== a); R.m.porId.delete(id);
  deslocar(a, -(R.X0 - QUADRO.x0), -(R.Z0 - QUADRO.z0));   // passa a guardar coordenadas do jogo
  jogo.estrategicos.set(id, a);
  e.modo = 'estrategico'; a.hunter.ordem = null; a.contatos = []; e.rota = null;
  planejarViagem(jogo, id, p, alvo);
  anotar(jogo, id, `entrou em hexágono sem terreno detalhado (${hexDoPonto(jogo, aFrente(e.estrat.pontos, p, 30))}): viagem simplificada`, 'viagem');
}
// Volta à simulação detalhada quando a rota chega a um hexágono com GLB: região nova em volta do ponto.
function voltarDaViagem(jogo, id) {
  const e = jogo.hunters.get(id), a = jogo.estrategicos.get(id);
  if (e.esperandoRegiao) return;
  e.esperandoRegiao = true;
  solicitar(jogo, janela({ x: e.estrat.x, y: e.estrat.y }), (w, t) => {
    const R = { id: `R${++jogo.seq}`, ...w, lidoN: -1, reservada: id };
    R.m = mundoVazio(jogo.cfg, jogo.cen, jogo.semente + jogo.seq, jogo.recursos, t, { t: jogo.t, tick: jogo.tick, relogio: [...jogo.regioes.values()][0].m.relogio });
    jogo.regioes.set(R.id, R); e.regiaoPronta = R.id;
  });
}
// Entra na região reservada na posição exata, quando ela cai numa célula livre (sem encaixe = sem salto); até lá,
// continua andando pela rota.
function entrarSeLivre(jogo, id) {
  const e = jogo.hunters.get(id), R = jogo.regioes.get(e.regiaoPronta), a = jogo.estrategicos.get(id);
  if (!R) { e.regiaoPronta = null; e.esperandoRegiao = false; return; }
  const l = paraLocal(R, e.estrat), k = l.x > MARGEM_INTERIOR && l.y > MARGEM_INTERIOR && l.x < R.L - MARGEM_INTERIOR && l.y < R.P - MARGEM_INTERIOR ? indice(R.m.terreno, l.x, l.y) : -1;
  if (k < 0 || R.m.terreno.bloqueio[k] || R.m.terreno.inclinacao[k] > 30) return;
  deslocar(a, R.X0 - QUADRO.x0, R.Z0 - QUADRO.z0);
  Object.assign(a, { vx: 0, vy: 0, velocidade: 0 });
  jogo.estrategicos.delete(id); R.m.animais.push(a); R.m.vivos.push(a); R.m.hunters.push(a); R.m.porId.set(id, a); R.lidoN = R.m.contadorEventos;
  e.modo = 'detalhado'; e.estrat = null; e.rota = null; e.regiaoPronta = null; e.esperandoRegiao = false; R.reservada = null;
  anotarRegiao(jogo, R, [id], 'voltou ao terreno detalhado: nova região');
}
function viagens(jogo) {
  for (const [id, e] of jogo.hunters) {
    if (e.modo !== 'estrategico' || !e.estrat) continue;
    if (e.regiaoPronta) { entrarSeLivre(jogo, id); if (e.modo !== 'estrategico') continue; }
    if (e.estrat.fim) continue;
    const a = jogo.estrategicos.get(id), hex = hexEm(jogo.G, e.estrat.x, e.estrat.y);
    const v = a.especie.movimento.trote * (a.atributos?.velocidade ?? 1) * 0.6 / (hex?.custo ?? 1), antes = { x: e.estrat.x, y: e.estrat.y };
    Object.assign(e.estrat, avancar(e.estrat.pontos, e.estrat, v * jogo.cen.dt));
    a.x = e.estrat.x; a.y = e.estrat.y; a.direcao = Math.atan2(e.estrat.y - antes.y, e.estrat.x - antes.x);
    const hd = hexDoPonto(jogo, e.estrat), ha = hexDoPonto(jogo, antes);
    if (hd !== ha && hexDisponivel(jogo, hd) && !e.esperandoRegiao) voltarDaViagem(jogo, id);
  }
}

function tarefa(jogo, id) {
  const e = jogo.hunters.get(id), a = atorDe(jogo, id);
  if (morto(jogo, id)) { if (e.atual) { e.atual.estado = 'interrompida (morte)'; e.atual = null; e.fila = []; } return; }
  // Hexágono atual: conferido a cada 10 passos (o centro mais próximo entre 272 custa 6% do passo).
  const p = posicao(jogo, id), hx = jogo.tick % 10 && e.hexAtual ? e.hexAtual : hexEm(jogo.G, p.x, p.y)?.id ?? null;
  if (hx !== e.hexAtual) { if (e.hexAtual) anotar(jogo, id, `entrou em ${hx} (${jogo.G.porId.get(hx)?.bioma ?? 'fora do mapa'})${hexDisponivel(jogo, hx) ? '' : ' — sem terreno detalhado'}`, 'exploracao'); e.hexAtual = hx; }
  if (e.modo === 'detalhado' && foraDeCombate(a)) return;
  const t = e.atual;
  if (!t) { if (e.fila.length) iniciar(jogo, id, e.fila.shift()); else if (e.modo === 'detalhado' && !a.hunter.ordem) a.hunter.ordem = { tipo: 'ir', x: a.x, y: a.y }; return; }
  if (t.estado === 'indisponível' || t.estado === 'sem rota') return concluir(jogo, id, t.estado);
  let feito = false;
  if (t.tipo === 'ir' || t.tipo === 'voltar') { feito = irPara(jogo, id, t.alvo, t.tipo === 'voltar' ? 'trote' : t.ritmo ?? 'trote'); t.progresso = progressoDist(t, p); }
  else if (t.tipo === 'explorar' || t.tipo === 'patrulhar') {
    const prox = t.pontos[t.i % t.pontos.length];
    if (irPara(jogo, id, prox, t.tipo === 'patrulhar' && Math.hypot(p.x - prox.x, p.y - prox.y) < 60 ? 'andar' : 'trote')) { t.i++; if (t.tipo === 'explorar') anotar(jogo, id, `ponto de exploração ${t.i}/${t.pontos.length} alcançado`, 'exploracao'); }
    t.progresso = t.tipo === 'explorar' ? t.i / t.pontos.length : (t.i % t.pontos.length) / t.pontos.length;
    feito = t.tipo === 'explorar' && t.i >= t.pontos.length;
  } else if (t.tipo === 'descansar' || t.tipo === 'vila') {
    const chegou = irPara(jogo, id, t.alvo, 'andar') || (e.modo === 'detalhado' && Math.hypot(p.x - t.alvo.x, p.y - t.alvo.y) < 25);
    if (chegou && e.modo === 'detalhado') a.hunter.ordem = null;
    t.progresso = a.saude.hp / a.saude.hpMax;
    feito = t.tipo === 'descansar' && chegou && a.saude.hp >= a.saude.hpMax * (PERFIS[e.perfil]?.descansoAte ?? 0.95) && !a.saude.ferimentos.some((f) => f.sangramento > 0);
  } else if (t.tipo === 'cacar') feito = cacar(jogo, id, t, a);
  if (feito) concluir(jogo, id, t.estado === 'em andamento' ? 'concluída' : t.estado);
}
const progressoDist = (t, p) => { t.dist0 ??= Math.hypot(p.x - t.alvo.x, p.y - t.alvo.y) || 1; return Math.max(0, Math.min(1, 1 - Math.hypot(p.x - t.alvo.x, p.y - t.alvo.y) / t.dist0)); };
function concluir(jogo, id, estado) {
  const e = jogo.hunters.get(id), t = e.atual; t.estado = estado; t.fim = jogo.t;
  anotar(jogo, id, `${rotulo(jogo, t)}: ${estado}`); e.atual = null; e.rota = null;
  if (/concluída/.test(estado)) decidir(jogo, id, { regra: 'concluida', acao: 'proxima', motivo: `Missão concluída: ${rotulo(jogo, t)}${e.fila.length ? ' — próxima da fila' : ''}` }, ctxDe(jogo));
  const a = atorDe(jogo, id); if (e.modo === 'detalhado' && a?.vivo) a.hunter.ordem = { tipo: 'ir', x: a.x, y: a.y };
}
// Caçar: procura onde o alvo foi visto (memória do Hunter ou de quem caça junto) ou vasculha o território conhecido.
function cacar(jogo, id, t, a) {
  const vivos = criaturas(jogo).filter(({ a: c }) => c.especie.id === t.especie);
  if (!vivos.length) { t.estado = 'concluída — presa abatida'; anotar(jogo, id, `${t.especie} abatido`, 'combate'); return true; }
  if (jogo.hunters.get(id).modo === 'estrategico') { irPara(jogo, id, jogo.toca); return false; }
  let pista = null;
  for (const h of jogo.hunters.values()) {
    if (h.atual?.tipo !== 'cacar' || h.atual.especie !== t.especie || h.modo !== 'detalhado') continue;
    const R = regiaoDe(jogo, h.id), c = R?.m.porId.get(h.id); if (!c?.memoria) continue;
    for (const mem of c.memoria.criaturas.values()) if (mem.especie === t.especie && (!pista || (mem.t ?? 0) > (pista.t ?? 0))) pista = { ...paraJogo(R, mem), t: mem.t };
  }
  if (pista) { if (!t.avistado) { t.avistado = true; anotar(jogo, id, `${t.especie} localizado`, 'combate'); } t.progresso = 0.5 + 0.5 * (1 - vivos[0].a.saude.hp / vivos[0].a.saude.hpMax); irPara(jogo, id, pista, 'trote'); return false; }
  t.busca ??= pontosDeVisita(jogo, id, hexEm(jogo.G, jogo.toca.x, jogo.toca.y), 140, 4, jogo.toca); t.ib ??= 0;
  if (irPara(jogo, id, t.busca[t.ib % t.busca.length], 'trote')) t.ib++;
  t.progresso = 0.1;
  return false;
}
function eventos(jogo, R) {
  const ev = R.m.eventos, novos = [];
  for (let i = ev.length - 1; i >= 0 && ev[i].n > R.lidoN; i--) novos.push(ev[i]);
  if (ev.length) R.lidoN = ev[ev.length - 1].n;
  for (const e of novos.reverse()) {
    if (!jogo.hunters.has(e.id) && !jogo.hunters.has(e.atacante)) continue;
    if (e.tipo === 'ferimento' && jogo.hunters.has(e.id)) anotar(jogo, e.id, `ferido (${e.regiao}, −${Math.round(e.dano ?? 0)})`, 'perigo');
    if (e.tipo === 'ferimento' && jogo.hunters.has(e.atacante)) anotar(jogo, e.atacante, `acertou ${e.id} (${e.regiao})`, 'combate');
    if (e.tipo === 'morte' && jogo.hunters.has(e.id)) anotar(jogo, e.id, `MORTO (${e.causa ?? 'ferimentos'}) — morte permanente`, 'morte');
    if (e.tipo === 'hunter_incapacitado') anotar(jogo, e.id, 'incapacitado', 'perigo');
  }
}

// ------------------------------------------------------------------ salvar / restaurar
// Cada região salva o mundo do lab sem a grade (refeita dos GLBs na carga) e a janela.
export function salvarJogo(jogo) {
  const R0 = [...jogo.regioes.values()][0], fora = [...jogo.estrategicos.values()];
  // Hunters em viagem entram temporariamente na primeira região (coordenadas locais dela) para o save do lab.
  for (const a of fora) deslocar(a, R0.X0 - QUADRO.x0, R0.Z0 - QUADRO.z0);
  R0.m.vivos.push(...fora); R0.m.hunters.push(...fora); R0.m.animais.push(...fora);
  let regioes;
  try {
    regioes = [...jogo.regioes.values()].map((R) => {
      const s = salvarMundoHunters(R.m); s.eco.terreno = null; s.eco.cinzas = null;
      return { id: R.id, X0: R.X0, Z0: R.Z0, L: R.L, P: R.P, lidoN: R.lidoN, monstros: R.m.animais.filter((a) => a.monstro).map((a) => a.id), dormentes: R.m.animais.filter((a) => a.dormente).map((a) => a.id), mundo: s };
    });
  } finally {
    R0.m.vivos = R0.m.vivos.filter((a) => !fora.includes(a)); R0.m.hunters = R0.m.hunters.filter((a) => !fora.includes(a)); R0.m.animais = R0.m.animais.filter((a) => !fora.includes(a));
    for (const a of fora) deslocar(a, -(R0.X0 - QUADRO.x0), -(R0.Z0 - QUADRO.z0));
  }
  return { versao: 'wildhaven-v023-1', salvoEm: new Date().toISOString(), semente: jogo.semente, seq: jogo.seq, t: jogo.t, tick: jogo.tick, cenario: jogo.cen, vila: jogo.vila, toca: jogo.toca, regioes, R0: R0.id,
    hunters: [...jogo.hunters.values()].map((e) => structuredClone({ ...e, ordemLivre: null, rota: null })), log: jogo.log };
}
// Carga: as grades vêm do provedor (`terrenos`: id da região → terreno montado com a janela salva).
export function janelasDoSave(salvo) { return salvo.regioes.map((r) => ({ id: r.id, X0: r.X0, Z0: r.Z0, L: r.L, P: r.P })); }
export function carregarJogo(cfg, salvo, { fichaHunter, equipamentos, G, provedor, terrenos }) {
  const jogo = { cfg, recursos: { fichaHunter, equipamentos }, semente: salvo.semente, G, cen: salvo.cenario, provedor, regioes: new Map(), seq: salvo.seq, t: salvo.t, tick: salvo.tick,
    vila: salvo.vila, toca: salvo.toca, hunters: new Map(), estrategicos: new Map(), log: salvo.log ?? [], pendentes: [] };
  const cen = { ...salvo.cenario };
  for (const r of salvo.regioes) {
    const t = terrenos.get(r.id), n = (r.L / t.res) * (r.P / t.res);
    const eco = { ...r.mundo.eco, terreno: { largura: 4, profundidade: 4, res: 1, alturas: '', agua: '', cobertura: '', bloqueio: '', vegetacao: '', vegetacaoMax: '' }, cinzas: [] };
    // carregarMundo exige um terreno serializado: um 4 × 4 vazio serve de casca; a grade real entra logo depois.
    const casca = { largura: 4, profundidade: 4, res: 1, alturas: b64(new Float32Array(16)), agua: b64(new Float32Array(16)), cobertura: b64(new Uint8Array(16)), bloqueio: b64(new Uint8Array(16)), vegetacao: b64(new Float32Array(16)), vegetacaoMax: b64(new Float32Array(16)) };
    eco.terreno = casca; eco.cinzas = new Array(16).fill(0);
    const m = carregarMundoHunters({ ...cfg, cenarios: { ...cfg.cenarios, [cen.id]: { ...cen, populacoes: [] } } }, { ...r.mundo, eco }, { fichaHunter, equipamentos });
    m.terreno = t; m.terreno.cinzas = new Float32Array(n); m.pontosAgua = []; m.opcoes.maxEventos = 20000;
    for (const id of r.monstros) { const a = m.porId.get(id); if (a) { a.especie = fichaMonstro(cfg.especies.varrisco); a.comandoTeste = decidirMonstro; } }
    for (const id of r.dormentes) { const a = m.porId.get(id); if (a) { m.vivos = m.vivos.filter((x) => x !== a); m.porId.delete(id); a.dormente = true; } }
    jogo.regioes.set(r.id, { id: r.id, X0: r.X0, Z0: r.Z0, L: r.L, P: r.P, lidoN: r.lidoN, m });
  }
  const R0 = jogo.regioes.get(salvo.R0);
  for (const e of salvo.hunters) {
    jogo.hunters.set(e.id, e);
    if (e.modo === 'estrategico') {
      const a = R0.m.porId.get(e.id);
      R0.m.vivos = R0.m.vivos.filter((x) => x !== a); R0.m.hunters = R0.m.hunters.filter((x) => x !== a); R0.m.animais = R0.m.animais.filter((x) => x !== a); R0.m.porId.delete(e.id);
      deslocar(a, -(R0.X0 - QUADRO.x0), -(R0.Z0 - QUADRO.z0)); jogo.estrategicos.set(e.id, a);
    }
    const ator = atorDe(jogo, e.id); if (ator?.hunter) iniciarEstadoRegras(e, ator);
  }
  return jogo;
}
const b64 = (typed) => { const u = new Uint8Array(typed.buffer); let s = ''; for (const c of u) s += String.fromCharCode(c); return typeof btoa === 'function' ? btoa(s) : Buffer.from(u).toString('base64'); };

// Eventos de todas as regiões (para registros e testes). As regiões numeram eventos de forma independente.
export const todosEventos = (jogo) => [...jogo.regioes.values()].flatMap((R) => R.m.eventos);
export const varrisco = (jogo) => { for (const R of jogo.regioes.values()) { const a = R.m.animais.find((x) => x.especie.id === 'varrisco'); if (a) return { a, R, vivo: a.vivo && !R.m.mortos.has(a.id) }; } return null; };
