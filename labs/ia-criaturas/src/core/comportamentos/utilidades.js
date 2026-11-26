// Funções auxiliares compartilhadas pelos cérebros. Recebem apenas `sentidos` (nunca o mundo).
import { atan2, cos, hipot, sen } from '../matematica.js';
import { distancia, distanciaPontoSegmento, limitar, normalizarAngulo, pontoDentroRetangulo } from '../geometria.js';
import { linhaDeVisaoLivre } from '../percepcao.js';

export function maisProximo(lista, eu) {
  let melhor = null, dMelhor = Infinity;
  for (const item of lista) {
    const d = distancia(eu, item);
    if (d < dMelhor) { dMelhor = d; melhor = item; }
  }
  return melhor;
}

export function maisRecente(lista) {
  let melhor = null;
  for (const m of lista) if (!melhor || m.t > melhor.t) melhor = m;
  return melhor;
}

export function pontoLivre(terreno, p, raio) {
  return !terreno.obstaculos.some((o) => o.bloqueiaMovimento && pontoDentroRetangulo(p, o, raio + 0.2));
}

export function pontoNoTerreno(terreno, x, y, margem) {
  return { x: limitar(x, margem, terreno.largura - margem), y: limitar(y, margem, terreno.altura - margem) };
}

// Ponto de vagar sorteado com o RNG da própria criatura (determinístico).
export function sortearPontoVagar(s, raioBusca) {
  const raio = s.eu.especie.corpo.raio;
  for (let i = 0; i < 12; i++) {
    const ang = s.rng.entre(-Math.PI, Math.PI);
    const r = s.rng.entre(raioBusca * 0.3, raioBusca);
    const p = pontoNoTerreno(s.terreno, s.eu.x + cos(ang) * r, s.eu.y + sen(ang) * r, raio + 1);
    if (pontoLivre(s.terreno, p, raio)) return p;
  }
  return pontoNoTerreno(s.terreno, s.terreno.largura / 2, s.terreno.altura / 2, raio + 1);
}

// Avalia candidatos de fuga: longe da ameaça, sem passar perto dela, com bônus para pontos fora da linha de visão.
export function calcularPontoDeFuga(s, ameaca, params) {
  const eu = s.eu, raio = eu.especie.corpo.raio, t = s.terreno;
  const candidatos = [];
  const n = 16;
  for (let k = 0; k < n; k++) {
    const ang = (k / n) * Math.PI * 2;
    candidatos.push(pontoNoTerreno(t, eu.x + cos(ang) * params.distanciaFuga, eu.y + sen(ang) * params.distanciaFuga, raio + 0.8));
  }
  // Esconderijos: atrás de cada obstáculo que bloqueia visão, do lado oposto à ameaça.
  for (const o of t.obstaculos) {
    if (!o.bloqueiaVisao) continue;
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    let dx = cx - ameaca.x, dy = cy - ameaca.y;
    const d = hipot(dx, dy) || 1;
    dx /= d; dy /= d;
    const alcance = hipot(o.w, o.h) / 2 + raio + 1.2;
    candidatos.push(pontoNoTerreno(t, cx + dx * alcance, cy + dy * alcance, raio + 0.8));
  }
  let melhor = null, notaMelhor = -Infinity;
  for (const c of candidatos) {
    if (!pontoLivre(t, c, raio)) continue;
    const dAmeaca = distancia(c, ameaca);
    const dCaminho = distancia(eu, c);
    if (dCaminho < 1) continue;
    let nota = dAmeaca - distancia(eu, ameaca);
    const passagem = distanciaPontoSegmento(ameaca, eu, c);
    nota -= Math.max(0, 5 - passagem) * 3; // não correr em direção ao predador
    if (!linhaDeVisaoLivre(ameaca, c, t.obstaculos)) nota += params.bonusEsconderijo;
    nota -= dCaminho * 0.05;
    // Continuidade: mudar muito de rumo custa velocidade, então penaliza curvas fechadas.
    const desvio = Math.abs(normalizarAngulo(atan2(c.y - eu.y, c.x - eu.x) - eu.direcao));
    nota -= desvio * (params.penalidadeCurva ?? 1.5);
    if (nota > notaMelhor) { notaMelhor = nota; melhor = c; }
  }
  return melhor ?? pontoNoTerreno(t, eu.x + (eu.x - ameaca.x), eu.y + (eu.y - ameaca.y), raio + 0.8);
}

export const fmt = (v, casas = 1) => Number(v).toFixed(casas);
