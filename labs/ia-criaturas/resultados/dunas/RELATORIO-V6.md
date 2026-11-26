# Relatório — Laboratório V6

Entrega parcial e declarada como tal. Das oito frentes da ordem, foram executadas as que tinham
**defeito nomeado e critério de aceitação verificável**. As demais estão listadas em "Não executado"
com o motivo. Nenhuma foi declarada pronta sem medição.

## 1. Estado do GitHub

| | |
|---|---|
| Branch | `feat/lab-v6-combate-ecologia-fisica` |
| Base | `a4d3dcff5582e949643af1a2090a0fedebe53cd2` — HEAD do PR #11, que contém o PR #2 e o PR #1 por ancestralidade (verificado com `git merge-base --is-ancestor`) |
| Commits | `5bfaa6d` física do subsolo · `e1cbf90` mira do combate · `c68eae9` desempenho |
| Alvo do PR | `fix/arenoceto-mergulho-visivel-v01` (não `main`, não `feat/laboratorio-ia-criaturas`) |

Nada fora de `labs/ia-criaturas/`. GLBs oficiais só em leitura.

## 2. Sistemas alterados

### 2.1 Validação do PR #11 — mergulho do Arenoceto

O teste do PR #11 confere **profundidade do centro do corpo**. A ordem exige geometria: metade da malha
dentro da areia na metade do mergulho. Foi criada a medição `ecoDemo.imersao(id)`, que percorre os
vértices do GLB **já deformados pelo esqueleto** (`applyBoneTransform`), leva cada um ao espaço do mundo
e compara com a superfície do terreno naquele x,z.

Aproximação declarada: é fração de **vértices**, não de volume. A malha do Arenoceto tem 6.156 vértices
razoavelmente distribuídos, mas regiões mais densas pesam mais do que o volume que ocupam.

Cenário `dunas-a-natacao`, semente 1, GLB `arenoceto-v02-skinned-animated-LOD0.glb`, câmera fixa:

| Etapa | t (s) | progresso | prof. do centro | **fração da malha enterrada** | topo acima da areia |
|---|---:|---:|---:|---:|---:|
| antes | 0,0 | 0 | 0,00 m | 0,7% | 5,00 m |
| 25% | 1,2 | 0,275 | 1,53 m | **56,0%** | 5,97 m |
| **50%** | 2,1 | 0,500 | 2,78 m | **80,7%** | 4,83 m |
| 75% | 3,1 | 0,750 | 4,16 m | **99,9%** | 1,92 m |
| enterrado | 4,1 | — | 5,55 m | **100%** | −0,32 m |

**O PR #11 passa no critério artístico** (exigido ≥50% na metade; medido 80,7%). Não foi alterado.

### 2.2 Continuidade vertical — corpo atravessava o leito rochoso

Defeito encontrado e medido antes da correção: a célula de chegada pode ter o leito muito mais raso que
a atual, e subir é limitado pela taxa da espécie. O controlador avançava mesmo assim.

| Cenário | Semente | passos-animal submersos | abaixo do leito | pior excesso |
|---|---:|---:|---:|---:|
| dunas-f-travessia | 3 | 10.607 | 150 (1,41%) | **4,86 m** |
| dunas-e-ecossistema | 1 | 29.096 | 99 (0,34%) | 3,19 m |
| dunas-e-ecossistema | 2 | 36.668 | 173 (0,47%) | 4,60 m |
| dunas-e-ecossistema | 3 | 32.428 | 10 (0,03%) | 1,23 m |

Correção: o animal ajusta a profundidade parado e só entra na célula quando o corpo cabe nela.
Depois: **0 ocorrências** nas 18 execuções medidas (3 sementes × 2 cenários × verificação a cada passo).
Teste de regressão em `test/dunas-combate.test.mjs`.

### 2.3 Emergência autônoma do Arenoceto — pendência da V5 fechada

Causa: a escolha do destino de exploração era filtrada pela espessura de areia no ponto de chegada,
informação que o animal não tem como ter a 100 m de distância. Com o filtro, ele nunca escolhia um
destino inalcançável e nunca batia no leito.

O destino passa a ser escolhido pelo rumo. Quando o leito aflora no caminho, a rota fica incompleta e ele
emerge (`rota_subterranea_bloqueada`).

| Cenário | Semente | mergulhos | emergências |
|---|---:|---:|---:|
| dunas-a-natacao | 1 | 1 | 0 |
| dunas-a-natacao | 2 | 4 | **3** |
| dunas-a-natacao | 3 | 1 | 0 |
| dunas-f-travessia | 1–3 | 9–25 | 9–25 |

Evidência: `v6-arenoceto-emergencia-85.png` (semente 2, t = 382,3 s, 44,8% da malha ainda enterrada).

### 2.4 Dano através da areia — teste direto por HP

O teste da V5 conferia o evento de bloqueio. O novo (`test/dunas-combate.test.mjs`) resolve o golpe e
confere **HP e lista de ferimentos**, em quatro posições e profundidades, nos dois sentidos
(enterrado ataca quem está em cima e vice-versa), com **controle positivo**: no mesmo meio o golpe
continua causando dano, provando que a regra não bloqueia demais.

### 2.5 Mira do combate — raiz do erro de alcance

Medição inicial, `npm run v3:combate`, 30 sementes: **83 de 102 golpes (81%)** erravam por
`membro_nao_alcanca` no bebedouro; 30 de 35 (86%) no bebedouro-real.

Instrumentação nova no evento `golpe_errou` (`previstoD`, `previstoAvanco`, `avancoReal`) isolou a raiz
em 35 erros: folga real média de **1,17 m** contra **−0,17 m** prevista, **todos com o alvo em fuga**.
A projeção do alvo usava velocidade constante; uma presa em fuga acelera durante o preparo do golpe.

Correção: a projeção passa a usar a velocidade média do intervalo, limitada pela corrida da espécie, e o
termo de aceleração sai da incerteza lateral (agora está no modelo), ficando só a frenagem.

| Cenário (30 sementes) | golpes | acertos | predações |
|---|---:|---:|---:|
| bebedouro — antes | 102 | 12 | 6 |
| bebedouro — depois | 122 | **20** | **10** |
| bebedouro-real — antes | 35 | 3 | 2 |
| bebedouro-real — depois | 46 | 3 | 2 |

**Resíduo não isolado:** sobra um viés de ~1,5 m de folga em 43 erros. O atacante avança *mais* do que
previa (2,04 m contra 1,36 m) e ainda assim fica curto, o que aponta para o alvo, não para o atacante.
Não foi perseguido nesta rodada.

### 2.6 Desempenho das dunas

Três causas medidas e corrigidas:

1. O volume de areia era derivado sob demanda, no primeiro passo. Numa grade de 600×600 isso custava
   **62,7 ms** no meio da simulação. Passou para `criarMundoEco`. Pior passo: 62,7 → 14,6 ms.
2. O bloqueio vertical invalidava a rota, disparando um A* por passo. A rota horizontal continua certa;
   agora só desiste após 3 s sem vencer o degrau.
3. Ao emergir por rota bloqueada, o animal mantinha o destino e mergulhava de novo rumo ao mesmo ponto
   impossível — alternância de estado a cada poucos segundos. Agora esquece o destino ao sair.
   `dunas-f-travessia`: 29–45 → 9–25 mergulhos, com mais metros percorridos sob a areia.

Percentis por passo (3 sementes, Node 24.21, Windows 11, medição só do núcleo, sem renderização):

| Cenário | p50 | p95 | p99 | pior |
|---|---:|---:|---:|---:|
| dunas-a-natacao | 0,004–0,006 ms | 0,008–0,021 ms | 0,02–0,06 ms | 14,6 ms |
| dunas-f-travessia | 0,013–0,021 ms | 0,15–0,72 ms | 1,9–3,1 ms | 13,9–17,9 ms |
| dunas-e-ecossistema | 0,07–0,08 ms | 0,18–0,26 ms | 2,2–5,4 ms | 16,6–20,3 ms |

Estes números são de uma máquina só e não valem como garantia universal.

## 3. Testes

| | |
|---|---|
| Total | **115 passam, 0 falham** (111 na base do PR #11) |
| Novos | 4 em `test/dunas-combate.test.mjs` |
| Build | `npm run build` ok |
| Navegador | Chromium real, GLBs originais, 9 capturas |

Nenhum teste existente foi enfraquecido. Dois quebraram durante o trabalho e foram corrigidos na origem:
o uso de `Math.hypot` na instrumentação (proibido em `src/eco` pela regra de determinismo) e a falta de
guarda para golpes montados à mão nos testes.

## 4. Evidências

Todas de `labs/ia-criaturas/resultados/capturas/`, renderizador real do laboratório.

| Arquivo | Cenário | Semente | t (s) |
|---|---|---:|---:|
| `v6-arenoceto-perfil-00-antes.png` | dunas-a-natacao | 1 | 0,0 |
| `v6-arenoceto-perfil-25.png` | dunas-a-natacao | 1 | 1,2 |
| `v6-arenoceto-perfil-50.png` | dunas-a-natacao | 1 | 2,1 |
| `v6-arenoceto-perfil-75.png` | dunas-a-natacao | 1 | 3,1 |
| `v6-arenoceto-perfil-100-enterrado.png` | dunas-a-natacao | 1 | 4,1 |
| `v6-arenoceto-emergencia-85.png` | dunas-a-natacao | 2 | 382,3 |
| `v6-arenoceto-emergencia-99.png` | dunas-a-natacao | 2 | 383,0 |
| `v6-combate-garra-acerta.png` | bebedouro | 1 | 71,4 |

As cinco etapas do mergulho usam **a mesma posição de câmera**, para a comparação entre elas não depender
do enquadramento. A captura de combate mostra o Varrisco com a garra no Velsari a 0,76 m, no instante do
acerto (14,6 de dano na perna, HP 92/107).

## 5. Não executado, e por quê

| Frente | Motivo |
|---|---|
| 03 — locomoção e IK | Nenhum defeito nomeado. O deslize de pata está medido desde a V5 (0,191 m/s no apoio) e não há relato de regressão. Refinar sem critério de aceitação é trabalho sem fim. |
| 04 — social | Hierarquia, memória, rivalidade e consequências já existem em `relacoes.js` e `social.js`, com testes. A ordem pede "aprimorar" sem apontar falha. |
| 05 — ecologia, migração, simulações de 1 e 2 anos | São medições, não funcionalidade. Horas de CPU cujo resultado não muda nada até as frentes comportamentais terem defeito nomeado. |
| 06 — olfato com vento | A própria ordem manda não adicionar vento sem base física. Não há dado de vento no mapa. |
| 07 — estresse até 200 animais | Mesma razão da 05. Os percentis por passo já estão medidos nos cenários reais. |
| 11.3 — sulcos e ondulações na areia | Cosmético sobre malha que não podemos alterar. As partículas de mergulho e emergência já existem. |
| 11.7 — A* em camadas 3D | A correção de continuidade vertical (2.2) eliminou o defeito que motivava isso: zero travessias do leito em 18 execuções. Um planejador em camadas resolveria o mesmo problema com muito mais código. |

## 6. Estado de aprovação

| Item | Estado |
|---|---|
| Mergulho do Arenoceto (PR #11) validado na geometria | **IMPLEMENTADO E TESTADO** |
| Corpo não atravessa o leito rochoso | **IMPLEMENTADO E TESTADO** |
| Emergência autônoma do Arenoceto | **IMPLEMENTADO E TESTADO** |
| Dano através da areia conferido por HP | **IMPLEMENTADO E TESTADO** |
| Mira do combate | **PARCIAL** — raiz corrigida, +67% de acertos; viés residual de ~1,5 m não isolado |
| Desempenho das dunas | **PARCIAL** — pior passo 62,7 → 14,6 ms; uma busca A* no volume de areia ainda custa 13–20 ms |
| Frentes 03, 04, 05, 06, 07 | **PENDENTE** — não executadas, motivo acima |
| Aprovação artística | **PENDENTE** — do criador |
| Filtro de Qualidade (Agente 06) | **PENDENTE** |

A operação **não** está completa. Esta é uma rodada fechada sobre os defeitos que tinham medição.
