#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo "          INICIANDO PROYECTOR BÍBLICO LOCAL"
echo "=========================================================="
echo "Abriendo la aplicación en tu navegador web..."
echo "Directorio: $DIR"
echo "Servidor: http://localhost:8000"
echo "=========================================================="

# Abrir el navegador tras 1 segundo
(sleep 1 && open "http://localhost:8000/index.html") &

# Ejecutar el servidor web local con Python
python3 -m http.server 8000
