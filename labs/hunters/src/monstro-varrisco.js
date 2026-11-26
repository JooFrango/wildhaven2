// Varrisco como monstro de caçada (linha MH, ?pve1=1&pve2=1&mh=1). Desligado, nada aqui roda.
// Ligado, o Varrisco do Hunter Lab decide pelo `comandoTeste` do núcleo (mundo.js), então a tática ecológica
// (recuar dentro de tooClose) e o conflito ecológico (`cedeu`) não decidem por ele. O golpe continua físico:
// `iniciarAtaque`/`resolverGolpe` do núcleo medem alcance, esquiva, região e dano. Este módulo só escolhe
// QUAL golpe e QUANDO, e mantém raiva, cansaço, queda, vacilo, rugido e alvo.
import {iniciarAtaque, resolverGolpe, capsula} from '../../ia-criaturas/src/eco/combate.js';
import {atan2, cos, sen} from '../../ia-criaturas/src/core/matematica.js';
import {normalizarAngulo} from '../../ia-criaturas/src/core/geometria.js';
import {foraDeCombate} from './hunter.js';

let ligado = false;
export function usarMonstro(v) {ligado = !!v;}
export const monstroLigado = () => ligado;

// v06 = v05 aprovada + 4 golpes novos (aprovados em 2026-11-20).
export const GLB_MONSTRO = 'assets/models/creatures/varrisco/v06/varrisco-animated-v06-LOD0.glb';
const REG = ['torax', 'abdomen', 'bracos', 'pescoco', 'pernas', 'tronco', 'flanco'];
// Golpes do moveset. Tempos do GLB v05/v06 (extras.janelasSeg/contactFraction); alcance medido no mesmo GLB por
// labs/ia-criaturas/scripts/anatomia-glb.mjs (unidades do modelo). dMin/dMax: distância entre centros (m);
// ang/angMin: faixa do desvio do alvo em relação à frente (rad); lado: 1 = alvo à esquerda, -1 = à direita;
// varredura: o contato vale na direção do alvo ('frente') ou com a cauda para ele ('tras');
// passo/recuo: deslocamento do corpo no golpe (m; o recuo vem depois do impacto); saltos: instantes dos impulsos (s do clipe);
// angAcerto: a cauda só varre os lados e a traseira (Hunter à frente: o golpe erra, vale só o recuo);
// corpo: membro sob o peito (garras, chute) — só alcança com os corpos encostados (ver contatoCorpo); soRaiva; recExtra: punição extra.
const GOLPES = {
  mordida:         {clipe: 'bite',        dur: 1.00, tImp: .40, alc: 1.363, alt: .968,  dano: 5,  recargaSeg: 1.4, dMin: 1.0, dMax: 2.4, ang: .55, peso: 3},
  garra_foice:     {clipe: 'claw_right',  dur: 1.00, tImp: .42, alc: .716,  alt: 1.057, dano: 3,  recargaSeg: 1.2, dMin: 0,   dMax: 2.0, ang: .7, peso: 3, passo: 1.1, corpo: true, combo: 'garra_dupla'},
  garra_dupla:     {clipe: 'double_claw', dur: 1.20, tImp: .50, alc: .691,  alt: .788,  dano: 4,  recargaSeg: 2.5, dMin: 0,   dMax: 2.1, ang: .7, peso: 0, passo: 1.1, corpo: true},
  mordida_pesada:  {clipe: 'bite_heavy',  dur: 1.60, tImp: .90, alc: 1.427, alt: .967,  dano: 8,  recargaSeg: 4.0, dMin: 1.3, dMax: 2.8, ang: .45, peso: 1.5},
  bote:            {clipe: 'pounce',      dur: 1.30, tImp: .72, alc: 1.429, alt: 1.536, dano: 8,  recargaSeg: 6.0, dMin: 3.4, dMax: 7.5, ang: .35, peso: 2.5},
  investida:       {clipe: 'body_slam',   dur: 1.46, tImp: .80, alc: 1.387, alt: .994,  dano: 7,  recargaSeg: 5.0, dMin: 2.4, dMax: 5.5, ang: .45, peso: 1.5},
  chicotada_cauda: {clipe: 'tail_sweep',  dur: 1.40, tImp: .62, alc: -1.80, alt: 1.118, dano: 6,  recargaSeg: 3.5, dMin: 0,   dMax: 2.3, ang: Math.PI, peso: 0, varredura: 'tras'},
  // v06 — alcance do chute estimado pelo alvo do tornozelo no clipe (não medido por anatomia-glb, que não reconhece o pé como arma).
  chute_garra:      {clipe: 'sickle_kick',   dur: 1.20, tImp: .54, alc: .62,   alt: .45,   dano: 5,  recargaSeg: 4.0,  dMin: 0,   dMax: 2.5,  ang: .5, peso: 2, passo: 1.3, corpo: true},
  mordida_giro_esq: {clipe: 'bite_turn_l',   dur: 1.00, tImp: .38, alc: 1.3,   alt: .968,  dano: 6,  recargaSeg: 2.5,  dMin: 0,   dMax: 1.75, ang: 1.7, angMin: .6, lado: 1, varredura: 'frente', peso: 3},
  mordida_giro_dir: {clipe: 'bite_turn_r',   dur: 1.00, tImp: .38, alc: 1.3,   alt: .968,  dano: 6,  recargaSeg: 2.5,  dMin: 0,   dMax: 1.75, ang: 1.7, angMin: .6, lado: -1, varredura: 'frente', peso: 3},
  bote_triplo:      {clipe: 'pounce_chain',  dur: 2.60, tImp: 1.80, alc: 1.429, alt: 1.4,  dano: 14, recargaSeg: 14.0, dMin: 3.5, dMax: 11,   ang: .5, peso: 3, soRaiva: true, saltos: [.45, .95, 1.45], recExtra: .75},
  rabada_recuo:     {clipe: 'backstep_tail', dur: 1.10, tImp: .44, alc: -2.0,  alt: 1.118, dano: 6,  recargaSeg: 4.0,  dMin: 0,   dMax: 2.4,  ang: Math.PI, angAcerto: .9, varredura: 'tras', recuo: 1.6, peso: 1},
};
const AJUSTE = {
  hpMultiplicador: 5,            // monstro de caçada: a luta dura minutos, não 30 s
  pausa: [2.2, 3.8], pausaRaiva: [1.2, 2.2], pausaCansado: [3.5, 5.0],
  reposicionar: {chance: .3, distancia: 5.5, maxSeg: 2.5}, // recua para abrir espaço e voltar de bote/investida
  raiva: {danoPct: .30, duracao: 30, dano: 1.2}, // preparo × 0,75 via `contra` do núcleo
  cansaco: {duracao: 15, velMax: 2.2, recuperacaoExtra: .7},
  rugido: {raio: 9, atordoa: 1.0, dur: 2.0, ativo: [.6, 1.6]},
  queda: {pernas: 3, danoPct: .35, duracao: 3.0}, vacilo: {cabeca: 5, duracao: .8}, // partes: acertos; queda também por dano acumulado
  fuga: {hpPct: .2, duracao: 7},
  trocaAlvoSeg: 6,
};
const sorteio = (a, [lo, hi]) => lo + (hi - lo) * a.rngCombate.proximo();

// Modelo 3D da linha MH: GLB v06 e clipe de cada golpe novo (o Animal3D toca `modelo.clipes[golpe.nome]`).
export const modeloMonstro = (m) => ({...m, glb: GLB_MONSTRO, clipes: {...m.clipes, ...Object.fromEntries(Object.entries(GOLPES).map(([nome, g]) => [nome, g.clipe]))}});

// Ficha clonada: ataques e anatomia do moveset v05/v06. O núcleo lê `combate.ataques` e `anatomia.ataques`.
export function fichaMonstro(especie) {
  const e = structuredClone(especie);
  e.modelo = modeloMonstro(e.modelo);
  e.combate.ataques = Object.entries(GOLPES).map(([nome, g]) => ({nome, alcance: Math.abs(g.alc) * (e.escalaModelo ?? 1), dano: g.dano, preparoSeg: g.tImp, recargaSeg: g.recargaSeg, regioes: REG, clipe: g.clipe}));
  e.anatomia = {...(e.anatomia ?? {}), ataques: Object.fromEntries(Object.entries(GOLPES).map(([nome, g]) =>
    [nome, {clipe: g.clipe, duracao: g.dur, tImpacto: g.tImp, alcance: g.alc, sentido: g.alc < 0 ? 'tras' : 'frente', alturaImpacto: g.alt, avancoNoClipe: 0}]))};
  e.combate.agarrar = false; // o rig v13 do Hunter não tem reação de agarrado
  e.combate.esquiva = 0;     // monstro não esquiva o golpe do Hunter (a esquiva ecológica disparava contra-ataques fora do ritmo)
  return e;
}

export function instalarMonstro(mundo) {
  if (!ligado) return;
  for (const a of mundo.animais.filter((x) => x.especie.id === 'varrisco' && x.vivo)) {
    a.especie = fichaMonstro(a.especie);
    a.saude.hpMax *= AJUSTE.hpMultiplicador; a.saude.hp = a.saude.hpMax;
    a.monstro = {fase: 'espreita', alvo: null, trocaEm: -1e9, ameaca: {}, ultimoN: mundo.eventos.at(-1)?.n ?? 0, proximoGolpe: 0, combo: null,
      raivaAte: -1, cansadoAte: -1, danoDesdeRaiva: 0, danoDesdeQueda: 0, pernas: 0, cabeca: 0, fugiu: false, fugaAte: -1, rugido: null, janela: null};
    a.comandoTeste = decidirMonstro;
    mundo.evento('monstro_instalado', a.id, {hpMax: +a.saude.hpMax.toFixed(0)});
  }
}

// Lê os eventos do núcleo desde a última decisão: dano recebido (raiva, ameaça), partes atingidas (queda/vacilo).
function lerEventos(a, mundo) {
  const s = a.monstro, t = mundo.t, ev = mundo.eventos;
  // Pelo número do evento (n), não pelo índice: o núcleo descarta os mais antigos quando a lista enche.
  let i = ev.length; while (i > 0 && ev[i - 1].n > s.ultimoN) i--;
  s.ultimoN = ev.at(-1)?.n ?? s.ultimoN;
  for (; i < ev.length; i++) {
    const e = ev[i];
    if (e.tipo !== 'ferimento' || e.id !== a.id) continue;
    s.danoDesdeRaiva += e.dano ?? 0; s.danoDesdeQueda += e.dano ?? 0;
    s.ameaca[e.atacante] = (s.ameaca[e.atacante] ?? 0) + (e.dano ?? 0);
    if (e.regiao === 'pernas' || e.regiao === 'cauda') s.pernas++;
    if (e.regiao === 'cabeca' || e.regiao === 'pescoco') s.cabeca++;
  }
  for (const k of Object.keys(s.ameaca)) s.ameaca[k] *= .995; // ameaça esquece devagar (~14 s de meia-vida a 20 Hz)
}

function escolherAlvo(a, mundo) {
  const s = a.monstro, t = mundo.t;
  const vivos = mundo.hunters.filter((h) => h.vivo && !foraDeCombate(h));
  if (!vivos.length) return null;
  const nota = (h) => (s.ameaca[h.id] ?? 0) + 12 / (1 + Math.hypot(h.x - a.x, h.y - a.y));
  const atual = vivos.find((h) => h.id === s.alvo);
  const melhor = vivos.reduce((m, h) => (nota(h) > nota(m) ? h : m));
  if (!atual || (melhor !== atual && t - s.trocaEm > AJUSTE.trocaAlvoSeg && nota(melhor) > 1.3 * nota(atual))) {
    if (s.alvo !== melhor.id) {s.trocaEm = t; mundo.evento('monstro_alvo', a.id, {alvo: melhor.id});}
    s.alvo = melhor.id; return melhor;
  }
  return atual;
}

function golpe(a, alvo, nome, mundo) {
  const s = a.monstro, g = GOLPES[nome], base = a.especie.combate.ataques.find((x) => x.nome === nome);
  const raiva = mundo.t < s.raivaAte;
  const ataque = raiva ? {...base, dano: base.dano * AJUSTE.raiva.dano} : base;
  iniciarAtaque(a, alvo, ataque, mundo, {contra: raiva}); // contra: preparo × 0,75 (o clipe toca mais rápido)
  const imp = a.golpe.impacto, k = (imp - mundo.t) / g.tImp; // k < 1 na raiva: o clipe toca mais rápido
  const fim = imp + (g.dur - g.tImp) * (raiva ? .8 : 1) + (g.recExtra ?? 0) + (mundo.t < s.cansadoAte ? AJUSTE.cansaco.recuperacaoExtra : 0);
  if (g.varredura) a.impulso = null; // giro e rabada não avançam o corpo
  s.recuo = g.recuo ? {em: imp, dist: g.recuo} : null;
  s.saltos = g.saltos ? g.saltos.map((x) => mundo.t + x * k) : null; s.kSaltos = k;
  // Garra: braço curto (mão a ~0,7 m do centro); o golpe leva o corpo junto num passo de até 1,1 m.
  if (g.passo) {
    const passo = Math.max(.3, Math.min(g.passo, Math.hypot(alvo.x - a.x, alvo.y - a.y) - 1.15)), v = passo / Math.max(.15, imp - mundo.t);
    a.impulso = {vx: cos(a.direcao) * v, vy: sen(a.direcao) * v, ate: imp, tipo: 'passo_ataque'};
  }
  // A ação tática do núcleo vira o clipe inteiro: o Hunter lê `recuperacao` até o fim e pode punir.
  if (a.tatica?.action) a.tatica.action.end = fim;
  s.janela = {ataque: nome, de: imp + .05, ate: fim};
  s.ocupadoAte = fim;
  s.proximoGolpe = fim + sorteio(a, raiva ? AJUSTE.pausaRaiva : mundo.t < s.cansadoAte ? AJUSTE.pausaCansado : AJUSTE.pausa);
  s.combo = g.combo && a.rngCombate.chance(raiva ? .85 : .6) ? g.combo : null;
  const R = AJUSTE.reposicionar;
  s.repos = !s.combo && mundo.t >= s.cansadoAte && a.rngCombate.chance(R.chance) ? {ate: fim + R.maxSeg} : null;
  // Hunter colado ao abrir distância: começa pelo salto para trás com rabada.
  if (s.repos && nome !== 'rabada_recuo' && Math.hypot(alvo.x - a.x, alvo.y - a.y) < 2.4 && !((a.recargas.rabada_recuo ?? 0) > 0) && a.rngCombate.chance(.25)) s.combo = 'rabada_recuo';
  mundo.evento('monstro_golpe', a.id, {ataque: nome, alvo: alvo.id, raiva, cansado: mundo.t < s.cansadoAte, janela: [+s.janela.de.toFixed(2), +fim.toFixed(2)]});
  return {estado: 'atacando', codigo: 'monstro_' + nome, motivo: `${nome}${raiva ? ' (raiva)' : ''}`, alvo: {tipo: 'criatura', id: alvo.id, x: alvo.x, y: alvo.y}, destino: null, ritmo: 'parado', acao: nome, olharPara: {x: alvo.x, y: alvo.y}};
}

// Corpo a corpo (garras e chute): o braço e o pé ficam sob o peito, atrás da frente da cápsula única do corpo,
// então pelo ponto do membro nunca encostariam. Com os corpos encostados (folga < 0,25 m) e o Hunter à frente,
// o membro alcança: o golpe é resolvido pelo núcleo com o alcance até a superfície do Hunter, só neste impacto.
function folgaCorpos(a, b) {
  const A = capsula(a), B = capsula(b);
  let min = Infinity;
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
    const u = -A.meio + A.meio * i / 4, w = -B.meio + B.meio * j / 4;
    min = Math.min(min, Math.hypot(A.cx + A.ux * u - B.cx - B.ux * w, A.cy + A.uy * u - B.cy - B.uy * w) - A.r - B.r);
  }
  return min;
}
function contatoCorpo(a, alvo, linha, ang, mundo) {
  const an = a.especie.anatomia.ataques[a.golpe.nome], esc = (a.especie.escalaModelo ?? 1) * a.escala;
  a.golpe.impacto = mundo.t;
  if (ang > 1.0 || folgaCorpos(a, alvo) > .25) return resolverGolpe(a, mundo); // longe: o núcleo registra o erro
  const alc = an.alcance, dir = a.direcao;
  an.alcance = Math.max(alc, Math.hypot(alvo.x - a.x, alvo.y - a.y) / esc); a.direcao = linha;
  resolverGolpe(a, mundo);
  an.alcance = alc; a.direcao = dir;
}

function rugir(a, mundo, motivo) {
  const s = a.monstro, t = mundo.t, R = AJUSTE.rugido;
  s.rugido = {de: t, ate: t + R.dur, atingiu: false, motivo};
  s.ocupadoAte = t + R.dur; s.proximoGolpe = t + R.dur + .2;
  if (a.tatica) a.tatica.action = {name: 'rugido', start: t, impact: t + R.ativo[0], end: t + R.dur, reach: R.raio, heading: a.direcao};
  mundo.evento('monstro_rugido', a.id, {motivo});
}

function parado(a, alvo, estado, motivo, extra = {}) {
  return {estado, codigo: 'monstro_' + estado, motivo, alvo: alvo ? {tipo: 'criatura', id: alvo.id, x: alvo.x, y: alvo.y} : null, destino: null, ritmo: 'parado', ...extra};
}

export function decidirMonstro(a, mundo) {
  if (!ligado || !a.monstro) return null;
  const s = a.monstro, t = mundo.t;
  lerEventos(a, mundo);
  a.energia = Math.max(a.energia, 45); a.fome = Math.min(a.fome, 60); // fôlego do monstro é o cansaço abaixo
  const alvo = escolherAlvo(a, mundo);
  if (!alvo) return null;
  // Espreita até ver um Hunter; ao ver, rugido de abertura.
  if (s.fase === 'espreita') {
    if (!a.contatos.some((k) => k.id === alvo.id && k.via === 'visao')) return null;
    s.fase = 'combate'; mundo.evento('monstro_aggro', a.id, {alvo: alvo.id});
    rugir(a, mundo, 'avistou');
  }
  // Rugido em curso: na janela ativa atordoa quem estiver perto, uma vez.
  if (s.rugido && t < s.rugido.ate) {
    const R = AJUSTE.rugido;
    if (!s.rugido.atingiu && t >= s.rugido.de + R.ativo[0]) {
      s.rugido.atingiu = true;
      for (const h of mundo.hunters) if (h.vivo && !foraDeCombate(h) && Math.hypot(h.x - a.x, h.y - a.y) < R.raio && !(h.hunter?.dodgeUntil > t)) {
        h.saude.atordoadoAte = Math.max(h.saude.atordoadoAte ?? 0, t + R.atordoa);
        mundo.evento('monstro_rugido_atordoou', h.id, {por: a.id});
      }
    }
    return parado(a, alvo, 'rugindo', 'rugido', {olharPara: {x: alvo.x, y: alvo.y}});
  }
  s.rugido = null;
  // Vacilo (cabeça) e queda (pernas): partes acumuladas cancelam o golpe e abrem janela grande.
  if (s.cabeca >= AJUSTE.vacilo.cabeca) {
    s.cabeca = 0; a.golpe = null; s.ocupadoAte = t + AJUSTE.vacilo.duracao; s.proximoGolpe = s.ocupadoAte + .3; s.combo = null;
    s.janela = {ataque: 'vacilo', de: t, ate: s.ocupadoAte};
    a.saude.desequilibradoAte = Math.max(a.saude.desequilibradoAte ?? 0, s.ocupadoAte);
    mundo.evento('monstro_vacilo', a.id, {});
  }
  if (s.pernas >= AJUSTE.queda.pernas || s.danoDesdeQueda >= AJUSTE.queda.danoPct * a.saude.hpMax) {
    s.pernas = 0; s.danoDesdeQueda = 0; a.golpe = null; s.combo = null;
    a.saude.caidoAte = t + AJUSTE.queda.duracao; s.ocupadoAte = a.saude.caidoAte + .4; s.proximoGolpe = s.ocupadoAte + .3;
    s.janela = {ataque: 'queda', de: t, ate: a.saude.caidoAte};
    mundo.evento('monstro_queda', a.id, {ate: +a.saude.caidoAte.toFixed(2)});
    return null; // caído: o núcleo cuida do corpo
  }
  // Raiva por dano acumulado; ao acabar, cansaço.
  if (t >= s.raivaAte && s.raivaAte > 0 && s.cansadoAte < s.raivaAte) {
    s.cansadoAte = t + AJUSTE.cansaco.duracao; mundo.evento('monstro_cansado', a.id, {ate: +s.cansadoAte.toFixed(1)});
  }
  if (t >= s.raivaAte && t >= s.cansadoAte && s.danoDesdeRaiva >= AJUSTE.raiva.danoPct * a.saude.hpMax && !a.golpe) {
    s.danoDesdeRaiva = 0; s.raivaAte = t + AJUSTE.raiva.duracao + AJUSTE.rugido.dur;
    mundo.evento('monstro_raiva', a.id, {ate: +s.raivaAte.toFixed(1)});
    rugir(a, mundo, 'raiva');
    return parado(a, alvo, 'rugindo', 'rugido de raiva', {olharPara: {x: alvo.x, y: alvo.y}});
  }
  // Fuga mancando uma vez, ferido: afasta-se e volta furioso.
  if (!s.fugiu && a.saude.hp < AJUSTE.fuga.hpPct * a.saude.hpMax && !a.golpe) {
    s.fugiu = true; s.fugaAte = t + AJUSTE.fuga.duracao; s.danoDesdeRaiva = AJUSTE.raiva.danoPct * a.saude.hpMax;
    mundo.evento('monstro_fuga', a.id, {ate: +s.fugaAte.toFixed(1)});
  }
  const dx = alvo.x - a.x, dy = alvo.y - a.y, d = Math.hypot(dx, dy), linha = atan2(dy, dx);
  const rel = normalizarAngulo(linha - a.direcao), ang = Math.abs(rel); // rel > 0: Hunter à esquerda do monstro
  if (t < s.fugaAte) return {estado: 'mancando', codigo: 'monstro_fuga', motivo: 'ferido, recua mancando', alvo: null,
    destino: {x: a.x - cos(linha) * 6, y: a.y - sen(linha) * 6}, ritmo: 'andar', velMax: 1.0};
  // Golpe em curso ou recuperação: comprometido, sem girar (é a janela do Hunter).
  if (a.golpe || t < (s.ocupadoAte ?? 0)) {
    if (!a.golpe && s.combo && t >= (s.ocupadoAte ?? 0) - .25 && d <= GOLPES[s.combo].dMax && ang <= GOLPES[s.combo].ang) {
      const c = s.combo; s.combo = null; return golpe(a, alvo, c, mundo);
    }
    // Varredura (rabadas, mordida giratória): o membro passa por todo o arco; o contato vale na direção do Hunter.
    const gg = a.golpe && GOLPES[a.golpe.nome], vg = gg?.varredura;
    if (vg && t + mundo.dt >= a.golpe.impacto) {
      const dir = a.direcao; a.golpe.impacto = t;
      if (ang >= (gg.angAcerto ?? 0)) a.direcao = normalizarAngulo(vg === 'tras' ? linha + Math.PI : linha);
      resolverGolpe(a, mundo); a.direcao = dir;
    }
    if (gg?.corpo && t + mundo.dt >= a.golpe.impacto) contatoCorpo(a, alvo, linha, ang, mundo);
    // Rabada em recuo: depois do impacto o corpo salta para longe do Hunter.
    if (s.recuo && t >= s.recuo.em) {
      const v = s.recuo.dist / .3; s.recuo = null;
      a.impulso = {vx: -cos(linha) * v, vy: -sen(linha) * v, ate: t + .3, tipo: 'passo_ataque'};
    }
    // Salto triplo: cada salto relança o corpo rumo ao Hunter (re-mira entre os pousos).
    if (a.golpe && s.saltos?.length && t >= s.saltos[0]) {
      s.saltos.shift();
      // Voo de 0,35 s do clipe (mais curto na raiva) e nunca além do impacto: o último salto termina na boca.
      const voo = Math.max(.12, Math.min(.35 * s.kSaltos, a.golpe.impacto - t)), v = Math.min(3.2, Math.max(1.2, d - (s.saltos.length ? 1.6 : 1.0))) / voo;
      a.impulso = {vx: cos(linha) * v, vy: sen(linha) * v, ate: t + voo, tipo: 'investida'};
    }
    const preparo = a.golpe && (s.saltos?.length || t < a.golpe.inicio + (a.golpe.impacto - a.golpe.inicio) * .5);
    return parado(a, alvo, a.golpe ? 'preparando' : 'recuperando', a.golpe ? `preparo de ${a.golpe.nome}` : 'recuperação (janela)', preparo ? {olharPara: {x: alvo.x, y: alvo.y}} : {});
  }
  s.combo = null;
  // Reposiciona: dá as costas e trota para longe, para voltar de bote ou investida.
  if (s.repos && t < s.repos.ate && d < AJUSTE.reposicionar.distancia) return {estado: 'reposicionando', codigo: 'monstro_reposiciona', motivo: 'abre distância',
    alvo: {tipo: 'criatura', id: alvo.id, x: alvo.x, y: alvo.y}, destino: {x: alvo.x - cos(linha) * (AJUSTE.reposicionar.distancia + 1), y: alvo.y - sen(linha) * (AJUSTE.reposicionar.distancia + 1)}, ritmo: 'trote'};
  if (s.repos) {s.repos = null; s.proximoGolpe = Math.min(s.proximoGolpe, t);}
  // Escolha: golpes possíveis por distância e ângulo, ponderados; recargas do núcleo valem.
  const raiva = t < s.raivaAte, cansado = t < s.cansadoAte;
  if (t >= s.proximoGolpe) {
    const op = [];
    for (const [nome, g] of Object.entries(GOLPES)) {
      if ((a.recargas[nome] ?? 0) > 0 || d < g.dMin || d > g.dMax || ang > g.ang || ang < (g.angMin ?? 0)) continue;
      if ((g.lado && Math.sign(rel) !== g.lado) || (g.soRaiva && !raiva)) continue;
      if (cansado && (nome === 'bote' || nome === 'investida' || nome === 'chute_garra')) continue;
      let p = g.peso;
      if (nome === 'chicotada_cauda') p = ang > 2.2 ? 4 : ang > 1.6 ? 1.5 : 0; // bem atrás: giro de 360°; no flanco traseiro prefere a rabada em recuo
      if (nome === 'mordida_pesada' && raiva) p += 1.5;
      if (p > 0) op.push([nome, p]);
    }
    if (op.length) {
      let r = a.rngCombate.proximo() * op.reduce((x, [, p]) => x + p, 0);
      for (const [nome, p] of op) if ((r -= p) <= 0) return golpe(a, alvo, nome, mundo);
      return golpe(a, alvo, op.at(-1)[0], mundo);
    }
  }
  // Movimento: fecha a distância de frente; colado e desalinhado, gira no lugar (vira a cauda ou a boca para ele).
  const perto = 1.9;
  if (d > perto) {
    const ritmo = cansado ? 'andar' : d > 6 ? 'corrida' : 'trote';
    return {estado: 'perseguindo', codigo: 'monstro_aproxima', motivo: `aproxima (${d.toFixed(1)} m)`, alvo: {tipo: 'criatura', id: alvo.id, x: alvo.x, y: alvo.y},
      destino: {x: alvo.x - cos(linha) * (perto - .2), y: alvo.y - sen(linha) * (perto - .2)}, ritmo, velMax: cansado ? AJUSTE.cansaco.velMax : null, olharPara: {x: alvo.x, y: alvo.y}};
  }
  // Colado e parado, não persegue o Hunter com o olhar: só vira quando ele passa para trás (atraso de giro). Assim o
  // flanco fica aberto para a mordida giratória e as rabadas, em vez de o monstro encarar o tempo todo.
  return parado(a, alvo, cansado ? 'ofegante' : 'encarando', cansado ? 'cansado' : 'encara o Hunter', ang > 2.0 ? {olharPara: {x: alvo.x, y: alvo.y}} : {});
}
