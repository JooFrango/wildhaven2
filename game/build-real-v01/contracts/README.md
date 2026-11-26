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

O snapshot v1 ganhou campos **aditivos** (gameplay: `game.*`, e nos Hunters `skills`, `hp`,
`activity`, `inventory`…); nenhum campo exigido foi removido ou mudou de tipo.

Endpoints (**não há endpoint de controle direto do Hunter**; o único `POST` aceita ordens
`explorar`, `cacar`, `recolher`):
`POST /api/v1/orders`, `GET /api/v1/gameplay`, `GET /assets/…`, `GET /fichas/<espécie>.json`,
`GET /api/v1/health`, `GET /api/v1/snapshot`, `GET /api/v1/continent`, `WS /api/v1/stream` (snapshot a 5 Hz),
`GET /physics/<tile>-physics-v01/<chunk>.whp.gz`, `GET /glb/terrain/<tile>`, `GET /glb/hunter.glb`.
