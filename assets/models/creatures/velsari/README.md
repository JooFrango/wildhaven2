# Velsari — Corredor Dourado | Wildhaven

**Status:** modelo poligonal 3D original com rig articulado e dez animações, isolado da Alpha jogável.

Pequeno herbívoro fantasioso de **savana aberta**. Corpo leve de aparência antílope-lebre, pernas posteriores longas, duas hastes curtas recurvadas, grandes orelhas, pelagem dourada com marcas creme, cascos fendidos e cauda com tufo claro.

- **Escala proposta:** ~1,0 m de comprimento, ~0,65 m nos ombros, ~22 kg.
- **Social:** grupos pequenos, tipicamente 4–10 indivíduos. Vigilância e fuga em saltos.
- **Dieta:** gramíneas e brotos; ajuda a controlar pastagens.
- **Frequência:** relativamente comum, fornece alimento para predadores pequenos/médios.
- **Bioma:** somente savana (sem modelos de spawn implementados).
- **Inspiração visual:** a arte conceitual aprovada no projeto.

## Artefatos

- `velsari-savanna-animated-v01.glb`: geometria real + articulações e 10 clipes GLB.
- `velsari-real-3d-three-quarter-v01.png`: screenshot real WebGL da geometria.
- `velsari-real-3d-side-v01.png`: screenshot real de perfil.
- `velsari-real-3d-running-v01.png`: quadro renderizado do clipe de corrida.
- Source: `../savanna-small-herbivores/source/fauna.mjs`.

**Dez animações:** `idle`, `walk`, `run`, `leap`, `graze`, `alert`, `call`, `flee`, `rest`, `death`.

As animações possuem trilhas verdadeiras de transformações dos pivôs; não são somente poses estáticas e não utilizam imagem gerada por IA como prévia. Ainda não há rig de deformação com pesos, IK ou IA de navegação.
