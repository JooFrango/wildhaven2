# Fulgaronte v05 — rig esquelético experimental + 22 clipes reais

## Estado e autorização
O diretor solicitou explicitamente: "O Claude ja fez, agora aplique as animações nele, estamos usando o novo modelo de animações" em 16/11/2026. A geometria de origem é o **Fulgaronte v04 da PR #38**, ainda sujeito à avaliação artística. Esta revisão v05 é **animação para revisão**, não uma aprovação técnica/artística final.

## Procedência e preservação
Base binária **sem alterações**: `../v04/fulgaronte_v04_blockout_fiel.glb` da branch `feat/fulgaronte-fidelidade-conceito-v04`; Git blob original `08f6dc37e5664001b6c69cd4484bbaf69c5532dd`.
A v05 preserva os primeiros 828.812 bytes do buffer BIN, inclusive atributos de malha, índices, UV e textura embutida, e apenas **acrescenta** JOINTS_0, WEIGHTS_0, matriz inversa e animações. Não substitui a v04.

## Rig
- 29 juntas hierárquicas: raiz, quadril, coluna, ombros, pescoço, cabeça, mandíbula, 7 juntas de cauda, membros anteriores/posteriores e membranas peitorais.
- Uma skin glTF com pesos de até 4 influências normalizados por vértice.
- 2.476 triângulos originais; 6.184 vértices; 1 malha / 1 material / 1 textura UV.
- Os pesos são um primeiro ajuste procedural aproximado às regiões anatômicas da v04. **Não há IK nem foot-lock embutido**; os pesos de nadadeiras e mandíbula requerem inspeção visual.

## Animações
Clipes embutidos no GLB: `idle`, `heavy_walk`, `charge`, `turn_left`, `turn_right`, `swim`, `swim_fast`, `dive`, `surface`, `alert`, `roar`, `bite_heavy`, `tail_sweep`, `body_slam`, `shock_bite`, `overload_warning`, `overload_burst`, `overload_recovery`, `injured`, `death`, `rest`, `feed`.

O novo esquema de animação do Wildhaven tem três camadas:
1. **Esquelética** — implementada aqui em clipes do GLB.
2. **Correções procedurais/IK** — contrato em `animation-layer-contract.json`; NÃO implementadas no runtime.
3. **IA tática de combate** — contrato de intenções e janelas; NÃO integrada à Alpha ou aos laboratórios.

O ataque elétrico e a sobrecarga geram postura e timing corporal; raios, colisões, arremessos e estado de choque **não foram implementados**. Nenhuma captura/animação de combate foi declarada fisicamente validada.

## Auditoria e limitações
O GLB foi montado a partir dos bytes originais e reimportado estruturalmente no gerador independente, com 29 nós skin, 22 clipes e índices originais. Falta rodar o validador Python em playback/render e verificar a qualidade das deformações, ground-contact, loops, interpenetrações e a fidelidade visual — **não considerar finalizado**.
Publicação binária usa objeto Git próprio e branch independente; manifesto inclui Git blob SHA e tamanho. O SHA-256 deve ser calculado pelo validador, sem inventar um valor.
Nenhum mapa ou arquivo da Alpha foi alterado.

## Próximas validações necessárias
Executar `python source/validate_rig_v05.py` nesta pasta (Python 3, bibliotecas padrão), então verificar no visualizador 3D:
- patadas sem deslizamento e membranas sem interpenetração;
- boca, cabeça e cauda em impactos;
- começo e fim de clipes repetíveis;
- transições específicas da descarga e recuperação.
