# 04 — Bestiário e dossiês das criaturas

## Princípio central [CONFIRMADO]
O jogo terá um **bestiário**. **A cada animal avistado**, o bestiário **cria ou atualiza uma página correspondente à criatura** e mostra seu **dossiê**. Um segundo avistamento da mesma espécie **não cria outra página duplicada**.

O bestiário reúne o conhecimento das espécies reais que habitam o Wildhaven. As fichas devem se basear na documentação/autoria aprovada do projeto, nunca em atributos, ataques ou fraquezas inventados.

**Correção do diretor em 23/11/2026:** **Conhecimento de Monstros aparece somente no Bestiário, porém afeta realmente o comportamento dos Hunters em geral.** Não é uma informação meramente decorativa. Os dossiês, observações e eventual indicador de progresso ficam na ficha da espécie; o sistema influencia as **decisões da IA** em aproximação, leitura de ameaças, combate, armadilhas e retirada conforme o conhecimento disponível. Não exibir este conhecimento na ficha de habilidades individuais do Hunter. **Ainda falta definir** se o conhecimento é compartilhado pela equipe ou específico de cada Hunter, com visualização centralizada no Bestiário; não presumir nível 1–20 para esse sistema. **Rastreamento** e **Furtividade** permanecem habilidades individuais próprias. Ver [11 — Habilidades dos Hunters](11-habilidades-hunters.md).

## Evento de avistamento [REQUISITO FUNCIONAL]
1. Um Hunter da expedição **avista uma criatura** — o critério exato de percepção deverá ser implementado com a IA de visão já existente ou equivalente.
2. O sistema reconhece o **ID estável da espécie**, independentemente de variação visual e de instâncias individuais.
3. Se ainda não há entrada no bestiário, cria uma **página de dossiê** para essa espécie.
4. Se a entrada já existe, **atualiza seus dados de observação**, sem duplicar.
5. Emite um aviso legível na HUD (ex.: "Nova criatura registrada" ou "Avistamento registrado").
6. **Salva o progresso** no estado persistente da expedição/jogador.

## Campos da ficha e informações de caçada
Os elementos **criatura retratada, itens potencialmente obtidos e mapinha mostrando onde vive** são **confirmados** pelo diretor, assim como o dossiê e o botão de caçada. A apresentação visual e o conteúdo exato das tabelas dependerão dos dados canônicos das espécies.

## Dossiê — proposta de campos [PROPOSTO]
| Campo | Regra sugerida |
|---|---|
| Nome e ID da espécie | Identidade canônica da espécie |
| Retrato/ilustração | Arte ou render aprovado, com origem identificada |
| Descrição | Dossiê de lore/documentação já existente |
| Bioma e ambiente | Habitats publicados; exibir **mapinha** das regiões onde a espécie vive [CONFIRMADO] |
| Porte e anatomia | Informações verificadas da espécie |
| Dieta | Herbívoro, carnívoro, onívoro e exceções existentes |
| Comportamento | Territorialidade, socialidade e padrões observados/documentados |
| Perigos e ataques | Só ataques efetivamente definidos no projeto |
| Sinais e rastros | Dados definidos/observados |
| Registro de avistamentos | Quantidade, primeiro/último evento, hexágono onde visto |
| Itens que a criatura pode fornecer [CONFIRMADO] | Mostrar itens possíveis; usar apenas dados de drop aprovados, sem inventar taxas |
| Estado de descoberta | Avistado / estudado / derrotado, se aprovado |

**Decisão pendente:** o diretor confirmou o **dossiê exibido no primeiro avistamento**. A ideia de revelar informações progressivamente (por rastros, ataques observados, vitórias ou pesquisa) é **opcional e não aprovada**. Não bloquear todo o dossiê ao avistar sem a decisão do diretor.

## Conhecimento da espécie e comportamento dos Hunters [CONFIRMADO + DETALHES PROPOSTOS]

- [CONFIRMADO] A ficha do Bestiário mostra informações e **Conhecimento de Monstros**. O conhecimento registrado **modifica o comportamento da IA dos Hunters**, não apenas uma descrição.
- [PROPOSTO] A IA consulta conhecimento relevante à espécie e ajusta decisões: previsão de investida observada, escolha de posicionamento, armadilhas mais adequadas, momento de aproximação, cautela e retirada. Ela continua sujeita aos seus sentidos, níveis de habilidade, equipe, ferimentos e riscos reais.
- [PROPOSTO] Eventos reais (avistamentos, ataques observados, confrontos) alimentam registros; a regra exata para desbloquear e quantificar conhecimento depende de aprovação.
- [PENDENTE] O conhecimento é global/compartilhado entre Hunters ou individual com visualização apenas no Bestiário? A escolha deve preservar os registros persistentes da espécie e a morte permanente.
- [OBRIGATÓRIO] Não transformar o conhecimento em radar, garantia de sucesso ou desbloqueio de ataques de arma que dependem das proficiências pessoais.

## Botão Caçar [CONFIRMADO]
Cada ficha oferece um **botão interativo “Caçar”**. Ao clicar, o jogador seleciona **quais Hunters participarão** e se irão **a pé ou de carroça**. Carroça **custa dinheiro e leva no máximo seis Hunters por carroça**. Depois de chegar à região de caça, os Hunters **procuram pegadas** antes do confronto, em vez de correr direto até o animal. O procedimento detalhado está em [06 — Caçadas pelo bestiário](06-cacadas-pelo-bestiario.md), [07 — Rastros](07-rastros-otimizacao.md) e [08 — Estratégias](08-estrategias-emboscada-armadilhas.md).

**Mapinha da ficha:** é um mapa **de habitat**, não um minimapa de HUD permanente e não um radar em tempo real para revelar a posição de cada animal [interpretação proposta].

## Integração com a HUD [PROPOSTO]
- Acesso ao bestiário por um menu persistente da interface, sem exigir minimapa fixo.
- Notificação discreta ao descobrir espécie pela primeira vez.
- Página com retrato da criatura, informações, itens possíveis, mapinha de habitat, botão Caçar e histórico; navegação por espécie ou bioma.
- Quando uma ficha depender de GLB/arte, conferir versão real aprovada e não usar conceito como se fosse render do GLB.

## Persistência e verificações obrigatórias [PROPOSTO]
- Uma chave única por espécie evita duplicatas entre saves e avistamentos repetidos.
- Variações macho/fêmea e juvenis permanecem relacionadas ao ID da espécie; subpáginas só com regra aprovada.
- Salvar de forma independente do Hunter que viu a criatura, para não apagar o bestiário com morte permanente.
- Testes: primeiro avistamento cria 1 página; repetição atualiza a mesma página; trocar de Hunter não apaga; sair e retornar mantém o dossiê; espécie ainda não avistada não aparece como descoberta.

## Pendências
- O avistamento vale quando um Hunter detecta, quando o grupo detecta, ou quando a câmera simplesmente exibe um animal?
- O dossiê completo fica visível ao primeiro encontro ou parte é desbloqueada depois?
- Se a espécie for avistada em outro bioma, os dois habitats aparecem no registro?
- Qual repositório/estrutura conterá a fonte oficial dos dossiês canônicos e dos itens de drop de cada espécie?
- Como a fonte do mapa de habitat será vinculada aos biomas/hexágonos atuais, sem usar posições exatas ocultas de indivíduos?
- Qual moeda e fórmula do custo da viagem de carroça?
