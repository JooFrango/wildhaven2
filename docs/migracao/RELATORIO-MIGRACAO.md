# Relatório da migração de criaturas para wildhaven2

Data: 26/11/2026.

Origens auditadas:

- `carioca1111/wildhaven` — 122 branches, 4,0 GB.
- `carioca1111/wildhaven-new` — 122 branches, 1,5 GB.

Destino: `JooFrango/wildhaven2`.

## Como a recuperação foi feita

O disco local tinha menos de 1 GB livre, o que impedia clonar os dois repositórios
de origem (5,5 GB somados). Em vez de clonar, a árvore de arquivos de **todas as
244 branches** foi lida pela API do GitHub e cada arquivo de criatura foi baixado
individualmente pelo seu *blob sha*, com o endpoint `git/blobs` em formato bruto.
Esse caminho não tem o limite de 1 MB do endpoint de conteúdo, que foi o que
bloqueou as tentativas anteriores pelo conector.

Cada arquivo baixado teve o hash do objeto git recalculado localmente
(`sha1("blob <tamanho>\0" + bytes)`) e comparado com o sha de origem antes de ser
gravado. Os 2.034 arquivos transferidos conferem byte a byte com a origem. Nenhum
modelo foi reconstruído, recomprimido ou reduzido.

Nenhum dos três repositórios usa Git LFS: não existe `.gitattributes` com filtro
LFS em nenhuma branch, e os binários estão gravados diretamente no git. Portanto
não havia arquivos ponteiro para resolver. A auditoria confirma isso: zero
ponteiros LFS entre os 281 GLBs verificados.

O `tools/asset-bridge` da branch `feat/wildhaven-asset-bridge-v01` do
wildhaven-new foi inspecionado (`download.py`, `README.md` e o workflow
`wildhaven-asset-bridge.yml`). Ele não foi usado, porque o download direto por
blob sha já recupera o binário real e permite verificar o hash.

## Regra de não sobrescrita

Nenhum arquivo que já existia no destino foi apagado ou sobrescrito.

- Arquivo com o mesmo conteúdo já presente no destino: não foi copiado de novo.
- Caminho livre no destino: o arquivo foi gravado no mesmo caminho da origem.
- Caminho já ocupado por conteúdo diferente, ou disputado por mais de uma versão:
  a versão mais recente (pela data do commit da branch) ficou no caminho original
  e as outras foram preservadas em
  `docs/migracao/variantes/<repositório>/<branch>/<caminho original>`.

## Resultado

| Item | Quantidade |
| --- | --- |
| Branches auditadas nas origens | 244 |
| Blobs únicos vistos nas origens | 7.407 |
| Arquivos de criatura transferidos | 2.034 |
| Falhas de download | 0 |
| Divergências de hash | 0 |
| Arquivos no destino | 2.299 |
| Tamanho total no destino | 744,4 MB |
| GLBs no destino | 301 (308,5 MB) |
| Imagens PNG/JPG/WEBP | 723 (325,9 MB) |
| GIFs de animação | 99 (98,3 MB) |
| Criaturas no inventário | 94 |
| GLBs auditados | 281 |
| GLBs com falha de validação | 0 |
| GLBs com animação embutida | 227 |
| GLBs com rig (skin) | 152 de 281 |
| Triângulos somados | 2.942.385 |
| Artes conceituais originais localizadas | 11 |
| Fichas e documentos de criatura | 167 |

As 13 pastas sem GLB apontadas na auditoria anterior passaram a ter modelo:
Arraia-de-Areia (3), Arumbar (6), Caudraco (2), Clavascárnio (1), Cornévio (2),
Dunlíngua (5), Fulgaronte (7), Lagarto-Papagaio (7), Nevisco (2), Quedravo (2),
Serpaduna (3), Tufrino (2), além da Fauna da Neve V02.

Os animais que não tinham pasta própria no destino também foram recuperados:
Ferrunco (5 GLBs), Pica-Termita (5), Rocantraz (12), Escarvão (6), Fossário (2),
Gravarto (2), Lajurim (2), Serracorion (3).

A **Fauna da Neve V02** é um lote de três espécies, identificadas pelo
`README.md` do lote: **Casquim**, **Tufrino de Gelo** e **Nevisco**. Cada uma tem
pasta e GLB próprios; a pasta `snow-fauna-v02` guarda só a documentação e os
scripts de geração do lote. O próprio documento de origem registra que esses
blockouts estão em revisão artística, sem aprovação de forma, sem rig e sem
clipes, e pede que não sejam integrados à Alpha.

## Pendências reais

### 1. Arte conceitual original quase inexistente nos repositórios

Esta é a maior lacuna e ela não pode ser resolvida dentro do git. Em 244 branches
existem apenas **11 arquivos de arte conceitual de criatura**:

- `assets/models/creatures/brejaveo/v01/conceito-aprovado.png`
- `assets/models/creatures/brejaveo/v03/previews/brejaveo-v03-comparativo-conceito-glb.png`
- `assets/models/creatures/fulgaronte/v04/previews/comparacao/conceito_predador_anfibio_couraca_serpentina.webp`
- `assets/models/creatures/fulgaronte/v04/previews/comparacao/comparativo_conceito_v03_v04.png`
- `assets/models/creatures/sirocauro/v01/conceito-aprovado.jpg`
- `assets/models/creatures/sirocauro/v01/previews/sirocauro-v01-conceito-vs-glb.png`
- `assets/models/creatures/varrisco/referencias/varrisco-arte-conceitual.webp`
- `assets/models/creatures/varrisco/referencias/bug-v09-frente.png`
- `assets/models/creatures/varrisco/referencias/bug-v09-perfil.png`
- `assets/models/creatures/varrisco/v09/previews/repouso-vs-conceito.png`
- `assets/models/creatures/varrisco/v10/previews/repouso-vs-conceito.png`

As outras 723 imagens de criatura são **renders do próprio GLB** (padrões
`real-3d`, `real-glb`, `GLB_REAL`, `PRANCHA`, pastas `previews/`) ou **texturas**
(`textures/`, `uv_atlas`, `albedo`). Elas foram recuperadas e catalogadas, mas
estão registradas no inventário como `previews_do_modelo`, nunca como arte
conceitual, para não substituir uma pela outra.

Conclusão: as artes conceituais originais das demais 83 criaturas **nunca foram
versionadas** nesses dois repositórios. Elas só podem vir de fora do git — do
histórico de conversas em que foram geradas, de armazenamento do diretor de arte,
ou do serviço que as produziu. Nenhuma imagem foi gerada para preencher essa
lacuna.

### 2. Versão aprovada não é identificável pelos arquivos

Só dois arquivos no acervo trazem aprovação explícita no nome
(`brejaveo/v01/conceito-aprovado.png` e `sirocauro/v01/conceito-aprovado.jpg`).
Para os modelos, não existe marcação de aprovação em caminho, nome ou manifesto.
O que existe é o campo `status` das fichas em `creatures/species/*.json`, com
valores como `asset_v03_organic_anatomy_in_review`, e o texto dos READMEs de
lote. O inventário registra esse `status_ficha` e marca
`versao_aprovada: "nao localizado"` quando não há evidência. A definição de qual
versão vai para a Build Real depende de uma decisão de direção de arte que não
está escrita nos repositórios.

Todas as versões anteriores foram preservadas: as que disputavam o mesmo caminho
estão em `docs/migracao/variantes/`, com repositório e branch de origem no
caminho, e o registro completo está em `docs/migracao/procedencia.json`.

### 3. Rig e animação ausentes em parte dos modelos

129 dos 281 GLBs não têm skin (`skins=0`). Em boa parte dos casos isso é o estado
real do asset na origem: são blockouts estáticos, como os da Fauna da Neve V02,
cujo README diz explicitamente que não há rig nem clipes. Não é perda de
transferência — o GLB de origem também não tem rig. O inventário marca isso por
criatura como pendência técnica, não como falha de migração.

### 4. Fora de escopo nesta etapa

Laboratórios, mapa, mundo, armas e armaduras não foram migrados, conforme a
restrição da tarefa. De `labs/ia-criaturas` foram trazidos apenas `src/`,
`scripts/` e `animacoes/`, que são os scripts originais de geração das criaturas
pedidos no item 7. `labs/ia-criaturas/config/` ficou de fora porque contém dados
de terreno do mundo, não trabalho de criatura.

## Como reproduzir a verificação

```bash
node tools/auditar-criaturas.mjs          # auditoria técnica de todos os GLBs
node tools/auditar-criaturas.mjs --falhas # só o que falhou
node tools/gerar-inventario-criaturas.mjs # regera o inventário a partir do repo
```

A auditoria sai com código 1 se qualquer GLB falhar na validação.
