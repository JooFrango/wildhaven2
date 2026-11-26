# Wildhaven — Escarvão v01 · Blockout 3D real + três variações UV

**Estado artístico:** conceito aprovado pelo usuário para começar a modelagem; **forma do GLB aguarda aprovação**. Sem rig, animações, LODs, integração no mapa/Alpha ou mecânicas implementadas. Não mesclar automaticamente.

## Escopo
- Espécie: Escarvão, artrópode predador/necrófago territorial do Mar de Dunas.
- Anatomia de arachnídeo estilizado: 8 patas locomotoras, 2 pedipalpos com pinças abertas, cefalotórax, dois olhos principais simplificados, segmentos dorsais e metasoma com ferrão.
- Base local medida por GLB: corpo completo X = 5,21 m, largura Z = 4,05 m, altura Y = 2,68 m. A escala é uma **proposta**, sujeita à revisão artística. Nota: as primeiras estimativas do conceito eram menores.
- Estilo: mid/low-poly facetado com planificação intencional, inspirado no piloto Torvardo v03 do Wildhaven.
- Variações: cobre (dunas douradas), rubro (cânions ferruginosos), oliva (oásis/pedras).
- **Geometria idêntica** em todos os GLBs. Não existem malhas criadas apenas para representar cores/manchas: os padrões são exclusivamente UV numa textura PNG pintada proceduralmente e incorporada à imagem PBR do GLB.

## Entrega real
- `escarvao_cobre_blockout_v01.glb` — malha estática, atlas UV incorporado.
- `escarvao_rubro_blockout_v01.glb` — mesma malha, atlas UV diferente.
- `escarvao_oliva_blockout_v01.glb` — mesma malha, atlas UV diferente.
- `textures/*.png` — atlas editável de 1024 × 1024.
- `previews/escarvao_{variante}_real_glb_{three_quarter,side,front}.png` — PNG de arquivo real renderizado **após reimportação em vtkGLTFImporter**.
- `previews/escarvao_v01_tres_variantes_tres_angulos_GLB_REAL.png` — prancha das nove capturas reais.
- `source/build.py`, `source/render.py`, `source/validate.py` — fonte e testes reprodutíveis.
- `manifest.json` — bytes, SHA-256 e métricas dos modelos. Valores de distância são de prévia e não de jogabilidade.

## Reconstrução

Python 3.13, `numpy==2.3.5 Pillow==12.3.0 trimesh==4.11.1 vtk==9.6.2`:

```bash
python source/build.py
xvfb-run -a python source/render.py  # alternativa: python source/render.py com VTK offscreen
python source/validate.py
```

## Critérios de aprovação da forma
1. Oito pernas com apoio claro no solo, pinças abertas naturais, metasoma com articulações definidas.
2. Crânio próprio, grandes placas não coladas como massinha, proporção equilibrada entre tórax e pinças.
3. Mesmo esqueleto anatômico visual em cobre/rubro/oliva, sem geometria de cor.
4. Caso o usuário aprove a forma: realizar refinamento geométrico/UV e apenas depois rig, clipes e LODs em versões novas.

## Publicação
A geração local não certifica publicação em GitHub. Só considerar publicado após verificar que os três GLBs binários podem ser recuperados pelo GitHub com o mesmo tamanho e SHA-256. No repositório, versionar sob `assets/models/creatures/escarvao/v01/` em branch e PR *draft*.
