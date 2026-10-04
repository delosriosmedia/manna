# Pruebas

## Automáticas

- `npm test` (usa `node --test`, sin librerías). Deben pasar antes de cualquier commit.
- Toda lógica pura del servidor lleva prueba en `test/<tema>.test.js`: lectura de formatos, citas, búsquedas, validaciones, cálculos.
- Las pruebas crean sus datos en carpetas temporales. No dependen de `Biblias/` ni de `data/`.
- Un hook corre las pruebas automáticamente al editar `server/` o `test/`.

## En navegador

Lo que tiene interfaz se prueba en el navegador antes de darlo por hecho. Procedimiento en la skill `/probar`. Mínimo:

- Escritorio y celular (375 px).
- Consola sin errores.
- El cambio se refleja en otro dispositivo (abrir `/proyeccion` en otra pestaña).
- Permisos: un rol sin permiso recibe error y no ve el control.

Usar siempre un servidor de prueba con `MANNA_DATA` temporal, `PORT=8123` y `MANNA_NAME=manna-prueba`, para no tocar el PIN, el orden del culto ni los ajustes reales, ni chocar con un Manna en uso.

## En un Chrome real

- `node scripts/probar-chrome.mjs rapido` recorre la interfaz como un usuario: Biblia, orden del culto, ajustes y permisos (30 s). Ejecutarlo tras cualquier cambio en `web/`.
- `node scripts/probar-chrome.mjs` añade lo que un navegador integrado no puede comprobar: el paso a la dirección con nombre, el aviso al cerrar y la reconexión tras un cambio de IP (3 min). Ejecutarlo al tocar la conexión, las direcciones o la navegación entre páginas.
- `node scripts/auditar-responsive.mjs` abre la app en nueve tamaños (celular, tableta, escritorio) y verifica las garantías de `DESIGN.md`. Ejecutarlo al tocar cualquier disposición.

Una prueba nueva de interfaz se añade a `scripts/probar-chrome.mjs`; un tamaño o una pantalla nuevos, a `scripts/auditar-responsive.mjs`.

## Honestidad al informar

Decir explícitamente qué se probó y qué no. Lo que no se pueda probar en el equipo de desarrollo (segunda pantalla, Windows, celular real) se anota en la tabla "Probado y sin probar" de `docs/ESTADO.md`.
