# Lagarto-Papagaio v01 — Wildhaven

Blockout estático real baseado na última arte conceitual enviada. Nome provisório. Grande carnívoro da selva; predador de emboscada, quadrúpede, escamas verdes e marcas amarelas, crânio alongado, garras, cauda. Comprimento 5,66 m; 1,61 m de altura; 2,51 m de largura entre patas. Valores de design, não implementados na IA.

- 4.342 triângulos, uma malha, atlas UV embutido, zero skins e clipes.
- 69 componentes fechados independentes; orientação e volume conferidos após reimportação e soldagem apenas para auditoria. Não é uma única superfície soldada. Revisar juntas e possíveis interpenetrações antes de rig.
- Renders VTK reais do GLB exportado: perfil, frente e três-quartos. Forma e fidelidade artística aguardam aprovação. Não integrar na Alpha, nem mesclar automaticamente.
- Distinto do Gravarto (PR 51 no repositório original); a referência conceitual aqui é o predador verde e amarelo da selva.

Reproduzir: `python source/build.py` e `python source/render.py` (numpy, Pillow, trimesh, vtk; ambiente gráfico headless com EGL ou Xvfb).
