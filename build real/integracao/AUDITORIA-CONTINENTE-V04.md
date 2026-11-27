# Auditoria do continente — Build Real V04

Gerada por `game/build-real-v04/tools/auditoria-continente.mjs` (dados completos por hex em `game/build-real-v04/bench/auditoria-continente.json`) e pelo `wh-sim-check continente` (viagens reais na simulação autoritativa).

## Resumo

| Item | Resultado |
| --- | --- |
| Hexes no manifesto | 272 |
| GLB-fonte presente, bytes conferidos | 272/272 |
| Escala verificada | 272/272 |
| Física WHP1 compilada | 272/272 |
| Visual V04 gerado (chunks + LOD + vegetação) | 272/272 — 10.861.769 triângulos LOD0. 3.155.942 instâncias de vegetação |
| Certificados para travessia a pé | **266** (V03: 223) |
| Exceção marítima (exige transporte marítimo; sem travessia a pé) | 6 |
| Não certificados | 0 |
| Fronteiras (arestas) validadas / rejeitadas / marítimas | 705 / 5 / 28 |
| Maior desnível de emenda entre vizinhos (malha real) | 0.111 m |
| Hexes sem fauna integrável | 87 (costas e regiões glaciais: sem espécie animada com ficha — ver INVENTARIO-CRIATURAS-V04) |

## Os 43 hexes costeiros certificados na V04

Na V03 eles ficavam fora por **vegetação instanciada na GPU sem regra física** (Folhosa, Dossel, Emergente, Palmeira, Figueira de várzea, Arbusto, Juncos, Moita de savana) — o próprio `node-classes-v01.json` exigia "regra de árvore com raio MEDIDO por espécie". A V04:

1. **mediu** o raio do tronco na malha original (`tools/continental/medir-troncos.mjs`: a seção mais estreita entre faixas de 2% da altura nos 40% inferiores);
2. aplicou a esse raio o **mesmo fator da correção visual aprovada** (altura-alvo da família / altura original): as árvores originais têm 100–280 m; o colisor coincide com a árvore desenhada (ex.: Emergente 33,3 m → 4,5 m; Folhosa ~0,85 m), em vez de discos invisíveis de 30 m;
3. recompilou só esses 43 hexes com o compilador ORIGINAL (`--tree-rules`, regras por hex em `data/tree-rules-costeiros-v04.json`), reaproveitando os outros 229 sem cópia (`.generated/physics-272-v04`);
4. rodou o validador ORIGINAL de portais (`--snap-centers lattice`) → `data/relatorio-continental-272-v04.json`: 266 certificados, as mesmas 705 arestas validadas do relatório da V03.

Status: **proposta técnica** (árvores não cortáveis). Revisão do diretor pendente.

## Viagens longas na simulação (sem teleporte, sempre sobre chão compilado)

| Origem → destino | Saltos | Hexes atravessados | Chegada (tempo simulado) | Passo máx. / limite | Ticks sem chão | Espécies no caminho |
| --- | ---: | ---: | --- | --- | ---: | ---: |
| HV_01 (temperate forest) → X3 (Arco e Cânion da Transição) | 5 | 6 | 4.6 h | 0.237 / 0.237 m | 0 | 21 |
| HV_01 (temperate forest) → costa_+03_-04 (praia) | 7 | 8 | 6.6 h | 0.237 / 0.237 m | 0 | 21 |

Grupo de 6 Hunters a pé; mortes no caminho fazem parte da simulação (combate real com Lobrapedras); a ordem de viagem é retomada após ataques (correção V04).

## Classes de bioma (33 rótulos do manifesto → 13 classes)

| Classe | Hexes |
| --- | ---: |
| Desertos e megadunas | 46 |
| Floresta temperada | 33 |
| Montanhas florestadas | 33 |
| Costas rochosas e falésias | 29 |
| Selva tropical | 26 |
| Regiões nevadas e glaciais | 25 |
| Savana | 24 |
| Montanhas rochosas e cordilheiras | 22 |
| Planícies temperadas | 19 |
| Desertos rochosos, cânions e arcos | 11 |
| Costas glaciais e plataformas de gelo | 11 |
| Costas arenosas e de dunas | 11 |
| Pântano tropical | 7 |
