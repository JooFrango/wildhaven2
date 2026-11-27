# Checklist persistente — Build Real V04 (mundo completo)

**Retomada:** o código está em `game/build-real-v04/` na branch `feat/build-real-v04-mundo-completo` (base V03). Comece por `git log origin/feat/build-real-v04-mundo-completo`.

**Dados gerados localmente:**
- `.generated/physics-272-v04`: 229 hexes por link, mais os 43 costeiros recompilados;
- `.generated/visual-272`: os 272 hexes; `.generated/visual-v04` é um link para ele.

Para regenerar, rode os passos do workflow `wildhaven-windows-portable-v04.yml`.

## Feito (com evidência)

- [x] Branch independente da V04 a partir da V03 (checkpoints por índice temporário, sem trocar a árvore da V03).
- [x] Inventário: 56 espécies, 47 com GLB animado, 34 integradas e 22 pendentes com motivo. Arquivo: `INVENTARIO-CRIATURAS-V04.md`.
- [x] Biomas: 33 rótulos do manifesto mapeados para 13 classes (`data/biomas-v04.json`). A savana tem menos água que a planície.
- [x] Dados de jogo V04: as 8 espécies da V02 preservadas e mais 26 (`tools/gerar-gameplay-v04.mjs`).
- [x] Visual dos 272 hexes, com chunks, LOD e vegetação instanciada (pipeline V02/V03).
- [x] Física: 272 hexes compilados, **266 certificados**, 705 arestas validadas (`data/relatorio-continental-272-v04.json`).
- [x] Locomoção por voo e subsolo portada do laboratório (`meio.rs`), com testes automatizados.
- [x] Percepção por vibração das espécies de subsolo. Criaturas submersas só são vistas de perto e não deixam pegadas.
- [x] Distribuição ecológica:
  - por bioma de origem;
  - territórios de predadores;
  - presas perto de água;
  - subsolo só em areia (censo em `bench/continente-*.json`).
- [x] Viagens longas sem teleporte:
  - grupo HV_01 → X3 (deserto, 6 hexes);
  - grupo HV_01 → costa_+03_-04 (praia, 8 hexes).
- [x] Ordem retomada após ataque; viagem em grupo; estimativa de rota; cancelamento; hexes descobertos; rotas no mapa.
- [x] Filtro de relevância do WebSocket pelo Hunter seguido.
- [x] Distribuição modular:
  - pacotes por hex baixados sob demanda;
  - SHA-256 conferido;
  - viagem parte quando a rota chega;
  - `Baixar-Continente-Completo.bat`;
  - teste local de ponta a ponta.
- [x] Auditoria do continente: `AUDITORIA-CONTINENTE-V04.md`.
- [x] Pendências documentadas: `PENDENCIAS-V04.md`.
- [x] Aprovação artística da floresta da V02 registrada na memória do Claude Code e em `CHECKLIST-V03-V04.md`.

## Em andamento ou a fazer

- [ ] CI V04 (workflow do continente completo) verde, com ZIP base e release `build-real-v04-hexes` publicados e SHA-256 conferido após download.
- [ ] Cliente no navegador com o continente:
  - capturas reais por bioma;
  - troca entre Hunters distantes;
  - Bestiário com as espécies novas;
  - mapa com rotas.
- [ ] Benchmark V03 × V04 na mesma cena (`BENCHMARK-V03-V04.md`).
- [ ] Testes longos da V04 (Econômico, oculto, 3D), mais 8 h e 24 h se a infraestrutura permitir.
- [ ] Caçada fora da floresta temperada (savana ou deserto) na simulação.
- [ ] `RELATORIO-V04.md`.
