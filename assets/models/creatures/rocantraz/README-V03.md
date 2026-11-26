# Rocantraz v03 — predador ápice BÍPEDE do Wildhaven

**Status:** asset 3D com duas variantes e 12 animações por variante, sem qualquer integração ao jogo Alpha. Esta é a remodelagem após aprovação da direção conceitual **bípede**.

## Anatomia e silhueta

- **Locomoção:** estritamente bípede; possui **apenas duas pernas portantes**. Os dois braços são menores e servem para agarrar/atacar.
- **Corpo:** tronco vertical, peito largo, ombros musculosos, cintura relativamente estreita, quadril poderoso.
- **Cabeça:** crânio ameaçador com supercílios/órbitas profundas, mandíbula rotativa, dentes distribuídos nas duas arcadas, duas presas laterais e chifres curvos.
- **Braços:** ombros, cotovelos e punhos independentes, três dedos com garras.
- **Pernas:** coxa de grande massa, joelho e tornozelo separados, pata larga com quatro dedos e garras; apoio digitígrado.
- **Cauda:** contrapeso comprido, oito segmentos animados da base à ponta, com proteção dorsal e espinhos.
- **Armadura:** placas ossificadas sobrepostas encaixadas à geometria de costas, ombros e costelas, em vez de pedaços geométricos flutuantes.
- **Materiais:** textura estilizada por superfície e pigmentação, com chifres em gradiente de cor nos próprios vértices (sem imagens falsas).
- **Porte:** altura alvo de 4–6 m e comprimento total de 8–12 m, a conferir na escala final entre criaturas.

## Variantes (mesma espécie)

| Variante | Habitat | Aparência e estratégia |
|---|---|---|
| Florestal/montanhês | Florestas temperadas e tropicais, montanhas | Pele e placas verde-musgo, pequenos líquens geométricos, chifres mais compactos, emboscada |
| Desértico | Desertos, regiões rochosas, cânions | Ferrugem, areia e ocre, chifres ligeiramente mais longos, perseguição curta e caça crepuscular |

**Ecologia:** predador ápice **muito raro**, territorial, geralmente solitário, caça grandes herbívoros, com populações baixas.

## GLBs e animações reais

Os arquivos ficam em `assets/models/creatures/rocantraz/`:

- `rocantraz-forest-biped-animated-v03.glb` — variante florestal.
- `rocantraz-desert-biped-animated-v03.glb` — variante desértica.
- `rocantraz-biped-manifest-v03.json` — contagens reais, tamanhos, joints, clipes, hashes SHA-256.
- `rocantraz-biped-forest-desert-real-3d-v03.png` — comparativo real do Three.js.
- `rocantraz-forest-biped-real-3d-v03.png` e `rocantraz-desert-biped-real-3d-v03.png` — imagens reais das duas variantes.
- `rocantraz-forest-biped-profile-v03.png`, `rocantraz-forest-biped-roar-v03.png`, `rocantraz-desert-biped-charge-v03.png` — quadros reais de animação.

**Doze clipes em cada GLB:** `idle`, `walk`, `stalk`, `run`, `charge`, `bite`, `swipe`, `roar`, `feed`, `defend`, `rest`, `die`.

Trilhas reais de translação, rotação (quaternions) e escala em juntas hierárquicas. A caminhada usa alternância de apoios, flexão do joelho, compensação do tornozelo e deslocamento de massa. Rugido abre mandíbula; mordida projeta a cabeça; swipe movimenta braços e punhos; cauda acompanha a inércia.

## Reproduzir o asset

Na pasta `assets/models/creatures/rocantraz-v03/source/`:

```sh
npm install
npm test
npm run build
npm run export
npx playwright install chromium
npm run capture
```

- `rocantraz.mjs` — criação da geometria, rig, pose e clips.
- `export.mjs` — exportação GLB2 das duas variantes.
- `verify.mjs` — testes anatômicos/biológicos/GLB.
- `index.html` e `viewer.mjs` — estúdio visual com seleção de animações.
- `capture.mjs` — renderização real WebGL em Chromium/SwiftShader.

## Limitações honestas

Ainda é uma escultura 3D procedural mid/high-poly, não uma cópia automática da arte conceitual. O rig é **hierárquico por pivôs**; não possui deformação orgânica em `SkinnedMesh`, pintura de pesos, foot IK em terreno irregular ou simulação física de impactos. Animações são `in-place`, sem movimento de deslocamento no mapa. IA, territórios e encontros são conceitos ecológicos, **não comportamentos implementados**.

**Não foi alterado nenhum arquivo de `game/alpha01` nem `world/`.** O objetivo desta versão é aprovar anatomia e movimento reais antes da integração.
