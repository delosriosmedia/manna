#!/bin/bash
# Preparación única de Manna en Mac: comprueba los requisitos y crea la app "Manna"
# en Aplicaciones, con un acceso en el Escritorio. Después, Manna se abre siempre desde ahí.
#
# Para pruebas: MANNA_DESTINO=<carpeta> crea la app en esa carpeta y no toca el Escritorio.
cd "$(dirname "$0")" || exit 1
PROYECTO="$(pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"

pausa() { [ -t 0 ] && read -n 1 -s -r -p "Pulsa cualquier tecla para cerrar..."; echo; }

echo ""
echo "=========================================================="
echo "  Manna - Church projection app"
echo "  Preparando este equipo..."
echo "=========================================================="
echo ""

if ! command -v node >/dev/null 2>&1 || ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)"; then
  echo "  NO SE PUEDE INSTALAR MANNA TODAVÍA"
  echo "  Falta Node.js 18 o superior, el programa que hace funcionar Manna."
  echo "  Descárgalo aquí: https://nodejs.org/es/download"
  echo ""
  echo "  Se abrió una página con las instrucciones paso a paso."
  echo "  Cuando termines, vuelve a abrir este archivo."
  open "instalacion/requisitos.html"
  pausa
  exit 1
fi
echo "  [OK] Node.js está instalado."

DESTINO="${MANNA_DESTINO:-/Applications}"
if [ -z "$MANNA_DESTINO" ] && [ ! -w "$DESTINO" ]; then DESTINO="$HOME/Applications"; fi
mkdir -p "$DESTINO"
APP="$DESTINO/Manna.app"

# Solo se reemplaza una app creada por este mismo instalador.
if [ -e "$APP" ] && [ ! -f "$APP/Contents/Resources/creada-por-manna" ]; then
  echo "  Ya existe otra app llamada Manna en $DESTINO y no es de este programa."
  echo "  Muévela o cámbiale el nombre y vuelve a abrir este archivo."
  pausa
  exit 1
fi
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "instalacion/icono/manna.icns" "$APP/Contents/Resources/Manna.icns"
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

# La app es un lanzador mínimo: arranca el servidor sin ventana y termina.
# Si Manna ya está abierto, el propio servidor lo detecta y solo vuelve a mostrar el control.
{
  echo '#!/bin/bash'
  echo 'export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"'
  printf 'PROYECTO=%q\n' "$PROYECTO"
  cat <<'LANZADOR'
aviso() { osascript -e "display alert \"Manna\" message \"$1\"" >/dev/null 2>&1; }
if ! cd "$PROYECTO" 2>/dev/null || [ ! -f server/index.js ]; then
  aviso "No se puede abrir la carpeta de Manna. Si la moviste, o si macOS pidió permiso para leerla y no se concedió, vuelve a abrir el archivo Instalar Manna en Mac."
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
echo "  [OK] App \"Manna\" creada en $DESTINO."

if [ -z "$MANNA_DESTINO" ]; then
  ln -sfn "$APP" "$HOME/Desktop/Manna"
  echo "  [OK] Acceso \"Manna\" creado en el Escritorio."
  echo ""
  echo "  Abriendo Manna..."
  open "$APP"
fi

echo ""
echo "=========================================================="
echo "  LISTO. Desde ahora, abre Manna con el icono \"Manna\""
echo "  del Escritorio o de Aplicaciones. Para tenerlo siempre a"
echo "  mano, arrástralo desde Aplicaciones al Dock."
echo ""
echo "  - Si macOS pide permiso para acceder a una carpeta o a"
echo "    la red local, elige \"Permitir\"."
echo "  - Para apagar Manna usa el botón \"Apagar\" del control."
echo "  - Si mueves la carpeta de Manna a otro sitio, vuelve a"
echo "    abrir este archivo."
echo "=========================================================="
echo ""
pausa
