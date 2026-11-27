# Pendências da Build Real V04 (com evidência)

Cada item diz o que falta, por quê e o que já existe. Nada aqui foi marcado como pronto sem evidência no repositório.

## Dependem de decisão do diretor

| # | Pendência | Situação atual |
| --- | --- | --- |
| D1 | Física da vegetação costeira (43 hexes) | Raio do tronco **medido** na malha e escalado pelo fator da correção visual aprovada (`data/regras-vegetacao-costeira-v04.json`). Árvores não cortáveis. Proposta técnica: aprovar ou ajustar. |
| D2 | Vegetação dos demais biomas | O pipeline usa as alturas-alvo por família de `vegetacao-provisoria-v02.json` (Emergente 32 m, Dossel 24 m, Palmeira 12 m, Folhosa 16 m…). A floresta da V02 é a referência aprovada. Os outros biomas precisam da comparação visual do diretor (capturas em `evidencias/v04/`). |
| D3 | Densidades, hp, dano e itens das 26 espécies novas | São fórmulas provisórias da V02 (`gameplay-provisorio-v04.json`, campo `provisorio`). Faltam números aprovados. |
| D4 | Regras de transporte (barco de dunas, dirigível, montarias, wyvern) | Não há regras aprovadas de aquisição, preço e velocidade. Ver T1–T4. |
| D5 | Aprovação artística das espécies | O status de cada uma está em `INVENTARIO-CRIATURAS-V04.md`. A maioria está `in_review` ou `proposal`. |

## Assets ausentes ou insuficientes (não inventados)

| # | Item | Evidência |
| --- | --- | --- |
| A1 | Fauna de neve (Nevisco, Gelfaro, Tufrino, Quedravo, Casquim, Branquelope) | GLB estático, sem clipes. Os pacotes `snow-fauna-v01/v02` têm só a fonte (scripts e tarballs), sem GLB publicado. Os biomas glaciais e as costas glaciais ficam **sem fauna** (36 hexes). |
| A2 | Fauna costeira | Nenhuma espécie com ficha cobre `beach`/`cliffs`. As 40 costas arenosas e rochosas ficam sem fauna própria. |
| A3 | 13 espécies animadas sem ficha nem config do laboratório (Brejaveo, Gravarto, Lagarto-papagaio, Sirocauro, Fulgaronte, Caudraco, Cornevio, Fossário, Lajurim, Brotarro, Cípria, Tumbira, Velufim) | Só README. Faltam percepção, dieta e habitat aprovados. |
| A4 | Wyvern da montanha | Só blockout sem clipes (`wyvern-montanha/*_blockout.glb`). |
| A5 | Dodarro | GLB sem rig (já registrado na V02). |
| A6 | Sprites pixel art por espécie | O Modo Econômico usa classes (pequena presa, predador, herbívoro grande, voador, ondulação de areia). Faltam sprites próprios por espécie. |
| A7 | Cavernas | Nenhuma geometria interna nos GLBs. Não foram criadas. |
| A8 | Laboratório climático V08 | Não existe no repositório (verificado). Segue o porte do V7 (V02), com as diferenças por bioma (savana mais seca que a planície). |

## Transportes

| # | Transporte | Situação |
| --- | --- | --- |
| T1 | Carroças de Chad e Nailon (Dodarro) | Preservadas (6 Hunters, acampamento, resgate). |
| T2 | Barco de dunas | Existe só como sprite da tela de carregamento. Sem GLB nem regras. |
| T3 | Dirigível e montarias terrestres | Nenhum asset encontrado. |
| T4 | Travessia marítima (6 hexes de exceção marítima, 28 arestas marítimas) | Exige transporte marítimo inexistente. **Sem travessia a pé** (regra respeitada). |

## Técnicas

| # | Pendência | Situação |
| --- | --- | --- |
| P1 | FPS em GPU real | Não medido (contêiner com SwiftShader). Use o F3 → "Exportar relatório" no computador do diretor. |
| P2 | Locomoção aquática | Nenhuma espécie integrada é aquática. O contrato e o meio estão prontos para quando houver. |
| P3 | Testes de 8 h e 24 h | Dependem de a sessão não ser reiniciada. Ver `BENCHMARK-V03-V04.md`. |
