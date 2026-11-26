# Wildhaven — três especialistas em cupins (conceitos)

**Estado:** três protótipos 3D mid-poly animados foram produzidos e versionados como assets independentes para revisão. **Nenhuma criatura foi integrada à Alpha jogável.**

A fauna foi redesenhada para ter aparência fantástica e identidade própria, sem ser uma cópia de animais reais.

## Ferrunco — florestas
Quadrúpede robusto e baixo, com cobertura dorsal de grandes placas sobrepostas, cristas ósseas, tufos de líquens e garras muito largas. Possui focinho estreito e língua extensível. 
- **Estratégia:** fareja cupinzeiros, quebra a crosta superficial com as garras e extrai muitos cupins de uma vez.
- **Trade-off ecológico:** coleta eficiente, porém causa maiores danos à superfície do cupinzeiro; pode acelerar o colapso de uma colônia enfraquecida.
- **Hábitat:** florestas úmidas, temperadas e suas bordas.

## Dunlíngua — deserto
Predador de cupins alongado, coberto por escamas/placas cor de areia e cobre, com cauda longa, membros escavadores e crista dorsal alta em forma de lâminas.
- **Estratégia:** patrulha entre dunas e rochas, detecta vibrações no solo, abre pequenas fendas e usa língua longa para capturar cupins.
- **Trade-off ecológico:** visita em horários frescos; permanece pouco tempo em cada colônia para evitar superaquecimento.
- **Hábitat:** deserto, cânions e áreas áridas.

## Pica-Termita de Crista — planícies e bordas de floresta
Ave fantástica com longa crista vermelho-laranja, plumagem em padrões contrastantes, cauda ornamental e bico estreito. 
- **Estratégia:** pousa no cupinzeiro, perfura pequenas aberturas com o bico e captura cupins com língua rápida.
- **Trade-off ecológico:** consome menos indivíduos por visita, com impacto estrutural menor; desloca-se rapidamente entre colônias.
- **Hábitat:** campos, savanas e bordas de floresta.

## Interação com recurso ecológico
Todas as visitas descontam `cupinsConsumidos` da população da colônia (ver `../ecology/cupinzeiros.md`). Se qualquer espécie consumir os últimos cupins, a colônia passa para o estado de extinta e nunca se recupera. Esses animais podem competir pela mesma fonte alimentar.

## Modelos 3D, animações e prévias reais

| Espécie | GLB | Ações |
|---|---|---:|
| Ferrunco | `assets/models/creatures/ferrunco/ferrunco-animated-v01.glb` | 16 |
| Dunlíngua | `assets/models/creatures/dunlingua/dunlingua-animated-v01.glb` | 16 |
| Pica-Termita | `assets/models/creatures/pica-termita/pica_termita-animated-v01.glb` | 18 |

Os PNGs de prévia real foram renderizados diretamente do Three.js/WebGL que produz essas geometrias, e ficam em cada pasta de espécie.

As **artes conceituais originais** foram produzidas na conversa do projeto Wildhaven; seus PNGs ainda não foram versionados. Os GLBs atuais são protótipos que aguardam refinamento/aprovação estética e não são cópias perfeitas das ilustrações. As animações não incluem IA, colisões ou navegação.
