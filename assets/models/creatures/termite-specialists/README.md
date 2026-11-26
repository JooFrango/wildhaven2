# Wildhaven — Especialistas em cupins: pacote de quatro modelos 3D

**Objetivo:** armazenar exclusivamente modelos 3D, animações, prévias reais e dados ecológicos; **não alterar `game/alpha01`**.

| Asset | Bioma | GLB | Clipes |
|---|---|---|---:|
| Ferrunco | Florestas | `../ferrunco/ferrunco-animated-v01.glb` | 16 |
| Dunlíngua | Deserto | `../dunlingua/dunlingua-animated-v01.glb` | 16 |
| Pica-Termita de Crista | Planícies, bordas de floresta | `../pica-termita/pica_termita-animated-v01.glb` | 18 |
| Cupinzeiro | Planícies, savana, bordas de floresta | `../../environment/cupinzeiro/cupinzeiro-animated-v01.glb` | 6 |

Prévia comparativa real: `termite-specialists-real-3d.png`. Prévias individuais estão em cada pasta.

## Pipeline
`source/fauna.mjs`: geometria procedural Three.js com rig hierárquico;
`source/export.mjs`: grava GLBs autossuficientes com clipes de animações;
`source/verify.mjs`: testes de anatomia, canais e dados;
`source/ecology.mjs`: simulação de população/consumo/extinção permanente do cupinzeiro (não integrada ao jogo);
`source/index.html` e `source/viewer.mjs`: visualizador interativo;
`source/capture.mjs`: captura WebGL autêntica.

Na pasta `source/`:
```sh
npm install
npm run verify
npm run build
npm run export
npx vite
```

**Limitações:** modelos mid-poly procedurais, ainda passíveis de refinamento artístico. A rigging por pivôs não deforma a pele com pesos. As animações são em lugar fixo; deslocamento, navegação, interações com o cupinzeiro, colisões e IA não foram integrados. Arte conceitual no histórico do projeto não é apresentada como render de malha.
