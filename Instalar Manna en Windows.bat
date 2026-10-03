@echo off
rem Preparacion unica de Manna en Windows: comprueba los requisitos y crea el icono "Manna"
rem en el Escritorio y en el menu Inicio. Despues, Manna se abre siempre desde ese icono.
chcp 65001 >nul
title Instalar Manna
cd /d "%~dp0"

echo.
echo  ==========================================================
echo    Manna - Church projection app
echo    Preparando este equipo...
echo  ==========================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto falta_node
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)"
if errorlevel 1 goto falta_node
echo   [OK] Node.js esta instalado.

rem La ruta de Manna viaja en una variable para que no importen los espacios ni las tildes.
set "MANNA_DIR=%CD%"
powershell -NoProfile -Command "$w = New-Object -ComObject WScript.Shell; foreach ($d in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) { $s = $w.CreateShortcut((Join-Path $d 'Manna.lnk')); $s.TargetPath = (Join-Path $env:MANNA_DIR 'instalacion\abrir-windows.bat'); $s.WorkingDirectory = $env:MANNA_DIR; $s.IconLocation = (Join-Path $env:MANNA_DIR 'instalacion\icono\manna.ico'); $s.WindowStyle = 7; $s.Description = 'Manna - Church projection app'; $s.Save() }"
if errorlevel 1 goto fallo_icono
echo   [OK] Icono "Manna" creado en el Escritorio y en el menu Inicio.

echo.
echo   Abriendo Manna...
call "instalacion\abrir-windows.bat"

echo.
echo  ==========================================================
echo    LISTO. Desde ahora, abre Manna con el icono "Manna"
echo    del Escritorio. Esta ventana ya no hace falta.
echo.
echo    - Si Windows pregunta por el Firewall, elige
echo      "Permitir acceso" en redes privadas. Sin eso, los
echo      celulares no podran conectarse.
echo    - Para apagar Manna usa el boton "Apagar" del control.
echo    - Si mueves la carpeta de Manna a otro sitio, vuelve a
echo      ejecutar este archivo.
echo  ==========================================================
echo.
pause
exit /b 0

:falta_node
echo.
echo  ==========================================================
echo    NO SE PUEDE INSTALAR MANNA TODAVIA
echo  ==========================================================
echo    Falta Node.js 18 o superior, el programa que hace
echo    funcionar Manna.
echo    Descargalo aqui: https://nodejs.org/es/download
echo.
echo    Se abrio una pagina con las instrucciones paso a paso.
echo    Cuando termines, vuelve a abrir este archivo.
echo  ==========================================================
start "" "instalacion\requisitos.html"
echo.
pause
exit /b 1

:fallo_icono
echo.
echo   No se pudo crear el icono en el Escritorio.
echo   Puedes abrir Manna con el archivo:
echo   %MANNA_DIR%\instalacion\abrir-windows.bat
echo.
pause
exit /b 1
