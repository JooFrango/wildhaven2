# Arumbar v03 — Anatomia orgânica e animações de massa

**Status:** arquivo 3D e animações da revisão v03 em produção, **sem integrar a versão jogável**.

O Arumbar mantém sua identidade aprovada: **bisão blindado colossal**, cor de cobre/terra, chifres curvos, carapaça de placas sobrepostas, crina volumosa e quatro cascos fendidos. Vive **exclusivamente nas savanas**, é **raro**, tem **população pequena** e é **majoritariamente solitário**.

## Sete melhorias aplicadas ao código 3D

1. **Corpo:** nova malha 3D contínua com peito profundo, ombros altos, corcova integrada e garupa menor e mais baixa. Não é apenas subdividir os icosaedros da v02.
2. **Cabeça:** crânio bovino alargado e encurtado, focinho achatado, narinas profundas, maçãs do rosto, pálpebras, mandíbula contínua e chifres curvos com gradiente de material real.
3. **Armadura:** placas abauladas ajustadas sobre a superfície do tronco por uma função de perfil, inseridas na pele, reduzidas rumo à garupa e sem fileira lateral suspensa.
4. **Patas:** novos volumes orgânicos de ombro, coxa, jarrete/joelho, canela, tornozelo e casco fendido de queratina; membros dianteiros mais espessos.
5. **Crina:** mechas tridimensionais grossas sobrepostas e agrupadas em camadas, sem agulhas pontiagudas nem sprites.
6. **Materiais:** pigmentação gradual real nos vértices da pele, variações da cor ocre/castanha e base de chifre escura para ponta clara.
7. **Movimentação:** quatro tempos no passo, apoio diagonal na corrida, deslocamento do tronco e atraso inercial entre pescoço/cabeça e patas; pastagem, bebida, alerta, investida e morte preservados e ajustados.

### Arquivos reais de 3D

- `arumbar-savanna-anatomy-animated-v03.glb`: arquivo glTF binário com malhas poligonais de verdade e **oito animações incorporadas**: `idle, walk, run, graze, drink, alert, charge, death`.
- `arumbar-real-3d-three-quarter-v03.png`, `arumbar-real-3d-side-v03.png`, `arumbar-real-3d-front-v03.png`, `arumbar-real-3d-grazing-v03.png`, `arumbar-real-3d-running-v03.png`: capturas **reais em WebGL** das mesmas malhas e poses que compõem o GLB.
- `arumbar-manifest-v03.json`: contagem auditável de triângulos, joints, malhas, SHA-256 e animações.
- `source/arumbar-anatomy-v03.mjs`: nova escultura procedural reproduzível.
- `source/verify-v03.mjs` e `source/export-v03.mjs`: testes e exportador.
- `source/index-v03.html`: visualizador de animações do asset (oficina independente).

A versão `v02` continua disponível como referência histórica; `v01` também permanece intacta. Nenhum arquivo de `game/alpha01` ou `world` é alterado.

### Limitações ainda conhecidas

As animações são **trilhas transformadas em articulações hierárquicas GLB**, não uma armature `SkinnedMesh` com deformação de pele por pesos. Isso limita a suavidade de juntas próximas ao ombro e ao quadril, apesar de haver massas orgânicas modeladas ao redor. Deslocamento pelo mundo, colisões, IK de cascos, física e IA ecológica só poderão ser implementados numa etapa separada após aprovação visual.

O orçamento de triângulos será confirmado no manifesto e avaliado contra desempenho no navegador. A versão visualmente mais complexa não deve ser aplicada indiscriminadamente a todos os animais de um hexágono.
