# Auditoria e checkpoints

## Base explicitamente verificada

Repositório de trabalho: `carioca1111/wildhaven-new`. Branch `feat/hunter-lab-codex-v1`, derivada do commit **233975e112efe12e406115f4319c819a99078386**, cabeça do PR20 (`perf/lab-hex-5km-stress-v01`). `git merge-base --is-ancestor bbb3b78f651b485aec9a73ad12e7b41d4ab22c0f 233975e112efe12e406115f4319c819a99078386` confirmou a inclusão do PR19. Ambos estavam abertos e não mesclados durante a auditoria. O PR deste trabalho usa a branch do PR20 como base para expor apenas o diff do laboratório Codex.

AGENTS.md lido antes de programar. A skill codebase-memory foi lida; seus MCPs não estavam disponíveis. Não havia `.codegraph/` na árvore-base. Auditoria por arquivos direcionados e refs Git; nenhum grafo inexistente foi declarado como consultado.

## Assets

`assets/hunters/hunter-workshop/` contém uma base anterior e cabelos, não é a v02 que a missão exige. Permanece intacto.

Hunter v02 recuperado em clone separado da branch `review/hunter-1000tri-v02` de `carioca1111/wildhaven`, PR81, commit **f6c6eff2be765127098938f5070fc80328cdef5b**. Os nomes citados na missão não vieram como novos anexos binários neste turno. A revisão local da conversa anterior foi comparada com essa fonte: arquivos iguais. Cópias oficiais no diretório privado do lab, sem substituir assets aprovados. Hashes e contagens em `assets/manifest.json`.

Hex52 original: `world/environmental-polish/base10/models/52_savana_bosques_de_acacia_5km.glb`, SHA **b45715d284e1359db83f50cbe2dc8e9a69d731766714eb23a36390e8d84a0773**. Recorte derivado de X=-400..-300, Z=100..200, altura-base 346,44573974609375. Cores e triângulos visuais derivados do original; nenhum mapa oficial foi alterado.

## Sistemas reaproveitados

Imports diretos, sem cópia do laboratório animal: `eco/mundo.js`, `percepcao.js`, `saude.js`, `combate.js`, `veneno.js`, `persistencia.js`, `locomocao.js`, `terreno.js`, RNGs e decodificador/derivação do GLB. A ficha humana e a inclusão do Hunter como presa são cópias em memória para o lab; fichas oficiais permanecem intactas.

O callback `comandoTeste` existente no ciclo ecológico permite instalar a IA humana sem alterar o núcleo animal. `src/integration.js` trata um caso demonstrado: o planejador animal superestima incerteza de aceleração ao atacar o alvo humano parado; o adaptador mantém sua perseguição e inicia o ciclo de ataque existente apenas com contato geométrico, percepção visual válida e linha sólida livre. Dano, região, veneno e impacto seguem os módulos ecológicos originais. Não foi criado um segundo sistema de saúde animal.

`niveis.js:sairDoNivel1` apaga `golpe` e encerra conflitos com motivo `fora_de_foco`. O Hunter Lab não usa foco de câmera para atribuir níveis: `observacao=null`. A flag remota controla somente representação e frequência de mentes ociosas. Não altera o laboratório de criaturas nem suas regras históricas.

## Checkpoints executados

1. Auditoria e recuperação da v02 oficial; comparação de SHA e metadados.
2. Primeiro duelo sem interface: ataques, erros de alcance, ferimentos e rendição observados.
3. Integração do Varrisco: danos nos dois sentidos e desistência do Hunter observados.
4. Interface real, GLBs carregados e capturas em Chromium. Controles testados por automação.
5. Primeira rodada 19/23. Corrigido corte de quina da navegação; três testes tinham pressupostos incorretos sobre alcance visual, estado após recuperação e atraso de percepção. Ajustados para verificar comportamento, sem remover requisitos. Depois: 23/23; com teste de atomicidade de equipamento: 24/24.
6. Regressão ecológica inicialmente 183/185 por assets omitidos no checkout esparso após falta de espaço em disco. Restaurados os assets de leitura necessários; rodada completa final: 185/185. Nenhuma alteração no código compartilhado.
7. Benchmark real progressivo. Identificado custo de consultas de linha 3D; adicionado percurso pelos bins espaciais. Arquivo anterior preservado para transparência; somente `browser.json` é a medição final de referência. Não se afirma velocidade de GPU física.
8. Validação glTF dos GLBs locais: zero erros e avisos. Publicação do código em PR rascunho e pacote estático privado separado.

Implementado, provisório e pendente estão separados no README. O arquivo da missão é uma instrução do usuário; imagens e descrições históricas não foram tratadas como código pronto.
