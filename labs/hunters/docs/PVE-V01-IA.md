# PvE v01 — IA do Hunter sobre o lote 1 de espada

Adapta a simulação e a IA do Hunter aos doze clipes `pve1_*` do [lote 1](PVE-V01-LOTE1.md), segundo a seção 11 do
[contrato](CONTRATO-ANIMACOES.md). **Validação técnica concluída. Piloto aprovado pelo diretor em 2026-11-19** (lote 1 de animações e IA, sobre o
vídeo contra o Varrisco e os GIFs). A aprovação não cobre esquiva, bloqueio e golpe pesado em combate real: no vídeo eles não
aparecem, porque o Varrisco quase não ataca. Esses três têm só validação técnica isolada. Nada foi integrado à Alpha. O que está
medido aqui é tempo, contato, janelas, deslocamento e regressão — nada disso diz se o combate *parece bom*.

Tudo fica atrás de um interruptor próprio, `usarPve1(true)` em `src/trajetoria-arma.js`, ligado pelo laboratório
com `?pve1=1` (`src/web3d/app-hunters.js`) e pelos testes. Desligado — o padrão — o comportamento é idêntico ao
anterior, e isso é verificado por impressão digital (ver "Regressão").

## O que mudou

| Item do pedido | Como ficou |
|---|---|
| Tempo vem do clipe | Com o interruptor ligado e espada, `estilo(a)` devolve o estilo PvE: preparo = `impact` do clipe (leve 0,4167 s, pesado 0,9333 s) e recuperação = `duration − impact` (0,7333 s, 1,0667 s). `action.impact − action.start` e `action.end − action.start` saem exatamente dos números de `trajetorias-pve1.js`. Nenhum clipe é acelerado; as janelas da IA (`escolherSequencia`) é que se ajustam: o golpe leve passa a exigir uma abertura de cerca de 0,85 s. O clipe é escolhido pela regra de `remapPve1` (`clipePve1`: heavy/finish → pesado, o resto → leve). |
| Uma fonte só para lâmina e contato | `armaLocal` lê punho e direção da lâmina por quadro de `trajetorias-pve1.js`, junto com as do PvP v12, num único mapa. `amostrarArma`, `contatoTrajetoria` e `aparoNoIntervalo` usam essa leitura. A janela ativa é a das fases autoradas (`activeStart`–`activeEnd`), não a janela abstrata de fase do núcleo. Nenhuma trajetória foi duplicada. |
| Janelas de interrupção | `podeInterromper(action, t, para)` consulta `interrupts` do clipe. A ação guarda `clip`; o cancelamento de recuperação para aparar ou esquivar só vale dentro de uma janela que declare `block`/`dodge`. `cancelAfter` passa a ser o início da primeira janela depois do contato (leve 0,62 s, pesado 1,50 s). |
| Esquiva | `esquivarPve1`: a IA escolhe o lado (`left`/`right`, relativo ao corpo) e o expõe em `hunter.dodgeLado`, `hunter.esquivaPve` e no estado de animação (`combatAnimation` devolve `lado` e `duracao`). A esquiva dura 1,00 s e o corpo percorre `rootMotion.curve` (1,2 m nativos, escalados por altura/1,70 m e pela mobilidade), aplicada por `moverEsquivasPve1` antes do passo do núcleo, com checagem de terreno e com a varredura de geometria sólida do próprio `passoHunters`. Não usa o `impulso` do núcleo. |
| Bloqueio | A guarda de lâmina sobe pelo tempo do clipe (0,30 s, a pose segurada) em vez de 0,12 s. A IA só apara se o resto do preparo do inimigo for de pelo menos 0,30 s. Investida de monstro é esquivada, não aparada. |
| Distância e decisão | O alcance de trabalho é o da lâmina autorada na janela ativa (1,26 m leve, 1,23 m pesado a 1,75 m de altura) menos 10 cm. Esquiva só se há tempo de sair da linha: o corpo precisa de 0,47 m de folga (raio 0,26 + tolerância de contato 0,15 + folga), que a curva do clipe leva ~0,28 s para entregar; sem isso a IA não esquiva. Perna ferida encurta a esquiva e, abaixo de 0,6 de mobilidade, a IA deixa de escolher o pesado (2,00 s de compromisso); abaixo de 0,45 não esquiva. Contra monstro mais pesado que o Hunter a saída curta ganha até 0,5 m. A previsão continua a do núcleo: sinal de preparo, `windup` aprendido e `restante`. Stamina e terreno seguem as regras que já existiam (reserva de energia, `segmentoLivre`). |
| Cadeia | Sem o clipe `finish` (lote 2), a cadeia da espada fica em 2 golpes e o contra-ataque usa o golpe leve com o tempo do clipe leve. |

Arquivos editados: `src/combate-jogador.js`, `src/trajetoria-arma.js`, `src/animacao-jogador.js` (só o estado
`combat_dodge`), `src/mundo-hunters.js` (uma chamada que não faz nada com o interruptor desligado) e
`src/web3d/app-hunters.js` (liga o interruptor). `cerebro-hunter.js` não precisou mudar: a IA já passa por
`decidirComoJogador`. Não foram tocados: gerador, GLBs, `trajetorias-pve1.js`, `trajetorias-pvp12.js`,
`remapPve1`/`remapPvp12`, Alpha, PvP v12, IA das criaturas.

## Medidas

Tudo reproduzível: `node scripts/medir-pve1.mjs`, `node scripts/regressao-pve1.mjs`,
`node scripts/bench-pve1.mjs 0|1`, `npm test`. Cenário `jogador-espada` (Hunter de espada contra o Varrisco
real, 85 kg), 120 s simulados no máximo.

### Taxa de reprodução por golpe (portão do contrato: 0,90×–1,10×)

Tempo do clipe dividido pelo tempo simulado, amostrado a cada passo de simulação de todo golpe, no preparo e na
recuperação, como o renderizador o faria com `combatAnimation`.

| Golpe | Preparo | Recuperação | Amostras |
|---|---|---|---|
| `pve1_c_sword_light` (inclui `follow`, que cai no leve) | 1,000×–1,000× | 1,000×–1,000× | todas as sementes |
| `pve1_c_sword_heavy` | 1,000× (teste de tempo; o pesado não saiu nas sementes abaixo) | 1,000× | 1 golpe forçado |

Antes, o mesmo preparo rodava a 0,29 s contra 0,4167 s do clipe, o que esticava a animação em 1,4× no preparo e
~1,9× na recuperação. Agora a taxa é 1,0× por construção.

### Resultado por semente (interruptor ligado × desligado, 120 s)

| Semente | Desfecho (ligado) | Golpes | Acertos | Erros | Contato na janela ativa | Hunter ferido |
|---|---|---|---|---|---|---|
| 7 | Varrisco derrotado em 77,5 s | 12 | 10 | 0 | 12/12 | 0 |
| 17 | Varrisco derrotado em 105,8 s | 21 | 15 | 2 (`membro_nao_alcanca`) | 19/19 | 0 |
| 23 | Varrisco derrotado em 104,9 s | 19 | 11 | 5 (`membro_nao_alcanca`) | 14/14 | 0 |

Desligado, na mesma medida (trajetória antiga, tempo do núcleo): 8/7/7 acertos em 26/17/32 golpes, com 12/6/15
erros por `trajetoria_nao_alcanca` (a lâmina do núcleo não alcançava o corpo) e contato dentro da janela ativa
autorada em 2/24, 0/16 e 1/23 golpes. Com o PvE ligado esse tipo de erro some: a lâmina que desenha o golpe é a
que testa o contato. Cada golpe agora dura 1,15 s em vez de ~0,7 s (ritmo PvE mais lento, como o contrato aceita): nas sementes 17 e 23
o Varrisco cai em 105,8 s e 104,9 s contra 37 s e 74,3 s antes. Na semente 7 acontece o contrário: antes ele
sobrevivia aos 120 s e agora cai em 77,5 s, porque os golpes passaram a acertar.

### Regressão (interruptor desligado)

`scripts/regressao-pve1.mjs` junta resultado, hash do mundo, estados e contagem de eventos de: duelos PvP v12
com guarda fechada ligada e desligada (`rodarCombate`, 120 s, sementes **7, 17, 23**), `arena-duelo`,
`jogador-espada`, `jogador-lanca`, `jogador-montante` e `arena-aparo`. A impressão digital do resultado antes
desta mudança (commit `add9d7f`) e depois é a mesma, `6c3fe698e65e90d27e40acf26f12dee14fbfb8d890cab21c627130ef3605833b`.
O teste `regressão` em `test/pve1-ia.test.mjs` guarda esse valor: se o núcleo mudar por outro motivo, o teste
avisa e a impressão digital precisa ser regerada de propósito, não ignorada.

### Esquiva, bloqueio e janelas (testes)

- Esquiva: lado exposto à animação e igual ao lado em que o corpo anda; duração 1,000 s; em cada passo de 0,2 s a
  1,0 s o corpo está a menos de 6 cm da curva do clipe escalada (deslocamento total 1,2 m × 1,75/1,70).
- Sem espaço dos dois lados (rochas): não esquiva. Perna ferida: curva escalada para ≤ 70%. Sem tempo (restante
  de 0,10 s): não esquiva.
- Bloqueio: `guarda.impact − guarda.start` = 0,30 s; a lâmina fica a meio caminho em 0,15 s.
- Janelas: leve cancelável só em [0; 0,12] e [0,62; 1,15]; pesado em [0; 0,30] e [1,50; 2,00]; `cancelAfter` de
  ações reais cai na primeira janela depois do contato.

### CPU por passo (`scripts/bench-pve1.mjs`, mediana de 7 corridas de 800 passos, `jogador-espada`)

| | passo p50 | média |
|---|---|---|
| antes (add9d7f) | 0,056–0,064 ms | 0,060–0,069 ms |
| depois, interruptor desligado | 0,066–0,067 ms | 0,075–0,083 ms |
| depois, interruptor ligado | 0,061–0,071 ms | 0,076–0,089 ms |

Duas rodadas intercaladas; a diferença entre elas é do tamanho do ruído da máquina. `bench-hunters.mjs`
(2, 10 e 20 Hunters, 30 s) repetido três vezes por árvore variou ±40% entre corridas da mesma árvore, então não
serve para separar esse custo. Conclusão honesta: o custo por passo é inferior a 0,1 ms nos dois estados e
não há aumento mensurável acima do ruído; o que foi adicionado no caminho quente é uma leitura de interruptor
e, ligado, a busca de um quadro por amostra de lâmina.

### Vídeo real contra o Varrisco

`node scripts/capture-jogador.mjs --pve1` (servidor da raiz na porta 8782 já estava de pé e servia esta árvore):
`resultados/pve-v01/espada-real.webm` e `browser-final.json`/`browser-espada.json` (64,65 s simulados, Varrisco
derrotado, 0 violações de invariante, 0 erros de página, clipes vistos: guarda, corrida, `pve1_c_sword_light`,
passos para trás, para a frente e para a direita), mais três quadros. O script tinha um erro anterior a este
trabalho (`page.evaluate` com dois argumentos) e foi corrigido. **É vídeo de validação técnica, não de aprovação.**

## Pendências e limites

- **Esquiva e bloqueio quase não aparecem no confronto real.** Nas três sementes o Varrisco ataca 0–1 vez por luta
  e o Hunter nunca é ferido, então o vídeo não mostra esquiva nem bloqueio; esses comportamentos foram medidos
  isolados (testes acima). Também não existe carnívoro grande com rig. Um monstro que ataque de verdade é
  necessário para julgar a IA defensiva.
- **Esquiva é rara por conta do tempo de leitura.** O Hunter só vê o preparo depois do atraso de percepção e
  de reconhecimento; um bote de 0,60 s deixa ~0,1–0,3 s de preparo, e a curva do clipe precisa de ~0,28 s para
  tirar o corpo da linha. A IA recusa a esquiva sem tempo em vez de fingir que escapou. Calibrar isso (leitura
  mais cedo, folga menor) é decisão de ritmo de jogo, não de animação.
- **O pesado não saiu nas sementes.** `escolherSequencia` só o escolhe com abertura ≥ ~1,6 s (rival caído ou
  atordoado), e o Varrisco quase não cai. O pesado foi validado em tempo, janelas e lâmina, não em combate.
- **`remapPve1` ainda deduz o lado da esquiva pela direção do movimento e reescala o tempo de 0,65 s para o
  clipe.** Não pude editá-lo (é do dono do A/B/C). Para não esticar o clipe, `combatAnimation` entrega `time`
  na escala de 0,65 s e define `direcaoMovimento` no sentido do passo lateral; o resultado é o lado e o tempo
  certos, mas o ideal é `remapPve1` ler `requested.lado` e `requested.duracao` e tocar em tempo real.
- **Janelas iniciais não são usadas.** O leve declara `dodge`/`block` em [0; 0,12] e o pesado em [0; 0,30]; a IA
  não cancela um golpe ainda em preparo, só a recuperação. É um subconjunto seguro das janelas, não o conjunto.
- **A guarda de bloqueio é segurada, não executada.** O renderizador toca só até a pose de 0,30 s; as fases
  `impacto`/`absorcao`/`recovery` do clipe de bloqueio não são tocadas e a esquiva não cancela o bloqueio dentro
  da janela [0,18; 0,36].
- **Hunter contra Hunter com PvE ligado** funciona (os testes usam esse arranjo), mas não foi tema deste lote.
- **Manifesto da v05.** O campo `trajectorySourceSha256` apontava para uma versão de `trajetoria-arma.js` anterior
  aos dois últimos commits do PvP (o teste já falhava antes deste trabalho) e foi atualizado para o hash do
  arquivo editado, em LF. O teste agora normaliza fim de linha antes de comparar, porque o checkout do Windows
  entrega CRLF.
- **Taxa no navegador.** A taxa foi medida na simulação, com a função de estado que o renderizador usa; a corrida
  no navegador (2× de reprodução, 288 ms por quadro em SwiftShader) tem outra cadência de passos e outro desfecho
  (64,65 s contra 105,8 s para a semente 17), e a taxa por quadro lá não foi instrumentada.
- **Aprovação artística** (diretor, sobre vídeo contra criatura) continua pendente.
