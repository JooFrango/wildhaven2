# Arenoceto v02 — rig com skinning e 20 animações reais

## Estado
- Espécie: Arenoceto, baleia filtradora e agressiva do Mar de Dunas.
- Conceito v01 aprovado em chat em 2026-11-09; forma/animações v02 continuam em revisão artística.
- Base preservada: branch `wildhaven-arenoceto-v01-uv-blockout`, PR #61.
- Nenhuma substituição dos assets v01, nenhuma alteração no gameplay, mapas ou Hunters.
- Não integrado à Alpha.

## Resultado concreto
- Arquivo `arenoceto-v02-skinned-animated-LOD0.glb`: geometria original v01 e atlas UV originais, mantendo os 2.052 triângulos, 6.156 vértices facetados, 1 mesh, 1 skin e 16 juntas com pesos reais (`JOINTS_0`/`WEIGHTS_0`).
- As juntas do corpo são encadeadas, com pesos interpolados. A mandíbula, as duas nadadeiras e a cauda têm controles específicos.
- São 20 clipes glTF embutidos: `idle`, `swim_sand`, `swim_fast`, `turn_left`, `turn_right`, `dive`, `surface`, `burrow`, `breach`, `filter_feed`, `sift_sediment`, `alert`, `threat_display`, `bellow`, `charge`, `fin_sweep`, `tail_slam`, `hurt`, `rest` e `death`.
- Texturas: o GLB preserva os bytes exatos da textura PNG pintada do v01. Nenhuma mancha ou mudança de cor foi convertida em polígonos adicionais.
- Não foram feitos LOD1/LOD2 nesta etapa.

## Reprodutibilidade e evidência de movimento
- `source/build_rig.py`: gerador de hierarquia de ossos, pesos e amostras de todos os clipes a partir do GLB v01.
- `source/validate_and_preview.py`: analisador **independente do GLB exportado** que lê os canais de animação glTF, calcula as matrizes das juntas e avalia a deformação por *linear blend skinning*, além de gerar as prévias reais.
- `manifest.json`: bytes e SHA-256 do binário, lista de juntas e clipes; `animation-validation.json`: métricas de 20 clipes, checagem dos loops e de textura/malha/UV imutáveis.
- `previews/arenoceto-v02-real-animated-{side,front,three_quarter}.png`: perfil, frente e 3/4 obtidos do GLB v02 em poses animadas.
- GIFs reais de `swim_sand`, `filter_feed`, `breach`, `tail_slam`, `dive` e `threat_display`: renderizados a partir dos dados binários exportados (não são imagens IA).
- `previews/arenoceto-v02-three-real-animated-poses.png`: contato das três vistas.

### Nota do importador VTK
O VTK 9.6 identifica os canais e nomes das 20 animações, mas não aplica corretamente o skinning na malha ao chamar apenas `UpdateAtTimeValue`. Para impedir previews estáticos falsos, o renderizador próprio reinterpreta as matrizes, a hierarquia de juntas, os pesos e os canais **do arquivo glTF exportado**, aplicando a deformação real quadro a quadro e renderizando com o material da textura UV original.

## Aprovações e limitações
- A aprovação artística dos movimentos do Arenoceto v02 está pendente: verificar principalmente articulação da mandíbula, transições das nadadeiras e ondulação axial antes de integrar no jogo.
- Emergência e mergulho deformam e deslocam o animal, mas não simulam fisicamente milhões de grãos de areia ou integram IA, efeitos, colisões de gameplay.
- Antes do lançamento, otimizar LOD1/2, adicionar efeitos de superfície e validar reprodução WebGL na Alpha.
