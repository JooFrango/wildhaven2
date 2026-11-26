# 02 — Duas carroças, dodos, Chad, Nailon e acampamentos

## Inventário logístico [CONFIRMADO]
| Elemento | Quantidade | Vínculo | Função |
|---|---:|---|---|
| Carroça de Chad | 1 | Chad | Leva até **6 Hunters** e suprimentos até a expedição |
| Carroça de Nailon | 1 | Nailon | Leva até **6 Hunters** e suprimentos até a expedição |
| Dodo de tração | 1 por carroça | Modelo de dodo já feito no projeto | Puxa a carroça |

**Local inicial: vila.** Capacidade de passageiros Hunters: **6 por carroça**, até **12 nas duas carroças**. Isso é capacidade de transporte, não definição de quantidade máxima de Hunters controláveis. A capacidade dos baús/carga é **pendente**, e não deve ser confundida com a lotação de passageiros.

## Modalidade de viagem via botão Caçar [CONFIRMADO]
A partir do bestiário, o jogador pode escolher **a pé** ou **de carroça**. A viagem **de carroça custa dinheiro** (valor/fórmula ainda não definidos) e **cada carroça só transporta 6 Hunters**. O limite é **por veículo/partida**, não autorização automática para agrupar 12 Hunters em uma única caçada. A seleção e a cobrança devem apresentar o custo antes da confirmação [proposta de UI]. Ver [06 — Caçadas pelo bestiário](06-cacadas-pelo-bestiario.md).

## Ciclo de expedição [CONFIRMADO]
1. Jogador indica o **hexágono requerido** e organiza os Hunters.
2. Chad e/ou Nailon conduz a carroça correspondente puxada pelo dodo na direção da área.
3. Ao chegar ao hexágono, o condutor **procura um local limpo ou uma clareira**.
4. A carroça estaciona e o **acampamento é montado**.
5. Hunters partem do acampamento para explorar/caçar e retornam para equipamentos, itens e recuperação.

## Funções do acampamento [CONFIRMADO]
- Trocar equipamentos dos Hunters.
- Deixar e recuperar itens obtidos durante as expedições.
- Descansar para recuperar a vida **mais rapidamente**.
- Receber os Hunters feridos transportados por Chad/Nailon após um resgate bem-sucedido.

## Regras candidatas de implementação [PROPOSTO, NÃO APROVADO]
- Seleção da clareira deve verificar declive, obstáculos, colisores e proximidade de ameaças.
- A carroça e o dodo trafegam fisicamente; rotas inválidas impedem a montagem até encontrar outro ponto viável.
- Acampamento persistente enquanto estiver montado; itens associados a um inventário próprio, com salvamento.
- Interações com equipamentos e depósito via HUD; não exigir controle manual do Hunter.
- O descanso acelera regeneração, mas lesões graves demandam tratamento/tempo compatível.

## Decisões pendentes
- Chad e Nailon viajam sempre juntos ou podem comandar expedições diferentes?
- Uma ou duas áreas de acampamento caso as carroças cheguem ao mesmo hexágono?
- Quantidade de carga, limites de baús, alimentação do dodo e montagem/desmontagem.
- Valor e fórmula da viagem paga de carroça; momentos de cobrança, reembolso e cancelamento.
- Acampamento e resgate para expedições que optam por ir a pé.
- Condição de retorno à vila e comportamento da carroça caso o condutor esteja em resgate.
- Asset/versão definitiva dos dodos, carroças, armaduras de Chad e Nailon: **validar GLBs reais antes da implementação**; não fabricar novos modelos nesta fase de planejamento.
