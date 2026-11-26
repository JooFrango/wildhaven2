# 05 — Roadmap da Build Real para 28/11/2026

**Planejamento, não promessa de entrega.** A meta é uma **fatia vertical jogável** do zero, sem modificar a Alpha nem mesclar builds experimentais.

## Sequência de trabalho sugerida [PROPOSTO]
| Data-alvo | Etapa | Entrega demonstrável |
|---|---|---|
| 22–23/11 | Fundação | Arquitetura isolada, HUD de referência, seleção/câmera/ordens e salvamento |
| 24/11 | Expedição | Hunters autônomos, rotas e janela de simulação detalhada acompanhando Hunters |
| 25/11 | Logística | Duas carroças na vila, dodos e transporte de até 6 Hunters por carroça |
| 26/11 | Acampamentos + bestiário | Montar em clareira, interagir com equipamento/itens/descanso; avistamento criando dossiê com itens, mapinha e botão Caçar |
| 27/11 | Rastreamento + combate e resgates | Trilha virtual com revelação azul, interrupção pela água, táticas de furtividade/armadilha, perigo crítico, resgates e morte |
| 28/11 | Integração | Teste de ponta a ponta, falhas, persistência e otimização navegador |

## Escopo de aceitação [CONFIRMADO + TESTÁVEL]
- [ ] O jogador só **comanda e observa** Hunters; IA controla movimento e golpes.
- [ ] **Nenhum Hunter tem nível geral**. Proficiências distintas têm níveis 1–20, inclusive por arma; o progresso individual é salvo.
- [ ] Um novo nível de combate com cada arma libera uma técnica nova, e níveis de Desvio permitem novas animações, aplicadas autonomamente pela IA.
- [ ] Testar **Desvio 1** (jogar-se no chão e levantar) e **Desvio 5** (rolar e esperar **3 segundos** antes de atacar); Armadilhas por porte e Mineração/Velocidade por eficiência.
- [ ] Habilidades adicionais **confirmadas como categorias**: Escalada, Primeiros socorros, Rodeio, Furtividade e Rastreamento, todas com nível próprio 1–20; marcos/efeitos específicos ainda pendentes.
- [ ] **Conhecimento de Monstros é mostrado somente no Bestiário, mas influencia realmente o comportamento geral da IA dos Hunters**. Testar decisões diferentes para estados de conhecimento distintos, preservando sensores, habilidades, resultados plausíveis e sem revelar localização secreta. Modelo compartilhado ou individual ainda precisa de decisão.
- [ ] Ver [11 — Habilidades dos Hunters](11-habilidades-hunters.md): outras habilidades permanecem propostas, não requisitos fechados de 28/11.
- [ ] HUD se baseia na referência do diretor, com vida/estado, ordens, Hunters clicáveis e inventário inferior.
- [ ] **Exatamente duas carroças** na vila, atribuídas a **Chad** e **Nailon**, puxadas por dodos.
- [ ] Uma carroça comporta **6 Hunters** e impede embarcar um **7º Hunter** (teste de capacidade).
- [ ] As duas carroças juntas oferecem **12 vagas de transporte**, sem definir limite total da equipe do jogo.
- [ ] A viagem até o hexágono selecionado é simulada; não teletransportar.
- [ ] A carroça encontra ponto limpo/clareira e monta acampamento.
- [ ] Hunters trocam equipamentos, guardam itens e descansam para recuperar vida mais rapidamente.
- [ ] Um Hunter que **avista pela primeira vez** uma espécie acrescenta **uma página de dossiê** ao bestiário.
- [ ] Novo avistamento da mesma espécie **atualiza**, não duplica; o dossiê permanece após salvar/reabrir.
- [ ] Ficha mostra **criatura, itens possíveis, mapinha de habitats e botão Caçar**.
- [ ] Botão Caçar abre seleção de Hunters e viagem **a pé ou de carroça**; carroça mostra custo, verifica pagamento e aceita no máximo **6 por veículo**.
- [ ] Ao chegar, Hunter **procura pegadas**; elas só **brilham em azul quando descobertas**, e a trilha se **interrompe ao entrar na água**.
- [ ] Rastros são **registros compactos sob demanda**, não milhares de objetos 3D invisíveis permanentes por todo o mapa.
- [ ] Após o avistamento, Hunter escolhe autonomamente entre **aproximação agachada e rodeio com espada** ou **armadilha e provocação**, quando essas estratégias forem viáveis.
- [ ] Armadilha pode imobilizar por segundos variáveis segundo seu tipo e a criatura pode evitar/fugir da armadilha.
- [ ] Situação desesperadora (1/3 caído + demais sem saída, ou único Hunter da caçada caído) pode acionar resgate.
- [ ] Chad ou Nailon se equipa, desloca-se e **combate realmente** o monstro, com possibilidade real de perder.
- [ ] Quando vence, recolhe feridos e os leva ao acampamento para se recuperarem.
- [ ] Se não há resgate possível e os Hunters morrem, a morte **permanece persistida**.
- [ ] A simulação detalhada acompanha os Hunters, não depende do local da câmera.
- [ ] **Meta de cobertura continental:** auditar 272/272 GLBs de origem, gerar camadas físicas e visuais otimizadas, validar fronteiras e carregar sob demanda; ver [12 — Pesquisa mapa completo](12-pesquisa-mapa-272-hexagonos.md).
- [ ] Não confundir 272 hexágonos no grafo com 272 hexágonos fisicamente jogáveis. A V02.3 comprova somente 41 integrados; os outros requerem testes de navegação, terreno, colisão e gameplay.
- [ ] **Seis hexes iceberg-sea** têm travessia terrestre bloqueada no grafo: para anunciar 272 plenamente jogáveis, será necessário acesso marítimo/aéreo validado.
- [ ] Hunters atravessam fronteiras sem desaparecer/teleportar; caso falte chunk, carregamento seguro e retry. Nenhuma luta é cancelada apenas por troca de câmera.
- [ ] Pipeline pré-compila física em chunks, preserva bordas/água e utiliza streaming/LOD, com memória controlada ao cruzar dezenas de hexes.
- [ ] Nenhuma mudança em Alpha nem substituição de GLBs aprovados.
- [ ] Modo Econômico oferece **visualização 2D pixel art com Hunters, criaturas, cenário local, estatísticas e acontecimentos em tempo real**.
- [ ] A troca 3D↔2D altera somente o apresentador; a **simulação permanece idêntica** (mesmas sementes, ordens, ticks, IA, física, combate, ferimentos e morte permanente).
- [ ] Modo Econômico comprova economia de CPU total/renderização, GPU e memória **medida**, sem inventar ganhos em porcentagem; resguarda limitação das abas ocultas.
- [ ] Benchmark com simulação determinística igual compara 3D e pixel art no mesmo hardware; não degradar IA/física para fabricar desempenho.


## Gate de desempenho gráfico — culling [CONFIRMADO EM 25/11/2026; IMPLEMENTAÇÃO PENDENTE]
Requisito obrigatório aprovado pelo diretor para a Build Real. **Não criar laboratório separado de culling.** Implementar e validar diretamente na futura Build Real, preservando a Alpha e os protótipos anteriores.
- [ ] **Frustum Culling:** descartar da renderização objetos/chunks fora do volume visível da câmera. Usar limites conservadores para modelos animados, incluindo movimentos extremos, armas e acessórios. Não copiar indiscriminadamente `frustumCulled = false` da V02.3; evitar desaparecimento de Hunters/criaturas durante animações.
- [ ] **Occlusion Culling:** descartar objetos totalmente ocultos por obstáculos opacos (relevo, paredes e construções), com testes conservadores e sem bloquear objetos parcialmente visíveis. Considerar custo de CPU/GPU, mudanças de câmera, oclusores dinâmicos e reaparecimento imediato; não usar consultas de GPU síncronas por objeto. Preservar sombras relevantes de objetos fora da visão ou ocluídos.
- [ ] **Backface Culling:** manter materiais de superfícies fechadas com faces traseiras descartadas; auditar materiais GLB, orientação dos triângulos e exceções justificadas (folhas, superfícies finas, interiores e outras geometrias que realmente necessitam de duas faces). Não aplicar `FrontSide` indiscriminadamente a todos os materiais.
- [ ] Os três mecanismos afetam somente apresentação gráfica. IA, física, colisões, combate, sensores, persistência e níveis ecológicos continuam independentes da câmera e da visibilidade.
- [ ] Validar na própria Build Real em floresta, selva, vila, montanha, dunas e cavernas quando disponíveis; comparar baseline e otimizações nas mesmas cenas, câmeras, hardware e configurações, inclusive GPU integrada. Medir FPS, tempo de quadro p50/p95/p99, draw calls, triângulos, CPU/GPU e memória quando mensuráveis, sem prometer ganhos antes dos testes.
- [ ] Verificar regressões visuais (bordas do frustum, modelos animados, sombras, transparências, troca de Hunter, zoom e deslocamento), além da equivalência da simulação ao variar a câmera. Se o custo da oclusão exceder o benefício em um cenário, ajustar sua estratégia de descarte sem sacrificar correção.
- [ ] Não considerar o requisito implementado apenas pela existência de documentação ou pelo comportamento padrão do Three.js; registrar evidências da futura integração e os resultados medidos.

## Gate de escalabilidade — IA adaptativa [DIRETRIZ AUTORIZADA, IMPLEMENTAÇÃO PENDENTE]
Consultar [14 — IA adaptativa e orçamento de servidor](14-ia-adaptativa-otimizacao-servidor.md) antes de portar ou integrar o núcleo da IA. Não declarar capacidade de produção pela demonstração de 28/11.
- [ ] Medir baseline real e separar benchmark sintético de integração.
- [ ] Atribuir níveis pela união das regiões dos Hunters; preservar combates e interações causais, independentemente da câmera.
- [ ] Frequência adaptativa de percepção com estímulos válidos e transições sem perda de estado, sem reduzir física crítica.
- [ ] Índices espaciais para consultas locais, cache de navegação compartilhada e dados compactos por indivíduo.
- [ ] Validar N1/N2/N3, múltiplos grupos, fauna distante, ferimentos, persistência, ausência de duplicação e identidade preservada.
- [ ] Clima/calendário universais, dia 2h e noite 40min; não duplicar meteorologia por conta.
- [ ] Stress Lab: carga progressiva até 1.000 simultâneos, cenários PvE/PvP, 24h de estabilidade e hardware registrado; publicar RAM, CPU e p95/p99 reais.
- [ ] Capacidade e custo por jogador são conclusões de testes, não garantias; meta econômica em uma máquina de 8–16 GiB ainda não comprovada.

## Critério de demonstração [PROPOSTO]
Demonstrar uma expedição completa partindo da vila: consultar bestiário (criatura, itens e mapa), clicar Caçar, escolher Hunters e transporte com pagamento da carroça, deslocar-se ao habitat, procurar e revelar pegadas azuis, perder rastro na água, avistar a presa, executar uma estratégia de rodeio/armadilha, lidar com ferimentos/resgate e retornar. Testar persistência, recursos e carga do navegador. **Este cenário inteiro até 28/11 é uma meta ambiciosa e pode exigir priorização de uma versão demonstrativa menor, sem declarar concluídas mecânicas ainda ausentes.**

Não exigir renderização/colisão física detalhada em todos os hexágonos na primeira entrega; regiões distantes podem usar simulação estratégica identificada. Usar assets reais aprovados e validar seus caminhos antes da integração.

## Referências e limites
- Repositório de produção: `carioca1111/wildhaven-new`; repositório histórico: `carioca1111/wildhaven`.
- `AGENTS.md` rege produção e publicação de modelos; não criar novos GLBs nesta etapa.
- PRs #102/#103 documentam testes experimentais, **não equivalem à Build Real**.
- Não modificar `game/alpha01/`; implementação futura deverá possuir pasta e branch próprias, sujeitas à aprovação do diretor.
- Até esta revisão, **somente documentação** foi criada.

## Itens para decisão do diretor
1. Número máximo de Hunters simultâneos no mundo e divisão em equipes.
2. Viagens de Chad/Nailon em conjunto ou independentes.
3. Condição exata do resgate e janela de tempo do Hunter caído.
4. Regras de carga/itens e desmonte do acampamento.
5. Bestiário: dossiê completo ao avistar ou revelar parte do conhecimento depois.
6. Qual área detalhada será usada na primeira demonstração se a auditoria de 272 hexágonos ainda não permitir garantir gameplay físico em todo o mundo. Evitar declarar o mapa completo sem QA por hex.
7. Quanto cobra a carroça e como se calcula o preço? Pode uma mesma caçada usar duas carroças?
8. Dados canônicos de drops e habitats por espécie para o bestiário.
9. Persistência/vida útil dos rastros e comportamento para recuperar trilha após cruzar água.
10. Catálogo e duração das armadilhas, anatomias e armas adequadas ao rodeio montado.
11. Definir critério de economia suficiente para o [Modo Econômico](10-modo-economico-pixel-art.md) e se o usuário poderá deixar uma janela visível em segundo plano. Aba ocultada não garante simulação local contínua.
12. Definir catálogo de habilidades e evolução por prática, inclusive as animações de 20 níveis de combate com cada arma e Desvio.
13. Definir como serão jogáveis os seis hexes marítimos `iceberg-sea` e o transporte necessário; verificar produção e aprovação dos GLBs originais v12 e litoral.
14. Priorizar construção/validação do pipeline de [272 hexágonos](12-pesquisa-mapa-272-hexagonos.md) versus alcance mais limitado da fatia vertical antes de anunciar data garantida.
