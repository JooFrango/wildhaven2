# Wildhaven — Build Real V02

O servidor autoritativo Rust e o cliente Three.js. O jogador **só dá ordens e observa**. Relatório completo:
[`build real/integracao/RELATORIO-V02.md`](../../build%20real/integracao/RELATORIO-V02.md).

## Jogar sem instalar nada (Windows)

1. Baixe o [ZIP portátil](https://github.com/JooFrango/wildhaven2/releases/download/build-real-v02-portatil/Wildhaven-Windows-portatil-v02.zip).
2. Extraia tudo.
3. Clique duas vezes em `Iniciar-Wildhaven.bat`.

## Rodar a partir do código (modo leve: HV_01 + 6 vizinhos)

Na raiz do repositório:

```bash
node "build real/continental/tools/fetch-sources.mjs" --out .generated/sources --around HV_01
```

```bash
node "build real/continental/compiler/cli.mjs" --all --around HV_01 --old-root .generated/sources/old-root --new-root .generated/sources/new-root --out .generated/physics-272 --res 2 --chunk 256 --node-classes "build real/continental/compiler/node-classes-v01.json" --snap-centers lattice
```

```bash
(cd game/build-real-v02/tools/visual && npm ci) && node game/build-real-v02/tools/visual/build-visual.mjs --around HV_01 --chunk 256
```

```bash
cd game/build-real-v02/client && npm ci && npm run build
```

```bash
cd game/build-real-v02/server && WH_REPO_ROOT=../../.. cargo run --release -p wh-server
```

Depois abra http://127.0.0.1:8787.

## Teclas

| Tecla | Ação |
| --- | --- |
| M | Mapa |
| B | Bestiário |
| I | Inventário |
| F3 | Menu do desenvolvedor (configurável em Sistema) |
| Tab, 1–9 | Escolher Hunter |
| Botão direito/meio, Q/E | Girar a câmera |
| Roda | Zoom |
| WASD | Deslocar a câmera |
| F | Voltar a seguir o Hunter |

## Parâmetros de URL (teste e auditoria)

| Parâmetro | Efeito |
| --- | --- |
| `?perfil=economico\|baixo\|medio\|alto` | Escolhe o perfil gráfico |
| `?cam=dist,inclinação,rumo` | Posição inicial da câmera |
| `?camfix=x,y,z,alvoX,alvoY,alvoZ` | Câmera fixa |
| `?comparar=original` | GLBs originais, sem otimização |
| `?fog=0` | Desliga o fog |
| `?hud=0` | Esconde a HUD |
| `?fase=1..4` | Fase da vila |

## Testes

```bash
cd game/build-real-v02/server && cargo test --release
```

```bash
cd game/build-real-v02/server && ./target/release/wh-sim-check demo 30000 ../data/demo-check-v02.json
```
