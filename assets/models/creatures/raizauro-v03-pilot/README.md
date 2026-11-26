# Wildhaven — Raizauro v03, blockout 3D real

**Status: revisão artística do blockout; não é modelo completo/animado.**

Reconstrução exclusiva do réptil herbívoro escavador Raizauro seguindo o estilo aprovado do Torvardo v03: superfícies de planos definidos, vértices separados por face para controlar normais e detalhes anatômicos com geometria em vez de texturas falsas. Reproduzível com Python e dependências `numpy`, `trimesh`, `vtk`, `Pillow`.

## Conteúdo
- `raizauro-v03-anatomy-blockout.glb`: malha triangulada, colorida por vértices, 4.822 triângulos, um mesh exportado.
- `manifest.json`: SHA-256, geometria, estado de rig e animações.
- `previews/raizauro-v03-real-glb-{three_quarter,side,front}.png`: screenshots capturados importando **o GLB exportado**, não arte gerada por IA.
- `previews/Raizauro_v03_Preview_GLb_Real_3_Angulos.png`: composição dos três ângulos reais.
- `previews/Raizauro_Comparacao_Real_V02_V03.png`: comparação real com a v02 anterior.
- `source/build.py`, `render.py`, `validate.py`, `sheets.py`: fontes legíveis e reprodutíveis.

## Anatomia e critérios
Tronco blindado largo, placas dorsais facetadas seguindo o eixo das costas, ombros cobertos por escudos, patas dianteiras mais musculosas que as traseiras, quatro garras escavadoras por pata, cauda óssea afilada e cabeça reptiliana de mandíbula pesada e bico córneo recurvo. Cores verde-oliva, areia e ferrugem. Evita forma cilíndrica com espinhos flutuantes e smooth shading global.

## Executar
```bash
python -m pip install numpy trimesh vtk pillow
python source/build.py
xvfb-run -a python source/render.py
python source/validate.py
python source/sheets.py
```

## Limitações e próximos passos
Ainda precisa da avaliação visual do usuário, refinamento de rosto, placas, encaixes e proporções. **Não contém rig, animações nem LODs** por decisão de produção: o bloqueio de silhueta deve ser aprovado antes de skinning e animação. Não integra o gameplay, a IA, os mapas nem a Alpha. Preserva os modelos v01/v02 existentes.