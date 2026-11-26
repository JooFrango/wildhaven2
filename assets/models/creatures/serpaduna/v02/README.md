# Serpáduna v02 — rig axial e animações reais

**Wildhaven — 12 de novembro de 2026 — revisão artística/técnica, não integrado à Alpha.**

A v02 parte do `serpaduna_v01_blockout.glb` publicado na branch `feat/serpaduna-blockout-v01` (PR #14). A v01 está preservada. O diretor aprovou a arte e autorizou a passagem para rig/animação. **A aprovação final da v02 e a auditoria do Filtro de Qualidade ainda estão pendentes.**

## Arquivos

- `serpaduna_v02_rig_animated.glb` — GLB 2.0 com skinning, juntas, 11 clipes e 4 morph targets embutidos.
- `source/build_rig_v02.py` — reprodutor do asset a partir do GLB v01.
- `source/inspect_and_bake_v02.py` — inspeção independente do arquivo exportado, cálculo de poses/skin e renders de prova, executável a partir do GLB v02.
- `previews/serpaduna_v02_3_vistas_do_rig_real.png` — perfil, frente e três-quartos.
- `previews/serpaduna_v02_*_deformed_real.gif` — prévias de deformações calculadas pelas matrizes **reais do GLB**.
- `animation_test_metrics.json` — deslocamentos de vértices medidos entre poses para todos os clipes.
- `viewer.html` — inspeção animada com Three.js GLTFLoader/AnimationMixer.

## Anatomia e técnica

- Corpo: malha contínua da versão v01, 15 m de eixo corporal aproximado incluindo crânio, paleta e UV preservadas.
- Rig: **72 juntas**: 70 juntas da coluna, 1 dobradiça mandibular, 1 articulação da língua bifurcada.
- Skinning: `JOINTS_0` + `WEIGHTS_0` em **todas as 51 meshes**, com interpolação cúbica não negativa em quatro ossos nas 3.230 posições de vértice do corpo. Elementos cranianos rígidos seguem a extremidade da coluna; mandíbula e língua movem-se em ossos independentes.
- Engolimento: **quatro morph targets** do corpo que simulam uma protuberância percorrendo garganta e torso. É deformação da geometria existente, não malha de coloração ou objeto falso.
- GLB: 8.198 triângulos, skin de verdade, 11 `animations`, 4 morph targets; texturas UV dentro do GLB.

### Clipes

| Animação | Duração | Loop | Movimento |
|---|---:|:---:|---|
| `idle` | 6,0 s | sim | movimento respiratório e ondulação mínima |
| `slither` | 4,0 s | sim | ondulação axial lateral coordenada |
| `fast_slither` | 2,4 s | sim | ondulação mais rápida e vigorosa |
| `coil_defend` | 5,0 s | sim | postura enrolada defensiva |
| `alert` | 3,0 s | sim | elevação e exploração com a cabeça |
| `tongue_flick` | 1,5 s | sim | movimentação da língua bifurcada |
| `ambush_strike` | 2,2 s | não | preparação, disparo de cabeça e retorno |
| `venom_bite` | 1,8 s | não | articulação de mandíbula e mordida |
| `swallow_whole` | 7,0 s | não | deglutição com propagação volumétrica via morph targets |
| `rest` | 7,0 s | sim | repouso com ondulação quase imperceptível |
| `death` | 4,0 s | não | contração corporal final e colapso do pescoço |

**Importante:** o clipe `venom_bite` não injeta veneno de gameplay; status de envenenamento, paralisia, detecção de presa, efeitos de sangue, colisões e sincronização com a presa precisam ser implementados/validados no ecossistema futuramente. `swallow_whole` representa passagem volumétrica; não inclui mesh de presa, IK com contato ou distensão facial realista. Navegação/aderência dinâmica ao terreno também não está incluída; os clipes são **in-place** com pequena oscilação local. A animação de engolir é uma primeira versão, sujeita a ajuste artístico.

## Validações feitas

**Correção de loop:** `slither` e `fast_slither` usam períodos inteiros; a diferença máxima entre o primeiro e último quadro para todos os sete loops é menor que `0,000001` nas amostras exportadas.

1. GLB exportado e reaberto, com 11 nomes de animações reconhecidos por `vtkGLTFImporter`.
2. Cada canal/skin avaliados por uma implementação independente de glTF em `inspect_and_bake_v02.py`, com conversão de quaternions, hierarquia real de joints, inverseBindMatrices, pesos e morph targets.
3. Vértices da malha deformados de fato em todos os clipes, conforme `animation_test_metrics.json`.
4. Renders e GIFs rotulados como **"deformed_real"** saem de vértices deformados do **GLB v02 real**, não de imagem sintética nem de visualização estática disfarçada de animação.
5. Limitação do VTK: ele lista os clipes mas não atualiza visualmente os atores nas tentativas com `UpdateAtTimeValue`; o validador independente é o que prova as mudanças. Reprodução em navegador com Three.js está disponível via `viewer.html`, mas não foi feito teste de performance na Alpha.

## Reconstrução e viewer

Use Python com `numpy scipy pillow vtk`:

```sh
python source/build_rig_v02.py ../v01/serpaduna_v01_blockout.glb
python source/inspect_and_bake_v02.py
python -m http.server 8080
```

Abrir `http://localhost:8080/viewer.html` no navegador (importações Three.js via CDN necessitam Internet). Se rodando no caminho do repositório, mantenha v01 como pasta irmã de v02.

## Estado do fluxo

- Arte conceitual aprovada: **sim**.
- Autorização do diretor para rig e animações: **sim**.
- Exportação + skin + animações v02: **realizadas**.
- Aprovação artística da forma/animações v02: **pendente**.
- Filtro de Qualidade: **pendente**.
- Alpha modificada: **não**.
