# Horizonte continental V02 (derivado)

`horizonte-272-v01.glb` é a paisagem distante de baixíssimo custo dos **272 hexes**. Ela é gerada por
`tools/visual/build-visual.mjs --horizon` a partir dos GLBs originais, verificados pelo `fetch-sources.mjs`,
que **não são alterados**.

- Contém relevo e água, simplificados com erro absoluto de 10 m (água: 6 m) e borda travada, sem frestas entre hexes vizinhos.
- A cor fica nos vértices: cor original × média da textura. Onde há copa de árvore, a cor é tingida com a cor média da copa.
- Fica 0,6 m abaixo do relevo real e é ocultado hex a hex quando o hex detalhado está carregado.
- É só apresentação: o servidor Rust e a física WHP1 não usam este arquivo.

Bytes, SHA-256 e triângulos por hex estão em [`horizonte-272-v01.json`](horizonte-272-v01.json).
