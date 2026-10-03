#!/bin/bash
# Lanzador para macOS: doble clic para iniciar Manna.
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"

falta() {
  echo ""
  echo "=========================================================="
  echo "  NO SE PUEDE INICIAR MANNA"
  echo "=========================================================="
  echo "  $1"
  echo "  Descárgalo aquí: $2"
  echo ""
  echo "  Se abrió una página con las instrucciones paso a paso."
  echo "  Cuando termines de instalar, vuelve a abrir este archivo."
  echo "=========================================================="
  open "instalar.html"
  read -n 1 -s -r -p "Pulsa cualquier tecla para cerrar..."
  exit 1
}

command -v node >/dev/null 2>&1 || falta "Falta Node.js (el programa que hace funcionar el servidor)." "https://nodejs.org/es/download"
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)" \
  || falta "Tu versión de Node.js es muy antigua. Instala la versión LTS actual." "https://nodejs.org/es/download"

node server/index.js
echo ""
read -n 1 -s -r -p "Manna se detuvo. Pulsa cualquier tecla para cerrar..."
