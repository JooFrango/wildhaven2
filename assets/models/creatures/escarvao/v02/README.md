# Wildhaven — Escarvão v02 | Esqueleto e animações reais

Versão **animada e com skinning ponderado** construída sobre os três GLBs de blockout v01, sem sobrescrever modelos, atlas UV ou arquivos anteriores.

## Escopo e aprovação

- **V01**: conceito da criatura aprovado para modelagem, blockout publicado em [PR #72](https://github.com/carioca1111/wildhaven/pull/72).
- **V02**: rig e animações solicitados pelo responsável. Movimentos e deformações **aguardam aprovação artística**. PR separado em draft; não integrar à Alpha jogável automaticamente.
- Não foram feitos LOD1/LOD2, colisores, lógica de caça, IK em terreno irregular ou efeitos de areia.

## GLBs reais desta etapa

| Variante | Binário | Polígonos | Ossos de skin | Clips |
|---|---|---:|---:|---:|
| Cobre | `escarvao_cobre_rig_anim_v02.glb` | 3.487 | 51 | 18 |
| Rubro | `escarvao_rubro_rig_anim_v02.glb` | 3.487 | 51 | 18 |
| Oliva | `escarvao_oliva_rig_anim_v02.glb` | 3.487 | 51 | 18 |

Uma malha e um material por variante, com o **PNG de textura incorporado**. Posições, índices, UV, textura e faces do blockout v01 são preservados: o arquivo binário antigo permanece no início do novo buffer glTF, sem modificar sequer um byte.

### Estrutura anatômica

- 1 osso do tronco e 1 da cabeça.
- 4 ossos em cada uma das 8 pernas: coxa, fêmur, tíbia e tarso.
- 5 ossos em cada pedipalpo: base, antebraço, palma e dois dedos articulados independentes.
- 7 ossos na cauda, incluindo suporte do ferrão.
- Total: **51 ossos glTF**, uma skin com `JOINTS_0`, `WEIGHTS_0` e matrizes inversas de bind. Próximo às dobradiças há **dois pesos de influência**; nas peças rígidas uma influência é dominante.

### Clipes GLB embutidos

`idle`, `walk`, `run`, `scuttle_side`, `turn_left`, `turn_right`, `alert`, `threat_display`, `pincer_grab`, `pincer_crush`, `sting`, `tail_sweep`, `burrow`, `emerge`, `feed`, `hurt`, `rest`, `death`.

As rotações possuem canais glTF reais amostrados por keyframes, com interpolação `LINEAR`. O corpo desloca-se apenas para cima/baixo nas ações de escavação, em posição in-place. Não há mecanismo de IK ou deslocamento automático do personagem pelo cenário. Os clipes não implementam por si só dano, veneno ou IA. Eventos de animação e ação são futuros pontos de integração.

## Reprodução, testes e renders

Partindo de uma cópia completa da branch v01:

```bash
python -m pip install numpy trimesh Pillow vtk
python assets/models/creatures/escarvao/v02/source/build_rig.py
python assets/models/creatures/escarvao/v02/source/validate_rig.py
xvfb-run -a python assets/models/creatures/escarvao/v02/source/preview_animation.py all
```

- `source/build_rig.py`: adiciona rig, pesos e animações aos arquivos originais sem alterar a geometria/UV/atlas v01.
- `source/validate_rig.py`: reimporta três GLBs; confere o byte range original, integridade de 51 ossos, 18 clipes, normalização de pesos, matriz inversa de bind, amplitudes de movimento e pose neutra exata.
- `source/preview_animation.py`: amostra os **canais exportados do glTF**, aplica skinning aos vértices, exporta quadros temporários para visualização e os reimporta por **VTK GLTFImporter**. Os PNGs/GIFs são evidências reais do modelo GLB, não ilustrações de IA.
- `manifest_v02.json` armazena SHA256, bytes, número de ossos, triângulos, clipes e canais.
- `validation_v02.json` armazena o resultado dos testes de deformação.

**Atenção artística:** clipes procedurais em v02 são uma primeira passada. Revisar contato dos tarsos com areia, curvatura lateral da cauda, eventual interpenetração de pinças e gesto de ataque. Render bonito não comprova integração na Alpha.
