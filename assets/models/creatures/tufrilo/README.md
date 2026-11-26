# Wildhaven · Carniroca e Tufrilo — modelos 3D animados Alpha 0.1

**Estado:** malhas 3D procedurais originais, rig e clipes válidos, em **revisão visual**; não integrados ao gameplay. Não requer créditos fal.

## Arquivos

| Espécie | GLB detalhado | Triângulos | GLB otimizado (LOD1) | Triângulos | Ossos | Clipes |
| --- | --- | ---: | --- | ---: | ---: | ---: |
| Carniroca | `carniroca_animated_v01.glb` | 16.704 | `carniroca_LOD1_animated_v01.glb` | 8.698 | 18 | 25 |
| Tufrilo | `tufrilo_animated_v01.glb` | 10.596 | `tufrilo_LOD1_animated_v01.glb` | 6.714 | 20 | 25 |

**Carniroca**: necrófago médio com corpo de ave, pescoço parcialmente sem penas, bico curvo, patas de garras, asas com três seções articuladas, penugem escura e penas cor de ferrugem. 

**Tufrilo**: herbívoro pequeno saltador de bosque temperado, quatro patas diferenciadas, patas traseiras maiores, orelhas móveis foliformes e cauda com penacho, pelagem em tons de musgo, creme e ferrugem. 

## Animações

Carniroca: `idle`, `breathing`, `walk`, `hop`, `takeoff`, `fly`, `glide`, `flap_hard`, `bank_left`, `bank_right`, `land`, `wing_fold`, `perch`, `scan`, `approach_carcass`, `peck_carrion`, `tear_meat`, `swallow`, `threaten`, `call`, `preen`, `rest`, `sleep`, `hurt`, `death`.

Tufrilo: `idle`, `breathing`, `walk`, `hop`, `bound`, `sprint`, `turn_left`, `turn_right`, `sniff`, `forage`, `nibble`, `collect_seed`, `stash_seed`, `dig`, `look_around`, `alert_call`, `freeze`, `flee`, `hide`, `groom`, `drink`, `rest`, `sleep`, `hurt`, `death`.

O arquivo `index.html` é um visualizador para celular/desktop: selecionar espécie, LOD e clipe, orbitar com toque e alterar velocidade. Precisa de internet para a biblioteca Three.js e de servidor HTTP na pasta: `python -m http.server 8000` e acesse `http://localhost:8000/`.

## Reprodutibilidade e testes

- `generate_creatures.py` — gera toda a malha, materiais por vértices primitivos, pesos, ossos, animações e GLBs sem software proprietário (Python e NumPy).
- `validate_glb.py` — confere estrutura glTF 2.0, buffers, malhas, pesos, articulações, clipes, tempos e importação por Trimesh.
- `render_creatures.py` — renderiza poses reais dos arquivos GLB (CPU skinning com VTK/SciPy), gif e MP4 mobile.
- `validation.json` — resultados de validação.
- `creature_manifest.json` — tamanhos, hashes SHA-256, bounds e clipes de cada arquivo.
- Prévias: `carniroca_tufrilo_comparison.png`, `actions_contact_sheet.png`, `creatures_animations_preview.gif`, `creatures_preview_mobile.mp4`.

## Limitações importantes

- A geometria é mid-poly procedural, não equivalente a escultura orgânica manual; o sombreamento usa materiais sólidos sem mapas PBR complexos.
- Pesos de pele rígidos por região anatômica; **ainda sem skinning orgânico, IK de patas, simulação aerodinâmica de voo, colisão ou validação física das asas**.
- Animações de locomoção predominantemente **in-place**, dependem do controlador do jogo para translação global.
- A Carniroca **não executa** IA de procura de carcaças; o Tufrilo **não guarda sementes de fato**. Ambos possuem somente os clipes correspondentes.
- Assets não foram inseridos na Alpha jogável de Wildhaven e precisam de aprovação visual.

**Licença do artefato original:** criação para o projeto Wildhaven, sem dependência de geração paga; Three.js carrega de CDN no visualizador.
