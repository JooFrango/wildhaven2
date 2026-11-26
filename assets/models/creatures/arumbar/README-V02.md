# Arumbar v02 — bisão blindado de alta densidade geométrica

**Status:** revisão 3D detalhada, com oito animações preservadas. Asset separado da Alpha e dos hexágonos existentes.

## Direção artística

O Arumbar é um **bisão blindado fantástico**, grande, raro e majoritariamente solitário, encontrado **apenas nas savanas** de Auralis. A v02 aproxima a silhueta da arte conceitual aprovada: peso visível nos ombros, chifres laterais robustos, cabeça curta e larga, pele ocre, placas córneas sobrepostas, crina avermelhada densa, patas poderosas com cascos fendidos e cauda de ponta felpuda.

## Mudanças em relação à v01

- **Escultura orgânica nova:** malha contínua de alta resolução para tronco, corcova, abdômen, pescoço, crânio e focinho. Modelagem por anéis cúbicos suavizados; não é simplesmente aumentar subdivisões dos antigos icosaedros.
- **Cabeça retrabalhada:** focinho mais curto e largo, músculos das bochechas, pálpebras, narinas reais em volumes escuros, testa e mandíbula mais bovinas; orelhas anatômicas em articulações próprias.
- **Chifres novos:** dois tubos curvos de secções variáveis, com ponta afilada e reforço na base.
- **Armadura de escudos:** osteodermos largos, abaulados e sobrepostos sobre dorso, ombros e pescoço, com bordas geométricas distintas; alguns têm articulação secundária.
- **Crina:** dezenas de mechas geométricas grossas e direcionais, sem uso de sprites/billboards ou texturas simulando volume.
- **Pernas e cascos:** novos volumes contínuos de ombro, coxa, joelho, canela e tornozelo, com ligamentos, faixas e dois cascos por pata, preservando a cinemática do rig anterior.
- **Cauda:** cinco segmentos articulados e tufo com mechas reais.
- **Animação:** mantém os oito clipes, agora com mais amostras e movimentos secundários de orelhas, armadura e crina. É animação por pivôs hierárquicos (transform tracks), **não** skinning deformável.

## Arquivos

- `arumbar-savanna-highpoly-animated-v02.glb` — GLB high-poly e oito clipes.
- `arumbar-manifest-v02.json` — contagem de triângulos, malhas e articulações, SHA-256, comparação de nível de detalhe.
- `arumbar-real-3d-three-quarter-v02.png` — prévia real de três quartos;
  outras imagens de perfil, frente, pastagem e corrida na mesma pasta.
- `source/arumbar-highpoly-v02.mjs` — escultura procedural nova;
  `source/export-v02.mjs` e `source/verify-v02.mjs` — exportação e validação;
  `source/index-v02.html`, `source/viewer-v02.mjs` — estúdio de animações;
  `source/capture-v02.mjs` — screenshots autênticos de WebGL.

## Uso e limitações

A v01 antiga permanece na pasta e serve como **LOD mais simples para distâncias maiores**. A v02 é indicada para visualização de perto e inspeção; ambas devem ser avaliadas quanto ao orçamento de renderização antes de qualquer integração ao navegador.

**Não foram implementados:** LOD automático em runtime, streaming, colisões, IA, spawn, comportamento social, geometria dos hexágonos do mundo e deformação de pele por SkinnedMesh. Animar pivôs pode mostrar separações discretas nas articulações; será necessário aperfeiçoá-las caso o asset seja aprovado como definitivo.

O comportamento ecológico permanece **raro, população pequena, predominantemente solitário e restrito às savanas**. Os parâmetros de ocupação são sugestões de design, não populações efetivas no motor do jogo.
