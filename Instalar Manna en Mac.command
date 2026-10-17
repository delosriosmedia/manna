#!/bin/bash
# Instalar o actualizar Manna en Mac. Es lo único que hay que descargar: baja Manna de GitHub, lo deja
# en la carpeta Manna (en Documentos, o donde ya estuviera su Contenido) y crea la app "Manna" en
# Aplicaciones, con un acceso en el Escritorio. Volver a abrirlo pone Manna al día.
#
# La carpeta queda con solo esto: los dos instaladores (con su icono), Contenido (lo de la iglesia, que
# nunca se pisa) y Programa (el programa y sus datos; si la carpeta está en iCloud, Programa va a
# ~/Library/Application Support/Manna). Lo ordena instalacion/ordenar.mjs, del Manna recién bajado:
# mueve lo de antes, sin borrar nada.
#
# Todo va dentro de main(): bash lo lee entero antes de empezar, y este archivo puede cambiar mientras tanto.
#
# Para pruebas: MANNA_DESCARGA (de dónde bajar el .zip, también file://), MANNA_BASE (la carpeta oculta),
# MANNA_DOCUMENTOS (dónde va la carpeta Manna) y MANNA_DESTINO (dónde crear la app; con él no se
# toca el Escritorio ni se abre Manna).
main() {
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"
DESCARGA="${MANNA_DESCARGA:-https://github.com/delosriosmedia/manna/archive/refs/heads/main.zip}"
OCULTA="${MANNA_BASE:-$HOME/Library/Application Support/Manna}"
DOCUMENTOS="${MANNA_DOCUMENTOS:-$HOME/Documents}"

pausa() { [ -t 0 ] && read -n 1 -s -r -p "Pulsa cualquier tecla para cerrar..."; echo; }
falla() { echo ""; echo "  $1"; echo ""; pausa; exit 1; }

echo ""
echo "=========================================================="
echo "  Manna - Church projection app"
echo "  Instalando..."
echo "=========================================================="
echo ""

if ! command -v node >/dev/null 2>&1 || ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)"; then
  echo "  NO SE PUEDE INSTALAR MANNA TODAVÍA"
  echo "  Falta Node.js 18 o superior, el programa que hace funcionar Manna."
  echo "  Se abrió su página: descarga la versión LTS para macOS e instálala."
  echo "  Cuando termines, vuelve a abrir este archivo."
  open "https://nodejs.org/es/download"
  pausa
  exit 1
fi
echo "  [OK] Node.js está instalado."

# A dónde apunta la app Manna: la carpeta del programa que hay instalado (o, a la antigua, la del proyecto).
LANZADO=""
for APP in "${MANNA_DESTINO:-/Applications}/Manna.app" "$HOME/Applications/Manna.app"; do
  if [ -f "$APP/Contents/Resources/creada-por-manna" ] && [ -f "$APP/Contents/MacOS/Manna" ]; then
    LANZADO="$(PROYECTO=""; eval "$(grep -m1 '^PROYECTO=' "$APP/Contents/MacOS/Manna")"; echo "$PROYECTO")"
    [ -n "$LANZADO" ] && break
  fi
done

echo "  Descargando Manna..."
TEMPORAL="$(mktemp -d)"
trap 'rm -rf "$TEMPORAL"' EXIT
curl -fsSL "$DESCARGA" -o "$TEMPORAL/manna.zip" || falla "No se pudo descargar Manna. Comprueba que este equipo tiene internet y vuelve a abrir este archivo."
ditto -x -k "$TEMPORAL/manna.zip" "$TEMPORAL/abierto" || falla "La descarga llegó dañada. Vuelve a abrir este archivo."
ORIGEN="$(find "$TEMPORAL/abierto" -mindepth 2 -maxdepth 3 -path '*/server/index.js' | head -1)"
[ -n "$ORIGEN" ] || falla "La descarga no contiene Manna. Vuelve a abrir este archivo."
ORIGEN="$(dirname "$(dirname "$ORIGEN")")"

# Cierra el Manna abierto, mueve lo de antes y deja la carpeta ordenada (instalacion/ordenar.mjs).
echo "  Ordenando la carpeta de Manna..."
HECHO="$(NODE_NO_WARNINGS=1 node "$ORIGEN/instalacion/ordenar.mjs" --origen "$ORIGEN" --oculta "$OCULTA" --documentos "$DOCUMENTOS" ${LANZADO:+--lanzador "$LANZADO"} | tail -1)"
dato() { node -e "const d = JSON.parse(process.argv[1] || '{}'); const v = d[process.argv[2]]; process.stdout.write(Array.isArray(v) ? v.join('\n') : v == null ? '' : String(v))" "$HECHO" "$1"; }
[ -n "$HECHO" ] || falla "No se pudo ordenar la carpeta de Manna. Vuelve a abrir este archivo."
[ -z "$(dato error)" ] || falla "$(dato error)"
PROGRAMA="$(dato programa)"; CONTENIDO="$(dato contenido)"; RAIZ="$(dato raiz)"
echo "  [OK] Manna está en su carpeta, al día."
echo "  [OK] Carpeta de contenido: $CONTENIDO"

# Los dos instaladores de la carpeta, con el icono de Manna y su engranaje.
osascript -l JavaScript - "$PROGRAMA/instalacion/icono/instalar.icns" "$RAIZ/Instalar Manna en Mac.command" "$RAIZ/Instalar Manna en Windows.bat" >/dev/null 2>&1 <<'ICONO'
ObjC.import('AppKit');
function run(argv) {
  const image = $.NSImage.alloc.initWithContentsOfFile(argv[0]);
  for (const file of argv.slice(1)) $.NSWorkspace.sharedWorkspace.setIconForFileOptions(image, file, 0);
}
ICONO

DESTINO="${MANNA_DESTINO:-/Applications}"
if [ -z "$MANNA_DESTINO" ] && [ ! -w "$DESTINO" ]; then DESTINO="$HOME/Applications"; fi
mkdir -p "$DESTINO"
APP="$DESTINO/Manna.app"

# Solo se reemplaza una app creada por Manna.
if [ -e "$APP" ] && [ ! -f "$APP/Contents/Resources/creada-por-manna" ]; then
  falla "Ya existe otra app llamada Manna en $DESTINO y no es de este programa. Muévela o cámbiale el nombre y vuelve a abrir este archivo."
fi
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$PROGRAMA/instalacion/icono/manna.icns" "$APP/Contents/Resources/Manna.icns"
touch "$APP/Contents/Resources/creada-por-manna"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Manna</string>
  <key>CFBundleDisplayName</key><string>Manna</string>
  <key>CFBundleIdentifier</key><string>app.manna.lanzador</string>
  <key>CFBundleExecutable</key><string>Manna</string>
  <key>CFBundleIconFile</key><string>Manna</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
PLIST

# La app es un lanzador mínimo: arranca el servidor sin ventana y termina. Si Manna ya está abierto,
# el propio servidor lo detecta y solo vuelve a mostrar el control. La conexión por internet, si está
# encendida en Ajustes, la abre el propio Manna.
{
  echo '#!/bin/bash'
  echo 'export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"'
  printf 'PROYECTO=%q\n' "$PROGRAMA"
  cat <<'LANZADOR'
aviso() { osascript -e "display alert \"Manna\" message \"$1\"" >/dev/null 2>&1; }
if ! cd "$PROYECTO" 2>/dev/null || [ ! -f server/index.js ]; then
  aviso "No se encuentra Manna. Vuelve a abrir el archivo Instalar Manna en Mac."
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  open "instalacion/requisitos.html"
  exit 1
fi
nohup node server/index.js --segundo-plano >/dev/null 2>&1 &
LANZADOR
} > "$APP/Contents/MacOS/Manna"
chmod +x "$APP/Contents/MacOS/Manna"
touch "$APP"
echo "  [OK] App \"Manna\" en $DESTINO."

if [ -z "$MANNA_DESTINO" ]; then
  ln -sfn "$APP" "$HOME/Desktop/Manna"
  echo "  [OK] Acceso \"Manna\" en el Escritorio."
  echo ""
  echo "  Abriendo Manna..."
  open "$APP"
fi

echo ""
echo "=========================================================="
echo "  LISTO. Abre Manna con el icono \"Manna\" del Escritorio"
echo "  o de Aplicaciones. Para tenerlo a mano, arrástralo al Dock."
echo ""
echo "  - Las biblias, los himnos y los medios de la iglesia van en:"
echo "    $CONTENIDO"
echo "  - Todo Manna está en $RAIZ. No borres su carpeta Programa."
if [ -n "$(dato antiguo)" ]; then
  echo "  - Lo de la versión anterior que ya no se usa quedó en:"
  echo "    $(dato antiguo)"
fi
dato avisos | while IFS= read -r AVISO; do [ -n "$AVISO" ] && echo "  - $AVISO"; done
echo "  - Para actualizar Manna, abre \"Instalar Manna en Mac\" de esa carpeta."
echo "  - Para apagar Manna usa el botón \"Apagar\" del control."
echo "=========================================================="
echo ""
pausa
}
main "$@"; exit $?
