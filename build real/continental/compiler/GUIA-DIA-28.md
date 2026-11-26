# Entrega para a IA de implementação — Wildhaven Build Real (28/11/2026)

**Esta pasta contém código executável, não apenas um prompt.** Versão de trabalho: `feat/build-real-continental-272-v01`, PR #108 (draft). **Não modificar Alpha**, nem substituir GLBs aprovados. Não mesclar automaticamente. Cada nova etapa técnica deve preservar versões e ser revisada pelo diretor.

## O que já está pronto para uso

- Inventário 272/272 GLBs existentes (170 no repositório histórico, 1 vila, 24 tropicais, 77 costas), 738 adjacências, 266 setores com deslocamento terrestre estratégico e 6 setores marítimos bloqueados para caminhada.
- `compiler/glb.mjs`: leitor de **GLB 2.0 real** com matrizes TRS, bufferViews, strides, índices triangulados e leitura de `EXT_mesh_gpu_instancing`. Rejeita Draco/meshopt no **arquivo físico de origem** para evitar geometria incompleta.
- `compiler/physics.mjs`: rasterização das malhas reais por classe em **chunks globais alinhados** de 256 m por padrão, resolução 2 m, altura, água, bloqueios e cobertura. Binary format **WHP1** com header e quatro canais. **Não substitui terreno por plano inventado.**
- `compiler/cli.mjs`: ferramenta Node sem dependências npm, verificação de tamanho e SHA-1 Git do GLB original; SHA-256 adicional quando há registro confiável; gera arquivos `.whp.gz` versionados, `index.json`, `trees.json` e `compile-report.json`.
- `compiler/vegetation.mjs`: extrai árvores **instanciadas de GLB auxiliar** quando cada node tem regra explícita de raio; crucial para a selva/pântano com vegetação fora do GLB de terreno.
- `src/dynamic-trees.mjs`: colisões de árvores **separadas da base física**, com estados `standing/fallen/removed`, salvamento de deltas e callback para atualizar apenas nav-chunks afetados. Não apaga colisores permanentes.
- `src/physics-loader.mjs`: carregador para navegador/Worker verifica SHA-256 e descompacta gzip antes de interpretar WHP1. **Recusa pacotes não certificados em execução normal**; `allowUnverified:true` somente para ferramentas de revisão.
- `src/streamer.mjs`, `src/regions.mjs`, `src/graph.mjs`: cache LRU, controle de residência dos Hunters, rotas estratégicas e proteção de travessias.
- `test/compiler.test.mjs`: gera GLB 2.0 binário em memória e verifica CLI gzip, árvore cortada, obstáculos permanentes, água, hashes e ausência de piso falso. O CI GitHub usa Node 22.

## Pré-requisitos

Node.js 20+ (CI roda Node 22), cópia local dos **GLBs originais sem compressão meshopt/Draco**, espaço em disco e RAM para exportação **um hexágono por vez**. O repositório antigo contém 170 GLBs no commit `5865b5d0e92ec3eef541bfb51f3c1d9d7cbeb258`. O repositório novo tem os 102 restantes na revisão de laboratório `f20febb4a6aea59fb44c7f58812773b872e1983b`. **Recuperar bytes sem token no cliente; usar Git no ambiente de desenvolvimento.** No repositório principal, `main` não contém necessariamente esses GLBs.

## Evidência CI — compilação REAL (sem certificação de gameplay)

O [workflow GitHub Actions concluído com sucesso](https://github.com/carioca1111/wildhaven-new/actions/runs/45296200352) executou Node 22 com **14/14 testes aprovados** e baixou o **GLB verdadeiro** `JS_+0_11.glb` da branch `feat/regioes-moveis-v023`. A CLI executou **sem mocks** com `--res 4 --chunk 256`, registrando **286 chunks `.whp.gz`** somando **3.218.440 bytes comprimidos** e **1.014.540 células de terreno**. O índice gerado ficou com `certified:false`, como deve ser. Isto demonstra compilação real de **um** GLB; não valida os demais 271, nem os portais, nem sua apresentação/combate.

## 1. Executar os testes antes de qualquer integração

Na raiz do checkout da branch:

```bash
node 'build real/continental/tools/validate.mjs'
node --test 'build real/continental/test/continental.test.mjs' 'build real/continental/test/compiler.test.mjs'
```

## 2. Compilar um GLB real (teste pequeno antes do continente)

Exemplo com o GLB do sul tropical — usar **caminho real** para o checkout da V02.3:

```bash
node 'build real/continental/compiler/cli.mjs' \
  --tile JS_+0_11 \
  --glb '../wildhaven-new-v023/world/tropical-south-v01/models/JS_+0_11.glb' \
  --out './.generated/physics-smoke' --res 2 --chunk 256
```

Verificar `.generated/physics-smoke/JS_+0_11-physics-v01/index.json`, os `.whp.gz` e `compile-report.json`. Arquivo original permanece inalterado. Compilação **não** significa terreno fisicamente aprovado.

Se houver GLB de vegetação separado (p. ex. `world/tropical-south-v01/vegetation/JS_+0_11.glb`), adicionar `--vegetation <arquivo.glb>` e `--tree-rules <config.json>`. **Não ativar corte sem medir raio e conferir ID estável de cada árvore**. Usar `compiler/tree-rules.example.json` somente como esquema de teste; valores ali são fictícios e não aprovados.

## 3. Compilar fontes continentais locais (lote)

Preparar dois checkouts **separados**, sem modificar assets:
- `../wildhaven-original-v12/`: o commit antigo do `carioca1111/wildhaven` acima, com os 170 arquivos de `world/world-visual-coherence-v12/detailed/`.
- `../wildhaven-new-v023/`: a revisão experimental antiga do `carioca1111/wildhaven-new` acima, contendo vila, sul tropical e litoral. Não mesclar branches experimentais com a Build Real.

Executar:

```bash
node 'build real/continental/compiler/cli.mjs' --all \
  --old-root '../wildhaven-original-v12' \
  --new-root '../wildhaven-new-v023' \
  --out './.generated/physics-272'
```

O `compile-report.json` identifica quais GLBs falharam. Se não houver arquivo, hash divergir ou faltar categoria de terreno, **registrar falha e não criar plano/collider fictício**. A ferramenta é sequencial, para limitar pico de memória; o tempo total e tamanho comprimido **não foram medidos para os 272**.

## 4. Corte de árvores: ponto de integração obrigatório

- **Camada física pré-compilada:** solo, água, rochas permanentes, troncos legados que não são individulizáveis. Têm prioridade e nunca são apagados por comandos de corte.
- **Camada dinâmica de árvores:** instâncias com identificadores permanentes derivados do ID do hex, índice do nó e índice da instância; só entram aqui com regra explícita e medida. Estados são `standing`, `fallen`, `removed`.
- O motor deve usar `TreeObstacleOverlay.blockedForChunk(chunk)` como complemento dos colliders imutáveis. Depois de cortar, atualizar tiles de navegação afetados; o terreno base não é recompilado.
- **Limite existente:** certos GLBs antigos têm todos os troncos fundidos numa única malha; não há como cortar cada tronco apenas apagando vértices. Exigem exportação de instâncias/identificadores físicos separadamente, mantendo visual e GLB aprovado.
- No sul tropical as instâncias de vegetação podem estar em **GLB lateral**. O compilador opcional suporta isso, mas não adivinha quais árvores são cortáveis nem os raios corretos.
- Quando árvore cai, testar raio do tronco real, animação, dano, caminho e persistência com colisão. A cápsula de colisão atual da árvore caída é **provisória** e precisa de revisão de escala e orientação por espécie.

## 5. Integração no runtime da Build Real

1. **Não copiar a V02.3 cegamente**: avaliar contratos atuais do Hunter Lab, modelo de mundo, save e cenas. O código desta branch é infra isolada e precisa de integração.
2. Ler `index.json` por tile, carregar apenas os `chunks` necessários à janela do Hunter e compor terrenos vizinhos na mesma grade global. O índice `certified:false` impede liberação como jogável antes do Filtro de Qualidade.
3. Montar portais físicos entre fronteiras; não confundir as 738 adjacências de grafo com 738 passagens reais. Tolerância máxima de continuidade vertical `0.03 m`; verificar inclinação e rios também.
4. Rodar simulação e colisões **junto de todos os Hunters ativos**, e não só da câmera. Separar LOD/render 3D e modo pixel art; nenhum dos dois altera a IA.
5. Ligar `src/streamer.mjs` e `src/regions.mjs` aos pacotes. O callback `onCommit` precisa alterar posição global/estado de forma atômica. Se um pacote falhar, manter a região anterior carregada.
6. Gravar alterações do mundo, inclusive árvores cortadas, raridade de animais e morte permanente, com versões de schema e migrações de save.
7. Preparar LOD/HLOD visual e instanciamento de vegetação como etapa **separada** da física. Não otimizar o visual apagando informações necessárias à navegação.
8. Seis hexágonos `iceberg-sea` continuam sem travessia terrestre; navegação marítima precisa de projeto próprio.

## 6. Testes de aceitação para publicação

- [ ] Todos os 272 GLBs reais acessados e SHA verificados pelo compilador, sem arquivos improvisados.
- [ ] Malhas de solo, água, montanhas, rochas, obstáculos e classificação de categorias conferidas por região.
- [ ] **Bordas e cantos** auditados por pares/trincas (altura, inclinação, água, cores e cobertura), especialmente nos 738 pares lógicos onde houver contato real.
- [ ] Árvores cortáveis têm IDs e raios corretos, não conservam colisão estática invisível ao serem removidas.
- [ ] Simular 100+ travessias entre biomas, salvar/carregar, mudar de câmera, seguir Hunter e lutar perto de fronteiras sem desaparecimento ou teleporte.
- [ ] Verificar FPS, p95/p99, RAM/VRAM, bytes de rede, CPU sim/render em GPU integrada; não prometer porcentagens antes de medir.
- [ ] Diferenciar arte aprovada, GLB existente, colisão compilada, fronteira validada e gameplay certificado por ID.
- [ ] PR auditado; **não mesclar na main nem alterar Alpha** sem instrução do diretor.

## Prompt objetivo para o Claude/Codex em 28/11

> Continue a Build Real do Wildhaven a partir do PR #108 (`feat/build-real-continental-272-v01`), sem modificar `game/alpha01/`, sem sobrescrever GLBs aprovados e sem mesclar o PR automaticamente. Leia `AGENTS.md`, `docs/prompts/CONTINUIDADE.md`, `MAPAS.md`, e o presente guia. Execute os testes do compilador de terreno físico WHP1 e compile primeiro `JS_+0_11` a partir do GLB real da branch V02.3. Audite por nó/categoria, compare alturas/água/obstáculos, gere relatórios e portais entre vizinhos, sem inventar terreno. Só então processe o lote 272 com os GLBs originais nos commits fixos. Preserve árvores cortáveis como entidades individuais em overlay dinâmico com IDs persistentes, nunca como bloqueios estáticos que permanecem após o corte. Integre chunk loading e região móvel aos Hunters autônomos, sem relação com a câmera. Execute testes no Node e Chrome com evidência de uso de memória e travessias. Não declarar hexágonos jogáveis até validar sua física, água, passagens e gameplay. Entregue arquivos reais, hashes, links e PR em rascunho para aprovação do diretor.

**Nota de transparência:** a ferramenta está pronta como **base executável com testes de regressão**. A certificação física dos 272, a geração de LOD, a integração ao navegador/IA e os testes de gameplay ainda são tarefas futuras da produção, não entregas implícitas deste guia.
