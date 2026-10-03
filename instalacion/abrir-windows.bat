@echo off
rem Abre Manna sin ventana. Lo usa el icono "Manna" del Escritorio y del menu Inicio.
rem Si Manna ya esta abierto, el propio programa lo detecta y solo vuelve a mostrar el control.
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  start "" "instalacion\requisitos.html"
  exit /b 1
)

powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath node -ArgumentList 'server/index.js','--segundo-plano' -WindowStyle Hidden"
