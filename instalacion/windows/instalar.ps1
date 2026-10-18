# Instalar o actualizar Manna en Windows. Baja Manna de GitHub y el Node.js oficial (el motor de Manna, de
# nodejs.org, comprobando su huella), lo deja en la carpeta Manna (en Documentos, o donde ya estuviera) y crea el
# icono "Manna" en el Escritorio y en el menú Inicio. Volver a abrirlo pone Manna al día.
#
# Lo abren: Instalar-Manna-Windows.exe (el único archivo que se descarga de GitHub: lo lleva dentro, ver
# Instalar.cs) y, para actualizar, "Instalar Manna en Windows.bat" de la carpeta del programa (Manna lo abre desde
# Ajustes o el aviso de versión nueva). MANNA_INSTALADOR dice cuál de los dos se abrió.
#
# Va en UTF-8 con BOM: así PowerShell 5.1 lee bien las tildes.
#
# Para pruebas: MANNA_DESCARGA (de dónde bajar el .zip, también file://), MANNA_NODE_DESCARGA (la carpeta con
# SHASUMS256.txt y el Node.js, también file://), MANNA_BASE, MANNA_DOCUMENTOS y MANNA_DESTINO (dónde crear los
# iconos; con él no se abre Manna ni se espera a que se pulse una tecla).
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }
try { $Host.UI.RawUI.WindowTitle = 'Instalar Manna' } catch { }

$descarga = if ($env:MANNA_DESCARGA) { $env:MANNA_DESCARGA } else { 'https://github.com/delosriosmedia/manna/archive/refs/heads/main.zip' }
$nodeMayor = 24
$nodeDescarga = if ($env:MANNA_NODE_DESCARGA) { $env:MANNA_NODE_DESCARGA } else { "https://nodejs.org/dist/latest-v$nodeMayor.x" }
$oculta = if ($env:MANNA_BASE) { $env:MANNA_BASE } else { Join-Path $env:LOCALAPPDATA 'Manna' }
$documentos = if ($env:MANNA_DOCUMENTOS) { $env:MANNA_DOCUMENTOS } else { [Environment]::GetFolderPath('MyDocuments') }
$interactivo = -not $env:MANNA_DESTINO -and -not [Console]::IsOutputRedirected
$aqui = if ($env:MANNA_INSTALADOR) { Split-Path $env:MANNA_INSTALADOR } else { $PSScriptRoot }
$pasos = 5

# ---- La consola: un título, los pasos con su marca y una barra de avance ----
function Pausa { if ($interactivo -and -not [Console]::IsInputRedirected) { Write-Host ''; [void](Read-Host '  Pulsa Intro para cerrar') } }
function Falla($mensaje) {
  Write-Host ''
  Write-Host '  ✗ No se pudo terminar. ' -ForegroundColor Red -NoNewline
  Write-Host $mensaje
  Pausa
  exit 1
}
function Paso($n, $texto) { Write-Host ''; Write-Host "  $n/$pasos  " -ForegroundColor Cyan -NoNewline; Write-Host $texto }
function Hecho($texto) { Write-Host '        ✓ ' -ForegroundColor Green -NoNewline; Write-Host $texto }
function Barra($hecho, $total) {
  $ancho = 28
  if ($total -gt 0) {
    $parte = [Math]::Min(1, $hecho / $total)
    $llenos = [int][Math]::Floor($parte * $ancho)
    $texto = '{0,3} %   {1:N1} de {2:N1} MB' -f [int]($parte * 100), ($hecho / 1MB), ($total / 1MB)
  } else { $llenos = 0; $texto = '{0:N1} MB' -f ($hecho / 1MB) }
  Write-Host -NoNewline ("`r        " + ('█' * $llenos) + ('░' * ($ancho - $llenos)) + "  $texto   ")
}
# Baja un archivo con su barra de avance (file:// solo se copia: es para las pruebas).
function Bajar($url, $destino) {
  if ($url -like 'file://*') { Copy-Item -LiteralPath ([Uri]$url).LocalPath -Destination $destino; return }
  $peticion = [Net.HttpWebRequest]::Create($url)
  $peticion.UserAgent = 'Manna'
  $respuesta = $peticion.GetResponse()
  $total = $respuesta.ContentLength
  $entrada = $respuesta.GetResponseStream()
  $salida = [IO.File]::Create($destino)
  $trozo = New-Object byte[] 65536
  $hecho = 0
  $ultimo = 0
  try {
    while (($n = $entrada.Read($trozo, 0, $trozo.Length)) -gt 0) {
      $salida.Write($trozo, 0, $n)
      $hecho += $n
      if ($interactivo -and ([Environment]::TickCount - $ultimo) -gt 150) { Barra $hecho $total; $ultimo = [Environment]::TickCount }
    }
  } finally { $salida.Close(); $entrada.Close(); $respuesta.Close() }
  if ($interactivo) { Barra $hecho $total; Write-Host '' }
}
function Texto($url) {
  if ($url -like 'file://*') { return [IO.File]::ReadAllText(([Uri]$url).LocalPath) }
  return (New-Object Net.WebClient).DownloadString($url)
}

Write-Host ''
Write-Host '  ╭──────────────────────────────────────────────────╮' -ForegroundColor Cyan
Write-Host '  │   MANNA  ·  Instalar o actualizar                │' -ForegroundColor Cyan
Write-Host '  │   Proyección para la iglesia, en la red local    │' -ForegroundColor Cyan
Write-Host '  ╰──────────────────────────────────────────────────╯' -ForegroundColor Cyan
Write-Host '  Hace falta internet. Tarda unos minutos; no cierres esta ventana.'

# A dónde apunta el icono del Escritorio: la carpeta del programa que hay instalado (o, a la antigua, la del proyecto).
$shell = New-Object -ComObject WScript.Shell
$escritorio = [Environment]::GetFolderPath('Desktop')
$lanzador = ''
$viejo = Join-Path $escritorio 'Manna.lnk'
if (Test-Path -LiteralPath $viejo) {
  $apunta = $shell.CreateShortcut($viejo).TargetPath
  if ($apunta -like '*\instalacion\abrir-windows.bat') { $lanzador = Split-Path (Split-Path $apunta) }
}
$temporal = Join-Path ([IO.Path]::GetTempPath()) ('manna-' + [Guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $temporal | Out-Null

# ---- 1. El equipo ----
Paso 1 'Comprobando el equipo'
$arq = switch ($env:PROCESSOR_ARCHITECTURE) { 'AMD64' { 'x64' } 'ARM64' { 'arm64' } default { $null } }
if (-not $arq) { Falla "Este equipo no es compatible (procesador $($env:PROCESSOR_ARCHITECTURE)): hace falta Windows de 64 bits." }
$libre = try { [int]((Get-PSDrive -Name ($documentos.Substring(0, 1))).Free / 1MB) } catch { $null }
if ($null -ne $libre -and $libre -lt 500) { Falla 'Hace falta al menos 500 MB libres en el disco.' }
Hecho "Windows $([Environment]::OSVersion.Version), procesador $arq$(if ($null -ne $libre) { ", $libre MB libres" })"

# ---- 2. Node.js: el de Manna si ya está; si no, el oficial (se instala en Programa\node en el paso 4) ----
Paso 2 'Node.js, el motor de Manna'
function NodeSirve($exe) {
  if (-not $exe -or -not (Test-Path -LiteralPath $exe)) { return $false }
  # (En PowerShell 5.1, lo que un programa escribe en stderr con 'Stop' corta el guion.)
  $ErrorActionPreference = 'Continue'
  & $exe -e "process.exit(Number(process.versions.node.split('.')[0]) >= $nodeMayor ? 0 : 1)" 2>$null
  return $LASTEXITCODE -eq 0
}
$node = $null
foreach ($candidato in @((Join-Path (Split-Path $aqui) 'node\node.exe'), (Join-Path $aqui 'Programa\node\node.exe'), $(if ($lanzador) { Join-Path (Split-Path $lanzador) 'node\node.exe' }))) {
  if (NodeSirve $candidato) { $node = $candidato; break }
}
$nuevo = $null
if ($node) {
  Hecho "Ya está el de Manna ($(& $node --version))."
} else {
  try { $huellas = Texto "$nodeDescarga/SHASUMS256.txt" } catch { Falla 'No se pudo descargar Node.js. Comprueba que este equipo tiene internet y vuelve a intentarlo.' }
  $linea = ($huellas -split "`n") | Where-Object { $_ -match " node-v[0-9.]+-win-$arq\.zip\s*$" } | Select-Object -First 1
  if (-not $linea) { Falla 'No se encontró Node.js para este equipo en nodejs.org.' }
  $huella, $archivo = ($linea.Trim() -split '\s+')[0, 1]
  Write-Host "        Descargando $($archivo -replace '\.zip$', '')…"
  try { Bajar "$nodeDescarga/$archivo" (Join-Path $temporal $archivo) } catch { Falla 'No se pudo descargar Node.js. Comprueba que este equipo tiene internet y vuelve a intentarlo.' }
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $temporal $archivo)).Hash -ne $huella.ToUpper()) { Falla 'La descarga de Node.js llegó dañada (su huella no coincide). Vuelve a intentarlo.' }
  try { Expand-Archive -LiteralPath (Join-Path $temporal $archivo) -DestinationPath (Join-Path $temporal 'node') -Force } catch { Falla 'No se pudo abrir la descarga de Node.js.' }
  $nuevo = Get-ChildItem -LiteralPath (Join-Path $temporal 'node') -Directory | Select-Object -First 1 -ExpandProperty FullName
  $node = Join-Path $nuevo 'node.exe'
  if (-not (NodeSirve $node)) { Falla 'El Node.js descargado no arranca en este equipo.' }
  Hecho "Node.js $(& $node --version), comprobado."
}

# ---- 3. Manna ----
Paso 3 'Descargando Manna'
$zip = Join-Path $temporal 'manna.zip'
try { Bajar $descarga $zip } catch { Falla 'No se pudo descargar Manna. Comprueba que este equipo tiene internet y vuelve a intentarlo.' }
try { Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $temporal 'abierto') -Force } catch { Falla 'La descarga llegó dañada. Vuelve a intentarlo.' }
$indice = Get-ChildItem -LiteralPath (Join-Path $temporal 'abierto') -Directory | ForEach-Object { Join-Path $_.FullName 'server\index.js' } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $indice) { Falla 'La descarga no contiene Manna. Vuelve a intentarlo.' }
$origen = Split-Path (Split-Path $indice)
Hecho "Manna $((Get-Content -Raw -LiteralPath (Join-Path $origen 'package.json') | ConvertFrom-Json).version)"

# ---- 4. La carpeta Manna: cierra el Manna abierto, mueve lo de antes y la ordena (instalacion\ordenar.mjs) ----
Paso 4 'Ordenando la carpeta Manna'
# (Lo que Node diga por su cuenta, como un aviso, no debe cortar la instalación.)
$env:NODE_NO_WARNINGS = '1'
$ErrorActionPreference = 'Continue'
$salida = & $node (Join-Path $origen 'instalacion\ordenar.mjs') --origen $origen --oculta $oculta --documentos $documentos --aqui $aqui --lanzador $lanzador
$ErrorActionPreference = 'Stop'
$hecho = $null
try { $hecho = ($salida | Select-Object -Last 1) | ConvertFrom-Json } catch { }
if (-not $hecho) { Falla 'No se pudo ordenar la carpeta de Manna. Vuelve a intentarlo.' }
if ($hecho.error) { Falla $hecho.error }
$programa = $hecho.programa
# Node.js va junto al programa, en Programa\node; si se acaba de bajar, reemplaza al de antes.
$motor = Join-Path (Split-Path $programa) 'node'
if ($nuevo) {
  try {
    if (Test-Path -LiteralPath $motor) { Remove-Item -LiteralPath $motor -Recurse -Force }
    Move-Item -LiteralPath $nuevo -Destination $motor
  } catch { Falla "No se pudo dejar Node.js en $motor. ¿Sigue abierto Manna? Ciérralo con «Apagar» y vuelve a intentarlo." }
}
Remove-Item -LiteralPath $temporal -Recurse -Force -ErrorAction SilentlyContinue
Hecho "Manna está en $($hecho.raiz)"
Hecho "Carpeta de contenido: $($hecho.contenido)"
if ($hecho.dominio) { Hecho "Conexión por internet con tu dominio: $($hecho.dominio)" }

# En la carpeta, el instalador de Windows es un acceso directo con su icono (un .bat no puede tenerlo).
$acceso = $shell.CreateShortcut((Join-Path $hecho.raiz 'Instalar Manna en Windows.lnk'))
$acceso.TargetPath = Join-Path $programa 'Instalar Manna en Windows.bat'
$acceso.WorkingDirectory = $programa
$acceso.IconLocation = Join-Path $programa 'instalacion\icono\instalar.ico'
$acceso.Description = 'Instalar o actualizar Manna'
$acceso.Save()

# ---- 5. El icono Manna: lo abre sin ventana, con el Node.js de Manna (instalacion\abrir-windows.bat) ----
Paso 5 'Creando el icono «Manna»'
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
Hecho 'Icono «Manna» en el Escritorio y en el menú Inicio'
if (-not $env:MANNA_DESTINO) {
  Start-Process -FilePath (Join-Path $programa 'instalacion\abrir-windows.bat') -WorkingDirectory $programa -WindowStyle Hidden
}

Write-Host ''
Write-Host '  ╭──────────────────────────────────────────────────╮' -ForegroundColor Green
Write-Host '  │   ✓ LISTO. Manna se está abriendo.               │' -ForegroundColor Green
Write-Host '  ╰──────────────────────────────────────────────────╯' -ForegroundColor Green
Write-Host '  - La próxima vez, ábrelo con el icono «Manna» del Escritorio.'
Write-Host '  - Si Windows pregunta por el Firewall, elige «Permitir acceso» en redes'
Write-Host '    privadas. Sin eso, los celulares no podrán conectarse.'
Write-Host '  - Dentro de Manna, en Ajustes → «Carpeta de contenido», elige la carpeta'
Write-Host '    de tu iglesia (biblias, himnario y medios). Ahora es:'
Write-Host "    $($hecho.contenido)"
Write-Host '  - Desde Manna también se reinicia, se apaga y se actualiza.'
if ($hecho.antiguo) {
  Write-Host '  - Lo de la versión anterior que ya no se usa quedó en:'
  Write-Host "    $($hecho.antiguo)"
}
foreach ($aviso in $hecho.avisos) { Write-Host "  - $aviso" }
Pausa
