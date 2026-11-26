# Wildhaven — Build V02 (simulador idle de Hunters autônomos)

Corrige a direção da V01: o jogador **não controla** o Hunter. Ele observa com uma câmera estratégica, seleciona
Hunters e dá **ordens**; a IA do Hunter Lab decide movimento, esquiva, bloqueio, perseguição, recuo e golpes.

> Experimental. Rig v13 do Hunter e clipes PvE v02 aguardam aprovação artística (PRs #92–#97). A V01
> (`game/playable-v01/`) continua intacta e é usada como base técnica (terreno derivado, `cacada.js`, servidor).

## Iniciar

```bash
cd game/playable-v01 && npm install     # servidor e three.js da V01 (só na primeira vez)
cd ../playable-v02 && npm install
npm run dev                              # http://127.0.0.1:5210/game/playable-v02/
```

| Comando | O que faz |
|---|---|
| `npm test` | Node: grafo de 272 hexágonos, quatro Hunters independentes, viagem estratégica, salvar/restaurar |
| `npm run test:navegador` | Chrome real: aceitação completa por cliques na interface → `resultados/` |
| `npm run derivar` | regera `public/data/auralis-grafo.json` |

## Como jogar

| Ação | Como |
|---|---|
| Selecionar Hunter | clique no cartão do esquadrão (ou tecla 1–4) |
| Seleção múltipla (ordens de grupo) | Ctrl/Shift + clique nos cartões |
| Observar / acompanhar | duplo clique no cartão, botão **Observar** ou **F**; a câmera segue sem prender zoom nem ângulo |
| Câmera | arrastar (esquerdo) desloca · arrastar (direito) gira · roda = zoom · WASD/setas deslocam · Q/E giram |
| Ordens | painel esquerdo: ir até ponto (clique no terreno), ir até hexágono (mapa), explorar hexágono (mapa), patrulhar aqui, caçar espécie, voltar à vila, descansar, permanecer na vila |
| Fila de ordens | marque "adicionar à fila" ou segure Shift ao dar a ordem |
| Tempo | pausa / 1× / 2× / 4× / 8× (barra de espaço pausa) |
| Mapa continental | **M**: 272 hexágonos, rotas e posições; clique num hexágono para destino |
| Salvar | automático a cada 30 s, ao esconder a aba e ao sair; botão **Salvar**. Recarregar → "Continuar sessão salva" |

Nenhuma tecla move Hunter ou dispara golpe. Os controles manuais da V01 não estão nesta interface.

## Modelo de simulação

| Camada | Onde | O que acontece |
|---|---|---|
| Navegação estratégica | grafo de 272 hexágonos (vizinhança = `shared_edges` da composição 195 + `contacts` do litoral) | A* com custo por bioma e relevo (**regra provisória**), 6 hexágonos de mar intransponíveis |
| Navegação local | janela de 800 × 3 100 m sobre HV_01, FX_20, ER_18 (grade de 2 m derivada dos GLBs) | o cérebro do lab anda até a ordem (`a.hunter.ordem`), desvia de bloqueios |
| Simulação detalhada | mesma janela | percepção, combate, ferimentos, animações reais, para todos os Hunters ali (observados ou não) |
| Simulação simplificada | fora da janela | posição avança continuamente pela rota (sem teletransporte), na marcha dividida pelo custo do bioma; sem combate, sem perigos simulados; ao voltar à janela, o Hunter retoma a simulação detalhada no ponto onde entrou |

Os 272 hexágonos **não** são jogáveis: só a janela tem terreno físico e combate. Fora dela o Hunter aparece como
marcador sobre o terreno desenhado (quando o hexágono está carregado).

## Regras mantidas

- Tempo só anda com a página aberta e visível. Ao esconder/sair: salva e congela. Sem progresso offline.
- Modo letal: Hunter morto fica morto no save. **Reiniciar demonstração** (com confirmação) é o único reinício e apaga o save.
- Varrisco com 50% da vida da ficha (preset de demonstração da V01).

## V02.2 — IA em três camadas

Cada Hunter tem um **perfil de IA** (cauteloso, equilibrado, agressivo; painel esquerdo, seção Inteligência) e **regras
condicionais** (defesa, retirada, evitar ameaça, enfrentar, retomar, ajudar, descansar) que interrompem e retomam a
tarefa sem apagá-la. O motivo de cada decisão aparece em "Decisões recentes" e no filtro **Decisões** dos registros.
Detalhes, testes e limites: [`resultados/v022/RELATORIO.md`](resultados/v022/RELATORIO.md).

| Comando | O que faz |
|---|---|
| `npm test` | V02 (4) + V02.2 (7) em Node |
| `node tools/navegador-v022.mjs` | aceitação V02.2 no Chrome real |
| `node tools/desempenho-ab.mjs <pastaA> <pastaB>` | A/B de FPS com o mesmo roteiro |

Relatório da V02: [`resultados/RELATORIO.md`](resultados/RELATORIO.md).

## Regiões detalhadas móveis (etapa 1)

A simulação detalhada acompanha cada Hunter: uma grade de 1,2 × 1,2 km montada a partir dos GLBs reais (num Web
Worker) e recentrada enquanto ele anda; Hunters distantes têm regiões próprias. Só os 41 hexágonos com GLB nesta
build têm terreno detalhado; nos demais a viagem é simplificada. Fome e sede dos Hunters ficam congeladas (sem
suprimentos até a V02.7). Detalhes: [`resultados/v023/RELATORIO.md`](resultados/v023/RELATORIO.md) ·
teste no navegador: `node tools/navegador-v023.mjs`.
