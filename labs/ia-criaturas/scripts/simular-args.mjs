// Leitor mínimo de argumentos --chave valor (sem dependências).
export function lerArgs(lista) {
  const out = {};
  for (let i = 0; i < lista.length; i++) {
    if (!lista[i].startsWith('--')) continue;
    const chave = lista[i].slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const prox = lista[i + 1];
    if (prox === undefined || prox.startsWith('--')) out[chave] = true;
    else { out[chave] = prox; i++; }
  }
  return out;
}
