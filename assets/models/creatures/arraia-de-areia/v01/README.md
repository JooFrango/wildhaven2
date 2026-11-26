# Wildhaven — Arraia-de-Areia v01 (blockout anatômico UV)

**Status artístico:** conceito individual aprovado pelo responsável; **forma 3D em revisão**, sem aprovação do blockout. **Sem rig, clipes ou LODs nesta etapa.** Não foi integrado ao gameplay da Alpha nem aos hexágonos; não modifica criaturas existentes.

## Anatomia / especificações

- Arraia-de-Areia: gigante onívora do Mar de Dunas; pequenas manadas, comportamento defensivo, movimentação por ondulação das nadadeiras no futuro.
- Envergadura de 18 m (Z ±9), comprimento 19,83 m (X -12,6 a +7,23), nadadeiras unidas ao corpo, dorso convexo, ventre achatado.
- Estruturas anatômicas modeladas: cabeça com olhos em cavidades, escudo supraorbital, boca côncava, filamentos queratinosos filtradores, duas presas escavadoras, cristas ósseas e cauda flexível com espinhos protetores.
- **Todo padrão visual, manchas, abrasões, marcas de escamas e diferenças de cor é pintado em pixels de UMA textura Base Color 2048², mapeada em UV**. Nenhuma geometria adicional existe apenas para coloração.
- Um único material PBR metálico=0, rugosidade=0,92, atlas PNG incorporado ao GLB; sem mapas de normal/roughness separados nesta etapa, para minimizar leituras de textura no navegador.
- **6.296 triângulos** (versão de aprovação de silhueta), uma mesh com normais facetadas. Geometria de boca, dentes e espinhos porque esses elementos têm relevo próprio. É um orçamento de protótipo; otimizar só após aprovação da forma.

## Fonte e exportação

- `source/build.py`: monta as faces anatômicas, pinta o atlas raster original, exporta o GLB, reimporta com trimesh e escreve o manifesto com hashes.
- `source/render.py`: importa o GLB exportado no `vtkGLTFImporter` e grava perfil, frente, três-quartos; vista superior adicional. Não usa imagem gerada por IA como evidência 3D.
- `arraia-de-areia-v01-blockout-texturizado.glb`: GLB real, com atlas embutido.
- `textures/arraia-de-areia-v01-albedo-pintado-uv.png`: cópia da pintura UV original.
- `manifest.json`: bytes, SHA-256, triângulos, materiais, envergadura, estado artístico.
- `previews/arraia-de-areia-v01-GLB-real-{perfil,frente,tres-quartos,superior}.png`: capturas do GLB reimportado; `previews/arraia-de-areia-v01-GLB-real-3-vistas.png`: prancha montagem dos 3 PNGs verdadeiros.

## Reprodução

Python 3.13, `numpy==2.3.5`, `Pillow==12.3.0`, `trimesh==4.11.1`, `vtk==9.6.2`.

```bash
python source/build.py
xvfb-run -a python source/render.py
```

Verificação: `manifest.json` confere SHA-256 e tamanho binário; GLB tem `TEXCOORD_0`, um `images` PNG embutido e um único material, zero skins e zero animações. A textura do GLB é comparada pixel a pixel com o PNG original.

## Checkpoint

Aguardar decisão artística **da forma** olhando os três renders reais. Não criar rig, animações, LODs nem mesclar automaticamente o PR. Preservar todas as versões anteriores e o Arenoceto.
