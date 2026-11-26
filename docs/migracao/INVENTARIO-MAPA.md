# Inventario do mapa continental de Auralis

Gerado em 2026-11-26T08:28:31.121Z por `tools/gerar-inventarios-br.mjs`.

Fonte: `build real/continental/data/continent-272.manifest.json` e os GLBs em `assets/world/continental-272/`.

Campos marcados como "nao localizado" nao foram encontrados nos repositorios
de origem. Nenhum valor foi estimado.

## Resumo

- gerado em: **2026-11-26T08:27:34.511Z**
- manifesto: **{"schema":"wildhaven.continent.manifest.v1","geradoEm":"2026-11-23","escopo":"source-inventory-and-runtime-contract-not-physical-integration"}**
- hexagonos no manifesto: **272**
- hexagonos com glb no repo: **272**
- hexagonos sem glb: **0**
- hexagonos com falha: **0**
- terrenos duplicados: **0**
- arestas: **738**
- arestas invalidas: **0**
- grau min: **3**
- grau max: **6**
- nos isolados: **0**
- componentes conexos: **1**
- maior componente: **272**
- tiles terrestres manifesto: **266**
- tiles maritimos manifesto: **6**
- tiles fisicos certificados: **0**
- biomas distintos: **33**
- geometria: **{"hexPointToPointMeters":5000,"stepMeters":4330.127,"ladoMetros":2500}**
- area por hexagono km2: **16.238**
- area total km2: **4416.7**
- area terrestre km2: **4319.3**
- caixa media xz metros: **[4330.1,5000]**
- altura minima metros: **12.59**
- altura maxima metros: **5029.01**
- triangulos totais: **45273372**
- continuidade 3cm: **NAO VERIFICADA — ver comentario no topo deste script**

## Sistemas do mapa recuperados

- compilador de terrenos: presente (`build real/continental/compiler/`, 6 arquivo(s))
- grafo continental: presente (`build real/continental/src/graph.mjs`, 1 arquivo(s))
- regioes moveis: presente (`build real/continental/src/regions.mjs`, 1 arquivo(s))
- streaming de terreno: presente (`build real/continental/src/streamer.mjs`, 1 arquivo(s))
- carregador de fisica: presente (`build real/continental/src/physics-loader.mjs`, 1 arquivo(s))
- fisica do compilador: presente (`build real/continental/compiler/physics.mjs`, 1 arquivo(s))
- vegetacao: presente (`build real/continental/compiler/vegetation.mjs`, 1 arquivo(s))
- validador: presente (`build real/continental/tools/validate.mjs`, 1 arquivo(s))
- testes: presente (`build real/continental/test/`, 2 arquivo(s))
- grafo original de Auralis: presente (`build real/continental/data/auralis-grafo-original.json`, 1 arquivo(s))
- worldgen (heightmap, biomas, rios, regioes): presente (`world/auralis/`, 148 arquivo(s))
- heightmap: presente (`world/auralis/outputs/heightmap.png`, 1 arquivo(s))
- mapa de biomas: presente (`world/auralis/outputs/biomes.png`, 1 arquivo(s))
- rios: presente (`world/auralis/outputs/rivers.json`, 1 arquivo(s))
- regioes: presente (`world/auralis/outputs/regions.json`, 1 arquivo(s))
- locais especiais (cavernas e afins): presente (`world/auralis/outputs/special-locations.json`, 1 arquivo(s))
- precipitacao: presente (`world/auralis/outputs/precipitation.png`, 1 arquivo(s))
- temperatura: presente (`world/auralis/outputs/temperature.png`, 1 arquivo(s))
- vila dos Hunters: presente (`world/hunters-village-v01/`, 87 arquivo(s))
- prototipos de litoral: presente (`world/coast-v01/`, 177 arquivo(s))
- estudio de hexagonos (Godot): presente (`tools/godot-hex-studio/`, 12 arquivo(s))

## Hexagonos

| id | bioma | GLB | bytes | triangulos | sha confere | revisao | fisica |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C | Arco e Ossada Central | sim | 3964440 | 182243 | sim | pending-review | not-built |
| NW | Mesas e Vale Seco | sim | 1484376 | 71852 | sim | pending-review | not-built |
| NE | Torres de Arenito | sim | 1531996 | 73650 | sim | pending-review | not-built |
| E | Dunas e Ossada | sim | 1475920 | 71456 | sim | pending-review | not-built |
| SE | Oásis das Dunas | sim | 1452288 | 69866 | sim | pending-review | not-built |
| SW | Cânion Secreto | sim | 1576620 | 75734 | sim | pending-review | not-built |
| W | Arco Desértico | sim | 1530792 | 73482 | sim | pending-review | not-built |
| X3 | Arco e Cânion da Transição | sim | 3813460 | 179251 | sim | pending-review | not-built |
| X6 | Maciço e Vales do Leste | sim | 7214172 | 339034 | sim | pending-review | not-built |
| X7 | Oásis dos Contrafortes | sim | 3794492 | 177886 | sim | pending-review | not-built |
| F_N | temperate forest | sim | 8952812 | 307492 | sim | pending-review | not-built |
| F_E | temperate forest | sim | 11994792 | 407596 | sim | pending-review | not-built |
| F_S | temperate forest | sim | 12495560 | 424344 | sim | pending-review | not-built |
| F_E2 | temperate forest | sim | 10379184 | 355168 | sim | pending-review | not-built |
| F_NE | temperate forest | sim | 9656024 | 331526 | sim | pending-review | not-built |
| F_SE | temperate forest | sim | 11788052 | 439048 | sim | pending-review | not-built |
| F_S2 | temperate forest to grassland | sim | 11918968 | 441844 | sim | pending-review | not-built |
| F_E3 | temperate forest to grassland | sim | 8695384 | 299252 | sim | pending-review | not-built |
| F_P_E | temperate forest -> open plains | sim | 8756456 | 367184 | sim | pending-review | not-built |
| F_P_R | temperate forest -> open plains | sim | 6439624 | 259776 | sim | pending-review | not-built |
| PL_NW | entirely temperate plains (no transition) | sim | 5294904 | 179980 | sim | pending-review | not-built |
| PL_NE | entirely temperate plains (no transition) | sim | 5348972 | 182256 | sim | pending-review | not-built |
| PL_SW | entirely temperate plains (no transition) | sim | 5299580 | 179982 | sim | pending-review | not-built |
| PL_S | entirely temperate plains (no transition) | sim | 5316232 | 180540 | sim | pending-review | not-built |
| PL_SE | entirely temperate plains (no transition) | sim | 5301144 | 180796 | sim | pending-review | not-built |
| PL_E_W | entirely temperate plains (no transition) | sim | 5350944 | 182488 | sim | pending-review | not-built |
| PL_E_N | entirely temperate plains (no transition) | sim | 5329036 | 181782 | sim | pending-review | not-built |
| PL_E_E | entirely temperate plains (no transition) | sim | 5354164 | 182290 | sim | pending-review | not-built |
| PL_E_S | entirely temperate plains (no transition) | sim | 5294100 | 179702 | sim | pending-review | not-built |
| PL_E_SE | entirely temperate plains (no transition) | sim | 5280780 | 179476 | sim | pending-review | not-built |
| SV_W | temperate prairie north of river + golden fantasy savanna south | sim | 6018372 | 187998 | sim | pending-review | not-built |
| SV_CW | temperate prairie north of river + golden fantasy savanna south | sim | 5878080 | 186546 | sim | pending-review | not-built |
| SV_C | temperate prairie north of river + golden fantasy savanna south | sim | 6386056 | 196732 | sim | pending-review | not-built |
| SV_CE | temperate prairie north of river + golden fantasy savanna south | sim | 5714980 | 182381 | sim | pending-review | not-built |
| SV_E | temperate prairie north of river + golden fantasy savanna south | sim | 6151436 | 207081 | sim | pending-review | not-built |
| SV2_W | temperate golden fantasy savanna | sim | 6590056 | 183064 | sim | pending-review | not-built |
| SV2_CW | temperate golden fantasy savanna | sim | 4937368 | 168590 | sim | pending-review | not-built |
| SV2_C | temperate golden fantasy savanna | sim | 6085084 | 188236 | sim | pending-review | not-built |
| SV2_CE | temperate golden fantasy savanna | sim | 5074152 | 169726 | sim | pending-review | not-built |
| SV2_E | temperate golden fantasy savanna | sim | 5523492 | 183110 | sim | pending-review | not-built |
| SV3_W | temperate golden fantasy savanna | sim | 6000628 | 181232 | sim | pending-review | not-built |
| SV3_CW | temperate golden fantasy savanna | sim | 5298176 | 176280 | sim | pending-review | not-built |
| SV3_CE | temperate golden fantasy savanna | sim | 5933436 | 185296 | sim | pending-review | not-built |
| SV3_E | temperate golden fantasy savanna | sim | 5461696 | 189338 | sim | pending-review | not-built |
| SV4_CW | temperate golden fantasy savanna | sim | 5640564 | 188920 | sim | pending-review | not-built |
| SV4_C | temperate golden fantasy savanna | sim | 6045428 | 181375 | sim | pending-review | not-built |
| SV4_CE | temperate golden fantasy savanna | sim | 4851944 | 162354 | sim | pending-review | not-built |
| SV4_W | temperate golden fantasy savanna | sim | 5436944 | 179142 | sim | pending-review | not-built |
| SV4_E | temperate golden fantasy savanna | sim | 5389244 | 180576 | sim | pending-review | not-built |
| TR_CW | humid savanna -> elevated jungle rocky ecotone | sim | 5986788 | 263430 | sim | pending-review | not-built |
| TR_CE | humid savanna -> elevated jungle rocky ecotone | sim | 6170516 | 272388 | sim | pending-review | not-built |
| TR_W | humid savanna -> elevated jungle rocky ecotone | sim | 6254980 | 276287 | sim | pending-review | not-built |
| TR_E | humid savanna -> elevated jungle rocky ecotone | sim | 6069140 | 267697 | sim | pending-review | not-built |
| J_CW | true tropical jungle | sim | 34391200 | 1540923 | sim | pending-review | not-built |
| J_C | true tropical jungle | sim | 36356568 | 1627810 | sim | pending-review | not-built |
| J_CE | true tropical jungle | sim | 34738444 | 1555052 | sim | pending-review | not-built |
| J_W | true tropical jungle | sim | 35177672 | 1574956 | sim | pending-review | not-built |
| J_E | true tropical jungle | sim | 35833380 | 1604499 | sim | pending-review | not-built |
| MW_01 | mountain barrier | sim | 3379416 | 115672 | sim | pending-review | not-built |
| MW_02 | mountain barrier | sim | 2562348 | 66752 | sim | pending-review | not-built |
| MW_03 | mountain barrier | sim | 2873052 | 65399 | sim | pending-review | not-built |
| MW_04 | mountain barrier | sim | 1974384 | 50701 | sim | pending-review | not-built |
| MW_05 | mountain barrier | sim | 3319332 | 68458 | sim | pending-review | not-built |
| MW_06 | mountain barrier | sim | 4149376 | 79894 | sim | pending-review | not-built |
| MW_07 | mountain barrier | sim | 1828908 | 48885 | sim | pending-review | not-built |
| MW_08 | mountain barrier | sim | 5244996 | 160074 | sim | pending-review | not-built |
| MN2_01 | mountain_second_row | sim | 969056 | 36480 | sim | pending-review | not-built |
| MN2_02 | mountain_second_row | sim | 969052 | 36480 | sim | pending-review | not-built |
| MN2_03 | mountain_second_row | sim | 969056 | 36480 | sim | pending-review | not-built |
| MN2_04 | mountain_second_row | sim | 969056 | 36480 | sim | pending-review | not-built |
| MN2_05 | mountain_second_row | sim | 969052 | 36480 | sim | pending-review | not-built |
| MN2_06 | mountain_second_row | sim | 969052 | 36480 | sim | pending-review | not-built |
| MN2_07 | mountain_second_row | sim | 969056 | 36480 | sim | pending-review | not-built |
| MN2_08 | mountain_second_row | sim | 969052 | 36480 | sim | pending-review | not-built |
| DN_01 | erg_dune_desert | sim | 969052 | 36480 | sim | pending-review | not-built |
| DN_02 | erg_dune_desert | sim | 969048 | 36480 | sim | pending-review | not-built |
| DN_03 | erg_dune_desert | sim | 969064 | 36480 | sim | pending-review | not-built |
| DN_04 | erg_dune_desert | sim | 969064 | 36480 | sim | pending-review | not-built |
| DN_05 | erg_dune_desert | sim | 969064 | 36480 | sim | pending-review | not-built |
| DN_06 | erg_dune_desert | sim | 969052 | 36480 | sim | pending-review | not-built |
| DN_07 | erg_dune_desert | sim | 969048 | 36480 | sim | pending-review | not-built |
| DN_08 | erg_dune_desert | sim | 969052 | 36480 | sim | pending-review | not-built |
| DN_09 | erg_dune_desert | sim | 969048 | 36480 | sim | pending-review | not-built |
| DN_10 | erg_dune_desert | sim | 969052 | 36480 | sim | pending-review | not-built |
| DN_11 | erg_dune_desert | sim | 969064 | 36480 | sim | pending-review | not-built |
| DN_12 | erg_dune_desert | sim | 969064 | 36480 | sim | pending-review | not-built |
| DN_13 | erg_dune_desert | sim | 969064 | 36480 | sim | pending-review | not-built |
| DN_14 | erg_dune_desert | sim | 969048 | 36480 | sim | pending-review | not-built |
| DN_15 | erg_dune_desert | sim | 969048 | 36480 | sim | pending-review | not-built |
| DN_16 | erg_dune_desert | sim | 969052 | 36480 | sim | pending-review | not-built |
| DN_17 | erg_dune_desert | sim | 969048 | 36480 | sim | pending-review | not-built |
| DN_18 | erg_dune_desert | sim | 969052 | 36480 | sim | pending-review | not-built |
| DN_19 | erg_dune_desert | sim | 969064 | 36480 | sim | pending-review | not-built |
| DN_20 | erg_dune_desert | sim | 969060 | 36480 | sim | pending-review | not-built |
| DN_21 | erg_dune_desert | sim | 969064 | 36480 | sim | pending-review | not-built |
| DN_22 | erg_dune_desert | sim | 969044 | 36480 | sim | pending-review | not-built |
| DN_23 | erg_dune_desert | sim | 969048 | 36480 | sim | pending-review | not-built |
| DN_24 | erg_dune_desert | sim | 969048 | 36480 | sim | pending-review | not-built |
| DN_25 | erg_dune_desert | sim | 969044 | 36480 | sim | pending-review | not-built |
| FX_01 | temperate forest | sim | 10707336 | 285206 | sim | pending-review | not-built |
| FX_02 | temperate forest | sim | 8546720 | 268784 | sim | pending-review | not-built |
| FX_03 | temperate forest | sim | 9947732 | 311746 | sim | pending-review | not-built |
| FX_04 | temperate forest | sim | 10412540 | 276150 | sim | pending-review | not-built |
| FX_05 | temperate forest | sim | 8871516 | 277032 | sim | pending-review | not-built |
| FX_06 | temperate forest | sim | 9905136 | 311164 | sim | pending-review | not-built |
| FX_07 | temperate forest | sim | 7783568 | 243812 | sim | pending-review | not-built |
| FX_08 | temperate forest | sim | 9103832 | 284830 | sim | pending-review | not-built |
| FX_09 | temperate forest | sim | 11680400 | 364828 | sim | pending-review | not-built |
| FX_10 | temperate forest | sim | 6296796 | 199102 | sim | pending-review | not-built |
| FX_11 | temperate forest | sim | 9976188 | 312564 | sim | pending-review | not-built |
| FX_12 | temperate forest | sim | 8430976 | 262606 | sim | pending-review | not-built |
| FX_13 | temperate forest | sim | 11931992 | 373048 | sim | pending-review | not-built |
| FX_14 | temperate forest | sim | 7764896 | 243226 | sim | pending-review | not-built |
| FX_15 | temperate forest | sim | 7822728 | 246122 | sim | pending-review | not-built |
| FX_16 | temperate forest | sim | 11938800 | 373858 | sim | pending-review | not-built |
| FX_17 | temperate forest | sim | 7580276 | 238582 | sim | pending-review | not-built |
| FX_18 | temperate forest | sim | 7965884 | 250494 | sim | pending-review | not-built |
| FX_19 | temperate forest | sim | 11924616 | 373728 | sim | pending-review | not-built |
| FX_20 | temperate forest | sim | 7081316 | 222322 | sim | pending-review | not-built |
| FX_21 | temperate forest | sim | 11394812 | 357680 | sim | pending-review | not-built |
| ER_01 | forested mountain | sim | 24433504 | 646802 | sim | pending-review | not-built |
| ER_02 | forested mountain | sim | 15702256 | 468284 | sim | pending-review | not-built |
| ER_03 | forested mountain | sim | 20499192 | 626010 | sim | pending-review | not-built |
| ER_04 | forested mountain | sim | 20051644 | 611712 | sim | pending-review | not-built |
| ER_05 | forested mountain | sim | 15108372 | 449274 | sim | pending-review | not-built |
| ER_06 | forested mountain | sim | 19921172 | 607342 | sim | pending-review | not-built |
| ER_07 | forested mountain | sim | 14892544 | 441274 | sim | pending-review | not-built |
| ER_08 | forested mountain | sim | 9765132 | 271654 | sim | pending-review | not-built |
| ER_09 | forested mountain | sim | 19322180 | 588542 | sim | pending-review | not-built |
| ER_10 | forested mountain | sim | 13614584 | 397564 | sim | pending-review | not-built |
| ER_11 | forested mountain | sim | 21487676 | 659488 | sim | pending-review | not-built |
| ER_12 | forested mountain | sim | 21086688 | 647140 | sim | pending-review | not-built |
| ER_13 | forested mountain | sim | 12405716 | 359330 | sim | pending-review | not-built |
| ER_14 | forested mountain | sim | 19856020 | 605434 | sim | pending-review | not-built |
| ER_15 | forested mountain | sim | 20477124 | 626202 | sim | pending-review | not-built |
| ER_16 | forested mountain | sim | 12195620 | 351106 | sim | pending-review | not-built |
| ER_17 | forested mountain | sim | 21136892 | 648744 | sim | pending-review | not-built |
| ER_18 | forested mountain | sim | 19850680 | 605412 | sim | pending-review | not-built |
| ER_19 | forested mountain | sim | 9769368 | 270778 | sim | pending-review | not-built |
| ER_20 | forested mountain | sim | 20994132 | 643788 | sim | pending-review | not-built |
| ER_21 | forested mountain | sim | 21228640 | 651902 | sim | pending-review | not-built |
| ER_22 | forested mountain | sim | 17788256 | 537138 | sim | pending-review | not-built |
| ER_23 | forested mountain | sim | 10514436 | 296242 | sim | pending-review | not-built |
| ER_24 | forested mountain | sim | 21484696 | 660442 | sim | pending-review | not-built |
| ER_25 | forested mountain | sim | 19812536 | 603570 | sim | pending-review | not-built |
| ER_26 | forested mountain | sim | 14066540 | 414046 | sim | pending-review | not-built |
| ER_27 | forested mountain | sim | 20506956 | 626762 | sim | pending-review | not-built |
| ER_28 | forested mountain | sim | 13939792 | 409646 | sim | pending-review | not-built |
| ER_29 | forested mountain | sim | 20695920 | 632756 | sim | pending-review | not-built |
| WG_01 | snow-forest | sim | 4837840 | 133262 | sim | pending-review | not-built |
| WG_02 | snow-forest | sim | 5246688 | 145846 | sim | pending-review | not-built |
| WG_03 | snow-forest | sim | 4852744 | 132930 | sim | pending-review | not-built |
| WG_04 | snow-forest | sim | 5819764 | 157054 | sim | pending-review | not-built |
| WG_05 | mountain-ice-canyon | sim | 3965260 | 80856 | sim | pending-review | not-built |
| WG_06 | mountain-ice-canyon | sim | 3817764 | 85582 | sim | pending-review | not-built |
| WG_07 | mountain-ice-canyon | sim | 4901808 | 135302 | sim | pending-review | not-built |
| WG_08 | mountain-ice-canyon | sim | 3795784 | 73716 | sim | pending-review | not-built |
| WG_09 | mountain-ice-canyon | sim | 4721796 | 109110 | sim | pending-review | not-built |
| WG_10 | coastal-ice-shelf | sim | 2801116 | 40016 | sim | pending-review | not-built |
| WG_11 | coastal-ice-shelf | sim | 2479060 | 36794 | sim | pending-review | not-built |
| WG_12 | coastal-ice-shelf | sim | 1772692 | 36908 | sim | pending-review | not-built |
| WG_13 | coastal-ice-shelf | sim | 2049944 | 37454 | sim | pending-review | not-built |
| WG_14 | coastal-ice-shelf | sim | 3313440 | 49536 | sim | pending-review | not-built |
| WG_15 | iceberg-sea | sim | 1958352 | 64458 | sim | pending-review | not-built |
| WG_16 | iceberg-sea | sim | 2166072 | 56360 | sim | pending-review | not-built |
| WG_17 | iceberg-sea | sim | 2226480 | 59137 | sim | pending-review | not-built |
| WG_18 | iceberg-sea | sim | 2329576 | 63827 | sim | pending-review | not-built |
| WG_19 | iceberg-sea | sim | 1950008 | 64360 | sim | pending-review | not-built |
| WG_20 | iceberg-sea | sim | 1949372 | 64376 | sim | pending-review | not-built |
| EC_01 | forest-snow coastal ecotone | sim | 3089620 | 84324 | sim | pending-review | not-built |
| HV_01 | temperate forest | sim | 972840 | 43846 | sim | unverified-in-this-build | not-built |
| JS_-3_10 | true tropical jungle | sim | 130048 | 5540 | sim | unverified-in-this-build | not-built |
| PT_+3_10 | tropical swamp | sim | 201756 | 9017 | sim | unverified-in-this-build | not-built |
| JS_-3_11 | true tropical jungle | sim | 130048 | 5540 | sim | unverified-in-this-build | not-built |
| JS_-2_11 | true tropical jungle | sim | 130052 | 5540 | sim | unverified-in-this-build | not-built |
| JS_-1_11 | true tropical jungle | sim | 130052 | 5540 | sim | unverified-in-this-build | not-built |
| JS_+0_11 | true tropical jungle | sim | 130052 | 5540 | sim | unverified-in-this-build | not-built |
| JS_+1_11 | true tropical jungle | sim | 130052 | 5540 | sim | unverified-in-this-build | not-built |
| PT_+2_11 | tropical swamp | sim | 190220 | 8421 | sim | unverified-in-this-build | not-built |
| PT_+3_11 | tropical swamp | sim | 226544 | 10288 | sim | unverified-in-this-build | not-built |
| JS_-3_12 | true tropical jungle | sim | 130052 | 5540 | sim | unverified-in-this-build | not-built |
| JS_-2_12 | true tropical jungle | sim | 130048 | 5540 | sim | unverified-in-this-build | not-built |
| JS_-1_12 | true tropical jungle | sim | 130052 | 5540 | sim | unverified-in-this-build | not-built |
| JS_+0_12 | true tropical jungle | sim | 130048 | 5540 | sim | unverified-in-this-build | not-built |
| JS_+1_12 | true tropical jungle | sim | 130052 | 5540 | sim | unverified-in-this-build | not-built |
| PT_+2_12 | tropical swamp | sim | 197592 | 8795 | sim | unverified-in-this-build | not-built |
| PT_+3_12 | tropical swamp | sim | 213144 | 9578 | sim | unverified-in-this-build | not-built |
| JS_-3_13 | true tropical jungle | sim | 130052 | 5540 | sim | unverified-in-this-build | not-built |
| JS_-2_13 | true tropical jungle | sim | 130052 | 5540 | sim | unverified-in-this-build | not-built |
| JS_-1_13 | true tropical jungle | sim | 130048 | 5540 | sim | unverified-in-this-build | not-built |
| JS_+0_13 | true tropical jungle | sim | 130052 | 5540 | sim | unverified-in-this-build | not-built |
| JS_+1_13 | true tropical jungle | sim | 130048 | 5540 | sim | unverified-in-this-build | not-built |
| PT_+2_13 | tropical swamp | sim | 205596 | 9088 | sim | unverified-in-this-build | not-built |
| PT_+3_13 | tropical swamp | sim | 216232 | 9761 | sim | unverified-in-this-build | not-built |
| JS_-1_14 | true tropical jungle | sim | 130052 | 5540 | sim | unverified-in-this-build | not-built |
| costa_+03_-11 | glacial | sim | 515652 | 9588 | sim | unverified-in-this-build | not-built |
| costa_+04_-11 | glacial | sim | 509240 | 9532 | sim | unverified-in-this-build | not-built |
| costa_+05_-11 | glacial | sim | 520180 | 9620 | sim | unverified-in-this-build | not-built |
| costa_+02_-10 | glacial | sim | 500740 | 9442 | sim | unverified-in-this-build | not-built |
| costa_+05_-10 | glacial | sim | 525180 | 9672 | sim | unverified-in-this-build | not-built |
| costa_+06_-10 | glacial | sim | 515512 | 9582 | sim | unverified-in-this-build | not-built |
| costa_+01_-09 | glacial | sim | 491408 | 9368 | sim | unverified-in-this-build | not-built |
| costa_+06_-09 | glacial | sim | 416288 | 8712 | sim | unverified-in-this-build | not-built |
| costa_+07_-09 | glacial | sim | 525080 | 9668 | sim | unverified-in-this-build | not-built |
| costa_+08_-09 | praia | sim | 344352 | 9138 | sim | unverified-in-this-build | not-built |
| costa_+09_-09 | praia | sim | 354716 | 9264 | sim | unverified-in-this-build | not-built |
| costa_+10_-09 | praia | sim | 353852 | 9270 | sim | unverified-in-this-build | not-built |
| costa_+01_-08 | glacial | sim | 447448 | 8990 | sim | unverified-in-this-build | not-built |
| costa_+10_-08 | praia | sim | 353040 | 9216 | sim | unverified-in-this-build | not-built |
| glacial | glacial | sim | 1122752 | 27924 | sim | unverified-in-this-build | not-built |
| costa_+10_-07 | praia | sim | 344392 | 9186 | sim | unverified-in-this-build | not-built |
| costa_+00_-06 | glacial | sim | 520484 | 9632 | sim | unverified-in-this-build | not-built |
| costa_+10_-06 | praia | sim | 359928 | 9242 | sim | unverified-in-this-build | not-built |
| costa_+11_-06 | falesia | sim | 550056 | 10942 | sim | unverified-in-this-build | not-built |
| costa_+00_-05 | glacial | sim | 527016 | 9696 | sim | unverified-in-this-build | not-built |
| costa_+01_-05 | glacial | sim | 523636 | 9660 | sim | unverified-in-this-build | not-built |
| costa_+02_-05 | glacial | sim | 526960 | 9694 | sim | unverified-in-this-build | not-built |
| costa_+03_-05 | praia | sim | 365676 | 9262 | sim | unverified-in-this-build | not-built |
| costa_+11_-05 | falesia | sim | 559192 | 10996 | sim | unverified-in-this-build | not-built |
| costa_+00_-04 | dunas | sim | 292644 | 7638 | sim | unverified-in-this-build | not-built |
| costa_+01_-04 | dunas | sim | 292108 | 7616 | sim | unverified-in-this-build | not-built |
| costa_+02_-04 | dunas | sim | 285820 | 7562 | sim | unverified-in-this-build | not-built |
| costa_+03_-04 | praia | sim | 256952 | 8276 | sim | unverified-in-this-build | not-built |
| costa_+11_-04 | falesia | sim | 544268 | 10854 | sim | unverified-in-this-build | not-built |
| costa_-01_-03 | dunas | sim | 297116 | 7668 | sim | unverified-in-this-build | not-built |
| costa_+11_-03 | falesia | sim | 557528 | 10966 | sim | unverified-in-this-build | not-built |
| costa_-02_-02 | dunas | sim | 287260 | 7572 | sim | unverified-in-this-build | not-built |
| costa_+11_-02 | falesia | sim | 540180 | 10872 | sim | unverified-in-this-build | not-built |
| costa_-03_-01 | dunas | sim | 301696 | 7702 | sim | unverified-in-this-build | not-built |
| costa_+10_-01 | falesia | sim | 569760 | 11090 | sim | unverified-in-this-build | not-built |
| dunas | dunas | sim | 947448 | 26580 | sim | unverified-in-this-build | not-built |
| costa_+09_+00 | falesia | sim | 547720 | 10874 | sim | unverified-in-this-build | not-built |
| costa_-04_+01 | dunas | sim | 290816 | 7616 | sim | unverified-in-this-build | not-built |
| costa_+09_+01 | falesia | sim | 553828 | 10980 | sim | unverified-in-this-build | not-built |
| costa_-05_+02 | dunas | sim | 301792 | 7706 | sim | unverified-in-this-build | not-built |
| costa_+06_+02 | praia | sim | 305188 | 7634 | sim | unverified-in-this-build | not-built |
| costa_+07_+02 | falesia | sim | 549668 | 10916 | sim | unverified-in-this-build | not-built |
| costa_+08_+02 | falesia | sim | 572340 | 11134 | sim | unverified-in-this-build | not-built |
| costa_-05_+03 | dunas | sim | 285780 | 7564 | sim | unverified-in-this-build | not-built |
| praia | praia | sim | 1166452 | 28670 | sim | unverified-in-this-build | not-built |
| costa_-05_+04 | dunas | sim | 290616 | 7608 | sim | unverified-in-this-build | not-built |
| costa_+05_+04 | praia | sim | 299188 | 7558 | sim | unverified-in-this-build | not-built |
| costa_-05_+05 | dunas | sim | 284508 | 7564 | sim | unverified-in-this-build | not-built |
| costa_+05_+05 | arcos | sim | 589328 | 12926 | sim | unverified-in-this-build | not-built |
| costa_-05_+06 | dunas | sim | 293628 | 7628 | sim | unverified-in-this-build | not-built |
| costa_-04_+06 | dunas | sim | 297156 | 7672 | sim | unverified-in-this-build | not-built |
| costa_-03_+06 | dunas | sim | 287220 | 7572 | sim | unverified-in-this-build | not-built |
| arcos | arcos | sim | 1113492 | 27680 | sim | unverified-in-this-build | not-built |
| costa_-03_+07 | dunas | sim | 285880 | 7568 | sim | unverified-in-this-build | not-built |
| costa_+04_+07 | arcos | sim | 506164 | 9322 | sim | unverified-in-this-build | not-built |
| costa_-04_+08 | dunas | sim | 295320 | 7646 | sim | unverified-in-this-build | not-built |
| costa_+04_+08 | arcos | sim | 502444 | 9316 | sim | unverified-in-this-build | not-built |
| costa_-04_+09 | dunas | sim | 285576 | 7554 | sim | unverified-in-this-build | not-built |
| costa_+03_+09 | falesia | sim | 341952 | 9670 | sim | unverified-in-this-build | not-built |
| costa_+04_+09 | falesia | sim | 611592 | 12320 | sim | unverified-in-this-build | not-built |
| costa_-04_+10 | dunas | sim | 292484 | 7632 | sim | unverified-in-this-build | not-built |
| costa_+04_+10 | falesia | sim | 628876 | 12372 | sim | unverified-in-this-build | not-built |
| costa_-04_+11 | falesia | sim | 605832 | 11966 | sim | unverified-in-this-build | not-built |
| costa_+04_+11 | falesia | sim | 628904 | 12358 | sim | unverified-in-this-build | not-built |
| costa_-04_+12 | falesia | sim | 613680 | 12014 | sim | unverified-in-this-build | not-built |
| costa_+04_+12 | falesia | sim | 611184 | 12240 | sim | unverified-in-this-build | not-built |
| falesia | falesia | sim | 1447040 | 31084 | sim | unverified-in-this-build | not-built |
| costa_+04_+13 | falesia | sim | 625172 | 12428 | sim | unverified-in-this-build | not-built |
| costa_-04_+14 | falesia | sim | 621160 | 12250 | sim | unverified-in-this-build | not-built |
| costa_-03_+14 | falesia | sim | 628284 | 12164 | sim | unverified-in-this-build | not-built |
| costa_-02_+14 | falesia | sim | 612140 | 11892 | sim | unverified-in-this-build | not-built |
| costa_+00_+14 | falesia | sim | 633744 | 12098 | sim | unverified-in-this-build | not-built |
| costa_+01_+14 | falesia | sim | 608700 | 12170 | sim | unverified-in-this-build | not-built |
| costa_+02_+14 | falesia | sim | 623468 | 12358 | sim | unverified-in-this-build | not-built |
| costa_+03_+14 | falesia | sim | 627628 | 12434 | sim | unverified-in-this-build | not-built |
| costa_-02_+15 | falesia | sim | 616364 | 12180 | sim | unverified-in-this-build | not-built |
| costa_-01_+15 | falesia | sim | 623840 | 12222 | sim | unverified-in-this-build | not-built |