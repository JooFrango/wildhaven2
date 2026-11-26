# Wildhaven — Rocantraz v04 · anatomia e biomecânica

Revisão **3D real**, exportada em GLB com 12 animações por variante e prévias capturadas no Three.js/WebGL, sem geração de imagens artificiais e sem modificar a Alpha jogável.

## Correções anatômicas implementadas

1. **Corpo e centro de massa:** caixa torácica mais profunda e ampla, glúteos, peitorais, abdômen mais integrado à malha, maior continuidade entre costas e ombros.
2. **Pernas bípedes:** espessura correta da musculatura da coxa e perna, novos tendões posteriores (`Hamstring`), bainhas de pele ao redor do joelho (`PatellarSkinSleeve`), tendão patelar e tendão de Aquiles. Essas são **malhas poligonais reais**, não texturas de simulação.
3. **Pés e tornozelos:** ponte metatársica, calcanhar reforçado, dedos e garras preservados; compensação da orientação da pata durante o passo.
4. **Braços de ataque:** tríceps e sua inserção, tecido na região do cotovelo e punho, maior continuidade entre ombro e braço.
5. **Crânio:** focinho proporcionalmente mais curto e largo, arcada zigomática e tendões da mandíbula, com músculos da mastigação e presas.
6. **Tórax:** malha intercostal auxiliar com pequena expansão respiratória durante repouso, locomoção e rugido, sem escalas de textura falsas.
7. **Armadura e cauda:** escudos permanecem parte da anatomia, com deslocamento secundário mínimo; os oito segmentos da cauda têm atraso de fase durante locomoção.

## Biomecânica de movimento

A caminhada e corrida não dependem apenas de girar o quadril. Incluí uma **solução analítica de cinemática inversa de dois segmentos**, usando o comprimento real entre quadril, joelho e tornozelo. Durante os clipes:

- A fase de **apoio** mantém a altura-alvo do tornozelo próxima do solo enquanto tronco e pelve oscilam.
- A fase de **balanço** eleva a pata, com transição contínua e ângulo do tornozelo compensado.
- O tronco se desloca lateralmente para o lado da perna de suporte.
- Pescoço, cabeça, mandíbula, braços e cauda apresentam atrasos e compensações.
- Nas animações de **mordida, defesa, rugido e ataque de garras**, os dois pés são recalculados para sustentar o deslocamento da massa do corpo.

O Rocantraz continua **estritamente bípede**: apenas duas pernas portantes, braços menores para ataque e uma cauda longa de equilíbrio. Mantém a ecologia de predador ápice muito raro e geralmente solitário. Variantes florestal e desértica preservadas.

## Arquivos resultantes

Os arquivos abaixo ficam em `assets/models/creatures/rocantraz/`:

- `rocantraz-forest-biped-animated-v04.glb`
- `rocantraz-desert-biped-animated-v04.glb`
- `rocantraz-biped-manifest-v04.json`
- `rocantraz-biped-forest-desert-real-3d-detail-v04.png`
- `rocantraz-forest-biped-real-3d-detail-v04.png`
- `rocantraz-desert-biped-real-3d-detail-v04.png`
- Capturas reais de perfil, rugido e investida, além das versões completas.

**Os doze clipes de cada GLB:** `idle`, `walk`, `stalk`, `run`, `charge`, `bite`, `swipe`, `roar`, `feed`, `defend`, `rest`, `die`.

Fonte e ferramenta de inspeção: `assets/models/creatures/rocantraz-v04/source/`.

## Limitações conhecidas

**É um refinamento de geometria, pivôs e animações reais, não uma armature com pintura de pesos.** As bainhas musculares cobrem os encontros das articulações, mas ainda não há skinning orgânico do corpo inteiro. Os clipes são `in-place`, por isso a altura do pé em apoio é compensada, mas **não há travamento horizontal físico perfeito** em terreno. A solução de IK usa um plano horizontal estático; obstáculos, inclinação e irregularidades dependem de um controlador posterior de gameplay/terrain IK.

Essas correções não devem ser confundidas com integração ao jogo: **spawn, navegação, IA de caça, colisões, física e hexágonos continuam intocados**.

A v03, assim como as versões anteriores, permanece no repositório para comparação.
