@echo off
setlocal
cd /d "%~dp0"
title Wildhaven - Build Real v01
set "WH_REPO_ROOT=%CD%"
set "WH_BIND=127.0.0.1:8787"
if not defined WH_TIME_SCALE set "WH_TIME_SCALE=20"
if not defined WH_CACHE_MB set "WH_CACHE_MB=128"
if not exist "%~dp0wh-server.exe" (
  echo ERRO: wh-server.exe ausente. Extraia o pacote completo.
  pause
  exit /b 1
)
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8787/api/v1/health' -TimeoutSec 2; if ($r.Content.Trim() -eq 'ok') {exit 0} } catch {}; exit 1"
if not errorlevel 1 (
  start "" "http://127.0.0.1:8787"
  exit /b 0
)
echo Iniciando Wildhaven. Mantenha esta janela aberta enquanto joga.
start "" /min powershell -NoProfile -Command "for ($i=0; $i -lt 60; $i++) { try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8787/api/v1/health' -TimeoutSec 2; if ($r.Content.Trim() -eq 'ok') { Start-Process 'http://127.0.0.1:8787'; exit } } catch {}; Start-Sleep -Seconds 1 }"
"%~dp0wh-server.exe"
echo Servidor encerrado. Se houve erro, veja as mensagens acima.
pause
