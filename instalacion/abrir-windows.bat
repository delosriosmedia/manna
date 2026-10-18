@echo off
rem Abre Manna sin ventana. Lo usa el icono "Manna" del Escritorio y del menu Inicio.
rem Si Manna ya esta abierto, el propio programa lo detecta y solo vuelve a mostrar el control.
rem Con el Node.js de Manna (Programa\node, desde la 1.35) o, en una instalacion anterior, el del equipo.
cd /d "%~dp0.."
set "MANNA_NODE=%~dp0..\..\node\node.exe"
if exist "%MANNA_NODE%" goto abrir
set "MANNA_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  start "" "instalacion\requisitos.html"
  exit /b 1
)
:abrir
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath $env:MANNA_NODE -ArgumentList 'server/index.js','--segundo-plano' -WindowStyle Hidden"
