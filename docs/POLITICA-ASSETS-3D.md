# Política obrigatória — Publicação de GLBs no GitHub

**Regra do usuário:** “Sempre publique os GLBs no Github”.

## Onde publicar

Repositório: `carioca1111/wildhaven`  
Destino canônico para criaturas: `assets/models/creatures/<id>/`  
Exemplo: `assets/models/creatures/folhisco/folhisco_animated_v01.glb`

Sempre que existir versão de detalhe, adicionar GLBs de LOD com seus nomes reais, mantendo os clipes consistentes.

## Critérios de conclusão

- [ ] GLB criado, possui geometria real e abre corretamente; rig e clipes importáveis quando fizerem parte da etapa entregue.
- [ ] GLB principal publicado em **commit do GitHub**; não somente anexado à conversa.
- [ ] Todos os LODs prometidos também publicados.
- [ ] A fonte/projeto editável e visualizador publicados, se disponíveis.
- [ ] O manifesto JSON da revisão (por exemplo, `manifest.json` ou `asset-prototype-manifest.json`) indica caminho real de cada GLB, bytes e hash SHA-256.
- [ ] Hash do GitHub confrontado com o arquivo gerado.
- [ ] Validação de estrutura e importação; teste de rig, clipes e playback quando presentes, mais teste no navegador quando houver viewer nessa etapa.
- [ ] Ficha da espécie em `creatures/species/<id>.json` atualizada **apenas com caminhos existentes e verificados**.
- [ ] Links do commit e dos GLBs incluídos na resposta ao usuário.

**Não confundir aprovação visual com publicação.** Um animal pode ter design aprovado mesmo se o binário estiver pendente. E um GLB publicado pode permanecer em revisão artística.

## Entregas de criaturas por etapa — atualização de 2026-11-09

Um blockout estático publicado é uma entrega válida da etapa de forma: GLB real, fonte/editável quando disponível, manifesto/métricas e renders de perfil, frente e três-quartos do arquivo exportado e reimportado. Registre zero skins/clipes quando ausentes, sem exigir nem alegar rig, animações ou LOD1/2 antes das etapas correspondentes.

Publique o blockout na branch/PR para obter aprovação específica da anatomia antes de refinamento, rig e animações, respeitando aprovações já dadas ou orientação atual diferente do usuário. Acrescente clipes e LODs à medida que forem realmente entregues. Mantenha PRs de criaturas em revisão artística até a decisão aplicável; não mesclar automaticamente. ZIP é complementar e não substitui os arquivos reais no repositório.

Referências de construção: [pilotos facetados v03](prompts/referencias/exemplos-criaturas-v03.md). Fluxo completo: [mestre de criaturas](prompts/prompt-mestre-criaturas.md).

## Status de publicação — 2026-11-06

**Migração concluída para as quatro criaturas.** Os **7 GLBs reais** foram publicados no GitHub com verificação de hash Git blob, tamanho e SHA-256. Também foram publicados os **4 geradores Python** e os **4 visualizadores HTML** originais com comparação exata de bytes.

- [Commit dos 7 GLBs](https://github.com/carioca1111/wildhaven/commit/7b8cb97496fe8a3d4a5dab4f5c019b0f2413e998)
- [Commit dos geradores e visualizadores](https://github.com/carioca1111/wildhaven/commit/d9c450f80ee57ecb0e027fb44df32d68cc1bb857)

| Espécie | GLBs verificados | Status |
| --- | ---: | --- |
| Folhisco | 1 | Publicado |
| Silvarano | 2 | Publicados — temperado e tropical |
| Torvalho | 2 | Publicados — LOD0 e LOD1 |
| Boscaranha | 2 | Publicados — LOD0 e LOD1 |

Cada ficha de espécie aponta ao GLB principal em `assets.model` e `assets.riggedModel`. As variantes e demais LODs estão em `asset-prototype-manifest.json`, com o caminho real, hash e tamanho.

**Limites:** publicação de assets não equivale à aprovação artística nem à integração das criaturas no jogo. Imagens de conceito, efeitos, IA, navegação e colisões têm processos próprios.

## Se o conector só publicar texto

Arquivos GLB não são UTF-8: não converter binários em arquivo textual com extensão `.glb`. Use uma operação de upload binário de verdade, Git via cliente autenticado ou GitHub API `git/blobs` com conteúdo `base64` e árvore/commit. Se esses meios não estiverem disponíveis no ambiente, não alegar publicação e manter os arquivos para posterior sincronização. Não adicionar ponteiros Git LFS sem o objeto real em LFS.

## Manutenção

Preservar sempre a versão atual de assets aprovados. Mudanças de rig, animação ou visual são publicadas como revisões novas. Para otimização, preferir novos LODs sem substituir o modelo original.

