# Relatório de otimização — Build Real V04.2 (segunda varredura)

**O que é:** a V04.1 com uma segunda rodada de otimização: auditoria das próprias mudanças da V04.1, perfil por quadro no cliente e servidor medido em escala.

**Mesmo conteúdo:**
- mesmos 272 hexes, vegetação, sombras, clima, criaturas, regras de IA, interface e telas de carregamento;
- nenhuma mecânica nova;
- nada simplificado.

**Onde está:**
- código: `game/build-real-v04-2/`;
- branch: `feat/build-real-v04-2-segunda-varredura`;
- a V04.1 continua intacta em `game/build-real-v04-1/`.

**Documentos relacionados:**
- checklist: `CHECKLIST-V04.2.md`;
- números lado a lado: `BENCHMARK-V04-V04.1-V04.2.md`;
- o que ficou para depois: `PENDENCIAS-V04.2.md`.

**Ambiente de medição:**
- contêiner Linux de 4 núcleos, Chromium 158 headless;
- WebGL por **SwiftShader** (rasterização na CPU, 3–5 quadros/s no perfil Médio);
- **nenhum FPS de GPU física foi medido.** A meta de 60 FPS na Iris Xe só pode ser conferida no PC do diretor, com o gravador de quadros do F3 (60 s, JSON com cada pico e a causa).

**Método:** ciclos medir → gargalo → alternativas → implementar → comparar (A/B/B/A, ou digesto do estado no servidor) → conferir visual/equivalência → regressão.

## 1. Resultado em uma página

| Área | V04.1 | V04.2 | Como foi medido |
| --- | --- | --- | --- |
| Servidor, 20.000 criaturas, Hunters espalhados | 10,22 ms por passo | **6,79 ms** (−34%) | `sim_check escala`, mesmo estado (digesto) |
| Servidor, 10.000 criaturas, espalhados | 4,56 ms | **2,79 ms** (−39%) | idem |
| Servidor, 5.000 criaturas, espalhados | 2,29 ms | **1,59 ms** (−31%) | idem |
| Servidor, exploração longa (60.000 passos) | 2,56 ms | **2,20 ms** (−14%) | digesto `ca74bf9f89216c13` nas duas |
| Publicação, 1 cliente Econômico | 9,5 ms/s | **5,4 ms/s** (−43%) | mesmos bytes entregues |
| Publicação, 1 cliente em segundo plano | 7,8 ms/s | **3,9 ms/s** (−50%) | idem |
| Publicação, 1 cliente 3D | 10,6 ms/s | **7,0 ms/s** (−34%) | idem |
| RAM do servidor (padrão interno) | 321 MB (cache 256) | **190 MB** (cache 128, como o portátil) | mesmo digesto; +0,7% no passo |
| Lixo por segundo no cliente 3D | 1,45 / 1,66 MB/s | **1,40 / 1,32 MB/s** (−14%) | A/B/B/A, 60 s de assentamento + 40 s |
| Vértices mantidos na RAM da CPU | 67,5 MB | **62,6 MB** (5 MB só na GPU) | varredura em runtime |
| Pegadas: reenvio por quadro | ~57 KB por quadro | só quando a lista muda | pulso no shader |
| CPU do servidor, teste de 2 h Econômico | 4,85% | **3,46%** (−29%) | mesmo roteiro |
| CPU do servidor, teste de 2 h aba oculta | 4,53% | **1,45%** (−68%) | idem |
| Visual (capturas na mesma cena) | — | 0,03–0,04% de pixels diferentes (Hunters em movimento) | `final/capturas/` |

**O que não melhorou (medido):**
- **3D no SwiftShader:** CPU e quadros/s praticamente iguais nas três versões (≈355% de CPU). Aqui o custo é a rasterização por software, que não representa a GPU real.
  - No teste de 60 s na mesma cena (A/B/B/A), a V04.2 ficou ligeiramente à frente: 10,41–10,61 contra 10,27–10,41 quadros/s; 90/106 contra 148/99 quadros acima de 100 ms.
- **Heap JS vivo após coleta:** 41,4 MB na V04.1, 41,7 MB na V04.2.

## 2. Servidor

### 2.1 Passo da simulação

Perfil por seção do passo (`prof`), escala 1k/5k/10k/20k criaturas, Hunters na vila e espalhados (`bench/v04-2/escala-*.json`).

Achados e correções:

| Gargalo | Correção | Equivalência |
| --- | --- | --- |
| Visões copiadas (`HunterView`/`CreatureView` clonadas por criatura) | Vizinhos por referência (`&[&View]`) | Digesto idêntico |
| Grade espacial em `HashMap<cell, Vec>` reconstruída a cada passo | Grade plana: chaves ordenadas, índices contíguos, buffers reaproveitados, hash multiplicativo de célula | Idem |
| Distância mínima ao Hunter: uma raiz quadrada por par | Mínimo das distâncias ao quadrado, uma raiz por criatura | Idem |
| Clima: busca linear dos nós a cada consulta | Grade de nós (5 km) com busca em anel; consulta sem alocação | Idem |
| Areia recalculada por criatura | Cache por hex | Idem |
| Espécie consultada em 3 mapas | Uma consulta (`sp_info`) | Idem |
| Estado e clipe da criatura como `String` nova a cada passo | `Cow<'static, str>` | Idem |

**Resultados (ms por passo, V04.1 → V04.2):**

| Criaturas | Vila | Espalhados |
| --- | --- | --- |
| 1.000 | 0,40 → 0,11 | — |
| 5.000 | 0,76 → 0,47 | 2,29 → 1,59 |
| 10.000 | 1,42 → 0,92 | 4,56 → 2,79 |
| 20.000 | 3,12 → 2,10 | 10,22 → 6,79 |

RSS do servidor nos cenários de escala: 322–341 MB, quase todo o cache físico de 256 MB; cerca de 0,9 KB por criatura.

### 2.2 Publicação

**Antes:** o estado era publicado a cada passo, mesmo quando nenhum cliente consumia naquele ritmo.

**Agora:** o intervalo segue o cliente mais exigente conectado:

| Cliente mais exigente | Intervalo |
| --- | --- |
| 3D | a cada passo |
| Econômico | 400 ms |
| Segundo plano | 5 s |
| Nenhum | 1 s |

**Garantias:**
- Evento importante novo (combate, morte etc.) publica na hora.
- A persistência é decidida antes e não depende da publicação.
- Mesmos bytes recebidos pelo cliente em cada modo (`bench/v04-2/publicacao/`).

### 2.3 Cache físico

| Cache | RSS | ms por passo | Digesto |
| --- | --- | --- | --- |
| 256 MB | 321 MB | 2,074 | igual |
| 128 MB | 190 MB | 2,089 | igual |
| 64 MB | 127 MB | 2,187 | igual |

O portátil já usava 128 MB; o padrão interno passou de 256 para 128.

### 2.4 Rumo a 1.000 jogadores

Análise com números medidos. **Não implementada nesta etapa:** muda a arquitetura de processos e não é otimização de mecânica existente.

**Hoje:** um processo de servidor é **uma** instância de mundo (um jogador, seus 8 Hunters).

**Custos por instância medidos:**
- **CPU:**
  - V04.1, teste longo com 1 cliente Econômico: 4,85% de um núcleo em média (2 h);
  - V04.2: ver seção 4;
  - instância congelada (jogador saiu): 0, como hoje (regra mantida).
- **RAM:** cache físico + **62–65 MB** do resto (estado, dados estáticos, alocador): 321 − 256, 190 − 128, 127 − 64.
- **Rede por cliente:**

  | Modo | Recebido pelo cliente |
  | --- | --- |
  | 3D | 13,8 KB/s |
  | Econômico | 8,2 KB/s |
  | Segundo plano | 2,5 KB/s |

**1.000 jogadores simultâneos, como está (1 processo por jogador):**
- CPU: ~50 núcleos;
- RAM: ~190 GB com cache de 128 MB;
- rede: 8–14 MB/s de saída.

**O gargalo é a RAM: o cache físico de cada instância guarda os mesmos dados.** O relevo físico é só leitura e igual para todos.

**Proposta para a próxima etapa:**
- **Processos "shard"** com K instâncias cada, num pool de threads (uma simulação por instância, como hoje).
- **Um repositório físico compartilhado por processo.** Os chunks já são `Arc<Chunk>`; falta trocar o LRU por instância por um LRU compartilhado e protegido.
- **RAM estimada com cache compartilhado:** 256 MB por processo + 1.000 × 62–65 MB ≈ **62–65 GB**, em vez de ~190 GB.
- **Ganho adicional possível:** compartilhar os dados estáticos (manifesto, continente, clima, espécies). Hipótese a medir: separar o RSS antes e depois da geração do mundo.
- **Rede e WebSocket:** um gateway por processo; o filtro de relevância e a publicação por cliente já existem.

### 2.5 Picos de tick na geração de criaturas (investigado; correção desfeita)

**Origem:** o teste de 2 h da V04.2 registrou um tick de 454 ms aos 33 min, quando um hex novo gerou ~1.400 criaturas.

**Medição** (`sim_check exploracao-longa`, agora com pior passo, seções e chunks síncronos por passo):
- V04.1 e V04.2 têm o **mesmo** padrão: 27 passos de geração de 105–160 ms em 60.000.
- Cada um faz **160–250 leituras síncronas** de chunks físicos do disco. Elas vêm do anel de busca de água (150/300 m) em volta dos candidatos a toca.
- Não é regressão da V04.2. O teste de 420 min da V04.1 também mostra picos de 230–359 ms nas gerações.

**Tentativa (`9dbc0ea`):**
- O anel passava a esperar o chunk de forma assíncrona, como a geração já faz com o chunk do candidato.
- Mesmo digesto no `sim_check`.
- **No servidor real, porém, a geração ficou muito mais lenta:** cada ponto do anel pedia um chunk por passo. O hex inicial chegou a 292 criaturas em 90 s, contra 1.722 em 60 s na V04.1.
- Isso muda o jogo. **A mudança foi desfeita em `676fa23`** (código idêntico ao anterior; 1.720 criaturas no passo 309, conferido).

**Desenho da correção para a próxima etapa** (em `PENDENCIAS-V04.2.md`):
- calcular de antemão as 40 posições candidatas do grupo, que dependem só da sequência aleatória;
- pedir **em lote** todos os chunks delas e dos anéis;
- gerar quando todos estiverem prontos: uma ida e volta à thread de carga em vez de dezenas.

## 3. Cliente

### 3.1 Alocação e coleta de lixo

**Laboratório:** `tools/lab/alocacoes.mjs`: amostragem do HeapProfiler por função, mais os eventos de GC do trace.

**Primeira rodada (V04.2 inicial):**
- cores e vetores temporários do céu, atores, câmera, vila e portão de luzes;
- pegadas com o pulso no shader;
- resultado sem diferença mensurável: 0,86–1,06 MB/s na V04.1 contra 1,06–1,08 MB/s.

O laboratório mostrou onde estava o lixo de verdade:

| Origem | Problema | Correção |
| --- | --- | --- |
| Seleção do relevo | closures `hide`/`showTile`/`prio` e um array de objetos `plan` criados por hex a cada quadro; `Object.assign` com literal | Métodos; o plano fica no próprio bloco; campos atribuídos um a um |
| Vegetação | duas `subarray` (dois objetos TypedArray) por instância desenhada | Cópia direta dos 16 + 3 valores |
| Capim | chave em string por hex em cada amostra; `group.updateMatrixWorld(true)` do hex inteiro, filhos incluídos, a cada amostra | Pré-filtro pela extensão das folhas de relevo do hex; matriz só da folha usada |
| F3 (VRAM estimada) | a cada 5 s, array espalhado de atributos e `Object.values` de cada material da cena inteira | Mesma soma, sem alocar |

**Equivalência do capim:** `tools/test/capim-equivalencia.mjs`. 1.117 de 1.117 pontos comparáveis idênticos: altura, normal e cor. Os 1.883 restantes estavam com o relevo ainda carregando nas duas variantes.

**Resultado (A/B/B/A, vila, Médio, 60 s de assentamento + 40 s medidos):**

| | V04.1 (2 execuções) | V04.2 (2 execuções) |
| --- | --- | --- |
| MB/s alocados | 1,45 / 1,66 | 1,40 / 1,32 |
| KB por quadro | 399 / 382 | 389 / 305 |
| GC menor | 45 / 46 (37 ms) | 48 / 43 (35–42 ms) |
| GC maior | 1 (17,5 / 15,4 ms) | 1 (25,1 / 17,5 ms) |

O que resta é em maior parte trabalho de carregamento:
- parse dos GLB de relevo e de modelos (GLTFLoader);
- montagem de células de capim quando o Hunter anda;
- fila de pedidos do relevo.

### 3.2 Memória

`tools/lab/memoria-assets.mjs`:
- heap V8 real após GC (CDP);
- vértices na CPU × só na GPU, por grupo;
- duplicatas por conteúdo.

| Medida | V04.1 | V04.2 |
| --- | --- | --- |
| Heap V8 vivo após GC | 41,4 MB | 41,7 MB |
| `performance.memory` (o "heap" do F3) | 295,6 MB | 290,9 MB |
| Vértices na CPU: relevo | 37,1 MB | 32,1 MB (+5,0 MB só na GPU) |
| Vértices na CPU: horizonte | 13,6 MB | 13,6 MB |
| Vértices na CPU: vegetação instanciada | 10,6 MB | 10,6 MB |
| Vértices na CPU: vila | 5,1 MB | 5,1 MB |
| Geometrias duplicadas por conteúdo | 1,2 MB | 1,2 MB |

**Leitura:**
- O "heap ~300 MB" do F3 é quase todo **lixo à espera de coleta**: o heap vivo é de ~41 MB. Na aba oculta da V04.1 ele cai para 12 MB na primeira coleta maior (teste de 2 h).
- O relevo L0 continua na CPU porque o capim faz raycast nele. Liberar exigiria outra fonte de altura, e a equivalência de posição do capim é regra.
- Horizonte (13,6 MB), vegetação (10,6 MB) e vila (5,1 MB) ainda mantêm a cópia na CPU. Não foi verificado se algum código as lê depois do envio à GPU; liberar sem essa verificação poderia quebrar culling ou raycast. Fica como pendência medida.

### 3.3 Compilação de shaders

**V04.2:** materiais de relevo que chegam depois do carregamento passam por `compileAsync` antes de o nó ficar pronto.

**Gravador de picos** (zoom, troca de Hunter, viagem, 40 s cada, V04.1 × V04.2):
- **nenhum pico acima de 2,5× a mediana** nas duas versões;
- 1 programa novo no jogo em cada cenário, nas duas.

**Limite do roteiro noturno:** em 40 s com ×50 o ciclo não chega à noite. As lanternas foram medidas à parte, em `tools/lab/lanternas.mjs`:
- noite forçada, câmera sobre a vila, zoom 65 ↔ 700 m (as 6 lanternas acendem e apagam);
- 2 execuções por versão;
- **1 programa compilado durante as 5 trocas, nas duas versões.**
- A V04.2 chega ao jogo com 81 programas prontos, contra 77 na V04.1: mais materiais pré-compilados.

### 3.4 Sombras (experimento isolado; o jogo não mudou)

`tools/lab/sombras.mjs`: vila, câmera fixa, ordem A/B/C/D/D/C/B/A, mediana do intervalo de quadro.

| Modo | Mediana (SwiftShader) | Diferença |
| --- | --- | --- |
| Atual (mapa a 30 Hz) | 263 ms | — |
| Congelado (teto de um cache estático perfeito) | 239 ms | −9% |
| 15 Hz | 222 ms | dentro do ruído do congelado |
| Sem sombras | 201 ms | −24% |

**Decisão: não adotar cache estático nem 15 Hz.**
- O ganho máximo de um cache é ~9% aqui. O resto do custo é amostrar a sombra nos materiais, que um cache não remove.
- O sol se move continuamente (ciclo dia/noite) e invalida qualquer cache estático. O resultado seria sombra "em degraus": mudança visual, contra a regra do diretor.
- Capturas em `bench/v04-2/labs/sombras/`:
  - foram feitas às 06:11 (amanhecer), com sombras fracas;
  - diferença de pixels contra o atual: 0,11% (congelado), 0,19% (15 Hz), 0,35% (sem sombras).

### 3.5 WebGPU

`client/lab/webgpu.html` é uma página isolada que não altera o jogo: a mesma floresta instanciada com os protótipos reais de vegetação (`/visual/prototypes.glb`, 20.000 instâncias por padrão), mesma câmera e resolução, em WebGL e em WebGPU, com tempo de quadro de cada renderizador por 10 s.
- O SwiftShader não oferece WebGPU, então não houve medição aqui.
- Fica para o PC do diretor (PENDENCIAS).

### 3.6 Técnicas investigadas

| Técnica | Situação | Motivo |
| --- | --- | --- |
| Vizinhos por referência, grade plana, clima indexado (servidor) | **Aprovada** | −31 a −39% por passo, digesto igual |
| Publicação no ritmo do cliente | **Aprovada** | −34 a −50% de custo de publicação, mesmos bytes |
| Cache físico 128 MB | **Aprovada** | −131 MB de RSS, +0,7% de CPU |
| Lixo por quadro (relevo, capim, vegetação, F3) | **Aprovada** | −14% de alocação, equivalência do capim 100% |
| Pulso das pegadas no shader | **Aprovada** | sem reenvio de matrizes por quadro, mesmo visual |
| Relevo compilado antes de aparecer | **Aprovada** | `compileAsync` |
| Vértices do relevo (exceto L0) só na GPU | **Aprovada** | −5 MB de CPU |
| Cache estático de sombras / 15 Hz | **Rejeitada** | teto de −9%; o sol móvel causaria mudança visual |
| Desligar sombras | **Rejeitada** | regra do diretor |
| Liberar relevo L0 da CPU | **Rejeitada nesta etapa** | o capim depende dele |
| Worker para a BVH do capim | **Adiada** | transferir a geometria custa uma cópia; a construção já caiu para 2–8 ms na V04.1 |
| WASM no cliente | **Rejeitada nesta etapa** | os perfis da V04.1 apontaram custo em funções do three.js (`getProgram`, `getParameters`, `updateMatrixWorld`) e na rasterização, não num laço numérico isolável que WASM aceleraria |
| WebGPU | **Laboratório isolado** | sem medição possível neste ambiente |
| meshopt / KTX2 | **Não aplicada** | as texturas são poucas (34) e o relevo é gerado; teria de ser derivado em CI sem tocar nos originais. Ganho de RAM medido possível: pequeno (vértices na CPU ~62 MB, maior parte necessária) |
| Multi-instância compartilhando o relevo físico | **Analisada (2.4)** | próxima etapa; reduziria ~190 GB → ~62 GB para 1.000 jogadores |

## 4. Testes longos

Mesmo roteiro e mesmo script nas três versões: todos os Hunters explorando, amostra a cada 60 s, servidor dedicado com cache de 256 MB.

| Teste | Duração executada | V04 | V04.1 | V04.2 |
| --- | --- | --- | --- | --- |
| Econômico: CPU do navegador | 120 min (as três) | 26,1% | 10,6% | **10,3%** |
| Econômico: CPU do servidor | idem | 5,24% | 4,85% | **3,46%** (−29% × V04.1) |
| Aba oculta: CPU do navegador | 120 min (as três) | 0,16% | 0,17% | **0,17%** |
| Aba oculta: CPU do servidor | idem | 4,37% | 4,53% | **1,45%** (−68% × V04.1) |
| Aba oculta: heap no fim | idem | 259 MB | 11,5 MB | **11,8 MB** |
| 3D Médio, 30 min: CPU do navegador | 30,06 / 30,05 / 30,06 min | 356% | 354% | **358%** |
| 3D Médio: quadros em 30 min | idem | 9.450 | 9.180 | **9.210** |
| 3D Médio: heap início → fim | idem | 295 → 308 MB | 298 → 296 MB | **293 → 289 MB** |
| Erros de página | todos | 0 | 0 | 0 |

**Leitura:**
- A queda de CPU do servidor nos modos Econômico e oculto vem da publicação no ritmo do cliente (2.2). O passo da simulação também ficou mais barato (2.1).
- A CPU do navegador no Econômico não muda da V04.1 para a V04.2 (10,6% × 10,3%): o ganho grande desse modo já tinha vindo na V04.1.
- O 3D no SwiftShader é igual nas três versões: a rasterização por software domina.
- **Tick máximo do servidor no Econômico da V04.2: 454 ms**, na geração de um hex novo. A causa é a mesma da V04.1 (2.5) e continua pendente.
- **Não executados na V04.2:** 8 h e 24 h. O teste longo do servidor registrado é o da V04.1: 420,06 min.

## 5. Portátil Windows v04.2

(Preenchido após o CI e a conferência do SHA-256.)

