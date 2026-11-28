# Benchmark V04 × V04.1

**Ambiente:**
- contêiner Linux com 4 núcleos e Chromium 158 headless;
- WebGL por **SwiftShader** (rasterização na CPU);
- servidor Rust em release na mesma máquina.

**Como ler a CPU:** porcentagem de **um** núcleo; 100% = um núcleo inteiro.

**Limite do ambiente:** no 3D, a CPU do navegador inclui a rasterização por software. Isso **não representa GPU real**. Nenhum FPS de Iris Xe foi medido aqui; para isso existe o gravador de quadros do F3 (ver `PENDENCIAS-V04.1.md`).

**Arquivos brutos:**
- V04: `game/build-real-v04/bench/`;
- V04.1: `game/build-real-v04-1/bench/v04-1/` (A/B em `ab/`).

## 1. Mesma cena, 60 s por modo (A/B/B/A)

**Configuração:** vila, perfil Baixo, servidores novos e idênticos (portas 8831/8832), ordem V04, V04.1, V04.1, V04.

| Modo | Métrica | V04 (2 execuções) | V04.1 (2 execuções) |
| --- | --- | --- | --- |
| 3D | CPU navegador | 356 / 365% | 364 / 365% |
| 3D | Quadros/s | 9,5 / 9,5 | 9,6 / 9,8 |
| 3D | 1% low | 5,7 / 6,5 fps | 6,7 / 6,8 fps |
| 3D | Quadros > 100 ms | 235 / 246 | 233 / 179 |
| 3D | Pior quadro | 217 / 167 ms | 167 / 167 ms |
| 3D | RSS navegador | 1.455 / 1.459 MB | 1.489 / 1.489 MB |
| 3D | Carregamento | 1,5 / 1,5 s | 1,9 / 1,9 s |
| Econômico | CPU navegador | 12,7 / 13,1% | 12,9 / 13,2% |
| Aba oculta | CPU navegador | 4,7 / 4,8% | 4,8 / 4,8% |

**Leitura:**
- Em 60 s as duas versões são equivalentes.
- O +0,4 s de carregamento e o +30 MB de RSS no 3D vêm da pré-compilação de shaders (64–71 programas antes do 1º quadro, contra 13).
- No SwiftShader, o tempo por quadro é dominado pela rasterização. Por isso a remoção de trabalho de CPU do JS quase não aparece aqui.

## 2. Testes longos do cliente (2 h, mesmo roteiro)

**Roteiro:** todos os Hunters exploram; amostra a cada 60 s; servidor dedicado por teste; o mesmo script nas duas versões (`tools/test/longa-duracao.mjs`).

### Econômico (120,03 min nas duas)

| Métrica | V04 | V04.1 |
| --- | --- | --- |
| CPU navegador, média | **26,1%** | **10,6%** |
| CPU por 10 min | 9,4 → 9,6 → 16 → 30,8 → 31 → 30,9 → 30,2 → 30,8 → 31,8 → 32,5 → 30 → 30,4 | 9,6 → 9,6 → 9,6 → 9,5 → 9,7 → 11,1 → 11,2 → 11,8 → 11,8 → 11,9 → 11,2 → 10,1 |
| CPU navegador, máx | — | 13,1% |
| RSS navegador, início → fim | 841 → 933 MB | 846 → 879 MB |
| Heap JS, início → fim | 4,9 → 5,2 MB | 5,3 → 5,7 MB |
| Quadros desenhados | 108.240 | 108.240 |
| Travamentos > 50 ms | 2 | 0 |
| Erros de página | 0 | 0 |

**Leitura:**
- Na V04, a CPU triplicava depois de ~25 min, quando o cache de regiões enchia: a região nova era descartada na hora e redesenhada sem parar.
- Na V04.1 (LRU corrigido) a CPU fica entre 9,5% e 11,9%. O aumento de 50 a 110 min acompanha a chegada de mais criaturas ao campo visual (o tráfego WS sobe de 9,5 para até 33 KB/s), e a CPU volta a 9,6% no fim.

### Aba oculta (120,03 min nas duas)

| Métrica | V04 | V04.1 |
| --- | --- | --- |
| CPU navegador, média | 0,16% | 0,17% |
| Quadros desenhados com a aba oculta | 0 | 0 |
| Heap JS, início → fim | 295 → **259 MB** | 296 → **11,5 MB** |
| RSS navegador, início → fim | 1.481 → 1.421 MB | 1.496 → 1.130 MB |
| Erros de página | 0 | 0 |

**Leitura:**
- Nas duas versões, os quadros e travamentos contados (27/28) são todos do período anterior a ocultar a aba: o contador não muda durante as 2 h.
- **Heap de ~300 MB depois do descarte do 3D:**
  - V04.1: lixo à espera de coleta, não referência retida. O heap cresce devagar (295 → 303 MB em 55 min, mensagens WS) e cai para 12 MB por volta de 60 min, quando o V8 faz a coleta maior. Fica em 11–12 MB até o fim.
  - V04: a coleta acontece, mas o heap só desce para ~255 MB. Essa é a cena retida pela depuração (MEM-01, Codex).
- A diferença no RSS (−291 MB no fim) é a mesma coisa vista pelo sistema.

### 3D (30 min, perfil Médio)

Executados em sequência (V04.1 das 20:12 às 20:42 UTC, V04 das 20:43 às 21:13 UTC), cada um com servidor novo.

| Métrica | V04 (30,06 min) | V04.1 (30,05 min) |
| --- | --- | --- |
| CPU navegador, média | 356% | 354% |
| Quadros em 30 min | 9.450 (5,2/s) | 9.180 (5,1/s) |
| Heap JS, início → fim | 295 → 308 MB | 298 → 296 MB |
| RSS navegador, início → fim | 1.593 → 1.647 MB | 1.640 → 1.692 MB |
| Tick máx. do servidor | 22,1 ms | 24,0 ms |
| Erros de página | 0 | 0 |

**Leitura:**
- No SwiftShader o perfil Médio fica em ~5 quadros/s. Todos os quadros passam de 50 ms nas duas versões, então a contagem de travamentos não diferencia nada aqui.
- A diferença de 3% nos quadros está dentro da variação do roteiro: os Hunters exploram caminhos aleatórios, e a cena muda. O A/B de 60 s na mesma cena deu a V04.1 ligeiramente à frente.
- As duas sobem ~53 MB de RSS em 30 min (cache de relevo e modelos enchendo).
- O heap da V04.1 não cresce; o da V04 sobe 13 MB.

## 3. Servidor

### Teste longo com 1 cliente WebSocket Econômico

**Atenção à comparação:**
- O soak da V04 não tinha cliente WS conectado (a opção `--cliente-ws` é nova na V04.1). Então a V04.1 faz **mais** trabalho nesse teste.
- O soak da V04 foi interrompido aos 376,32 min por um reinício do contêiner.

| Minuto | V04: CPU / tick p99 / tick máx / criaturas | V04.1: CPU / tick p99 / tick máx / criaturas |
| --- | --- | --- |
| 60 | 5,0% / 19,8 / 23,0 ms / 3.827 | 5,8% / 15,5 / 18,3 ms / 3.786 |
| 155 | 23,7% / 105,3 / 134,7 ms / 4.950 | 7,5% / 22,6 / 29,2 ms / 4.640 |

| 300 | 12,0% / 67,0 / 82,6 ms / 5.199 | 19,9% / 49,0 / 62,2 ms / 4.886 |
| 376 | 6,0% / 29,9 / 40,9 ms / 5.489 | 5,0% / 11,6 / 14,7 ms / 4.863 |
| 420 | — | 3,3% / 6,7 / 7,3 ms / 4.858 |

**Duração executada:**
- V04: 376,32 min (reinício do contêiner).
- V04.1: 420,06 min de 480 pedidos; parado a pedido do diretor para adiantar a entrega (`concluido: false`).

**Totais:**

| Métrica | V04 | V04.1 |
| --- | --- | --- |
| CPU média | 7,74% (376 min) | 6,45% (420 min) / 6,78% (até 376 min) |
| Tick máximo | 239 ms | 684 ms |
| Erros, descartes, reconexões | — | 0 / 0 / 0 |

O tick máximo da V04.1 é pior, mas:
- o teste dividiu a máquina com outras medições;
- os picos de geração existem igualmente nas duas versões (medido com `sim_check`). Ver `RELATORIO-OTIMIZACAO-V04.1.md` §3.1.

### Microbenchmarks (mesmo digesto de estado)

| Medida | V04 | V04.1 |
| --- | --- | --- |
| `exploracao-longa`, ms por passo | 2,95 | 2,56 |
| Filtro de relevância por envio (3.000 criaturas) | 3,24 ms | 0,88 ms |

## 4. Laboratório de correções (reprodução isolada)

| Correção | Antes | Depois |
| --- | --- | --- |
| MEM-01, heap após descarte do 3D + GC | 35,5 MB | 4,8 MB |
| MEM-01, backing storage | 216 MB | 4,1 MB |
| ACT-01, modelos órfãos | 1 | 0 |
| Capim, construção de 16 células | 165–176 ms num quadro | 2–8 ms |
| Lanternas acesas, programas compilados no jogo | 15 | 8 |
| Programas prontos antes do 1º quadro | 13 | 64–71 |
| Grades de altura | 13,3 MB; 97 ms / 120 mil consultas | 7,2 MB; 56 ms |
| Segundo plano manual | — | 8 de 8 etapas, 0 quadros |
