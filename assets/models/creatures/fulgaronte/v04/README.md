# Fulgaronte v04 — reconstrução para fidelidade à arte conceitual

## Estado de aprovação

- Conceito do Fulgaronte (`Predador anfíbio de couraça serpentina`): **aprovado pelo diretor**.
- Blockouts v01, v02 e v03: **reprovados visualmente** pelo diretor.
- Blockout v04: **nova proposta para avaliação da forma**. Não aprovado, não finalizado.
- Refinamento, rig, skinning, animação, VFX elétrico, LODs, combate e integração na Alpha: **não realizados**.
- v01, v02 e v03 permanecem sem alteração. Nenhuma mudança em mapas, outros animais, sistemas de IA ou `game/alpha01/`.

## Base de trabalho

- Branch-base: `feat/fulgaronte-reconstrucao-v03`, repositório `carioca1111/wildhaven-new`.
- A branch v03 **não contém o GLB binário** da v03, nem fonte nem manifesto: só
  `v03/previews/Fulgaronte_v03_3_Vistas_GLb_Real.jpg`. O diretor forneceu o arquivo
  `Fulgaronte_v03.glb` (650.448 bytes), que foi usado apenas como objeto de diagnóstico.
  A v04 **não reaproveita a geometria da v03**: a malha foi reconstruída do zero.
- Referência artística principal: a imagem de conceito aprovada, copiada para
  `previews/comparacao/conceito_predador_anfibio_couraca_serpentina.webp`.
- Nenhuma ferramenta de imagem-para-3D, nenhum conversor automático e nenhuma imagem
  gerada por IA foi usada como evidência de modelagem. Todos os renders saem do GLB real.

## Métricas (lidas do GLB reimportado — ver `manifest.json`)

| Item | Valor |
| --- | ---: |
| Triângulos | 2.476 |
| Malhas | 1 |
| Materiais | 1 |
| Texturas embutidas | 1 (atlas UV 1024×1024) |
| Skins / ossos / clipes | 0 / 0 / 0 |
| Comprimento (bounding box) | 16,02 m |
| Largura | 6,50 m |
| **Altura do corpo (linha do dorso no ombro)** | **4,96 m** |
| **Altura máxima com a vela dorsal dominante** | **6,65 m** |
| Bytes do GLB | 830.264 |
| SHA-256 | `0e0422bdb6e9ba708b71c892f00100d02024cebd86bf6bdc1b00e717b7b37cf8` |

A altura do corpo e a altura máxima das velas são grandezas diferentes e estão
registradas separadamente, conforme o pedido. As proporções vieram de medição da
arte conceitual, não de estimativa: ver `RELATORIO-CORRECOES.md`.

## Orçamento de geometria

2.476 triângulos, abaixo dos 4.600 da v03 e dos 5.000 pedidos. A redução **não** veio
de cortar estrutura: veio de remover geometria que não mudava a silhueta — fileiras de
placas idênticas aplicadas sobre o corpo, que apareciam nos renders como colagem de
peças soltas. A couraça da v04 está nos planos facetados do próprio tronco e no padrão
de placas sobrepostas pintado no atlas UV. Há folga de orçamento para devolver
geometria de couraça na etapa de refinamento, construída **dentro** da superfície.

## Arquivos

- `fulgaronte_v04_blockout_fiel.glb` — GLB estático real, textura embutida.
- `fulgaronte_v04_uv_albedo.png` — atlas UV exportado à parte, para edição.
- `manifest.json` — métricas lidas do binário reimportado.
- `source/fulgaronte_v04.blend` — projeto editável.
- `source/build.py` — gerador paramétrico completo.
- `source/render.py` — renderizador: importa o GLB do disco e gera perfil, frente e três-quartos.
- `source/validate.py` — reimporta o GLB, valida a estrutura e escreve o manifesto.
- `source/concept_profile.py` — medição da silhueta da arte conceitual.
- `source/compare.py` — prancha comparativa e sobreposição de silhuetas.
- `source/build_metrics.json` — contagem de faces por parte anatômica.
- `previews/fulgaronte_v04_real_glb_{perfil,frente,tres_quartos}.png` — renders reais do GLB v04.
- `previews/comparacao/` — conceito, renders reais da v03 e a prancha
  `comparativo_conceito_v03_v04.png` (conceito, v03, v04 e sobreposição de silhuetas).
- `RELATORIO-CORRECOES.md` — correções anatômicas feitas e diferenças que persistem.

## Gerar, renderizar e validar

O ambiente desta máquina não tem Python autônomo nem o conjunto `numpy`/`trimesh`/`vtk`
usado pelos geradores da v01 e v02, então o gerador foi portado para o Python embutido
do Blender. O método é o mesmo: seções transversais anatômicas controladas, planos
facetados e cor apenas no atlas UV.

```bash
blender --background --factory-startup --python source/build.py
blender --background --factory-startup --python source/render.py -- fulgaronte_v04_blockout_fiel.glb previews fulgaronte_v04_real_glb
blender --background --factory-startup --python source/validate.py
```

Observação de ambiente: o Blender falha ao gravar em caminhos muito longos no Windows.
Se o `render.py` acusar `cannot save`, renderize para um diretório curto e copie os PNGs.

## Publicação e política

Assets em `assets/models/creatures/fulgaronte/v04/`, branch
`feat/fulgaronte-fidelidade-conceito-v04`, PR em **rascunho**. Nenhuma aprovação
artística da v04 foi inferida. Publicação não equivale a aprovação nem a integração.
