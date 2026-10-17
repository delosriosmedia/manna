# Pruebas

## Automáticas

- `npm test` (usa `node --test`, sin librerías). Deben pasar antes de cualquier commit.
- Toda lógica pura del servidor lleva prueba en `test/<tema>.test.js`: lectura de formatos, citas, búsquedas, validaciones, cálculos.
- Lo que pasa por HTTP (rutas, acciones, permisos, archivos) se prueba contra el servidor de verdad en `test/servidor.test.js`: crea la app con datos temporales y la atiende con `app.handle`, sin llamar a `listen()`, así que no abre ventanas ni se anuncia en la red.
- Las pruebas crean sus datos en carpetas temporales. No dependen de `Contenido/` ni de `data/`, ni de internet (las descargas se prueban contra un servidor en el propio equipo).
- Un hook corre la revisión del código sin ejecutarlo (abajo; 1 s) al editar `server/`, `web/`, `scripts/` o `test/`. `npm test` entero (unos 30 s; varios minutos con el equipo ocupado) se corre al terminar cada cambio, no en cada edición.
- **Revisión del código sin ejecutarlo** (`test/codigo.test.js`, con `scripts/lib/codigo.mjs`): falla si un archivo importa algo que el otro no ofrece, si una variable o un parámetro lleva el nombre de algo importado (así se rompió la subida del fondo: un campo `upload` tapaba la función `upload`), o si la interfaz envía una orden o pide una dirección que el servidor no tiene. Un fallo aquí se arregla cambiando el nombre o el código, no aflojando la regla.
- Lo que Manna le pide a una ventana de Chrome por el protocolo de depuración (las flechas a una página web) se prueba con un Chrome sin ventana de verdad: `test/teclas.test.js` (se salta, diciéndolo, si el equipo no tiene Chrome ni Edge).
- Lo que solo pasa entre arranques (notar una actualización, relevar a una copia anterior, reiniciar) se prueba con procesos de verdad sobre una copia del programa: `test/arranque.test.js`.

## En navegador

Lo que tiene interfaz se prueba en el navegador antes de darlo por hecho. Procedimiento en la skill `/probar`. Mínimo:

- Escritorio y celular (375 px).
- Consola sin errores.
- El cambio se refleja en otro dispositivo (abrir `/proyeccion` en otra pestaña).
- Permisos: un rol sin permiso recibe error y no ve el control.

Usar siempre un servidor de prueba con `MANNA_DATA` temporal, `PORT=8123`, `MANNA_NAME=manna-prueba` y **`MANNA_SIN_VENTANA=1`** (si no, con un proyector conectado la prueba se proyecta y suena en él: pasó el 2026-10-04), para no tocar el PIN, el orden del culto ni los ajustes reales, ni chocar con un Manna en uso.

## En un Chrome real

- `node scripts/probar-chrome.mjs` recorre la revisión del equipo y la interfaz como un usuario, y lo que un navegador integrado no puede comprobar: el paso a la dirección con nombre, el PIN y la escucha desde otro dispositivo, el aviso al cerrar y la reconexión tras un cambio de IP. Corre en **tres grupos a la vez**, cada uno con su servidor, su nombre en la red y su Chrome: «control» (Biblia, orden, escenario, ajustes, mandos, alabanza, PIN, escuchar y salir; puerto 8123), «biblioteca» (imágenes, videos y audios, diapositivas, presentador, páginas web y el cierre; 8131) y «red» (revisión del equipo, en el 8125, YouTube, himnario y cambio de IP; 8133). Tarda lo que el grupo más largo, menos de 3 min (2026-10-15: 168, 150 y 128 s). Con nombres corre solo esos grupos (`node scripts/probar-chrome.mjs biblioteca`), y con `rapido` se salta los pasos 2 a 4. Al final junta lo vigilado: una orden o una dirección sin usar es la que no usó ningún grupo (solo con los tres y sin `rapido`). Un dato que un grupo necesita de otro (un versículo en el orden, un video subido) lo crea él al empezar, por la API. Usa sus propias biblias (la RV1909 y una versión de prueba de dos versículos), no las de `Contenido/Biblias/`. Si la demostración está abierta en uno de sus puertos, se niega a empezar.
- **Antes de ejecutarlo, cerrar toda pestaña que quedara abierta en `localhost:8123`** (la demostración, una prueba a mano), **también la del navegador integrado del asistente: detener el servidor no basta, hay que cerrar la pestaña** (`tabs_close`). Aunque su servidor ya no exista, la página se reconecta sola al de la prueba y cuenta como una pantalla más del equipo principal. Pasó dos veces el 2026-10-10: la pestaña se quedó con el sonido e hizo fallar «sin ventana de proyección, el sonido sale por el control» (se reconoce en el detalle del fallo: `"suena":"c1"` cuando la prueba es `c2`), y hubo que repetir la prueba entera, con su gasto de tiempo y de tokens. El orden que lo evita: mirar en el navegador → **cerrar la pestaña** → detener la demostración → ejecutar el guion.
- `node scripts/auditar-responsive.mjs` abre la app en diez tamaños (celular, tableta, escritorio) y verifica las garantías de `DESIGN.md` (unos 4 min). Reparte los tamaños entre tres Chrome a la vez, cada uno con su servidor (puertos 8124, 8126 y 8128), y cada tamaño empieza sin preferencias guardadas, como un dispositivo nuevo: así el resultado no depende del orden. Comprueba también que ningún panel se desplace de lado sin tener nada al lado, los cajones en su tamaño más pequeño, que las capas («Buscar en todo», los mandos) se cierren al tocar fuera, y el **contraste sobre fondos cambiantes**: el texto de lo que flota sobre la proyección tiene que leerse (4,5:1, o 3:1 si es grande) con una diapositiva blanca detrás y con una negra; se compone cada capa de cristal y la sombra de arriba y de abajo, y lo que otra capa tapa o tiene fondo opaco no cuenta. Con palabras revisa solo las pantallas y los tamaños cuyo nombre las lleva: `node scripts/auditar-responsive.mjs biblia 360x640 844x390 1280x720`.

## Cuántas pruebas y cuándo

Por niveles, para no esperar de más:

- **En cada edición**: la revisión del código (el hook, 1 s).
- **Al terminar un cambio**: `npm test` y, si toca la interfaz, la auditoría de las pantallas tocadas en los tres tamaños que más fallan (`360x640 844x390 1280x720`), en total unos 2 min; si el cambio tiene comprobaciones en Chrome, el grupo que las lleva.
- **Al cerrar una parte o una fase, y antes de publicar**: todo una vez: `npm test`, `node scripts/probar-chrome.mjs` y la auditoría entera. Las dos últimas pueden correr a la vez (usan puertos distintos): unos 4 min en total.

Una orden a Chrome que no se contesta en 60 s hace fallar el guion (`scripts/lib/chrome.mjs`), en vez de dejarlo esperando: el 2026-10-15 un «¿Salir del sitio?» sin aceptar dejó la prueba colgada casi dos horas. Una prueba que termina en una página con cambios la deja (o acepta el aviso) antes de seguir. Una prueba larga se lanza en segundo plano y se espera el aviso de que terminó. **Nunca se espera con un bucle que busque el proceso por su nombre** (`pgrep -f probar-chrome…`): la línea de órdenes de otra espera también lleva ese nombre, así que las esperas se encuentran entre sí y no terminan. Pasó el 2026-10-14 y el 2026-10-15, con esperas de hasta tres horas y media que el dueño tuvo que parar.

Lo que habla con un equipo de la red (un televisor) se prueba contra uno de mentira: `scripts/lib/tv-falso.mjs` responde como un Samsung y apunta lo que recibe. Lo usan `test/tv.test.js` y los dos guiones de Chrome. Nunca se deja que una prueba salga a la red de verdad.

Lo que descarga de internet (YouTube) se prueba con un programa de mentira: `scripts/lib/yt-dlp-falso.mjs` escribe un yt-dlp que dice el título y el avance, fabrica el video con ffmpeg y deja subtítulos "automáticos" como los de YouTube; falla como un video privado si el identificador empieza por `privado`. Se pone en `data/herramientas/` del servidor de prueba, que arranca con `MANNA_FALTA=yt-dlp` para que el yt-dlp de verdad del equipo no se use nunca. Lo usan `test/youtube.test.js` y la prueba en Chrome. **Una descarga real de YouTube no forma parte de ninguna prueba.**

La conexión por internet se prueba con un cloudflared de mentira (`scripts/lib/cloudflared-falso.mjs`, en la carpeta de programas de la prueba y con `MANNA_FALTA=cloudflared`): da la dirección de un túnel rápido, «se registra» y falla como una clave no válida si la clave empieza por «malo». **Ninguna prueba abre un túnel de verdad.** Los instaladores aceptan `MANNA_DESCARGA` (un `.zip` local con `file://`), `MANNA_BASE`, `MANNA_DOCUMENTOS` y `MANNA_DESTINO` para probarlos en carpetas temporales sin tocar el equipo.

El himnario de las pruebas, la auditoría y la demostración es **inventado**: `scripts/lib/himnario-falso.mjs` fabrica los videos (con dos pistas de sonido, como los de verdad) y escribe títulos y letras que no son de ningún himnario, con los casos difíciles dentro (una letra con otro título que su video, un himno sin letra, uno sin video, uno sin pista), categorías con sección («El día: …») y diapositivas inventadas en cuatro himnos (para «Letras sin música»). Todo guion que arranca un servidor le pasa `MANNA_HIMNARIO`; si no, leería el de `Contenido/`. El Chrome de las pruebas va con el sonido apagado (`--mute-audio`).

Los PDF que necesita una prueba se fabrican en el momento con `scripts/lib/pdf.mjs` (`makePdf`), y el Chrome de la prueba los convierte de verdad con pdf.js. PowerPoint se sustituye por un guion (`scripts/lib/powerpoint-falso.mjs`, con `MANNA_POWERPOINT_PRUEBA`) que deja las imágenes como las dejaría el de verdad y que, con `MANNA_PPT_MODO=vivo`, hace también de pase en vivo (una animación en la diapositiva 2; apunta cada orden en `pase.jsonl` y, si aparece `pase.jsonl.mover`, «alguien» la pasa en el equipo). Con él, PowerPoint en vivo se prueba en cualquier sistema y sin segunda pantalla; ninguna prueba abre el PowerPoint del equipo.

Los videos y audios que necesita una prueba se fabrican en el momento con ffmpeg (un patrón de colores con un tono bajo, de pocos segundos). Donde no hay ffmpeg, esas pruebas se saltan diciéndolo, y lo que Manna hace sin ffmpeg se prueba siempre (con `MANNA_FALTA=ffmpeg`).

Las imágenes que necesita una prueba se fabrican en el momento con `scripts/lib/png.mjs` (`makePng`, `examplePoster`): no se guardan imágenes en el repositorio ni se usan las de ninguna iglesia. Los datos de ejemplo (`scripts/lib/ejemplo.mjs`) se escriben **antes** de arrancar el servidor, que los lee al abrirse.

Una prueba nueva de interfaz se añade a `scripts/probar-chrome.mjs`; un tamaño o una pantalla nuevos, a `scripts/auditar-responsive.mjs`.

Lo que un guion lanza (el Chrome sin ventana, los servidores de prueba) se registra con `killOnExit()` de `scripts/lib/chrome.mjs`, para que se cierre con el guion aunque lo corten a medias. El 2026-10-05 se encontraron tres Chrome sin ventana de pruebas interrumpidas, y como el puerto de control era fijo, las pruebas siguientes se enganchaban al más antiguo; ahora cada Chrome usa un puerto libre.

## Lo que vigila la prueba en Chrome

Además de sus comprobaciones, `scripts/probar-chrome.mjs` vigila toda la sesión y falla si:

- algún botón responde con un **aviso de error que no se esperaba** (un error dentro de `guard()` no rompe la página: solo sale un aviso, y por eso pasó inadvertido). Un error provocado a propósito se declara antes con `expectError('trozo del texto')`;
- hay un **error de JavaScript** en cualquier pantalla;
- queda alguna **orden o dirección del servidor que la interfaz no usó pulsando** (solo en la prueba completa). Lo que de verdad no se puede pulsar ahí va en `UNTOUCHED`, con su motivo.

**Una comprobación no puede pasar en vacío.** "Todas las miniaturas cargaron la imagen pequeña" es cierto también cuando aún no hay ninguna miniatura (se ve el esqueleto de carga): antes de un `every()` se comprueba cuántos elementos hay. Así pasó inadvertido, el 2026-10-05, que las miniaturas del orden pedían la imagen grande.

**Regla**: una orden o un botón nuevos no están hechos hasta que la prueba en Chrome los pulsa. Probar la ruta por HTTP no basta: el fallo del fondo estaba en la pantalla, no en el servidor.

## Honestidad al informar

Decir explícitamente qué se probó y qué no. Lo que no se pueda probar en el equipo de desarrollo (segunda pantalla, Windows, celular real) se anota en la tabla "Probado y sin probar" de `docs/ESTADO.md`.
