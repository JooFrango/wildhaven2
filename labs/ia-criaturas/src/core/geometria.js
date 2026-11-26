// Geometria 2D do plano do terreno (x, y em metros). Obstáculos são retângulos {x, y, w, h}.
import { hipot } from './matematica.js';

export const distancia = (a, b) => hipot(b.x - a.x, b.y - a.y);
export const limitar = (v, min, max) => (v < min ? min : v > max ? max : v);

export function normalizarAngulo(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// Liang–Barsky: o segmento AB cruza o retângulo expandido por `margem`?
export function segmentoCruzaRetangulo(ax, ay, bx, by, r, margem = 0) {
  const minX = r.x - margem, minY = r.y - margem;
  const maxX = r.x + r.w + margem, maxY = r.y + r.h + margem;
  const dx = bx - ax, dy = by - ay;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - minX, maxX - ax, ay - minY, maxY - ay];
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

export function pontoDentroRetangulo(p, r, margem = 0) {
  return p.x > r.x - margem && p.x < r.x + r.w + margem && p.y > r.y - margem && p.y < r.y + r.h + margem;
}

// Penetração de um círculo num retângulo (0 = sem contato).
export function penetracaoCirculoRetangulo(p, raio, r) {
  const cx = limitar(p.x, r.x, r.x + r.w);
  const cy = limitar(p.y, r.y, r.y + r.h);
  const d = hipot(p.x - cx, p.y - cy);
  if (pontoDentroRetangulo(p, r)) {
    const menor = Math.min(p.x - r.x, r.x + r.w - p.x, p.y - r.y, r.y + r.h - p.y);
    return raio + menor;
  }
  return Math.max(0, raio - d);
}

// Empurra o círculo para fora do retângulo. Retorna true se houve colisão.
export function empurrarParaFora(p, raio, r) {
  if (pontoDentroRetangulo(p, r)) {
    const opcoes = [
      [p.x - r.x, -1, 0], [r.x + r.w - p.x, 1, 0],
      [p.y - r.y, 0, -1], [r.y + r.h - p.y, 0, 1],
    ].sort((a, b) => a[0] - b[0]);
    const [d, nx, ny] = opcoes[0];
    p.x += nx * (d + raio);
    p.y += ny * (d + raio);
    return true;
  }
  const cx = limitar(p.x, r.x, r.x + r.w);
  const cy = limitar(p.y, r.y, r.y + r.h);
  const dx = p.x - cx, dy = p.y - cy;
  const d = hipot(dx, dy);
  if (d >= raio) return false;
  p.x = cx + (dx / d) * raio;
  p.y = cy + (dy / d) * raio;
  return true;
}

export function distanciaPontoSegmento(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return distancia(p, a);
  const t = limitar(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1);
  return hipot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
