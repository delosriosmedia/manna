# Pruebas

## Automáticas

- `npm test` (usa `node --test`, sin librerías). Deben pasar antes de cualquier commit.
- Toda lógica pura del servidor lleva prueba en `test/<tema>.test.js`: lectura de formatos, citas, búsquedas, validaciones, cálculos.
- Lo que pasa por HTTP (rutas, acciones, permisos, archivos) se prueba contra el servidor de verdad en `test/servidor.test.js`: crea la app con datos temporales y la atiende con `app.handle`, sin llamar a `listen()`, así que no abre ventanas ni se anuncia en la red.
- Las pruebas crean sus datos en carpetas temporales. No dependen de `Contenido/` ni de `data/`, ni de internet (las descargas se prueban contra un servidor en el propio equipo).
- Un hook corre las pruebas automáticamente al editar `server/`, `web/`, `scripts/` o `test/`.
- **Revisión del código sin ejecutarlo** (`test/codigo.test.js`, con `scripts/lib/codigo.mjs`): falla si un archivo importa algo que el otro no ofrece, si una variable o un parámetro lleva el nombre de algo importado (así se rompió la subida del fondo: un campo `upload` tapaba la función `upload`), o si la interfaz envía una orden o pide una dirección que el servidor no tiene. Un fallo aquí se arregla cambiando el nombre o el código, no aflojando la regla.
- Lo que solo pasa entre arranques (notar una actualización, relevar a una copia anterior, reiniciar) se prueba con procesos de verdad sobre una copia del programa: `test/arranque.test.js`.

## En navegador

Lo que tiene interfaz se prueba en el navegador antes de darlo por hecho. Procedimiento en la skill `/probar`. Mínimo:

- Escritorio y celular (375 px).
- Consola sin errores.
- El cambio se refleja en otro dispositivo (abrir `/proyeccion` en otra pestaña).
- Permisos: un rol sin permiso recibe error y no ve el control.

Usar siempre un servidor de prueba con `MANNA_DATA` temporal, `PORT=8123`, `MANNA_NAME=manna-prueba` y **`MANNA_SIN_VENTANA=1`** (si no, con un proyector conectado la prueba se proyecta y suena en él: pasó el 2026-10-04), para no tocar el PIN, el orden del culto ni los ajustes reales, ni chocar con un Manna en uso.

## En un Chrome real

- `node scripts/probar-chrome.mjs rapido` recorre la revisión del equipo y la interfaz como un usuario: Biblia y su búsqueda, orden del culto, mandos en vivo, ajustes y permisos (1 min). Usa sus propias biblias (la RV1909 y una versión de prueba de dos versículos), no las de `Contenido/Biblias/`. Ejecutarlo tras cualquier cambio en `web/`. Usa los puertos 8123 y 8125: si la demostración está abierta, se niega a empezar.
- `node scripts/probar-chrome.mjs` añade lo que un navegador integrado no puede comprobar: el paso a la dirección con nombre, el aviso al cerrar y la reconexión tras un cambio de IP (3 min). Ejecutarlo al tocar la conexión, las direcciones o la navegación entre páginas.
- `node scripts/auditar-responsive.mjs` abre la app en nueve tamaños (celular, tableta, escritorio) y verifica las garantías de `DESIGN.md`. Ejecutarlo al tocar cualquier disposición.

Lo que habla con un equipo de la red (un televisor) se prueba contra uno de mentira: `scripts/lib/tv-falso.mjs` responde como un Samsung y apunta lo que recibe. Lo usan `test/tv.test.js` y los dos guiones de Chrome. Nunca se deja que una prueba salga a la red de verdad.

Los videos y audios que necesita una prueba se fabrican en el momento con ffmpeg (un patrón de colores con un tono bajo, de pocos segundos). Donde no hay ffmpeg, esas pruebas se saltan diciéndolo, y lo que Manna hace sin ffmpeg se prueba siempre (con `MANNA_FALTA=ffmpeg`).

Las imágenes que necesita una prueba se fabrican en el momento con `scripts/lib/png.mjs` (`makePng`, `examplePoster`): no se guardan imágenes en el repositorio ni se usan las de ninguna iglesia. Los datos de ejemplo (`scripts/lib/ejemplo.mjs`) se escriben **antes** de arrancar el servidor, que los lee al abrirse.

Una prueba nueva de interfaz se añade a `scripts/probar-chrome.mjs`; un tamaño o una pantalla nuevos, a `scripts/auditar-responsive.mjs`.

## Lo que vigila la prueba en Chrome

Además de sus comprobaciones, `scripts/probar-chrome.mjs` vigila toda la sesión y falla si:

- algún botón responde con un **aviso de error que no se esperaba** (un error dentro de `guard()` no rompe la página: solo sale un aviso, y por eso pasó inadvertido). Un error provocado a propósito se declara antes con `expectError('trozo del texto')`;
- hay un **error de JavaScript** en cualquier pantalla;
- queda alguna **orden o dirección del servidor que la interfaz no usó pulsando** (solo en la prueba completa). Lo que de verdad no se puede pulsar ahí va en `UNTOUCHED`, con su motivo.

**Regla**: una orden o un botón nuevos no están hechos hasta que la prueba en Chrome los pulsa. Probar la ruta por HTTP no basta: el fallo del fondo estaba en la pantalla, no en el servidor.

## Honestidad al informar

Decir explícitamente qué se probó y qué no. Lo que no se pueda probar en el equipo de desarrollo (segunda pantalla, Windows, celular real) se anota en la tabla "Probado y sin probar" de `docs/ESTADO.md`.
