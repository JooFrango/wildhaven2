# Boscaranha — modelos 3D animados v0.1

**Arquivos originais publicados e verificados no GitHub Wildhaven.** Não são apenas manifestos: os modelos GLB, fontes Python e visualizador HTML constam na branch `main`.

## GLBs publicados

| Arquivo | Bytes | SHA-256 |
| --- | ---: | --- |
| [boscaranha_animated_v01.glb](./boscaranha_animated_v01.glb) | 843480 | `c5a1399ddbc4b7b48d7e391a7efc5fbfde27229d325e898cab8ac9a0f7f084ec` |
| [boscaranha_LOD1_animated_v01.glb](./boscaranha_LOD1_animated_v01.glb) | 462068 | `b3cd59ada4ae06f72be4e35f95d93517310088c925505c84d9e57d44a398500a` |

## Código-fonte e visualizador

- [generate_boscaranha.py](./generate_boscaranha.py) — gera o(s) modelo(s) e os clipes originais com Python + NumPy.
- [index.html](./index.html) — visualizador de animações Three.js com seleção de clipes, para executar em um servidor HTTP.
- [asset-prototype-manifest.json](./asset-prototype-manifest.json) — nomes, tamanhos, SHA-256 e Git blob SHA verificados.

## 22 animações

`idle`, `walk`, `scuttle`, `sprint`, `stalk`, `ambush`, `sense_vibrations`, `vigilance`, `pounce`, `bite`, `silk_wrap`, `feed`, `climb`, `threat_display`, `retreat`, `turn_left`, `turn_right`, `groom`, `nest`, `rest`, `hurt`, `death`.

## Testar localmente

1. Baixe ou clone o diretório `assets/models/creatures/boscaranha/` com os arquivos GLB ao lado do HTML.
2. Execute `python -m http.server 8765` na pasta.
3. Abra `http://localhost:8765/` no navegador, ou use o IP do computador na mesma rede para testar no telefone.

## Estado de produção

Protótipo visual em revisão; falta percepção de vibrações, teias, colisão e IA.
Os clipes locomotores são **in-place**; faltam controlador de mundo, navegação, IK e testes de gameplay. A existência do GLB não significa que o jogo já importe ou use a criatura.

[Ficha da espécie](../../../../creatures/species/boscaranha.md) · [Commit de publicação dos GLBs](https://github.com/carioca1111/wildhaven/commit/7b8cb97496fe8a3d4a5dab4f5c019b0f2413e998)
