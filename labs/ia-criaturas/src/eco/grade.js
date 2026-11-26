// Grade espacial uniforme: achar os vizinhos dentro de um raio sem comparar todos contra todos.
//
// Requisito que manda no desenho: a simulação é determinística e o hash do mundo depende da ORDEM em que
// os pares são visitados (somas de ponto flutuante não são associativas). Por isso a consulta devolve
// ÍNDICES DA LISTA EM ORDEM CRESCENTE — exatamente a ordem da varredura completa que ela substitui.
// Trocar a varredura pela grade não muda nenhum resultado; só deixa de olhar quem está longe.
const CELULA_PADRAO = 16;

export function construirGrade(lista, celula = CELULA_PADRAO) {
  const n = lista.length;
  if (!n) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const a = lista[i];
    if (a.x < minX) minX = a.x; if (a.x > maxX) maxX = a.x;
    if (a.y < minY) minY = a.y; if (a.y > maxY) maxY = a.y;
  }
  // Um animal com coordenada inválida derrubaria a grade inteira; os invariantes acusam o caso real.
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
  const nx = Math.max(1, Math.floor((maxX - minX) / celula) + 1);
  const ny = Math.max(1, Math.floor((maxY - minY) / celula) + 1);
  const baldes = new Array(nx * ny);
  for (let i = 0; i < n; i++) {
    const a = lista[i];
    const cx = Math.min(nx - 1, Math.max(0, Math.floor((a.x - minX) / celula)));
    const cy = Math.min(ny - 1, Math.max(0, Math.floor((a.y - minY) / celula)));
    const k = cy * nx + cx;
    if (baldes[k]) baldes[k].push(i); else baldes[k] = [i];
  }
  return { lista, celula, nx, ny, minX, minY, baldes };
}

// Índices dos candidatos cujas CÉLULAS tocam o quadrado de lado 2·raio centrado em (x, y), em ordem
// crescente. É uma peneira grossa de propósito: quem chama ainda mede a distância real.
export function vizinhos(g, x, y, raio, saida = []) {
  saida.length = 0;
  if (!g) return saida;
  const { celula, nx, ny, minX, minY, baldes } = g;
  const i0 = Math.max(0, Math.floor((x - raio - minX) / celula));
  const i1 = Math.min(nx - 1, Math.floor((x + raio - minX) / celula));
  const j0 = Math.max(0, Math.floor((y - raio - minY) / celula));
  const j1 = Math.min(ny - 1, Math.floor((y + raio - minY) / celula));
  let ordenado = true, ultimo = -1;
  for (let j = j0; j <= j1; j++) {
    const base = j * nx;
    for (let i = i0; i <= i1; i++) {
      const b = baldes[base + i];
      if (!b) continue;
      for (let k = 0; k < b.length; k++) {
        const v = b[k];
        if (v < ultimo) ordenado = false;
        ultimo = v;
        saida.push(v);
      }
    }
  }
  // Consultas de uma célula só (ou cujos baldes já saíram em ordem) dispensam a ordenação, que é a parte
  // cara da consulta em população alta.
  if (!ordenado && saida.length > 1) saida.sort((a, b) => a - b);
  return saida;
}
