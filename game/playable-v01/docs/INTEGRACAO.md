# Relatório de integração — Playable Build V01

Data: 2026-11-21 · Branch: `feat/build-jogavel-auralis-v01` · Repositório: `carioca1111/wildhaven-new`

## Bases auditadas (estado do GitHub em 2026-11-21)

| PR | Branch | Head | Base do PR | Estado | Uso nesta build |
|---|---|---|---|---|---|
| #99 | `feat/vila-hunters-170` | `cef76243` | `main` | aberto, sem revisão | ancestral da base (vila HV_01, fase 1) |
| #100 | `feat/selva-pantano-sul` | `a09d24d3` | #99 | aberto, sem revisão | ancestral da base (composição 195 → mapa 2D) |
| #101 | `feat/litoral-prototipos-v01` | `5655e7f5` | #100 | rascunho | **base geográfica do worktree** (litoral 77 → mapa 2D) |
| #92–#96 | `feat/hunter-pve-v02-e0…e4-combate` | — | cadeia | rascunhos `[AGUARDA APROVAÇÃO]` | rig v13 e clipes PvE v02, via #97 |
| #97 | `feat/hunter-pve-v02-e7-lab` | `2fa7c5b1` | #96 | rascunho | **`labs/` inteiro e Varrisco** importados por arquivo |
| #98 | `feat/varrisco-mh-pve` | `a714cf48` | #97 | mesclado em #97 em 2026-11-20 | Varrisco v11 + IA MH (dentro de `2fa7c5b1`) |

As duas linhas só têm em comum `162e096` (main). Elas **não foram mescladas**: o worktree partiu de `5655e7f`
(#101, que contém #99 e #100) e recebeu, num commit separado (`0af3e96`), os caminhos `labs/` e
`assets/models/creatures/varrisco/` de `2fa7c5b`. Nenhum desses caminhos existia na linha do mundo, então nenhum
arquivo existente foi sobrescrito. Fora de `labs/`, a diferença de #97 para a main é só `assets/models/creatures/varrisco/`.

**Inalterados:** `game/alpha01/`, todos os GLBs e fontes de `world/`, `labs/` e `assets/`. Esta build só lê esses
arquivos. Código novo apenas em `game/playable-v01/`.

## Aprovações (como registradas nos arquivos)

| Asset | Registro | Uso |
|---|---|---|
| Hunter rig v13 (`labs/hunters/assets/hunter-rig-v13/hunter_rig_v13_blockout.glb`) e clipes PvE v02 | PRs #92–#97 em rascunho, títulos "AGUARDA APROVAÇÃO" | experimental, identificado na tela inicial e no README |
| Varrisco v11 (`assets/models/creatures/varrisco/v11/varrisco-animated-v11-LOD0.glb`) | `v11/README.md`: "Aprovada pelo diretor em 2026-11-21 no Hunter Lab (`?pve1=1&pve2=1&mh=1`, PR #98); integração na Alpha fora desta aprovação" | inimigo principal. O briefing dizia "aprovação artística pendente"; o arquivo diz o contrário — confirmar com o diretor |
| Vila HV_01 fase 1 | PR #99 aberto, sem aprovação registrada | ponto de entrada e retorno |

**Alternativa estável ao rig v13:** não há uma que funcione com o Varrisco MH. No laboratório, o modo MH só liga com
`pve2` (rig v13); sem ele o Varrisco volta à IA antiga, que "quase não ataca" (`PVE2-E7-LAB.md`). O Hunter v05/PvE v01
também estão em PRs aguardando aprovação. Por isso a build usa só o rig v13.

## Decisões

1. **Sem Vite/TypeScript.** O Hunter Lab é ES modules sem dependências e já roda no navegador. Reescrever em TS
   duplicaria código testado. A build importa os módulos do lab por caminho relativo; a única dependência de
   runtime é `three@0.170.0` (a mesma versão do lab), servida localmente.
2. **Simulação numa grade derivada dos GLBs.** O núcleo do lab (`labs/ia-criaturas`) trabalha em grade regular. A
   ferramenta `tools/derivar-regiao.mjs` rasteriza os triângulos reais de HV_01, FX_20 e ER_18 com a mesma função
   do lab (`lib-hex-glb.mjs`) numa janela de 800 × 3 100 m, res. 2 m (620 000 células, nenhuma sem terreno).
   As paredes e pisos da vila (fase 1) entram pela própria `blocked()`/`walkingHeight()` de
   `world/hunters-village-v01/runtime.mjs`. O que se vê é o GLB; o que colide é essa grade.
3. **Origem da cena no centro da janela** (`x0 + 400`, `z0 + 1550`, `alturaBase` 878,96 m): coordenadas da cena
   ficam abaixo de ~10 km, sem tremor de float32. As coordenadas continentais seguem nos dados.
4. **Exploração sem inimigo.** O controle manual do lab só move o Hunter com um alvo percebido. `decidirJogador`
   (`src/cacada.js`) chama a decisão do lab e, só quando ela não tem inimigo, troca a intenção por movimento
   relativo à câmera. Com o Varrisco percebido, vale o controle do lab sem alteração (teclas do PR #97).
5. **Resistência.** `semCansacoPve2` mantém a energia do Hunter cheia na simulação. A build adiciona uma
   resistência de interface: correr gasta 16/s, rolar custa 20, recupera 20/s; sem fôlego, Shift é ignorado.
6. **Dificuldade.** Com a ficha original (≈ 800 de vida do Varrisco contra ≈ 100 do Hunter) a IA do Hunter com
   habilidade máxima perdeu nas 5 sementes medidas. O preset padrão "Demonstração" usa 50% da vida do Varrisco
   (nos testes: 2 vitórias e 3 derrotas da IA). "Laboratório (100%)" fica no menu.
7. **Morte.** Modo `letal` na simulação; a derrota mostra o resultado e reinicia a sessão (modo de demonstração).

## Cobertura funcional do mundo

| Camada | Hexágonos | O que funciona |
|---|---|---|
| Região de caça | HV_01, FX_20, ER_18 (canto norte comum) | terreno físico, colisão, vila, Hunter, Varrisco, travessia contínua dentro da janela de 800 × 3 100 m |
| Entorno desenhado | até 21 (dist/), por distância e preset | só visual: streaming e descarte por proximidade; o Hunter não sai da janela de simulação |
| Continente | 272 | mapa 2D (tecla M) com centro e bioma de cada hexágono; sem modelos, sem travessia |

## Fora desta build (lista objetiva)

- Travessia fora da janela de 800 × 3 100 m; streaming da **simulação** (só o desenho faz streaming).
- LODs dos hexágonos vizinhos (não existem para ER/FX; o LOD1 de HV_01 não é usado) e instanciamento de vegetação
  (os GLBs trazem a vegetação mesclada; não há instâncias para reaproveitar).
- Fases 2–4 da vila, interiores navegáveis com precisão (a grade de 2 m fecha portas estreitas), habitantes ativos.
- Fauna ambiental: nenhuma outra criatura com modelo e comportamento prontos foi integrada.
- Golpe no ar sem alvo, travar mira manual, potions/itens, inventário real (sem tabela de recompensa do Varrisco).
- Hospedagem pública: não foi publicada; use o procedimento local do README.
- Áudio só pelos efeitos do lab (`apresentacao-combate.js`), desligado por padrão.

## Testes e medições

Ver [`../resultados/RELATORIO.md`](../resultados/RELATORIO.md).
