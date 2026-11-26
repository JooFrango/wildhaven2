# Criaturas de Wildhaven

Cada espécie tem ecologia, aparência, habitat, relações alimentares, ações e um conjunto de estados. Cada indivíduo instanciado no jogo recebe ID próprio e histórico persistente (quando necessário).

## Espécies conceituais

| ID | Nome | Papel | Habitat proposto | Status |
| --- | --- | --- | --- | --- |
| folhisco | Folhisco | herbívoro de pequeno porte | floresta temperada | visual aprovado |
| silvarano | Silvarano | herbívoro reptiliano de médio porte | florestas temperada e tropical | proposta detalhada |
| torvalho | Torvalho | herbívoro bovino de grande porte | campos e bordas de florestas temperadas | proposta |
| boscaranha | Boscaranha | predador aracnídeo de porte médio (caça Folhiscos) | floresta temperada | protótipo 3D em revisão |
| nharuk | Nharuk | predador felinoide original; ecótipo tropical menor e temperado/planícies maior | floresta tropical, floresta temperada e planície | proposta detalhada |
| cavoru | Cavoru | herbívoro de porte médio, pastador e escavador superficial de raízes | floresta temperada e planícies | modelos GLB animados v0.1 em revisão |
| tufrilo | Tufrilo | herbívoro pequeno saltador e dispersor de sementes | bosque temperado e clareiras | GLBs animados v0.1 em revisão |
| carniroca | Carniroca | necrófago alado | floresta temperada e planícies | GLBs animados v0.1 em revisão |
| musgarrao | Musgarrão | anfíbio territorial | rios, lagos | proposta |
| dunacornio | Dunacórnio | herbívoro migratório | deserto | proposta |
| escarapina | Escarapina | planador | montanhas | proposta |
| brumassauro | Brumassauro | grande predador raro | florestas antigas | proposta |

As fichas estruturadas iniciais estão em `species/*.json`; propostas não são assets aprovados. Os nomes não devem ser tomados como definitivos.

## Indivíduos

Dados sugeridos: `id`, `speciesId`, idade, sexo (quando aplicável), posição global, região, saúde, energia, fome, sede, medo, grupo, território, memória de ameaças, gestação/filhotes (quando aplicável) e eventos. Definir quais devem persistir para evitar salvar milhões de entidades desnecessariamente.

## Princípio

A criatura não é removida só porque saiu da tela. Perto do jogador usa IA e animação detalhadas; longe pode ser simulada em passos agregados, preservando o resultado ecológico.

## Modelo de percepção

Os campos opcionais `body`, `perception`, `locomotion` e `threatResponse` de `species/schema.json` descrevem diferenças de visão, audição, olfato, movimento e reação a ameaças. As primeiras fichas completas são [Folhisco](./species/folhisco.md) e [Silvarano](./species/silvarano.md); confira o [documento de sensores](../gameplay/SENTIDOS-E-IA-DE-CRIATURAS.md).
