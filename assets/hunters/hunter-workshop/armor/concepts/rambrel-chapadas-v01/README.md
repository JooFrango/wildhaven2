# Sentinela da Crista Alta v01

**Criatura de origem:** Rambrél-das-Chapadas  
**ID de referência:** `rambrel_chapadas`  
**Relação taxonômica no catálogo:** subespécie gigante do Rambrél comum  
**Bioma:** savana de chapadas  
**Status:** aguardando aprovação artística  
**Versão:** v01 — conceito individual; sem GLB

## Justificativa de seleção

O catálogo técnico separa o modelo `rambrel_chapadas` do Rambrél comum e descreve uma subespécie com silhueta e escala próprias, além de chifres ampliados. O conceito já existente no PR [#60](https://github.com/carioca1111/wildhaven-new/pull/60) é explicitamente do **Rambrél comum**. A busca por PRs e branches de armadura não encontrou um conjunto dedicado a `rambrel_chapadas`; por isso esta proposta cobre somente a subespécie das chapadas, sem substituir nem renomear o conjunto comum.

## Referências reais consultadas

- Modelo de origem: [Rambrel-das-Chapadas LOD0, manifesto v05](https://github.com/carioca1111/wildhaven-new/blob/main/assets/models/creatures/rambrel_chapadas/rambrel_chapadas-lowpoly-manifest-v05.json)
- Render real três-quartos do GLB: [PNG](https://github.com/carioca1111/wildhaven/blob/wildhaven-savanna-4-creatures-lowpoly-lods-v05/assets/models/creatures/rambrel_chapadas/rambrel_chapadas-real-3d-three_quarter-lowpoly-v05.png)
- Render real frontal do GLB: [PNG](https://github.com/carioca1111/wildhaven/blob/wildhaven-savanna-4-creatures-lowpoly-lods-v05/assets/models/creatures/rambrel_chapadas/rambrel_chapadas-real-3d-front-lowpoly-v05.png)
- Render real lateral do GLB: [PNG](https://github.com/carioca1111/wildhaven/blob/wildhaven-savanna-4-creatures-lowpoly-lods-v05/assets/models/creatures/rambrel_chapadas/rambrel_chapadas-real-3d-side-lowpoly-v05.png)
- Ficha do lote de herbívoros: [README v05](https://github.com/carioca1111/wildhaven-new/blob/main/assets/models/creatures/savanna-herbivores-lowpoly-v05/README.md)
- Hunter masculino oficial de referência: [GLB, textura e manifesto](https://github.com/carioca1111/wildhaven-new/tree/main/assets/hunters/hunter-workshop/base/hunter-masculino-1000v)

### Dados técnicos de referência

O manifesto v05 do Rambrél-das-Chapadas registra LOD0 com **24.627 triângulos**, 17 juntas e 11 clipes de animação. A ficha do lote descreve corpo e altura próprios e chifres ampliados em relação ao Rambrél comum. A referência do Hunter registra corpo de 1.000 triângulos, 959 vértices exportados, 19 joints, skin glTF e clipes `Running` e `Walking`; a textura-base é 512×512.

As capturas de referência acima são renders reais dos GLBs do animal, não imagens conceituais.

## Descrição visual do conjunto

Armadura de caça robusta, mas articulada, com silhueta vertical e uma crista dorsal escura que remete à juba alta do animal. As peças usam placas facetadas de couro curtido, queratina e osso, com encaixes metálicos discretos. O conjunto mantém anatomia humana e proporções do Hunter masculino; não transforma o personagem em quadrúpede nem acrescenta cauda, cascos ou membros animais.

### Peças

- **Capacete/máscara:** máscara integral de placas sobrepostas, visor âmbar estreito e duas cristas curvas recuadas, inspiradas nos chifres longos do Rambrél-das-Chapadas. As pontas ficam alinhadas para trás para não ampliar excessivamente a largura da cabeça.
- **Peitoral e ombreiras:** couraça de couro castanho com placas ferrugem e creme; ombreiras escalonadas com franja curta de material escuro inspirada na juba cervical.
- **Manoplas:** braçadeiras e placas angulares sobre juntas flexíveis, com reforços de queratina nas bordas.
- **Cinturão:** cinto largo de couro, fivelas de bronze envelhecido e bolsas utilitárias.
- **Proteção das pernas:** tassets sobrepostas com recortes que deixam quadris e joelhos livres; joelheiras facetadas e reforçadas.
- **Grevas e botas:** grevas em camadas, botas humanas de sola firme e tiras de fixação; sem imitar patas ou cascos.

## Materiais e paleta

- **Materiais inspirados na criatura:** couro castanho, queratina escura dos chifres, fibras curtas de juba, osso polido em pequenos reforços, tecido resistente e bronze envelhecido.
- **Paleta:** marrom quente, ferrugem, ocre, creme-osso, carvão e bronze discreto.
- **Linguagem:** Monster Hunter como referência de leitura funcional e riqueza de equipamento; design original Wildhaven, low-poly facetado, com planos firmes e sem volumes de massinha.

## Raridade e atributos — propostas, não valores oficiais

- **Raridade proposta:** rara.
- **Atributos temáticos propostos:** defesa física, resistência a impacto e estabilidade em terreno irregular de chapadas.
- Nenhum número, bônus, receita, material de crafting ou efeito foi aprovado ou implementado.

## Aprovação e próximos gates

1. **Conceito:** aguardando aprovação artística do responsável.
2. **GLB:** não iniciado; depende de autorização explícita.
3. **Renders reais:** somente depois do GLB ser modelado e reimportado.
4. **UV/texturas e refinamento:** depois da revisão dos renders reais.
5. **Rig/skinning/animações:** somente após aprovação do modelo refinado.
6. **Filtro de Qualidade:** receberá os arquivos reais após os gates anteriores.

A imagem neste diretório é uma prévia PNG compacta do conceito individual. A arte-mestre em alta resolução foi apresentada nesta execução. Esta ilustração é **concept art**, não render de GLB.

## Segurança de escopo

- Nenhuma alteração em Alpha, mapas, fauna jogável ou conjuntos aprovados.
- Nenhum GLB de armadura foi criado.
- Nenhum merge automático.
- O conceito comum do Rambrél permanece intacto.
