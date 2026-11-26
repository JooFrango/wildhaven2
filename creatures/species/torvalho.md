# Torvalho — proposta de espécie 003

**Wildhaven · Fauna de Auralis**  
**Status:** proposta de design (ainda não aprovada). O animal é original, inspirado no nicho e na anatomia de bois selvagens; não deve copiar criaturas de outras franquias.

## Conceito principal
O **Torvalho** é um grande herbívoro de ombros altos, peito poderoso e chifres amplos, típico de **clareiras, campos temperados e bordas de florestas**. Não é uma versão bovina do Silvarano: é uma linhagem com pelo curto espesso, cascos fendidos e manadas defensivas. Seu papel é transformar discretamente a paisagem ao pastar, pisotear vegetação, abrir trilhas e transportar sementes.

## Corpo e aparência
- Altura no ombro: **1,55–1,90 m**; massa: **480–820 kg**.
- Corpo maciço com espáduas altas, cabeça baixa e focinho largo; pescoço forte, pernas curtas em proporção ao tronco, cascos fendidos.
- Dois chifres permanentes, espessos na base, crescendo lateralmente e para cima. Não são galhadas ramificadas.
- Juba curta e áspera nos ombros; pelos mais curtos no corpo; cauda longa com tufo.
- Paleta: castanho-terra, cobre queimado, juba marrom-escura, chifres marfim fosco com bases cinza.
- Indivíduos variam em massa, tamanho dos chifres, cicatrizes, forma da juba e tonalidade. Filhotes têm chifres pouco desenvolvidos.
- Não transformar em monstro grotesco ou blindado; a presença imponente vem da anatomia e do movimento.

## Nicho e habitats
- **Principal:** campos temperados, clareiras com gramíneas e bordas de floresta temperada.
- **Secundário:** prados ribeirinhos e bosque aberto, respeitando acesso a água e alimento.
- Alimentação vegetal: gramíneas, ciperáceas, plantas herbáceas e brotos sazonais.
- Evita mata tropical muito fechada, escarpas, lama funda e longas travessias aquáticas.
- Forma trilhas e pequenas clareiras pelo pisoteio, ajuda na dispersão de sementes e fertiliza o solo através de resíduos.

## Organização social
- Manadas estáveis de **5–12**, com filhotes e adultos.
- Indivíduos experientes podem iniciar deslocamentos. Machos podem ficar mais isolados em parte do ciclo anual.
- Defesa de grupo: adultos aproximam-se, posicionam os corpos entre ameaça e filhotes e fazem sinais de intimidação.
- Não transformar todo encontro em combate: muitas vezes uma ameaça distante é observada, cheirada ou evitada.
- Comunicam-se com bufos graves, pisadas fortes e mudança de postura; o alerta viaja como som e visão, sem conhecimento instantâneo da posição do predador.

## Sentidos e movimento — valores iniciais para gameplay
| Parâmetro | Proposta |
| --- | ---: |
| Campo de visão | **300°**, zona cega aproximada de 60° |
| Detecção visual de movimento | até **38 m** |
| Detecção de alvo estático | até **16 m** |
| Olfato | **alto**, referência até **45 m** dependendo de vento |
| Audição | **alta**, referência até **35 m** |
| Caminhada | **1,0 m/s** |
| Corrida | **8,5 m/s** por ~**8 s** |
| Salto útil | **0,45 m** |

É forte e rápido em linha reta, mas desacelera para virar e perde eficiência em terreno muito inclinado. O peso interfere em aceleração, derrapagem e capacidade de frear. Parâmetros dependem de calibração com colisões, clima e terreno.

## Comportamento ecológico
1. **Pastar** em manchas de gramíneas sem atravessar rochas e obstáculos.
2. **Ruminar e descansar** enquanto alguns membros vigiam.
3. **Farejar** sinais de ameaças e direção do vento.
4. **Alertar** via bufos e postura de cabeça/cauda.
5. **Reunir filhotes** dentro do grupo e formar barreira protetora.
6. **Intimidar** batendo cascos e avançando lentamente.
7. **Investir** em curta distância quando necessário; pode recuar se ferido ou em desvantagem.
8. **Deslocar-se** para novas áreas de pasto quando a vegetação rarear.

## Reprodução e ciclo de vida
Vivíparo, geralmente um filhote por nascimento; jovens seguem a manada e aprendem rotas de água e pasto. Duração de gestação, maturidade e longevidade ainda dependem da escala temporal final do jogo; não usar taxas humanas de relógio sem balancear a simulação.

## Hunters, vila e sistema ecológico
- Rastros incluem pegadas fundas em solo úmido, gramíneas amassadas, árvores roçadas por chifres, fezes e bufos audíveis.
- Uma manada passando perto da vila pode abrir caminhos, destruir lavouras ou atrair predadores.
- Uma investida deve ter aviso telegráfico e ser perigosa; não deve permitir repetição automática interminável.
- A perda de um animal afeta o grupo e a disponibilidade alimentar de grandes predadores, inclusive fora da câmera.

## Direção para arte 3D e animação
Propor um adulto em ambiente de bosque temperado aberto, vistas frente/lateral/traseira, detalhe dos chifres/cascos/focinho e filhote. Texturas de couro e pelo não podem substituir a geometria estrutural. Animações futuras: `idle`, `walk`, `graze`, `chew`, `sniff`, `alert`, `group_guard`, `stomp`, `charge`, `run`, `turn`, `drink`, `rest`, `sleep`, `hurt`, `death`, `calf_follow`.

**Próxima decisão:** avaliar o design antes de produzir arte conceitual e modelo animado. O registro da espécie não significa aprovação visual nem implementação no jogo.

[Ficha estruturada](./torvalho.json).
