# Brejáveo — v01: blockout anatômico estático

**Projeto:** Wildhaven — Floresta Tropical / Pântano Tropical  
**Espécie:** Brejáveo (`brejaveo`) — wyvern quadrúpede carnívoro de emboscada  
**Aprovação:** conceito aprovado pelo diretor; **forma 3D aguardando aprovação**  
**Etapa:** blockout; rig, skinning, animações e LOD1/2 não fazem parte da revisão  
**Destino:** repositório `carioca1111/wildhaven-new`, branch `feat/brejaveo-blockout-v01` (sem alteração da Alpha).

## Anatomia e escala

- **5,457 m comprimento total**, **6,961 m envergadura aberta**, **2,65 m altura total** (medidos a partir dos extremos do GLB). A prancha original mostra uma criatura menor; esta escala foi alterada no planejamento que o diretor aprovou.
- Braços e antebraços são os **membros dianteiros de apoio**; seus reforços ósseos também sustentam as membranas alares. São asas-membros, não quatro pernas mais um segundo par de asas.
- Caixa torácica facetada, pescoço longo, mandíbula distinta, garganta alargada e língua anatômica recolhida, preparada como requisito para futura captura de presas sem combate frontal.
- Pernas traseiras digitígradas, dedos com garras, cauda de equilíbrio, dois pares de estruturas cefálicas, olhos inseridos na cavidade ocular.
- **Textura UV pintada**: manchas verde/roxo na pele, contraste ventral e membranas ocre-alaranjadas. Não há malhas adicionais usadas exclusivamente para representar pintura ou cor. Ossos de asa, dentes, chifres e garras são volumes anatômicos.

## Arquivos reais

- `brejaveo-v01-anatomia-blockout.glb`: GLB estático com malhas trianguladas, UV e textura interna.
- `textures/brejaveo-v01-atlas-uv.png`: atlas externo idêntico ao utilizado no exportador.
- `source/build.py`: gerador procedural/editável (Python, NumPy, Pillow, trimesh).
- `source/render.py`: render real depois de reimportar o GLB (Python, VTK, trimesh, Pillow).
- `source/contact_sheet.py`: diagramação das três capturas reais.
- `previews/brejaveo-v01-real-glb-perfil.png`, `...frente.png`, `...tres-quartos.png`, `...3-vistas.png`: evidências do GLB **reimportado**. Não são artes geradas por IA.
- `manifest.json`: métricas/identidade e checksums locais.

## Validação realizada

GLB glTF 2.0 exportado; reimportação por `trimesh.load(..., force='scene', process=False)`, renderização por VTK das malhas reimportadas, verificação de vértices finitos, UVs e métricas. Foram confirmados **89 meshes**, **3.692 faces triangulares**, **2.169 vértices**, **0 skins**, **0 juntas** e **0 clipes de animação**. Os grupos separados do blockout **não garantem fusão de topologia, skinning ou deformação**; essas questões ficam para as etapas posteriores.

**SHA-256 GLB:** `eaa65d74edbe0e3e14d84b66bea3328917b1b174308cc4d2207475feffb40977`  
**Git blob SHA do GLB produzido:** `abfba65ec06847b53cf25ba2bcf3485aff42b34d`  
**Bytes GLB:** 246804

## Portão de aprovação

Aprovação artística requerida para a forma: silhueta, volume, braços/asa, distribuição de peso, abertura de boca e dimensões. **Não executar refinamento, rig, animações, LODs ou integração de gameplay/Alpha antes do aval do diretor.** Após aprovação, a futura rigagem da língua deve levar em conta tração de presas, extensão, recolhimento e inserção anatômica na mandíbula. Não atribuir aprovação artística automática à validação do arquivo.