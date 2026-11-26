> **Status atual — Rocantraz v04:** modelo 3D **bípede** aprimorado em anatomia e biomecânica, com duas variantes (florestal e desértica), **12 animações reais em cada GLB**, tendões modelados, regiões de articulação mais integradas, transferência de peso e cinemática inversa dos membros inferiores para altura de apoio. Fonte em `assets/models/creatures/rocantraz-v04/source/`; GLBs, imagens reais e manifesto auditável em `assets/models/creatures/rocantraz/`. A v03 foi preservada; **nada foi integrado à Alpha ou à IA ecológica**.

> **Atualização v03:** o Rocantraz foi remodelado como um **predador ápice estritamente bípede**, com dois membros inferiores portantes e dois braços de ataque menores. Existem duas variantes, florestal/montanhês e desértica, com **12 animações reais em GLB por variante**. O pacote fica em `assets/models/creatures/rocantraz/`, com prévias verdadeiras de Three.js/WebGL, código-fonte em `assets/models/creatures/rocantraz-v03/source/` e manifesto de validação. Esta mudança é somente de **assets**; não cria spawn, IA ou integração ao jogo.

# Rocantraz — espécie rara predadora de topo

**Status:** modelo e animações em `../../assets/models/creatures/rocantraz/`; planejado, ainda não integrado à Alpha.

## Ecótipos
- Floresta e montanhas: ocultação entre árvores e rochas, emboscada curta; revestimento verde-musgo e líquens.
- Deserto e cânions: vigilância de cristas e dunas, atividade crepuscular e investidas; armadura de tons arenosos.

## Parâmetros de projeto (estimativas fictícias)
- Comprimento: 8–12 m; altura: 4–6 m; massa: 6–12 t.
- Campo de visão horizontal: cerca de 270°; detecção olfativa e auditiva elevada.
- Caminhada 4–8 km/h; sustentada 20–30 km/h; explosão 40–55 km/h por 4–7 segundos.
- Territorial, solitário e muito raro, com grandes áreas de vida.
- Dieta: herbívoros grandes, carnívoros intermediários e carniça; evita perseguições longas.
- Comportamentos: patrulha, detecção, espreita, investida, mordida, ataque com garras, rugido, descanso.

Valores sujeitos a revisão ecológica e balanceamento. Fonte detalhada: `../../assets/models/creatures/wildhaven-threejs-source/src/creatures/rocantraz.ts`.

**Importante:** não introduzir Rocantraz no jogo sem decisão de integração posterior.
