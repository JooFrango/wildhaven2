# Tarruco (redesenhado) — Raizeiro da Savana | Wildhaven

**Status:** modelo 3D original e 10 animações reais em GLB, independente do jogo.

A anatomia antiga inspirada em tatu/anta **foi descartada**. A versão aprovada é um pequeno mamífero fantástico de corpo compacto e peludo, **sem carapaça dorsal nem tromba**, com focinho curto, bochechas volumosas, orelhas grandes, três ressaltos ósseos discretos sobre a testa, ombros largos e patas dianteiras adaptadas à escavação, com garras.

- **Escala proposta:** ~0,75 m de comprimento, ~0,38 m nos ombros, ~12 kg.
- **Social:** predominantemente solitário; fêmea e filhotes podem andar juntos.
- **Dieta:** raízes rasas, brotos e frutos caídos.
- **Habitat:** savana com arbustos, terra solta e pontos de sombra.
- **Ecologia:** revolve superficialmente o solo, afetando sementes e regeneração local.
- **Frequência:** moderadamente comum, discreto, atividade preferencial ao amanhecer e entardecer.

## Artefatos

- `tarruco-savanna-animated-v01.glb`: malha real + pivôs animados glTF2.
- `tarruco-real-3d-three-quarter-v01.png`: screenshot real WebGL.
- `tarruco-real-3d-side-v01.png`: screenshot real de perfil.
- `tarruco-real-3d-digging-v01.png`: quadro real da animação de escavação.
- Source: `../savanna-small-herbivores/source/fauna.mjs`.

**Dez animações:** `idle`, `walk`, `trot`, `dig`, `forage`, `alert`, `flee`, `sniff`, `rest`, `death`.

Não há lógica de IA, reprodução, colisões, caminho físico ou spawn no jogo nesta entrega. Os clipes são feitos com articulações rígidas, sem skinning por pesos.
