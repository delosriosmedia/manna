# Plan de trabajo: versión 2

Estado: **aprobado por el dueño el 2026-10-04. En curso: hechas las fases 0, 1, 2, 4 a 8 y 10 a 15 (1.17.0) y la parte de código de la 9 (auditoría, 1.18.0); falta la del equipo real, con las pruebas del dueño. La 3 (televisores) está en pausa.**
Parte de la versión 1.0.0 y termina en la 2.0.0.

Este documento es el plan y, al terminar, la base de la auditoría (sección 8). Se actualiza al cerrar cada fase: la sección 9 lleva el avance, la 10 cada cambio que se le hizo al plan y por qué, y la 11 los cambios que se le sugieren al dueño y aún no ha decidido.

## 1. Qué se pide

| # | Petición | Dónde queda |
| --- | --- | --- |
| A | Módulo comparador de versiones | Fase 2 (hecho) |
| B | Búsqueda mejor: exactas primero, parecidas después, resaltado; rápida. **Solo en la Reina-Valera 1960** (decisión 12) | Fase 1 (hecho), ajustada en la 2 |
| C | Pantalla de proyección en televisores (Samsung, LG, Android TV), a pantalla completa | Fase 3 |
| D | Imágenes: subir, nombrar, ajustar a pantalla, zoom y desplazamiento en vivo | Fase 4 |
| E | Himnario: 613 videos, dos vistas, buscador con letra, volumen, barra de avance, **cantado o pista** | Fases 5 y 15 (hecho, 1.17.0: el himnario corregido tiene las 613 letras sin avisos y «Letras sin música») |
| F | Videos y audios locales en cualquier formato, con **conversión en segundo plano y avance a la vista** | Fase 6 |
| G | YouTube: descargar al añadir el enlace, proyectar sin anuncios, **con subtítulos opcionales** | Fase 7 (hecho) |
| H | Diapositivas: PDF y PowerPoint, con vista de la siguiente, cuántas faltan y zoom | Fase 8 (hecho; PowerPoint real sin probar) |
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
- **Las categorías del himnario** en nuevohimnario.com se cargan con un programa de la página. No hizo falta revisarlas: en la fase 5 las categorías vinieron en el archivo de letras del dueño (decisión 29).
- **El archivo de letras del dueño** (2026-10-05, 408 KB): 614 himnos, 2165 partes y 24 categorías; se lee en 18 ms. De los 613 himnos con video, 540 coinciden en título con el archivo y 73 no (del 123 al 195). Catálogo e índice de búsqueda: 50 ms. Una búsqueda: de 0,2 a 5 ms.

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
| `song` | Himnario | Uno (el video) | Pausa, reinicio, saltos, barra de avance; cantado o pista; volumen general | Hecho (1.9) |
| `lyrics` | Himnario («Letras sin música») | Una diapositiva por paso (vuelve a la portada) | Zoom, desplazamiento, vista de la siguiente, cuántas quedan | Hecho (1.17) |
| `video`, `audio` | Medios | Uno | Pausa, reinicio, saltos, barra de avance; subtítulos; volumen general | Hecho (1.6) |
| `youtube` | Medios | Uno | Los mismos, con elección del idioma de los subtítulos | Hecho (1.7) |
| `slides` | Diapositivas | Una diapositiva por paso | Zoom, desplazamiento, vista de la siguiente, cuántas quedan | Hecho (1.8) |
| `web` | Páginas web | Uno | Anterior y siguiente (en archivos HTML y ventana aparte) | Hecho (1.11) |

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
| 8 | Dock de módulos en el celular | Hecho (fase 13; en la 4 era un botón «Más») | `web/core/shell.js`: el dock lleva todos los módulos con su nombre y se desliza si no caben (ya no existe «Más») |
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
| Node.js para YouTube | Que yt-dlp resuelva lo que pide YouTube, cuando el Node.js del equipo es anterior al 22 (aprobado el 2026-10-16, decisión 38) | Necesario solo para YouTube |
| cloudflared | Conexión por internet (túnel de Cloudflare, Ajustes; aprobado el 2026-10-14) | Opcional |
| PowerPoint | Convertir `.pptx` | Opcional: se usa por defecto si está; si no, se pide el PDF |
| pdf.js (Mozilla, Apache 2.0) | Leer PDF en el navegador | En `web/vendor/pdfjs/` desde la fase 8 (versión 6.4.299, variante para navegadores no tan nuevos); se renueva con `scripts/actualizar-pdfjs.mjs` |

**Revisión del equipo.** Cada vez que Manna se abre comprueba todo lo anterior. Si falta algo se abre en `/requisitos` en vez de en el control. La página dice **qué módulos funcionarán completos y cuáles no**, y para cada programa, para qué sirve; ofrece **Instalar por mí** (ffmpeg, yt-dlp y cloudflared, descargados de su sitio oficial a `data/herramientas/`, con comprobación de la huella, sin tocar el sistema) y los pasos para hacerlo a mano.

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
| 10 | Función «Presentador» | M | |
| 11 | Páginas web y presentaciones HTML | M | |
| 12 | PowerPoint en vivo (Windows) | L | 1.14 |
| 13 | Rediseño «Escenario» de toda la interfaz de control (decisión 32) | L+ | 1.11 a 1.13; va antes de la 12 |
| 14 | Ajustes tras la prueba del dueño con la 1.14 (decisión 36) | L | 1.16 |
| 15 | Himnario corregido y «Letras sin música» (decisión 37) | M | 1.17 |
| 16 | Videos, módulo aparte con categorías (decisión 40) | L | 1.19 |
| 17 | Diapositivas dentro de Medios (decisión 40) | M | 1.20 |
| 18 | Textos: mensajes y citas con autor (decisión 40) | M | 1.21 |
| 19 | Auditoría de la interfaz con las skills de diseño (decisión 40) | M | 1.22 |

**Orden cambiado el 2026-10-04 (decisión 20)**: la fase 6 va antes que la 5, mientras el dueño revisa las letras de los himnos. La reproducción (pausa, avance, volumen, una sola pantalla que suena), que iba a estrenarse con el himnario, se construye con los videos.

**Y el 2026-10-14 (decisión 30)**: se añaden las fases 10 a 12, en ese orden, a petición del dueño.

**Y el 2026-10-05 (decisión 28)**: tras la fase 7 se hace la 8 (diapositivas); ahí se detiene el trabajo para que el dueño pruebe, y después se revisa el himnario.

**Y el 2026-10-16 (decisión 40)**: se añaden las fases 16 a 19, en ese orden. La 2.0 sigue esperando la parte del equipo real de la fase 9 (las pruebas del dueño).

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

### Fase 5 · Himnario — hecha (1.9.0)

La reproducción, que se iba a estrenar aquí, se construyó en la fase 6. El himnario la recibió hecha. Lo que cambió respecto a lo escrito abajo está en la sección 10: las letras y las categorías salen de **un solo archivo** entregado por el dueño, la pista se sirve preparada al pedirla, y los mandos van donde los de cualquier video.

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

### Fase 8 · Diapositivas — hecha (1.8.0)

- **PDF**: el navegador del control lo convierte en imágenes, una por página. Sirven en cualquier pantalla y heredan el zoom de la fase 4.
- **PowerPoint, por defecto con PowerPoint** (decisión 3): en Windows se le pide, sin ventana, que exporte cada diapositiva como imagen (automatización de Office con `WithWindow` desactivado; si ya había un PowerPoint abierto, no se cierra). Sin PowerPoint, se pide el PDF. En Mac, PowerPoint se abre a la vista un momento.
- En el orden y en el panel: anterior y siguiente, miniatura de la que viene, "quedan N", zoom y desplazamiento.
- **Límite**: animaciones, transiciones y videos incrustados se pierden; cada diapositiva es una imagen fija.
- **Pendiente de la fase**: ejecutar los guiones de PowerPoint contra un PowerPoint de verdad (sección 9).

### Fase 9 · Auditoría

Sección 8.

### Fase 10 · Función «Presentador»

- Una función propia (`/presentador`, con PIN) para quien pasa diapositivas, sin panel «Al aire»: la presentación se elige del orden del culto o de la biblioteca de Diapositivas, o se sube ahí mismo.
- La diapositiva al aire en grande, la siguiente al lado (debajo en el celular) y la cuadrícula de todas: tocar una la proyecta. Al llegar a la última, «Siguiente» no salta al siguiente elemento del orden.
- **Señalar**: el dedo sobre la diapositiva marca un punto en la proyección. **Mover**: pellizcar acerca y arrastrar desplaza, además de los mandos de encuadre de siempre.
- Se prueba entera en el equipo de desarrollo.
- **Dónde está** (2026-10-14, publicado en la 1.10.0): `web/modules/slides/presenter.js` (la pantalla), `web/roles/presentador.js` y `web/presentador.html` (la función, con la clase `no-dock`), el rol en `server/roles.js`, la orden `projection.pointer` y el espacio `pointer` en `server/modules/projection/index.js`, el punto en `web/modules/projection/stage.js` (`setPointer`, `pointAt`) y `picture.js` (`locate`, `spot`). Pruebas: `test/servidor.test.js` (puntero), sección «Presentador» de `scripts/probar-chrome.mjs` y dos pantallas en `scripts/auditar-responsive.mjs`.

### Fase 11 · Páginas web y presentaciones HTML — hecha (1.11.0)

- Un archivo HTML o ZIP subido se proyecta sin internet, encerrado para que no pueda dar órdenes a Manna.
- Una dirección que se deja mostrar dentro de Manna (Canva con su enlace de insertar, Google Slides publicado, Genially) se ve en todas las pantallas y admite el puntero.
- Una que no se deja (Kahoot): su propia ventana a pantalla completa sobre la proyección, que se cierra al pasar a otra cosa y se maneja con el ratón del equipo principal; anterior y siguiente desde el celular, si se le pueden enviar las flechas.
- Manna dice al agregar una dirección en cuál de los dos casos cae. **Las direcciones necesitan internet durante el culto** (decisión 30).
- **Cómo quedó** (2026-10-14): un módulo propio, **Páginas web** (`server/modules/web/`, `web/modules/web/`), no una pestaña de Diapositivas. Solo `.html` sueltos, sin ZIP. Un archivo propio va encerrado (cabecera `sandbox` y marco con `sandbox`) y recibe «Anterior» / «Siguiente» por mensajes al marco, en todas las pantallas a la vez. Lo que no se deja mostrar lo abre el módulo de proyección en otra ventana (`item.window`, perfil `navegador-paginas`). El router rechaza toda orden con `Origin: null` o de otro sitio. Ampliación aprobada (S33, S34): esa ventana recibe «Anterior» y «Siguiente» desde cualquier dispositivo, por el protocolo de depuración de Chrome (solo en 127.0.0.1 y con su perfil propio), y el Presentador también presenta páginas web, con el puntero.

### Fase 12 · PowerPoint en vivo (Windows) — hecha (1.14.0)

- La presentación la pasa el propio PowerPoint del equipo principal, en una ventana sobre la segunda pantalla: videos, GIF, animaciones y transiciones tal cual. Anterior, siguiente e ir a una diapositiva desde cualquier celular; si alguien avanza en el equipo, los celulares lo ven.
- Los celulares siguen viendo una foto de cada diapositiva, que PowerPoint saca al agregarla (decisión 30).
- En este modo no hay zoom; el puntero, solo si se puede mover el láser de PowerPoint. Los televisores ven la foto. El sonido de PowerPoint no lo gobierna el volumen de Manna.
- **Solo Windows** (decisión 30): PowerPoint para Mac no deja elegir la pantalla. En Mac sigue la conversión en imágenes. Solo se puede probar de verdad en el equipo de la iglesia.
- **Cómo se hará** (notas del 2026-10-14 para retomarla; «sin comprobar» = de una consulta, no de una prueba):
  - Se conserva el `.pptx` original junto a sus imágenes (hoy se borra tras convertir: mirar `server/modules/slides/index.js` y `powerpoint.js`). Las imágenes y miniaturas se siguen sacando como ahora.
  - **Un PowerShell que queda abierto** mientras dura la presentación, con un guion fijo en `powerpoint.js` (`-EncodedCommand`, como el de convertir) que lee órdenes de una línea JSON por la entrada estándar (`abrir`, `ir a n`, `siguiente`, `anterior`, `salir`, `dónde`). Lanzar uno por orden tarda 1-2 s; abierto, decenas de milisegundos (sin comprobar).
  - Por COM (`PowerPoint.Application`): abrir sin ventana del editor, `SlideShowSettings.ShowType` en ventana y colocar `SlideShowWindow` (`Left`, `Top`, `Width`, `Height`, en puntos = píxeles × 72 / PPP de Windows) sobre la segunda pantalla que da `server/modules/projection/display.js`; ponerla delante de la ventana de proyección de Chrome (`Activate` o `SetForegroundWindow` sobre su `HWND`). Avanzar con `View.Next()`, `View.Previous()`, `View.GotoSlide(n)`; leer `View.Slide.SlideIndex` cada medio segundo para que los celulares sigan lo que se haga en el equipo; `View.Exit()` al proyectar otra cosa o al apagar Manna (`app.onClose`). Existe también la propiedad `DisplayMonitor` de `SlideShowSettings` (sin comprobar).
  - **Trampas**: una ventana de PowerPoint que pide algo (vista protegida, reparar el archivo, fuentes) deja el proceso esperando para siempre: hace falta tiempo límite y cerrar ese PowerShell. No cerrar un PowerPoint que ya estuviera abierto. Que no queden `POWERPNT.EXE` huérfanos.
  - **Puntero**: COM no deja colocar el láser de PowerPoint; la vía posible es mover el ratón de Windows sobre esa pantalla (`SetCursorPos`) con el puntero en modo láser. Sin comprobar; si no sale, en este modo no hay puntero.
  - En el estado, la diapositiva al aire sigue siendo del tipo `slides` (con su imagen, que es lo que ven celulares y televisores); un ajuste por presentación dice si se pasa en vivo. Para probarlo sin PowerPoint hay que ampliar `scripts/lib/powerpoint-falso.mjs` para que haga de sesión en vivo.
- **Cómo quedó** (2026-10-15):
  - `server/modules/slides/powerpoint.js`: `LIVE_SCRIPT` (el PowerShell que queda abierto; órdenes `ir n`, `siguiente`, `anterior`, `parar` por su entrada y respuestas `diapositiva n`, `fin`, `inicio`, `parado` por su salida, cada una con el n.º de su orden; sin órdenes mira cada medio segundo dónde va) y `openLive` (lo lanza, 90 s para abrir y 10 s por orden; si no contesta, lo corta).
  - `server/modules/slides/index.js`: el original se guarda en `data/presentaciones/`; la ficha lleva `live` (y la vista, `liveable`); la acción `slides.live`; la sesión se abre al poner al aire una presentación en vivo con la pantalla de proyección abierta, y termina el pase con «Negro», «Solo fondo» u otro contenido (la presentación sigue abierta para volver enseguida). Lo que dice PowerPoint por su cuenta pone al aire esa diapositiva. Si falla, la presentación va como imágenes hasta que se vuelva a pedir, con un aviso en la cola.
  - El tipo de contenido gana `step(item, delta)` (en `projection.step`): «Anterior» y «Siguiente» los da PowerPoint; con `fin` o `inicio`, Manna sigue con el orden del culto.
  - En la web: «Pasar como imágenes» / «Pasar con PowerPoint» en el menú de la presentación, «PowerPoint en vivo» en su ficha, y en los mandos y el Presentador sin encuadre, zoom ni puntero mientras la pasa PowerPoint.
  - Pruebas: una automática en `test/diapositivas.test.js` y siete comprobaciones en el grupo «biblioteca» de `scripts/probar-chrome.mjs`, con el PowerPoint de mentira en modo vivo. **El guion de verdad no se ha ejecutado**: no hay Windows en el equipo de desarrollo.

### Fase 14 · Ajustes tras la prueba del dueño con la 1.14 — hecha (1.16.0)

Decisión 36. Lo que el dueño encontró al probar la 1.14 en el Mac y en el equipo Windows (2026-10-16), en cinco partes, en este orden:

1. **Errores.**
   - YouTube en Windows: el motivo real de un fallo de yt-dlp va al registro (hoy no queda en ninguna parte); yt-dlp usa el Node de Manna como intérprete de JavaScript (YouTube lo pide cada vez más; en el Mac de desarrollo funcionaba porque tiene Deno); «Actualizar» prueba el nuevo yt-dlp, con más tiempo para su primera ejecución, antes de reemplazar al que funciona; el aviso dice cómo instalarlo a mano.
   - «Escuchar antes de añadir» del Himnario: siempre cantado, sin elegir.
   - «Escuchar aquí» sin cortes: un solo reproductor (el de la proyección de fondo de ese dispositivo) y una corrección que solo actúa si se aleja más de un segundo. Si sigue cortándose en la prueba del dueño, se quita.
   - Presentador con el ratón: arrastrar para señalar o mover no arrastra la diapositiva. En el celular, sin el zoom viejo bajo la anterior y la siguiente.
2. **Mandos siempre a la vista.** Sin la capa «Mandos»: la barra de abajo lleva los de lo que está al aire (himno: pausa, Cantado/Pista, Letra y volumen; video: pausa, saltos, subtítulos y volumen; diapositivas e imágenes: cuál sigue, Señalar, Mover y Restablecer, también en Control completo y Control del orden). «Solo fondo» y «Negro» suben junto a «AL AIRE». En el celular, la hoja de mandos con márgenes y adaptable. En el Presentador de escritorio, la anterior y la siguiente, pequeñas, debajo de la grande.
3. **Pulido visual.** Categorías del Himnario más limpias; «Buscar en todo» con más margen; el botón de la cola del culto se queda arriba a la derecha y cambia de icono al desplegarla; la proyección de fondo se desvanece en los bordes en vez de cortarse.
4. **Consumo de recursos.** Medir antes y después con un video al aire (procesador, memoria, gráficos) y bajar lo que más gaste (sospechas: el cristal desenfocado sobre un video, que se recalcula en cada fotograma, y el video de fondo del control).
5. **Lo ya aprobado.** S24 (espacio en disco en Ajustes) con «Limpiar multimedia temporales», que borra **todo** lo subido o descargado (YouTube, videos, imágenes, presentaciones y páginas; también lo que esté en el orden del culto) y nunca toca `Contenido/`; S23 (tamaño de los subtítulos en Ajustes); S39 (puntero en PowerPoint en vivo, con una capa transparente).

### Fase 15 · Himnario corregido y «Letras sin música» — hecha (1.17.0)

Decisión 37. El dueño reemplazó el himnario por uno revisado (613 himnos, letras y categorías del índice oficial, y las diapositivas de cada himno):

- **Categorías en dos niveles**: las del archivo vienen como «Sección: Categoría»; la sección encabeza sus categorías plegables.
- **Letras sin música**, una pestaña más junto a Categorías: los himnos con diapositivas en `Contenido/Himnario/diapositivas/` (una carpeta por himno con el nombre de su video; `01.jpg`, la portada). Se proyectan como una presentación (tipo `lyrics`) y se pasan a mano. Tras la última, «Siguiente» vuelve a la portada del mismo himno; en la portada, «Anterior» se queda. Nunca salen del himno ni avanzan en el orden del culto. Se añaden al orden como elemento propio.
- Con eso se cierran S7, S29, S30 y S31.

### Fase 16 · Videos, módulo aparte con categorías — hecha (1.19.0)

Decisión 40. «Videos» sale de Medios y es un botón propio del dock, con todos los videos juntos: los subidos, los de la carpeta de la iglesia (`Contenido/Medios`) y los descargados de YouTube.

- **Sin pestaña de YouTube**: la casilla para pegar el enlace va en la cabecera de Videos, junto a «Subir videos», y lo descargado entra en la misma lista, con su icono.
- **Categorías con nombre propio**: una fila con «Todos», las categorías y «+ Nueva categoría». Cada una se renombra o se borra (borrarla no borra sus videos). En el menú de cada video, «Agregar a una categoría» y «Quitar de esta categoría». Un video puede estar en **varias** categorías, también los de la carpeta de la iglesia. Se guardan en el equipo principal (`medios.json`, `categories: [{ id, name, videos }]`, publicadas en el espacio `media`) y se ven igual en todos los dispositivos. Órdenes `media.categoryAdd`, `media.categoryRename`, `media.categoryRemove` y `media.categoryToggle`, con el permiso `media.edit`; quitar un video lo quita de sus categorías.
- **Cómo se hace**: una segunda pantalla del módulo de medios (`web/modules/media/videos.js`, como el Presentador en Diapositivas), que reutiliza la lista, la subida y la reproducción de hoy; el servidor sigue en `server/modules/media/`. Medios se queda con Imágenes y Audios; los avisos de ffmpeg, yt-dlp y Node.js pasan a Videos.
- **Funciones**: Videos va detrás del Himnario en el dock. El Servicio de alabanza recibe **Videos en lugar de Medios**. «Buscar en todo» lleva los videos a Videos.
- **Con ella salen los arreglos de la tableta** que esperan publicarse (la Biblia en la tableta pequeña acostada, botones de 36 px en la tableta en horizontal).
- **Lecciones que aplicar** (de los arreglos de la tableta): toda pantalla nueva pasa la auditoría también en 960 × 540; cabeceras en una fila; las reglas de clases compartidas (`.abar`, `.chips`) se limitan con `.ws[data-module=…]`; una tira que se desliza va en `SIDEWAYS_OK`; los tamaños táctiles con `var(--control)` y `var(--tap)`. La casilla de YouTube con el aviso de yt-dlp en 960 × 540 es hoy el único caso que falla en la auditoría (deja 85 px): Videos tiene que resolverlo.

### Fase 17 · Diapositivas dentro de Medios

Decisión 40. Medios queda con **Imágenes, Audios y Diapositivas**, y Diapositivas sale del dock.

- La pestaña funciona como el módulo de hoy: subir un PDF o un PowerPoint, ver sus diapositivas, «Pasar con PowerPoint». Arrastrar un PDF o un PowerPoint a Medios lo lleva a esa pestaña.
- El Presentador y su función no cambian. «Buscar en todo» lleva a la pestaña (`medios.pestana`). El servidor no cambia (`slides.*`, permiso `slides.edit`).
- **Cómo se hace**: Diapositivas ofrece su pestaña con la forma de las de Medios (`web/modules/slides/panel.js`, sacado de su `workspace.js`) y Medios la importa: una excepción documentada a «un módulo no importa archivos de otro», que se anota en `web.md` y `arquitectura.md`.

### Fase 18 · Textos: mensajes y citas con autor

Decisión 40. Un módulo nuevo (`server/modules/texts/`, `web/modules/texts/`, tipo de contenido `text`) para proyectar mensajes.

- **Una lista de textos guardados**, para volver a usarlos y añadirlos al orden del culto.
- **Dos tipos**: *Texto*, un mensaje normal; y *Cita*, la cita en grande y debajo «— Autor».
- **Una línea en blanco parte un texto largo en pantallas**, que se pasan con «Siguiente», como los versículos.
- Se proyecta con el fondo y la letra de la proyección (los de la Biblia, `projection/text.js`), con el tamaño ajustado para que quepa. Se ve antes en «Preparado».
- Guardado con `app.storage('textos')` (`{ id, style: 'normal' | 'quote', text, author, added }`), órdenes `texts.save` y `texts.remove` con el permiso nuevo `texts.edit`, longitud validada en el servidor. En «Buscar en todo».
- **Al empezar la fase se confirma con el dueño** si el Servicio de alabanza también tiene Textos.

### Fase 19 · Auditoría de la interfaz con las skills de diseño

Decisión 40. Al terminar las fases 16 a 18, una revisión de toda la interfaz con las skills de diseño instaladas en el equipo del dueño, además de la auditoría de pantallas de siempre (`auditar-responsive`):

- **impeccable**: sus revisiones de auditoría, crítica, robustez y adaptación a cada pantalla (jerarquía, legibilidad, estados vacíos y de error, accesibilidad, celular y tableta).
- **break-ui**: los peores datos posibles en cada pantalla (nombres larguísimos, listas vacías o enormes, categorías y textos sin nombre, citas sin autor).
- **review-animations** y **emil-design-eng**: las transiciones y los detalles de acabado.

Reglas: lo que digan las skills se contrasta con `DESIGN.md`, que manda; los hallazgos se comprueban en la app antes de corregirlos y se le presentan al dueño, que decide los cambios grandes (primero el plan). Se cierra con las pruebas completas y la auditoría de pantallas.

### Fase 13 · Rediseño «Escenario» de la interfaz de control

Decisión 32. El diseño se aprobó sobre un lienzo de prototipos navegables (https://claude.ai/artifact/J1nL2fMbgmB3wiUgVZKJW4, privado del dueño). Lo que hace falta para construirlo está aquí; al empezar, `DESIGN.md` se reescribe con ello.

**Lo aprobado**
- Escritorio y tableta en horizontal: **«Escenario»**. Lo que está al aire ocupa toda la pantalla, con un borde rojo mientras se ve. Encima flotan, en cristal:
  - la barra superior: estado, «Buscar en todo» y la ficha de la función;
  - el dock de módulos a la izquierda, que abre cajones;
  - la cola del culto a la derecha;
  - la barra de transporte abajo.
- Celular y tableta en vertical: **«Historias»**.
  - La proyección en un recuadro 16:9 arriba, con su color tiñendo el fondo.
  - Se pasa tocando la imagen (a la derecha avanza, a la izquierda vuelve), con rayitas que marcan los pasos.
  - Debajo: Al aire / Solo fondo / Negro, el volumen y el carrusel «A continuación».
  - Abajo, el dock: cada módulo se abre en un cajón que sube y se amplía a pantalla completa.
- **Un toque prepara, doble toque o Intro proyecta.** Lo preparado se ve en la tarjeta «Preparado», con Proyectar y Añadir al orden. Sustituye a la vista previa del panel «Al aire», que desaparece.
- **Buscar en todo (Ctrl K)**: versículos (RV1960), himnos (número, título o letra), medios, presentaciones y páginas.
- Orden del culto en dos lugares: la **cola** para operar y el **cajón** para prepararlo, con una segunda vista, el **Mapa del culto**.
- El **Comparador pasa a ser un botón de la Biblia** y deja de ser un módulo propio. En la Biblia, «Varios» elige un tramo con dos toques.
- Sistema visual:
  - **cian #5CE8FF** como único acento: selección, acción principal y foco;
  - rojo #E0383E solo para «al aire»;
  - suelo #030406;
  - cristal en tres niveles: flotante, cajón y hoja;
  - **Sora** para la interfaz, en lugar de Geist. Se incluye en `web/vendor/`, con licencia libre;
  - la proyección conserva su propia letra.
- La cola, abierta por defecto en escritorio. En el celular, tocar la imagen pasa en todas las funciones. En el Presentador, «Señalar» cambia el toque a señalar.
- **Toda capa flotante se cierra al tocar fuera y con Esc** (pedido del dueño): la búsqueda, los menús, las hojas, los cajones del celular, el Mapa del culto, el PIN y las confirmaciones.
- **Lo local siempre funciona por defecto** (pedido del dueño):
  - las direcciones, el código QR y el icono usan la red de la iglesia;
  - la conexión por internet es un camino más, y su estado (apagada, conectando o caída) no bloquea ni cambia nada de lo local;
  - ya es así, y lo comprueba `test/internet.test.js`.

**Cómo se hará**: por partes. Cada una deja Manna funcionando, lleva sus pruebas y se publica al cerrarla.
1. **Sistema visual.**
   - Fichas nuevas en `web/core/app.css` y Sora en `web/vendor/`; sale Geist.
   - Cristal con alternativa sólida donde `backdrop-filter` no exista o vaya lento: televisores y celulares modestos.
   - Iconos que falten; `DESIGN.md` reescrito.
   - Aún no cambia la estructura: es un cambio de piel.
2. **Estructura de capas** (`web/core/shell.js`).
   - Proyección de fondo con `createStage` a pantalla completa, barra superior, dock, cajón compacto (440 px) o ampliado, cola plegable y barra de transporte.
   - Los mandos de cada tipo (`controls()` de los tipos) pasan a la barra de transporte.
   - Tarjeta «Preparado» y, en el celular, «Historias».
   - Fuera del equipo principal, la proyección de fondo de un video o un himno muestra su imagen, no el video, para no gastar batería ni red.
3. **Buscar en todo**, en el cliente, juntando lo que ya existe: la búsqueda de la RV1960 del servidor, el himnario (`GET /api/hymns`) y lo que hay en el estado (medios, diapositivas, páginas).
4. **Módulos en cajones**, uno a uno, fluidos (caben en 440 px, ampliados y en el celular):
   - Orden (lista y Mapa del culto) y Biblia (con Comparar y Varios);
   - Himnario (la ficha al lado), Medios, Diapositivas y Páginas web;
   - Ajustes, por secciones, con la revisión del equipo dentro.
5. **Funciones.**
   - Inicio y PIN con teclado.
   - Control, Alabanza (volumen grande) y Control del orden (solo la cola).
   - Presentador en escritorio y en celular, con «Señalar».
   - La revisión del equipo con la piel nueva.
   - La pantalla de proyección no cambia.
6. **Ajustes del dueño** (pedidos y aprobados el 2026-10-15, tras probar la 1.12 en su celular):
   - **PIN de 4 cifras, solo números, que entra solo al teclear la cuarta**, en celular, tableta y escritorio. El servidor no acepta otro largo; un PIN más largo de antes se cambia al arrancar por uno nuevo de 4 cifras (se ve en «Dispositivos»).
   - **El fondo muestra el punto rojo** del Presentador (y el zoom de lo que está al aire).
   - **Presentador**: la diapositiva **anterior**, del mismo tamaño, a la izquierda de la siguiente; y **«Restablecer»** el zoom al lado de «Mover».
   - **Conexión por internet** (Cloudflare): encender y apagar desde el menú de la función (Control completo), con su estado.
   - **Himnario por categorías**: todas plegadas; se abre la elegida y se pliega la anterior.
   - **Alabanza**: botón **«Letra»** con la letra completa del himno que suena.
   - **Cajones**: tocar el fondo (la proyección) los cierra también en el escritorio; la cola, «Preparado» y la barra de abajo siguen funcionando con el cajón abierto. El cajón reducido se **redimensiona desde su borde libre, sin moverse**: en el escritorio desde el derecho (de 360 px hasta la cola), en el celular desde el de arriba (de un tercio de la pantalla a casi toda), sin tapar el dock ni las barras; cada dispositivo recuerda su tamaño. En el celular se vuelve a abrir **reducido** (decisión del dueño), con lo esencial.
   - **Versión reducida con solo lo esencial** (lo demás, al ampliar): Biblia, una fila con la cita, la versión abreviada y una lupa, y los versículos (sin «Recientes», «Comparar», «Varios», ± ni la barra de acciones: se proyecta desde «Preparado»); Orden, solo la lista (sin la cita rápida, «Añadir», el Mapa ni el resumen); Himnario, el buscador y los himnos; Medios, Diapositivas y Páginas, la lista para elegir (sin subir ni agregar); Ajustes, siempre completo. La cabecera del cajón reducido no repite lo que está al aire (ya se ve encima). En la barra de arriba del celular no queda una píldora vacía: solo la M.
   - **Nada se desplaza de lado si no hay nada al lado** (visto en el Orden del celular): la auditoría lo comprueba en cada panel y se corrige donde falle.
   - **Audio en el celular**, con un reproductor local: «Escuchar aquí» lo que está al aire (apagado por defecto y cada vez que se abre la página; sigue el reloj compartido; no toca el volumen general ni lo que suena en la iglesia), y **escuchar antes de añadir** en el Himnario, Medios y la cola (Control completo, Alabanza y Control del orden), solo en ese dispositivo y una escucha a la vez. Nada de esto en el equipo que suena para la iglesia.
7. **Pruebas y documentos.**
   - `scripts/probar-chrome.mjs` y `scripts/auditar-responsive.mjs` se rehacen en buena parte, junto con cada parte y no al final: cambian casi todos los selectores, pero se conservan las comprobaciones de comportamiento, incluida la de pulsar todas las órdenes.
   - La auditoría mide además el contraste sobre fondos cambiantes, que las capas se cierren al tocar fuera, que ningún panel se desplace de lado sin nada al lado y los cajones a varios tamaños redimensionados (anchos y altos).
   - `scripts/probar-chrome.mjs` se divide en grupos independientes (Biblia y orden; Medios; Himnario y diapositivas; Páginas web, televisores y ajustes; red y reinicios), cada uno con su servidor y su Chrome: corren a la vez y se pueden pedir sueltos. La comprobación de pulsar todas las órdenes junta lo de todos los grupos.
   - `README.md`, `.claude/rules/web.md` y `DESIGN.md`.

**Riesgos**
- Es el cambio más grande hasta ahora. Por eso va por partes, y cada una se puede publicar sola.
- Las pruebas en Chrome dependen de la estructura: rehacerlas es parte de cada paso.
- El cristal desenfocado y la proyección de fondo cuestan en celulares y televisores: alternativa sólida y sin video de fondo fuera del equipo principal.
- Legibilidad sobre fondos que cambian, como una diapositiva blanca detrás: el cristal lleva opacidad suficiente y la auditoría mide el contraste.
- Los voluntarios tendrán que aprender dónde está cada cosa. Se conservan los atajos y lo de siempre: Anterior, Siguiente, Negro.
- Preparar añade un toque. El doble toque proyecta directo.

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
| 30 | Presentador, páginas web y PowerPoint en vivo (2026-10-14) | **Sí a todo, en el orden 10 → 11 → 12.** Acepta que en PowerPoint en vivo se saque igualmente una foto de cada diapositiva para los celulares, que ese modo sea solo para Windows al principio y que las páginas web por dirección necesiten internet durante el culto |
| 31 | Instalación y conexión por internet (2026-10-14) | **Se queda la conexión por internet (Cloudflare) y se abre con el mismo icono que Manna**, si está encendida en Ajustes. Desde internet **nada se ve sin PIN**, ni la pantalla de proyección; el PIN se queda como está (4 cifras, 5 intentos por minuto). **Se instala con un solo archivo** que baja Manna a una carpeta que el usuario no ve; volver a abrirlo lo actualiza. **La carpeta de contenido de la iglesia nunca se reemplaza ni se mueve.** Levanta los límites «solo red local» y «ningún programa nuevo» para cloudflared |
| 32 | Rediseño de la interfaz (2026-10-14) | **Aprobado el diseño «Escenario»** para escritorio y tableta horizontal y **«Historias»** para celular y tableta vertical, con lo que propusieron los prototipos: cian como acento, Sora, preparar antes de proyectar, buscar en todo, cola abierta, el Comparador dentro de la Biblia y tocar la imagen para pasar en el celular. Además: **toda capa flotante se cierra al tocar fuera** y **lo local siempre funciona por defecto**, esté o no la conexión por internet. Va antes de la fase 12 |
| 29 | Tras la fase 8 (2026-10-05) | **Empezar ya el himnario**, con un archivo `.md` que el dueño dejó en `Contenido/Himnario/letras/` con todas las letras **y las categorías**. Las sugerencias S23 a S28 y las pruebas, después |
| 28 | Orden tras la fase 7 (2026-10-05) | **Pasar de una vez a la fase 8 (diapositivas) y ahí detenerse** para hacer pruebas, antes de revisar la fase del himnario |
| 27 | La espera al convertir un video pesado (S19, S20, S21) | **Convertir más rápido y poder usar el video de inmediato**; la conversión para los dispositivos remotos, de fondo. **No** medir el equipo desde la revisión |
| 33 | Sugerencias tras la fase 13 (2026-10-15) | **S37 sí**: se hace al empezar la fase 12. **S38 no**: «Escuchar» lo usa normalmente un solo celular a la vez. **S36 queda cubierta** por la parte 6 de la fase 13. S35 y S23 a S28 siguen abiertas. Seguir con la fase 12 |
| 34 | Sugerencias pendientes (2026-10-15) | **S28 no**: nadie usa notas del orador. **S23 cambia**: no el estilo de la proyección; solo poder cambiar el tamaño de los subtítulos en Ajustes. **S22 hecha**: el dueño descargó de YouTube en el equipo Windows y funciona. **S7, S29, S30 y S31, aplazadas**: el dueño revisa el himnario por su cuenta y, al terminar, pondrá en `Contenido/` himnos, letras, músicas y videos (o mezclas de ellos); hasta entonces se sigue con el himnario actual |
| 35 | Más sugerencias (2026-10-15) | **S8 no** (no es indispensable fijar la dirección en el router). **S26 no**: es más cómodo subir las presentaciones desde la app o arrastrándolas. **S32 sí, ya**: favoritos del himnario, sin esperar a la revisión del himnario. **S9, S10 y S11, al final de todo**: el asistente se las recuerda al dueño cuando toque retomar los televisores. **S39 y S25, después**: primero el asistente estudia si PowerPoint puede pasar la presentación en segundo plano; luego la prueba del dueño en Windows, y con ella se decide el puntero |
| 36 | Prueba del dueño con la 1.14 (2026-10-16) | **Sí a la fase 14**, en el orden propuesto (errores, mandos siempre a la vista, pulido, consumo y lo ya aprobado). «Limpiar multimedia temporales» borra **todo lo temporal** (lo subido o descargado), también lo que esté en el orden del culto; nunca `Contenido/`. «Escuchar aquí» se intenta arreglar antes de quitarlo. **S27 no**. Manejar páginas web desde el celular se estudia **después** de la fase 14 (S40) |
| 37 | Himnario corregido (2026-10-16) | **Sí a la fase 15** (himnario corregido y «Letras sin música»), tal como se propuso. Con la portada al aire, «Anterior» se queda en ella. `HIMNARIO_NUEVO.md` y «Categorías del himnario.md» (de `Contenido/Himnario/`) no se publican: de `Contenido/` solo van los `LEEME.txt` |
| 38 | Tras probar la 1.17 (2026-10-16) | «Escuchar aquí» se quita si no hay una solución segura (no la hay sin un celular de verdad para probar). La barra de abajo del escritorio se aparta sola sin uso. yt-dlp se pone al día solo y YouTube reintenta. **Node.js propio para YouTube**: si el del equipo es anterior al 22, Manna instala el oficial (nodejs.org) solo para eso y lo pone al día solo. Publicar todo junto en la 1.18.0 |
| 39 | Manejar páginas web desde el celular (2026-10-16) | **S40 se descarta por ahora**, aunque la prueba de concepto funcionó. El estudio queda en la sección 11 por si se retoma |
| 40 | Videos, Medios con Diapositivas, Textos y auditoría de la interfaz (2026-10-16) | **Sí a las fases 16 a 19**, con las recomendaciones del asistente: un video puede estar en varias categorías, también los de la carpeta de la iglesia; el Servicio de alabanza recibe Videos en lugar de Medios; en Textos, una línea en blanco parte un texto largo en pantallas; orden 16, 17, 18 y 19. La fase 19 (auditoría de la interfaz con las skills de diseño del dueño) va al terminar las otras tres. Los arreglos de la tableta se publican con la fase 16 |
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
| El guion que gobierna PowerPoint no se ha ejecutado contra uno de verdad | El PDF funciona siempre y sin programas; si PowerPoint falla, la tarjeta lo dice y propone el PDF; primera prueba pendiente en el equipo Windows (S25) |
| Un PDF malicioso | Lo abre pdf.js en el navegador de quien lo sube, con la ejecución de código del PDF desactivada; al servidor solo llegan imágenes JPG, que comprueba por su contenido |
| yt-dlp deja de funcionar | Botón «Actualizar» en Ajustes (hecho); el fallo se dice con palabras de quien usa Manna y sugiere actualizar; lo ya descargado sigue en la biblioteca; el resto de Manna no depende de él |
| YouTube exige iniciar sesión o bloquea las descargas desde la red de la iglesia | No hay arreglo desde Manna: se dice que se intente más tarde. Alternativa de siempre: descargar el video por otro medio y subirlo a la pestaña Videos |
| Conversión lenta de videos largos | Se hace al añadir, no al proyectar; en segundo plano con avance; se guarda el resultado |
| Sonido con retraso o doble | Una sola salida de sonido; las demás pantallas en silencio |
| Memoria con 14 versiones cargadas | Índice en segundo plano y opción de limitar versiones |
| Contenido con derechos en el repositorio | `Himnario/`, `Medios/`, letras y biblias fuera de git; revisión en cada publicación |
| Disco lleno por medios | Tamaño visible en Ajustes; lo temporal se borra al abrir y al cerrar |
| La interfaz se recarga de módulos | Un módulo de medios; "Más" en celular; mandos solo cuando hacen falta |

## 8. Auditoría final (fase 9)

Al terminar, se revisa el proyecto entero contra esta lista y se entrega un informe con lo encontrado y lo corregido. **Hecha la parte de código el 2026-10-16 (1.18.0)**: Gemini leyó el código por temas (seguridad, arquitectura, interfaz, documentos); cada hallazgo se comprobó en el código antes de corregirlo, y los que no se sostenían se descartaron. Falta la del equipo real (pruebas del dueño).

**Contra este plan**
- [x] Cada petición de la sección 1 está cumplida, o consta por qué no (C, televisores, en pausa; H, PowerPoint de verdad, pendiente de la prueba en Windows).
- [x] Cada decisión de la sección 6 quedó anotada en `docs/ESTADO.md` (faltaban la 7, la 30, la 33, la 36 y la 37: añadidas).
- [x] Cada cambio de la sección 10 se cumplió en la fase a la que se movió (12 comprobados al azar contra el código).

**Arquitectura**
- [x] Ningún módulo del servidor importa archivos de otro (búsqueda en el código); en la web, solo de `projection` y `system`.
- [x] Todo lo proyectable es un tipo registrado, se puede añadir al orden y se recorre con "Siguiente". Dos excepciones a propósito: la imagen de prueba no entra al orden (es para encuadrar) y una letra sin música no sale de su himno (decisión 37).
- [x] Todo mando en vivo pasa por `projection.control` y lo valida su tipo.
- [x] Ningún dato compartido vive solo en un navegador (`localStorage`, solo preferencias del dispositivo, por `web/core/prefs.js`).
- [x] Código muerto: quitada la tabla de tipos previstos de `web/modules/kinds.js`. **Quedan duplicados menores**, anotados en `docs/ESTADO.md`.

**Seguridad**
- [x] Toda acción declara permiso y valida su entrada. Corregido: `projection.styles` aceptaba nombres heredados (`toString`).
- [x] Subidas: tamaño limitado, tipo comprobado, nombres saneados, nada fuera de sus carpetas. Sin ffmpeg, un video se acepta por su extensión (se sirve como video, no se ejecuta).
- [x] Programas externos: solo a través de `server/core/tools.js`, siempre con lista de argumentos.
- [x] Ningún programa que falte bloquea la app.
- [x] Descargas de programas: solo de las direcciones fijadas, con huella comprobada y desde el equipo principal. Corregido: un programa que no se puede instalar cerraba Manna.
- [x] Enlaces de YouTube validados (solo el identificador).
- [x] Un dispositivo remoto sin PIN no puede cambiar nada. Corregido: se rechazan también las órdenes de otro puerto o subdominio (`same-site`); por el túnel, el bloqueo del PIN es por persona; la pista instrumental se prepara de una en una (un dispositivo sin PIN podía lanzar cientos de ffmpeg).

**Calidad**
- [x] Pruebas automáticas para toda la lógica; recorrido completo en Chrome real; auditoría de pantallas limpia (cifras en la sección 9).
- [x] Mensajes de error en español y con qué hacer (mejorados: el fallo inesperado, YouTube con un Node viejo, la imagen de prueba).
- [x] Cada pantalla sigue `DESIGN.md`. Añadidos estados de carga (Himnario, espacio en disco) y de error (pasos del orden). **Quedan** colores y radios sueltos en algunas hojas de estilo, anotados en `docs/ESTADO.md`.

**Rendimiento**
- [x] Arranque, memoria y tiempo de búsqueda medidos y anotados (`docs/ESTADO.md`, con la Biblia y el himnario reales).
- [x] Un video de una hora se sirve por trozos (206, solo lo pedido), sin cargarlo entero.
- [x] Mover un mando en vivo no reenvía el contenido proyectado (solo llega el espacio `live`).

**Legal y contenido**
- [x] El repositorio no contiene biblias, himnos, letras ni medios con derechos (de `Contenido/`, solo los `LEEME.txt` y la Reina-Valera 1909).
- [x] Licencias de lo incluido (Sora, Geist, Phosphor, qrcode-generator, pdf.js) presentes, y créditos de lo que se instala aparte (ffmpeg, yt-dlp, cloudflared; añadido cloudflared y las licencias).

**Documentación**
- [x] `README`, `DESIGN.md`, reglas, skills, `ESTADO.md` y `CHANGELOG.md` describen lo que hay (corregidos unos veinte datos viejos: la interfaz anterior al «Escenario», Node 22 para YouTube, decisiones que faltaban, cifras, rutas).
- [x] Otra persona puede instalar y continuar el proyecto solo con el repositorio (la página de pruebas del dueño es solo una comodidad: el registro es `docs/ESTADO.md`).

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
| 8 Diapositivas | **Hecha** · 2026-10-05 | 1.8.0 | Ver abajo. El PDF, probado de verdad; **PowerPoint, solo con uno de mentira**: falta la prueba en Windows. Aquí se detiene el trabajo (decisión 28) |
| 5 Himnario | **Hecha** · 2026-10-05 | 1.9.0 | Ver abajo. Probado con el himnario real: 613 himnos, 540 con letra. **El archivo de letras tiene 73 himnos (123 a 195) que no corresponden a sus videos**: no se usan hasta que se corrijan (corregido por el dueño; fase 15) |
| 9 Auditoría | **Hecha la parte de código** · 2026-10-16 | 1.18.0 | Ver sección 8. Seguridad: 5 fallos corregidos (el más serio, una orden que cerraba Manna). Arquitectura e interfaz: 3 fallos y 6 estados o mensajes corregidos; descartados 4 hallazgos que no se sostenían en el código. Documentos: unos veinte datos al día. Rendimiento medido. Pruebas al cerrar: 161 automáticas, 445 en Chrome, auditoría de 9 tamaños sin problemas. **Falta la parte del equipo real** (pruebas del dueño); la 2.0 se publica cuando pase |
| 10 Presentador | **Hecha** · 2026-10-14, publicada en la 1.10.0 | | Probada en Chrome (con dedos simulados) y en la auditoría de pantallas. Falta la prueba del dueño con un celular real y el proyector |
| 11 Páginas web | **Hecha** · 2026-10-14 | 1.11.0 | Probada con pruebas automáticas y en Chrome real, con páginas de un servidor del propio equipo. **Falta la prueba del dueño**: la ventana aparte con el proyector, Canva y Kahoot de verdad, y en Windows |
| 16 Videos | **Hecha** · 2026-10-17 | 1.19.0 | Videos es una pantalla propia del módulo de medios (`media/videos.js`), detrás del Himnario: los videos subidos, los de la carpeta y los de YouTube juntos, con el enlace de YouTube en la cabecera. Categorías con el nombre que se quiera (`media.category*`), un video en varias, que se renombran y se eliminan sin borrar videos. Medios queda con Imágenes y Audios; Alabanza recibe Videos. Salen también los arreglos de la tableta pequeña acostada y «Mover» con PowerPoint en vivo. Pruebas al cerrar: 166 automáticas (una nueva de las categorías), 454 en Chrome (con las cuatro órdenes nuevas pulsadas), auditoría de 10 tamaños sin problemas (con Videos, una categoría y YouTube). **Sin probar**: en celulares y tabletas reales, y en Windows |
| 17 Diapositivas en Medios | **Pendiente** (decisión 40) | 1.20.0 | |
| 18 Textos | **Pendiente** (decisión 40) | 1.21.0 | |
| 19 Auditoría de la interfaz | **Pendiente** (decisión 40) | 1.22.0 | |
| 15 Himnario corregido y Letras sin música | **Hecha** · 2026-10-16 | 1.17.0 | Categorías en dos niveles (sección y categoría, como el índice del himnario) y la pestaña «Letras sin música»: las diapositivas de cada himno, tipo `lyrics`, que se pasan a mano y tras la última vuelven a la portada del mismo himno. Con el himnario real corregido, en un servidor de prueba: 613 himnos, todos con letra y diapositivas, 46 categorías en 7 secciones, sin avisos. Cierra S7, S29, S30 y S31. Pruebas al cerrar: 160 automáticas, 444 en Chrome (8 nuevas del himnario), auditoría de 9 tamaños sin problemas (con la pestaña nueva). **Sin probar**: el himnario real en Chrome y en Windows, y las letras sin música en el proyector |
| 14 Ajustes tras la prueba | **Hecha** · 2026-10-16 | 1.16.0 | Parte 1: YouTube con el Node de Manna como intérprete de JavaScript y el motivo de cada fallo en el registro; «Actualizar» ya no rompe el programa que funcionaba; «Escuchar aquí» con un solo reproductor y sincronización tolerante; «Escuchar» del Himnario siempre cantado; el Presentador ya no arrastra la diapositiva con el ratón y pierde el zoom viejo. Parte 2: mandos siempre a la vista en la barra de abajo, «Solo fondo» y «Negro» arriba, «Señalar» y «Mover» también en Control y Orden (`projection/gestures.js`), hoja de mandos del celular con márgenes, Presentador con la anterior y la siguiente debajo. Parte 3: categorías del Himnario más limpias, «Buscar en todo» con más aire, botón de la cola fijo y con forma según su estado, proyección de fondo que se desvanece en los bordes. Parte 4: sin desenfoque con un video al aire, y sin reproducir el video de fondo en los celulares salvo al escuchar. Parte 5: espacio en disco y «Limpiar multimedia temporales» (S24), tamaño de los subtítulos (S23), punto rojo encima del pase de PowerPoint (S39, revisado por Gemini). Pruebas al cerrar: 159 automáticas, 434 en Chrome, auditoría de 9 tamaños sin problemas. **Sin probar en Windows**: YouTube, el punto rojo en PowerPoint y el consumo en un equipo modesto; **ni en un celular real**: «Escuchar aquí» |
| 12 PowerPoint en vivo | **Hecha** · 2026-10-15 | 1.14.0 | Antes, S37: la prueba en Chrome baja a menos de 3 min (YouTube y el himnario al grupo «red»). PowerPoint en vivo con el original guardado, «Pasar con PowerPoint» / «Pasar como imágenes», «Siguiente» y «Anterior» dados por PowerPoint (con las animaciones), seguimiento de lo que se pase en el equipo y vuelta a las imágenes si falla. Gemini revisó el guion de PowerShell y se aplicaron sus avisos (sección 10). Pruebas al cerrar: 157 automáticas, 427 en Chrome, auditoría de 9 tamaños sin problemas, todo con un PowerPoint de mentira. **El guion de verdad no se ha ejecutado: falta la prueba del dueño en Windows con PowerPoint y el proyector (S25)**. Sigue la fase 9 (auditoría) |
| 13 Rediseño Escenario | **Hecha** · 2026-10-15 (plan aprobado el 2026-10-14; siete partes) | 1.11.0 a 1.13.1 | Parte 1: cian, Sora, píldoras y cristal en ventanas, menús y avisos (156 automáticas, 319 en Chrome, auditoría sin problemas). Parte 2: escenario con dock, cajón, cola del culto, «Preparado» y transporte; «Historias» en el celular; toda capa se cierra al tocar fuera y con Esc. Pruebas: 155 automáticas, 355 en Chrome (con las nuevas de la cola, «Preparado», el cajón, los mandos y «Historias»), auditoría de 9 tamaños sin problemas. Parte 3: «Buscar en todo» con Ctrl K, en el cliente, sobre la búsqueda de la Biblia y la del himnario y lo que hay en el estado. Pruebas: 365 en Chrome (diez nuevas de la búsqueda), auditoría de 9 tamaños sin problemas (con la búsqueda abierta y con algo preparado). Parte 4: todos los módulos se miden por su cajón (`@container cajon`); Orden con el Mapa del culto, Biblia con «Comparar» y «Varios» (el Comparador deja de ser módulo), Himnario con la ficha al lado, Ajustes por secciones e «Instalar» dentro. Pruebas: 155 automáticas, 380 en Chrome, auditoría de 9 tamaños (con el cajón estrecho, comparar y el Mapa del culto). La auditoría de las partes 2 a 4 no revisó el cajón del celular a media altura (lo heredaba completo del celular pequeño): al corregirla, el 2026-10-15, salieron 7 problemas en los celulares altos, resueltos abriendo el cajón completo (sección 10). Antes de la parte 5 se aceleraron las pruebas (sección 10). Parte 5: el Inicio con una tarjeta por función y el PIN en un teclado grande (con ✓, porque tiene de 4 a 8 cifras); el Presentador con la diapositiva sin nada encima (la siguiente y todas en una columna de cristal a la derecha) y, sin herramienta, tocar la grande pasa (así se empieza en el celular); la revisión del equipo con la piel nueva; Alabanza y Control del orden ya estaban. Pruebas: 155 automáticas, 388 en Chrome (con el PIN entrando por la dirección de la red), auditoría de 9 tamaños sin problemas. Parte 6, ajustes del dueño (aprobada el 2026-10-15): PIN de 4 números que entra solo; punto rojo y zoom en el fondo; Presentador con la anterior y «Restablecer»; internet en el menú de la función; categorías plegadas; «Letra» en los mandos de un himno; cajones que se cierran tocando el fondo y se redimensionan desde su borde libre; versión reducida con lo esencial en el celular; nada se desplaza de lado sin tener nada al lado (la auditoría lo mide); «Escuchar aquí» y «Escuchar antes de añadir» fuera del equipo principal. Pruebas: 156 automáticas, 417 en Chrome (con el arrastre del cajón con el ratón de verdad y la escucha desde la dirección de la red), auditoría de 9 tamaños sin problemas (ahora mide también el desplazamiento lateral y los cajones en su tamaño más pequeño). Parte 7, pruebas y documentos: la prueba en Chrome corre en tres grupos a la vez («control», «biblioteca» y «red», cada uno con su servidor, su nombre en la red y su Chrome; 3,5 min en vez de 6,5, y se puede pedir uno solo) y junta lo vigilado; la auditoría mide además el contraste sobre una proyección blanca y una negra y que las capas se cierren al tocar fuera. El contraste encontró texto secundario ilegible sobre una diapositiva blanca: se aclaró en lo que flota y la cola pasó al cristal de cajón. Pruebas al cerrar: 156 automáticas, 423 en Chrome, auditoría de 9 tamaños sin problemas. Sigue la fase 12 (PowerPoint en vivo) |

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

### Fase 8 · resultados

- **Módulo Diapositivas**, con su tipo de contenido `slides`: una presentación es una carpeta de imágenes (2560 px de lado mayor, con miniaturas) y cada diapositiva, un paso.
- **PDF con pdf.js**, incluido en el proyecto (4,7 MB en `web/vendor/pdfjs/`, descargado del registro oficial comprobando su huella). Lo convierte el navegador de quien sube, página a página, y envía las imágenes; el servidor las reconoce por su contenido y no publica la presentación hasta tenerlas todas. Se carga solo al elegir un PDF.
- **PowerPoint con PowerPoint**: guion de PowerShell para Windows (sin ventana, sin diapositivas ocultas, sin cerrar un PowerPoint en uso, rutas por variables de entorno, guion codificado) y AppleScript para Mac (dentro de la carpeta propia de PowerPoint, miniaturas con `sips`). Corre como tarea con avance. Sin PowerPoint, la interfaz explica cómo sacar el PDF.
- **Al aire**: por cuál va, cuántas quedan, miniatura de la que sigue, y el encuadre de una imagen. Para no escribir dos veces lo mismo, lo que se proyecta "como imagen" (dibujo, encuadre y su cuenta) pasó a piezas comunes que usan Medios y Diapositivas.
- **En el orden del culto**, miniaturas de cada diapositiva (con la versión pequeña de cada imagen).
- **De paso**: corregida una carrera al elegir lo recién subido (también en Medios); el aviso de un módulo no sale por un programa opcional; «Más» en el celular ya se usa (seis módulos).
- **Pruebas automáticas**: de 129 a 136. **Chrome real**: de 196 a 226 comprobaciones, con un PDF de verdad convertido por el propio Chrome. **Pantallas**: 9 tamaños, 27 pantallas en cada uno.
- **Sin probar**: **PowerPoint de verdad**, en Windows (no hay) y en Mac (se abrió, pero no respondió: macOS pide un permiso que solo acepta una persona). Presentaciones reales de la iglesia, PDF grandes y la subida desde un celular real.

### Fase 5 · resultados

- **Módulo Himnario** y tipo de contenido `song`: una ficha por video, dos vistas (todos y por categorías), buscador por número, título y letra, y **cantado o pista** antes de proyectar y al aire.
- **Análisis del archivo de letras entregado** (408 KB, un solo `.md`): viene en dos formas mezcladas (los himnos 1 a 21 a renglón seguido con barras; los demás con las marcas escapadas y un renglón por párrafo) y Manna las lee las dos. 614 himnos, 2165 partes, 24 categorías, ningún aviso de formato. Comparado con los videos:
  - **540 títulos coinciden** (sin contar tildes ni signos) y toman la letra y el título bien escrito.
  - **73 no coinciden: del 123 al 195, seguidos.** El archivo pone en esos números otros himnos; 57 de esos títulos no son de ningún video. Sus letras no se usan.
  - El archivo trae un 614 que no tiene video; 5 himnos tienen una parte de un solo renglón (antes eran 15).
  - **Las categorías son tramos de números seguidos** (1 a 45 y luego de 25 en 25), no el índice del himnario.
- **Regla nueva**: los videos mandan. La letra de un número solo se usa si su título es el del video. Lo que no cuadra se dice en «avisos», en frases.
- **La pista** se prepara al pedirla (una copia del video con su segunda pista de sonido, sin recodificar) y cada pantalla la reproduce como un video más; al cambiar de sonido al aire sigue en el mismo segundo.
- **Para compartir** lo que ya existía: el reproductor y los mandos de lo que suena pasaron a piezas comunes de la proyección (los usan Medios y el Himnario); el resaltado de lo encontrado, a una pieza común (la usan la Biblia y el Himnario).
- **Pruebas automáticas**: de 136 a 143. **Chrome real**: de 226 a 247 comprobaciones. **Pantallas**: 9 tamaños, 32 pantallas en cada uno. Todas con un himnario inventado; además, el recorrido se hizo a mano con el himnario real (sección "Probado y sin probar" de `docs/ESTADO.md`).
- **Sin probar**: oír las dos pistas, el equipo Windows y un celular real.

## 10. Cambios al plan

Cada modificación del plan aprobado, con su motivo. Es parte de la base de la auditoría.

| Fecha | Cambio | Motivo |
| --- | --- | --- |
| 2026-10-14 | Fase 11: Páginas web es un módulo propio, no una pestaña de Diapositivas | Su biblioteca y su forma de agregar no se parecen a las de una presentación; así no se acopla a Diapositivas |
| 2026-10-14 | Fase 11: solo archivos `.html` sueltos, sin ZIP | Abrir un ZIP sin dependencias obliga a escribir un lector a mano; el dueño aceptó empezar así |
| 2026-10-14 | Fase 11: «Anterior» y «Siguiente» llegan a un archivo HTML propio por mensajes al marco, no por el protocolo de depuración de Chrome | Llegan a todas las pantallas a la vez (también a la que se abre tarde) y se pueden probar en Chrome sin proyector |
| 2026-10-14 | Se añade la fase 13 (rediseño «Escenario») y va antes de la 12 | Decisión 32 |
| 2026-10-14 | Fase 13, parte 2: en el escritorio el cajón se abre ancho (hasta la cola) y en el celular a media altura, o completo en celulares de menos de 700 px de alto | Hasta la parte 4 los módulos conservan su disposición; en el cajón estrecho o en un celular bajo no caben |
| 2026-10-14 | Fase 13, parte 2: en el celular, la cabecera del cajón dice lo que está al aire (en vez del nombre del módulo, que ya está en el módulo) | Con el cajón completo, el prototipo lo tapaba todo, y la garantía de `DESIGN.md` pide ver siempre qué está al aire |
| 2026-10-14 | Fase 13, parte 2: «Dispositivos» pasa al menú de la función, y en el celular el dock lleva todos los módulos y se desliza (sin «Más») | El dock del escenario es solo de módulos; con nombre bajo cada icono, deslizar se entiende mejor que un menú aparte |
| 2026-10-14 | Fase 13, parte 2: el volumen va en la barra de transporte en todas las funciones, no solo en el Servicio de alabanza | En el escenario hay sitio, y así los mandos de lo que suena no lo repiten |
| 2026-10-14 | Fase 13, parte 3: «Buscar en todo» solo está en Control completo y Servicio de alabanza, no en «Control del orden» | Esa función solo proyecta lo que ya está en el orden del culto |
| 2026-10-14 | Fase 13, parte 3: un himno encontrado se proyecta cantado (la pista se elige en sus mandos, al aire), y una cita de capítulo entero («sal 23») empieza en su primer versículo | Es lo que ya hacen el himnario y la Biblia sin elegir nada; evita otra pregunta en la búsqueda |
| 2026-10-14 | Fase 13, parte 4: cada módulo se mide por el ancho de su cajón con consultas de contenedor (`@container cajon`), no por el de la pantalla | El mismo módulo va en el cajón ancho, en el estrecho y en el celular; la proyección ya usaba consultas de contenedor, así que no pide navegadores más nuevos |
| 2026-10-14 | Fase 13, parte 4: la Biblia conserva su buscador (con Antiguo y Nuevo Testamento y «ver más») y su barra con «Proyectar», aunque los prototipos lo dejaban todo en Ctrl K y en la tarjeta «Preparado» | «Buscar en todo» no tiene esas opciones, y la barra es la acción principal en el celular, donde la tarjeta se oculta con el cajón abierto |
| 2026-10-15 | Fase 13, parte 4: la ficha del Himnario (número, título, categoría, duración y letra) va al lado de la rejilla cuando el cajón mide 900 px o más; la barra de abajo se queda con el sonido y las acciones | Con la ficha a la vista, el botón «Letra» sobra; en cajones estrechos no cabe y vuelve el botón |
| 2026-10-15 | Fase 13, parte 4: Ajustes «por secciones» es una fila de botones que lleva a cada sección, no una sección cada vez como en el prototipo; los programas que faltan se instalan desde su sección | Todo sigue a la vista de un vistazo, y lo que ya se probaba de Ajustes no cambia de sitio |
| 2026-10-15 | Fase 13, parte 4: el Presentador sigue midiéndose por la pantalla | No va en un cajón: ocupa la pantalla entera |
| 2026-10-15 | Fase 13: antes de la parte 5 se aceleran las pruebas. Tras cada edición solo corre la revisión del código; la auditoría deja elegir pantallas y tamaños y reparte los tamaños entre tres Chrome a la vez; la prueba de convertir usa un video más corto. La parte 6 divide además la prueba en Chrome en grupos que corren a la vez | Una ronda completa de pruebas tardaba unos 17 minutos (y las esperas mal hechas, horas): el dueño tuvo que pararlas. Aprobado por el dueño |
| 2026-10-15 | Fase 13, parte 4: en el celular el cajón se abre a pantalla completa, no a media altura (cambia lo de la parte 2) | La auditoría heredaba entre tamaños el «cajón completo» del celular pequeño; al empezar cada tamaño sin preferencias salió que, a media altura, en un celular de 390 × 844 a la Biblia le quedaban 144 px (versículo y medio), y lo mismo a Comparar, Alabanza, YouTube y el Himnario. Decisión del dueño |
| 2026-10-15 | Fase 13, parte 5: el PIN se entra con ✓ o Intro, no solo al escribir la cuarta cifra | El PIN puede tener de 4 a 8 cifras; decir su largo al que lo escribe daría una pista a quien prueba PIN desde fuera |
| 2026-10-15 | Fase 13, parte 5: en el Presentador, la diapositiva ocupa lo que deja la columna de la derecha (la siguiente y todas), en vez de quedar debajo de ella; «Señalar» y «Mover» van arriba y los botones abajo, en píldoras de cristal | Sobre una diapositiva tapada en parte no se puede señalar en todos sus puntos |
| 2026-10-15 | Fase 13, parte 5: en el Presentador, «Señalar» y «Mover» se apagan con otro toque y, sin ninguno, tocar la grande pasa (también en el escritorio); en el celular se empieza así y se conserva «Mover» | Es lo de «Historias»; «Mover» acerca con dos dedos, algo que el celular ya hacía y que la función promete |
| 2026-10-15 | Fase 13, parte 5: Servicio de alabanza y Control del orden no cambian | Ya eran el mismo escenario con menos módulos desde la parte 2, como pide el diseño |
| 2026-10-15 | Fase 13: se añade la parte 6, «Ajustes del dueño», y pruebas y documentos pasa a ser la 7. En el celular el cajón vuelve a abrirse reducido, ahora con solo lo esencial y redimensionable | Pedidos del dueño tras probar la 1.12 en su celular (capturas del 2026-10-15: en la Biblia a media altura quedaba un versículo, tapado por la barra de acciones). Plan y decisiones aprobados por el dueño |
| 2026-10-15 | Fase 13, parte 6: el PIN es de 4 números y entra solo al teclear el cuarto (deja sin efecto lo de la parte 5, entrar con ✓); uno más largo de antes se cambia al arrancar | Decisión del dueño |
| 2026-10-15 | Fase 13, parte 6: en un celular de menos de 700 px de alto el cajón se abre completo, y reducido no baja de un tercio de la pantalla o 400 px | Reducido, en un celular bajo, al módulo no le quedaba sitio (la auditoría lo midió) |
| 2026-10-15 | Fase 13, parte 6: Ajustes se abre siempre completo en el celular (`full` en su módulo) | No tiene una versión reducida que sirva |
| 2026-10-15 | Fase 13, parte 6: la cabecera del cajón reducido lleva el nombre del módulo y el estado de lo al aire («SOLO FONDO»), sin repetir qué es | Si el cajón agrandado tapa el recuadro, el estado tiene que seguir a la vista |
| 2026-10-15 | Fase 13, parte 6: «Letra» va en los mandos de un himno al aire en todas las funciones (no solo en Alabanza); en el celular, dentro de «Mandos» | Una sola pieza para todas; en Alabanza del escritorio está en la barra de abajo |
| 2026-10-15 | Fase 13, parte 6: la conexión por internet, en el menú de la función, no se ofrece a quien entra por internet | Apagarla le cortaría a él mismo |
| 2026-10-15 | Fase 13, parte 6: «Escuchar aquí» y «Escuchar antes de añadir» salen en cualquier dispositivo que no sea el equipo principal (también un PC de la red), no solo en celulares | Lo que importa es que no suene por los parlantes de la iglesia |
| 2026-10-15 | Fase 13, parte 7: la prueba en Chrome va en tres grupos, no en los cinco del primer planteamiento | Con tres basta para bajarla a la mitad, y cada grupo apenas necesita datos de otro (un versículo en el orden, un video subido): menos cosas que preparar por la API y que se puedan desincronizar |
| 2026-10-15 | Fase 13, parte 7: el texto secundario de lo que flota sobre la proyección es más claro (`#cdd3dd`; en el cajón, `#b9c1cd`), la cola usa el cristal de cajón (74 %) y el rojo claro de los avisos es `#ffaaad` | La auditoría de contraste lo encontró en 3:1 sobre una diapositiva blanca; la cola ya era un «cajón» en el diseño aprobado |
| 2026-10-15 | La prueba en Chrome reparte mejor sus grupos (S37, aceptada; decisión 33): YouTube y el himnario pasan al grupo «red» | Bajó de 3,5 a 2,8 minutos (168, 150 y 128 s); seguir repartiendo pedía preparar por la API lo que dejan las imágenes y los videos, para ganar unos 20 s |
| 2026-10-15 | Fase 12: un PowerPoint subido en Windows con PowerPoint viene ya «en vivo»; se pasa a imágenes en su menú | Es para lo que se sube un PowerPoint en vez de un PDF (videos y animaciones), y si PowerPoint falla queda la imagen debajo |
| 2026-10-15 | Fase 12: «Negro» y «Solo fondo» terminan el pase de PowerPoint en vez de oscurecerlo | Una sola forma de quitarlo (la misma que al cambiar de contenido); al volver, PowerPoint tarda un momento en empezar |
| 2026-10-15 | Fase 12: la presentación se abre con su ventana del editor minimizada, no sin ventana como al convertir | Revisión de Gemini: PowerPoint puede negarse a empezar el pase de una presentación sin ventana. Sin comprobar en Windows |
| 2026-10-15 | Fase 12: sin puntero en vivo (pasa a la sección 11, S39) | El láser de PowerPoint no se coloca por COM, y mover el ratón del equipo sin probarlo antes podía estorbar a quien lo usa |
| 2026-10-15 | Fase 12: el tipo de contenido gana `step` (dar él mismo «Anterior» y «Siguiente») | Para que pasen las animaciones sin que la proyección sepa de PowerPoint |
| 2026-10-15 | Fase 12: el original se guarda en `data/presentaciones/` (cubre en parte S27: aún no se puede reemplazar una presentación) | Hace falta para pasarla en vivo; fuera de `data/media`, que se sirve a toda la red |
| 2026-10-16 | Fase 14, parte 2: en la barra de abajo va «Vista completa» (de los mandos) y no «Restablecer», que hace lo mismo; «Restablecer» queda bajo el recuadro de «Historias» y en el Presentador | Dos botones iguales en la misma fila confunden |
| 2026-10-16 | Fase 14, parte 2: «Señalar» y «Mover» se recogen en todo el fondo del escenario, no solo en la proyección | La proyección de fondo no recibe el ratón (lo recibe la capa de color de detrás); con una herramienta encendida, tocar el fondo ya no cierra el cajón |
| 2026-10-16 | Fase 14, partes 2 y 3: la barra de abajo y el estado de arriba usan el cristal de la cola (74 %), y en la tableta la barra empieza a la derecha del dock | Con los mandos dentro, la auditoría de contraste lo pidió sobre una diapositiva blanca; y, más alta, pisaba el dock |
| 2026-10-16 | Fase 14, parte 4: en un dispositivo remoto, la proyección de fondo no reproduce un video salvo con «Escuchar aquí» | Ya lo decía el diseño («un video muestra su imagen»), pero se reproducía: gastaba batería, red y procesador en cada celular |
| 2026-10-16 | Fase 14, parte 4: la medición (procesador de Chrome con un video al aire) se hizo en el Mac de desarrollo con el video pequeño de la demostración: ahí el gasto es bajo (unos 6 % de un núcleo) y casi todo es el desenfoque del cristal | No hay en el equipo de desarrollo un equipo modesto ni un video pesado; las medidas se eligieron por lo que se midió, y su efecto real lo dirá la prueba del dueño |
| 2026-10-16 | S40 (manejar una página web desde el celular) se descarta por ahora | Decisión 39 del dueño; el estudio y la prueba de concepto quedan anotados por si se retoma |
| 2026-10-16 | Fuera de las fases (decisión 38), dentro de la 1.18.0: se quita «Escuchar aquí»; la barra de abajo del escritorio se aparta sola; yt-dlp se pone al día solo (`freshen`) y YouTube reintenta lo que no es del video | Lo pidió el dueño al probar la 1.17; la 1.18.0 aún no se había publicado |
| 2026-10-16 | Fase 9 en dos partes: la de código se cierra ya (1.18.0); la del equipo real, con las pruebas del dueño, y entonces la 2.0 | Las pruebas del dueño no dependen del asistente, y los arreglos de seguridad no deben esperar |
| 2026-10-16 | Fase 9: la lectura del código la hizo Gemini por temas; cada hallazgo se comprobó en el código antes de corregirlo | No gasta tokens de Claude; de 40 hallazgos, 4 no se sostenían y otros señalaban decisiones del dueño |
| 2026-10-16 | Fase 15: las letras sin música son un tipo propio (`lyrics`) y no una presentación de Diapositivas | Vienen de `Contenido/` (no se suben ni se borran desde la app) y su «Siguiente» no sale del himno: tras la última vuelve a la portada |
| 2026-10-16 | Fase 15: las categorías «Sección: Categoría» se agrupan bajo su sección, sin cambiar el formato del archivo de letras | El índice del himnario tiene dos niveles; el archivo ya los escribe así |
| 2026-10-16 | S7, S29, S30 y S31 se cierran con la fase 15 | El dueño corrigió el archivo de letras (S7, S29) y sus categorías siguen el índice oficial (S30); «Letras sin música» proyecta las letras (S31) |
| 2026-10-16 | S24 y S39 se hicieron en la fase 14; S27 se descarta | Decisión 36 |
| 2026-10-17 | Fase 16: las categorías van dentro de la cabecera de Videos, no en una fila aparte; en el cajón estrecho y en las pantallas bajas, sin el título «Videos» (lo dice el cajón) y con «Subir» y «Añadir» solo con su icono | Con una fila aparte, la auditoría daba 80 a 144 px para la lista en el celular pequeño, el celular acostado y la tableta pequeña acostada (pide 150). Así quedan 172 a 212 |
| 2026-10-17 | Fase 16: en la tableta baja, el aviso de un programa que falta va en una sola fila (el texto se parte, los botones no) | Era lo que dejaba sin sitio a Medios › YouTube en 960 × 540 (problema conocido anotado el 2026-10-16); ahora sirve a Videos y a cualquier módulo |
| 2026-10-17 | Fase 16: `media.categoryToggle` acepta `on` (poner o quitar) además de cambiarlo; los nombres de categoría tienen hasta 40 letras y no se repiten (sin contar mayúsculas) | Poner y quitar desde el menú del video no depende de lo que haya hecho otro dispositivo mientras tanto |
| 2026-10-17 | Fase 16: «Añadir» del orden del culto separa «Video» de «Imagen o audio», y «Buscar en todo» agrupa los videos aparte; en Medios, el aviso de ffmpeg sale solo en Audios | Siguen a Videos como pantalla propia |
| 2026-10-16 | Se añaden las fases 16 (Videos), 17 (Diapositivas en Medios), 18 (Textos) y 19 (auditoría de la interfaz con las skills de diseño) | Decisión 40 |
| 2026-10-16 | Fuera de las fases: con PowerPoint en vivo también se puede «Mover» y pellizcar; mientras está acercada, PowerPoint se aparta y se ve la imagen de Manna, y vuelve con la vista completa o al pasar de diapositiva | El dueño lo echó en falta al probar en Windows. Cambia lo decidido en la fase 12 («lo que pasa PowerPoint no se acerca desde Manna») |
| 2026-10-16 | Fuera de las fases: la tableta pequeña en horizontal (960 × 540) entra en la auditoría de pantallas, y en la tableta en horizontal los botones son de 36 px | Lo encontró el dueño: la Biblia no se veía y los botones no dejaban sitio. Sale con la fase 16 (decisión 40) |
| 2026-10-16 | Se añade la fase 14 (ajustes tras la prueba del dueño con la 1.14) y va antes de la 9 | Decisión 36: lo encontrado al probar en el Mac y en el equipo Windows |
| 2026-10-15 | S32 se acepta: favoritos en el Himnario, ya (decisión 35) | Con 613 himnos, los que más se cantan a un toque; no depende de la revisión del himnario que hace el dueño |
| 2026-10-15 | S23 se acepta cambiada: el tamaño de los subtítulos se elige en Ajustes, sin darles el estilo de la proyección (decisión 34). Hecho en la fase 14 (1.16.0) | Los actuales se leen bien; lo que falta es poder agrandarlos o achicarlos |
| 2026-10-15 | S36 (cajón estrecho por defecto en el escritorio) se da por cubierta | La parte 6 de la fase 13 hizo el cajón redimensionable y lo recuerda (decisión 33) |
| 2026-10-14 | Fuera de las fases (decisión 31): la conexión por internet entra en Manna (módulo `internet`), desde internet todo pide PIN, y se instala con un solo archivo que no toca nunca el contenido | A petición del dueño |
| 2026-10-14 | Fase 11, ampliación: la ventana aparte recibe «Anterior» y «Siguiente» desde el celular (S33) y el Presentador muestra páginas web, con el puntero (S34) | El dueño aceptó las dos sugerencias |
| 2026-10-14 | S35 deja de ser «subir un ZIP» y pasa a estudiar **compartir una pestaña de Chrome**, como Google Meet | A petición del dueño: resolvería a la vez internet, los ZIP y las páginas que no se dejan mostrar |
| 2026-10-14 | Se añaden las fases 10 (Presentador), 11 (páginas web) y 12 (PowerPoint en vivo) | Decisión 30, a petición del dueño |
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
| 2026-10-05 | **Fase 5: las categorías salen del archivo de letras del dueño**, no de nuevohimnario.com | Decisión 29: el dueño entregó el archivo "con las categorías". Son líneas `##` que él puede cambiar; sustituye a la decisión 14 |
| 2026-10-05 | Fase 5: las letras van en un solo archivo, que puede venir escrito de varias formas (también como lo exporta Word) | Es como lo entregó el dueño. El formato de los trece archivos anteriores sigue valiendo |
| 2026-10-05 | Fase 5: **la letra de un número solo se usa si su título es el del video** | El archivo trae 73 himnos seguidos (123 a 195) que no son los de esos números. Mejor un himno sin letra que con la letra de otro |
| 2026-10-05 | Fase 5: la pista no se deja en `data/tmp/` al elegirla, sino que se prepara cuando una pantalla la pide | Así sirve igual desde el orden del culto y tras un reinicio, sin pasos previos; tarda décimas de segundo |
| 2026-10-05 | Fase 5: los mandos del himno van en el panel "Al aire" y en el detalle del elemento del orden, no en la propia fila | Es donde están los de cualquier video desde la fase 6 |
| 2026-10-05 | Fase 5: se añade ver la letra del himno elegido («Letra») | Ya estaba leída para buscar; sirve para confirmar que es el himno que se quiere |
| 2026-10-05 | El Himnario va tercero en la barra, después de Biblia; el Comparador pasa a «Más» en el celular | Se usa en todos los cultos; en el celular solo caben cuatro módulos a la vista |
| 2026-10-05 | Las pruebas, la auditoría y la demostración usan un himnario inventado (`MANNA_HIMNARIO`) y el Chrome de las pruebas va sin sonido | No dependen de `Contenido/` ni suenan en el equipo donde se ejecutan |
| 2026-10-05 | Fase 8: el módulo no avisa en cada visita de que falta PowerPoint; lo explica al elegir un PowerPoint | Es un programa opcional. El plan decía que cada módulo avisa al abrirlo de lo que le falta, pero una franja permanente por algo opcional solo estorba |
| 2026-10-05 | Fase 8: no se guarda el archivo original, solo las imágenes | No hace falta para proyectar y duplica lo que ocupa. Para cambiar una diapositiva se sube la presentación de nuevo |
| 2026-10-05 | Fase 8: la miniatura de "la que viene" y "quedan N" van en los mandos en vivo (panel "Al aire" y orden), no solo en el orden | Así también sirven al proyectar una presentación directamente desde su módulo |
| 2026-10-05 | Fase 8: en Windows no se exportan las diapositivas ocultas | Tampoco saldrían al presentar con PowerPoint |
| 2026-10-05 | Lo que se proyecta como imagen (dibujo, encuadre y su cuenta) pasa a piezas comunes: `server/core/view.js`, `web/modules/projection/picture.js` y `view.js` | Lo usaba Medios y ahora también Diapositivas; un módulo no importa archivos de otro |
| 2026-10-05 | **Tras la fase 8 el trabajo se detiene** para las pruebas del dueño; el himnario se revisa después | Decisión 28 |
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

Las sugerencias S9 a S11 son del televisor: quedan para el final de todo, cuando se retome la fase 3 (decisiones 19 y 35); el asistente se las recuerda al dueño entonces.

| # | Sugerencia | Por qué | Qué cambiaría |
| --- | --- | --- | --- |
| S9 | Encender y apagar el televisor desde Manna | Su control por red lo permite (encendido por red y tecla de apagado). No se incluyó para no apagar un televisor por error ni probarlo sin el dueño delante | Dos botones en la tarjeta del televisor. Pequeño; se haría tras la prueba del dueño |
| S10 | Fase 7: enviar un video de YouTube directamente al televisor | El televisor anuncia su aplicación de YouTube en la red (se vio al explorarlo). Serviría para que el video lo reproduzca el propio televisor, sin pasar por su navegador | Se estudiaría en la fase 7; no cambia el plan todavía |
| S11 | Otras marcas de televisor | El módulo está hecho para añadirlas. Los LG (webOS) sí aceptan que se les indique la dirección por la red | Solo si alguna iglesia lo necesita; hace falta un televisor de esa marca para probar |
| S25 | Que el dueño pruebe **PowerPoint en el equipo Windows** con dos o tres presentaciones reales, **convertidas y en vivo** (fase 12) | Es lo único de la fase 8 que no se pudo ejecutar: en el equipo de desarrollo no hay Windows, y en Mac PowerPoint no respondió sin que alguien aceptara un permiso | Nada en el plan. Si falla, lo que diga la tarjeta de la presentación es el punto de partida; mientras tanto, el PDF funciona **Pospuesta** hasta que el asistente estudie si PowerPoint puede pasar la presentación en segundo plano (decisión 35) |
| S35 | **Proyectar una pestaña ya abierta en el Chrome del equipo principal**, como al compartir en Google Meet | Serviría para cualquier página, también las que no se dejan mostrar o piden iniciar sesión, sin ZIP | Estudiado el 2026-10-14: ver «S35 · lo que se sabe», debajo. Mediano |
| S42 | **Ordenar a mano** las categorías de Videos y los videos dentro de una | Hoy van en el orden en que se crearon y de lo más nuevo a lo más viejo. Se dejó fuera de la fase 16 para no alargarla | Arrastrar para reordenar, en el escritorio y en el celular. Mediano |
| S41 | **Letras sin música en un proyector 16:9**: fondo negro a los lados | Las diapositivas del himnario son 4:3 (1024 × 768): en un proyector 16:9 quedan franjas a los lados, donde se ve el fondo de la proyección | Si al probarlas en la iglesia molestan, poner negro detrás solo de las letras sin música. Pequeño |


### S40 · Manejar una página web desde el celular: lo que se sabe (2026-10-16; descartada por ahora, decisión 39)

Prueba de concepto en el Mac de desarrollo, con un Chrome sin ventana y el cliente WebSocket de Manna (`core/ws.js`), sobre una página de prueba servida en el propio equipo:

- **Funciona** por el mismo protocolo de depuración con que hoy se envían las flechas: **tocar** (un clic donde se tocó, pasado de fracciones de la imagen a la página de 1920 × 1080), **desplazar** (con la rueda y con un gesto de dedo de verdad, `Input.synthesizeScrollGesture`) y **escribir** en un campo (`Input.insertText`).
- **Imagen en vivo** (`Page.startScreencast`): Chrome solo envía un cuadro cuando la página cambia; una página quieta no gasta nada. Tras un toque, el cuadro nuevo llega en menos de 10 ms. Con 960 px de ancho, una página sencilla pesa unos 6 KB por cuadro; el peor caso (una página llena de detalle que cambia en cada cuadro, como un video) llega a 140 KB por cuadro y 24 cuadros por segundo, unos 3,3 MB/s. Por eso, al celular se le enviarían **como mucho 5 cuadros por segundo** (el último, descartando los de en medio): en el peor caso, unos 700 KB/s, y casi nada con una presentación quieta.
- **Solo con la página en su propia ventana** (la que se abre sobre la proyección): una página que se deja mostrar dentro de Manna se ve como una copia en cada pantalla, y no hay una sola que manejar. Para manejarla, se abriría también en su ventana.
- **Cómo sería**: en el celular, con una página web al aire, «Manejar» abre la imagen en vivo a pantalla completa; un toque es un clic, arrastrar desplaza y «Teclado» escribe. El servidor abre la sesión con la ventana solo mientras alguien la maneja (`launcher.js`, el único sitio que habla con Chrome) y una orden nueva (`web.input`, con permiso de control) valida cada toque, desplazamiento y texto.
- **Riesgos**: amplía la regla de lo que se le envía a esa ventana (hoy, solo flechas). Desde el celular se podría seguir un enlace a otro sitio o escribir una contraseña que se vería en el proyector. Un enlace que abre otra ventana quedaría fuera de la vista. Todo eso es de la página, no de Manna, y desde internet sigue pidiendo PIN.
- **Sin probar**: en el equipo Windows y con un Chrome con ventana de verdad en el proyector (el protocolo es el mismo en los dos sistemas), y en un celular real.
- **Recomendación**: hacerlo. Tamaño mediano.

### S39 · PowerPoint en segundo plano: lo que se sabe (2026-10-15; se hizo en la fase 14)

El dueño preguntó si PowerPoint podría pasar la presentación en segundo plano, sin verse, y que Manna la mostrara (así el puntero de Manna se vería encima).

- **Cómo es hoy**: la presentación se abre con la ventana del editor minimizada; en la pantalla de quien opera no aparece PowerPoint (solo su icono en la barra de tareas). Lo único visible es el pase, y solo en el proyector.
- **PowerPoint no dibuja un pase sin ventana**: no tiene un modo que entregue las imágenes a otro programa. Para que Manna lo mostrara habría que **grabar en video la ventana del pase** y enviarlo a la proyección: con el ffmpeg reciente (filtro `gfxcapture`, de Windows Graphics Capture, comprobado en su documentación) o compartiendo la ventana desde Chrome (como S35, con el selector cada vez). Costes: un retraso visible, gasto de procesador, menos nitidez y el sonido aparte; y capturar un pase de PowerPoint a pantalla completa falla a menudo (foros de OBS, comprobado: a veces se queda en la primera diapositiva). **No se recomienda para un culto.**
- Exportar la presentación como video (`CreateVideo`) conserva animaciones, pero se reproducen con tiempos fijos, no al pulsar «Siguiente»: no sirve.
- **Lo que sí resuelve el puntero**: una ventana transparente siempre encima del pase, en la pantalla del proyector, que solo dibuja el punto rojo. Programas como ZoomIt dibujan así sobre un pase de PowerPoint. La trampa conocida: si se hace clic en esa capa, PowerPoint sale del pase; se evita con una capa que deja pasar los clics y no toma el foco. Sin comprobar en Windows.

### S35 · Compartir una pestaña de Chrome: lo que se sabe (2026-10-14)

Consultado a Gemini y comprobado en la documentación de Chrome lo marcado así; lo demás, **sin comprobar**.

- **Cómo sería**: el control del equipo principal (en `localhost`, que el navegador da por seguro) pide `getDisplayMedia`; Chrome muestra **su selector de pestañas cada vez** (no se puede saltar ni recordar). El video llega a la ventana de proyección (otro Chrome, otro perfil) por WebRTC, con Manna de intermediario para conectarlas.
- **Lo que gana**: vale para cualquier página: Kahoot, Canva sin enlace de insertar y las que piden iniciar sesión, porque la pestaña es la del Chrome normal con sus sesiones. Lleva el sonido de la pestaña. Quien opera la maneja en su pantalla mientras se proyecta, sin ZIP ni archivos.
- **Controles que Manna podría tener** (Chrome de escritorio):
  - **Desplazar** la pestaña y **acercar o alejar** con *Captured Surface Control*: `forwardWheel`, `increaseZoomLevel`, `decreaseZoomLevel` y `resetZoomLevel`. Desde Chrome 136, y pide permiso una vez (comprobado: https://developer.chrome.com/docs/web-platform/captured-surface-control).
  - **Cambiar a otra pestaña** sin volver a empezar (`surfaceSwitching`).
  - Que Chrome **no salte** a la pestaña al compartir (*Conditional Focus*).
  - **Pausar o dejar de compartir**.
- **Lo que no se puede**:
  - No hay forma estándar de enviar **flechas ni clics** a la pestaña compartida. Para «Anterior / Siguiente» desde un celular haría falta una **extensión de Chrome** con `chrome.debugger`, instalada a mano; Chrome muestra un aviso de depuración en la pestaña.
  - El protocolo de depuración ya no se abre sobre el perfil normal de Chrome (Chrome 136).
- **Límites**:
  - Solo se comparte desde el equipo principal: un celular en `http://` no puede.
  - Compartir dura lo que siga abierta la página de control que comparte.
  - Codificar el video gasta CPU del equipo principal.
  - El texto pequeño se ve peor que en la página tal cual.
  - Hacerlo llegar también a celulares y televisores por WebRTC sin `https` está sin comprobar: Chrome oculta la dirección del equipo tras un nombre `.local`, y Safari en `http://` puede no aceptarlo.
- **Recomendación**:
  - Añadirlo como **una forma más** de proyectar, sin quitar las direcciones ni los archivos: «Compartir una pestaña», solo en el equipo principal y hacia su pantalla de proyección, con desplazar, acercar y cambiar de pestaña.
  - Las demás pantallas mostrarían la tarjeta «Se ve en el proyector».
  - Antes, una prueba de concepto de un día: WebRTC entre dos Chrome del mismo equipo, sin dependencias.
  - Las flechas desde el celular, solo si se acepta la extensión.
