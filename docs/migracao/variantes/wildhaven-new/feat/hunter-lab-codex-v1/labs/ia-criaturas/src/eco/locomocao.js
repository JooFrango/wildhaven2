// Locomoção no terreno 3D (V3).
// - Caminho A* por espécie com margem corporal (animal grande precisa de mais espaço) e suavização com folga.
// - Seguimento com antecipação: sonda à frente e desvia antes de encostar em água funda, rocha ou paredão.
// - Separação entre criaturas (direção) + resolução de sobreposição (mundo.js): corpos não se atravessam.
// - Giro limitado que diminui com a velocidade, frenagem antes de curvas fechadas e giro no lugar quando lento.
// - Bloqueio físico preservado: nunca entra em célula intransponível; se a célula atual ficar intransponível
//   (a água subiu), sai pela vizinha transitável mais próxima.
import { atan2, cos, sen } from '../core/matematica.js';
import { limitar, normalizarAngulo } from '../core/geometria.js';
import { altura, buscarCaminho, celulaPassavelProxima, centro, folga, indice, perfilMobilidade, segmentoLivre } from './terreno.js';
import { fatorMobilidade } from './saude.js';
import { capsulaContra } from './combate.js';
import { vizinhos } from './grade.js';

// Reaproveitado entre chamadas de `separacao`: evita alocar um array por animal por passo.
const perto = [];
import { aplicarAltura, naSuperficie, separadosNaVertical } from './subsolo.js';

export const raioCorpo = (a) => a.especie.corpo.raio * a.escala;

export function velocidadeMaxima(a, ritmo) {
  if (ritmo === 'parado') return 0;
  const m = a.especie.movimento;
  let v = (m[ritmo] ?? m.andar) * a.atributos.velocidade * fatorMobilidade(a);
  if (a.juvenil) v *= 0.55 + 0.45 * a.crescimento;
  v *= a.climaLocomocao ?? 1;
  if (a.energia <= a.especie.necessidades.limiteExaustao) v = Math.min(v, m.andar);
  if (ritmo === 'corrida' && a.folego <= 0) v = Math.min(v, m.trote * fatorMobilidade(a));
  // Senescência: idosos perdem velocidade.
  if (a.idadeAnos > a.especie.vida.expectativaAnos * 0.75) v *= 0.85;
  return v;
}

// Destinos que a própria experiência mostrou inacessíveis (caminho parcial que terminou longe do alvo).
export function destinoInacessivel(a, p, t) {
  const l = a.mente.inacessiveis;
  if (!l) return false;
  return l.some((q) => t - q.t < 180 && (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y) < 9);
}

function planejar(a, destino, mundo, perfil, raio) {
  const t = mundo.terreno;
  const zona = raio * 1.5 + 1;
  if (segmentoLivre(t, perfil, a, destino, raio, zona) || segmentoLivre(t, perfil, a, destino, raio * 0.6, zona)) {
    a.caminho = { destino: { ...destino }, pontos: [destino], i: 0, quando: mundo.t, completo: true, direto: true };
    return;
  }
  const r = buscarCaminho(t, perfil, a, destino, { maxExpansoes: 15000, prefereCobertura: a.mente.preferirCobertura ? 0.5 : 0, raio });
  mundo.metricas.buscasCaminho++;
  const pts = r?.pontos.slice(1) ?? [];
  a.caminho = { destino: { ...destino }, pontos: pts.length ? pts : r ? [destino] : [], i: 0, quando: mundo.t, completo: !!r?.completo, direto: false };
  if (r && !r.completo) mundo.evento('caminho_parcial', a.id, { destino: { x: +destino.x.toFixed(1), y: +destino.y.toFixed(1) } });
}

// Ponto a seguir + limite de velocidade pela próxima curva (frenagem antecipada).
function proximoPonto(a, destino, mundo, perfil, raio) {
  const c = a.caminho;
  const dDest = c ? Math.sqrt((c.destino.x - destino.x) * (c.destino.x - destino.x) + (c.destino.y - destino.y) * (c.destino.y - destino.y)) : 0;
  const distAlvo = Math.sqrt((destino.x - a.x) * (destino.x - a.x) + (destino.y - a.y) * (destino.y - a.y));
  const mudou = !c || dDest > Math.max(3, distAlvo * 0.15) || mundo.t - c.quando > (c.direto ? 1.0 : 4.0) || c.invalido;
  if (mudou) planejar(a, destino, mundo, perfil, raio);
  const cc = a.caminho;
  const chegou = (p, r) => (p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y) < r * r;
  while (cc.i < cc.pontos.length - 1 && chegou(cc.pontos[cc.i], Math.max(1.2, raio * 1.5))) cc.i++;
  // Atalho visível: se o ponto seguinte já está livre com folga, pula o atual (curvas mais naturais).
  if (cc.i < cc.pontos.length - 1 && segmentoLivre(mundo.terreno, perfil, a, cc.pontos[cc.i + 1], raio, raio)) cc.i++;
  const p = cc.pontos[cc.i] ?? null;
  // Destino inacessível: caminho parcial e já no fim dele.
  if (p && !cc.completo && cc.i === cc.pontos.length - 1 && chegou(p, 1.5)) {
    (a.mente.inacessiveis ??= []).push({ x: destino.x, y: destino.y, t: mundo.t });
    if (a.mente.inacessiveis.length > 8) a.mente.inacessiveis.shift();
    mundo.evento('destino_inacessivel', a.id, { x: +destino.x.toFixed(1), y: +destino.y.toFixed(1) });
    cc.invalido = true;
    return { ponto: null, freio: 0 };
  }
  let freio = Infinity;
  if (p && cc.i < cc.pontos.length - 1) {
    const q = cc.pontos[cc.i + 1];
    const a1 = atan2(p.y - a.y, p.x - a.x), a2 = atan2(q.y - p.y, q.x - p.x);
    const curva = Math.abs(normalizarAngulo(a2 - a1));
    const m = a.especie.movimento;
    const vCurva = Math.max(m.andar, m.corrida * (1 - curva / Math.PI) * (1 - curva / Math.PI));
    const dp = Math.sqrt((p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y));
    freio = Math.sqrt(vCurva * vCurva + 2 * m.aceleracao * 1.6 * dp);
  }
  return { ponto: p, freio };
}

// Repulsão dos vizinhos próximos (espaço individual). Não repele o alvo que o animal está atacando.
function separacao(a, mundo, raio) {
  let sx = 0, sy = 0;
  const lista = mundo.listaN1 ?? mundo.vivos;
  const alvoId = a.alvo?.tipo === 'criatura' && ['perseguindo', 'atacando', 'combatendo'].includes(a.estado) ? a.alvo.id : null;
  // Raio de consulta: o maior `lim` possível deste animal contra qualquer vizinho (ver o cálculo abaixo).
  const g = mundo.gradeN1?.lista === lista ? mundo.gradeN1 : null;
  const cand = g ? vizinhos(g, a.x, a.y, raio + (mundo.maxRaioCorpo ?? 0) + 0.6 + 0.15 * a.velocidade + (mundo.margemPasso ?? 0), perto) : null;
  const n = cand ? cand.length : lista.length;
  for (let c = 0; c < n; c++) {
    const b = cand ? lista[cand[c]] : lista[c];
    if (b === a || !b.vivo || b.id === alvoId) continue;
    const dx = a.x - b.x, dy = a.y - b.y;
    const rb = raioCorpo(b);
    const familia = b.id === a.maeId || a.id === b.maeId;
    const lim = raio + rb + (familia ? 0.3 : 0.6 + 0.15 * a.velocidade);
    const d2 = dx * dx + dy * dy;
    if (d2 >= lim * lim || d2 < 1e-9) continue;
    const d = Math.sqrt(d2);
    const w = ((lim - d) / lim) * 1.6;
    sx += (dx / d) * w; sy += (dy / d) * w;
  }
  return { x: sx, y: sy };
}

export function mover(a, intencao, mundo, dt) {
  const m = a.especie.movimento;
  const t = mundo.terreno;
  const perfil = perfilMobilidade(t, m);
  const fol = folga(t, perfil);
  const raio = raioCorpo(a);
  medirPreso(a, intencao, mundo);
  let alvoVel = velocidadeMaxima(a, intencao.ritmo);
  const sd = a.saude;
  // Caído ou preso na boca de um predador: não anda (a posição do agarrado é a do agarrão). Desequilibrado: cambaleia.
  if (sd.caidoAte > mundo.t || a.agarradoPor) { a.velocidade = 0; a.velAngular = 0; a.girandoNoLugar = false; aplicarImpulso(a, mundo, dt, perfil); medirPreso(a, null, mundo); gastarEnergia(a, dt); return; }
  if (sd.desequilibradoAte > mundo.t) alvoVel *= 0.35;
  if (intencao.velMax != null) alvoVel = Math.min(alvoVel, intencao.velMax);
  if (a.agarrando) alvoVel = 0; // segurando a presa na boca: só vira, não anda
  // Encostou no corpo do próprio alvo (à frente): acompanha a velocidade dele em vez de empurrá-lo.
  if (intencao.alvo?.tipo === 'criatura' && alvoVel > 0) {
    const o = mundo.porId.get(intencao.alvo.id);
    if (o && o !== a) {
      const pp = pontosMaisProximos(capsulaContra(a, o), capsulaContra(o, a));
      const gap = Math.sqrt((pp.bx - pp.ax) * (pp.bx - pp.ax) + (pp.by - pp.ay) * (pp.by - pp.ay)) - (raioCorpo(a) + raioCorpo(o)) * 0.9;
      const frente = Math.abs(normalizarAngulo(atan2(o.y - a.y, o.x - a.x) - a.direcao)) < 1.0;
      if (gap < 0.35 && frente) alvoVel = Math.min(alvoVel, o.velocidade * Math.max(0, cos(o.direcao - a.direcao)) + Math.max(0, gap) * 2);
    }
  }
  const destino = intencao.destino;
  const kAtual = indice(t, a.x, a.y);
  const encurralado = kAtual >= 0 && !perfil.passavel[kAtual];
  let desejado = null, freio = Infinity, pertoDoFim = false;
  if (encurralado) {
    const k = celulaPassavelProxima(t, perfil.passavel, kAtual, 8);
    if (k >= 0) {
      const c = centro(t, k);
      desejado = atan2(c.y - a.y, c.x - a.x);
      alvoVel = Math.max(alvoVel, m.andar * fatorMobilidade(a));
      if (!a.mente.saiuDeCelulaRuimEm || mundo.t - a.mente.saiuDeCelulaRuimEm > 5) { a.mente.saiuDeCelulaRuimEm = mundo.t; mundo.evento('saindo_celula_intransponivel', a.id, {}); }
    }
  } else if (destino && alvoVel > 0 && Math.sqrt((destino.x - a.x) * (destino.x - a.x) + (destino.y - a.y) * (destino.y - a.y)) > 0.3) {
    const r = proximoPonto(a, destino, mundo, perfil, raio);
    if (r.ponto) {
      a.waypoint = r.ponto;
      desejado = atan2(r.ponto.y - a.y, r.ponto.x - a.x);
      freio = r.freio;
      const dFim = Math.sqrt((destino.x - a.x) * (destino.x - a.x) + (destino.y - a.y) * (destino.y - a.y));
      pertoDoFim = dFim < raio * 2 + 1.5;
      // Chegada a destino parado: desacelera em vez de frear no último instante.
      if (intencao.ritmo !== 'corrida') freio = Math.min(freio, Math.sqrt(2 * m.aceleracao * 1.6 * Math.max(0, dFim - 0.3)) + 0.2);
    } else alvoVel = 0;
  } else {
    a.waypoint = null;
    alvoVel = 0;
    if (intencao.olharPara) desejado = atan2(intencao.olharPara.y - a.y, intencao.olharPara.x - a.x);
  }

  let erro = 0;
  if (desejado !== null) {
    if (alvoVel > 0) {
      // Separação entre criaturas.
      const s = separacao(a, mundo, raio);
      if (s.x || s.y) desejado = atan2(sen(desejado) + s.y, cos(desejado) + s.x);
      // Antecipação de obstáculos: sonda à frente; desvia para o lado livre mais próximo do rumo desejado.
      if (!encurralado) {
        const folAtual = kAtual >= 0 ? fol[kAtual] : 0;
        const alcance = raio + a.velocidade * 0.6 + 0.6;
        const livre = (ang) => {
          for (const f of [0.5, 1]) {
            const k = indice(t, a.x + cos(ang) * alcance * f, a.y + sen(ang) * alcance * f);
            if (k < 0 || !perfil.passavel[k]) return false;
            if (!pertoDoFim && fol[k] < raio * 0.7 && fol[k] < folAtual) return false;
          }
          return true;
        };
        if (!livre(desejado)) {
          let achou = null;
          const lado = normalizarAngulo(desejado - a.direcao) >= 0 ? 1 : -1;
          for (const off of [0.35, 0.7, 1.05, 1.4, 1.75, 2.2, 2.7, Math.PI]) {
            for (const s2 of [lado, -lado]) { const ang = desejado + off * s2; if (livre(ang)) { achou = ang; break; } }
            if (achou !== null) break;
          }
          mundo.metricas.desvios = (mundo.metricas.desvios ?? 0) + 1;
          if (achou !== null) { desejado = achou; alvoVel *= 0.75; }
          else { alvoVel = Math.min(alvoVel, m.andar * 0.4); if (a.caminho) a.caminho.invalido = true; }
        }
      }
    }
    // Giro: taxa máxima cai com a velocidade (animal em sprint faz curva aberta).
    const fracV = limitar(a.velocidade / m.corrida, 0, 1);
    const antes = a.direcao;
    // Corpo longo: a curva tem raio mínimo, então quem está devagar gira pouco e parado não gira no lugar —
    // sem isso o rastro ganha uma quina que o corpo de 15 m não consegue acompanhar.
    const rMin = a.serpente?.enrolando ? null : a.especie.serpente?.raioCurvaturaMinM;
    const taxa = rMin ? Math.min(m.giroGrausSeg, (a.velocidade / rMin) * (180 / Math.PI)) : m.giroGrausSeg * (1 - 0.45 * fracV);
    girar(a, desejado, taxa, dt);
    a.velAngular = normalizarAngulo(a.direcao - antes) / dt;
    erro = Math.abs(normalizarAngulo(desejado - a.direcao));
  } else a.velAngular = 0;

  if (alvoVel > 0) {
    // Corpo longo: nunca para para virar — parada ela não gira (o giro é v/raio), e ficaria travada de costas
    // para o destino. Faz a meia-volta andando devagar, como uma serpente de verdade.
    if (erro > 1.75) alvoVel = a.especie.serpente ? Math.max(alvoVel * (m.fatorCurvaFechada ?? 0.6), m.andar * 0.6) : (a.velocidade < m.andar * 1.2 ? 0 : alvoVel * (m.fatorCurvaFechada ?? 0.6));
    else if (erro > Math.PI / 2) alvoVel *= m.fatorCurvaFechada ?? 0.6;
    else alvoVel *= Math.max(0.35, cos(erro));
    alvoVel = Math.min(alvoVel, freio);
  }
  a.girandoNoLugar = desejado !== null && erro > 0.5 && a.velocidade < m.andar * 0.5 && Math.abs(a.velAngular) > 0.3;
  const acel = m.aceleracao * dt * fatorMobilidade(a);
  a.velocidade = a.velocidade < alvoVel ? Math.min(alvoVel, a.velocidade + acel) : Math.max(alvoVel, a.velocidade - acel * 1.6);
  const nx = a.x + cos(a.direcao) * a.velocidade * dt, ny = a.y + sen(a.direcao) * a.velocidade * dt;
  // Encurralado (célula atual ficou intransponível): pode cruzar células do mesmo tipo só até a saída mais próxima.
  const livre = (x, y) => { const k = indice(t, x, y); return k >= 0 && (perfil.passavel[k] === 1 || encurralado); };
  let px = nx, py = ny;
  if (a.velocidade > 1e-6 && !livre(nx, ny)) {
    mundo.metricas.contatosObstaculo++;
    // Desliza ao longo do obstáculo (só um eixo) antes de parar.
    if (livre(nx, a.y)) py = a.y; else if (livre(a.x, ny)) px = a.x; else px = null;
    if (px === null || Math.abs(px - a.x) + Math.abs(py - a.y) < 1e-6) {
      // Bloqueio físico: não atravessa; perde velocidade e replaneja.
      a.velocidade *= 0.3; a.colisoes++;
      if (a.caminho) a.caminho.invalido = true;
      px = null;
    } else a.velocidade *= 0.85;
  }
  if (px !== null) {
    const dz = altura(t, px, py) - altura(t, a.x, a.y);
    const passo = Math.sqrt((px - a.x) * (px - a.x) + (py - a.y) * (py - a.y));
    const fatorSubida = dz > 0 ? Math.max(0.5, 1 - (dz / Math.max(0.01, passo)) * 0.5) : 1;
    a.x = a.x + (px - a.x) * fatorSubida; a.y = a.y + (py - a.y) * fatorSubida;
  }
  aplicarImpulso(a, mundo, dt, perfil);
  a.x = limitar(a.x, 0.01, t.largura - 0.01); a.y = limitar(a.y, 0.01, t.profundidade - 0.01);
  a.z = altura(t, a.x, a.y);
  gastarEnergia(a, dt);
}

// Deslocamento extra de curta duração: investida do bote, esquiva lateral, empurrão, escape de um agarrão.
// Respeita o bloqueio físico (não atravessa água funda/rocha).
function aplicarImpulso(a, mundo, dt, perfil) {
  const im = a.impulso;
  if (!im) return;
  if (mundo.t > im.ate + 1e-9) { a.impulso = null; return; }
  const t = mundo.terreno;
  // Investida termina ao encostar no corpo do alvo do golpe (aterrissa sobre ele; não o arrasta adiante).
  if (im.tipo === 'investida' && a.golpe) {
    const o = mundo.porId.get(a.golpe.alvo);
    if (o) {
      const pp = pontosMaisProximos(capsulaContra(a, o), capsulaContra(o, a));
      const gap = Math.sqrt((pp.bx - pp.ax) * (pp.bx - pp.ax) + (pp.by - pp.ay) * (pp.by - pp.ay)) - (raioCorpo(a) + raioCorpo(o)) * 0.9;
      if (gap < 0.05) { a.impulso = null; a.velocidade = Math.min(a.velocidade, o.velocidade); return; }
    }
  }
  const nx = a.x + im.vx * dt, ny = a.y + im.vy * dt;
  const k = indice(t, nx, ny);
  if (k >= 0 && perfil.passavel[k] === 1) { a.x = nx; a.y = ny; a.z = altura(t, a.x, a.y); }
  else a.impulso = null;
  // Na investida o corpo realmente corre: a velocidade acompanha o impulso (anima e gasta fôlego).
  if (im.tipo === 'investida') a.velocidade = Math.max(a.velocidade * 0.5, Math.sqrt(im.vx * im.vx + im.vy * im.vy) * 0.6);
}

function gastarEnergia(a, dt) {
  const m = a.especie.movimento;
  // Fôlego (sprint) e energia.
  const n = a.especie.necessidades;
  const frac = a.velocidade / m.corrida;
  if (a.velocidade > m.trote * 1.05) a.folego = Math.max(0, a.folego - dt);
  else a.folego = Math.min(m.resistenciaSeg * a.atributos.resistencia, a.folego + dt * (a.velocidade < 0.3 ? 0.6 : 0.3));
  a.energia -= (n.custoBasePorSeg + n.custoCorridaPorSeg * frac * frac) * dt;
  // Camuflagem ativa ocupa o metabolismo: parado camuflado não recupera energia.
  if (a.velocidade < 0.2) a.energia += (1 - (a.camuflagem?.intensidade ?? 0)) * n.recuperacaoPorSeg * (['descansando', 'escondido'].includes(a.estado) ? 1 : n.fatorRecuperacaoParado ?? 0.5) * dt;
  a.energia = limitar(a.energia, 0, n.energiaMax);
}

// Sobreposição de corpos: afasta os pares que se interpenetram, na proporção inversa da massa, sem empurrar
// ninguém para célula intransponível. Ordem determinística (lista do mundo).
export function resolverSobreposicoes(mundo, lista) {
  const t = mundo.terreno;
  const g = mundo.gradeN1?.lista === lista ? mundo.gradeN1 : null;
  const perto2 = [];
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    if (!a.vivo) continue;
    // Raio: a rejeição barata abaixo usa (compA + compB)/2 + 1; o maior corpo vivo dá o limite superior.
    const alcanceBusca = (a.especie.corpo.comprimentoM * a.escala + (mundo.maxComprimentoCorpo ?? 0)) / 2 + 1 + (mundo.margemPasso ?? 0);
    const cand = g ? vizinhos(g, a.x, a.y, alcanceBusca, perto2) : null;
    const nCand = cand ? cand.length : lista.length;
    for (let c = 0; c < nCand; c++) {
      const j = cand ? cand[c] : c;
      if (j <= i) continue;
      const b = lista[j];
      if (!b.vivo || a.agarrando === b.id || b.agarrando === a.id) continue;
      // Meios diferentes na vertical: não há contato nem empurrão (areia sólida entre os corpos).
      if (separadosNaVertical(a, b)) continue;
      // Rejeição barata antes das cápsulas: centros mais longe que os dois meios-comprimentos + folga.
      const lim0 = (a.especie.corpo.comprimentoM * a.escala + b.especie.corpo.comprimentoM * b.escala) / 2 + 1;
      if ((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) > lim0 * lim0) continue;
      // Corpos como cápsulas ao longo do rumo (comprimento real): um animal longo ocupa o espaço da cabeça à cauda.
      const ka = capsulaContra(a, b), kb = capsulaContra(b, a);
      const lim = (ka.r + kb.r) * 0.9;
      const alcance = ka.meio + kb.meio + lim;
      if ((ka.cx - kb.cx) * (ka.cx - kb.cx) + (ka.cy - kb.cy) * (ka.cy - kb.cy) >= alcance * alcance) continue;
      const pp = pontosMaisProximos(ka, kb);
      const dx = pp.bx - pp.ax, dy = pp.by - pp.ay;
      const d2 = dx * dx + dy * dy;
      if (d2 >= lim * lim) continue;
      const d = Math.sqrt(d2);
      const ux = d > 1e-6 ? dx / d : cos(a.numero), uy = d > 1e-6 ? dy / d : sen(a.numero);
      const pen = lim - d;
      const wa = b.massa / (a.massa + b.massa), wb = 1 - wa;
      const pa = perfilMobilidade(t, a.especie.movimento).passavel, pb = perfilMobilidade(t, b.especie.movimento).passavel;
      const ok = (p, x, y) => { const k = indice(t, x, y); return k >= 0 && p[k] === 1; };
      const ax = a.x - ux * pen * wa, ay = a.y - uy * pen * wa, bx = b.x + ux * pen * wb, by = b.y + uy * pen * wb;
      const okA = ok(pa, ax, ay), okB = ok(pb, bx, by);
      if (okA && okB) { a.x = ax; a.y = ay; b.x = bx; b.y = by; }
      else if (okA && ok(pa, a.x - ux * pen, a.y - uy * pen)) { a.x -= ux * pen; a.y -= uy * pen; }
      else if (okB && ok(pb, b.x + ux * pen, b.y + uy * pen)) { b.x += ux * pen; b.y += uy * pen; }
      else continue;
      if (naSuperficie(a)) a.z = altura(t, a.x, a.y); else aplicarAltura(a, mundo);
      if (naSuperficie(b)) b.z = altura(t, b.x, b.y); else aplicarAltura(b, mundo);
      mundo.metricas.separacoes = (mundo.metricas.separacoes ?? 0) + 1;
    }
  }
}

// Pontos mais próximos entre os eixos (segmentos) de duas cápsulas no plano.
export function pontosMaisProximos(ka, kb) {
  const p1x = ka.cx - ka.ux * ka.meio, p1y = ka.cy - ka.uy * ka.meio, d1x = ka.ux * 2 * ka.meio, d1y = ka.uy * 2 * ka.meio;
  const p2x = kb.cx - kb.ux * kb.meio, p2y = kb.cy - kb.uy * kb.meio, d2x = kb.ux * 2 * kb.meio, d2y = kb.uy * 2 * kb.meio;
  const rx = p1x - p2x, ry = p1y - p2y;
  const a = d1x * d1x + d1y * d1y, e = d2x * d2x + d2y * d2y, f = d2x * rx + d2y * ry;
  let s = 0, t = 0;
  if (a <= 1e-9 && e <= 1e-9) { s = 0; t = 0; }
  else if (a <= 1e-9) { s = 0; t = limitar(f / e, 0, 1); }
  else {
    const c = d1x * rx + d1y * ry;
    if (e <= 1e-9) { t = 0; s = limitar(-c / a, 0, 1); }
    else {
      const b = d1x * d2x + d1y * d2y, den = a * e - b * b;
      s = den > 1e-9 ? limitar((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = limitar(-c / a, 0, 1); } else if (t > 1) { t = 1; s = limitar((b - c) / a, 0, 1); }
    }
  }
  return { ax: p1x + d1x * s, ay: p1y + d1y * s, bx: p2x + d2x * t, by: p2y + d2y * t };
}

// Episódio "preso": quis se deslocar (destino a mais de 2 m, ritmo ≠ parado) durante 5 s e andou menos de 0,5 m.
function medirPreso(a, intencao, mundo) {
  const d = intencao?.destino;
  const quer = d && intencao.ritmo !== 'parado' && (d.x - a.x) * (d.x - a.x) + (d.y - a.y) * (d.y - a.y) > 4;
  const j = a.janelaPreso;
  if (!quer) { a.janelaPreso = null; return; }
  if (!j) { a.janelaPreso = { x: a.x, y: a.y, t: mundo.t }; return; }
  if (mundo.t - j.t >= 5) {
    const mov = Math.sqrt((a.x - j.x) * (a.x - j.x) + (a.y - j.y) * (a.y - j.y));
    if (mov < 0.5) {
      mundo.metricas.presos++;
      (mundo.decisoesPreso ??= []).push(`${a.estado}|${a.caminho?.pontos.length ? (a.caminho.completo ? 'caminho' : 'parcial') : 'sem_caminho'}`);
      mundo.evento('preso', a.id, { x: +a.x.toFixed(1), y: +a.y.toFixed(1), estado: a.estado });
    }
    a.janelaPreso = { x: a.x, y: a.y, t: mundo.t };
  }
}

function girar(a, ang, graus, dt) {
  const max = ((graus * Math.PI) / 180) * dt * (a.juvenil ? 1.2 : 1);
  const d = normalizarAngulo(ang - a.direcao);
  a.direcao = normalizarAngulo(a.direcao + limitar(d, -max, max));
}
