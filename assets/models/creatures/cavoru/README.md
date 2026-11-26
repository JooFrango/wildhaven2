# Cavoru — criaturas 006 · Wildhaven · Modelo 3D animado v0.1

**Estado:** primeiro protótipo 3D funcional para revisão visual, não integrado à Alpha jogável.

Criação original baseada no conceito de um herbívoro médio de florestas temperadas e planícies: tronco robusto contínuo, focinho espatulado para remexer o solo, orelhas foliformes, quatro dedos com garras, cauda curta e tufos de pelo geométricos. A variante florestal tem listras creme e marrom-musgo; a das planícies é mais comprida, acobreada, com marcas discretas.

## Arquivos GLB

| Ecótipo | Modelo | Triângulos | Vértices | Articulações | Ações | Tamanho |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Floresta temperada | `cavoru_forest_animated_v01.glb` | 23.610 | 13.330 | 24 | 27 | 1.035.236 B |
| Floresta temperada | `cavoru_forest_LOD1_animated_v01.glb` | 10.552 | 6.170 | 24 | 27 | 534.744 B |
| Planícies | `cavoru_plains_animated_v01.glb` | 21.300 | 11.893 | 24 | 27 | 938.428 B |
| Planícies | `cavoru_plains_LOD1_animated_v01.glb` | 9.708 | 5.606 | 24 | 27 | 497.420 B |

Os GLBs glTF 2.0 têm uma skin articulada, keyframes reais e geometria 3D, **não são imagens simulando malha 3D**. O manifesto `cavoru_manifest.json` lista hash SHA-256, bounds, métricas e clipes por arquivo.

## 27 ações animadas

`idle`, `breathing`, `walk`, `trot`, `short_sprint`, `turn_left`, `turn_right`, `graze`, `sniff_ground`, `dig_shallow`, `pull_tuber`, `chew`, `drink`, `lookout`, `freeze`, `warning_call`, `regroup`, `flee_start`, `dodge`, `push_defense`, `dust_roll`, `groom`, `rest`, `sleep`, `hurt`, `death`, `juvenile_follow`.

Os movimentos de *dig_shallow* e *pull_tuber* simulam gestos corporais; **não produzem física do solo nem um tubérculo visível**. As animações de locomoção são `in-place`, portanto o controlador da criatura será responsável pelo deslocamento no mapa.

## Visualizador

O `index.html` oferece giro por toque, zoom, escolha da variante, dos LODs, das animações e controle de reprodução. Para abrir localmente, execute `python -m http.server 8000` nesta pasta e visite `http://localhost:8000`. Requer conexão com a internet para a biblioteca Three.js carregada de CDN.

## Arquivos-fonte e testes

- `generate_cavoru.py`: fonte original em Python/NumPy para gerar os quatro GLBs com rig/ações.
- `validate_glb.py`: valida os GLBs, buffers, articulações, canais, pesos, keyframes e importação via Trimesh; salva `cavoru_validation.json`.
- `render_cavoru.py`: renderiza malha e animações reais por CPU skinning com VTK, produz prévias PNG/GIF/MP4.
- `cavoru_variants_comparison.png`: comparação dos modelos. `cavoru_actions_contact_sheet.png`: 12 ações. `cavoru_preview_celular.mp4`: prévia móvel.

## Limitações e trabalho futuro

Este é um primeiro modelo **mid-poly procedural**, não uma escultura final. A malha do tronco é contínua, mas o skinning usa regiões com pesos rígidos; ainda faltam deformação orgânica das articulações, IK de quatro patas, LOD dinâmico em runtime, áudio, colisões, animação facial refinada, estados de fome e sede e IA para pastar/escavar/fugir. As variantes e o design aguardam sua aprovação visual antes de entrar no jogo. Nenhum sistema anterior foi alterado.

[Espécie Cavoru](../../../../creatures/species/cavoru.md) · [Ficha JSON](../../../../creatures/species/cavoru.json)
