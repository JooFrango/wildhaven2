# Wildhaven — Armadura do Serracórion v01
## Carrasco das Areias Profundas

**Espécie-base:** Serracórion (Serracorion), predador blindado do Mar de Dunas.
**Etapa:** arte conceitual individual 2D, **aguardando aprovação artística**.
**Não há armadura GLB, UVs de equipamento, skinning ou animações nesta entrega.**

### Referências existentes e motivo da escolha
- `AGENTS.md` de `wildhaven` e `wildhaven-new`; `docs/prompts/README.md`, `CONTINUIDADE.md`, `CRIATURAS.md`.
- `assets/models/creatures/serracorion/v03/README.md` e `manifest.json` do repositório `wildhaven-new`: v03 com 4.815 triângulos, 43 juntas, textura UV e 20 animações de **criatura**. Animações v03 ainda em avaliação visual.
- Histórico da criatura nos PRs `wildhaven#74` (blockout v01), `wildhaven#75` (espinhos v02), `wildhaven#76` (rig v03). A v02 corrigida tem **oito espinhos dorsais integrados**, preservados na v03.
- Anatomia documentada da criatura: cabeça em cunha e mandíbulas; duas pinças grandes nos membros anteriores; seis patas locomotoras; carapaça e placas quitinosas; cauda arqueada com lâmina terminal em foice.
- Hunter masculino oficial: `assets/hunters/hunter-workshop/base/hunter-masculino-1000v/manifest.json` (1.000 triângulos, 19 joints, textura 512 × 512). `assets/hunters/hunter-workshop/docs/PIPELINE.md`.
- Inspeção de branches e PRs de armadura do repositório feita antes deste conceito: nenhum conjunto próprio do Serracórion encontrado. Não sobrescrever qualquer arte anterior ou aprovado.

### Ficha visual
**Nome:** Carrasco das Areias Profundas.

**Silhueta:** Hunter de corpo inteiro, robusto e facetado, com peças articuladas de carapaça de dunas e volume concentrado em capacete, ombros e antebraços. Linguagem inspirada no gênero Monster Hunter, com desenho original de Wildhaven. Mantém proporções humanas e mobilidade de quadril, ombro, cotovelo e joelhos.

**Capacete/máscara:** elmo integral com viseira escura estreita e rosto em cunha, ecoando o escudo cefálico e as mandíbulas do Serracórion. Sem anatomia extra inventada.

**Peitoral e ombreiras:** placas sobrepostas, arestas facetadas bem definidas, ombreiras grandes como segmentos da carapaça; aba de tecido sobre o pescoço contra a areia; discretas saliências inspiradas na linha dorsal da criatura.

**Manoplas:** braçadeiras e punhos em placas com pontas curtas inspiradas nas pinças; as mãos continuam humanas e articuladas, sem garras gigantes que impeçam empunhar armas.

**Cinturão e proteção das pernas:** couro escuro, fivelas, bolsa de coleta, faldões/tassets segmentados e um ornamento curvo no quadril lembrando a lâmina terminal da cauda — não é uma cauda funcional nem há uma cauda humana.

**Grevas e botas:** proteções angulares de canela, tornozeleiras envolventes, botas de sola robusta para areia; joelhos livres para flexão.

**Materiais inspirados na criatura:** quitina/carapace reaproveitadas como placas, couro tratado, osso/queratina de detalhes, tecido de deserto e ferragens discretas. Todos são **propostas de materiais de armadura**, não prova de recursos/crafting já implementados.

**Paleta conceitual proposta:** vermelho-ferrugem/terracota, ocre e areia dourada, castanho profundo, cinza-chumbo nas frestas e ferragens envelhecidas. A validação das cores contra os texels oficiais da criatura ainda é pendente.

**Raridade sugerida:** épica, **não oficial**. **Atributos sugeridos, sem números nem implementação:** boa defesa física; proteção contra abrasão/areia; equilíbrio para caça de emboscada e uso de pinças em ataques de contato. Sem valores oficiais, receitas ou habilidades estabelecidas.

### Imagem do conceito
- [PNG individual compacto de prévia 128 × 192](./carrasco_das_areias_profundas_conceito_v01.png) — arte gerada por IA, **não render de um GLB real**.
- A arte-mestre **1024 × 1536** foi apresentada no chat ao diretor e preservada como entrega local; **não está publicada nesta branch**. O PNG versionado aqui é uma redução cromática/espacial fiel ao conceito individual para inspeção e controle de aprovação.
- Arte-mestre local: 1.672.959 bytes, SHA-256 `7b52f895cf99e474d6c618d63085be6e8c92885f493b22407b2905f4cb36f339`.
- PNG compacto publicado: 6.963 bytes, SHA-256 `d290baeb8383579a7483db97a708be30c568e7acdc3d45ebd63c535ba2907b8d`; Git blob esperado `cd96f8ba8f8e8598eafcf85a7c4b514f20330699`.

### Aprovação e bloqueios
- **Conceito: aguardando aprovação explícita do diretor.**
- A existência do Hunter 3D como referência **não significa aplicação técnica já testada no rig**.
- Só após autorização expressa: blockout GLB real, reimportação e renders reais para aprovação de forma; depois refinamento/UV; e finalmente rig/skinning/animações com validação pelo Filtro de Qualidade.
- Sem alterações na Alpha, sem merge automático, sem substituição de armaduras aprovadas ou outros biomas.
