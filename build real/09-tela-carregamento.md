# 09 — Tela inicial de carregamento: corrida pixel-art

**Estado:** direção de arte proposta pelo diretor em 23/11/2026; protótipo independente do Codex V02 incorporado em `loading-screen/v02/`, com três cenas executáveis; integração no jogo ainda não implementada.

## Referência do diretor [CONFIRMADO]
A imagem-esboço enviada em 23/11/2026 mostra uma moldura/tela, uma **barra horizontal de progresso** e dois marcadores que devem ser **sprites pixel-art animados**, não círculos: **azul = Hunter correndo**, **vermelho = Varrisco correndo**. Os personagens **acompanham o carregamento**. Este conceito substitui, para a mecânica, a tela estática de carregamento anterior de acampamento.

A renderização conceitual gerada nesta conversa é **arte de referência, não um asset integrado** nem render de modelos GLB. O sprite do Varrisco na versão final precisa seguir a aparência do **Varrisco aprovado** no repositório, não uma criatura genérica.

## Comportamento funcional esperado [CONFIRMADO + PARÂMETROS PROPOSTOS]
- A tela aparece **quando o jogador entra e o jogo ainda está carregando**.
- A barra horizontal representa o **progresso real** do carregamento; não apenas um ciclo falso de porcentagem.
- Um Hunter pixel-art corre na parte **superior/adjacente à barra**, na posição identificada pelo marcador azul do esboço.
- O Varrisco pixel-art corre na parte **superior/adjacente à barra**, na posição identificada pelo marcador vermelho do esboço.
- Os sprites têm **animação de corrida em loop**; o **deslocamento horizontal é sincronizado ao progresso real**. Não é suficiente animar os pés enquanto ficam imóveis durante toda a carga.
- Manter os sprites visualmente distintos da barra e um do outro; a velocidade visual deve acompanhar as mudanças de porcentagem de forma suave, inclusive em carregamentos com pausas.
- **Interpretação proposta:** Hunter corre à frente enquanto Varrisco o persegue; definir o afastamento exato e qual sprite deve ficar sobre a ponta do preenchimento ao validar a arte final.

## Recomendações técnicas para navegador [PROPOSTO]
1. Carregar imediatamente elementos extremamente leves da interface, evitando depender dos GLBs completos para exibir a tela.
2. Gerar **spritesheets pequenas** de Hunter e Varrisco com poucos quadros, textura compartilhada por personagem; manter pixel art nítida (pixelated/neighbour). Preferir arquivos compactos.
3. Renderizar UI com HTML/CSS e/ou canvas 2D; sprites usam animação em frames e posição derivada de `loadProgress` (0..1), sem cenas 3D pesadas.
4. Medir progresso por tarefas reais (manifesto de assets, carregamento/descompactação de GLBs/texturas, inicialização do mundo e simulação), com pesos acordados; nunca declarar 100% se o jogo ainda não estiver pronto.
5. Se uma etapa não informar porcentagem confiável, mostrar estado **'Preparando...'** em vez de inventar progresso.
6. Respeitar redução de movimento quando ativada; pausar animação quando aba estiver oculta; não consumir processamento em loop intenso.
7. A transição deve acontecer apenas quando Hunter, câmera, terreno mínimo e controles de UI estiverem preparados, evitando tela preta e personagens ausentes.

## Entrega independente do Codex — três cenas disponíveis [ARQUIVOS VERIFICADOS]
- **Montanhas:** Hunter perseguido pelo Varrisco — [captura](loading-screen/v02/review/tela.png).
- **Dunas:** barco em fuga do Arenoceto — [captura](loading-screen/v02/review/dunas.png).
- **Savana:** Velsari em fuga do Gravarto — [captura](loading-screen/v02/review/savana.png).
- [Protótipo, instruções e testes](loading-screen/v02/README.md). As três cenas pertencem a uma única página `index.html`; parâmetros `?cena=hunter`, `?cena=dunas`, `?cena=savana` ou sorteio padrão.
- Os sprites/capturas são pixel art, não renders GLB. **Não está conectado ao jogo**.

## Critérios de aceitação
- [ ] Tela abre no primeiro acesso ao jogo enquanto os recursos carregam.
- [ ] Barra reflete estados de carregamento verdadeiros.
- [ ] Pixel art **Hunter azul na referência** e **Varrisco vermelho na referência** substitui os círculos da imagem original.
- [ ] Ambos correm com frames animados e acompanham horizontalmente o progresso.
- [ ] Quando uma tarefa demora, animação de corrida continua sem avançar falsamente o percentual.
- [ ] O Varrisco final é baseado em arte/modelo oficial real; conceito não é apresentado como render de GLB.
- [ ] Ao terminar, entra no jogo sem cortes ou travamentos visíveis.
- [ ] Funciona nas resoluções desktop prioritárias, sem quebrar proporções.
- [ ] A Alpha e os modelos aprovados não são modificados durante esta etapa de documentação.

## Decisões ainda abertas
- Pixel art simples fiel ao rascunho ou moldura fantasia ornamentada como a HUD?
- O Hunter fica à frente e Varrisco atrás, ou os dois avançam para posições distintas?
- Porcentagem numérica e dicas de loading na UI: opcionais, precisam de aprovação.
- Assets finais de sprite e números de quadros/velocidade; confirmar silhueta canônica do Varrisco.
- A arte gerada na conversa precisa ser publicada como arquivo binário separadamente se for aprovada; esta entrega **não inclui PNG/GIF no GitHub**.
