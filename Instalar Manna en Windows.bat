@echo off
rem Instalar o actualizar Manna en Windows. Es lo unico que hay que descargar: baja Manna de GitHub,
rem lo deja en la carpeta Manna (en Documentos, o donde ya estuviera su Contenido) y crea el icono
rem "Manna" en el Escritorio y en el menu Inicio. Volver a abrirlo pone Manna al dia.
rem
rem La carpeta queda con solo esto: "Instalar Manna en Windows" (un acceso directo con su icono),
rem "Instalar Manna en Mac.command", Contenido (lo de la iglesia, que nunca se pisa) y Programa (el
rem programa y sus datos; si la carpeta esta en OneDrive, Programa va a %LOCALAPPDATA%\Manna). Lo
rem ordena instalacion\ordenar.mjs, del Manna recien bajado: mueve lo de antes, sin borrar nada.
rem
rem El trabajo lo hace PowerShell con lo que sigue a la marca de abajo, en este mismo archivo. Va en la
rem misma linea que exit: este archivo puede cambiar de sitio mientras tanto, y cmd ya no lo vuelve a leer.
rem Para pruebas: MANNA_DESCARGA, MANNA_BASE, MANNA_DOCUMENTOS y MANNA_DESTINO (como en el de Mac).
chcp 65001 >nul
title Instalar Manna
set "MANNA_INSTALADOR=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t = [IO.File]::ReadAllText($env:MANNA_INSTALADOR); iex ($t.Substring($t.IndexOf('#POWERSHELL' + '#') + 12))" & exit /b
#POWERSHELL#
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
function Pausa { Write-Host ''; [void](Read-Host '  Pulsa Intro para cerrar') }
function Falla($mensaje) { Write-Host ''; Write-Host "  $mensaje"; Pausa; exit 1 }
$descarga = if ($env:MANNA_DESCARGA) { $env:MANNA_DESCARGA } else { 'https://github.com/delosriosmedia/manna/archive/refs/heads/main.zip' }
$oculta = if ($env:MANNA_BASE) { $env:MANNA_BASE } else { Join-Path $env:LOCALAPPDATA 'Manna' }
$documentos = if ($env:MANNA_DOCUMENTOS) { $env:MANNA_DOCUMENTOS } else { [Environment]::GetFolderPath('MyDocuments') }

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
  Pausa
  exit 1
}
Write-Host '  [OK] Node.js esta instalado.'

# A donde apunta el icono del Escritorio: la carpeta del programa que hay instalado (o, a la antigua, la del proyecto).
$shell = New-Object -ComObject WScript.Shell
$escritorio = [Environment]::GetFolderPath('Desktop')
$lanzador = ''
$viejo = Join-Path $escritorio 'Manna.lnk'
if (Test-Path -LiteralPath $viejo) {
  $apunta = $shell.CreateShortcut($viejo).TargetPath
  if ($apunta -like '*\instalacion\abrir-windows.bat') { $lanzador = Split-Path (Split-Path $apunta) }
}

Write-Host '  Descargando Manna...'
$temporal = Join-Path ([IO.Path]::GetTempPath()) ('manna-' + [Guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $temporal | Out-Null
$zip = Join-Path $temporal 'manna.zip'
try { Invoke-WebRequest -UseBasicParsing -Uri $descarga -OutFile $zip } catch { Falla 'No se pudo descargar Manna. Comprueba que este equipo tiene internet y vuelve a abrir este archivo.' }
try { Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $temporal 'abierto') -Force } catch { Falla 'La descarga llego danada. Vuelve a abrir este archivo.' }
$indice = Get-ChildItem -LiteralPath (Join-Path $temporal 'abierto') -Directory | ForEach-Object { Join-Path $_.FullName 'server\index.js' } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $indice) { Falla 'La descarga no contiene Manna. Vuelve a abrir este archivo.' }
$origen = Split-Path (Split-Path $indice)

# Cierra el Manna abierto, mueve lo de antes y deja la carpeta ordenada (instalacion\ordenar.mjs).
Write-Host '  Ordenando la carpeta de Manna...'
# (Lo que Node diga por su cuenta, como un aviso, no debe cortar la instalacion.)
$env:NODE_NO_WARNINGS = '1'
$ErrorActionPreference = 'Continue'
# --aqui: si este archivo esta en la carpeta de Manna (junto a su Contenido), se ordena esa carpeta.
$salida = & node (Join-Path $origen 'instalacion\ordenar.mjs') --origen $origen --oculta $oculta --documentos $documentos --aqui (Split-Path $env:MANNA_INSTALADOR) --lanzador $lanzador
$ErrorActionPreference = 'Stop'
$hecho = $null
try { $hecho = ($salida | Select-Object -Last 1) | ConvertFrom-Json } catch { }
Remove-Item -LiteralPath $temporal -Recurse -Force -ErrorAction SilentlyContinue
if (-not $hecho) { Falla 'No se pudo ordenar la carpeta de Manna. Vuelve a abrir este archivo.' }
if ($hecho.error) { Falla $hecho.error }
$programa = $hecho.programa
$contenido = $hecho.contenido
Write-Host '  [OK] Manna esta en su carpeta, al dia.'
Write-Host "  [OK] Carpeta de contenido: $contenido"
if ($hecho.dominio) { Write-Host "  [OK] Conexion por internet con tu dominio: $($hecho.dominio)" }

# En la carpeta, el instalador de Windows es un acceso directo con su icono (un .bat no puede tenerlo).
$acceso = $shell.CreateShortcut((Join-Path $hecho.raiz 'Instalar Manna en Windows.lnk'))
$acceso.TargetPath = Join-Path $programa 'Instalar Manna en Windows.bat'
$acceso.WorkingDirectory = $programa
$acceso.IconLocation = Join-Path $programa 'instalacion\icono\instalar.ico'
$acceso.Description = 'Instalar o actualizar Manna'
$acceso.Save()

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
Write-Host "    - Todo Manna esta en $($hecho.raiz). No borres su carpeta Programa."
if ($hecho.antiguo) {
  Write-Host "    - Lo de la version anterior que ya no se usa quedo en:"
  Write-Host "      $($hecho.antiguo)"
}
foreach ($aviso in $hecho.avisos) { Write-Host "    - $aviso" }
Write-Host '    - Si Windows pregunta por el Firewall, elige "Permitir acceso"'
Write-Host '      en redes privadas. Sin eso, los celulares no podran conectarse.'
Write-Host '    - Para actualizar Manna, abre "Instalar Manna en Windows" de esa carpeta.'
Write-Host '    - Para apagar Manna usa el boton "Apagar" del control.'
Write-Host '  =========================================================='
Pausa
