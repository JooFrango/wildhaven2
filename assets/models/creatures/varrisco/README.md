# Varrisco — predador bípede facetado (Wildhaven)

## Versões preservadas

- `v01/varrisco-v01-original-chat-blockout.glb`: **arquivo estático original exato** exibido ao usuário, 166.276 bytes, SHA-256 `feef8e39d9f51f3ecdeb63e77db7651cb0463c317f259966791e27aa3beeea48`.
- `v01/varrisco-v01-anatomy-blockout.glb`: reexportação estática feita no ambiente do CI, com manifesto próprio. Não substitui a cópia original.
- `v02/varrisco-animated-v02-LOD0.glb`: GLB 2.0 animado, 667.968 bytes, SHA-256 `774f80944633a65bce0663a0ee8e65a3d8f868270303ccb431fbb63e15b4c678`.

## Varrisco v02

Predador fictício original inspirado na biomecânica de pequenos terópodes. **Uma única espécie/aparência para savana e deserto**. A forma segue a linguagem facetada do Torvardo v03, com Mastélio e Garruva v03 como referências complementares.

- 2.754 triângulos medidos no único mesh do GLB.
- Um skin de pesos, 22 joints, 8.262 vértices com `JOINTS_0` e `WEIGHTS_0`.
- 17 clipes realmente embutidos: `idle`, `walk`, `run`, `stalk`, `turn_left`, `turn_right`, `alert`, `sniff`, `bite`, `claw_slash`, `pounce`, `feed`, `drink`, `threat_display`, `rest`, `hurt`, `death`.
- Eixos: +X para frente, +Y vertical, +Z lateral; unidade proposta: metro.
- `v02/manifest.json`: métricas, durações, loops, SHA-256, bytes e evidência de validação.

## Prévias efetivas

- `v02/previews/varrisco-v02-three-real-glb-views.png`: perfil, frente e três-quartos.
- `v02/previews/varrisco-v02-walk-run-animated-real-glb.gif`: quadros do GLB animado.
- Arquivos PNG individuais para perfil, frente, três-quartos e poses de caminhada, corrida, mordida, salto, ameaça e morte.

**As imagens foram renderizadas por um leitor independente que reabre o GLB exportado, resolve os accessors, matrizes de skin e keyframes nativos, e apresenta a geometria no VTK.** Não são conceitos de IA nem imagens do gerador não exportado.

## Código-fonte

- `v02/source/blockout_source.py`: gerador de geometria v01 preservado.
- `v02/source/build_animated.py`: gera o GLB glTF 2.0 com skin e clipes.
- `v02/source/validate_and_preview.py`: reimporta o binário, verifica pesos/assinaturas/deformação e gera prévias.

Para reproduzir, instale `numpy scipy trimesh vtk pillow`, execute primeiro `python v02/source/build_animated.py`, depois `python v02/source/validate_and_preview.py`. Em Linux headless, use `xvfb-run -a` para a etapa de render.

CI: [execução concluída com sucesso](https://github.com/carioca1111/wildhaven/actions/runs/42661082431).

## Status e limitações

Conceito aprovado e criação de animações autorizada. **Não há aprovação artística específica das animações nem integração na Alpha/gameplay.** As animações são keyframes por joints com skin; não há IK em terreno real, física de contato ou animação contextual de IA. As passadas são predominantemente in-place e podem apresentar deslize de pés. Somente LOD0 foi entregue: a base já contém 2.754 triângulos e nenhum LOD adicional foi declarado/testado. As outras espécies, mapas, Hunters e arquivos aprovados não foram alterados.
