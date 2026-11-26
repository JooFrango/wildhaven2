# V02.2 — IA em três camadas, perfis e regras condicionais (2026-11-21)

## O que mudou

| Camada | Onde | Papel |
|---|---|---|
| 1. Objetivo do jogador | `src/jogo.js` (tarefas e fila) | registrado até concluir, ser cancelado, abandonado ou impossível; regras só **suspendem** |
| 2. Planejamento | `src/regras.js` (novo) | a cada 0,5 s: avalia percepção real do Hunter (contatos), vida, companheiros; decide seguir, interromper, recuar, retomar |
| 3. Sobrevivência e combate | `labs/hunters/src/cerebro-hunter.js` (inalterado) | esquiva, bloqueio, recuo, fuga, golpes; a camada 2 só liga/desliga o engajamento quando o Hunter **não** está sendo atacado |

Perfis (`PERFIS`): desvio sobre a personalidade individual (agressividade/cautela, lidas pelo limiar de recuo do lab) e
parâmetros de decisão. Atributos físicos não mudam.

| Perfil | Tolerância a risco | Recua abaixo de | Retoma após | Abandona após | Ajuda companheiro | Descansa até |
|---|---:|---:|---:|---:|---|---:|
| Cauteloso | 0,5 | 60% | 10 s | 3 interrupções | não | 95% |
| Equilibrado | 1,0 | 40% | 6 s | 5 | sim, com vida > 60% | 80% |
| Agressivo | 1,8 | 25% | 4 s | nunca | sim, com vida > 60% | 60% |

Risco = massa estimada da criatura percebida ÷ massa do Hunter ÷ (1 + aliados a menos de 25 m). Contra a espécie da
missão de caça, a tolerância dobra. **Os números são uma calibração inicial desta build, não dados validados.**

Regras (`REGRAS`), em ordem de prioridade: defesa (fixa, não desligável) 100 · retirada por ferimentos 90 ·
evitar ameaça superior 80 · enfrentar ameaça tolerável 75 · retomar 70 · ajudar companheiro 60 · descansar na vila 40.
Estabilidade: avaliação a cada 0,5 s, troca mínima de 2 s entre regras (a defesa entra sempre), defesa mantida 6 s
após o último sinal de ataque, histerese de 4 s para "enfrentar". Liga/desliga e prioridade editáveis no painel
(avançado). Registro: só mudanças, com o motivo montado dos números que dispararam a regra.

## Testes

`npm test` (Node): **11/11** — `test/v02.test.mjs` 4/4 (V02 sem regressão) e `test/v022.test.mjs` 7/7.
V01 (`game/playable-v01`, `npm test`): 6/6.

| Cenário pedido | Teste | Resultado |
|---|---|---|
| 1. Quatro Hunters, tarefas independentes | v02 + navegador | ok |
| 2. Perfis diferentes | v022 "perfis" + navegador | agressivo, equilibrado, cauteloso, equilibrado; personalidades distintas |
| 3. Ferido avalia retirada | v022 "ferido" | a 35%: equilibrado recua e suspende a exploração; agressivo segue; a missão volta com o mesmo início e ponto |
| 4. Agressivo × cauteloso, mesma situação | v022 "cauteloso × agressivo" (semente 1) | cauteloso interrompe a 44–45 m (risco 0,95 > 0,50); agressivo enfrenta (≤ 1,80), é atacado e se defende |
| 5–6. Interrupção e retomada | v022 + navegador | interrompe em 185 s e retoma em 195 s — mesmos instantes no Node e no Chrome |
| 7. Troca de perfil sem perder tarefa | v022 + navegador (select do painel) | tarefa, início, fila e interrupção preservados |
| 8. Troca de câmera sem reiniciar | navegador | interrupção e tarefa idênticas antes/depois do duplo clique em outro Hunter |
| 9. Save/restore com perfis e decisões | v022 + navegador | perfil, regra ativa, nº de decisões e tarefa iguais após recarregar |
| 10. Combate autônomo | v022 + navegador | Varrisco morto; "Enfrentando…" e "Defendendo-se: atacado por Varrisco" registrados por Arvo, Brena e Caio |
| 11. Sem conflito de prioridades | v022 "sem conflito" | nenhuma troca < 2 s, sem "enfrentar" repetido, regra desligada cede à próxima, defesa não desliga |
| 12. Sem regressão V01/V02 | Node + `tools/navegador.mjs` | ver abaixo |
| Reprodutibilidade | v022 "reprodutível" | mesmas decisões nos mesmos instantes com a mesma semente |

Navegador: `tools/navegador-v022.mjs` passou (`navegador-v022.json`, sem erro de página nem HTTP ≥ 400).

## Desempenho (A/B na mesma sessão, `tools/desempenho-ab.mjs`, Iris Xe, preset baixa)

Mesmo roteiro (dois caçam, um patrulha, um na vila; câmera acompanhando Arvo), 11 s a 1× e 11 s a 8×, duas rodadas alternadas.

| Versão | Rodada | 1× FPS (p95 ms) | 8× FPS (p95 ms) |
|---|---|---|---|
| V02 (`feat/build-idle-auralis-v02`) | 1 | 48,0 (34,6) | 57,9 (17,9) |
| V02.2 | 1 | 55,7 (32,7) | 57,7 (18,3) |
| V02 | 2 | 42,7 (49,8) | 53,5 (33,2) |
| V02.2 | 2 | 43,0 (50,0) | 48,5 (34,4) |

Sem regressão detectável: a diferença entre rodadas da mesma versão (até 7 FPS) é maior que a diferença entre versões.
A janela de 1× inclui os primeiros quadros após a carga (hexágonos ainda chegando), por isso fica abaixo da de 8×.
Otimização de streaming e observação distante ficam para a V02.6, como pedido.

## Limitações

- O Varrisco MH só começa a atacar depois de **ver** um Hunter; após o aggro, persegue qualquer Hunter vivo sem
  depender de percepção (regra do laboratório). Por isso a retomada só acontece quando o Hunter evita o Varrisco antes
  de ser visto; um cauteloso já perseguido passa à defesa.
- "Ajudar companheiro" leva o Hunter até o aliado incapacitado e o deixa lutar ali; não há tratamento de ferimentos de
  terceiros (o lab só estabiliza o próprio Hunter).
- A recuperação usa a cura do núcleo (8% da vida por dia de jogo de 900 s): sair de 35% para 80% leva cerca de 5 dias
  de jogo. O teste de retomada após descanso usa um ajuste de vida como fixture de tempo.
- Regras não atuam em Hunters em viagem simplificada (sem percepção fora da região detalhada; incidentes são V02.5).
- Só o Varrisco é avaliado como ameaça na região (é o único carnívoro presente); o código avalia qualquer carnívoro percebido.

## Capturas

`v022-01-interrupcao-cauteloso.png` · `v022-02-painel-perfil-regras.png` · `v022-03-decisoes-combate.png` · `v022-04-restaurado.png`
