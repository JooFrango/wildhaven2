# Wildhaven — Gravarto v02 (animações GLB reais)

**Espécie:** Gravarto — predador quadrúpede grande da savana. **Estado:** protótipo animado sob revisão artística, **não** integrado à Alpha/gameplay.

## Relação com a v01

A v02 parte do arquivo exportado `../v01/gravarto-v01-anatomy-blockout.glb`, preservando integralmente os **4.888 triângulos**, facetas, coordenadas UV, escamas com relevo geométrico e o **mapa de albedo pintado de 2048×2048**. As manchas/listras continuam sendo pixels da textura, não polígonos coloridos.

A v01 permanece inalterada. A v02 tem 1 malha, 1 material com textura PNG embutida, **1 skin real de 27 juntas com JOINTS_0 / WEIGHTS_0**, matrizes de bind e 17 clipes glTF. Nenhuma versão LOD1/LOD2 foi criada antes da revisão artística e de testes de desempenho.

## Clipes

`idle`, `walk`, `trot`, `short_sprint`, `stalk`, `turn_left`, `turn_right`, `alert`, `sniff`, `bite`, `tail_sweep`, `threaten`, `feed`, `drink`, `rest`, `hurt`, `death`.

Movimentos autorados considerando massa de lagarto monitor: caminhada quadrúpede com passos diagonais, oscilação tardia da cauda, deslocamento do tórax, mandíbula articulada, mordida e golpe lateral com cauda.

São **animações in-place**, sem controle de colisão, detecção de obstáculos, IK sobre terreno nem integração à IA ecológica. O contato dos pés exige ajuste no motor final e podem existir deslizes ou interpenetrações em poses extremas.

## Arquivos

- `gravarto-v02-animated-LOD0.glb` — GLB 2.0 animado, UV/textura embutida.
- `source/build_animated.py` — exportador reproduzível (lê a v01, não a altera).
- `source/render_stills.py` — três vistas reais via `vtkGLTFImporter` do GLB v02.
- `source/render_animated.py` — GIFs com skinning CPU a partir de **keyframes, pesos, matrizes e textura reimportados do GLB exportado**, renderizados em VTK 3D.
- `source/validate.py` — confere estrutura glTF, textura original, bind, animações e movimento.
- `previews/` — três capturas e GIFs reais de walk, sprint, bite e tail sweep.
- `manifest.json` — SHA256, contagens e teste de movimento.

### Execução

Ambiente Python 3.12+ com `numpy`, `trimesh`, `scipy`, `Pillow`, `vtk`. Em Linux sem display use `xvfb-run` para renderizar.

```sh
python source/build_animated.py
xvfb-run -a python source/render_stills.py
xvfb-run -a python source/render_animated.py
python source/validate.py
```

## Aprovações

O conceito foi aprovado no chat. O pedido posterior de animações autoriza prosseguir com a v02, mas não significa aprovação artística automática de cada pose/clip. O PR deve continuar **draft** até revisão visual. Publicar os assets não os integra à Alpha.
