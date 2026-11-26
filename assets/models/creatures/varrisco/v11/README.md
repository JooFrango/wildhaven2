# Varrisco v11 — faces viradas para fora em cada parte da malha (55 clipes da v10)

Correção do relato do diretor em 2026-11-21 ("pernas e pescoço ainda dão pra ver por dentro"), entregue como
versão nova; a v10 aprovada fica intacta. **Aprovada pelo diretor em 2026-11-21** no Hunter Lab (`?pve1=1&pve2=1&mh=1`, PR #98); integração na Alpha fora desta aprovação.

## Defeito

A malha (desde a v02) é feita de partes fechadas separadas: 100 na v02 e 129 na v10. Dentro das partes havia
faces com a ordem de vértices trocada em relação às vizinhas (1002 arestas compartilhadas percorridas no mesmo
sentido, em 88 partes), e partes inteiras do avesso (volume com sinal negativo: pescoço, canelas, pés, ombros,
mãos). A v08 inverteu a malha inteira: acertou o tronco, a cauda e a cabeça, mas não essas partes. Com o
material de um lado só, as faces viradas para dentro somem e mostram o interior.

## Correção (`source/build_v11.py`)

Por parte conectada (vértices soldados por posição, 1e-4): orientação coerente propagada pelas arestas
compartilhadas (busca em largura) e, se o volume com sinal da parte for negativo, a parte inteira é invertida.
Cada triângulo invertido troca o 2º e o 3º índice e nega a normal facetada, no mesmo lugar do BIN.
1428 de 3044 triângulos invertidos.

Resultado: 129 partes, 0 bordas abertas, 0 arestas com orientação trocada, volume positivo em todas, normais
seguindo a ordem em 3044/3044. O JSON é idêntico ao da v10 e o BIN só difere em índices e normais: posições,
cores, juntas, pesos, nós, skin, os 55 clipes e extras não mudam (teste `varrisco-v11-mh`).

## Evidências

- `previews/faces-de-tras-ocultas-v10-*.png` × `v11-*.png`: Blender com faces de trás ocultas (como o three.js),
  quadro da corrida — na v10 a coxa e o pescoço aparecem vazados; na v11, sólidos.
- `previews/threejs-v10.png` × `threejs-v11.png`: viewer Three.js com o material do GLB.
- Hunter Lab `?mh=1`: `labs/hunters/resultados/mh-v11/`, 0 erros.

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.3\5.3\python\bin\python.exe" assets/models/creatures/varrisco/v11/source/build_v11.py
node --test labs/ia-criaturas/test/varrisco-v11-mh.test.mjs
```

## Fora desta versão

O mesmo defeito por parte existe no Varrisco v02 do laboratório ecológico e da Alpha (100 partes, 41 do avesso)
e pode existir em outras espécies; não foram alterados aqui.
