# Torvalho — modelos 3D animados v0.1

**Arquivos originais publicados e verificados no GitHub Wildhaven.** Não são apenas manifestos: os modelos GLB, fontes Python e visualizador HTML constam na branch `main`.

## GLBs publicados

| Arquivo | Bytes | SHA-256 |
| --- | ---: | --- |
| [torvalho_animated_v01.glb](./torvalho_animated_v01.glb) | 1413784 | `2fb8e8363d3f9cf2ae419668ebc2c11288165cff71a45b367a08c79aea09021e` |
| [torvalho_LOD1_animated_v01.glb](./torvalho_LOD1_animated_v01.glb) | 607004 | `980a1138b9de1fda13c3af6c5298a6e719c02a658e291813b9f84186fa869786` |

## Código-fonte e visualizador

- [generate_torvalho.py](./generate_torvalho.py) — gera o(s) modelo(s) e os clipes originais com Python + NumPy.
- [index.html](./index.html) — visualizador de animações Three.js com seleção de clipes, para executar em um servidor HTTP.
- [asset-prototype-manifest.json](./asset-prototype-manifest.json) — nomes, tamanhos, SHA-256 e Git blob SHA verificados.

## 27 animações

`walk`, `trot`, `run`, `calf_follow`, `idle`, `graze`, `chew`, `ruminate`, `sniff_air`, `watch`, `alert`, `alarm_bellow`, `herd_guard`, `stomp`, `charge_windup`, `charge`, `horn_sweep`, `head_toss`, `drink`, `rest`, `sleep`, `dust_bath`, `tail_swish`, `turn_left`, `turn_right`, `hurt`, `death`.

## Testar localmente

1. Baixe ou clone o diretório `assets/models/creatures/torvalho/` com os arquivos GLB ao lado do HTML.
2. Execute `python -m http.server 8765` na pasta.
3. Abra `http://localhost:8765/` no navegador, ou use o IP do computador na mesma rede para testar no telefone.

## Estado de produção

Protótipo visual em revisão; falta navegação, IA de manada e colisões.
Os clipes locomotores são **in-place**; faltam controlador de mundo, navegação, IK e testes de gameplay. A existência do GLB não significa que o jogo já importe ou use a criatura.

[Ficha da espécie](../../../../creatures/species/torvalho.md) · [Commit de publicação dos GLBs](https://github.com/carioca1111/wildhaven/commit/7b8cb97496fe8a3d4a5dab4f5c019b0f2413e998)
