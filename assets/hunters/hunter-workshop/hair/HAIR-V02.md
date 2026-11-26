# Hunter Workshop — cabelos v02 (revisão artística)

Esta etapa **refaz somente os dois cabelos** e conserva os arquivos v01 sem alterações. Todos os detalhes de cor e estrias de cabelo são representados em uma única textura UV de 256 × 256 embutida em cada GLB. Nenhuma malha extra é usada para pintura.

## Modelos

| Item | Modelo | Triângulos | Vértices geométricos | Encaixe |
| --- | --- | ---: | ---: | --- |
| Curto facetado | `hair/short-v02/hair_short_v02.glb` | 300 | 199 | osso `Head` |
| Moicano baixo | `hair/mohawk-v02/hair_mohawk_v02.glb` | 188 | 96 | osso `Head` |

### O que mudou
- **Curto:** contorno da testa assimétrico, mechas volumétricas principais e laterais junto às têmporas, superfície em planos facetados em lugar da forma arredondada uniforme anterior.
- **Moicano:** crista inferior, redução do aspecto de espinho único, cume amplo com seção quase plana e raiz estreita acompanhando o formato da cabeça; laterais raspadas permanecem expostas.

## Instruções

O gerador reprodutível é `hair/source/generate_hairs_v02.py` (numpy, trimesh, Pillow). Executar `python assets/hunters/hunter-workshop/hair/source/generate_hairs_v02.py`, seguido do `hair/source/verify_hairs_v02.py`.

No navegador, `viewer/index.html` seleciona a revisão v02. A única instância de esqueleto é a do Hunter: os cabelos são malhas rígidas anexadas ao osso `Head`. Animações `Walking` e `Running` permanecem no modelo original, sem cópias por cabelo.

As **prévias foram renderizadas dos GLBs locais exportados e reimportados** sobre o Hunter original; estarão no pacote entregue nesta conversa. O modelo base `hunter_masculino_1000v.glb` ainda não está publicado no GitHub, mas o viewer aceita a escolha manual desse arquivo.

## Publicação / aprovação

Os GLBs reais são construídos e submetidos pela GitHub Action `.github/workflows/wildhaven-hunter-hairs-v02.yml`. A publicação só é considerada concluída após verificar o binário remoto e SHA-256; um manifesto ou código-fonte não substitui o arquivo. Aprovação artística v02 e integração na Alpha são etapas diferentes e ainda pendentes.
