# Relatório — ecossistema V2

Gerado em 2026-11-12T04:01:19.349Z por `npm run eco` · sementes `1` · 300 s por encontro.

## Encontros no bebedouro (nível 1, GLB/IA reais)

| Cenário | Sementes | Predações | Presas feridas vivas | Perseguições (desfecho) | Disputas (fase final) | Fugas durante disputa | Mortes em combate | Falhas | Colisões | Custo (ms/animal/s) |
|---|---|---|---|---|---|---|---|---|---|---|
| `bebedouro-real` | 1 | 1 | 0 | 1 (abate: 1) | 0 (—) | 0 | 0 | 0 | 0 | 0.2011 |
| `bebedouro` | 1 | 0 | 1 | 9 (desistiu_cansaco: 9) | 0 (—) | 0 | 0 | 0 | 5 | 0.4341 |

Resultados observados por semente (rótulos não exclusivos) e uma semente de exemplo de cada:

| Cenário | Resultado | Sementes | Exemplo | Reproduzir |
|---|---|---|---|---|
| `bebedouro-real` | predacao | 1/1 | 1 | `ecossistema.html?cenario=bebedouro-real&semente=1` |
| `bebedouro-real` | carcaca_disputada_ou_reciclada | 1/1 | 1 | `ecossistema.html?cenario=bebedouro-real&semente=1` |
| `bebedouro` | presa_ferida_sobreviveu | 1/1 | 1 | `ecossistema.html?cenario=bebedouro&semente=1` |
| `bebedouro` | desistencia_cansaco | 1/1 | 1 | `ecossistema.html?cenario=bebedouro&semente=1` |

Motivos das disputas: `bebedouro-real` — · `bebedouro` —

Comunicação: `bebedouro-real` 0 alarmes, 0 recepções, 0 proteções de filhote · `bebedouro` 12 alarmes, 21 recepções, 0 proteções de filhote

Ataques: `bebedouro-real` 1 iniciados, 1 feriram, 0 esquivas, 0 erraram · `bebedouro` 5 iniciados, 1 feriram, 0 esquivas, 4 erraram

## Dinâmica populacional (2 anos, níveis 2/3, savana procedural 640×520 m)

Inicial: velsari: 40, tarruco: 4, cromatil: 3, varrisco: 1 · Final: velsari: 52, tarruco: 4, cromatil: 2, varrisco: 1

Nascimentos 105 · predações 75 · mortes sede: 1, predacao: 75, mortalidade_juvenil: 18 · migrações 0 · incêndios 2 · contágios 0 · 9406 ms de execução

| Dia | Estação | População | Vegetação | Fome média | Sede média | Células de água |
|---|---|---|---|---|---|---|
| 2 | chuvosa | velsari: 40, tarruco: 4, cromatil: 3, varrisco: 1 | 0.999 | 12 | 32.4 | 113 |
| 17 | chuvosa | velsari: 40, tarruco: 4, cromatil: 2, varrisco: 1 | 0.986 | 13.4 | 16.1 | 118 |
| 32 | chuvosa | velsari: 40, tarruco: 4, cromatil: 2, varrisco: 1 | 0.984 | 13.3 | 18.8 | 118 |
| 47 | chuvosa | velsari: 40, tarruco: 4, cromatil: 2, varrisco: 1 | 0.983 | 13.1 | 18.8 | 118 |
| 62 | chuvosa | velsari: 40, tarruco: 5, cromatil: 3, varrisco: 1 | 0.982 | 14.1 | 26.5 | 118 |
| 77 | chuvosa | velsari: 40, tarruco: 7, cromatil: 2, varrisco: 1 | 0.981 | 12.7 | 23.4 | 118 |
| 92 | chuvosa | velsari: 40, tarruco: 7, cromatil: 2, varrisco: 1 | 0.981 | 13.3 | 21.8 | 118 |
| 107 | chuvosa | velsari: 40, tarruco: 7, cromatil: 4, varrisco: 1 | 0.98 | 13.1 | 21.4 | 118 |
| 122 | chuvosa | velsari: 40, tarruco: 5, cromatil: 4, varrisco: 1 | 0.98 | 13.3 | 20.9 | 118 |
| 137 | chuvosa | velsari: 40, tarruco: 5, cromatil: 4, varrisco: 1 | 0.98 | 13.5 | 21.2 | 118 |
| 152 | seca | velsari: 51, tarruco: 4, cromatil: 7, varrisco: 1 | 0.969 | 14.6 | 23.5 | 118 |
| 167 | seca | velsari: 73, tarruco: 4, cromatil: 4, varrisco: 1 | 0.943 | 13.6 | 21.7 | 118 |
| 182 | seca | velsari: 76, tarruco: 4, cromatil: 2, varrisco: 1 | 0.92 | 13.6 | 23 | 118 |
| 197 | seca | velsari: 75, tarruco: 4, cromatil: 2, varrisco: 1 | 0.903 | 13.5 | 20.7 | 118 |
| 212 | seca | velsari: 73, tarruco: 4, cromatil: 2, varrisco: 1 | 0.893 | 13.6 | 22.5 | 118 |
| 227 | seca | velsari: 68, tarruco: 4, cromatil: 2, varrisco: 1 | 0.887 | 13.7 | 21.2 | 118 |
| 242 | seca | velsari: 66, tarruco: 4, cromatil: 2, varrisco: 1 | 0.886 | 13.7 | 22.1 | 113 |
| 257 | seca | velsari: 63, tarruco: 4, cromatil: 2, varrisco: 1 | 0.886 | 14.1 | 20.9 | 105 |
| 272 | seca | velsari: 62, tarruco: 4, cromatil: 2, varrisco: 1 | 0.888 | 13.6 | 25 | 94 |
| 287 | seca | velsari: 60, tarruco: 4, cromatil: 2, varrisco: 1 | 0.89 | 13.9 | 17.9 | 93 |
| 302 | seca | velsari: 58, tarruco: 4, cromatil: 2, varrisco: 1 | 0.892 | 13.3 | 17.7 | 86 |
| 317 | seca | velsari: 55, tarruco: 4, cromatil: 2, varrisco: 1 | 0.895 | 13.9 | 21.3 | 81 |
| 332 | seca | velsari: 54, tarruco: 4, cromatil: 2, varrisco: 1 | 0.898 | 14.1 | 21.6 | 78 |
| 347 | seca | velsari: 51, tarruco: 4, cromatil: 2, varrisco: 1 | 0.901 | 12.4 | 19.8 | 74 |
| 362 | seca | velsari: 49, tarruco: 4, cromatil: 2, varrisco: 1 | 0.904 | 13.3 | 20.2 | 69 |
| 377 | chuvosa | velsari: 48, tarruco: 4, cromatil: 2, varrisco: 1 | 0.975 | 13.6 | 22 | 72 |
| 392 | chuvosa | velsari: 48, tarruco: 4, cromatil: 2, varrisco: 1 | 0.977 | 13.5 | 22.4 | 72 |
| 407 | chuvosa | velsari: 46, tarruco: 4, cromatil: 2, varrisco: 1 | 0.977 | 13.7 | 22.7 | 72 |
| 422 | chuvosa | velsari: 45, tarruco: 5, cromatil: 2, varrisco: 1 | 0.977 | 12 | 20.9 | 72 |
| 437 | chuvosa | velsari: 44, tarruco: 6, cromatil: 2, varrisco: 1 | 0.977 | 13.5 | 19.7 | 72 |
| 452 | chuvosa | velsari: 43, tarruco: 5, cromatil: 2, varrisco: 1 | 0.977 | 13.3 | 23.3 | 72 |
| 467 | chuvosa | velsari: 43, tarruco: 4, cromatil: 5, varrisco: 1 | 0.977 | 13.5 | 20.1 | 72 |
| 482 | chuvosa | velsari: 43, tarruco: 4, cromatil: 4, varrisco: 1 | 0.977 | 13.3 | 24.8 | 72 |
| 497 | chuvosa | velsari: 43, tarruco: 7, cromatil: 3, varrisco: 1 | 0.976 | 13.2 | 20.6 | 72 |
| 512 | seca | velsari: 48, tarruco: 4, cromatil: 6, varrisco: 1 | 0.974 | 13.2 | 21 | 72 |
| 527 | seca | velsari: 80, tarruco: 7, cromatil: 3, varrisco: 1 | 0.945 | 13.4 | 18.8 | 72 |
| 542 | seca | velsari: 80, tarruco: 7, cromatil: 2, varrisco: 1 | 0.918 | 13.8 | 19.6 | 72 |
| 557 | seca | velsari: 79, tarruco: 6, cromatil: 2, varrisco: 1 | 0.897 | 13.7 | 21.6 | 72 |
| 572 | seca | velsari: 77, tarruco: 6, cromatil: 2, varrisco: 1 | 0.884 | 13.6 | 21.5 | 72 |
| 587 | seca | velsari: 74, tarruco: 4, cromatil: 2, varrisco: 1 | 0.878 | 11.9 | 22 | 72 |
| 602 | seca | velsari: 71, tarruco: 4, cromatil: 2, varrisco: 1 | 0.876 | 13.4 | 18.9 | 72 |
| 617 | seca | velsari: 68, tarruco: 4, cromatil: 2, varrisco: 1 | 0.875 | 13.5 | 20 | 72 |
| 632 | seca | velsari: 67, tarruco: 4, cromatil: 2, varrisco: 1 | 0.877 | 13.7 | 17.8 | 72 |
| 647 | seca | velsari: 64, tarruco: 4, cromatil: 2, varrisco: 1 | 0.882 | 13.7 | 19.1 | 72 |
| 662 | seca | velsari: 61, tarruco: 4, cromatil: 2, varrisco: 1 | 0.888 | 13.5 | 23.4 | 72 |
| 677 | seca | velsari: 60, tarruco: 4, cromatil: 2, varrisco: 1 | 0.891 | 13.5 | 22 | 72 |
| 692 | seca | velsari: 59, tarruco: 4, cromatil: 2, varrisco: 1 | 0.894 | 13.9 | 18.5 | 72 |
| 707 | seca | velsari: 56, tarruco: 4, cromatil: 2, varrisco: 1 | 0.896 | 13.2 | 20.4 | 72 |
| 722 | seca | velsari: 53, tarruco: 4, cromatil: 2, varrisco: 1 | 0.902 | 13.2 | 21.2 | 72 |

### Desequilíbrios identificados (não são automaticamente bugs)

- Mortes por sede (1): verificar seca prolongada e conhecimento de pontos de água.

### Custo por nível

Nível 1: 435 ms em 576 passos-animal · Nível 2: 0 ms em 0 · Nível 3: 7844 ms em 1123072.
