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
| Triângulos | 2.688 (teto autorizado: 4.000) |
| Malhas | 1 |
| Materiais | 1 |
| Texturas embutidas | 1 (atlas UV 1024×1024) |
| Skins / ossos / clipes | 0 / 0 / 0 |
| Comprimento (bounding box) | 16,16 m |
| Largura | 7,48 m |
| **Altura do corpo (linha do dorso no ombro)** | **5,16 m** |
| **Altura máxima com a vela dorsal dominante** | **6,85 m** |
| Bytes do GLB | 843.564 |
| SHA-256 | `204259eeee53cd95b204f4fcbc013445239a3ae7be6a5346857f5056e127e27d` |

A altura do corpo e a altura máxima das velas são grandezas diferentes e estão
registradas separadamente, conforme o pedido. As proporções vieram de medição da
arte conceitual, não de estimativa: ver `RELATORIO-CORRECOES.md`.

## Orçamento de geometria

2.688 triângulos, abaixo dos 4.600 da v03 e do teto de 4.000 autorizado pelo diretor.
A contagem baixa **não** veio
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

## Rig, skinning e animações — etapa seguinte, entregue a pedido

O diretor pediu as animações antes de aprovar a forma. Elas foram feitas sobre o
blockout v04 sem alterar o GLB estático. **Publicar animação não aprova o blockout**:
se a forma mudar, o rig e os clipes precisam ser refeitos sobre a forma aprovada.

- GLB animado: `fulgaronte_v04_animado.glb` — 1.993.632 bytes, SHA-256
  `59a9eb8d456fcfd2ea031c3ec8aae0409e64445638ef2b62849c3371eb6274b1`.
- Projeto editável: `source/fulgaronte_v04_animado.blend`.
- Gerador: `source/rig_animate.py`. Validador: `source/validate_animado.py`.
- Manifesto da etapa: `manifest-animado.json`.

Esqueleto de **36 ossos**: cadeia quadril–espinha–tórax–pescoço–cabeça, mandíbula
articulada, seis ossos de cauda, três de vela dorsal e, por lado, ombro, braço,
antebraço, mão, membrana do antebraço, pélvis, coxa, canela e pé.

Deformação é **skinning com pesos reais**, até dois ossos por vértice, com queda
suave por distância ao segmento do osso. Não são pivôs rígidos. Os 6.560 vértices
do arquivo reimportado têm peso; nenhum ficou solto. Dentro da cabeça os pesos não
são decididos por distância: um plano ao longo da boca aberta separa crânio de
mandíbula, senão os dentes superiores seguiriam a mandíbula.

### Clipes (24 fps, lidos do binário reimportado)

| Clipe | Segundos | Quadros | Conteúdo |
| --- | ---: | ---: | --- |
| `idle` | 4,00 | 96 | respiração, cauda lenta, movimento ocasional da mandíbula |
| `walk` | 2,04 | 49 | marcha de quatro tempos, membros diagonais, rolagem do tronco |
| `swim` | 2,54 | 61 | membros recolhidos, ondulação lateral do corpo e da cauda |
| `feed` | 3,00 | 72 | cabeça desce à carcaça, duas mordidas, retorno |
| `alert` | 2,00 | 48 | cabeça e velas erguidas, boca entreaberta |
| `hit_react` | 1,50 | 36 | recuo curto ao golpe e recuperação |
| `rest` | 3,00 | 72 | deita sobre o ventre, membros dobrados, respiração lenta |
| `death` | 3,00 | 72 | cambaleio, pernas cedem, tomba de lado e assenta |
| `electric_charge` | 2,50 | 60 | firma o corpo, ergue as velas e empina para descarregar |

`electric_charge` é **pose e deformação apenas**. Não há VFX elétrico, partículas,
luz nem lógica de combate nesta revisão.

### Evidência

`previews/animacao/clipe_<nome>.png` traz quatro quadros de cada clipe e
`previews/animacao/clipes_todos.png` reúne os nove. Todos saem do GLB animado
reimportado do disco por `source/render_clips.py`, com câmera, escala ortográfica e
iluminação fixas. Não houve teste em viewer de navegador nesta máquina.

### Pendências desta etapa

LOD0/LOD1/LOD2 não foram produzidos. Não há ciclo de corrida, virada, ataque com
mordida direcionada nem transições entre clipes. Os pés não têm trava de contato
com o solo: o deslizamento aparece em deslocamento de raiz, que deve ser dirigido
pelo código do jogo. Integração na Alpha não foi feita.

```bash
blender --background --factory-startup --python source/rig_animate.py
blender --background --factory-startup --python source/validate_animado.py
blender --background --factory-startup --python source/render_clips.py -- fulgaronte_v04_animado.glb previews/animacao
```

### GIFs dos clipes

`previews/animacao/gif/<clipe>.gif` — 24 quadros, 420x300, gerados por
`source/make_gifs.py` a partir do GLB animado reimportado. A máquina de build não
tem ffmpeg nem ImageMagick e o Blender não escreve GIF, então o GIF89a é montado
no próprio script: paleta por popularidade num grid de 5 bits por canal, tabela de
consulta para o mapeamento e codificação LZW. Há banda de cor visível nos degradês,
efeito dos 256 cores do formato.

```bash
blender --background --factory-startup --python source/make_gifs.py -- fulgaronte_v04_animado.glb previews/animacao/gif
```
