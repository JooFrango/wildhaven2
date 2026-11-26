# Wildhaven — código-fonte legado de fauna Three.js (isolado da Alpha)

Esta pasta guarda os geradores/protótipos originais de **Rocantraz** (floresta/montanha e deserto) e de três detritívoros (**Cascarrumo, Dunébrio e Nivélio**) que foram escritos inicialmente no repositório histórico `carioca1111/chat-`.

Os modelos foram migrados para o **repositório canônico `carioca1111/wildhaven`**, sem modificar `game/alpha01`. Fontes TypeScript preservam seus imports relativos para que possam ser executadas como uma oficina independente.

## Como usar
```sh
npm install
npm run build
npm run export:rocantraz
npm run export:detritivores
npx vite --host 127.0.0.1
```

Abra `/rocantraz.html` ou `/creatures.html`. O export grava `dist-creatures/*.glb`. A versão publicada desses arquivos fica em `../rocantraz/` e `../detritivoros/`, respectivamente.

A exportação de Rocantraz reconstitui suas duas variantes com **12 animações** por GLB. Os três detritívoros foram inicialmente fornecidos como malhas Three.js animadas em tempo real; esta migração também os empacota como arquivos GLB independentes com **7 animações** cada, preservando a anatomia/rig de origem.

A animação é feita por transformações de pivôs `THREE.Group` (não por skinning com pesos por vértice). As visualizações e os modelos são protótipos mid-poly; a aprovação estética continua pendente.

**Não adicionar imports destes arquivos ao jogo sem aprovação explícita.**
