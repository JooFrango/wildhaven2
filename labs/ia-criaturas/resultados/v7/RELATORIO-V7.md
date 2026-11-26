# Relatório — Laboratório V7

Sobrevivência, veneno, camuflagem, voo, inteligência predatória, clima e decomposição.

Tudo o que está aqui foi medido na simulação ou capturado no navegador real. Onde um sistema não
produziu o efeito esperado, o número está no relatório do mesmo jeito.

## 1. GitHub

| | |
|---|---|
| Branch | `feat/lab-v7-sobrevivencia-ecossistema` |
| Base | `a4d3dcf` — HEAD do PR #11, que já continha o PR #2 e o PR #1 |
| Alvo do PR | `feat/lab-v6-combate-ecologia-fisica` (head do PR #12), **não** `main` |
| Commits | 7, um por etapa funcional |

Nada fora de `labs/ia-criaturas/`. Nenhum GLB, textura, mapa ou hexágono oficial foi alterado:
os assets entram só por leitura.

## 2. Auditoria inicial (Etapa 1)

Suíte na base: **145 testes, 0 falhas**. PRs #1, #2, #11 e #12 abertos e empilhados.

**Auditoria dos GLBs** (todos os 28 do catálogo, lendo o JSON de cada arquivo):

| GLB | Ossos de asa | Clipes de voo | Conclusão |
|---|---:|---|---|
| `carniroca` | 6 | `takeoff, fly, glide, flap_hard, bank_left/right, land` | **Voador completo** |
| `pica-termita` | 0 (rig por pivôs) | `fly, land` | Voa; sem clipe de decolagem/planeio |
| `velufim` | 6 | `flap, takeoff, glide, land` | Voador; não usado nesta rodada |
| `folhisco` | 2 | `jump_flap` | **Não voa** (salto, conforme a ficha) |
| `arraia-de-areia` | 10 | `glide_shallow` | "Asas" são nadadeiras de areia |
| demais 23 | 0 | — | Terrestres |

A auditoria desmente a suposição de que asa no rig significa voo: o Folhisco tem ossos de asa e a
ficha oficial diz `"flight": false`. **Nenhum animal foi declarado voador por causa do rig.**

## 3. Sistemas implementados

Todos declarativos na ficha. Quem não declara a capacidade **não ganha estado nenhum** — há um teste
para cada caso ("espécie sem a capacidade não ganha estado").

### 3.1 Veneno — `src/eco/veneno.js`

Cada inoculação vira uma **carga por quilo da vítima**, com latência de absorção e meia-vida.
Carga 1,0 = 1 mg/kg com potência 1. Neurotóxico tira coordenação e, em carga grave, derruba e
compromete a respiração; hemotóxico impede a coagulação do próprio ferimento e causa dano
progressivo; citotóxico agrava a lesão local.

Entra **só depois de `ferir`**: sem ferimento registrado não há inoculação. Medido em 20 sementes a
0,9 m: **18 acertos inocularam, 2 erros não inocularam, nenhuma exceção**. A 3 m (fora do alcance do
membro) o golpe erra e **a reserva nem é gastada**.

| Medição (20 sementes) | Resultado |
|---|---|
| Dose da mesma glândula num Velsari de 22 kg | pico de intensidade **0,36** — sintomas leves, sobrevive |
| Mesma glândula num Folhisco de 2,5 kg | pico **0,95** — **paralisia** |
| Vítima com resistência 0,8 | carga **< 45%** da normal, metaboliza mais rápido, **nunca imune** |
| Mobilidade sob efeito | cai a **< 90%** e volta a **100%** ao expirar; **zero dano residual** |
| Alvo que não é presa nem ameaça | **mordida seca** — poupa a glândula |

Decisão de usar veneno: presa, ameaça, ou o próprio animal abaixo de 60% de vida.

### 3.2 Camuflagem óptica ativa — `src/eco/camuflagem.js`

Reduz **só a visão**. O corpo continua colidindo, fazendo barulho, cheirando e emitindo calor.

Distâncias **medidas** com um Velsari parado olhando na direção do predador (grade de 2 m):

| Situação | Sem camuflagem | Com camuflagem |
|---|---:|---:|
| Predador parado | 30 m | **4 m** |
| Predador andando | 42,7 m | **10,0 m** |
| Predador correndo | — | **28,2 m** |

Correr quase anula o efeito, como manda a ordem. **Não é invisibilidade:** a 4 m o corpo é visto.
Energia: 0,55/s parado, mais 1,6/s proporcional à corrida; desliga abaixo de 15 de energia e só
religa acima de 35, depois de 12 s de recarga; **atacar quebra o efeito** na hora.

O efeito visual é um passe de **transmissão** (`MeshPhysicalMaterial`) que refrata o cenário atrás
do corpo, com espessura e índice de refração ondulando no tempo e mais distorção em movimento. Os
materiais do GLB **não são alterados**: cada malha recebe um material próprio e o original volta ao
desligar. Não é `visible = false` nem opacidade zero.

### 3.3 Termorrecepção — `src/eco/termo.js`

Sentido independente, por contraste térmico com o ar. Alcance **medido** contra um alvo endotérmico
(37 °C), em grade de 1 m:

| Temperatura do ar | Alcance |
|---:|---:|
| 8 °C | **29 m** |
| 26 °C | **17 m** |
| 36,5 °C | **0 m** (sem contraste) |

Um ectotérmico parado tem a temperatura do ar e é **invisível ao calor** (medido: 0 m). Rocha
bloqueia (livre 12 m → tapado 0 m); fora do cone não detecta. A pista **não identifica a espécie**
(`especie: null`) e não entra na memória de criaturas — o animal sabe que há calor ali, não o quê.

**Interação com a camuflagem, no cenário A, semente 1:** o Serpentino detecta o caçador camuflado a
**9,4 m** enquanto a visão comum não o reconhece; orienta a cabeça, estima o porte e decide
(imóvel ou fuga, com histerese 6 m / 14 m). Evidência: `v7-termo-detecta-camuflado.png`.

### 3.4 Voo — `src/eco/voo.js` e `src/eco/cerebro-voo.js`

Controlador próprio, no mesmo lugar do controlador de areia: altitude sobre o terreno, velocidade
horizontal e vertical separadas, curva com taxa limitada, estol abaixo da velocidade mínima, planeio
que troca altura por distância, decolagem com corrida, pouso com rampa e arremetida.

| Teste | Medido |
|---|---|
| Decolagem e cruzeiro | altitude máx **22,8 m**, **263 m** voados, maior passo **1,14 m** (sem teletransporte) |
| Morro de 30 m no rumo | atravessa **0** vezes; folga mínima **3,0 m** sobre o terreno |
| Pouso | toca a **2,2 m** do alvo, vz **−0,17 m/s**, v **6,3 m/s** (≤ mínima × 1,8) |
| Energia | subindo **1,79/s**, planando **0,12/s** (15×) |
| Sem energia | não decola (`energia_insuficiente`) |
| Asa ferida (flanco) | não decola (`asa_ferida`); no ar, **obrigado a descer** |
| Limites do mapa | nunca sai |

Lago não é local de pouso: o animal arremete e escolhe a margem.

### 3.5 Bandos

Três regras locais por indivíduo (coesão, separação, alinhamento) sobre **os vizinhos que ele vê no
ar** — não existe entidade "bando" comandando ninguém.

| n | Distância mínima | Raio médio | Alinhamento | Quedas | CPU/passo |
|---:|---:|---:|---:|---:|---:|
| 1 | — | — | — | 0 | 0,015 ms |
| 3 | 2,47 m | 3,7 m | 0,99 | 0 | 0,044 ms |
| 10 | 1,41 m | 8,0 m | 0,92 | 0 | 0,204 ms |
| 20 | 0,77 m | 14,1 m | 0,60 | 0 | 0,736 ms |

Zero contatos de corpo pelo critério do próprio motor. **Não é corpo rígido**: a distância entre dois
indivíduos varia ao longo do tempo (desvio-padrão medido > 0,3 m — o teste falha se ficar constante).

Ameaça terrestre, 10 aves no chão: **10/10 decolam**, dispersam em **≥ 2 faixas de altitude**
diferentes, o raio do grupo vai a **80 m** e volta a **39 m** depois que a ameaça se afasta. Zero
quedas, zero mortes.

**GIF real:** `v7-bando-voo.gif` (32 quadros, 8 fps, renderizador do laboratório).

### 3.6 Emboscada e táticas

Máquina de estados: procura cobertura **perto de onde ele percebeu presa** (nunca uma posição que não
percebeu) → aproxima → espera imóvel → avalia → dispara → o combate normal resolve o contato →
persegue ou desiste.

Comparação em situações equivalentes, **30 sementes**, mesma posição inicial, só o predador muda.
A capacidade é removida de uma **cópia** da ficha; as fichas no disco não são tocadas:

| Caso | Golpes | Acertos | Abates |
|---|---:|---:|---:|
| Varrisco comum × Velsari isolado | 2 | 1 | 0 |
| **Camuflado** × Velsari isolado | **16** | **4** | **3 (10%)** |
| Camuflado **sem** camuflagem × Velsari isolado | 2 | 1 | 0 |
| Dois Varriscos (par) × Velsari isolado | 11 | 0 | 0 |
| Varrisco comum × 5 Velsaris | 132 | 46 | 12 (40%) |
| Camuflado × 5 Velsaris | 83 | 23 | 6 (20%) |
| Boscaranha (veneno + emboscada) × Folhisco isolado | 4 | 0 | 0 |
| Boscaranha **sem** emboscada × Folhisco isolado | 3 | 0 | 0 |
| Boscaranha **sem** veneno × Folhisco isolado | 4 | 0 | 0 |
| Boscaranha × **5 Folhiscos** | 20 | 15 | 3 (10%) |

**Dois resultados contra a expectativa, reportados como saíram:**

1. **A camuflagem ajuda contra presa isolada e atrapalha contra grupo** (10% × 0% isolado; 20% × 40%
   em grupo). Causa provável: o caçador camuflado espreita até 5 m em vez de disparar a 16 m, e num
   grupo de cinco alguém o percebe por som ou cheiro antes disso. Não foi isolado nesta rodada.
2. **A emboscada sozinha não muda o resultado contra presa isolada** (0 abates com e sem). Ela só
   rende contra grupo, onde a passagem de presas pela cobertura é frequente. Com uma presa só, ela
   evita a área depois do primeiro susto (`memoriaDePerigo`) e o predador espera em vão.

Nenhuma probabilidade foi ajustada para fazer qualquer habilidade parecer útil.

### 3.7 Cupins — `src/eco/cupins.js`

Colônia finita com crescimento logístico, atividade que varia com clima e hora, e casca que só
algumas espécies abrem. **Comer exige localizar primeiro** (visão do monte ou olfato).

| Medição | Resultado |
|---|---|
| Ferrunco, colônia a 50 m | achou em **0,1 s** (olfato), primeira boca em **35,4 s** (abriu a casca antes) |
| Consumo × população | batem dentro de 60 indivíduos (o resto é crescimento) |
| Sem colônia no mundo | `procurando_cupins`, fome **não cai**, consumo **0** |
| Colônia de 120 | **esgota e se extingue**; o animal a abandona e procura outra |
| Colônia extinta | consumo **para** (nada de recurso infinito) |
| Colônia poupada | 800 → **> 900**, nunca acima do máximo |
| Competição | Ferrunco (182 kg) come 214; Pica-Termita (2 kg) **cede e espera** |
| Chuva × tempestade | acesso **0,120 → 0,180** (chuva) e **0,036** (tempestade) |

### 3.8 Clima — `src/eco/clima.js`

Um estado único (`mundo.climaAtivo`) lido pelos **sentidos, locomoção, voo e fisiologia**. A névoa e
as partículas da cena saem **do mesmo fator** que limita os animais: não existe tempestade só da
câmera.

Distância em que a presa reconhece o predador que se aproxima:

| Condição | Distância |
|---|---:|
| Céu limpo | 45,3 m |
| Chuva intensa | **24,6 m** |
| Tempestade de areia | **6,2 m** |

Cada evento só ocorre no bioma que o comporta: nevasca e tempestade de areia são **recusadas**
(`clima_recusado`) na savana, com motivo. Nevasca medida: 30 s de trote rendem **108,7 m → 75,6 m**,
energia **83,0 → 70,1**, ar **−1,8 °C → −15,8 °C**.

**Chuva × controle, 30 sementes, mesma semente e posição inicial:**

| | Caçadas | Ferimentos | Golpes errados | Buscas de abrigo | Mortes |
|---|---:|---:|---:|---:|---:|
| Com chuva | 20 | 1 | 5 | **162** | **0** |
| Sem chuva | **52** | **13** | 42 | 0 | **3** |

Voador em tempestade de areia **pousa** (`pouso_por_clima`, 0 quedas); sem tempestade continua no ar.

### 3.9 Decomposição e necrófagos — `src/eco/carcaca.js`

Estágios: fresca → consumida → decomposição → restos → ossos → reciclada. Velocidade por temperatura,
umidade, porte e número de insetos.

**A carne nunca é criada.** Três destinos contabilizados — animais, insetos e apodrecimento — e o
teste confere a cada passo que a soma é igual à carne inicial, com o balanço final no evento
`ossos_reciclados`.

| Medição | Resultado |
|---|---|
| Até os ossos | 34 °C **48 s** · 20 °C **102 s** · 4 °C **720 s** |
| Insetos a 4 °C | **0** (não chegam no frio) |
| Ciclo completo | 15 trocas de estágio em ordem, chegada e dispersão dos insetos, reciclagem |
| Limite de objetos | 10 carcaças com teto 4 → **4 ficam**, 6 recicladas por limite |
| Cenário sem `decomposicao` | comportamento antigo intacto |

Insetos necrófagos: **Dunébrio**, do catálogo (`detritivoros/`), que a ficha descreve consumindo
"detritos secos, fezes e restos orgânicos". GLB real, carregado em leitura. **Cupins não foram
transformados em necrófagos.**

Ossos: geometria procedural (espinha, costelas, crânio) dimensionada pelo corpo da espécie,
marcada `userData.proxy = 'ossos procedurais experimentais'`. **Não é um esqueleto anatômico
definitivo** — a especificação do asset real fica para os Agentes 02 e 04.

### 3.10 VFX de sangue

O sangue nasce do **evento de ferimento**, no osso da região atingida (busca no rig por nome:
`Head/Neck/Spine/Wing/Thigh/Tail`), com quantidade proporcional à gravidade. Sem osso reconhecível,
cai no centro do corpo — e o código declara isso. **Golpe que erra ou é bloqueado não emite nada.**

Sangramento ativo goteja enquanto o ferimento sangra e para quando coagula. Marcas no chão duram
90 s e encolhem. Pooling: 260 partículas e 80 marcas, instanciadas, **nunca recriadas**.

Medido no golpe fatal do cenário G: **131 partículas de sangue, 4 marcas no chão**.

## 4. Testes

| | |
|---|---|
| Total | **166 passam, 0 falham** (145 na base) |
| Novos | 21, em 5 arquivos: `v7-veneno`, `v7-camuflagem-termo`, `v7-voo`, `v7-ecologia`, `v7-emboscada` |
| Build | `npm run build` ok |
| Navegador | Chromium real, GLBs originais, 23 capturas + 1 GIF |

Nenhum teste existente foi enfraquecido. Os testes medem distâncias e taxas na simulação em vez de
afirmar valores fixos; quatro deles falharam durante o trabalho e apontaram defeitos reais, corrigidos
na origem:

1. Camuflado parado ficava **invisível a 4 m** → redução ajustada de 0,9 para 0,82.
2. Parado camuflado **recuperava mais energia do que gastava** → camuflagem ativa bloqueia a recuperação.
3. Corpo em voo **atravessava paredão** de raspão → corredor de 6 m de largura e taxa de subida por ponto.
4. Cupinívoro menor **cedia o monte 38 vezes seguidas** → espera por 4 s depois de perder o rival de vista.

## 5. Evidências (renderizador real, GLBs originais)

| Arquivo | O que mostra | Cenário · semente · t |
|---|---|---|
| `v7-camuflagem-1-desligada.png` | caçador visível | A · 2 · 3,9 s |
| `v7-camuflagem-2-ligada.png` | mesmo corpo refratando o fundo | A · 2 · 3,9 s |
| `v7-termo-detecta-camuflado.png` | Serpentino sente o camuflado a 9,4 m | A · 1 · 24,9 s |
| `v7-veneno-1-inoculacao.png` | mordida no pescoço, carga 0,246 | B · 23 · 94,3 s |
| `v7-veneno-2-sintomas.png` | descoordenação, mobilidade 86% | B · 23 · 117 s |
| `v7-veneno-3-recuperado.png` | carga expirada, sem dano residual | B · 23 · 371,7 s |
| `v7-voo-1-individual.png` | Carniroca a 13,4 m, voo batido | C · 2 · 6,4 s |
| `v7-voo-2-bando.png` | 8 aves em altitudes de 7 a 13,6 m | C · 2 · 6,4 s |
| `v7-bando-voo.gif` | bando voando (32 quadros) | C · 2 |
| `v7-tempestade-1-antes.png` | dunas com céu limpo | D · 1 · 20 s |
| `v7-tempestade-2-durante.png` | tempestade, 1120 partículas | D · 1 · 42,7 s |
| `v7-tempestade-3-durante-a-6m.png` | animal a 6 m mal aparece | D · 1 · 42,7 s |
| `v7-chuva-caca.png` | chuva e Varrisco abrigado | E · 1 · 40,3 s |
| `v7-cupinzeiro-1-ferrunco-come.png` | Ferrunco no monte aberto 61% | F · 1 · 33,8 s |
| `v7-sangue-golpe-fatal.png` | 131 partículas no golpe que mata | G · 2 · 71,2 s |
| `v7-carcaca-1-fresca.png` … `-4-ossos.png` | quatro estágios, mesma câmera | G · 2 · 74,7–132,6 s |
| `v7-carcaca-5-ossos-de-perto.png` | esqueleto proxy de perto | G · 2 · 132,7 s |
| `v7-carcaca-6-insetos.png` | 4 Dunébrios sobre os restos | G · 2 · 113,3 s |
| `v7-emboscada-1-espera.png` | Boscaranha imóvel há 82 s | H · 12 · 517,7 s |
| `v7-emboscada-2-contato-e-sangue.png` | mordida na perna, sangue | H · 12 · 525,5 s |
| `v7-emboscada-3-sintomas.png` | fraqueza muscular, mobilidade 46% | H · 12 · 541,1 s |

Nenhuma imagem foi gerada por IA. Todas saíram do renderizador do laboratório com os GLBs reais.

## 6. Desempenho

Node 24.21, Windows 11, uma máquina só. Medição do núcleo, sem renderização, mediana de 10 sementes:

| Cenário | p50 | p95 | p99 | pior |
|---|---:|---:|---:|---:|
| A — caçador camuflado | 0,064 ms | 0,177 ms | 0,444 ms | 57,2 ms |
| B — mordedura venenosa | 0,048 ms | 0,105 ms | 0,285 ms | 21,7 ms |
| C — bandos (12 aves) | 0,688 ms | 1,546 ms | 2,703 ms | 26,5 ms |
| D — tempestade de areia | 0,077 ms | **7,021 ms** | **22,08 ms** | 85,2 ms |
| E — chuva | 0,108 ms | 0,300 ms | 0,755 ms | 21,9 ms |
| F — cupinzeiro | 0,036 ms | 0,074 ms | 0,155 ms | 3,3 ms |
| G — carcaça | 0,113 ms | 0,297 ms | 0,587 ms | 18,5 ms |
| H — emboscada | 0,147 ms | 0,348 ms | 0,821 ms | 36,9 ms |

O p95 alto do cenário D **não vem da V7**: é a busca A* no volume de areia do Serracórion, pendência
já declarada no relatório da V6 (13–20 ms por busca). O clima em si custa quase nada: o cenário E, com
chuva permanente, fica em 0,3 ms.

Custo do bando: **0,736 ms/passo com 20 voadores**, crescendo perto de O(n²) porque cada indivíduo
percorre os vizinhos que vê. Para centenas de voadores seria preciso organização espacial — não foi
necessário nesta rodada e **não foi implementado**.

Os picos de "pior passo" (20–85 ms) são a derivação do terreno e as primeiras buscas de rota, no
primeiro passo da simulação, não no meio dela.

## 7. Pendências e limitações

| Item | Estado |
|---|---|
| Camuflagem contra grupo rende menos que sem ela | **medido, causa não isolada** |
| Emboscada não muda o resultado contra presa isolada | **medido, explicado, não resolvido** |
| Bando em O(n²) | acima de ~40 voadores exige organização espacial |
| Ossos procedurais | **PROXY** — asset real pendente (Agentes 02 e 04) |
| Cupinzeiro (cone de terra) | **PROXY** — não há GLB de cupinzeiro no catálogo |
| Espécies hipotéticas (Caçador Camuflado, Serpentino) | usam GLB de outra criatura, **declarado na ficha e no inspetor** |
| Pica-Termita e Ferrunco | GLB por pivôs, sem `SkinnedMesh`: anatomia de combate não é mensurável, vale a ficha |
| Vento | **não implementado** — a ordem desaconselha sem base física, e o mapa não traz dado de vento |
| Ferimentos permanentes em textura | não feitos: exigiriam alterar GLBs aprovados |
| Olfato direcional | continua sem vento, como na V3 |
| Serpente de verdade | **não existe no catálogo**; a termorrecepção foi testada num protótipo declarado |

## 8. Estado de aprovação

| Item | Estado |
|---|---|
| Veneno (tipos, dose, resistência, decisão, morte) | **IMPLEMENTADO E TESTADO** |
| Camuflagem óptica (efeito, energia, detecção, limites) | **IMPLEMENTADO E TESTADO** |
| Termorrecepção (alcance, contraste, obstáculo, identidade) | **IMPLEMENTADO E TESTADO** |
| Voo 3D (física, decolagem, pouso, obstáculos, ferimento) | **IMPLEMENTADO E TESTADO** |
| Bandos (coesão, separação, alinhamento, dispersão) | **IMPLEMENTADO E TESTADO** |
| Cupins (recurso finito, busca, competição, recuperação) | **IMPLEMENTADO E TESTADO** |
| Clima (sentidos, locomoção, voo, abrigo, bioma) | **IMPLEMENTADO E TESTADO** |
| Decomposição (estágios, insetos, ossos, balanço) | **IMPLEMENTADO E TESTADO** |
| VFX de sangue (evento real, região anatômica, pooling) | **IMPLEMENTADO E VALIDADO VISUALMENTE** |
| Emboscada | **PARCIAL** — funciona e é medida; não melhora o resultado contra presa isolada |
| Ossos e cupinzeiro como arte | **PENDENTE** — protótipos declarados, aguardando os Agentes 02 e 04 |
| Aprovação artística | **PENDENTE** — do criador |
| Filtro de Qualidade (Agente 06) | **PENDENTE** |

Nenhum merge automático foi feito. O PR aponta para a branch da V6, não para `main`.
