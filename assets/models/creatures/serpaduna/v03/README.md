# Serpáduna v03 — correção de pose enrolada

O repouso inicial da v02 estava permanentemente em espiral. A v03 reorienta a malha corporal e as matrizes de bind da skin axial para uma pose estendida, mantendo 72 juntas, 4 morphs UV e 8.198 triângulos. Animações existentes foram refeitas; `coil_enter` e `coil_exit` permitem enrolar/desenrolar pela animação, sem forçar enrolamento na bind pose.

O script `source/build_v03.py` lê o v02 existente como `../v02/serpaduna_v02_rig_animated.glb` e gera o GLB v03 versionado. Não substituir as versões anteriores, não modificar a Alpha. Revisão artística e Filtro de Qualidade pendentes.

A fonte e o manifesto podem estar publicados antes dos binários; só considerar a etapa publicada quando o GLB real e os previews forem recuperados e conferidos remotamente.
