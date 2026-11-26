# Wildhaven — Brejáveo v03 / blockout reconstruído após rejeição visual

Status: **conceito aprovado; forma 3D v01 e rig v02 rejeitados visualmente pelo diretor**.
Esta v03 é nova proposta estática e **aguarda avaliação; não finalizada**.

## Procedência
- Arte original fornecida e aprovada pelo diretor: `conceito-aprovado.png`.
- Referências visuais: Torvardo v03 (principal), Mastélio v03 e Garruva v03 (complementares).
- GLB rejeitado v01 e animado v02 ficam preservados, sem sobrescrita.
- Projeto de destino: `carioca1111/wildhaven-new`, em branch própria.
- NÃO alterar Alpha, IA, mapa, esqueleto ou clipes v02.

## Correções geométricas
1. Asas dianteiras agora ficam dobradas e varridas para trás, com ossos digitais reais sustentando membranas UV, sem espigões verticais de lona.
2. Pescoço passa a ter afunilamento e encaixe no tórax; o tronco está mais baixo e largo.
3. Crânio em cunha reptiliana, olho mais encaixado e chifres mais inclinados para trás.
4. Membros traseiros e anteriores possuem seção mais contínua até o apoio; patas adaptadas à lama.
5. Mancha arroxeada e gradação verde-ventre são pintadas no atlas UV. Não há malhas que representem coloração.
6. A língua fica recolhida no blockout, sem golpe animado.

## Limitações / revisão artística
- Esta é uma reconstrução procedural **mid-poly**, não um esculpido de acabamento final. Rever especialmente dedos alares e continuidade da membrana antes do rig.
- Com as asas dobradas, a largura visível do blockout **não representa a envergadura em voo**.
- O rig v02 foi criado sobre a anatomia rejeitada e **não é reutilizável sem novo skinning**.
- Ausentes nesta etapa: juntas, skins, animações, LODs, IA, IK, colisores de combate e integração na Alpha.
- Evidências são screenshots de VTK da geometria do **GLB exportado e reimportado**, não AI art.

## Reproduzir

```bash
python source/build.py
python source/render.py
```

Requer `numpy`, `Pillow`, `trimesh`, `vtk`.
O build gera `brejaveo-v03-anatomia-blockout.glb`, o atlas UV e `manifest.json`.