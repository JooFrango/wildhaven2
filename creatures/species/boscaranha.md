# Boscaranha — Criatura 004 · Wildhaven

**Estado:** dossiê de design e modelo 3D v0.1 **em revisão**, sem implementação de IA/combate.  
**Perfil:** aracnídeo carnívoro do tamanho aproximado de um cachorro, especializado em caçar **Folhiscos** nas florestas temperadas de Auralis.

## Corpo e aparência

- Oito pernas articuladas com garras nas pontas; carapaça de aspecto semelhante a casca de árvore e musgo.
- Cefalotórax marrom, abdômen com escudos irregulares de quitina, detalhes cobre/laranja e musgo; oito olhos simples escuros.
- Quelíceras articuladas, pedipalpos e fiandeiras; não é um mamífero com pele de aranha.
- Comprimento conceitual do corpo (sem patas abertas): aproximadamente 0,6–0,8 m; envergadura de patas pode ultrapassar a largura de um cão médio.
- Massa proposta de 12–26 kg e altura aproximada de 0,38–0,6 m são hipóteses do jogo, não dados biológicos reais.

## Habitat e ecologia

Prefere raízes, folhas secas, troncos caídos, áreas úmidas e vegetação fechada. Cada indivíduo mantém pequenos pontos de emboscada. Caça prioritariamente Folhiscos; também pode consumir pequenos vertebrados e invertebrados grandes, conforme recursos disponíveis. Solitária; não possui caça cooperativa.

**Folhisco → Boscaranha:** a espécie cria pressão de predação sobre as aves que ciscam no solo. Alarmes e fuga dos Folhiscos afetam a probabilidade de sucesso. Não há sucesso automático só porque ambos ocupam o mesmo chunk.

## Sentidos (valores iniciais para prototipagem)

| Sensor | Hipótese |
| --- | --- |
| Vibrações do solo | Excepcional; eventos até ~14 m em meio conectado |
| Vibrações em fios de alarme | Excepcional; até ~25 m em fios conectados |
| Visão | ~260°; útil para alvos móveis próximos, ~15 m em condição favorável |
| Alvo imóvel | Mais difícil de identificar, ~6 m |
| Audição aérea | Baixa |
| Quimiorrecepção | Moderada, ~8 m para pistas próximas |
| Sprint | Até 4,7 m/s por ~2 segundos |
| Caminhada | ~0,75 m/s |

Os valores não são científicos; são parâmetros de equilíbrio. Árvores, relevo, vento, ruído e superfícies interrompem ou enfraquecem os sinais. O sensor de vibração jamais conhece a posição precisa de todos os animais de uma região.

## IA e caça

1. **Esconder:** escolher abrigo sob raízes/troncos e ficar imóvel para poupar energia.
2. **Sentir:** reagir a passos, movimentos na vegetação e fios de alarme efetivamente tocados.
3. **Inspecionar:** orientar cefalotórax e pedipalpos; confirmar estímulo visual ou mecânico.
4. **Aproximar:** mover-se lentamente enquanto a presa está desatenta.
5. **Dar bote:** salto curto e rápido, com possibilidade real de falha.
6. **Morder:** quelíceras atacam durante uma janela delimitada pelo controlador de combate.
7. **Imobilizar e alimentar-se:** veneno e seda são sistemas de gameplay/efeitos futuros, não são causados pelo clipe de animação sozinho.
8. **Recuar:** contra ameaça superior, preferir intimidação ou retirada para abrigo.

A Boscaranha pode deixar fios de seda de alarme entre raízes, mas **não** uma teia gigante que captura qualquer animal automaticamente.

## Modelo 3D produzido

Dois arquivos **glTF 2.0 GLB** originais foram produzidos e validados nesta sessão: LOD0 com 17.344 triângulos e LOD1 com 7.629 triângulos. Ambos têm **33 articulações** e **22 clipes**. A versão estilizada contém escudos geométricos, musgo, oito pernas, olhos, presas móveis e fiandeiras.

**Animações:** `idle`, `walk`, `scuttle`, `sprint`, `stalk`, `ambush`, `sense_vibrations`, `vigilance`, `pounce`, `bite`, `silk_wrap`, `feed`, `climb`, `threat_display`, `retreat`, `turn_left`, `turn_right`, `groom`, `nest`, `rest`, `hurt`, `death`.

**Limitações:** movimentação sem deslocamento real pelo mapa (in-place), pesos rígidos nas articulações, falta de IK de patas, colisões, veneno, VFX de teia, sons, animações contextuais e IA de caça. Prévia MP4, GIF, 2 GLBs, código-fonte e visualizador foram preparados em um ZIP na conversa, mas os **arquivos binários ainda não estão publicados no GitHub**.

## Testes essenciais ao integrar

- Oito patas não atravessam rochas/troncos durante deslocamento; escalar exige superfície navegável.
- Vibrações só atravessam materiais/segmentos conectados, não outros hexágonos arbitrariamente.
- Folhisco pode detectar a Boscaranha, fugir e escapar; bote pode falhar.
- Animais não se duplicam ao trocar de chunk.
- Predador precisa descansar/alimentar-se e pode morrer sem presa disponível.
- Período de cooldown e alcance de ataque não são definidos por frame rate.
- Com dezenas de Boscaranhas distantes, LOD e simulação simplificada preservam desempenho.

[Cadastro JSON](./boscaranha.json) · [Pasta do modelo](../../assets/models/creatures/boscaranha/).
