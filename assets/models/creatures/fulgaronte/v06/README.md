# Fulgaronte v06 — revisão dos movimentos orgânicos

**Status:** revisão técnica para aprovação do diretor; não aprovada/finalizada.

## Problema resolvido nesta revisão
A v05 tem 22 clipes funcionais, mas vários usam oscilações isoladas e poucos canais. A v06 refaz a coreografia de oito clipes prioritários usando poses com antecipação, ataque, desaceleração, inércia e recuperação. Mantém os outros 14 clipes intactos.

### Oito movimentos prioritários
- `heavy_walk`: marcha de quatro tempos (ordem esquerda dianteira, direita traseira, direita dianteira, esquerda traseira), fases de suporte/balanço, joelho, tornozelo, oscilação do tronco e atraso cervical.
- `charge`: aceleração corporal, passada mais agressiva.
- `swim`: onda lateral da coluna à cauda, membranas e membros em esforço coordenado.
- `bite_heavy`: preparação, retração, abertura, avanço, fechamento, sacudida e recuperação.
- `tail_sweep`: giro preparatório, propagação retardada da cauda, golpe e amortecimento.
- `overload_warning`: três pulsos de tensão crescentes, posição defensiva e sinais corporais.
- `overload_burst`: compressão, descarga física, extensão e recuo.
- `overload_recovery`: exaustão e tremores que desaparecem.

## Metas e honestidade técnica
- O **GLB preserva exatamente a malha, UV, textura e skin da v05**, com 2.476 triângulos, 29 ossos e 22 clipes; altera somente os canais de oito clipes e acrescenta bytes.
- Os movimentos são **in-place** e calculados em keyframes glTF reais.
- **Ainda não existe IK/foot-lock corretivo de terreno no runtime**: as fases de apoio são aproximações autoradas em keyframes, sem resolução de contato físico.
- Eletricidade e arremesso continuam sendo lógica/VFX pendentes, não imagens de raios no GLB.
- Testar visualmente os GIFs reais e a compatibilidade com os laboratórios antes de aprovação; não declarar combate orgânico só pelo clipe.
- Nenhuma alteração em `game/alpha01`, nem overwrite de v04/v05.

**Código de construção:** `source/build_motion_v06.py`; **validador independente:** `source/validate_motion_v06.py`; **prévia real:** `source/preview_cpu.py`. O workflow grava o GLB + GIFs diretamente na branch, sem usar storage de artifacts.
