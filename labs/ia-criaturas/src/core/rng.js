// Gerador pseudoaleatório determinístico (mulberry32) + derivação de fluxos por rótulo.
// Toda aleatoriedade do laboratório passa por aqui: mesma semente => mesmas decisões.

export function hashTexto(texto) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function criarRng(semente) {
  const base = semente >>> 0;
  let estado = base;
  const proximo = () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    semente: base,
    proximo,
    entre: (a, b) => a + (b - a) * proximo(),
    inteiro: (a, b) => Math.floor(a + (b - a + 1) * proximo()),
    chance: (p) => proximo() < p,
    // Fluxo independente: adicionar uma criatura não altera o sorteio das outras.
    derivar: (rotulo) => criarRng((hashTexto(String(rotulo)) ^ Math.imul(base, 2654435761)) >>> 0),
  };
}
