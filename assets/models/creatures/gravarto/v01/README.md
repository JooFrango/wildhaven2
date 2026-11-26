# Wildhaven — Gravarto v01 / anatomia facetada com textura UV pintada

**Escopo:** blockout 3D estático para aprovação da forma. Conceito original de Gravarto aprovado pelo usuário; o modelo ainda NÃO está aprovado. Savana; carnívoro de grande porte inspirado na Megalania.

## Arte e construção

- Torvardo v03 como referência anatômica facetada; Mastélio v03 e Garruva v03 como complementos.
- Animal quadrúpede: tronco largo e pesado, crânio em cunha, mandíbula robusta, quatro pernas de suporte, cinco garras por pé, cauda longa, olhos recessivos e cristas baixas no dorso.
- A geometria carrega apenas estrutura física, placas, dedos, garras, boca e crânio; **manchas, listras, cor de ventre e escamas finas são todas pintadas em mapa UV RGBA** 2048 x 2048.
- GLB inclui o material metálico zero, rugosidade 0.96 e imagem baseColorTexture embutida.
- Sem rig, sem joints/skins, sem animação, sem LOD1/2 nesta etapa. Não integrado ao jogo.
- Modelo procedural com volumes que se intersectam no blockout, necessitando revisão artística antes de qualquer rig.

## Arquivos reais

- `gravarto-v01-anatomy-blockout.glb`: modelo GLB real exportado.
- `texture/gravarto-v01-albedo.png`: textura pintada e exportada no GLB.
- `previews/gravarto-v01-real-glb-profile.png`: captura GLB reimportado.
- `previews/gravarto-v01-real-glb-front.png`: captura GLB reimportado.
- `previews/gravarto-v01-real-glb-three-quarter.png`: captura GLB reimportado.
- `previews/Gravarto_v01_GLb_Real_3_Angulos.png`: composição das capturas reais.
- `source/build.py`, `source/render.py`, `source/validate.py`: scripts reprodutíveis.
- `manifest.json`: métricas e SHA-256.

## Reproduzir

Python 3.12+, `numpy==2.3.5`, `trimesh==4.11.1`, `pillow==12.3.0`, `vtk==9.6.2`.

```bash
python3 source/build.py
xvfb-run -a python3 source/render.py
python3 source/validate.py
```

## Estado e aprovação

Conceito aprovado; **forma GLB em revisão**. Sem refinamento, rig/animação, LODs finais ou implementação na Alpha. PR permanece draft para inspeção da forma. Não sobrepor, modificar ou mesclar as referências históricas.
