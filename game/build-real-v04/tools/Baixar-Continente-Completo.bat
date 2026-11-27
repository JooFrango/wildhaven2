@echo off
setlocal
cd /d "%~dp0"
title Wildhaven - baixando o continente completo (V04)
echo Este inicializador baixa TODOS os 266 hexes certificados do continente (~4,4 GB) para jogar offline depois.
echo Cada pacote e conferido (tamanho + SHA-256) antes de ser extraido. O jogo abre normalmente enquanto baixa.
echo Pode fechar e abrir de novo: os hexes ja baixados ficam no cache (.generated).
set "WH_BAIXAR_TUDO=1"
call "%~dp0Iniciar-Wildhaven.bat"
