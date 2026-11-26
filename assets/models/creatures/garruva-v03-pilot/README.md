# Wildhaven — Garruva v03 | blockout anatômico facetado

**Estágio:** revisão artística, sem aprovação. Modelo 3D real do Garruva **réptil terrestre necrófago**, nunca a antiga ideia de ave. Segue o padrão low-poly de planos definidos do Torvardo v03, Raizauro v03 e Mastélio v03.

## O que está implementado

- Arquivo binário `garruva-v03-anatomy-blockout.glb`, glTF 2.0.
- Um mesh renderizável composto de volumes anatômicos poligonais, sem soft shading global, sem SDF/marching-cubes e sem aparência de massa orgânica uniforme.
- Crânio comprido, linha de dentes afiados, maxilar pronunciado, olhos âmbar em cavidades, narinas laterais, garganta ferrugem; tronco reptiliano, dorsal com escamas integradas e cauda longa.
- Quatro membros com cotovelos, tornozelos e dedos/garras separados; pernas de marcha em vez das patas escavadoras do Raizauro.
- Cores naturais por face e normais planas no mesh exportado.
- Três screenshots de perfil, frente e três-quartos **renderizados do GLB importado**, com composição e comparação com o GLB v02.
- `manifest.json` documenta triângulos, bytes, checksum SHA256, número de malhas, características visuais e estado de aprovação.

## Como reproduzir

Python 3.12+ com numpy 2.3.5, trimesh 4.11.1, vtk 9.6.2 e pillow 11.3.0. Linux sem display usa `xvfb-run`:

```bash
python3 assets/models/creatures/garruva-v03-pilot/source/build.py
xvfb-run -a python3 assets/models/creatures/garruva-v03-pilot/source/render.py
python3 assets/models/creatures/garruva-v03-pilot/source/validate.py
python3 assets/models/creatures/garruva-v03-pilot/source/compare.py
```

A comparação V02 × V03 precisa da captura real antiga em `assets/models/creatures/garruva/garruva-real-3d-three_quarter-v02.png`.

## Limites desta entrega

- **Sem rig, animação, LOD1/LOD2 ou integração no jogo**. Aprovamos primeiro silhueta e anatomia, depois autoramos movimentos específicos com rig original e LODs.
- O modelo tem partes de superfície geométrica que se interpenetram intencionalmente no blockout; aprovação visual e revisão de deformações ainda são necessárias.
- Contagem baixa de triângulos não garante qualidade; priorizamos silhueta e linguagem facetada da referência oficial.
- V01/V02 e a `main` devem permanecer intactas; não atualizar mapas, ecossistema, vila ou Hunters.