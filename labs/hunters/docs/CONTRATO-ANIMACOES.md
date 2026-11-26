# Contrato de animações do Hunter — PvE v01

Contrato comum entre os módulos de animação (A–F) e a IA PvE. Ele fixa rig, nomes, fases, eventos, trajetória,
contatos, transições e quem pode editar o quê. **Não é inventário de clipes prontos**: nenhum clipe `pve1_*`
existe ainda. Status: **rascunho, aguarda aprovação do diretor**. O módulo G (montarias, ataques montados e
interações especiais) está **suspenso** e fora deste contrato.

O PvP (`pvp12_*`, `remapPvp12`, `trajetorias-pvp12.js`, `?pvp12=1`) **não é alterado** por nada aqui.

## 1. Corpo e rig de referência

Base de autoria PvE: `labs/hunters/assets/hunter-pvp-v12/hunter_pvp_v12.glb`
(sha256 `b36f7a82b852e0f2cfcda665c2098ae3730c472e03711120b03737f8908d2c25`, status `pending-director-approval`).

| | |
|---|---|
| triângulos | 1000 (corpo) + 60 (espada) |
| juntas do skin | 23: as 19 do v02 + `RightFingers1`, `RightFingers2`, `LeftFingers1`, `LeftFingers2` |
| socket de arma | `WeaponSocket_Right_PvP12`, filho de `RightHand` |
| clipes no arquivo | 93 = 2 do v02 + 81 da v05 + 10 `pvp12_*` |
| frente anatômica | `+Z` (determinada olhando a cena; ver histórico) |
| altura nativa → altura no laboratório | 1,70 m → 1,75 m (escala uniforme aplicada ao corpo e à trajetória) |
| taxa de autoria | 60 fps |

Regras:

1. **Malha, skin, materiais, textura e ordem das juntas não mudam.** Cada GLB PvE novo acrescenta clipes e
   reprova a geração se o prefixo binário ou os clipes existentes mudarem (mesmo portão da v12).
2. **Clipes da v05 são histórico, não base.** Os 81 clipes `combat_*`, `sword_*`, `spear_*`, `greatsword_*`,
   `unarmed_*`, `guard_*`, `recover_*`, `hunter_*` ficam no arquivo e **não são desenhados** com a biblioteca
   PvE ligada. A gravação reprova se um aparecer, como na v12.
3. **Rig novo só com pedido.** Se um módulo precisar de junta nova (ex.: dedos completos, socket na mão
   esquerda para arma de duas mãos), o pedido vai ao diretor antes de qualquer autoria. O acréscimo de dedos
   da v11 é o modelo: juntas novas no fim da lista, skin antigo intacto (limite 10 µm).
4. Se a v12 for reprovada, este contrato volta para revisão: a base PvE depende dela.

## 2. Camadas e quem decide o quê

| Camada | Decide | Onde | Nunca faz |
|---|---|---|---|
| Simulação + IA | **o que** e **quando**: ação, alvo, distância, início | `cerebro-hunter.js`, `combate-jogador.js`, `mundo-hunters.js` | escolher pose ou acelerar clipe |
| Biblioteca (A–F) | **como** o corpo executa: poses, fases, contato, trajetória da arma | gerador + GLB + `trajetorias-pve1.js` gerado | mudar dano, alcance ou regra |
| Procedural de vista | pés no terreno, IK de mão no socket, correção fina | `animacao-jogador.js`, `web3d/app-hunters.js` | substituir um clipe mal construído |

A simulação emite um **nome de estado canônico** por `combatAnimation(a,t)` em `src/animacao-jogador.js`.
Esses nomes (abaixo) são o vocabulário do contrato. Cada biblioteca traduz estado → clipe numa função própria,
como `remapPvp12` faz hoje. A PvE ganha `remapPve1`, ligada só com `?pve1=1` (e o equivalente nos scripts
de captura). **Sem `pve1=1` nada muda.**

## 3. Nomes de clipe

Formato: `pve1_<modulo>_<arma>_<acao>[_<variante>]`

- `modulo`: `a` locomoção, `b` movimentação de combate, `c` combate com arma, `d` reação a monstro,
  `e` ferimento e sobrevivência, `f` exploração e ferramentas.
- `arma`: `sword`, `spear`, `greatsword`, `unarmed`, ou `any` quando o clipe não depende da arma.
  São as quatro classes reais de `config/equipamento.json` (`espada`, `lanca`, `montante`, `maos`).
  Escudo é variante de `spear` (`_shield`), não classe.
- `acao` e `variante`: minúsculas, inglês, `_` como separador. Altura de golpe usa `_high` / `_low`, como o
  estado canônico.

Exemplos: `pve1_b_sword_guard`, `pve1_a_sword_run`, `pve1_c_sword_light`, `pve1_c_sword_heavy_charged`,
`pve1_b_sword_dodge_left`, `pve1_d_any_knockback_large`.

## 4. Tabela estado canônico → clipe PvE

Estados que a simulação já emite hoje. A coluna "lote" diz quando o clipe PvE entra; antes disso `remapPve1`
cai na guarda PvE (nunca num clipe v05).

| Estado canônico | Disparo na simulação | Clipe PvE | Módulo | Lote |
|---|---|---|---|---|
| `guard_<arma>` | parado em combate | `pve1_b_<arma>_guard` | B | 1 |
| `recover_<arma>` | `estado === 'recuperando'` | `pve1_b_<arma>_recover` | B | 1 |
| `hunter_walk` | `velocidade` 0,12–2,2 m/s, para frente | `pve1_b_<arma>_step_forward` | B | 1 |
| `combat_step_back/left/right` | direção relativa do movimento | `pve1_b_<arma>_step_back/left/right` | B | 1 |
| `hunter_jog`, `hunter_run` | `velocidade` > 2,2 / > 4 m/s | `pve1_a_<arma>_jog`, `pve1_a_<arma>_run` | A | 1 (`run`) / 2 (`jog`) |
| `combat_turn_left/right` | `velAngular` > 0,4 rad/s parado | `pve1_a_<arma>_turn_left/right` | A | 2 |
| `<arma>_light[_high/_low]` | ação leve | `pve1_c_<arma>_light[...]` | C | 1 (espada) |
| `<arma>_heavy[_high/_low]` | ação pesada | `pve1_c_<arma>_heavy[...]` | C | 1 (espada) |
| `<arma>_follow`, `<arma>_finish` | continuação de combo | `pve1_c_<arma>_follow`, `_finish` | C | 2 |
| `combat_block` | `blockUntil` / `postura === 'defesa'` | `pve1_b_<arma>_block` | B | 1 |
| `combat_dodge` | `dodgeUntil` | `pve1_b_<arma>_dodge_<dir>` | B | 1 |
| `combat_hit_light`, `combat_hit_heavy`, `combat_hit` | `reacaoImpacto`, `atingidoPor` | `pve1_d_any_hit_light/heavy` | D | 3 |
| `combat_guard_recoil` | impacto em bloqueio | `pve1_d_<arma>_guard_recoil` | D | 3 |
| `combat_stagger` | `saude.atordoadoAte` | `pve1_e_any_stagger` | E | 3 |
| `combat_knockdown` | `saude.caidoAte` | `pve1_d_any_knockdown` | D | 3 |
| `combat_get_up` | `getUpUntil` | `pve1_d_any_get_up` | D | 3 |
| `combat_death` | morte | `pve1_e_any_death` | E | 3 |
| `combat_surrender` | rendição | — (PvP; sem clipe PvE) | — | — |

`combat_dodge` hoje não carrega direção. A direção da esquiva (`left`/`right`/`back`) é o primeiro campo novo
que a IA expõe no lote 1.

Estados que **ainda não existem** na simulação (arremesso, agarrão, arrastamento, pisoteamento, queimadura,
congelamento, choque, coleta, escalada, natação, saque e armazenamento da arma): o módulo dono propõe o estado
canônico **junto** com o clipe, e a IA o implementa. Não se autora clipe sem estado que o dispare.

## 5. Fases e eventos (obrigatórios por clipe)

Cada clipe grava em `animation.extras` do GLB e no manifesto:

```json
{
  "contract": "hunter-pve-v01",
  "module": "c",
  "weapon": "sword",
  "loop": false,
  "fps": 60,
  "duration": 1.40,
  "phases": { "guard": 0, "anticipation": 0.18, "activeStart": 0.42, "contact": 0.52,
              "activeEnd": 0.62, "recovery": 0.62, "guardReturn": 1.40 },
  "interrupts": [ { "from": 0.0,  "to": 0.30, "into": ["dodge", "block"] },
                  { "from": 0.90, "to": 1.40, "into": ["dodge", "block", "light"] } ],
  "footContacts": { "left": [[0, 1.40]], "right": [[0, 0.30], [0.55, 1.40]] },
  "rootMotion": { "mode": "curve", "distanceM": 0.45 }
}
```

Os números do exemplo são ilustrativos, não medidos.

- **Ataque** (módulo C): `guard`, `anticipation`, `activeStart`, `contact`, `activeEnd`, `recovery`,
  `guardReturn` são obrigatórios e crescentes. `contact` é **calculado** (alcance máximo da lâmina na direção
  do alvo), nunca digitado, como na v12.
- **Interrupções**: janelas em que a IA pode cancelar o clipe e em quê. Fora delas o corpo está comprometido.
  A IA só cancela dentro de uma janela declarada.
- **Locomoção e passos**: `footContacts` por pé, em segundos. Base do travamento de pé e do teste de
  deslizamento.
- **Reações** (D/E): `phases` com `impact`, `peak`, `settle`, `recoverable` (instante a partir do qual a IA
  pode agir de novo), e `scale`: `small` / `medium` / `large` — porte do monstro para o qual a reação foi feita.
- Nome de fase fora desta lista é aceito em `phases` como informação, mas a IA não o lê.

## 6. Trajetória e contato: uma fonte só

O gerador grava, por quadro a 60 fps, punho (em alturas de corpo), direção da lâmina e deslocamento do corpo
de cada clipe com arma ou `rootMotion` em `src/trajetorias-pve1.js` (**gerado, não editar**), no mesmo
formato de `trajetorias-pvp12.js`, mais as fases e janelas da seção 5. A simulação lê lâmina, deslocamento e
tempo dali. Nenhum módulo reescreve golpe à mão em `armaLocal`: a divergência medida antes da v12 era de
0,56 m e 105°.

## 7. Tempo: sem aceleração artificial

Na PvE, o tempo da ação vem do clipe, não o contrário:

- `action.impact − action.start` = `contact − guard` do clipe; `action.end − action.start` =
  `guardReturn − guard`. A IA lê esses números de `trajetorias-pve1.js`.
- **Portão**: taxa de reprodução de cada clipe PvE que não é locomoção em **0,90×–1,10×**. Fora disso a captura
  reprova. Locomoção (passos, corrida) segue a distância andada (`stride`), então a taxa varia com a velocidade
  de propósito; ali o portão é o pé plantado, não a taxa.
- Toda duração é um número inteiro de quadros a 60 fps (a corrida tem 0,65 s, não 0,64 s): senão o último
  quadro não cai no fim do clipe e o canal não cobre a duração declarada.
- Consequência aceita no pedido do diretor: o ritmo PvE fica mais lento que o do núcleo atual (a v12 roda
  2,2–3,3× acelerada no PvP). A IA PvE ajusta escolha de janela e distância a esse tempo; dano e alcance não
  mudam sem teste.
- O PvP mantém o comportamento atual.

## 8. Deslocamento do corpo (root motion)

- Clipes **em lugar** por padrão: o laboratório move o corpo, como na v12.
- Esquiva, avanço de ataque pesado e reações com arremesso usam `rootMotion.mode: "curve"`: o clipe é
  exportado em lugar e a curva de deslocamento vai para `trajetorias-pve1.js`. A simulação aplica essa
  curva (com colisão). Assim os pés autorados e o corpo simulado concordam sem patinar.
- Nunca deslocamento embutido no osso `Hips` e também aplicado pela simulação.

## 9. Transições

- Todo clipe dos módulos B e C começa e termina na guarda PvE da sua arma (`pve1_b_<arma>_guard`). Portão:
  quadro 0 e último quadro contra a guarda, osso por osso, **≤ 0,5°** (tronco e braços; pernas livres em passos).
  Exceções: estados em laço com pose própria (`pve1_b_<arma>_recover`, `pve1_a_<arma>_run`), que entram e saem
  por mistura.
- Clipes A (corrida, giro) terminam numa pose que a guarda alcança em ≤ 0,20 s de mistura.
- Reações D/E começam de qualquer pose (mistura de entrada ≤ 0,12 s) e terminam na guarda ou em `knockdown`.
- Mistura máxima entre clipes: 0,20 s. Mistura maior esconde transição mal autorada e reprova na revisão.

## 10. Portões de qualidade (cada lote)

Herdados da v12, com os mesmos limites: erro de IK de mão 10 mm, de pé 12 mm, deslizamento de pé plantado
2 mm, desvio de punho 60°, penetração lâmina-corpo 0, cotovelo no contato ≥ 140°, skin antigo 10 µm,
costura 0,5°. Novos:

| Medida | Limite |
|---|---|
| taxa de reprodução na captura | 0,90×–1,10× |
| fases obrigatórias presentes e crescentes | todas |
| janelas de interrupção dentro do clipe | todas |
| clipe v05 ou `pvp12_*` desenhado com `pve1=1` | 0 |
| arma fora do socket fora de golpe | 0,000 m; em golpe ≤ 2,5 cm |
| centro do punho fechado ao centro da cabeça | ≥ 16 cm em todo quadro |
| pé plantado medido no mundo (pé local + curva de deslocamento) | ≤ 2 mm por quadro |

Validação técnica (portões acima, testes, glTF Validator, SHA-256 local e remoto) e **aprovação artística**
(diretor, sobre GIFs de perfil, frente e três-quartos e vídeo contra criatura) são registros separados.

## 11. Propriedade dos arquivos

Nenhum arquivo tem dois donos ao mesmo tempo. Lotes do mesmo gerador são **sequenciais**.

| Dono | Modelo | Pode editar | Não edita |
|---|---|---|---|
| A, B, C | Opus 5.5 | gerador PvE, definições A/B/C, `assets/hunter-pve-v01/`, `trajetorias-pve1.js` (via gerador), `remapPve1` | IA, PvP, criaturas |
| D, E, F | Opus 5 | definições D/E/F no gerador PvE, GLB PvE de versão nova | definições A/B/C, IA, PvP |
| IA PvE | Sonnet 5.5 | `cerebro-hunter.js`, `combate-jogador.js`, leitura de tempo em `trajetoria-arma.js`, testes | gerador, GLB, `remapPve1`, criaturas |

O gerador PvE é o próprio `scripts/animate-hunter-pvp-v09.mjs` com `--pve1`, no mesmo padrão das flags
`--v10`/`--v11`/`--v12`: IK, Hermite, trilha de pé e portões são os mesmos, sem módulo novo. Portão de não
regressão: sem `--pve1` a saída da v12 (GLB, manifesto e `trajetorias-pvp12.js`) sai **byte a byte igual**
(sha256 conferido a cada geração do lote 1). Saída PvE: `assets/hunter-pve-v01/hunter_pve_v01.glb` (os 93 clipes
da v12 + os `pve1_*`) e `src/trajetorias-pve1.js`.

IA de criaturas: qualquer ajuste para o PvE fica atrás de flag própria, com teste de regressão, e não muda a
impressão digital aprovada do laboratório de criaturas.

## 12. Lote 1 (piloto)

Um Hunter, espada, contra **Varrisco v02** (`medium_carnivore`, 3,1 m, 85 kg,
`assets/models/creatures/varrisco/v02/varrisco-animated-v02-LOD0.glb`). Não existe carnívoro grande com rig
no repositório; Nharuk (predador, 125 kg) tem o GLB riggado ausente do caminho declarado na ficha.

| Clipe | Módulo |
|---|---|
| `pve1_b_sword_guard` | B |
| `pve1_b_sword_step_forward`, `_step_back`, `_step_left`, `_step_right` | B |
| `pve1_a_sword_run` | A |
| `pve1_b_sword_block` | B |
| `pve1_b_sword_dodge_left`, `pve1_b_sword_dodge_right` | B |
| `pve1_c_sword_light` | C |
| `pve1_c_sword_heavy` | C |
| `pve1_b_sword_recover` | B |

Cenário: `jogador-espada` com `?pve1=1`, semente fixa. Depois da aprovação artística o Sonnet 5.5 adapta a IA
(lote 1 da IA) e só então os módulos D/E/F começam.

## 13. Pendências fora deste contrato

- `config/hunter.json` → `modelo` ainda descreve o GLB v02 com dois clipes; o laboratório escolhe o GLB em
  `src/web3d/app-hunters.js`. Corrigir quando `pve1=1` existir.
- Modelos 3D de lança, montante e escudo não existem; só a espada tem malha (60 triângulos, socket PvP12).
- Não há clipes de saque e armazenamento da arma nem estado que os dispare.

## Histórico

A versão anterior deste documento descrevia `hunter_masculino_1000tri_v02.glb` (sha256 `b1d0074e…`, 19 ossos,
só `Walking` e `Running`). A frente `+Z` foi determinada olhando o modelo na cena: a heurística de
`auditar-glb.mjs` compara cabeça e raiz no plano e não serve para bípedes (Δ medido 0,02 m, ruído). Evidência:
[`resultados/evidencias/04-hunter-glb-v02-rumo-mais-x.png`](../resultados/evidencias/04-hunter-glb-v02-rumo-mais-x.png).
