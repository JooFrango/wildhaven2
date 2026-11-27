# Wildhaven — Build Real V04: mundo completo

**Código:** `game/build-real-v04/`, na branch independente `feat/build-real-v04-mundo-completo`, com base na V03 otimizada. A V03 continua em `game/build-real-v03/`.

**Downloads (Windows):**
- [Wildhaven-Windows-portatil-v04.zip](https://github.com/JooFrango/wildhaven2/releases/download/build-real-v04-portatil/Wildhaven-Windows-portatil-v04.zip) (212.032.000 bytes, SHA-256 `f75942430f55a12ebb506d72db721df40c40c1cb06e263f6232a87cf02d4aea4`). Traz a vila, os 6 hexes vizinhos, o horizonte dos 272 hexes e as 34 espécies.
- [Pacotes por hex](https://github.com/JooFrango/wildhaven2/releases/tag/build-real-v04-hexes): 259 pacotes, 3,84 GB, mais o índice `hexes-v04.json`. São baixados **sob demanda** pelo servidor, ou todos de uma vez por `Baixar-Continente-Completo.bat`.
- Baixei os dois de novo, direto do GitHub, e conferi o SHA-256: o ZIP base e o pacote `X3.zip`.

> Nenhum FPS foi medido em GPU real (contêiner com SwiftShader). A aprovação artística e o desempenho no computador do diretor continuam sujeitos à validação dele.

## 1. O continente

| | V03 | V04 |
| --- | ---: | ---: |
| Hexes com visual detalhado (chunks, LOD, vegetação) | 7 | **272** |
| Hexes com física WHP1 compilada | 7 no ZIP | **272** |
| Hexes certificados para travessia a pé | 223 no relatório (7 no ZIP) | **266** (todos, menos 6 de exceção marítima) |
| Fronteiras validadas | 705 | 705 (os 43 costeiros entram sem perder nenhuma) |
| Espécies integradas | 8 | **34** (com 22 pendentes, cada uma com motivo) |
| Classes de bioma | — | 13, cobrindo os 33 rótulos do manifesto |

**Fonte da geometria.** Ela vem dos GLBs **originais**, com bytes e SHA-256 conferidos contra o manifesto. Não há terreno genérico nem collider fictício. A emenda máxima entre vizinhos é de 11 cm (`AUDITORIA-CONTINENTE-V04.md`).

**Os 43 hexes costeiros.** Na V03 eles não estavam certificados por causa da vegetação instanciada sem regra física.
- O raio do tronco foi medido na malha original.
- Esse raio foi escalado pelo **mesmo fator da correção visual aprovada** para a floresta da V02, para que o colisor coincida com a árvore desenhada. As árvores originais têm de 100 a 280 m.
- A física foi recompilada com o compilador e o validador originais.
- Status: proposta técnica, pendente da revisão do diretor.

**Direção artística aprovada.** A floresta da V02 é a referência mínima: geometria original e árvores de ~16–21 m. A altura **não** foi aplicada a todos os biomas: o pipeline usa a altura-alvo de cada família, por exemplo Emergente 32 m, Dossel 24 m e Palmeira 12 m na selva. Essa aprovação está registrada na memória do Claude Code e no checklist.

## 2. Quatro camadas

| Camada | O que é | Onde está |
| --- | --- | --- |
| 1. Continental | Horizonte dos 272 hexes em poucos draw calls, mapa estratégico e clima com 272 nós | `visual.ts` (Horizon), `ui.ts` (mapa), `climate.rs` |
| 2. Regional | Hex inteiro em LOD3 e blocos de 1 km, só com os **metadados** dos hexes no raio de visão | `visual.ts` (stream/tile3/blocos) |
| 3. Local | Folhas de 256 m em LOD0 e LOD1, baixadas **por nó** via HTTP Range só quando a seleção pede. Descarte com histerese e teto por perfil. | `visual.ts` (fila, cancelamento, fallback) |
| 4. Física | Janelas WHP1 em torno de **cada Hunter** (nunca da câmera), com E/S em thread auxiliar. Hexes ausentes são baixados sob demanda. | `terrain.rs`, `pacotes.rs` |

- A região detalhada acompanha o Hunter **seguido**.
- Os outros Hunters continuam simulados no servidor sem nada desenhado.
- Trocar de Hunter apenas muda o foco do streaming, que é progressivo.

## 3. Criaturas e ecossistema

O inventário completo está em `INVENTARIO-CRIATURAS-V04.md`.
- **Encontradas:** 56 pastas de espécie, 47 delas com GLB animado.
- **Integradas:** 34.
- **Pendentes:** 22, por falta de GLB animado (neve, wyvern, dodarro) ou de ficha.

**Locomoção** portada do laboratório (`labs/ia-criaturas`, `meio.rs`), com o mesmo núcleo de necessidades para todas:
- **Voadoras** (Carniroca, Pica-termita):
  - decolam quando o destino passa de `distanciaVoarM` ou para fugir, com limite de energia;
  - voam em cruzeiro acima do relevo, com folga de obstáculo, sem o A* do chão;
  - pousam em célula caminhável e não deixam pegadas em voo.
- **Subterrâneas na areia** (Arenoceto, Arraia-de-areia, Escarvão, Serracorion):
  - ficam submersas e percebem pela **vibração** dos passos (Hunter agachado vibra menos);
  - emergem para o bote e voltam a submergir;
  - Hunters só as veem de perto, e elas não deixam pegadas;
  - fora da areia, ficam na superfície.
- **Aquáticas:** o contrato existe, mas nenhuma espécie integrada é aquática.

Testes automatizados: `flyer_takes_off_cruises_and_lands_without_ground_astar_v04` e `burrower_submerges_on_sand_emerges_to_strike_and_surfaces_off_sand_v04`.

**Distribuição ecológica:**
- espécies por classe de bioma (habitats das fichas);
- predadores com território, sem outro grupo da mesma espécie no raio de forrageio;
- presas perto de água quando o hex tem água;
- espécies de subsolo só em areia.

No censo da viagem longa, nenhuma criatura nasceu fora do seu bioma (`bench/continente-*.json`). Os números (densidade, hp, dano) são **provisórios**, ficam fora do código e estão em `data/gameplay-provisorio-v04.json`.

**Clima.** É o V7 continental da V02; o laboratório V08 não existe no repositório. Ele cobre os 272 nós e diferencia os biomas: a umidade-base da savana é 0,35, contra 0,5 na planície e 0,1 no deserto. Também simula a sombra de chuva das montanhas.

## 4. Navegação continental

- **Grafo de portais certificados:** os 266 hexes são alcançáveis a pé a partir da vila. A rota estratégica é uma busca no grafo, barata. O trecho local usa A* com orçamento por tick.
- **Viagens longas em grupo** (`wh-sim-check continente`), sem teleporte (passo máximo igual ao limite da caminhada) e sem nenhum tick fora do chão compilado:

  | Destino | Hexes atravessados | Tempo simulado |
  | --- | ---: | ---: |
  | X3, deserto | 6 | 4,6 h |
  | costa_+03_-04, praia | 8 | 6,6 h |

- **Correção V04:** uma ordem de viagem ou exploração interrompida por um ataque é **retomada** depois do combate. Antes, o Hunter voltava para a vila.
- **Novidades na interface:**
  - estimativa antes da ordem (saltos, km, duração);
  - viagem em grupo e cancelamento;
  - hexes descobertos (o mapa vela o que ninguém percorreu);
  - rotas no mapa.

## 5. Caçada fora da floresta temperada

Em `wh-sim-check caca-bioma` (`bench/caca-deserto.json`), o fluxo completo terminou com **abate**:
1. o grupo viajou até o deserto (X3);
2. avistou uma **Serpáduna** (espécie exclusiva da areia, com página nova no Bestiário);
3. voltou à vila;
4. recebeu a ordem Caçar de carroça;
5. a expedição viajou, acampou, rastreou e Hunter 06 abateu a Serpáduna;
6. os itens foram guardados e a carroça voltou à vila.

O resgate e a morte permanente continuam ativos: houve mortes no caminho.

## 6. Distribuição modular

- **Servidor (`pacotes.rs`).** Lê o índice com bytes e SHA-256 e baixa numa thread própria, sem bloquear a simulação. Confere cada pacote antes de extrair e rejeita caminhos com `..`.
  - Viagens cuja rota passa por hexes ausentes **esperam** o download e partem sozinhas.
  - Os vizinhos dos Hunters são baixados antes.
  - Sem internet, joga-se com os hexes presentes.
- **Teste local:** ordem para ER_19, ausente; baixou 19 MB, conferiu, liberou e a viagem começou.
- **CI Windows:** o mesmo teste passou no runner, sem Rust ou Node no PATH.

## 7. Desempenho e testes

Ver `BENCHMARK-V03-V04.md`, que é preenchido ao fim das medições.

## 8. Pendências

Ver `PENDENCIAS-V04.md`.
