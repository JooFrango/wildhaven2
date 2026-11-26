# Wildhaven — Build Real v01 (primeira build jogável, corte Fase 0 + 1 + início da 2)

**Estado:** build técnica em revisão (PR em rascunho). Não substitui nem altera `game/alpha01/`.
Nenhuma aprovação artística é implicada por esta build; ver
[`build real/integracao/`](../../build%20real/integracao/) para a matriz de estado.

## O que roda

| Peça | Onde | O que faz |
| --- | --- | --- |
| Servidor autoritativo (Rust) | `server/crates/wh-server` | simulação em passo fixo de 0,2 s; relógio global (dia de 2 h + noite de 40 min); streaming LRU de chunks WHP1 com janela móvel em torno de **cada Hunter**; HTTP + WebSocket; PostgreSQL opcional |
| Núcleo (Rust) | `server/crates/wh-core` | relógio, leitor WHP1 (SHA-256), hex/regiões, portais validados, A* no terreno compilado, Hunter autônomo, porte incremental da Alpha (rng/hash/strike) com paridade por seed |
| Cliente (TypeScript + Three.js) | `client/` | render dos GLBs reais de terreno perto dos Hunters + malhas da física da janela autoritativa, Hunter do workshop com o clipe `Walking`, minimapa dos 272 hexes, HUD; **sem controle direto** do Hunter |
| Contratos | `contracts/v1/` | `wildhaven.snapshot.v1` (schema JSON), validado por teste no servidor e espelhado em `client/src/contracts.ts` |
| Migrations | `server/migrations/` | `0001_init.sql` (mundos, Hunters com posição global, log de travessias) |

A velocidade do Hunter (**1,1733 m/s**) é extraída do clipe `Walking` do GLB do workshop por
`tools/clip-speed.mjs` (FK + pé plantado; estimativa por passada concorda em 5%). `Running`
diverge 43% entre os dois métodos e não é usado.

## Pré-requisitos

Node.js ≥ 22 (o teste de paridade usa `--experimental-strip-types`), Rust ≥ 1.80 (testado com 1.97),
npm, ~6 GB livres em disco para `.generated/` (1,3 GB de GLBs via hardlink + ~3,3 GB de pacotes WHP1).
PostgreSQL 16 é opcional.

## Execução local — passo a passo (na raiz do repositório)

```bash
node "build real/continental/tools/fetch-sources.mjs" --out .generated/sources --link
```

```bash
node "build real/continental/compiler/cli.mjs" --all --old-root .generated/sources/old-root --new-root .generated/sources/new-root --out .generated/physics-272 --res 2 --chunk 256 --node-classes "build real/continental/compiler/node-classes-v01.json" --snap-centers lattice
```

```bash
node "build real/continental/tools/validate-portals.mjs" --physics .generated/physics-272 --old-root .generated/sources/old-root --new-root .generated/sources/new-root --node-classes "build real/continental/compiler/node-classes-v01.json" --snap-centers lattice --out "build real/integracao/relatorio-continental-272.json"
```

(O relatório N/N já está versionado; os dois últimos comandos regeneram os pacotes locais, que
**não** são versionados por tamanho. A compilação levou ~5,5 min e a validação ~1 min nesta máquina de 4 vCPU.)

```bash
node game/build-real-v01/tools/pick-spawn.mjs --report "build real/integracao/relatorio-continental-272.json" --physics .generated/physics-272 --out game/build-real-v01/data/spawn-v01.json
```

Cliente:

```bash
cd game/build-real-v01/client && npm ci && npm run build
```

Servidor (serve também o cliente compilado em `http://127.0.0.1:8787`):

```bash
cd game/build-real-v01/server && cargo run --release -p wh-server
```

Abrir `http://127.0.0.1:8787`. Para desenvolvimento do cliente com recarga, rode `npm run dev` em
`client/` (porta 5173, proxy para o servidor em 8787).

Com PostgreSQL (opcional): copie `.env.example` para `.env`, preencha `DATABASE_URL` localmente
e carregue com `set -a; . ./.env; set +a` antes de `cargo run`. As migrations são aplicadas na partida.

## Testes

```bash
node --test "build real/continental/test/continental.test.mjs" "build real/continental/test/compiler.test.mjs"
```

```bash
cd game/build-real-v01/server && cargo test
```

```bash
cd game/build-real-v01/server && cargo run --release -p wh-server --bin wh-sim-check -- 6000 ../data/sim-check-v01.json
```

`wh-sim-check` roda a simulação sem rede sobre o terreno compilado real e grava a evidência de
travessia (hex de origem → destino, passo no tick da travessia, continuidade da posição global).

Regenerar os vetores de paridade a partir do TypeScript original da Alpha (somente leitura):

```bash
cd game/build-real-v01 && node --experimental-strip-types --no-warnings tools/gen-parity-fixtures.mjs
```

## O que NÃO está nesta build

PvP, Battle Royale, economia/RMT, stress de 1.000 contas, clima V08 completo, carroças/resgate,
bestiário, criaturas no mundo, combate em gameplay (só a regra `strike` portada com paridade),
modo econômico pixel art, HUD ilustrada, occlusion culling, travessia marítima dos 6 `iceberg-sea`,
colisores de vegetação instanciada dos costeiros. Ver o relatório final em
`build real/integracao/RELATORIO-FINAL-v01.md`.
