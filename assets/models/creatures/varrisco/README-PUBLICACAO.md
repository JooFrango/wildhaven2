# Varrisco — Wildhaven (etapas versionadas)

Uma espécie de carnívoro bípede médio, compartilhada entre savana e deserto.
Conceito v01 aprovado. Modelagem segue Torvardo v03, Mastélio e Garruva.

- `v01/`: blockout real estático, fontes, manifesto e três renders reimportados.
- `v02/`: v01 preservado como anatomia-base, GLB `varrisco-animated-v02-LOD0.glb`, 24 juntas com skinning por pesos, 17 clipes embutidos, 3 renders do GLB e GIFs de reprodução da malha animada avaliada a partir do próprio GLB.

## Reproduzir

`pip install numpy trimesh scipy vtk pillow`

`python v01/source/build.py && python v01/source/render.py && python v01/source/validate.py`

`python v02/source/build_animated.py && python v02/source/render_animated.py && python v02/source/validate_animated.py`

Os clipes são in-place; deslocamento no mundo, terreno/IK, colisões, ecologia e gameplay não estão integrados. Os pés podem deslizar na animação de solo plano; a validação não comprova IK. Não mesclar automaticamente, manter PR em revisão artística.
