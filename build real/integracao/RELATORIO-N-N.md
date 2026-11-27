# Relatório N/N — continente Auralis 272 (Build Real v01)

Gerado por `build real/continental/tools/validate-portals.mjs` sobre os pacotes WHP1 compilados nesta sessão a partir dos **272 GLBs reais** (bytes e SHA conferidos). Dados completos: [`relatorio-continental-272.json`](relatorio-continental-272.json). Hashes dos pacotes: [`pacotes-fisicos-272.manifest.json`](pacotes-fisicos-272.manifest.json).

## Resumo N/N

| Etapa | N / 272 |
| --- | ---: |
| No catálogo | 272 |
| Com GLB acessível (bytes + SHA conferidos) | 272 |
| Compilados (WHP1) | 272 |
| Escala verificada pela geometria (4.330,127 × 5.000 m ± 1 m) | 272 |
| Com ao menos um portal de fronteira validado | 266 |
| Certificados tecnicamente | 223 |
| Exceção marítima legítima (iceberg-sea) | 6 |

| Arestas do grafo | N / 738 |
| --- | ---: |
| Validadas (≥1 portal) | 705 |
| Reprovadas | 5 |
| Exceção marítima | 28 |
| Sem pacote | 0 |
| Não geométricas | 0 |

## Critérios

- **Emenda:** altura das malhas de terreno REAIS dos dois GLBs no ponto da aresta compartilhada (1 cm para dentro de cada lado), amostrada a cada 2 m; |Δ| ≤ **0.03 m** (guia).
- **Inclinação:** entre células WHP1 a 4 m de cada lado ≤ 35° — *proposta técnica*.
- **Água e bloqueio:** célula com água ou bloqueio em qualquer lado reprova a amostra para travessia a pé — *proposta técnica*.
- **Portal:** trecho contínuo de amostras aprovadas com largura ≥ 4 m — *proposta técnica*.
- **Certificado técnico (hex):** compilado; zero geometria não classificada; escala verificada; ≥1 portal validado. É validação TÉCNICA; não é aprovação artística nem de gameplay.
- Centros: grade exata R = 2.500 m (`--snap-centers lattice`); correção máxima aplicada ao manifesto: 0,047 m.
- Classificação de nós: `compiler/node-classes-v01.json` (*proposta*, pendente de revisão do diretor). Sem ela, o lote base compila 251/272 (falham `C` e `WG_01..WG_20` por falta de nó `terrain`).

## Distribuição de falhas por amostra (arestas terrestres)

| Motivo | Amostras |
| --- | ---: |
| inclinacao | 35214 |
| agua | 20472 |
| emenda | 10938 |
| bloqueio | 216 |
| semCobertura | 0 |

## Arestas reprovadas

| A | B | Motivo | Emenda p50 / máx (m) |
| --- | --- | --- | --- |
| MN2_05 | MN2_06 | emenda=1144, inclinacao=1249 | 0.039 / 0.0544 |
| PT_+3_11 | costa_+04_+10 | agua=1249 | 0.0001 / 0.0004 |
| PT_+2_12 | PT_+3_12 | agua=1249 | 0.0001 / 0.0003 |
| PT_+2_13 | costa_+02_+14 | agua=1249 | 0.0002 / 0.0004 |
| PT_+3_13 | costa_+02_+14 | agua=1249 | 0.0001 / 0.0002 |

## Hexes não certificados

| Hex | Família | Bioma | Motivo |
| --- | --- | --- | --- |
| costa_+08_-09 | coast-v01 | praia | geometria não classificada (5 nós/instâncias) |
| costa_+09_-09 | coast-v01 | praia | geometria não classificada (5 nós/instâncias) |
| costa_+10_-09 | coast-v01 | praia | geometria não classificada (5 nós/instâncias) |
| costa_+10_-08 | coast-v01 | praia | geometria não classificada (5 nós/instâncias) |
| costa_+10_-07 | coast-v01 | praia | geometria não classificada (5 nós/instâncias) |
| costa_+10_-06 | coast-v01 | praia | geometria não classificada (5 nós/instâncias) |
| costa_+11_-06 | coast-v01 | falesia | geometria não classificada (5 nós/instâncias) |
| costa_+03_-05 | coast-v01 | praia | geometria não classificada (5 nós/instâncias) |
| costa_+11_-05 | coast-v01 | falesia | geometria não classificada (5 nós/instâncias) |
| costa_+03_-04 | coast-v01 | praia | geometria não classificada (5 nós/instâncias) |
| costa_+11_-04 | coast-v01 | falesia | geometria não classificada (5 nós/instâncias) |
| costa_+11_-03 | coast-v01 | falesia | geometria não classificada (5 nós/instâncias) |
| costa_+11_-02 | coast-v01 | falesia | geometria não classificada (5 nós/instâncias) |
| costa_+10_-01 | coast-v01 | falesia | geometria não classificada (5 nós/instâncias) |
| costa_+09_+00 | coast-v01 | falesia | geometria não classificada (5 nós/instâncias) |
| costa_+09_+01 | coast-v01 | falesia | geometria não classificada (5 nós/instâncias) |
| costa_+06_+02 | coast-v01 | praia | geometria não classificada (3 nós/instâncias) |
| costa_+07_+02 | coast-v01 | falesia | geometria não classificada (5 nós/instâncias) |
| costa_+08_+02 | coast-v01 | falesia | geometria não classificada (5 nós/instâncias) |
| praia | coast-v01 | praia | geometria não classificada (5 nós/instâncias) |
| costa_+05_+04 | coast-v01 | praia | geometria não classificada (3 nós/instâncias) |
| costa_+05_+05 | coast-v01 | arcos | geometria não classificada (3 nós/instâncias) |
| arcos | coast-v01 | arcos | geometria não classificada (3 nós/instâncias) |
| costa_+04_+07 | coast-v01 | arcos | geometria não classificada (3 nós/instâncias) |
| costa_+04_+08 | coast-v01 | arcos | geometria não classificada (3 nós/instâncias) |
| costa_+03_+09 | coast-v01 | falesia | geometria não classificada (7 nós/instâncias) |
| costa_+04_+09 | coast-v01 | falesia | geometria não classificada (7 nós/instâncias) |
| costa_+04_+10 | coast-v01 | falesia | geometria não classificada (7 nós/instâncias) |
| costa_-04_+11 | coast-v01 | falesia | geometria não classificada (8 nós/instâncias) |
| costa_+04_+11 | coast-v01 | falesia | geometria não classificada (7 nós/instâncias) |
| costa_-04_+12 | coast-v01 | falesia | geometria não classificada (8 nós/instâncias) |
| costa_+04_+12 | coast-v01 | falesia | geometria não classificada (7 nós/instâncias) |
| falesia | coast-v01 | falesia | geometria não classificada (8 nós/instâncias) |
| costa_+04_+13 | coast-v01 | falesia | geometria não classificada (7 nós/instâncias) |
| costa_-04_+14 | coast-v01 | falesia | geometria não classificada (8 nós/instâncias) |
| costa_-03_+14 | coast-v01 | falesia | geometria não classificada (8 nós/instâncias) |
| costa_-02_+14 | coast-v01 | falesia | geometria não classificada (8 nós/instâncias) |
| costa_+00_+14 | coast-v01 | falesia | geometria não classificada (8 nós/instâncias) |
| costa_+01_+14 | coast-v01 | falesia | geometria não classificada (7 nós/instâncias) |
| costa_+02_+14 | coast-v01 | falesia | geometria não classificada (7 nós/instâncias) |
| costa_+03_+14 | coast-v01 | falesia | geometria não classificada (7 nós/instâncias) |
| costa_-02_+15 | coast-v01 | falesia | geometria não classificada (8 nós/instâncias) |
| costa_-01_+15 | coast-v01 | falesia | geometria não classificada (8 nós/instâncias) |

Todos os 43 são costeiros (`coast-v01`) com vegetação em instâncias GPU (`Folhosa_*`, `Dossel_*`, `Palmeira_*`, ...) sem regra de árvore com raio MEDIDO. Os costeiros também **não têm malha de superfície do mar**; a água oceânica não é inventada.

## Exceção marítima

WG_15, WG_16, WG_17, WG_18, WG_19, WG_20 — `iceberg-sea`, sem travessia terrestre; navegação marítima é projeto próprio.

## Tabela por hex

| Hex | Família | Compilado | Escala (X × Z m) | Arestas validadas / total | Status |
| --- | --- | --- | --- | --- | --- |
| C | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| NW | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| NE | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 5 / 5 | certificado-tecnico |
| E | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SE | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SW | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| W | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| X3 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 4 / 4 | certificado-tecnico |
| X6 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| X7 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| F_N | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 5 / 5 | certificado-tecnico |
| F_E | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| F_S | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| F_E2 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| F_NE | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| F_SE | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| F_S2 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| F_E3 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| F_P_E | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| F_P_R | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| PL_NW | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| PL_NE | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| PL_SW | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| PL_S | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| PL_SE | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| PL_E_W | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| PL_E_N | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| PL_E_E | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| PL_E_S | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| PL_E_SE | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SV_W | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SV_CW | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SV_C | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SV_CE | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SV_E | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SV2_W | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SV2_CW | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SV2_C | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SV2_CE | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SV2_E | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SV3_W | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SV3_CW | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SV3_CE | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SV3_E | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SV4_CW | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SV4_C | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SV4_CE | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SV4_W | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| SV4_E | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| TR_CW | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| TR_CE | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| TR_W | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| TR_E | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| J_CW | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| J_C | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| J_CE | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| J_W | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| J_E | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| MW_01 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| MW_02 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| MW_03 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| MW_04 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| MW_05 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| MW_06 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| MW_07 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| MW_08 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| MN2_01 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| MN2_02 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| MN2_03 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| MN2_04 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| MN2_05 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 5 / 6 | certificado-tecnico |
| MN2_06 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 5 / 6 | certificado-tecnico |
| MN2_07 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| MN2_08 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_01 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_02 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_03 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 5 / 5 | certificado-tecnico |
| DN_04 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_05 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_06 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 5 / 5 | certificado-tecnico |
| DN_07 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_08 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_09 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_10 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_11 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_12 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_13 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_14 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_15 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_16 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_17 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_18 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_19 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_20 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_21 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_22 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_23 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_24 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| DN_25 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| FX_01 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| FX_02 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| FX_03 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| FX_04 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| FX_05 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| FX_06 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| FX_07 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| FX_08 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| FX_09 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| FX_10 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| FX_11 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| FX_12 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 4 / 4 | certificado-tecnico |
| FX_13 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 5 / 5 | certificado-tecnico |
| FX_14 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| FX_15 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| FX_16 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| FX_17 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 5 / 5 | certificado-tecnico |
| FX_18 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| FX_19 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| FX_20 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| FX_21 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_01 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_02 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_03 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_04 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_05 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_06 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_07 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_08 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_09 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_10 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_11 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_12 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_13 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_14 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_15 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_16 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_17 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_18 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_19 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_20 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_21 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_22 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_23 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_24 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_25 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_26 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_27 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_28 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| ER_29 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| WG_01 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| WG_02 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| WG_03 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| WG_04 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| WG_05 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| WG_06 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| WG_07 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| WG_08 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| WG_09 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| WG_10 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 4 / 6 | certificado-tecnico |
| WG_11 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 4 / 6 | certificado-tecnico |
| WG_12 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 4 / 6 | certificado-tecnico |
| WG_13 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 5 / 6 | certificado-tecnico |
| WG_14 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| WG_15 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 0 / 6 | excecao-maritima |
| WG_16 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 0 / 6 | excecao-maritima |
| WG_17 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 0 / 6 | excecao-maritima |
| WG_18 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 0 / 6 | excecao-maritima |
| WG_19 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 0 / 6 | excecao-maritima |
| WG_20 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 0 / 6 | excecao-maritima |
| EC_01 | world-visual-coherence-v12 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| HV_01 | hunters-village-v01 | sim | 4330.128 × 5000 | 6 / 6 | certificado-tecnico |
| JS_-3_10 | tropical-south-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| PT_+3_10 | tropical-south-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| JS_-3_11 | tropical-south-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| JS_-2_11 | tropical-south-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| JS_-1_11 | tropical-south-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| JS_+0_11 | tropical-south-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| JS_+1_11 | tropical-south-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| PT_+2_11 | tropical-south-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| PT_+3_11 | tropical-south-v01 | sim | 4330.127 × 5000 | 5 / 6 | certificado-tecnico |
| JS_-3_12 | tropical-south-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| JS_-2_12 | tropical-south-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| JS_-1_12 | tropical-south-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| JS_+0_12 | tropical-south-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| JS_+1_12 | tropical-south-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| PT_+2_12 | tropical-south-v01 | sim | 4330.127 × 5000 | 5 / 6 | certificado-tecnico |
| PT_+3_12 | tropical-south-v01 | sim | 4330.127 × 5000 | 5 / 6 | certificado-tecnico |
| JS_-3_13 | tropical-south-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| JS_-2_13 | tropical-south-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| JS_-1_13 | tropical-south-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| JS_+0_13 | tropical-south-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| JS_+1_13 | tropical-south-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| PT_+2_13 | tropical-south-v01 | sim | 4330.127 × 5000 | 5 / 6 | certificado-tecnico |
| PT_+3_13 | tropical-south-v01 | sim | 4330.127 × 5000 | 5 / 6 | certificado-tecnico |
| JS_-1_14 | tropical-south-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| costa_+03_-11 | coast-v01 | sim | 4330.127 × 5000 | 2 / 3 | certificado-tecnico |
| costa_+04_-11 | coast-v01 | sim | 4330.127 × 5000 | 2 / 4 | certificado-tecnico |
| costa_+05_-11 | coast-v01 | sim | 4330.127 × 5000 | 2 / 3 | certificado-tecnico |
| costa_+02_-10 | coast-v01 | sim | 4330.127 × 5000 | 2 / 4 | certificado-tecnico |
| costa_+05_-10 | coast-v01 | sim | 4330.127 × 5000 | 2 / 5 | certificado-tecnico |
| costa_+06_-10 | coast-v01 | sim | 4330.127 × 5000 | 2 / 3 | certificado-tecnico |
| costa_+01_-09 | coast-v01 | sim | 4330.127 × 5000 | 2 / 3 | certificado-tecnico |
| costa_+06_-09 | coast-v01 | sim | 4330.127 × 5000 | 4 / 5 | certificado-tecnico |
| costa_+07_-09 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | certificado-tecnico |
| costa_+08_-09 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| costa_+09_-09 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| costa_+10_-09 | coast-v01 | sim | 4330.127 × 5000 | 3 / 3 | nao-certificado |
| costa_+01_-08 | coast-v01 | sim | 4330.127 × 5000 | 4 / 5 | certificado-tecnico |
| costa_+10_-08 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| glacial | coast-v01 | sim | 4330.127 × 5000 | 3 / 3 | certificado-tecnico |
| costa_+10_-07 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| costa_+00_-06 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | certificado-tecnico |
| costa_+10_-06 | coast-v01 | sim | 4330.127 × 5000 | 5 / 5 | nao-certificado |
| costa_+11_-06 | coast-v01 | sim | 4330.127 × 5000 | 3 / 3 | nao-certificado |
| costa_+00_-05 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | certificado-tecnico |
| costa_+01_-05 | coast-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| costa_+02_-05 | coast-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| costa_+03_-05 | coast-v01 | sim | 4330.127 × 5000 | 6 / 6 | nao-certificado |
| costa_+11_-05 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| costa_+00_-04 | coast-v01 | sim | 4330.127 × 5000 | 5 / 5 | certificado-tecnico |
| costa_+01_-04 | coast-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| costa_+02_-04 | coast-v01 | sim | 4330.127 × 5000 | 6 / 6 | certificado-tecnico |
| costa_+03_-04 | coast-v01 | sim | 4330.127 × 5000 | 6 / 6 | nao-certificado |
| costa_+11_-04 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| costa_-01_-03 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | certificado-tecnico |
| costa_+11_-03 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| costa_-02_-02 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | certificado-tecnico |
| costa_+11_-02 | coast-v01 | sim | 4330.127 × 5000 | 3 / 3 | nao-certificado |
| costa_-03_-01 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | certificado-tecnico |
| costa_+10_-01 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| dunas | coast-v01 | sim | 4330.127 × 5000 | 3 / 3 | certificado-tecnico |
| costa_+09_+00 | coast-v01 | sim | 4330.127 × 5000 | 5 / 5 | nao-certificado |
| costa_-04_+01 | coast-v01 | sim | 4330.127 × 5000 | 5 / 5 | certificado-tecnico |
| costa_+09_+01 | coast-v01 | sim | 4330.127 × 5000 | 3 / 3 | nao-certificado |
| costa_-05_+02 | coast-v01 | sim | 4330.127 × 5000 | 3 / 3 | certificado-tecnico |
| costa_+06_+02 | coast-v01 | sim | 4330.127 × 5000 | 5 / 5 | nao-certificado |
| costa_+07_+02 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| costa_+08_+02 | coast-v01 | sim | 4330.127 × 5000 | 3 / 3 | nao-certificado |
| costa_-05_+03 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | certificado-tecnico |
| praia | coast-v01 | sim | 4330.127 × 5000 | 5 / 5 | nao-certificado |
| costa_-05_+04 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | certificado-tecnico |
| costa_+05_+04 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| costa_-05_+05 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | certificado-tecnico |
| costa_+05_+05 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| costa_-05_+06 | coast-v01 | sim | 4330.127 × 5000 | 3 / 3 | certificado-tecnico |
| costa_-04_+06 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | certificado-tecnico |
| costa_-03_+06 | coast-v01 | sim | 4330.127 × 5000 | 5 / 5 | certificado-tecnico |
| arcos | coast-v01 | sim | 4330.127 × 5000 | 3 / 3 | nao-certificado |
| costa_-03_+07 | coast-v01 | sim | 4330.127 × 5000 | 5 / 5 | certificado-tecnico |
| costa_+04_+07 | coast-v01 | sim | 4330.127 × 5000 | 5 / 5 | nao-certificado |
| costa_-04_+08 | coast-v01 | sim | 4330.127 × 5000 | 3 / 3 | certificado-tecnico |
| costa_+04_+08 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| costa_-04_+09 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | certificado-tecnico |
| costa_+03_+09 | coast-v01 | sim | 4330.127 × 5000 | 6 / 6 | nao-certificado |
| costa_+04_+09 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| costa_-04_+10 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | certificado-tecnico |
| costa_+04_+10 | coast-v01 | sim | 4330.127 × 5000 | 3 / 4 | nao-certificado |
| costa_-04_+11 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| costa_+04_+11 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| costa_-04_+12 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| costa_+04_+12 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| falesia | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| costa_+04_+13 | coast-v01 | sim | 4330.127 × 5000 | 3 / 3 | nao-certificado |
| costa_-04_+14 | coast-v01 | sim | 4330.127 × 5000 | 3 / 3 | nao-certificado |
| costa_-03_+14 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| costa_-02_+14 | coast-v01 | sim | 4330.127 × 5000 | 5 / 5 | nao-certificado |
| costa_+00_+14 | coast-v01 | sim | 4330.127 × 5000 | 5 / 5 | nao-certificado |
| costa_+01_+14 | coast-v01 | sim | 4330.127 × 5000 | 4 / 4 | nao-certificado |
| costa_+02_+14 | coast-v01 | sim | 4330.127 × 5000 | 2 / 4 | nao-certificado |
| costa_+03_+14 | coast-v01 | sim | 4330.127 × 5000 | 3 / 3 | nao-certificado |
| costa_-02_+15 | coast-v01 | sim | 4330.127 × 5000 | 3 / 3 | nao-certificado |
| costa_-01_+15 | coast-v01 | sim | 4330.127 × 5000 | 3 / 3 | nao-certificado |
