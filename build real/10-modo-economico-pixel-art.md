# 10 — Modo Econômico ilustrado em pixel art (segundo plano)

**Estado:** pedido do diretor confirmado em 23/11/2026; arquitetura, desempenho e metas sujeitos a protótipo e medições. **Somente planejamento**. Não alterar Alpha, GLBs ou gameplay.

## Especificação aprovada pelo diretor
O **Modo Econômico é o próprio modo de segundo plano**. **Não são três modos**: há apenas o modo visual normal em 3D e a apresentação econômica em **2D/pixel art**, semelhante na linguagem visual a *Stardew Valley*. Ao ativar o modo, **a tela muda substancialmente**, porém o jogo continua mostrando acontecimentos reais e estatísticas.

- Hunter e criaturas **viram personagens em pixel art** na apresentação.
- A tela traz uma **ilustração simplificada e contínua** do que ocorre no mundo real do Wildhaven.
- A **simulação é exatamente a mesma**: IA, eventos, decisões, movimento, posições, visão/olfato/audição, tempo de viagem, busca por pegadas, combate, ferimentos, fadiga, inventário, caça, armadilhas, rodeio, resgates, ecologia, economia, vida e morte permanente **não são simplificados por selecionar o modo econômico**.
- A diferença é **somente de renderização e interface**: não criar uma segunda IA, sistema de combate resumido ou outra tabela de probabilidades para o modo pixel art.
- O modo deve **consumir substancialmente menos recursos do PC do jogador**, sempre que os gargalos gráficos representarem parte significativa da carga. **A economia precisa ser medida, não prometida.**
- O propósito é permitir ao usuário deixar o jogo trabalhando enquanto utiliza o PC em outras tarefas; se a aba ficar oculta ou minimizada, a continuidade **não é garantida por navegadores**, mesmo com Workers.

## Arquitetura recomendada — um único mundo, dois apresentadores [PROPOSTO]
```text
                     NÚCLEO ÚNICO DE SIMULAÇÃO
           estado do mundo, IA, física, combate, nav,
         animais, Hunters, itens, economia, persistência
                                 |
                      snapshots/eventos autoritativos
                                 |
             +-------------------+---------------------+
             |                                         |
       VISUALIZAÇÃO 3D                           VISUALIZAÇÃO PIXEL
      Three.js/WebGL                             Canvas 2D ou Pixi
       modelos GLB                             spritesheets/tiles
       animações 3D                             quadros ilustrados
       luzes/sombras                            UI estatísticas
             |                                         |
   [desativada no econômico]                [ativa no econômico]
```

### Garantia da mesma simulação
- O **módulo simulação** recebe entradas de jogo (ordens) e devolve estado/eventos; **não pode consultar** qual apresentador está ativo para decidir regras.
- Renderizadores 3D e 2D são consumidores *read-only* do estado; a troca de modo não deve reconstruir, reiniciar ou avançar o mundo.
- A simulação usa seu **mesmo passo de tempo**, coordenadas, sementes, colisores, navmesh e políticas de atualização do mundo em ambos os modos.
- Se a física utilizar dados de GLB, separar **colisores/altura/navmesh compactos** dos **meshes de renderização** em uma etapa futura. Isso só é seguro se os dados usados pela simulação forem idênticos.
- A região detalhada deve continuar acompanhando cada Hunter, conforme projeto. **Não** reduzir alcance, taxa de IA, duração de combate ou precisão física por estar em pixel art.
- Mesmo número e identidade de animais e Hunters; não inventar reaparecimentos ou encontros simplificados para manter a tela interessante.
- Sprites são apenas ilustrações de entidades reais: posição 2D derivada da mesma posição de mundo; estados de agachar, caminhar, investigar, atacar, fugir, sangrar e morrer derivados de eventos/estado da IA.
- Os comandos do usuário no modo econômico entram pela mesma fila de ordens.

## Interface econômica [PROPOSTO]
- Centro da tela: **mapa local em pixel art** do terreno/bioma, com Hunters e animais em sprite animado, câmera top-down ou três-quartos; não é mapa separado nem teleporte do mundo.
- Cenários ilustrados baseados em dados locais de terreno, obstáculos, árvores, água e bioma. Exibir posições relativas e encontros efetivos; qualidade artística não compromete precisão da IA.
- Coluna de Hunters: retrato pixel art, vida, resistência, ferimentos, arma, missão, status, hora estimada de deslocamento *apenas quando calculada*.
- Painel de eventos: "Arvo encontrou pegadas", "Varrisco avistado", "Brena montou uma armadilha", "Hunter derrubado", "Chad a caminho", "Espécie registrada no bestiário"; apenas eventos que aconteceram.
- Cards de criaturas reais próximas, HP/estado observado, e situação do acampamento e das carroças.
- Controles essenciais mantidos: pausar/voltar, ordem de caçada, seleção de Hunter, mapa do bestiário; nada de controle manual.
- Diminuição opcional da frequência **visual** (ex.: 10–15 FPS para sprites; painéis 2–4 atualizações/s) **sem alterar** o passo da simulação. Números são sugestões a testar, não taxas de IA.
- Ao retornar ao 3D, carregar modelos e texturas apenas necessários à região observada; mostrar breve transição de carregamento, mantendo a simulação ativa.

## Onde realmente economiza recursos [ANÁLISE TÉCNICA]
| Recurso | Economia esperada | Condição |
| --- | --- | --- |
| GPU/energia gráfica | **Potencialmente grande** | Desligar passagem WebGL, sombras, iluminação, pós-processamento, skinning e meshes; desenhar poucos sprites/tile layers. Sem garantia de % antes de medir. |
| CPU de apresentação | **Potencialmente grande** | Não executar AnimationMixer, traversals, preparação de draw calls 3D, atualizações de matriz/luzes de objetos 3D; desenhar sprites em canvas. |
| CPU da IA/física | **Praticamente sem economia**, como exigido | Mesmo passo e mesmos cálculos. Se IA/física dominarem CPU total, modo econômico pode economizar pouco CPU total. |
| RAM/VRAM | **Variável** | Liberação efetiva de geometria, animações e texturas 3D; se permanecerem carregadas em cache, RAM/VRAM não cairão substancialmente. |
| Rede | **Variável** | Na entrada direta em pixel art, evitar downloads de GLBs de apresentação. Dados de simulação continuam necessários. |
| Bateria | **Pode melhorar** | Redução de GPU/CPU visual, condicionada ao hardware e medições de energia. |

**Limite de Amdahl:** se a IA/física consumirem 70% do tempo de CPU e a visualização 3D 30%, mesmo eliminar quase totalmente o custo visual economiza no máximo perto de 30% do tempo da CPU. Se renderização dominar, a economia total pode ser muito maior. Não converter esses exemplos em resultado medido.

### Evidências do próprio Wildhaven
- PR [#20](https://github.com/carioca1111/wildhaven-new/pull/20) relatou 32,1 → 7,5 ms/quadro em animação no cenário testado, mantendo a impressão digital de simulação `94df59e1` após otimizações de IA/animação. **Isto não é uma medição deste modo econômico.**
- PR [#103](https://github.com/carioca1111/wildhaven-new/pull/103) relatou 58,9 FPS a 1×, 45 FPS a 8×, e 22 FPS quando streaming de GLBs pesava na thread principal; mostra que CPU/streaming e renderização podem ser gargalos. **Não permite inferir porcentagem de economia do modo pixel.**
- PR [#105](https://github.com/carioca1111/wildhaven-new/pull/105) descreveu melhorias 22 → 60 FPS pela leitura em Worker e cache de GLB; reforça que otimização de carregamento continua importante em ambos os modos.
- O próprio protótipo de [loading-screen/v02](loading-screen/v02/README.md) mostra viabilidade de sprites 16-bit + Canvas 2D e múltiplas cenas, **mas não executa a simulação do jogo** e portanto não serve como benchmark de CPU total. Reaproveitar técnicas de sprites, não declarar que seus personagens são todos os modelos aprovados do gameplay.

### Restrições do navegador que precisam ser explicitadas
- **Visível em janela pequena/segundo monitor:** é plausível continuar rodando em baixo consumo, já que a UI econômica continua desenhada.
- **Aba oculta/minimizada, tela do celular bloqueada:** os navegadores suspendem `requestAnimationFrame`, limitam temporizadores e podem congelar abas, inclusive o trabalho com Workers; **não há garantia de tempo real local**.
- Se o requisito virar "continua caçando por horas com navegador fechado/minimizado", exigir execução autoritativa **no servidor** com a **mesma lógica** (ou uma aplicação desktop capaz de manter processo ativo). O servidor acrescenta custo e gestão por conta; não improvisar um cronômetro que simula vitórias fora da tela.
- **Mundo congelado ao sair:** preservar essa regra do projeto a menos que o diretor decida explicitamente alterá-la. Modo econômico não equivale a progresso offline.

## Como demonstrar ganho real [TESTE OBRIGATÓRIO]
Preparar dois modos **sobre o mesmo processo de simulação**, mesmos seeds/ordens/passo do tempo e entidades (ex.: 4 Hunters e fauna dos hexágonos realmente integrados); registrar por 10–15 minutos em cada modo, alternando ABBA, no mesmo PC e carga. Benchmarks repetidos, com aquecimento e resolução idêntica.

Medir:
- `CPU total` do processo/navegador e `CPU simulação` separado de `CPU render/UI`, p50/p95 por frame;
- GPU uso aproximado e **tempo de GPU** quando disponível, draw calls, frames/segundo da UI 2D e 3D;
- RAM JS heap e memória do processo, VRAM quando possível;
- energia/bateria quando possível;
- travadas, entrada em modo econômico e tempo de retorno ao 3D;
- latência de observação na UI versus tempo autoritativo do mundo.

**Paridade mandatória:** resultados de simulação (hash por ticks, snapshots e log de eventos) devem ser iguais em ambas as apresentações com mesma seed/ordens; vidas, dano, morte, recursos, loot, trajetórias e encontros **não podem** divergir. Não comparar apenas FPS nem anunciar economia porcentual não medida.

### Metas sugeridas para aprovação — NÃO MEDIDAS
- Redução clara de uso de GPU (alvo exploratório ≥70% de tempo de renderização da GPU, **somente como objetivo**, nunca resultado);
- Redução de CPU total e RAM suficiente para tornar perceptível trabalhar com outras janelas, a determinar após baseline;
- Ausência de regresso da simulação e de perdas de eventos durante troca de modo;
- Modo 2D legível mesmo com dezenas de entidades, animações simples e eventos;
- Retorno ao 3D sem reiniciar missão/combate ou ressuscitar criaturas.

## Prioridade de implementação sugerida
1. Isolar a simulação do loop Three.js e provar paridade com câmera/renderização desligada.
2. Criar um **apresentador 2D** simples baseado nos mesmos snapshots e eventos; usar poucos sprites e chão por bioma derivados do mundo.
3. Gerar pixel art dos Hunters, criaturas e carroças que forem integrados na primeira versão. Essas imagens **são sprites**, não renders 3D.
4. Criar painel de estatísticas/eventos e comutação 3D↔pixel sem perda de estado.
5. Liberar assets 3D da memória quando vantajoso e reaquecer ao retornar; medir latência.
6. Medir recursos e validar simulação determinística com mesmos eventos/snapshots.
7. Tratar janela oculta como restrição real da plataforma; não prometer progresso contínuo sem execução dedicada.

## Questões não definidas
- Vista top-down tipo *Stardew Valley* ou isométrica pixel art? O diretor indicou estilo similar a *Stardew Valley*, mas não aprovou layout final.
- Mostrar todos os eventos observados na região detalhada ou também um resumo de regiões distantes? Não inventar eventos sem simulação.
- Quantos sprites exibidos e nível de zoom durante caça montada?
- O modo será ativado manualmente, automaticamente com inatividade, ou ambos?
- Quando a aba for ocultada, salvar/preservar estado e congelar até voltar, ou usar servidor dedicado para tempo real? Nenhuma decisão foi dada para alterar o congelamento ao sair.
- Definição objetiva de "consumir muito menos" (CPU/GPU/RAM/bateria) após primeiros benchmarks.
