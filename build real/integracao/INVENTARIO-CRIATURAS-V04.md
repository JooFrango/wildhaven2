# Inventário de criaturas — Build Real V04

Gerado por `game/build-real-v04/tools/inventario-md.mjs` em 2026-11-27. Fontes: `assets/models/creatures/` (GLBs lidos um a um), `creatures/species/` (fichas), `labs/ia-criaturas/config/eco/especies/` (configs do laboratório) e `game/build-real-v04/data/gameplay-provisorio-v04.json` (dados de jogo gerados, **todos provisórios**).

## Totais

| Encontradas (pastas de espécie) | Com GLB animado | Integradas na V04 | Pendentes |
| ---: | ---: | ---: | ---: |
| 56 | 47 | 34 | 22 |

Pastas de pacote/variante (otimizações, pilotos, pacotes de savana/neve): 36. Nenhuma delas virou espécie nova sem ficha: os pacotes de neve só têm fonte (scripts e tarballs), sem GLB publicado.

## Integradas por classe de bioma

### Floresta temperada (`floresta_temperada`) — 14 espécie(s)

| Espécie | Papel | Massa (kg) | Locomoção | Clipes | LODs | Retrato | Fonte dos dados | Aprovação |
| --- | --- | ---: | --- | ---: | ---: | --- | --- | --- |
| Folhisco | presa | 2.5 | terrestre | 15 | 3 | sim | creatures/species/folhisco.json | visual aprovado em 2026-11-06 |
| Lobrapedra | predador | 55 | terrestre | 16 | 3 | sim | creatures/species/lobrapedra.json (sem percepção/locomoção na ficha) | modeled_candidate (sem aprovação artística) |
| Silvarano | presa | 140 | terrestre | 28 | 3 | sim | creatures/species/silvarano.json (percepção, locomoção e massa da ficha) | proposal |
| Cavoru | presa | 83 | terrestre | 27 | 3 | sim | creatures/species/cavoru.json (percepção, locomoção e massa da ficha) | in_review |
| Torvalho | presa | 650 | terrestre | 27 | 3 | sim | creatures/species/torvalho.json (percepção, locomoção e massa da ficha) | proposal |
| Tufrilo | presa | 4 | terrestre | 25 | 3 | sim | creatures/species/tufrilo.json (percepção, locomoção e massa da ficha) | in_review |
| Nharuk | predador | 80 | terrestre | 27 | 3 | sim | creatures/species/nharuk.json (percepção, locomoção e massa da ficha) | in_review |
| Boscaranha | predador | 19 | terrestre | 22 | 3 | sim | creatures/species/boscaranha.json (percepção, locomoção e massa da ficha) | in_review |
| Carniroca | predador | 6 | voador | 25 | 3 | sim | creatures/species/carniroca.json + labs/ia-criaturas/config/eco/especies/carniroca.json | in_review |
| Cervalume | presa | 20 | terrestre | 14 | 3 | sim | creatures/species/cervalume.json | proposal |
| Ferrunco | presa | 220 | terrestre | 16 | 3 | sim | creatures/species/ferrunco.json + labs/ia-criaturas/config/eco/especies/ferrunco.json | in_review |
| Frutavil | presa | 3 | terrestre | 11 | 3 | sim | creatures/species/frutavil.json + labs/ia-criaturas/config/eco/especies/frutavil.json | in_review |
| Pica-Termita de Crista | presa | 2 | voador | 18 | 3 | sim | creatures/species/pica-termita.json + labs/ia-criaturas/config/eco/especies/pica-termita.json | in_review |
| Rocantraz | predador | 4000 | terrestre | 12 | 3 | sim | creatures/species/rocantraz.json + labs/ia-criaturas/config/eco/especies/rocantraz.json | biped_anatomy_biomechanics_v04_asset |

### Montanhas florestadas (`montanha_florestada`) — 11 espécie(s)

| Espécie | Papel | Massa (kg) | Locomoção | Clipes | LODs | Retrato | Fonte dos dados | Aprovação |
| --- | --- | ---: | --- | ---: | ---: | --- | --- | --- |
| Folhisco | presa | 2.5 | terrestre | 15 | 3 | sim | creatures/species/folhisco.json | visual aprovado em 2026-11-06 |
| Lobrapedra | predador | 55 | terrestre | 16 | 3 | sim | creatures/species/lobrapedra.json (sem percepção/locomoção na ficha) | modeled_candidate (sem aprovação artística) |
| Silvarano | presa | 140 | terrestre | 28 | 3 | sim | creatures/species/silvarano.json (percepção, locomoção e massa da ficha) | proposal |
| Cavoru | presa | 83 | terrestre | 27 | 3 | sim | creatures/species/cavoru.json (percepção, locomoção e massa da ficha) | in_review |
| Tufrilo | presa | 4 | terrestre | 25 | 3 | sim | creatures/species/tufrilo.json (percepção, locomoção e massa da ficha) | in_review |
| Nharuk | predador | 80 | terrestre | 27 | 3 | sim | creatures/species/nharuk.json (percepção, locomoção e massa da ficha) | in_review |
| Boscaranha | predador | 19 | terrestre | 22 | 3 | sim | creatures/species/boscaranha.json (percepção, locomoção e massa da ficha) | in_review |
| Carniroca | predador | 6 | voador | 25 | 3 | sim | creatures/species/carniroca.json + labs/ia-criaturas/config/eco/especies/carniroca.json | in_review |
| Cervalume | presa | 20 | terrestre | 14 | 3 | sim | creatures/species/cervalume.json | proposal |
| Ferrunco | presa | 220 | terrestre | 16 | 3 | sim | creatures/species/ferrunco.json + labs/ia-criaturas/config/eco/especies/ferrunco.json | in_review |
| Rocantraz | predador | 4000 | terrestre | 12 | 3 | sim | creatures/species/rocantraz.json + labs/ia-criaturas/config/eco/especies/rocantraz.json | biped_anatomy_biomechanics_v04_asset |

### Montanhas rochosas e cordilheiras (`montanha_rochosa`) — 1 espécie(s)

| Espécie | Papel | Massa (kg) | Locomoção | Clipes | LODs | Retrato | Fonte dos dados | Aprovação |
| --- | --- | ---: | --- | ---: | ---: | --- | --- | --- |
| Lobrapedra | predador | 55 | terrestre | 16 | 3 | sim | creatures/species/lobrapedra.json (sem percepção/locomoção na ficha) | modeled_candidate (sem aprovação artística) |

### Regiões nevadas e glaciais (`glacial`) — 0 espécie(s)

Nenhuma espécie integrável: não há GLB animado com ficha para este bioma (ver pendências).

### Planícies temperadas (`planicie`) — 7 espécie(s)

| Espécie | Papel | Massa (kg) | Locomoção | Clipes | LODs | Retrato | Fonte dos dados | Aprovação |
| --- | --- | ---: | --- | ---: | ---: | --- | --- | --- |
| Cavoru | presa | 83 | terrestre | 27 | 3 | sim | creatures/species/cavoru.json (percepção, locomoção e massa da ficha) | in_review |
| Torvalho | presa | 650 | terrestre | 27 | 3 | sim | creatures/species/torvalho.json (percepção, locomoção e massa da ficha) | proposal |
| Tufrilo | presa | 4 | terrestre | 25 | 3 | sim | creatures/species/tufrilo.json (percepção, locomoção e massa da ficha) | in_review |
| Nharuk | predador | 80 | terrestre | 27 | 3 | sim | creatures/species/nharuk.json (percepção, locomoção e massa da ficha) | in_review |
| Carniroca | predador | 6 | voador | 25 | 3 | sim | creatures/species/carniroca.json + labs/ia-criaturas/config/eco/especies/carniroca.json | in_review |
| Cervalume | presa | 20 | terrestre | 14 | 3 | sim | creatures/species/cervalume.json | proposal |
| Pica-Termita de Crista | presa | 2 | voador | 18 | 3 | sim | creatures/species/pica-termita.json + labs/ia-criaturas/config/eco/especies/pica-termita.json | in_review |

### Savana (`savana`) — 16 espécie(s)

| Espécie | Papel | Massa (kg) | Locomoção | Clipes | LODs | Retrato | Fonte dos dados | Aprovação |
| --- | --- | ---: | --- | ---: | ---: | --- | --- | --- |
| Arbélio | presa | 5 | terrestre | 11 | 3 | sim | creatures/species/arbelio.json | in_review |
| Arumbar | presa | 3500 | terrestre | 8 | 3 | sim | creatures/species/arumbar.json | asset_v03_organic_anatomy_in_review |
| Cromátil | presa | 4 | terrestre | 11 | 3 | sim | creatures/species/cromatil.json + labs/ia-criaturas/config/eco/especies/cromatil.json | in_review |
| Frutavil | presa | 3 | terrestre | 11 | 3 | sim | creatures/species/frutavil.json + labs/ia-criaturas/config/eco/especies/frutavil.json | in_review |
| Garruva | predador | 350 | terrestre | 13 | 3 | — | creatures/species/garruva.json | sem status |
| Mastélio | presa | 975 | terrestre | 12 | 3 | sim | creatures/species/mastelio.json | sem status |
| Pica-Termita de Crista | presa | 2 | voador | 18 | 3 | sim | creatures/species/pica-termita.json + labs/ia-criaturas/config/eco/especies/pica-termita.json | in_review |
| Raizauro | presa | 825 | terrestre | 12 | 3 | sim | creatures/species/raizauro.json | sem status |
| Rambrél | presa | 250 | terrestre | 11 | 3 | sim | creatures/species/rambrel.json | animated_3d_asset_in_review |
| Sevilho | presa | 3 | terrestre | 11 | 3 | sim | creatures/species/sevilho.json | in_review |
| Talvero | presa | 210 | terrestre | 10 | 3 | sim | creatures/species/talvero.json | animated_3d_asset_in_review |
| Tarruco | presa | 12 | terrestre | 10 | 3 | sim | creatures/species/tarruco.json + labs/ia-criaturas/config/eco/especies/tarruco.json | redesigned_animated_3d_asset_in_review |
| Torvardo | presa | 1400 | terrestre | 12 | 3 | sim | creatures/species/torvardo.json | sem status |
| Turvagal | presa | 320 | terrestre | 11 | 3 | sim | creatures/species/turvagal.json | animated_3d_asset_in_review |
| Varrisco | predador | 70 | terrestre | 55 | 1 | sim | creatures/species/varrisco.json + labs/ia-criaturas/config/eco/especies/varrisco.json | asset_in_review_not_integrated |
| Velsari | presa | 22 | terrestre | 10 | 3 | sim | creatures/species/velsari.json + labs/ia-criaturas/config/eco/especies/velsari.json | animated_3d_asset_in_review |

### Selva tropical (`selva`) — 4 espécie(s)

| Espécie | Papel | Massa (kg) | Locomoção | Clipes | LODs | Retrato | Fonte dos dados | Aprovação |
| --- | --- | ---: | --- | ---: | ---: | --- | --- | --- |
| Silvarano | presa | 140 | terrestre | 28 | 3 | sim | creatures/species/silvarano.json (percepção, locomoção e massa da ficha) | proposal |
| Nharuk | predador | 80 | terrestre | 27 | 3 | sim | creatures/species/nharuk.json (percepção, locomoção e massa da ficha) | in_review |
| Ferrunco | presa | 220 | terrestre | 16 | 3 | sim | creatures/species/ferrunco.json + labs/ia-criaturas/config/eco/especies/ferrunco.json | in_review |
| Rocantraz | predador | 4000 | terrestre | 12 | 3 | sim | creatures/species/rocantraz.json + labs/ia-criaturas/config/eco/especies/rocantraz.json | biped_anatomy_biomechanics_v04_asset |

### Pântano tropical (`pantano`) — 3 espécie(s)

| Espécie | Papel | Massa (kg) | Locomoção | Clipes | LODs | Retrato | Fonte dos dados | Aprovação |
| --- | --- | ---: | --- | ---: | ---: | --- | --- | --- |
| Ferrunco | presa | 220 | terrestre | 16 | 3 | sim | creatures/species/ferrunco.json + labs/ia-criaturas/config/eco/especies/ferrunco.json | in_review |
| Rocantraz | predador | 4000 | terrestre | 12 | 3 | sim | creatures/species/rocantraz.json + labs/ia-criaturas/config/eco/especies/rocantraz.json | biped_anatomy_biomechanics_v04_asset |
| Turvagal | presa | 320 | terrestre | 11 | 3 | sim | creatures/species/turvagal.json | animated_3d_asset_in_review |

### Desertos e megadunas (`deserto_dunas`) — 8 espécie(s)

| Espécie | Papel | Massa (kg) | Locomoção | Clipes | LODs | Retrato | Fonte dos dados | Aprovação |
| --- | --- | ---: | --- | ---: | ---: | --- | --- | --- |
| Arenoceto | presa | 20000 | subterraneo_areia | 20 | 1 | sim | labs/ia-criaturas/config/eco/especies/arenoceto.json | provisorio |
| Arraia-de-Areia | presa | 440 | subterraneo_areia | 22 | 1 | sim | labs/ia-criaturas/config/eco/especies/arraia-de-areia.json | provisorio |
| Dunlíngua | presa | 100 | terrestre | 16 | 3 | sim | creatures/species/dunlingua.json | in_review |
| Escarvão | predador | 90 | subterraneo_areia | 18 | 1 | sim | labs/ia-criaturas/config/eco/especies/escarvao.json | provisorio |
| Rocantraz | predador | 4000 | terrestre | 12 | 3 | sim | creatures/species/rocantraz.json + labs/ia-criaturas/config/eco/especies/rocantraz.json | biped_anatomy_biomechanics_v04_asset |
| Serpáduna | predador | 900 | terrestre | 13 | 1 | sim | labs/ia-criaturas/config/eco/especies/serpaduna.json | experimental_v7 |
| Serracórion | predador | 1200 | subterraneo_areia | 20 | 1 | sim | labs/ia-criaturas/config/eco/especies/serracorion.json | provisorio |
| Varrisco | predador | 70 | terrestre | 55 | 1 | sim | creatures/species/varrisco.json + labs/ia-criaturas/config/eco/especies/varrisco.json | asset_in_review_not_integrated |

### Desertos rochosos, cânions e arcos (`deserto_rochoso`) — 8 espécie(s)

| Espécie | Papel | Massa (kg) | Locomoção | Clipes | LODs | Retrato | Fonte dos dados | Aprovação |
| --- | --- | ---: | --- | ---: | ---: | --- | --- | --- |
| Arenoceto | presa | 20000 | subterraneo_areia | 20 | 1 | sim | labs/ia-criaturas/config/eco/especies/arenoceto.json | provisorio |
| Arraia-de-Areia | presa | 440 | subterraneo_areia | 22 | 1 | sim | labs/ia-criaturas/config/eco/especies/arraia-de-areia.json | provisorio |
| Dunlíngua | presa | 100 | terrestre | 16 | 3 | sim | creatures/species/dunlingua.json | in_review |
| Escarvão | predador | 90 | subterraneo_areia | 18 | 1 | sim | labs/ia-criaturas/config/eco/especies/escarvao.json | provisorio |
| Rocantraz | predador | 4000 | terrestre | 12 | 3 | sim | creatures/species/rocantraz.json + labs/ia-criaturas/config/eco/especies/rocantraz.json | biped_anatomy_biomechanics_v04_asset |
| Serpáduna | predador | 900 | terrestre | 13 | 1 | sim | labs/ia-criaturas/config/eco/especies/serpaduna.json | experimental_v7 |
| Serracórion | predador | 1200 | subterraneo_areia | 20 | 1 | sim | labs/ia-criaturas/config/eco/especies/serracorion.json | provisorio |
| Varrisco | predador | 70 | terrestre | 55 | 1 | sim | creatures/species/varrisco.json + labs/ia-criaturas/config/eco/especies/varrisco.json | asset_in_review_not_integrated |

### Costas arenosas e de dunas (`costa_arenosa`) — 0 espécie(s)

Nenhuma espécie integrável: não há GLB animado com ficha para este bioma (ver pendências).

### Costas rochosas e falésias (`costa_rochosa`) — 0 espécie(s)

Nenhuma espécie integrável: não há GLB animado com ficha para este bioma (ver pendências).

### Costas glaciais e plataformas de gelo (`costa_glacial`) — 0 espécie(s)

Nenhuma espécie integrável: não há GLB animado com ficha para este bioma (ver pendências).

## Pendentes (com motivo)

| Espécie | Motivo |
| --- | --- |
| branquelope | sem GLB animado publicado (estático ou só fonte) |
| brejaveo | GLB animado sem ficha nem config do laboratório (só README): faltam percepção, dieta e habitat |
| brotarro | GLB animado sem ficha nem config do laboratório (só README): faltam percepção, dieta e habitat |
| casquim | sem GLB animado publicado (estático ou só fonte) |
| caudraco | GLB animado sem ficha nem config do laboratório (só README): faltam percepção, dieta e habitat |
| cipria | GLB animado sem ficha nem config do laboratório (só README): faltam percepção, dieta e habitat |
| clavascarnio | sem GLB animado publicado (estático ou só fonte) |
| cornevio | GLB animado sem ficha nem config do laboratório (só README): faltam percepção, dieta e habitat |
| dodarro | sem GLB animado publicado (estático ou só fonte) |
| fossario | GLB animado sem ficha nem config do laboratório (só README): faltam percepção, dieta e habitat |
| fulgaronte | GLB animado sem ficha nem config do laboratório (só README): faltam percepção, dieta e habitat |
| gelfaro | sem GLB animado publicado (estático ou só fonte) |
| gravarto | GLB animado sem ficha nem config do laboratório (só README): faltam percepção, dieta e habitat |
| lagarto-papagaio | GLB animado sem ficha nem config do laboratório (só README): faltam percepção, dieta e habitat |
| lajurim | GLB animado sem ficha nem config do laboratório (só README): faltam percepção, dieta e habitat |
| nevisco | sem GLB animado publicado (estático ou só fonte) |
| quedravo | sem GLB animado publicado (estático ou só fonte) |
| sirocauro | GLB animado sem ficha nem config do laboratório (só README): faltam percepção, dieta e habitat |
| tufrino | sem GLB animado publicado (estático ou só fonte) |
| tumbira | GLB animado sem ficha nem config do laboratório (só README): faltam percepção, dieta e habitat |
| velufim | GLB animado sem ficha nem config do laboratório (só README): faltam percepção, dieta e habitat |
| wyvern-montanha | sem GLB animado publicado (estático ou só fonte) |

## Regras usadas

- **Integrada** = GLB **animado** publicado + ficha (`creatures/species`) ou config do laboratório. Nada de modelo genérico no lugar de criatura complexa.
- **Locomoção**: contrato do laboratório (`src/eco/capacidades.js`): `subsolo` no config → subterrânea na areia; `voo` → voadora; senão inferida dos clipes.
- **Biomas**: habitats da ficha → classes de `data/biomas-v04.json` → rótulos do manifesto. Espécies só do laboratório: palavras-chave do README/fonte (registradas em `habitats`).
- **Números** (hp, dano, densidade, itens): fórmulas provisórias da V02; parâmetros fora do código, em `gameplay-provisorio-v04.json`.
- **Testadas**: ver `AUDITORIA-CONTINENTE-V04.md` e `bench/continente-*.json` (censo por bioma nas viagens longas).
