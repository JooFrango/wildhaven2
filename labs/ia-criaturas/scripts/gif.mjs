// Codificador GIF89a mínimo (sem dependências): paleta local por quadro (até 256 cores mais frequentes em
// 15 bits, mapeamento ao vizinho mais próximo com cache) + LZW. Usado para gravar quadros reais do renderizador.
export function codificarGif(quadros, largura, altura, fps = 10) {
  const partes = [];
  const b = (...xs) => partes.push(Buffer.from(xs));
  const txt = (s) => partes.push(Buffer.from(s, 'ascii'));
  const u16 = (v) => b(v & 255, (v >> 8) & 255);
  txt('GIF89a'); u16(largura); u16(altura); b(0x00, 0, 0); // sem paleta global
  b(0x21, 0xff, 0x0b); txt('NETSCAPE2.0'); b(0x03, 0x01, 0, 0, 0x00); // laço infinito
  const atraso = Math.round(100 / fps);
  for (const rgba of quadros) {
    const { paleta, indices } = quantizar(rgba, largura * altura);
    b(0x21, 0xf9, 0x04, 0x04, atraso & 255, (atraso >> 8) & 255, 0, 0x00);
    b(0x2c); u16(0); u16(0); u16(largura); u16(altura); b(0x80 | 7); // paleta local de 256
    const pal = Buffer.alloc(768);
    paleta.forEach(([r, g, bl], i) => { pal[i * 3] = r; pal[i * 3 + 1] = g; pal[i * 3 + 2] = bl; });
    partes.push(pal);
    b(8);
    const dados = lzw(indices, 8);
    for (let i = 0; i < dados.length; i += 255) { const n = Math.min(255, dados.length - i); b(n); partes.push(dados.subarray(i, i + n)); }
    b(0);
  }
  b(0x3b);
  return Buffer.concat(partes);
}

function quantizar(rgba, n) {
  const hist = new Map();
  for (let i = 0; i < n; i++) { const k = ((rgba[i * 4] >> 3) << 10) | ((rgba[i * 4 + 1] >> 3) << 5) | (rgba[i * 4 + 2] >> 3); hist.set(k, (hist.get(k) ?? 0) + 1); }
  const top = [...hist.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 256).map(([k]) => [((k >> 10) & 31) * 8 + 4, ((k >> 5) & 31) * 8 + 4, (k & 31) * 8 + 4]);
  while (top.length < 256) top.push([0, 0, 0]);
  const cache = new Map();
  const indices = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const k = ((rgba[i * 4] >> 3) << 10) | ((rgba[i * 4 + 1] >> 3) << 5) | (rgba[i * 4 + 2] >> 3);
    let idx = cache.get(k);
    if (idx === undefined) {
      const r = rgba[i * 4], g = rgba[i * 4 + 1], bl = rgba[i * 4 + 2];
      let melhor = 0, dm = Infinity;
      for (let p = 0; p < 256; p++) { const d = (top[p][0] - r) ** 2 * 2 + (top[p][1] - g) ** 2 * 4 + (top[p][2] - bl) ** 2 * 3; if (d < dm) { dm = d; melhor = p; } }
      idx = melhor; cache.set(k, idx);
    }
    indices[i] = idx;
  }
  return { paleta: top, indices };
}

function lzw(indices, minCod) {
  const limpar = 1 << minCod, fimInfo = limpar + 1;
  const saida = [];
  let acc = 0, nb = 0, tam = minCod + 1;
  const emitir = (c) => { acc |= c << nb; nb += tam; while (nb >= 8) { saida.push(acc & 255); acc >>>= 8; nb -= 8; } };
  let dic = new Map(), prox = fimInfo + 1;
  emitir(limpar);
  let w = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const chave = w * 4096 + k;
    const c = dic.get(chave);
    if (c !== undefined) { w = c; continue; }
    emitir(w);
    if (prox < 4096) { dic.set(chave, prox++); if (prox > (1 << tam) && tam < 12) tam++; }
    else { emitir(limpar); dic = new Map(); prox = fimInfo + 1; tam = minCod + 1; }
    w = k;
  }
  emitir(w); emitir(fimInfo);
  if (nb > 0) saida.push(acc & 255);
  return Buffer.from(saida);
}
