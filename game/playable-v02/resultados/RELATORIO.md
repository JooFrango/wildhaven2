# Testes e desempenho — Build V02 (2026-11-21)

Máquina: Windows 11, Intel Iris Xe (GPU integrada), Chrome do sistema (ANGLE/D3D11), 1600 × 900, preset gráfico "baixa".

## `npm test` (Node) — 4/4

| Teste | Resultado |
|---|---|
| Grafo | 272 hexágonos, 738 arestas; contém todas as 506 `shared_edges` da composição 195 e os 148 `contacts` do litoral |
| Quatro Hunters, 360 s | Arvo e Brena caçam (20 ferimentos no Varrisco, Varrisco morto), Caio explora HV_01, Dara fica a no máximo 8,6 m da vila; todos com `controle: 'ia'` |
| Viagem estratégica | Caio vai a ER_25 (sai da janela andando, entra em ER_25) e volta à vila (reentra na simulação detalhada); maior deslocamento num passo < 2 m |
| Salvar / restaurar | save de 0,03 MB (sem o terreno); posições, tarefas, vida e o Hunter em viagem idênticos; IA de monstro do Varrisco reinstalada; a viagem continua |

Testes da V01 (`game/playable-v01`, `npm test`): 6/6 nesta branch.

## `npm run test:navegador` (Chrome real, só cliques na interface) — passou

| Critério | Evidência |
|---|---|
| 1. Câmera isométrica | ângulo polar 0,858 rad ao abrir; W desloca a câmera; W/J/H/K não movem nem fazem o Hunter golpear |
| 2. Selecionar Hunter | clique no cartão; Ctrl+clique seleciona Arvo e Brena juntos |
| 3. Ordem | caçar (grupo), explorar HV_01 (clique no mapa), permanecer na vila; ir até ponto (clique no terreno); ir até ER_25 (clique no mapa) |
| 4. IA executa movimento | depois de trocar a câmera de Arvo para Caio: 151 m, 156 m e 40 m andados em 6 s (8×) por Arvo, Brena e Caio |
| 5–6. Encontro e combate sem controles | "varrisco localizado"; 19 ferimentos no Varrisco, 4 golpes do Varrisco, 3 esquivas; Varrisco morto |
| 7. Resultado | registro "varrisco abatido" e "caçar varrisco: concluída — presa abatida" |
| 8. Trocar tarefa | Caio → voltar à vila; Brena → ir até ponto |
| Navegação entre hexágonos | Dara sai da janela andando e segue em simulação simplificada para ER_25 |
| 9. Salvar e restaurar | botão Salvar → recarregar → "Continuar sessão salva": t = 489,55 s antes e depois (pausado, sem progresso offline); modos, tarefas, posições (< 2 m) e vida iguais; a simulação continua |
| 10. Erros | nenhum erro de página e nenhuma resposta HTTP ≥ 400 |
| Troca de câmera | nenhuma tarefa reiniciou (mesmo instante de início, ou concluída normalmente) |

## Desempenho medido (`navegador.json`)

| Situação | FPS médio | p95 (ms) | Draw calls | Triângulos | Heap JS |
|---|---:|---:|---:|---:|---:|
| 1×, câmera acompanhando Caio | 58,9 | 17,1 | 49 | 1,00 M | 145 MB |
| 8×, mesma cena | 45,1 | 66,8 | 45 | 0,83 M | 140 MB |
| 8×, câmera seguindo Hunter em viagem (hexágonos carregando) | 21,9 | 100 | 43 | 0,99 M | 141 MB |

A queda na viagem vem da leitura dos GLBs (3–7 MB cada) na thread principal quando a câmera entra em hexágonos
novos. Nenhum passo de simulação foi cedido (`passosCedidos: 0`) nas três medições.

## Capturas

`v02-01-inicio.png` · `v02-02-mapa-ordem.png` · `v02-03-acompanhando-caio.png` · `v02-04-combate-observado.png` ·
`v02-05-resultado-cacada.png` · `v02-06-rota-continental.png` · `v02-07-viagem-simplificada.png` · `v02-08-restaurado.png`.
