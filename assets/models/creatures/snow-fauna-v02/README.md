# Wildhaven — Três criaturas nevadas, revisão de forma v02

**Data:** 16/11/2026. **Status:** blockout real em revisão artística (sem aprovação de forma).  
**Modelos retrabalhados:** Casquim, Tufrino de Gelo e Nevisco.  
**Referências:** cinco conceitos enviados pelo diretor; Torvardo v03 (principal), Mastélio e Garruva v03 (complementares).

A v01 está preservada. Esta revisão reesculpe proporções e estrutura anatômica. 

- Casquim: tórax mais largo, antebraços de escavação volumosos, crânio e bochechas espessos, placas dorsais baixas ancoradas à silhueta, ventre com volume próprio.
- Tufrino de Gelo: tronco e peito arredondados, pescoço e cabeça mais coesos, asas recolhidas e penas laterais com volume, pés amplos de neve.
- Nevisco: tronco compacto, pernas e coxas mais sustentadas, orelhas compridas com seção foliar, chifres menores, rosto e crina corrigidos.

Cada espécie tem **até 3.000 triângulos**, um GLB estático real exportado com textura UV pintada embutida, e três renders independentes (perfil, frente, três-quartos) resultantes da **reimportação do GLB com vtkGLTFImporter**. A cor/marcação da pelagem não usa malhas extras. Os detalhes geométricos dos escudos, penas, patas e tufos representam volume físico.

As partes são algumas malhas de autoria intersectantes exportadas como uma única mesh glTF; isso não prova topologia soldada. A inspeção visual, anatomia para rig, costuras de partes e fidelidade dos conceitos ainda precisam da aprovação do diretor. **Não há rig, skin ou clipes. Não integrar à Alpha.**

## Reprodução

Python 3 + numpy, pillow, trimesh, vtk:

```bash
python source/build_snow_fauna.py
python source/render_snow_fauna.py
```

Os arquivos têm nomes versionados `*_blockout_v02.glb` e `*_uv_v02.png`, com manifesto por criatura e resumo no `manifest.json`.
