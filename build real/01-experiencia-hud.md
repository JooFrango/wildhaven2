# 01 — Experiência e HUD da Build Real
**Estado:** planejamento; interface e regras-base confirmadas, detalhes de implementação pendentes.

## Visão da experiência [CONFIRMADO]
O jogador não controla o corpo do Hunter. Emite ordens e administra a expedição. Os Hunters agem sozinhos, avaliam ameaças, exploram, combatem, vigiam, recuam e descansam conforme IA e ordens disponíveis. A seleção de outro Hunter muda o personagem **observado/administrado**, não dá controle manual.

## HUD de referência [CONFIRMADO]
Referência: **imagem enviada pelo diretor em 22/11/2026**, `HUD de Wildhaven em português.png`. Manter a identidade visual fantasia/caça da arte como ponto de partida:
- Retrato do Hunter principal; vida, energia, arma equipada, **estado e efeitos, sem nível geral**. Abrir perfil para visualizar **habilidades individuais de nível 1–20**, conforme [11 — Habilidades dos Hunters](11-habilidades-hunters.md).
- Lista de Hunters acompanhantes com retrato, vida, arma e estado; clicar em um Hunter permite acompanhá-lo e gerenciá-lo.
- Roda de ordens: caçar, explorar, seguir, vigiar, recuar, descansar.
- Comandos contextuais de equipe/expedição.
- Faixa inferior de inventário: poções, alimentos, utilitários, equipamentos, materiais e itens especiais.
- Área de missão/expedição, avisos de combate e observação, horário e clima.
- **Sem minimapa permanente** na HUD principal, conforme preferência do diretor. O **mapinha de habitat no bestiário** é uma interface separada, e não contradiz esta regra.

### Adaptação necessária [PROPOSTO]
O mockup exibe 4 Hunters e não constitui limite de equipe. A lista deverá acomodar grupos maiores e a capacidade de **6 passageiros Hunters por carroça** sem lotar toda a tela (rolagem, paginação ou painel recolhível; escolher com o diretor).

## Mundo e câmera [CONFIRMADO EM DISCUSSÃO ANTERIOR]
A área de simulação detalhada acompanha os **Hunters**, não fica ancorada rigidamente na câmera ou em um único hexágono inicial. A distância, usar representação estratégica simplificada sem alegar que todo hexágono possui terreno e combate detalhados. Sem teleporte arbitrário.

## Planejar uma caçada pelo bestiário [CONFIRMADO]
A página de espécie inclui **itens obtíveis, mapinha de onde vive e botão Caçar**. O botão abre seleção de Hunters e modalidade de viagem **a pé ou carroça**; carroça **custa dinheiro e só leva 6 Hunters por veículo**. A IA conduz a busca de rastros e decide entre estratégias de combate. Ver os documentos [06](06-cacadas-pelo-bestiario.md), [07](07-rastros-otimizacao.md) e [08](08-estrategias-emboscada-armadilhas.md).

## Controles indiretos [PROPOSTO]
Selecionar Hunter, escolher destino e prioridade, abrir inventário e dossiês, acompanhar foco da câmera, emitir ordem e receber relatórios/eventos. Implementar como uma interface de **direção de expedição**.

## Perfil de habilidades [CONFIRMADO + INTERFACE PROPOSTA]
- **Não existe nível geral do Hunter.** Corrigir qualquer protótipo de HUD que exiba “nível” isolado para o personagem.
- No perfil, mostrar proficiência separada por arma (uma técnica diferente liberada por nível), Desvio (com animações), Velocidade, Agilidade, Armadilhas e Mineração, todas com nível próprio até 20.
- A IA utiliza apenas os movimentos desbloqueados, sem permitir controle manual dos golpes.
- Detalhes visuais, ordem dos campos e outras habilidades sugeridas em [11 — Habilidades dos Hunters](11-habilidades-hunters.md) ainda dependem de aprovação.

## Pendências
- Número máximo de Hunters simultâneos em uma caçada.
- Como exibir separação de equipes entre duas carroças na HUD.
- Regras exatas de fila, cancelamento e autonomia das ordens.
- Local definitivo do PNG de referência no repositório.
