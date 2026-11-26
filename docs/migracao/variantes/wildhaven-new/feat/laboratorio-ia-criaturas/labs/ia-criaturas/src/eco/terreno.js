// Terreno 3D em grade regular: altura, água, cobertura (ocultação), bloqueios (rochas/troncos) e vegetação.
// Plano: x (leste) e y (sul) em metros; z = altura. Determinístico: só + − × ÷, sqrt e funções de matematica.js.
import { atan, PI } from '../core/matematica.js';
const sq = (v) => v * v;

export function criarTerreno({ largura, profundidade, res = 1, alturas, agua, cobertura, bloqueio, vegetacao, vegetacaoMax, origem = null }) {
  const nx = Math.round(largura / res), ny = Math.round(profundidade / res);
  const n = nx * ny;
  const t = {
    largura: nx * res, profundidade: ny * res, res, nx, ny, origem,
    alturas: alturas ?? new Float32Array(n),
    agua: agua ?? new Float32Array(n).fill(-1e9),
    cobertura: cobertura ?? new Uint8Array(n),
    bloqueio: bloqueio ?? new Uint8Array(n),
    vegetacao: vegetacao ?? new Float32Array(n),
    vegetacaoMax: vegetacaoMax ?? new Float32Array(n),
    cinzas: new Float32Array(n),
    perfis: new Map(),
  };
  t.inclinacao = calcularInclinacao(t);
  return t;
}

export const indice = (t, x, y) => {
  const i = Math.floor(x / t.res), j = Math.floor(y / t.res);
  if (i < 0 || j < 0 || i >= t.nx || j >= t.ny) return -1;
  return j * t.nx + i;
};
export const centro = (t, k) => ({ x: ((k % t.nx) + 0.5) * t.res, y: (Math.floor(k / t.nx) + 0.5) * t.res });
export const dentro = (t, x, y) => x >= 0 && y >= 0 && x < t.largura && y < t.profundidade;

// Altura interpolada (bilinear entre centros de célula).
export function altura(t, x, y) {
  const fx = x / t.res - 0.5, fy = y / t.res - 0.5;
  let i = Math.floor(fx), j = Math.floor(fy);
  const u = fx - i, v = fy - j;
  const h = (a, b) => t.alturas[Math.min(t.ny - 1, Math.max(0, b)) * t.nx + Math.min(t.nx - 1, Math.max(0, a))];
  return h(i, j) * (1 - u) * (1 - v) + h(i + 1, j) * u * (1 - v) + h(i, j + 1) * (1 - u) * v + h(i + 1, j + 1) * u * v;
}

export function profundidadeAgua(t, x, y) {
  const k = indice(t, x, y);
  if (k < 0) return 0;
  return Math.max(0, t.agua[k] - t.alturas[k]);
}

function calcularInclinacao(t) {
  const out = new Float32Array(t.nx * t.ny);
  for (let j = 0; j < t.ny; j++) for (let i = 0; i < t.nx; i++) {
    const h = (a, b) => t.alturas[Math.min(t.ny - 1, Math.max(0, b)) * t.nx + Math.min(t.nx - 1, Math.max(0, a))];
    // Maior desnível para os 8 vizinhos (detecta degraus/penhascos que a média suavizaria).
    let g = 0;
    for (const [di, dj, d] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142135623730951], [-1, -1, 1.4142135623730951], [1, -1, 1.4142135623730951], [-1, 1, 1.4142135623730951]]) {
      g = Math.max(g, Math.abs(h(i + di, j + dj) - h(i, j)) / (d * t.res));
    }
    out[j * t.nx + i] = (atan(g) * 180) / PI;
  }
  return out;
}

// Perfil de mobilidade por espécie (cacheado): célula transitável?
export function perfilMobilidade(t, mov) {
  const chave = `${mov.inclinacaoMaxGraus}|${mov.profundidadeMaxM}|${mov.nadar ? 1 : 0}|${mov.escalarRochas ? 1 : 0}`;
  if (t.perfis.has(chave)) return t.perfis.get(chave);
  const n = t.nx * t.ny;
  const passavel = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    const prof = Math.max(0, t.agua[k] - t.alturas[k]);
    const okAgua = prof <= mov.profundidadeMaxM || mov.nadar;
    const okRocha = t.bloqueio[k] === 0 || (mov.escalarRochas && t.bloqueio[k] === 1);
    const okInc = t.inclinacao[k] <= mov.inclinacaoMaxGraus || (mov.escalarRochas && t.inclinacao[k] <= 75);
    passavel[k] = okAgua && okRocha && okInc ? 1 : 0;
  }
  const p = { chave, passavel, mov };
  t.perfis.set(chave, p);
  return p;
}

export function transitavel(t, perfil, x, y) {
  const k = indice(t, x, y);
  return k >= 0 && perfil.passavel[k] === 1;
}

// Folga (m) de cada célula até a célula intransponível mais próxima ou a borda do mapa, por perfil de mobilidade.
// Transformada de distância chanfrada em duas passadas (pesos 1 e √2): determinística e O(n). Cacheada no perfil.
export function folga(t, perfil) {
  if (perfil.folga) return perfil.folga;
  const { nx, ny } = t, n = nx * ny, R2 = 1.4142135623730951;
  const f = new Float32Array(n);
  for (let k = 0; k < n; k++) f[k] = perfil.passavel[k] ? 1e9 : 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (!f[k]) continue;
    let v = f[k];
    if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) v = Math.min(v, 1);
    if (i > 0) v = Math.min(v, f[k - 1] + 1);
    if (j > 0) { v = Math.min(v, f[k - nx] + 1); if (i > 0) v = Math.min(v, f[k - nx - 1] + R2); if (i < nx - 1) v = Math.min(v, f[k - nx + 1] + R2); }
    f[k] = v;
  }
  for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i;
    if (!f[k]) continue;
    let v = f[k];
    if (i < nx - 1) v = Math.min(v, f[k + 1] + 1);
    if (j < ny - 1) { v = Math.min(v, f[k + nx] + 1); if (i < nx - 1) v = Math.min(v, f[k + nx + 1] + R2); if (i > 0) v = Math.min(v, f[k + nx - 1] + R2); }
    f[k] = v;
  }
  // Centro→centro em células; converte para metros até a borda da célula bloqueada.
  for (let k = 0; k < n; k++) f[k] = f[k] ? Math.max(0, (f[k] - 0.5) * t.res) : 0;
  perfil.folga = f;
  return f;
}

export function folgaEm(t, perfil, x, y) {
  const k = indice(t, x, y);
  return k < 0 ? 0 : folga(t, perfil)[k];
}

// Segmento com folga corporal: todas as amostras transitáveis e, fora da zona de partida (`tolerancia` m),
// com folga ≥ raio. A zona de partida permite sair de um ponto apertado sem ficar preso nele.
export function segmentoLivre(t, perfil, a, b, raio, tolerancia = 0) {
  const pass = perfil.passavel, fol = folga(t, perfil);
  return percorrerCelulas(t, a, b, (k, dist) => k >= 0 && pass[k] === 1 && !(raio > 0 && dist > tolerancia && fol[k] < raio));
}

// Percorre TODAS as células cruzadas pelo segmento (DDA de Amanatides–Woo). Em cruzamento exato de quina,
// visita as duas vizinhas: um segmento não "escapa" por entre duas células bloqueadas na diagonal.
// f(k, distânciaDesdeA) → false interrompe. Retorna true se todas passaram.
export function percorrerCelulas(t, a, b, f) {
  const x0 = a.x / t.res, y0 = a.y / t.res, x1 = b.x / t.res, y1 = b.y / t.res;
  const dx = x1 - x0, dy = y1 - y0;
  const comp = Math.sqrt(dx * dx + dy * dy) * t.res;
  let i = Math.floor(x0), j = Math.floor(y0);
  const iF = Math.floor(x1), jF = Math.floor(y1);
  const si = dx > 0 ? 1 : dx < 0 ? -1 : 0, sj = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const tdx = si ? 1 / Math.abs(dx) : Infinity, tdy = sj ? 1 / Math.abs(dy) : Infinity;
  let tmx = si > 0 ? (i + 1 - x0) * tdx : si < 0 ? (x0 - i) * tdx : Infinity;
  let tmy = sj > 0 ? (j + 1 - y0) * tdy : sj < 0 ? (y0 - j) * tdy : Infinity;
  const k = (p, q) => (p < 0 || q < 0 || p >= t.nx || q >= t.ny ? -1 : q * t.nx + p);
  if (!f(k(i, j), 0)) return false;
  for (let n = 0; n < 4 * (t.nx + t.ny) && (i !== iF || j !== jF); n++) {
    if (Math.abs(tmx - tmy) < 1e-9) {
      const u = tmx;
      if (u > 1) break;
      if (!f(k(i + si, j), u * comp) || !f(k(i, j + sj), u * comp)) return false;
      i += si; j += sj; tmx += tdx; tmy += tdy;
    } else if (tmx < tmy) { if (tmx > 1) break; i += si; tmx += tdx; } else { if (tmy > 1) break; j += sj; tmy += tdy; }
    if (!f(k(i, j), Math.min(tmx, tmy, 1) * comp)) return false;
  }
  return true;
}

// Linha de visão sobre o relevo: bloqueada por terreno, rochas/troncos; vegetação acumula ocultação.
export function linhaDeVisao(t, a, b, olhoA = 1, alturaB = 0.5) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const passos = Math.max(1, Math.ceil(dist / (t.res * 0.5)));
  const za = altura(t, a.x, a.y) + olhoA, zb = altura(t, b.x, b.y) + alturaB;
  let visivel = 1;
  const kA = indice(t, a.x, a.y), kB = indice(t, b.x, b.y);
  let ultimo = -2;
  for (let s = 1; s <= passos; s++) {
    const u = s / passos;
    const x = a.x + dx * u, y = a.y + dy * u;
    const k = indice(t, x, y);
    if (k < 0) return { livre: false, visibilidade: 0 };
    if (k === ultimo) continue;
    ultimo = k;
    if (k !== kA && k !== kB && t.bloqueio[k] === 1) return { livre: false, visibilidade: 0 };
    if (u < 1 && altura(t, x, y) > za + (zb - za) * u + 0.05) return { livre: false, visibilidade: 0 };
    if (k !== kA && t.cobertura[k] > 0) visivel *= 1 - (t.cobertura[k] / 100) * (k === kB ? 1 : 0.35);
  }
  return { livre: true, visibilidade: visivel };
}

// ---------- A* em grade (8 vizinhos), desempate determinístico pelo índice ----------
// `raio` (m): margem corporal. Células com folga < raio só são usadas perto da partida e da chegada
// (zona de manobra), e a proximidade de obstáculos custa mais — rotas grandes passam longe de água e rochas.
export function buscarCaminho(t, perfil, de, para, { maxExpansoes = 40000, custoAgua = 3, prefereCobertura = 0, raio = 0 } = {}) {
  const ini = indice(t, de.x, de.y);
  let fim = indice(t, para.x, para.y);
  if (ini < 0 || fim < 0) return null;
  const pass = perfil.passavel;
  const fol = raio > 0 ? folga(t, perfil) : null;
  const zona = raio > 0 ? Math.ceil((raio * 1.5) / t.res) + 1 : 0;
  const perto = (k, c) => Math.max(Math.abs((k % t.nx) - (c % t.nx)), Math.abs(Math.floor(k / t.nx) - Math.floor(c / t.nx))) <= zona;
  if (!pass[fim]) fim = celulaPassavelProxima(t, pass, fim, 12);
  if (fim < 0) return null;
  const ok = (q) => pass[q] && (!fol || fol[q] >= raio || perto(q, ini) || perto(q, fim));
  const n = t.nx * t.ny;
  const g = new Float32Array(n).fill(Infinity);
  const veio = new Int32Array(n).fill(-1);
  const fechado = new Uint8Array(n);
  const heap = new Heap();
  const h = (k) => { const a = centro(t, k), b = centro(t, fim); return Math.sqrt(sq(a.x - b.x) + sq(a.y - b.y)); };
  g[ini] = 0; heap.push(h(ini), ini);
  let melhor = ini, melhorH = h(ini), exp = 0;
  const viz = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142135623730951], [-1, 1, 1.4142135623730951], [1, -1, 1.4142135623730951], [-1, -1, 1.4142135623730951]];
  while (heap.tamanho && exp < maxExpansoes) {
    const k = heap.pop();
    if (fechado[k]) continue;
    fechado[k] = 1; exp++;
    if (k === fim) { melhor = k; break; }
    const hk = h(k);
    if (hk < melhorH) { melhorH = hk; melhor = k; }
    const i = k % t.nx, j = Math.floor(k / t.nx);
    for (const [di, dj, d] of viz) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= t.nx || b >= t.ny) continue;
      const q = b * t.nx + a;
      if (!ok(q) || fechado[q]) continue;
      if (di && dj && (!pass[j * t.nx + a] || !pass[b * t.nx + i])) continue; // sem cortar quinas
      const prof = Math.max(0, t.agua[q] - t.alturas[q]);
      const margem = fol ? Math.max(0, 2 * raio - fol[q]) / Math.max(0.3, raio) : 0;
      const custo = d * t.res * (1 + t.inclinacao[q] / Math.max(10, perfil.mov.inclinacaoMaxGraus) + (prof > 0.05 ? custoAgua : 0) + margem * 1.5 - prefereCobertura * (t.cobertura[q] / 100));
      const ng = g[k] + Math.max(0.2 * d * t.res, custo);
      if (ng < g[q]) { g[q] = ng; veio[q] = k; heap.push(ng + h(q), q); }
    }
  }
  const celulas = [];
  for (let k = melhor; k !== -1; k = veio[k]) celulas.push(k);
  celulas.reverse();
  const pts = celulas.map((k) => centro(t, k));
  if (melhor === fim && fim === indice(t, para.x, para.y)) pts[pts.length - 1] = { x: para.x, y: para.y };
  return { completo: melhor === fim, expansoes: exp, chegada: centro(t, fim), pontos: raio > 0 ? suavizarComFolga(t, perfil, pts, raio, zona * t.res) : suavizar(t, pass, pts) };
}

// Corte de cantos (string pulling) que mantém a folga corporal fora das zonas de partida/chegada.
function suavizarComFolga(t, perfil, pts, raio, zona) {
  if (pts.length <= 2) return pts;
  const fim = pts[pts.length - 1];
  const livre = (a, b) => segmentoLivre(t, perfil, a, b, raio, a === pts[0] ? zona : 0)
    || (Math.sqrt(sq(b.x - fim.x) + sq(b.y - fim.y)) <= zona && segmentoLivre(t, perfil, a, b, 0));
  const out = [pts[0]];
  let ancora = 0;
  for (let i = 2; i < pts.length; i++) {
    if (!livre(pts[ancora], pts[i])) { out.push(pts[i - 1]); ancora = i - 1; }
  }
  out.push(fim);
  return out;
}

export function celulaPassavelProxima(t, pass, k, raio) {
  const i0 = k % t.nx, j0 = Math.floor(k / t.nx);
  for (let r = 1; r <= raio; r++) {
    let melhor = -1, dm = Infinity;
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const a = i0 + di, b = j0 + dj;
      if (a < 0 || b < 0 || a >= t.nx || b >= t.ny) continue;
      const q = b * t.nx + a;
      const d = di * di + dj * dj;
      if (pass[q] && (d < dm || (d === dm && q < melhor))) { dm = d; melhor = q; }
    }
    if (melhor >= 0) return melhor;
  }
  return -1;
}

// Corta pontos intermediários quando o segmento direto continua todo transitável.
function suavizar(t, pass, pts) {
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  let ancora = 0;
  for (let i = 2; i < pts.length; i++) {
    if (!segmentoPassavel(t, pass, pts[ancora], pts[i])) { out.push(pts[i - 1]); ancora = i - 1; }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function segmentoPassavel(t, pass, a, b) {
  return percorrerCelulas(t, a, b, (k) => k >= 0 && pass[k] === 1);
}

class Heap {
  constructor() { this.p = []; this.k = []; }
  get tamanho() { return this.p.length; }
  push(prio, chave) {
    const p = this.p, k = this.k;
    p.push(prio); k.push(chave);
    let i = p.length - 1;
    while (i > 0) {
      const pai = (i - 1) >> 1;
      if (p[pai] < p[i] || (p[pai] === p[i] && k[pai] <= k[i])) break;
      [p[pai], p[i]] = [p[i], p[pai]]; [k[pai], k[i]] = [k[i], k[pai]]; i = pai;
    }
  }
  pop() {
    const p = this.p, k = this.k;
    const topo = k[0];
    const ultP = p.pop(), ultK = k.pop();
    if (p.length) {
      p[0] = ultP; k[0] = ultK;
      let i = 0;
      for (;;) {
        const e = 2 * i + 1, d = e + 1;
        let m = i;
        if (e < p.length && (p[e] < p[m] || (p[e] === p[m] && k[e] < k[m]))) m = e;
        if (d < p.length && (p[d] < p[m] || (p[d] === p[m] && k[d] < k[m]))) m = d;
        if (m === i) break;
        [p[m], p[i]] = [p[i], p[m]]; [k[m], k[i]] = [k[i], k[m]]; i = m;
      }
    }
    return topo;
  }
}

// ---------- Terreno procedural de teste (relevo suave, lago, penhasco, rochas, arbustos) ----------
export function gerarTerrenoProcedural(rng, { largura = 160, profundidade = 120, res = 1, lago = null, penhasco = null, rochas = [], arbustos = [], amplitude = 3, capim = 60 } = {}) {
  const t = criarTerreno({ largura, profundidade, res });
  const grade = 8, gx = Math.ceil(largura / (grade * res)) + 2, gy = Math.ceil(profundidade / (grade * res)) + 2;
  const nos = new Float32Array(gx * gy).map(() => rng.entre(-1, 1));
  const suave = (u) => u * u * (3 - 2 * u);
  for (let j = 0; j < t.ny; j++) for (let i = 0; i < t.nx; i++) {
    const fx = i / grade, fy = j / grade, a = Math.floor(fx), b = Math.floor(fy);
    const u = suave(fx - a), v = suave(fy - b);
    const n = (p, q) => nos[q * gx + p];
    let h = (n(a, b) * (1 - u) + n(a + 1, b) * u) * (1 - v) + (n(a, b + 1) * (1 - u) + n(a + 1, b + 1) * u) * v;
    h *= amplitude;
    const x = (i + 0.5) * res, y = (j + 0.5) * res;
    if (penhasco) {
      // Degrau vertical ao longo de x = penhasco.x (entre y0 e y1): lado leste fica `altura` mais alto.
      if (y >= penhasco.y0 && y <= penhasco.y1 && x >= penhasco.x) h += penhasco.altura;
    }
    if (lago) {
      const d = Math.sqrt(sq(x - lago.x) + sq(y - lago.y));
      if (d < lago.raio * 1.6) h -= lago.fundo * suave(Math.max(0, 1 - d / (lago.raio * 1.6)));
    }
    const k = j * t.nx + i;
    t.alturas[k] = h;
    t.vegetacaoMax[k] = capim; t.vegetacao[k] = capim;
  }
  if (lago) {
    const nivel = altura(t, lago.x, lago.y) + lago.fundo * 0.55;
    for (let k = 0; k < t.nx * t.ny; k++) if (t.alturas[k] < nivel) { const c = centro(t, k); if (Math.sqrt(sq(c.x - lago.x) + sq(c.y - lago.y)) < lago.raio * 1.6) { t.agua[k] = nivel; t.vegetacaoMax[k] = 0; t.vegetacao[k] = 0; } }
  }
  for (const r of rochas) marcarDisco(t, r.x, r.y, r.raio, (k) => { t.bloqueio[k] = 1; t.alturas[k] += r.altura ?? 1.5; t.vegetacaoMax[k] = 0; t.vegetacao[k] = 0; });
  for (const a of arbustos) marcarDisco(t, a.x, a.y, a.raio, (k) => { t.cobertura[k] = Math.max(t.cobertura[k], a.ocultacao ?? 60); t.vegetacaoMax[k] += a.alimento ?? 20; t.vegetacao[k] = t.vegetacaoMax[k]; });
  t.inclinacao = calcularInclinacao(t);
  t.perfis.clear();
  return t;
}

export function marcarDisco(t, x, y, r, f) {
  for (let j = Math.floor((y - r) / t.res); j <= Math.floor((y + r) / t.res); j++)
    for (let i = Math.floor((x - r) / t.res); i <= Math.floor((x + r) / t.res); i++) {
      if (i < 0 || j < 0 || i >= t.nx || j >= t.ny) continue;
      const c = { x: (i + 0.5) * t.res, y: (j + 0.5) * t.res };
      if (sq(c.x - x) + sq(c.y - y) <= r * r) f(j * t.nx + i);
    }
}

// ---------- (De)serialização compacta (base64) para dados derivados e persistência ----------
const B64 = typeof globalThis.Buffer !== 'undefined';
export function paraBase64(typed) {
  const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
  if (B64) return globalThis.Buffer.from(bytes).toString('base64');
  let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return globalThis.btoa(s);
}
export function deBase64(str, Tipo) {
  let bytes;
  if (B64) { const b = globalThis.Buffer.from(str, 'base64'); bytes = new Uint8Array(b.buffer, b.byteOffset, b.byteLength).slice(); }
  else { const s = globalThis.atob(str); bytes = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i); }
  return new Tipo(bytes.buffer);
}
export function serializarTerreno(t) {
  return {
    largura: t.largura, profundidade: t.profundidade, res: t.res, origem: t.origem,
    alturas: paraBase64(t.alturas), agua: paraBase64(t.agua), cobertura: paraBase64(t.cobertura),
    bloqueio: paraBase64(t.bloqueio), vegetacao: paraBase64(t.vegetacao), vegetacaoMax: paraBase64(t.vegetacaoMax),
  };
}
export function desserializarTerreno(d) {
  return criarTerreno({
    largura: d.largura, profundidade: d.profundidade, res: d.res, origem: d.origem,
    alturas: deBase64(d.alturas, Float32Array), agua: deBase64(d.agua, Float32Array), cobertura: deBase64(d.cobertura, Uint8Array),
    bloqueio: deBase64(d.bloqueio, Uint8Array), vegetacao: deBase64(d.vegetacao, Float32Array), vegetacaoMax: deBase64(d.vegetacaoMax, Float32Array),
  });
}
