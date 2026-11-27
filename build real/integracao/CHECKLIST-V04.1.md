# Checklist V04.1 — otimização extrema e integração da auditoria do Codex

**Onde está:**
- código: `game/build-real-v04-1/`;
- branch: `feat/build-real-v04-1-extreme-performance`;
- base: V04 `a2b11e7`, que fica intacta em `game/build-real-v04/` e na branch `feat/build-real-v04-mundo-completo`.

**Como retomar após um reinício:** leia esta lista, depois `git log origin/feat/build-real-v04-1-extreme-performance`. Processos em segundo plano não sobrevivem a reinícios do contêiner; confira com `pgrep -f wh-server`. Teste longo do servidor em andamento: veja a seção "Testes".

**Regras do diretor (não negociáveis):**
- **Não reduzir:** densidade de vegetação, polígonos, texturas, população de criaturas.
- **Não remover nem alterar:** sombras, clima, animações, regras de IA.
- **Preservar:** interface, telas de carregamento do Codex.
- **Não usar fal.**

**Prioridades:**
- **P0:** travamento crítico ou vazamento grave.
- **P1:** grande desperdício de recursos.
- **P2:** otimização importante.
- **P3:** melhoria complementar.

## Etapas

- [x] V04.1 independente, com caminhos próprios e workflow do ZIP v04.1 (reaproveita a release `build-real-v04-hexes`).
- [x] Integrar MEM-01, GP-01, BG-01 e ACT-01, cada um num commit próprio com autoria do Codex.
- [x] Performance Lab e evidências brutas do Codex (`bench/codex-auditoria`).
- [x] Validar as quatro correções no Linux (A/B em ordem alternada):
  - descarte;
  - cancelamento;
  - gpu-timer;
  - fundo manual.
- [x] BG-01: botão no relógio e em Sistema, aviso de retomada, atalho válido durante o carregamento. Teste `tools/test/fundo-manual.mjs`:
  - suspensão no carregamento;
  - botão;
  - troca de região com descarte;
  - eventos;
  - reconexão;
  - ausência de 8,3 h de jogo.
- [ ] ACT-01: teste dedicado de troca de LOD durante travessia de região.
- [x] Picos: causas medidas (shaders no jogo, capim, luzes locais). Correções feitas, gravador de quadros no F3.
- [ ] Picos: medir no Windows/Iris Xe (só o diretor tem a GPU; o gravador do F3 exporta).
- [x] VIS-01: LOD só sob demanda, pré-carga preditiva, shaders de modelo novo compilados antes do clone.
- [x] RAM-02: LRU por bytes com pinos; consulta pelo hex e vizinhos.
- [x] MET-01: contador de quadros ao vivo; gravador mede no fim do quadro; heap × buffers documentado.
- [x] MET-02: custo por fase do servidor (passos, visão publicada, mensagens por cliente).
- [x] MET-03: soak com duração executada e status de conclusão.
- [x] ECO-01: criaturas fora do alcance de qualquer criatura ativa saem das visões e da grade (digesto idêntico).
- [x] Vegetação: material próprio do LOD1 (sem troca de programa por desenho); matrizes estáticas.
- [x] Relevo: oclusão não expira com a câmera parada; caixas sem alocação; descarte 1×/s.
- [x] Janela fora de foco: limite opcional de quadros (padrão 30).
- [ ] Sombras: só medição e decisão documentada.
- [ ] Econômico: varredura de repinturas na V04.1.
- [ ] Benchmarks V04 × V04.1 intercalados (A/B/B/A).
- [ ] Capturas comparativas.
- [ ] Testes longos do cliente: 3D 30 min, Econômico 2 h, oculto 2 h.
- [ ] ZIP v04.1 validado no CI e SHA-256 conferido após download.
- [ ] Documentos:
  - RELATORIO-OTIMIZACAO-V04.1;
  - AUDITORIA-CODEX-INTEGRACAO;
  - BENCHMARK-V04-V04.1;
  - PENDENCIAS-V04.1.

## Problemas

Colunas: ID · arquivo · grau · causa · evidência · solução · antes → depois · risco · status.

| ID | Onde | Grau | Causa | Evidência | Solução | Antes → depois | Risco | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ECO-LRU | `client/src/economic.ts` | P1 | Região nova criada com `used: 0`; o LRU a descartava na hora, e cada consulta a recriava. | `bench/v04-base/eco-metricas-v04-lru-bug.json`: 252 → 12.358 renderizações em 2 min. CPU 9% → 30% em 2 h. | `used = frameNo` na criação. | ~166 → 4–11 regiões/s (0 parado) | Baixo | feito `bc1c7d2` |
| MEM-01 | `client/src/main.ts` | P1 | A variável global de depuração retinha a cena descartada. | Lab descarte A/B/B/A. | Getter da cena corrente (Codex). | heap 35,5 → 4,8 MB; backing 216 → 4,1 MB | Baixo | feito `553ec97` |
| ACT-01 | `client/src/actors.ts` | P1 | Clone anexado depois que a criatura saiu. | Lab cancelamento. | Marca `released` (Codex). | 1 → 0 órfãos | Médio | feito `78a7f03` (falta teste de LOD em travessia) |
| GP-01 | `client/src/perf.ts` | P2 | `endGpu` sem `begin` pareado. | `tools/test/gpu-timer.mjs` | Pareamento por quadro (Codex). | 5/5/5 | Baixo | feito `76c5bba` |
| BG-01 | `client/src/main.ts` | P2 | Janela visível e ociosa desenhava; atalho ignorado durante o carregamento. | `bench/v04-1/fundo-manual.json` | Shift+F8 (Codex), botão, registro no início. | 0 quadros; 7/7 etapas ok | Médio | feito `a772450` |
| LUZ-01 | `client/src/village.ts`, `actors.ts` | P0 | O número de luzes pontuais visíveis mudava (lanternas/fogueiras) e recompilava todos os materiais. | Noite forçada: 21 → 36 programas; 12 quadros em 10,4 s. | Portão `LocalLightGate` (compila em paralelo, segura a contagem com fantasmas) e pré-compilação 0/1/6/7 luzes. | 15 → 8 programas no jogo; 70 pré-compilados | Médio | feito `55100e4` |
| SHD-01 | `client/src/scene3d.ts` | P0 | Nenhum shader pré-compilado: os primeiros quadros compilavam tudo. | Codex: picos de 263–481 ms nos primeiros 2 s. | Pré-compilação na tela de carregamento (cena inteira, LODs ocultos, modelos). | 13 → 64–71 programas prontos antes do 1º quadro | Baixo | feito `55100e4` |
| CAP-01 | `client/src/grass.ts` | P0 | 26 raios por célula contra ~6.300 triângulos sem BVH. | 16 células = 165–176 ms num quadro. | three-mesh-bvh 0.9.17 (MIT), `firstHitOnly`. | 2–8 ms; 1.358/1.358 pontos idênticos | Baixo | feito `2a4eceb` |
| REL-01 | `client/src/visual.ts` | P2 | Oclusão expirava com a câmera parada; `wb.clone()` por folha; `evict` por quadro. | Perfil de alocação. | Geração da câmera, caixa fixa por folha, descarte 1×/s. | Relevo pula atualização parado | Baixo | feito `5392caa` |
| VEG-01 | `client/src/vegetation.ts` | P2 | Material único entre LOD0 e LOD1 com `receiveShadow` diferente: troca de programa por desenho. | Perfil de CPU. | Material próprio do LOD1 (mesmo shader). | — | Baixo | feito `50dfc3b` |
| MAT-01 | vegetação, capim, vila | P3 | 605 de 728 objetos recalculavam a matriz por quadro. | Contagem na cena. | `matrixAutoUpdate` desligado nos estáticos. | — | Baixo | feito `50dfc3b` |
| VIS-01 | `client/src/actors.ts`, `scene3d.ts` | P1 | Todos os LODs das espécies das 64 primeiras criaturas carregados no início. | Codex. | Só o LOD em uso; pré-carga preditiva; `compileAsync` antes do clone. | — (medição de campo pendente) | Médio | feito `7fb2a45` |
| RAM-02 | `client/src/heights.ts` | P2 | Grades nunca liberadas; `last` retido; consulta varria todas as grades. | Lab: 80 grades. | LRU 16 MB com pinos; hex + vizinhos. | 13,3 → 7,2 MB; 97 → 56 ms / 120 mil consultas | Médio | feito `4af8eb4` |
| ECO-01 | `server/crates/wh-core/src/game.rs` | P1 | Todas as criaturas entravam nas visões e na grade a cada tick. | Digesto do estado. | Filtro por halo `longe_m + 543 m`. | 2,95 → 2,56 ms/passo; digesto idêntico | Baixo | feito `65954b6` |
| MET-02 | `server/crates/wh-server/src/main.rs` | P2 | O estado inteiro era copiado por cliente antes de filtrar; o custo não era medido. | Teste `relevant_igual`. | Cópia só do que vai ao cliente; `custo_ms_por_s`. | 3,24 → 0,88 ms por envio (3.000 criaturas) | Baixo | feito `d119f4e` |
| MET-03 | `tools/test/soak-servidor.mjs` | P3 | O arquivo "8h" tinha 192 min. | Codex. | `minutosExecutados`, `concluido`. | — | Baixo | feito `d119f4e` |
| FOCO-01 | `client/src/scene3d.ts` | P2 | Janela sem foco desenhava a 60 Hz. | — | Limite opcional (padrão 30). | 14,6 → 5 (teste) | Baixo | feito `b637ddb` |

## Testes

- **Servidor V04.1, 8 h:**
  - iniciado em 27/11 às 17:36 UTC, porta 8820, com cliente WebSocket Econômico;
  - arquivo `bench/v04-1/soak-servidor-480min.json` (o JSON diz quanto realmente rodou).
- **Base V04:** `bench/v04-base/`:
  - Econômico 2 h: 26,9% de CPU média, por causa do bug ECO-LRU;
  - oculto 2 h: 0,15%;
  - soak: 376 de 480 min, interrompido por reinício do contêiner.
