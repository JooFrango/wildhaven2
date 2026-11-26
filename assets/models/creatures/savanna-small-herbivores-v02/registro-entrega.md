# Registro de entrega — Wildhaven: Sevilho e Arbélio v02

## Identificação, base e escopo

- Data: 2026-11-09.
- Repositório: `carioca1111/wildhaven`.
- Branch: `wildhaven-sevilho-arbelio-faceted-v02`, baseada em `wildhaven-small-savanna-herbivores-animated-v01` (SHA-base `26c4763913c75e3cac256b42e6eeb2495bd5d4fa`).
- Solicitação: continuar a fauna em lotes de até dois animais, preservando as referências aprovadas e a linguagem low/mid-poly de planos firmes.
- Espécies: Sevilho e Arbélio; revisão artística/geometria v02 sobre a rigagem animada v01.
- Escolha da base: v01 já contém GLBs dos dois animais com três LODs, onze clipes e conceito aprovado. Raizauro/Mastélio/Garruva v03 são blockouts ainda não aprovados para rig/animação e não foram modificados. Cervalume e Lobrapedra permanecem removidos.
- Fontes: `source/refine_pair.py`, `source/capture_real.py`; reutilizada `savanna-small-herbivores-v01/source/generate.py`.

## Modelos 3D reais exportados

| Arquivo em `assets/models/creatures/<id>/` | Bytes | Triângulos (índices / 3) | SHA-256 dos bytes remotos |
| --- | ---: | ---: | --- |
| `sevilho-savanna-faceted-v02-LOD0.glb` | 555792 | 5006 | `3f7f5748c3339f07e218c290d1f3b2d93a940640d98dc05df0ad8a4d681e0ea0` |
| `sevilho-savanna-faceted-v02-LOD1.glb` | 431292 | 3524 | `461d6f384bcb8e05f0a63b3cb4824cf6b242320a4648837b7a869228920444bc` |
| `sevilho-savanna-faceted-v02-LOD2.glb` | 343568 | 2480 | `ffc472f480b4e4e25b29b28f8bfb7d61990dafa78f69ea206586779d6447d3dc` |
| `arbelio-savanna-faceted-v02-LOD0.glb` | 549124 | 5012 | `f3fcb4e9753e32e2fcbd41b4c2d1d1b5b326824b450cbae1028023276d991f64` |
| `arbelio-savanna-faceted-v02-LOD1.glb` | 424760 | 3532 | `1be18924de7c476b3cdfd84d8a81f15176c01694c9cbbcdb78641b09fc03055e` |
| `arbelio-savanna-faceted-v02-LOD2.glb` | 353176 | 2680 | `cb0925de4bd8bddf25b2d5b9924a65a3688fe94ffa361cc902280ac5bca939a6` |

**Publicação e confronto remoto:** após GitHub Actions [#42647056547](https://github.com/carioca1111/wildhaven/actions/runs/42647056547) concluir com sucesso, cada GLB publicado foi recuperado via conector GitHub como conteúdo base64; decodificação e SHA-256 independentes confrontados com os seis manifestos da branch — **6/6 idênticos**. Essa verificação recuperou os binários reais do GitHub, não apenas listagens de árvore.

## Verificação técnica

- **Exportação e checagem estrutural:** GitHub Actions passou com `glTF 2.0`, 6 GLBs, 3 LODs por espécie, 11 animações não vazias para cada arquivo, `skins = 0`.
- **Contagem de triângulos:** soma de índices de primitivas dividida por 3, *definições de malha*; não foi medida contagem de instâncias desenhadas em runtime.
- **Nós de transformação / ossos:** Sevilho: 20 nós, 19 nós de malha; Arbélio: 18 nós, 17 de malha. **0 joints ponderados e 0 skins.** Animações por hierarquia rígida; nomes de clipe v01 preservados.
- **Clipes Sevilho:** idle, walk, scurry, hop, forage, store_seed, sniff, alert, flee, rest, death.
- **Clipes Arbélio:** idle, walk, climb, leap, grip, forage, balance, alert, flee, rest, death.
- **Pés, loops e deformação:** ainda requerem teste de playback real em viewer interativo; sucesso estrutural não é prova de locomoção correta. Movimento in-place, sem IK de terreno e sem skinning ponderado.
- **Escala:** unidade herdada da v01; metros e apresentação in-game não calibrados.

## Evidência visual

- Prancha composta: `previews/Wildhaven_Sevilho_Arbelio_Real_GLBS_v02.png`.
- Capturas individuais: `previews/{sevilho,arbelio}-v02-real-GLB-{side,front,three_quarter}.png`.
- Método: `vtkGLTFImporter` importando o **arquivo GLB efetivamente exportado** no job, câmera paralela, luzes simples, fundo cinza/bege; sem imagem de IA. Todos os seis renders criados e publicados.
- Comparação visual: planos anatômicos mais firmes, orelhas de malhas poligonais e normas por face. Não foi feita avaliação visual independente pelo usuário. Não declarar fidelidade definitiva.

## Estados independentes

| Dimensão | Estado |
| --- | --- |
| Produção | 6 GLBs v02, manifestos, fonte e renders reais gerados |
| Técnica | GitHub Actions passou; hashes remotos dos 6 GLBs confirmados; playback de clips pendente |
| Arte | **Em revisão; aprovação do modelo v02 pendente** |
| Publicação | Publicado na branch, não na main |
| Integração | **Fora do jogo** (Alpha/ecossistema não modificados) |

## Próximo passo

Abrir a prancha de GLBs reais e revisar especialmente rosto, inserção dos membros e cauda de ambos; corrigir observações visuais, depois testar animações e contato dos pés nos três LODs. Não substituir v01 sem aprovação explícita.
