# Cavoru — Criatura 006 · Wildhaven

**Status:** protótipo 3D animado v0.1 publicado no GitHub e **ainda aguardando aprovação visual**.  
**Papel:** herbívoro de porte médio do bosque temperado e das planícies de Auralis, especializado em pastar, selecionar raízes e remexer superficialmente o solo.

## 1. Identidade e inspiração

O **Cavoru** ocupa um espaço que ainda não tínhamos entre os animais do Wildhaven. Ele não é um cervo reptiliano como o Silvarano nem um boi enorme como o Torvalho. É um **fossador-pastador** de corpo compacto e musculoso, lembrando vagamente a função ecológica de vombates, antas e capivaras, mas com anatomia própria.

Sua marca registrada é o **focinho espatulado**, com uma aba curta e rígida de queratina capaz de afastar folhas secas e terra fofa. Não consegue escavar túneis gigantes ou atravessar pedras: faz sulcos e buracos rasos para encontrar bulbos, raízes e água retida no solo. Uma curta escova na ponta da cauda e orelhas altas em forma de folha completam a silhueta.

## 2. Anatomia e escala

| Parâmetro | Proposta inicial |
| --- | ---: |
| Altura no ombro | 0,67–0,90 m |
| Massa adulta | 58–108 kg |
| Comprimento do corpo, sem cauda | ~1,10–1,50 m |
| Organização | Grupos familiares de 4–9 |
| Dieta | Herbívoro estrito |
| Mobilidade | Marcha, trote e arrancadas curtas |

- Corpo baixo e profundo, dorso redondo, ombros largos e pescoço curto.
- Cabeça angular com focinho sensível e lábio superior em formato de pequena pá; sem tromba comprida.
- Quatro patas grossas, dedos com unhas escavadoras curtas. **Sem chifres, cascos ou armadura**.
- Duas orelhas largas e móveis; olhos âmbar laterais, boa vigilância periférica.
- Pelo curto com alguns tufos geométricos mais longos na nuca e ao longo do dorso.
- Cauda curta com ponta em formato de escova; movimenta-se quando o animal se alarma.
- Filhotes têm membros proporcionalmente curtos, focinho menos desenvolvido e marcas da pelagem mais claras.

## 3. Aparência por bioma

**Bosques temperados:** pelagem marrom-musgo, creme no ventre e listras claras quebradas nas laterais. Tufos de pelo acompanham a silhueta do dorso e ajudam na camuflagem entre raízes e folhas secas. Costuma repousar sob arbustos.

**Planícies:** tons de ocre seco e ferrugem, flancos mais claros e listras discretas. Orelhas ligeiramente mais expostas, aspecto mais esguio e preferência por capim médio, moitas e beiras de riachos.

São **variações naturais de uma única espécie**, com indivíduos intermediários em zonas de transição. Não há transformação instantânea de aparência ao trocar de chunk; genes e envelhecimento determinam características.

## 4. Dieta e impacto ambiental

No bosque, procura brotos, raízes tenras, frutos caídos e ervas baixas. Na planície, pasta gramíneas e seleciona bulbos. A alimentação varia com estação, chuva e disponibilidade real.

Ao farejar e cavar, cria pequenas manchas de solo exposto, que podem facilitar a germinação, reter água ou permitir que outras criaturas alcancem alimentos. Também espalha sementes. Essas alterações devem ser **localizadas, lentas e reversíveis**, não um sistema de destruição ilimitada do terreno.

Ele não compete diretamente com todos os Torvalhos por cada planta: enquanto estes removem principalmente grandes volumes de capim, os Cavorus aproveitam raízes, brotos e áreas mais baixas.

## 5. Sentidos — valores iniciais de gameplay

| Sentido | Parâmetro inicial |
| --- | --- |
| Campo de visão horizontal | ~285° |
| Visão de movimento sem obstáculos | até 33 m |
| Identificação de alvo imóvel | até 13 m |
| Audição | alta, até ~40 m em ambiente favorável |
| Olfato | alto, até ~38 m conforme vento |
| Caminhada | 1,05 m/s |
| Trote | ~2,6 m/s |
| Sprint | até 7,4 m/s por cerca de 6 s |
| Salto útil | ~0,42 m |

Esses números são parâmetros para balanceamento, não capacidades exatas de um animal real. Obstáculos, iluminação, vegetação, vento, fadiga e ruídos influenciam a percepção.

## 6. Comportamento e socialização

Grupos familiares de **4–9 animais** se deslocam entre fontes de alimento e locais seguros. Um ou dois adultos podem vigiar enquanto os outros cavam ou pastam. Vigilância é uma decisão contextual: fome, filhotes, experiência individual, ruídos e distância da cobertura influenciam a distribuição do grupo.

Estados de IA propostos:

1. **Forragear:** identificar plantas e regiões de solo favoráveis.
2. **Farejar:** localizar bulbos, raízes e rastros recentes.
3. **Cavar raso:** deslocar solo fofo em ciclos, consumindo energia e deixando marcas.
4. **Pastar e mastigar:** alimentação visível.
5. **Vigiar:** levantar a cabeça e virar as orelhas em direção a estímulos.
6. **Congelar:** interromper o movimento ao ouvir ou farejar perigo.
7. **Alertar:** emitir um estalo/ronco curto de baixa frequência para animais próximos.
8. **Agrupar:** reunir os indivíduos vulneráveis, sem telepatia e sem posicionamento perfeito.
9. **Fugir:** buscar moitas, raízes e caminhos de cobertura com arrancadas em zigue-zague.
10. **Defender-se:** um adulto acuado pode empurrar com os ombros; não ataca para caçar.
11. **Descansar e cuidar dos jovens:** escolher abrigo térmico e alternar vigília.

## 7. Predação e ecossistema

O Nharuk-dos-Campos é um predador importante do Cavoru, especialmente contra jovens, animais isolados ou debilitados. Adultos saudáveis podem escapar por cobertura ou resistência de grupo, mas não são imunes. O contato do predador exige percepção real; um Nharuk não descobre a posição de todos os Cavorus da chunk.

A Boscaranha raramente é capaz de dominar um Cavoru adulto, embora filhotes pequenos possam ser alvos oportunistas. Os Folhiscos podem aproveitar áreas abertas pela alimentação do Cavoru para procurar pequenos recursos; não são uma presa nem uma ameaça direta a ele.

O Torvalho pode disputar algumas áreas de pastagem, mas utiliza outra faixa de vegetação. Os restos do Cavoru podem alimentar necrófagos após uma caçada. A espécie deve ter mortalidade, crescimento e disponibilidade de alimento suficientes para evitar crescimento populacional infinito.

## 8. Reprodução e crescimento

**Vivíparo**, normalmente 1–2 filhotes por parto, com cuidado parental e associação ao grupo durante o desenvolvimento. O tempo de gestação e a longevidade dependerão do calendário definitivo de Wildhaven, e não devem ser balanceados usando diretamente dias reais.

Filhotes dependem de adultos para acessar água e áreas seguras. A perda de uma mãe ou de um animal vigilante altera o comportamento e a chance de sobrevivência dos jovens.

## 9. Rastreio por Hunters

Pistas características incluem:
- solo fofo remexido em pequenos sulcos e buracos superficiais;
- raízes puxadas ou mastigadas;
- pegadas com quatro dedos largos;
- pelos ásperos presos em arbustos;
- estalos curtos de alerta e caminhos de acesso à água.

O Hunter poderá distinguir um grupo saudável de animais feridos e acompanhar rastros. A caça excessiva pode reduzir o revolvimento do solo e alterar discretamente a vegetação.

## 10. Direção de modelo 3D e animações futuras

O modelo deverá manter o tronco contínuo e os músculos dos ombros integrados às pernas, com transições orgânicas e sem volumes geométricos simplesmente encaixados. Focinho espatulado, orelhas móveis, quatro dedos bem legíveis e cauda em escova precisam ser modelados como geometria real.

**Clipes produzidos nos quatro GLBs (27 cada):** `idle`, `breathing`, `walk`, `trot`, `short_sprint`, `turn_left`, `turn_right`, `graze`, `sniff_ground`, `dig_shallow`, `pull_tuber`, `chew`, `drink`, `lookout`, `freeze`, `warning_call`, `regroup`, `flee_start`, `dodge`, `push_defense`, `dust_roll`, `groom`, `rest`, `sleep`, `hurt`, `death`, `juvenile_follow`.

**Os quatro GLBs reais foram exportados e publicados no GitHub**, com LOD0/LOD1, rig de 24 ossos, 27 clipes, código-fonte, visualizador e hashes verificados. Consulte [assets/models/creatures/cavoru](../../assets/models/creatures/cavoru/). O sistema de escavação de terreno/IA ainda não foi integrado.

## 11. Pendências de aprovação

A arte conceitual foi gerada na conversa; os modelos 3D de ambas as variantes e suas animações v0.1 também foram criados e publicados. O próximo passo é **aprovação visual e refinamento de skinning/IK**, antes da integração ao jogo.

[Ficha JSON](./cavoru.json).

## 12. Assets 3D animados publicados — Alpha 0.1

| Variante | Modelo detalhado | Modelo leve | Triângulos detalhado / LOD1 |
| --- | --- | --- | ---: |
| Floresta temperada | [GLB](../../assets/models/creatures/cavoru/cavoru_forest_animated_v01.glb) | [LOD1](../../assets/models/creatures/cavoru/cavoru_forest_LOD1_animated_v01.glb) | 23.610 / 10.552 |
| Planícies | [GLB](../../assets/models/creatures/cavoru/cavoru_plains_animated_v01.glb) | [LOD1](../../assets/models/creatures/cavoru/cavoru_plains_LOD1_animated_v01.glb) | 21.300 / 9.708 |

Cada GLB possui **24 articulações e 27 animações**. [Visualizador](../../assets/models/creatures/cavoru/index.html) · [Gerador Python](../../assets/models/creatures/cavoru/generate_cavoru.py) · [Manifesto SHA-256](../../assets/models/creatures/cavoru/cavoru_manifest.json). Os arquivos foram conferidos na árvore GitHub pelo SHA Git, de acordo com a regra de publicação do projeto.

**Limitações:** modelo procedimental com skinning rígido por regiões, animações in-place, sem IK, terreno deformável, colisões, IA ou integração à Alpha jogável. A aparência ainda não foi aprovada.
