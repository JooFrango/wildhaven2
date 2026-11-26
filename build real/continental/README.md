# WILDHAVEN — Infraestrutura continental 272 v01

**Estado: infraestrutura de código e catálogo REAL, publicada em branch isolada; não integrada à Build Real jogável.** Nenhuma alteração na Alpha, nos GLBs aprovados, na branch V02.3 ou no mundo de produção. Não misturar o fato de haver 272 entradas no catálogo com "272 hexágonos jogáveis".

## O que esta primeira implementação entrega

- `data/auralis-grafo-original.json`: cópia do grafo de 272 hexágonos / 738 arestas da branch V02.3, preservado para comparação e rastreabilidade.
- `data/continent-272.manifest.json`: índice real das 272 fontes GLB encontradas; com caminho, repositório, commit de origem fixo, bytes, SHA-1 Git (hash do blob) e SHA-256/triângulos quando disponíveis na base v12.
- `src/graph.mjs`: normaliza/valida topologia, localiza hexágono e calcula rotas continentais A*. Não confunde conectividade do grafo com portais físicos validados.
- `src/streamer.mjs`: carregamento sob demanda, deduplicação de solicitações, limite de concorrência, cache LRU com teto de bytes, pinning de regiões ativas e liberação de recursos.
- `src/provider.mjs`: contrato para pacotes físicos e visuais PRÉ-PROCESSADOS e verificados (URL, bytes, SHA-256), sem expor tokens de repositório privado nem fingir gerar colisão de GLB em tempo de jogo.
- `src/regions.mjs`: residência de Hunters por hexágono independente da câmera; só muda o hex depois de dados físicos disponíveis, portal certificado e commit aceito pelo núcleo. Em falha preserva o hex antigo.
- `tools/validate.mjs` e `test/continental.test.mjs`: verificação de catálogo, grafo, políticas de travessia e streaming com provedor simulado.
- `demo/index.html`: visualizador leve dos **272 hexes com seleção e roteamento A***, explicitamente apenas topológico, sem fingir render/colisão 3D.

**Nenhum dos 272 hexes está marcado como "fisicamente certificado" neste novo manifesto.** Isso não nega os 41 já integrados no protótipo V02.3: é uma infraestrutura nova, sem promover automaticamente validações antigas.

## Origem e integridade

O inventário foi feito lendo `carioca1111/wildhaven` no commit histórico `5865b5d0e92ec3eef541bfb51f3c1d9d7cbeb258` e `carioca1111/wildhaven-new` no commit experimental `f20febb4a6aea59fb44c7f58812773b872e1983b`.

| Fonte | Hexes | Bytes dos arquivos originais |
| --- | ---: | ---: |
| Mundo v12 (repositório original) | 170 | 1.328.513.200 |
| Vila dos Hunters | 1 | 972.840 |
| Sul tropical | 24 | 3.661.944 |
| Costas litorâneas | 77 | 38.851.708 |
| **Total** | **272** | **1.371.999.692** |

O manifesto registra SHA-1 do objeto Git, não SHA-256 de bytes para itens sem catálogo v12; não afirmar que recalculamos o SHA-256 de binários. SHA-256 da base v12 foi lido de seu manifesto, não recalculado dos GLBs.

O grafo de 272 inclui 266 terras conectadas à Vila em nível de grafo e 6 hexes `iceberg-sea` sem custo de navegação terrestre. Essas seis áreas exigem locomoção marítima ou aérea.

## Como executar as verificações

Na raiz do repositório:

```bash
node "build real/continental/tools/validate.mjs"
node --test "build real/continental/test/continental.test.mjs"
```

Requisitos: Node.js com suporte nativo a `node:test` e ESM (recomendado 20+). Não exige npm install e não baixa 1,37 GB.

Para inspecionar o mapa no navegador (sem integração com gameplay):

```bash
python -m http.server 8871
# abrir http://localhost:8871/build%20real/continental/demo/index.html
```

O visualizador não apresenta sprites de Hunter nem terreno físico; apenas a cobertura e rotas lógicas.

## Compilador físico WHP1 — primeira versão implementada

**Esta seção atualiza o status anterior:** já foi publicado um compilador OFFLINE executável em `compiler/cli.mjs` e `compiler/physics.mjs`, com leitor GLB real, rasterização de colisão, água e cobertura, chunks alinhados ao mundo, exportação `.whp.gz` e integridade SHA-1 do blob Git e SHA-256 do arquivo gerado. Árvores individuais podem ser importadas de `EXT_mesh_gpu_instancing` com regras explícitas e tratadas por `src/dynamic-trees.mjs` sem reconstruir o relevo. O runtime pode ler os chunks em `src/physics-loader.mjs` (por padrão recusa `certified:false`).

**Testes Node reais no GitHub Actions:** `Wildhaven Continental Physics Compiler`, incluindo GLB 2.0 gerado em memória e teste real de execução de CLI gzip, árvore cortada e acesso a água/rochas. O compilador também foi exercitado diretamente em um GLB real do sul tropical em revisão técnica preliminar, sem publicar pacotes certificados daquele GLB.

**Ponto de partida obrigatório para a IA:** [GUIA-DIA-28.md](compiler/GUIA-DIA-28.md). A ferramenta está pronta para **processar GLBs disponíveis localmente**, mas ainda falta executar o lote 272, validar física por hex e integrar ao runtime.

### Testes do compilador

```bash
node --test 'build real/continental/test/compiler.test.mjs'
node 'build real/continental/compiler/cli.mjs' --tile JS_+0_11 \\
  --glb '../wildhaven-new-v023/world/tropical-south-v01/models/JS_+0_11.glb' \\
  --out './.generated/physics-smoke' --res 2 --chunk 256
```

A execução do segundo comando exige que o GLB **exista de verdade no checkout do laboratório**. Com dados ausentes ou hash diferente, o compilador falha explicitamente. Saídas são versionadas e nunca sobrescrevem dados existentes.

## Contrato para a etapa seguinte — CERTIFICAÇÃO e INTEGRAÇÃO (pendente)

O pacote físico por hex/chunk deve ser gerado a partir dos GLBs originais de terreno, com alturas, água, rochas/troncos/bloqueios, cobertura, declives e atributos por nível. Construir portais de fronteira reais validando vizinhos, tolerância de 0,03 m, inclinação e bioma. Publicar arquivos versionados e checksums SHA-256. Os LODs visuais devem preservar UV e paleta; nunca sobrescrever GLBs aprovados.

O campo `tile.packages.physics` **não é preenchido** hoje. Até um pacote real existir, `makeHttpProvider` lança `UnpreparedTileError`, e `HunterRegionManager` impede entrada/saída fingida. Para integrar ao jogo, o núcleo autoritativo deve usar `onCommit` atômico para mover atores e manter posições globais: esta classe não implementa física nem IA.

### Próximos passos de implementação

1. Os testes Node agora são executados automaticamente pelo workflow GitHub Actions; manter a suíte verde ao integrar novas versões.
2. Executar o compilador WHP1 contra GLBs originais, gerar pacotes físicos reais por hex/chunk e publicar derivados auditados com seus hashes e tamanhos (NÃO feito para 272).
3. Gerar portais físicos com testes de todas as fronteiras e QA de água/encostas.
4. Gerar versões LOD de renderização, streaming preditivo e orçamento de memória/VRAM.
5. Conectar as classes ao novo núcleo da Build Real: múltiplos Hunters, salvamento, simulação e modo pixel.
6. Testar longas rotas com combate/colisões, câmera, carroças e persistência por bioma.
7. Construir travessia real dos seis setores marítimos antes de anunciar 272 jogáveis.

**Limite:** os 272 GLBs não foram copiados ou transformados, a física não foi compilada, o QA não foi executado no navegador e o runtime jogável não foi integrado. Nenhuma etapa artística foi automaticamente aprovada. Esta entrega é a FUNDAÇÃO DE CÓDIGO E INVENTÁRIO.
