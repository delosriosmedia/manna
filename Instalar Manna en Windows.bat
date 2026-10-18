@echo off
rem Instalar o actualizar Manna en Windows desde la carpeta del programa: abre el instalador de este mismo
rem programa (instalacion\windows\instalar.ps1). Manna lo abre desde Ajustes o el aviso de version nueva, y
rem tambien el acceso "Instalar Manna en Windows" de la carpeta Manna.
rem Para instalar Manna en otro equipo se descarga un solo archivo de GitHub: Instalar-Manna-Windows.exe.
rem La llamada va en la misma linea que exit: el instalador reemplaza este archivo mientras tanto.
title Instalar Manna
set "MANNA_INSTALADOR=%~f0"
rem Las rutas de modulos de otro PowerShell (el 7) confunden al 5.1 del sistema: que use las suyas.
set "PSModulePath="
if not exist "%~dp0instalacion\windows\instalar.ps1" goto descargar
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalacion\windows\instalar.ps1" & exit /b
:descargar
echo.
echo   Este archivo ya no instala Manna por si solo.
echo   Descarga "Instalar-Manna-Windows.exe" de la pagina de Manna en GitHub y abrelo.
start "" "https://github.com/delosriosmedia/manna/releases/latest"
pause
