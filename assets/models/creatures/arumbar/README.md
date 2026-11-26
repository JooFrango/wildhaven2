# Arumbar v0.1 — herbívoro raro e solitário das savanas

**Status:** modelo 3D real e oito animações, pacote independente da versão jogável. Não integrar sem aprovação específica.

O Arumbar foi aprovado como **bisão blindado colossal**, com grandes chifres laterais arqueados, corcova poderosa, placas córneas de proteção, pelagem/espinhos nas crinas, quatro patas espessas, cascos fendidos e cauda com tufo. A anatomia e cores seguem a arte conceitual aprovada nesta conversa.

## Habitat e ecologia

- **Habitat exclusivo:** savanas de Auralis. Não atribuir florestas, desertos, montanhas ou outros biomas.
- **Raridade:** população baixa, avistamentos incomuns. Proposta ajustável: hexágonos adequados com ocupação de 15–25% e, quando ocupados, no máximo 1–2 adultos por hexágono de referência de 5 km; não é uma taxa implementada.
- **Comportamento social:** majoritariamente solitário; adultos reunidos apenas por reprodução, proteção temporária de filhotes ou em áreas de alimento concentrado. **Sem manadas grandes e comuns.**
- **Alimentação:** gramíneas, arbustos e folhas baixas. Prioriza pastagens abertas e água sazonal.
- **Risco:** evita confronto quando possível; pode levantar a cabeça e investir contra predadores que se aproximam demais.
- **Consequência ecológica:** consumo de biomassa vegetal, abertura de trilhas, dispersão de sementes e alimentação de grandes predadores/necrófagos após morte.

### Escala de design
Comprimento adulto alvo **5,2 m**, altura aos ombros **2,8 m**, massa típica **3,5 toneladas**. Os valores servem como direção artística/biomecânica e podem precisar de ajuste após testes lado a lado com Hunters e outros animais; não são dados de uma espécie real.

## Arquivos e animações

- **Modelo final deste marco:** `arumbar-savanna-animated-v01.glb` — malhas de polígonos 3D e rig hierárquico verdadeiro em glTF 2.0.
- **Oito clipes embutidos:** `idle`, `walk`, `run`, `graze`, `drink`, `alert`, `charge`, `death`.
- **Prévias reais:** `arumbar-real-3d-three-quarter-v01.png`, `arumbar-real-3d-side-v01.png`, `arumbar-real-3d-front-v01.png`, `arumbar-real-3d-grazing-v01.png`, `arumbar-real-3d-running-v01.png`. Todos são screenshots renderizados pelo Three.js/WebGL usando a mesma geometria.
- **Manifesto:** `arumbar-manifest-v01.json` inclui clipes, articulações, geometria e SHA-256.
- **Código-fonte:** `source/arumbar.mjs`, `source/export.mjs`, `source/verify.mjs`, `source/viewer.mjs`, `source/capture.mjs`.

### Testes de oficina
Na pasta `source/`:

```sh
npm install
npm test
npm run build
npm run export
npx playwright install chromium
node capture.mjs
```

O arquivo `index.html` é um estúdio para visualizar as oito animações; o terreno de savana apresentado é apenas um cenário auxiliar de validação, **não** um hexágono existente da composição do mundo.

### Limitações da versão v0.1

O rig usa pivôs `THREE.Group` e transformações GLB — **não há skinning por pesos, IK, colisão, comportamento de manadas, navegação, IA nem spawn integrado**. O movimento é *in-place*. A anatomia foi construída proceduralmente com geometria mid-poly genuína; a estética deve ser julgada pelas capturas reais e ainda pode receber refinamentos para se aproximar ainda mais da arte conceitual. A Alpha jogável e os hexágonos oficiais permanecem intocados.
