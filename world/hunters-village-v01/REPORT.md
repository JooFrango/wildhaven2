# Verificação da vila dos Hunters

## Geometria

A base contém 170 hexágonos e 437 ligações. `HV_01` acrescenta uma peça e seis ligações. Os 170 centros, caminhos de modelo e GLBs originais foram preservados. Os endereços de leitura da composição integrada usam a montagem local dos binários fixados por SHA-256.

Em cada divisa, o teste leu os triângulos do GLB vizinho e do terreno exportado, verificou os 73 vértices do perfil e interpolou os dois perfis em mais de mil posições. A maior diferença vertical foi **0,0511 mm**. O maior erro nas coordenadas do contorno foi **0,636 mm**. A tolerância pedida era **30 mm**. A maior diferença de inclinação transversal medida foi cerca de 1,1°. A cor de referência inclui o efeito das texturas de albedo dos vizinhos. A diferença máxima de canal RGB linear foi 0,00121 na escala 0–1. [Medições por divisa](tests/geometry.json)

A floresta tem **1.295 instâncias**, distribuídas entre oito exemplares do `FX_20`. O teste projetou cada raiz sobre os triângulos exportados e mediu o afastamento de todos os vértices das copas em relação às divisas. O maior erro de contato da raiz ficou abaixo de 0,5 mm. A copa mais próxima da borda fica a mais de 12 m dela. O terreno detalhado tem 43.846 triângulos. O LOD continental tem 2.362. [Terreno](models/hv_01_terrain.glb) · [Bosque instanciado](models/hv_01_forest.glb)

Os 32 GLBs passaram pelo validador Khronos com **zero erros e zero avisos**. Todos reabriram no Blender. No arquivo editável, zerar a amplitude do relevo mudou o interior em até 19,48 m e manteve a altura da borda. [Validador](tests/gltf-validator.json) · [Teste do arquivo Blender e reimportações](tests/blender.json)

## Custos medidos

| Fase | Triângulos dos exteriores | LOD dos exteriores | Interiores | Triângulos desenhados no núcleo | Chamadas de desenho |
| --- | ---: | ---: | ---: | ---: | ---: |
| Acampamento | 25.675 | 11.992 | 2.324 | 78.815 | 22 |
| Expansão | 37.179 | 16.963 | 3.180 | 91.175 | 28 |
| Estabelecida | 53.972 | 26.283 | 4.096 | 108.884 | 35 |
| Completa | 59.284 | 29.311 | 4.096 | 114.196 | 36 |

As duas últimas colunas incluem terreno, construções e vegetação visível no enquadramento inicial, lidas das estatísticas do Three.js. A câmera próxima restringe a vegetação desenhada ao seu entorno. O bosque completo armazena 1.892 triângulos de protótipos em 109.616 bytes. A repetição integral equivale a 305.476 triângulos. O LOD continental agrupa o bosque em células de 210 m e usa os mesmos exemplares da floresta.

Cada GLB de arquitetura usa um material PBR e três mapas de atlas de 768 × 768 px. O exterior final tem 9,15 MB e seu interior tem 1,61 MB. Os GLBs individuais empacotam as texturas para uso independente. O runtime carrega as duas camadas da fase próxima ou apenas o LOD da fase distante. O mapa continental reutiliza o panorama original de 91,99 MB, carregado sob demanda. No retorno à vila, o teste observou 36 geometrias e oito texturas ativas. [Inventário por GLB, bytes e SHA-256](manifest.json)

O teste do navegador usou Chrome em WebGL por software, com SwiftShader, com janela de 1.152 × 728 px e buffer de desenho de 600 × 379 px. A mediana medida no núcleo completo foi 482 ms por quadro nesse ambiente. O modo por software reduz a resolução interna e desativa sombras dinâmicas. A interface orbital redesenha sob demanda. O desempenho com aceleração gráfica e a memória residente em dispositivos-alvo continuam sem medição. [Resultados do navegador](tests/browser.json)

## Circulação e estado

O teste percorreu uma grade de 0,6 m sobre a geometria real, respeitando os volumes de colisão e os pisos das edificações. Encontrou um caminho da chegada até o interior da entrada dos 6, 10, 15 e 16 lotes ativos nas fases sucessivas. As rotas exportadas usam alturas reais. As seis divisas receberam ensaio geométrico. A passagem para `FX_20` também recebeu ensaio de caminhada no navegador. [Rotas para NPCs](navigation.json)

O teste da passagem confirma que o Hunter pôde atravessar a divisa nos dois terrenos carregados. A troca rápida entre fases manteve só a última solicitada. Reabrir a conta restaurou a fase, e uma segunda conta local iniciou na fase 1. A posição e a orientação são salvas ao sair da caminhada. A persistência testada usa armazenamento local do navegador. A sincronização autenticada entre dispositivos depende do serviço de contas do jogo.


O build de produção da Alpha abriu a vila pela rota normal, alternou as quatro fases e restaurou a conta de teste. [Teste da Alpha compilada](tests/alpha-browser.json)

Um checkout novo de `carioca1111/wildhaven-new` confirmou os mesmos bytes e SHA-256 para 46 arquivos publicados: os 32 GLBs da vila, o Blender editável, seis imagens, o panorama e os seis vizinhos v12. [Verificação remota](tests/remote.json)
