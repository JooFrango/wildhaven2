# Auditoria independente de desempenho da V04

**Resultado parcial em 27/11/2026.** O descarte do 3D mantinha uma cena inteira alcançável pelo JavaScript. Liberar essa referência reduziu em 210,6 MiB o armazenamento de buffers observado após GC. A vila continua apresentando picos. Não há demonstração de 60 FPS estáveis ou estabilidade por 24 horas.

## Ambiente e controle experimental

Base a2b11e7ed3bb790ec0143c0580b4506e42359805, branch independente audit/v04-extreme-performance. Windows, i7-1165G7, 8 processadores lógicos, 19,73 GiB de RAM, Intel Iris Xe via ANGLE/D3D11, Chromium headless com perfil de teste. A compilação limpa da base reproduziu os nomes de conteúdo dos bundles oficiais index-DxVHWanD.js, scene3d-CxDnVZN4.js e index-CPp9rbPN.css. Para o experimental, o mesmo wh-server.exe serviu o novo dist por WH_CLIENT_DIST. Cache físico de 128 MiB, estado em memória, 28 hexes presentes, perfil gráfico médio e resolução dinâmica original. A simulação permaneceu ativa. A partida, o relógio, os caches e a carga de outros processos podem diferir entre corridas. Há um par de imagens com a mesma configuração de câmera, sem sincronização por tick.

Evidências numéricas em game/build-real-v04/bench/audit-*.json. Durações curtas destinam-se à reprodução de comportamentos e à triagem. CPU por núcleo = segundos de CPU / segundos de parede × 100. CPU da máquina = valor por núcleo / 8. O processo GPU do Chrome também executa código na CPU. Seu tempo de CPU não representa ocupação da GPU.

## Resultados próprios

| Ensaio | Observação |
|---|---|
| Vila original, ×1, 15,65 s | 723 intervalos, 46,73 FPS, 1% low 3,37 FPS. p50/p95/p99 de 17,0/31,4/128,9 ms. 21 intervalos >50 ms, nove >100 ms. Menos de mil intervalos para 0,1% low. Última publicação do jogo com 126 draw calls e 327.861 triângulos. |
| Vila, câmera 140/28/35, orig. → exp. | 56,58 → 54,80 FPS em janelas de ~10 s. p99 36,9 → 38,2 ms. Dois intervalos >50 ms em cada execução. Não há ganho demonstrado de FPS 3D. |
| Zoom experimental | 833 intervalos, 54,61 FPS, 1% low 8,04, p99 58,3 ms, quatro >100 ms. |
| 3D → Econômico, pós-descarte | Base e correção a ~15,0 FPS. Heap JS usado após GC 35,33 → 4,62 MiB. Backing storage V8 213,58 → 2,95 MiB. São contadores separados. O GC foi forçado exclusivamente para diagnóstico. |
| Econômico frio | Apresentador pixel, sem instância Scene3D. CPU somada dos processos do navegador dedicado 1,61% da máquina em ~12 s. A sonda de intervalos depende do objeto 3D e fica indisponível na partida econômica fria. |
| Aba realmente oculta | O navegador ativou uma segunda aba. Nenhum intervalo de apresentação em 12 s. A cena permaneceu em cache nessa janela curta. |
| Segundo plano manual | Shift+F8 suspendeu, manteve o WebSocket e voltou ao laço 3D. Zero intervalos. CPU do navegador 0,42% da máquina em ~10 s. |
| WebSocket | Replay local de 60 mensagens reais incluindo parsing e aplicação. Mediana de 1,52 ms por lote após aquecimento. Hash do estado final no JSON. A amostra é da vila. |
| Servidor original na vila | ×1/5/10/50 efetivos 1,00/4,96/10,01/50,00. CPU do processo em % da máquina 0,08/0,20/0,35/1,13. Working set ~152 MiB, dívida zero nas quatro amostras finais. Dez segundos por escala. P99 publicado é da janela móvel interna, que pode abranger a escala anterior. |

Os números de CPU cliente e servidor provêm de janelas distintas. Atingir as metas de RAM total do jogo ou CPU total durante expedições permanece em aberto. Os testes A/B de descarte usaram a mesma família de cenas da vila e o mesmo binário de servidor. O heap é uma evidência de liberação, não de queda equivalente no working set do Windows.

## Achados por prioridade

Referências abaixo usam linhas da base V04, relativas a game/build-real-v04, salvo indicação. Gravidade considera impacto observado. Não foi confirmado crescimento ilimitado.

| ID | Grau e localização | Causa e evidência | Correção, risco e complexidade |
|---|---|---|---|
| MEM-01 | P1, client/src/main.ts:137,166,252 | Após o descarte de 60 s, a variável local passa a null, mas window.__wildhavenScene retém Actors, caches de GLTF e clones. No ensaio pareado, a depuração ainda alcançava 3 templates e 8 Hunters. | Getter expõe a cena corrente. Zero objetos acessíveis por esse caminho após correção. Custo e risco baixos. Evidência em audit-descarte-base-pareado e audit-descarte-fix. |
| ACT-01 | P1, client/src/actors.ts:141,272,304 | A resolução de template adiciona o clone mesmo quando a entidade já saiu do mapa. LOD pendente pode igualmente reinstalar um ator antigo. Com a malha real do Hunter, retirar o ator antes da microtask deixou um filho sem registro. | Marcar cancelamento no ator e na substituição pendente antes da clonagem. Teste de criação inicial 1 → 0 órfãos. Custo baixo, risco na sincronização das trocas de LOD. Falta teste dedicado à troca de LOD em travessia. |
| VIS-01 | P1 candidato, client/src/scene3d.ts:132 e client/src/actors.ts:123,257 | A carga inicial considera as primeiras 64 criaturas recebidas, deduplica espécies e solicita todos os LODs. O spawn avalia distância projetada antes da clonagem, mas o teste de frustum do objeto pronto vem depois. | Testar fila por espécie/LOD com volumes conservadores e margem baseada na velocidade da câmera. Medir bytes, tempo até primeiro ator e p99 em troca de Hunter. Ganho em campo pendente. Risco de aparecimento tardio, complexidade média. |
| ECO-01 | P1 candidato, server/crates/wh-core/src/game.rs:522,545,641 | Grades e vistas de todas as criaturas são reconstruídas antes do teste de relevância. Congeladas continuam no vetor e entram no índice. O histórico foi de 1.722 a 4.947. A estrutura de regiões já geradas limita respawn por descoberta. | Medir custo por classe antes de mudar o modelo. Separar registro regional persistente e índice ativo, incluindo halo de percepção. Testar reativação com o mesmo ID, RNG, saúde, relações, carcaças e tempos absolutos. Complexidade e risco ecológico altos. |
| BG-01 | P2, client/src/main.ts:247,268 | O segundo plano dependia da visibilidade da aba. Uma janela visível ociosa seguia desenhando. A partida inicialmente oculta ainda entrava na inicialização 3D. | Shift+F8 reaproveita o protocolo fundo e a suspensão. A partida já oculta adia o 3D. Retomada manual verificada. Mudança de modo no meio de um carregamento continua precisando de cancelamento cooperativo. |
| GP-01 | P2, client/src/perf.ts:40,44 | Com cinco consultas pendentes beginGpu deixa de abrir a sexta. endGpu ainda tenta encerrar uma consulta por haver itens na fila. Corrompe a instrumentação. | Parear início/fim por quadro e liberar consultas no detach. Teste com 12 quadros bloqueados gera 5 pares válidos e 5 liberações. Risco baixo. Ganho de FPS não medido. |
| RAM-02 | P2 candidato, client/src/heights.ts:31,48 e client/src/visual.ts:126 | Descarregar TileVis não chama HeightIndex.drop. A grade fica no índice compartilhado. Mesmo o drop existente pode deixar last referenciando a grade. O conjunto está limitado pelo continente, mas cresce com exploração. | Orçamento LRU próprio por bytes para grades, pinos do Econômico e da câmera, invalidação de last e proteção de downloads pendentes. Medir travessia de ida e volta antes de integrar. Risco de recarga e falha de oclusão, complexidade média. |
| MET-01 | P2, tools/bench-modos.mjs:31,57 e client/src/visual.ts:391 | A sonda rAF mede a cadência do navegador. A amostra histórica oculta tem 3.603 callbacks e zero quadros do jogo. Em relevo, nodesVram usa drawnOnce e nodesDrawn usa mesh.visible. Nenhum dos dois consulta residência física. | Medir intervalos no fim do apresentador, usar ativação real de outra aba e verificar document.hidden. Registrar contador do driver quando disponível. Garantir que a própria sonda não acorde o renderizador. |
| MET-02 | P2, server/crates/wh-server/src/main.rs:431,482,507 | O cronômetro do intervalo começa depois de ordens/prefetch e termina antes de persistir e de parte da telemetria. O trabalho por WebSocket ocorre em outra tarefa. | O laboratório mede CPU do processo e threads no Windows. Para custo por conta, separar serialização, diff por assinante e persistência em traces. Complexidade média. |
| MET-03 | P3, tools/test/soak-servidor.mjs e bench/soak-servidor-8h.json | O arquivo pede 480 min, contém 192 amostras e termina em 192,17 min. O nome não demonstra oito horas. | Publicar tempo realizado junto ao solicitado, erros e última amostra válida. Complexidade baixa. |

## Visibilidade e continuidade

A simulação física segue Hunters e carroças no servidor. O cliente recebe uma vista e usa a câmera para escolher terreno detalhado. O horizonte continental é um GLB de abertura. O terreno detalhado tem metadados por hex e nós individuais. Os materiais do hex são carregados como GLB em loadTile. Vegetation carrega protótipos compartilhados e envia instâncias. GLBs de atores são templates com esqueletos e ações por clone. Assim, há seis contagens diferentes: entidades simuladas, presentes no snapshot, instâncias em RAM, objetos na cena, trabalho submetido à GPU e fragmentos que contribuem para a imagem. O histórico não mede diretamente as duas últimas contagens por entidade.

A arquitetura experimental seguinte deveria manter a câmera como consumidora da representação, preservar identidade regional no servidor, priorizar volumes que entram no frustum e descartar conclusões obsoletas antes de parse, clonagem ou upload. A residência física dos 272 hexes deve ser avaliada independentemente das janelas de renderização. A referência de região vizinha pode afetar percepção mesmo quando o animal está fora da câmera.

## Decisões e limites

O ciclo de luz, água, vento, partículas e poses mantém a cena 3D animada mesmo em vila parada. Desligar quadros sem uma regra de invalidação visual testada alteraria a apresentação. Os toggles do laboratório isolam custos e não alteram o perfil entregue. O replay de rede não justifica uma migração para binário. Não há medições suficientes para recomendar WebGPU, WASM, OffscreenCanvas, atlas, impostores, compressão com perdas, paralelização da IA ou reduzir população.

O portátil disponível contém 28 hexes. O volume C: ficou abaixo de 30 MiB livres. Essa máquina não comportava os pacotes adicionais de ~4 GB, compilação Rust e arquivos brutos de perfis extensos na mesma unidade. Os testes independentes desta entrega são curtos. Permanecem abertos: uma leitura exaustiva de todo o material histórico, combate e carroça em campo, tempestade controlada, centenas de criaturas visíveis, 272 hexes, comparativo sincronizado por estado/clima, pressão de memória e GPU concorrente, heaps completos, taxa de alocação, VRAM real, medições de 30 min/2 h/8 h/24 h, testes Rust de integração e segunda máquina. Degradação visual, ausência de vazamentos de longo prazo e cumprimento das metas globais continuam sem certificação.

## Reprodução

Use Node 24, Chrome e duas instâncias do mesmo portátil com WH_BIND distintos. Aponte WH_CLIENT_DIST da segunda para o dist gerado por npm ci e npm run build em client. Abra uma instância dedicada do Chrome com --remote-debugging-port=19224, --user-data-dir em pasta de teste e --headless=new. Execute em game/build-real-v04. O laboratório cria e fecha sua própria aba. Execute apenas um cenário de navegador por vez.

```powershell
node tools/performance-lab.mjs 19224 http://127.0.0.1:18874 descarte 70 base.json
node tools/performance-lab.mjs 19224 http://127.0.0.1:18875 descarte 70 fix.json
node tools/performance-lab.mjs 19224 http://127.0.0.1:18875 cancelamento 1 cancelamento.json
node tools/performance-lab.mjs 19224 http://127.0.0.1:18875 manual 10 manual.json
node tools/performance-lab.mjs 19224 http://127.0.0.1:18875 vila 30 sombras.json sombras
node tools/bench-wire-replay.mjs replay bench/audit-wire-capture.json
node tools/test/gpu-timer.mjs
./tools/bench-windows.ps1 -BaseUrl http://127.0.0.1:18874 -ServerPid 1234 -OutputFile servidor.json
```

Trocar 1234 pelo PID da instância de teste. Cenários adicionais: vila, zoom, alternar, oculto, economico. Para partida econômica fria, incluir ?modo=economico na URL. Para capturar imagem, definir WH_LAB_SCREENSHOT com um caminho PNG. Toggles finais opcionais: sombras, agua, ceu, vegetacao, animacoes, streaming, hud, clima, comunicacao. hud isola o desenho do elemento; animacoes desativa tickMixer dos atores; clima desliga as partículas; comunicacao solicita a cadência de fundo preservando o WebSocket. Cada nova aba restaura o controle original.

O ZIP experimental traz o cliente compilado e um iniciador para usar com o portátil V04 extraído. A execução aponta WH_CLIENT_DIST para o novo cliente. O EXE, as regras, os modelos e o terreno vêm do portátil original. Extraia em pasta separada e arraste a pasta original sobre Iniciar-Auditoria.bat. Endereço local http://127.0.0.1:18879.

## Isolamento dos efeitos na Iris Xe

Câmera 140/28/35, vila, uma janela de dez segundos por condição. A GPU reportou 8,13 ms na última publicação de controle, 6,44 ms com sombras desativadas e 6,02 ms com vegetação/capim desativados. CPU somada do navegador em % da máquina: 25,18%, 20,45% e 17,89%. São leituras exploratórias sob resolução dinâmica e estados da simulação diferentes. Isso orienta perfilar o passe de sombras e a atualização das instâncias na mesma resolução efetiva antes de propor mudanças. O pacote conserva os dois efeitos. Os JSONs preservam cada amostra, inclusive draw calls e triângulos.

Os arquivos audit-descarte-base.json (uma segunda aba interrompeu a permanência no Econômico) e audit-descarte-experimental.json (inicialização falhou durante uma tentativa de interceptar o bundle) ficam como execuções excluídas. A comparação válida usa base-pareado e fix servidos pelo servidor do portátil, com o modo pixel contínuo. O cliente experimental foi testado por HTTP normal.
