# Wildhaven — correção visual global v12

**170 hexágonos preservados.** A lacuna central permanece por escolha expressa do usuário. Nenhum hexágono foi movido, acrescentado ou excluído. As posições dos vértices e os índices dos 170 GLBs detalhados permanecem byte a byte iguais às fontes da composição v11.

## O que foi corrigido

A prévia anterior misturava materiais com metalicidade implícita 1 e materiais explicitamente não metálicos. Isso produzia um salto forte entre a floresta central e a serra oriental. Parte dos geradores históricos também escrevia valores de RGB de exibição diretamente nos atributos de cor linear do glTF, elevando demais o brilho quando a resposta metálica era removida.

Esta revisão grava materiais não metálicos explícitos e albedo coerente nos **GLBs reais de todas as peças**. A paleta histórica passa para o espaço linear; a paleta já linear da região Geometry Nodes é preservada. As cores de transição são reconstruídas a partir dessas fontes. O campo continental reconcilia cores nas bordas e cantos em faixas de 600 m. Os interiores do relevo glacial mantêm o campo aprovado de neve/rocha, sem achatar a classificação pela borda administrativa.

O LOD panorâmico usa o terreno glacial completo, com a tesselação original aprovada. Os demais terrenos são amostrados em resolução maior, props têm simplificação menos agressiva e os agrupamentos de árvores passam a ter troncos, copas e silhuetas de coníferas. A imagem completa usa enquadramento ortográfico calculado sobre todos os vértices, para incluir os 170 hexágonos sem cortar as peças do sul.

Há **170 GLBs detalhados e um GLB panorâmico**. A correção de material faz parte desses arquivos; o visualizador não substitui materiais para esconder diferenças. A opção de material neutro é apenas uma inspeção explicitamente identificada.

## Abrir

```powershell
py -3.14 world/world-visual-coherence-v12/tools/serve.py --port 8793
```

Abra http://127.0.0.1:8793/viewer/index.html. A vista geral usa `models/world_170_v12.glb`; as vistas próximas carregam os novos GLBs detalhados. Three.js e sua licença estão incluídos em `viewer/vendor/`. A iluminação é a mesma em todas as regiões, com exposição 1,0, luz hemisférica 1,2, principal 2,4 e preenchimento 0,6; não há correção seletiva por bioma nem neblina.

Os arquivos detalhados estão em `detailed/<id>_v12.glb` no Git/GitHub. Para evitar duplicar mais de 1 GB na cópia de trabalho, o servidor também consegue lê-los diretamente dos objetos Git identificados no manifesto, conferindo SHA-256 e bytes antes de servir. São os mesmos GLBs binários publicados, não modelos reconstruídos pelo navegador. `git_blob_sha1` é apenas o endereço local no Git; o controle de integridade usa SHA-256.

## Fontes e reconstrução

A base é a composição v11 do commit `66fda36ca929948014469d7a56d0e0675b07308b`. Seus arquivos permanecem preservados. Para reconstruir, os scripts reutilizam a biblioteca histórica local `wildhaven-reconstruction-v03` e a região aprovada em `wildhaven-glacial-gn-v10/assets/models/environment/glacial-20-geometry-nodes-v10`. Fontes v11 ausentes da cópia de trabalho são lidas do commit original no Git. O `.blend` de Geometry Nodes aprovado permanece na fonte original, sem alterações de forma.

```powershell
py -3.14 world/world-visual-coherence-v12/tools/correct.py --prepare
py -3.14 world/world-visual-coherence-v12/tools/correct.py --stage
py -3.14 world/world-visual-coherence-v12/tools/finalize.py
py -3.14 world/world-visual-coherence-v12/tools/overview.py
py -3.14 world/world-visual-coherence-v12/tests/geometry.py
node world/world-visual-coherence-v12/tests/validate-glb.mjs
node world/world-visual-coherence-v12/tests/browser.mjs
node world/world-visual-coherence-v12/tests/render-world.mjs
```

`--stage` salva cada GLB real no índice Git, confere o objeto e retira somente a cópia gerada da pasta de trabalho. Isso reduz o uso de disco. Não execute essa opção se não quiser atualizar o índice. Dependências: NumPy, SciPy, Trimesh, Pillow, VTK; Playwright e glTF Validator configurados por `WILDHAVEN_BROWSER_MODULES` e `GLTF_VALIDATOR_PACKAGE`.

## Evidências e limites

- `tests/geometry.json`: leitura dos 170 GLBs e comparação de posições/índices com as fontes; materiais não metálicos explícitos; normais unitárias; mesmas coordenadas de montagem e mesmos 170 IDs.
- As 437 interfaces são sondadas nos triângulos efetivos, considerando textura e albedo. O relatório inclui média, percentil 99 e pior diferença de cor, sem declarar erro zero para texturas ou esconder diferenças residuais da região aprovada.
- `tests/gltf-validator.json`: validação dos 171 GLBs por bytes e SHA-256. Uma validação anterior só é reutilizada quando o arquivo possui o mesmo SHA-256.
- `tests/browser.json`: carregamento real no Chrome, vistas geral, transição, costa e região glacial. `preview/` contém imagens desses modelos. A imagem de todo o mundo tem 4800 × 3600 pixels.
- `tests/remote-publication.json`, quando presente: downloads independentes de todos os novos binários, confrontados por bytes e SHA-256.

A vista panorâmica continua sendo um LOD para a câmera distante; árvores agrupadas não representam individualmente cada árvore da biblioteca completa. Foram preservadas as formas e a hidrologia existentes. As diferenças de altura históricas entre outras peças são registradas no relatório, não reesculpidas nesta revisão de aparência. Não foram alterados Hunters, combate ou Alpha. A nova aparência é apresentada para revisão do usuário, sem atribuir aprovação artística automática.
