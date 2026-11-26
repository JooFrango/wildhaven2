# Wildhaven — Fauna da Neve, cinco blockouts GLB reais v01

Criaturas baseadas nas cinco artes conceituais aprovadas pelo diretor em 16/11/2026: **Casquim**, **Gélfaro**, **Tufrino de Gelo**, **Branquelópe** e **Nevisco**.

## Arquivos publicados e métricas

| Espécie | GLB | Triângulos | Alimentação |
|---|---|---:|---|
| Casquim | [casquim_blockout_v01.glb](../casquim/v01/casquim_blockout_v01.glb) | 1.518 | Herbívoro |
| Gélfaro | [gelfaro_blockout_v01.glb](../gelfaro/v01/gelfaro_blockout_v01.glb) | 1.376 | Carnívoro |
| Tufrino de Gelo | [tufrino_blockout_v01.glb](../tufrino/v01/tufrino_blockout_v01.glb) | 1.038 | Herbívoro |
| Branquelópe | [branquelope_blockout_v01.glb](../branquelope/v01/branquelope_blockout_v01.glb) | 1.332 | Herbívoro |
| Nevisco | [nevisco_blockout_v01.glb](../nevisco/v01/nevisco_blockout_v01.glb) | 1.370 | Herbívoro |

Cada pasta `../<id>/v01/` contém GLB verdadeiro, atlas PNG UV, `manifest.json` com SHA-256/tamanho/triângulos, e pasta `previews/` com três renders reimportados **perfil, frente e três-quartos**, além de uma prancha de comparação.

## Validação técnica

Os cinco GLBs foram exportados como glTF 2.0 binário com textura UV embutida, 1 mesh por espécie, 0 skins, 0 clipes. Todos foram reimportados via Trimesh; os quinze renders foram capturados com VTK `vtkGLTFImporter`, sem substituição por arte de IA. Os hashes Git blob e tamanhos binários publicados coincidiram com as cópias produzidas localmente. Validação de silhouette/artística **não ocorreu**.

## Fonte reproduzível

- `source/build_snow_fauna.py` — gerador de anatomia facetada, atlas e GLB.
- `source/render_snow_fauna.py` — reimportação real e captura de 3 vistas.
- `source/source-tools.tar.xz.b64` — fonte original compactada usada na workflow.
- `manifest.json` — resumo das cinco exportações.
- `.github/workflows/snow-fauna-blockouts-v01.yml` — reconstrução e auditoria no GitHub Actions.

## Aprovação e preservação

**Conceitos aprovados; GLBs em revisão de forma.** Seguir padrão Torvardo v03, Mastélio e Garruva. Detalhes de coloração por textura UV, sem malhas adicionais apenas para padrões de cor. Até 2.000 triângulos por espécie. Não iniciar refinamento, rig, animações ou LODs antes da aprovação da forma. **A Alpha e todos os modelos anteriores não foram modificados.**

Parte da anatomia ainda é formada por cascas fechadas geometricamente sobrepostas; a futura etapa de refino/rig exige revisão de junções, deformações e superfície.
