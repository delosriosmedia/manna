# Plan de trabajo: versión 2

Estado: **aprobado por el dueño el 2026-10-04. En curso: hechas las fases 0, 1, 2, 4, 6 y 7; sigue la 8 (diapositivas). La 3 (televisores) está en pausa y la 5 (himnario), pospuesta.**
Parte de la versión 1.0.0 y termina en la 2.0.0.

Este documento es el plan y, al terminar, la base de la auditoría (sección 8). Se actualiza al cerrar cada fase: la sección 9 lleva el avance, la 10 cada cambio que se le hizo al plan y por qué, y la 11 los cambios que se le sugieren al dueño y aún no ha decidido.

## 1. Qué se pide

| # | Petición | Dónde queda |
| --- | --- | --- |
| A | Módulo comparador de versiones | Fase 2 (hecho) |
| B | Búsqueda mejor: exactas primero, parecidas después, resaltado; rápida. **Solo en la Reina-Valera 1960** (decisión 12) | Fase 1 (hecho), ajustada en la 2 |
| C | Pantalla de proyección en televisores (Samsung, LG, Android TV), a pantalla completa | Fase 3 |
| D | Imágenes: subir, nombrar, ajustar a pantalla, zoom y desplazamiento en vivo | Fase 4 |
| E | Himnario: 613 videos, dos vistas, buscador con letra, volumen, barra de avance, **cantado o pista** | Fase 5 |
| F | Videos y audios locales en cualquier formato, con **conversión en segundo plano y avance a la vista** | Fase 6 |
| G | YouTube: descargar al añadir el enlace, proyectar sin anuncios, **con subtítulos opcionales** | Fase 7 (hecho) |
| H | Diapositivas: PDF y PowerPoint, con vista de la siguiente, cuántas faltan y zoom | Fase 8 |
| I | Imágenes y medios en un solo módulo | Decidido: sí (3.1) |
| J | Que la **revisión inicial del equipo** compruebe lo necesario y avise de qué módulos funcionarán y cuáles no, **sin bloquear**; y que cada módulo avise al abrirlo si le falta algo | Fases 0 y 1 (hecho) |
| K | Un **volumen general** de Manna, sin tocar el del equipo | Base en fase 0; mando en fase 5 |

## 2. Lo que se midió

Datos medidos en el proyecto, no supuestos.

- **Himnos.** `Himnario/` tiene 613 archivos `.mp4` (5,4 GB) con nombre `NNN Título.mp4`: H.264 a 1080p con **dos pistas de audio**. La primera es la cantada; la segunda, la instrumental (confirmado por el dueño). Elegir la pista con ffmpeg, sin recodificar, tarda **0,09 s** para un himno de 3 minutos.
- **Búsqueda en todas las versiones** (14 biblias, 430.000 versículos). Sin índice, buscar una frase tardaba entre 30 y 85 ms. **Con el índice de la fase 1**: entre 1 y 8 ms lo habitual, y 80 ms en el peor caso (palabras que están en casi todos los versículos, como "de la"). Preparar el índice tarda 0,16 s por versión, en segundo plano. Memoria con todo cargado: 106 MB las biblias más 160 MB los índices.
- **Conversión de video con ffmpeg** (Mac de desarrollo, M3 Pro, video de 1080p):

  | Caso | Qué hace Manna | Un video de 10 minutos |
  | --- | --- | --- |
  | MP4, M4V o MOV con H.264 (lo habitual de un celular, una cámara o una edición) | Nada: se usa tal cual | 0 s |
  | MKV con H.264 dentro, o elegir otra pista de audio | Cambia el envoltorio, sin recodificar | 1 a 3 s |
  | YouTube a 1080p | Descarga imagen y sonido ya compatibles y los une | Lo que tarde la descarga (1 min aprox. con 20 Mb/s) más 2 s |
  | AVI, MPEG, WMV y otros que el navegador no reproduce | Conversión completa | Entre 30 s (imagen tranquila, 21 veces más rápido que el video) y 4 min (mucho movimiento, 2,6 veces). Con el chip de video, 1,5 min constantes |

  En un equipo Windows de gama media la conversión completa será de 2 a 5 minutos; en uno antiguo, hasta unos 10. **La mayoría de los videos no necesita conversión.**
- **Televisor del dueño: Samsung 55QN85F (Neo QLED, 2025).** Su navegador es reciente, así que debería poder abrir la pantalla de proyección normal. En la prueba no abrió ni `manna.local` ni las dos direcciones numéricas, mientras un iPhone entraba al instante. Comprobado el 2026-10-04 desde el Mac de desarrollo:
  - El televisor está en `192.168.1.3` y el Mac en `192.168.1.14`: **misma red**. El televisor responde desde el Mac, el cortafuegos del Mac está apagado y Manna escucha en el puerto 80. **No es un problema de red.**
  - La "segunda dirección" que mostraba Manna era `169.254.x.x`: la de un adaptador sin red. No sirve para nada y no debería ofrecerse.
  - **Confirmado con una foto del dueño**: al escribir `http://192.168.1.14`, el navegador del televisor lo convierte en `https://192.168.1.14/` y dice "No se encontró el servidor". Pide una página segura que Manna no ofrece.
  - Falta saber si hace lo mismo con una dirección que lleva puerto (`http://192.168.1.14:8000`). Desde la versión 1.3 Manna atiende también en el 8000 para poder probarlo.
- **Video en el navegador.** Chrome reproduce MP4, M4V y MOV con H.264, y WebM. No reproduce AVI, MPEG ni WMV.
- **Un video real del dueño** (2026-10-04): MP4 de 483 MB, 2:24, **4K, HEVC de 10 bits** a 26 Mb/s, con sonido AAC. Es el formato que exportan muchos editores y cámaras recientes. Medido en el Mac de desarrollo (M3 Pro):

  | Qué se hace | Tiempo para este video |
  | --- | --- |
  | Convertir como lo hace Manna 1.6 (el chip codifica; la lectura del 4K, por programa) | 59 s |
  | Lo mismo, leyendo también con el chip (`-hwaccel auto`) | 28 s |
  | Sin chip y con dos hilos, como un equipo modesto | 2 min 10 s |
  | **Reproducirlo tal cual en Chrome**, sin convertir | 0 s: lo admite, con el chip, 304 cuadros en 10 s y ninguno perdido; salta sin problema |

  Con la 1.6.2 (decisión 27), ese video se pudo proyectar a los **3,3 s** de copiarlo, con el original, y su copia ligera tardó **26 s**.

  Bajar la calidad o el tamaño del resultado casi no ahorra tiempo: lo que cuesta es leer el 4K. En Windows, Chrome y Edge reproducen HEVC solo si la tarjeta gráfica lo decodifica (en general, equipos de 2017 en adelante); en uno más antiguo hay que convertir, y ahí tardaría varios minutos.
- **Herramientas.** En el Mac de desarrollo están ffmpeg 8.1, yt-dlp y PowerPoint. En el equipo Windows de la iglesia lo comprobará la revisión del equipo.
- **Las categorías del himnario** en nuevohimnario.com se cargan con un programa de la página; su estructura se revisará en la fase 5.

## 3. Decisiones de diseño

### 3.1 Imágenes y medios: un solo módulo

**"Medios"**, con cuatro pestañas: Imágenes, Videos, Audios y YouTube. Comparten biblioteca, subida y nombre. **En el orden del culto cada cosa conserva su identidad**: icono, color y etiqueta propios. Diapositivas va aparte porque se maneja de otra forma.

### 3.2 Todo lo proyectable es un "tipo de contenido"

| Tipo | Módulo | Pasos | Mandos propios cuando está al aire | Estado |
| --- | --- | --- | --- | --- |
| `verses` | Biblia | Un versículo por paso | — | Hecho (1.0) |
| `testcard` | Proyección | Uno | Imagen (encuadre, colores, blanco) y cronómetro | Hecho (1.1) |
| `compare` | Biblia (pantalla Comparador) | Un versículo por paso | Disposición: lado a lado o una sobre otra | Hecho (1.3) |
| `image` | Medios | Uno | Ajuste, zoom, desplazamiento | Hecho (1.5) |
| `song` | Himnario | Uno (el video) | Pausa, reinicio, avance; cantado o pista | Fase 5 |
| `video`, `audio` | Medios | Uno | Pausa, reinicio, saltos, barra de avance; subtítulos; volumen general | Hecho (1.6) |
| `youtube` | Medios | Uno | Los mismos, con elección del idioma de los subtítulos | Hecho (1.7) |
| `slides` | Diapositivas | Una diapositiva por paso | Zoom, desplazamiento, vista de la siguiente | Fase 8 |

"Cantado o pista" se elige **antes** de proyectar o de añadir al orden (queda guardado en el elemento) y también se puede cambiar al aire.

### 3.3 Cimientos

Lo que varias fases necesitan, construido una sola vez. Dónde quedó cada pieza:

| # | Pieza | Estado | Dónde |
| --- | --- | --- | --- |
| 1 | Cómo se dibuja cada tipo (también en miniatura) | Hecho | `web/core/kinds.js`, `web/modules/kinds.js`, `web/modules/<id>/kind.js`, `web/modules/projection/stage.js` |
| 2 | Mandos en vivo por tipo | Hecho | Espacio `live` del estado y acción `projection.control` (`server/modules/projection/index.js`); `web/modules/projection/live.js` |
| 3 | Reloj de reproducción compartido | Hecho | `server/core/playback.js`, `web/core/playback.js`; la hora del servidor viaja en el latido |
| 4 | Una sola salida de sonido | Hecho (fase 6) | El servidor elige la pantalla que suena (`conexiones.sonido`, `server/core/realtime.js`). El volumen general está en `live.volume` y su mando en `web/modules/projection/volume.js` |
| 5 | Archivos grandes | Hecho | Trozos (Range) y subida directa a disco en `server/core/router.js`; `upload()` con avance en `web/core/api.js` |
| 6 | Carpetas de contenido | Base hecha | Todo lo de la iglesia en `Contenido/` (decisión 13). `server/core/folders.js` (vigilar y listar), `app.mount()` para servirlas, `data/tmp/` que se vacía al abrir y al cerrar. El himnario y los medios se conectan con su módulo (fases 5 y 6) |
| 7 | Programas externos | Hecho | `server/core/tools.js` e `install.js`; página `/requisitos`; sección en Ajustes; aviso por módulo (`needs`, `web/core/needs.js`) |
| 8 | "Más" en la barra de pestañas del celular | Hecho (fase 4) | `web/core/shell.js`: con más de cinco módulos, los cuatro primeros y "Más" |
| 9 | Nombre editable en cualquier elemento del orden | Hecho | `order.rename`, `renameItem` en `server/modules/order/logic.js` |
| 10 | Búsqueda compartida | Hecho (fase 1) | `server/core/search.js` |
| 11 | Selector de pasajes reutilizable | Hecho (fase 2) | `web/modules/bible/passages.js`, que usan Biblia y Comparador |
| 12 | Tareas en segundo plano con avance y tiempo restante (añadido) | Hecho | `server/core/jobs.js`, espacio `jobs`; `web/core/jobs.js`; se ven en el panel "Al aire" |

### 3.4 Programas del equipo principal

El código sigue sin dependencias. Lo aprobado son **programas aparte** y una biblioteca dentro del proyecto:

| Qué | Para qué | Nivel |
| --- | --- | --- |
| Node.js 18+ | El servidor | Sin él no arranca (lo comprueba el instalador del icono) |
| Chrome o Edge | Ventana de proyección en la segunda pantalla | Necesario para esa función |
| ffmpeg | Convertir, unir YouTube, pista de los himnos | Necesario para esas funciones |
| yt-dlp | Descargar de YouTube | Necesario para YouTube |
| PowerPoint | Convertir `.pptx` | Opcional: se usa por defecto si está; si no, se pide el PDF |
| pdf.js (Mozilla, Apache 2.0) | Leer PDF en el navegador | Archivo en `web/vendor/`; llega en la fase 8 |

**Revisión del equipo.** Cada vez que Manna se abre comprueba todo lo anterior. Si falta algo se abre en `/requisitos` en vez de en el control. La página dice **qué módulos funcionarán completos y cuáles no**, y para cada programa, para qué sirve; ofrece **Instalar por mí** (ffmpeg y yt-dlp, descargados de su sitio oficial a `data/herramientas/`, con comprobación de la huella, sin tocar el sistema) y los pasos para hacerlo a mano.

**Nada bloquea** (decisión del dueño): desde la revisión se continúa a la app con un clic, falte lo que falte. Dentro, **cada módulo avisa al abrirlo** de lo que no podrá hacer y ofrece instalarlo o ver cómo. Qué necesita cada módulo lo declara el propio módulo (`needs`).

## 4. Fases, en orden

De menor a mayor riesgo; cada fase deja algo usable y **se publica al cerrarla** (decisión 9). Tamaño: S pequeño, M mediano, L grande.

| Fase | Entrega | Tamaño | Versión |
| --- | --- | --- | --- |
| 0 | Cimientos, revisión del equipo e imagen de prueba | M | 1.1 |
| 1 | Búsqueda mejorada | S | 1.2 |
| 2 | Comparador de versiones | M | 1.3 |
| 3 | Pantalla para televisores | M | 1.4 |
| 4 | Medios: imágenes | M | 1.5 |
| 6 | Medios: videos y audios locales, con la reproducción | L | 1.6 |
| 7 | Medios: YouTube | M | 1.7 |
| 8 | Diapositivas | L | 1.8 |
| 5 | Himnario | M | 1.9 |
| 9 | Auditoría del proyecto completo | M | 2.0 |

**Orden cambiado el 2026-10-04 (decisión 20)**: la fase 6 va antes que la 5, mientras el dueño revisa las letras de los himnos. La reproducción (pausa, avance, volumen, una sola pantalla que suena), que iba a estrenarse con el himnario, se construye con los videos.

**Y el 2026-10-05 (decisión 28)**: tras la fase 7 se hace la 8 (diapositivas); ahí se detiene el trabajo para que el dueño pruebe, y después se revisa el himnario.

Por qué este orden: búsqueda y comparador usan datos que ya existen; los televisores dependen de pruebas del dueño, que conviene empezar pronto; las imágenes estrenan biblioteca y subidas sin la complejidad del sonido; el himnario estrena la reproducción con archivos que ya son compatibles; YouTube y diapositivas, los que dependen de programas de terceros, al final.

### Fase 0 · Cimientos — hecha (1.1.0)

Construido: la tabla de 3.3, la revisión del equipo de 3.4 y la **imagen de prueba**, que es el "tipo de prueba" que pedía el criterio de cierre y además sirve para encuadrar el proyector o un televisor y ver que las pantallas van a la par.

**Criterio de cierre, cumplido**: todas las pruebas anteriores pasan, y un tipo nuevo se dibuja, se gobierna en vivo, va a la par en dos pantallas y se añade al orden. Resultados y lo que quedó sin probar, en la sección 9.

### Fase 1 · Búsqueda mejorada — hecha (1.2.0)

Construido como estaba previsto, salvo lo anotado en la sección 10. Resultados en la sección 9. **Después, por la decisión 12, la búsqueda dejó de hacerse en todas las versiones**: lo que sigue sobre "las demás versiones" ya no aplica; se busca solo en la Reina-Valera 1960.

Resultados en tres niveles, en este orden:

1. **Frase exacta** (sin importar tildes ni mayúsculas). Primero la versión elegida; después las demás, cada resultado con la versión donde se encontró. El mismo versículo no se repite por versión: se agrupa.
2. **Todas las palabras**, en cualquier orden.
3. **Parecidas**: otras formas de la misma palabra ("amó", "amar", "amor") y una lista corta de sinónimos bíblicos escrita a mano (Señor / Jehová).

En todos se **resalta** lo encontrado. Sin modelo de lenguaje (decisión 4). Para que sea rápida:

- **Índice** de todas las biblias instaladas, hecho en segundo plano al arrancar y rehecho al copiar o borrar una biblia: el texto ya normalizado y un índice de palabras. La primera búsqueda no espera.
- La pieza de búsqueda (normalizar, ordenar por relevancia, resaltar) va en `server/core/search.js` para que el himnario use la misma.
- Buscar mientras se escribe, con una pausa de 150 ms; 50 resultados por nivel con "ver más".
- Moverse por los resultados con el teclado: flechas para recorrerlos, Enter para ir al versículo y otro Enter para proyectarlo.
- Si el texto que coincide es de otra versión, el resultado lo dice y al elegirlo se pasa a esa versión: se proyecta lo que se leyó.

**Criterio de cierre, cumplido**: una búsqueda en todas las versiones responde en menos de 100 ms en el equipo de desarrollo (1 a 8 ms lo habitual, 80 ms el peor caso), con pruebas del orden de los resultados y del resaltado.

### Fase 2 · Comparador de versiones — hecha (1.3.0)

Construido como estaba previsto, salvo lo anotado en la sección 10. Resultados en la sección 9.

- Módulo propio. El selector de pasajes de Biblia (libros, capítulos, versículos) se separa a una pieza reutilizable y los dos módulos la usan.
- Dos selectores de versión y un botón de disposición: lado a lado o una sobre otra. La disposición también se cambia al aire (mando en vivo).
- En pantalla: las dos versiones con una línea fina de separación, cada una con su sigla. El tamaño del texto se ajusta para que quepan.
- En el orden: tipo propio (`compare`), con icono, color y la etiqueta "Comparador", y las dos siglas en la línea secundaria.
- Si un versículo no existe en una de las versiones, ese lado lo indica.

### Fase 3 · Pantalla para televisores — construida (1.4.0), en pausa

**En pausa desde el 2026-10-04 (decisión 19)**: el televisor del dueño no llegó a mostrar la proyección. Se retoma al terminar las demás fases.

Lo que se hizo está en la sección 9. Lo que sigue es el plan original, que se conserva como referencia.

1. **Diagnóstico con el Samsung 55QN85F.** La red está descartada y la causa confirmada: el televisor convierte la dirección en `https` (sección 2). Prueba pendiente del dueño, con Manna reiniciado: `http://192.168.1.14:8000`.
   - **Si abre**: la fase queda en el botón de pantalla completa y la documentación.
   - **Si también la convierte**: Manna tiene que ofrecer páginas seguras. Se le añade un servidor `https` con un certificado hecho por el propio Manna (sin dependencias). El televisor avisará una vez de que no conoce el certificado y habrá que aceptar. Es el trabajo grande de esta fase, y no se puede probar sin el televisor.
2. **Ayuda dentro de Manna** (hecho en la 1.3): "Dispositivos" explica qué escribir en un televisor, ya no ofrece direcciones de adaptadores sin red (`169.254…`), y Manna atiende en el 80 **y** en el 8000. La imagen de prueba (fase 0) confirma el encuadre y la sincronía.
3. **Pantalla completa con el mando**: botón grande que se activa con OK. `manna.local` no funciona en la mayoría de televisores: se usa la dirección numérica, y conviene fijarla en el router.
4. **Página sencilla para televisores antiguos** (`/tv`, escrita para navegadores viejos): **solo si** las pruebas muestran que la página normal no abre en algún televisor. El del dueño es de 2025 y no debería necesitarla.
5. **Alternativas sin navegador**, que ya funcionan hoy sin tocar nada: el 55QN85F admite **proyección inalámbrica desde Windows** (Win + K, "Extender": el televisor pasa a ser la segunda pantalla y Manna abre ahí la proyección sola) y **AirPlay** desde Mac (Duplicar pantalla → "Usar como pantalla aparte"); también cable HDMI. Para un televisor fijo en la iglesia suele ser lo más estable.

**Límite**: no hay televisor en el equipo de desarrollo. Esta fase se cierra con las pruebas del dueño.

### Fase 4 · Medios: imágenes — hecha (1.5.0)

- Biblioteca con miniaturas. Se sube desde el equipo principal o desde la galería de un celular (control completo), con barra de avance. La imagen se reduce en el propio dispositivo antes de enviarla.
- Al subir se propone un nombre, que es el que se ve en el orden.
- **Ajuste a pantalla** sobre dos miniaturas: completa con bandas negras, o llenando la pantalla.
- **Al aire**: un recuadro donde se arrastra y se hace zoom (rueda, dos dedos o deslizador); la proyección lo sigue. Botón para volver a la vista completa.
- **Navegación**: con este módulo las pestañas del celular pasan de cuatro; se añade "Más".

### Fase 5 · Himnario — pospuesta, va después de la 6 (decisión 20)

La reproducción, que se iba a estrenar aquí, se construye en la fase 6. El himnario la recibe hecha.

Himnario:

- Lee `Contenido/Himnario/videos/` (`.mp4`, `.m4v`). Avisa si faltan números.
- **Vista en cuadrícula** (nota musical, número, título) y **vista por categorías** (grupos con el nombre grande).
- **Buscador** por número, título y letra, con el índice y el resaltado de la fase 1.
- **Cantado o pista**: se elige antes de proyectar o de añadir al orden, y queda en el elemento. La pista se prepara con ffmpeg en 0,1 s, sin recodificar, en `data/tmp/`.
- En el orden: barra de avance, pausa y reinicio en la propia fila.

**Letras.** Ya están en el equipo: el dueño las entregó en 13 archivos `.md` (613 himnos), en `Contenido/Himnario/letras/`. El formato está en su `LEEME.txt`: `## número. título`, `### Estrofa 1`, `### Coro`. Manna las lee de ahí, las indexa con la misma pieza que la Biblia y busca por número, título y letra. No se publican. 15 himnos tienen alguna parte de una sola línea (lista en `docs/ESTADO.md`): se mostrarán tal como están.

**Categorías.** Los mismos grupos y nombres que usa nuevohimnario.com/Himnario (decisión 14): solo el nombre de cada categoría y qué números de himno le corresponden.

### Fase 6 · Medios: videos y audios locales, con la reproducción — hecha (1.6.0)

Reproducción (para todo lo que suena): reloj compartido (hecho), pausa, reinicio, avance, y un **control de volumen grande** en el panel "Al aire" y en el orden mientras haya algo con sonido. Es el **volumen general de Manna**: uno solo para todo, sin tocar el del equipo (decisión 6).

- Carpeta `Medios/` (se copian archivos y aparecen) y subida desde la app, con nombre propuesto.
- **Qué se convierte**: nada si el navegador ya lo reproduce; solo el envoltorio si dentro hay H.264 (segundos); conversión completa en el resto, usando el chip de video del equipo si lo tiene. Tiempos en la sección 2.
- **La conversión no detiene nada**: corre en segundo plano como una tarea, con porcentaje y tiempo restante a la vista **en el módulo, junto al elemento, y en el panel "Al aire"**. El elemento se puede añadir al orden mientras tanto; al terminar queda listo para proyectar. El resultado se guarda: se convierte una sola vez.
- Subtítulos de un archivo `.srt` o `.vtt` con el mismo nombre que el video, con el mismo mando que YouTube.
- Audios: se proyecta el fondo con el nombre, y suenan con los mismos mandos.

### Fase 7 · Medios: YouTube — hecha (1.7.0)

- Se pega el enlace (desde el equipo principal o desde un celular); Manna lo descarga con yt-dlp a 1080p como máximo, como tarea con avance. Se pide imagen H.264 y sonido AAC, que solo hay que unir.
- **Subtítulos**: yt-dlp baja los que tenga el video en español y en inglés (los del autor y, si no hay, los automáticos) en formato WebVTT, que lleva los tiempos; el navegador los muestra sincronizados por sí solo. Un mando en vivo los **activa o desactiva** y elige el idioma. Los automáticos de YouTube traen líneas repetidas, que Manna limpia.
- **Los videos se conservan en la biblioteca** (`data/media/youtube/`), como cualquier otro video. *El plan decía borrarlos al cerrar Manna y volver a descargarlos al necesitarlos; se cambió (sección 10): así un video preparado el jueves se proyecta el sábado aunque ese día no haya internet o YouTube no deje descargar.* La descarga sí pasa por `data/tmp/` y solo se guarda si termina bien.
- Solo se aceptan enlaces de YouTube, y nunca se pasa texto del usuario a una línea de órdenes: del enlace se toma solo el identificador del video.

**Límites**: hace falta internet al añadir el enlace, no al proyectar. yt-dlp deja de funcionar cada cierto tiempo cuando YouTube cambia algo: Ajustes tiene un botón para actualizarlo. Descargar de YouTube va contra sus condiciones salvo contenido propio o con permiso: úsalo con los videos de la iglesia.

### Fase 8 · Diapositivas

- **PDF**: el navegador del control lo convierte en imágenes, una por página. Sirven en cualquier pantalla y heredan el zoom de la fase 4.
- **PowerPoint, por defecto con PowerPoint** (decisión 3): en Windows se le pide, sin ventana, que exporte cada diapositiva como imagen (automatización de Office con `WithWindow` desactivado; si ya había un PowerPoint abierto, no se cierra). Sin PowerPoint, se pide el PDF. En Mac, PowerPoint se abre a la vista un momento.
- En el orden: anterior y siguiente, miniatura de la que viene, "quedan N", zoom y desplazamiento.
- **Límite**: animaciones, transiciones y videos incrustados se pierden; cada diapositiva es una imagen fija.

### Fase 9 · Auditoría

Sección 8.

## 5. Cómo se trabaja cada fase

1. Detalle de la fase si hay algo que decidir; si no, se implementa.
2. Pruebas: automáticas para la lógica y para el servidor por HTTP, `probar-chrome` para el recorrido, `auditar-responsive` para celular y tableta.
3. Documentación al día: `README`, `DESIGN.md`, reglas, `ESTADO.md`, `CHANGELOG.md` y este plan (secciones 9 y 10).
4. Publicación al cerrar la fase, y resumen al dueño: resultados, lo probado y lo que no, la fase que sigue y los cambios que haga falta hacer al plan.

Lo que no se puede probar en el equipo de desarrollo y depende del dueño en cada fase: el equipo Windows, televisores reales, celulares reales y el sonido por el equipo de la iglesia.

## 6. Decisiones del dueño

Tomadas el 2026-10-04.

| # | Decisión | Respuesta |
| --- | --- | --- |
| 1 | ¿Imágenes y medios en un solo módulo "Medios"? | **Sí** |
| 2 | ¿ffmpeg y yt-dlp en el equipo principal, y pdf.js dentro del proyecto? | **Sí**, con una condición: que siga siendo fácil descargar y abrir la app, y que la revisión inicial garantice que el equipo tiene todo |
| 3 | PowerPoint | **PowerPoint por defecto**, en segundo plano si es posible |
| 4 | Búsqueda por significado | **Sin modelo de lenguaje.** Garantizar el índice y la velocidad en Biblia e himnario |
| 5 | Letras de los himnos | **Incluirlas, en local**: el dueño tiene la licencia y las entregó en archivos `.md`. Ver nota |
| 6 | Volumen | **Solo el de Manna**, como volumen general de todo lo que suene. No se toca el del equipo |
| 7 | Televisor | Samsung 55QN85F, en `192.168.1.3`. No abrió con el nombre ni con las dos direcciones; un iPhone sí |
| 8 | Segunda pista de audio de los himnos | **Es la instrumental**: ofrecer "Cantado / Pista" |
| 9 | ¿Publicar al cerrar cada fase? | **Sí** |
| 10 | ¿Qué bloquea el arranque si falta un programa? | **Nada.** Se deja avanzar con un aviso de qué módulos funcionarán y cuáles no; y dentro de la app, el módulo al que le falte algo también avisa y ofrece instalarlo o ver cómo |
| 11 | Informe al cerrar cada fase | Mostrar de nuevo el plan con las fases superadas y las observaciones, y un apartado con los cambios que se le sugieren |
| 12 | ¿En qué versiones se busca el texto? | **Solo en la Reina-Valera 1960.** Quitar la búsqueda en todas las versiones |
| 13 | ¿Dónde pone cada iglesia sus archivos? | **En una sola carpeta** (`Contenido/`): versiones de la Biblia, himnario en video e himnario en texto |
| 14 | Categorías del himnario | Las de nuevohimnario.com/Himnario: la misma agrupación y los mismos nombres, sin reproducir nada más |
| 15 | ¿Himnario antes que imágenes? (S6) | **No.** El himnario espera dos fases (3 y 4) mientras el dueño revisa las letras |
| 16 | Televisor (S5) | **Tiene que ser pantalla remota por su navegador.** Como segunda pantalla ya funciona, pero esa salida es para el proyector. Revisar el control por IP que trae el televisor |
| 17 | Filtro de búsqueda (S4) | **Sí**, por testamento |
| 18 | Orden de trabajo | Fase 3 y, a la vez, fase 4 |
| 20 | ¿Qué sigue tras las imágenes? (S13) | **Videos y audios (fase 6).** El himnario se sigue posponiendo |
| 21 | Televisores en la barra (S12) | **Fuera de la barra** mientras esté en pausa |
| 22 | ¿Fondo desde la biblioteca de Medios? (S14) | **No.** El fondo se elige en Ajustes, porque se usa poco. Las imágenes subidas como fondo deben **conservarse**, salir **junto a los colores** y poder **eliminarse** |
| 23 | ¿Álbumes en la biblioteca? (S15) | **No agrupar.** De la más reciente a la más antigua, con la hora en que se agregó |
| 24 | «Negro» y «Solo fondo» con algo sonando (S16) | **Lo pausan.** Y todo lo que detenga el sonido (pausa, negro, cambiar de contenido) lo hace con un **desvanecido rápido**, sin corte; la interfaz reacciona al instante |
| 25 | Al terminar un video (S17) | **Pasar a «Solo fondo»** con un desvanecido rápido |
| 26 | Botón para hacer sonar (S18) | **No.** Se quita también el aviso «Toca aquí para que suene». El sonido va solo al dispositivo de audio configurado en el equipo principal |
| 28 | Orden tras la fase 7 (2026-10-05) | **Pasar de una vez a la fase 8 (diapositivas) y ahí detenerse** para hacer pruebas, antes de revisar la fase del himnario |
| 27 | La espera al convertir un video pesado (S19, S20, S21) | **Convertir más rápido y poder usar el video de inmediato**; la conversión para los dispositivos remotos, de fondo. **No** medir el equipo desde la revisión |
| 19 | Televisor, tras la primera prueba | **En pausa.** Remotamente solo se abrió el navegador y el puntero se movió un poco; escribiendo la dirección a mano tampoco carga. Se retoma cuando estén hechas las demás modificaciones |

**Decisión 5 · Letras.** El dueño pidió incluirlas: las iglesias donde se usará Manna tienen la licencia de las letras y de toda la música oficial de la Iglesia Adventista del Séptimo Día. Cómo se resuelve:

- Las letras **se usan**: Manna las lee de `Contenido/Himnario/letras/`, las indexa y las ofrece en el buscador del himnario (fase 5).
- **Se quedan en el equipo**, igual que los videos y las biblias: cada iglesia con licencia copia esa carpeta. No van en el repositorio de GitHub, que es público y las entregaría a cualquiera, tenga licencia o no.
- **El asistente no las copió de un sitio web**: el dueño, que tiene la licencia, las entregó en archivos `.md` el 2026-10-04. Tampoco se escriben letras reales en el código, las pruebas ni la documentación: ahí se usan textos inventados.

## 7. Riesgos

| Riesgo | Cómo se reduce |
| --- | --- |
| Los índices de búsqueda ocupan memoria (160 MB con 14 versiones) | Medido; si el equipo de la iglesia va justo, se añade elegir en qué versiones se busca (sección 11) |
| Las "parecidas" de la búsqueda salen de reglas, no de entender el texto | Van siempre al final, después de las coincidencias exactas; la tabla de verbos y sinónimos se amplía con el uso |
| "Instalar por mí" no se ha probado en Windows | Probado en Mac con descargas simuladas y con el camino del `.zip`; siempre quedan los pasos a mano. Primera prueba pendiente en el equipo de la iglesia |
| Los sitios de descarga cambian de dirección | Las direcciones están en un solo lugar (`server/core/tools.js`); el error dice que se instale a mano |
| Navegadores de televisor muy antiguos | Página aparte solo si hace falta; alternativas sin navegador documentadas |
| yt-dlp deja de funcionar | Botón «Actualizar» en Ajustes (hecho); el fallo se dice con palabras de quien usa Manna y sugiere actualizar; lo ya descargado sigue en la biblioteca; el resto de Manna no depende de él |
| YouTube exige iniciar sesión o bloquea las descargas desde la red de la iglesia | No hay arreglo desde Manna: se dice que se intente más tarde. Alternativa de siempre: descargar el video por otro medio y subirlo a la pestaña Videos |
| Conversión lenta de videos largos | Se hace al añadir, no al proyectar; en segundo plano con avance; se guarda el resultado |
| Sonido con retraso o doble | Una sola salida de sonido; las demás pantallas en silencio |
| Memoria con 14 versiones cargadas | Índice en segundo plano y opción de limitar versiones |
| Contenido con derechos en el repositorio | `Himnario/`, `Medios/`, letras y biblias fuera de git; revisión en cada publicación |
| Disco lleno por medios | Tamaño visible en Ajustes; lo temporal se borra al abrir y al cerrar |
| La interfaz se recarga de módulos | Un módulo de medios; "Más" en celular; mandos solo cuando hacen falta |

## 8. Auditoría final (fase 9)

Al terminar, se revisa el proyecto entero contra esta lista y se entrega un informe con lo encontrado y lo corregido.

**Contra este plan**
- [ ] Cada petición de la sección 1 está cumplida, o consta por qué no.
- [ ] Cada decisión de la sección 6 quedó anotada en `docs/ESTADO.md`.
- [ ] Cada cambio de la sección 10 se cumplió en la fase a la que se movió.

**Arquitectura**
- [ ] Ningún módulo del servidor importa archivos de otro.
- [ ] Todo lo proyectable es un tipo registrado, se puede añadir al orden y se recorre con "Siguiente".
- [ ] Todo mando en vivo pasa por `projection.control` y lo valida su tipo.
- [ ] Ningún dato compartido vive solo en un navegador.
- [ ] No queda código muerto ni duplicado entre módulos (incluida la tabla de tipos previstos de `web/modules/kinds.js`).

**Seguridad**
- [ ] Toda acción declara permiso y valida su entrada.
- [ ] Subidas: tamaño limitado, tipo comprobado, nombres saneados, nada fuera de sus carpetas.
- [ ] Programas externos: solo a través de `server/core/tools.js`, siempre con lista de argumentos.
- [ ] Ningún programa que falte bloquea la app: cada módulo declara lo que necesita (`needs`) y avisa.
- [ ] Descargas de programas: solo de las direcciones fijadas en el código, con huella comprobada, y solo a petición desde el equipo principal.
- [ ] Enlaces de YouTube validados.
- [ ] Un dispositivo remoto sin PIN no puede cambiar nada.

**Calidad**
- [ ] Pruebas automáticas para toda la lógica; recorrido completo en Chrome real; auditoría de pantallas limpia.
- [ ] Mensajes de error en español y con qué hacer.
- [ ] Cada pantalla sigue `DESIGN.md`: un acento, iconos de la familia, estados vacío, cargando y error.

**Rendimiento**
- [ ] Arranque, memoria y tiempo de búsqueda medidos y anotados (búsqueda: hecho en la fase 1; repetir con el himnario).
- [ ] Un video de una hora se reproduce y salta sin cargarlo entero.
- [ ] Mover un mando en vivo no reenvía el contenido proyectado.

**Legal y contenido**
- [ ] El repositorio no contiene biblias, himnos, letras ni medios con derechos.
- [ ] Licencias de lo incluido (Geist, Phosphor, qrcode-generator, pdf.js) presentes, y créditos de lo que se instala aparte (ffmpeg, yt-dlp).

**Documentación**
- [ ] `README`, `DESIGN.md`, reglas, skills, `ESTADO.md` y `CHANGELOG.md` describen lo que hay.
- [ ] Otra persona puede instalar y continuar el proyecto solo con el repositorio.

**En el equipo real**
- [ ] Instalación, revisión del equipo ("Instalar por mí") y uso en el Windows de la iglesia, con proyector.
- [ ] Sonido, televisor y celulares reales.

## 9. Seguimiento

| Fase | Estado | Versión | Notas |
| --- | --- | --- | --- |
| 0 Cimientos | **Hecha** · 2026-10-04 | 1.1.0 | Ver abajo |
| 1 Búsqueda | **Hecha** · 2026-10-04 | 1.2.0 | Ver abajo. Incluye el cambio de la revisión del equipo: ya nada bloquea |
| 2 Comparador | **Hecha** · 2026-10-04 | 1.3.0 | Ver abajo. Incluye la carpeta `Contenido/`, la búsqueda solo en RVR1960 y el segundo puerto |
| 3 Televisores | **En pausa** (decisión 19) · construida el 2026-10-04 | 1.4.0 | Ver abajo. El televisor del dueño no carga la proyección, ni a mano. Se retoma al final |
| 4 Imágenes | **Hecha** · 2026-10-04 | 1.5.0 / 1.5.1 | Ver abajo. Incluye «Más» en la barra del celular. La 1.5.1 corrige dos fallos que encontró el dueño |
| 6 Videos y audios | **Hecha** · 2026-10-04 | 1.6.0 | Ver abajo. Fue antes que el himnario (decisión 20) y estrenó la reproducción |
| 7 YouTube | **Hecha** · 2026-10-05 | 1.7.0 | Ver abajo. Los videos se conservan en la biblioteca (cambio al plan). Probado con un yt-dlp de mentira: **falta la primera descarga real** |
| 8 Diapositivas | **Sigue** (decisión 28) | 1.8 | PowerPoint oculto: solo se puede probar en Windows. Al terminarla se detiene el trabajo para las pruebas del dueño |
| 5 Himnario | Pospuesta | 1.9 | Videos y letras ya están en `Contenido/Himnario/`. El dueño revisa las letras. Se revisa después de la fase 8 |
| 9 Auditoría | Pendiente | 2.0 | |

### Fase 0 · resultados

- **Pruebas automáticas**: de 24 a 51, todas pasan (`npm test`, 1,4 s). Nuevas: trozos de archivo, reloj de reproducción, tareas, nombre propio, instalador de programas (con un sitio de descargas simulado, incluido un `.zip`) y el servidor completo por HTTP (trozos, caché, subidas con límite, salir de la carpeta servida, mandos en vivo, volumen, revisión del equipo).
- **Chrome real** (`scripts/probar-chrome.mjs`): de 28 a 57 comprobaciones, todas pasan. Nuevas: la revisión del equipo de principio a fin (falta un programa → instalar con avance → abrir Manna), nombre propio en el orden, y la imagen de prueba con sus mandos: **el cronómetro marca lo mismo en dos pantallas y coincide con el servidor**.
- **Pantallas** (`scripts/auditar-responsive.mjs`): 9 tamaños, ahora con cuatro pantallas más (mandos en vivo en el panel y en el orden, inicio y revisión del equipo). Sin problemas. Encontró y se corrigió un desborde de los mandos en el panel estrecho de tableta.
- **Sin probar**: "Instalar por mí" con las descargas reales y en Windows; la detección de PowerPoint y de programas en Windows; la subida de un archivo de varios gigas (probado con 21 MB); el sonido (no hay nada que suene hasta la fase 5).

### Fase 1 · resultados

- **Búsqueda por niveles en todas las versiones**: frase exacta, todas las palabras y parecidas (otras formas de la palabra y 18 grupos de sinónimos bíblicos), con lo encontrado resaltado, la versión de la que sale cada texto y en cuántas más coincide. Un versículo sale una sola vez.
- **Velocidad** (14 versiones, 430.000 versículos, Mac de desarrollo): 1 a 8 ms lo habitual; 41 ms "dio"; 80 ms "de la". El índice se prepara solo al arrancar (2,3 s en total, en segundo plano) y al copiar una biblia.
- **Busca mientras se escribe**, con teclado: flechas, Enter para ir, Enter para proyectar.
- **Revisión del equipo sin bloqueo** (decisión 10): dice qué módulos funcionarán; cada módulo avisa al abrirlo.
- **Pruebas automáticas**: de 51 a 66. Nuevas: la pieza de búsqueda (raíces, niveles, marcas) y la búsqueda en varias versiones.
- **Chrome real**: de 57 a 71 comprobaciones, con biblias de prueba fijas para que no dependa de las que haya en el equipo.
- **Pantallas**: 9 tamaños, con dos pantallas más (resultados de búsqueda, aviso de módulo). Sin problemas.
- **Sin probar**: la búsqueda en el equipo Windows de la iglesia (velocidad y memoria reales) y en un celular real.
- **Límites conocidos**: sin tildes, "oró" y "oro" son la misma palabra, igual que "creó" y "creo"; las "parecidas" no entienden el significado, solo la forma de las palabras y la lista de sinónimos.

### Fase 2 · resultados

- **Comparador**: pantalla propia con dos selectores de versión y la disposición; junto a cada versículo se leen las dos versiones; vista previa, proyección, orden del culto (tipo `compare`) y disposición cambiable al aire.
- **Pieza común**: elegir un pasaje (buscador, recientes, libros, capítulos, versículos, selección) es ahora `web/modules/bible/passages.js`; Biblia y Comparador solo deciden qué se hace con el pasaje.
- **Fuera de la fase, pedido por el dueño**: carpeta `Contenido/` con las letras entregadas (613 himnos), búsqueda solo en la Reina-Valera 1960, y segundo puerto para el televisor.
- **Pruebas automáticas**: de 66 a 71. Nuevas: el tipo `compare` y en qué versión se busca.
- **Chrome real**: de 71 a 78 comprobaciones, con el recorrido del comparador.
- **Pantallas**: 9 tamaños, con la pantalla del comparador. La auditoría encontró y se corrigió que en tableta la cabecera del comparador no dejaba sitio al buscador.
- **Sin probar**: el segundo puerto desde el televisor; el comparador en un celular real.
- **Límites conocidos**: se comparan los versículos por su número; si dos versiones numeran distinto un pasaje, cada lado muestra lo que tiene con ese número.
- **Ajustes pedidos tras la revisión del dueño (1.3.1)**: el número delante de cada versículo en el comparador, también con uno solo; y el filtro de la búsqueda por testamento.

### Fase 3 · resultados

- **`https` propio**: Manna hace su certificado (X.509 armado a mano, sin dependencias) y cada puerto atiende `http` y `https` a la vez; con el 80 se abren también el 8000 y el 443. Comprobado en el Mac con un cliente que exige certificado válido.
- **Control del televisor por la red** (lo que pidió el dueño), probado contra su QN55QN85F:
  - **Funciona**: encontrarlo en la red, leer nombre y modelo, vincular (la clave se guarda), abrir y cerrar el navegador, teclas.
  - **No lo permite este modelo**: pasarle una dirección al navegador. Se probaron las cuatro vías conocidas (abrir con enlace por el canal del mando, con y sin tipo "nativo"; el servicio de aplicaciones web; y parámetros en la orden de abrir): las ignora o no existen.
  - **Sin confirmar**: puntero y texto. Manna los envía como marca el protocolo, pero sin ver la pantalla del televisor no se pudo comprobar que los obedezca.
- **Módulo Televisores**: lista, búsqueda, vinculación, "Abrir la proyección", control remoto con panel táctil, y un botón que escribe la dirección en el televisor. Sabe si el televisor ya muestra la proyección y, si se quedó en el aviso de seguridad, lo explica.
- **Pantalla completa con OK**, y Manna lo pulsa solo cuando el televisor llega a la proyección que se le pidió.
- **Pruebas automáticas**: de 72 a 87. Nuevas: certificado, puerto doble, cliente WebSocket, mando de Samsung y módulo, contra un televisor de mentira.
- **Chrome real**: 12 comprobaciones nuevas (Televisores y `https`). **Pantallas**: 9 tamaños, con la tarjeta y el control remoto.
- **Sin probar** (es la prueba que cierra la fase): que el navegador del televisor abra Manna por `https`, qué aviso muestra y si deja continuar; la pantalla completa; puntero y texto.
- **No hizo falta**: la página sencilla `/tv` para navegadores antiguos (el del dueño es reciente).

- **Prueba del dueño (2026-10-04)**: desde Manna, el navegador del televisor se abrió y el puntero se movió brevemente, nada más. Escribiendo la dirección a mano en el televisor, **tampoco carga**. La fase queda en pausa sin diagnóstico. Lo que sí sirve de ella a todo el proyecto: `https` en los mismos puertos y el registro de cómo llega cada equipo.

### Fase 4 · resultados

- **Módulo Medios**, con la pestaña Imágenes (las de Videos, Audios y YouTube están a la vista, apagadas): biblioteca en rejilla, subir desde el equipo, la galería del celular o arrastrando, varias a la vez, con nombre propuesto y avance por imagen.
- **Reducción en el dispositivo**: lado mayor de 2560 px; el PNG se conserva (por la transparencia) salvo que pese demasiado; un GIF se sube tal cual. La miniatura también la hace el dispositivo.
- **El servidor reconoce la imagen por su contenido** (JPG, PNG, WebP, GIF) y lee sus medidas; lo que no lo es, no entra.
- **Ajuste a la pantalla** sobre dos miniaturas; se recuerda por imagen y viaja en el elemento del orden.
- **Al aire**: la imagen entera con un marco de lo que se ve; arrastrar, rueda, dos dedos, deslizador (hasta 5×) y «Vista completa». Las pantallas calculan el encuadre con la misma cuenta, así que muestran la misma parte aunque tengan otro tamaño.
- **«Más»** en la barra del celular (la pieza 8 de los cimientos, que se había dejado para esta fase).
- **Pruebas automáticas**: de 87 a 92. **Chrome real**: 17 comprobaciones nuevas (Medios y «Más»). **Pantallas**: 9 tamaños, con la biblioteca y los mandos de una imagen al aire.
- **Sin probar**: desde un celular real (galería, fotos HEIC de iPhone, gesto de dos dedos); bibliotecas de cientos de imágenes.
- **Límites conocidos**: no hay carpetas ni búsqueda en la biblioteca; el marco de los mandos supone una pantalla 16:9 (en un proyector 4:3 lo que se ve difiere un poco de lo marcado).

### Fase 4 · lo que encontró el dueño y qué se hizo (1.5.1)

Dos fallos al probar, con causas distintas:

1. **"upload is not a function" al subir un fondo.** En la 1.1 se cambió la subida para que mostrara el avance, usando la función `upload`; el campo de elegir archivo ya se llamaba `upload` y la tapó. Roto durante cuatro versiones. **Por qué no se vio**: se probó la dirección del servidor, no el botón; y un error así no rompe la página, solo muestra un aviso.
2. **"No encontrado" al subir a Medios.** El Manna del dueño llevaba abierto desde antes de que existiera el módulo. La interfaz se lee del disco en cada visita (era la nueva); el servidor vive en memoria (era el viejo, sin Medios). Pulsar el icono otra vez no lo arreglaba: solo mostraba el que ya estaba abierto.

Lo que se añadió para que esta clase de fallos no vuelva:

- **Revisión del código sin ejecutarlo**, dentro de `npm test`: imports que no existen, nombres que tapan algo importado, y órdenes o direcciones que la interfaz pide y el servidor no tiene. Pasada por todo el proyecto, encontró el fallo 1 y ninguno más.
- **La prueba en Chrome vigila toda la sesión**: ningún aviso de error inesperado, ningún error de JavaScript, y la interfaz tiene que usar, pulsando, **todas** las órdenes y direcciones del servidor. Al medirlo salieron **19 órdenes que ninguna prueba pulsaba** (subir, elegir y eliminar fondos; añadir sección, quitar y vaciar el orden; cambiar el PIN; apagar; volver a comprobar el equipo; quitar el aviso de una tarea fallida; cinco de televisores). Todas tienen ya su recorrido, salvo cinco que no se pueden pulsar ahí y están declaradas con su motivo.
- **Manna nota que se actualizó estando abierto**, lo avisa, se reinicia solo desde un botón, las páginas se recargan, y pulsar el icono releva a la copia anterior. Probado con procesos de verdad.
- De paso: el menú "Añadir" del orden aún decía "Imagen · Próximamente".

### Fase 6 · resultados

- **Biblioteca de videos y audios** en Medios: pestañas propias, subida con nombre y avance, y la carpeta `Contenido/Medios/` vigilada.
- **Qué se convierte**, decidido mirando dentro del archivo con ffprobe: nada (lo habitual), solo el envoltorio, o conversión completa a MP4 con H.264 y AAC. Una conversión a la vez, como tarea con avance y tiempo restante; el resultado se guarda y el original no se toca. Se prueba primero el chip de video del equipo y, si falla, libx264.
- **Reproducción compartida** (la parte que venía de la fase 5): reloj en el servidor, reproductor en cada pantalla que se pone en ese punto y corrige el desfase, mandos de pausa, reinicio, saltos y barra.
- **Volumen general con mando**, y **una sola pantalla que suena**, elegida por el servidor.
- **Subtítulos** `.srt` y `.vtt`.
- **Sin ffmpeg** sigue funcionando: lo habitual se acepta por su extensión, y la duración y la imagen las saca el navegador de quien lo sube (o la primera pantalla que lo reproduce).
- **Pruebas automáticas**: de 104 a 117, con conversiones reales. **Chrome real**: de 138 a 167 comprobaciones. **Pantallas**: 9 tamaños, con las pestañas de videos y audios y los mandos de un video al aire.
- **Sin probar**: videos reales de la iglesia (los de las pruebas duran segundos), archivos de varios gigas, la conversión y el chip de video en Windows, subir desde un celular, y oír el sonido por el proyector.
- **Límites conocidos**: "Negro" no detiene el sonido; al acabar un video no avanza solo; el HEVC siempre se convierte.

### Fase 6 · ajustes tras la prueba del dueño (1.6.1)

- **Fallo**: en la pantalla de proyección se quedaba el aviso «Toca aquí para que suene» aunque ya sonara. Era un aviso pensado para pestañas corrientes; se quitó entero (decisión 26).
- **Quién suena** pasa a ser: la proyección del equipo principal y, si no hay, su página de control. Siempre el equipo principal.
- **Desvanecidos** de 0,3 s al pausar, ocultar y cambiar de contenido (decisión 24); **«Negro» y «Solo fondo» pausan**; **al terminar, «Solo fondo»** (decisión 25).
- Para lo último, un tipo de contenido puede decir qué hacer al ocultarse (`hide`) y cuándo termina (`endsAt`); la proyección hace el resto.
- **Conversión de video**: el dueño probó un MP4 de 4K (HEVC de 10 bits, 483 MB, 2:24) y le preocupó la espera. Medido y con alternativas en la sección 11 (S19 a S21): pendiente de su decisión.

### Fase 6 · uso inmediato y conversión más rápida (1.6.2)

- **Conversión**: lee también con el chip de video (`-hwaccel auto`), con vuelta atrás si falla; prioridad baja; se detiene mientras algo se reproduce en pantalla.
- **Uso inmediato**: el equipo principal comprueba solo si su navegador reproduce el original; si puede, el video es proyectable ya. Las pantallas de ese equipo usan el original siempre; las demás, la copia ligera cuando está.
- Para eso: lo que se proyecta puede llevar dos archivos (`local` y `url`), cada conexión sabe si es del equipo principal, y la proyección puede refrescar lo que está al aire sin tocar su reproducción.
- Probado con el video real del dueño: proyectable a los 3,3 s; copia en 26 s en vez de 59.
- **Sin probar**: en Windows.

### Fase 7 · resultados

- **Pestaña YouTube** en Medios: se pega el enlace y el video queda en la biblioteca con su título, su imagen, su duración y sus subtítulos. Tipo de contenido `youtube`, que se reproduce como `video`.
- **Del enlace solo se usa el identificador** del video (11 letras o cifras, de un dominio de YouTube); la dirección que recibe yt-dlp la escribe Manna. Probado con 12 formas válidas de enlace y 20 que deben rechazarse (otros sitios, dominios parecidos, listas, texto con órdenes añadidas).
- **Descarga**: imagen H.264 y sonido AAC hasta 1080p, unidos con ffmpeg; si el video no lo ofrece así, lo mejor que haya, y entonces pasa por la conversión de la fase 6. Una a la vez, como tarea con avance y con el título del video en cuanto se conoce.
- **Subtítulos**: español e inglés, del autor o automáticos, en una segunda llamada que puede fallar sin estropear el video. Los automáticos se limpian (cada línea una sola vez). Mando en vivo para mostrarlos y elegir idioma; los subtítulos de un video pasan a ser una lista con su idioma.
- **Fallos dichos con claridad** (privado o retirado, sin internet, en directo, restricción de edad, YouTube pide iniciar sesión, y "actualiza yt-dlp" para lo demás), con «Reintentar».
- **«Actualizar» yt-dlp** en Ajustes.
- **De paso**: los avisos de que falta un programa salen solo en la pestaña a la que afectan (`parts` en `needs`, `ctx.setPart`); una tarea puede cambiar de título; y las pruebas ya no dejan abierto un Chrome sin ventana si se cortan a medias (se encontraron tres, y las pruebas siguientes se enganchaban al más viejo).
- **Pruebas automáticas**: de 122 a 129. **Chrome real**: de 175 a 196 comprobaciones. **Pantallas**: 9 tamaños, 23 pantallas en cada uno, con la pestaña YouTube y los mandos de un video con subtítulos en dos idiomas.
- **Sin probar**: **una descarga real de YouTube**. Todo lo anterior se probó con un yt-dlp de mentira, porque las pruebas no salen a internet; con el de verdad solo se comprobó, sin descargar, que YouTube acepta la orden y elige el formato esperado. Tampoco en Windows.

## 10. Cambios al plan

Cada modificación del plan aprobado, con su motivo. Es parte de la base de la auditoría.

| Fecha | Cambio | Motivo |
| --- | --- | --- |
| 2026-10-04 | Las versiones se renumeran: la fase 0 es la 1.1 y cada fase sube una (1.2 … 1.9, auditoría 2.0) | La fase 0 dejó cambios a la vista (revisión del equipo, nombre propio, imagen de prueba) y se publica, como todas |
| 2026-10-04 | La fase 0 gana tres piezas: revisión del equipo con "Instalar por mí", tareas con avance y tiempo restante, e imagen de prueba | Las dos primeras salen de las respuestas del dueño (decisión 2 y la conversión con avance a la vista); la tercera es el tipo con mandos que exigía el criterio de cierre, hecho útil en vez de desechable |
| 2026-10-04 | "Más" en las pestañas del celular pasa de la fase 0 a la 4 | Hasta que haya una quinta pestaña no hay con qué probarlo |
| 2026-10-04 | La búsqueda compartida pasa de la fase 0 a la 1 | Es justo lo que entrega la fase 1; se escribe en `server/core/` para que el himnario la reutilice |
| 2026-10-04 | El selector de pasajes reutilizable pasa de la fase 0 a la 2 | Separar una pantalla que funciona sin tener aún su segundo uso es riesgo sin beneficio; se separa junto al comparador |
| 2026-10-04 | Lo subido desde la app va a `data/media/` (no a una carpeta nueva `data/medios/`) | Ya existía y ya se servía por `/media/`; dos carpetas casi iguales confunden |
| 2026-10-04 | Los mandos en vivo van en un espacio de estado propio (`live`), no dentro de `projection` | Mover un mando muchas veces por segundo no debe reenviar el contenido proyectado ni redibujar el orden del culto |
| 2026-10-04 | Fase 3: la página especial `/tv` pasa a ser condicional | El televisor del dueño es de 2025 y su navegador es reciente; el fallo observado es de red. Primero se diagnostica |
| 2026-10-04 | Fase 5: "Cantado / Pista" se elige antes de proyectar o añadir al orden | Observación del dueño |
| 2026-10-04 | Fase 6: conversión en segundo plano con avance en el módulo y en "Al aire"; subtítulos de archivo `.srt`/`.vtt` | Observación del dueño; lo segundo aprovecha el mando de subtítulos de YouTube |
| 2026-10-04 | Fase 7: subtítulos de YouTube con mando para activarlos | Petición del dueño; analizado como viable |
| 2026-10-04 | Fase 8: PowerPoint por defecto, sin ventana, exportando imágenes directamente | Decisión 3. Exportar imágenes evita pasar por PDF |
| 2026-10-04 | Letras de los himnos: de carpeta local, no copiadas de un sitio web | Derechos de autor (decisión 5) |
| 2026-10-04 | **Ningún programa bloquea el arranque**, ni el navegador. La revisión avisa por módulo y cada módulo avisa al abrirlo | Decisión 10 del dueño. Sustituye a "sin el navegador no se entra" de la fase 0; se quitó el desvío de páginas del servidor |
| 2026-10-04 | Los módulos declaran lo que necesitan (`needs`) y la barra muestra "Medios" en vez de "Imágenes" y "Videos" | Lo primero, para el aviso por módulo; lo segundo, refleja la decisión 1 |
| 2026-10-04 | Fase 1: no se hizo la opción de limitar la búsqueda a unas versiones favoritas | Medido: con 14 versiones los índices ocupan 160 MB y la búsqueda tarda milisegundos. Queda como sugerencia si el equipo de la iglesia va justo (sección 11) |
| 2026-10-04 | Fase 1: Enter sobre un resultado va al versículo; hace falta un segundo Enter para proyectar | El plan decía "proyectar con Enter". Un solo Enter proyectaría a la vista de todos un resultado elegido por error |
| 2026-10-04 | Fase 1: elegir un resultado de otra versión cambia a esa versión | Lo que se proyecta debe ser el texto que se leyó en el resultado |
| 2026-10-04 | Fase 3: el diagnóstico del televisor ya no empieza por la red | Comprobado que televisor y Mac están en la misma red y se ven (sección 2) |
| 2026-10-04 | Fase 5: las letras se incluyen, importadas de archivos del dueño (texto u OpenLP), y viajan con la carpeta `Himnario/` | Decisión 5: las iglesias tienen la licencia. No van al repositorio público ni se copian de un sitio web |
| 2026-10-04 | El informe de cada fase muestra de nuevo el plan y un apartado de cambios sugeridos (sección 11) | Decisión 11 del dueño |

| 2026-10-04 | **La búsqueda se hace solo en la Reina-Valera 1960.** Se quitó buscar en todas las versiones, agrupar por versículo, decir de qué versión es cada texto y cambiar de versión al elegir un resultado | Decisión 12 del dueño. De paso, un solo índice en vez de catorce: unos 12 MB en vez de 160 |
| 2026-10-04 | Todo lo de la iglesia va en `Contenido/` (`Biblias/`, `Himnario/videos/`, `Himnario/letras/`). `Biblias/` y `Himnario/` dejan de estar en la raíz | Decisión 13 del dueño |
| 2026-10-04 | Letras: entregadas por el dueño en `.md`; ya no hace falta un importador de OpenLP | Decisión 5, resuelta |
| 2026-10-04 | Se adelantó de la fase 3: atender también en el puerto 8000, explicar en "Dispositivos" qué escribir en un televisor y no ofrecer direcciones `169.254…` (era la sugerencia S1) | La foto del dueño confirmó que el televisor exige `https`; esto es lo mínimo para hacer la prueba siguiente |
| 2026-10-04 | Fase 2: el comparador no es un módulo aparte en el código, sino una segunda pantalla y un segundo tipo del módulo Biblia | Comparte con Biblia casi todo (lectura, selector de pasajes). Así ningún módulo importa archivos de otro |
| 2026-10-04 | Fase 3: si el televisor también convierte la dirección con puerto, Manna tendrá que ofrecer `https` con certificado propio | Consecuencia de la foto. Sube el tamaño de la fase de M a L |

| 2026-10-04 | Comparador: el número de cada versículo va siempre delante del texto | Pedido del dueño al revisar la fase 2 |
| 2026-10-04 | Búsqueda con filtro por testamento (era la sugerencia S4) | Decisión 17 |
| 2026-10-04 | El himnario no se adelanta (se rechaza S6): sigue después de las fases 3 y 4 | Decisión 15: el dueño está revisando las letras |
| 2026-10-04 | Las fases 3 y 4 se trabajan a la vez | Decisión 18. La 3 depende de pruebas del dueño con el televisor; la 4 no |
| 2026-10-04 | Fase 3: el televisor debe abrir por su navegador; se descarta dar por buena la segunda pantalla. Se añade el control por IP del televisor (era la sugerencia S5) | Decisión 16. La dirección con puerto 8000 tampoco abrió |
| 2026-10-04 | Fase 3: `http` y `https` van por el mismo puerto, en vez de un servidor `https` aparte | No se sabe a qué puerto va el televisor cuando convierte la dirección; así acierta en cualquiera (80, 443, 8000) |
| 2026-10-04 | Fase 3: nace el módulo "Televisores" (buscar, vincular, abrir el navegador, control remoto, escribir la dirección) | El control por red del televisor abre el navegador pero no acepta una dirección: la primera vez hay que escribírsela, y Manna lo hace como un teclado |
| 2026-10-04 | Fase 3: Manna anota cómo llega cada equipo (`http`, `https` o saludo cortado) | Sin ver el televisor no hay otra forma de saber por qué no entra; ahora lo dice la tarjeta |
| 2026-10-04 | Fase 3: se quitan del plan las alternativas "como segunda pantalla" | Decisión 16 |
| 2026-10-04 | **La fase 6 (videos y audios) va antes que la 5 (himnario)**, y se lleva la parte de reproducción | Decisión 20 (era la sugerencia S13) |
| 2026-10-04 | Televisores sale de la barra de módulos; sigue existiendo y se abre por su dirección | Decisión 21 (era S12). Así sus pruebas siguen vivas para cuando se retome |
| 2026-10-04 | Fondos de la proyección: galería guardada en Ajustes, junto a los colores, con eliminar. No se elige el fondo desde Medios | Decisión 22 (en lugar de S14) |
| 2026-10-04 | Biblioteca de imágenes: sin álbumes; por fecha, con la hora en que se agregó | Decisión 23 (en lugar de S15) |
| 2026-10-04 | Nuevo, fuera de fase: revisión del código en `npm test`, vigilancia de toda la prueba en Chrome, y aviso y reinicio cuando Manna se actualiza estando abierto | Los dos fallos de la 1.5 (ver "Fase 4 · lo que encontró el dueño") |
| 2026-10-04 | Fase 6: la carpeta es `Contenido/Medios/`, no `Medios/` en la raíz | Decisión 13: todo lo de la iglesia va en `Contenido/` |
| 2026-10-04 | Fase 6: quién suena lo decide el servidor (antes: "la proyección abierta en el equipo principal", que podían ser dos) | Con dos ventanas de proyección en el equipo sonaban las dos |
| 2026-10-04 | Fase 6: la duración y la imagen de un video también las puede dar el navegador (quien lo sube o quien lo reproduce) | Para que Medios funcione en un equipo sin ffmpeg, como pide la regla de que nada bloquea |
| 2026-10-04 | Fase 6: "usar el chip de video si lo tiene" se resuelve probando: primero el chip, y si falla, libx264 | ffmpeg puede listar un codificador que ese equipo no tiene |
| 2026-10-04 | Las pruebas y la demostración nunca abren su proyección en el proyector (`MANNA_SIN_VENTANA`) | Una prueba se proyectó y sonó en la segunda pantalla del equipo de desarrollo |
| 2026-10-04 | «Negro» y «Solo fondo» pausan lo que suena; todo corte de sonido es un desvanecido; al terminar un video se pasa a «Solo fondo» | Decisiones 24 y 25 (eran S16 y S17) |
| 2026-10-04 | Sin avisos ni botones para hacer sonar: suena el equipo principal, por su proyección o por su control | Decisión 26 (en lugar de S18) |
| 2026-10-04 | Fase 6: un video que hay que convertir ya no espera a la conversión si el equipo principal reproduce el original; la copia ligera queda para las demás pantallas | Decisión 27 (eran S19 y S20). El plan decía que el elemento quedaba listo "al terminar" la conversión |
| 2026-10-04 | Fase 6: la conversión se detiene mientras algo se reproduce | Para que usar un video recién agregado no compita con su propia conversión en un equipo modesto |
| 2026-10-04 | No se añade la medición del equipo a la revisión (S21) | Decisión 27 |
| 2026-10-05 | **Fase 7: los videos de YouTube se conservan en la biblioteca**; no se borran al cerrar Manna ni se vuelven a descargar al necesitarlos | Un video preparado con tiempo debe poder proyectarse el día del culto aunque ese día no haya internet, YouTube pida iniciar sesión o yt-dlp haya dejado de funcionar. Es además lo que ya hacen los demás videos. A cambio ocupan disco hasta que se eliminan |
| 2026-10-05 | Fase 7: los subtítulos se piden solo en español e inglés | Pedir "todos" trae decenas de traducciones automáticas por video. Añadir un idioma es una línea (`SUBTITLE_LANGS`) |
| 2026-10-05 | Fase 7: los subtítulos se dibujan como los del navegador, no con el estilo de la proyección | Es lo que ya hacía la fase 6 con los `.srt`; se ven igual en todas las pantallas. Darles el estilo de la proyección queda como sugerencia (S23) |
| 2026-10-05 | Fase 7: no se estudió enviar el video a la aplicación de YouTube del televisor (S10) | Televisores está en pausa (decisión 19) |
| 2026-10-05 | Las versiones se renumeran: YouTube es la 1.7, diapositivas la 1.8 y el himnario la 1.9 | El orden real de las fases (decisiones 20 y 28) |
| 2026-10-05 | Un módulo con pestañas avisa de un programa que falta solo en la pestaña afectada | Con YouTube ya en uso, el aviso de yt-dlp salía también en Imágenes, donde no hace falta, y en un celular quitaba sitio |
| 2026-10-04 | **Fase 3 en pausa**; se retoma al terminar las demás fases | Decisión 19: el televisor no cargó la proyección ni con Manna ni a mano |
| 2026-10-04 | Fase 4: la miniatura la hace el dispositivo que sube, junto con la reducción | El servidor no tiene con qué encoger imágenes sin añadir dependencias |
| 2026-10-04 | Fase 4: el ajuste se recuerda por imagen (además de ir en el elemento del orden) | Quien proyecta el mismo cartel cada semana no debería elegirlo cada vez |
| 2026-10-04 | Fase 4: los mandos muestran la imagen entera con un marco, en vez de una copia de la pantalla | El panel ya tiene el monitor "Al aire"; lo que faltaba ver es qué parte de la imagen queda fuera |
| 2026-10-04 | Fase 4: «Más» aparece con más de cinco pestañas, no con más de cuatro | En un celular de 360 px caben cinco; con Televisores y Medios ya son seis |
| 2026-10-04 | Un módulo puede marcar como "próximamente" lo que pedirán sus partes futuras (`needs` con `soon`) | Medios existe ya, pero ffmpeg y yt-dlp son para pestañas que aún no están: la revisión del equipo lo cuenta y el módulo no molesta con ello |

## 11. Cambios sugeridos al plan

Propuestas del asistente que el dueño aún no ha decidido. Al decidirse, pasan a la sección 10 (si se aceptan) o se borran.

Las sugerencias S8 a S11 son del televisor: esperan a que se retome la fase 3 (decisión 19).

| # | Sugerencia | Por qué | Qué cambiaría |
| --- | --- | --- | --- |
| S8 | Fijar en el router la dirección del equipo principal y la del televisor | La página de inicio del televisor guarda la dirección numérica de Manna; si el router la cambia, hay que volver a escribirla | Nada en Manna: es un ajuste del router. Se documentaría con capturas |
| S9 | Encender y apagar el televisor desde Manna | Su control por red lo permite (encendido por red y tecla de apagado). No se incluyó para no apagar un televisor por error ni probarlo sin el dueño delante | Dos botones en la tarjeta del televisor. Pequeño; se haría tras la prueba del dueño |
| S10 | Fase 7: enviar un video de YouTube directamente al televisor | El televisor anuncia su aplicación de YouTube en la red (se vio al explorarlo). Serviría para que el video lo reproduzca el propio televisor, sin pasar por su navegador | Se estudiaría en la fase 7; no cambia el plan todavía |
| S11 | Otras marcas de televisor | El módulo está hecho para añadirlas. Los LG (webOS) sí aceptan que se les indique la dirección por la red | Solo si alguna iglesia lo necesita; hace falta un televisor de esa marca para probar |
| S22 | Que el dueño haga la **primera descarga real de YouTube** antes de usarlo en un culto | Es lo único de la fase 7 que no se pudo probar sin salir a internet. Si YouTube pide iniciar sesión desde la red de la iglesia, conviene saberlo con tiempo | Nada en el plan. Si falla, se vería qué dice yt-dlp y se ajustaría |
| S23 | Subtítulos con el estilo de la proyección (tipografía, tamaño y sombra de Ajustes) | Hoy los dibuja el navegador con su estilo: letra blanca sobre una caja oscura. Se leen bien, pero no se parecen al resto de la proyección ni se puede cambiar su tamaño | Dibujarlos Manna en vez del navegador. Mediano; vale para YouTube, videos e himnos |
| S24 | Aviso de espacio en disco en Ajustes | Los videos de YouTube y las copias convertidas se acumulan en `data/media/`. El plan ya lo preveía como riesgo ("tamaño visible en Ajustes") y aún no existe | Una línea en Ajustes con lo que ocupa cada biblioteca. Pequeño; encaja en la auditoría (fase 9) |
| S7 | Que el dueño revise los 15 himnos cuya letra parece incompleta (lista en `docs/ESTADO.md`) | Al copiar las letras se perdieron líneas en algunas partes. **En curso: el dueño las está revisando** | Nada en el plan; se corrigen los archivos `.md` y Manna los vuelve a leer solo |

