@echo off
rem Lanzador para Windows: doble clic para iniciar Manna.
chcp 65001 >nul
title Manna - Church projection app
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto falta_node
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)"
if errorlevel 1 goto falta_node

node server\index.js
echo.
echo Manna se detuvo.
pause
exit /b 0

:falta_node
echo.
echo ==========================================================
echo   NO SE PUEDE INICIAR MANNA
echo ==========================================================
echo   Falta Node.js 18 o superior (el programa que hace
echo   funcionar el servidor).
echo   Descargalo aqui: https://nodejs.org/es/download
echo.
echo   Se abrio una pagina con las instrucciones paso a paso.
echo   Cuando termines de instalar, vuelve a abrir este archivo.
echo ==========================================================
start "" "instalar.html"
pause
exit /b 1
