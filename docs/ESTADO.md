# Estado del proyecto

Última actualización: 2026-10-05 · Versión: 1.8.0

Este documento es la foto actual del proyecto. Se actualiza con cada cambio (ver `.claude/rules/documentacion.md`). El historial está en `CHANGELOG.md`.

## Qué funciona

- Servidor en red local con estado central y tiempo real.
- **Interfaz en tres zonas** (ver `DESIGN.md`): barra de módulos, espacio de trabajo y panel "Al aire" con monitor y mandos. Adaptada a celular (vertical y horizontal), tableta y escritorio.
- Módulos: `system`, `bible`, `projection`, `order`, `media`, `slides`, `tv`. En la interfaz: Orden, Biblia, Comparador, Medios, Diapositivas y Ajustes; Himnario aparece atenuado como previsto. Televisores existe pero está fuera de la barra (en pausa).
- **Versión 2 en construcción**, por fases, según `docs/PLAN.md`. Hechas las fases 0 (cimientos), 1 (búsqueda), 2 (comparador), 4 (imágenes), 6 (videos y audios), 7 (YouTube) y 8 (diapositivas). **El trabajo está detenido aquí, por decisión del dueño, para que haga sus pruebas**; después se revisa la 5 (himnario, pospuesta) y queda la 9 (auditoría). La 3 (televisores) está construida pero **en pausa por decisión del dueño**: no logró que su televisor mostrara la proyección.
- **Carpeta de la iglesia**: todo lo que pone cada iglesia va en `Contenido/` (`Biblias/`, `Himnario/videos/`, `Himnario/letras/`), con un `LEEME.txt` por carpeta. Nada de ahí se publica, salvo las instrucciones y la Reina-Valera 1909.
- Roles por dispositivo: control completo, control del orden (solo operar), pantalla de proyección. PIN para los de control (el equipo principal no lo necesita).
- **Logo e identidad**: el logo del dueño, en vector, integrado en la interfaz, los iconos del sistema y la pestaña del navegador. La versión se muestra junto al logo y sale de `package.json`.
- **Biblia**: pasajes recientes, rejilla de libros, capítulos, versículos con selección de varios, vista previa en el panel.
- **Búsqueda en la Biblia**: mientras se escribe. Una cita ("jn 3 16") lleva al pasaje. Un texto se busca **solo en la Reina-Valera 1960** (en la versión elegida, si no está instalada) y sale por niveles: frase exacta, todas las palabras y parecidas (otras formas de la palabra y sinónimos bíblicos), con lo encontrado resaltado. El resultado se abre en la versión que esté elegida. Se puede limitar al Antiguo o al Nuevo Testamento. Con el teclado: flechas, Enter para ir al versículo y otro Enter para proyectarlo. El índice se prepara solo al arrancar.
- **Comparador de versiones**: el mismo pasaje en dos versiones, lado a lado o una sobre otra, con la sigla de cada una y el número delante de cada versículo. Se elige como en Biblia, viendo los dos textos junto a cada versículo; se proyecta, se añade al orden como elemento propio (tipo `compare`) y la disposición se cambia también al aire. Si a la segunda versión le falta un versículo, lo dice.
- **Orden del culto** (antes "guion"): elementos con tipo y pasos, secciones, reordenar arrastrando o por menú, cita rápida, miniaturas de los pasos que se despliegan y se recogen con un clic, "todo junto" para pasajes cortos, **nombre propio para cualquier elemento** (el original queda a la vista debajo y se recupera dejando el nombre vacío). Al abrir, la lista se coloca en lo que está al aire. El guion de versiones anteriores se convierte solo.
- **Medios: imágenes** (módulo `media`, tipo `image`): biblioteca con miniaturas; subida desde el equipo, la galería del celular o arrastrando, varias a la vez, con nombre propuesto y avance; reducción en el dispositivo (lado mayor de 2560 px) y miniatura; ajuste a la pantalla elegido sobre dos miniaturas y recordado por imagen; proyección, orden del culto, cambio de nombre y eliminación. Al aire: recuadro de encuadre (arrastrar, rueda, dos dedos, deslizador hasta 5×) que todas las pantallas siguen, y «Vista completa». Las imágenes viven en `data/media/imagenes/`.
- **Medios: videos y audios** (tipos `video` y `audio`): pestañas propias; subida desde la app (hasta 8 GB un video, 1 GB un audio) o copiando a `Contenido/Medios/`, que se vigila sola. Con ffmpeg, Manna mira dentro de cada archivo: lo habitual (H.264 y AAC o MP3 en MP4/MOV; MP3, M4A, WAV, OGG, FLAC) se usa tal cual; si solo cambia el envoltorio, se rehace en segundos; el resto se convierte a MP4 (con el chip de video del equipo si funciona, y si no con libx264), de uno en uno, como tarea con avance. A cada video se le saca una imagen. Subtítulos `.srt`/`.vtt` (archivo vecino en la carpeta o añadido desde el menú). Sin ffmpeg, lo habitual funciona y lo demás queda "a la espera" hasta instalarlo.
- **Video usable al instante**: de lo que hay que convertir, el equipo principal comprueba solo si su navegador reproduce el original (lo carga a escondidas y mira que avance sin perder cuadros; lo hace su pantalla de proyección o, si no hay, su control). Si puede, el video se proyecta ya: las pantallas del equipo principal usan siempre el original y las demás esperan la copia ligera (MP4, 1080p como mucho), mostrando entre tanto la imagen del video. La copia se hace de fondo, leyendo con el chip de video, con prioridad baja, y **se detiene mientras algo se reproduce en pantalla**.
- **Medios: YouTube** (tipo `youtube`): pestaña propia con un campo para pegar el enlace. Manna toma del enlace solo el identificador del video y lo descarga con yt-dlp (imagen H.264 y sonido AAC, 1080p como mucho, unidos con ffmpeg) a una carpeta de paso; al terminar lo guarda en `data/media/youtube/` con su título, su imagen y su duración, y desde entonces es un video más, que no necesita internet. Las descargas van de una en una, como tareas con avance (en la tarjeta y en "Al aire"). Trae los subtítulos en español e inglés (del autor o automáticos, limpiando las líneas repetidas de estos); al aire se muestran con un botón y se elige el idioma. Lo que falla dice por qué (privado, sin internet, en directo, YouTube pide iniciar sesión) y se reintenta; una descarga que se quedó a medias al apagar no se retoma sola. El mismo video no se descarga dos veces. Un nombre puesto a mano no lo pisa el título de YouTube.
- **Diapositivas** (módulo `slides`, tipo `slides`): presentaciones convertidas en imágenes, una por diapositiva (lado mayor de 2560 px, con miniatura). Un **PDF** lo convierte el navegador de quien lo sube (pdf.js, incluido en el proyecto) y envía las páginas una a una, con avance; funciona sin instalar nada y desde un celular. Un **PowerPoint** (`.pptx`, `.ppt`, `.ppsx`…, reconocido por su contenido) se sube entero y lo convierte el PowerPoint del equipo principal como tarea con avance: en Windows sin ventana y sin las diapositivas ocultas; en Mac abriéndose un momento. Sin PowerPoint, la interfaz explica cómo guardar el PDF. La pantalla: presentaciones a un lado, diapositivas de la elegida al otro (una cosa cada vez en el celular); se elige por cuál empezar, se proyecta, se añade al orden (una diapositiva por paso), se renombra y se elimina. Al aire: «Siguiente» recorre las diapositivas; los mandos dicen por cuál va, cuántas quedan y muestran la que sigue; se acerca y se desplaza como una imagen, y cada diapositiva empieza en vista completa. Hasta 500 diapositivas por presentación.
- **Actualizar yt-dlp** (Ajustes → Programas del equipo principal, solo en el equipo principal): vuelve a descargarlo a `data/herramientas/`, que tiene preferencia sobre el que haya en el sistema.
- **Reproducción**: al proyectar empieza a reproducirse; mandos de pausa, volver al principio, ±10 s, barra de avance y subtítulos, en el panel "Al aire" y en el orden. Cada pantalla lleva su reproductor al punto que marca el reloj del servidor y corrige el desfase sola. Tras un reinicio queda en pausa donde iba.
- **Volumen de Manna**: deslizador con silencio dentro de los mandos de lo que suena. **Suena una sola pantalla, siempre del equipo principal** (así sale por el dispositivo de audio que ese equipo tenga elegido), elegida por el servidor: su ventana de proyección y, si no hay, su página de control. Si en el equipo principal no hay abierta ninguna de las dos, el control lo avisa.
- **Sin cortes de sonido**: al pausar, ocultar («Negro», «Solo fondo») o cambiar lo que está en pantalla, el sonido se desvanece en 0,3 s; la interfaz no espera. «Negro» y «Solo fondo» pausan lo que suena, y «Reproducir» lo vuelve a mostrar. Al terminar un video o un audio, la proyección pasa sola a «Solo fondo».
- **«Más» en el celular**: con más de cinco módulos, la barra de abajo muestra los cuatro primeros y «Más» abre el resto. Hoy hay seis: Orden, Biblia, Comparador y Medios a la vista; Diapositivas y Ajustes, en «Más».
- **Fondos de la proyección** (Ajustes): los seis colores y, a su lado, las imágenes subidas, que se conservan (`data/media/fondos/`, hasta 30); se elige con un toque, se suben con «+» (reducidas en el dispositivo) y se elimina la que está puesta. Elegir un color no borra las imágenes.
- **Actualizar con Manna abierto**: el servidor guarda una huella de su código al arrancar y la compara cada 20 s con lo que hay en disco. Si cambió, avisa en todas las pantallas de control (`system.stale`) y ofrece «Reiniciar ahora» en el equipo principal. Reiniciar cierra y vuelve a abrir solo; las páginas notan que el servidor es otro y se recargan. Pulsar el icono con una copia anterior abierta la cierra y abre la actual.
- **Tipos de contenido** (`app.kind`): `verses`, `compare`, `image`, `video`, `audio`, `youtube`, `slides` y `testcard`. "Siguiente" recorre los pasos de un elemento y luego el orden. Cada tipo dice cómo se dibuja (`web/core/kinds.js`) y, si los tiene, qué **mandos en vivo** ofrece mientras está al aire; los mandos salen en el panel "Al aire" y en el detalle del elemento en el orden.
- **Imagen de prueba** (Ajustes → Proyector de este equipo): encuadre, barras de color o blanco, con un cronómetro que marca lo mismo en todas las pantallas.
- **Revisión del equipo** (`/requisitos`): al abrirse, Manna comprueba Chrome o Edge, ffmpeg, yt-dlp y PowerPoint. Si falta algo, se abre ahí en vez de en el control y dice qué módulos funcionarán completos y cuáles no; "Instalar por mí" descarga ffmpeg (Windows) y yt-dlp (Windows y Mac) a `data/herramientas/`. **Nada bloquea**: desde ahí se continúa a la app. También está en Ajustes.
- **Aviso por módulo**: al abrir un módulo al que le falta un programa, una franja dice qué no podrá hacer y ofrece instalarlo o ver cómo. Lo usan Ajustes (sin Chrome o Edge no se abre sola la proyección en la segunda pantalla) y Medios, donde sale **solo en la pestaña afectada**: sin yt-dlp, en YouTube; sin ffmpeg, en Videos, Audios y YouTube. Cerrarlo vale para esa visita. Un programa opcional (PowerPoint) no hace salir el aviso: Diapositivas lo explica al elegir un PowerPoint.
- **Cimientos para los módulos con medios**: archivos servidos por trozos, subida directa a disco con avance, reloj de reproducción compartido, volumen general, tareas en segundo plano con avance y tiempo restante, carpeta temporal que se vacía al abrir y cerrar.
- Biblias desde `Contenido/Biblias/` en formatos `.xmm` y `.xml`, con recarga automática al copiar archivos.
- Proyección con ajuste automático del tamaño, estilos e imagen de fondo propia (en Ajustes).
- Reconexión automática de los dispositivos, con detección de conexiones congeladas y aviso con instrucciones si no vuelve.
- Recuperación de lo que estaba en pantalla si el servidor se reinicia en menos de 15 minutos.
- Confirmación del navegador al cerrar la pestaña de control.
- Dirección con nombre `manna.local` (mDNS propio, sin dependencias) y puerto 80, con el 8000 de reserva. Si hay otro Manna en la red, toma `manna-2.local`.
- Con el puerto 80, Manna atiende **también en el 8000**, para televisores cuyo navegador no abre una dirección sin puerto; "Dispositivos" lo explica en "¿Es un televisor?". Ya no se ofrecen direcciones de adaptadores sin red (`169.254…`).
- **`https` en los mismos puertos**: cada puerto de Manna atiende `http` y `https` a la vez, y con el 80 se abre además el 443. El certificado lo hace Manna la primera vez (`data/certificado/`, válido 825 días, se renueva solo) y no cambia aunque cambie la IP. Si no se puede crear, Manna sigue solo con `http`.
- **Televisores** (módulo `tv`, Samsung): buscar en la red, añadir por dirección, vincular (la clave que entrega el televisor se guarda en `data/televisores.json` y no sale del servidor), abrir y cerrar su navegador, control remoto (teclas, puntero, texto) y escribirle la dirección de la proyección. La tarjeta dice si está encendido, si tiene el navegador abierto, si muestra la proyección y, si llegó a Manna y cortó la conexión segura, qué hacer.
- **Pantalla completa en un televisor**: en la página de proyección, OK o un toque del puntero. Si el televisor abre la proyección tras pedírsela desde Manna, Manna le pulsa OK.
- Paso automático de la dirección numérica al nombre en los dispositivos que lo admiten, y reconexión sola tras un cambio de IP del equipo principal.
- Ventana "Dispositivos" con un solo código QR, la dirección `manna.local` y direcciones alternativas plegadas.
- Instaladores del icono "Manna" para Windows y Mac. Comprueban Node.js (`instalacion/requisitos.html` si falta); el resto lo revisa Manna al abrirse.
- Arranque en segundo plano desde el icono, una sola copia, registro en `data/manna.log` y página de error si no puede abrir.
- Apagado desde Ajustes, solo en el equipo principal.

## Probado y sin probar

| Área | Estado |
| --- | --- |
| Interfaz: Biblia, orden del culto (desplegar, recoger, nombre propio), ajustes, dispositivos, versión junto al logo y permisos del rol "Control del orden" | Probado en Chrome real con `scripts/probar-chrome.mjs` (226 comprobaciones en total) |
| Búsqueda en la Biblia: al escribir, niveles, resaltado, teclado, "ver más", cita, sin resultados | Probado en Chrome real, y con pruebas automáticas del orden, de las marcas y de en qué versión se busca |
| Búsqueda: velocidad y memoria | Con un solo índice (Reina-Valera 1960): unos milisegundos por búsqueda y unos 12 MB. **Sin medir en el equipo Windows de la iglesia** |
| Comparador: elegir versiones, ver las dos junto a cada versículo, vista previa, disposición antes y al aire, "siguiente", versículo que falta en una versión, añadir al orden | Probado en Chrome real con dos versiones de prueba, y con pruebas automáticas del tipo `compare` |
| `http` y `https` en los puertos 80, 443 y 8000 | Probado en el Mac de desarrollo, por la dirección de red, con un cliente que exige un certificado válido y con otro que lo rechaza. **Sin probar en Windows** (puertos 80 y 443 con el Firewall) |
| Medios: subir (dos imágenes, una mayor de lo que se guarda), nombre propuesto, reducción y miniatura, ajuste, proyectar, encuadre al aire con deslizador y arrastre, la misma parte en dos pantallas, vista completa, añadir al orden, renombrar, eliminar | Probado en Chrome real y con pruebas automáticas (reconocer JPG, PNG, WebP y GIF por su contenido, rechazar lo que no es imagen, permisos) |
| Subir, elegir y eliminar imágenes de fondo; conservarlas al reabrir el control | Probado en Chrome real y con pruebas automáticas |
| Actualización con Manna abierto: aviso, «Reiniciar ahora», recarga de la página, relevo al pulsar el icono | Probado con procesos de verdad sobre una copia del programa (`test/arranque.test.js`) y en Chrome real. **Sin probar en Windows** (lanzar la copia nueva sin ventana) ni con el icono de la app de Mac |
| Todos los botones que envían una orden | La prueba en Chrome real comprueba que la interfaz usó, pulsando, **todas** las órdenes y direcciones del servidor, salvo seis declaradas con su motivo (`UNTOUCHED` en `scripts/probar-chrome.mjs`) |
| Videos y audios: subir, rechazar lo que no lo es, conversión completa (AVI), cambio de envoltorio (MKV), audio (WMA), carpeta `Contenido/Medios` con subtítulos, proyectar, pausa, saltos, barra, volumen, silencio, subtítulos, orden del culto, renombrar, eliminar | Probado en Chrome real con archivos hechos con ffmpeg en el momento, y con pruebas automáticas contra el servidor de verdad (que convierten de verdad) |
| Dos pantallas a la par | Probado en Chrome real: 0,17 s de diferencia al arrancar (dentro del margen que el reproductor corrige) y el mismo punto exacto al pausar. Las dos pantallas estaban en el mismo equipo: **sin probar entre dispositivos distintos** |
| Una sola pantalla suena | Probado: suena la de proyección del equipo, el monitor del control va en silencio; sin proyección suena el control del equipo, y nada pide tocar la pantalla. **Sin oírlo de verdad en el proyector** (Chrome sin ventana no tiene altavoz) |
| Desvanecido al pausar, al poner «Negro» y al cambiar de contenido; «Negro» pausa; «Reproducir» vuelve a mostrar; fin del video → «Solo fondo» | Probado en Chrome real midiendo el volumen del reproductor cada 15 ms (baja en varios pasos antes de detenerse), y con pruebas automáticas del servidor. **Sin oírlo**: que el desvanecido suene bien al oído lo tiene que juzgar el dueño |
| Diapositivas con un **PDF**: elegirlo, nombre propuesto, cuántas diapositivas tiene, conversión en el navegador, imágenes de 2560 px con miniatura, elegir una, vista previa, proyectar, mandos (por cuál va, cuántas quedan, la que sigue), la misma diapositiva a tamaño completo en otra pantalla, siguiente y anterior, acercar, vuelta a la vista completa, fin de la presentación, orden del culto con sus miniaturas, renombrar, celular | Probado en Chrome real con un PDF de cuatro páginas hecho en el momento (`scripts/lib/pdf.mjs`), que **convierte de verdad el pdf.js incluido**, y con pruebas automáticas contra el servidor. El PDF de prueba es sencillo (fondo de color y un rótulo): **sin probar con presentaciones reales** (fotos, tipografías incrustadas, muchas páginas, varios megas) ni desde un celular real |
| Diapositivas con un **PowerPoint** en la interfaz: subir, conversión de fondo con avance, resultado, sin PowerPoint | Probado en Chrome real y con pruebas automáticas, **con un PowerPoint de mentira** (un guion que deja tres imágenes). Lo que hace el servidor con lo que PowerPoint entrega está probado; **lo que hace PowerPoint, no** |
| **PowerPoint de verdad en Windows** (el guion de PowerShell: abrir sin ventana, exportar cada diapositiva y su miniatura, saltar las ocultas, no cerrar un PowerPoint en uso) | **Sin probar.** No hay Windows ni PowerPoint para Windows en el equipo de desarrollo. Las pruebas comprueban el texto del guion y que las rutas no viajan en él, no su ejecución. Es la prueba más importante que le queda al dueño en esta fase |
| **PowerPoint de verdad en Mac** (AppleScript) | **Sin probar.** El 2026-10-05 se intentó en el Mac de desarrollo: PowerPoint (16.113) se abrió, pero no respondió a ninguna orden en 40 s. Lo más probable es que macOS estuviera preguntando en pantalla si se le deja controlar PowerPoint, cosa que solo puede aceptar una persona. No se sabe, por tanto, ni el nombre ni el tamaño de las imágenes que exporta (el código acepta "Slide1.jpeg" o "Diapositiva1.jpeg" y les hace la miniatura con `sips`) |
| YouTube: pegar un enlace, rechazar lo que no lo es, avance de la descarga, título antes que el video, imagen, duración, no repetir el mismo video, proyectar, subtítulos en dos idiomas y elegir cuál, añadir al orden, un video privado con su motivo, reintentar, eliminar | Probado en Chrome real y con pruebas automáticas, **con un yt-dlp de mentira** (`scripts/lib/yt-dlp-falso.mjs`) que fabrica el video con ffmpeg y subtítulos como los automáticos de YouTube. También: 32 formas de enlace (12 válidas, 20 que deben rechazarse, entre ellas intentos de colar órdenes) |
| YouTube con el **yt-dlp de verdad** | Solo se comprobó, el 2026-10-04 y sin descargar nada (`--simulate`), que YouTube acepta la orden que arma Manna y elige imagen H.264 de 1080p con sonido AAC. **Sin probar: una descarga real**, la unión con ffmpeg, la imagen y los subtítulos reales, y cuánto tarda. Es la primera prueba pendiente del dueño en esta fase |
| YouTube en el **equipo Windows** (`yt-dlp.exe`, rutas, unir con ffmpeg) | **Sin probar** |
| «Actualizar» yt-dlp desde Ajustes | Probado en Chrome real con una descarga simulada que entrega una versión más nueva: queda la nueva. **Sin probar con la descarga real** |
| Medios sin ffmpeg | Probado en Chrome real y en pruebas automáticas: lo habitual queda listo con la imagen y la duración que saca el navegador; lo demás espera y lo dice |
| Uso inmediato del original y copia de fondo | Probado en Chrome real (un MKV que el navegador reproduce y un AVI que no) y con pruebas automáticas: usable al decirlo el equipo, la conversión cede el paso mientras se reproduce, y la copia llega a lo que está al aire sin interrumpirlo |
| **El video real del dueño** (4K, HEVC de 10 bits, 483 MB, 2:24), en el Mac de desarrollo | Probado: se pudo proyectar a los **3,3 s** de copiarlo a la carpeta; se reprodujo el original en 4K (183 cuadros en 6 s, 9 perdidos al arrancar); la copia ligera tardó **26 s** (antes, 59 s) y conserva los colores del original |
| Lo mismo en el **equipo Windows** de la iglesia: si su navegador reproduce HEVC, cuánto tarda la copia, y que al reproducir se corte y reinicie la conversión | **Sin probar.** En Windows la conversión no se puede congelar: se corta y vuelve a empezar al terminar la reproducción |
| Otros videos reales: de celular (HEVC de iPhone), de varios gigas | **Sin probar** |
| Subir un video desde un **celular real** | **Sin probar** |
| Medios desde un **celular real**: elegir de la galería, fotos HEIC de iPhone, acercar con dos dedos | **Sin probar.** El gesto de dos dedos está escrito pero solo se probaron el arrastre, la rueda y el deslizador |
| «Más» en la barra del celular | Probado en Chrome real con tamaño de celular y en la auditoría de pantallas |
| Televisor Samsung real (QN55QN85F): encontrarlo en la red, leer sus datos, vincular, abrir y cerrar el navegador, tecla "Inicio" | **Probado desde Manna con el televisor del dueño** (se comprobó en el propio televisor, por su estado) |
| Subida de imágenes a Medios desde el celular del dueño (2026-10-04) | Falló con «No encontrado» porque el Manna abierto era anterior al módulo. **Corregida la causa; falta que el dueño lo repita** tras reiniciar |
| Televisor real: puntero y texto | El dueño vio que el navegador se abrió y que el puntero **se movió brevemente**; no llegó a la barra de direcciones ni escribió la dirección |
| Televisor real: **abrir la proyección** | **No funciona.** Ni con las órdenes de Manna ni escribiendo la dirección a mano en el televisor (prueba del dueño, 2026-10-04). Sin diagnosticar: en pausa |
| Módulo Televisores en la interfaz: añadir, vincular, abrir, control remoto, panel táctil, escribir la dirección, quitar | Probado en Chrome real contra un televisor de mentira (`scripts/lib/tv-falso.mjs`), y con pruebas automáticas del mando y del módulo |
| Aviso por módulo cuando falta un programa | Probado en Chrome real con el navegador "ausente": aparece en Ajustes, no en Biblia, y se puede cerrar. **El botón de instalar desde el aviso no se probó** (usa la misma orden que la revisión, que sí) |
| Mandos en vivo (imagen de prueba): cambiar de imagen, cronómetro, pausa; en el panel, en el orden y desde "Control del orden" | Probado en Chrome real. **El cronómetro marca lo mismo en dos pantallas** (diferencia de 0,0 s) y coincide con el servidor. Las dos pantallas estaban en el mismo equipo: **sin probar entre dispositivos distintos** |
| Revisión del equipo: aviso de lo que falta y de los módulos afectados, "Instalar por mí" con avance, paso al control sin bloqueo | Probado en Chrome real y por HTTP, **con una descarga simulada** servida en el propio equipo |
| "Instalar por mí" con las **descargas reales** de ffmpeg y yt-dlp | **Sin probar.** Solo se comprobó que las direcciones responden. El camino del `.zip` (ffmpeg en Windows) está probado con un `.zip` simulado en Mac |
| Revisión del equipo en **Windows**: detección de Edge, ffmpeg, yt-dlp y PowerPoint; instalación | **Sin probar** |
| Servidor de archivos: trozos (Range), caché, salir de la carpeta, subida a disco con límite | Probado por HTTP en las pruebas automáticas. Subida probada hasta 21 MB: **sin probar con archivos de varios gigas** |
| Logo: fidelidad del vector frente al arte original | Probado: las formas coinciden en un 98 %. El vector no reproduce las estelas tenues bajo las barras |
| Iconos generados (`.ico`, `.icns`, PNG) | Revisados a la vista en 32, 180 y 400 px. **Sin ver** en el Escritorio de Windows ni en la pantalla de inicio de un celular |
| Adaptación a pantallas: 9 tamaños (celular 360/390/430 vertical, celular horizontal, tableta vertical y horizontal, tableta grande, portátil, escritorio) | Probado con `scripts/auditar-responsive.mjs`: sin desborde, navegación y "Al aire" a la vista, acción principal sin desplazarse, botones de 40 px o más en táctil, títulos largos legibles, mandos en vivo completos en el panel y en el orden (también los de un video de YouTube, con su lista de idiomas), el campo del enlace de YouTube con el aviso de que falta yt-dlp encima, Diapositivas (las presentaciones, las diapositivas de una y sus mandos al aire), revisión del equipo. 27 pantallas por tamaño. **Con emulación de Chrome, no en dispositivos reales** |
| Conversión del guion antiguo al orden del culto | Probado con un guion de ejemplo |
| PIN, permisos por rol, bloqueo por intentos | Probado por API desde la IP de red |
| Lectura y limpieza de las 14 biblias locales | Probado |
| Ventana de kiosco de Chrome: abrir, conectar, cerrar | Probado sobre la pantalla principal |
| Desconexión: servidor caído y reiniciado | Probado: reconecta solo, recupera lo proyectado, la sesión remota sigue válida |
| Desconexión: conexión congelada 33 s | Probado: aviso en unos 30 s, reconecta al reanudar |
| Desconexión: la dirección deja de responder | Probado: aviso con instrucciones, la página no se rompe, reconecta si la dirección vuelve |
| Doble clic sobre un versículo no centrado | Probado: proyecta ese versículo y la lista no se mueve |
| Confirmación al cerrar la pestaña | Probado en Chrome real (`scripts/probar-chrome.mjs`): aparece tras un clic en la página; "cambiar de función" no la pide |
| `manna.local` y puerto 80 en el Mac de desarrollo | Probado: el nombre resuelve, sin puerto; con el 80 ocupado pasa al 8000; al apagar, el nombre desaparece |
| Dos Manna en la misma red | Probado en el mismo equipo: el segundo toma `manna-prueba-2.local` |
| Paso automático de la IP al nombre | Probado en Chrome real (pantalla de inicio y proyección) |
| Cambio de IP con un dispositivo conectado por el nombre | Probado en Chrome real, simulado (el servidor deja una dirección y aparece en otra): reconecta solo a los 59 s, sin recargar, recupera lo proyectado y no vuelve a pedir PIN |
| `manna.local` desde **celulares reales** (iPhone, Android 12+, Android antiguo) | **Sin probar** |
| `manna.local` y puerto 80 con **Windows como servidor** | **Sin probar** |
| Cambio de IP con un **router real** | **Sin probar** (solo simulado) |
| Elección de la dirección recomendada con varias redes | Probado con pruebas automáticas y con direcciones simuladas; **sin probar en un equipo con dos redes reales** |
| Apertura automática en una **segunda pantalla real** | **Sin probar** (el equipo de desarrollo no tiene proyector) |
| Icono en **Mac**: instalador, app en segundo plano, segunda pulsación, registro | Probado en una copia temporal (carpeta con espacios), creando la app fuera de Aplicaciones. **Sin probar** con el proyecto dentro de Documentos, donde macOS pedirá permiso de acceso |
| Apagar Manna (Ajustes) | Probado en Chrome real: confirma, apaga el servidor y muestra la pantalla final; un dispositivo remoto con control completo no puede apagar |
| Fallo de arranque en segundo plano | Probado: escribe `data/error.html` y el registro |
| Icono en **Windows**: `Instalar Manna en Windows.bat` e `instalacion/abrir-windows.bat` | **Sin probar.** Es la primera prueba pendiente en el equipo de la iglesia |
| **Windows**: detección de pantallas y ventana de proyección | **Sin probar** |
| Conexión desde un celular real | Probada por el dueño (vuelve sola al regresar del segundo plano) |

## Problemas conocidos

- **El logo es cian y el acento de la interfaz es ámbar.** Se mantuvo el ámbar porque es lo que se aprobó en la maqueta; el cian aparece solo en el logo. Unificarlos es cambiar tres valores en `web/core/app.css` (pendiente de que el dueño lo decida).
- El nombre "MANNA" del logotipo se compone con la tipografía de la app (Geist, peso 700), no con la del arte original, que no se recibió como archivo.
- Las estelas tenues que el arte original tiene bajo las barras no están en el vector.
- **Manna abierto desde la carpeta de desarrollo**: mientras se programa, el aviso «Manna se actualizó» sale cada vez que cambia el código del servidor. Es correcto (hay que reiniciar para probar lo nuevo), pero si se reinicia a mitad de un cambio puede no abrir; en ese caso sale la página de error de arranque.
- **Cuando suena la página de control** (equipo principal sin proyector), el navegador exige que alguien haya hecho clic en esa página alguna vez desde que se abrió; la ventana del proyector no tiene esa limitación. Una página que no puede sonar lo dice al servidor y se elige otra del equipo; si ninguna puede, los mandos avisan de que no suena en ningún sitio y piden un clic en la página de Manna del equipo principal.
- Al quitar «Negro» o «Solo fondo», lo que sonaba no se reanuda solo: hay que pulsar «Reproducir» (decisión de diseño, para que nada suene por sorpresa).
- **Una pantalla remota no ve un video recién agregado hasta que su copia ligera está lista** (ve su imagen y un aviso). Si además algo se está reproduciendo, la copia espera. Lo normal es agregar los videos con tiempo.
- **En Windows, una conversión interrumpida por una reproducción vuelve a empezar de cero** al terminar esta (el sistema no deja congelarla, como sí se hace en Mac).
- La comprobación de si el equipo principal reproduce un original la hace una página suya **a la vista**: si el control está en una pestaña de fondo y no hay ventana de proyección, se hace al volver a esa pestaña; hasta entonces se espera a la conversión, como antes.
- Tras pausar, la pantalla que suena queda hasta 0,3 s por delante de las demás (lo que dura el desvanecido); se iguala sola al reanudar.
- El video de "alta eficiencia" (HEVC) de un iPhone siempre se convierte, aunque algunos equipos podrían reproducirlo tal cual: así funciona en todas las pantallas.
- Sin ffmpeg no se puede comprobar que un archivo con extensión de video lo sea de verdad: se acepta y, si no lo es, simplemente no se reproduce.
- **Incidente del 2026-10-04**: durante el desarrollo, un servidor de prueba abrió su proyección en la segunda pantalla del Mac (que no se sabía conectada) y reprodujo unos segundos un video de prueba con un tono. Desde entonces todo servidor de prueba y la demostración llevan `MANNA_SIN_VENTANA=1`. Las pruebas en Chrome de ese día, anteriores al cambio, también se vieron en esa pantalla.
- **Televisores: en pausa.** El módulo está fuera de la barra (se abre escribiendo `#televisores` al final de la dirección del control) y hace lo que se comprobó (encontrar, vincular, abrir y cerrar el navegador, teclas), pero **el televisor del dueño no carga la proyección**, tampoco a mano. Falta saber por qué: Manna anota cómo llega cada equipo (`http`, `https` o conexión segura cortada) y la tarjeta del televisor lo muestra; ese dato es el punto de partida al retomarlo. No se trabaja en ello hasta terminar las demás fases.
- **PowerPoint solo se ha probado de mentira** (ver la tabla de arriba): ni el guion de Windows ni el de Mac se han ejecutado contra un PowerPoint real. Si falla en el equipo de la iglesia, el PDF funciona siempre.
- Diapositivas: se pierden animaciones, transiciones y videos incrustados; una diapositiva con varias "apariciones" queda como se ve al final. Las diapositivas ocultas no se exportan en Windows; en Mac no se sabe (depende de PowerPoint). Las notas del orador no se usan.
- Diapositivas: un PDF se convierte en el dispositivo que lo sube y hay que dejar esa ventana abierta hasta que termine; con un PDF muy grande, un celular modesto puede tardar o quedarse sin memoria (mejor subirlo desde el equipo principal). No hay carpeta en `Contenido/` para dejar presentaciones: se suben desde la app.
- Diapositivas: no se guarda el archivo original (PDF o PowerPoint), solo las imágenes. Para cambiar una diapositiva hay que subir la presentación de nuevo.
- En Mac, PowerPoint se abre a la vista para convertir y macOS pide permiso la primera vez; si nadie lo acepta, la conversión espera hasta 15 minutos y falla diciéndolo.
- **Una comprobación de la prueba en Chrome falló una vez de seis** el 2026-10-05 y no se repitió: tras pausar un `.mkv` que el equipo reproduce tal cual, el monitor del control quedó 1 s por detrás del punto de la pausa. No se halló la causa; al reanudar se iguala solo.
- Los tipos de elemento futuros (himno) tienen icono, color y sitio en la interfaz, pero no existen: no se pueden añadir ni proyectar. Su icono y nombre provisionales están en `web/modules/kinds.js` y se quitan cuando llega cada módulo.
- **YouTube no se ha probado con una descarga real** (ver la tabla de arriba). Lo que se sabe que puede pasar: YouTube a veces pide iniciar sesión («confirma que no eres un robot») según la red desde la que se descarga, y Manna no inicia sesión en YouTube: lo dice y hay que intentarlo más tarde, o bajar el video por otro medio y subirlo a Videos.
- YouTube: solo se piden subtítulos en español y en inglés; un directo no se puede descargar hasta que termina; siempre se baja a 1080p como mucho, sin elegir calidad; las listas de reproducción no se admiten (de un enlace con lista se toma solo su video).
- YouTube: una descarga interrumpida al apagar Manna no se retoma sola; la tarjeta lo dice y ofrece «Reintentar».
- «Actualizar» yt-dlp instala la copia de Manna (`data/herramientas/`), que desde entonces es la que se usa aunque el equipo tenga otra instalada por su cuenta.
- **Búsqueda sin tildes**: "oró" y "oro", o "creó" y "creo", son la misma palabra para el buscador. Las "parecidas" salen de reglas del español y de una lista de sinónimos (`server/core/search.js`), no de entender el texto: pueden traer alguna palabra que solo se parece. Van siempre al final.
- **Televisor Samsung: lo que su control por red permite y lo que no** (comprobado en el QN55QN85F, 2026-10-04). Permite leer sus datos, abrir y cerrar aplicaciones (el navegador) y hacer de mando (teclas; puntero y texto, sin confirmar). **No permite decirle al navegador qué dirección abrir**: las órdenes para eso que valían en modelos anteriores, este las ignora. Por eso la primera vez hay que llevar el navegador a la dirección de Manna (con el botón que la escribe) y guardarla como página de inicio.
- **El aviso de seguridad del televisor**: el certificado de Manna es propio, así que el navegador avisa y hay que elegir "Avanzado" y "Continuar". No se sabe cada cuánto lo vuelve a preguntar el televisor. No hay forma de evitarlo sin un nombre público en internet, que queda fuera de los límites del proyecto.
- Cambiar de equipo principal, o borrar `data/certificado/`, crea otro certificado: los televisores volverán a avisar una vez.
- El módulo Televisores solo conoce Samsung. Está hecho para añadir otras marcas (`server/modules/tv/samsung.js` es la única parte propia de la marca).
- **Letras del himnario**: están las 613, pero 15 himnos tienen alguna parte de una sola línea, señal de que al copiarlas se perdieron líneas (48, 57, 58, 68, 83, 116, 128, 244, 265, 280, 318, 327, 458, 546 y 590). Hay además erratas sueltas. No afecta a nada hasta la fase 5.
- En el comparador, dos archivos de la misma traducción (por ejemplo, las dos copias de Dios Habla Hoy) aparecen con la misma sigla.
- "Instalar por mí" no existe para ffmpeg en Mac (no hay una descarga oficial única): ahí se instala con Homebrew, y la revisión da la orden.
- La imagen de prueba se proyecta desde Ajustes; no tiene botón para añadirla al orden del culto (el servidor lo admite).
- En el orden del culto cada versículo es un paso. Un pasaje se puede mostrar entero ("Todo junto") solo si tiene entre 2 y 6 versículos, y hay que elegirlo en sus miniaturas: no se recuerda por elemento.
- Reordenar arrastrando funciona con ratón. En pantallas táctiles se reordena con los botones Subir / Bajar.
- La vista previa `/vista-previa` muestra la app en marcos de celular y tableta, pero el navegador de escritorio no reproduce el teclado en pantalla ni las barras del navegador del celular.
- **Cambio de IP del equipo principal**: los dispositivos que no entienden nombres `.local` (Android anterior a la versión 12) no encuentran solos la dirección nueva; deben volver a escanear el QR y escribir el PIN. Los demás reconectan solos en un minuto aproximadamente; no puede ser más rápido porque el navegador recuerda la dirección anterior durante ese tiempo.
- **El nombre dejó de responder una vez** durante las pruebas, a los pocos minutos de arrancar, sin que el servidor lo notara. No se pudo reproducir ni hallar la causa. Desde entonces el servidor comprueba el nombre cada 10 s y lo rehace si falla (probado dejándolo mudo a propósito). Si reaparece en uso real, los dispositivos siguen pudiendo entrar por la dirección numérica.
- No se ha comprobado si al escribir `manna.local` sin `http://` algún navegador abre una búsqueda en vez de la página. El remedio es escribir `manna.local/`.
- En macOS puede aparecer una vez el permiso "buscar dispositivos en la red local". Si se deniega, el nombre no funciona; la dirección numérica sí.
- En Mac, la app Manna no se añade sola al Dock: hay que arrastrarla desde Aplicaciones.
- Manna abierto desde el icono no tiene ventana: si el botón "Apagar" no está a mano, solo se cierra apagando el equipo o terminando el proceso `node`.
- El equipo principal puede entrar en reposo durante una reunión: Manna no lo impide. Conviene desactivar el reposo en los ajustes de energía.
- La confirmación al cerrar solo aparece si se hizo algún clic en la página (regla de Chrome), y su texto no se puede cambiar.
- Un celular o tableta usado como pantalla de proyección puede apagar su pantalla por inactividad: la función del navegador que lo impide exige HTTPS o `localhost`. No afecta a la ventana del equipo principal.
- Biblia de Jerusalén: la limpieza de títulos es por reglas y deja restos, como las letras hebreas del Salmo 119 ("Alef.").
- Traducción en Lenguaje Actual (`SpanishTLABible.xml`): unos 26.500 versículos frente a unos 31.100 de las demás. No se revisó si une versículos o está incompleta.
- Versiones repetidas en dos formatos (Dios Habla Hoy, Palabra de Dios para Todos) aparecen con "(2)".
- Un navegador tiene una sola sesión: abrir "control completo" y "control del orden" en dos pestañas del mismo navegador hace que la más antigua vuelva a la pantalla de inicio al dar una orden.

## Decisiones tomadas

- **2026-10-03 · Equipo principal: Windows.** El desarrollo sigue en Mac; lo que afecte al arranque o al sistema debe funcionar en Windows.
- **2026-10-03 · Sin compilaciones por ahora.** Node.js y Chrome se aceptan como requisitos del equipo principal. Manna se abre con un icono creado por un instalador sencillo.
- **2026-10-03 · Dirección `manna.local` y puerto 80.** El QR sigue llevando la dirección numérica.
- **2026-10-04 · Rediseño de la interfaz aprobado** sobre una maqueta: tres zonas, módulo Biblia y módulo Orden del culto separados, y sitio previsto para himnario, imágenes, videos y presentaciones. El sistema quedó escrito en `DESIGN.md`.
- **2026-10-04 · "Guion de culto" pasa a llamarse "Orden del culto"** y es donde confluyen todos los módulos, con los elementos diferenciados por tipo.
- **2026-10-04 · "Al aire" en rojo.** El ámbar queda para la selección y la acción principal.
- **2026-10-04 · Tipografía Geist e iconos Phosphor incluidos en el repositorio** (licencias libres, sin internet en uso).
- **2026-10-04 · Los celulares se usan en vertical; las tabletas, también en horizontal.**
- **2026-10-04 · Versión 1.0.0**, con el logo del dueño integrado y la versión visible junto a él.
- **2026-10-04 · Módulos futuros visibles pero atenuados.** El dueño no eligió entre mostrarlos u ocultarlos; se dejaron como en la maqueta aprobada. Para ocultarlos basta quitar las entradas `soon` de `web/modules/registry.js`.
- **2026-10-04 · Plan de la versión 2 aprobado** (`docs/PLAN.md`, sección 6, con las nueve respuestas):
  - Imágenes, videos, audios y YouTube en **un solo módulo "Medios"**.
  - **ffmpeg, yt-dlp y pdf.js aprobados**, con la condición de que la revisión inicial garantice que el equipo tiene todo y siga siendo fácil abrir la app.
  - **PowerPoint por defecto** para las presentaciones, en segundo plano si se puede.
  - **Búsqueda sin modelo de lenguaje**, con índice y velocidad garantizados en Biblia e himnario.
  - **Volumen: solo el de Manna**, como volumen general. No se toca el del equipo.
  - Himnos: la segunda pista es la instrumental; se ofrece **"Cantado / Pista"** antes de proyectar o añadir al orden.
  - Conversión de videos **en segundo plano, con el avance a la vista** en el módulo y en "Al aire". **Subtítulos de YouTube** con mando para activarlos.
  - **Se publica al cerrar cada fase.**
- **2026-10-04 · Ningún programa que falte bloquea el arranque**, tampoco el navegador. Se avisa de qué módulos funcionarán y cuáles no, y cada módulo avisa al abrirlo y ofrece instalar lo que le falta. (Sustituye a lo hecho en la fase 0, donde sin navegador no se entraba.)
- **2026-10-04 · Letras de los himnos: se usan, en local.** El dueño tiene la licencia y las entregó en 13 archivos `.md`; están en `Contenido/Himnario/letras/`, fuera de GitHub. Manna las leerá de ahí (fase 5). Las categorías del himnario se toman de la agrupación de nuevohimnario.com: solo los nombres y qué himnos van en cada una.
- **2026-10-04 · Una sola carpeta para lo de cada iglesia**: `Contenido/`, con las biblias, los himnos en video y las letras.
- **2026-10-04 · La búsqueda de texto se hace solo en la Reina-Valera 1960**, no en todas las versiones. Con filtro por testamento.
- **2026-10-04 · El televisor tiene que funcionar como pantalla remota por su navegador.** Usarlo como segunda pantalla no vale: esa salida es del proyector.
- **2026-10-04 · El himnario se queda después de las fases 3 y 4**, mientras el dueño revisa las letras. Las fases 3 (televisores) y 4 (imágenes) se trabajan a la vez.
- **2026-10-04 · Televisores en pausa.** La prueba remota no pasó de abrir el navegador y mover un poco el puntero, y a mano el televisor tampoco carga la página. Se retoma cuando estén hechas las demás modificaciones.
- **2026-10-04 · El himnario sigue pospuesto**: tras los ajustes de la 1.5.1 se pasa a la fase 6 (videos y audios), que estrena la reproducción.
- **2026-10-04 · La imagen de fondo se elige en Ajustes, no desde Medios** (se usa poco). Lo importante es que las imágenes subidas como fondo se conserven, salgan junto a los colores y se puedan eliminar.
- **2026-10-04 · La biblioteca de imágenes no se agrupa**: de la más reciente a la más antigua, con la hora en que se agregó cada una.
- **2026-10-04 · Televisores fuera de la barra** mientras esté en pausa.
- **2026-10-04 · El sonido nunca se corta de golpe**: todo lo que lo detenga (pausa, negro, solo fondo, cambiar de contenido) lo hace con un desvanecido rápido; la interfaz reacciona al instante.
- **2026-10-04 · «Negro» y «Solo fondo» pausan lo que suena. Al terminar un video se pasa a «Solo fondo»** con un desvanecido rápido.
- **2026-10-04 · Sin botón para hacer sonar**: el sonido va solo al dispositivo de audio configurado en el equipo principal.
- **2026-10-04 · Un video recién agregado debe poder usarse de inmediato**, aunque lo habitual sea agregarlos con tiempo; la conversión para los dispositivos remotos va de fondo. No se añade una prueba del equipo a la revisión: el de la iglesia no es antiguo, aunque tampoco potente.
- **2026-10-05 · Tras YouTube, diapositivas; y ahí se detiene** el trabajo para hacer pruebas, antes de revisar la fase del himnario.
- **2026-10-04 · Informe de cada fase**: muestra de nuevo el plan con las fases superadas y las observaciones, y un apartado de cambios sugeridos (`docs/PLAN.md`, sección 11).

## Decisiones pendientes del dueño

### 0. Sugerencias al plan de la versión 2

En `docs/PLAN.md`, sección 11.

### 1. Instaladores compilados (aplazada)

Propuesta: empaquetar el servidor como aplicación de escritorio con **Electron**. Los dispositivos remotos seguirían entrando por navegador. Aplazada el 2026-10-03: se revisará más adelante si es momento de crear compilaciones.

- Incluye su propio navegador y Node: desaparecen los requisitos de Chrome y Node.js.
- Abre la proyección en la segunda pantalla con funciones nativas, sin Chrome ni `osascript`/PowerShell, y puede impedir que el equipo se duerma.
- Entregables: instalador `.exe` para Windows (puede crear las reglas del Firewall porque se ejecuta como administrador) y `.dmg` para Mac.
- El desarrollo diario no cambia: `node server/index.js` y `npm test`. Electron solo interviene al empaquetar.
- Costes: instaladores de unos 100 MB; añade dependencias de empaquetado (requiere levantar el límite "sin dependencias" para esa parte); el instalador de Windows se compilaría en GitHub Actions; sin certificados de pago, Windows y macOS muestran una advertencia la primera vez.
- Las biblias pasarían a una carpeta visible del usuario (por ejemplo `Documentos/Manna/Biblias`) con un botón para abrirla.

### 2. Otras

- Acento de la interfaz: mantener el ámbar o pasarlo al cian del logo.
- Licencia del repositorio (hoy no tiene ninguna).

## Próximos pasos

- **El trabajo está detenido para las pruebas del dueño** (decisión 28). Después se revisa la fase 5 (himnario, versión 1.9), que ya tiene hecha la reproducción; luego la 9 (auditoría) y, al final, se retoma la 3 (televisores). El orden completo está en `docs/PLAN.md`.
- Que el dueño pruebe **Diapositivas**: un PDF de verdad de la iglesia (desde el equipo principal y desde el celular) y, en el equipo Windows, un PowerPoint de verdad: que se convierta sin que se vea ninguna ventana, que las diapositivas salgan nítidas y que no cierre un PowerPoint que tenga abierto.
- Que el dueño pruebe **YouTube de verdad**: instalar yt-dlp desde la revisión del equipo («Instalar por mí»), pegar el enlace de un video de la iglesia y ver que baja, que tiene imagen y subtítulos, y que se proyecta. Es lo único de la fase 7 que no se pudo probar sin salir a internet.
- Que el dueño pruebe en el **equipo Windows** el video de 4K: si la tarjeta dice «Ya se puede proyectar» a los pocos segundos y cuánto tarda la copia. Y oír el sonido y los desvanecidos por el proyector.
- Que el dueño repita, tras reiniciar Manna, las dos pruebas que fallaron: subir una imagen a Medios y subir una imagen de fondo, desde el equipo principal y desde el celular.
- **Televisores: al retomarlo**, lo primero es el diagnóstico: con Manna abierto, escribir la dirección en el navegador del televisor y mirar en su tarjeta (módulo Televisores) cómo dice Manna que llegó. Si no llegó de ninguna forma, el problema está antes de Manna (el televisor o la red); si llegó y cortó la conexión segura, es el certificado.
- Que el dueño pruebe Medios desde su celular: subir fotos de la galería y encuadrar con dos dedos.
- **Probar en el equipo Windows de la iglesia**, en este orden: `Instalar Manna en Windows.bat`, abrir con el icono, **revisión del equipo e "Instalar por mí"**, aviso del Firewall, proyección en la segunda pantalla, imagen de prueba, botón "Apagar", y `manna.local` desde un celular.
- El dueño revisa las letras de los himnos (15 con partes incompletas, lista arriba) antes de la fase 5.
- Que el dueño revise la versión para celular y tableta (se hizo sin maqueta previa) y diga qué ajustar.
- Probar `manna.local` desde celulares reales (iPhone, Android 12 o posterior, Android antiguo) y con un router real.

## Entorno de desarrollo

- Carpeta local del proyecto: `Manna/`.
- Node instalado con Homebrew en el Mac de desarrollo. El equipo principal de la iglesia es otro, con Windows.
- `data/` y casi todo `Contenido/` (13 biblias con derechos, 613 himnos en video que ocupan 5,4 GB, y sus letras) existen solo en local; están en `.gitignore`.
- El Mac de desarrollo tiene ffmpeg, yt-dlp y PowerPoint. Para simular un equipo sin ellos: `MANNA_FALTA=ffmpeg,yt-dlp,powerpoint` (ver `.claude/rules/servidor.md`).
