# Som e câmera do Hunter Lab

`apresentacao-combate.js` consome eventos confirmados e posições. Não escreve vida, energia, relógio ou RNG. `ferimento` e `impacto_arma` do mesmo contato produzem um único feedback.

Som inicia desligado. Marque **Som** para desbloquear Web Audio por gesto do usuário. Impactos, metal, passos, esforço e respiração são sintetizados localmente, com volume limitado, distância, até dez vozes simultâneas e descarte dos nós. Sons sintetizados são provisórios; não são gravações de atores.

**Câmera cinematográfica** acompanha o par, com velocidade limitada e tremor curto em impactos fortes próximos. Desmarque para controlar a câmera. O botão Câmera livre também desliga o modo cinematográfico. Pausa não repete eventos. Efeitos e marcadores podem ser desligados independentemente.

Vídeos em resultados/jogador são capturas do canvas real, com áudio Opus capturado do mesmo grafo. A reprodução da simulação é 2× e o limite observado é explicitado.
