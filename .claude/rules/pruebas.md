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

Usar siempre un servidor de prueba con `MANNA_DATA` temporal, `PORT=8123` y `MANNA_NAME=manna-prueba`, para no tocar el PIN, el guion ni los ajustes reales, ni chocar con un Manna en uso.

## En un Chrome real

`node scripts/probar-chrome.mjs` comprueba lo que el navegador integrado no puede: el paso a la dirección con nombre, el aviso al cerrar la pestaña y la reconexión tras un cambio de IP. Ejecutarlo al tocar la conexión, las direcciones o la navegación entre páginas.

## Honestidad al informar

Decir explícitamente qué se probó y qué no. Lo que no se pueda probar en el equipo de desarrollo (segunda pantalla, Windows, celular real) se anota en la tabla "Probado y sin probar" de `docs/ESTADO.md`.
