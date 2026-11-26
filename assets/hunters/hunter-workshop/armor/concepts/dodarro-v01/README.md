# Vigia do Leque Rubro — Dodarro v01

**Wildhaven · Hunter Workshop · conceito 2D individual**

- **Criatura-base:** Dodarro (`dodarro`)
- **Bioma:** savana / planícies
- **Conjunto:** Vigia do Leque Rubro
- **Etapa:** conceito artístico 2D
- **Estado:** aguardando aprovação artística do responsável
- **Modelagem de armadura:** não iniciada

## Referências consultadas

- [AGENTS.md](../../../../../../AGENTS.md)
- [Pipeline Hunter Workshop](../../../docs/PIPELINE.md)
- [Hunter masculino oficial — manifesto](../../../base/hunter-masculino-1000v/manifest.json)
- [Dodarro — documentação técnica v02](../../../../../models/creatures/dodarro/README.md)
- [Dodarro selvagem v02 — manifesto](../../../../models/creatures/dodarro/manifest_selvagem_v02.json)
- [Dodarro montaria v02 — manifesto](../../../../models/creatures/dodarro/manifest_montaria_v02.json)
- [Dodarro selvagem v02 — GLB real](../../../../models/creatures/dodarro/dodarro_selvagem_v02_blockout.glb)
- [Dodarro montaria v02 — GLB real](../../../../models/creatures/dodarro/dodarro_montaria_v02_blockout.glb)
- [Dodarro v02 — PR de criaturas no repositório antigo](https://github.com/carioca1111/wildhaven/pull/64)
- [Dodarro v01 — PR histórico](https://github.com/carioca1111/wildhaven/pull/62)

A referência de anatomia foi conferida no GLB selvagem v02: corpo bípede, pescoço em S, bico curvo e descendente, crista ferrugem, asas em camadas, cauda em leque, coxas fortes e pernas escuras com dedos separados. A espécie é descrita como oportunista, consumindo frutos e carniça. O GLB v02 é um blockout estático de 3.955 triângulos; o manifesto ainda marca a forma do modelo como aguardando aprovação. Portanto, este conceito de armadura acompanha a referência atual e poderá ser ajustado se a silhueta da criatura mudar.

## Direção visual

Armadura original do Wildhaven, com convenções de fantasia de caça e leitura de equipamento robusto, sem copiar conjuntos existentes. A silhueta humana do Hunter masculino é preservada. O leque de penas é uma referência de construção e paleta, não um par de asas funcionais.

### Capacete / máscara

Máscara integral de perfil afilado, com frente em queratina escura curvada para baixo, lembrando o bico do Dodarro sem transformar o Hunter em uma cabeça de ave literal. Visor âmbar estreito, placas frontais marfim e crista facetada ferrugem inclinada para trás. Sem chifres inventados.

### Peitoral e ombreiras

Peitoral em placas sobrepostas marfim e creme, com quilha central ferrugem e subcamada de couro castanho. Ombreiras compactas com lâminas de penas em azul-ardósia, cinza e pontas ferrugem; a forma acompanha o ombro humano e não cria asas.

### Manoplas

Manoplas de couro escuro com placas angulares de queratina/carapaça, reforços nos nós dos dedos e pequenas lâminas de pena junto ao antebraço. Proteção segmentada para permitir flexão do punho.

### Cinturão e proteção das pernas

Cinturão largo de couro com fivela de bronze envelhecido, bolsas de caça e pequenos pingentes de pena. Um saiote curto em leque, feito de lâminas de pena sobrepostas em ferrugem, creme e ardósia, protege quadril e coxas sem ocultar a articulação.

### Grevas e botas

Grevas grafite inspiradas nas escamas escuras das pernas do Dodarro, presas por tiras de couro. Botas continuam claramente humanas, com biqueira segmentada e reforços angulares; não reproduzem patas nem pés de ave.

## Materiais inspirados na criatura

- Penas rígidas e placas lamelares para ombreiras, gola e saiote.
- Couro castanho para correias, cinturão, luvas e bolsas.
- Queratina escura para máscara, antebraços e grevas.
- Osso/queratina clara nas placas marfim do peitoral.
- Bronze envelhecido apenas em fivelas, rebites e fechos.

## Paleta

Derivada do atlas UV do Dodarro v02: castanho quente, castanho escuro, creme de peito, ferrugem, laranja queimado, azul-ardósia, grafite e bronze. As cores exatas são registradas em `manifest.json`.

## Raridade e atributos — somente propostas

- **Raridade:** ainda a definir; nenhuma raridade oficial atribuída.
- **Papel proposto:** conjunto equilibrado, com mobilidade média-alta e proteção média.
- **Utilidade proposta:** exploração, rastreio e recuperação de recursos; não representa bônus implementados no jogo.

## Arte conceitual

- `vigia_leque_rubro_conceito_v01.png` — prévia PNG compacta publicada (128 × 192).
- A arte-mestre 1024 × 1536 foi apresentada nesta conversa; não está incluída nesta branch.
- A imagem é **ilustração conceitual gerada por IA**, não render de GLB.

## Base Hunter e limites técnicos

O Hunter masculino de referência é um GLB real com 1.000 triângulos, 959 vértices exportados, textura 512 × 512 e 19 juntas. A arte mantém proporções humanas, mas o encaixe no rig, ocultação de partes do corpo, pesos, colisões e deformações ainda não foram testados.

## Gates de aprovação

1. **Conceito artístico:** aguardando aprovação do responsável.
2. **GLB da armadura:** não iniciado; bloqueado até autorização explícita.
3. **Renders reais do GLB:** não existem nesta etapa.
4. **UVs, texturas e refinamento:** não iniciados.
5. **Rig, skinning e animações:** não iniciados.
6. **Filtro de Qualidade:** não encaminhado.

Não modificar Alpha, não substituir conceitos existentes, não fazer merge automático.