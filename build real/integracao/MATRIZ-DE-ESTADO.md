# Matriz de estado — sistemas e assets (Build Real v01, 26/11/2026)

Branch `feat/build-real-jogavel-v01` a partir de `main@0a7aab5`. As colunas são **independentes**:
publicar não é aprovar; compilar não é certificar; certificar tecnicamente não é aprovar arte nem gameplay.

Legenda: ✅ sim (com evidência) · ⚠️ parcial (ver nota) · ❌ não · — não se aplica.

| Sistema / asset | Planejado | Protótipo | Implementado isolado | Aprovado artisticamente | Publicado (Git) | Integrado na build-real-v01 | Validado em runtime | Evidência / nota |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 272 GLBs de terreno (v12 170 + vila 1 + sul 24 + costa 77) | ✅ | — | — | ⚠️ manifesto: `pending-review` (v12) / `unverified-in-this-build` (demais) | ✅ `main@0a7aab5` `assets/world/continental-272/` | ⚠️ 223 certificados entram no runtime | ⚠️ HV_01 e ER_18 percorridos | fetch 272/272 bytes+SHA; `relatorio-continental-272.json` |
| Compilador WHP1 (Node) | ✅ | — | ✅ | — | ✅ | ✅ (gera os pacotes que o servidor lê) | ✅ 272/272 compilados | 17/17 testes `node --test` |
| Classificação de nós v01 | — | — | ✅ | — | ✅ | ✅ | ✅ | **proposta**, revisão do diretor pendente |
| Pacotes físicos WHP1 (272) | ✅ | — | ✅ | — | ❌ 3,44 GB, não versionados (hashes sim) | ✅ | ✅ | `pacotes-fisicos-272.manifest.json` |
| Portais de fronteira | ✅ | — | ✅ | — | ✅ relatório | ✅ (servidor só atravessa portal validado) | ⚠️ 2 travessias HV_01↔ER_18 observadas | 705/738 validadas |
| Fetch reproduzível dos GLBs | ✅ | — | ✅ | — | ✅ | — | ✅ | `tools/fetch-sources.mjs` |
| Servidor autoritativo Rust | ✅ | — | ✅ | — | ✅ | ✅ | ✅ HTTP/WS e PostgreSQL local | `cargo test` 11 testes |
| Relógio global (dia 2 h + noite 40 min) | ✅ | — | ✅ | — | ✅ | ✅ (servidor + luz do cliente) | ✅ | testes de fronteira de fase |
| Streaming LRU + janela por Hunter (servidor) | ✅ | ✅ (JS) | ✅ (Rust) | — | ✅ | ✅ | ✅ 0 erros de carga no sim-check | `sim-check-v01.json` |
| Streaming LRU no cliente | ✅ | ✅ | ✅ | — | ✅ | ✅ espelha a janela autoritativa | ✅ headless | captura em `evidencias/` |
| Contratos versionados v1 | ✅ | — | ✅ | — | ✅ | ✅ | ✅ | `contracts/v1`, `contract_v1.rs` |
| Migrations PostgreSQL | ✅ | — | ✅ | — | ✅ | ✅ (opcional) | ✅ PostgreSQL 16 local: aplicar, salvar, recarregar | ver diário |
| Hunter do workshop (GLB 1.000 tri, 19 ossos) | ✅ | — | — | ⚠️ "base de referência" enviada pelo responsável; aprovação para jogo não registrada | ✅ `main` | ✅ | ✅ headless | `manifesto-integracao.json` |
| Velocidade de locomoção extraída dos clipes | ✅ | — | ✅ | — | ✅ | ✅ Walking 1,1733 m/s | ✅ | Running divergente (43%): não usado |
| IA autônoma do Hunter (escolha de destino + A*) | ✅ | ✅ (Alpha, JS) | ✅ (Rust, nova) | — | ✅ | ✅ | ✅ 20 min simulados | sem controle direto |
| Porte da IA/combate da Alpha | ✅ | ✅ Alpha | ⚠️ rng, hash, clamp, strike | — | ✅ | ❌ (strike não usado em gameplay) | ✅ paridade bit a bit | `parity_alpha01.rs` |
| Frustum culling | ✅ | — | ⚠️ esferas por chunk/GLB; Hunter skinned com culling desligado | — | ✅ | ✅ | ❌ ganho não medido | — |
| Occlusion culling | ✅ | — | ❌ | — | — | ❌ | ❌ | backlog |
| Backface culling | ✅ | — | ⚠️ `FrontSide` na camada física; GLBs usam material como exportado | — | ✅ | ✅ | ❌ não auditado | — |
| Tela de carregamento V02 | ✅ | ✅ | ✅ isolado | ❌ | ✅ `build real/loading-screen/v02` | ❌ | ❌ | fora do corte |
| HUD ilustrada (22/11) | ✅ | — | ❌ | — | ❌ imagem ausente do repo | ❌ (HUD técnica provisória) | — | — |
| Carroças, resgate, bestiário, caçadas | ✅ | — | ❌ | — | — | ❌ | ❌ | backlog explícito |
| Clima V08 completo | ✅ | ✅ (referência) | ❌ | — | — | ❌ | ❌ | backlog |
| PvP / Battle Royale / economia-RMT / stress 1.000 | ✅ | — | ❌ | — | — | ❌ | ❌ | backlog |
| Modo econômico pixel art | ✅ | — | ❌ | — | — | ❌ | ❌ | backlog |
| Fauna em revisão (PRs #1–#7 do wildhaven2) | — | ✅ | ✅ nos PRs | ❌ em revisão | ✅ nos PRs | ❌ | ❌ | **não tocados** por este PR |
| `game/alpha01` | — | ✅ | — | — | ✅ | — (somente leitura) | — | não modificada |
