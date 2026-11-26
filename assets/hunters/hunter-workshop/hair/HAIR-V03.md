# Hunter Workshop — novos cabelos: lote v03

Este lote adiciona **dois estilos inéditos**; não altera curto v02 e moicano v02.

| Item | GLB | Vértices | Triângulos |
| --- | --- | ---: | ---: |
| Médio penteado para trás | hair/swept-back-v01/hair_swept_back_v01.glb | 363 | 486 |
| Rabo de cavalo curto | hair/short-ponytail-v01/hair_short_ponytail_v01.glb | 386 | 560 |

Ambas as peças são GLBs reais com um mesh, um material opaco, atlas UV pintado 256×256 embutido e coordenadas locais do osso Head. Não duplicam o esqueleto do Hunter nem seus clipes Walking/Running. O rabo é curto e não utiliza física ou ossos extras.

Gerador: hair/source/generate_hairs_v03.py; validador: hair/source/verify_hairs_v03.py. CI: .github/workflows/wildhaven-hunter-hairs-v03.yml.

O visualizador usa o GLB do Hunter original enviado pelo responsável, que ainda não foi publicado nesta branch; o usuário pode carregá-lo manualmente no campo de arquivo. As prévias reais reimportadas do GLB final e o modelo base estão no ZIP entregue na conversa.

A publicação binária exige verificação remota de bytes/SHA-256. Aprovação artística e integração à Alpha jogável não são automáticas.
