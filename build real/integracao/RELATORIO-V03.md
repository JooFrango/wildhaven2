# Wildhaven — Build Real V03: otimização profunda

**Código:** `game/build-real-v03/`, independente. A V02 continua intacta em `game/build-real-v02/` e na branch `preview/build-real-v02-windows-portable`.
**Download:** [Wildhaven-Windows-portatil-v03.zip](https://github.com/JooFrango/wildhaven2/releases/download/build-real-v03-portatil/Wildhaven-Windows-portatil-v03.zip). O SHA-256 está no arquivo `.sha256` do lançamento e na seção 9.

A V03 faz o mesmo trabalho da V02 com menos recursos. A aparência, a interface, as mecânicas e a qualidade da simulação são as mesmas. Os gargalos foram medidos **antes** de qualquer mudança.

> **Ambiente de medição.** Contêiner Linux com 4 núcleos e Chromium headless com **SwiftShader**, que rasteriza o WebGL na CPU.
> - No modo 3D, a CPU medida inclui a rasterização que, numa GPU real, não pesa na CPU. Os números do 3D servem para comparar V02 com V03, não para prever o FPS no seu PC.
> - O Econômico e o Segundo Plano quase não dependem disso.
> - **Nenhum FPS foi medido em GPU real.** O painel F3 tem um botão para exportar o relatório no seu computador.

## 1. Gargalos encontrados (linha de base V02)

| Área | Medição na V02 | Causa |
| --- | --- | --- |
| Tick do servidor | **6.704 ms** num único tick, na primeira geração de criaturas (disco frio). 175–277 ms com o cache quente. Picos de 150 ms em ×10. | A geração de um hex inteiro num tick lia e descomprimia os chunks WHP1 de forma síncrona, **segurando o mutex do mundo**. HTTP e WebSocket ficavam parados. |
| Lock do mundo | Simulação, snapshot e serialização no mesmo `Mutex`. Em ×50, 35–43 ms por intervalo. | Ordens HTTP e envios esperavam a simulação. |
| Rede | 23 KB de JSON completo a cada 200 ms. **112 KB/s** em todos os modos, inclusive com a aba oculta. | Não havia diferenças nem frequência por modo. |
| Modo Econômico | **86%** de um núcleo. RSS de 1,55 GB. | Recalculava ~20 mil amostras de altura e milhares de `fillRect` por quadro. Também continuava o `world.stream()` 3D, carregando GLBs. |
| Aba oculta | **38%** de um núcleo. | Analisava 5 JSON completos por segundo e o 3D continuava a 1 quadro/s. |
| Vegetação 3D | `compose()` em dezenas de milhares de instâncias a cada 250 ms, mesmo com a câmera parada. | A atualização era por tempo, não por mudança. |
| Streaming 3D | GLB inteiro de cada hex (todos os chunks e LODs) carregado de uma vez. | Não havia carga por nó nem descarte por uso. |
| Interface | `innerHTML` de vários painéis reescrito a cada 250 ms. Slots e menu F3 recriados. | Não comparava valores antes de escrever. |
| Medição | A VRAM estimada percorria a cena inteira a cada 30 quadros. | — |

## 2. Servidor Rust

O tick deixou de ter picos, e o custo de cada fase passou a ser medido.

- **Thread de simulação dedicada.** Ela é a única dona do `World`, sem `Mutex`.
  - As ordens chegam por uma **fila limitada** de 64 itens, com resposta imediata. São aplicadas entre passos, como na V02.
  - O snapshot é publicado como valor **imutável compartilhado** (`watch`). A serialização e o diff ficam fora da simulação.
- **Dívida de passos com teto.** Intervalos perdidos viram dívida; não há rajadas.
  - Cada intervalo executa no máximo 2× a escala, dentro de um orçamento de 50% do intervalo (`WH_SIM_BUDGET_PCT`).
  - Acima de 30 s de simulação atrasada, o excesso é **descartado, contado e exposto**: log, F3 e `passos_descartados`. Nada é escondido.
  - Assim o ×50 não monopoliza a máquina. Se ela não aguentar, a "escala efetiva" aparece no F3.
- **E/S dos chunks físicos em thread auxiliar.** A leitura, a verificação SHA-256 e a descompressão saíram do tick. A amostragem do terreno ganhou um atalho sem alocação de `String`. As janelas só são recalculadas quando um ator anda mais de 16 m.
- **Geração de criaturas distribuída entre ticks.**
  - Fila determinística de 4 grupos por tick, com a mesma semente da V02 e as mesmas espécies e posições. Só o instante muda.
  - No servidor ao vivo, a fila também espera, sem bloquear, os chunks ainda não lidos.
  - `WH_SPAWN_GRUPOS=0` reproduz a V02.
- **Alocações removidas do laço das criaturas.** O nome da espécie passou de `String` para `Arc<str>`, e os vetores de vizinhos são reaproveitados.
- **Métricas novas:**
  - CPU e RSS do processo (Linux `/proc`; Windows `GetProcessTimes`/`K32GetProcessMemoryInfo`);
  - custo por fase do intervalo (janelas físicas, gameplay, visão e fio) com p50/p95/p99/máx;
  - ocupação da thread, escala efetiva, dívida, tráfego WS e terreno residente.

**Benchmark reproduzível.** Comando: `wh-bench`, sem rede, com o mesmo roteiro (todos os Hunters exploram). Arquivos: `game/build-real-v03/bench/servidor-*.json`. Os valores são o intervalo de 200 ms, em ms:

| Escala | V02 p95 | V02 máx | V03 p95 | V03 máx |
| --- | ---: | ---: | ---: | ---: |
| ×1 | 0,68 | **6.704,8** | 0,98 | **14,6** |
| ×5 | 6,10 | 56,5 | 4,07 | 6,9 |
| ×10 | 9,13 | 156,6 | 5,99 | 8,4 |
| ×50 | 42,9 | 86,7 | 31,7 | 40,3 |

- **Janela física máxima:** 277 ms → 0,1 ms.
- **Envio por intervalo:** 23 KB → **2,0 KB** (×1).
- **Criaturas simuladas:** as mesmas 1.584.
- **Ao vivo, em ×10 com Hunters explorando:**
  - escala efetiva 10,02;
  - dívida 0 e nenhum passo descartado;
  - CPU do processo 3,3% de um núcleo e RSS de 75 MB.

**Regressão do servidor.**
- `cargo test`: 21/21. Inclui o teste novo de ida e volta do protocolo.
- Demo com `WH_SPAWN_GRUPOS=0`: **14/14**, com o mesmo resultado da V02 (eventos, mortes, Bestiário, dinheiro). A única diferença é uma fração de XP de furtividade, que **já varia entre duas execuções da própria V02**: `bench/demo-v02-ref-a.json` e `-b.json`.
- Demo com a geração distribuída: o desfecho do roteiro muda com a ordem de surgimento das criaturas. Rodei 6 sementes em cada modo (`/tmp` → resumo na seção 8). O roteiro falha em algumas sementes **também com a geração idêntica à V02**, com taxa de sucesso parecida nos dois modos. A sensibilidade é do roteiro, não uma regressão da V03.

## 3. Comunicação incremental

**Protocolo** (`wh_core::wire`, espelhado em `client/src/wire.ts`):
- snapshot completo na conexão e quando o cliente pede ressincronização;
- depois, só diferenças em relação ao último estado que **aquele** cliente recebeu;
- listas com `id`/`seq` mudam por chave, e só os campos alterados trafegam;
- eventos ganharam `seq`, então só os novos trafegam;
- o que não mudou (Bestiário, vila, nós climáticos estáveis) não é reenviado.

**Frequência por modo.** O cliente informa o modo e o servidor ajusta:

| Modo | Frequência |
| --- | --- |
| 3D | 5 Hz, com interpolação |
| Econômico | 2,5 Hz |
| Segundo Plano | a cada 5 s, ou imediatamente em morte, ferimento, abate, Bestiário, resgate ou expedição |

A simulação continua a 5 passos/s × escala.

**Controle de atraso.** O `watch` guarda só a publicação mais recente: atrasos se fundem e não há fila crescendo. Quando o `seq` base não confere, o cliente pede ressincronização.

**Teste contra o servidor real** (`tools/test/wire-ao-vivo.mjs`). Uma conexão reconstrói o estado só com diffs, outra recebe completos, e os dois são comparados no mesmo `seq`:
- com o mundo parado: **104 comparações, 0 divergências**;
- com Hunters explorando em ×10: **100 comparações, 0 divergências**.

## 4. Cliente

### Modo Econômico
- **Mesma arte da V02.** Mantém 384×216 a 1,25 m/px, paletas, sombreamento, curvas de nível a cada 20 m, água, árvores, sprites, nuvens, partículas e noite.
- **Camada estática pré-renderizada.** Fica em regiões de 96×96 px ancoradas no mundo, com o relevo a meia resolução ampliado 2× como na V02 e as árvores numa camada própria. As regiões ficam num cache LRU de 140.
  - A normalização de cor só muda quando a vista muda de verdade. A troca é em bloco, sem costura.
  - Há um orçamento de 4 regiões por quadro.
- **Camada dinâmica.** Usa `drawImage` de um atlas de sprites pré-renderizados no lugar de um `fillRect` por pixel.
- **Relevo pela grade compacta** `heights.json` + `heights.bin` (`HeightIndex`), independente dos GLBs. **Nenhum renderizador WebGL é criado e nenhum GLB é baixado.**
- **Limite de 12, 15 ou 20 FPS**, num temporizador próprio.
- **Política de memória:**
  - vindo do 3D, o 3D é suspenso na hora;
  - depois de **60 s contínuos** no Econômico, é **descartado** (geometrias, materiais, texturas e contexto WebGL);
  - ao voltar, a cena é recriada, com tela de carregamento se a espera passar de 400 ms.
- **OffscreenCanvas e Worker: não usados.** O JS do Econômico custa **0,36 ms por quadro**, e um worker não teria o que ganhar. O custo restante é composição do navegador.

### Segundo Plano
`visibilitychange` desliga tudo:
- nenhum quadro 3D ou pixel art, sem partículas, sem streaming e sem interface;
- o servidor envia diferenças a cada 5 s ou em acontecimento importante;
- depois de 60 s oculto, o 3D também é descartado;
- ao voltar, há ressincronização completa.

A simulação continua no servidor, que não depende do navegador.

### Laços e interface
- Um único laço por vez (3D, pixel ou nenhum), garantido por `Loops`. O `setMode` não inicia um laço antes de parar o outro.
- A interface atualiza num temporizador próprio de 4 Hz. Cliques e ordens continuam com resposta imediata.
- O DOM é escrito de forma incremental (HTML, texto, largura, classe), só quando o valor muda, com referências reutilizadas.
- Os slots de inventário só são refeitos se os itens mudarem.
- O mapa é redesenhado no canvas sem reconstruir a janela. Listas modais só são trocadas se mudarem.
- O F3 tem esqueleto fixo e só as células são atualizadas.

### 3D — streaming por visibilidade
**Pacote por nó.** `tools/visual/split-chunks.mjs` cria um **GLB por nó** (folha LOD0, folha LOD1, parte de bloco, hex inteiro) dentro de `chunks.bin`.
- O índice fica em `chunks.json`. O material e as texturas do hex ficam em `materials.glb`, uma vez por hex.
- **4.350 nós conferidos idênticos ao original**: posições, normais, cores, índices, transformação e material.
- O pacote é ~31–52% maior que o GLB único, porque os LOD1 deixam de compartilhar vértices com o LOD0. Em troca, só é baixado o que a seleção pede.
- Um índice `visual/index.json` evita pedir hexes ausentes. A V02 gerava dezenas de 404 por sessão.

**Seleção e carga** (`visual.ts`). A seleção é a mesma da V02 (erro em pixels, frustum hierárquico, distância por categoria, oclusão). Cada nó necessário vira um pedido **HTTP Range**:
- fila por prioridade (distância ao foco, direção do movimento e câmera);
- 6 pedidos simultâneos e 6 malhas novas por quadro;
- cancelamento com `AbortController` do que perde relevância.

Pré-carga preventiva:
- blocos a menos de 700 m fora da tela;
- LOD1 das folhas a menos de 450 m.

**Fallback sem buracos:** folha → bloco → hex inteiro → horizonte. Um bloco e suas folhas nunca aparecem juntos.

**Descarte e teto:** um nó sem uso há 30 s é descartado da RAM e da VRAM. O teto de memória por perfil é de 120/220/360 MB, com descarte LRU. Sem mudança de câmera e sem nó novo, a seleção não é recalculada.

**Vegetação.** As matrizes e cores das instâncias são calculadas uma vez por hex. A atualização acontece só quando a câmera anda ou gira, ou durante um fade. Os dados de um hex só são baixados no alcance das árvores e saem com folga.

**Criaturas.** Modelo, esqueleto e AnimationMixer só existem se a criatura ocupar 1,5 px ou mais na tela. São liberados com histerese de 10 s (`stopAllAction` + `uncacheRoot`).

**Outros ajustes:**
- pegadas recalculadas só quando a lista muda, já que o protocolo preserva a identidade da lista;
- mapas do quadro anterior montados uma vez por mensagem;
- sem `new Vector3` no caminho do quadro;
- sombras com no máximo 30 atualizações por segundo.

O F3 mostra os objetos simulados, em RAM, em VRAM, desenhados, ocultos e descartados, separadamente.

## 5. Telas de carregamento originais

São as três cenas do Codex: Montanhas (Hunter × Varrisco), Dunas (barco × Arenoceto) e Savana (Velsari × Gravarto). Ficam em `build real/loading-screen/v02/` e são servidas **sem cópia nem alteração** em `/carregamento/`.

**Isolamento.** A página original roda num `<iframe>`, então seu CSS e seu script não tocam o jogo. É Canvas 2D com PNG, sem um segundo motor 3D. O console do simulador é escondido com um estilo injetado; o arquivo não muda.

**Progresso real.** O jogo só chama a API pública do protótipo, `WildhavenLoading.setProgress`. Cada uma das 6 etapas recebe uma fração medida (bytes do horizonte, hexes, nós de relevo, espécies) ou `null` ("Preparando…") quando não há medida:

1. Inicializando servidor
2. Carregando mundo
3. Carregando terrenos
4. Preparando criaturas
5. Sincronizando Hunters
6. Preparando interface

Não há porcentagem inventada nem espera artificial.

**Quando aparece:**
- inicialização e carga inicial;
- recuperação de sessão (queda de WebSocket por mais de 1,5 s);
- volta ao 3D com espera acima de 400 ms;
- hex do Hunter seguido sem relevo pronto por mais de 1,5 s.

A cena é escolhida pelo bioma de destino. Nas cargas silenciosas da caminhada, a tela não aparece. A animação se suspende com a aba oculta, e o iframe é removido ao terminar.

## 6. Comparação V02 × V03 por modo

Medido com `tools/bench-modos.mjs`, mesmo navegador, perfil Baixo, 60 s após 25 s de aquecimento. Os arquivos estão em `bench/v0X-modo-*.json`. A CPU é a soma de todos os processos do navegador, em % de um núcleo.

| Modo | CPU V02 | CPU V03 | WS V02 | WS V03 | Quadros da V03 |
| --- | ---: | ---: | ---: | ---: | --- |
| 3D | 354% | **283%** | 112 KB/s | **7,9 KB/s** | 8/s (SwiftShader) |
| Econômico | 86% | **19,5%** | 112 KB/s | **4,8 KB/s** | 15/s |
| Aba oculta | 38% | **4,0%** (0,4% sem a sonda rAF do medidor) | 112 KB/s | **1,7 KB/s** | **0** |

**Econômico, distribuição da CPU.** O JS custa 0,36 ms por quadro. Por processo:
- renderizador: 4,5%;
- GPU (composição por SwiftShader, que na GPU real é hardware): 12,9%;
- navegador: 0,4%.

**Memória.** O navegador headless vazio ocupa ~745 MB de RSS neste ambiente.

| Situação | RSS | Heap JS |
| --- | ---: | ---: |
| Econômico desde o início | 855 MB (+110 MB sobre o navegador vazio) | ~5 MB |
| 3D | — | 37 MB |
| Oculto por 80 s após o 3D (3D descartado) | — | 5,4 MB |

O heap foi medido por CDP após coleta de lixo.

**Aparência.** Capturas com a mesma câmera, perfil e hora estão em `build real/integracao/evidencias/v03/comparar-v0X-{perto,medio,longe}.png`. Mostram o mesmo relevo, árvores, fog e cores. As diferenças vêm da posição do Hunter seguido.

| Vista | Draw calls V02 | Draw calls V03 | Triângulos V02 | Triângulos V03 |
| --- | ---: | ---: | ---: | ---: |
| Perto | 207 | 210 | 329 k | 314 k |
| Médio | 195 | 198 | 292 k | 278 k |
| Longe | 204 | 202 | 379 k | 363 k |

## 7. Memória: alternância 3D ↔ Econômico

Teste `tools/test/alternancia-memoria.mjs`, 5 ciclos de 25 s em 3D e 70 s no Econômico. Arquivo: `bench/v03-alternancia-3d-economico.json`.

- **Heap JS exato:** 5,6 → 6,2 MB ao fim de cada fase Econômica e 37–38,7 MB em 3D. Estável, sem vazamento.
- **Descarte do 3D confirmado** em todos os ciclos: 0 geometrias no Econômico.
- **RSS do navegador:** sobe +70, +71, +42 e +8 MB por ciclo e estabiliza. É memória nativa do navegador ao recriar o contexto WebGL (SwiftShader), não do jogo.

## 8. Testes de longa duração

`tools/test/longa-duracao.mjs` abre um navegador num modo e, a cada minuto, grava CPU e RSS do navegador e do servidor, heap, quadros, travamentos, tráfego do WebSocket e as métricas do servidor. Os 8 Hunters exploram o tempo todo. O servidor roda em modo leve (os 7 hexes do ZIP).

A primeira tentativa foi interrompida aos 11 min por um reinício do contêiner. Os registros estão em `bench/longa-*-interrompido-11min.json`. Os testes foram refeitos do zero.

| Teste | Duração | CPU média do navegador | RSS do navegador | Heap JS | Servidor | Erros |
| --- | --- | ---: | --- | --- | --- | ---: |
| 3D, perfil Baixo | 30 min | 274% (SwiftShader) | 1315 → 1337 MB | estável | CPU 1,5%, RSS 112 MB, 0 passos descartados | 0 |
| Aba oculta | **2 h** | **0,14%** (máx. 0,3%) | 1253 → 1037 MB | 167 → 7,7 MB (3D descartado aos 60 s) | CPU 2,6%, RSS 195 MB, 0 descartados | 0 |
| Econômico | **2 h** | 38% (16–66%, ver abaixo) | 811 → 911 MB | 5,4 → 19 MB | CPU 3,2%, RSS 196 MB, 0 descartados | 0 |

- **Aba oculta:** nenhum quadro desenhado em 2 h. Só os 17 quadros de antes de esconder a aba.
- **Simulação:** escala efetiva entre 0,997 e 1,000 nos três servidores, com dívida de passos sempre 0.
- **Econômico:** a CPU ficou em 16–19% na primeira meia hora e depois subiu para 35–66%. A investigação está na seção 10.

## 9. Distribuição

- **Workflow:** `.github/workflows/wildhaven-windows-portable-v03.yml`.
  1. Busca os terrenos reais e compila a física dos 7 hexes.
  2. Executa o pipeline visual e a divisão por nó.
  3. Compila o cliente e o servidor e monta o pacote.
- **O pacote inclui** as telas de carregamento originais e os assets da V02 (horizonte, carroça, acampamento, armadilhas).
- **Validação no Windows**, sem Rust ou Node no PATH:
  - servidor, snapshot com 8 Hunters, chunks e materiais;
  - requisição Range retornando 206;
  - telas de carregamento e modelos.
- **ZIP:** [Wildhaven-Windows-portatil-v03.zip](https://github.com/JooFrango/wildhaven2/releases/download/build-real-v03-portatil/Wildhaven-Windows-portatil-v03.zip).

## 10. Resultados finais e pendências

(Atualizado ao fim dos testes.)
