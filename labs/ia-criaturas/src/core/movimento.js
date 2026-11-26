// Locomoção: navegação contornando obstáculos, giro limitado, aceleração e colisão.
import { atan2, cos, sen } from './matematica.js';
import { distancia, empurrarParaFora, limitar, normalizarAngulo, pontoDentroRetangulo, segmentoCruzaRetangulo } from './geometria.js';

export const RITMOS = ['parado', 'andar', 'trote', 'corrida'];

export function caminhoLivre(a, b, obstaculos, margem) {
  for (const o of obstaculos) {
    if (o.bloqueiaMovimento && segmentoCruzaRetangulo(a.x, a.y, b.x, b.y, o, margem)) return false;
  }
  return true;
}

// Escolhe um ponto intermediário (quina de obstáculo) quando o caminho direto está bloqueado.
export function navegar(origem, destino, terreno, raio) {
  const obs = terreno.obstaculos;
  if (caminhoLivre(origem, destino, obs, raio)) return destino;
  const folga = raio + 0.35;
  let melhor = null, custoMelhor = Infinity;
  for (const o of obs) {
    if (!o.bloqueiaMovimento) continue;
    const quinas = [
      { x: o.x - folga, y: o.y - folga }, { x: o.x + o.w + folga, y: o.y - folga },
      { x: o.x - folga, y: o.y + o.h + folga }, { x: o.x + o.w + folga, y: o.y + o.h + folga },
    ];
    for (const q of quinas) {
      if (q.x < raio || q.y < raio || q.x > terreno.largura - raio || q.y > terreno.altura - raio) continue;
      if (obs.some((o2) => o2.bloqueiaMovimento && pontoDentroRetangulo(q, o2, raio))) continue;
      if (distancia(origem, q) < 0.2) continue;
      if (!caminhoLivre(origem, q, obs, raio * 0.95)) continue;
      const custo = distancia(origem, q) + distancia(q, destino) + (caminhoLivre(q, destino, obs, raio) ? 0 : 6);
      if (custo < custoMelhor) { custoMelhor = custo; melhor = q; }
    }
  }
  return melhor ?? destino;
}

export function velocidadeDoRitmo(c, ritmo) {
  if (ritmo === 'parado') return 0;
  const m = c.especie.movimento;
  let v = m[ritmo] ?? m.andar;
  // Exaustão: sem energia, não passa do passo.
  if (c.energia <= c.especie.necessidades.limiteExaustao) v = Math.min(v, m.andar);
  return v;
}

export function mover(c, intencao, terreno, dt) {
  const m = c.especie.movimento;
  const raio = c.especie.corpo.raio;
  let alvoVel = velocidadeDoRitmo(c, intencao.ritmo);
  let destino = intencao.destino;
  if (destino && distancia(c, destino) < 0.15) alvoVel = 0;

  if (destino && alvoVel > 0) {
    const ponto = navegar(c, destino, terreno, raio);
    c.waypoint = ponto;
    const desejado = atan2(ponto.y - c.y, ponto.x - c.x);
    girarPara(c, desejado, m.giroGrausSeg, dt);
    // Ao fazer curva fechada, reduz a velocidade.
    const desvio = Math.abs(normalizarAngulo(desejado - c.direcao));
    if (desvio > Math.PI / 2) alvoVel *= m.fatorCurvaFechada ?? 0.6;
  } else {
    c.waypoint = null;
    if (intencao.olharPara) girarPara(c, atan2(intencao.olharPara.y - c.y, intencao.olharPara.x - c.x), m.giroGrausSeg, dt);
  }

  const dv = m.aceleracao * dt;
  c.velocidade = c.velocidade < alvoVel ? Math.min(alvoVel, c.velocidade + dv) : Math.max(alvoVel, c.velocidade - dv * 1.5);

  const anterior = { x: c.x, y: c.y };
  c.x += cos(c.direcao) * c.velocidade * dt;
  c.y += sen(c.direcao) * c.velocidade * dt;
  let colidiu = false;
  for (let iter = 0; iter < 2; iter++) {
    for (const o of terreno.obstaculos) if (o.bloqueiaMovimento && empurrarParaFora(c, raio, o)) colidiu = true;
  }
  const xL = limitar(c.x, raio, terreno.largura - raio);
  const yL = limitar(c.y, raio, terreno.altura - raio);
  if (xL !== c.x || yL !== c.y) colidiu = true;
  c.x = xL; c.y = yL;
  if (colidiu) {
    // Velocidade efetiva é o que realmente andou (evita "correr parado" contra a parede).
    c.velocidade = Math.min(c.velocidade, distancia(anterior, c) / dt);
    c.colisoes++;
  }
}

function girarPara(c, angulo, giroGrausSeg, dt) {
  const max = ((giroGrausSeg * Math.PI) / 180) * dt;
  const diff = normalizarAngulo(angulo - c.direcao);
  c.direcao = normalizarAngulo(c.direcao + limitar(diff, -max, max));
}
