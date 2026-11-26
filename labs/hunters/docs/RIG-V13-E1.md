# Hunter rig v13 — etapa E1 (pele, empunhadura e portões de deformação)

Segunda etapa do [plano da evolução PvE](PLANO-EVOLUCAO-PVE.md). A [E0](RIG-V13-E0.md) foi aprovada pelo diretor em
2026-11-19. Status: **E1 aprovada pelo diretor em 2026-11-19.** A forma continua a do corpo base, e a
cabeça continua intacta. PvP, Alpha, PvE v01, criaturas e GLBs aprovados não foram tocados.

GLB: `assets/hunter-rig-v13/hunter_rig_v13_blockout.glb` — sha256 `06908f2c…0797`, 346 288 bytes, 2 482 triângulos
de corpo + 60 da espada, **46 juntas**, 1 clipe de estresse com 9 poses.

## O que mudou desde a E0

| Problema da E0 | Causa encontrada | Correção |
|---|---|---|
| Meio do antebraço afinava 9–12% | Vértices do meio do antebraço carregavam `RightHand` 0,33 e `RightArm` 0,23, herdados da base e espalhados pela subdivisão | Pesos de braço e perna **refeitos ao longo da cadeia** (ombro → cotovelo → punho; quadril → joelho → tornozelo), conservando o peso total do membro em cada vértice |
| Cotovelo e joelho pinçavam na dobra profunda | Skinning linear em dobra de 115–130° | **Osso auxiliar de meia-rotação** em cotovelo e joelho (`ElbowHelper`, `KneeHelper`), dirigido a 50% da dobra; até 85% do anel da articulação passa a ele |
| Ombro com transição dura entre peito, clavícula e braço | — | Suavização dos pesos na região do ombro (4 passes, soma dos grupos conservada) |
| IK em repouso com erro de rotação de 19–31° | O importador glTF deixa a pose do nó em `matrix_basis`; depois da mudança de rolagem dos ossos, isso deslocava o braço fora da ação de estresse | Pose zerada logo após a importação. Erro em repouso agora: **0,4–0,8°**. O GLB da E0 não era afetado, porque a ação de estresse chaveava todos os ossos |
| Socket de arma provisório | — | Espada da v12 presa a `WeaponSocket_R`, com a posição encontrada por busca (abaixo) |

Também entrou no rig de controle uma **clavícula automática** (`Clavicula_auto`, Damped Track para o alvo de IK da mão).
Ela começa com influência 0. Use 0,25 com o braço em IK.

## Empunhadura

A busca exige que o cabo fique **dentro** do punho, e não só encostado nele. Ela mede quantos dos 12 setores de 30° em
volta do eixo do cabo têm palma, dedo ou polegar a menos de 4 cm, e também busca a curvatura dos dedos.

| Mão | Cobertura | Folga mínima ao eixo (raio do cabo 15 mm) | Vértices a < 2,7 cm | Curvatura `Fingers1/2` |
|---|---|---|---|---|
| direita | **11/12** | 14,7 mm (0,3 mm de contato) | 11 | −90° / −95° |
| esquerda | 10/12 | 15,7 mm | 10 | −90° / −80° |

A primeira versão da busca, sem cobertura, achou uma posição com o cabo **por fora** dos dedos. O render mostrou
isso, e a busca foi corrigida. A curvatura escolhida ficou no limite da grade (−90/−95): uma grade maior pode fechar
mais. A lâmina sai do lado do polegar, cruzando a palma a 15° como na v12.

## Portões (reprovam a revisão; `resultados/rig-v13/deformacao-v13.json`)

Raio médio do anel posado ÷ repouso. Torção = quanto a superfície gira em torno do eixo, descontada a dobra.

| Anel | Limite | Pior v13 | Mesma pose na base (divisão v12) |
|---|---|---|---|
| ombro (u = 0,15 do braço) | ≥ 0,75 | 0,82 (golpe por cima) | 0,84 |
| dobra do cotovelo | ≥ 0,70 | 0,71 (cotovelo 120°) | 0,76 |
| antebraço perto do cotovelo | ≥ 0,80 | 0,84 | **0,33** |
| meio do antebraço | ≥ 0,85 | 0,97 | 0,99 |
| punho | ≥ 0,85 | 0,99 | 0,90 |
| joelho | ≥ 0,65 | 0,71 (agachamento 130°) | **0,48** |
| canela | ≥ 0,85 | 1,00 | 1,00 |
| torção da superfície perto do cotovelo | ≤ 15° | 8,6° | **47,7°** |

Resultado: **0 violações** nas 9 poses. Quadros: pronação 85° com cotovelo 115°, supinação 80°, golpe por cima com
clavícula, agachamento de rolamento, flexão de punho 70°, extensão 60° com desvio ulnar 30°, braço à frente com a
clavícula projetada, corrida.

O que a base faz melhor: o anel da dobra do cotovelo (0,76 × 0,71). A base tem 4 vértices nesse anel e a v13 tem 17,
então a base mede menos e "dobra" menos geometria. O portão vale para a v13.

## Teste automatizado

`test/rig-v13.test.mjs` (6 testes) confere:
- o GLB contra o manifesto;
- os 19 nomes da base e os 27 ossos novos, sem nenhum `CTRL_` exportado;
- pesos com soma 1;
- os 132 vértices da cabeça da base presentes;
- a espada como filha do socket;
- os portões de deformação e de empunhadura, medidos sobre este mesmo GLB.

`npm test` em `labs/hunters`: **95 passam**.

## Renders reais (`resultados/rig-v13/`)

- `v13_repouso_*`: repouso.
- `v13_mao_{frente,cima,palma}`: punho fechado na espada.
- `estresse_qNN_{frente,perfil,tres-quartos}`: v13 (esquerda) × base (direita) nas 8 poses.
- `antebraco_qNN_{v13,base}`: aproximação do braço direito.

## Pendências (não resolvidas nesta etapa)

- **Vinco escuro no ombro direito** no quadro 96 (corrida, braço para trás). Visto no render e não medido pelos
  portões, porque o anel do ombro fica fora do vinco.
- Polegar: o eixo de curvatura foi estimado e só é verificado pela cobertura do cabo. Não há portão próprio.
- Dedo indicador separado continua fora: a luva não tem geometria para ele.
- A busca da curvatura dos dedos parou no limite da grade.
- glTF Validator da Khronos não está instalado nesta máquina.

## Reproduzir

```
blender -b --python labs/hunters/source/rig-v13/build_hunter_rig_v13.py -- <raiz>
blender -b labs/hunters/assets/hunter-rig-v13/hunter_rig_v13_source.blend --python labs/hunters/source/rig-v13/export_review_rig_v13.py -- <raiz>
cd labs/hunters && node --test test/rig-v13.test.mjs
```
