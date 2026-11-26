// Navegação estratégica entre hexágonos (V02). Coordenadas do jogo = coordenadas da simulação (x leste, y sul,
// metros, origem no canto da janela de simulação); fora da janela elas continuam valendo (x/y negativos ou maiores).
// Mundo (X, Z) = (x + x0, y + z0).

export function criarGrafo(g, origem) {
  const porId = new Map(g.tiles.map((t) => [t.id, t])), viz = new Map(g.tiles.map((t) => [t.id, []]));
  for (const [a, b] of g.arestas) { viz.get(a).push(b); viz.get(b).push(a); }
  // Centros em coordenadas do jogo.
  for (const t of g.tiles) { t.cx = t.x - origem.x0; t.cy = t.z - origem.z0; }
  return { tiles: g.tiles, porId, viz, passo: g.passoM, x0: origem.x0, z0: origem.z0 };
}

// Hexágono que contém o ponto: o centro mais próximo (a grade de hexágonos é o diagrama de Voronoi dos centros).
// Fora do continente (mais de um raio do centro mais próximo) devolve null.
export function hexEm(G, x, y) {
  let melhor = null, d = Infinity;
  for (const t of G.tiles) { const e = Math.hypot(t.cx - x, t.cy - y); if (e < d) { d = e; melhor = t; } }
  return d <= 2500 ? melhor : null;
}

// A* sobre o grafo; custo da aresta = passo × média dos custos de bioma. Hexágono com custo null é intransponível.
export function rota(G, de, para) {
  if (!G.porId.get(de)?.custo || !G.porId.get(para)?.custo) return null;
  const h = (id) => { const a = G.porId.get(id), b = G.porId.get(para); return Math.hypot(a.cx - b.cx, a.cy - b.cy); };
  const g = new Map([[de, 0]]), veio = new Map(), aberto = new Set([de]);
  while (aberto.size) {
    let atual = null, f = Infinity;
    for (const id of aberto) { const v = g.get(id) + h(id); if (v < f) { f = v; atual = id; } }
    if (atual === para) { const r = [atual]; while (veio.has(r[0])) r.unshift(veio.get(r[0])); return r; }
    aberto.delete(atual);
    for (const n of G.viz.get(atual)) {
      const c = G.porId.get(n).custo; if (!c) continue;
      const v = g.get(atual) + G.passo * (G.porId.get(atual).custo + c) / 2;
      if (v < (g.get(n) ?? Infinity)) { g.set(n, v); veio.set(n, atual); aberto.add(n); }
    }
  }
  return null;
}

// Caminho em pontos do jogo: partida → centros dos hexágonos intermediários → alvo.
export function caminho(G, de, para) {
  const a = hexEm(G, de.x, de.y), b = hexEm(G, para.x, para.y);
  if (!a || !b) return null;
  const r = rota(G, a.id, b.id);
  if (!r) return null;
  return { hexes: r, pontos: [{ x: de.x, y: de.y }, ...r.slice(1, -1).map((id) => ({ x: G.porId.get(id).cx, y: G.porId.get(id).cy })), { x: para.x, y: para.y }] };
}

// Primeiro ponto em que o caminho sai do retângulo [m, L−m] × [m, P−m] (ou null se não sai).
export function saida(pontos, L, P, m = 20) {
  const dentro = (p) => p.x >= m && p.y >= m && p.x <= L - m && p.y <= P - m;
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1], b = pontos[i];
    if (!dentro(a)) return { ponto: a, i: i - 1 };
    if (dentro(b)) continue;
    let lo = 0, hi = 1;   // bisseção até 0,5 m
    for (let k = 0; k < 20; k++) { const t = (lo + hi) / 2; if (dentro({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) lo = t; else hi = t; }
    return { ponto: { x: a.x + (b.x - a.x) * lo, y: a.y + (b.y - a.y) * lo }, i };
  }
  return null;
}

// Avança `dist` metros sobre a polilinha a partir de {i, x, y}; devolve o novo estado (fim = true no último ponto).
export function avancar(pontos, e, dist) {
  let { i, x, y } = e;
  while (dist > 0 && i < pontos.length - 1) {
    const b = pontos[i + 1], d = Math.hypot(b.x - x, b.y - y);
    if (d <= dist) { x = b.x; y = b.y; i++; dist -= d; } else { x += (b.x - x) * dist / d; y += (b.y - y) * dist / d; dist = 0; }
  }
  return { i, x, y, fim: i >= pontos.length - 1 };
}
