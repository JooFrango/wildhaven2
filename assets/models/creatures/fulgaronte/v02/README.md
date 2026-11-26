# Fulgaronte v02 — reconstrução após reprovação do blockout v01

## Estado de aprovação

- Conceito do Fulgaronte: **aprovado pelo diretor** (15/11/2026).
- Blockout v01: **reprovado visualmente** pelo diretor (15/11/2026): não representava a silhueta do conceito.
- Blockout v02: **nova proposta para avaliação da forma**; não aprovado e não finalizado.
- Refinamento, rig, skinning, animação, VFX elétrico, lógica de combate, simulação e Alpha: **não realizados**.
- v01 preservada sem alterações; revisar apenas na branch `feat/fulgaronte-reconstrucao-fiel-v02`.

## Mudanças geométricas

1. Corpo mais comprido e afunilado, com maior presença de ombros e quadril.
2. Crânio em cunha e focinho crocodiliano alongado com placas cranianas e dentes; mandíbula mais aberta.
3. Três pares de grupos principais de escudos facetados, placas angulares e cristas com uma barbatana dorsal dominante de silhueta legível.
4. Quatro membros com cotovelos, tornozelos e dedos; membranas dos membros anteriores ampliadas.
5. Cauda muscular com nadadeira terminal em dois lobos, em vez de ponta estreita da v01.
6. UVs pintadas em atlas 2048x2048; padrões de coloração não acrescentam malhas geométricas.

## Métricas e limitações reais

- GLB estático: `fulgaronte_v02_blockout_reconstruido.glb`.
- 3.496 triângulos, 1 malha, 1 atlas UV embutido (ver `manifest.json`).
- Comprimento total no bounding box: 16,52 m; altura máxima **com vela dorsal**: 6,02 m; largura: 5,08 m.
- A altura máxima supera os 5 m planejados, por causa da vela dorsal. Ajustar caso o diretor mantenha 5 m como limite absoluto.
- A v02 é **um blockout**, não um esculpido final. A semelhança à arte aprovada ainda requer avaliação do diretor, em particular crânio, proporções e membranas, antes de rig.
- Partes anatômicas foram exportadas unificadas em uma mesh, mas sem garantir superfície soldada/manifold em todas as juntas; o rig futuro pode exigir retopologia.
- `previews/` contém capturas do GLB exportado e reimportado pelo VTK, sem substituição por imagem de IA.

## Gerar, renderizar e validar

```bash
pip install numpy Pillow trimesh vtk
python source/build.py
python source/render.py
python source/validate.py
```

## Publicação e política

Assets em `assets/models/creatures/fulgaronte/v02/`; manter PR em **draft**. Nenhuma alteração na Alpha ou nos GLBs anteriores. Nenhuma aprovação artística da v02 foi inferida automaticamente.
