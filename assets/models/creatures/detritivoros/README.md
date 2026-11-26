# Três detritívoros — modelos 3D Wildhaven

**Origem:** migração do módulo `wildhaven/src/rendering/detritivores.ts` de `carioca1111/chat-`, branch `wildhaven-fauna-detritivores-3d`.
**Estado:** assets separados da Alpha jogável.

| Criatura | Habitat | Adaptação geométrica | Arquivo |
|---|---|---|---|
| Cascarrumo | floresta temperada e tropical | 12 pares de patas, carapaça com 8 placas, antenas | `cascarrumo-animated.glb` |
| Dunébrio | deserto | 3 pares de patas, élitros rígidos, mandíbulas | `dunebrio-animated.glb` |
| Nivélio | neve e montanhas geladas | 3 pares de patas, cerdas, fúrcula de salto | `nivelio-animated.glb` |

## Animações

Sete clipes por criatura: `idle, walk, feed, flee, defend, rest, die`, exportados das mesmas malhas e articulações procedurais que eram usadas no Three.js.

## Fonte

`../wildhaven-threejs-source/src/rendering/detritivores.ts` e
`../wildhaven-threejs-source/tools/export-detritivores.ts`. [Dossiê original](./dossie-original.md).
A oficina Three.js possui `creatures.html` para inspecionar a aparência e alternar movimentos.

**Observação:** no repositório antigo os três existiam como malhas Three.js com animação procedural, não como GLBs prontos; o processo de migração empacota a geometria e os movimentos em arquivos GLB sem redesenhá-los.

Esses modelos são protótipos mid-poly, **não** assets anatômicos finais. Nenhum spawn nem código da Alpha foi migrado.
