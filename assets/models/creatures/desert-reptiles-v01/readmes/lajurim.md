# Wildhaven — Lajurim v01 | blockout facetado com textura pintada

**Etapa:** forma 3D para avaliação artística. Animado: não. Integrado à Alpha: não.

- Herbívoro pequeno do rocky_desert de Auralis.
- Defesa principal: `wedge_brace_in_rock_crevice`.
- Comprimento de design: 0.7 m; massa de design: 3.0 kg (não medidas reais).
- GLB real: `lajurim-v01-textured-blockout.glb` | 3647328 bytes | 1588 triângulos | SHA-256 `e858c8fdde62ae670abfc988c3607a96b9b7984f5e4332ab3e4e12a340a618f7`.
- 1 mesh, 1 material PBR, 1 UV atlas 2048x2048 incorporado no GLB, pinturas de coloração, sem malha geométrica para manchas.
- 0 skins, 0 juntas, 0 clipes, 0 LODs adicionais. Sem deformação ou animação nesta etapa.
- Perfil, frente e três-quartos real obtidos reimportando o mesmo GLB; hash vinculado no `manifest.json`.

**Referências**: Torvardo v03 (PR39), Mastélio v03 (PR42), Garruva v03 (PR44), e instruções oficiais do repositório.

**Estado**: ficha/conceito do conjunto encaminhados para aprovação; usuário autorizou blockout. Formas v01 ainda aguardam avaliação visual específica, sem aprovação final automática.

## Reproduzir

Python 3.12; numpy 2.3.5, pillow 12.3.0, trimesh 4.11.1, vtk 9.6.2.
Código compartilhado: `assets/models/creatures/desert-reptiles-v01/source/`.

```
python assets/models/creatures/desert-reptiles-v01/source/build.py --species lajurim
xvfb-run -a python assets/models/creatures/desert-reptiles-v01/source/render.py --species lajurim
python assets/models/creatures/desert-reptiles-v01/source/validate.py --species lajurim
```

Para gerar diretamente nos caminhos canônicos, definir `WILDHAVEN_MODELS_ROOT=$PWD/assets/models/creatures`.

### Limites do blockout

Anatomia simplificada (especialmente dedos, encaixes das juntas, placas e rosto). O arte-final e movimentos reais serão produzidos somente depois da aprovação específica desta forma. Manchas são exclusivamente uma pintura UV, distinta da geometria funcional. Não modifica mapas, outras espécies ou código da Alpha.
