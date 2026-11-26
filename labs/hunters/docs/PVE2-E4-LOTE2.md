# PvE v02 — E4, lote 2: combate com espada no rig v13

Lote 2 da etapa E4 do [plano PvE](PLANO-EVOLUCAO-PVE.md), sobre o [lote 1](PVE2-E4-LOTE1.md) aprovado pelo diretor em
2026-11-19. Status: **validação técnica feita; aprovação artística pendente**. PvP, Alpha, PvE v01, criaturas e GLBs
aprovados não foram tocados.

## Clipes

| Clipe | Duração | O que é |
|---|---|---|
| `pve2_c_sword_combo_1` | 0,80 s | Diagonal descendente, do ombro direito ao quadril esquerdo, com meio passo da perna da frente |
| `pve2_c_sword_combo_2` | 0,85 s | Horizontal reverso (costas da mão), da esquerda para a direita; a pelve gira à frente da lâmina |
| `pve2_c_sword_combo_3` | 1,10 s | Ascendente com passo longo: o corpo afunda, avança 0,43 m e sobe com a lâmina |
| `pve2_c_sword_charge_loop` | 1,00 s (laço) | Carga: base larga e baixa, lâmina sobre o ombro direito, mão livre mirando, tremor de esforço |
| `pve2_c_sword_charge_release` | 1,20 s | Liberação: estocada explosiva de 0,51 m (pé da frente e chassé do pé de trás) com corte para a frente e para baixo |
| `pve2_b_sword_roll_left` / `_right` | 0,90 s | Rolamento: vira para o lado, cambalhota de ombro, levanta e volta à guarda, 1,3 m de lado |

O combo encadeia pelas janelas `interrupts`: 1 → 2 → 3 → 1.
- A carga cancela em liberação, esquiva ou bloqueio.
- O rolamento cancela em esquiva, bloqueio, combo 1 ou carga a partir de 0,63 s.

## Método

O lote 1 usava curvas de ciclo. Os golpes usam **poses-chave sobre a guarda**: cada pose muda só o que precisa.
- **Interpolação nos parâmetros da pose**, quadro a quadro, por spline com velocidade contínua. O corpo não para em cada
  chave. A primeira e a última chave têm tangente zero: o golpe sai da guarda e volta a ela em repouso.
- **Cada cadeia com atraso próprio:** a pelve 2 quadros antes, o antebraço 1 depois, a mão 2 depois, a cabeça 2 depois.
  O corpo lidera e a lâmina chega por último, em chicote.
- **A lâmina é um alvo em cada pose.** Pronação, flexão e desvio do punho são escolhidos dentro de uma caixa anatômica
  (desvio ulnar até 30°, radial até 15°, flexão e extensão até 50°), perto da escolha da pose anterior.
  A spline nunca sai da caixa.
- **Pés plantados no mundo.** O avanço do corpo vai para `rootMotion` (curva por quadro, eixo `z` = frente ou `x` = lado),
  e o clipe sai em lugar. A pelve desce o necessário para as pernas alcançarem os pés.
- **Passos com tempo próprio** nas estocadas. O pé de trás dá um chassé quando o corpo avança mais do que a perna alcança;
  antes ele era arrastado até 88 mm por quadro.
- **Contato calculado**, não digitado: é o quadro da janela ativa em que a lâmina chega mais longe à frente.
- **Rolamento:**
  - pernas em FK encolhidas no ar, com o IK desligado em rampa depois que os pés saem do chão e religado antes de pousarem;
  - pelve com uma volta de 360° em torno do eixo do rolamento;
  - contato com o chão resolvido: em cada quadro do ar, a pelve sobe ou desce até o ponto mais baixo do corpo tocar o chão.

## Fonte única para a simulação (contrato §6)

`src/trajetorias-pve2.js` (gerado; não editar) tem, para cada clipe do lote 1 e do lote 2:
- duração, fases (com o contato calculado), janelas de interrupção, contatos de pé e curva de deslocamento;
- nos golpes, punho (em alturas de corpo de 1,70 m) e direção da lâmina por quadro, nos eixos do glTF, no mesmo formato
  de `trajetorias-pve1.js`.

## Portões (medidos no GLB exportado e reimportado)

Ver `resultados/pve2-e4/portoes-e4-combate.json` e a tabela abaixo.

GLB: `assets/hunter-rig-v13/hunter_rig_v13_blockout.glb` — sha256 `941c70d8…`, 923 844 bytes, 12 clipes. **0 violações**.

| Clipe | Contato | Cotovelo no contato | Desliz. pé plantado (mm/quadro) | Folga lâmina–corpo | Ponta acima do chão | Punho–cabeça | Costura entrada / saída | Avanço | Joelho mín. | Quadril ext. máx. | Triâng. deformados (coxa) | Braço–cabeça |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| combo 1 | 0,300 s | 143,5° | 0,03 | 0,021 m | 0,134 m | 0,374 m | 0,13° / 0,13° | 0,13 m | 1,6° | 14,8° | 73 (6) | 0,053 m |
| combo 2 | 0,333 s | 157,9° | 0,03 | 0,105 m | 0,915 m | 0,423 m | 0,13° / 0,13° | 0,08 m | 32,7° | −12,7° | 63 (5) | 0,097 m |
| combo 3 | 0,367 s | 157,1° | 0,02 | 0,022 m | 0,468 m | 0,504 m | 0,13° / 0,13° | 0,43 m | 10,1° | 13,4° | 57 (9) | 0,104 m |
| carga (laço) | — | — | 0,03 | 0,055 m | 1,091 m | 0,291 m | — / 0,00° | 0 | 42,8° | −21,4° | 40 (4) | 0,070 m |
| liberação | 0,150 s | 140,3° | 0,04 | 0,055 m | 0,017 m | 0,291 m | parte da carga / 0,13° | 0,51 m | 19,2° | −0,4° | 77 (13) | 0,070 m |
| rolamento esq. | — | — | 0,03 | *exceção* | *exceção* | 0,455 m | 0,13° / 0,13° | +1,30 m (x) | 0,0° | −20,2° | 79 (20) | 0,122 m |
| rolamento dir. | — | — | 0,03 | *exceção* | *exceção* | 0,455 m | 0,13° / 0,13° | −1,30 m (x) | 35,7° | −20,2° | 87 (16) | 0,122 m |
| **limite** | na janela ativa | ≥ 140° | ≤ 2 | ≥ 0,02 m | ≥ 0 | ≥ 0,16 m | ≤ 0,5° | — | ≥ −5° | ≤ 30° | ≤ 90 (≤ 20) | ≥ 0,05 m |

Punho, em todos os golpes, dentro dos limites anatômicos (extensão 60, flexão 70, radial 20, ulnar 35). Os portões do lote 1
continuam valendo para guarda e locomoção (0 violações). `npm test`: **110 passam**.

**Folgas apertadas:** a liberação passa a lâmina a 1,7 cm do chão no contato. Os combos 1 e 3 passam a lâmina a 2,1–2,2 cm
do corpo. Todos ficam dentro dos limites, mas perto.

**Exceção documentada nos rolamentos:** a lâmina de 0,8 m encosta no chão e no corpo durante a cambalhota, e nenhuma
pegada evita isso com a arma na mão. Os portões de ponta acima do chão e de folga lâmina–corpo **não valem** para esses dois
clipes (`gateExceptions` nos extras); os demais portões valem. Num jogo isso costuma ser tolerado. Se o diretor quiser
resolver, há dois caminhos: rolar com a arma guardada ou um rolamento curto sem cambalhota.

## Rolamento refeito (revisão do diretor)

O diretor apontou a perna anatomicamente errada no rolamento. A causa era um erro de sinal nas pernas em FK, que só
aparecem com o IK desligado, no ar:
- `R(X, +t)` girava a coxa **para trás** (hiperextensão de quadril de 111–117°);
- `R(X, −k)` dobrava o joelho **para a frente** (até 141°).

O mesmo erro respondia pela coxa esmagada (58 triângulos) e, junto com os braços dobrados, pelas mãos atravessando o
rosto (0,5 cm).

Correções:
- **Sinal corrigido.** Mais um limite de IK no joelho (só flexão), porque o combo 1 também hiperestendia 10° com a perna
  quase reta, e 3% de folga de alcance nos golpes, para o joelho nunca travar reto.
- **Rolamento redesenhado como mergulho:**
  - as mãos tocam o chão à frente, abrem para os lados com o corpo invertido e nunca passam pelo rosto;
  - encolhimento: quadril até 70°, joelho até 94°, coluna até 34° e pescoço com cabeça até 56°;
  - no rolamento direito, os pés da aterrissagem estavam com o afastamento do rolamento esquerdo, e as pernas cruzavam.
    Agora é espelhado.
- **Portões novos, que reprovam a revisão de combate:**

  | Portão | Limite |
  |---|---|
  | Joelho dobrando para a frente | até 5° |
  | Extensão de quadril | até 30° |
  | Triângulos esmagados ou esticados (área < 35% ou > 200% do repouso), sem os dedos | até 90 |
  | Desses, na coxa | até 20 |
  | Distância braço/mão–cabeça | ≥ 5 cm |

  Os limites de deformação foram calibrados nos clipes já aceitos (máximo de 85 triângulos, 17 na coxa e 7 cm entre
  braço e cabeça).

  Rodado sobre o GLB do PR #96, o portão reprova os dois rolamentos com joelho a −141° e quadril a 117°, e o combo 1 com
  joelho a −10°.

  | | Antes | Agora |
  |---|---|---|
  | Triângulos deformados | 138–139 | 79–87 |
  | Na coxa | 58 | 16–20 |
  | Braço–cabeça | 0,5 cm | 12,2 cm |
  | Joelho | dobrava para a frente | ≥ 0° (rolamento direito ≥ 36°) |

## O que não está neste lote

- **Ligação no laboratório (E7): feita depois deste lote**, em [PVE2-E7-LAB.md](PVE2-E7-LAB.md). O que segue descreve o estado em que este lote foi entregue.
- **Ligação no laboratório (E7):** a simulação e a IA ainda não leem `trajetorias-pve2.js`. Ligar só o renderizador
  esticaria os clipes e reprovaria o portão de 0,90–1,10×. A ligação inclui `remapPve2`, a mistura de locomoção da E3 e a
  transição de pegada (normal ↔ reversa).
- Rolamento para a frente e para trás, passos laterais e golpes P1 (plano §4).
- Vinco do ombro (E1, ainda aberto).
- glTF Validator da Khronos não está instalado nesta máquina.

## Reproduzir

```
blender -b --python labs/hunters/source/rig-v13/build_hunter_rig_v13.py -- <raiz>
blender -b labs/hunters/assets/hunter-rig-v13/hunter_rig_v13_source.blend --python labs/hunters/source/rig-v13/author_e4_locomocao.py -- <raiz>
blender -b labs/hunters/assets/hunter-rig-v13/hunter_rig_v13_source.blend --python labs/hunters/source/rig-v13/author_e4_combate.py -- <raiz>
blender -b labs/hunters/assets/hunter-rig-v13/hunter_rig_v13_source.blend --python labs/hunters/source/rig-v13/export_review_rig_v13.py -- <raiz>
blender -b --python labs/hunters/source/rig-v13/review_e4_locomocao.py -- <raiz>
blender -b --python labs/hunters/source/rig-v13/review_e4_combate.py -- <raiz>
cd labs/hunters && npm test
```
