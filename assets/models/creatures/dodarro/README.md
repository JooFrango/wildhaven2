# Wildhaven — Dodarro V02 (selvagem e com sela)

**Estado:** reconstrução completa do blockout anatômico, aguardando aprovação artística da forma. O conceito está aprovado; a versão V01 foi rejeitada visualmente e continua preservada apenas na branch/PR anterior.

## Escopo de arte

- Duas variantes da mesma espécie: selvagem e com sela de montaria.
- Biomas: savana/planície. Dieta oportunista: frutas e carniça.
- Direção: arte conceitual aprovada do Dodarro; volume facetado/anatômico do Torvardo v03 (PR39), Mastélio v03 (PR42) e Garruva v03 (PR44).
- Corpo e anatomia remodelados do zero: tórax, pescoço em S, crânio, bico curvo, asas em camadas, crista, cauda em leque, coxas e pés com dedos separados.
- A versão montável usa a **mesma base anatômica**, com assento baixo, arreios, manta e alforjes.
- **Cores, bordados e detalhes finos são exclusivamente pinturas no atlas UV**. Somente penas que definem a silhueta e partes funcionais de sela têm geometria própria.

## Arquivos reais nesta pasta

- `dodarro_selvagem_v02_blockout.glb`
- `dodarro_montaria_v02_blockout.glb`
- `textures/dodarro_uv_atlas_v02.png` — atlas 3072 × 2560, embutido nos GLBs.
- `source/build_dodarro_v02.py` — gerador aberto e editável que gera os dois modelos e os manifestos.
- `source/render_dodarro_v02.py` — importa os próprios GLBs e renderiza as vistas reais.
- `previews/dodarro_*_v02_REAL_*.png` — perfil, frente, três-quartos, traseira.
- `previews/dodarro_*_v02_PRANCHA_REAL.png` — prancha dos três ângulos.
- `manifest_selvagem_v02.json`, `manifest_montaria_v02.json`, `manifest_v02.json` — triângulos, bytes, SHA-256, UV, materiais e ausência de clipes.

## Contagem e etapa

- Selvagem: **3.955 triângulos**.
- Montaria: **4.315 triângulos**.
- Atlas 3072 × 2560 e um material nos dois arquivos.
- **0 rigs, 0 skins, 0 clipes, 0 LODs.**
- **Não integrado no jogo** e sem IA de ninhos, ovos ou retorno à vila nesta entrega.

O pipeline do GitHub deve exportar, reimportar, validar e publicar os GLBs reais, seus hashes e renders reais. **Nem testes técnicos nem publicação implicam aprovação da forma.** PR em draft até a revisão artística. Preservar V01 e todas as outras criaturas.
