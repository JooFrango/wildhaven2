# Relatório final — IA Base V1.0

Detalhe completo em [`IA-BASE-V1-CHECKPOINT.md`](../../IA-BASE-V1-CHECKPOINT.md).

## 1. Estado

**PRONTA PARA APROVAÇÃO.** Todos os critérios obrigatórios da operação foram atendidos, com uma exceção
que não está ao meu alcance: a auditoria independente do **Agente 06 — Filtro de Qualidade** ainda não foi
feita. Testes verdes não substituem essa auditoria, então a V1.0 não deve ser congelada antes dela.

## 2. GitHub

| item | valor |
| --- | --- |
| branch | `release/laboratorio-ia-base-v1` |
| commit de consolidação | `d179794` (código, cenários, testes e documentos); seguem só commits de documentação |
| PR | https://github.com/carioca1111/wildhaven-new/pull/19 |
| base | `feat/lab-serpenduna-locomocao-v01` (`126d629`, cabeça do PR #18) |
| dependências | #18 → #17 → #12 → #11 → #2 → #1, todos contidos em `126d629`; modelos da Serpáduna (#14/#15/#16) entraram por merge explícito `b3043bd` |
| merge | **não feito**. Nada tocou `main` nem a Alpha. |

Integridade: clone limpo do remoto + `git fsck` → sem saída. Os 10 blobs ausentes do alerta anterior são do
clone local de trabalho e de arquivos históricos; nenhum pertence a estes commits. Nenhum comando destrutivo
foi usado.

## 3. Testes

| | |
| --- | --- |
| total executado | **185** |
| aprovados | **185** |
| falhas | **0** |
| antes da operação | 177 |
| novos | 7, em `test/ia-base-v1.test.mjs` |

Build ok. `simular --sementes 1-30 --falhar-se-erro` sem falhas. Paridade `94df59e1`.

Os 7 testes novos: cenário integrado da savana em 5 sementes; cenário das dunas em 5 sementes; execução
longa de 900 s; persistência completa; os Maps das capacidades sobrevivendo ao JSON; conservação da matéria
da carcaça; contrato da espécie nova.

## 4. Integração

**Espécies (11 na savana, 6 nas dunas):** Velsari (grupo com filhotes), Tarruco, Cromátil, Folhisco,
Frutavil, Varrisco, Boscaranha, protótipo caçador camuflado, Carniroca, Pica-Termita, Ferrunco /
Arenoceto, Arraia-de-areia, Escarvão, Serracórion, Serpáduna, Cromátil.

**Sistemas exercitados:** percepção, memória, decisão, fome, sede, energia, descanso, locomoção terrestre,
navegação, colisão, saúde, ferimentos, combate, fuga, veneno, camuflagem óptica, termorrecepção, voo,
bandos, locomoção subterrânea, locomoção de serpente, engolir inteira, relações sociais, reprodução, clima
adverso, alimentação, cupinzeiros, carcaça, decomposição, necrófagos, persistência e níveis de simulação.

**Sementes:** 1 a 5, em cada cenário, 1200 s simulados cada. **0 falhas registradas nas 10 execuções.**

**Resultado:** mortes por predação em 3 das 5 sementes da savana; uma presa envenenada, morta e engolida
inteira nas dunas (semente 4); 209 decolagens e 214 pousos; 702 cumprimentos e 510 limpezas mútuas;
605 mergulhos na areia; 13 mudanças de estágio de carcaça e 3 reciclagens de ossos. Nada foi forçado para
que um evento acontecesse.

## 5. Desempenho

| cenário | animais | p50 | p95 | p99 | pior passo |
| --- | --- | --- | --- | --- | --- |
| savana | 23 | 1,8–2,4 ms | 4,0–5,5 ms | 5,1–7,4 ms | 59–169 ms |
| dunas | 8 | 0,22–0,43 ms | 0,57–1,09 ms | 0,75–4,50 ms | 43–185 ms |

O pior passo é arranque e busca de caminho, não regime: um passo isolado no fim de 1200 s custa **2,46 ms**.
Buscas de caminho: 57–346 na savana, 0–2 nas dunas. RSS 253–340 MB num processo que acumula as 10 execuções.
**Nenhuma regressão grave** causada pela consolidação; o limite de `eco-tecnico` (menos de 5 ms por animal
por segundo simulado) continua sendo cumprido. O custo do A\* subterrâneo segue como limitação conhecida.

## 6. Limitações

**Nenhum problema crítico em aberto no núcleo compartilhado.** Os cinco defeitos bloqueantes encontrados
nesta operação foram corrigidos (percepção por vibração, três buracos na persistência e a criação de
nutriente do nada na reciclagem).

**Pendências não bloqueantes** — lista completa em [`docs/PENDENCIAS-IA-FUTURAS.md`](../../docs/PENDENCIAS-IA-FUTURAS.md):

- corpo da serpente não participa da física (só a cápsula de cabeça/pescoço de 2,6 m);
- extremidades de voadores não colidem;
- A\* subterrâneo caro;
- células intransponíveis geram atrito de rota (`preso` instantâneo, nunca prisão: nenhum bloqueio contínuo
  passou de 0,0 s em 1200 s);
- camuflagem ativa piora o resultado contra grupos — resultado medido e contrário à expectativa, não
  corrigido;
- o erro `computeBoundingSphere ... NaN` que estava em aberto foi reproduzido pela CI no commit `2509b83`,
  teve a causa achada (ficha territorial sem `raioTerritorioM`) e foi corrigido na origem.

**Assets que precisam de trabalho futuro:** cauda imóvel em 11 dos 13 clipes do GLB da Serpáduna;
`coil_enter`/`coil_exit` afundando a −9,3 m; Frutavil com rig por pivôs, sem pesos de skinning; ossos
desenhados com proxy procedural. Tudo é tarefa de rig/modelagem, não do núcleo.

## 7. Próxima área de desenvolvimento

**Sim, dá para tirar o Claude Code do laboratório.** O núcleo faz o que precisa fazer, está medido, testado
em duas sementes de bioma e documentado, e uma criatura nova entra por um JSON — a Frutavil prova isso.
Três ressalvas honestas:

1. A V1.0 só deve ser **congelada** depois da auditoria do Agente 06.
2. A ponte com a Alpha e o mapa completo **não foi feita** e é uma operação própria. Quem for integrar vai
   precisar de alguém que conheça o laboratório.
3. As pendências de rig (Serpáduna, principalmente) são de outro agente e continuam abertas; elas não
   bloqueiam o núcleo, mas aparecem na tela.

Com isso dito: Hunters, equipamento, combate do jogador e sistemas de sobrevivência podem receber o foco.
