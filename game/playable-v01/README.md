# Wildhaven — Playable Build V01

Primeira build jogável de Wildhaven no navegador: entrar na Vila dos Hunters, explorar a região real de Auralis,
encontrar o Varrisco, lutar, vencer ou cair, ver o resultado e recomeçar.

> **Build experimental.** O Hunter usa o rig v13 e os clipes PvE v02 (PRs #92–#97), que **aguardam aprovação
> artística**. O Varrisco é a v11 da linha Monster Hunter (PR #98, em rascunho). Nada desta build aprova assets.

## Iniciar

Requisitos: Node ≥ 22 e um navegador de computador com WebGL2 (Chrome/Edge recomendados).

```bash
cd game/playable-v01
npm install          # three@0.170.0 (runtime) e playwright-core (só para o teste de navegador)
npm run dev          # http://127.0.0.1:5210/game/playable-v01/
```

Os GLBs são lidos do próprio repositório (`/repo/…` → raiz). Nenhum acesso autenticado ao GitHub é usado.

| Comando | O que faz |
|---|---|
| `npm test` | testes em Node: terreno derivado, três sementes de caçada, vitória possível, movimento do jogador |
| `npm run test:navegador` | sessão automatizada em Chrome real: movimento, travessia de fronteira, três caçadas, recursos, desempenho → `resultados/` |
| `npm run build` | gera `dist/` (só os arquivos usados, com `MANIFESTO.json` de bytes e SHA-256) |
| `npm run preview` | serve `dist/` em http://127.0.0.1:5210/game/playable-v01/ |
| `npm run derivar` | regera `public/data/regiao-v01-sim.json` a partir dos GLBs (somente leitura) |

## Controles

| Tecla | Ação |
|---|---|
| W A S D | andar — relativo à câmera; com o Varrisco à vista, relativo ao alvo (como no Hunter Lab) |
| Shift | correr (gasta resistência; sem fôlego, volta a andar até recuperar 30%) |
| J | golpe e combo 1 → 2 → 3; correndo com Shift, salto descendente |
| H | carregar e liberar golpe pesado |
| Espaço | rolamento (A/D escolhem o lado; custa 20 de resistência) |
| K | guarda |
| Mouse / roda | girar câmera (clique para capturar o mouse) / distância |
| Esc ou P | pausa, configurações e controles |
| M | mapa continental de Auralis (272 hexágonos) |

J, H, Espaço e K atuam com o Varrisco percebido: é o controle manual do Hunter Lab, que precisa de um alvo.

## Ciclo de jogo

1. Nasce na praça da Vila dos Hunters (HV_01, fase 1 do PR #99).
2. Objetivo: encontrar o Varrisco, 520 m ao norte (bússola no topo e minimapa).
3. O Varrisco percebe, persegue e ataca com os golpes da linha MH; o HUD mostra a vida dos dois.
4. Vitória → "Volte à vila"; chegar a 20 m da praça encerra a caçada com o registro.
5. Derrota → tela de resultado. **Modo de demonstração:** a sessão recomeça; isso não muda a morte permanente dos Hunters.

Dificuldade (pausa → Vida do Varrisco): **Demonstração 50%** (padrão) ou **Laboratório 100%** (ficha original;
nos testes, mesmo a IA do Hunter com habilidade máxima perde nas cinco sementes medidas).

## O que é real e o que não é

| Item | Estado |
|---|---|
| Terreno da caçada | GLBs reais HV_01, FX_20, ER_18 desenhados; colisão e simulação numa grade de 2 m derivada desses mesmos triângulos (800 × 3 100 m) |
| Hexágonos desenhados | streaming por distância entre HV_01 e os 40 hexágonos de `world/playable-eastern-range-v01/play/region.json` (main) |
| Vila | fase 1 (exterior + interior) com colisão de paredes e pisos da `progression.json` rasterizada na grade |
| Hunter | `hunter_rig_v13_blockout.glb`, clipes PvE v02, espada do GLB na mão |
| Varrisco | `varrisco-animated-v11-LOD0.glb`, IA e golpes de `labs/hunters/src/monstro-varrisco.js` |
| Mapa continental | 272 hexágonos (composição 195 + litoral 77) desenhados em 2D; **sem travessia** fora da região de caça |
| Resistência | camada desta build (a simulação PvE v02 mantém a energia cheia) |
| Recompensa | não há tabela de materiais do Varrisco publicada; a tela final mostra o registro da caçada |

Relatórios: [`docs/INTEGRACAO.md`](docs/INTEGRACAO.md) (bases, SHAs, decisões, limites) e
[`resultados/`](resultados/) (testes, capturas, desempenho).
