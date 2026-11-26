# Sentidos e IA de criaturas — design de sistema

Cada espécie deve ter sensores, atributos locomotores, objetivos e táticas próprias, em vez de herdar uma visão ou IA universal.

## Percepção parametrizada

- **Visão:** alcance máximo, ângulo horizontal (0–360°), possível ângulo vertical, visão em baixa luz, detecção de movimento e necessidade de linha de visão.
- **Olfato:** intensidade de rastreamento por tipo de odor, distância, vento, obstáculos e persistência de rastros.
- **Audição:** distância máxima, intensidade do som, vegetação e ruído ambiente; chamadas de alarme propagam-se por som, não telepatia.
- **Memória:** último local em que viu ou ouviu uma ameaça, tempo desde o estímulo, confiança e esquecimento progressivo.

A detecção deve ser calculada a partir de estímulos *efetivamente disponíveis*. Não fazer busca global de predadores e depois fingir que a criatura os detectou pelo sensor.

## Locomoção e decisões

- Caminhada, corrida, aceleração, cansaço, salto, voo, nado e transposição de obstáculos são capacidades por espécie.
- Animais solitários e gregários utilizam políticas diferentes. Caçar em bando requer comunicação/coordenação local, não compartilhamento mágico de informações.
- Herbívoros podem se esconder, congelar, fugir, alarmar, reagrupar ou defender filhotes, conforme espécie e contexto.
- Não presumir que caçadores e presas sempre conhecem a melhor posição um do outro.

## Modelo de atualização viável

1. **Visível:** sensores e IA detalhados com eventos de estímulo e checagens espaçadas.
2. **Próximo:** decisões a baixa frequência, sem animar/renderizar todos os corpos.
3. **Distante:** modelo populacional e eventos com persistência seletiva.

Deve-se medir CPU e precisão de detecção em múltiplos animais. Balancear raios e intervalos com testes, não com números absolutos de um único bioma.

## Primeira implementação demonstrativa

Folhisco (visão periférica boa, audição boa, olfato fraco, bando, fuga) versus um predador terrestre aprovado para o bioma, com sensorial e comportamento definidos na ficha da espécie. O teste verifica furtividade, alarme, fuga e refúgio em terreno real.

Este documento é planejamento, não código jogável.
