# Checklist persistente — Build Real V03 → V04

Retomada: leia este arquivo, `git log --oneline -20` na branch `claude/hopeful-noether-oehmyn` e o diretório `game/build-real-v03/bench/`. Cada item marcado tem evidência (commit, arquivo ou medição).

## V03 — otimização profunda (`game/build-real-v03/`)

- [x] V02 preservada na branch `preview/build-real-v02-windows-portable`; V03 é cópia independente.
- [x] Linha de base V02 medida: servidor (`bench/servidor-linha-base-v02.json`) e cliente por modo (`bench/v02-modo-*.json`).
- [x] Servidor: thread de simulação, snapshots imutáveis, fila de ordens, dívida de passos com teto, E/S de chunks em thread auxiliar, geração de criaturas em fila determinística, métricas de CPU/RAM/intervalo (commit `00d2982`).
- [x] Protocolo incremental (`wh_core::wire` + `client/src/wire.ts`), teste ao vivo sem divergência (`tools/test/wire-ao-vivo.mjs`).
- [x] Streaming por visibilidade por nó (`tools/visual/split-chunks.mjs`, `client/src/visual.ts`); 4.350 nós idênticos ao original.
- [x] Modo Econômico com regiões em cache, atlas, FPS limitado, sem 3D (`client/src/economic.ts`, `heights.ts`).
- [x] Segundo plano, laços exclusivos, UI incremental, F3 e relatório exportável.
- [x] Telas de carregamento originais via `/carregamento/` (iframe, progresso real).
- [x] Benchmarks V03 por modo e comparação V02×V03 (`bench/v0X-modo-*.json`, RELATORIO-V03 §6).
- [x] Captura visual V02×V03 com a mesma câmera (`evidencias/v03/comparar-v0X-*.png`).
- [x] Testes: `cargo test`, demo, wire ao vivo, alternância 3D↔Econômico (memória), sementes.
- [x] Testes longos: 3D 30 min, oculto 2 h, Econômico 2 h e Econômico 30 min refeito após as correções (`bench/longa-*.json`). 8 h e 24 h não rodaram (o contêiner reinicia).
- [x] Workflow `wildhaven-windows-portable-v03.yml`, ZIP publicado e SHA-256 conferido após download.
- [x] `RELATORIO-V03.md`.

## V04 — mundo completo (inicia automaticamente após a V03)

- [x] Branch própria para a V04 a partir da V03 (`feat/build-real-v04-mundo-completo`).
- [ ] Documentos: RELATORIO-V04, CHECKLIST-V04, PENDENCIAS-V04, INVENTARIO-CRIATURAS-V04 e AUDITORIA-CONTINENTE-V04 prontos na branch da V04; falta BENCHMARK-V03-V04.
- [x] Direção artística aprovada registrada (floresta V02: geometria original, árvores ~16–21 m, mais densidade; não aplicar a mesma altura a todos os biomas).

## Decisões do diretor registradas

- 2026-11-27: aprovada a aparência da floresta da V02 (geometria original preservada, árvores reduzidas para ~16–21 m, vegetação mais densa). Referência mínima de qualidade para a V04. A selva tropical pode ter árvores bem maiores, conforme a sua arte conceitual.
