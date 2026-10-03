#!/bin/bash
# Hook PostToolUse: al editar archivos del servidor o de pruebas, corre las pruebas.
# Si fallan, devuelve el resultado al asistente (código 2) para que lo corrija de inmediato.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
command -v node >/dev/null 2>&1 || exit 0

file=$(node -e '
  let s = "";
  process.stdin.on("data", (d) => { s += d; }).on("end", () => {
    try { console.log(JSON.parse(s).tool_input.file_path || ""); } catch { console.log(""); }
  });
')

case "$file" in
  */server/*.js|*/test/*.js) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
if ! out=$(node --test test/ 2>&1); then
  echo "Las pruebas fallan después de editar $file:" >&2
  echo "$out" | tail -40 >&2
  exit 2
fi
exit 0
