# 06 — Planejamento de caçadas pelo bestiário

**Estado: mecânicas descritas pelo diretor confirmadas; parâmetros e apresentação fina pendentes.** Somente documentação.

## Objetivo [CONFIRMADO]
A página de cada criatura no bestiário mostra:
1. **A criatura** (identificação e representação visual).
2. Seu **dossiê**.
3. **Itens que podem ser obtidos** dela (não inventar drops; usar tabela canônica quando existir).
4. Um **mapinha** exibindo **onde a espécie vive**.
5. Um **botão interativo "Caçar"**, que abre o planejamento de uma nova expedição contra essa espécie.

O **mapinha da ficha é distinto do minimapa permanente**: a HUD geral continua sem minimapa fixo. Mostrar **habitat/áreas conhecidas**, não a localização exata, em tempo real, de cada indivíduo [INTERPRETAÇÃO PROPOSTA]. Se for necessário mostrar avistamentos, marcar apenas informações descobertas pelo jogador, sem transformar o bestiário em rastreador perfeito.

## Janela de planejamento da caçada [CONFIRMADO]
1. O jogador abre a ficha de uma espécie já avistada.
2. Clica em **Caçar**.
3. **Escolhe quais Hunters** participarão.
4. Seleciona **como viajar**: **a pé** ou **de carroça**.
5. Confirma a expedição, respeitando as regras de capacidade e pagamento.
6. Os Hunters partem em direção ao **habitat/hexágono de caça**; encontrar o animal demanda **procurar rastros** (ver 07).

### Modalidades
| Modalidade | Regras do diretor | Requisitos operacionais propostos |
|---|---|---|
| **A pé** | Hunters viajam caminhando para caçar | Sem a cobrança **específica da carroça**; duração, desgaste, risco, camping e limite de Hunters **pendentes** |
| **De carroça** | **Custa dinheiro; no máximo 6 Hunters por carroça** | Exibir custo e saldo **antes de confirmar**; bloquear >6 passageiros na carroça escolhida; associar a Chad ou Nailon e ao respectivo dodo; descontar apenas quando a viagem for validamente confirmada |

**Regra de precedência:** existem **duas carroças na vila**, Chad e Nailon, cada uma com **6 lugares**. Para **esta seleção de modalidade "de carroça"**, não deixar entrar mais que **6 Hunters em uma única carroça**. Dividir a mesma caçada entre duas carroças / 12 Hunters é **pendente de aprovação**, e não pode furar a regra de seis por veículo.

**Não inventar** moeda, custo numérico, fórmula de distância, número de dias, velocidade, permissões, garantia de encontro ou taxas de obtenção de itens.

## Depois de chegar [CONFIRMADO]
- O Hunter **não vai automaticamente ao animal**.
- Vai **andar pela região procurando pegadas** e outros sinais quando aplicável.
- Após encontrar pegadas válidas, segue o **rastro revelado em azul**, sujeito a perda da pista quando a criatura entrar na água.
- Ao avistar a criatura, avalia comportamento, ameaça e terreno; **monta uma estratégia própria**, sem o jogador controlar o movimento nem os golpes.

## Decisões de UI [PROPOSTO]
- O botão Caçar na ficha abre painel: espécie, retrato, mapa de habitats, seleção de Hunters, transporte, carroça/condutor quando aplicável, custo total e confirmação.
- Desabilitar confirmação se o saldo for insuficiente ou passageiros excederem 6.
- Mostrar estado da expedição: Preparando → Em viagem → Procurando sinais → Rastreando → Observando → Caçando → Resultado/Retorno.
- O jogador pode abrir o dossiê para ver itens potenciais, sem afirmar que todos cairão ao abater o animal.

## Integração com outros sistemas
- Carroças e acampamentos: `02-carrocas-acampamentos.md`.
- Rastreamento performático: `07-rastros-otimizacao.md`.
- Estratégias autônomas: `08-estrategias-emboscada-armadilhas.md`.
- Resgate e perdas: `03-resgate-hunters.md`.

## Aceitação
- [ ] Ficha apresenta criatura, itens possíveis (dados existentes), mapinha de habitat e botão Caçar.
- [ ] Caçar abre seleção de Hunters e transporte, sem assumir controle direto.
- [ ] Carroça mostra custo e **recusa um sétimo passageiro** na mesma carroça.
- [ ] Viagem a pé e de carroça levam a uma área válida do habitat, sem teleportar Hunter ao animal.
- [ ] A busca por sinais começa **depois de chegar**, antes do encontro com a presa.
- [ ] Save preserva escolha de missão, registro de espécie e recursos sem duplicar pagamento.
