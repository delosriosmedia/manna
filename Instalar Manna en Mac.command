#!/bin/bash
# Instalar o actualizar Manna en Mac. Es lo único que hay que descargar: baja Manna de GitHub a una
# carpeta que no hace falta ver (~/Library/Application Support/Manna) y crea la app "Manna" en
# Aplicaciones, con un acceso en el Escritorio. Volver a abrirlo pone Manna al día.
#
# La carpeta de contenido de la iglesia (biblias, himnos, medios) nunca se reemplaza ni se mueve:
#   - en una instalación nueva es Documentos/Manna/Contenido, y solo se le añade lo que falte;
#   - si Manna ya estaba instalado a la antigua (la carpeta entera del proyecto), se siguen usando
#     su Contenido y sus datos donde están.
#
# Para pruebas: MANNA_DESCARGA (de dónde bajar el .zip, también file://), MANNA_BASE (carpeta del
# programa), MANNA_DOCUMENTOS (dónde va Contenido) y MANNA_DESTINO (dónde crear la app; con él no se
# toca el Escritorio ni se abre Manna).
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"
DESCARGA="${MANNA_DESCARGA:-https://github.com/delosriosmedia/manna/archive/refs/heads/main.zip}"
BASE="${MANNA_BASE:-$HOME/Library/Application Support/Manna}"
PROGRAMA="$BASE/programa"
CARPETAS="$BASE/carpetas.json"

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

# Una instalación a la antigua: la app apunta a la carpeta del proyecto, con su Contenido y sus datos.
ANTERIOR=""
for APP in "${MANNA_DESTINO:-/Applications}/Manna.app" "$HOME/Applications/Manna.app"; do
  LANZADOR="$APP/Contents/MacOS/Manna"
  if [ -f "$APP/Contents/Resources/creada-por-manna" ] && [ -f "$LANZADOR" ]; then
    CARPETA="$(PROYECTO=""; eval "$(grep -m1 '^PROYECTO=' "$LANZADOR")"; echo "$PROYECTO")"
    if [ -n "$CARPETA" ] && [ "$CARPETA" != "$PROGRAMA" ] && [ -f "$CARPETA/server/index.js" ]; then ANTERIOR="$CARPETA"; fi
  fi
done

mkdir -p "$BASE" || falla "No se pudo crear la carpeta $BASE."
if [ ! -f "$CARPETAS" ]; then
  if [ -n "$ANTERIOR" ]; then
    DATOS="$ANTERIOR/data"; CONTENIDO="$ANTERIOR/Contenido"
  else
    DATOS="$BASE/datos"; CONTENIDO="${MANNA_DOCUMENTOS:-$HOME/Documents}/Manna/Contenido"
  fi
  node -e "require('fs').writeFileSync(process.argv[1], JSON.stringify({ datos: process.argv[2], contenido: process.argv[3] }, null, 2))" "$CARPETAS" "$DATOS" "$CONTENIDO" \
    || falla "No se pudo guardar dónde están los datos de Manna."
fi
CONTENIDO="$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).contenido)" "$CARPETAS")"

echo "  Descargando Manna..."
TEMPORAL="$(mktemp -d)"
trap 'rm -rf "$TEMPORAL"' EXIT
curl -fsSL "$DESCARGA" -o "$TEMPORAL/manna.zip" || falla "No se pudo descargar Manna. Comprueba que este equipo tiene internet y vuelve a abrir este archivo."
ditto -x -k "$TEMPORAL/manna.zip" "$TEMPORAL/abierto" || falla "La descarga llegó dañada. Vuelve a abrir este archivo."
ORIGEN="$(find "$TEMPORAL/abierto" -mindepth 2 -maxdepth 3 -path '*/server/index.js' | head -1)"
[ -n "$ORIGEN" ] || falla "La descarga no contiene Manna. Vuelve a abrir este archivo."
ORIGEN="$(dirname "$(dirname "$ORIGEN")")"

# El programa se reemplaza entero; ahí no hay nada de la iglesia.
mkdir -p "$PROGRAMA"
rsync -a --delete "$ORIGEN/" "$PROGRAMA/" || falla "No se pudo copiar Manna a $PROGRAMA."
echo "  [OK] Manna está en su carpeta, al día."

# Al contenido solo se le añade lo que falte (las instrucciones y la Reina-Valera 1909): nada se pisa ni se borra.
mkdir -p "$CONTENIDO" && rsync -a --ignore-existing "$ORIGEN/Contenido/" "$CONTENIDO/" \
  || falla "No se pudo preparar la carpeta de contenido $CONTENIDO."
echo "  [OK] Carpeta de contenido: $CONTENIDO"

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
if [ -n "$ANTERIOR" ]; then
  echo "  - Tus datos y tu contenido siguen en $ANTERIOR."
  echo "    No borres esa carpeta."
fi
echo "  - Para actualizar Manna, vuelve a abrir este archivo."
echo "  - Para apagar Manna usa el botón \"Apagar\" del control."
echo "=========================================================="
echo ""
pausa
