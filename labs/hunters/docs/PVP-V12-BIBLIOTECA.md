# PvP v12 — biblioteca de animações nova (guarda, locomoção, quatro golpes, bloqueio)

Biblioteca PvP autorada do zero. **Não depende dos 83 clipes da v05**: eles continuam dentro do GLB como
histórico, e o duelo com a v12 ligada não desenha nenhum deles (há um portão que reprova a gravação se um
aparecer). Aguarda aprovação. Nada aqui altera a Alpha, o PvE, os monstros ou os GLBs aprovados.

## Os dez clipes

| Clipe | Duração | Contato | O que é |
|---|---|---|---|
| `pvp12_guard` | 3,20 s (laço) | — | Guarda fechada com respiração e microajuste de peso. Espada junto ao corpo, punho a ~10 cm à frente do quadril direito, ponta alta cruzando para a esquerda — **nunca apontada para o adversário** —, joelhos flexionados (pelve 8,5 cm abaixo do repouso), base aberta, quadril de lado. |
| `pvp12_step_forward` | 0,85 s (laço) | — | Avançar em guarda. Passada 0,52 m, apoio 60%, o pé da frente sai primeiro. |
| `pvp12_step_back` | 0,85 s (laço) | — | Recuar. Passada 0,52 m, quem sai primeiro é o pé de trás. |
| `pvp12_step_left` / `pvp12_step_right` | 0,85 s (laço) | — | Circular para os lados. Passada 0,40 m. |
| `pvp12_sword_horizontal_cut` | 1,90 s | 0,92 s | Corte horizontal direita→esquerda. Preparo legível, coil completo com a lâmina deitada atrás do ombro, quadril disparando antes dos ombros, braço estendendo no contato, continuação pela inércia e recuperação pesada. |
| `pvp12_sword_horizontal_reverse_cut` | 1,90 s | 0,88 s | Reverso, esquerda→direita, de costas da mão. Coil com a lâmina deitada sobre o ombro esquerdo, quadril abrindo para a direita antes dos ombros. |
| `pvp12_sword_diagonal_down` | 2,10 s | 0,97 s | Diagonal descendente pesado: espada erguida sobre o ombro direito, tronco cai sobre a perna da frente e a lâmina desce cruzando até o quadril esquerdo. |
| `pvp12_sword_thrust` | 1,50 s | 0,58 s | Estocada (contra-ataque): punho recolhe ao quadril, avanço longo da perna da frente, braço estende com a ponta ~20° acima do antebraço. |
| `pvp12_sword_block` | 1,10 s | 0,30 s | Bloqueio de linha média: a lâmina sobe do quadril, atravessa o plano frontal, leva o impacto (a guarda cede para trás e para baixo), absorve e volta. |

**A costura da biblioteca**: os dez clipes partem da **mesma** pose de guarda. Isso é medido, não afirmado:
`validate-hunter-pvp-v09.mjs --v12` compara o quadro 0 osso por osso contra `pvp12_guard` e reprova acima de
0,5°. Medido: **0,19°**. Nos passos a comparação cobre tronco e braços — as pernas mudam de propósito, porque
o ciclo começa com um pé à frente.

Os passos são **em lugar**: o pé plantado escorrega para trás sob o corpo (quem translada o Hunter é o
laboratório) e o pé no ar volta à frente a mesma distância, então o ciclo fecha. Arrasto medido: **0,61 m/s**,
exatamente a velocidade de corpo que a passada declara. É um arrasto de combate, não uma caminhada: os pés
não se cruzam e a guarda não se desfaz.

## Como foram feitas

- **Poses-chave com interpolação Hermite/Catmull-Rom**, com chaves marcadas `hold` onde o corpo assenta.
- **Corpo inteiro por chave**: pelve, yaw do quadril, yaw/pitch/roll do tronco repartidos entre `Spine` e
  `Spine02`, contrarrotação do pescoço e da cabeça, clavícula, e as duas pernas.
- **IK de duas juntas com pole explícito** nos quatro membros; a mão é orientada pela direção da lâmina e do
  fio, com a pronação repartida (60% antebraço, 40% mão).
- **Pés com trilha própria**: ponta, yaw, pivô de calcanhar e arco de elevação. Nos passos a trilha do pé
  plantado é **linear**, senão o arrasto ganharia aceleração e o pé patinaria.
- **Rig v11 com dedos**: o punho fecha em volta do cabo, posicionado por busca para não penetrar a malha.

## QA medido (portões que reprovam a geração)

| Medida | Limite | Medido |
|---|---|---|
| Erro de IK da mão | 10 mm | **4,5 × 10⁻⁸ m** |
| Erro de IK do pé | 12 mm | **8,8 mm** |
| Deslizamento do pé plantado (clipes de pé fixo) | 2 mm | **0,28 mm** |
| Arrasto do pé plantado (passos, medido e não limitado) | — | 10,2 mm por quadro = 0,61 m/s |
| Desvio do punho | 60° | **59,3°** (diagonal; corte 51,2°, reverso 57,6°, estocada 44,2°) |
| Penetração da lâmina no corpo | 0 | **0** |
| Cotovelo no contato do ataque | ≥ 140° | corte 161,6° · reverso 153,5° · diagonal 142,1° · estocada 166,6° |
| Cotovelo na guarda / bloqueio | ≤ 150° (fechado de propósito) | 95,9° / 133,6° |
| Alteração do skin dos clipes antigos | 10 µm | **7,4 × 10⁻⁸ m** |
| Costura entre clipes (quadro 0) | 0,5° | **0,19°** |

A v05 continua intacta: malha, materiais, texturas, ordem de ossos, prefixo binário e os 83 clipes originais
são comparados byte a byte e a geração reprova se mudarem.

## Uma fonte só para desenho e contato

Antes desta entrega o golpe existia duas vezes: autorado no GLB e reescrito à mão em `armaLocal`. Medido no
corte horizontal, as duas descrições divergiam até **0,56 m e 105°**, e no golpe a mão desenhada era arrastada
até o punho simulado — o braço autorado era sobrescrito em tempo real.

Agora o gerador grava, por quadro a 60 fps, o punho (em alturas de corpo) e a direção da lâmina de cada ataque
em `src/trajetorias-pvp12.js` (gerado, não editar). Com a guarda fechada ligada, a simulação lê a lâmina dali.
Divergência medida depois: **0°**; os 4 cm de posição que a sonda mostra são só a escala 1,70 m (nativa) →
1,75 m (Hunter), que o laboratório aplica igual ao corpo. Golpe novo agora é só autoria: a simulação segue sozinha.

**Contato calculado.** O instante de contato de cada ataque é o de alcance máximo da lâmina na direção do
adversário, não um número digitado. Declarado à mão (0,84 s), o contato do corte caía antes de a lâmina cruzar
a linha do adversário, e o aparo não achava aço: **0 aparos** em três duelos. Calculado (0,92 s): 12–16.

**Leitura do defensor.** A guarda de aparo sobe para a altura e a inclinação da lâmina **visível** (o trecho que
corta, no plano frontal, espelhado porque os dois se encaram), não para a altura de mira. Golpe autorado passa
numa altura própria; com a altura de mira a guarda ficava por cima ou por baixo da lâmina.

**Qual golpe sai.** Uma regra só (`clipePvp12`), usada pela simulação e pelo renderizador: contra-ataque =
estocada; pesado = diagonal; continuação = reverso; golpe leve alterna corte, reverso e diagonal pela contagem
de golpes do Hunter. A IA continua decidindo quando e com que tempo golpear.

**Punho nas transições.** Nas chaves de volta à guarda o fio não corta nada, então o giro da lâmina no próprio
eixo é livre: o gerador testa 36 giros e fica com o que deixa o punho mais reto (`rollLivre`).

## A guarda da simulação

A espada desenhada é a espada **simulada** do laboratório — a mesma função que decide o contato. A pose
neutra dela era o braço estendido, **51,4 cm** longe da mão autorada: era por isso que a espada saía da mão
ao começar o golpe. Agora `armaLocal` tem a chave `usarGuardaFechada`, que o laboratório liga junto com a
biblioteca v12:

- **Ligada**: a pose neutra da espada de uma mão é a guarda fechada autorada. Distância da mão: **0,000 m**.
  A lâmina ainda **viaja** da guarda até o coil ao longo do preparo, em vez de ficar parada nos primeiros
  55% do golpe e só então saltar para a posição de ataque.
- **Desligada** (padrão): a trajetória é exatamente a de antes. O PvE e os cenários fora do PvP não veem
  diferença nenhuma.

O comprimento da lâmina é preservado na mistura (0,6388 m contra 0,6387 m): a interpolação é da **direção**,
não da ponta — interpolar os dois extremos encurtaria a espada no meio do movimento.

O GLB da v05 **não foi regerado**; o `sha256` dele continua `1824a6c4…`. Só o campo
`trajectorySourceSha256` do manifesto foi reescrito, com nota explicando que a chave nasce desligada.

## Duelo real na Arena dos Caçadores

`node scripts/capture-aparo.mjs --pvp12 --segundos 18`, semente 17, dois ângulos:

- **6 aparos de lâmina** por ângulo, **0 invariantes violados**, **104 trocas de clipe**.
- **Os quatro golpes aparecem**: reverso 6×, estocada 6×, diagonal 4×, corte 2×; bloqueio 13×; passos 56×.
- Cadeia observada: `0,95 s A reverso → 1,15 s B bloqueia → 1,25 s B guarda → 1,70 s B circula → 1,75 s B estocada`.
- **Nenhum clipe da v05 desenhado**: a gravação reprova se um aparecer.
- **Espada no punho fechado**: 0,000 m fora de golpe; **2,1 cm** no pior aparo. O IK mira o centro do punho
  fechado (socket), não o pulso — antes a espada ficava ~7 cm fora da mão durante o golpe.

Simulação sem renderizador (`rodarCombate`, 30 s, sementes 7/17/23): 12–16 aparos por duelo, contra 15 com a
trajetória antiga.

## Como rodar

```
node scripts/animate-hunter-pvp-v09.mjs --v12            # gera o GLB da biblioteca
node scripts/validate-hunter-pvp-v09.mjs --v12           # portão estrutural + costura entre clipes
node scripts/capture-hunter-pvp-v09.mjs --v12 --clip pvp12_step_forward   # GIFs e poses de um clipe
node scripts/capture-aparo.mjs --pvp12 --segundos 18     # duelo real na arena (precisa de Chrome)
npm test                                                 # 77 testes do laboratório
```

No navegador: `viewer/pvp-preview-v12.html?clip=pvp12_sword_block`.
No laboratório: `hunter-lab.html?cenario=arena-aparo&pvp12=1` — **sem `pvp12=1` nada muda**.

## Limites conhecidos

- **Reação a ferimento, cambaleio, queda, levantar, morte e rendição ainda não existem na v12.** Com a
  biblioteca ligada esses estados caem na **guarda** em vez de voltarem a um clipe da v05 — é deliberado,
  mas significa que um Hunter atingido hoje não reage visualmente.
- **Ritmo: o golpe autorado roda 2–3× mais rápido no duelo.** A IA usa o tempo de espada da simulação (preparo
  leve 0,29 s, recuperação 0,38 s; contra-ataque 0,26/0,50 s) e o renderizador estica o clipe até ele. Preparos
  autorados: corte 0,92 s, reverso 0,88 s, diagonal 0,97 s, estocada 0,58 s — aceleração de 3,2×, 3,0×, 3,3× e
  2,2× no preparo. As poses de preparo ficam borradas. Mudar isso é mudar o ritmo de jogo (janelas da IA, dano
  por segundo): decisão de direção, não de animação.
- **O pesado quase nunca sai.** Para a espada a IA só escolhe pesado com abertura de 1,20 s; no duelo a janela
  fica ~0,84 s. A diagonal aparece pela alternância do golpe leve, no tempo de golpe leve.
- **Faltam** corte vertical, diagonal ascendente, golpe rápido próprio e continuação encadeada (o reverso hoje
  é variante do golpe leve: a cadeia da IA é interrompida a cada aparo).
- **Um bloqueio só** (linha média). Faltam alto e baixo, e aparos direcionais.
- **Giro parado usa o passo lateral.** Sem distância andada o clipe roda no relógio; não há clipe de giro
  próprio, então os pés giram menos do que o corpo.
- **A espada do GLB fica escondida na arena.** O laboratório desenha a espada simulada; a do socket serve de
  referência de pose. Ter as duas visíveis dava duas lâminas por Hunter.
- **Referência visual incompleta.** Um quadro real de combate de Kenshi foi consultado; as galerias com a
  pose de guarda estão atrás de verificação anti-bot e não foram abertas. A guarda saiu da descrição escrita
  do pedido, e a imagem de referência citada nele não chegou.
