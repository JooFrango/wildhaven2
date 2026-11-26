# Wildhaven — Megafauna da savana V02 | Planos definidos

**Status: reconstrução low-poly em revisão artística.** Quatro modelos 3D verdadeiros: Torvardo, Raizauro, Mastélio e Garruva (réptil terrestre necrófago, não ave). Nenhum mapa, Alpha, ecossistema ou outro animal foi alterado.

## Mudança de linguagem visual

A versão V01 era feita com volumes implícitos orgânicos excessivamente arredondados. A V02 substitui o torso por uma malha com seções transversais poligonais (10 lados) e acrescenta malhas próprias para crânio, pescoço, pernas articuladas, cauda e elementos de identidade. Foram modelados escudo craniano e juba em placas do Torvardo, osteodermos geométricos e bico vegetal do Raizauro, orelhas e tromba de duas juntas do Mastélio e crânio alongado com mandíbula e dentes do Garruva.

## Geometria exportada (triângulos reais)

| Criatura | LOD0 | LOD1 | LOD2 | Animações | Juntas |
| --- | ---: | ---: | ---: | ---: | ---: |
| Torvardo | 2.013 | 1.389 | 959 | 12 | 17 |
| Raizauro | 2.159 | 1.495 | 891 | 12 | 17 |
| Mastélio | 1.554 | 1.086 | 806 | 12 | 19 |
| Garruva terrestre | 2.167 | 1.475 | 847 | 13 | 17 |
| **Todos LOD0** | **7.893** | | | **49** | |

A contagem baixa veio da reconstrução geométrica, não de somente decimar um torso de alta densidade. Os 12 GLBs mantêm clipes reais, hierarquia de juntas e um corpo skinned, mas **animações in-place não equivalem a movimentos finalizados com IK e biomecânica comprovada**.

## Pastas

- `models/<id>/<id>-savanna-animated-v02-LOD{0,1,2}.glb`: GLB real da criatura com animações.
- `models/<id>/<id>-manifest-v02.json`: SHA256, número de clipes, triângulos, LODs e limites.
- `previews/<id>-real-3d-{side,front,three_quarter}-v02.png`: capturas do GLB exportado, renderizadas em VTK.
- `previews/Wildhaven_Megafauna_4_Modelos_Reais_v02.png`: comparação das quatro criaturas.
- `source/generate_species.py`: malhas poligonais, chifres, caudas, escamas e características específicas.
- `source/legacy_species.py` e `source/base_v02.py`: suporte reprodutível para hierarquia, clipes e exportação glTF; nenhuma geometria SDF de v01 é usada na V02.
- `source/optimize.py`: reconstrução do GLB dos três LODs sem perder skins/animações.
- `source/render_glb.py`, `source/validate.py`, `source/make_sheet.py`, `source/build_all.py`: geração, prints reais e validação.
- `viewer/index.html`: visualizador Three.js, para selecionar criatura, LOD e clipe.

## Reproduzir

Instale Python 3.12+, `numpy`, `scipy`, `trimesh`, `vtk`, `pillow`, `scikit-image`. No Linux use `xvfb-run`:

```
xvfb-run -a python3 source/build_all.py
python3 source/validate.py
python3 source/make_sheet.py
```

Visualizador: `python3 -m http.server 8000`, e abra `/viewer/` a partir da raiz deste pacote. Quando publicado no repositório, o viewer acessa também as pastas canônicas por espécie.

## Critérios de aprovação pendentes

- Comparar silhueta e proporções com os conceitos originais.
- Revisar, especialmente, postura e contato de pés no Torvardo/Mastélio; deformação das placas do Raizauro; mandíbula e proporções da cabeça do Garruva.
- Conferir clipes extremos reproduzidos no navegador. A validação estrutural não garante biomecânica.
- Aprovação artística explícita antes de mesclar qualquer PR.