# 03 — Resgate emergencial, ferimentos e morte permanente

**Estado: decisões narrativas confirmadas; parâmetros numéricos e lógica técnica ainda por aprovar.**

## Regra oficial de emergência [CONFIRMADO]
O sistema pode chamar **Chad ou Nailon** a partir do acampamento quando:
- **Pelo menos 1/3 dos Hunters participantes da caçada caiu**, **E** os sobreviventes não têm uma chance realista de sair vivos; OU
- **O único Hunter participante daquela caçada caiu.**

Não disparar o resgate apenas pelo número de baixas, ignorando se o restante consegue fugir ou vencer. O caso do Hunter solitário é uma exceção explícita.

## Ação do socorrista [CONFIRMADO]
1. O sistema avalia a emergência e escolhe entre os condutores disponíveis.
2. **Chad ou Nailon veste sua armadura**, equipa-se e **corre fisicamente** até os Hunters e o monstro.
3. O socorrista **enfrenta o monstro de verdade**; não existe vitória automática ou teleporte.
4. Quando consegue **matar o monstro**, recolhe os Hunters feridos/caídos.
5. Transporta-os de volta ao **acampamento**, onde permanecem para se recuperar.
6. O socorrista **pode falhar**. Se não houver mais resgate possível e não chegarem a ser salvos a tempo, os Hunters perdidos **morrem permanentemente**.

## Exemplo de gatilho [INTERPRETAÇÃO A CONFIRMAR]
Arredondar o mínimo de um terço para cima: 3 Hunters = 1 queda; 4 = 2 quedas; 6 = 2 quedas. **Isso não significa resgate automático**: também é preciso avaliar ausência de chance realista de sobrevivência dos demais, quando há mais de um Hunter na caçada. Os exemplos representam uma interpretação de arredondamento, não números explicitamente aprovados.

## Falha e consequências [CONFIRMADO]
- Hunter derrubado não é automaticamente morto se ainda houver resgate viável.
- A tentativa do socorrista não garante que todos voltem vivos.
- Se o resgate falha e nenhum outro é possível, a **morte é permanente**.
- O sistema deve persistir a morte real; não permitir restauração automática que a desfaça.

## IA e simulação [PROPOSTO]
- Avaliar ameaça, ferimentos, distância até o acampamento, tempo de chegada e possibilidade de fuga antes de mandar socorrista.
- Manter temporizador de risco de morte/hemorragia, mas não criar um valor fixo sem aprovação.
- Não interromper o combate por distância de câmera; o combate permanece centrado nas entidades.
- Separar estados: ativo, caído, socorro solicitado, socorrista em rota, combate de resgate, carregado, em recuperação, morto.
- Se ambos os condutores estiverem disponíveis, a possibilidade de segunda tentativa existe **apenas como proposta**, a discutir. Não presumir resgate infinito.
- Registrar no histórico: quem caiu, onde, qual socorrista foi, resultado e sobreviventes.

## Pendências
- Equipamentos/armaduras próprios de Chad e Nailon, atributos e chance de êxito.
- Como medir "nenhuma chance de sair vivo" sem disparar falsos positivos.
- Quanto tempo um Hunter caído pode resistir.
- Quantos feridos um socorrista carrega, e se usa a carroça/dodo para remoção.
- Se o segundo condutor pode tentar resgate após falha do primeiro.
- O que acontece se o próprio Chad ou Nailon cair; efeito na carroça e no acampamento.
