# Pruebas

## Automáticas

- `npm test` (usa `node --test`, sin librerías). Deben pasar antes de cualquier commit.
- Toda lógica pura del servidor lleva prueba en `test/<tema>.test.js`: lectura de formatos, citas, búsquedas, validaciones, cálculos.
- Lo que pasa por HTTP (rutas, acciones, permisos, archivos) se prueba contra el servidor de verdad en `test/servidor.test.js`: crea la app con datos temporales y la atiende con `app.handle`, sin llamar a `listen()`, así que no abre ventanas ni se anuncia en la red.
- Las pruebas crean sus datos en carpetas temporales. No dependen de `Contenido/` ni de `data/`, ni de internet (las descargas se prueban contra un servidor en el propio equipo).
- Un hook corre las pruebas automáticamente al editar `server/` o `test/`.

## En navegador

Lo que tiene interfaz se prueba en el navegador antes de darlo por hecho. Procedimiento en la skill `/probar`. Mínimo:

- Escritorio y celular (375 px).
- Consola sin errores.
- El cambio se refleja en otro dispositivo (abrir `/proyeccion` en otra pestaña).
- Permisos: un rol sin permiso recibe error y no ve el control.

Usar siempre un servidor de prueba con `MANNA_DATA` temporal, `PORT=8123` y `MANNA_NAME=manna-prueba`, para no tocar el PIN, el orden del culto ni los ajustes reales, ni chocar con un Manna en uso.

## En un Chrome real

- `node scripts/probar-chrome.mjs rapido` recorre la revisión del equipo y la interfaz como un usuario: Biblia y su búsqueda, orden del culto, mandos en vivo, ajustes y permisos (1 min). Usa sus propias biblias (la RV1909 y una versión de prueba de dos versículos), no las de `Contenido/Biblias/`. Ejecutarlo tras cualquier cambio en `web/`. Usa los puertos 8123 y 8125: si la demostración está abierta, se niega a empezar.
- `node scripts/probar-chrome.mjs` añade lo que un navegador integrado no puede comprobar: el paso a la dirección con nombre, el aviso al cerrar y la reconexión tras un cambio de IP (3 min). Ejecutarlo al tocar la conexión, las direcciones o la navegación entre páginas.
- `node scripts/auditar-responsive.mjs` abre la app en nueve tamaños (celular, tableta, escritorio) y verifica las garantías de `DESIGN.md`. Ejecutarlo al tocar cualquier disposición.

Lo que habla con un equipo de la red (un televisor) se prueba contra uno de mentira: `scripts/lib/tv-falso.mjs` responde como un Samsung y apunta lo que recibe. Lo usan `test/tv.test.js` y los dos guiones de Chrome. Nunca se deja que una prueba salga a la red de verdad.

Una prueba nueva de interfaz se añade a `scripts/probar-chrome.mjs`; un tamaño o una pantalla nuevos, a `scripts/auditar-responsive.mjs`.

## Honestidad al informar

Decir explícitamente qué se probó y qué no. Lo que no se pueda probar en el equipo de desarrollo (segunda pantalla, Windows, celular real) se anota en la tabla "Probado y sin probar" de `docs/ESTADO.md`.
