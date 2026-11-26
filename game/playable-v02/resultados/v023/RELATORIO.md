# Regiões detalhadas móveis — etapa 1 (2026-11-21)

Pedido: a simulação detalhada deixa de ficar presa a HV_01/FX_20/ER_18 e acompanha cada Hunter. Esta etapa cobre a
região móvel, a travessia entre hexágonos vizinhos e quatro Hunters em lugares diferentes. **Não expande para o continente.**

## Arquitetura

| Peça | Arquivo | O que faz |
|---|---|---|
| Construtor de grade | `src/regiao.js` | rasteriza os triângulos dos GLBs reais nas regras de `lib-hex-glb.mjs`, com arrays tipados: 7–40 ms por hexágono (antes ~1,2 s) e ~0,3 s por região de 1,2 × 1,2 km. A grade gerada é **idêntica** à da V01 na mesma janela (0 células diferentes em bloqueio e cobertura; altura < 1 mm) |
| Fontes | `src/fontes.js` | os 41 hexágonos com GLB de terreno nesta build (HV_01 + `region.json`): só neles há navegação detalhada |
| Regiões | `src/regioes.js` | uma região = um mundo do Hunter Lab com grade 1 200 × 1 200 m (res. 2 m). Recentrar = grade nova + deslocar **todo** o estado posicional do mundo pelo mesmo múltiplo de 2 m (posições, destinos, memórias, caminhos, eventos) |
| Jogo | `src/jogo.js` | recentra a 250 m da borda, separa Hunters que se afastam (região própria), junta regiões que se sobrepõem, pré-carrega os hexágonos à frente a 500 m da borda, faz viagem simplificada só em hexágonos **sem** GLB |
| Navegador | `src/provedor-web.js`, `src/trabalhador-regiao.js` | um download por GLB (os mesmos bytes desenham e viram grade); extração e montagem num Web Worker, fora do quadro |
| Desenho | `src/main.js` | streaming de hexágonos pela câmera; cada mundo é desenhado no lugar certo; efeitos de combate da região observada |

Hunters próximos compartilham região; distantes têm regiões independentes. Uma região sem Hunter fica dormente
(as criaturas ficam onde estavam, congeladas, e voltam quando uma região com Hunter passa por lá).

## Validação

`node --test test/v02.test.mjs test/v022.test.mjs test/v023.test.mjs` e `node tools/navegador-v023.mjs`
(ver `navegador-v023.json` e `../node-v023.log`).

| Item pedido | Evidência |
|---|---|
| Região acompanha o Hunter, sem teletransporte | Brena: HV_01 → FX_20 sempre na simulação detalhada, maior passo 0,36 m, região recentrada a cada ~2 min de jogo |
| Travessia entre vizinhos | "entrou em FX_20" (Brena), "entrou em ER_18" (Caio), andando no terreno real |
| Grade real dos GLBs | teste "grade da região = grade da V01" |
| Arvo na vila | ficou a < 30 m da vila |
| Brena floresta (FX_20) | chegou; terreno de FX_20 desenhado sob ela |
| Caio montanha (ER_18, *forested mountain*) | chegou; terreno de ER_18 desenhado sob ele |
| Dara deserto (X3) | andou ~10 km no terreno real (HV_01 → FX_20 → FX_19); FX_18 não tem GLB nesta build → viagem simplificada daí em diante. **X3 não é declarado integrado** |
| Regiões independentes | Arvo, Brena e Caio em três regiões diferentes |
| Troca de observação | 72 trocas de câmera entre os quatro: modelo 3D a ≤ 0,15 m da posição simulada; nenhuma tarefa reiniciou |
| Determinismo | mesma semente → mesmas posições; cópia restaurada de um save no meio da viagem segue a original |
| Salvamento | várias regiões + Hunter em viagem restaurados no mesmo instante, mesmas regiões e posições |

## Desempenho (Chrome real, Iris Xe, preset baixa)

| Situação | V02 | Agora |
|---|---:|---:|
| 8×, câmera seguindo Hunter em viagem | 21,9 FPS (p95 100 ms) | **60,0 FPS (p95 16,9 ms)** |
| 1×, cena estável | 58,9 | 60,0 |
| 8×, cena estável | 45,1 | 59,5 |

Causa da queda antiga: parsing dos GLBs (3–7 MB) na thread principal enquanto a câmera seguia a viagem, e o download
duplicado. Agora cada GLB é baixado uma vez e a grade é montada no Worker; o desenho só faz o `parse` do GLTF.
Nenhum passo de simulação cedido nas medições.

## Mudanças de comportamento e limites

- **Fome e sede dos Hunters congeladas no nível inicial.** Uma viagem longa (~7 dias de jogo) matou o Caio de sede no
  teste: as regiões não têm água e não há suprimentos (V02.7). Regra explícita até lá.
- Explorar um hexágono agora sorteia pontos no hexágono inteiro (antes, só na janela fixa).
- Saves da V02/V02.2 (grade fixa) não abrem nesta versão; a tela inicial avisa e oferece nova demonstração.
- Água dos mapas (`pontosAgua`) não é recalculada ao recentrar (a função do núcleo não é exportada); os hexágonos
  testados não têm água.
- Só 41 dos 272 hexágonos têm GLB disponível aqui. Os demais (inclusive desertos e litoral, cujos GLBs existem no
  repositório) precisam entrar em `src/fontes.js` **e** ser validados antes de serem chamados de integrados.
- Ao recentrar, o núcleo recalcula a mobilidade por espécie na thread principal (~40 ms, uma vez por região nova).
- Regiões dormentes guardam a grade antiga (~7 MB cada) enquanto tiverem criaturas.
- Em combate, a região não recentra (a borda pode ficar mais perto até a luta acabar).
