# Wildhaven · Clareiras temperadas V01

Piloto para aprovação artística e técnica em FX_16, FX_19 e FX_20. Base jogável `5ab87d9`, modelos V12 de `5865b5d0e92ec3eef541bfb51f3c1d9d7cbeb258`. A Build Real continua carregando o catálogo anterior. O visualizador permite alternar entre as duas composições mantendo câmera e iluminação.

## Avaliação visual

Na pasta deste README, execute `npm ci` e `npm start`. Abra [o visualizador local](http://127.0.0.1:4183/). Arraste para orbitar, use a roda para aproximar e o botão direito para deslocar a câmera. A opção de Hunter posiciona os olhos a 1,75 m do solo.

| Câmera | V12 | Piloto |
|---|---|---|
| Três hexágonos | [Original](review/air-before.jpg) | [Clareiras](review/air-after.jpg) |
| Fronteira FX_19 / FX_20 | [Original](review/edge-before.jpg) | [Clareiras](review/edge-after.jpg) |
| Altura de Hunter | [Original](review/hunter-before.jpg) | [Clareiras](review/hunter-after.jpg) |
| Clareira isolada do FX_20 | [Original](review/island-before.jpg) | [Clareiras](review/island-after.jpg) |

## Modelos e paisagem

| GLB derivado | Árvores V12 | Árvores V01 | Triângulos V12 | Triângulos únicos V01 |
|---|---:|---:|---:|---:|
| [FX_16](models/FX_16.glb) | 1.357 | 801 | 373.858 | 231.482 |
| [FX_19](models/FX_19.glb) | 1.352 | 940 | 373.728 | 268.810 |
| [FX_20](models/FX_20.glb) | 800 | 434 | 222.322 | 129.752 |
| Total | 3.509 | 2.175 | 969.908 | 630.044 |

A redução total foi de 38,0%. Os números de malha contam cada geometria compartilhada uma vez. Se todas as instâncias de capim e flores fossem desenhadas em LOD0 ao mesmo tempo, o piloto somaria 1.403.732 triângulos. O visualizador seleciona a vegetação visível conforme a câmera. Os arquivos [metrics.json](metrics.json) e [pilot.json](pilot.json) registram contagens, bytes, fontes e hashes.

O gerador do diorama de Auralis constrói árvores em lotes. Os binários FX da revisão continental têm sua própria topologia. O piloto usa diretamente os componentes conectados dos GLBs finais, preservando a variação das copas e as correções V12 de cor e relevo. A reconstrução identifica anéis de base e topo do tronco, vincula o início dos galhos ao topo e confere a sequência das copas com as extremidades dos galhos. As camadas das coníferas são associadas pelo eixo. O script verifica faces, contiguidade e integridade das associações. Aplica escala uniforme 0,5 em torno da interseção do eixo da base com o terreno. Cada árvore recebe um ID estável e intervalos de índices nas malhas derivadas.

As aberturas seguem um campo continental com bordas onduladas, variação de raio, influência da altitude e corredores sinuosos. A máscara perde força ao aproximar-se dos lados externos do piloto. A clareira que atravessa FX_19 / FX_20 passa pelo ponto continental (23.815,7; −7.500) m. A outra clareira medida ocupa 430 × 400 m dentro de FX_20. A medição delimita a região aberta numa grade de 10 m. [Medições das clareiras](sites.json)

## Renderização

Os GLBs contêm os modelos detalhados, rochas e arbustos originais, 46.311 tufos de capim com flores distribuídas em parte deles. Capim e flores compartilham geometria e material em lotes `EXT_mesh_gpu_instancing`. O visualizador conserva tronco, galhos e copas originais no LOD0. Nos LOD1/2, usa instâncias simplificadas com dimensões e cores extraídas de cada copa. Seleciona chunks de 450 m por frustum e distância. O LOD0 usa consultas conservadoras de oclusão WebGL2 contra a profundidade do terreno. O descarte por distância do sub-bosque começa a 750 m. Os lotes distantes usam malha de baixa complexidade.

| Câmera | Draw calls V12 → V01 | Triângulos desenhados V12 → V01 |
|---|---:|---:|
| Aérea | 21 → 12 | 969.908 → 172.638 |
| Fronteira | 21 → 24 | 969.908 → 152.166 |
| Hunter | 14 → 21 | 596.050 → 105.240 |
| Clareira isolada | 21 → 18 | 969.908 → 126.016 |

Capturas em Chrome headless com SwiftShader, 1.440 × 920. No enquadramento de Hunter, os buffers de geometria e instâncias alcançáveis na cena somaram 30,92 MB no original e 31,77 MB no piloto. O heap JS do visualizador carregando ambos os mundos ficou entre 95 e 175 MB nas amostras. A contagem de buffers exclui overhead do driver, caches e memória do processo. O custo de GPU em hardware dedicado requer medição separada. [Métricas por câmera](review/render.json)

## Física e reprodução

A compilação rasteriza o terreno e as malhas derivadas na grade continental WHP1 de 2 m. O catálogo individual registra o raio medido de cada tronco e o preenchimento do disco de colisão. Os 849 chunks têm hashes da forma compactada e descompactada. Os 2.175 centros de troncos retidos bloqueiam passagem. Três das 1.334 posições de árvores removidas ainda caem em células ocupadas por geometria presente no cenário. Os catálogos mantêm apenas IDs retidos. Os testes comparam os buffers de solo, rochas e arbustos por hash com os originais.

As três arestas internas têm portais validados pelo verificador da Build Real. A busca em WHP1 percorre 800 m no corredor entre FX_19 e FX_20 com raios de 0,55 m e 2 m, verificando colisão, água e inclinação. São testes geométricos com dois envelopes de agente. O comportamento da IA em sessão jogável continua pendente de teste. [Portais](portals.json) · [Navegação e colisões](navigation.json) · [Pacotes físicos](packages/compile-report.json)

Para reproduzir em um checkout com a pasta de saída `packages` livre, execute nesta pasta:

```sh
npm ci
node build.mjs
node ../compiler/cli.mjs --all --old-root . --new-root . --out packages --manifest pilot.json --node-classes ../compiler/node-classes-v01.json --tree-rules rules.json --snap-centers lattice
node colliders.mjs
node ../tools/validate-portals.mjs --physics packages --old-root . --new-root . --manifest pilot.json --out portals.json --node-classes ../compiler/node-classes-v01.json --snap-centers lattice
npm test
npm run capture
```

A captura requer Chrome instalado. As fontes V12 continuam em `assets/world/continental-272/`. A aprovação deste piloto e a ampliação para outros hexágonos são decisões separadas.