# Contratos versionados — Build Real v01

Fonte única dos formatos trocados entre o servidor Rust (`server/`) e o cliente TypeScript (`client/`).

| Contrato | Arquivo | Produtor | Consumidores |
| --- | --- | --- | --- |
| `wildhaven.snapshot.v1` | [`v1/snapshot.schema.json`](v1/snapshot.schema.json) | `wh-core::sim::Snapshot` | `client/src/contracts.ts`, testes |
| `wildhaven.continent.summary.v1` | resposta de `GET /api/v1/continent` | `wh-server` | minimapa do cliente |
| `wildhaven.physics.tile.v1` / WHP1 | `build real/continental/compiler/physics.mjs` | compilador Node | `wh-core::whp`, `physics-loader.mjs` |
| `wildhaven.continental.portal-report.v1` | `build real/integracao/relatorio-continental-272.json` | `validate-portals.mjs` | `wh-core::portals` |

Regras: mudança incompatível cria `v2/` (nunca editar `v1` em produção); o teste
`server/crates/wh-core/tests/contract_v1.rs` falha se o servidor deixar de emitir
um campo exigido pelo schema; o cliente compila contra `client/src/contracts.ts`.

Endpoints (todos somente leitura; **não há endpoint de controle direto do Hunter**):
`GET /api/v1/health`, `GET /api/v1/snapshot`, `GET /api/v1/continent`, `WS /api/v1/stream` (snapshot a 5 Hz),
`GET /physics/<tile>-physics-v01/<chunk>.whp.gz`, `GET /glb/terrain/<tile>`, `GET /glb/hunter.glb`.
