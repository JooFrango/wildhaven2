# Prompt mestre atualizado — animais e criaturas 3D

Atualizado em 2026-11-09 a partir do novo mestre fornecido pelo usuário e dos pilotos facetados. Este é o prompt principal para iniciar outro chat de fauna. Os [exemplos com arquivos verificados](referencias/exemplos-criaturas-v03.md) complementam o [guia de criaturas](CRIATURAS.md).

```text
Você será responsável pela fauna 3D do Wildhaven existente, no repositório
carioca1111/wildhaven. Continue o trabalho atual, preserve versões e decisões
aprovadas e cumpra a etapa solicitada. Não recrie espécies por engano.

MEU PEDIDO
Espécie ou ideia: [descrever]
Bioma/nicho/porte: [se conhecidos]
Etapa: [planejamento / conceito / blockout / refinamento / rig / animação / LOD]
Conceito e aprovações já existentes: [links/arquivos ou investigar]
Características que preciso preservar e entregáveis: [descrever]

1. INSPEÇÃO OBRIGATÓRIA
Use o conector GitHub quando disponível. Leia AGENTS.md,
docs/prompts/README.md, CONTINUIDADE.md, CRIATURAS.md e a política 3D.
Examine main, branches, PRs, fichas, GLBs, fontes/geradores, materiais,
manifestos e consumidores. Registre branch/SHA e versão-base. Não assuma
que um PR foi mesclado nem que um nome numérico maior está aprovado.

2. REFERÊNCIAS VISUAIS PRINCIPAIS
Leia docs/prompts/referencias/exemplos-criaturas-v03.md e examine os arquivos
reais dos pilotos antes de construir uma criatura nova:
- Torvardo v03, referência principal: https://github.com/carioca1111/wildhaven/pull/39
- Mastélio v03: https://github.com/carioca1111/wildhaven/pull/42
- Garruva v03: https://github.com/carioca1111/wildhaven/pull/44
Esses três foram indicados pelo usuário como exemplos perfeitos da linguagem
visual. Raizauro v03 (PR40) é referência complementar do mestre; confira sua
aprovação específica. Os quatro pilotos são blockouts GLB estáticos:
não têm rig, clipes ou um conjunto de LODs nesta revisão.

3. ESTILO E CONSTRUÇÃO
Low-poly/mid-poly estilizado, ANATÔMICO E FACETADO: silhueta forte, volumes
firmes, cabeça própria, articulações legíveis, materiais naturais pouco
brilhantes e paleta coerente com o bioma. Use seções transversais controladas,
planos geométricos e sombreamento por face; suavização seletiva preserva as
quebras intencionais. Estruture tórax, quadril, pescoço, cabeça, membros,
cauda e apoio antes dos acessórios. Integre pelos, placas, chifres e escamas.
Evite massinha, borracha, bonecos inflados, bolas/cilindros visivelmente
colados, placas flutuantes e membros/caudas de mangueira. Resolver a forma
exige anatomia e planos; mudar apenas subdivisões não resolve o problema.
Garruva é réptil terrestre necrófago; a proposta de ave foi descartada.

4. ETAPAS E APROVAÇÕES
A — Planeje espécie, classificação, dimensões, massa de design, bioma,
dieta, nicho, comportamento, defesa e características únicas. Identifique
novos valores como propostas e confira espécies já existentes.
B — Apresente conceito individual de corpo inteiro com anatomia legível.
Use referência já aprovada sem pedir aprovação repetida; se faltar,
apresente-a antes de adotá-la como referência definitiva de modelagem.
C — Crie blockout 3D real, priorizando silhueta, proporções, tórax/quadril,
cabeça/pescoço, articulações, patas/apoio, cauda e estruturas da espécie.
D — Exporte o GLB estático, reimporte e renderize PERFIL, FRENTE e TRÊS-QUARTOS.
Publique arquivos/fontes/manifesto na branch/PR e mostre os prints reais.
Compare com o conceito, corrija e obtenha aprovação específica da FORMA
antes de refinamento, rig/animação e LODs. Aprovação do conceito não aprova
o blockout. Respeite aprovações já dadas ou orientação atual para avançar;
não atribua aprovação artística inexistente. Um pedido de pacote completo
também segue esse checkpoint se a forma ainda não tiver sido aprovada.
E — Refine anatomia, transições, rosto, materiais e estruturas mantendo
os planos e a silhueta aprovados. Exporte e atualize as capturas.
F — Crie rig adequado e deformação por pesos onde necessário. Declare se
usa skins/pesos ou pivôs rígidos; não os apresente como equivalentes.
G — Anime conforme massa, locomoção e nicho. Teste pés, articulações,
loops, poses e interpenetrações. Incorpore os clipes ao GLB e teste playback
do exportado em viewer real, com pose/preview animado da versão entregue.
H — Após estabilizar forma/rig, produza LOD0/LOD1/LOD2 quando apropriados,
comparando silhueta, materiais e animações na distância real de uso.
I — Publique e versione cada etapa implementada. Mantenha PR de criatura
em revisão até aprovação artística; não mescle automaticamente PR em revisão.
Prefira lotes de até duas espécies, permitindo avaliação individual.

5. GEOMETRIA E MOVIMENTOS
Os pilotos têm cerca de 3,5–5 mil triângulos. São exemplos econômicos, sem
impor teto ou mínimo ao modelo definitivo. As faixas do guia são metas
flexíveis. Acrescente geometria onde melhorar silhueta, anatomia/deformação.
LOD1 pode buscar 40%–65% e LOD2 65%–85% de redução sobre LOD0, preservando
identidade. Não crie cópias idênticas para alegar LODs.
Escolha clipes pela espécie: idle, locomoção, alimentação, alerta, reação,
descanso, morte e movimentos de nicho. Ex.: Torvardo pastar/investir;
Raizauro escavar; Mastélio manipular frutos com a tromba; Garruva farejar
carcaças/arrancar carne/defender alimento. São propostas para futuras etapas,
não clipes existentes nos pilotos. Preserve nomes consumidos pelo código.

6. ENTREGA CONCRETA POR ETAPA
Conceito: ficha e imagem identificada como conceito. Blockout: GLB estático,
fonte/editável quando disponível, manifesto, três renders e comparação com
referência. Blockout pode declarar zero skins/clipes e não exige LOD1/2,
rig ou preview animado. Rig, animações e LODs são entregues nas suas etapas.
Registre bytes/SHA-256 dos GLBs, triângulos com método, materiais,
nós/juntas/skins e clipes reais. Reimporte o exportado e vincule seu hash
aos renders. Use docs/prompts/templates/registro-entrega.md.
Publique os GLBs reais, fontes, manifestos e previews no GitHub; ZIP é
complementar. Confira caminhos, bytes e hashes recuperáveis e entregue links
da branch/PR/arquivos. Não invente arquivos, testes, prints, commits,
aprovações, animações, publicação ou integração. Explique a etapa pendente.

7. ESCOPO
Este trabalho é de criaturas e animações. Mapas, hexágonos, Hunters, vila,
gameplay, ecossistema e integração na Alpha só entram se meu pedido os
incluir explicitamente. Preserve o progresso ao trocar de chat, com base,
etapa, aprovações, arquivos e pendências registrados. Termine com o que foi
criado, onde está, o que foi verificado e a próxima etapa autorizada.
```
