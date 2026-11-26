# Visualizador — Hunter Workshop (cabelos v01)

Um único avatar com 19 ossos, carregado do GLB original. Clique **Nenhum / Curto / Moicano**; os GLBs de cabelo são objetos rígidos anexados ao osso `Head` e reutilizados em cache. O seletor de animações reproduz somente `Walking` ou `Running` do Hunter, sem rig duplicado.

Rode `python -m http.server 8000` na raiz do repositório e abra `http://localhost:8000/assets/hunters/hunter-workshop/viewer/`. O navegador precisará carregar Three.js do CDN.

Até que o binário original do Hunter seja publicado no GitHub, selecione manualmente `hunter_masculino_1000v.glb` no campo de arquivo para testar no navegador. Os dois arquivos de cabelo são gerados e publicados pelo workflow `.github/workflows/wildhaven-hunter-hairs-v01.yml`.

Sem integração à Alpha e sem aprovação artística implícita.
