# Sirocauro v02 — protótipo de rig e animações

Continuação isolada da forma pesada v01 (PR #36). O GLB original v01 permanece inalterado.

**Camada 1 implementada em protótipo:** skin real (atributos glTF JOINTS_0, WEIGHTS_0; 27 ossos, até 4 influências), 41 clipes esqueléticos nomeados, preservando bytes de geometria e texturas do GLB v01. Movimentos são curvas programáticas experimentais, **não animações refinadas manualmente no Blender/Cascadeur**. Não declarar qualidade artística validada.

**Camada 2 pendente:** IK de pés em solo e encostas, balanço e apoio dinâmicos, transições, colisões, motion warping e sincronização root motion com simulação.

**Camada 3 pendente:** ligar aos estados da IA v05, fingimentos, esquiva física, agressão, agarrão com contato, ferimentos regionais e aprendizado durante a luta. O clipe sozinho não causa dano, areia ou fogo.

Validação automática realizada na geração: estrutura GLB2, 6238 triângulos, 18714 vértices, 27 ossos, normalização de pesos, canais e 41 clipes. Sem validação visual real no navegador, reimportação independente no Blender nem aprovação QA.

Reproduzir com Node: `node source/build_v02.cjs ../v01/sirocauro-v01-anatomia-pesada-blockout.glb sirocauro-v02-rig41-LOD0.glb`.

Não alterar Alpha. Não fazer merge automático. Revisar forma e anatomia deformada antes de novas etapas.

## Visualização local

Abra a pasta v02 em um terminal, execute `python -m http.server 8000` e acesse `http://localhost:8000/viewer/`. A página importa Three.js via CDN, carrega o arquivo GLB publicado e permite trocar os 41 clipes, a velocidade e as vistas. Esta visualização não substitui a inspeção visual real, ainda pendente.

## Verificação de integridade

Consulte `validation.json`: o GLB foi rebaixado do GitHub e inspecionado após publicação, incluindo 41 clipes, 314 canais, pesos de skin, normas de quatérnions e preservação byte a byte do BIN original v01. Hash SHA-256 verificado contra manifesto.
