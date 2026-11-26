# Folhisco — modelos 3D animados v0.1

**Arquivos originais publicados e verificados no GitHub Wildhaven.** Não são apenas manifestos: os modelos GLB, fontes Python e visualizador HTML constam na branch `main`.

## GLBs publicados

| Arquivo | Bytes | SHA-256 |
| --- | ---: | --- |
| [folhisco_animated_v01.glb](./folhisco_animated_v01.glb) | 700196 | `87fa091aeed60b95e45a8b702c7cba311df33abaf47cd37b7a21ee81ac30a033` |

## Código-fonte e visualizador

- [generate_folhisco.py](./generate_folhisco.py) — gera o(s) modelo(s) e os clipes originais com Python + NumPy.
- [index.html](./index.html) — visualizador de animações Three.js com seleção de clipes, para executar em um servidor HTTP.
- [asset-prototype-manifest.json](./asset-prototype-manifest.json) — nomes, tamanhos, SHA-256 e Git blob SHA verificados.

## 15 animações

`idle`, `walk`, `run`, `peck`, `scratch`, `scan_head`, `alert`, `alarm_call`, `jump_flap`, `hide`, `hurt`, `death`, `drink`, `preen`, `sleep`.

## Testar localmente

1. Baixe ou clone o diretório `assets/models/creatures/folhisco/` com os arquivos GLB ao lado do HTML.
2. Execute `python -m http.server 8765` na pasta.
3. Abra `http://localhost:8765/` no navegador, ou use o IP do computador na mesma rede para testar no telefone.

## Estado de produção

Visual e clipes v0.1 aprovados; IA, colisão e integração ainda pendentes.
Os clipes locomotores são **in-place**; faltam controlador de mundo, navegação, IK e testes de gameplay. A existência do GLB não significa que o jogo já importe ou use a criatura.

[Ficha da espécie](../../../../creatures/species/folhisco.md) · [Commit de publicação dos GLBs](https://github.com/carioca1111/wildhaven/commit/7b8cb97496fe8a3d4a5dab4f5c019b0f2413e998)
