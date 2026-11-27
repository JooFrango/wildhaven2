# Checklist V04.1 — otimização extrema e integração da auditoria do Codex

**Onde está:**
- código: `game/build-real-v04-1/`;
- branch: `feat/build-real-v04-1-extreme-performance`;
- base: V04 `a2b11e7`, que fica intacta em `game/build-real-v04/` e na branch `feat/build-real-v04-mundo-completo`.

**Como retomar após um reinício:** leia esta lista, depois `git log origin/feat/build-real-v04-1-extreme-performance`. Processos em segundo plano não sobrevivem a reinícios do contêiner; confira com `pgrep -f wh-server`.

**Regras do diretor (não negociáveis):**
- **Não reduzir:** densidade de vegetação, polígonos, texturas, população de criaturas.
- **Não remover nem alterar:** sombras, clima, animações, regras de IA.
- **Preservar:** interface, telas de carregamento do Codex, aparência aprovada da V02/V04.
- **Não usar fal.**

**Prioridades:**
- **P0:** travamento crítico ou vazamento grave.
- **P1:** grande desperdício de recursos.
- **P2:** otimização importante.
- **P3:** melhoria complementar.

## Etapas

- [x] Criar a V04.1 independente, com caminhos próprios e workflow do ZIP v04.1.
- [x] Integrar MEM-01 (`9383696`), GP-01 (`b0ce0a5`), BG-01 (`ad94066`) e ACT-01 (`cf7425f`), cada um num commit próprio com autoria do Codex.
- [x] Trazer o Performance Lab e as evidências brutas do Codex (`bench/codex-auditoria`).
- [ ] Validar as quatro correções no Linux com o laboratório:
  - descarte;
  - cancelamento;
  - gpu-timer;
  - fundo manual.
- [ ] BG-01: botão na interface e testes:
  - suspensão e retomada;
  - reconexão;
  - eventos;
  - carregamento em andamento;
  - região trocada;
  - retorno após horas.
- [ ] ACT-01: teste de troca de LOD durante travessia de região.
- [ ] Travamentos acima de 100 ms: traces dos picos, categoria de cada um, orçamento de trabalho por quadro.
- [ ] VIS-01: LODs sob demanda e criaturas avaliadas antes de instanciar.
- [ ] RAM-02: LRU por bytes nas grades de altura.
- [ ] MET-01: intervalos medidos no fim do apresentador.
- [ ] MET-02: tempo completo do servidor (serialização, diff por cliente, persistência).
- [ ] MET-03: soak que registra a duração realmente executada.
- [ ] ECO-01: criaturas congeladas fora do índice ativo, preservando IDs, RNG e estado.
- [ ] Sombras: custo medido e otimização sem perda visual.
- [ ] Vegetação: atualizações redundantes de instâncias.
- [ ] Render sob demanda com a cena estática (sem congelar animações visíveis).
- [ ] Econômico: novas fontes de repintura, como a do box-shadow já corrigida.
- [ ] Protocolo: dados por Hunter selecionado e custo de parsing.
- [ ] Benchmarks V04 × V04.1 intercalados (A/B/B/A), mesma câmera e configuração.
- [ ] Capturas comparativas automatizadas.
- [ ] Testes longos: 30 min, 2 h e 8 h.
- [ ] ZIP v04.1 validado no Windows (CI) e SHA-256 conferido após download.
- [ ] Documentos:
  - RELATORIO-OTIMIZACAO-V04.1;
  - AUDITORIA-CODEX-INTEGRACAO;
  - BENCHMARK-V04-V04.1;
  - PENDENCIAS-V04.1.

## Problemas

Colunas: ID · arquivo:linha · grau · causa · evidência · solução · antes → depois · risco · status.

| ID | Onde | Grau | Causa | Evidência | Solução | Antes → depois | Risco | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ECO-LRU | `client/src/economic.ts:189` | P1 | Região nova criada com `used: 0`; ao passar de 140 regiões, o LRU a descartava na hora e cada consulta a recriava. | `bench/v04-base/eco-metricas-v04-lru-bug.json`: renderizações 252 → 12.358 em 2 min. CPU no teste de 2 h: 9% → 30%. | `used = frameNo` na criação. | Com cache cheio e viagem ×50: ~166 → 4–11 regiões/s, e 0 parado. | Baixo | corrigido (`bc1c7d2`); falta teste longo |
| MEM-01 | `client/src/main.ts:120` | P1 | `window.__wildhavenScene` guardava a cena após o descarte. | Codex: backing storage 213,6 → 2,9 MiB após GC. | Getter da cena corrente. | — | Baixo | integrado; validar no Linux |
| ACT-01 | `client/src/actors.ts:146,281,309` | P1 | Clone anexado depois que a criatura já tinha saído. | Codex: 1 → 0 órfãos. | Marca `released` no ator e na substituição. | — | Médio (troca de LOD) | integrado; falta teste de LOD |
| GP-01 | `client/src/perf.ts:43` | P2 | `endGpu` sem `beginGpu` pareado. | `tools/test/gpu-timer.mjs` | Pareamento por quadro e liberação no detach. | — | Baixo | integrado |
| BG-01 | `client/src/main.ts:255–285` | P2 | Janela visível e ociosa continuava desenhando. | Codex: 0 quadros, 0,42% da máquina. | Shift+F8 com a mesma suspensão da aba oculta. | — | Médio | integrado; falta botão e testes |
