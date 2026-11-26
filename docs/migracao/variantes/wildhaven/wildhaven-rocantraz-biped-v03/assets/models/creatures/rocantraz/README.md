# ROCANTRAZ — MODELO ATUAL: v03 BÍPEDE

A versão atual deste predador ápice é o **Rocantraz v03, estritamente bípede**, com anatomia reconstruída e **12 animações reais em cada uma das duas variantes**. A versão antiga foi preservada para comparação.

| Variante | Modelo 3D animado | Render real |
|---|---|---|
| Florestal | [rocantraz-forest-biped-animated-v03.glb](./rocantraz-forest-biped-animated-v03.glb) | [Prévia 3D real](./rocantraz-forest-biped-real-3d-detail-v03.png) |
| Desértico | [rocantraz-desert-biped-animated-v03.glb](./rocantraz-desert-biped-animated-v03.glb) | [Prévia 3D real](./rocantraz-desert-biped-real-3d-detail-v03.png) |

**[Prévia real comparando os dois bípede](./rocantraz-biped-forest-desert-real-3d-detail-v03.png)**

- Geometria 3D real, não pintura IA.
- Doze animações em cada GLB: `idle, walk, stalk, run, charge, bite, swipe, roar, feed, defend, rest, die`.
- Fonte: `../rocantraz-v03/source/rocantraz.mjs`.
- Relatório de malha, juntas, SHA-256 e clips: [manifesto v03](./rocantraz-biped-manifest-v03.json).
- [Dossiê completo da nova versão](./README-V03.md).
- **Nenhuma alteração na Alpha jogável; animações hierárquicas, ainda sem skinning por pesos.**

---

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
