# Migração Wildhaven — registro de integridade

## Método validado em 26/11/2026

O conector de leitura de conteúdo retorna vazio para alguns binários acima de 1 MB; o GitHub Actions do repositório de origem também está com a cota de artefatos esgotada. A alternativa testada não usa artefatos:

1. Checkout Git autenticado e esparso, fixado no commit de origem.
2. Validar tamanho, SHA Git, SHA-256 e cabeçalho GLB.
3. Em branch privada de transferência, armazenar temporariamente blocos Base64 de 540000 bytes originais cada (720000 caracteres; múltiplo de 3, exceto último bloco).
4. Ler os blocos em ordem, concatenar Base64, criar blob binário no destino com encoding base64 e exigir igualdade do SHA Git original.
5. Publicar o blob em árvore e commit normais; conferir tamanho/SHA no destino e verificar novamente por checkout ou download bruto. Não publicar arquivos de staging no destino.

## Arquivos já publicados

- Build Real: 15 Markdown de `carioca1111/wildhaven-new` em commit `9f43c1cbbff3c4020a71d4c45661bb8235f0dd08`; commit destino `fe5b8658d0ed54acaf183b2b5c531b34b8e0488b`.
- Arbélio V02: LOD0/1/2 e manifesto; origem `162e096c73be0733579e7d203c5e77336e3b2ac4`; destino `73c778feb0c0fb527a6f40024e6b73ee239e0359`. Verificados por nova leitura Base64.
- Arenoceto V02: GLB animado original, manifesto e README; origem no mesmo commit; destino `6beeceafaf0979b732abbeab178da06edd701355`. 1588096 bytes, SHA Git `9112818e1e00dcb156b9896835786d61d6a8bd5d`, SHA-256 esperado e conferido na origem `2c70d4c14c7fa6148c4f3d76a292f8bb57a5b8fe6a4cee0d96d27d413fa92bfd`. SHA Git e tamanho idênticos no destino. Revisão artística original permanece pendente.
- AGENTS.md, política 3D e dois guias de criaturas: mesmos blobs da origem.

## Pendências

Recuperação bruta independente do GLB maior no ambiente do chat ainda não confirmada. Demais animais, artes conceituais, mapa, laboratórios, fichas, fontes e dependências ainda precisam de seleção e transferência. Este repositório não constitui uma build jogável validada. Não apagar versões originais, nem confundir o estado de migração com aprovação artística.

A branch privada de staging fica fora de main. O método consome execução de Actions, mas não armazenamento de artefatos. O destino é público; não incluir segredos, tokens ou dados privados não autorizados.
