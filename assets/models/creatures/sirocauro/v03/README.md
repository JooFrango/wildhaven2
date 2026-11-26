# Sirocauro v03 — correção de faces internas e pesos

**Problema comprovado** no GLB v02: 12/123 componentes de geometria com winding invertido, incluindo o tronco, cabeça, pescoço, mandíbula, cauda e pés. Culling do glTF oculta faces exteriores, provocando aparência de buracos e visualização de partes internas, especialmente durante animação. O skinning v02 também atribuía pesos de membros ao torso com base só na posição do vértice.

Esta v03 experimental inverte **apenas índices de triângulos** nos 12 componentes identificados por volume orientado negativo; mantém material com faces simples (não usa doubleSided como remendo), posições originais, UV e textura. Recalcula JOINTS_0 e WEIGHTS_0 por componente anatômico, evitando que o tronco seja puxado pelas pernas ou dentes superiores pela mandíbula inferior. Preserva 41 clipes e o rig de 27 ossos.

Não altera v01, v02 ou Alpha, não há merge automático. Estrutura original ainda é composta de 123 superfícies separadas; melhorar costuras/união topológica e deformação muscular é trabalho futuro. Revisão visual obrigatória antes de considerar problema resolvido.

Reproduzir com Node 22+: `node source/repair-v03.cjs ../v02/sirocauro-v02-rig41-LOD0.glb sirocauro-v03-rig41-malha-corrigida.glb`.
