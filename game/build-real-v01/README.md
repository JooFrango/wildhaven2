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

### Gameplay da fatia demonstrável

| Peça | Onde |
| --- | --- |
| Ordens (explorar, caçar, recolher) — sem mover Hunter | `POST /api/v1/orders`, `wh-core::game` |
| 6 Hunters + Chad e Nailon, habilidades 1–20 por prática, sem nível geral | `wh-core::hunter` |
| 2 carroças (6 vagas, custo), viagem por portais, acampamento em clareira | `wh-core::game` |
| Folhisco (presa) e Lobrapedra (predador) por bioma, percepção da ficha | `wh-core::creature` |
| Pegadas compactas, azuis quando descobertas, interrompidas pela água | `wh-core::tracks` |
| Estratégia autônoma: rodeio agachado ou armadilha + grito; Desvio 1/5 | `wh-core::game` |
| Ferimento, resgate por Chad/Nailon (pode fracassar), morte permanente | `wh-core::game` |
| Bestiário (página no 1º avistamento, Conhecimento de Monstros) | `wh-core::bestiary` |
| Estado salvo no PostgreSQL (`world_state`, migration 0002) | `wh-server::persist` |
| Modo Econômico pixel art (mesma simulação) | `client/src/economic.ts` |

**Todos os números de gameplay são PROVISÓRIOS** e ficam num arquivo só:
[`data/gameplay-provisorio-v01.json`](data/gameplay-provisorio-v01.json). Cada bloco cita o item de
decisão do diretor ou a ficha de espécie de onde veio. Aceitação item a item:
[`build real/integracao/ACEITACAO-ROADMAP-v01.md`](../../build%20real/integracao/ACEITACAO-ROADMAP-v01.md).

### Como jogar (no navegador)

1. **Explorar**: manda Hunters da vila andarem por hexes vizinhos até avistarem animais (página nova no Bestiário).
2. **Recolher exploradores** para trazê-los de volta.
3. No **Bestiário**, abra a espécie (conhecimento, itens, mapinha) e clique **Caçar**: marque os Hunters
   (só quem está na vila), escolha **a pé** ou a **carroça de Chad/Nailon** (custo estimado; o servidor confirma) e **Partir**.
4. Observe: viagem, acampamento, busca de pegadas (azuis), estratégia, combate, retorno. Clique num Hunter para segui-lo.
5. **E** alterna o Modo Econômico (pixel art); **F** mostra a malha física; arrastar orbita a câmera.

Para acelerar a revisão, `WH_TIME_SCALE=20` (máx. 50) roda 20 passos de simulação por intervalo.

A velocidade do Hunter (**1,1733 m/s**) é extraída do clipe `Walking` do GLB do workshop por
`tools/clip-speed.mjs` (FK + pé plantado; estimativa por passada concorda em 5%). `Running`
diverge 43% entre os dois métodos e não é usado.

## Pré-requisitos

Node.js ≥ 22 (o teste de paridade usa `--experimental-strip-types`), Rust ≥ 1.80 (testado com 1.97),
npm, ~6 GB livres em disco para `.generated/` (1,3 GB de GLBs via hardlink + ~3,3 GB de pacotes WHP1).
PostgreSQL 16 é opcional.

## Modo leve — Vila (HV_01) + 6 vizinhos (pouco disco)

Medido num clone limpo nesta sessão: `.git` 57 MB, GLBs 104 MB, pacotes WHP1 88 MB,
`node_modules` 95 MB, `target/` do Rust 247 MB (≈ 0,6 GB no total, **sem contar** a instalação
do Node e do Rust). Mesmo resultado do modo completo: 2 travessias HV_01 ↔ ER_18, 0 ticks sem chão.

```bash
git clone --filter=blob:none --sparse --branch feat/build-real-jogavel-v01 https://github.com/JooFrango/wildhaven2.git
```

```bash
cd wildhaven2 && git sparse-checkout set "build real/continental" "build real/integracao" game/build-real-v01 assets/hunters/hunter-workshop/base
```

```bash
node "build real/continental/tools/fetch-sources.mjs" --out .generated/sources --around HV_01
```

```bash
node "build real/continental/compiler/cli.mjs" --all --around HV_01 --old-root .generated/sources/old-root --new-root .generated/sources/new-root --out .generated/physics-272 --res 2 --chunk 256 --node-classes "build real/continental/compiler/node-classes-v01.json" --snap-centers lattice
```

```bash
cd game/build-real-v01/client && npm ci && npm run build
```

```bash
cd ../server && WH_TIME_SCALE=5 cargo run --release -p wh-server
```

Abrir `http://127.0.0.1:8787`. O servidor libera só hexes certificados **com pacote presente**
(no log: `7 tiles liberados ao runtime`). Em Windows/PowerShell, troque a última linha por
`$env:WH_TIME_SCALE=5; cargo run --release -p wh-server`.

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
cd game/build-real-v01/server && cargo run --release -p wh-server --bin wh-sim-check -- travessia 30000 ../data/sim-check-v01.json
```

```bash
cd game/build-real-v01/server && cargo run --release -p wh-server --bin wh-sim-check -- demo 30000 ../data/demo-check-v01.json
```

A demo roteirizada leva ~10–40 min de relógio nesta máquina de 4 vCPU (simula ~6–15 h de jogo).

`wh-sim-check travessia` grava a evidência da Fase 2 (hex de origem → destino, passo no tick da
travessia, continuidade da posição global). `wh-sim-check demo` roda a expedição completa do roadmap
e grava a linha do tempo de eventos.

Regenerar os vetores de paridade a partir do TypeScript original da Alpha (somente leitura):

```bash
cd game/build-real-v01 && node --experimental-strip-types --no-warnings tools/gen-parity-fixtures.mjs
```

## O que NÃO está nesta build

PvP, Battle Royale, economia/RMT, stress de 1.000 contas e IA adaptativa N1/N2/N3, clima V08 completo,
HUD ilustrada (imagem ausente do repo), animações de técnicas/Desvio/agachar/queda (o GLB do workshop
só tem `Walking`/`Running`), troca de equipamento, LOD visual, travessia marítima dos 6 `iceberg-sea`,
colisores de vegetação instanciada dos costeiros, correção da escala das árvores (pendente de decisão),
medição em GPU real. Criaturas a mais de 1.500 m de qualquer ator ficam congeladas.
Ver `build real/integracao/ACEITACAO-ROADMAP-v01.md` e `RELATORIO-FINAL-v01.md`.
