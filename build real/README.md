# WILDHAVEN — BUILD REAL
**Plano da primeira versão jogável | v0.10 | 24/11/2026 | meta: 28/11/2026**

> **ESTE DIRETÓRIO CONTÉM PLANEJAMENTO E UM PROTÓTIPO INDEPENDENTE DAS TELAS DE CARREGAMENTO. NÃO É UMA BUILD JOGÁVEL IMPLEMENTADA.**
> Não alterar `game/alpha01/`, builds anteriores, assets aprovados, branches ou PRs experimentais.
> A build experimental V01/V02 comprovou possibilidades, mas a **Build Real será planejada e desenvolvida do zero** em implementação futura separada.
> Não interpretar as datas como garantia de implementação.

## Intenção
Wildhaven é um jogo de Hunters **autônomos**. O jogador comanda a expedição, seleciona e observa os Hunters, define ordens e administra equipamentos, logística, acampamentos, caçadas e perdas. **O jogador não controla diretamente a movimentação ou os golpes dos Hunters.**

## Decisões confirmadas pelo diretor
- Adotar a HUD ilustrada enviada pelo diretor em 22/11/2026 como **referência visual** (imagem original: `HUD de Wildhaven em português.png`; a imagem ainda precisa ser adicionada como asset ao repositório).
- São **2 carroças na vila**: uma do **Chad** e outra do **Nailon**.
- Cada carroça é puxada por um **dodo** já modelado e transporta **até 6 Hunters**. As duas carroças somam capacidade de transporte de até **12 Hunters**, não um limite aprovado de tamanho de esquadrão no jogo.
- As carroças viajam ao hexágono solicitado, param em terreno limpo ou clareira e montam acampamento.
- No acampamento, Hunters trocam equipamentos, depositam itens obtidos e descansam para recuperação de vida mais rápida.
- Em situação desesperadora (ao menos 1/3 dos Hunters da caçada derrubados e os demais sem chance realista de sair vivos), Chad ou Nailon pode equipar armadura e correr para o resgate. Se um Hunter estiver sozinho na caçada e cair, o socorro também pode ser acionado.
- Resgate não é garantido. O socorrista enfrenta o monstro; se o matar, leva os feridos para se recuperar no acampamento. Pode fracassar. Sem resgate possível ou tempestivo, ocorre **morte permanente do Hunter**.
- Haverá **bestiário**: cada animal avistado cria/atualiza sua página com criatura, **dossiê**, **itens que pode fornecer** e **mapinha das regiões onde vive**; sem duplicatas.
- A página possui botão **Caçar**: jogador seleciona Hunters e escolhe viagem **a pé ou de carroça**. Carroça **custa dinheiro** e leva no máximo **6 Hunters por veículo**.
- Ao chegar ao habitat, Hunter **não recebe localização automática** do animal: procura pegadas invisíveis, que **brilham em azul** depois de descobertas; **água interrompe o rastro**.
- Ao avistar criatura, Hunter monta sua própria estratégia: **aproximação agachada + salto/rodeio atacando com espada**, ou **armadilha + grito para atrair a criatura** e aproveitar alguns segundos de imobilização variáveis por armadilha. Não há sucesso garantido.
- **Hunters não possuem nível geral**: possuem níveis de **habilidades individuais de 1 a 20**, como combate com cada arma, Desvio, Velocidade, Agilidade, Armadilhas e Mineração. Cada nível de combate desbloqueia ataque distinto; Desvio desbloqueia animações e transições; detalhes adicionais propostos no documento 11.
- **Mais cinco habilidades aprovadas:** **Escalada, Primeiros socorros, Rodeio, Furtividade e Rastreamento**, todas 1–20. Seus movimentos e bônus por nível ainda serão definidos.
- **Conhecimento de Monstros aparece somente no Bestiário, mas tem efeito real nas decisões e no comportamento geral da IA dos Hunters**. Não é apenas texto. Distribuição do conhecimento entre Hunters e progressão específica seguem pendentes; não exibir na ficha individual nem conceder onisciência. Ver documentos 04 e 11.
- **Objetivo de expansão para a primeira build:** trabalhar para liberar os **272 hexágonos do mapa** para exploração e, quando aprovados/validados, gameplay detalhado. A auditoria localizou os **272 arquivos de terreno** distribuídos nos dois repositórios (170 v12 no original, 1 vila, 24 sul e 77 costa), total bruto ~1,37 GB. Só 41 estavam integrados na V02.3, não por ausência dos outros GLBs, mas por integração e validação pendentes. Proposta técnica: **compilação offline de colisão, blocos físicos compactos, LOD/HLOD, streaming por Hunter, portais de fronteira e QA**. Seis hexágonos de mar com icebergs precisam de navegação marítima específica. Ver [12 — Pesquisa mapa 272](12-pesquisa-mapa-272-hexagonos.md). Esta é uma meta de produção, **não** entrega já concluída.
- **Modo Econômico é o modo de segundo plano, não uma simulação simplificada**: a apresentação inteira muda para ilustração em pixel art semelhante visualmente a Stardew Valley, com Hunters/criaturas pixelados, acontecimentos e estatísticas ao vivo. A **simulação, IA, física, combate e resultados continuam exatamente os mesmos**. Economia em CPU visual, GPU e memória deve ser comprovada por benchmarks. Navegadores podem suspender abas realmente ocultas; não há garantia de continuidade local com aba minimizada.

- **Otimização de IA — diretriz autorizada em 24/11/2026:** preservar indivíduos e mecânicas, usar níveis de simulação por proximidade e interação dos Hunters (não da câmera), percepção adaptativa, índices espaciais e compartilhamento de dados. Meta econômica de 1.000 simultâneos em uma máquina é hipótese a validar; frequências, proporções e orçamentos em [14](14-ia-adaptativa-otimizacao-servidor.md) são propostas técnicas, não resultados medidos.
- **Clima e calendário universais aprovados posteriormente ao documento 13:** dia de 2h e noite de 40min reais; uma simulação meteorológica compartilhada, independente do congelamento das contas offline. As referências antigas a clima por conta no documento 13 estão superadas por esta decisão. V08 é referência aprovada, não integração comprovada.

- **Otimização gráfica obrigatória — decisão do diretor em 25/11/2026:** a Build Real deve implementar **Frustum Culling, Occlusion Culling e Backface Culling**, com o objetivo de melhorar o desempenho no navegador, inclusive em GPUs integradas, sem degradar a qualidade visual nem alterar a simulação autoritativa. A auditoria encontrou culling de frustum desativado nas malhas de Hunters/criaturas da V02.3 (`main.js`, linha 132), backface culling padrão nos materiais básicos da Alpha e nenhuma implementação dedicada de occlusion culling no código consultado. Corrigir volumes de delimitação de modelos animados e auditar materiais GLB; descartar somente objetos comprovadamente ocultos. Ver critérios obrigatórios no [05 — Roadmap e aceitação](05-roadmap-aceitacao.md). **Não criar laboratório de culling**: validar diretamente na futura Build Real, em cenários representativos. Requisito aprovado, implementação e ganhos de FPS ainda pendentes; não alterar a Alpha ou protótipos anteriores.

## Documentos deste diretório
- [01 — Experiência e HUD](01-experiencia-hud.md)
- [02 — Carroças, dodos e acampamentos](02-carrocas-acampamentos.md)
- [03 — Sistema de resgate e morte permanente](03-resgate-hunters.md)
- [04 — Bestiário e dossiê das espécies](04-bestiario.md)
- [05 — Planejamento da build de 28/11](05-roadmap-aceitacao.md)
- [06 — Caçadas pelo bestiário, seleção e transporte](06-cacadas-pelo-bestiario.md)
- [07 — Rastros azuis e otimização de pegadas](07-rastros-otimizacao.md)
- [08 — IA de furtividade, rodeio e armadilhas](08-estrategias-emboscada-armadilhas.md)
- [09 — Tela de carregamento pixel-art Hunter × Varrisco](09-tela-carregamento.md)
- [10 — Modo Econômico: visualização pixel art da mesma simulação](10-modo-economico-pixel-art.md)
- [11 — Habilidades dos Hunters sem nível geral (1–20)](11-habilidades-hunters.md)
- [12 — Pesquisa profunda: liberar os 272 hexágonos](12-pesquisa-mapa-272-hexagonos.md)
- [13 — Clima dinâmico](13-clima-dinamico.md)
- [14 — IA adaptativa e orçamento de servidor](14-ia-adaptativa-otimizacao-servidor.md)

## Protótipo de carregamento do Codex — 3 cenas [ARQUIVOS REAIS PRESENTES]
- [Pasta do carregamento 16-bit V02](loading-screen/v02/README.md): HTML, CSS, JS Canvas 2D, sprites PNG e testes/capturas. É um protótipo isolado, ainda não conectado à Build Real.
- [Cena 1 — Montanhas: Hunter × Varrisco](loading-screen/v02/review/tela.png)
- [Cena 2 — Dunas: barco × Arenoceto](loading-screen/v02/review/dunas.png)
- [Cena 3 — Savana: Velsari × Gravarto](loading-screen/v02/review/savana.png)
- Selecionar com `?cena=hunter`, `?cena=dunas` ou `?cena=savana`. Sem parâmetro, sorteio.
- Incorporado do PR #107 mantendo o conjunto original e sem modificar a Alpha.

## Política do plano
- **Confirmado** = descrito explicitamente pelo diretor.
- **Proposto** = regra de design sugerida, aguardando aprovação; não tratar como especificação final.
- **Pendente** = precisa de definição/validação técnica e não deve ser inventado.
- A HUD enviada é conceito de interface, **não** prova de implementação.
- Referências: `AGENTS.md`; histórico da V01/V02 (PRs #102/#103) apenas como lições técnicas, não como base obrigatória.
- Os documentos não implementam gameplay. As três cenas do Codex estão presentes como protótipo independente; não houve integração ao jogo, geração de GLB nem mudança na Alpha.
