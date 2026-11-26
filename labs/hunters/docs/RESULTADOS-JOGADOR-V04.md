# Medição do Hunter Lab v04

Mesmo laboratório, cenário e sementes para a política anterior e a nova. Máximo de 120 segundos simulados; limite não equivale a vitória. CPU por passo neste host, sem renderização.

| Política | Arma | Seed | Tempo (s) | Desfecho | Acertos/erros | Máx. sequência | Pesados | Esquivas/guardas | CPU p95 (ms) |
|---|---|---|---|---|---|---|---|---|---|
| anterior | lanca | 1 | 96.50 | criatura derrotada | 7/2 | 0 | 0 | 0/0 | 0.367 |
| anterior | lanca | 17 | 48.90 | criatura derrotada | 9/0 | 0 | 0 | 0/0 | 0.418 |
| anterior | lanca | 42 | 92.90 | criatura derrotada | 9/1 | 0 | 0 | 0/0 | 0.449 |
| anterior | espada | 1 | 50.90 | criatura derrotada | 11/1 | 0 | 0 | 0/0 | 0.528 |
| anterior | espada | 17 | 120.00 | limite_de_observacao_120s | 8/12 | 0 | 0 | 0/0 | 0.437 |
| anterior | espada | 42 | 63.15 | criatura derrotada | 12/1 | 0 | 0 | 0/0 | 0.519 |
| anterior | montante | 1 | 120.00 | limite_de_observacao_120s | 7/2 | 0 | 0 | 0/0 | 0.473 |
| anterior | montante | 17 | 120.00 | limite_de_observacao_120s | 6/6 | 0 | 0 | 0/0 | 0.731 |
| anterior | montante | 42 | 120.00 | limite_de_observacao_120s | 2/1 | 0 | 0 | 0/0 | 0.489 |
| v04 | lanca | 1 | 120.00 | limite_de_observacao_120s | 4/1 | 2 | 4 | 2/0 | 0.238 |
| v04 | lanca | 17 | 90.30 | criatura derrotada | 11/1 | 2 | 11 | 2/0 | 0.349 |
| v04 | lanca | 42 | 52.30 | criatura derrotada | 11/1 | 2 | 9 | 0/0 | 0.388 |
| v04 | espada | 1 | 120.00 | limite_de_observacao_120s | 4/4 | 2 | 2 | 3/0 | 0.303 |
| v04 | espada | 17 | 120.00 | limite_de_observacao_120s | 6/4 | 2 | 5 | 0/0 | 0.225 |
| v04 | espada | 42 | 120.00 | limite_de_observacao_120s | 7/3 | 2 | 0 | 0/0 | 0.414 |
| v04 | montante | 1 | 120.00 | limite_de_observacao_120s | 3/3 | 1 | 0 | 0/0 | 0.192 |
| v04 | montante | 17 | 54.55 | Hunter fora de combate | 3/0 | 2 | 0 | 2/0 | 0.200 |
| v04 | montante | 42 | 120.00 | limite_de_observacao_120s | 6/2 | 1 | 0 | 0/0 | 0.208 |

Nem toda abertura permite pesado, terceiro golpe ou bloqueio: contadores zero são mantidos. Guardas reativas e contra-estocada também têm teste controlado para uma preparação longa; os confrontos reais usam os ataques existentes do Varrisco sem alongá-los para favorecer a demonstração.

Vídeos: três armas, semente 17, canvas real, 2×. O relatório browser-final.json registra os clipes efetivamente usados. SwiftShader é renderização em software e não comprova desempenho de uma GPU física. As capturas são amostras reais; a galeria demonstra os outros clipes disponíveis.

Regressão final: 37 testes (23 existentes, 14 novos). Validador GLB: zero erros/avisos. Nenhuma simulação de outro laboratório foi alterada. Fonte da comparação em scripts/measure-jogador.mjs; dados completos e hashes em comparacao.json.
