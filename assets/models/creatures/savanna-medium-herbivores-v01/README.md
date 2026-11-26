# Wildhaven — herbívoros de savana v01 (modelos 3D reais)

## Quatro assets (não integrados à Alpha)

| Asset | Nicho | GLB canônico | Clipes |
| --- | --- | --- | --- |
| Talvero | Corredor das campinas; pastador gregário | assets/models/creatures/talvero/talvero-savanna-animated-v01.glb | 10 |
| Rambrél | Herbívoro navegador de acácias; forma comum | assets/models/creatures/rambrel/rambrel-savanna-animated-v01.glb | 11 |
| Rambrél-das-Chapadas | Subespécie gigante, alcança copas altas | assets/models/creatures/rambrel_chapadas/rambrel_chapadas-savanna-animated-v01.glb | 11 |
| Turvagal | Herbívoro ribeirinho robusto | assets/models/creatures/turvagal/turvagal-savanna-animated-v01.glb | 11 |

Modelos e versões **v01 em revisão artística**: nenhum modelo foi declarado definitivo ou integrado ao jogo. Os dois Rambréis estão separados para permitir o ajuste de proporções e animações do gigante. O catálogo os relaciona por subspeciesOf.

## Ficheiros reais

Cada pasta canônica contém:
- Um GLB binário glTF 2.0, com malhas trianguladas genuínas, materiais PBR e 10–11 clipes de animação exportados.
- Três screenshots renderizados a partir da geometria real com VTK (frente, perfil, três-quartos). Não são desenhos IA.
- Um manifesto JSON com tamanho, SHA256, número de triângulos, clipes e nós.

Fonte: source/generate.py; teste da exportação: source/validate.py. Esses scripts não modificam world/ ou game/alpha01/.

## Testar animações num navegador

Na raiz do repositório:

    python3 -m http.server 8000

Abrir http://localhost:8000/assets/models/creatures/savanna-medium-herbivores-v01/viewer/

O visualizador em Three.js permite selecionar o animal, selecionar qualquer clipe de animação, pausar, rotacionar e aproximar, lendo **diretamente os GLBs**. É necessária internet para o carregamento inicial dos módulos Three.js via CDN.

## Reproduzir exportação e renders reais

Requer Python 3.12, numpy 2.2.x, vtk 9.4.x e (em Linux) Xvfb:

    python3 -m pip install numpy==2.2.6 vtk==9.4.2
    xvfb-run -a python3 assets/models/creatures/savanna-medium-herbivores-v01/source/generate.py --render
    python3 assets/models/creatures/savanna-medium-herbivores-v01/source/validate.py

O workflow wildhaven-four-savanna-herbivores-assets.yml executa essas etapas e publica os binários e imagens no mesmo branch.

## Limitações técnicas explícitas

- Os rigs **não têm pesos de skin nem deformação muscular contínua**: usam juntas hierárquicas animadas exportadas como clipes reais glTF.
- Movimentos são **in-place**, sem navegação, contato de pés com terreno irregular, colisão, IK de terreno ou IA.
- São modelos mid/low-poly funcionais de primeira revisão; refinar anatomicamente especialmente pescoço, ombros, articulações e transições orgânicas será necessário para igualar a fidelidade das artes conceituais.
- As alturas/pesos nas fichas são alvos de design, não medições físicas verificadas contra uma escala canônica do mundo.
- A cadeia alimentar, spawns, ecossistema e Hunters não foram modificados aqui.
