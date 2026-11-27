# Integração da auditoria do Codex na V04.1

**Fonte:**
- branch `audit/v04-extreme-performance` (PR 9);
- documentos `AUDITORIA-PERFORMANCE-V04.md` e `PROMPT-CLAUDE-OTIMIZACOES-V04.md`;
- laboratório `tools/performance-lab.mjs` e 24 arquivos brutos (`bench/audit-*.json` e duas capturas).

**Base do Codex:** V04 `a2b11e7`, medida em Windows com i7-1165G7 e Intel Iris Xe (ANGLE/D3D11).

**Destino:**
- V04.1 em `game/build-real-v04-1/`;
- branch `feat/build-real-v04-1-extreme-performance`.

**Método:**
- o PR 9 **não** foi mesclado: cada correção virou um commit próprio, aplicado com o mesmo diff e com a autoria do Codex preservada;
- o laboratório e as evidências brutas foram copiados para `game/build-real-v04-1/tools/` e `game/build-real-v04-1/bench/codex-auditoria/`;
- o ZIP experimental do Codex não foi incorporado: o ZIP v04.1 já contém tudo.

## 1. Correções comprovadas — integradas e reproduzidas aqui

Reprodução no contêiner Linux:
- Chromium 158 headless com SwiftShader;
- servidores V04 e V04.1 lado a lado;
- ordem A/B/B/A;
- arquivos brutos no scratchpad do laboratório, números abaixo.

| ID | Commit Codex → V04.1 | Reprodução aqui (V04 → V04.1) | Observação |
| --- | --- | --- | --- |
| MEM-01 | `9383696` → `553ec97` | Após 70 s em Econômico e GC forçado:<br>• heap JS 35,5 → 4,8 MB<br>• backing storage 216,0–216,4 → 4,1–4,3 MB<br>• cena acessível pela depuração: sim → não | Bate com o Codex (35,3 → 4,6 MiB; 213,6 → 2,9 MiB).<br>Procurei outras referências globais: timers e ouvintes da cena são removidos e os carregamentos em `visual.ts` checam `disposed`; nenhuma outra retenção encontrada. |
| ACT-01 | `cf7425f` → `78a7f03` | Lab "cancelamento": órfãos 1 → 0 | O teste dedicado de troca de LOD durante a travessia de região continua pendente (PENDENCIAS-V04.1). |
| GP-01 | `b0ce0a5` → `76c5bba` | `tools/test/gpu-timer.mjs`: 5 inícios, 5 finais, 5 liberações | O SwiftShader não expõe o temporizador de GPU, então o ganho real só aparece no Windows. |
| BG-01 | `ad94066` → `7f57404` | Lab "manual": 0 quadros em 10 s, retomada no laço 3D | Ampliado na V04.1 (seção 2). |

## 2. O que a V04.1 acrescentou ao trabalho do Codex

**BG-01 completo** (`a772450`):
- botão no relógio e em Sistema, além de Shift+F8;
- aviso estático que retoma ao clicar;
- atalho registrado no início do carregamento: antes, um Shift+F8 durante o carregamento era ignorado e o 3D carregava e desenhava. Defeito encontrado pelo teste `tools/test/fundo-manual.mjs`, 8 etapas, todas aprovadas:
  - suspensão no carregamento;
  - retomada;
  - botão do relógio (0 quadros, tráfego 9,2 → 1,7 KB/s);
  - descarte do 3D após 75 s;
  - troca de região durante a suspensão (HV_01 → ER_21);
  - eventos preservados;
  - reconexão com o servidor reiniciado;
  - ausência de 8,3 h de jogo (10 min reais em ×50) sem nenhum quadro.

**Achados que o Codex deixou abertos:**

| ID | O que o Codex viu | O que a V04.1 mediu e fez |
| --- | --- | --- |
| Picos de 100–480 ms | 9 intervalos >100 ms em 15 s na vila; muitos sem tarefa longa registrada. | Três causas medidas e corrigidas:<br>• shaders compilados no jogo (nada era pré-compilado);<br>• a contagem de luzes locais mudava (+15 programas de uma vez ao acender as lanternas);<br>• o capim fazia raios sem BVH (165–176 ms num quadro).<br>Para a GPU real: gravador de quadros no F3. |
| VIS-01 | Todos os LODs das espécies das 64 primeiras criaturas eram carregados. | Só o LOD em uso, pré-carga preditiva do próximo LOD e shaders compilados antes do clone. |
| ECO-01 | Grades e visões incluíam congeladas. | Halo de percepção; digesto do estado idêntico; −13% por passo. |
| RAM-02 | Grade de alturas sem `drop`; `last` retido. | LRU de 16 MB com pinos e `last` limpo. Achado extra: a consulta varria todas as grades, e o custo crescia com a exploração. |
| MET-01 | A sonda de rAF media a cadência do navegador. | Contador de quadros ao vivo (o publicado só mudava a cada 30) e gravador no fim de cada quadro. Achado extra: o "heap" do F3 (`performance.memory`) dizia 296 MB onde o heap V8 tinha 42 MB, porque inclui os buffers de geometria. |
| MET-02 | Cronômetro do servidor sem serialização e sem envio por cliente. | `server.custo_ms_por_s` (passos, visão publicada, mensagens por cliente). `relevant()` deixou de copiar o estado inteiro por cliente: 3,24 → 0,88 ms por envio. |
| MET-03 | `soak-servidor-8h.json` tinha 192 min. | O arquivo foi publicado no meio da execução. A execução seguiu até 376,32 min e foi interrompida por um reinício do contêiner. O valor final está em `bench/v04-base/soak-servidor-8h.json`. O script agora grava `minutosExecutados` e `concluido`. |

## 3. Discordâncias e cuidados

- **Desligar quadros com a cena estática.** Concordo com o Codex: na vila o ciclo de luz, a água, o vento, as partículas e as poses mudam a imagem a cada quadro. A V04.1 não congela a cena. Ela limita os quadros só com a janela **fora de foco** (opção em Sistema, padrão 30).
- **Sombras.** Os números de isolamento do Codex (GPU 8,13 → 6,44 ms sem sombras) são exploratórios e vieram de estados diferentes. Medi quanto da vegetação entra no passe de sombra: 2 instâncias no perfil Médio e 18 no Alto, todas dentro do mapa. Não há desperdício a cortar aí sem mudar o visual. Ver RELATORIO-OTIMIZACAO-V04.1.
- **Comparar com o SwiftShader.** Nada aqui substitui a medição na Iris Xe. Os ganhos de GPU e de picos de compilação só são confirmados com o gravador do F3 no computador do diretor.
