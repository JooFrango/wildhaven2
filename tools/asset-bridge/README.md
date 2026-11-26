# Wildhaven Asset Bridge V01

Status: experimental; não considerar operacional até o teste remoto e a recuperação do ZIP passarem. Não altera a Alpha nem assets aprovados.

## Diagnóstico de 26/11/2026

O conector conseguiu retornar GLBs do Arbélio de 353176 e 549124 bytes em Base64. Para o Arenoceto V02 LOD0 de 1588096 bytes (blob 9112818e1e00dcb156b9896835786d61d6a8bd5d), retornou conteúdo vazio em Base64; a leitura direta do blob falhou por UnicodeDecodeError. Isso é compatível com o limite de 1 MB do modo de conteúdo padrão, não prova esgotamento de cota.

## Uso em ambiente autenticado

Requisitos: Python 3.9+, GitHub CLI autenticado com acesso de leitura ao repositório (ou GH_TOKEN fornecido pelo ambiente, nunca registrado em código, chat ou logs).

```sh
python tools/asset-bridge/download.py --repo carioca1111/wildhaven-new --ref 162e096c73be0733579e7d203c5e77336e3b2ac4 --path assets/models/creatures/arenoceto/v02/arenoceto-v02-skinned-animated-LOD0.glb --out transfer/arenoceto.glb
```

O script obtém metadados, usa a representação raw, confronta tamanho, SHA Git e SHA-256 opcional do manifesto, verifica a estrutura de GLB 2.0 e não sobrescreve saídas. Não substitui validação completa de geometria, skinning e animações. Para LFS ou arquivos acima de 100 MB, usar checkout Git/Git LFS autenticado; não confundir ponteiros com arquivos reais.

## Agentes

1. Resolver branch/commit e caminho real; preferir SHA imutável.
2. Para arquivos pequenos, o conector Base64 é aceitável somente com tamanho e assinatura válidos. Se retornar vazio ou falhar, usar o downloader em ambiente autenticado.
3. Se o ambiente não tiver gh autenticado, executar o teste/transferência por GitHub Actions quando disponível e recuperar o artefato ZIP por uma integração autorizada. A capacidade de materializar esse ZIP no ambiente do agente ainda precisa ser confirmada.
4. Comparar SHA-256 com manifesto quando disponível. Não editar ou publicar se os bytes reais não estiverem disponíveis.
5. Para publicação, usar Git autenticado em branch versionada e confirmar recuperação remota conforme AGENTS.md. Upload automatizado pela ponte ainda não implementado. Nunca publicar credenciais ou substituir versões aprovadas.

O workflow de teste, quando instalado e permitido pelo GitHub, baixa o Arenoceto do commit fixo com o token efêmero de leitura, valida os bytes e produz um artefato ZIP privado com o GLB e relatório. Não é necessário tornar nenhum repositório público. O token padrão de Actions de wildhaven-new não deve ser presumido capaz de ler wildhaven; para o repositório original, usar autenticação autorizada própria.

Referência: https://docs.github.com/en/rest/repos/contents#get-repository-content

## Resultado do teste real — 26/11/2026

- Execução 45758951204: GitHub CLI falhou na representação raw com `transform: short source buffer`.
- Execução 45759369851: o checkout Git autenticado e esparso recuperou integralmente o GLB original. Validação de bytes, SHA Git, SHA-256 do manifesto e estrutura GLB 2.0: sucesso.
- Bytes: 1588096; SHA-256: 2c70d4c14c7fa6148c4f3d76a292f8bb57a5b8fe6a4cee0d96d27d413fa92bfd.
- Upload do ZIP falhou com `Artifact storage quota has been hit`. GitHub informa recálculo a cada 6–12 horas. Isso confirma uma cota de armazenamento de artefatos atingida, separada da limitação de leitura do conector.
- Estado: checkout Git validado; entrega ZIP aos agentes ainda bloqueada. Preferir processamento diretamente no checkout autenticado, ou Git local autenticado. Não apagar artefatos ou habilitar cobrança sem decisão do diretor. Não declarar retrabalho de criatura concluído sem novo GLB e renders reais.

Logs: https://github.com/carioca1111/wildhaven-new/actions/runs/45759369851
