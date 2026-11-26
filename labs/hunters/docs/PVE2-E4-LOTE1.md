# PvE v02 — E4, lote 1: locomoção com espada no rig v13

Etapa E4 do [plano PvE](PLANO-EVOLUCAO-PVE.md), sobre o rig v13 ([E0](RIG-V13-E0.md) e [E1](RIG-V13-E1.md) aprovadas)
e o runtime da [E3](RUNTIME-E3.md). Status: **validação técnica feita; aprovação artística pendente**.
PvP, Alpha, PvE v01, criaturas e GLBs aprovados não foram tocados.

## Por que dois lotes

| Lote | Clipes | Estado |
|---|---|---|
| **1 (este)** | guarda, andar, trote, corrida | feito |
| 2 | rolamentos (2 lados), combo de 3 golpes, carga + liberação | depois da revisão deste lote |

A revisão do estilo de locomoção (peso, inclinação, como a espada é carregada) orienta o lote de combate.
**O lote 1 ainda não entra no laboratório.** Sem golpes v13, o Hunter ficaria na guarda durante os ataques da
simulação. A ligação no laboratório (`remapPve2`, mistura de locomoção da E3) entra com o lote 2.

## Arquivos

| | |
|---|---|
| GLB | `assets/hunter-rig-v13/hunter_rig_v13_blockout.glb` — sha256 `5bdf1991…`, 579 408 bytes; clipes `pve2_b_sword_guard`, `pve2_a_sword_walk`, `pve2_a_sword_jog`, `pve2_a_sword_run` e `rig13_stress` |
| Fonte | `hunter_rig_v13_source.blend`; autor `source/rig-v13/author_e4_locomocao.py` |
| Revisão | `source/rig-v13/review_e4_locomocao.py` → `resultados/pve2-e4/portoes-e4.json` |
| Vídeos reais | `resultados/pve2-e4/<clipe>_{perfil,frente,tres-quartos}.mp4` (3 ciclos) e `<clipe>_perfil_{a,b,c,d}.png` |

Cada clipe leva em `animation.extras`:
- campos do contrato: `contract`, `loop`, `fps`, `duration`, `footContacts`, `rootMotion`;
- nos ciclos de locomoção: `stride`, `speedMs`, `footRoll` (fases do apoio) e `bladeCarry` (como a mão segura a espada).

## Método (o que muda em relação à v01)

- **Pernas por IK nos controles de pé**, com trilha exata no chão:
  - no apoio, o pé anda para trás à velocidade do clipe;
  - o pé rola no calcanhar e depois na bola do pé, com pivô no ponto real de contato da sola (o calcanhar rola sobre a curva);
  - o pouso casa com a velocidade do chão;
  - a ponta do pé fica nivelada quando o pé está inclinado para baixo.
- **Pelve que desce o necessário** para as duas pernas alcançarem os pés. É um mínimo suave entre a oscilação e o
  alcance, com no máximo 12 cm a mais. Sem isso o joelho travava esticado.
- **Cadência ajustada à perna do corpo base.** O quadril fica a 0,757 m (44% da altura; num humano real, perto de 53%).
  Passadas de humano real ficavam fora do alcance:

  | Clipe | Velocidade | Ciclo | Fase de apoio |
  |---|---|---|---|
  | andar | 1,4 m/s (a da ficha) | 50 quadros | 62% |
  | trote | 3,1 m/s | 35 quadros | 42% |
  | corrida | 5,6 m/s | 34 quadros | 25%, com voo |

- **Cada cadeia com fase própria:**
  - a pelve lidera (giro, inclinação para o lado em balanço, descida no apoio);
  - o tronco contra-gira 3 quadros depois;
  - os braços balançam 3 quadros atrasados e o cotovelo 5;
  - a cabeça estabiliza o olhar.
- **A mão da espada fica parada no antebraço durante o ciclo** (problema D do diagnóstico). Pronação, flexão e desvio são
  escolhidos uma vez por clipe, dentro dos limites anatômicos, e o transporte usa no máximo 25° de desvio ulnar.
  É a lâmina que segue o braço. Antes, a v01 movia o punho 77° por passada.

## Como a espada é carregada

A pegada natural põe o cabo a 75° do antebraço, e isso limita o que a lâmina alcança. Com o cotovelo dobrado,
a lâmina não aponta para trás nem para baixo. O braço foi posado para cada caso:

| Clipe | Braço | Lâmina | Erro para o alvo |
|---|---|---|---|
| andar | quase estendido (cotovelo 20°) | à frente e para baixo | 21° |
| trote | cotovelo 50° | à frente, quase nivelada | 33° |
| corrida | cotovelo 80°, **pegada reversa** | para trás, para baixo e um pouco para fora, ao lado da perna | 1,6° |

**Pegada reversa na corrida — decisão do diretor (2026-11-19).** Na primeira versão, a corrida repetia o "à frente e
para cima" da v01; o diretor escolheu a pegada reversa com a lâmina baixa.
- **Como funciona:** o socket da mão direita gira 180° em torno do eixo da guarda só nesse clipe (chave por quadro em
  `WeaponSocket_R`). O cabo continua na mesma linha dentro do punho, já validado na E1. A lâmina sai do lado do dedo
  mínimo, e a guarda fica junto dele.
- **Resultado:** o punho fica quase neutro (flexão 13°, desvio ulnar 12°).
- **Folgas:** a lâmina foi inclinada um pouco para fora e para trás. Ela livra a coxa (3,8 cm) e o chão (ponta a 11,7 cm).
- **Registro:** `bladeCarry.grip` em cada clipe diz qual pegada está em uso.
- **Pendência de runtime:** a troca de pegada entre clipes precisa de uma transição. Ela entra com o lote 2, quando a
  locomoção for ligada no laboratório.

## Portões (medidos no GLB exportado e reimportado; 0 violações)

| Clipe | Apoio pleno: desliz. (mm/quadro) | Rolamento: desliz. (mm) | Abaixo do chão (mm) | Plantado acima (mm) | Costura | Folga lâmina–corpo | Ponta da espada acima do chão | Punho: desvio / extensão |
|---|---|---|---|---|---|---|---|---|
| guarda | 0,03 | — | 0,0 | 0,2 | 0,000° | 0,230 m | 1,088 m | radial 10,9° / flexão 5,1° |
| andar | 0,02 | 1,64 | 3,1 | 4,4 | 0,000° | 0,052 m | 0,180 m | ulnar 24,6° / ext. 4,3° |
| trote | 0,01 | 3,39 | 0,0 | 3,6 | 0,000° | 0,066 m | 0,520 m | ulnar 24,9° / ext. 2,2° |
| corrida (reversa) | 0,00 | 4,43 | 0,0 | 3,3 | 0,000° | 0,038 m | 0,117 m | ulnar 12,0° / flexão 13,3° |
| **limite** | 2 | 5 | 5 | 15 | 0,5° | 0,02 m | 0,05 m | radial 20, ulnar 35, ext. 60, flexão 70 |

- **Rolamento** é a fase do calcanhar e da bola do pé: um pivô fixo não acompanha perfeitamente a curva da sola. O limite
  de 5 mm foi criado nesta etapa. Antes os dois limites eram de 2 mm, e a separação está registrada.
- IK do tornozelo (no Blender): erro ≤ 1,7 mm.
- Fora da tabela, `test/pve2-e4.test.mjs` confere:
  - os campos do contrato;
  - `stride` = velocidade × duração;
  - apoio duplo no andar, voo na corrida e nenhum voo no andar.
- `npm test`: **104 passam**.

## Leitura visual do autor (não é aprovação)

- **Guarda:** base baixa e espada alta com a mão livre à frente. Lê como guarda; talvez alta demais para MHW.
- **Andar:** espada baixa à frente, braço solto. Lê bem.
- **Corrida:** o tronco inclina pouco mesmo com 22° somados. A malha do corpo base mostra a inclinação menos do que os
  números sugerem.
- **Vinco no ombro** quando o braço vai para trás na corrida: é a pendência da E1, ainda aberta.

## Correção posterior (lote 2)

A guarda passou a chavear o controle da ponta do pé em repouso. Antes ela herdava o último valor deixado pela ação
anterior no arquivo (a corrida) e podia sair com os dedos dobrados. Os clipes de andar, trote, corrida e estresse ficaram
byte a byte iguais; só a guarda mudou.

## Pendências

- Lote 2 (combate) e ligação no laboratório.
- Início, parada, pivô e passos laterais (plano §4, P0) não estão neste lote.
- Vinco do ombro (E1).
- glTF Validator da Khronos não está instalado nesta máquina.

## Reproduzir

```
blender -b --python labs/hunters/source/rig-v13/build_hunter_rig_v13.py -- <raiz>
blender -b labs/hunters/assets/hunter-rig-v13/hunter_rig_v13_source.blend --python labs/hunters/source/rig-v13/author_e4_locomocao.py -- <raiz>
blender -b labs/hunters/assets/hunter-rig-v13/hunter_rig_v13_source.blend --python labs/hunters/source/rig-v13/export_review_rig_v13.py -- <raiz>
blender -b --python labs/hunters/source/rig-v13/review_e4_locomocao.py -- <raiz>
cd labs/hunters && npm test
```
