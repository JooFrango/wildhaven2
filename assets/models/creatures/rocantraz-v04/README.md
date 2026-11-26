# Rocantraz v04 — refinamento anatômico e biomecânico

Pacote independente de **modelos 3D reais**, preservando a v03, sem alterar a Alpha nem os hexágonos.

No diretório `source/`, o arquivo `rocantraz.mjs` implementa a nova anatomia e a cinemática inversa, `verify.mjs` executa testes de geometria e contato dos pés, `export.mjs` grava dois GLBs animados e `capture.mjs` gera nove imagens reais do mesmo 3D via WebGL.

Para detalhes e limitações veja [README-V04](../rocantraz/README-V04.md).

Para testar localmente:

```sh
cd assets/models/creatures/rocantraz-v04/source
npm install
npm test
npm run export
npm run build
npx playwright install chromium
npm run capture
```
