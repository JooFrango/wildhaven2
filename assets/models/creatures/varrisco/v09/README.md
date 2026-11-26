# Varrisco v09 — forma e cores da arte conceitual (rig e 54 clipes da v08)

Pedido do diretor em 2026-11-20 ("mais parecido com a arte conceitual sem zoar as animações"); escopo aprovado
antes da autoria. Referência: `../referencias/varrisco-arte-conceitual.webp`. A v08 aprovada fica intacta.
**Aprovada pelo diretor em 2026-11-20** no Hunter Lab (`?pve1=1&pve2=1&mh=1`, PR #98); integração na Alpha fora desta aprovação.

## O que muda

- **Forma (pose de repouso):** cauda 12% mais longa e afinando até 45% na ponta; focinho em cunha; coxas um
  pouco mais cheias; mãos e garras 28% maiores.
- **Peças novas:** crista de espinhos deitada para trás, da altura do olho até o pescoço (fileira central e duas
  laterais), e garra em foice elevada e curva em cada pé. +162 triângulos (2754 → 2916).
- **Cores por face** (COLOR_0 linear, paleta de 6 tons da prancha): corpo ferrugem/ocre, ventre e garganta
  creme, faixas diagonais e losangos marrom-escuros no dorso, faixas quase pretas na cauda, faixa escura no
  olho e ponta do focinho, pernas marrom-escuras, garras quase pretas. Dentes, olhos e garras originais mantêm
  a cor da v08.

## O que não muda (teste `labs/ia-criaturas/test/varrisco-v09-mh.test.mjs`)

Nós e nomes dos ossos, skin, matrizes de bind e os 54 clipes (canais, tempos, valores e extras). Os 8262
vértices da v08 guardam os mesmos pesos (inclui a correção da cauda da v05); o deslocamento de cada vértice
depende da posição e dos pesos, então a malha facetada não racha. As peças novas têm peso rígido: crista em
`head`/`neck`, garra em foice em `footL`/`footR`. Volume com sinal positivo (malha do lado certo, como na v08).

## Evidências

- `previews/repouso-vs-conceito.png`: perfil, frente e três-quartos do GLB exportado (Blender 5.3, cores por
  vértice) sobre a prancha.
- `previews/threejs-v08.png` × `previews/threejs-v09.png`: viewer Three.js com o material do GLB.
- `previews/*.png` e `qa.json`: rugido, mordida pesada, salto triplo, rabada, chute, vacilo forte, andar,
  correr e queda. Chão e deslize iguais aos da v08 nos mesmos clipes (andar, correr e queda já entravam no
  chão desde a v02/v04).
- Hunter Lab `?mh=1`: `labs/hunters/resultados/mh-v09/`.

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.3\5.3\python\bin\python.exe" assets/models/creatures/varrisco/v09/source/build_v09.py
& "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --factory-startup --python assets/models/creatures/varrisco/v09/source/render_v09_repouso.py
node --test labs/ia-criaturas/test/varrisco-v09-mh.test.mjs
```

## Limitações

- Low-poly facetado com uma cor por face: as escamas da prancha viram variação de tom entre faces, e as faixas
  seguem o contorno dos triângulos.
- De frente, as coxas continuam mais largas que na prancha (volume herdado da malha da v02).
- Os espinhos da crista seguem a cabeça e o pescoço como peças rígidas; nas poses extremas de pescoço podem
  encostar no dorso.
