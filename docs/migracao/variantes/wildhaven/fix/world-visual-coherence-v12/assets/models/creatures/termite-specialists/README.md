# Wildhaven — Especialistas em cupins: pacote de quatro modelos 3D

**Objetivo:** armazenar exclusivamente modelos 3D, animações, prévias reais e dados ecológicos; **não alterar `game/alpha01`**.

| Asset | Bioma | GLB | Clipes |
|---|---|---|---:|
| Ferrunco | Florestas | `../ferrunco/ferrunco-animated-v02.glb` | 16 |
| Dunlíngua | Deserto | `../dunlingua/dunlingua-animated-v02.glb` | 16 |
| Pica-Termita de Crista | Planícies, bordas de floresta | `../pica-termita/pica_termita-animated-v02.glb` | 18 |
| Cupinzeiro | Planícies, savana, bordas de floresta | `../../environment/cupinzeiro/cupinzeiro-animated-v02.glb` | 6 |

Prévia comparativa real: `termite-specialists-real-3d-v02.png`. Prévias individuais estão em cada pasta.

## Pipeline
`source/fauna.mjs` + `source/polish.mjs`: malhas refinadas e rig hierárquico;
`source/export.mjs`: grava GLBs autossuficientes com clipes de animações;
`source/verify.mjs`: testes de anatomia, canais e dados;
`source/ecology.mjs`: simulação de população/consumo/extinção permanente do cupinzeiro (não integrada ao jogo);
`source/index.html` e `source/viewer.mjs`: visualizador interativo;
`source/interaction.html` e `source/interaction.mjs`: três dioramas reais 3D de validação com cupinzeiros e especialistas em escala, sem tocar no mapa jogável;
`source/capture.mjs` e `source/capture-interactions.mjs`: capturas WebGL autênticas de todos os modelos e cenas de interação. Relatório JSON em `feeding-scene-validation-v02.json`.

Na pasta `source/`:
```sh
npm install
npm run verify
npm run build
npm run export
npx vite
```

**Limitações:** modelos mid-poly procedurais, ainda passíveis de refinamento artístico. A rigging por pivôs não deforma a pele com pesos. As animações são em lugar fixo; deslocamento, navegação, interações com o cupinzeiro, colisões e IA não foram integrados. Arte conceitual no histórico do projeto não é apresentada como render de malha.

## Refinamento v0.2 — relatório
A versão anterior v0.1 foi mantida. Ferrunco recebeu peitoral, escudos de focinho, placas e garras extras; Dunlíngua recebeu escamas mais contínuas, reforço facial e dois segmentos distais da cauda; Pica-Termita recebeu raízes de asas, penas, colar e novas cristas articuladas; o cupinzeiro recebeu base mais orgânica e fragmentos separados para erosão.

O ciclo de animação foi ajustado com poses restauradas a cada avaliação, pouso gradual, voo com flexão de asas, língua de alimentação, escavação alternada e fragmentos deslocáveis durante o desmoronamento. As prévias de validação incluem `feeding-scenes-detail-real-3d-v02.png` e uma foto real de cada bioma. O teste automatizado confirma distância entre animal e fonte, números de cupins consumidos, regeneração da colônia viva e extinção permanente em zero. **Cenas de teste independentes, não substituem os modelos reais dos hexágonos do mundo.**
