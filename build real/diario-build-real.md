# Diário da Build Real

## 2026-11-26 — sessão na nuvem (Fase 0 + 1 + início da 2)

**Fase atual:** fim da Fase 1 e início da Fase 2 (um Hunter autônomo atravessando fronteira).
**Branch:** `feat/build-real-jogavel-v01` (base `main@0a7aab5`). PR em rascunho; não mesclar.
**Último commit:** ver `git log -1` na branch. Este diário é atualizado no commit de documentação.

### Feito
1. Auditoria. O legado está inacessível: `add_repo` negado e fetch com 403/404. A `main` do wildhaven2 já contém `build real/continental/` e os 272 GLBs, que conferem com o manifesto (bytes e SHA-1 de blob nos 272, SHA-256 nos 170 da v12). Os testes originais passaram: 14/14.
2. `fetch-sources.mjs`, um fetch reproduzível por commit fixo com verificação.
3. Lote base: 251/272. Depois a classificação v01, proposta e medida, e os centros na grade exata (o manifesto arredonda a 0,1 m): 272/272.
4. `validate-portals.mjs`: 705/738 arestas e 223 hexes certificados tecnicamente.
5. `game/build-real-v01`: servidor Rust, cliente TS + Three.js, contratos v1 e migrations.
6. Velocidade de caminhada extraída do clipe: 1,1733 m/s.
7. Paridade Rust × Alpha (rng, hash, strike) bit a bit.
8. Hunter autônomo: HV_01 → ER_18 → HV_01, sem teleporte. Persistência PostgreSQL verificada.

### Próximo passo
Revisão do diretor (classificação v01, limites de 35°, 4 m e água). Depois, raios de vegetação dos costeiros, FPS em GPU real e porte de `decide` (criaturas) com paridade.

### Comandos (na raiz do repositório)

```bash
node "build real/continental/tools/fetch-sources.mjs" --out .generated/sources --link
```

```bash
node "build real/continental/compiler/cli.mjs" --all --old-root .generated/sources/old-root --new-root .generated/sources/new-root --out .generated/physics-272 --res 2 --chunk 256 --node-classes "build real/continental/compiler/node-classes-v01.json" --snap-centers lattice
```

```bash
node "build real/continental/tools/validate-portals.mjs" --physics .generated/physics-272 --old-root .generated/sources/old-root --new-root .generated/sources/new-root --node-classes "build real/continental/compiler/node-classes-v01.json" --snap-centers lattice --out "build real/integracao/relatorio-continental-272.json"
```

```bash
node --test "build real/continental/test/continental.test.mjs" "build real/continental/test/compiler.test.mjs"
```

```bash
cd game/build-real-v01/server && cargo test && cargo run --release -p wh-server --bin wh-sim-check -- 6000 ../data/sim-check-v01.json
```

```bash
cd game/build-real-v01/client && npm ci && npm run build
```

```bash
cd game/build-real-v01/server && cargo run --release -p wh-server
```

## 2026-11-26 (noite) — fatia demonstrável do roadmap

**Pedido do diretor:** "só pare quando terminar a build real, qualquer coisa depois de pronto vamos polindo".
**Feito:** gameplay completo no servidor (ordens, carroças, acampamento, criaturas, rastros, estratégias,
combate, Desvio, resgate, morte, Bestiário, persistência), cliente com HUD, Bestiário/Caçar, criaturas,
pegadas azuis, Modo Econômico e culling. Demo roteirizada e roteiro no navegador passaram.
**Bugs achados e corrigidos no caminho:** cada replanejamento dava um passo para trás; o alvo do rodeio
alternava; o Hunter que perdia o alvo fora de expedição entrava em loop; a rota `/assets` colidia com o bundle;
o HUD perdia cliques; o canvas pixel cobria os painéis.
**Próximo passo:** revisão do diretor dos números provisórios, assets faltantes (HUD, animações, carroça),
medição em GPU real, escala das árvores.

```bash
cd game/build-real-v01/server && cargo run --release -p wh-server --bin wh-sim-check -- demo 30000 ../data/demo-check-v01.json
```

```bash
cd game/build-real-v01/server && WH_TIME_SCALE=20 cargo run --release -p wh-server
```
