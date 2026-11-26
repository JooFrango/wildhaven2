# Hunter — revisão de animações v05

Usada pelo mesmo `labs/hunters/hunter-lab.html`. Não é outro laboratório.

GLB: `hunter_combat_v05.glb`, textura embutida, 1.000 triângulos, 19 juntas, um skin, 83 clipes. Malha, rig, materiais, imagens e os dois clipes originais preservados. v04 mantida intacta.

Gerador: `../../scripts/animate-hunter-v05.mjs`. SHA-256 e medidas em `manifest.json`.

Inclui guardas e recuperação por arma, três reações de impacto e ataques com empunhadura derivada de `trajetoria-arma.js`. O runtime adapta o braço à altura exata observada por IK. O GLB contém as animações esqueléticas; arma e escudo são equipamentos separados no visualizador de combate.

Validação técnica e aprovação artística são distintas: revisão experimental disponível para avaliação visual, sem integração automática à Alpha.
