# Duelo de grandes carnívoros — Gravarto × Rocantraz (laboratório experimental)

**Estado: experimental, não aprovado artisticamente.** Esta arena usa **dois GLBs originais publicados** e o kernel de IA v05 existente, não imagens ou vídeo pré-renderizado.

## Participantes reais
- **Gravarto v02:** quadrúpede predador inspirado em lagarto-monitor (anatomia próxima à megalânia), **17 clipes**, **27 ossos**, **4.888 triângulos**. `assets/models/creatures/gravarto/v02/gravarto-v02-animated-LOD0.glb`.
- **Rocantraz v05:** grande carnívoro bípede, cerca de **9 m**, GLB otimizado preservando **12 animações**. `assets/models/creatures/rocantraz/rocantraz-desert-biped-optimized-v05-LOD0.glb`.

## Como assistir
No clone da branch `feat/lab-duelo-gravarto-rocantraz-v01`:

```sh
cd labs/ia-criaturas
npm run dev
```

Navegue para:
`http://localhost:5180/laboratorio-predadores.html?modelo=v04&teste=ia-v05-gravarto-rocantraz`

O botão **GIGANTES — Gravarto × Rocantraz** também aparece na bateria de testes. O cenário inicializa ambos frente a frente, câmera de duelo e IA avançada no núcleo. Eventos físicos como ataques, colisões, dano, agarrões e esquivas são calculados pelo kernel original, não pelo script da página.

## Restrições técnicas
- A ficha de Gravarto é **provisória somente neste laboratório**, pois ainda não possui ficha ecológica oficial. Não foi incluída em `config/eco/indice.json`.
- As animações v05 específicas de gigantes (finta/esquiva/agarrão) **não existem nesses dois GLBs**. O motor usa alguns clipes preexistentes para as transições provisórias. Não afirmar que o movimento especializado já foi produzido.
- O estado físico da v05 e o ritmo cinematográfico ainda precisam de testes de integração e revisão visual; este é um campo para observar e corrigir essas limitações, não a entrega final.
- A fase `combate` do kernel tem limite padrão de 14 s; esta arena respeita esse limite em vez de falsificar uma luta contínua.
- A mudança experimental de incerteza de frenagem é isolada nesta branch e ainda precisa de regressões.
- **Alpha não modificada. PR em rascunho; não mesclar sem aprovação.**

## Regressão
```sh
node --test test/duelo-gravarto-rocantraz.test.mjs
npm test
```

Comparar também sementes 3, 7 e 11 e inspecionar os eventos `ataque_inicio` e `tatico_*` nos resultados do laboratório; relatar resultados reais, inclusive quando a IA ficar passiva.
