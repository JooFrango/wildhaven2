# Fulgaronte v04 — diagnóstico da v03, correções e diferenças que persistem

Este relatório separa três coisas: o que foi medido, o que foi corrigido e o que
continua divergente. Não há percentuais de semelhança: semelhança não foi medida,
foi avaliada por comparação visual direta entre a arte conceitual e os renders do
GLB real, ângulo por ângulo e região por região.

## 1. Como as proporções foram obtidas

A arte conceitual é um desenho de perfil com leve perspectiva. Em vez de estimar
proporções a olho, a silhueta do desenho foi medida: `source/concept_profile.py`
ajusta um fundo quadrático robusto ao papel, isola a criatura e lê, coluna a coluna,
o topo e a base da silhueta. As leituras foram conferidas contra pontos de referência
lidos na própria imagem (ponta do focinho, topo do crânio, linha do dorso no ombro,
ápice da vela dominante, linha do ventre, chão).

Tomando a linha do dorso no ombro como unidade, o conceito dá:

| Medida | Proporção no conceito | Valor adotado na v04 |
| --- | ---: | ---: |
| Comprimento total (bounding box) | 3,2 × a altura do dorso | 16,02 m |
| Altura do dorso no ombro | 1,00 | 4,96 m |
| Ápice da vela dorsal dominante | 1,36 | 6,65 m |
| Topo do crânio | 0,92 | 4,60 m |
| Ponta do focinho | 0,78 | 3,88 m |
| Linha do ventre | 0,31 | 1,55 m |
| Comprimento da cabeça | 0,51 | 2,54 m |

Essas proporções são internamente consistentes com a faixa pedida: com 16 m de
comprimento, o conceito dá cerca de 5 m de altura **de corpo**, e as velas passam
disso. Por isso o manifesto registra 4,96 m (corpo) e 6,65 m (máximo com vela) como
duas grandezas separadas.

## 2. Diagnóstico da v03 (GLB real fornecido pelo diretor)

GLB diagnosticado: `Fulgaronte_v03.glb`, 650.448 bytes, 4.600 triângulos, 1 malha,
1 textura, 16,93 m × 6,88 m × 5,39 m. Renderizado em perfil, frente e três-quartos
com a mesma câmera, escala ortográfica e iluminação usadas na v04
(`previews/comparacao/fulgaronte_v03_real_glb_*.png`).

| Região | Defeito na v03 | Gravidade | Correção aplicada na v04 |
| --- | --- | --- | --- |
| Postura geral | Corpo tubular rente ao chão, membros curtos, nenhuma massa de ombro | Grave | Tronco com seções de altura 3,4 m, ombro alto, ventre a 1,55 m e membros longos |
| Cabeça — altura | Cabeça baixa, focinho mergulhando para o chão | Grave | Cabeça erguida: focinho a 3,88 m, topo do crânio a 4,60 m, como no conceito |
| Cabeça — massa | Crânio fino, sem testa óssea, sem volume de bochecha | Grave | Crânio em cunha com plataforma supraorbital, escudos de bochecha e de mandíbula, massa de garganta ligando a articulação ao pescoço |
| Mandíbula | Boca aberta tipo boneco, lábio reto, dentes isolados | Grave | Mandíbula com dobradiça real, abertura crescente até 0,82 m na ponta, palato e assoalho bucal fechando a cavidade |
| Dentes | Fileira uniforme de triângulos chatos, alguns sem raiz aparente | Grave | 22 dentes com base afundada dentro do osso, alternando tamanho, nenhum flutuante |
| Pescoço e tórax | Transição inexistente: tubo contínuo da cabeça ao quadril | Grave | Loft único cabeça–pescoço–tórax–quadril–cauda com alargamento progressivo; peito mais largo com 4,0 m |
| Patas dianteiras | Cilindros finos com dedos minúsculos | Grave | Membro contínuo em cinco seções (1,05 m no ombro até 0,50 m no punho), pé largo, quatro dedos e garras plantadas no chão |
| Patas traseiras e quadril | Mesma falha das dianteiras | Grave | Coxa de 1,15 m de raio, joelho e tornozelo legíveis, apoio real no solo |
| Nadadeiras dos braços | Plaquinhas pequenas presas ao ombro, não ao braço | Grave | Membrana grande no antebraço, contorno curvo e varão de sustentação na borda de ataque |
| Velas dorsais | Triângulos planos isolados, todos do mesmo tamanho, parecendo placas flutuantes | Grave | Três velas com volume real, perfil assimétrico (borda de ataque íngreme, bordo de fuga varrido), diminuindo para trás, cada uma sobre um contraforte ósseo que se integra ao dorso |
| Crista da cauda | Série de triângulos iguais | Média | Escudos serrilhados inclinados para trás, decrescendo ao longo da cauda |
| Couraça | Textura manchada sobre superfície lisa; nenhuma placa real | Média | Padrão de placas sobrepostas com costuras deformadas por ruído, pintado no atlas UV |
| Cauda | Cone reto e fino terminando em ponta triangular, "lança" | Grave | Cauda grossa na base (1,36 m de raio), descendo e com gancho para a frente junto ao solo |
| Nadadeira caudal | Ponta triangular pequena | Grave | Lâmina caudal larga de 1,4 m de altura, com lobo inferior e três varões internos |
| Textura | Manchas brancas e laranja de alto contraste, sem estrutura de valor | Grave | Gradiente ventre claro → flanco → dorso cinza-rocha, manchas ocre misturadas e não carimbadas, membranas arroxeadas, costuras de placa |

## 3. Método de verificação usado

1. GLB da v03 importado do disco e renderizado em três ângulos.
2. Comparação direta com o conceito; tabela de defeitos acima.
3. Reconstrução completa da malha a partir das proporções medidas.
4. Exportação do GLB, **reimportação do arquivo exportado** e renderização dos
   mesmos três ângulos com câmera, escala ortográfica (19 m) e iluminação idênticas.
5. Sobreposição de silhuetas v03 × v04 no painel inferior direito de
   `previews/comparacao/comparativo_conceito_v03_v04.png`: vermelho é v03, azul é v04,
   preto é a interseção.
6. Dez ciclos de correção e reavaliação antes desta entrega. Três estruturas foram
   **removidas** depois de reprovadas no próprio ciclo, por reproduzirem o defeito de
   colagem: a fileira densa de escudos dorsais, as placas de flanco chapadas e a
   fileira de escudos sobre a linha do dorso.

Uma malha tecnicamente válida pode continuar artisticamente ruim. A exportação passar
na validação não é argumento de qualidade, e nada aqui foi marcado como aprovado.

## 4. Diferenças que persistem em relação ao conceito

Avaliadas região por região, nos três renders reais da v04.

| Região | Diferença que persiste | Impacto |
| --- | --- | --- |
| Velas dorsais | As membranas são superfícies retas e facetadas. No conceito elas são curvas, com nervuras de sustentação visíveis atravessando a membrana | Alto |
| Nadadeiras dos braços | Existem e têm o contorno certo, mas ficam encobertas pela pata dianteira na vista de perfil. No conceito elas são um elemento dominante da silhueta lateral | Alto |
| Arco do dorso | A linha do dorso da v04 é mais reta. No conceito há um arco claro subindo do quadril ao ombro | Médio |
| Cauda | Mais curta e menos sinuosa que no conceito, que mostra uma cauda longa varrendo para o lado antes de voltar à frente. O limite de 14–16 m de bounding box foi respeitado, o que custou comprimento de cauda | Médio |
| Mandíbula inferior | Ainda lê como uma peça de espessura constante; falta o volume muscular posterior do estudo de cabeça | Médio |
| Couraça | Sem geometria própria: só padrão no atlas UV. Na silhueta, o contorno do dorso é liso onde o conceito mostra placas destacadas | Médio |
| Nadadeira caudal | Lâmina única de contorno simples. No conceito é uma nadadeira orgânica de dois lobos com borda recortada | Médio |
| Chifres cranianos | Quatro por lado, retos. O estudo de cabeça mostra uma coroa mais densa e recurvada | Baixo |
| Textura | O mosqueado ocre é mais fraco e mais fino que o do conceito, que tem manchas douradas maiores e mais contrastadas sobre cinza escuro | Baixo |
| Altura máxima | 6,65 m com a vela dominante. É o que as proporções do conceito exigem para 16 m de comprimento, mas está acima do número de 5 m citado no briefing se esse número for lido como altura absoluta | A decidir pelo diretor |

Nenhuma dessas diferenças foi escondida com iluminação, enquadramento ou
pós-processamento: os três renders usam a mesma câmera ortográfica e o mesmo conjunto
de três luzes fixas, sem pós-processamento, e o fundo é chapado.

## 5. Etapa pendente

Aprovação específica da **forma** pelo diretor. Só depois disso: refinamento
(curvatura das membranas, volume da mandíbula, couraça com geometria integrada),
e então rig, skinning, animações, eletricidade e LODs. Nada disso foi feito nem
pode ser inferido desta entrega.
