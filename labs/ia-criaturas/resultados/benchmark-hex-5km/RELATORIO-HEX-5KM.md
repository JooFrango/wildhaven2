# Laboratório de IA V1.1 — densidade máxima num hexágono de 5 km

Operação de desempenho sobre a IA Base V1.0 (`bbb3b78`, PR #19). Nenhuma capacidade de IA foi desligada,
nenhum parâmetro de gameplay foi mexido, nenhum GLB foi alterado.

## 1. Como reproduzir

```bash
node scripts/derivar-terreno-hex.mjs ../../world/environmental-polish/base10/models/52_savana_bosques_de_acacia_5km.glb --x0 -2160 --z0 -2480 --largura 4320 --profundidade 4960 --res 8 --bloquearSemTerreno --saida config/eco/terrenos/hex52-savana-acacia-5km.json
```

```bash
node scripts/bench-populacao.mjs --populacoes 25,50,100,200,400,800,1600,3200 --segundos 120 --sementes 1-5 --json resultados/benchmark-hex-5km/sim.json
```

```bash
npm install --no-save playwright && npx playwright install chromium && node scripts/bench-navegador.mjs --populacoes 25,100,400 --quadros 120 --json resultados/benchmark-hex-5km/nav.json
```

## 2. Hardware e configuração

| item | valor |
| --- | --- |
| CPU | Intel Core i7-1165G7 @ 2,80 GHz, 8 núcleos lógicos |
| RAM | 19,7 GB |
| Node | v24.21.0 |
| SO | Windows 11 (10.0.26200) |
| Navegador | Chromium do Playwright, headless, **WebGL por software (ANGLE/SwiftShader)** |
| Resolução da medição | 1280 × 720, pixelRatio 1, sem vsync |

**O número de FPS deste relatório é um teto de CPU, não o FPS de uma placa de vídeo.** A medição roda com
rasterização por software; numa GPU real a parte de desenho cai muito, e a parte de IA (que é CPU) fica
igual. Nada aqui se transfere para outra máquina sem repetir a medição.

## 3. O hexágono

`world/environmental-polish/base10/models/52_savana_bosques_de_acacia_5km.glb` — savana com bosques de
acácia, o mesmo GLB oficial de onde já saía o recorte de 240 × 200 m usado nos cenários da V1.

| característica | preservada? | como |
| --- | --- | --- |
| Dimensões | sim | 4320 × 4960 m (hexágono de 5 km entre lados opostos) |
| Limites do polígono | sim | célula sem triângulo de terreno vira **bloqueio**, não chão plano (`--bloquearSemTerreno`) |
| Relevo | sim, amostrado | grade de **8 m**; desnível de 222 m dentro da área navegável |
| Obstáculos | sim | 4560 células de rocha/tronco, das malhas `boulders`, `rock_escarpments` e `trunks` |
| Vegetação e cobertura | sim | 50 281 células com cobertura (`shrubs`, `broadleaf_canopy`) |
| Água | sim | 8706 células de `river_water` (0,56 km²) |
| Área navegável | — | **15,36 km²** (o hexágono ideal de 4320 m entre lados tem 16,2 km²) |

**Simplificação declarada:** a grade é de 8 m, não de 1 m. A 1 m o hexágono inteiro daria 25 milhões de
células (~700 MB só de grades) e um arquivo de centenas de MB. A 8 m são 540 × 620 células e 8,1 MB. O que
isso custa: obstáculos menores que 8 m e trilhas estreitas somem na amostragem; o relevo, a água, a
cobertura e o contorno do hexágono ficam.

## 4. Benchmark A — simulação pura (sem renderizador)

5 níveis de população, 120 s simulados cada, semente 1, com todos os sistemas ligados e os invariantes
verificados durante a execução (0 falhas em todos os níveis).

| animais | p50 antes | p50 depois | ganho | p95 antes | p95 depois | tempo real antes | tempo real depois | ms/animal/s antes | depois |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 25 | 0,91 ms | 1,16 ms | 0,8× | 1,74 | 2,37 | 78,0× | 56,7× | 0,475 | 0,653 |
| 50 | 1,78 ms | 1,47 ms | 1,2× | 3,26 | 2,89 | 46,3× | 50,5× | 0,432 | 0,396 |
| 100 | 6,51 ms | 2,12 ms | **3,1×** | 9,85 | 4,05 | 14,4× | 38,5× | 0,704 | 0,262 |
| 200 | 18,65 ms | 5,62 ms | **3,3×** | 26,37 | 10,85 | 5,1× | 15,6× | 0,982 | 0,322 |
| 400 | 72,68 ms | 12,08 ms | **6,0×** | 101,01 | 21,10 | 1,33× | 7,43× | 1,878 | 0,336 |
| 800 | 276,58 ms | 20,54 ms | **13,5×** | 374,04 | 31,49 | 0,35× | 4,56× | 3,576 | 0,274 |
| 1600 | — | 46,38 ms | — | — | 71,88 | — | 2,02× | — | 0,309 |
| 2000 | — | 65,11 ms | — | — | 98,11 | — | 1,45× | — | 0,344 |
| 2400 | — | 85,63 ms | — | — | 125,51 | — | **1,12×** | — | 0,373 |
| 2800 | — | 98,27 ms | — | — | 159,26 | — | 0,94× | — | 0,379 |
| 3200 | — | 120,97 ms | — | — | 181,43 | — | 0,78× | — | 0,399 |

*Tempo real* = segundos simulados por segundo de parede. Abaixo de 1,0 a simulação não acompanha o relógio.

**O que mudou de forma:** antes, o custo por animal **crescia com a população** (0,43 → 3,58 ms), o traço de
um algoritmo O(n²). Depois, ele fica **plano em 0,26–0,40 ms** de 50 a 3200 animais: o custo passou a ser
linear.

Em 25 animais a grade é 20% mais lenta: montar duas grades por passo custa mais do que varrer 25 animais.
É o preço honesto da mudança, e ele some a partir de ~50.

### Limite sustentável — simulação pura

**~2400 animais** com todos os sistemas ligados (2400 = 1,12× o tempo real; 2800 já cai para 0,94×).
Antes da otimização, o mesmo limite ficava entre **400 e 450**. Ganho de **~6× na população sustentável**.

## 5. Benchmark B e C — renderização e integrado

**Leia o aviso da seção 2 antes dos números:** a medição roda com WebGL por software. O FPS aqui é um teto
de CPU, não o de uma placa de vídeo. O que vale levar daqui é a **divisão do quadro** e a **contagem de
objetos**, que não dependem da GPU.

### Custo do quadro com a população espalhada pelo hexágono (modo ecológico, GLBs reais)

| animais | FPS | 1% low | quadro p50 | simulação | animação | desenho | malhas | com skin | carga |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 25 | 81,8 | 32,2 | 11,3 ms | 0,96 ms | 4,19 ms | 7,07 ms | 820 | 104 | 7,1 s |
| 50 | 54,3 | 14,5 | 15,8 ms | 1,33 ms | 7,69 ms | 9,39 ms | 1543 | 224 | 5,8 s |
| 100 | 29,9 | 18,2 | 32,3 ms | 1,67 ms | 14,25 ms | 17,57 ms | 3073 | 430 | 9,1 s |
| 200 | — | — | 75,1 ms | 2,16 ms | 24,43 ms | — | 6207 | 860 | 7,2 s |
| 400 | — | — | 122,3 ms | 4,17 ms | 46,66 ms | — | 12403 | 1720 | 5,4 s |
| 800 | — | — | 258,0 ms | 9,80 ms | 93,74 ms | — | 24795 | 3440 | 7,7 s |

A coluna de desenho acima de 100 animais ficou poluída por travadas do rasterizador por software (quadros
isolados de dezenas de segundos), então **não reporto FPS acima de 100**: seria um número que a medida não
sustenta. O que a medida sustenta é a tendência de `simulação` e `animação`, que são CPU pura.

**O achado:** a animação custava **mais do que toda a IA**, e crescia com o total de animais, não com os
visíveis — o esqueleto de cada animal era atualizado todo quadro, mesmo fora da tela.

### Densidade visível real (modo estresse, 400 animais concentrados, câmera enquadrando o aglomerado)

| altura da câmera | animais visíveis | draw calls | triângulos | animação | desenho | FPS |
| --- | --- | --- | --- | --- | --- | --- |
| 80 m | 5 | 96 | 2,18 M | 2,09 ms | 71,9 ms | 11,6 |
| 160 m | 20 | 566 | 2,34 M | 3,13 ms | 85,3 ms | 10,6 |
| 320 m | 76 | 2226 | 3,05 M | 10,17 ms | 93,3 ms | 9,2 |
| 640 m | 260 | 7842 | 5,44 M | 36,33 ms | 147,5 ms | 5,3 |

**Cada animal visível custa ~30 draw calls.** 260 visíveis dão 7842 chamadas de desenho — os GLBs são
dezenas de malhas separadas por criatura. É o gargalo de renderização mais claro do laboratório e ele
**independe da GPU**: é contagem de objetos, não de pixels. Resolver isso é trabalho de asset (juntar as
malhas de cada criatura), não de IA.

### Total simulado ≠ total visível

No cenário ecológico, 400 animais espalhados por 15,36 km² significam **um animal a cada ~190 m**. Mesmo
na concentração artificial do modo estresse, a 80 m de altura só 5 dos 400 aparecem na tela. A separação
que a Fase 5 pede, medida:

| contagem | 400 animais, modo estresse, câmera a 320 m |
| --- | --- |
| vivos no hexágono | 400 |
| com IA completa (nível 1) | 400 |
| com IA simplificada (níveis 2/3) | 0 neste cenário (todos próximos) |
| modelos carregados na cena | 400 |
| **visíveis no quadro** | **76** |
| **animados no quadro (esqueleto)** | **76** (antes do LOD: 400) |

## 6. Gargalos

### Medidos antes (perfil de CPU, 400 animais, 60 s)

| % do tempo | função |
| --- | --- |
| 40,2% | `passoEco` (mundo.js) — inclui os laços par-a-par que o V8 inlina no quadro do chamador |
| 17,8% | `mover` (locomocao.js) — dominado por `separacao` |
| 7,5% | `perceber` (percepcao.js) |
| 6,7% | `resolverSobreposicoes` (locomocao.js) |
| 4,8% | `separacao` (locomocao.js) |
| 4,0% | `medirSobreposicao` (mundo.js) |
| 3,3% | `separadosNaVertical` (subsolo.js) |

Quatro laços varriam a lista inteira de animais para cada animal: percepção, separação, resolução de
sobreposição e a métrica de sobreposição. Juntos, mais da metade do tempo.

### Medidos depois (perfil de CPU, 2400 animais, 60 s)

| % do tempo | função |
| --- | --- |
| 20,6% | `passoEco` |
| 13,6% | `perceber` |
| 9,8% | `vizinhos` (grade.js) — a própria consulta espacial |
| 4,9% | `mover` |
| 3,4% | coletor de lixo |
| 3,4% | `atualizarMemoria` |
| 2,6% | `altura` (terreno.js) |
| 2,1% | `linhaDeVisao` (terreno.js) |
| 1,9% | `buscarCaminho` (terreno.js) |

O custo está distribuído. O que sobrou de concentrado é a própria consulta espacial (9,8%) e a percepção,
que agora é o trabalho real de cada animal, não uma varredura da lista.

## 7. Otimizações aplicadas

Só uma mudança estrutural, e ela veio direto do perfil.

### Grade espacial uniforme (`src/eco/grade.js`)

Uma grade de células de 16 m, montada duas vezes por passo (antes da percepção e antes da fase de contato),
que devolve os vizinhos dentro de um raio em vez de varrer todos.

O ponto delicado: a simulação é determinística e o hash do mundo depende da **ordem** em que os pares são
visitados — somas de ponto flutuante não são associativas. Por isso a consulta devolve **índices em ordem
crescente**, exatamente a ordem da varredura que ela substitui, e o raio de consulta soma a margem do
deslocamento do passo (`mundo.margemPasso`), porque a grade é montada antes de os animais andarem.

**Prova de que nada mudou de comportamento:** a impressão digital de 180 encontros em 30 sementes continua
`94df59e1`, idêntica à da V1.0, e os 185 testes passam. Não é "parecido": é o mesmo resultado, bit a bit.

Houve uma iteração no caminho: a primeira versão montava a grade só no início do passo e o bando deixava de
se reagrupar (`separação e reagrupamento` falhou). A causa era a grade velha na fase de contato — corrigida
com a remontagem e a margem.

### Micro-otimização na consulta

A consulta só ordena o resultado quando os baldes não saíram já em ordem. Ganho pequeno e medido
(85,6 → 83,5 ms de p50 em 2400 animais), três linhas.

### LOD de animação: esqueleto parado fora do campo de visão (`src/web3d/animador.js`, `app-eco.js`)

Medido primeiro: a animação consumia 93,7 ms por quadro com 800 animais, e crescia com o **total**, não com
os visíveis. Agora cada quadro testa a esfera do corpo contra o tronco de visão da câmera; quem está fora
recebe só posição e rumo (`quadroSimples`), e o esqueleto, a IK, a mira e o mixer ficam parados até o animal
reaparecer — o clipe retoma de onde estava.

| 400 animais, 76 visíveis | sem LOD | com LOD |
| --- | --- | --- |
| animação | 32,14 ms | **7,47 ms** |
| quadro p50 | 89,5 ms | **74,8 ms** |
| FPS | 11,1 | **13,2** |

Com 100 animais a diferença é maior ainda: 57,36 ms → 1,40 ms de animação. Pode ser desligado em tempo de
execução com `ecoDemo.lodAnimacao(false)`, que é como a tabela acima foi medida no mesmo mundo.

### O que **não** foi feito, e por quê

Instanciamento, agendamento entre quadros e reuso de rotas não aparecem no perfil: busca de caminho é 1,9%
do tempo, e instanciar malhas com esqueletos diferentes é justamente o que a ordem proíbe fazer às cegas.
Mexer nelas agora seria otimizar por intuição. Ficam registradas para quando o perfil as justificar.

## 8. A IA continua funcionando

| verificação | resultado |
| --- | --- |
| Suíte completa | **185/185** |
| Impressão digital (30 sementes) | **94df59e1** — igual à da V1.0 |
| Invariantes durante o benchmark | **0 falhas** em todos os níveis de população |
| Fome, sede, percepção, caça, fuga, combate, ferimentos, memória, social, voo, veneno, reprodução, carcaças, persistência | cobertos pelos testes da V1.0, todos aprovados sem alteração |

Nenhuma mudança legítima de comportamento a registrar na simulação: o resultado é idêntico ao da base.
No renderizador há uma mudança assumida: o esqueleto de quem está fora da tela não avança, então o clipe
retoma de onde parou quando o animal reaparece. Posição, rumo e tudo o que a IA decide seguem iguais.

### Resistência — 5 sementes, 400 animais, 600 s simulados cada

| semente | passo p50 | p95 | tempo real | mortes | RSS | invariantes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 24,17 ms | 48,08 | 3,06× | predação 3 | 491 MB | 0 |
| 2 | 14,92 ms | 34,46 | 5,79× | predação 1 | 481 MB | 0 |
| 3 | 10,70 ms | 20,78 | 8,60× | — | 471 MB | 0 |
| 4 | 10,86 ms | 21,06 | 8,40× | predação 1 | 498 MB | 0 |
| 5 | 11,19 ms | 21,01 | 8,45× | predação 1 | 459 MB | 0 |

Sem crescimento de memória entre sementes (459–498 MB), sem animal preso, sem falha de navegação, sem
congelamento. A semente 1 está mais lenta porque o navegador da medição anterior ainda estava aberto
disputando CPU — é ruído de medição, não do laboratório.

### Persistência em escala — 400 animais

| verificação | resultado |
| --- | --- |
| Hash depois de salvar aos 90 s, carregar e seguir até 180 s | `e9187177`, **idêntico** ao da execução sem parar |
| Invariantes no mundo retomado | 0 |
| Tempo para salvar / carregar | 192 ms / 981 ms |
| Tamanho do instantâneo | 10,3 MB (8,1 MB é o terreno do hexágono) |

## 9. Limites

| limite | valor |
| --- | --- |
| Técnico (simulação pura, tempo real) | ~2400 animais |
| Ecológico | muito abaixo disso: 2400 animais em 15,36 km² dão ~156 animais/km² |

Os dois números respondem perguntas diferentes. O técnico diz o que a máquina aguenta; o ecológico, quantos
animais fazem sentido no bioma. **A densidade artificial do modo `--modo estresse` serve só para achar o
teto técnico.**

### Resumo

| | antes | depois |
| --- | --- | --- |
| População máxima estável (simulação pura, tempo real) | ~400 | **~2400** |
| Custo por animal por segundo simulado | 0,43 → 3,58 ms (cresce com a população) | **0,26–0,40 ms (plano)** |
| Passo com 800 animais | 276,6 ms | **20,5 ms** |
| Animação por quadro, 400 animais / 76 visíveis | 32,1 ms | **7,5 ms** |
| Impressão digital | `94df59e1` | `94df59e1` |
| Suíte | 185/185 | 185/185 |

**Ganho real: 6× na população sustentável da simulação, com resultado bit a bit idêntico.**

### Gargalos que ficam

1. **~30 draw calls por animal visível.** Os GLBs são dezenas de malhas por criatura. 260 visíveis = 7842
   chamadas. É trabalho de asset (juntar malhas por criatura ou gerar LOD de malha), não de IA, e é o teto
   de renderização mais claro que existe hoje.
2. **Medição de FPS presa à rasterização por software.** O número real de uma GPU não foi medido, e não dá
   para deduzir daqui. Repetir `scripts/bench-navegador.mjs` numa máquina com GPU é uma hora de trabalho.
3. **`vizinhos` é 9,8% do tempo** com 2400 animais: a consulta espacial virou o próprio custo. Dá para
   atacar com células por raio de consulta ou lista de vizinhos reaproveitada entre passos — só com perfil
   novo que justifique.
4. **Carga inicial de 5 a 25 s** com população alta no navegador, dominada pela clonagem dos GLBs.

### Limites de cada verificação

- A simulação pura mede CPU de um processo Node; não inclui renderização nem entrada do jogador.
- O FPS do navegador é teto de CPU com WebGL por software, a 1280 × 720, sem vsync.
- A resistência foi medida em 600 s simulados, não em horas; crescimento de memória muito lento não
  apareceria.
- Os níveis acima de 400 animais não foram rodados em 5 sementes, só em 1: as 5 sementes cobrem o nível
  ecológico, não o teto técnico.
- Nada disso mede a Alpha: é o laboratório.
