# Relatório de otimização — Build Real V04.1

**O que é:** a V04 com a auditoria do Codex integrada e uma rodada própria de correções de desempenho.

**Mesmo conteúdo da V04:** mesmos 272 hexes, vegetação, sombras, clima, criaturas, regras de IA, interface e telas de carregamento. Nada foi simplificado.

**Onde está:**
- código: `game/build-real-v04-1/`;
- branch: `feat/build-real-v04-1-extreme-performance`;
- checklist com arquivo, causa, evidência e commit de cada problema: `CHECKLIST-V04.1.md`;
- integração do Codex: `AUDITORIA-CODEX-INTEGRACAO.md`;
- pendências: `PENDENCIAS-V04.1.md`;
- números: `BENCHMARK-V04-V04.1.md`.

**Ambiente de medição:**
- contêiner Linux com 4 núcleos e Chromium 158 headless;
- WebGL por **SwiftShader**, que rasteriza na CPU e chega a ~10 quadros/s na vila;
- **nenhum FPS de GPU física foi medido aqui.** Para a Iris Xe do diretor a V04.1 traz o gravador de quadros no F3.

## 1. O que mudou e por quê

### Travamentos (picos de quadro)

| Problema | Evidência | Correção | Resultado medido |
| --- | --- | --- | --- |
| Nenhum shader pré-compilado: os primeiros quadros do jogo compilavam tudo. | Codex: intervalos de 263–481 ms nos primeiros 2 s. | Pré-compilação atrás da tela de carregamento: cena inteira, inclusive LODs ocultos, modelos e 0/1/6/7 luzes locais. | 13 → 64–71 programas prontos antes do 1º quadro (+0,4 s de carregamento). |
| Acender as lanternas da vila ou montar acampamento mudava o número de luzes, e todos os materiais recompilavam. | Noite forçada: 21 → 36 programas de uma vez; 12 quadros em 10,4 s. | Portão de luzes locais: compila a contagem nova em paralelo e segura a antiga com luzes-fantasma de intensidade 0. Mesmo visual. | 15 → 8 programas compilados no jogo. Com `KHR_parallel_shader_compile` (Chrome/Windows), a compilação sai do quadro. |
| Capim: 26 raios por célula contra a malha inteira (~6.300 triângulos) sem estrutura de aceleração. | 16 células = 165–176 ms num único quadro. | BVH (three-mesh-bvh 0.9.17, MIT). | 2–8 ms; 1.358 de 1.358 pontos idênticos ao da V04. |
| Modelos de criatura carregados no meio do jogo compilavam no 1º desenho. | — | `compileAsync` antes do primeiro clone. | — |

### Desperdício contínuo

| Problema | Correção | Resultado medido |
| --- | --- | --- |
| Econômico: com o cache cheio, a região nova era descartada na hora e o relevo era redesenhado sem parar. | Corrigido o LRU. | CPU no teste de 2 h da V04: 9% → 30% ao encher o cache. Na V04.1: ver seção 3. |
| A cena 3D descartada continuava acessível pela depuração (Codex). | Getter da cena corrente. | heap 35,5 → 4,8 MB; backing storage 216 → 4 MB após GC. |
| Criatura removida durante carregamento ganhava modelo órfão (Codex). | Cancelamento antes de clonar. | 1 → 0 órfãos. |
| Relevo nunca pulava a atualização com a câmera parada: a oclusão expirava a cada 600 ms. | A oclusão só expira se a câmera mudou; caixas sem alocação; descarte 1×/s. | — |
| Vegetação: LOD0 e LOD1 compartilhavam material com `receiveShadow` diferente, e o programa trocava a cada desenho. | Material próprio do LOD1 (mesmo shader). | — |
| 605 de 728 objetos recalculavam a matriz a cada quadro. | Matrizes estáticas na vegetação, capim e vila. | — |
| Todos os LODs das espécies das 64 primeiras criaturas eram carregados. | Só o LOD em uso, mais pré-carga preditiva. | — |
| Grades de altura nunca liberadas, e a consulta varria todas. | LRU de 16 MB com pinos; consulta pelo hex e vizinhos. | 13,3 → 7,2 MB; 97 → 56 ms por 120 mil consultas. |
| Janela visível sem foco desenhava a 60 Hz. | Limite opcional (Sistema, padrão 30). | Volta ao normal ao receber foco. |
| Segundo plano manual (Codex). | Botão, aviso e atalho válido desde o carregamento. | 8 de 8 etapas do teste, inclusive 8,3 h de jogo ausente sem nenhum quadro. |

### Servidor

| Problema | Correção | Resultado medido |
| --- | --- | --- |
| Todas as criaturas já geradas entravam nas visões e na grade a cada passo, inclusive as congeladas longe de todos. | Halo de percepção. | 2,95 → 2,56 ms por passo; digesto do estado idêntico. |
| O estado inteiro era copiado por cliente antes do filtro de relevância. | Cópia só do que vai ao cliente. | 3,24 → 0,88 ms por envio (3.000 criaturas), valor idêntico. |
| Custo de publicação e mensagens fora das métricas. | `server.custo_ms_por_s`. | — |
| O soak não declarava a duração executada. | `minutosExecutados` e `concluido`. | — |

## 2. O que não foi feito (e por quê)

- **Render sob demanda com a janela em foco.** Na vila, água, vento, ciclo de luz, partículas e poses mudam a imagem a cada quadro. Congelar alteraria a apresentação.
- **Mudanças nas sombras.** Só 2 a 18 instâncias de vegetação entram no passe de sombra, todas dentro do mapa. Não há o que cortar sem mudar o visual. Os experimentos de cache estático/dinâmico ficam para a V04.2.
- **WebGPU, WASM e Workers.** Não houve medição que justificasse. Ficam como laboratórios na V04.2.

## 3. Testes

**Benchmark A/B/B/A V04 × V04.1, mesma cena (vila, Baixo, 60 s por modo):** praticamente iguais em CPU, quadros e rede.

| Modo | V04 | V04.1 | Observação |
| --- | --- | --- | --- |
| 3D | 356–365% | 364–365% | Quadros/s 9,5 → 10,0 |
| Econômico | 12,7–13,1% | 12,9–13,2% | — |
| Aba oculta | 4,7–4,8% | 4,8% | 0 quadros nas duas |

Era esperado: os ganhos da V04.1 aparecem em situações que o teste curto não cobre:
- sessões longas;
- picos;
- memória após o descarte do 3D;
- servidor com milhares de criaturas.

Os testes longos (seção 3.1) cobrem essas situações.

### 3.1 Testes longos

Mesmo roteiro e mesmo script nas duas versões: todos os Hunters explorando, amostra a cada 60 s, servidor dedicado. Detalhes em `BENCHMARK-V04-V04.1.md`.

| Teste | Duração executada | V04 | V04.1 |
| --- | --- | --- | --- |
| Econômico | 120,03 min nas duas | CPU média 26,1%; sobe de 9% para 31% depois de ~25 min | CPU média **10,6%**, máx 13,1%; 0 travamentos; 0 erros |
| Aba oculta | 120,03 min nas duas | CPU 0,16%; heap 295 → **259 MB** | CPU 0,17%; heap 296 → **11,5 MB**; RSS −291 MB no fim; 0 quadros com a aba oculta |
| 3D, Médio | 30,06 / 30,05 min | CPU 356%; 9.450 quadros; heap 295 → 308 MB | CPU 354%; 9.180 quadros; heap 298 → 296 MB; 0 erros |
| Servidor com 1 cliente WS | V04: 376,32 min (reinício do contêiner); V04.1: **420,06 min** de 480 pedidos (parado a pedido do diretor; `concluido: false`) | CPU média 7,74%; tick máx 239 ms | CPU média 6,45% (6,78% até 376 min); 0 erros; 0 descartes; 0 reconexões; tick máx **684 ms** |

**Picos de tick do servidor no teste longo da V04.1** (> 100 ms em 10 amostras):
- Aos 34, 84 e 262 min coincidem com geração de criaturas em hex novo: leitura síncrona de chunks físicos, causa identificada e corrigida só na V04.2.
- Aos 289–301 min coincidem com outro teste meu que lia física do disco ao mesmo tempo (cache de 16 MB).
- Aos 315–339 min (pior: 684 ms) não há causa confirmada. O teste dividiu a máquina com outras medições a noite toda.
- A comparação justa de picos entre versões está no teste dedicado de geração com tempo ×10 (relatório da V04.2).

**Heap de ~300 MB na aba oculta (pendência da auditoria):**
- Na V04.1, é lixo à espera de coleta: cai para 12 MB por volta de 60 min, quando o V8 faz a coleta maior, e fica assim até o fim.
- Na V04 desce só para ~255 MB: é a cena retida pela depuração (MEM-01).
