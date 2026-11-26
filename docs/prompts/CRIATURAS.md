# Padrão de criaturas, monstros e animações

Leia primeiro [Continuidade](CONTINUIDADE.md). “Monstro” e “criatura” seguem o mesmo processo: cada espécie deve ter ecologia, anatomia e identidade próprias.

## Direção artística

**Low-poly/mid-poly estilizado, anatômico e facetado, com planos firmes, silhueta expressiva e suavização seletiva.** A referência principal de construção é o **Torvardo v03**; o usuário também indicou **Mastélio v03 e Garruva v03** como exemplos perfeitos em 2026-11-09. Abra os [exemplos com GLBs, fontes e renders](referencias/exemplos-criaturas-v03.md) antes de modelar. Fantasia naturalista é a direção geral; referências como Monster Hunter ajudam na massa e ecologia, sem copiar criaturas existentes.

- Comece pela silhueta sem materiais. Resolva tronco, caixa torácica, quadril, pescoço, cabeça, membros e cauda com transições intencionais.
- Modele cabeça/focinho com perfil próprio e olhos inseridos no crânio. Cotovelos, joelhos, jarretes, patas e pés precisam sustentar a postura.
- Use quebras de planos, normais separadas e arestas seletivas nas regiões que precisam de estrutura. Suavize apenas onde isso favorece a anatomia.
- Construa blockouts com seções transversais controladas: perfil, largura, altura e orientação variam conforme tórax, quadril, pescoço e membros. Resolva as transições anatômicas e os planos antes do detalhamento; mudar apenas subdivisões não corrige aparência de massinha.
- Curvas e tubos paramétricos podem construir chifres, caudas e apêndices com trajetória e raio controlados. Avalie a forma resultante, as conexões e a silhueta. Concatenar peças em uma única mesh não prova vértices soldados ou deformação contínua, nem obriga o rig futuro a usar uma única malha.
- Agrupe crina, pelos, penas, placas e escamas em massas econômicas integradas. Detalhes que alteram a silhueta precisam de geometria; textura e cor reforçam a forma.
- Evite corpos de esferas/cápsulas/tubos visivelmente colados, olhos aderidos, caudas de mangueira, músculos inflados, juntas moles e aparência de massinha ou borracha. Primitivas podem servir ao bloqueio, sem definir o acabamento final.
- Materiais naturais e simples, sem brilho plástico ou metalização indiscriminada. Paleta harmônica com habitat e contraste entre corpo, ventre, cabeça e detalhes.
- Não acrescentar espinhos e placas genéricos para preencher superfície. Cada estrutura deve ter função e identidade.

## Identidade que já deve ser preservada

| Espécie | Diretriz |
| --- | --- |
| Arumbar | Bisão blindado colossal, quadrúpede, ombros/corcova, crina, chifres e placas integradas. Exclusivo da savana, raro e predominantemente solitário. |
| Rocantraz | **Bípede**, duas pernas portantes, braços menores e cauda de equilíbrio. Predador ápice muito raro. Variantes florestal e desértica pertencem à mesma espécie. |
| Velsari | Pequeno antílope fantástico dourado, orelhas grandes, chifres pequenos, cascos fendidos, corrida/saltos e pequenos grupos. |
| Tarruco | Redesenho compacto, dorso peludo, focinho curto, orelhas grandes, crista óssea discreta e membros anteriores escavadores. Não retornar à aparência rejeitada de anta blindada/tatu. |
| Torvardo | Grande pastador da savana, corpo robusto, juba geométrica, escudo frontal e chifres curvos; piloto v03 como principal referência de planos. |
| Raizauro | Réptil herbívoro escavador, bico córneo, patas/garras escavadoras e placas; conferir aprovação específica da forma. |
| Mastélio | Grande frugívoro, tromba curta, orelhas abertas e membros colunares. |
| Garruva | Réptil terrestre necrófago, crânio alongado, mandíbula forte e cauda pesada. A proposta anterior de ave foi descartada. |

Essa tabela preserva decisões dos textos fornecidos, não declara o modelo mais recente aprovado. Confira versões, conceitos e registros atuais. Sevilho, Arbélio, Frutavil, Cromátil, Talvero, Rambrél, Rambrél-das-Chapadas, Turvagal, Torvardo, Raizauro, Mastélio e demais espécies seguem a mesma linguagem, com anatomia própria. Mencionar um nome não comprova existência de GLB.

## Processo de produção

1. **Inspeção e planejamento:** localize ficha, conceitos, variantes, versões, fontes, consumidores e os pilotos v03. Registre classificação, bioma, dieta, dimensões, massa de design, anatomia, locomoção, sociabilidade, raridade, defesa, reprodução, presas/predadores e características únicas. Valores novos são propostas; não apresentá-los como simulação existente ou ciência medida. Prefira lotes de até duas espécies, com avaliação visual individual.
2. **Conceito e aprovação:** para nova espécie, apresente imagem individual de corpo inteiro, anatomia legível e vistas úteis. Compare com espécies próximas. Use um conceito já aprovado sem pedir a mesma aprovação novamente; se faltar, apresente-o antes de adotá-lo como referência definitiva, salvo orientação atual diferente. Avance na ficha e estudo anatômico enquanto a decisão estiver pendente.
3. **Blockout 3D real:** construa silhueta, tórax, quadril, pescoço, cabeça, articulações, patas/apoio, cauda e estruturas próprias, nessa prioridade. Controle seções e planos, sem começar por acessórios superficiais. Em revisão, evolua a base existente.
4. **Exportação e aprovação do blockout:** exporte o GLB estático, reimporte, gere perfil, frente e três-quartos e publique arquivos/fontes/manifesto na branch/PR. Compare com o conceito e mostre o resultado concreto. Corrija proporções e anatomia e obtenha aprovação específica da forma antes de refinamento, rig/animação e LODs, salvo dispensa atual do usuário. A aprovação do conceito não aprova automaticamente o blockout.
5. **Refinamento:** preserve os planos e proporções aprovados; refine transições, rosto, narinas, boca, orelhas, pelagem/placas e materiais. Garanta espaço para movimentos. Exporte e gere novas capturas após alterações.
6. **Rig:** crie esqueleto adequado à anatomia e use pesos/deformação orgânica quando necessários. Documente o método real. Teste poses extremas, articulações e apoio; não chamar simples pivôs rígidos de skinning por pesos.
7. **Animações:** desenvolva movimentos próprios, respeitando massa, locomoção e nicho. Incorpore clipes ao GLB, reimporte e teste playback, loops, poses e apoio antes da otimização final.
8. **LODs e publicação final:** após estabilizar geometria/rig, produza os níveis apropriados, compare silhueta, materiais e animações e publique todos os arquivos prometidos, com hashes e evidências. A publicação ocorre também nas etapas anteriores; um blockout não precisa esperar rig para estar disponível para revisão.

### Entregáveis conforme a etapa

| Etapa | Evidência necessária |
| --- | --- |
| Conceito | Ficha/design e imagem individual identificada como conceito, corpo inteiro. |
| Blockout | GLB estático real, fonte/editável quando disponível, manifesto com métricas/hash, três renders do exportado, comparação com conceito e branch/PR para revisão. Rig, clipes e LOD1/2 ainda não são exigidos. |
| Refinamento | Geometria/materiais da revisão e novas capturas do GLB exportado. |
| Rig e animação | Esqueleto/método declarados, testes de poses/deformação e clipes prometidos embutidos/reproduzidos, com prévia animada real. |
| Otimização final | LOD0/1/2 quando apropriados, comparação visual, métricas e playback dos níveis animados entregues. |

Mantenha PRs de criaturas em revisão até a aprovação artística aplicável e siga o fluxo autorizado de integração. Não mescle automaticamente um PR em revisão nem considere a aprovação de uma referência como aprovação de uma espécie nova. Registre aprovações de conceito, forma/blockout e versão final separadamente.

## Continuidade ecológica quando houver integração

As criaturas devem continuar existindo na simulação fora da tela; simplificar a atualização distante não significa apagar e recriar indivíduos ou desfazer consequências. Registre o que o runtime realmente implementa antes de afirmar persistência, reprodução, caça ou regulação de populações. Essas diretrizes não ampliam uma tarefa de modelagem para implementar o ecossistema.

Para especialistas em cupins, preserve as decisões do mestre fornecido: cupinzeiro 3D sem obrigação de interior navegável, colônia finita que perde indivíduos ao ser explorada e se recupera gradualmente apenas enquanto viva. População zero significa morte definitiva daquela colônia, sem regeneração automática; a estrutura abandonada se degrada. Presença desses assets ou regras não autoriza espalhá-los por cenários que os excluem. Novos parâmetros e taxas precisam de proposta/testes, sem inventar valores já implementados.

## Orçamento de geometria

Os pilotos facetados v03 registram aproximadamente **3.500–5.000 triângulos**: Torvardo 3.910, Raizauro 4.822, Mastélio 3.570 e Garruva 4.252. São exemplos estáticos de construção econômica; não são mínimos, tetos ou LODs finais animados. Comece com a geometria necessária à forma e acrescente detalhe onde melhorar anatomia, silhueta ou deformação.

Metas iniciais do guia anterior, por animal final em LOD0, mantidas como planejamento flexível:

| Porte | Triângulos de referência |
| --- | ---: |
| Pequeno | 4.000–8.000 |
| Médio | 12.000–26.000 |
| Grande | 18.000–26.000; exceções justificadas pela silhueta/estruturas |

LOD1 busca redução de 40%–65% e LOD2 de 65%–85%, **ambas em relação ao LOD0**. São metas de planejamento, não garantia de qualidade nem limites absolutos. Planeje LOD0/1/2; entregue os níveis que o uso justificar e explique ausências. Não criar arquivos duplicados para alegar três LODs. Preserve rig/clipes compatíveis ou documente a diferença.

Concentre geometria no rosto, silhueta e pontos de deformação. Meça os triângulos efetivos do GLB e declare o método: geometria única nas definições de malha e geometria desenhada por instância são métricas distintas. Registre também materiais/draw calls, bytes, texturas e custo no navegador quando medido. Não reutilize mínimos high-poly de testes antigos como meta de otimização.

## Rig e contrato de animação

Esta seção se aplica à etapa de rig/animação. Blockouts podem declarar zero skins/juntas/clipes e permanecer estáticos; não adicionar animações fictícias para preencher um checklist. Documente se usa pivôs rígidos, ossos com skins/pesos, morph targets ou combinação. Conte nós de transformação, juntas de skin e skins separadamente; nome de nó não prova existência de osso. IK baked em clipe não é um controlador de IK funcionando sobre o terreno no jogo.

Clipes seguem a biologia: idle, locomoção adequada, alimentação, alerta/reação, descanso e morte; ataques, escavação, pastagem, planar e outros movimentos conforme o nicho. Não prometer o mesmo pacote para anatomias distintas. Preserve os nomes consumidos pelo código: `die` e `death` não são intercambiáveis sem migração.

Referências de contrato da main auditada: Arumbar v03 tem `idle, walk, run, graze, drink, alert, charge, death`; Rocantraz v04 tem `idle, walk, stalk, run, charge, bite, swipe, roar, feed, defend, rest, die`. São contratos dessas revisões; confirme o candidato escolhido e suas variantes antes de alterar.

Movimentos de nicho propostos no mestre atualizado: Torvardo pastar/bater cascos/investir; Raizauro escavar/arrancar raízes/defender com a cauda; Mastélio alcançar e agarrar frutos com a tromba/beber; Garruva farejar carcaças/arrancar carne/ameaçar/defender alimento. Esses movimentos são próximos entregáveis, não clipes existentes nos pilotos estáticos v03.

Para cada clipe, registre nome, duração, loop, root motion ou in-place e função. Verifique:

- Ordem de apoio dos pés, altura e trajetória de balanço, transferência de peso e comprimento de passada.
- Pelve e tronco compensando apoio; cabeça e cauda reagindo com inércia apropriada à massa.
- Ausência de saltos no loop, interpenetrações relevantes, lacunas nas juntas e pés flutuantes.
- Corrida/ataque envolvendo o corpo, antecipação e recuperação, sem movimentos copiados mecanicamente.
- Playback real de todos os clipes em cada variante e LOD prometido. Não considerar um nome no manifesto prova de animação válida.

Declare limitações de deslize in-place, contato em plano e ausência de skinning quando existirem. Não anunciar root motion, deformação contínua, navegação ou física sem demonstração.

## Validação e entrega da criatura

O pacote deve reunir ou referenciar GLB versionado em `assets/models/creatures/<id>/`, variantes aplicáveis, fontes editáveis/geradores, manifesto, README e evidências da etapa. Acrescente rig/clipes e viewer animado nas etapas que os incluem. Reutilize oficinas já existentes mesmo quando a fonte estiver num diretório compartilhado ou `<id>-vNN/source/`; não mova tudo só para impor uma nova organização. ZIP pode facilitar a entrega, mantendo os arquivos reais no GitHub.

O manifesto precisa registrar caminhos reais, versão-base, SHA-256 e bytes de cada GLB, triângulos com método, materiais, nós/juntas/skins com método, clipes/durações, LODs, escala/eixos e estados independentes de aprovação/publicação/integração. Respeite esquemas existentes; não faça uma migração geral de manifests por conveniência.

**Capturas obrigatórias do GLB recém-exportado e reimportado em cada etapa 3D:** perfil, frente e três-quartos. Quando houver rig/clipes entregues, inclua pose relevante e prévia animada/viewer. Vincule o hash do arquivo renderizado ao relatório. Previews construídos diretamente do gerador são úteis, mas não substituem essa prova de exportação. Conceitos feitos por IA devem permanecer identificados como conceito.

Compare com o conceito: silhueta, proporção de cabeça/tronco/membros, planos, características distintivas, paleta e poses. Mostre diferenças restantes. Teste técnico, publicação e arte têm estados separados. Só pedir aprovação depois de fornecer a versão concreta e capturas reais; não marcar definitivo sem registro do usuário.
