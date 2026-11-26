# Hunter rig v13 — etapa E0 (blockout + esqueleto + rig de controle)

Primeira etapa do [plano da evolução PvE](PLANO-EVOLUCAO-PVE.md), decisões D1–D5 aprovadas pelo diretor em 2026-11-19.
Status: **validação técnica feita; aprovação de forma e de rig pendente**. Nenhum clipe de jogo foi autorado.
PvP, Alpha, PvE v01, criaturas e GLBs aprovados não foram tocados.

## Decisão de forma: derivar, não remodelar

O corpo base da oficina (`assets/hunters/hunter-workshop/base/hunter-masculino-1000v`, sha256 `90f7cf65…`) foi
fornecido pelo diretor e é a referência dos módulos de cabelo e equipamento. Por isso a v13 **não muda a forma**:

- A malha ganha densidade **só nas articulações** (ombro, cotovelo, punho, mão, cintura, quadril, joelho, tornozelo, pé),
  por subdivisão plana: a silhueta é a mesma.
- A cabeça fica intacta: os 132 vértices da cabeça da base existem iguais na v13. Os cabelos da oficina continuam válidos.
- Textura, UV e material são os da base.

Isso corrige a proposta do plano (4–6 mil triângulos com malha nova). A oficina fixa um teto provisório de 3 500 vértices
para o avatar equipado. A v13 fica em 2 482 triângulos e 1 874 vértices exportados.

## Esqueleto (42 juntas)

Os 19 nomes originais continuam, mais:

| Novo | Para quê |
|---|---|
| `root` | deslocamento do corpo (curvas de esquiva e avanço) |
| `SpineMid` | coluna de três segmentos: o tronco curva em vez de dobrar num ponto |
| `ArmTwist` ×2 | desfaz metade da torção do úmero perto do ombro |
| `ForeArmTwist1/2` ×2 | pronação distribuída: 0 no cotovelo, 1/3, 2/3, mão inteira no punho |
| `UpLegTwist` ×2 | mesma ideia na coxa |
| `ToeBase` ×2 | rolamento calcanhar → ponta do pé |
| `Thumb1/2` ×2, `Fingers1/2` ×2 | polegar separado; os quatro dedos como um bloco (a malha é uma luva) |
| `WeaponSocket_R/L`, `Sheath_Back` | arma em cada mão e arma guardada nas costas |

Os ossos de torção são dirigidos por drivers (`SWING_TWIST_Y` da mão e do braço). O animador gira só a mão, e a torção
se espalha sozinha. O GLB leva os valores amostrados por quadro.

## Rig de controle (só no `.blend`, não exportado)

- IK de braço e perna com polo (`CTRL_hand_ik.*`, `CTRL_elbow_pole.*`, `CTRL_ankle_ik.*`, `CTRL_knee_pole.*`), com
  ângulo de polo calculado para preservar o repouso. Erro de posição em repouso: 0,2–3,6 mm.
- Antebraço e canela travados em Y no IK (dobradiça). Rolamento de pé: `CTRL_foot` → `CTRL_ball_roll` → tornozelo,
  e `CTRL_toe` para a ponta.
- `CTRL_weapon` com `Child Of` na mão esquerda, para empunhadura de duas mãos.
- Todos os controles começam com influência 0. A ação de estresse é FK puro.

## Medidas de deformação (`resultados/rig-v13/deformacao-v13.json`)

O corpo base recebe **as mesmas rotações no mundo**, com a pronação dividida como a v12 faz (60% no antebraço inteiro).

| Quadro | Pronação | Torção da superfície perto do cotovelo (u = 0,15) | Raio relativo perto do cotovelo | Raio relativo no meio do antebraço |
|---|---|---|---|---|
| 12 | +85° | **v13 9,4°** × base 38,4° | **v13 0,80** × base 0,68 | v13 0,89 × base 0,99 |
| 24 | −80° | **v13 −5,6°** × base −33,0° | 0,92 × 0,93 | v13 0,88 × base 1,00 |
| 36 | +70° | **v13 8,2°** × base 29,8° | **0,80** × 0,67 | v13 0,91 × base 0,99 |

Leitura:
- Na base, a superfície perto do cotovelo gira 30–38°. Esse é o "papel de bala" visto na corrida. Na v13 ela gira
  6–9°: a pronação acontece no antebraço e no punho, como no corpo real.
- Perto do cotovelo a v13 perde menos volume.
- **Piora**: no meio do antebraço a v13 afina 9–12% sob pronação de 80–85°. Fica acima do portão proposto (0,70), mas
  é o primeiro ponto a revisar na E1 (pesos de `ForeArmTwist1/2`).

## Renders reais

`resultados/rig-v13/`: GLB exportado e reimportado no Blender, Workbench com a textura do arquivo.

- `v13_repouso_{frente,perfil,tres-quartos}.png`: repouso.
- `estresse_qNN_{frente,perfil,tres-quartos}.png`: v13 (esquerda) × base (direita) nos quadros 12, 24, 36 e 48.
- `antebraco_qNN_{v13,base}.png`: aproximação do antebraço direito.

## O que a E0 não resolve (vai para a E1)

- **Ombro com o braço erguido** afunda no peito nos dois corpos (quadro 36). Precisa de pesos de clavícula e deltoide.
- Afinamento no meio do antebraço (acima).
- Dedos: a luva não tem indicador separado. O osso não foi criado, porque não teria geometria para mover.
- Os sockets têm posição provisória. A empunhadura real da espada (cabo na palma, dedos fechados) é ajustada na E1.
- Sem glTF Validator da Khronos nesta máquina: a verificação estrutural é a do script de inspeção e a reimportação no Blender.

## Reproduzir

```
blender -b --python labs/hunters/source/rig-v13/build_hunter_rig_v13.py -- <raiz>
blender -b labs/hunters/assets/hunter-rig-v13/hunter_rig_v13_source.blend --python labs/hunters/source/rig-v13/export_review_rig_v13.py -- <raiz>
```
