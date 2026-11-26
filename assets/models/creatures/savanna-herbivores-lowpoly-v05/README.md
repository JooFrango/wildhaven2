# Wildhaven · 4 herbívoros de savana — baixo orçamento de polígonos

**Estado:** arquivos GLB reais produzidos e validados estruturalmente. Os três modelos novos ainda requerem APROVAÇÃO ARTÍSTICA. O Talvero v04 já foi aprovado como base; a otimização LOD0 preserva sua forma. Nenhum destes assets foi integrado à Alpha 0.1, ao ecossistema ou aos mapas.

## Modelo e animações (LOD0 de referência)

| Animal | Triângulos LOD0 | Clipes glTF 2.0 | Juntas | Design |
|---|---:|---:|---:|---|
| Talvero | 25.247 | 10 | 17 | pastador corredor, crina escura e manchas claras |
| Rambrél | 22.426 | 11 | 17 | navegador de acácias, chifres recuados, crina e pescoço alto |
| Rambrél-das-Chapadas | 24.627 | 11 | 17 | subespécie gigante, corpo/altura próprios e chifres ampliados |
| Turvagal | 21.909 | 11 | 17 | corpo pesado, placas dorsais reais e alimentação ribeirinha |

**Atenção:** números acima são da geração experimental local. O manifesto do build em GitHub Actions será a referência autoritativa para os binários efetivamente publicados. Distâncias LOD e limites de triângulos são alvos de performance sujeitos a avaliação de tela real.

## Arquivos

Cada animal contém:
- `id-savanna-animated-{v03|v05}-LOD{0,1,2}.glb`: três GLBs REAIS com animações e rig embutidos, propriedades de superfície normais, cores por vértice e pesos de skinning.
- `id-real-3d-{side,front,three_quarter}-lowpoly-v05.png`: três capturas de **geometria real carregada do GLB final**, via VTK, não concept art gerada por IA.
- `id-lowpoly-manifest-v05.json`: SHA-256, bytes, número de malhas, triângulos, clipes e redução relativa.

Geradores e teste: `assets/models/creatures/savanna-herbivores-lowpoly-v05/source/`.

## Otimização

Malha anatômica de corpo contínuo, detalhes de silhueta em geometria 3D e pequena variação de cores com pintura por vértice. O algoritmo usa **quadric decimation** na superfície exportada, limpa faces degeneradas e mantém estrutura de joints e clipes glTF. Normais são recalculadas; pesos e cores são reprojetados em cada LOD. Três níveis servem a distâncias e dispositivos distintos.

O teste de perfil no Talvero comparando a renderização original v04 local contra LOD0 local produziu ~94,6% de interseção/união de silhuetas, com redução de ~77,7% da contagem de triângulos. Isso **não garante** que o visual seja idêntico em todos os ângulos ou poses, e ainda precisa de avaliação em execução real.

## Reproduzir

Na raiz do repositório:

```
python3 -m pip install numpy==2.2.6 scipy==1.15.3 scikit-image==0.25.2 trimesh==4.11.1 vtk==9.6.2 pillow==11.2.1
xvfb-run -a python3 assets/models/creatures/savanna-herbivores-lowpoly-v05/source/build_all.py --root .
python3 assets/models/creatures/savanna-herbivores-lowpoly-v05/source/validate.py --root .
python3 -m http.server 8000
```

Abrir `http://localhost:8000/assets/models/creatures/savanna-herbivores-lowpoly-v05/viewer/` para reproduzir clipes e comparar os LODs em Three.js; conexão à internet necessária para carregar o Three.js via CDN.

## Limitações

- Os 43 clipes são movimentos próprios exportados em glTF, mas sem root motion físico, percepção, navegação e IK em terreno irregular.
- A reconstrução anatômica 3D foi procedimental; a fidelidade à ilustração aprovada ainda deve ser avaliada pelo artista.
- A redução de polígonos minimiza superfície, **não** garante automaticamente baixo custo de draw calls ou materiais. A otimização de rig e materiais no navegador exige benchmark adicional.
- Preservar arquivos v01/v03/v04 e nunca substituir ativos anteriormente aprovados sem revisão do responsável.