# Wildhaven — Arraia-de-Areia v03 (rig e 22 animações)

**Conceito aprovado, forma v01 aprovada, v02 refinado. Etapa v03 autorizada em conversa em 2026-11-09.**

## Entrega
- `arraia-de-areia-v03-rig-animated-LOD0.glb`: **GLB genuíno** com 23 juntas, **1 skin de pesos** e **22 clipes glTF reais**.
- Exatamente 6.576 triângulos / 19.728 vértices com normais facetadas. Malha, índices, mapeamento UV e imagem PNG embutida do v02 foram copiados e verificados como **idênticos**; nenhuma malha adicionada para cor.
- Textura UV Base Color 2048×2048 embutida no GLB, **um só material PBR** (o mesmo v02). O `v01` e o `v02` continuam intactos.
- Os pesos JOINTS_0 / WEIGHTS_0 possuem até quatro influências por vértice, normalizadas, com interpolação nas nadadeiras. Inverse bind matrices de todas as 23 juntas validadas.

## Organização dos ossos
- Root/manto/cabeça/mandíbula/filtro/presas (9 juntas)
- Cauda em quatro segmentos (4 juntas)
- Cinco juntas por nadadeira para ondas progressivas e rig apropriado à natação sob areia (10 juntas)

## 22 clipes implementados
`idle`, `swim_sand`, `swim_fast`, `glide_shallow`, `dive`, `surface`, `burrow`, `turn_left`, `turn_right`, `feed_roots`, `filter_feed`, `scavenge`, `alert`, `threat_display`, `fin_slap`, `tail_sweep`, `charge`, `evade`, `hurt`, `rest`, `death`, `breach`.

## Provas e validação
- `animation-validation.json`: teste **independente** de todos os 22 clipes, interpolação e repetição dos loops, skin real, pesos, inverse bind matrices, preservação exata de malha, UV, índices e textura.
- `manifest.json`: SHA256 do GLB real, bytes, juntas, clipes, contagens e status.
- `previews/`: quatro PNGs de posições animadas reais, prancha com três ângulos e seis GIFs (natação, mergulho, filtragem, ataque com nadadeira, ataque de cauda e emergência) capturados a partir dos canais do GLB exportado.
- `source/build_rig.py` e `source/validate_and_preview.py`: fontes reproduzíveis.
- `source/*`: gerador depende do v02 existente na árvore da branch, não de arquivos fora do GitHub.

### Método de render das animações
O importador VTK 9.6 reimporta o GLB real e suas texturas, porém não movimenta o skin automaticamente. O verificador lê **os canais glTF exportados**, calcula a hierarquia e as matrizes de juntas, aplica CPU linear blend skinning nos vértices da **malha reimportada**, e então renderiza os quadros em VTK. Nenhuma imagem de IA é usada para fingir render real.

### Limites reais
- Rig e clipes publicados para **revisão artística**, sem merge automático.
- Não foram implementados comportamento da IA, colisão dinâmica, deformação da areia, partículas, controle do barco, integração à Alpha ou LOD1/LOD2.
- O movimento de aproximação/deslocamento no mundo pode depender do controlador de gameplay; clipes locomotores são majoritariamente *in-place*.
