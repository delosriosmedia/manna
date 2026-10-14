@echo off
rem Instalar o actualizar Manna en Windows. Es lo unico que hay que descargar: baja Manna de GitHub
rem a una carpeta que no hace falta ver (%LOCALAPPDATA%\Manna) y crea el icono "Manna" en el
rem Escritorio y en el menu Inicio. Volver a abrirlo pone Manna al dia.
rem
rem La carpeta de contenido de la iglesia (biblias, himnos, medios) nunca se reemplaza ni se mueve:
rem   - en una instalacion nueva es Documentos\Manna\Contenido, y solo se le anade lo que falte;
rem   - si Manna ya estaba instalado a la antigua (la carpeta entera del proyecto), se siguen usando
rem     su Contenido y sus datos donde estan.
rem
rem El trabajo lo hace PowerShell con lo que sigue a la marca de abajo, en este mismo archivo.
rem Para pruebas: MANNA_DESCARGA, MANNA_BASE, MANNA_DOCUMENTOS y MANNA_DESTINO (como en el de Mac).
chcp 65001 >nul
title Instalar Manna
set "MANNA_INSTALADOR=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t = [IO.File]::ReadAllText($env:MANNA_INSTALADOR); iex ($t.Substring($t.IndexOf('#POWERSHELL' + '#') + 12))"
echo.
pause
exit /b
#POWERSHELL#
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
function Falla($mensaje) { Write-Host ''; Write-Host "  $mensaje"; exit 1 }
$descarga = if ($env:MANNA_DESCARGA) { $env:MANNA_DESCARGA } else { 'https://github.com/delosriosmedia/manna/archive/refs/heads/main.zip' }
$base = if ($env:MANNA_BASE) { $env:MANNA_BASE } else { Join-Path $env:LOCALAPPDATA 'Manna' }
$programa = Join-Path $base 'programa'
$carpetas = Join-Path $base 'carpetas.json'

Write-Host ''
Write-Host '  =========================================================='
Write-Host '    Manna - Church projection app'
Write-Host '    Instalando...'
Write-Host '  =========================================================='
Write-Host ''

$ok = $false
if (Get-Command node -ErrorAction SilentlyContinue) {
  & node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)"
  $ok = ($LASTEXITCODE -eq 0)
}
if (-not $ok) {
  Write-Host '  NO SE PUEDE INSTALAR MANNA TODAVIA'
  Write-Host '  Falta Node.js 18 o superior, el programa que hace funcionar Manna.'
  Write-Host '  Se abrio su pagina: descarga la version LTS para Windows e instalala.'
  Write-Host '  Cuando termines, vuelve a abrir este archivo.'
  Start-Process 'https://nodejs.org/es/download'
  exit 1
}
Write-Host '  [OK] Node.js esta instalado.'

# Una instalacion a la antigua: el icono del Escritorio apunta a la carpeta del proyecto.
$shell = New-Object -ComObject WScript.Shell
$escritorio = [Environment]::GetFolderPath('Desktop')
$anterior = $null
$viejo = Join-Path $escritorio 'Manna.lnk'
if (Test-Path -LiteralPath $viejo) {
  $apunta = $shell.CreateShortcut($viejo).TargetPath
  if ($apunta -like '*\instalacion\abrir-windows.bat') {
    $carpeta = Split-Path (Split-Path $apunta)
    if ($carpeta -ne $programa -and (Test-Path -LiteralPath (Join-Path $carpeta 'server\index.js'))) { $anterior = $carpeta }
  }
}

New-Item -ItemType Directory -Force -Path $base | Out-Null
if (-not (Test-Path -LiteralPath $carpetas)) {
  if ($anterior) {
    $datos = Join-Path $anterior 'data'
    $contenido = Join-Path $anterior 'Contenido'
  } else {
    $documentos = if ($env:MANNA_DOCUMENTOS) { $env:MANNA_DOCUMENTOS } else { [Environment]::GetFolderPath('MyDocuments') }
    $datos = Join-Path $base 'datos'
    $contenido = Join-Path $documentos 'Manna\Contenido'
  }
  [IO.File]::WriteAllText($carpetas, (@{ datos = $datos; contenido = $contenido } | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))
}
$contenido = (Get-Content -LiteralPath $carpetas -Raw -Encoding UTF8 | ConvertFrom-Json).contenido

Write-Host '  Descargando Manna...'
$temporal = Join-Path ([IO.Path]::GetTempPath()) ('manna-' + [Guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $temporal | Out-Null
$zip = Join-Path $temporal 'manna.zip'
try { Invoke-WebRequest -UseBasicParsing -Uri $descarga -OutFile $zip } catch { Falla 'No se pudo descargar Manna. Comprueba que este equipo tiene internet y vuelve a abrir este archivo.' }
try { Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $temporal 'abierto') -Force } catch { Falla 'La descarga llego danada. Vuelve a abrir este archivo.' }
$indice = Get-ChildItem -LiteralPath (Join-Path $temporal 'abierto') -Directory | ForEach-Object { Join-Path $_.FullName 'server\index.js' } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $indice) { Falla 'La descarga no contiene Manna. Vuelve a abrir este archivo.' }
$origen = Split-Path (Split-Path $indice)

# El programa se reemplaza entero; ahi no hay nada de la iglesia.
robocopy $origen $programa /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { Falla "No se pudo copiar Manna a $programa." }
Write-Host '  [OK] Manna esta en su carpeta, al dia.'

# Al contenido solo se le anade lo que falte (las instrucciones y la Reina-Valera 1909): nada se pisa ni se borra.
New-Item -ItemType Directory -Force -Path $contenido | Out-Null
robocopy (Join-Path $origen 'Contenido') $contenido /E /XC /XN /XO /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { Falla "No se pudo preparar la carpeta de contenido $contenido." }
Write-Host "  [OK] Carpeta de contenido: $contenido"
Remove-Item -LiteralPath $temporal -Recurse -Force -ErrorAction SilentlyContinue

# El icono abre Manna sin ventana. La conexion por internet, si esta encendida en Ajustes, la abre el propio Manna.
$lugares = if ($env:MANNA_DESTINO) { @($env:MANNA_DESTINO) } else { @($escritorio, [Environment]::GetFolderPath('Programs')) }
foreach ($lugar in $lugares) {
  New-Item -ItemType Directory -Force -Path $lugar | Out-Null
  $acceso = $shell.CreateShortcut((Join-Path $lugar 'Manna.lnk'))
  $acceso.TargetPath = Join-Path $programa 'instalacion\abrir-windows.bat'
  $acceso.WorkingDirectory = $programa
  $acceso.IconLocation = Join-Path $programa 'instalacion\icono\manna.ico'
  $acceso.WindowStyle = 7
  $acceso.Description = 'Manna - Church projection app'
  $acceso.Save()
}
Write-Host '  [OK] Icono "Manna" en el Escritorio y en el menu Inicio.'
if (-not $env:MANNA_DESTINO) {
  Write-Host ''
  Write-Host '  Abriendo Manna...'
  Start-Process -FilePath (Join-Path $programa 'instalacion\abrir-windows.bat') -WorkingDirectory $programa -WindowStyle Hidden
}

Write-Host ''
Write-Host '  =========================================================='
Write-Host '    LISTO. Abre Manna con el icono "Manna" del Escritorio.'
Write-Host ''
Write-Host '    - Las biblias, los himnos y los medios de la iglesia van en:'
Write-Host "      $contenido"
if ($anterior) {
  Write-Host "    - Tus datos y tu contenido siguen en $anterior."
  Write-Host '      No borres esa carpeta.'
}
Write-Host '    - Si Windows pregunta por el Firewall, elige "Permitir acceso"'
Write-Host '      en redes privadas. Sin eso, los celulares no podran conectarse.'
Write-Host '    - Para actualizar Manna, vuelve a abrir este archivo.'
Write-Host '    - Para apagar Manna usa el boton "Apagar" del control.'
Write-Host '  =========================================================='
