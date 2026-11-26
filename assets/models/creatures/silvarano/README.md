# Silvarano — modelos 3D animados v0.1

**Arquivos originais publicados e verificados no GitHub Wildhaven.** Não são apenas manifestos: os modelos GLB, fontes Python e visualizador HTML constam na branch `main`.

## GLBs publicados

| Arquivo | Bytes | SHA-256 |
| --- | ---: | --- |
| [silvarano_temperate_animated_v01.glb](./silvarano_temperate_animated_v01.glb) | 816616 | `d539669aecd9d68db228804df1481da945551a52ddb321081f2ca8f7751f1e72` |
| [silvarano_tropical_animated_v01.glb](./silvarano_tropical_animated_v01.glb) | 816604 | `159d21c9720c2ba8cacda8f3e93ad6576fdf65546c2b191eb244ac4daab1562e` |

## Código-fonte e visualizador

- [generate_silvarano.py](./generate_silvarano.py) — gera o(s) modelo(s) e os clipes originais com Python + NumPy.
- [index.html](./index.html) — visualizador de animações Three.js com seleção de clipes, para executar em um servidor HTTP.
- [asset-prototype-manifest.json](./asset-prototype-manifest.json) — nomes, tamanhos, SHA-256 e Git blob SHA verificados.

## 28 animações

`idle`, `walk`, `trot`, `run`, `sprint`, `turn_left`, `turn_right`, `browse`, `chew`, `drink`, `rest`, `sleep`, `thermoregulate`, `scan`, `freeze`, `alarm_call`, `flee_start`, `jump`, `land`, `regroup`, `social_display`, `head_sweep`, `hind_kick`, `short_charge`, `hurt`, `death`, `nest_guard`, `juvenile_follow`.

## Testar localmente

1. Baixe ou clone o diretório `assets/models/creatures/silvarano/` com os arquivos GLB ao lado do HTML.
2. Execute `python -m http.server 8765` na pasta.
3. Abra `http://localhost:8765/` no navegador, ou use o IP do computador na mesma rede para testar no telefone.

## Estado de produção

Protótipos visuais em revisão; falta aprovar anatomia, colisões e IA.
Os clipes locomotores são **in-place**; faltam controlador de mundo, navegação, IK e testes de gameplay. A existência do GLB não significa que o jogo já importe ou use a criatura.

[Ficha da espécie](../../../../creatures/species/silvarano.md) · [Commit de publicação dos GLBs](https://github.com/carioca1111/wildhaven/commit/7b8cb97496fe8a3d4a5dab4f5c019b0f2413e998)
