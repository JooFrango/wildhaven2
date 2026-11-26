# Wildhaven — Serracórion v03 (rig e 20 animações glTF)

**Estado:** rig e clipes técnicos concluídos, aguardando avaliação visual dos movimentos. PR separado, em rascunho. Sem merge automático.

## Base preservada

Base binária v02: `assets/models/creatures/serracorion/v02/serracorion-v02-espinhos-integrados.glb` (PR #75), **sem alterações**. A geometria, o mapeamento UV, os índices de triângulos e os bytes da textura Base Color embutida são comparados byte a byte ao GLB v02 pelo validador independente. Os oito espinhos corrigidos permanecem integrais e não são adicionados polígonos para manchas ou cores.

## Rig real glTF

- 43 juntas hierárquicas: root; corpo central, frontal e traseiro; cabeça, mandíbula, quelíceras; 4 ossos por braço/pinça dianteira; 3 ossos por perna (3 pares bilaterais); 9 ossos para o arco de cauda e lâmina final.
- Skin verdadeiro: `JOINTS_0`, `WEIGHTS_0`, matrizes `inverseBindMatrices`, 4 influências possíveis por vértice, pesos normalizados.
- Malha única, 4.815 triângulos, 14.445 vértices de face facetada, 1 material PBR e 1 textura UV original de 2048 × 2048 pixels.
- GLB inclui os 20 clipes, não são animações feitas apenas em código externo.

## Animações (20)

`idle`, `walk`, `run`, `turn_left`, `turn_right`, `burrow`, `emerge`, `alert`, `threat_display`, `pincer_grab`, `pincer_slam`, `bite`, `tail_sting`, `tail_sweep`, `charge`, `hurt`, `death`, `rest`, `feed`, `sand_dig`.

## Renders e validação

- `source/build_rig.py`: esqueleto real, pesos e exportação glTF com animações.
- `source/validate_and_preview.py`: reimporta o GLB gerado, lê independente do exportador os canais, pesos, hierarquia e materiais, verifica poses, loops, inversas e preservação exata de malha e textura, renderiza quadros realmente deformados do GLB.
- `animation-validation.json`: validações de todos os clipes; `manifest.json`: hashes, juntas e detalhes técnicos.
- `previews/`: perfil, frente, três-quartos, superior, contato de três vistas e GIFs de caminhada, corrida, agarrar com pinças, ferroada, escavação e ameaça, obtidos do GLB reimportado (não são imagens geradas por IA).

## Limites

A versão não traz VFX de areia, física detalhada de solo, sonorização, colisão de ataque, IA de caça, LOD1/LOD2 ou integração ao jogo. O movimento é um primeiro passe técnico que precisa ser avaliado e polido artisticamente antes da Alpha.
