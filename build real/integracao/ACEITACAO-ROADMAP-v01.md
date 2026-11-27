# Aceitação — `05-roadmap-aceitacao.md` × Build Real v01 (26/11/2026)

Cada item do escopo de aceitação, com status e evidência. **✅ feito e verificado** · **⚠️ parcial** · **❌ não feito**.
Parâmetros de gameplay marcados como provisórios estão em
[`game/build-real-v01/data/gameplay-provisorio-v01.json`](../../game/build-real-v01/data/gameplay-provisorio-v01.json);
nenhum deles é regra aprovada.

Evidências:
- **(T)** testes automatizados: `cargo test` e `node --test`.
- **(D)** `wh-sim-check demo`, a expedição roteirizada sobre o terreno real. Resultado em [`demo-check-v01.json`](../../game/build-real-v01/data/demo-check-v01.json): **14/14 etapas OK** (commit `fee36d2`, 17.358 s de jogo). Folhisco abatido em 5.700 s, retorno com itens em 6.622 s. Hunter sozinho contra Lobrapedra: caiu, Nailon partiu para o resgate, também caiu, e o Hunter teve morte permanente.
- **(N)** roteiro no navegador headless por cliques. Capturas em [`evidencias/`](evidencias/).

| # | Item do roadmap | Status | Evidência / observação |
| --- | --- | --- | --- |
| 1 | Jogador só comanda e observa; IA controla movimento e golpes | ✅ | Só existem ordens `explorar`, `cacar` e `recolher` (`POST /api/v1/orders`); não há rota de mover Hunter (N, D) |
| 2 | Sem nível geral; proficiências 1–20 por arma; progresso salvo | ✅ | `Hunter.skills`, progresso por prática, teste `skills_level_by_practice_without_general_level` (T); salvo no `world_state` |
| 3 | Novo nível de combate libera técnica; Desvio libera animações aplicadas pela IA | ⚠️ | A subida de nível é registrada em evento, mas **não há clipes** de técnicas nem de Desvio no GLB do workshop (só `Walking`/`Running`) |
| 4 | Desvio 1 (jogar-se e levantar) e Desvio 5 (rolar e esperar 3 s) | ✅ lógica / ❌ animação | Teste `dodge_level_5_waits_three_seconds…` (T); eventos na demo (D); animação ausente |
| 5 | Escalada, Primeiros socorros, Rodeio, Furtividade, Rastreamento com nível próprio | ⚠️ | Furtividade, Rastreamento, Rodeio e Armadilhas têm efeito; Escalada e Primeiros socorros existem como categoria, sem efeito (marcos pendentes no roadmap) |
| 6 | Conhecimento de Monstros só no Bestiário, influenciando a IA | ✅ | Aparece só no Bestiário. Com "estudado", o Hunter se agacha antes do alcance de visão da espécie; com "dominado", usa armadilha contra predador (D: "conhecimento: dominado → armadilha + grito") |
| 7 | HUD baseada na referência do diretor | ❌ | A imagem de referência **não está no repositório**; existe HUD técnica provisória com vida/estado, Hunters clicáveis, ordens e inventário |
| 8 | Exatamente duas carroças (Chad e Nailon), puxadas por dodos | ✅ lógica / ⚠️ arte | Teste (T); o dodo é o blockout do Dodarro (sem aprovação); a carroça **não tem asset** e aparece como marcador técnico |
| 9 | Carroça comporta 6 e recusa o 7º | ✅ | Teste (T) e demo: "A carroça leva no máximo 6 Hunters (pedido: 7)" (D) |
| 10 | Duas carroças = 12 vagas, sem limite de equipe | ✅ | Capacidade por carroça; nenhum limite total imposto |
| 11 | Viagem simulada até o hexágono, sem teletransporte | ✅ | A carroça percorre a rota por portais validados no terreno compilado (D: viagem de ~2.090 s) |
| 12 | Carroça acha clareira e monta acampamento | ✅ | `find_clearing` (raio 6 m, inclinação ≤ 12°, provisórios) (D, N) |
| 13 | Trocar equipamento, guardar itens, descansar com cura mais rápida | ⚠️ | Guardar itens e cura acelerada ✅ (D); **troca de equipamento não implementada** (há uma arma só) |
| 14 | Primeiro avistamento cria página de dossiê | ✅ | Teste `first_sighting_creates_…` (T); demo (D); navegador (N) |
| 15 | Novo avistamento atualiza sem duplicar e persiste | ✅ | Teste (T); estado no PostgreSQL (`world_state`) |
| 16 | Ficha com criatura, itens, mapinha e botão Caçar | ✅ | Painel do Bestiário (N, `evidencias/cliente-v01-dialogo-cacar.png`); itens provisórios (item 8) |
| 17 | Caçar: seleção, a pé ou carroça, custo, pagamento, 6 por veículo | ✅ | Diálogo Caçar (N), teste de dinheiro insuficiente (T) |
| 18 | Hunter procura pegadas; azuis só depois de descobertas; água interrompe | ✅ lógica | Descoberta por Rastreamento e azul no cliente (D, N); sem pegada sobre água, e o Hunter perde a trilha e busca do outro lado. A interrupção por água só aparece na demo quando a trilha cruza água |
| 19 | Rastros compactos sob demanda | ✅ | Anel por criatura (máx. 400), expiração, só as descobertas vão ao cliente; teste `ring_cap_and_break_flag` (T) |
| 20 | Estratégia autônoma: agachado + rodeio, ou armadilha + provocação | ✅ | Eventos "escolheu: aproximação agachada e rodeio" e "armadilha + grito" (D) |
| 21 | Armadilha imobiliza por segundos variáveis; criatura pode evitar ou romper | ✅ | "preso na armadilha (rede) por 6,5 s"; chance de evitar; porte maior que o limite rompe (D) |
| 22 | Situação desesperadora aciona resgate | ✅ | 1/3 caídos sem saída, ou Hunter sozinho caído (inclusive explorando) (D) |
| 23 | Chad ou Nailon se equipa, combate de verdade e pode perder | ✅ | O socorrista usa o mesmo combate; o resgate pode fracassar (D) |
| 24 | Vencendo, recolhe os feridos e leva ao acampamento | ✅ lógica | `step_rescuer`: recolhe, carrega e cura no acampamento ou na vila |
| 25 | Morte permanente persistida | ✅ | Teste de serialização (T); `alive=false` salvo; o servidor recusa ordens a mortos |
| 26 | Simulação acompanha os Hunters, não a câmera | ✅ | Janelas por ator no servidor; criaturas simuladas num raio de 1.500 m de atores |
| 27 | Cobertura continental: auditar 272, física, fronteiras, sob demanda | ✅ | `RELATORIO-N-N.md`: 272/272 compilados, 705/738 arestas |
| 28 | Não confundir 272 no grafo com 272 jogáveis | ✅ | 223 certificados tecnicamente, declarados como tal |
| 29 | Seis iceberg-sea precisam de acesso marítimo ou aéreo | ❌ | Exceção registrada; sem navegação marítima |
| 30 | Atravessar fronteiras sem sumir nem teleportar; chunk ausente: carga segura | ✅ | Passo na travessia = velocidade × dt; chunk sem pacote = intransponível, nunca chão inventado |
| 31 | Física pré-compilada em chunks, streaming e LOD, memória controlada | ⚠️ | Física e streaming ✅; **LOD/HLOD visual não implementado** |
| 32 | Nenhuma mudança na Alpha nem em GLBs aprovados | ✅ | `git diff main -- game/alpha01 assets` vazio |
| 33 | Modo Econômico pixel art com Hunters, criaturas, cenário, estatísticas e acontecimentos | ✅ | `evidencias/cliente-v01-modo-economico.png` |
| 34 | Troca 3D ↔ 2D só muda o apresentador | ✅ | A simulação é do servidor; o cliente só troca o renderizador |
| 35 | Economia de CPU, GPU e memória **medida** | ⚠️ | Medido **só em renderização por software** (Chromium headless/SwiftShader): 3D ~0,9 FPS × pixel 56–60 FPS, quadro 2D 0,3–2,3 ms. Falta GPU real (inclusive integrada) |
| 36 | Benchmark determinístico 3D × pixel no mesmo hardware | ⚠️ | Estatísticas expostas em `window.__wildhavenPerf`; falta rodar em hardware real |
| C1 | Frustum culling com limites conservadores para animados | ✅ | Esfera de limite 2× nas malhas com esqueleto (não `frustumCulled=false`) |
| C2 | Occlusion culling conservador, sem consulta síncrona de GPU | ⚠️ | Oclusão por relevo (raios no heightfield) só para atores animados (~20–30% descartados nas cenas testadas); construções e vegetação não entram |
| C3 | Backface culling com auditoria | ⚠️ | Auditados: Folhisco 20/20, Lobrapedra 12/12, Hunter 1/1 e Dodarro 1/1 materiais `doubleSided`. Ficaram **como exportados** (mudar seria alterar asset aprovado) |
| C4 | Medir FPS, p50/p95/p99, draw calls, triângulos, memória em GPU real | ❌ | Só software; draw calls e triângulos aparecem no HUD |
| E | Gate de escalabilidade (N1/N2/N3, stress de 1.000, 24 h) | ❌ | Fora do corte original; criaturas fora de 1.500 m ficam **congeladas** |

## Critério de demonstração do roadmap

"Consultar o bestiário, clicar Caçar, escolher Hunters e transporte com pagamento, deslocar-se ao habitat,
revelar pegadas azuis, perder o rastro na água, avistar a presa, executar rodeio ou armadilha, lidar com
ferimentos ou resgate e retornar": **executado de ponta a ponta** em (D) e, por cliques, em (N). As exceções
estão na tabela acima. A perda do rastro na água depende de a trilha sorteada cruzar água.
