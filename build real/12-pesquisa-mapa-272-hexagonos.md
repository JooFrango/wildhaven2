# 12 — Pesquisa técnica: liberar todos os 272 hexágonos na Build Real

**23/11/2026 — PLANEJAMENTO, NÃO IMPLEMENTAÇÃO.** Objetivo do diretor: todas as áreas do continente acessíveis já na primeira build; não alterar Alpha, assets aprovados ou branches experimentais.

## Conclusão

**É tecnicamente viável disponibilizar os 272 hexágonos no navegador com streaming de regiões, LOD e colisão separada dos modelos visuais.** Não é viável carregar todos os GLBs originais simultaneamente. Para chamar cada hex de *jogável*, ele deve possuir terreno físico, transição entre vizinhos, IA, combate/caça conforme bioma e persistência, e não apenas movimentação estratégica sobre um mapa plano.

### Inventário verificado no GitHub
A fonte de verdade do grafo experimental é [auralis-grafo.json](https://github.com/carioca1111/wildhaven-new/blob/feat/regioes-moveis-v023/game/playable-v02/public/data/auralis-grafo.json): **272 nós, 738 arestas, 272 referências distintas a GLB**.

Foi verificada a existência do arquivo correspondente a cada um dos 272 IDs, cruzando o grafo e diretórios reais:
| Origem | Hexágonos | Bytes dos GLBs |
| --- | ---: | ---: |
| 170 GLBs do mundo v12 no repositório `carioca1111/wildhaven`, commit fixo `5865b5d0e92ec3eef541bfb51f3c1d9d7cbeb258` | 170 | 1.328.513.200 |
| Vila (`wildhaven-new`, branch `feat/regioes-moveis-v023`) | 1 | 972.840 |
| Selva/pântano tropical (mesma branch) | 24 | 3.661.944 |
| Litoral (mesma branch, subpasta `models/continente` e pasta `models`) | 77 | 38.851.708 |
| **Total das 272 peças** | **272** | **1.371.999.692** |

O GLB panorama do mundo v12 (91.989.336 bytes) **não** foi contado como novo hexágono. O catálogo de 170 peças do v12 tem estado artístico **“corrected output, awaiting user review”**: presença de GLB não significa aprovação de arte nem colisão pronta. Litoral registra teste de continuidade e abertura WebGL; há 72 peças costeiras novas para revisão artística.

**O que a V02.3 integra de fato:** somente **41 hexes** com terreno físico ativo, a partir de [fontes.js](https://github.com/carioca1111/wildhaven-new/blob/feat/regioes-moveis-v023/game/playable-v02/src/fontes.js). Os demais 231 são tratados como viagem simplificada; os GLBs podem estar no repositório antigo ou em fontes ainda não integradas. O [relatório da V02.3](https://github.com/carioca1111/wildhaven-new/blob/feat/regioes-moveis-v023/game/playable-v02/resultados/v023/RELATORIO.md) registra 21,9 → 60 FPS em movimento 8× no Iris Xe quando parsing físico passou ao Web Worker e foram eliminados downloads duplicados; **não** é uma estimativa do desempenho em 272 hexes.

**Dimensão:** hexágono regular de 5 km entre pontas, raio 2.500 m, área nominal aproximadamente 16,24 km². Total nominal ~4.417 km² incluindo mar/gelos. Não é medição de superfície terrestre caminhável. Seis hexes WG_15 a WG_20 do grafo são `iceberg-sea`, com custo terrestre **null**: a pé não se atravessam. Para dizer literalmente “272 jogáveis”, incluir rota marítima/aérea validada; sem isso, são 266 classificados como terrestres no grafo e seis marítimos que exigem transporte específico (ainda sem gameplay validado).

## Arquitetura recomendada

### A. Manifesto único da Build Real
Cada ID: centro/coordenadas, bioma, caminho e hash dos GLBs de origem, estado artístico, porto(s) de travessia nas fronteiras, tipo de deslocamento permitido, LOD visual, pacote de colisão e versão do conteúdo. Registrar versão/commit e SHA-256 das fontes. A build extrai os GLBs históricos via ambiente seguro, sem incluir credenciais GitHub no navegador. Publicar somente derivados autorizados/versionados em host/CDN apropriado.

### B. Preparação offline do terreno físico
Gerar, **antes de compactar GLBs**, dados de: alturas, água, relevo, rochas/troncos, passabilidade por inclinação, cobertura e malha/pontos de navegação. Validar lado a lado com a classificação de referência do laboratório. **Não** obrigar o browser a reconstruir o terreno da malha visual inteira ao atravessar cada fronteira. O parser atual de `regiao.js` lê atributos GLB por layout específico; ele pode não entender `EXT_meshopt_compression`, Draco ou componentes quantizados. Portanto, **nunca comprimir GLB e presumir que o parser físico antigo seguirá compatível**.

Empacotar blocos físicos com **128–256 m de lado** (proposta para medir). Um bloco de 256 m com resolução de 2 m tem 128 × 128 = 16.384 células, com alturas uint16 de 32 KiB brutos (antes de camadas de água/obstáculos); os chunks devem ter escala/offset, preservar bordas e poder ser agrupados em pacotes para evitar milhares de solicitações HTTP. Não se trata de tamanho medido do arquivo final. **Manter 2 m para física local onde necessário**, coarse 16–32 m somente para planejamento de viagens macro; não usar grade 32 m para confirmar golpes, ravinas, água ou escalada.

### C. LOD e HLOD visual independentes do gameplay
| Faixa de câmera — sugestão, a medir | Material exibido |
| --- | --- |
| 0–1 km | Geometria detalhada do terreno, pedras relevantes, vegetação próxima e Hunters |
| 1–5 km | Geometria simplificada, árvores/rochas agrupadas ou instanciadas, poucos materiais |
| >5 km | HLOD macro, perfis de montanhas, deserto, biomas e costa |

**A câmera escolhe a aparência, o Hunter escolhe onde a física roda**. Não interromper combate fora da vista, nem perder um Hunter ao selecionar outro. Manter silhuetas, altitude, UV/texturas e bordas dos originais; não substituir picos por modelos artificiais. Para visão continental, preparar panorama simplificado por regiões em vez de carregar o panorama bruto de 92 MB.

Instanciar vegetação e rochas repetidas usando `THREE.InstancedMesh` ou `THREE.BatchedMesh`; manter os usos de `EXT_mesh_gpu_instancing` onde suportados. Usar atlas UV, KTX2 quando houver suporte e compactação meshopt/Draco após comparar tempo de decode. Preservar assets canônicos, exportando derivados versionados.

### D. Navegação hierárquica para os 272
**Nível 1:** grafo continental de 272 hexes, A* por bioma e modo de transporte. O custo da V02 é provisório, não deve ser balanceamento final.

**Nível 2:** portais reais de fronteira (passagens viáveis em terreno/encostas, obstáculos, largura, água/rios, costa), gerados a partir das malhas e pacotes físicos. Hexes vizinhos no grafo nem sempre têm passagem física atravessável. Portais separados para Hunter a pé, dodo/carroça e futuras montarias.

**Nível 3:** navegação por grupos de chunks dentro do hex, com acesso à malha fina da região ativa; Recast/Detour tiled-navmesh + TileCache são opções, não substituição automática do grid 2 m existente.

**Nível 4:** posicionamento local, IK, colisões, armadilhas e combate em resolução necessária, sem golpe atravessando terreno ou desaparecimento em bordas.

### E. Regiões móveis de simulação
A V02.3 já usa **1.200 × 1.200 m, passo 2 m, recenter a 250 m da borda e prefetch a 500 m**. Podemos conservar a abordagem e substituir a rasterização de GLB em tempo de jogo por carregamento de chunks físicos pré-computados.

Hunters próximos compartilham região; Hunters distantes mantêm regiões ativas independentes. A simulação continua ao redor do Hunter, mesmo quando a câmera segue outro. Detalhes físicos de confronto não viram “resultado automático” só porque estão longe. Fauna sem Hunter pode usar ecologia agregada e persistência seletiva, preservando IDs, espécimes raros, carcaças, estado e nascimento; evita simular dezenas de milhares de animais em 272 hexes por frame. Mundo congela ao sair, conforme regra atual.

**Identidade mundial:** armazenar posição global com precisão suficiente e usar referencial local na renderização (floating origin). Salvar ordem, entidades, inventário, ferimentos e localização globais; trocar chunk não pode reiniciar ataque ou tarefa.

### F. Streaming sem buracos e sem desaparecimento
1. Precarregar chunks pela rota e velocidade (caminhar, correr, carroça), considerando p95 de rede/decode; frente de carregamento nunca depende apenas da câmera.
2. Workers para descompactar/processar ArrayBuffers, com transferíveis para evitar cópias.
3. Conservar collider/chunk antigo ativo até o novo estar pronto (double-buffer); trocar regiões em evento de commit e não abandonar Hunters na origem.
4. Erro de rede: bloquear provisoriamente a travessia e informar carregamento/retry, **não teletransportar nem declarar que entrou**.
5. Cache LRU com teto configurável e descarte real de geometria, materiais, texturas e ImageBitmaps não mais usados. Objetos compartilhados só saem com referências liberadas.
6. Primeira carga: manifesto e área inicial, nunca os 1,37 GB. Pacotes regionais versionados, CDN e cache HTTP. Se houver bundles com acesso parcial, validar HTTP 206 Range; usar URLs por pacote em caso contrário.
7. Texturas e sprites do modo Econômico podem ser derivados visuais sem mudar passo, IA, colisão, combate ou save.

## Prioridades e riscos
| P | Trabalho | Prova |
| --- | --- | --- |
| P0 | Manifesto de 272 com caminhos, hashes, permissões, aprovação, colisão e biomas | 272/272 verificáveis, nenhum path silenciosamente faltante |
| P0 | Conversão offline de GLBs para alturas, água, obstacles e chunks físicos | Células iguais à referência onde há terreno, sem piso plano inventado |
| P0 | Portais de fronteiras por classe de agente | Conectividade física realmente testada e sem barreira imaginária |
| P0 | Streaming com pré-carga e troca segura | Travessias reais sem teleportar, sumir, cair pelo chão ou perder combate |
| P1 | LOD/HLOD, instancing, KTX2 e meshopt | Reduzir rede, GPU, draw calls e RAM em benchmark |
| P1 | Persistência de fauna/Hunters, seleção de câmera e ecologia | Save/reload, 12 Hunters separados, sem duplicações |
| P2 | Navegação oceânica para seis hexes WG_15–WG_20, se literal 272 for obrigatório | Meio válido de deslocamento com água, barcos e IA de navegação |
| P2 | Ajustes específicos por bioma, QA artístico e performance dos dispositivos | Testes reais antes de afirmar conclusão |

**Riscos descobertos:** 164 v12 GLBs não foram copiados para a branch da V02.3; alguns arquivos têm >20–35 MB; o panorama v12 92 MB não deve ser usado como LOD inteiro; os seis hexes oceânicos não permitem caminhada; `pontosAgua` da V02.3 não é recriado ao recentrar; grids antigos ficam em regiões dormentes e podem elevar memória; muitos modelos históricos aguardam aprovação visual; a classe/altura dos materiais pode variar por versão GLB; o parser físico atual não deve receber GLBs comprimidos visualmente sem suporte.

## Metas de aceitação — ALVOS, NÃO RESULTADOS
- **Cobertura:** 272 IDs no manifesto; cada hex anunciado como jogável passa testes de altura, água, colisão, entrada/saída e persistência. Para seis oceânicos, declarar dependência de barco/voo; sem isso não anunciar “todos jogáveis”.
- **Memória:** não crescer indefinidamente ao percorrer 50, 100 e 272 hexes e voltar; CPU render e sim separados, GPU/texturas descartadas corretamente.
- **Desempenho:** mirar 30 FPS estáveis em preset baixo; perseguir 60 FPS em desktop com vídeo integrado. Medir p95/p99 do tempo de frame e de carregamento. Nenhuma dessas taxas está comprovada em 272 hexes.
- **Rede:** primeiro download é pequeno e proporcional à área inicial; medir bytes reais, não alegar “1,37 GB otimizados em X MB” antes de converter.
- **Fidelidade:** diferenças de altura/posição/borda dentro das tolerâncias do projeto; sem alterar texturas ou GLBs aprovados. Inclinação, rios, desertos e floresta não podem virar planícies genéricas.
- **Regressões:** 100+ travessias e trocas de câmera; 4 a 12 Hunters em regiões distantes; combater na borda, passar em carroça, perseguir criatura, seguir pegada até a água, salvar e continuar; comparar hashes/estado 3D e pixel art.
- **Falha:** conexão lenta, arquivo incompleto ou cache corrompido não pode apagar Hunter nem inventário.

## Proposta de desenvolvimento para primeira Build Real
**Fase 1:** localizar/validar 272 origens, construir pacote e manifesto auditável; automatizar extração de informação física.  
**Fase 2:** regiões móveis e colisão com streaming; passar em sequência entre biomas, sem limite artificial dos 41.  
**Fase 3:** LOD visual, plantas instanciadas e ajustes por GPU.  
**Fase 4:** navegação de carros/dodos/Hunters, fauna e combate; QA de bordas.  
**Fase 5:** oceano/icebergs com transporte adequado e relatório final por hex.

**O prazo de 28/11 é meta, não garantia.** Criar conversores, validar 272 terrenos, corrigir fronteiras, ecologia e água, integrar combate e nav marítima em poucos dias pode não ser realista. Uma liberação em “mapa aberto” é possível antes de um “continente com gameplay completo”; **não confundir os dois níveis**. Toda mudança em código ou arte depende de autorização posterior do diretor.

## Fontes externas pesquisadas
- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html), [BatchedMesh](https://threejs.org/docs/pages/BatchedMesh), [KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html), [descarte de recursos](https://threejs.org/manual/pages/how-to-dispose-of-objects.html)
- [Khronos EXT_meshopt_compression](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Vendor/EXT_meshopt_compression/README.md), [meshoptimizer/gltfpack](https://github.com/zeux/meshoptimizer/blob/master/gltf/README.md)
- [RecastNavigation, TileCache e navegação em tiles](https://github.com/recastnavigation/recastnavigation), [Cesium 3D Tiles e HLOD](https://github.com/CesiumGS/3d-tiles)
- [Web Workers e transferíveis](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers), [HTTP Range](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests), [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance)
