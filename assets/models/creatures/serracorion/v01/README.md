# Wildhaven — Serracórion v01 (nome provisório)

Criatura: predador blindado do Mar de Dunas. Referência: arte conceitual aprovada de cabeça baixa, presas, olhos encastrados, pinças gigantes, seis membros locomotores articulados, escudos elevados e cauda recurvada com lâmina distal.

## Situação
- Conceito: aprovado pelo responsável.
- Blockout estático: exportado e reimportado; **revisão artística pendente**.
- Rig, animações, LOD1/2, VFX e integração no jogo: não iniciados.
- Referências morfológicas do Wildhaven: Torvardo v03, Mastélio v03, Garruva v03.

## Entregáveis
- `serracorion-v01-anatomical-blockout.glb`: geometria real original GLB 2.0 e pintura UV embutida.
- `textures/serracorion-v01-painted-uv.png`: atlas UV raster de 2048x2048, cor e detalhes somente em pixels.
- `previews/*-perfil.png`, `*-frente.png`, `*-tres-quartos.png`: capturas reais da geometria reimportada pelo vtkGLTFImporter. O renderizador aplica o PNG de mesmo atlas sobre as UV reais reimportadas.
- `previews/*-superior.png`: revisão superior auxiliar.
- `manifest.json`: contagem de triângulos, SHA-256, tamanho, dimensões e aprovação.
- `source/build.py`: gerador reproduzível com malha e textura originais.
- `source/render.py`: importação e capturas de GLB via VTK.
- `references/concept-approved.png`: imagem aprovada no chat.

## Anatomia e decisões
- Corpo facetado de seção variável, cabeça em cunha, mandíbula inferior separada com cavidade oral e dentes.
- 3 pares de patas locomotoras com coxas, joelhos, tíbias e garras; 1 par de membros robustos terminando em pinças grandes.
- Fileira dorsal de escudos físicos e espinhos protetores; cauda de 12 seções com arma terminal em foice.
- Polígonos extras apenas para estruturas tridimensionais reais, **nunca** para manchas, bandas de cor ou pinturas.
- Um único material PBR, textura albedo original embutida, aspecto fosco, sem normal map exigido.
- A forma ainda pode sofrer ajustes após revisão específica dos 3 ângulos.

## Build
Python 3.13, numpy 2.3.5, Pillow 12.3.0, trimesh 4.11.1, vtk 9.6.2. Executar na raiz: `python source/build.py` e `xvfb-run -a python source/render.py`. O screenshot sai do arquivo GLB exportado e reimportado, não do gerador em memória.

## Avaliação
Comparar com arte conceitual: proporção de pinças, cabeça dentada, escudos dorsais e curvatura da cauda. Modelo é uma interpretação geométrica simplificada para aprovação, não uma réplica perfeita de cada detalhe orgânico do desenho.
