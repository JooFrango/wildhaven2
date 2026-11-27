@echo off
setlocal
chcp 65001 >nul
set "WH_REPO_ROOT=%~1"
if not defined WH_REPO_ROOT set "WH_REPO_ROOT=%~dp0..\Wildhaven-Windows-portatil-v04"
if not exist "%WH_REPO_ROOT%\wh-server.exe" (
  echo Arraste a pasta do Wildhaven V04 extraido sobre este arquivo.
  pause
  exit /b 1
)
if not exist "%~dp0dist\index.html" (
  echo Extraia o ZIP experimental completo em uma pasta separada.
  pause
  exit /b 1
)
set "WH_CLIENT_DIST=%~dp0dist"
set "WH_BIND=127.0.0.1:18879"
set "WH_CACHE_MB=128"
set "DATABASE_URL="
set "WH_WORLD_ID=auditoria-local"
echo Abra http://127.0.0.1:18879 no navegador. Shift+F8 alterna o segundo plano.
pushd "%WH_REPO_ROOT%" || exit /b 1
wh-server.exe
popd
pause
