# Arenoceto v01 — baleia das dunas (Wildhaven)

## Aprovações e escopo
- Conceito aprovado pelo usuário em 2026-11-09.
- **Aprovação de forma/GLB pendente.** Este é um blockout 3D estático para revisão artística.
- Não há rig, skins, clipes animados ou LOD1/LOD2 nesta etapa.
- Não integrado na Alpha, não altera mapa nem fauna existente.
- Referências de estilo: Torvardo v03 (PR 39), Mastélio v03 (PR 42), Garruva v03 (PR 44).

## Anatomia
- Espécie nova: Arenoceto; megafauna filtradora do Mar de Dunas, agressiva e territorial.
- Comprimento da malha: 37,4 m, de x=-20,3 a +17,1.
- Tronco com seções anatômicas facetadas, crânio largo em cunha, mandíbula de filtragem, estruturas filtrantes, duas nadadeiras escavadoras, escudos de proteção e leme caudal vertical.
- **Textura:** pigmentos, manchas, escoriações e diferenças de cor estão exclusivamente em PNG raster com mapeamento UV (não são polígonos para pintar a pele). Geometria adicional somente para estruturas anatômicas relevantes.
- Textura de fantasia naturalista com baixa metalicidade e acabamento fosco.

## Arquivos gerados pelo CI
- arenoceto-v01-textured-blockout.glb — modelo real com textura PNG embutida.
- textures/arenoceto-v01-handpaint-atlas.png — textura original de pintura raster procedural autoral.
- previews/arenoceto-v01-real-glb-side.png — perfil real.
- previews/arenoceto-v01-real-glb-front.png — frente real.
- previews/arenoceto-v01-real-glb-three_quarter.png — três-quartos real.
- manifest.json — SHA-256, bytes, triângulos, ausência de rig e status.
- source/build.py e source/render.py — código reproduzível e renderizador de reimportação VTK.

## Reprodução
Python 3.13, NumPy 2.3.5, Pillow 12.3.0, trimesh 4.11.1 e VTK 9.6.2.

1. Executar: python source/build.py
2. Renderizar com GLB reimportado: xvfb-run -a python source/render.py
3. Validar manifest.json, SHA-256, atributos UV TEXCOORD_0 e textura embutida no GLB.
4. As imagens de conceito NÃO são capturas da geometria.

## Revisão artística
Aguardar aprovação específica da forma após comparação de perfil, frente e três-quartos. Só então refinar anatomia, rig, animações e LODs em novas versões sem destruir esta revisão.
