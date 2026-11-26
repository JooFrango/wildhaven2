# Varrisco v08 — malha do lado certo (54 clipes da v07)

Correção pedida pelo diretor em 2026-11-20 ("a parte de fora está pra dentro"), entregue como versão nova por
escolha dele; a v07 aprovada fica intacta. **Aprovada pelo diretor em 2026-11-20** no Hunter Lab (`?pve1=1&pve2=1&mh=1`, PR #98); integração na Alpha fora desta aprovação.

## Defeito

Na malha `Varrisco_v02_facet_silhouette`, desde a v02, a ordem dos vértices dos 2754 triângulos **e** as
normais apontavam para dentro: volume com sinal −0,3786 m³, ordem e normais concordando em 2754/2754 triângulos.
Sem escala negativa nos nós. Com o material de um lado só (`doubleSided: false`), o three.js mostrava a face
interna da pele. O Blender (Workbench) desenha os dois lados, por isso as folhas de quadros anteriores não
mostravam o problema.

## Correção

`source/build_v08.py` troca o 2º e o 3º índice de cada triângulo e nega cada normal, gravando no mesmo lugar
do BIN. Volume com sinal: **+0,3786 m³**; 2754/2754 triângulos com ordem e normais para fora. O JSON é
idêntico ao da v07 (exceto `asset.generator`) e o BIN só difere nos bytes dos índices e das normais:
posições, cores, juntas, pesos, nós, skin, os 54 clipes e os extras não mudam.

Evidência: `previews/threejs-v07.png` (pele por dentro) × `previews/threejs-v08.png` (pele por fora), viewer
Three.js r160 com o material do GLB; reimportação no Blender 5.3 sem erro (`previews/qa.json`).

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.3\5.3\python\bin\python.exe" assets/models/creatures/varrisco/v08/source/build_v08.py
node --test labs/ia-criaturas/test/varrisco-v08-mh.test.mjs
```

## Fora desta versão

O mesmo defeito existe no Varrisco v02 usado no laboratório ecológico e na Alpha, e em GLBs de outras espécies
(amostra: 30 de 80 arquivos). Não foram alterados aqui.
