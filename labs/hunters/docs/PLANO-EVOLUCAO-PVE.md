# Wildhaven — plano da próxima evolução PvE (referência: Monster Hunter World)

Status: **decisões D1–D5 aprovadas pelo diretor em 2026-11-19**. Etapa E0 em [RIG-V13-E0.md](RIG-V13-E0.md) (a forma do Hunter é derivada do corpo base, não remodelada: ver lá). Auditoria feita em 2026-11-19 sobre
`carioca1111/wildhaven-new`, branch `feat/hunter-pve-v01-ia` (`47070bb`), PRs #90 e #91, GLBs reais e simulação.
Todas as medidas abaixo vêm de scripts somente leitura rodados sobre os arquivos reais. Nenhum render de IA foi usado.

Aviso de coordenação: esta árvore tem trabalho **não commitado de outra sessão** em
`scripts/animate-hunter-pvp-v09.mjs` (lote 2, módulos D/E, saída `hunter_pve_v02.glb`). Ele não foi tocado. A seção 5
recomenda pausá-lo até a decisão sobre o rig, porque ele é autorado sobre o rig que este plano propõe substituir.

---

## 1. Diagnóstico

Legenda: **[C]** confirmado por medida, **[H]** hipótese ainda não medida.

### A — IK artificial (corpo de marionete)

A causa principal não é um parâmetro: é o **método de autoria**. Cada clipe é uma lista de chaves com poucos números
(posição da pelve, guinada, inclinação do tronco, alvo do punho no mundo, direção da lâmina, dica de cotovelo,
mão livre, pés). A cada quadro, `pose()` em `scripts/animate-hunter-pvp-v09.mjs:851` resolve tudo por IK analítico de
dois ossos. O corpo é **consequência** de alvos, não uma atuação.

| Achado | Evidência |
|---|---|
| **[C]** Braços nunca giram no úmero: torção de `RightArm`, `LeftArm`, `RightUpLeg` = **0°** em todos os 12 clipes PvE | `aim()` usa `setFromUnitVectors` (arco mínimo), linha 104. Toda rotação axial vai para antebraço e mão. |
| **[C]** Mão esquerda **congelada**: `LeftHand` 0° de rotação em todos os clipes | linha 887: só IK até o punho; a mão nunca é orientada. |
| **[C]** Tronco rígido: `Spine02`/`Spine` variam 3–14° no total, inclusive na corrida (5–8°) | divisão fixa 40/60 de um único `pitch/chestYaw/roll`, linha 859. |
| **[C]** Todas as partes chegam na pose **no mesmo instante** | uma única curva Hermite por clipe (`sample()`, linha 108) para todos os campos. Não há sobreposição, atraso ou continuação por cadeia. |
| **[C]** Cabeça travada no alvo | `neck`/`Head` contra-giram a soma exata de pelve + tronco, linha 861. |
| **[C]** Pelve só gira em Y (e `hipPitch` no WIP). Sem inclinação lateral nem queda no apoio simples | linha 857. |
| **[C]** Pé é uma prancha: sem osso de dedo, o rolamento calcanhar→ponta não existe | esqueleto de 23 juntas, sem `ToeBase`. |
| **[C]** Joelho sempre aponta para a frente do pé | polo fixo `ankle + (0,.45,0) + 0,6·fwd ± 0,08`, linha 194. |
| **[C]** Malha de 1 000 triângulos, `Spine` com 10 vértices ponderados | inspeção do GLB. Não há anéis de deformação em cotovelo, punho, ombro e quadril. |

### B — Combate pouco cinematográfico

| Achado | Evidência |
|---|---|
| **[C]** O renderizador toca **um clipe por vez** e troca com um instantâneo de 0,12 s | `sampleCombatAnimation`, `src/animacao-jogador.js`. Não há mistura por camadas, aditivo, metade de corpo nem inércia. |
| **[C]** Só 2 golpes de espada PvE (leve e pesado). Combo = repetir o leve | `remapPve1`: `follow` cai no leve. |
| **[C]** Sem impacto físico no Hunter: reação, queda, levantar caem na guarda PvE | contrato §4, lote 3 ainda não existe. |
| **[C]** Flinch de impacto no pescoço nunca roda | procura o osso `'Neck'`, mas o osso se chama `neck`. |
| **[H]** Sem hit-stop, tremor de câmera ligado ao peso do golpe nem traço de lâmina | `apresentacao-combate.js` não foi auditado a fundo. |

### C — Locomoção

| Achado | Evidência |
|---|---|
| **[C]** Trote (2,2–4 m/s) toca o clipe de **corrida de sprint** desacelerado (0,56–1,0×): duas fases de voo em câmera lenta | `PVE1_PASSO.hunter_jog = pve1_a_sword_run`; tempo = distância/stride. |
| **[C]** Corrida autorada a 3,9 m/s, ficha permite 5,6 m/s (1,44×) | `config/hunter.json`. |
| **[C]** Contato de pé em tempo real vem de heurística `fase < 0,62`, não de `footContacts` do clipe | `ajustarPes`. Na corrida o apoio real é ~25% por pé: o IK trava o pé enquanto o clipe o levanta. |
| **[C]** Giro de 400°/s sem animação de giro; giro parado usa o passo lateral | `PVE1_GIRO`. |
| **[C]** Direção troca por limiar de ângulo (0,65 / 2,2 rad) sem mistura | `combatAnimation`. Estalos ao contornar o monstro. |
| **[C]** Não há início, parada, pivô, nem locomoção com arma guardada | nenhum estado nem clipe de sacar e guardar. |

### D — Mão deformada na corrida com espada

| Medida (mão direita relativa ao antebraço, contra o repouso) | Corrida | Leve | Guarda |
|---|---|---|---|
| eixo de desvio radial/ulnar | −29…+10° | **−59°** | **−36° segurado** |
| eixo de flexão/extensão | **+43 / −34° (77° pico a pico por passada)** | ±26° | −19° |
| torção na mão (além dos 60% já no antebraço) | 45° | 59° | 22° |

Limite anatômico de referência: desvio radial ~20°, ulnar ~30–35°.

**[C] Causa:** a mão é orientada pela **lâmina no mundo** (`orientHand`, linha 165). Na corrida a lâmina segue
chaves próprias e o braço balança, então o punho absorve a diferença: chicoteia 77° a cada passada. A torção vai 60%
para o antebraço inteiro, girando a partir do cotovelo (não há osso de torção). Há 22 vértices misturando braço e
antebraço e 21 misturando antebraço e mão, então o cotovelo e o punho colapsam em "papel de bala".
O portão atual `desvio do punho ≤ 60°` mede um ângulo combinado e deixa passar tudo isso.

### E — Pouca variedade

**[C]** A biblioteca PvE tem 12 clipes, dos quais 2 são ataques. A IA PvE só escolhe o pesado com abertura ≥ ~1,6 s (rival
caído ou atordoado). Nas medições, o pesado não aparece.

### F — Varrisco visualmente problemático

Inspeção do GLB `assets/models/creatures/varrisco/v02/varrisco-animated-v02-LOD0.glb`. A v03 e a v04 usam **a mesma
malha** (mesmos 2 754 triângulos, 8 262 vértices, mesmo skin).

| Achado | Medida | Efeito na tela |
|---|---|---|
| **[C]** O corpo é **100 cascas fechadas separadas**, encaixadas por interpenetração | 100 componentes conexos; 185 pares de caixas sobrepostas | partes giram rígidas umas dentro das outras ao animar |
| **[C]** Faixas de cor feitas de **malha extra**: 10 placas no flanco (12 triângulos e 1 cor cada) e 4 anéis na cauda | cascas 64–73 e 29–32 | viola a regra "cor por textura UV" |
| **[C]** As 4 faixas da cauda estão ponderadas **ao tórax**, não à cauda | cascas 29–32: `thorax` só, em x −1,56…−0,80 m | ao balançar a cauda, as faixas ficam no ar e a cauda as atravessa |
| **[C]** Uma garra da **mão esquerda** está presa à **mão direita** | cascas 27 e 98 (z +0,22…0,26) ponderadas a `handR`; `handR` 378 vértices × `handL` 126 | na `claw_slash` uma garra atravessa o peito |
| **[C]** Superfícies coplanares sobrepostas (z-fighting) | 71 pares a < 4 mm, 43 deles entre cascas diferentes | cintilação e "superfícies duplicadas" |
| **[C]** Cor por vértice com ruído por face | 137 cores distintas quase iguais (0,651…0,671); 79% dos pares de faces vizinhas com cor diferente | "cores fragmentadas", confete |
| **[C]** Sem UV e sem textura | atributos: `POSITION, NORMAL, COLOR_0, JOINTS_0, WEIGHTS_0` | — |
| **[C]** Skin rígido | 6 154 de 8 262 vértices com 1 influência | dobras quebradas em pescoço, quadril e cauda |
| ok | 0 faces invertidas, 0 arestas abertas dentro das cascas, 0 rachaduras de peso em vértices coincidentes | — |

A captura de referência do diretor não está no repositório. Os achados acima saem da geometria e independem dela.

### G — IA: por que o Varrisco não pressiona

Reproduzido em 10 sementes, 180 s, `jogador-espada` com `pve1`: Varrisco derrotado em 8, sem desfecho em 1, Hunter
fora de combate em 1. Hunter: 0 esquivas, 0 pesados, ferido em 2 de 10. Isso confirma o padrão da auditoria anterior.

| Achado | Evidência |
|---|---|
| **[C]** O Varrisco ataca **0–3 vezes por caçada** (9 golpes em 10 caçadas, **todos mordida**) | `garra_foice` e `bote` nunca saem |
| **[C]** A caçada é tratada como **disputa territorial** em 82% do tempo | `context = a.conflito ? 'territory' : 'hunt'` (`ia-criaturas/src/eco/combate.js:29`) |
| **[C]** Em `territory` a criatura só escala se a disputa estiver na fase `combate` ou se o Hunter estiver em preparo | `mayEscalate`, `combate.js:32` |
| **[C]** A criatura **cede 7–12 vezes por luta** e passa **53% do tempo recuando** | `encerrar(...,'cedeu')` com `disposicao < −0,15`; coragem do indivíduo 0,29 |
| **[C]** A garra é descartada pela regra do "membro mais curto que a frente do corpo" | `escolherAtaque`, `combate.js:~120`: `garra_foice` 1,3 m |
| **[C]** O `bote` exige surpresa | `exigeSurpresa` |
| **[C]** O Hunter fica no limiar do alcance da mordida (distância mediana 1,6–2,2 m contra 1,5 m) | sondagem |
| **[C]** Os preparos são curtos demais para leitura: mordida 0,35 s | ficha |
| **[C]** A esquiva do Hunter exige ~0,28 s de curva depois do atraso de percepção, então nunca há tempo | PVE-V01-IA.md |
| **[C]** `preso`: o Varrisco fica preso no terreno 4–10 vezes por caçada | eventos |
| **[C]** O laboratório desenha o Varrisco v02 (17 clipes). A v04 (41 clipes, com `stagger`, `fall`, `get_up`, `body_slam`) existe em outra branch e não está ligada | `perfis` do laboratório |

Conclusão: o Varrisco está fazendo o que o cérebro ecológico manda: um carnívoro médio e tímido que evita uma
disputa territorial com algo que o fere. Não é um monstro em caçada. Aumentar dano ou vida não muda isso.

### Escala

**[C]** O Varrisco tem 3,1 m de comprimento e 85 kg: é do porte de um *Great Jagras* jovem, não de um monstro grande.
Não há carnívoro grande com rig no repositório (o GLB riggado do Nharuk está ausente). O "espetáculo contra monstro
gigante" do objetivo final precisa de uma criatura grande. Isso é uma decisão de direção (seção 8, D3).

---

## 2. Visão artística

O que dá a sensação de MHW, traduzido em regras verificáveis para o Wildhaven:

1. **Compromisso legível.** Todo golpe tem antecipação que conta a intenção, ataque curto e recuperação que pune o erro.
   O jogador e a IA leem o corpo, não um número.
2. **Peso pela massa, não pela lentidão.** O centro de massa lidera: a pelve parte antes do braço, o tronco desce sobre a
   perna da frente, a arma arrasta o pulso e o pulso arrasta a mão. Depois do impacto o corpo continua e se reequilibra.
3. **Sobreposição e arcos.** Cada cadeia (pelve → tronco → ombro → cotovelo → punho → lâmina) chega defasada em
   2–6 quadros. A ponta da lâmina descreve um arco limpo, sem quinas.
4. **Ritmo.** Alternância de rápido e lento dentro do combo: dois cortes curtos e um terceiro com carga. A esquiva é
   explosiva, a aterrissagem é pesada.
5. **Acrobacia com física.** O rolamento usa o chão: o ombro toca, as costas rolam, o pé empurra para levantar. Nada flutua
   sem impulso visível. Nada gira mais rápido do que a pelve consegue gerar.
6. **O monstro é o diretor da cena.** Ele telegrafa, persegue, reposiciona, se enfurece, manca e foge. As aberturas do
   Hunter nascem das recuperações do monstro.
7. **Impacto vendido em camadas.** Pose de contato, hit-stop de 3–6 quadros proporcional ao peso, reação do alvo,
   poeira e tremor de câmera. Tudo de apresentação, sem mudar o resultado físico.
8. **Identidade Wildhaven.** Facetado mid-poly, sombreamento plano, cores em textura UV com paleta curta. Proporções
   humanas críveis: o Hunter de MHW exagera, o Wildhaven não precisa de saltos impossíveis para ter espetáculo.

---

## 3. Propostas técnicas

### 3.1 Autoria das animações (resolve A, B, D, E)

| Opção | Como | Vantagem | Risco | Recomendação |
|---|---|---|---|---|
| A1. Continuar no gerador procedural | mais chaves e mais campos em `animate-hunter-pvp-v09.mjs` | reaproveita portões | o teto é o método: alvos no mundo + IK por quadro + curva única. 1 043 linhas já, sem curva por osso | **não** |
| A2. **Rig de controle em Blender, autoria por osso** | rig de controle (IK/FK com troca, polos animáveis, rolamento de pé, alvo de mão com troca de pai para a arma) sobre o esqueleto de exportação. Poses-chave por osso, depois quebra de tempo por cadeia, depois passe de sobreposição. Exporta GLB. Os portões em Node leem o GLB exportado. | curva por osso, defasagem, arcos e revisão visual (`look` no Blender) no mesmo lugar. O MCP do Blender já está conectado | mais lento por clipe. Requer disciplina de versão (fonte `.blend` + script reprodutível) | **sim** |
| A3. Mocap licenciado + retarget + polimento | pacotes comerciais de espada, retarget no rig novo | base de movimento humano real | licença, estilo genérico, custo. Precisa de decisão | opcional, como referência ou base de locomoção (D4) |

O gerador atual continua sendo a fonte dos clipes v12/PvE v01 aprovados (preservação) e o modelo dos portões.

### 3.2 Rig e malha do Hunter (resolve A, C, D)

| Opção | O que muda | Resolve | Não resolve |
|---|---|---|---|
| R1. Rig atual + ossos de torção ao fim da lista + repintura de pesos do antebraço | 23 → 27 juntas, malha intacta | parte do "papel de bala" | o antebraço tem ~47 vértices: não há anéis para distribuir a torção. Pé sem dedo, tronco de 2 ossos |
| R2. **Rig v13 + malha mid-poly nova com a mesma identidade** | ~4–6 mil triângulos com anéis de deformação; esqueleto de ~45 ossos | tudo de A/C/D | exige o fluxo de aprovação de forma (blockout, três renders) |

**Recomendo R2.** Esqueleto v13 proposto (exportação):
`root` (deslocamento) · `pelvis` · `spine_01/02/03` · `neck` · `head` · clavícula, braço, **2 de torção do braço**,
antebraço, **2 de torção do antebraço**, mão por lado · polegar 2 + indicador 2 + demais dedos 2 (agrupados) por mão ·
coxa, **torção da coxa**, canela, pé, **dedo do pé** por lado · `weapon_r`, `weapon_l` (sockets com troca de pai)
· `sheath_back` (arma guardada).

Custo em vídeo integrado: com skinning na GPU do three.js, 5 mil triângulos e 45 ossos por Hunter são irrelevantes
(o terreno do hex52 tem ordens de grandeza a mais). **[H]** medir no hardware real do diretor (seção 9).

A malha nova segue o mesmo fluxo das criaturas: blockout GLB reimportado, três renders reais, aprovação de forma,
depois skin. O Hunter v02 e todos os GLBs aprovados ficam intactos.

### 3.3 Runtime de animação (resolve B, C)

Substituir "um clipe + instantâneo de 0,12 s" por um grafo pequeno, só de apresentação:

1. **Inércia de transição** (inertialization, GDC 2018, *Gears of War*): o offset da pose anterior decai por mola crítica.
   É mais barata que mistura cruzada e não precisa avaliar dois clipes.
2. **Espaço de mistura de locomoção**: velocidade (andar, trote, corrida, sprint) × direção (8). **Distance matching**
   e **stride warping** (técnicas da Epic em Paragon/Lyra) para o pé não patinar com velocidade intermediária.
3. **Início, parada, pivô e giro parado**, escolhidos pela intenção da simulação.
4. **IK de pé lendo `footContacts`** do clipe, com mola na altura da pelve e inclinação no terreno.
5. **Camadas**: metade superior (golpe leve em movimento) sobre a inferior (passos). Aditivos curtos para reação e respiração.
6. **Warping de movimento**: o avanço do golpe se alinha ao alvo dentro de um limite (ex.: ±0,4 m e ±25°).
7. **Hit-stop e câmera** proporcionais ao peso, só na vista.

Motion matching (Clavet, GDC 2016) foi considerado. Exige base de captura grande e não combina com o volume de autoria
manual. Fica fora.

### 3.4 Camada física complementar (Opus 5)

- Molas de sobreposição só de vista (cabeça, mão livre, alças) com amortecimento crítico.
- Reação a impacto como pose autorada + aditivo direcional escalado pela massa do monstro. Ragdoll completo fica fora.
- Equilíbrio: projeção do centro de massa no polígono de apoio, verificada em portão nas poses de recuperação.

---

## 4. Nova biblioteca de animações

Prioridade: **P0** entra no piloto; **P1** fecha a espada; **P2** expande. Arma do piloto: espada. Depois dela, o
**montante** (é o que mais vende peso e carga, como a Great Sword). Nomes no formato do contrato, com prefixo `pve2_`
(rig v13).

### Locomoção (módulo A)
| Clipe | Pri. | Depende de |
|---|---|---|
| `a_sword_idle`, `a_sword_walk`, `a_sword_jog`, `a_sword_run`, `a_sword_sprint` | P0 | rig v13 |
| `a_sword_start`, `a_sword_stop`, `a_sword_pivot_180` | P0 | locomoção |
| `a_sword_turn_90_l/r`, `a_sword_turn_180` | P1 | idle |
| `a_sheathed_idle/walk/jog/run/sprint` | P1 | `sheath_back` |
| `a_sword_draw_run`, `a_sword_sheathe_walk` | P1 | ambos os conjuntos |
| `a_any_slide_slope`, `a_any_vault_low`, `a_any_drop_land` | P2 | terreno |

### Movimentação de combate (módulo B)
| Clipe | Pri. |
|---|---|
| `b_sword_strafe_8dir` (espaço de mistura) | P0 |
| `b_sword_roll_fwd/back/left/right`: rolamento com contato real de ombro e costas, 0,9–1,0 s | P0 |
| `b_sword_sidestep_l/r`: esquiva curta, mantém a guarda | P1 |
| `b_sword_block_start/hold/impact_small/impact_large/guard_break` | P0 (`impact_small`, `hold`) / P1 |
| `b_sword_dive`: mergulho de emergência, cai no chão e levanta | P1 |

### Ataques com espada (módulo C)
| Clipe | Pri. | Nota |
|---|---|---|
| `c_sword_combo_1` diagonal, `c_sword_combo_2` horizontal reverso, `c_sword_combo_3` ascendente com passo | P0 | cadeia com janelas de cancelamento |
| `c_sword_charge_loop` + `c_sword_charge_release_1/2` | P0 | carga legível, liberação com avanço |
| `c_sword_dash_slash`: golpe de aproximação saindo da corrida | P0 | fecha distância |
| `c_sword_roll_slash`: golpe saindo do rolamento | P1 | recompensa a esquiva |
| `c_sword_backstep_slash`: corte recuando | P1 | — |
| `c_sword_leap_slash`: salto em investida a partir da corrida ou de desnível | P1 | golpe aéreo sem voo impossível |
| `c_sword_finisher_downed`: golpe pesado em monstro caído | P2 | sem montaria (módulo G suspenso) |

### Reações (módulos D/E, Opus 5)
| Clipe | Pri. |
|---|---|
| `d_any_hit_light_front/back`, `d_any_hit_heavy` | P0 |
| `d_any_knockback_launch` → `d_any_land_roll` → `d_any_get_up` | P0 |
| `d_any_knockdown` + `d_any_get_up_roll` | P1 |
| `d_any_roar_flinch`, `e_any_stagger`, `e_any_exhausted`, `e_any_death` | P1 |

**Total P0: 23 clipes**, autorados no rig v13. Cada um leva as fases e janelas do contrato (§5). O contrato vira
`hunter-pve-v02`, com os mesmos portões e os novos da seção 9.

### Varrisco (biblioteca de combate)
P0: `bite_quick`, `bite_lunge` (bote sem surpresa, telegrafado), `claw_combo_2`, `tail_sweep_180`, `backstep`,
`roar`, `turn_attack_l/r`, `flinch`, `stagger`, `topple` + `get_up`, `limp_run`. Base: os 41 clipes da v04,
reautorados sobre a malha nova (seção 6).

---

## 5. Reforma da locomoção e do IK

| Item | Ação |
|---|---|
| Portões de qualidade (IK, pé plantado, costura, punho–cabeça, lâmina fora do tronco) | **manter** e estender ao rig v13 |
| Contrato de fases, janelas, `rootMotion: curve`, "tempo vem do clipe" | **manter** |
| `trajetorias-*.js` gerado como fonte única de lâmina e contato | **manter** |
| Portão "desvio do punho ≤ 60° combinado" | **substituir** por limites por eixo (seção 9) |
| `orientHand` dirigido pela lâmina no mundo | **substituir**: na locomoção e no transporte a mão segue o antebraço (FK) e a lâmina segue a mão. Só no golpe a lâmina dirige |
| IK de dois ossos com polo fixo | **substituir** pelo rig de controle no Blender: polo animável, torção distribuída, rolamento de pé |
| `ajustarPes` com fase heurística | **corrigir**: usar `footContacts` do clipe |
| Trote = corrida desacelerada | **corrigir**: clipe de trote próprio + espaço de mistura |
| Bug `'Neck'` × `neck` | **corrigir** junto com o runtime novo |
| Gerador `animate-hunter-pvp-v09.mjs` | **preservar** como fonte dos clipes aprovados. Não recebe clipes novos |
| Lote 2 D/E em andamento (WIP não commitado) | **recomendo pausar**: autorar reações no rig v12 vira retrabalho quando o rig v13 for aprovado |

---

## 6. Revisão do Varrisco (v06)

Fonte: `source/build_v04.py` (Python, sem dependências). Saída nova em `varrisco/v06/`. v01–v05 intactas.

1. **Malha única por região, soldada.** Tronco, pescoço, cabeça, cauda e membros como uma pele contínua, com anéis em
   pescoço, quadril, ombro, joelho e base da cauda. Mantém o facetado (normais por face) sem cascas sobrepostas.
   Alvo LOD0 5–8 mil triângulos, LOD1 ~50%, LOD2 ~20%.
2. **Remover as 14 malhas de cor** (placas do flanco, anéis da cauda). As faixas passam para a textura.
3. **UV + textura de paleta** (512–1024 px): cor base, faixas, ventre claro e escamas da crista. Material sem `COLOR_0`.
   Paleta curta (4–6 tons), sem ruído por face.
4. **Pesos**: 2–3 influências nas juntas. Corrigir a garra esquerda presa a `handR` e partes da cauda presas ao tórax.
   Pesos espelhados por portão.
5. **Placas e espinhos dorsais** podem continuar geometria se forem forma (silhueta), não cor. Cada um soldado ou
   ponderado ao osso certo, sem coplanaridade.
6. **Leitura em combate**: cabeça e mandíbula maiores e mais contrastadas, garra em foice destacada, cauda com massa.
   O jogador tem de ler de onde vem o golpe.
7. **Portões novos**: 0 pares coplanares a < 4 mm; 0 cascas soltas fora de uma lista de exceções; espelho de pesos
   L/R ≤ 1%; UV sem sobreposição; 0 atributo `COLOR_0`; três renders reais por clipe.

---

## 7. IA PvE

Tudo atrás de um interruptor novo (`modoCacada`), para não mudar a impressão digital do laboratório de criaturas.

### Monstro
| Proposta | Resolve |
|---|---|
| **Contexto `cacada`**: o Hunter que fere vira ameaça de vida, não rival territorial. Fim do "cedeu" por disposição. Fuga só por estado (ferido grave, exausto) | os 82% em `territory` e os 7–12 "cedeu" |
| **Máquina de estados de monstro**: calmo → alerta → engajado → furioso → exausto → mancando → fuga para o ninho, com retorno. O estado muda cadência, velocidade e escolha de golpe | ritmo e espetáculo |
| **Seleção de golpe por zona** (frente, lados, traseira) e distância. Golpes de giro e de cauda para quem fica no flanco | "fico ao lado e ele não reage" |
| **Orçamento de pressão**: frequência-alvo de ataques por minuto por estado, com combos de 2–3 golpes e pausas de leitura | ataques variados sem dano artificial |
| **Telegrafia mínima** por golpe (0,45–1,2 s) com pose autorada clara; ataques rápidos só dentro de combos | dá tempo para esquivar e bloquear |
| **Fechadores de distância**: bote telegrafado sem surpresa, investida, recuo + bote | o Hunter não fica parado no limiar do alcance |
| **Regra do membro curto**: não vale para a garra do Varrisco (ela alcança à frente do peito) | `garra_foice` nunca usada |
| **Partes e limiares**: dano acumulado por parte gera `flinch`, `stagger` ou `topple`. Isso abre a janela do golpe pesado | 0 pesados |
| **Ligar a v04/v06 no laboratório** | 17 → 41+ clipes |
| **Desprender do terreno** (`preso` 4–10 por caçada) | **[H]** investigar a navegação |

### Hunter
| Proposta |
|---|
| Ler o **início da antecipação** (pose autorada) e não só o preparo reconhecido. A antecipação mais longa dá tempo para a esquiva |
| Rolamento como esquiva principal (curva espacial, sem invencibilidade: o Wildhaven é simulação). O passo lateral fica para golpes estreitos |
| Posicionamento por zona: atacar pernas e flanco, sair da frente antes do golpe frontal |
| Pesado na **recuperação** do monstro (janela autorada) e no `topple` |
| Combo com cancelamento em esquiva nas janelas do contrato |
| Personalidade e habilidade continuam mudando as escolhas, nunca os números do golpe |

---

## 8. Plano de implementação

### Decisões do diretor antes de começar
| | Decisão | Recomendação |
|---|---|---|
| D1 | Autoria em Blender com rig de controle (A2) | sim |
| D2 | Hunter: rig v13 + malha mid-poly nova (R2) | sim |
| D3 | Monstro do piloto: Varrisco v06. Depois, escolher um monstro grande (≥ 8 m) para o espetáculo pleno | Varrisco agora, grande no P2 |
| D4 | Mocap licenciado como base de locomoção | opcional; só como referência por padrão |
| D5 | Pausar o lote 2 D/E no rig v12 | sim |

### Etapas
| Etapa | Entrega | Modelo | Depende de | Aprovação |
|---|---|---|---|---|
| E0 | Rig de controle no Blender + esqueleto v13 + blockout da malha Hunter v03 (três renders) | Opus 5.5 | D1, D2 | forma aprovada |
| E1 | Malha v03 final + skin + portões de deformação | Opus 5.5 | E0 | três renders em poses extremas |
| E2 | Varrisco v06: malha soldada, UV/textura, pesos, LODs | Opus 5 (forma) + Opus 5.5 (rig) | — (paralela a E0/E1) | três renders + portões |
| E3 | Runtime: inércia, espaço de locomoção, contatos de pé, camadas, warping, hit-stop | Sonnet 5.5 | E1 (para testar), lê só GLB | testes + vídeo |
| E4 | Clipes P0 do Hunter (A, B, C) | Opus 5.5 | E1, E3 | GIFs de três ângulos por clipe |
| E5 | Clipes P0 de reação + camada física | Opus 5 | E1, E3 | GIFs + vídeo |
| E6 | Clipes P0 do Varrisco v06 | Opus 5.5 | E2 | GIFs |
| E7 | IA `modoCacada` (monstro e Hunter) | Sonnet 5.5 | E4–E6 (lê fases dos clipes) | métricas da seção 9 + vídeo |
| E8 | Piloto completo: 3 caçadas gravadas | todos | E7 | aprovação artística |

Propriedade de arquivos como no contrato §11: nenhum arquivo com dois donos ao mesmo tempo. Lotes do mesmo gerador
são sequenciais. Branch nova por etapa; PR em rascunho; sem merge automático. Os GLBs passam pelo fluxo do `AGENTS.md`
(publicação real e verificação do SHA-256 remoto).

Restrições respeitadas: PvP, Alpha, GLBs aprovados e módulo G não são tocados. Tudo novo fica atrás de `?pve2=1` e
`modoCacada`.

---

## 9. Plano de testes

### Técnicos (reprovam a geração)
- Herdados: IK de mão 10 mm, pé 12 mm, pé plantado 2 mm, costura 0,5°, lâmina fora do tronco, punho–cabeça 16 cm,
  taxa de reprodução 0,90–1,10×.
- **Limites anatômicos por eixo**: punho (flexão 70°, extensão 60°, desvio radial 20°, ulnar 35°), pronação e
  supinação 80–85° distribuídas nos ossos de torção, cotovelo 0–150°, joelho 0–150°, sem hiperextensão.
- **Deformação**: razão de volume da seção transversal em cotovelo e punho ≥ 0,7 do repouso em todo quadro
  (detecta "papel de bala").
- **Equilíbrio**: centro de massa dentro do polígono de apoio (+ margem) nas poses de guarda e recuperação.
- **Arco da lâmina**: suavidade (jerk) da ponta abaixo de um limite, sem quinas.
- **Contato de pé** do runtime igual a `footContacts` do clipe.
- **Varrisco**: os portões da seção 6.

### Confronto (20 sementes, `jogador-espada` com `pve2` e `modoCacada`)
| Medida | Hoje | Alvo |
|---|---|---|
| Ataques do monstro por minuto | ~1 | 8–14 |
| Golpes diferentes do monstro usados por caçada | 1 | ≥ 5 |
| Caçadas em que o Hunter é ferido | 2/10 | ≥ 70% |
| Vitória do Hunter (habilidade 0,85) | 8/10 | 60–85% |
| Esquivas por caçada | 0 | ≥ 6 |
| Bloqueios por caçada | ~0 | ≥ 3 |
| Pesados por caçada | 0 | ≥ 2 |
| Tempo médio de abate | 83 s | 120–240 s, sem mudar vida nem dano |
| `preso` do monstro | 4–10 | 0–1 |
| Regressão PvP, criaturas e PvE v01 com os interruptores desligados | — | impressão digital idêntica |

### Visual (aprovação do diretor, separada)
- GIF de perfil, frente e três-quartos de cada clipe, mais pose de cada fase.
- Vídeo real de 3 caçadas (sementes fixas), câmera de jogo e câmera lateral.
- Rubrica por clipe: peso, arco, sobreposição, contato de pé, leitura da intenção, punho e mão.

### Desempenho
- CPU de animação por personagem < 0,3 ms (Node e navegador instrumentado).
- FPS medido no **hardware do diretor** (vídeo integrado) com 1 Hunter + 1 monstro no hex52. SwiftShader não serve como estimativa.
- Orçamento: Hunter ≤ 6 mil triângulos e 1–2 materiais; Varrisco LOD0 ≤ 8 mil triângulos e 1 material.

---

## 10. Primeiro piloto recomendado

**"Corte vertical": espada contra o Varrisco v06, uma caçada completa.**

1. Rig v13 + malha Hunter v03 (E0–E1). É a fundação: tudo o que for feito antes dela é retrabalho.
2. Varrisco v06 com malha soldada, textura UV e pesos corrigidos (E2).
3. Runtime mínimo: inércia, espaço de locomoção (andar, trote, corrida), contatos de pé reais, hit-stop (E3).
4. **10 clipes do Hunter**: idle, walk, jog, run, start/stop, rolamento (2 lados), combo de 3 golpes, carga + liberação,
   reação pesada com levantar.
5. **6 clipes do Varrisco**: `bite_lunge`, `claw_combo_2`, `tail_sweep_180`, `backstep`, `roar`, `stagger`.
6. IA `modoCacada` com contexto de caçada, zonas, orçamento de pressão e telegrafia.

Critério de sucesso: na comparação lado a lado (mesma semente, v01 × piloto), o diretor vê peso, risco e variedade.
As métricas da seção 9 passam com a vida e o dano atuais.

Fica para depois do piloto: arma guardada e saque, golpes P1/P2, montante, monstro grande.

---

## Referências técnicas

- Bollo, *Inertialization: High-Performance Animation Transitions in Gears of War*, GDC 2018.
- Clavet, *Motion Matching and The Road to Next-Gen Animation*, GDC 2016 (considerado e descartado aqui).
- Rosen, *An Indie Approach to Procedural Animation*, GDC 2014 (molas e sobreposição baratas).
- Distance matching, stride warping e orientation warping: documentação de animação da Unreal Engine (Lyra).
- Monster Hunter: World (Capcom, 2018): telegrafia por pose, recuperação punível, estados de fúria e exaustão, limiares
  por parte, ataques por zona. A observação vem de jogo, não de documento técnico da Capcom.

## Arquivos auditados

`labs/hunters/scripts/animate-hunter-pvp-v09.mjs`, `src/animacao-jogador.js`, `src/trajetoria-arma.js`,
`src/combate-jogador.js`, `config/hunter.json`, `config/equipamento.json`, `config/cenarios.json`,
`assets/hunter-pve-v01/hunter_pve_v01.glb`, `labs/ia-criaturas/src/eco/combate.js`, `.../tatica.js`,
`assets/models/creatures/varrisco/v02`, `v04` (em `feat/varrisco-v05-ia-combate-completa`), docs do contrato, do lote 1
e da IA, PRs #90 e #91. Os scripts de sondagem são somente leitura e não foram adicionados ao repositório.
