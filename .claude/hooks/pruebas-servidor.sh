#!/bin/bash
# Hook PostToolUse: al editar código (servidor, interfaz, guiones o pruebas), corre la revisión del
# código sin ejecutarlo (test/codigo.test.js, 1 s). Si falla, devuelve el resultado al asistente
# (código 2) para que lo corrija de inmediato. Todas las pruebas (`npm test`, de 30 s a varios minutos
# con el equipo ocupado) se corren al terminar cada cambio, no en cada edición.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
command -v node >/dev/null 2>&1 || exit 0

file=$(node -e '
  let s = "";
  process.stdin.on("data", (d) => { s += d; }).on("end", () => {
    try { console.log(JSON.parse(s).tool_input.file_path || ""); } catch { console.log(""); }
  });
')

# También la interfaz y los guiones: la revisión mira su código aunque no se ejecute en Node.
case "$file" in
  */web/vendor/*) exit 0 ;;
  */server/*.js|*/test/*.js|*/web/*.js|*/scripts/*.mjs|*/scripts/*.js) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
if ! out=$(node --test test/codigo.test.js 2>&1); then
  echo "La revisión del código falla después de editar $file:" >&2
  echo "$out" | tail -40 >&2
  exit 2
fi
exit 0
