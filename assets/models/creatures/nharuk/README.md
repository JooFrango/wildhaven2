# Nharuk — modelos 3D animados v0.1

**Criatura 005 de Wildhaven** · predador original baseado no nicho ecológico de grandes felinos, não uma reprodução de onça.

## Revisão anatômica v0.2 (mais recente)

**Nova versão disponível:** [abrir a pasta `v02`](./v02/) · [ver comparação antes/depois](./v02/nharuk_anatomia_antes_depois.png).

A v0.2 remodela o tronco como superfície contínua, inclina os membros em postura digitígrada, melhora os ombros/coxas e encurta o focinho. São **quatro GLBs reais com 27 clipes e 24 ossos**, acompanhados de gerador, validação e visualizador. Todos foram publicados em commit próprio com hashes confirmados; **a v0.1 abaixo permanece preservada**. A v0.2 ainda precisa de refinamento artístico e skinning avançado antes da integração.

## Ecótipos

- **Nharuk-da-Sombra** (`tropical`): corpo mais compacto e escuro para sub-bosque tropical, aproximadamente 35–58 kg.
- **Nharuk-dos-Campos** (`temperate_plains`): forma maior e ocre-cobre para floresta temperada e planícies, aproximadamente 75–125 kg.

As duas variantes compartilham nomenclatura de rig e animações; tamanhos e cores são diferentes.

## GLBs reais

| Arquivo | Triângulos | Vértices | Articulações | Clipes |
| --- | ---: | ---: | ---: | ---: |
| `nharuk_tropical_animated_v01.glb` | 24.604 | 13.919 | 24 | 27 |
| `nharuk_tropical_LOD1_animated_v01.glb` | 9.752 | 5.761 | 24 | 27 |
| `nharuk_temperate_plains_animated_v01.glb` | 24.604 | 13.919 | 24 | 27 |
| `nharuk_temperate_plains_LOD1_animated_v01.glb` | 9.752 | 5.761 | 24 | 27 |

Os hashes SHA-256 e dimensões de cada GLB estão em `nharuk_manifest.json`; detalhes da validação estão em `nharuk_validation.json`.

## Animações (27)

`idle`, `breathing`, `walk`, `trot`, `run`, `turn_left`, `turn_right`, `stalk`, `crouch`, `ambush`, `pounce`, `bite`, `claw_sweep`, `drag_prey`, `feed`, `drink`, `sniff`, `listen`, `alert`, `growl`, `threat_display`, `groom`, `rest`, `sleep`, `hurt`, `death`, `cub_follow`.

## Visualizador e fontes

- `index.html`: prévia 3D em navegador desktop e Android, com toque, seleção de ecótipo, LOD e ação.
- `generate_nharuk.py`: gerador procedural de malha real, materiais, rig e keyframes, requer apenas NumPy.
- `validate_glb.py`: testes de estrutura GLB, integridade de buffers, juntas, pesos e importação via Trimesh.
- `render_nharuk.py`: gerador de prévias de cada clipe e vídeo, dependências VTK/SciPy/Pillow/ffmpeg.

Abra `index.html` por um servidor HTTP, por exemplo `python -m http.server 8000` na pasta e acesse `http://localhost:8000`. A biblioteca Three.js é carregada da CDN (internet necessária).

## Estado e limitações

**Protótipo visual em revisão.** As animações são `in-place`: deslocamento pelo mapa depende de navegação/IA do jogo. As juntas usam pesos rígidos por região e ainda requerem deformação orgânica, IK das patas, hitboxes, colisões, lógica de caça, áudio e refinamento anatômico e de pelagem. Ainda não está integrado à Alpha do Wildhaven.

Ver [dossiê da espécie](../../../../creatures/species/nharuk.md).
