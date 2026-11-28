# Benchmark V04 × V04.1 × V04.2

**Ambiente:**
- contêiner Linux, 4 núcleos, Chromium 158 headless, WebGL por **SwiftShader** (rasterização na CPU);
- servidor Rust em release na mesma máquina.

**Como ler a CPU:** porcentagem de **um** núcleo; 100% = um núcleo inteiro.

**Limite do ambiente:** nenhum FPS de GPU física foi medido. No 3D, a CPU inclui a rasterização por software. Para a Iris Xe: F3 → Gravar quadros (ver `PENDENCIAS-V04.2.md`).

**Arquivos brutos:**
- V04 × V04.1: `game/build-real-v04-1/bench/v04-1/`;
- V04.2: `game/build-real-v04-2/bench/v04-2/`, em especial `final/`.

## 1. Mesma cena, 60 s por modo (vila, perfil Baixo)

**Método:**
- Servidor novo a cada execução.
- V04 × V04.1 na ordem A/B/B/A (27/11, `bench/v04-1/ab/`).
- V04.1 × V04.2 na ordem A/B/B/A (28/11, `final/ab/`).
- As duas sessões não se misturam na tabela: cada comparação é dentro da própria sessão.

### V04.1 × V04.2 (28/11)

| Modo | Métrica | V04.1 (2 execuções) | V04.2 (2 execuções) |
| --- | --- | --- | --- |
| 3D | CPU navegador | 359 / 366% | 366 / 364% |
| 3D | Quadros/s | 10,27 / 10,41 | **10,61 / 10,41** |
| 3D | 1% low | 6,54 / 6,92 fps | 6,92 / 6,79 fps |
| 3D | Quadros > 100 ms | 148 / 99 | **90 / 106** |
| 3D | Pior quadro | 167 / 183 ms | **150 / 167 ms** |
| 3D | p99 | 150 / 133 ms | 133 / 133 ms |
| 3D | Heap JS | 264 / 265 MB | 260 / 259 MB |
| 3D | RSS navegador | 1.489 / 1.495 MB | 1.473 / 1.475 MB |
| 3D | CPU servidor | 1,88 / 1,88% | 1,78 / 1,80% |
| Econômico | CPU navegador | 12,4 / 11,9% | **11,6 / 11,6%** |
| Econômico | CPU servidor | 1,97 / 1,97% | **1,62 / 1,62%** |
| Econômico | 1% low | 49,7 / 50,9 fps | 50,9 / 50,9 fps |
| Aba oculta | CPU navegador | 4,2 / 4,4% | 4,1 / 4,3% |
| Aba oculta | CPU servidor | 1,80 / 1,85% | **1,30 / 1,35%** |
| Todos | Tráfego WS | 7,8 / 4,8 / 1,7 KB/s | 7,8 / 4,8 / 1,7 KB/s (igual) |
| Todos | Carregamento | 1,69–1,75 s | 1,73–1,98 s |

### V04 × V04.1 (27/11)

| Modo | Métrica | V04 | V04.1 |
| --- | --- | --- | --- |
| 3D | CPU navegador | 356 / 365% | 364 / 365% |
| 3D | Quadros/s | 9,5 / 9,5 | 9,6 / 9,8 |
| 3D | 1% low | 5,7 / 6,5 fps | 6,7 / 6,8 fps |
| 3D | Quadros > 100 ms | 235 / 246 | 233 / 179 |
| Econômico | CPU navegador | 12,7 / 13,1% | 12,9 / 13,2% |
| Aba oculta | CPU navegador | 4,7 / 4,8% | 4,8 / 4,8% |

**Leitura:**
- Em 60 s, o cliente das três versões é praticamente igual no SwiftShader.
- A V04.2 tem ligeira vantagem no 3D: menos quadros > 100 ms e pior quadro menor nas duas execuções.
- O servidor da V04.2 gasta menos: −18% no Econômico, −27% na aba oculta, com os mesmos bytes entregues.

## 2. Testes longos (mesmo roteiro e script; Hunters explorando)

| Teste | Métrica | V04 | V04.1 | V04.2 |
| --- | --- | --- | --- | --- |
| Econômico 120 min | CPU navegador (média) | 26,1% | 10,6% | **10,3%** |
| | CPU servidor (média) | 5,24% | 4,85% | **3,46%** |
| | Tick máximo do servidor | 89,5 ms | 104 ms | 454 ms (geração de hex; ver §4) |
| | RSS navegador início → fim | 841 → 933 MB | 846 → 879 MB | 844 → 877 MB |
| Aba oculta 120 min | CPU navegador | 0,16% | 0,17% | **0,17%** |
| | CPU servidor | 4,37% | 4,53% | **1,45%** |
| | Heap no fim | 259 MB | 11,5 MB | **11,8 MB** |
| | RSS navegador no fim | 1.421 MB | 1.130 MB | **1.134 MB** |
| 3D Médio 30 min | CPU navegador | 356% | 354% | 358% |
| | Quadros em 30 min | 9.450 | 9.180 | 9.210 |
| | Heap início → fim | 295 → 308 MB | 298 → 296 MB | 293 → 289 MB |
| Servidor com 1 cliente WS | Duração executada | 376,32 min (reinício do contêiner) | 420,06 min (parado a pedido) | não executado |
| | CPU média | 7,74% | 6,45% | — |

Erros de página: 0 em todos.

## 3. Servidor isolado (mesmo estado: digesto `ca74bf9f89216c13`)

| Medida | V04 | V04.1 | V04.2 |
| --- | --- | --- | --- |
| Exploração longa, ms por passo | 2,95 | 2,56 | **2,20** |
| 5.000 criaturas espalhadas | — | 2,29 ms | **1,59 ms** |
| 10.000 criaturas espalhadas | — | 4,56 ms | **2,79 ms** |
| 20.000 criaturas espalhadas | — | 10,22 ms | **6,79 ms** |
| 20.000 criaturas na vila | — | 3,12 ms | **2,10 ms** |
| Publicação: 1 cliente Econômico | — | 9,5 ms/s | **5,4 ms/s** |
| Publicação: 1 cliente em segundo plano | — | 7,8 ms/s | **3,9 ms/s** |
| Publicação: 1 cliente 3D | — | 10,6 ms/s | **7,0 ms/s** |
| RSS com o cache padrão | — | 321 MB (256) | **190 MB (128)** |

## 4. Picos e compilação

| Medida | V04.1 | V04.2 |
| --- | --- | --- |
| Lanternas (noite forçada, 5 trocas de zoom, 2 execuções): programas compilados no jogo | 1 / 1 | 1 / 1 |
| Programas prontos antes das trocas | 77 | 81 |
| Picos > 2,5× a mediana (zoom, troca de Hunter, viagem; 40 s cada) | 0 | 0 |
| Passos de geração > 100 ms no `sim_check` (60.000 passos) | 27 | 27 (mesma causa; correção desfeita, pendente) |

## 5. Memória do cliente (vila, Médio)

| Medida | V04.1 | V04.2 |
| --- | --- | --- |
| Lixo alocado (A/B/B/A, 40 s) | 1,45 / 1,66 MB/s | **1,40 / 1,32 MB/s** |
| Heap V8 vivo após GC | 41,4 MB | 41,7 MB |
| Vértices na RAM da CPU | 67,5 MB | **62,6 MB** |

## 6. Capturas na mesma cena

Arquivos em `bench/v04-2/final/capturas/` (mosaico: `mosaico-v04-v041-v042.png`):
- vila, zoom 65 m e zoom 700 m;
- servidor novo, 45 s de assentamento, 06:04–06:06 no relógio do jogo.

**Diferença de pixels V04.1 × V04.2:**

| Cena | Pixels com diferença > 8 |
| --- | --- |
| vila | 0,03% |
| perto | 0,04% |
| longe | 0,03% |

As diferenças vêm dos Hunters em movimento. A V04 não tem o botão de segundo plano no relógio (BG-01, V04.1).
