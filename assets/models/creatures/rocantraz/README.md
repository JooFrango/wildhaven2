# Rocantraz — predador ápice do Wildhaven

**Origem:** migração de `carioca1111/chat-`, branch `wildhaven-apex-ravakhor-3d`.
**Status:** pacote independente de fauna. Não integrado à versão jogável.

## Variantes (mesma espécie)
- `rocantraz-forest-animated.glb`: floresta temperada/tropical e montanhas.
- `rocantraz-desert-animated.glb`: desertos rochosos, cânions e regiões áridas.

Ambos são GLB glTF 2.0 de malhas tridimensionais reais e **12 animações** com juntas hierárquicas: `idle, walk, stalk, run, charge, bite, swipe, roar, feed, defend, rest, die`.

## Arquivos visuais
- `rocantraz-forest-desert-real-3d.png`: renderização real dos dois modelos em Three.js.
- `rocantraz-forest-desert-real-3d-detail.png`: enquadramento aproximado do mesmo render.

## Fonte e regeneração
Código e exportador preservados em `../wildhaven-threejs-source/`:
`src/rendering/rocantraz.ts`, `src/rendering/export-rocantraz.ts`,
`src/creatures/rocantraz.ts`, `tools/export-rocantraz.ts`.
Os GLBs resultam dessas fontes. [Dossiê anterior](./dossie-original.md).

**Limitações:** a anatomia ainda precisa de refinamento artístico e rig/skinning com deformação orgânica; a malha é mid-poly com pivôs articulados, não uma cópia do conceito ilustrado. **Nenhuma alteração na Alpha**.
