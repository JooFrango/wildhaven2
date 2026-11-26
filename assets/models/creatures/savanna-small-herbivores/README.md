# Wildhaven — Dois herbívoros pequenos da savana (v01)

Pacote de assets independentes: **Velsari e Tarruco redesenhado**, sem tocar em `game/alpha01`, `world/` ou em hexágonos existentes.

| Espécie | GLB | Clipes | Prévia real |
|---|---|---:|---|
| Velsari | `../velsari/velsari-savanna-animated-v01.glb` | 10 | `../velsari/velsari-real-3d-three-quarter-v01.png` |
| Tarruco | `../tarruco/tarruco-savanna-animated-v01.glb` | 10 | `../tarruco/tarruco-real-3d-three-quarter-v01.png` |

**Comparativo real:** `savanna-small-herbivores-real-3d-v01.png` criado com os modelos Three.js de ambos os animais no mesmo estúdio.

## Reproduzibilidade

`source/fauna.mjs`: geometrias mid-poly genuínas, rig e poses dos 20 clipes;
`source/export.mjs`: exportação GLB com transform keyframes;
`source/verify.mjs`: anatomia, movimento, bioma e testes dos 10 clipes por espécie;
`source/viewer.mjs` e `source/index.html`: estúdio 3D com inspeção de animações;
`source/capture.mjs`: capturas reais em Chromium/Three.js/WebGL.

```sh
cd assets/models/creatures/savanna-small-herbivores/source
npm install
npm run test
npm run build
npm run export
npx playwright install chromium
npm run capture
```

**Escopo visual:** malhas geométricas reais (não ilustrações). A aprovação conceitual não garante que o resultado procedural represente perfeitamente todos os traços da arte; a etapa v01 é para avaliação das proporções, da anatomia e da biomecânica. Os movimentos são in-place e os biomas de prévia são cenários de teste, não o mapa oficial.
