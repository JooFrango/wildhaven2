# Relatório — laboratório de IA das criaturas

Gerado em 2026-11-11T09:12:24.889Z · sementes `1-30` por cenário · 627 ms.

Gerado por `npm run simular`. Cada linha é reproduzível com `npm run reproduzir -- --cenario <id> --semente <n>`.

## Visão geral

| Cenário | Encontros | Sem detecção | Com perseguição | Com fuga | Desist. cansaço | Perda de rastro | Capturas | Duração perseg. (média / mín–máx s) | Sementes com falha |
|---|---|---|---|---|---|---|---|---|---|
| Campo aberto (`campo-aberto`) | 30 | 0 | 30 (34 perseg.) | 30 | 10 | 0 | 24 | 6.73 / 2.5–11.2 | 0 |
| Obstáculo entre os animais (`obstaculo`) | 30 | 0 | 30 (34 perseg.) | 30 | 7 | 4 | 24 | 6.77 / 1.5–14.7 | 0 |
| Predador com pouca energia (`predador-cansado`) | 30 | 0 | 30 (61 perseg.) | 30 | 43 | 0 | 17 | 3.7 / 2–7.5 | 0 |
| Territórios separados (`territorios-separados`) | 30 | 26 | 4 (4 perseg.) | 4 | 0 | 0 | 4 | 3.25 / 2–5.9 | 0 |
| Camuflagem no capim alto (`capim-alto`) | 30 | 8 | 21 (21 perseg.) | 22 | 1 | 1 | 19 | 4.17 / 0.7–10.2 | 0 |
| Aproximação furtiva (`aproximacao-furtiva`) | 30 | 0 | 28 (30 perseg.) | 30 | 2 | 1 | 27 | 3.62 / 0.9–10.4 | 0 |

Desistências e capturas são contadas como eventos: depois de desistir, o predador pode recuperar energia e tentar de novo no mesmo encontro. Perseguições de 0,1 s são as que começaram no último passo antes do fim do tempo.

## Semente de exemplo por resultado

**Resultado do encontro** = desfecho da primeira perseguição (ou, sem perseguição: fuga sem perseguição / detectado sem perseguição / sem detecção). Resultados que não aparecem na tabela não foram observados nessas sementes.

| Cenário | Resultado | Encontros | Semente de exemplo | Reproduzir |
|---|---|---|---|---|
| `campo-aberto` | captura | 22 | 1 | `npm run reproduzir -- --cenario campo-aberto --semente 1` |
| `campo-aberto` | desistencia_cansaco | 8 | 2 | `npm run reproduzir -- --cenario campo-aberto --semente 2` |
| `obstaculo` | captura | 21 | 1 | `npm run reproduzir -- --cenario obstaculo --semente 1` |
| `obstaculo` | desistencia_cansaco | 6 | 2 | `npm run reproduzir -- --cenario obstaculo --semente 2` |
| `obstaculo` | perda_de_rastro | 3 | 14 | `npm run reproduzir -- --cenario obstaculo --semente 14` |
| `predador-cansado` | desistencia_cansaco | 30 | 1 | `npm run reproduzir -- --cenario predador-cansado --semente 1` |
| `territorios-separados` | captura | 4 | 6 | `npm run reproduzir -- --cenario territorios-separados --semente 6` |
| `territorios-separados` | sem_deteccao | 26 | 1 | `npm run reproduzir -- --cenario territorios-separados --semente 1` |
| `capim-alto` | captura | 19 | 1 | `npm run reproduzir -- --cenario capim-alto --semente 1` |
| `capim-alto` | desistencia_cansaco | 1 | 24 | `npm run reproduzir -- --cenario capim-alto --semente 24` |
| `capim-alto` | perseguicao_em_andamento | 1 | 3 | `npm run reproduzir -- --cenario capim-alto --semente 3` |
| `capim-alto` | fuga_sem_perseguicao | 1 | 6 | `npm run reproduzir -- --cenario capim-alto --semente 6` |
| `capim-alto` | sem_deteccao | 8 | 2 | `npm run reproduzir -- --cenario capim-alto --semente 2` |
| `aproximacao-furtiva` | captura | 26 | 1 | `npm run reproduzir -- --cenario aproximacao-furtiva --semente 1` |
| `aproximacao-furtiva` | desistencia_cansaco | 2 | 9 | `npm run reproduzir -- --cenario aproximacao-furtiva --semente 9` |
| `aproximacao-furtiva` | fuga_sem_perseguicao | 2 | 11 | `npm run reproduzir -- --cenario aproximacao-furtiva --semente 11` |

**Resultado ao fim do tempo** (prioridade: captura > desistência por cansaço > perda de rastro > perseguição em andamento > sem perseguição):

| Cenário | Resultado final | Encontros | Semente de exemplo |
|---|---|---|---|
| `campo-aberto` | captura | 24 | 1 |
| `campo-aberto` | desistencia_cansaco | 6 | 2 |
| `obstaculo` | captura | 24 | 1 |
| `obstaculo` | desistencia_cansaco | 6 | 2 |
| `predador-cansado` | captura | 17 | 3 |
| `predador-cansado` | desistencia_cansaco | 13 | 1 |
| `territorios-separados` | captura | 4 | 6 |
| `territorios-separados` | sem_deteccao | 26 | 1 |
| `capim-alto` | captura | 19 | 1 |
| `capim-alto` | desistencia_cansaco | 1 | 24 |
| `capim-alto` | perda_de_rastro | 1 | 6 |
| `capim-alto` | perseguicao_em_andamento | 1 | 3 |
| `capim-alto` | sem_deteccao | 8 | 2 |
| `aproximacao-furtiva` | captura | 27 | 1 |
| `aproximacao-furtiva` | desistencia_cansaco | 1 | 9 |
| `aproximacao-furtiva` | perda_de_rastro | 1 | 20 |
| `aproximacao-furtiva` | fuga_sem_perseguicao | 1 | 11 |

## Furtividade, camuflagem e encontros que não acontecem

Visão com reconhecimento gradual (`visao.tempoReconhecimentoSeg`), alcance efetivo reduzido por `furtividade.camuflagem`, imobilidade (`fatorParado`) e vegetação com `ocultacao`. **Despercebido** = um animal relevante (presa/ameaça) dentro do alcance nominal de visão do outro sem ser visto, com o motivo. **Quase-encontro** = encontro sem nenhuma detecção em que a distância mínima entre eles ficou abaixo de 20 m.

| Cenário | Sem detecção | Quase-encontros (ex.: semente @ dist. mín.) | Dist. mín. média sem detecção (m) | Quem detectou primeiro | Dist. média da 1ª detecção (m) | Episódios despercebidos por motivo |
|---|---|---|---|---|---|---|
| `campo-aberto` | 0/30 | 0 | — | predador: 30 | herbivoro: 14.8, predador: 18 | camuflagem_cobertura: 104, fora_do_cone: 87 |
| `obstaculo` | 0/30 | 0 | — | predador: 22, herbivoro: 8 | herbivoro: 14.1, predador: 17 | sem_linha_de_visao: 113, camuflagem_cobertura: 42, fora_do_cone: 87, reconhecendo: 1 |
| `predador-cansado` | 0/30 | 0 | — | predador: 29, herbivoro: 1 | herbivoro: 14.7, predador: 17.1 | camuflagem_cobertura: 385, fora_do_cone: 194, reconhecendo: 16 |
| `territorios-separados` | 26/30 | 3 (semente 15 @ 12.046 m) | 33.6 | herbivoro: 2, predador: 2 | herbivoro: 15, predador: 15.3 | camuflagem_cobertura: 15, fora_do_cone: 10 |
| `capim-alto` | 8/30 | 8 (semente 15 @ 6.738 m) | 10.3 | predador: 16, herbivoro: 6 | herbivoro: 5.6, predador: 6.6 | camuflagem_cobertura: 83, fora_do_cone: 45, sem_linha_de_visao: 1 |
| `aproximacao-furtiva` | 0/30 | 0 | — | predador: 22, herbivoro: 8 | herbivoro: 7.2, predador: 8.2 | camuflagem_cobertura: 63, fora_do_cone: 42 |

Tempo total (s, somando as 30 sementes) em que cada animal teve o outro dentro do alcance nominal de visão sem vê-lo:

| Cenário | Observador | sem linha de visão | fora do cone | camuflagem/cobertura | reconhecendo |
|---|---|---|---|---|---|
| `campo-aberto` | predador | 0 | 69.6 | 224.8 | 31.6 |
| `campo-aberto` | herbivoro | 0 | 140.2 | 106.4 | 30.4 |
| `obstaculo` | predador | 515.1 | 90.3 | 91.1 | 39.9 |
| `obstaculo` | herbivoro | 143.9 | 133.9 | 123.8 | 34.2 |
| `predador-cansado` | predador | 0 | 238.9 | 365.9 | 56 |
| `predador-cansado` | herbivoro | 0 | 222.7 | 343.1 | 47.5 |
| `territorios-separados` | predador | 0 | 90.6 | 25.4 | 2.9 |
| `territorios-separados` | herbivoro | 0 | 6.3 | 30.2 | 2.2 |
| `capim-alto` | predador | 1.6 | 453.3 | 550.8 | 14.7 |
| `capim-alto` | herbivoro | 1.5 | 136 | 395.8 | 10.5 |
| `aproximacao-furtiva` | predador | 0 | 31.7 | 368.5 | 17.9 |
| `aproximacao-furtiva` | herbivoro | 0 | 78.8 | 140.3 | 13.2 |

## Falhas

Nenhuma falha de invariante (colisão, fora do terreno, NaN, reação sem percepção) nas sementes rodadas.

## Valores provisórios de balanceamento

- **Herbívoro de exemplo** (`herbivoro-exemplo`): `movimento.corrida`, `movimento.trote`, `percepcao.visao.alcance`, `percepcao.audicao.alcance`, `necessidades.custoCorridaPorSeg`, `necessidades.recuperacaoPorSeg`, `necessidades.fomePorSeg`, `decisao.tempoCalmaSeg`, `decisao.distanciaSegura`, `decisao.bonusEsconderijo`, `decisao.penalidadeCurva`, `furtividade.camuflagem`, `furtividade.fatorParado`, `percepcao.visao.tempoReconhecimentoSeg`
- **Predador de exemplo** (`predador-exemplo`): `movimento.corrida`, `percepcao.visao.alcance`, `percepcao.visao.anguloGraus`, `necessidades.custoCorridaPorSeg`, `ataque.alcance`, `ataque.chanceAcerto`, `ataque.recargaSeg`, `decisao.energiaDesistir`, `decisao.distanciaCorrida`, `decisao.tempoSemContatoMaxSeg`, `furtividade.camuflagem`, `furtividade.ruidoPassos`, `percepcao.visao.tempoReconhecimentoSeg`
