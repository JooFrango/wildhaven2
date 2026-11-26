# Relatório — IA das dunas e simulação subterrânea

Gerado em 2026-11-12T06:57:22.455Z. Sementes: 1, 2, 3.

## GLBs reais usados

| Espécie | GLB | bytes | SHA-256 |
|---|---|---:|---|
| arenoceto | `assets/models/creatures/arenoceto/v02/arenoceto-v02-skinned-animated-LOD0.glb` | 1588096 | `2c70d4c14c7fa6148c4f3d76a292f8bb57a5b8fe6a4cee0d96d27d413fa92bfd` |
| arraia-de-areia | `assets/models/creatures/arraia-de-areia/v03/arraia-de-areia-v03-rig-animated-LOD0.glb` | 5607416 | `c6d20ba62d51632db0a660974e9febb3ba65a09e6e56ab1ccf59269b0da4f672` |
| escarvao | `assets/models/creatures/escarvao/v02/escarvao_cobre_rig_anim_v02.glb` | 1959516 | `cef2ac4d2ba20cfc2c91ad197ddc7b01779375893d044cb06f68ee5cbf41506f` |
| serracorion | `assets/models/creatures/serracorion/v03/serracorion-v03-rig-animado-LOD0.glb` | 3571696 | `b12a9c509b9f7c3f3cf9abedecdf5deb116115df2e018dc2cb34ac9f39690cdc` |

## Execuções

| Cenário | Semente | Hexágonos | Mergulhos | Emergências | m sob a areia | Colisões bloqueadas | Ataques | Mortes | ms/passo |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| dunas-a-natacao | 1 | DN_19 | 1 | 0 | 1147 | 0 | 0 | 0 | 0.018 |
| dunas-a-natacao | 2 | DN_19 | 4 | 3 | 1177 | 0 | 0 | 0 | 0.024 |
| dunas-a-natacao | 3 | DN_19 | 1 | 0 | 1180 | 0 | 0 | 0 | 0.009 |
| dunas-b-arraia | 1 | DN_19 | 19 | 18 | 5179 | 3 | 0 | 0 | 0.095 |
| dunas-b-arraia | 2 | DN_19 | 14 | 13 | 4760 | 0 | 0 | 0 | 0.062 |
| dunas-b-arraia | 3 | DN_19 | 24 | 25 | 4356 | 25 | 0 | 0 | 0.105 |
| dunas-c-vibracoes | 1 | DN_19 | 50 | 51 | 25 | 0 | 0 | 0 | 0.074 |
| dunas-c-vibracoes | 2 | DN_19 | 0 | 0 | 157 | 0 | 0 | 0 | 0.064 |
| dunas-c-vibracoes | 3 | DN_19 | 9 | 10 | 111 | 0 | 0 | 0 | 0.056 |
| dunas-d-emboscada | 1 | DN_19 | 56 | 56 | 3474 | 0 | 2 | 0 | 0.095 |
| dunas-d-emboscada | 2 | DN_19 | 19 | 20 | 3815 | 10 | 2 | 0 | 0.051 |
| dunas-d-emboscada | 3 | DN_19 | 28 | 27 | 2819 | 0 | 10 | 1 | 0.042 |
| dunas-e-ecossistema | 1 | DN_19 | 128 | 127 | 10515 | 0 | 10 | 0 | 0.142 |
| dunas-e-ecossistema | 2 | DN_19 | 165 | 164 | 11030 | 55 | 10 | 0 | 0.161 |
| dunas-e-ecossistema | 3 | DN_19 | 144 | 142 | 10609 | 92 | 4 | 0 | 0.193 |
| dunas-f-travessia | 1 | DN_22+DN_23 | 9 | 9 | 4146 | 51 | 0 | 0 | 0.193 |
| dunas-f-travessia | 2 | DN_22+DN_23 | 25 | 25 | 2751 | 600 | 0 | 0 | 0.174 |
| dunas-f-travessia | 3 | DN_22+DN_23 | 21 | 21 | 2561 | 309 | 0 | 0 | 0.141 |

## Linha de base de CPU (savana-viva, sem espécies das dunas)

| Semente | ms/passo |
|---:|---:|
| 1 | 0.895 |
| 2 | 0.815 |
| 3 | 0.619 |

## Por indivíduo

| Cenário | Semente | Animal | Espécie | prof. máx (m) | m sob a areia | t sob a areia (s) | t na superfície (s) | mergulhos | emergências | estímulos | pistas | estado final |
|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| dunas-a-natacao | 1 | arenoceto-1 | arenoceto | 12 | 1146.9 | 415.9 | 0.1 | 1 | 0 | 0 | 0 | explorando |
| dunas-a-natacao | 2 | arenoceto-1 | arenoceto | 12 | 1177.2 | 388.6 | 0.4 | 4 | 3 | 0 | 0 | explorando |
| dunas-a-natacao | 3 | arenoceto-1 | arenoceto | 12 | 1180.1 | 415.9 | 0.1 | 1 | 0 | 0 | 0 | explorando |
| dunas-b-arraia | 1 | arraia-1 | arraia-de-areia | 3.6 | 1697.8 | 384.8 | 1.1 | 11 | 11 | 973 | 57 | fugindo |
| dunas-b-arraia | 1 | arraia-2 | arraia-de-areia | 3.6 | 1739.4 | 396.7 | 0.8 | 8 | 7 | 522 | 30 | mergulhando |
| dunas-b-arraia | 1 | arraia-3 | arraia-de-areia | 3.6 | 1741.5 | 420 | 0 | 0 | 0 | 734 | 66 | explorando |
| dunas-b-arraia | 2 | arraia-1 | arraia-de-areia | 3.6 | 1532.2 | 384.8 | 1.1 | 11 | 11 | 681 | 50 | explorando |
| dunas-b-arraia | 2 | arraia-2 | arraia-de-areia | 3.6 | 1640.1 | 418.4 | 0.1 | 1 | 0 | 676 | 49 | explorando |
| dunas-b-arraia | 2 | arraia-3 | arraia-de-areia | 3.6 | 1587.4 | 413.6 | 0.2 | 2 | 2 | 438 | 0 | explorando |
| dunas-b-arraia | 3 | arraia-1 | arraia-de-areia | 3.6 | 1354.7 | 371 | 1.5 | 15 | 16 | 1000 | 0 | emergindo |
| dunas-b-arraia | 3 | arraia-2 | arraia-de-areia | 3.6 | 1422.3 | 408.8 | 0.4 | 4 | 4 | 878 | 29 | emergindo |
| dunas-b-arraia | 3 | arraia-3 | arraia-de-areia | 3.6 | 1579.1 | 404 | 0.5 | 5 | 5 | 920 | 31 | explorando |
| dunas-c-vibracoes | 1 | escarvao-espreita | escarvao | 0.9 | 25.1 | 76.6 | 196.7 | 50 | 51 | 1086 | 12 | emergindo |
| dunas-c-vibracoes | 2 | escarvao-espreita | escarvao | 0.9 | 157.1 | 480 | 0 | 0 | 0 | 56 | 0 | explorando |
| dunas-c-vibracoes | 3 | escarvao-espreita | escarvao | 0.9 | 110.7 | 352.5 | 88.8 | 9 | 10 | 360 | 5 | explorando |
| dunas-d-emboscada | 1 | serracorion-emboscada | serracorion | 2 | 1.1 | 3.2 | 245 | 29 | 29 | 1861 | 67 | mergulhando |
| dunas-d-emboscada | 1 | arraia-presa-1 | arraia-de-areia | 3.6 | 1433.1 | 395.7 | 2.6 | 26 | 27 | 831 | 3 | emergindo |
| dunas-d-emboscada | 1 | arraia-presa-2 | arraia-de-areia | 3.6 | 2039.7 | 478.4 | 0.1 | 1 | 0 | 920 | 7 | explorando |
| dunas-d-emboscada | 2 | serracorion-emboscada | serracorion | 2 | 0.7 | 2.1 | 344.4 | 16 | 17 | 1488 | 55 | investigando |
| dunas-d-emboscada | 2 | arraia-presa-1 | arraia-de-areia | 3.6 | 1951.2 | 480 | 0 | 0 | 0 | 830 | 37 | explorando |
| dunas-d-emboscada | 2 | arraia-presa-2 | arraia-de-areia | 3.6 | 1863.1 | 469.5 | 1.2 | 3 | 3 | 528 | 26 | procurando_alimento |
| dunas-d-emboscada | 3 | serracorion-emboscada | serracorion | 2 | 1.2 | 3.1 | 259.8 | 27 | 27 | 1156 | 38 | mergulhando |
| dunas-d-emboscada | 3 | arraia-presa-1 | arraia-de-areia | 1.6 | 1953.2 | 480 | 0 | 0 | 0 | 429 | 2 | explorando |
| dunas-d-emboscada | 3 | arraia-presa-2 | arraia-de-areia | 3.6 | 864.2 | 225.7 | 0.1 | 1 | 0 | 353 | 59 | morto (morto: predacao) |
| dunas-e-ecossistema | 1 | arenoceto-eco | arenoceto | 14 | 1254.6 | 872.7 | 0.3 | 3 | 3 | 2903 | 9 | descansando |
| dunas-e-ecossistema | 1 | arraia-eco-1 | arraia-de-areia | 3.6 | 3073.4 | 890.4 | 0.3 | 3 | 3 | 1829 | 8 | descansando |
| dunas-e-ecossistema | 1 | arraia-eco-2 | arraia-de-areia | 3.6 | 2984 | 876 | 0.8 | 8 | 7 | 1576 | 0 | descansando |
| dunas-e-ecossistema | 1 | arraia-eco-3 | arraia-de-areia | 3.6 | 3189 | 896.8 | 0.1 | 1 | 1 | 1349 | 5 | descansando |
| dunas-e-ecossistema | 1 | escarvao-eco | escarvao | 0.9 | 8.8 | 222.2 | 423.6 | 62 | 62 | 482 | 0 | descansando |
| dunas-e-ecossistema | 1 | serracorion-eco | serracorion | 1.55 | 5.2 | 16.9 | 470.8 | 51 | 51 | 3429 | 0 | emergindo |
| dunas-e-ecossistema | 2 | arenoceto-eco | arenoceto | 14 | 1601.3 | 872.7 | 0.3 | 3 | 3 | 3462 | 47 | descansando |
| dunas-e-ecossistema | 2 | arraia-eco-1 | arraia-de-areia | 3.6 | 3051.6 | 893.6 | 0.2 | 2 | 2 | 1499 | 6 | descansando |
| dunas-e-ecossistema | 2 | arraia-eco-2 | arraia-de-areia | 3.6 | 3226.4 | 898.4 | 0.1 | 1 | 0 | 1327 | 9 | descansando |
| dunas-e-ecossistema | 2 | arraia-eco-3 | arraia-de-areia | 3.6 | 3140.6 | 893.6 | 0.2 | 2 | 2 | 2061 | 7 | descansando |
| dunas-e-ecossistema | 2 | escarvao-eco | escarvao | 0.9 | 6.5 | 100.2 | 421.3 | 92 | 93 | 575 | 27 | emergindo |
| dunas-e-ecossistema | 2 | serracorion-eco | serracorion | 1.55 | 3.5 | 12.4 | 367.1 | 65 | 64 | 4002 | 24 | mergulhando |
| dunas-e-ecossistema | 3 | arenoceto-eco | arenoceto | 14 | 1695.5 | 890.9 | 0.1 | 1 | 1 | 2413 | 0 | descansando |
| dunas-e-ecossistema | 3 | arraia-eco-1 | arraia-de-areia | 3.6 | 2411.5 | 839.2 | 1.9 | 19 | 19 | 1289 | 0 | descansando |
| dunas-e-ecossistema | 3 | arraia-eco-2 | arraia-de-areia | 3.6 | 3246.9 | 898.4 | 0.1 | 1 | 0 | 1744 | 0 | descansando |
| dunas-e-ecossistema | 3 | arraia-eco-3 | arraia-de-areia | 3.6 | 3232.2 | 893.6 | 0.2 | 2 | 2 | 1536 | 0 | comendo |
| dunas-e-ecossistema | 3 | escarvao-eco | escarvao | 0.9 | 19.5 | 302.2 | 331.3 | 65 | 65 | 528 | 0 | descansando |
| dunas-e-ecossistema | 3 | serracorion-eco | serracorion | 1.55 | 3.9 | 128.8 | 321.5 | 56 | 55 | 2924 | 0 | descansando |
| dunas-f-travessia | 1 | arenoceto-travessia | arenoceto | 14 | 1678 | 581.8 | 0.2 | 2 | 2 | 1084 | 48 | descansando |
| dunas-f-travessia | 1 | arraia-travessia | arraia-de-areia | 3.6 | 2467.7 | 578.6 | 0.7 | 7 | 7 | 833 | 23 | mergulhando |
| dunas-f-travessia | 2 | arenoceto-travessia | arenoceto | 14 | 902.6 | 563.6 | 0.4 | 4 | 4 | 960 | 4 | descansando |
| dunas-f-travessia | 2 | arraia-travessia | arraia-de-areia | 3.6 | 1848.8 | 528.1 | 6.8 | 21 | 21 | 542 | 0 | descansando |
| dunas-f-travessia | 3 | arenoceto-travessia | arenoceto | 14 | 866.3 | 563.6 | 0.4 | 4 | 4 | 715 | 0 | descansando |
| dunas-f-travessia | 3 | arraia-travessia | arraia-de-areia | 3.6 | 1694.8 | 512.1 | 35.2 | 17 | 17 | 463 | 0 | descansando |
