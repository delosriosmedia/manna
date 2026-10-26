#!/bin/bash
# Instalar o actualizar Manna en Mac. Baja Manna de GitHub y el Node.js oficial (el motor de Manna, de
# nodejs.org, comprobando su huella), lo deja en la carpeta Manna (en Documentos, o donde ya estuviera) y crea
# la app "Manna" en Aplicaciones, con un acceso en el Escritorio. Volver a abrirlo pone Manna al día.
#
# Para instalar se descarga "Instalar-Manna-Mac.pkg" de GitHub: el instalador de Apple, que lleva este mismo
# archivo y lo ejecuta (MANNA_PKG=1: sin Terminal; la app la abre el .pkg). Para actualizar, Manna abre la
# copia de este archivo que hay en la carpeta Manna (Ajustes o el aviso de versión nueva).
#
# La carpeta queda con solo esto: los dos instaladores (con su icono), Contenido (lo de la iglesia, que
# nunca se pisa; puede estar en otro sitio si se eligió en Ajustes) y Programa (el programa, Node.js y los
# datos; si la carpeta está en iCloud, Programa va a ~/Library/Application Support/Manna). Lo ordena
# instalacion/ordenar.mjs, del Manna recién bajado: mueve lo de antes, sin borrar nada.
#
# Todo va dentro de main(): bash lo lee entero antes de empezar, y este archivo puede cambiar mientras tanto.
#
# Para pruebas: MANNA_DESCARGA (de dónde bajar el .zip, también file://), MANNA_NODE_DESCARGA (la carpeta con
# SHASUMS256.txt y el Node.js, también file://), MANNA_BASE (la carpeta oculta), MANNA_DOCUMENTOS (dónde va
# la carpeta Manna) y MANNA_DESTINO (dónde crear la app; con él no se toca el Escritorio ni se abre Manna).
main() {
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:$PATH"
DESCARGA="${MANNA_DESCARGA:-https://github.com/delosriosmedia/manna/archive/refs/heads/main.zip}"
NODE_MAYOR=24
NODE_DESCARGA="${MANNA_NODE_DESCARGA:-https://nodejs.org/dist/latest-v$NODE_MAYOR.x}"
OCULTA="${MANNA_BASE:-$HOME/Library/Application Support/Manna}"
DOCUMENTOS="${MANNA_DOCUMENTOS:-$HOME/Documents}"
PASOS=5

# ---- La consola: un título, los pasos con su marca y una barra de avance (en el .pkg, solo texto) ----
if [ -t 1 ] && [ -z "$MANNA_PKG" ]; then
  V=$'\e[32m'; C=$'\e[36m'; R=$'\e[31m'; G=$'\e[2m'; N=$'\e[0m'
else
  V=''; C=''; R=''; G=''; N=''
fi
pausa() { [ -t 0 ] && [ -z "$MANNA_PKG" ] && [ -z "$MANNA_DESTINO" ] && read -n 1 -s -r -p "  Pulsa cualquier tecla para cerrar..."; echo; }
falla() {
  echo ""
  echo "  ${R}✗ No se pudo terminar.${N} $1"
  [ -n "$MANNA_PKG_ERROR" ] && printf '%s' "$1" > "$MANNA_PKG_ERROR"
  echo ""
  pausa
  exit 1
}
paso() { echo ""; echo "  ${C}$1/$PASOS${N}  $2"; }
hecho() { echo "        ${V}✓${N} $1"; }

echo ""
echo "  ${C}╭──────────────────────────────────────────────────╮${N}"
echo "  ${C}│${N}   MANNA  ·  Instalar o actualizar                ${C}│${N}"
echo "  ${C}│${N}   ${G}Proyección para la iglesia, en la red local${N}    ${C}│${N}"
echo "  ${C}╰──────────────────────────────────────────────────╯${N}"
echo "  Hace falta internet. Tarda unos minutos; no cierres esta ventana."

# A dónde apunta la app Manna: la carpeta del programa que hay instalado (o, a la antigua, la del proyecto).
LANZADO=""
for APP in "${MANNA_DESTINO:-/Applications}/Manna.app" "$HOME/Applications/Manna.app"; do
  if [ -f "$APP/Contents/Resources/creada-por-manna" ] && [ -f "$APP/Contents/MacOS/Manna" ]; then
    LANZADO="$(PROYECTO=""; eval "$(grep -m1 '^PROYECTO=' "$APP/Contents/MacOS/Manna")"; echo "$PROYECTO")"
    [ -n "$LANZADO" ] && break
  fi
done
# --aqui: si este archivo está en la carpeta de Manna (junto a su Contenido, o en Programa/programa), se ordena esa.
AQUI="$(cd "$(dirname "$0")" && pwd)"
TEMPORAL="$(mktemp -d)"
trap 'rm -rf "$TEMPORAL"' EXIT

# ---- 1. El equipo ----
paso 1 "Comprobando el equipo"
case "$(uname -m)" in arm64) ARQ=arm64 ;; x86_64) ARQ=x64 ;; *) falla "Este Mac no es compatible (procesador $(uname -m))." ;; esac
LIBRE=$(df -Pk "$HOME" | awk 'NR==2 { print int($4 / 1024) }')
[ "${LIBRE:-0}" -ge 500 ] || falla "Hace falta al menos 500 MB libres en el disco."
hecho "macOS $(sw_vers -productVersion 2>/dev/null), procesador $ARQ, ${LIBRE} MB libres"

# ---- 2. Node.js: el de Manna si ya está; si no, el oficial (se instala en Programa/node en el paso 4) ----
paso 2 "Node.js, el motor de Manna"
node_ok() { [ -x "$1" ] && "$1" -e "process.exit(Number(process.versions.node.split('.')[0]) >= $NODE_MAYOR ? 0 : 1)" 2>/dev/null; }
NODE=""
for CANDIDATO in "$AQUI/../node/bin/node" "$AQUI/Programa/node/bin/node" "${LANZADO:+$LANZADO/../node/bin/node}"; do
  if [ -n "$CANDIDATO" ] && node_ok "$CANDIDATO"; then NODE="$CANDIDATO"; break; fi
done
NUEVO=""
if [ -n "$NODE" ]; then
  hecho "Ya está el de Manna ($("$NODE" --version))."
else
  HUELLAS="$(curl -fsSL "$NODE_DESCARGA/SHASUMS256.txt")" || falla "No se pudo descargar Node.js. Comprueba que este equipo tiene internet y vuelve a intentarlo."
  LINEA="$(printf '%s\n' "$HUELLAS" | grep -E " node-v[0-9.]+-darwin-$ARQ\.tar\.gz$" | head -1)"
  [ -n "$LINEA" ] || falla "No se encontró Node.js para este Mac en nodejs.org."
  HUELLA="${LINEA%% *}"; ARCHIVO="${LINEA##* }"
  echo "        Descargando ${ARCHIVO%.tar.gz}…"
  if [ -t 1 ] && [ -z "$MANNA_PKG" ]; then BARRA=(--progress-bar); else BARRA=(-sS); fi
  curl -fL "${BARRA[@]}" "$NODE_DESCARGA/$ARCHIVO" -o "$TEMPORAL/$ARCHIVO" || falla "No se pudo descargar Node.js. Comprueba que este equipo tiene internet y vuelve a intentarlo."
  [ "$(shasum -a 256 "$TEMPORAL/$ARCHIVO" | awk '{ print $1 }')" = "$HUELLA" ] || falla "La descarga de Node.js llegó dañada (su huella no coincide). Vuelve a intentarlo."
  mkdir -p "$TEMPORAL/node" && tar -xzf "$TEMPORAL/$ARCHIVO" -C "$TEMPORAL/node" --strip-components 1 || falla "No se pudo abrir la descarga de Node.js."
  NODE="$TEMPORAL/node/bin/node"; NUEVO="$TEMPORAL/node"
  node_ok "$NODE" || falla "El Node.js descargado no arranca en este Mac."
  hecho "Node.js $("$NODE" --version), comprobado."
fi

# ---- 3. Manna ----
paso 3 "Descargando Manna"
if [ -t 1 ] && [ -z "$MANNA_PKG" ]; then BARRA=(--progress-bar); else BARRA=(-sS); fi
curl -fL "${BARRA[@]}" "$DESCARGA" -o "$TEMPORAL/manna.zip" || falla "No se pudo descargar Manna. Comprueba que este equipo tiene internet y vuelve a intentarlo."
ditto -x -k "$TEMPORAL/manna.zip" "$TEMPORAL/abierto" || falla "La descarga llegó dañada. Vuelve a intentarlo."
ORIGEN="$(find "$TEMPORAL/abierto" -mindepth 2 -maxdepth 3 -path '*/server/index.js' | head -1)"
[ -n "$ORIGEN" ] || falla "La descarga no contiene Manna. Vuelve a intentarlo."
ORIGEN="$(dirname "$(dirname "$ORIGEN")")"
hecho "Manna $("$NODE" -p "require('$ORIGEN/package.json').version" 2>/dev/null)"

# ---- 4. La carpeta Manna: cierra el Manna abierto, mueve lo de antes y la ordena (instalacion/ordenar.mjs) ----
paso 4 "Ordenando la carpeta Manna"
HECHO="$(NODE_NO_WARNINGS=1 "$NODE" "$ORIGEN/instalacion/ordenar.mjs" --origen "$ORIGEN" --oculta "$OCULTA" --documentos "$DOCUMENTOS" --aqui "$AQUI" ${LANZADO:+--lanzador "$LANZADO"} ${MANNA_INSTALADOR:+--instalador "$MANNA_INSTALADOR"} | tail -1)"
dato() { "$NODE" -e "const d = JSON.parse(process.argv[1] || '{}'); const v = d[process.argv[2]]; process.stdout.write(Array.isArray(v) ? v.join('\n') : v == null ? '' : String(v))" "$HECHO" "$1"; }
[ -n "$HECHO" ] || falla "No se pudo ordenar la carpeta de Manna. Vuelve a intentarlo."
[ -z "$(dato error)" ] || falla "$(dato error)"
PROGRAMA="$(dato programa)"; CONTENIDO="$(dato contenido)"; RAIZ="$(dato raiz)"
# Node.js va junto al programa, en Programa/node; si se acaba de bajar, reemplaza al de antes.
MOTOR="$(dirname "$PROGRAMA")/node"
if [ -n "$NUEVO" ]; then
  rm -rf "$MOTOR" && mv "$NUEVO" "$MOTOR" || falla "No se pudo dejar Node.js en $MOTOR."
  NODE="$MOTOR/bin/node"
fi
hecho "Manna está en $RAIZ"
hecho "Carpeta de contenido: $CONTENIDO"
[ -z "$(dato dominio)" ] || hecho "Conexión por internet con tu dominio: $(dato dominio)"
[ -z "$(dato emparejar)" ] || hecho "Será el equipo principal de $(dato emparejar): se conecta con su nube al abrirse"

# Los dos instaladores de la carpeta, con el icono de Manna y su engranaje.
osascript -l JavaScript - "$PROGRAMA/instalacion/icono/instalar.icns" "$RAIZ/Instalar Manna en Mac.command" "$RAIZ/Instalar Manna en Windows.bat" >/dev/null 2>&1 <<'ICONO'
ObjC.import('AppKit');
function run(argv) {
  const image = $.NSImage.alloc.initWithContentsOfFile(argv[0]);
  for (const file of argv.slice(1)) $.NSWorkspace.sharedWorkspace.setIconForFileOptions(image, file, 0);
}
ICONO

# ---- 5. La app Manna ----
paso 5 "Creando la app «Manna»"
DESTINO="${MANNA_DESTINO:-/Applications}"
if [ -z "$MANNA_DESTINO" ] && [ ! -w "$DESTINO" ]; then DESTINO="$HOME/Applications"; fi
mkdir -p "$DESTINO"
APP="$DESTINO/Manna.app"

# Solo se reemplaza una app creada por Manna.
if [ -e "$APP" ] && [ ! -f "$APP/Contents/Resources/creada-por-manna" ]; then
  falla "Ya existe otra app llamada Manna en $DESTINO y no es de este programa. Muévela o cámbiale el nombre y vuelve a intentarlo."
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
  <key>CFBundleURLTypes</key><array><dict><key>CFBundleURLName</key><string>Manna</string><key>CFBundleURLSchemes</key><array><string>manna</string></array></dict></array>
</dict>
</plist>
PLIST

# La app es un lanzador mínimo: arranca el servidor sin ventana, con el Node.js de Manna (o el del equipo, en
# una instalación de antes de la 1.35), y termina. Si Manna ya está abierto, el propio servidor lo detecta y
# solo vuelve a mostrar el control. La conexión por internet, si está encendida en Ajustes, la abre Manna.
{
  echo '#!/bin/bash'
  echo 'export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"'
  printf 'PROYECTO=%q\n' "$PROGRAMA"
  cat <<'LANZADOR'
aviso() { osascript -e "display alert \"Manna\" message \"$1\"" >/dev/null 2>&1; }
if ! cd "$PROYECTO" 2>/dev/null || [ ! -f server/index.js ]; then
  aviso "No se encuentra Manna. Vuelve a instalarlo con Instalar-Manna-Mac.pkg, de GitHub."
  exit 1
fi
NODE="$PROYECTO/../node/bin/node"
[ -x "$NODE" ] || NODE="$(command -v node)"
if [ -z "$NODE" ]; then
  open "instalacion/requisitos.html"
  exit 1
fi
nohup "$NODE" server/index.js --segundo-plano >/dev/null 2>&1 &
LANZADOR
} > "$APP/Contents/MacOS/Manna"
chmod +x "$APP/Contents/MacOS/Manna"
touch "$APP"
hecho "App «Manna» en $DESTINO"

if [ -z "$MANNA_DESTINO" ]; then
  ln -sfn "$APP" "$HOME/Desktop/Manna"
  hecho "Acceso «Manna» en el Escritorio"
  [ -z "$MANNA_PKG" ] && open "$APP"
fi

echo ""
echo "  ${V}╭──────────────────────────────────────────────────╮${N}"
echo "  ${V}│${N}   ✓ LISTO. Manna se está abriendo.               ${V}│${N}"
echo "  ${V}╰──────────────────────────────────────────────────╯${N}"
echo "  - La próxima vez, ábrelo con el icono «Manna» del Escritorio o de"
echo "    Aplicaciones (para tenerlo a mano, arrástralo al Dock)."
echo "  - Dentro de Manna, en Ajustes → «Carpeta de contenido», elige la carpeta"
echo "    de tu iglesia (biblias, himnario y medios). Ahora es:"
echo "    $CONTENIDO"
echo "  - Desde Manna también se reinicia, se apaga y se actualiza."
if [ -n "$(dato antiguo)" ]; then
  echo "  - Lo de la versión anterior que ya no se usa quedó en:"
  echo "    $(dato antiguo)"
fi
dato avisos | while IFS= read -r AVISO; do [ -n "$AVISO" ] && echo "  - $AVISO"; done
echo ""
pausa
}
main "$@"; exit $?
