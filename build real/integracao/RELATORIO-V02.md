# Relatório — Build Real V02 (27/11/2026)

**Branch:** `claude/hopeful-noether-oehmyn`, criada a partir de `preview/build-real-v01-windows-portable`.
**Código:** `game/build-real-v02/`. A V01 (`game/build-real-v01/`) segue intacta.

Cada linha deste relatório diz se o item foi **medido**, **testado**, só **implementado** ou se está **pendente**.
Nenhuma aprovação artística foi presumida. Todos os FPS deste ambiente vêm de renderização por **software**
(Chromium headless com SwiftShader) e **não representam o computador do diretor**.

## 1. Download

| Item | Valor |
| --- | --- |
| ZIP portátil | [Wildhaven-Windows-portatil-v02.zip](https://github.com/JooFrango/wildhaven2/releases/download/build-real-v02-portatil/Wildhaven-Windows-portatil-v02.zip) (pré-lançamento [`build-real-v02-portatil`](https://github.com/JooFrango/wildhaven2/releases/tag/build-real-v02-portatil)) |
| Pipeline | `.github/workflows/wildhaven-windows-portable-v02.yml`; republica o ZIP a cada push na branch |
| Validação no Windows (runner) | o `wh-server.exe` sobe sem Rust, Node ou Git no PATH; responde health, o cliente V02, o snapshot com Hunters, 9 assets V02 e confirma "7 tiles liberados" |
| Conferência após o download | ZIP do commit `6413a20`: 202.886.796 bytes, SHA-256 `fce942e4…0226`, idêntico ao do runner. Foi extraído e servido com o build Linux: 7 hexes, 213 draw calls, 422 mil triângulos (`evidencias/v02/v02-pacote-portatil-extraido.png`) |
| Uso | extrair tudo → clicar duas vezes em `Iniciar-Wildhaven.bat` → o navegador abre `http://127.0.0.1:8787` |

A execução por clique num Windows de verdade **não foi testada**: só no runner do GitHub Actions, por PowerShell.

## 2. Otimização gráfica

### O que mudou

| Técnica | Status | Como foi feita |
| --- | --- | --- |
| Chunk rendering | implementado e medido | Pipeline offline `tools/visual/build-visual.mjs`: folhas de 256 m, blocos de 1 km e o hex inteiro. Testados 64, 128 e 256 m: 28.439, 7.373 e 2.064 folhas nos 7 hexes (105, 69 e 57 MB). O relevo v12 tem triângulos de ~24 m, e 64 m daria ~16 triângulos por folha (mais draw calls do que geometria). |
| LOD do relevo | implementado | LOD0 é a geometria original; L1/L2/L3 vêm do meshoptimizer com **erro absoluto em metros** (0,6, 2,5 e 8 m) e **LockBorder**, sem frestas entre níveis. A escolha é pelo erro projetado em pixels, que vem do perfil (1,5 a 8 px). |
| Frustum culling | implementado e medido | Hierárquico: hex → bloco → folha; células de vegetação de 256 m; atores por caixa. |
| Occlusion culling | implementado e medido | Conservador, por relevo: grade de alturas **mínimas** de 32 m, raio só é dado como bloqueado com folga de 3 m, e o volume só some se três pontos do topo estiverem bloqueados. Orçamento de 72 raios por quadro, resultado reaproveitado por 600 ms. Não usa consulta síncrona de GPU. |
| Distance culling | implementado | Distância por categoria: rocha ≤ 3,5 km, árvores e plantas pequenas por perfil, capim ~70–110 m. Há fade por dithering e histerese de 15–25%. |
| GPU instancing | implementado | Vegetação: 19 protótipos × 4 LODs. Também instanciados: capim, flores, pegadas e sombras de contato. Densidade cai com a distância e o LOD sai do tamanho projetado. |
| Horizonte | implementado | Os 272 hexes simplificados (381.769 triângulos, 9,8 MB, versionado) em poucas regiões de 1 draw call cada, ocultados hex a hex quando o detalhado carrega. Há mar ao redor. As bordas de hex deixam de aparecer porque `hex_side_cut` sai do visual. |
| Fog | implementado | FogExp2 com componente de altura; paleta por bioma, hora, clima e noite. |
| LOD de criaturas | implementado | LOD0/1/2 reais das espécies, trocados a 28 e 75 m com histerese. |
| LOD de animação | implementado | Mixers longe ou ocultos atualizam a 20, 8 ou 3 Hz. |
| LOD de sombras | implementado | Área de 55/80/110 m e mapa de 1024/1536/2048 por perfil; texels estáveis. |
| Resolução dinâmica e limite de pixel ratio | implementado | Busca 16,7 ms e nunca desce abaixo de 50% da resolução. |
| Streaming e memória | implementado | Pré-carga na direção do movimento (12 s à frente); descarga com `dispose` de geometria, material e textura. |
| Modo Econômico | implementado e capturado | `setAnimationLoop(null)`: **nenhum render 3D** roda escondido. |

### Avaliado e não adotado nesta etapa

- **KTX2/Basis:** as texturas de relevo são 2 PNGs de 512² por hex e não são o gargalo.
- **Floating origin:** a origem já é a vila, e a precisão a 40 km fica em ~4 mm.
- **Web Workers:** o parse de GLB e a vegetação custam < 1 ms por atualização.
- **Pós-processamento:** a opção existe no menu, mas **não tem efeito**. Não há passe de pós (pendência).

### Medições (mesma máquina; software)

| Cena | Draw calls | Triângulos | CPU por quadro (*) |
| --- | ---: | ---: | ---: |
| V01, vila (4 hexes carregados) | 182 | 1.002.810 | 4,6 ms |
| V02 perto (zoom 14 m) | 175 | 325.547 | 32,3 ms |
| V02 vila (60 m) | 232 | 418.496 | 62,2 ms |
| V02 médio (140 m) | 229 | 415.877 | 62,6 ms |
| V02 longe (700 m) | 203 | 360.132 | 60,0 ms |
| V02 zoom máximo (900 m) | 180 | 214.962 | 29,1 ms |
| V02 vila, perfil **Baixo** | 150 | 301.841 | 9,4 ms |

(*) No SwiftShader, o tempo de CPU inclui a rasterização em software, inclusive sombras e o shader de céu da
V02, que a V01 não tinha. **Não é comparável com GPU real.** GPU timer indisponível neste navegador.

- **Triângulos:** de 1,0M (V01 aqui) e até 3M (medição do diretor) para 0,21–0,42M; a meta de < 500 mil foi atingida em todas as cenas.
- **Draw calls:** de 182 aqui e até 2.048 (diretor) para 150–232. A meta de < 200 foi atingida em perto, zoom máximo e perfil Baixo; **excedida** (203–232) no perfil Médio na vila, médio e longe.
- **Culling (vila):**
  - relevo: 24 folhas, 7 blocos e 2 hexes inteiros desenhados; 61 grupos descartados por frustum;
  - vegetação: 2.724 instâncias desenhadas; 207 células descartadas por frustum e 1.460 por distância.
  - Oclusão: 0–3 descartes nessas cenas; a vila fica num vale aberto, e a oclusão age atrás das montanhas.
- **Não medido:** 60 FPS no computador do diretor, 1% low em GPU real, VRAM real (só a estimada, 360 MB) e vazamento de memória em sessão longa.

### Fidelidade ao mapa original

Auditoria pedida pelo diretor: `v02-fidelidade-geometria-lod0.json`, modo `?comparar=original` e `evidencias/v02/v02-comparacao-glbs-originais-mesma-camera.png`.

- **Hexes:**
  - HV_01 com FX_20 (0,−1), ER_18 (1,−1), ER_21 (−1,0), ER_22 (1,0), ER_24 (−1,1) e ER_25 (0,1), conferidos pelo manifesto e pela vizinhança axial;
  - GLBs originais (v12 e a vila) com SHA conferido pelo `fetch-sources`, escala 1.
- **LOD0 do relevo:**
  - mesmos triângulos do original;
  - **100% dos vértices casados e diferença de altura de 0 m** nos 7 hexes;
  - escala vertical inalterada (ex.: ER_22 vai de 921,95 a 2.530,61 m nos dois);
  - nenhum terreno procedural ou placeholder.
- **Diferenças de aparência intencionais, todas registradas:**
  - AO assada nas cores de vértice (média de 0,6–2%);
  - variação procedural de solo no shader;
  - vegetação **re-escalada e adensada** (provisório, abaixo): é a mudança visual mais forte em relação aos GLBs.
  - Os GLBs originais não foram alterados.

## 3. Mundo vivo, clima e IA (servidor Rust)

- **Clima:** o laboratório **V08 não existe** no repositório (`docs/migracao/INVENTARIO-CLIMA.md`). Foi portado o módulo V7 (`labs/ia-criaturas/src/eco/clima.js`) para `climate.rs`:
  - campo de 272 nós, frentes com vento dominante e sombra de chuva nas montanhas;
  - chuva, tempestade, neve, nevasca e areia; tempestade de areia só em bioma arenoso e neve/nevasca só no frio;
  - megatempestade rara, ciclo lunar de 8 dias e aurora em biomas polares à noite;
  - efeitos em visão, audição, olfato (o vento leva o cheiro), locomoção e apagamento de pegadas; visão de Hunters e criaturas reduzida à noite;
  - o cliente desenha o mesmo estado (céu, fog, partículas, luz). Testado: determinismo, regra de bioma e efeito.
- **Ecossistema:**
  - fome, sede e energia; presas dormem à noite; busca de água no relevo compilado;
  - pasto; predação entre espécies, carcaças, carniça; território, bando e exploração;
  - recuperação de vida em repouso. Testado: predação gera carcaça e o predador se alimenta.
- **Escalabilidade:**
  - níveis de relevância: perto (todo tick), médio (a cada 3), longe (só necessidades, sem A*) e congelada além de 4,5 km;
  - grade espacial de 128 m para percepção; orçamento de 14 A* por tick; métricas no menu F3.
  - Medido: tick médio de 0,82 ms com 1.584 criaturas (842 longe, 742 congeladas). O pico de 166 ms acontece no spawn em lote.
- **Espécies:** 8, nos biomas temperados (Folhisco, Lobrapedra, Silvarano, Cavoru, Torvalho, Tufrilo, Nharuk, Boscaranha), com LODs e animações reais e percepção e locomoção das **fichas**.
- **Ordens novas:** Descansar, Viajar (por portais validados) e Equipar (só na vila). Velocidade da simulação ×1/×5/×10/×50; o relógio dia/noite segue **universal**. Clima forçado pelo menu do desenvolvedor.
- **Regressão:**
  - `wh-sim-check demo`: **14/14 etapas** (`data/demo-check-v02.json`, 24.381 s simulados): explorar, recusa do 7º Hunter, Caçar de carroça, acampamento, pegadas azuis, estratégia, abate, retorno com itens, Hunter sozinho contra Lobrapedra até o desfecho;
  - `cargo test` **20/20** e `node --test` **17/17**.

## 4. Visual, Hunters, vila, carroças

- **Hunters:**
  - GLB `labs/hunters/assets/hunter-pve-v01` (105 clipes reais; status do asset: *pending-director-approval*);
  - **fim da pose T**: sempre há um clipe ativo;
  - gestos de golpe, desvio e impacto vêm do servidor (`anim`/`anim_t`);
  - queda e morte usam `combat_knockdown`/`combat_death`, **sem girar o modelo**.
- **Poses que não existem como clipe** (agachar, sentar, descansar): criadas como **poses esqueléticas provisórias**, com o agachar como camada aditiva sobre a caminhada (**sem escala**).
- **Animações ainda ausentes:** idle relaxado, IK de pés, interação com armadilha, transporte e acampamento.
- **Vila:** fases reais de `world/hunters-village-v01` com LOD de distância; os Hunters circulam pela vila. A fase exibida é escolha de apresentação, porque **não há regra econômica aprovada**.
- **Assets novos** (não existiam; **proposta sem aprovação artística**), publicados e conferidos remotamente por SHA-256 (`assets/models/manifest-assets-v02.json`):
  - `carroca_v02.glb`: 1.400 tri, rodas animadas pela distância;
  - `acampamento_v02.glb`: 548 tri, com fogueira que ilumina;
  - `presa_de_ferro_v02.glb`: 512 tri, clipes acionar/rearmar;
  - `laco_de_raiz_v02.glb`: 372 tri, clipes acionar/rearmar.
- **Dodarro:** blockout estático sem rig; tem só um balanço leve (pendência).
- **Ambiente:** céu procedural, tone mapping ACES, sombras de contato, capim e flores, água com ondulação e reflexo do sol, pegadas azuis em forma de pegada.

## 5. Interface

- **HUD:** segue o layout da ilustração enviada no chat em 27/11 (a imagem não está no repositório):
  - menu de ordens à esquerda;
  - relógio, dia, ciclo, velocidade e clima no topo;
  - Expedição Atual com checklist;
  - bioma, temperatura e vento no canto;
  - barra inferior com arma, retrato, vida, proficiência, estado, Hunters e 6 slots;
  - painel de combate e condições à esquerda.
- **Janelas:**
  - Bestiário com retrato real, resumo da ficha, conhecimento, itens, biomas, mapa de ocorrência e Caçar;
  - mapa completo (M) com clima e clique para Viajar;
  - Sistema com 4 perfis e ajustes individuais;
  - menu do desenvolvedor (F3, tecla configurável).
- **Minimapa permanente removido.**
- **Limitações:**
  - um só modelo de Hunter, logo um só retrato (renderizado do GLB);
  - "Vigor" não aparece porque a simulação não tem estamina;
  - poções e utilitários não existem na simulação.

## 6. Parâmetros provisórios (fora do código)

- `data/gameplay-provisorio-v02.json`: espécies novas (hp, dano e itens por fórmula), armas lança/espadão, nomes das armadilhas, necessidades, relevância e clima.
- `data/vegetacao-provisoria-v02.json`: alturas-alvo e adensamento da vegetação. As árvores originais medem 57–132 m de mediana e foram reduzidas a 16–21 m. **Decisão do diretor pendente.**

## 7. Pendências e bloqueios

- **Bloqueios:**
  - `carioca1111/wildhaven-new` e `carioca1111/wildhaven` continuam **inacessíveis** nesta sessão (`add_repo` negado);
  - não há HUD ilustrada como asset no repositório.
- **Medição:**
  - FPS, 1% low e GPU no computador do diretor;
  - draw calls acima de 200 no perfil Médio em algumas cenas.
- **Arte e animação:**
  - aprovação da carroça, do acampamento, das armadilhas, das poses provisórias e da escala da vegetação;
  - rig do Dodarro;
  - clipes de idle, agachar, sentar, armadilha e acampamento.
- **Sistemas:**
  - pós-processamento real;
  - colisão das construções da vila (a física da V01 não as inclui);
  - espécies em outros biomas;
  - IK de pés.

## 8. Evidências

`evidencias/v02/`:
- HUD na vila, menu do desenvolvedor, mapa, tempestade forçada, carroças, capim, Modo Econômico;
- vista distante, pacote portátil extraído, comparação com os GLBs originais na mesma câmera, V01 de referência.

Benchmarks brutos: `game/build-real-v02/bench/`.
