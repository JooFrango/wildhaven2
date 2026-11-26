# Quedravo v02 — blockout com 2.000 triângulos

**Estado:** conceito aprovado; forma/otimização sob revisão do diretor. Sem rig, skinning, clipes ou integração na Alpha.

## Mudanças

- Redução **6.852 → 2.000 triângulos** (−70,81%) mantendo envergadura **11,0365 m**.
- **9 grupos de malha / 1 material PBR / atlas UV 1024²** original *idêntico byte a byte* ao v01.
- Dimensões de escala e geometria da cabeça, garras, tronco e trajetória das asas mantidas; secções transversais e detalhe da microanatomia simplificados.
- Penas: parte da geometria duplicada de faces posteriores e penas minúsculas ocultas foi removida; a variação cromática permanece exclusivamente na UV.
- Diferença artística: em closes, as penas ficam mais planas e certas arestas do corpo menos arredondadas. Isto **não** é perda zero de qualidade. O 2K deve ser aprovado visualmente em tamanho de jogo.

## Arquivos reais

- `quedravo_v02_blockout_2000.glb` — GLB binário.
- `quedravo_v02_uv_atlas.png` — mapa UV original preservado.
- `source/build.py` — fonte geométrica e exportador.
- `source/render.py` — renderizador VTK de GLB reimportado.
- `source/validate.py` — checa glTF 2, 2K tris, UV, textura e proporções em comparação ao v01.
- `previews/` — três renders reais, montagem e comparação v01/v02.
- `validation.json` e `manifest.json` — hashes/métricas/limitações.

## Limites e próximos passos

Não usar como LOD1 da criatura final antes da aprovação. Rig/animações/LOD dependem de autorização. Manter v01 intacto e PR em draft. Sem alteração de jogo, mapa ou Alpha.
