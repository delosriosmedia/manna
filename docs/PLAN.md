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
| 19 | ~~Investigación: funciones especializadas para el celular (decisión 41)~~ **Cancelada** (decisión 56): se rehará desde cero en la fase 40 | M | sin versión |
| 20 | Auditoría de la interfaz con las skills de diseño (decisión 40) | M | 1.22 |
| 21 | Un solo Manna a la vez: en internet y en la red local (decisión 42) | M | 1.28 |
| 22 | Medios en un solo cajón, con categorías que se arrastran (decisión 43) | L | 1.26 |
| 23 | Órdenes del culto guardados (decisión 43) | M | 1.27 |
| 24 | Biblia al aire: otra versión, otro versículo o comparar desde lo proyectado (decisión 44) | M | 1.29 |
| 25 | Escenario más compacto: conexión y dispositivos arriba, sin «Seleccionado», barra de abajo en una fila y cajones sin repetir (decisión 44) | L | 1.30 |
| 26 | Barra de arriba y Ajustes: marca con la versión, «Al aire» al centro, wifi y QR que se abren en su sitio, fundidos, tamaño de la interfaz, borrar por categoría (decisión 46) | M | 1.31 |
| 27 | Citas de un texto o documento al orden del culto: pegar muchas, o sacarlas de un Word o un PDF, con una lista para revisar (decisión 47; I1 e I2 (`docs/citas-de-documentos.md`)) | L | 1.32 |
| 28 | Varios videos de YouTube de una vez: pegar muchos enlaces y que se descarguen en cola (decisión 48) | S | 1.33 |
| 29 | Elegir la carpeta de contenido desde Ajustes, sin reiniciar, y avisar si no se ha elegido (decisión 48) | M | 1.34 |
| 30 | Instalador de un solo archivo con el icono de Manna, paso a paso y con Node.js incluido (decisión 48) | L | 1.35 |
| 31 | Tres capas encima de la proyección y páginas web transparentes (decisión 51; con fecha: el 29 de octubre) | M | 1.36 |
| 32 | Tiempo: la hora, cronómetros y temporizadores, a la proyección o a una capa (decisión 51) | M | 1.37 |
| 33 | Presentaciones sin PowerPoint, con DeckCraft: medir la fidelidad, convertir y pasar en vivo dentro de Manna (decisión 51) | L | 1.38 y 1.39 |
| 34 | Versículos en una capa y la barra de capas al estilo Dynamic Island (decisiones 51 y 54) | M | 1.40 |
| 40 | Investigación desde cero: funciones especializadas para el celular (decisión 56), en pausa hasta que lo diga el dueño (decisión 60) | M | sin versión (documento) |
| 41 | Organizar la interfaz desde el superadministrador (la idea I5, decisión 60), después de la 39 | por planear | |

**Orden cambiado el 2026-10-04 (decisión 20)**: la fase 6 va antes que la 5, mientras el dueño revisa las letras de los himnos. La reproducción (pausa, avance, volumen, una sola pantalla que suena), que iba a estrenarse con el himnario, se construye con los videos.

**Y el 2026-10-14 (decisión 30)**: se añaden las fases 10 a 12, en ese orden, a petición del dueño.

**Y el 2026-10-05 (decisión 28)**: tras la fase 7 se hace la 8 (diapositivas); ahí se detiene el trabajo para que el dueño pruebe, y después se revisa el himnario.

**Y el 2026-10-16 (decisión 40)**: se añaden las fases 16 a 19, en ese orden. La 2.0 sigue esperando la parte del equipo real de la fase 9 (las pruebas del dueño).

**Y el 2026-10-17 (decisión 41)**: antes de la auditoría de la interfaz se hace una investigación de funciones especializadas para el celular (fase 19); la auditoría pasa a ser la fase 20.

**Y el 2026-10-17 (decisión 42)**: se añade la fase 21, para que nunca funcionen dos Manna a la vez con el mismo dominio ni en la misma red.

**Y el 2026-10-17 (decisión 43)**: la fase 19 se aplaza. Antes de seguir van, con prioridad, la 22 (Medios en un solo cajón) y la 23 (órdenes guardados), en ese orden; después, la 21.

**Y el 2026-10-17 (decisión 44)**: tras la 21, la 24 (Biblia al aire) y la 25 (Escenario más compacto).

**Y el 2026-10-25 (decisión 56)**: se cancela la fase 19 y se retira su propuesta. Se añade la 40: a futuro, la misma investigación otra vez desde cero.

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

### Fase 17 · Diapositivas dentro de Medios — hecha (1.20.0)

Decisión 40. Medios queda con **Imágenes, Audios y Diapositivas**, y Diapositivas sale del dock.

- La pestaña funciona como el módulo de hoy: subir un PDF o un PowerPoint, ver sus diapositivas, «Pasar con PowerPoint». Arrastrar un PDF o un PowerPoint a Medios lo lleva a esa pestaña.
- El Presentador y su función no cambian. «Buscar en todo» lleva a la pestaña (`medios.pestana`). El servidor no cambia (`slides.*`, permiso `slides.edit`).
- **Cómo se hace**: Diapositivas ofrece su pestaña con la forma de las de Medios (`web/modules/slides/panel.js`, sacado de su `workspace.js`) y Medios la importa: una excepción documentada a «un módulo no importa archivos de otro», que se anota en `web.md` y `arquitectura.md`.

### Fase 18 · Textos: mensajes y citas con autor — hecha (1.21.0)

Decisión 40. Un módulo nuevo (`server/modules/texts/`, `web/modules/texts/`, tipo de contenido `text`) para proyectar mensajes.

- **Una lista de textos guardados**, para volver a usarlos y añadirlos al orden del culto.
- **Dos tipos**: *Texto*, un mensaje normal; y *Cita*, la cita en grande y debajo «— Autor».
- **Una línea en blanco parte un texto largo en pantallas**, que se pasan con «Siguiente», como los versículos.
- Se proyecta con el fondo y la letra de la proyección (los de la Biblia, `projection/text.js`), con el tamaño ajustado para que quepa. Se ve antes en «Preparado».
- Guardado con `app.storage('textos')` (`{ id, style: 'normal' | 'quote', text, author, added }`), órdenes `texts.save` y `texts.remove` con el permiso nuevo `texts.edit`, longitud validada en el servidor. En «Buscar en todo».
- **Solo en Control completo** (respuesta del dueño, 2026-10-17): el Servicio de alabanza no tiene Textos.

### Fase 19 · Investigación: funciones especializadas para el celular — cancelada (decisión 56)

**Cancelada el 2026-10-25** a pedido del dueño, con las dos versiones de su propuesta (la segunda, con más capacidades por función). El documento y su simulación (`docs/funciones-celular.md` y `.html`) se retiraron del repositorio y quedan solo en el historial de git. La investigación se rehará desde cero en la fase 40.

Decisión 41. Investigación y análisis, **sin programar**: cómo simplificar Manna en los celulares. En vez de entrar desde el teléfono a «Control completo», en el celular solo habría funciones especializadas, una por necesidad o por tema, con pocas cosas en pantalla.

- Se plantea **desde cero**, sin partir de la distribución actual: qué funciones (roles) habría, qué puede hacer cada una, qué tiene en pantalla y cómo se usa. Se piensa en la experiencia y no solo en la interfaz: quién la usa, en qué momento del culto, qué tareas hace, qué errores hay que evitarle y cómo pasa de una tarea a otra.
- Incluye cómo se elige la función en el celular, qué pasa con el PIN, qué queda solo para el equipo principal y la tableta, qué partes de hoy se aprovechan y cuáles habría que hacer, y en qué orden se construiría.
- Entrega: un documento con la propuesta (`docs/funciones-celular.md`), con bocetos de cada pantalla y las decisiones que tendrá que tomar el dueño. No cambia la app: lo que se apruebe entra como fases nuevas.
- Apoyo: las skills de diseño (impeccable, para la estructura y el uso) y Gemini para contrastar la propuesta.

### Fase 20 · Auditoría de la interfaz con las skills de diseño — hecha (1.22.0)

Decisión 40. Al terminar las fases 16 a 19, una revisión de toda la interfaz con las skills de diseño instaladas en el equipo del dueño, además de la auditoría de pantallas de siempre (`auditar-responsive`):

- **impeccable**: sus revisiones de auditoría, crítica, robustez y adaptación a cada pantalla (jerarquía, legibilidad, estados vacíos y de error, accesibilidad, celular y tableta).
- **break-ui**: los peores datos posibles en cada pantalla (nombres larguísimos, listas vacías o enormes, categorías y textos sin nombre, citas sin autor).
- **review-animations** y **emil-design-eng**: las transiciones y los detalles de acabado.

Reglas: lo que digan las skills se contrasta con `DESIGN.md`, que manda; los hallazgos se comprueban en la app antes de corregirlos y se le presentan al dueño, que decide los cambios grandes (primero el plan). Se cierra con las pruebas completas y la auditoría de pantallas.

### Fase 21 · Un solo Manna a la vez: en internet y en la red local — hecha (1.28.0)

Decisión 42. El 2026-10-17 el dueño abrió Manna en su Mac con la clave del túnel de la iglesia mientras el de la iglesia estaba encendido: los dos se conectaron a `manna-iglesia.es` y Cloudflare repartía las visitas entre ellos. Ese mismo día, en el Windows de la iglesia, una segunda copia de Manna se abrió sola en el puerto 8001 porque el 80 y el 8000 los tenía otra. Dos Manna a la vez confunden a los celulares, a la pantalla y a quien entra desde fuera.

**1. Conexión por internet con dominio propio**
- Antes de abrir el túnel, Manna entra a su dirección (`https://manna-iglesia.es/api/ping`) y mira quién contesta. Si contesta **otro** Manna (otro `id`), no se conecta: estado nuevo `busy`, y Ajustes y el menú de la función dicen «Esta conexión ya la está usando otro equipo con Manna (versión X). Este no se conecta, para no cortar a quien entra desde fuera».
- Mientras tanto vuelve a mirar cada minuto y **se conecta solo cuando el otro la suelta** (sin respuesta, o Cloudflare dice que no hay túnel).
- Si dos se encienden casi a la vez, el comprobador de la 1.24.0 lo nota («otro equipo»): en vez de rehacer el túnel, el que lo nota se aparta (pasa a `busy`) y espera. Cada uno espera un rato distinto al azar, para que no vuelvan a chocar.
- El túnel rápido (`trycloudflare.com`) no cambia: su dirección es única y no puede chocar.

**2. Red local**
- Al abrirse, Manna mira si ya hay otro **en el mismo equipo** (contesta en sus puertos, 80 y 8000 a 8010, con otro `id`) o **en la misma red** (otro equipo ya responde a `manna.local`; hoy, `mdns.js` se pone `manna-2.local` sin decir nada). El otro se confirma pidiéndole `/api/ping`.
- Si encuentra otro, este Manna **no funciona**: no se anuncia en la red, no abre la proyección, no se conecta a internet y no acepta órdenes (salvo apagarse y volver a comprobar). Todas sus pantallas muestran «Ya hay otro Manna funcionando en esta red, en 192.168.1.20 (Manna 1.25.3). Usa ese, o apágalo y pulsa *Volver a comprobar*», con «Apagar este Manna» en el equipo principal.
- Vuelve a mirar cada 15 segundos y **arranca solo cuando el otro se apaga**. El primero que se abrió sigue funcionando como siempre.
- Solo cuentan los Manna con el mismo nombre en la red (`manna.local`): los servidores de prueba y la demostración usan otros (`MANNA_NAME`) y no se bloquean entre sí ni bloquean al de la iglesia. Un Manna con los mismos datos (el mismo `id`) no es otro: es el de siempre, y se abre su control como hasta ahora.

**Pruebas**: dos servidores de prueba de verdad con el mismo nombre (el segundo se bloquea, lo dice en todas sus pantallas y arranca cuando el primero se apaga) y, para el túnel, el cloudflared de mentira con «otro Manna» contestando en la dirección de la comprobación. En Chrome se pulsan «Volver a comprobar» y «Apagar este Manna». **Sin probar** hasta que el dueño lo vea: dos equipos de verdad en la misma red y el túnel de verdad.

### Fase 22 · Medios en un solo cajón, con categorías que se arrastran — hecha (1.26.0)

Decisión 43. Videos vuelve a Medios, y todo lo que se agrega se junta en un mismo cajón, venga de donde venga.

**Cómo queda**
- **Medios lo tiene todo**: imágenes, videos (subidos, de la carpeta de la iglesia y de YouTube), audios y presentaciones (PDF y PowerPoint). Videos sale del dock, y el Servicio de alabanza recibe Medios en su lugar.
- Arriba, las categorías: **«Principal»** (el cajón principal) y las que cree la iglesia. Debajo, lo que hay en la elegida.
- **El cajón principal tiene solo lo que no está en ninguna categoría.**
  - Al poner algo en una categoría, sale del principal y queda solo ahí: cada elemento está en una sola categoría.
  - «Sacar de la categoría» lo devuelve al principal.
  - Borrar una categoría devuelve sus elementos al principal: no borra nada.
- **Separado por tipo, en el mismo cajón** (recomendación del asistente; el dueño preguntó si era mejor todo mezclado y marcado):
  - Primero las imágenes, luego los videos, los audios y las presentaciones.
  - Cada grupo lleva su título con su icono, su color y cuántos hay; cada elemento, la marca de su tipo. Un grupo vacío no se muestra.
  - Dentro de cada grupo, del más antiguo al más reciente.
  - Por qué así: en el culto se busca «el video» o «la presentación», y el tipo es lo primero que se sabe; las imágenes, los videos y las presentaciones se reconocen por su miniatura, y un audio no tiene; lo recién agregado queda al final de su grupo; y aprovecha las listas que ya funcionan, con su selección y sus mandos.
- **Arrastrar a una categoría**:
  - Se arrastra un elemento sobre el nombre de una categoría y pasa a ella, y desaparece de donde estaba. Sobre «Principal», sale de su categoría.
  - Con el ratón se arrastra sin más; con el dedo, se mantiene pulsado un momento y luego se arrastra.
  - El menú del elemento conserva «Mover a una categoría», para el teclado y para quien no arrastre.
- **Un solo botón «Subir»** para cualquier archivo (imágenes, videos, audios, PDF y PowerPoint), y el enlace de YouTube en la cabecera. Lo que se sube o se descarga con una categoría elegida entra en ella; si no, en el principal.
- En «Añadir» del orden del culto, «Video», «Imagen o audio» y «Diapositivas» pasan a ser una sola entrada: «Medios».

**Por dentro**
- Las categorías siguen en el módulo de medios (`data/medios.json`), ahora con cualquier elemento: imágenes, videos, audios y presentaciones. Las presentaciones las confirma el módulo de diapositivas (`app.services.slides`).
- Una orden nueva, «mover a una categoría (o a ninguna)», sustituye a la de poner y quitar.
- Al actualizar, un video que estaba en varias categorías se queda en la primera.
- Los tipos de contenido no cambian. Las listas de imágenes, videos, audios y presentaciones se reutilizan como grupos de una misma pantalla, con una sola selección a la vez.

**Pruebas**
- En `test/servidor.test.js`: el cambio de los datos y la orden nueva.
- En Chrome: subir de cada tipo, crear una categoría, arrastrar con el ratón y con el dedo, sacar al principal y borrar la categoría.
- La auditoría de pantallas, con Medios lleno y con una categoría.
- **Sin probar** hasta que lo vea el dueño: arrastrar con el dedo en un celular y una tableta reales.

### Fase 23 · Órdenes del culto guardados — hecha (1.27.0 y 1.27.1)

Decisión 43. Guardar el orden de un servicio entero aparte, usar otro mientras tanto y volver a él cuando haga falta, con todos sus elementos.

**Cómo queda**
- Manna tiene siempre **un orden sin nombre**, el de trabajo, y además **los órdenes guardados**, cada uno con su nombre («Culto del sábado 18», «Semana de oración»).
- Uno es **el que está en uso**: el que ven la cola, el módulo Orden y todos los dispositivos, y por el que se avanza con «Siguiente».
- **Solo pasa a «Órdenes guardados» el que tiene nombre** (ajuste del dueño, 2026-10-17). Ponerle nombre al orden sin nombre lo guarda; el nombre que se propone es el día, la fecha y la hora: «Sábado 18/10/26 19:30».
- **El orden sin nombre se vacía al cerrar Manna.** Al abrirse, Manna empieza con él, vacío; no se crea ningún orden en la lista.
  - Excepción, para que un cierre en mitad del culto no vacíe la cola: si Manna se reinicia (al actualizarse, «Reiniciar ahora») o vuelve a abrirse antes de 15 minutos, el orden sin nombre conserva lo que tenía y sigue en uso el mismo orden (como ya pasa con lo que está al aire).
- **Un orden guardado se guarda solo**: cada cambio queda guardado mientras está en uso, sin botón de guardar.
- En el módulo Orden, el nombre del orden en uso («Sin nombre» o el suyo) abre **«Órdenes guardados»**: el orden sin nombre arriba y luego los guardados, con su nombre, cuántos elementos tienen y cuándo se cambiaron. Desde ahí:
  - **Usar este**;
  - **Guardar con un nombre** el orden sin nombre (y seguir en él, ya guardado);
  - **Nuevo orden**: vuelve al orden sin nombre, vacío. Si tenía algo, avisa que se vaciará y ofrece guardarlo antes con un nombre;
  - en los guardados: cambiar el nombre, **duplicar** (para preparar el de la semana siguiente a partir de uno) y eliminar.
- Cambiar el orden en uso pide confirmación, porque lo ven todos los dispositivos al momento. Lo que esté al aire sigue al aire.
- Al volver a un orden, lo que ya no esté en la biblioteca (un video borrado) se quita y se avisa cuántos.
- El nombre del orden en uso se ve también en la cola del culto.
- Se edita solo el orden en uso. Preparar uno mientras se usa otro sin cambiar la cola era la decisión 8 de la fase 19 (cancelada); queda para la fase 40.
- La función «Control del orden» ve el nombre, pero no cambia de orden (no edita).

**Por dentro**
- `data/orden.json` pasa de una lista a `{ draft: { items }, saved: [{ id, name, items, updated }], active, alive }`: `draft` es el orden sin nombre, `active` el guardado en uso (`null`, el sin nombre) y `alive` la última hora en que Manna estaba abierto (se apunta cada minuto), para saber al abrir si pasaron 15 minutos. Al actualizar, el orden de hoy, si tiene algo, pasa a ser un orden guardado, «Orden del culto», y queda en uso esa primera vez.
- El espacio `order` sigue publicando `items` (los del orden en uso): la cola, la proyección y «Siguiente» no cambian. Se añaden el nombre y la lista de órdenes, sin sus elementos.
- Órdenes nuevas para crear, usar, cambiar el nombre y eliminar, con el permiso `order.edit`.
- «Limpiar multimedia temporales» limpia todos los órdenes.

**Pruebas**
- En `test/servidor.test.js`: el cambio de los datos, crear, usar, copiar, cambiar el nombre, eliminar y limpiar.
- En Chrome: cada botón de «Órdenes guardados», y que la cola de otro dispositivo cambie al usar otro orden.
- La auditoría de pantallas, con la lista abierta.

### Fase 24 · Biblia al aire: otra versión, otro versículo o comparar desde lo proyectado — hecha (1.29.0)

Decisión 44. Pedido del dueño: con un versículo al aire (del orden del culto o no), cambiar de versión, pasar a un versículo cercano o compararlo con otra versión obliga hoy a ir a la Biblia y buscar la cita.

**Cómo queda**: los mandos de un pasaje al aire (en la barra de abajo; en el celular, en su hoja) llevan tres botones:
- **Versión** (la abreviatura, «RVR1960 ▾»): la lista de versiones; tocar una pone al aire el mismo pasaje en esa versión.
- **Comparar** («⇄ ▾»): la lista de versiones; tocar una pone al aire el mismo pasaje en las dos, como el comparador de la Biblia. Con una comparación al aire, «Una sola» vuelve al pasaje.
- **Versículos** («Juan 3:16 ▾»): los números del capítulo en una rejilla, con lo que está al aire marcado; un toque proyecta ese versículo y dos toques eligen un tramo. Las flechas de al lado cambian de capítulo.
- Con lo que vino del orden del culto, cambiar la versión o comparar **no lo saca del orden**: «Siguiente» sigue por el orden, y el elemento del orden no cambia. Elegir otro versículo sí lo saca: se proyecta como desde la Biblia y «Siguiente» sigue por la Biblia.

**Por dentro**: sin órdenes nuevas en lo posible: `projection.show` con el pasaje nuevo, conservando el sitio en el orden (`orderId` y su paso) cuando el pasaje es el mismo. Las versiones y los versículos del capítulo ya los da el módulo de la Biblia.

**Pruebas**: en Chrome, cambiar la versión y comparar con algo del orden (y que «Siguiente» siga por el orden), elegir otro versículo y un tramo; la auditoría de pantallas con los mandos abiertos.

### Fase 25 · Escenario más compacto — hecha (1.29.0, con la 24)

Decisión 44. Pedidos del dueño tras usar la 1.27.

1. **Conexión por internet y Dispositivos, arriba, uno al lado del otro**, junto a la ficha de la función (donde hoy está «Dispositivos» en el menú de la función):
   - **Conexión**: un icono de wifi que dice su estado de un vistazo: apagada (gris, tachado), conectando (las ondas se encienden una tras otra), encendida y comprobada (cian), con error u ocupada por otro equipo (rojo, con un punto). Al tocarlo, una hoja con el detalle (la dirección, desde cuándo está comprobada, el último error) y **Encender / Apagar**. Lo ven las mismas funciones que hoy tienen la conexión en su menú.
   - **Dispositivos**: un icono de código QR minimalista (que se vea bien pequeño) que abre la ventana de siempre (el QR, las direcciones, el PIN y los dispositivos conectados).
2. **Sin la tarjeta «Seleccionado»** (antes «Preparado»): lo elegido ya se ve con su borde cian y se proyecta desde la barra de su módulo.
   - En la cola del culto y en «Buscar en todo», un toque marca el elemento, que lleva un botón pequeño ▶ para proyectarlo; el doble toque e Intro siguen proyectando.
   - En el celular («Historias»), igual.
3. **Todo un poco más pequeño**, en el escritorio y en el celular: barras, dock, cola, cajones, cabeceras y textos de la interfaz, con menos márgenes. En pantallas táctiles, lo que se toca baja a **35 px** como mínimo (ajuste del dueño; antes, 40): `DESIGN.md` y la auditoría de pantallas se cambian con ello.
4. **La barra de abajo en una sola fila**, con los mandos de lo que está al aire y lo de siempre: «Anterior», «Siguiente», el volumen (más corto) y los mandos del tipo. Sale «Sigue: …», que ya se ve en la cola. Lo que no quepa va al botón de más mandos. Además de ocultarse al dejar quieto el ratón, **se oculta al tocar el fondo**, y vuelve al mover el ratón.
5. **Cajones sin repetir**: la fila de arriba del cajón (el nombre del módulo, ampliar y cerrar) y la cabecera del módulo (otra vez el nombre y sus controles) pasan a ser **una sola fila**: el nombre una vez, los controles del módulo y, a la derecha, ampliar y cerrar. Se revisa cada módulo para que su cabecera ocupe una fila cuando quepa, sin nada repetido.

**Pruebas**: la prueba en Chrome y la auditoría de pantallas se rehacen donde cambie la estructura (la tarjeta, la barra de abajo, la fila del cajón), con comprobaciones nuevas: el estado del wifi en sus cinco casos (con el cloudflared de mentira), encender y apagar desde la hoja, la barra que se oculta al tocar el fondo y que todo quepa en una fila en los 10 tamaños.

### Fase 26 · Barra de arriba y Ajustes — hecha (1.31.0)

Decisión 46. Pedidos del dueño del 2026-10-18, aprobados con sus observaciones (orden E, C, A, B, D):

1. **Borrar por categoría** (E): sin «Limpiar multimedia temporales»; cada categoría de «Espacio en disco» con su botón, que pregunta dos veces. Las copias para celulares no tienen: se van con su video.
2. **La marca** (C): sale la ficha «Control completo · versión»; a la izquierda, el logo más grande y con aire, «Manna» y la versión, y un botón aparte de cambiar de función. **El logo abre Ajustes**, que sale del dock (observación del dueño), sin confundirse con cambiar de función, y sin perder Ajustes en el celular.
3. **El wifi y el QR se abren en su sitio** (A): el botón crece hasta ser una tarjeta con toda su información; lo de su izquierda se corre y vuelve al cerrarse (el mismo botón, o el ratón 2 s fuera; también Esc y tocar fuera).
4. **Fundidos sutiles** (B) en todo lo que se abre, cortos y baratos.
5. **«Al aire» al centro, en su burbuja, y «Solo fondo» y «Negro» como iconos** junto a cambiar de función (añadido por el dueño a mitad de la fase).
6. **Tamaño de la interfaz** (D): un deslizador en Ajustes, por dispositivo, del tamaño actual (mínimo) a un 8 % más, con una A pequeña y una grande en vez de números (observación del dueño). La auditoría se pasa también al máximo.
7. **Versión nueva**: cada hora en vez de cada 20 minutos, y «Buscar versión nueva» en Ajustes (observación del dueño).
8. **Pruebas con tiempo máximo** (regla del dueño): `probar-chrome.mjs` se corta a los 8 min y la auditoría a los 12, diciendo por dónde iban; se dejó como regla en `CLAUDE.md` y `.claude/rules/pruebas.md`.

### Fase 27 · Citas de un texto o documento al orden del culto — hecha (1.32.0)

Decisión 47. Las ideas I1 e I2 (su investigación está en `docs/citas-de-documentos.md`), la calibración con once documentos reales de la iglesia y las decisiones del dueño (aprobó todas las recomendaciones el 2026-10-18) están allí. El prototipo pasó a Manna y se borró.

**Qué hace**: en el Orden, «Añadir» → «Citas de un texto o documento». Se pega un texto (o, en la cita rápida, varias citas) o se elige un Word (`.docx`) o un PDF, desde cualquier dispositivo que pueda editar el orden. Manna encuentra las citas y las muestra en una lista para revisar, en el orden del documento:
- cada cita ya escrita bien, con el trozo del documento donde aparece;
- las seguras, marcadas; las dudosas, sin marcar, con su propuesta y el motivo; las descartadas, plegadas.

Abajo, «Añadir 12 al orden», bajo una sección nueva con el nombre del documento (o una que ya exista), en la versión elegida o en la que diga el documento si está instalada. Nada entra sin pasar por la lista. Sin dependencias nuevas ni modelos de lenguaje.

**Partes**:
1. **Medir antes de construir**. El dueño entrega 3 o 4 sermones nuevos, que el detector no haya visto (solo en local, fuera de git, nunca a Gemini). Se pasan por el prototipo sin tocarlo y se revisan cita por cita. Para seguir: **ninguna segura equivocada ni ninguna cita olvidada**. Si falla algo, se corrige y el caso pasa a ser una prueba (con una frase inventada de la misma forma) antes de seguir.
2. **El detector en Manna**: `server/modules/bible/citas.js`, a partir del prototipo, ya limpio.
   - Los nombres y abreviaturas de los libros viven en un solo sitio, `canon.js`, que comparten la cita rápida y el detector.
   - Ruta `POST /api/bible/citas` (el texto tal cual) → `{ items, dropped, pages }`, ya preparado para la lista (una vez cada cita, con sus opciones), con permiso de editar el orden.
   - Lleva lo calibrado: la ligadura «ti» de los PDF, la numeración más amplia de las biblias instaladas, el contexto, los versículos sueltos con su texto anterior, las citas sin libro y la comparación con el texto copiado.
   - `test/citas.test.js` con los casos del prototipo (hoy 66), sus trampas y sus dos bosquejos inventados. Si existe la carpeta local de bosquejos reales, una prueba comprueba que el resultado con ellos no cambia; si no existe, se salta diciéndolo.
   - Al terminar se borra el prototipo.
3. **Leer documentos en el navegador** (`web/core/documentos.js`):
   - `.docx`: un `.zip` que se abre con `DecompressionStream`.
   - PDF: pdf.js, con marcas de página. Su carga pasa de `web/modules/slides/pdf.js` a `web/core/`, para que lo usen Diapositivas y el Orden sin importarse entre módulos.
   - `.txt`.
   - Avisos: un `.doc` antiguo («guárdalo como .docx o PDF») y un documento sin texto, escaneado («no tiene texto que leer»).
4. **La lista para revisar y añadir**:
   - **Qué sale marcado**: las seguras y las citas de paso; las que confirma el texto copiado, aunque fueran deducidas. Las dudosas salen sin marcar, con la propuesta lista.
   - **Notas**: «aparece 10 veces» (se añade una vez); «ya está en el orden» (sin marcar); un capítulo de más de 40 versículos, con aviso.
   - **«y siguientes»**: hasta el final del capítulo, sin marcar, con el final para cambiarlo.
   - **Corregir a mano**: cualquier cita, con la cita rápida.
   - **Documentos largos** (más de 40 citas): grupos por página o por título del sermón, que se marcan o desmarcan de una vez.
   - **Añadir**: orden nueva `order.addMany { items, section }`, que añade todo de una vez (con la sección nueva o al final de una existente). La pulsa la prueba en Chrome.
5. **Pruebas y documentos**:
   - **Chrome**: pegar texto; elegir un `.docx` y un PDF fabricados en el momento (un `.docx` mínimo, con un ayudante nuevo, y el PDF con texto de `scripts/lib/pdf.mjs`); revisar, marcar y desmarcar; añadir, y la cola cambiando.
   - **Auditoría**: la ventana con una lista larga, en los 10 tamaños y al máximo.
   - **Documentos**: `README.md`, `.claude/rules/arquitectura.md`, `DESIGN.md` (la lista), `docs/ESTADO.md` y `CHANGELOG.md`.

**Riesgos**:
- Los predicadores escriben de muchas formas: la parte 1 lo mide antes de construir.
- Un PDF a dos columnas puede mezclar las líneas: sin probar, y sin un documento así para probarlo.
- Una cita escrita en palabras («Juan tres dieciséis») no se reconoce.

### Fase 28 · Varios videos de YouTube de una vez — hecha (1.33.0)

Pedido del dueño del 2026-10-18: pegar muchos enlaces de YouTube a la vez, separados como vengan (espacios, comas, saltos de línea o dentro de un mensaje), y que Manna los ponga en cola y los descargue uno por uno.

**Lo que ya hay**: el campo del enlace de Videos (`web/modules/media/clips.js`) añade uno con `media.youtube`, que reconoce solo un enlace (`youtubeId`, en `server/modules/media/youtube.js`). Las descargas **ya van en cola, de una en una** (`createDownloader`): lo nuevo es sobre todo la entrada.

**Qué haría**:
- Junto al campo del enlace, un botón **«Varios»** que abre una ventana para pegar; y pegar en el campo un texto con más de un enlace la abre sola (como las citas en el Orden).
- La ventana saca **todos los enlaces de YouTube del texto** (los mismos que hoy: `watch?v=`, `youtu.be`, `shorts`, `live`…) y los muestra en una lista: cada uno una vez, los que **ya están en la biblioteca** sin marcar, y cuántas cosas del texto no eran enlaces de YouTube. «Descargar 7 videos» los añade a la categoría elegida.
- En el servidor, una orden nueva `media.youtubeMany { links }` (hasta 50): comprueba yt-dlp y ffmpeg una vez y añade todos como «En cola»; cada tarjeta dice «En cola» hasta que le toca, y después su avance. Quitar una tarjeta en cola la saca de la cola.
- Pruebas: los enlaces mezclados en un texto (prueba automática), y en Chrome pegar varios con el yt-dlp de mentira.

**Decidido (decisión 48)**: las listas de reproducción no se aceptan por ahora (se dice); los títulos no se piden antes de descargar. Observaciones del dueño:
- **Lo que ya está se reconoce aunque se le haya cambiado el nombre**: se compara por el identificador del video de YouTube, no por el nombre.
- **El nombre de YouTube llega bien escrito**, con sus tildes: a veces salían «rombos» (�). Se revisa cómo se lee lo que dice yt-dlp (en Windows escribe en otra codificación si no se le pide UTF-8, y un carácter partido entre dos trozos de la salida también se estropea).
- Los enlaces pueden venir dentro de un mensaje, con un nombre o una nota en la misma línea («Canto de GM: https://youtu.be/… (no poner video)»), con `?si=` o `?feature=shared`, o con caracteres invisibles delante: la lista muestra la línea de cada enlace, para saber cuál es cuál.

### Fase 29 · Elegir la carpeta de contenido — hecha (1.34.0)

Pedido del dueño del 2026-10-18: que la persona le diga a Manna dónde está su carpeta de contenido (biblias, himnario, medios), al instalar y desde dentro de Manna.

**Lo que ya hay**: dónde está el contenido lo dice `carpetas.json` (`contenido`), que escribe el instalador (`instalacion/ordenar.mjs`) y lee `server/app.js` al arrancar. Hoy el instalador siempre usa `Documentos/Manna/Contenido` (o la que ya tenía), y la carpeta Manna es la que contiene `Contenido`.

**Qué haría**:
- **En Ajustes, «Carpeta de contenido»**: dónde está, qué tiene (13 biblias, 613 himnos, 20 medios), **«Abrir la carpeta»** (en el Explorador o el Finder) y **«Cambiar…»**, que abre la ventana del sistema para elegir una carpeta **en el equipo principal** (en Windows, la de PowerShell; en Mac, la de `choose folder`). Desde un celular se ve, pero no se cambia (no puede elegir carpetas del equipo).
- Al elegir otra: si no parece una carpeta de contenido (sin `Biblias`, `Himnario` ni `Medios`), lo pregunta antes; le añade solo lo que falte (las instrucciones y la Reina-Valera 1909), **nunca mueve ni borra nada**; guarda la ruta en `carpetas.json` y Manna se reinicia solo (lo que está al aire vuelve, como en cualquier reinicio).
- **Si la carpeta desaparece** (un disco externo desconectado, una carpeta movida), Manna se abre igual y avisa arriba, con «Elegir la carpeta».
- El instalador usa lo mismo (fase 30): `ordenar.mjs --contenido <ruta>`. La carpeta Manna de Documentos (con `Programa` y el instalador) ya no tiene que ser la que contiene `Contenido`: el contenido puede estar en cualquier sitio, también en otro disco.
- Pruebas: el cambio en `carpetas.json` y el aviso de carpeta perdida (automáticas, en carpetas temporales); en Chrome, la sección de Ajustes con la ventana del sistema sustituida por una de mentira. **La ventana del sistema de verdad solo se puede probar a mano** (en Windows, el dueño).

**Decidido (decisión 48)**, con las observaciones del dueño:
- **Sin reiniciar**: al elegir otra carpeta, Manna vuelve a leer las biblias, el himnario y los medios en el momento (cada módulo cambia la carpeta que vigila y lo que sirve), sin cerrarse.
- **El instalador ya no pide la carpeta** (fase 30): instala con la carpeta de siempre, que solo trae la Reina-Valera 1909 y las instrucciones. **Al abrir Manna**, si la carpeta no se ha elegido y solo tiene eso, un aviso dice que falta elegir la carpeta de contenido, donde están el himnario y las demás versiones de la Biblia, con «Elegir la carpeta». Al final de la instalación se dice también.
- Desde Manna se hace todo lo demás: elegir la carpeta, reiniciar (ya está en Ajustes → Apagar o reiniciar) y actualizar (el aviso de versión nueva y «Buscar versión nueva»).

### Fase 30 · Instalador de un solo archivo con el icono de Manna — hecha (1.35.0)

Pedido del dueño del 2026-10-18: que para instalar Manna baste con descargar **un solo archivo** de GitHub, el de su sistema; que explique paso a paso lo que hace mientras instala; y que al final deje elegir la carpeta de contenido.

**Lo que ya hay**: ya es un solo archivo por sistema (`Instalar-Manna-Windows.bat` e `Instalar-Manna-Mac.zip`, en cada versión de GitHub), que baja Manna, ordena la carpeta y crea el icono. Le falta: (1) **hay que instalar Node.js antes**, a mano, y es el paso que más cuesta; (2) es una ventana de texto (en Windows, sin tildes); (3) no deja elegir la carpeta de contenido.

**Qué haría**:
- **Una ventana de instalación de verdad**, sin ventana negra, con los pasos a la vista y una marca en cada uno al terminar: 1. Bienvenida (qué va a hacer, unos 5 minutos, hace falta internet); 2. Comprobar el equipo; 3. Descargar Node.js (si hace falta); 4. Descargar Manna; 5. **Elegir la carpeta de contenido** («¿Ya tienes la carpeta de tu iglesia?» → elegirla, o crear una nueva en Documentos/Manna); 6. Ordenar la carpeta y crear el icono; 7. Listo, con los avisos (el Firewall en Windows) y «Abrir Manna». Debajo de cada paso, una frase de lo que está pasando y una barra de avance. Al actualizar, el paso 5 se salta (ya se sabe dónde está; se cambia desde Ajustes).
  - **Windows**: el mismo `.bat` de un solo archivo, que abre una ventana de Windows (PowerShell con Windows Forms, que trae todo Windows) en vez de la consola.
  - **Mac**: una app, **«Instalar Manna.app»**, dentro de un `.zip` (hecha con `osacompile`, que trae macOS), con sus ventanas y su barra de avance, en vez del `.command` en el Terminal.
- **Node.js incluido**: el instalador baja el Node.js oficial de nodejs.org (comprobando su huella, como ya hace Manna con el de YouTube) a la carpeta `Programa`, y el icono abre Manna con él. Así **no hay que instalar nada antes**, y el Node.js de Manna se pone al día al actualizar.
- La lógica sigue en `instalacion/ordenar.mjs` (con sus pruebas); la ventana solo muestra los pasos. Pruebas: lo de siempre en carpetas temporales (`test/instalacion.test.js`) y la ventana de Mac en este equipo; **la de Windows solo la puede probar el dueño** en un Windows real.

**Por decidir**:
1. **Node.js incluido**: amplía lo aprobado el 2026-10-16 (Node.js oficial solo para YouTube) a «Node.js oficial para mover Manna». Recomendación: **sí**; es lo que más simplifica la instalación.
2. **Formato**: recomendación, el `.bat` con ventana (Windows) y la app en un `.zip` (Mac). Un `.exe` de Windows de verdad (por ejemplo con IExpress, que trae Windows) exige compilarlo en un Windows o en GitHub y no evita el aviso de Windows si no va firmado; un `.pkg` de Mac da el asistente de Apple, pero corre como administrador y no deja elegir bien la carpeta de contenido.
3. **Firmar los instaladores** (para que no salgan los avisos «Windows protegió su PC» y, en Mac, «no se puede abrir»): cuesta dinero cada año. Mac: el programa de desarrolladores de Apple (99 USD al año) permite firmar y notarizar, y el aviso desaparece. Windows: Azure Artifact Signing (unos 10 USD al mes) solo admite personas de Estados Unidos y Canadá (en la Unión Europea, solo organizaciones, por ejemplo la iglesia), y aun firmado, Windows avisa hasta que el archivo gana reputación con las descargas. Recomendación: **no firmar por ahora** y explicar los avisos con imágenes en la página de la versión y en el propio instalador. Desde macOS 15, el aviso de Mac ya no se salta con clic derecho → Abrir: hay que ir a Ajustes del Sistema → Privacidad y seguridad → «Abrir igualmente».

**Decidido (decisión 48)**, con las observaciones del dueño, que cambian la propuesta:
- **Un único archivo que se abre y lo hace todo**, con el **icono de Manna con el engranaje**; nada que descomprimir antes (o que se descomprima solo). Después, la persona solo abre el icono Manna del Escritorio y lo demás lo hace dentro de Manna.
- **Mac: un `.pkg`** (el instalador de Apple, con sus pasos). **Windows: lo equivalente, un `.exe`**. Un `.bat` no puede llevar icono propio: hace falta un `.exe`. Se propone hacerlo con el compilador de C# que trae el propio Windows (`csc.exe`, de .NET Framework), sin programas de terceros, y compilarlo en GitHub (un Windows de GitHub Actions) al publicar cada versión; con lo mismo, las pruebas del instalador corren en un Windows de verdad. Se confirma con el dueño al empezar la fase, porque es un paso de compilación (límite de `CLAUDE.md`).
- **Si solo puede ser una consola, que sea bonita**: título, la lista de pasos con su marca, qué se está instalando y una barra de avance hechas con caracteres, en la consola de Windows y en el Terminal de Mac.
- **Node.js incluido**: sí (amplía lo aprobado el 2026-10-16).
- **Sin elegir la carpeta de contenido en el instalador**: lo dice al terminar y lo avisa Manna (fase 29).
- **Sin firmar** por ahora: los avisos de Windows y de Mac se explican con imágenes.
- **A comprobar al empezar**: un `.pkg` descargado de internet muestra el icono de paquete de Apple, no uno propio (macOS no conserva el icono personalizado de un archivo al descargarlo); el logo de Manna sí puede ir dentro de la ventana del instalador. Si el icono en el propio archivo es imprescindible, la alternativa es una app dentro de un `.zip` que el navegador descomprime solo (Safari) o con doble clic.

**Orden**: 28, 29 y 30.

### Fase 31 · Tres capas encima de la proyección y páginas web transparentes — hecha (1.36.0)

Pedido del dueño del 2026-10-24 (desde la sesión «Sábado Joven», proyecto NUEVA VIDA, y en esta): tener cosas que **queden encendidas encima de todo lo que se proyecte** hasta que alguien las apague, como una página web con transparencias o la hora (fase 32). Serían **tres capas**: la 1 encima de lo que está al aire, la 2 encima de la 1 y la 3 encima de la 2. Lo que se elige en un módulo se envía a la proyección o a una capa, según prefiera quien lo maneja. Las indicaciones detalladas de la página web en una capa están en `docs/capas-y-paginas-transparentes.md`.

**Tiene fecha.** El sábado 31 de octubre de 2026 (Sábado Joven, Auditorio del SENA de Barrancabermeja) hay un concurso:
- la página que muestra cada palabra (`milugar.manna-iglesia.es/word?k=…`) va en una capa durante toda la jornada;
- es transparente casi siempre, y la palabra aparece en grande en menos de un segundo cuando el administrador la libera;
- el reloj del concurso arranca cuando la palabra está de verdad en pantalla.

Tiene que estar probado en el equipo que proyectará en el SENA **antes del ensayo del jueves 29**.

**Lo que ya hay**:
- `web` es un tipo de contenido: sustituye lo que está al aire.
- La página se dibuja a 1920 × 1080, escalada, dentro de un marco con fondo blanco fijo (`.web-frame` en `web/modules/projection/stage.css`). Por eso una página transparente se ve blanca.
- El escenario (`web/modules/projection/stage.js`) pinta, de abajo arriba, el fondo, la capa que oscurece, el contenido y el puntero. Nada va encima del contenido.
- Lo que está al aire se recupera tras un reinicio solo si fue hace menos de 15 minutos (`server/modules/projection/live.js`).
- PowerPoint en vivo y las páginas que no se dejan enmarcar se abren en una ventana propia, encima de la de proyección: taparían una capa.

**Qué haría**:
- **Módulo nuevo `layers`** («Capas» en la interfaz), sin acoplarse a los demás:
  - **Tres capas fijas.** Cada una lleva un elemento (un tipo de contenido con su `data`, como el orden del culto) y un ojo para mostrarla u ocultarla.
  - **Estado y órdenes.** Estado `layers = { slots: [{ n, item, visible }] }`. Órdenes `layers.set { n, kind, data }`, `layers.visible { n, visible }`, `layers.reload { n }` y `layers.clear { n }`, con el permiso `projection.control`: las funciones que ya pueden proyectar.
  - **Siempre vuelven.** Se guardan en `data/capas.json` y vuelven **siempre** al arrancar, sin el límite de 15 minutos: una capa queda encendida hasta que alguien la apague.
  - **Qué tipos entran.** Un tipo va en una capa solo si lo declara (`layer: true` en `app.kind` y en `registerKind`). Se dibuja con su propio `draw`, sin fondo. En esta fase entra `web`, y la 32 añade la hora y los temporizadores. Lo que suena (videos, audios, himnos) no va en capas: rompería la regla de que suena una sola pantalla.
- **Enviar a una capa desde el módulo**: junto a «Proyectar», un botón «Capa» con su menú (capa 1, 2 o 3), cuando lo elegido es de un tipo que va en capas. En esta fase, en Páginas web.
- **El cajón «Capas»** en el dock: las tres capas con lo que tiene cada una, el ojo, «Recargar», «Quitar» y «Poner aquí…».
- **En la ventana de proyección**, tres contenedores encima del contenido y debajo del puntero:
  - el mismo encaje 16:9, con `pointer-events: none`;
  - cambiar lo que está al aire no los toca.
- **Modos**: «Negro» y «Solo fondo» afectan solo a lo que está al aire: **las capas siguen encima** (decisión 51).
- **Otras pantallas** (el fondo del control, celulares, Presentador):
  - una página web de una capa no se carga en ellas: no se abre diez veces ni corre en todos los dispositivos;
  - una pastilla «Capas» junto a «Al aire» recuerda que hay algo encendido encima, y el cajón dice qué;
  - los tipos ligeros, como la hora de la fase 32, sí se dibujan en la proyección de fondo del equipo principal, para ver dónde caen.
- **Página web en una capa** (detalles en el documento de arriba):
  - **Marco transparente.** Es el mismo marco de `web`, con fondo transparente solo en las capas; el contenido `web` normal sigue en blanco. La proyección se queda en `color-scheme: normal`, así que una página que declare `color-scheme: dark` se vería con fondo: se documenta.
  - **Solo páginas que se dejan enmarcar**, con la revisión que ya hace `server/modules/web/index.js`. Las que no, se rechazan como capa diciendo por qué.
  - **Se carga una vez y se queda** (observación del dueño): la página de una capa se carga al ponerla y sigue cargada toda la jornada. Lo que muestra lo decide ella: en el concurso, la palabra aparece en cuanto el administrador la revela y se quita cuando la oculta, por la propia conexión de la página, sin pulsar nada en Manna.
  - **Ocultar no recarga.** Ocultar es `visibility: hidden`: el marco no se recarga al ocultarlo ni al cambiar lo que está al aire, solo con «Recargar» o si cambia la dirección.
  - **Sin páginas de error encima del culto, sin que nadie recargue.** Antes de cargar la página (al ponerla, al abrirse la ventana de proyección o al reiniciar Manna), el equipo principal comprueba que su dirección contesta. Si no contesta (sin internet), la capa espera oculta y Manna lo vuelve a intentar sola cada 15 s; en cuanto contesta, la carga. Así la página de error de Chrome no llega a verse, y la página no tiene que hacer nada especial (lo de `capa-lista` del documento queda descartado).
  - **Aviso de visibilidad.** Manna le manda a la página `{ manna: 'capa', visible }` al cargar y en cada cambio (el ojo, «Negro», la ventana oculta). Con eso el concurso sabe cuándo la palabra está de verdad en pantalla.
  - **Seguridad.** Manna no acepta órdenes ni mensajes de la página: solo le habla.
- **Lo que taparía una capa**: PowerPoint en vivo y una página en ventana propia. Al proyectarlas con una capa visible, Manna avisa y ofrece pasar la presentación como imágenes (decisión 51), hasta que DeckCraft reemplace a PowerPoint (fase 33).
- **Orden del culto**: «Encender capa» y «Apagar capa» como pasos, en la fase 34 (decisión 51). Descartado al planear la 34: las capas solo se tocan desde «Capas» y la barra de abajo (decisión 54).

**Pruebas**, todas antes del jueves 29:
- **Automáticas.** `test/capas.test.js` y `test/servidor.test.js`: las órdenes, los permisos, la validación, los tipos que no van en capas, y que se guarden y vuelvan al arrancar.
- **Página de prueba local** (`scripts/lib/capa-prueba.mjs`): fondo transparente, un recuadro semitransparente y un texto que cambia cada segundo (como la palabra que se revela). Muestra el último `visible` que recibió.
- **En Chrome** (`probar-chrome.mjs`), con cada botón nuevo pulsado:
  - la capa se ve encima de una imagen, un video, unos versículos, un himno, «Solo fondo» y «Negro»;
  - lo de debajo se ve a través de ella (se lee un píxel);
  - el marco no se recarga al cambiar de contenido;
  - vuelve sola al recargar la proyección y al reiniciar Manna;
  - con la dirección sin contestar, la capa espera oculta y se carga sola cuando vuelve a contestar;
  - lo que cambia la página (la palabra que aparece) se ve sin recargar nada;
  - el aviso de visibilidad llega en cada cambio.
- **Auditoría de pantallas**: el cajón «Capas» en los diez tamaños.
- **En el equipo del SENA**, a cargo del dueño, con la 1.36 y el Chrome o el Edge de Manna: la página de prueba, y la del concurso cuando la sesión del Sábado Joven avise que está publicada.

**Tamaño**: M. **Calendario**: el plan se aprueba el 24 o el 25; la fase queda hecha y publicada (1.36.0) el lunes 26 o el martes 27, y el dueño la prueba en el equipo del SENA el 27 o el 28.

**Decidido (decisión 51)**:
1. «Negro» y «Solo fondo» **no ocultan las capas**: solo afectan a lo que está al aire.
2. En esta fase, solo páginas web; la hora y los temporizadores, en la 32; **los versículos en una capa** (para ponerlos sobre una presentación sin salir de ella), en la 34.
3. Con una capa visible, PowerPoint en vivo o una página en ventana propia: Manna avisa y ofrece pasar la presentación como imágenes, mientras PowerPoint siga; la meta es reemplazarlo del todo por DeckCraft (fase 33).
4. «Encender» y «Apagar» capas desde el orden del culto: en la fase 34, cuando estén terminadas la 31, la 32 y la 33. (Descartado el 2026-10-25, decisión 54.)

### Fase 32 · Tiempo: la hora, cronómetros y temporizadores — hecha (1.37.0)

Pedido del dueño del 2026-10-24, con dos ideas suyas de ese día (I3 e I4, de la antigua bandeja de ideas):
- **la hora** en la pantalla de proyección, de forma permanente, sutil pero visible, en una esquina, centrada o donde se elija;
- **temporizadores** para el tiempo que le queda a cada actividad, con su título y en grande;
- además, **cronómetro**.

Lo que se elija se envía a la proyección o a una capa (fase 31), como en cualquier módulo. **Siempre transparente**: en la proyección va sobre el fondo configurado en Ajustes; en una capa, sin fondo.

**Lo que ya hay**:
- **El reloj compartido** de lo que se reproduce (`server/core/playback.js` en el servidor, `positionAt` en `web/core/playback.js`): cada pantalla calcula el tiempo con la hora del servidor (`serverNow()`), sin contar segundos por su cuenta. Así todas ven el mismo segundo.
- **El tipo `text`** (Textos), que se dibuja sobre el fondo con la letra y los colores de Ajustes.

**Qué haría**:
- **Módulo nuevo `time`** («Tiempo» en el dock), con tres clases de elemento:
  - **Hora**: la del equipo principal.
  - **Cronómetro**: cuenta hacia arriba desde cero.
  - **Temporizador**: cuenta atrás desde una duración, con su título («Anuncios», «Predicación»).

  Los cronómetros y temporizadores se guardan con su título, como los textos (`data/tiempo.json`). Cada uno lleva su reloj en el servidor (`{ running, position, at }`, el de la reproducción): corre aunque no esté a la vista, y todas las pantallas ven el mismo segundo.
- **Órdenes**:
  - crear y cambiar: `time.add`, `time.edit` y `time.remove`, con el permiso nuevo `time.edit`;
  - manejar: `time.start`, `time.pause`, `time.reset` y `time.adjust { minutos }` (sumar o restar un minuto), con `projection.control`.
- **Tipo nuevo `clock`**, con `layer: true`. Su `data` dice qué reloj es y cómo se ve:
  - **dónde**: nueve sitios (las cuatro esquinas, los bordes al centro y el centro);
  - **tamaño**: pequeño (la hora sutil), mediano o grande (el temporizador «que se vea grande»);
  - **aspecto**: sutil (semitransparente) o normal, con el título encima del número si lo tiene.

  En la proyección se dibuja sobre el fondo de Ajustes, con su letra y sus colores. En una capa va sin fondo, con una sombra suave para que se lea sobre lo claro y lo oscuro (la auditoría ya comprueba el contraste con una diapositiva blanca y una negra detrás).
- **Varios estilos gráficos** (observación del dueño), para elegir en cada reloj. Propuesta de partida, que se le muestra al dueño en una página de prueba antes de construirla: **Sencillo** (solo las cifras, con la letra de Ajustes), **Digital** (cifras de Geist Mono en una pastilla de cristal), **Tarjeta** (el título arriba y el número grande en un recuadro), **Anillo** (un temporizador con un anillo que se vacía) y **Barra** (las cifras con una barra fina que se acorta).
- **Al llegar a cero** (decisión 51): el temporizador **se queda quieto en 0:00**. En los últimos 10 segundos suena un **tictac de reloj** suave; en los últimos 5, más marcado; y al llegar a cero, una **alarma corta, suave y bonita**, nada estridente. Los sonidos los genera Manna en el navegador (Web Audio), sin archivos de terceros; suenan por la pantalla que suena (la regla de una sola) y con el volumen general. Cada temporizador se puede dejar sin sonido.
- **Mandos en vivo**: con un temporizador al aire o en una capa, sus botones (empezar, pausa, reiniciar, +1 min y −1 min) en los mandos y en el cajón «Capas».
- **Orden del culto**: un temporizador se puede añadir al orden, como todo lo proyectable (decisión 4).
- Sin dependencias: la cuenta es la del reloj compartido.

**Pruebas**:
- **Automáticas.** La lógica del reloj en `test/tiempo.test.js`: pausar, seguir, ajustar y pasar de cero. Las órdenes y los permisos, en `servidor.test.js`.
- **En Chrome**: crear, empezar y pausar, y enviar a la proyección y a una capa.
- **Auditoría**: la pantalla nueva y el contraste de la hora en una capa, sobre blanco y sobre negro.

**Tamaño**: M. Va después de la 31; el concurso del sábado no la necesita.

**Decidido (decisión 51)**:
1. Crear y cambiar relojes, solo Control completo (`time.edit`, como Textos); empezar y parar, las funciones que pueden proyectar.
2. La hora en 12 horas con «a. m.» y «p. m.» por defecto, con la opción de 24 horas.
3. Al llegar a cero se queda quieto, con el tictac de los últimos 10 segundos (más marcado en los últimos 5) y una alarma corta y suave al final.
4. Un temporizador proyectado desde el orden del culto empieza solo si está en su principio; si ya corrió, sigue donde iba.

### Fase 33 · Presentaciones sin PowerPoint, con DeckCraft — aprobada la parte 1 (decisión 51), en curso

Pedido del dueño del 2026-10-24: revisar si **DeckCraft** (https://github.com/storytold/deckcraft), de código abierto, puede integrarse en Manna para **reemplazar totalmente la dependencia de Microsoft PowerPoint** y resolver los problemas que ha dado.

**Los problemas de PowerPoint hasta hoy** (`docs/ESTADO.md`):
- **Hace falta PowerPoint instalado**, con su licencia de Office, en el equipo principal.
- **En Windows nunca se ha ejecutado con un PowerPoint real** (S25): ni la conversión ni el pase en vivo, solo con uno de mentira. (La conversión se probó por fin el 2026-10-25, en un Windows de pruebas; el pase en vivo, todavía no.)
- **Puede quedarse colgado o abierto.** Si se cancela una conversión, PowerPoint puede quedarse abierto sin ventana. Si se queda esperando una respuesta suya, Manna corta a los 10 s, pero el pase puede quedarse en el proyector hasta cerrarlo a mano.
- **En Mac** se abre a la vista y pide dos permisos que solo puede aceptar una persona.
- **El pase en vivo es otra ventana encima de la de Manna**:
  - «Señalar» necesita una ventana transparente aparte, sin probar;
  - «Mover» termina el pase y lo vuelve a empezar, así que una animación a medias empieza de nuevo;
  - «Negro» y «Solo fondo» lo terminan;
  - **taparía las capas** de la fase 31.
- **En vivo solo funciona en Windows**, y las diapositivas ocultas salen distinto en Windows y en Mac.

**Qué es DeckCraft** (revisado el 2026-10-24 en su repositorio, versión 0.10.0 del 22 de octubre):
- **Qué es.** Un programa de presentaciones hecho en Rust, con licencia MIT o Apache 2.0: se puede usar y redistribuir llevando su licencia. Abre y guarda `.pptx`, y pasa las presentaciones con transiciones y animaciones.
- **Tres formas**:
  - **Línea de órdenes** (`deckcraft-cli`). Dibuja cada diapositiva en PNG sin ventana y sin tarjeta gráfica (`render archivo.pptx --all --scale S carpeta/`), y con `--transparent`, sin el fondo de la diapositiva. Viene en el `.zip` portátil de Windows (77 MB, sin instalar nada más) y en el `.zip` de Mac (69 MB).
  - **Versión web** (WebAssembly, 10 MB). Dibuja con WebGPU o WebGL2 dentro de una página, se puede incrustar en otra y empieza el pase con `?show`. Abre archivos con la ventana de elegir archivo o soltándolos encima, pero no por una dirección, y otra página no puede saber en qué diapositiva va.
  - **App de escritorio.** Otro programa la maneja por un canal local (JSON en 127.0.0.1): empezar el pase, pulsar teclas y saber en qué va.
- **Es muy joven.** Se creó el 7 de octubre de 2026, está en alfa y saca versión cada dos o tres días. Sus propias carencias (`docs/gaps.md` de DeckCraft):
  - la primera de su lista: solo se ha comprobado con presentaciones hechas por ellos, no comparadas con lo que dibuja PowerPoint;
  - las fuentes, solo en normal, negrita y cursiva; usa las fuentes incrustadas en el `.pptx`, salvo las comprimidas a la manera de Office (MicroType Express), que guarda pero no dibuja;
  - las imágenes SVG no salen;
  - reproduce las 48 transiciones de PowerPoint, pero solo 64 de unos 190 efectos de animación (`docs/animation-parity.md` de DeckCraft);
  - la app de escritorio no arranca con algunas tarjetas gráficas de Windows.

**Qué haría**, por partes. Cada parte se prueba antes de pasar a la siguiente:
- **Parte 1 · Medir la fidelidad** (S, sin cambiar Manna):
  - en este Mac, con el `deckcraft-cli` de su versión de GitHub y PowerPoint al lado, convertir las 9 presentaciones reales que entregó el dueño (`Presentaciones pruebas/`, fuera de git; no se le pasan a Gemini). Revisadas el 2026-10-24: 149 diapositivas, muchas hechas de una imagen; una con transiciones; ninguna con animaciones, diapositivas ocultas, fuentes incrustadas ni videos; fuentes Aptos, Calibri, Arial, Verdana, Arial Rounded, Amasis MT Pro, Cascadia Mono, Nimbus y Bitstream Charter;
  - compararlas diapositiva por diapositiva con lo que saca PowerPoint: texto, fuentes, imágenes y colores, y cuánto tarda;
  - como esas 9 no traen lo difícil, **presentaciones de prueba hechas a propósito** (y abiertas en PowerPoint para comprobar que son válidas) con: una **diapositiva oculta** (¿la salta?), **animaciones de entrada** (¿dibuja todo visible, como hoy, o vacío?), **animaciones poco comunes** que DeckCraft no tiene (la presentación tiene que proyectarse igual, con esos elementos sin animar: si falla entera, no sirve) y **fuentes incrustadas** (tienen que verse con su letra; las que Office guarda comprimidas se prueban con una presentación que el dueño haga en el PowerPoint de Windows);
  - el resultado es una tabla de lo que sale bien y lo que no. Si sale mal, aquí se para; lo que falle se le reporta a DeckCraft con una presentación inventada.
- **Parte 2 · Convertir sin PowerPoint** (M):
  - **Un programa más del equipo principal**, como ffmpeg o yt-dlp (`server/core/tools.js`). Manna lo descarga de la versión de GitHub y comprueba su huella (`SHA256SUMS.txt`); en Windows guarda solo `deckcraft-cli.exe`. Se usa una versión fija, probada, que se cambia a mano tras probar la nueva.
  - **Convierte DeckCraft.** Un `.pptx` se convierte en una imagen por diapositiva y su miniatura, sin abrir ventanas ni pedir permisos, y sale igual en Windows y en Mac.
  - **Pruebas**: la prueba en Chrome sube un `.pptx` de verdad, fabricado en el momento y liviano, y DeckCraft lo convierte de verdad; un Windows de GitHub lo convierte también en cada versión.
- **Parte 3 · Pase con animaciones dentro de Manna** (L):
  - **Dentro de la proyección.** La versión web de DeckCraft va dentro de la propia ventana de proyección de Manna, como el marco de una página web.
  - **Lo que se gana.** Las animaciones y transiciones se ven en la ventana de Manna, **debajo de las capas**. «Señalar», «Mover», «Negro» y «Solo fondo» funcionan como en cualquier contenido, en Windows y en Mac. Los celulares siguen viendo la imagen de cada diapositiva.
  - **Lo que le falta a DeckCraft.** El archivo quizá se le pueda dar soltándolo encima, como hace una persona, pero falta que Manna le diga «siguiente», «anterior» e «ir a» y sepa en qué diapositiva va. Se le propone a DeckCraft como mejora (es de código abierto); si no la aceptan, Manna lleva una copia propia, compilada en GitHub como el `.exe` del instalador.
  - **Empieza con una prueba de concepto** en el equipo de la iglesia, para ver si su tarjeta gráfica mueve las animaciones con fluidez.
  - **Con esto se quita PowerPoint en vivo** (`server/modules/slides/powerpoint.js`).
- **No recomendado**: manejar la app de escritorio de DeckCraft en vivo, como hoy se maneja PowerPoint. Sería otra ventana encima, que taparía las capas, y no arranca con algunas tarjetas gráficas.

| Problema de hoy | Parte 2 (convertir) | Parte 3 (en vivo) |
| --- | --- | --- |
| Hace falta PowerPoint y su licencia | Resuelto | Resuelto |
| Se queda abierto o colgado; permisos en Mac | Resuelto (un programa sin ventana) | Resuelto |
| Otra ventana encima: tapa las capas, «Señalar» y «Mover» a medias | — | Resuelto |
| En vivo solo en Windows | — | Resuelto (también en Mac) |
| Sin probar en un Windows real | Lo prueba un Windows de GitHub en cada versión | La prueba de concepto en el equipo de la iglesia |

**Riesgos**:
- **Fidelidad**: es lo que mide la parte 1, y por eso va primero.
- **Juventud del proyecto**: cambia mucho entre versiones. Por eso Manna fija una versión probada.
- **Tamaño**: 77 MB en Windows.
- **Fuentes**: si el equipo no tiene las de la presentación, se sustituyen, igual que en PowerPoint.
- **Rendimiento** de la versión web en el equipo de la iglesia: lo mide la prueba de concepto.

Mientras tanto, **un PDF sigue funcionando siempre**, sin nada instalado.

**Tamaño**: L en total (S + M + L). Va después de la 32; la parte 1 se puede hacer en cuanto el dueño entregue las presentaciones.

**Parte 1 · resultados (2026-10-24)**, en este Mac con `deckcraft-cli` 0.10.0 frente al PowerPoint 16 del Mac (el informe y las comparaciones quedaron fuera del repositorio):
- **Las 9 presentaciones (149 diapositivas)**: 93 idénticas a la vista, 54 con diferencias leves y **2 graves**: el texto de un cuadro que se ajusta a su contenido (`spAutoFit`) ocupa más líneas que en PowerPoint y pisa el cuadro de al lado o queda bajo una foto. La causa no está confirmada (no es el encogimiento guardado, `normAutofit`, que esas diapositivas no usan): se busca con un ejemplo inventado en la parte 2.
- **Tiempo**: 12,6 s en total, frente a 41 s de PowerPoint (más lo que tarda sacar las imágenes de su PDF), sin abrir ninguna aplicación.
- **Leves, casi todas por fuentes**:
  - Aptos sale como Inter, que mide distinto, y una fuente de la nube de Microsoft (Amasis) cae en otra. DeckCraft usa las de Office donde Office las instaló (el equipo de la iglesia las tiene); en este Mac no las encontró.
  - Las viñetas con símbolo («❑») salen como punto cuando la presentación pide una fuente de símbolos que el equipo no tiene (`Noto Sans Symbols`, habitual en lo que viene de Google Slides); con la fuente, salen bien.
- **Colores**: DeckCraft da los del archivo; el camino de PowerPoint a PDF los desatura un poco.
- **Los cuatro casos de prueba**, con presentaciones inventadas:
  - **(a) Diapositiva oculta**: `render --all` la dibuja (PowerPoint la salta). Manna la saltará leyendo `info`.
  - **(b) Animaciones de entrada**: dibuja los elementos visibles, como hasta ahora.
  - **(c) Efectos que DeckCraft no tiene**: la presentación se abre y se dibuja igual, sin error (requisito del dueño cumplido), y al guardarla los conserva.
  - **(d) Fuente incrustada**: la dibuja con su letra si va como TrueType o como EOT. Falta la que guarda el PowerPoint de Windows, comprimida: el dueño hará una allí.
- **Windows**: su `.zip` portátil trae `deckcraft-cli.exe` (`packaging/windows/package.ps1` de DeckCraft); falta probarlo en Windows.
- **Conclusión: la parte 2 es viable.** Las dos diapositivas graves piden ver la vista previa antes de proyectar, mientras DeckCraft no lo resuelva.
- **Propuesto a DeckCraft el 2026-10-24** (decisión 52), cada cosa comprobada antes con su programa y con ejemplos inventados:
  - saltar las diapositivas ocultas al dibujarlas y pedir el ancho en píxeles: https://github.com/storytold/deckcraft/issues/1346;
  - dibujar la viñeta con otra fuente cuando falta la suya, en vez de un punto: https://github.com/storytold/deckcraft/issues/1347;
  - para la parte 3, poder empezar el pase en una diapositiva, darle «siguiente», «anterior» e «ir a» y saber en qué diapositiva y paso va (comentario en la propuesta de manejar la versión web desde la página que la contiene, que ya tiene un cambio en curso): https://github.com/storytold/deckcraft/issues/714;
  - el programa de órdenes para Windows suelto, sin la app (comentario): https://github.com/storytold/deckcraft/issues/100.

  No se propuso lo de los dos cuadros pisados (falta la causa) ni lo de Aptos (DeckCraft ya usa la de Office cuando está).

**Parte 3 · prueba de concepto (2026-10-25)**, en este Mac con la versión web de DeckCraft 0.10.0 (10 MB) dentro de una página de prueba, sin cambiar DeckCraft:
- carga en menos de un segundo, abre la presentación que la página le da desde fuera (soltándosela encima, con eventos del navegador) y empieza el pase con F5;
- cada «Siguiente» (la flecha, enviada desde fuera) hace aparecer el elemento que toca, con su animación de entrada (Aparecer, Desvanecer, Desplazar hacia dentro);
- **pero en una sola ventana muestra la vista del presentador** (la opción «Usar vista del presentador» va encendida y solo se apaga desde su cinta o con su orden `show.presenter`), y **desde fuera no se puede saber en qué diapositiva ni en qué paso va**.

El cambio pendiente en DeckCraft que deja manejar la versión web desde la página que la contiene (su PR 983: abrir una presentación desde la página y darle órdenes) resolvería la vista del presentador; pasar de diapositiva y saber en cuál va es lo que se les pidió en la 714. **El dueño decidió esperar su respuesta (2026-10-25)**; si no aceptan en una o dos semanas, el camino B (decisión 52).

**Requisitos del dueño** (decisión 51):
- Una animación que DeckCraft no tenga no puede hacer fallar la presentación: se proyecta igual, con ese elemento sin animar.
- Las fuentes incrustadas en la presentación tienen que verse bien. Si alguna no se puede dibujar (las que Office guarda comprimidas), Manna lo dice y nombra la fuente, y se busca cómo resolverlo (proponer a DeckCraft que las lea, o instalar la fuente en el equipo).

**Decidido (decisión 51)**:
1. DeckCraft: la medición (parte 1), ya; como programa del equipo principal, cuando la medición salga bien.
2. PowerPoint se quita del todo cuando DeckCraft pase la prueba en el equipo de la iglesia. Hasta entonces sigue como está.
3. Compilar en GitHub una copia propia de la versión web de DeckCraft (camino B): **sí, solo si sus autores no aceptan la mejora en una o dos semanas** (decisión 52). Primero se les propuso (arriba).
4. Las presentaciones de la medición son las 9 de `Presentaciones pruebas/`.

### Fase 34 · Versículos en una capa y la barra de capas al estilo Dynamic Island — hecha (1.40.0)

Pedido del dueño del 2026-10-24, rehecho el 2026-10-25 (decisión 54) al planearla en detalle:
- **Las capas no se tocan desde el orden del culto**: solo desde el cajón «Capas» y desde la barra de capas de abajo (decisión 53). Sale de la fase lo de «Encender capa» y «Apagar capa» como pasos del orden.
- **Versículos en una capa, con fondo**: a pantalla completa, como al proyectarlos (con el fondo y la letra de Ajustes), encima de lo que está al aire. Para cuando hay una presentación del predicador: el versículo la tapa un momento y, al quitar la capa, se ve de nuevo donde iba. Lo que está al aire no cambia, así que el Presentador sigue igual. Se pone con «Capa», junto a «Proyectar», en la Biblia.
- **La barra de capas de abajo, al estilo Dynamic Island**: la ficha de cada capa toma la forma de lo que tiene (la hora, en vivo; una página, su nombre; un versículo, su cita). Con un temporizador o un cronómetro, a su lado se desprende una burbuja con la cuenta en vivo y sus botones (empezar o pausar, volver al principio y, el temporizador, +1 min). La hora no lleva botones.

**Partes**: 1, versículos en una capa; 2, la barra al estilo Dynamic Island. **Tamaño**: M.

### Fases 35 a 39 · Manna Iglesia: preparar desde casa, y para varias iglesias — aprobadas (decisión 55)

Pedido del dueño del 2026-10-25: preparar el culto (órdenes, himnos, citas, videos) sin esperar a encender el servidor de la iglesia, y que Manna sirva a otras iglesias sin ir a instalarlo en persona. **El culto sigue sin depender de internet**: el equipo oficial de cada iglesia funciona igual sin conexión.

**Cómo queda**
- **Un subdominio por iglesia**, que crea el dueño (Nueva Vida: `nv.manna-iglesia.es`). Su portada sabe si el equipo oficial de esa iglesia está encendido:
  - encendido: lleva a él, por la red local si la persona está en la iglesia, o desde fuera por el túnel de Cloudflare si esa iglesia lo activó;
  - apagado: lo dice y ofrece `/preparacion`.
- **`/preparacion`**: los usuarios de esa iglesia preparan sus órdenes y escuchan los himnos.
- **Un solo equipo oficial por iglesia.** Instalar en otro equipo avisa de que el primero dejará de recibir lo preparado; si se confirma, el nuevo pasa a ser el oficial y el anterior queda inhabilitado, salvo que vuelva a reclamarse.
- **Instalar desde el subdominio**: el instalador sale emparejado con esa iglesia; luego Manna instala ffmpeg, yt-dlp y DeckCraft como hoy. El himnario completo en el equipo es opcional.
- **El himnario y las biblias, en Cloudflare R2** (gratis hasta 10 GB y sin coste por descargas), con enlaces que caducan y solo para iglesias con ingreso, y la nota «uso y estudio personal, investigación y pruebas; no comercial».
  - En la iglesia, un himno se baja al momento a una carpeta temporal que se vacía sola, y los del orden se bajan por adelantado al sincronizar.
  - Las biblias se bajan siempre al equipo (66 MB).
- **Solo en el equipo de cada iglesia**: lo subido desde el computador o el celular, y lo bajado de YouTube. En la nube, un video de YouTube va solo como enlace (YouTube bloquea las descargas desde servidores) y se baja al encender el servidor de la iglesia.
- **Copias de seguridad** de la nube en Google Drive (cuenta de Los Ríos Multimedia).
- **Usuarios**:
  - el **superadministrador** de todo Manna Iglesia (`admin.manna-iglesia.es`): iglesias, administradores, usuarios y métricas;
  - el **administrador de cada iglesia**: ve, edita y borra todos los órdenes de su iglesia, y gestiona sus usuarios;
  - los **usuarios**, con nombre y PIN: ven y editan solo sus órdenes. Cada orden tiene un dueño: sin copias ni conflictos.

  En el equipo oficial, el Control completo entra sin PIN como el administrador de la iglesia; la proyección y los televisores, sin ingreso.
- **La nube corre en el hosting de Hostinger del dueño** («Unlimited Web Hosting», con Node.js). Primero, una **prueba de un día**:
  - que aguante la conexión en vivo (SSE);
  - que los datos sobrevivan a una actualización del programa;
  - que deje subir archivos grandes;
  - que varios subdominios lleguen a la misma aplicación.

  Si algo falla, o cuando haya varias iglesias, un VPS pequeño. Crear el sitio es un paso hacia fuera: se hace con el permiso del dueño.
- **Una iglesia de pruebas**, `pruebas.manna-iglesia.es`, con sus propios usuarios y su propio equipo oficial (otro equipo del dueño), para probar sin tocar el equipo oficial de Nueva Vida (decisión 57).
- **La misma versión en todas partes** (decisiones 57 y 58):
  - en la nube, un solo programa para todas las iglesias, así que una actualización las pone al día a todas;
  - el equipo oficial de cada iglesia **se actualiza solo al encender el servidor**, antes de abrirse (16 s en el Windows de pruebas), y nunca mientras está encendido, para no cortar un culto;
  - la nube no sincroniza con un equipo de una versión anterior.
- **El administrador de cada iglesia entra en línea** (`nv.manna-iglesia.es/administrar`) con **usuario y contraseña**, aunque el servidor de la iglesia esté apagado, y crea, cambia o quita los usuarios de su iglesia (decisión 57). Los usuarios viven en la nube; el equipo de la iglesia guarda una copia para dejar entrar sin internet.

**Prueba del hosting, hecha el 2026-10-25** en `nv.manna-iglesia.es` (plan Business de Hostinger, Node.js 24, LiteSpeed), con una aplicación mínima que medía lo que necesita Manna:

| Qué | Resultado |
| --- | --- |
| Procesos | Uno por subdominio: 10, 40 y 60 peticiones a la vez las atendió el mismo proceso. Un segundo subdominio de la misma aplicación (dominio aparcado) tiene su propio proceso. |
| Conexión en vivo (SSE) | 3,5 minutos sin cortes: 104 eventos, uno cada 2 s, que llegaron cada 1,9 a 2,1 s (sin acumularse), con 0,1 a 0,2 s de retraso. |
| Quién llama | El hosting pasa la IP de quien llama (`X-Forwarded-For`) y entrega desde 127.0.0.1: Manna lo trata como de internet y pide PIN. |
| Datos | En una carpeta fuera del programa (`MANNA_DATA`), sobreviven a un despliegue nuevo. |
| Subidas | Archivos de 50 y 300 MB, enteros. |
| Sin uso | Tras 10 minutos sin visitas, el mismo proceso seguía vivo y contestó en 0,4 s. |
| Certificado | El hosting lo da solo a cada subdominio que apunta a él (en Cloudflare, sin el proxy). |

Lo que la fase 36 tiene que resolver en Manna:
- **Cómo carga el hosting la aplicación.** LiteSpeed la carga con `require()`, y Manna es un módulo con espera al cargar: hace falta una entrada que lo abra con `import()`.
- **Cómo abre el puerto.** Espera que la aplicación abra un servidor `http` en sus primeros 3 s, y Manna abre el suyo propio, que atiende `http` y `https` a la vez. En «modo nube» debe abrir un servidor `http` corriente (el hosting ya pone el `https`).
- **El arranque.** Al arrancar, Manna se cierra si ve otro Manna suyo abierto, y en un despliegue el hosting arranca dos procesos casi a la vez: en «modo nube» eso no debe cerrarlo.
- **Los datos de cada iglesia.** Como cada subdominio tiene su proceso, cada iglesia tiene su carpeta de datos y solo su proceso la escribe; el superadministrador habla con cada iglesia por su dirección, sin escribir en sus datos.

**Fases** (cada una se planea en detalle al llegar)
- **35 · Usuarios y el Orden rehecho** (L), en local, sin nube (decisión 59 para cómo se entra, el orden sin nombre, la cola y Ajustes):
  - usuarios con nombre y PIN, el administrador de la iglesia y cada orden con su dueño;
  - el cajón Orden con los guardados por semana (esta semana arriba, las anteriores debajo, y borrar los que ya no sirven) y una pestaña Favoritos para los que se repiten;
  - sale el «Mapa del culto».
- **36 · La nube de la iglesia** (L):
  - la prueba del hosting;
  - Manna en «modo nube» (sin proyección, sin programas del equipo, sin anunciarse en la red y siempre con ingreso), en `nv.manna-iglesia.es/preparacion`;
  - el himnario y las biblias en R2;
  - YouTube por enlace.
- **37 · Sincronización y equipo oficial** (L):
  - emparejar al instalar;
  - el equipo oficial y el aviso del segundo;
  - sincronizar usuarios, órdenes y biblioteca: de fondo y en vivo mientras los dos están encendidos, sin que la iglesia espere nunca a la nube;
  - la portada del subdominio.
- **38 · El himnario en línea en la iglesia y los archivos** (M):
  - bajar por adelantado los himnos del orden, con la carpeta temporal, y el himnario completo como opción;
  - los archivos que van y vienen, en cola por prioridad y con descargas que se reanudan;
  - las copias en Drive.
- **39 · Superadministrador** (M): iglesias, administradores, usuarios y métricas; el máximo de órdenes de cada iglesia (20 por defecto, `limit` de su `data/orden.json`; decisión 61).


#### Fase 36 · La nube de la iglesia

**Plan detallado (aprobado por el dueño el 2026-10-25)**

**Meta**: el mismo programa, en «modo nube», primero en `pruebas.manna-iglesia.es` y después en `nv.manna-iglesia.es` (decisión 58). Los usuarios de la iglesia entran con su nombre y su PIN y, en `/preparacion`, preparan sus órdenes y escuchan los himnos con el servidor de la iglesia apagado. Lo preparado llega al equipo de la iglesia en la fase 37 (sincronización); hasta entonces la nube funciona sola. El modo de siempre, en el equipo de la iglesia, no cambia.

**Partes**, cada una con sus pruebas y publicada al cerrarla:

1. **Modo nube** (`MANNA_NUBE=1`):
   - una entrada `server/inicio.cjs`, porque LiteSpeed carga la aplicación con `require()` (en la prueba del hosting funcionó así);
   - un servidor `http` corriente en el puerto que da el hosting, que pone él el `https`; sin los puertos 80, 8000 y 443 ni el certificado propio;
   - sin «Manna ya está abierto» ni «un solo Manna a la vez»: al desplegar, el hosting arranca dos procesos casi a la vez;
   - sin lo que es del equipo de la iglesia: la proyección y su ventana, los televisores, el túnel, el nombre en la red (mDNS), los programas del equipo (ffmpeg, yt-dlp, DeckCraft, PowerPoint, el navegador), la revisión del equipo, y apagar, reiniciar y actualizar;
   - **nadie es «el equipo principal»**: toda petición pide ingreso, también la que llegue sin cabeceras de reenvío;
   - cada iglesia con su carpeta de datos (`MANNA_DATA`), fuera de `public_html`, que sobrevive a los despliegues.
2. **`/preparacion`**, una función para preparar desde casa, sin escenario ni proyección, en **cinco pestañas** (decisión 62): Orden, Biblia, Himnario, Medios y Textos, cada una a pantalla completa (en el celular, abajo; en el computador, a la izquierda):
   - el Orden (los suyos, por semanas y con Favoritos; el administrador, todos);
   - la Biblia y el Himnario, para añadir al orden, y escuchar un himno antes de añadirlo;
   - Medios: un video de YouTube **por su enlace**, que se descarga en la iglesia (fase 37 o 38), porque YouTube bloquea las descargas desde servidores; la biblioteca de la iglesia, con la sincronización (fase 37);
   - Textos: escribir los mensajes y las citas, como en el Control completo;
   - de momento, la portada del subdominio lleva a `/preparacion`; la que sabe si el equipo de la iglesia está encendido es de la fase 37.
3. **El himnario y las biblias en R2**:
   - un depósito privado con los videos del himnario, sus letras y diapositivas, y las biblias (hoy, unos 5,9 GB: dentro de los 10 GB gratis);
   - se sube desde este Mac con un guion propio (`scripts/subir-r2.mjs`: la firma de R2 hecha a mano con `node:crypto`, sin dependencias, y solo lo que falta);
   - la nube guarda en su carpeta de datos las biblias y las letras, que pesan poco y le hacen falta para buscar; los videos los sirve R2 con **enlaces que caducan** (firmados por el servidor, una hora), solo a quien entró;
   - la nota «uso y estudio personal, investigación y pruebas; no comercial», en el Himnario de `/preparacion` y en el depósito.
4. **El administrador en línea** (decisión 57): `/administrar`, con usuario y contraseña (guardada con `scrypt`), para crear, cambiar o quitar los usuarios de su iglesia aunque el servidor de la iglesia esté apagado. El primero entra con una **clave de alta** de un solo uso que el dueño pone en las variables del sitio (`MANNA_CLAVE_ALTA`, decisión 62): con ella crea el administrador con su nombre, su PIN (para preparar el culto) y su contraseña, y entra. Los usuarios viven en la nube; el equipo de la iglesia los recibirá en la fase 37.
5. **Lo que dejó la auditoría, antes de abrir a internet** (decisión 60):
   - al servir archivos, no seguir un enlace simbólico que salga de su carpeta;
   - Páginas web no acepta direcciones del propio equipo ni de la red local (en la nube no hay Páginas web);
   - en la nube no se sube nada (lo subido es de cada iglesia), así que ahí ya no importa el video aceptado por su extensión;
   - las cookies, con `Secure` detrás del `https` del hosting.
6. **Desplegar**: `scripts/desplegar.mjs` arma el paquete (solo lo que la nube necesita) y lo sube con el conector de Hostinger, primero a `pruebas.manna-iglesia.es` y, cuando pase, a `nv.manna-iglesia.es`. Cómo se hace y lo que se aprenda queda en una regla nueva, `.claude/rules/nube.md`.

**Pruebas**:
- automáticas: el modo nube (nadie entra sin ingreso por ser local, sin programas ni proyección, solo `http`), la firma de R2 contra los ejemplos oficiales de AWS, y los permisos de `/preparacion` y `/administrar`;
- en Chrome, un grupo «nube»: entrar como usuario, preparar un orden, buscar un himno y escucharlo, con un R2 de mentira en este equipo;
- la auditoría de `/preparacion` y `/administrar` en sus tamaños;
- y de verdad, en `pruebas.manna-iglesia.es`, desde un celular y desde el PC de Leidy.

**Sin probar al cerrarla**: muchas iglesias a la vez y más de 10 minutos sin visitas (se verá con el uso).

**Lo que hace falta del dueño antes de empezar**:
- **Activar R2** en Cloudflare: pide una tarjeta en la cuenta aunque no cobre por debajo de 10 GB; eso solo lo puede hacer él. Después, permiso para crear el depósito y su clave de acceso.
- **Permiso para crear `pruebas.manna-iglesia.es`** (el sitio en Hostinger y su registro en Cloudflare).

#### Fase 37 · Sincronización y equipo oficial

**Plan detallado aprobado el 2026-10-25** (decisión 63, con las decisiones A a D al final).

**Meta**: lo que se prepara en la nube llega al equipo oficial de la iglesia y lo de la iglesia llega a la nube, sin que el culto dependa nunca de internet. Cada iglesia tiene un solo equipo oficial. La portada del subdominio sabe si está encendido.

**Cómo se hablan**: el equipo de la iglesia está detrás del router de la iglesia y la nube no puede llamarlo; por eso **siempre llama él**.
- Al encenderse, y mientras tiene internet, abre una conexión en vivo con la nube (la misma de siempre, SSE, con la clave del equipo) y le envía sus cambios; la nube le devuelve los suyos por esa conexión. Con los dos encendidos, un cambio llega al otro lado en uno o dos segundos.
- Sin internet, el equipo sigue igual que hoy y apunta lo que cambió; al volver la conexión, se ponen al día.
- La iglesia **nunca espera** a la nube: todo se guarda primero en el equipo y se envía después, en segundo plano.

**Partes**, cada una con sus pruebas y publicada al cerrarla:
1. **Emparejar el equipo con su iglesia** (decisión A): en `/administrar`, «Emparejar un equipo» da un código de 6 cifras que dura 10 minutos; en el equipo, Ajustes → «Nube» pide la dirección (`nv.manna-iglesia.es`) y el código. Con eso la nube le da una clave propia del equipo, que se guarda en sus datos y nunca se muestra. Ajustes dice desde entonces con qué iglesia está emparejado, si está conectado y cuándo se puso al día.
2. **El equipo oficial** (decisión D): emparejar un segundo equipo avisa de que el primero quedará bloqueado; si se confirma, el nuevo pasa a ser el oficial. El anterior, en cuanto se conecta a la nube, queda **bloqueado** como cuando hay otro Manna en la red (decisión de la fase 21): lo dice en todas sus pantallas, no proyecta y no acepta órdenes, salvo apagarse y «Volver a ser el equipo oficial», que pide otro código. Sin internet no se entera y sigue funcionando.
3. **Usuarios** (decisión B): viven en la nube y el equipo guarda una copia para dejar entrar sin internet. Emparejado, Ajustes → Usuarios los muestra y lleva a `/administrar` para cambiarlos. La primera vez que un equipo se empareja, sus usuarios suben a la nube: el que se llama como uno de la nube pasa a ser ese, con sus órdenes, y los demás entran tal cual (para no perder a nadie).
4. **Órdenes, textos y favoritos del himnario** (decisión C): van en los dos sentidos. Cada orden y cada texto lleva quién lo cambió y cuándo; lo borrado deja una marca para que no vuelva. El máximo de órdenes (20) cuenta los de los dos lados. El orden en uso en la cola sigue siendo cosa de la iglesia.
5. **La biblioteca de la iglesia en la nube**: la lista de imágenes, videos, audios y presentaciones del equipo, con sus categorías y sus miniaturas pequeñas, sube a la nube; en `/preparacion`, Medios la muestra para añadirla al orden (los archivos siguen en la iglesia; la fase 38 los hará ir y venir). Un video de YouTube añadido por su enlace en la nube se descarga en el equipo al recibirlo, y en el orden pasa a ser el video de la biblioteca.
6. **La portada del subdominio**: si el equipo oficial está conectado, ofrece entrar en él: por la red de la iglesia si quien abre la portada sale a internet por la misma dirección que el equipo (están en la misma red), y si no, por la conexión por internet de esa iglesia si está encendida. Si está apagado, lo dice y lleva a «Preparar el culto».
7. **La misma versión** (decisiones 57 y 58): el equipo oficial se pone al día solo al encenderse, antes de abrir (como «Actualizar ahora», sin preguntar), y nunca con Manna abierto. La nube y el equipo solo sincronizan si hablan la misma versión del «idioma» de la sincronización; si no, el equipo lo dice y sigue en local. Desplegar la nube pasa a ser un paso de cada versión (`/publicar`).

**Pruebas**:
- automáticas, con un equipo y una nube de verdad en el mismo proceso de prueba: emparejar, el código caducado o equivocado, el segundo equipo, los usuarios sin internet, un orden cambiado en los dos lados sin conexión, lo borrado, el máximo de 20, la versión distinta;
- en Chrome, un grupo «nube» con los dos servidores: preparar un orden en la nube y verlo llegar a la cola del equipo, y al revés; cortar la conexión y volver;
- y de verdad, en `pruebas.manna-iglesia.es` con el PC de Leidy como equipo oficial.

**Sin probar al cerrarla**: muchas iglesias a la vez y cortes de internet largos de verdad (se verá con el uso).

**Decisiones que pide al dueño**:
- **A · Cómo se empareja.** Recomendado: un código de 6 cifras que da `/administrar` y se escribe en Ajustes del equipo. La otra opción del plan general, un instalador que sale ya emparejado desde el subdominio, pide armar un instalador distinto por iglesia; se puede añadir después.
- **B · Dónde se cambian los usuarios.** Recomendado: emparejado, solo en `/administrar` (en el equipo se ven, pero no se cambian), para que nunca haya dos versiones de un mismo usuario. La otra: en los dos sitios, ganando el último cambio.
- **C · Un orden cambiado en los dos lados sin conexión.** Recomendado: gana el último cambio, y su dueño ve un aviso de que había otra versión. La otra: guardar las dos (contra «sin copias», decisión 55).
- **D · El equipo anterior al cambiar de oficial.** Recomendado: sigue funcionando en local, sin recibir nada y con su aviso, y puede volver a ser el oficial. La otra: bloquearlo hasta que se vuelva a emparejar. **Elegida: bloquearlo** (decisión 63).

#### Tras probar la nube: cuatro partes (decisión 64, 2026-10-25)

El dueño probó `pruebas.manna-iglesia.es` con la 1.48.0 y pidió estos cambios. Se hacen en este orden; cada parte se publica y se despliega en `pruebas` al cerrarla.

1. **Arreglos de Preparar y del administrador**. **Hecha en la 1.49.0**:
   - el nombre del orden, junto a «Orden del culto», se escribe ahí mismo y se guarda solo al terminar (al salir del campo o con Intro; Esc deja el de antes). Ya no lleva a la pestaña Órdenes;
   - el nombre que se propone es «Orden <quien lo crea> <el día en que lo crea>» («Orden Ana 25 de oct.»);
   - el administrador de la iglesia entra a `/administrar` con su PIN, el mismo de Preparar: sale la contraseña. La clave de alta se pide solo la primera vez, con su nombre y su PIN;
   - en Preparar, un himno se añade con pista aunque allí no se pueda oír (la nube no tiene ffmpeg); el equipo de la iglesia lo proyecta con la pista. No se suben las pistas a R2.
2. **Instalar Manna en el equipo principal desde la nube** (adelanta parte de la fase 38). **Hecha en la 1.50.0**:
   - en la portada de la nube, en un computador, «Instalar Manna en este equipo», con el PIN de un administrador; en celular y tableta, solo Preparar y Administrar;
   - si ya hay otro equipo oficial, primero el aviso de que quedará bloqueado;
   - el himnario: **desde la nube** (los himnos del orden se bajan antes del culto; otro, al momento, con internet) o **completo en el equipo** (cantados, pistas, letras y diapositivas, unos 6 GB, en segundo plano y siguiendo donde iba si se corta). Se elige al instalar y se ve y se cambia en Ajustes → Nube; las biblias y las letras se bajan siempre;
   - el instalador de Windows o de Mac sale emparejado con la iglesia (el código va en el nombre del archivo y dura 24 h): al terminar, Manna se abre como el equipo oficial, sin escribir códigos (es la opción del instalador emparejado que la decisión 63 dejó para después);
   - ya instalado, en ese computador la portada ofrece «Abrir Manna» (un enlace `manna://` que registra el instalador) y «Instalar» sale deshabilitado. Lo sabe porque ese navegador recuerda que instaló desde ahí y la nube confirma que ese equipo sigue siendo el oficial; en otro navegador volvería a ofrecer instalar (instalar encima solo actualiza).
3. **El superadministrador** (fase 39), en `admin.manna-iglesia.es` (permiso del dueño dado):
   - entra con **contraseña** (no con PIN), la primera vez con una clave de alta;
   - de cada iglesia muestra si responde, su versión, su equipo oficial y su última sincronización, usuarios, órdenes, espacio usado y último uso;
   - por iglesia controla: **activarla o suspenderla** (suspendida, no deja entrar en su nube ni sincroniza; el culto en su equipo sigue), **los módulos que puede usar** (su administrador reparte entre sus usuarios solo esos), **los archivos que se suben desde casa y su espacio** (5 GB al empezar) y **el máximo de órdenes** (20). Y **recuperar el acceso** de su administrador (una clave de alta nueva). El himnario de la nube no se apaga por iglesia;
   - **el espacio del plan**: el total, lo repartido entre las iglesias y lo que queda libre con un margen de seguridad; no deja repartir más de lo que hay;
   - **ordenar la interfaz** (lo de la fase 41): el orden de los módulos en el dock y en las pestañas de cada función, y cuál se abre primero. Los mandos de dentro de cada pantalla (Proyectar, el transporte, la cola) no se mueven: romperían el diseño en celular y tableta;
   - cada sitio lleva la clave del superadministrador en sus variables (`MANNA_CLAVE_SUPER`, la pone el dueño); crear un subdominio sigue siendo un paso del asistente en Hostinger, con permiso.
4. **Fotos, videos y presentaciones desde casa** (fase 37, parte 5, y fase 38): en Preparar → Medios, la misma biblioteca del Control (imágenes, videos, audios, PowerPoint y PDF) y YouTube por enlace. Lo subido se guarda en la nube de la iglesia y el equipo lo baja solo al estar encendido, primero lo que está en un orden; la biblioteca del equipo sube a la nube con sus categorías y miniaturas. Imágenes y PDF quedan listos al momento; los videos se ven tal cual se subieron (la copia ligera la hace el equipo); el PowerPoint se convierte en la iglesia al llegar.

**Versiones** (decisiones 58 y 64): todo se prueba primero en `pruebas` y, con la autorización del dueño, se despliega igual en las demás iglesias (hoy, `nv.manna-iglesia.es`). Manna llega a `nv` cuando pase la prueba de instalar en `pruebas`.

Después de estas cuatro partes siguen la 6 y la 7 de la fase 37 (la portada que sabe si el equipo está encendido y la misma versión) y las copias en Drive de la fase 38.

### Fase 40 · Investigación desde cero: funciones especializadas para el celular — en pausa hasta que lo diga el dueño (decisiones 56 y 60)

Decisión 56. El encargo de la fase 19 (cancelada), hecho **otra vez desde cero** cuando el dueño lo pida. No tiene fecha ni va antes de ninguna otra fase.

- En el celular, en vez de entrar a «Control completo», funciones especializadas, una por necesidad, con pocas cosas en pantalla: qué funciones habría, qué puede y qué no puede cada una, qué tiene en pantalla y cómo se usa, pensando en la experiencia y no solo en la interfaz.
- **Sin partir de la propuesta cancelada** ni de cómo esté repartida la app en ese momento. Sí se tiene en cuenta lo que Manna haga entonces: desde la fase 19 llegaron, entre otras, las capas, Tiempo y los órdenes guardados, y con las fases 35 a 39 llegarán los usuarios y la preparación en la nube.
- Entrega: un documento con la propuesta y las decisiones del dueño. No cambia la app: lo que se apruebe entra como fases nuevas.

### Fase 41 · Organizar la interfaz desde el superadministrador — idea al plan, se planea después de la 39 (decisión 60)

Idea del dueño del 2026-10-25 (I5, de la antigua bandeja de ideas). Depende de la fase 39 (superadministrador) si se hace desde la nube. Se planea en detalle al llegar, con lo que haya entonces.

**Qué**: una pantalla del superadministrador para organizar la interfaz de Manna:
- el orden de los módulos del dock (a la izquierda; abajo en el celular);
- qué elementos quedan siempre en pantalla, como la barra de arriba, la barra de abajo o la cola del culto;
- en qué orden van esos elementos;
- cómo se presenta cada botón o función fija: una versión más resumida (solo el icono) o una un poco más extensa (el icono con su nombre o su detalle).

**Lo que ya hay**:
- El orden del dock es el de la lista `MODULES` de `web/modules/registry.js`, y cada función elige sus módulos en `web/roles/`. Está fijo en el código.
- Lo que está siempre en pantalla lo colocan `web/core/shell.js` y `web/modules/projection/escenario.js`:
  - la barra de arriba: la marca, «Solo fondo» y «Negro», «Al aire», el proyector, «Buscar en todo», el wifi y el QR;
  - el dock y la cola del culto;
  - la barra de abajo: Anterior, Siguiente, los mandos, el volumen y «Más mandos».
- Ya hay versiones resumidas y extensas de varios botones (solo el icono en el celular, con su nombre en el escritorio), y lo que no cabe va a «Más mandos». Hoy lo decide el ancho de la pantalla, no una elección.
- Cada dispositivo guarda sus preferencias en `prefs` (el tamaño de la interfaz, el ancho del cajón). Lo que vale para todos vive en el servidor.

**Por decidir**:
- **A quién se aplica**: lo que elige el superadministrador, ¿vale para todas las iglesias (el diseño de partida), o cada iglesia o su administrador puede cambiarlo después? ¿Cada función (Alabanza, Control del orden) tiene el suyo?
- **Una iglesia sin nube**: el superadministrador vive en la nube (`admin.manna-iglesia.es`) y la iglesia recibiría el diseño al sincronizar. ¿Qué ve una iglesia que no usa la nube?
- **Cómo se organiza**: ¿arrastrando sobre una vista previa de la interfaz, o en una lista?
- **Qué se puede quitar**: `DESIGN.md` garantiza en cualquier pantalla ver qué está al aire, avanzar y retroceder, y llegar a la acción principal sin desplazarse, con 35 px para el dedo. La pantalla no debería dejar elegir una disposición que rompa eso: «Al aire», Anterior y Siguiente no se quitarían.
- **Las variantes de cada elemento**: ¿dos (resumida y extensa) o tres? Si se elige la extensa y en el celular no cabe, ¿pasa sola a la resumida, como hoy?
- **Volver atrás**: un botón «Volver al diseño original».

**Cuidado**: cada combinación es una pantalla más que la auditoría tiene que revisar en sus 10 tamaños. Conviene un número cerrado de opciones (pocas variantes por elemento, órdenes que se pueden probar) antes que una libertad total que nadie haya visto en un celular.

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
| 50 | Pruebas en Windows en cada versión (2026-10-18) | **Sí a S47**, tras medirla: en cada versión, un Windows de GitHub corre `npm test` (unos 40 s, a la vez que los instaladores), con tiempo máximo en cada paso. Antes, el dueño pidió el estimado: no quería alargar la publicación |
| 51 | Capas, tiempo y DeckCraft (2026-10-24) | **Sí a las fases 31, 32 y 33** (de la 33, por ahora la parte 1, la medición) y **se añade la 34**, con las observaciones del dueño: «Negro» y «Solo fondo» no ocultan las capas; la página de una capa se carga una vez y se queda, sin que nadie recargue nada; varios estilos gráficos en Tiempo; el temporizador se queda quieto en cero, con tictac en los últimos 10 s (más marcado en los últimos 5) y una alarma corta y suave; la hora en 12 h por defecto; DeckCraft reemplaza a PowerPoint del todo cuando pase la prueba en el equipo de la iglesia, sin que una animación que no tenga haga fallar la presentación y con las fuentes incrustadas bien. Pendiente de explicar: compilar una copia propia de la versión web de DeckCraft (parte 3) |
| 52 | DeckCraft y Capas (2026-10-24) | **Sí al camino B** de la fase 33: compilar en GitHub una copia propia de la versión web de DeckCraft, solo si sus autores no aceptan la mejora en una o dos semanas. **Proponerles ya las mejoras** (hecho el mismo día: issues 1346 y 1347 y comentarios en la 714 y la 100 de su repositorio). **El cajón «Capas», solo en Control completo** |
| 53 | Capas desde la barra de abajo (2026-10-25) | Pedido del dueño tras probar las capas: **encenderlas y apagarlas sin abrir el cajón «Capas»**, con botones siempre a la vista abajo. Hecho el mismo día: una ficha por capa con algo junto a «Siguiente» (en el celular, en «Historias»), solo en Control completo, como el cajón. |
| 54 | Fase 34 rehecha (2026-10-25) | Al planearla: **las capas no se tocan desde el orden del culto**, solo desde «Capas» y la barra de abajo; **los versículos en una capa van con fondo**, a pantalla completa, para tapar un momento la presentación del predicador sin cambiar lo que está al aire; y **la barra de capas, al estilo Dynamic Island**, con una burbuja aparte para los botones de un temporizador o un cronómetro. |
| 55 | Manna Iglesia en la nube (2026-10-25) | **Se levanta el límite «siempre red local, sin nube»** (el culto sigue sin depender de internet). Un subdominio por iglesia, con `/preparacion`; un solo equipo oficial por iglesia; el himnario y las biblias en **Cloudflare R2**, con la nota de uso personal y no comercial; copias de seguridad en **Google Drive**; la nube en el **hosting de Hostinger**, tras una prueba (un VPS si falla); **usuarios con nombre y PIN**, un **administrador por iglesia** (ve, edita y borra todos sus órdenes) y un **superadministrador**; el equipo oficial entra sin PIN como administrador; el Orden por semanas y con Favoritos, sin el Mapa. Fases 35 a 39. |
| 56 | Funciones para el celular (2026-10-25) | **Se cancela la fase 19** y se retira su propuesta (las dos versiones). **Se añade la fase 40**: a futuro y sin fecha, la misma investigación otra vez desde cero |
| 57 | Nube: pruebas, versiones y administrador (2026-10-25) | Una **iglesia de pruebas** (`pruebas.manna-iglesia.es`) con su propio equipo oficial; **la misma versión en todas partes**: la nube, un solo programa, y cada equipo oficial se actualiza solo al encender el servidor; el **administrador de cada iglesia entra en línea** con usuario y contraseña, sin el servidor encendido, para gestionar sus usuarios, que viven en la nube. |
| 58 | Versiones por etapas (2026-10-25) | **Sí a S49**: una versión nueva llega primero a la iglesia de pruebas (`pruebas.manna-iglesia.es`) y pasa a todas las iglesias con un botón del superadministrador. La nube y los equipos oficiales siguen la versión que diga la nube, no la última de GitHub. |
| 59 | Cómo se entra y el orden sin nombre (2026-10-25, al planear la fase 35) | **Siempre de una lista**: al entrar, cada persona toca su nombre y escribe su PIN. **El orden sin nombre desaparece**: todo orden tiene nombre (por ejemplo, «Culto del sábado 1 de nov.») y dueño desde que se crea. **La cola del culto muestra el orden en uso a todos los que operan**; solo lo editan su dueño o el administrador. **Ajustes, solo para el administrador.** |
| 60 | Lo pendiente, en cuatro grupos (2026-10-25) | **Todo lo pendiente vive en la sección 11**, en cuatro grupos: hoja de ruta, listas para hacer, tareas del dueño, y en pausa o a futuro; no hay otras listas (la bandeja de ideas `docs/ideas.md` y las ideas de la nota del segundo cerebro pasaron aquí; la investigación de las citas, a `docs/citas-de-documentos.md`). **Se eliminan** S10, S11 y empaquetar con Electron. **Se juntan**: lo anotado por la auditoría, en las fases 35 y 36; S9, en la fase 3; S25 se cierra con la fase 33. **Las pruebas en un equipo real se hacen en el PC de Leidy**, el equipo oficial de `pruebas.manna-iglesia.es`; el de la iglesia será el oficial de `nv.manna-iglesia.es` y no se usa para probar. La 2.0 será la primera versión de la nube. **S41**: a los lados de las «Letras sin música», una extensión desenfocada en lugar de negro, sin gastar. **S42**: hacerla pronto, con una vista más compacta de Medios. **En pausa**: S46, S35 y la fase 40. **La idea I5** pasa a fase 41. |
| 61 | Máximo de órdenes y sugerencias de la fase 35 (2026-10-25) | **Caben 20 órdenes por iglesia** por defecto; el **superadministrador** podrá cambiar el máximo de cada iglesia (fase 39). Con 5 o menos libres, Manna avisa de que hay que **limpiar los órdenes antiguos**; al llegar al máximo, no se crea otro hasta borrar alguno. **Sí a S51** (al abrir Manna, el único orden de hoy pasa a la cola) **y a S52** (al quitar a un usuario, sus órdenes pasan al administrador). |
| 62 | `/preparacion` y el primer administrador (2026-10-25) | **`/preparacion` con cinco pestañas**: Orden, Biblia, Himnario, Medios y Textos, cada una a pantalla completa y sin proyección (en el celular, las pestañas abajo; en el computador, a la izquierda), con los mismos módulos de siempre y «Añadir al orden» en lugar de «Proyectar». En la nube, Medios añade videos de YouTube por su enlace (se descargan en la iglesia); la biblioteca de la iglesia llega con la sincronización (fase 37). **El primer administrador de cada iglesia entra con una clave de alta** de un solo uso, que el dueño pone en las variables del sitio en el hosting: la primera vez, `/administrar` la pide y deja crear el administrador con su nombre, su PIN y su contraseña; después esa clave ya no sirve. |
| 63 | La fase 37 (2026-10-25) | **Sí al plan detallado de la fase 37**, con sus recomendaciones salvo la D. **A**: el equipo se empareja con un código de 6 cifras que da `/administrar` y se escribe en Ajustes del equipo. **B**: emparejado, los usuarios se cambian solo en `/administrar`. **C**: un orden cambiado en los dos lados sin conexión: gana el último cambio, con un aviso a su dueño. **D**: al emparejar otro equipo como oficial, **el anterior queda bloqueado** hasta que se vuelva a emparejar (se entera al conectarse a la nube: sin internet sigue funcionando). |
| 64 | Tras probar la nube (2026-10-25) | **Cuatro partes, en orden** (ver «Tras probar la nube: cuatro partes», en la fase 37). **1**: el nombre del orden se escribe junto al título y se guarda solo; el propuesto es «Orden <quien lo crea> <día>»; el administrador de la iglesia entra con su PIN (sale la contraseña; la clave de alta, solo la primera vez); en Preparar, un himno se añade con pista aunque no se pueda oír (**sin subir pistas a R2**). **2**: instalar Manna en el equipo principal desde la portada de la nube, con el PIN de un administrador, el aviso del equipo oficial anterior, el himnario desde la nube o completo y el instalador emparejado; ya instalado, «Abrir Manna»; en celular y tableta, solo Preparar y Administrar. **3**: el superadministrador en `admin.manna-iglesia.es` (**permiso dado**), con **contraseña**; por iglesia: activar o suspender, **los módulos que puede usar**, los archivos y su espacio (**5 GB** al empezar) y el máximo de órdenes, más su estado y recuperar el acceso de su administrador (el himnario de la nube **no** se apaga por iglesia); el **espacio total del plan**, lo repartido y lo libre con margen, sin repartir de más; **ordenar la interfaz** (la fase 41: el orden de los módulos de cada función). **4**: fotos, videos, PowerPoint y PDF desde Preparar. **Todo se prueba primero en `pruebas`** y, con autorización del dueño, se despliega igual en las demás (hoy `nv`, tras la prueba de instalar). |
| 49 | PDF hechos de imágenes (2026-10-18) | Pedido del dueño con un PDF real que Manna rechazaba («no tiene texto»): era de imágenes (hecho con jsPDF). **Se leen con el reconocimiento de texto del sistema** en el equipo principal (Vision en Mac, `Windows.Media.Ocr` en Windows), sin programas de terceros ni modelos de lenguaje propios; cambia lo decidido en la fase 27 (descartar los documentos sin texto) |
| 48 | YouTube en lote, carpeta de contenido e instalador (2026-10-18) | **Sí a las fases 28, 29 y 30**, en ese orden, con las recomendaciones del asistente y las observaciones del dueño: en la 28, reconocer lo que ya está aunque tenga otro nombre y que el título de YouTube llegue con sus tildes, sin listas de reproducción; en la 29, cambiar la carpeta sin reiniciar y avisar al abrir Manna si no se ha elegido; en la 30, un único archivo con el icono de Manna (`.pkg` en Mac, `.exe` en Windows) que lo hace todo, consola con barra de avance si hace falta, Node.js incluido, sin elegir la carpeta ni firmar |
| 47 | Citas de un texto o documento (2026-10-18) | **Sí a la fase 27** (I1 e I2; su investigación, en `docs/citas-de-documentos.md`), con todas las recomendaciones del asistente: en el Orden, «Añadir» → «Citas de un texto o documento» (y la cita rápida, si se pegan varias); una lista para revisar con las seguras y las de paso marcadas y las dudosas sin marcar; una sección con el nombre del documento; capítulo entero si no hay versículo; repetidas una vez; la versión del documento si está instalada; el orden del documento; documentos largos en grupos. Un documento sin texto se descarta con un aviso. Antes de construir, se mide con 3 o 4 sermones nuevos |
| 46 | Barra de arriba y Ajustes (2026-10-18) | **Sí a la fase 26**, con las observaciones del dueño: versión nueva cada hora y «Buscar versión nueva»; el logo abre Ajustes, que sale del dock; el tamaño de la interfaz con una A pequeña y una grande, sin números; y, a mitad de la fase, «Al aire» al centro y «Solo fondo» y «Negro» como iconos. **Regla nueva**: las pruebas largas tienen tiempo máximo y quien las lanza las vigila |
| 45 | Aviso de versión nueva (2026-10-17) | Pedido del dueño: cada 20 minutos Manna mira en GitHub si hay una versión nueva; sin internet o sin nada nuevo, no avisa; con una nueva, avisa con un botón que abre el instalador. Hecho en la 1.30.0 (sin fase propia). Recomendaciones del asistente aceptadas: el botón solo en el equipo principal, con confirmación, y una × que lo esconde hasta la próxima versión; en la copia con git no se pregunta |
| 44 | Biblia al aire y Escenario más compacto (2026-10-17) | **Sí a las fases 24 y 25, tras la 21**, como las propuso el asistente, con dos ajustes del dueño: en pantallas táctiles lo que se toca mide **35 px** como mínimo (antes, 40), y el icono de Dispositivos es un código QR minimalista, que se vea bien pequeño. Al elegir otro versículo desde lo que está al aire, «Siguiente» sigue por la Biblia |
| 43 | Medios en un solo cajón y órdenes guardados (2026-10-17) | **Se aplaza la fase 19.** Con prioridad, la fase 22 (Videos vuelve a Medios: todo lo agregado en un mismo cajón; categorías a las que se arrastra, y lo que entra en una sale del principal; cada tipo bien señalado) y la 23 (varios órdenes del culto guardados, para usar uno y volver a otro con todos sus elementos). Después, la 21 y lo demás del plan |
| 42 | Un solo Manna a la vez (2026-10-17) | **Fase 21**: si otro equipo con Manna ya usa el dominio propio, este no se conecta y espera a que lo suelte; si ya hay otro Manna en el mismo equipo o en la misma red, este no funciona y lo dice en todas sus pantallas, hasta que el otro se apague. El plan, como lo propuso el asistente |
| 41 | Funciones especializadas para el celular (2026-10-17) | **Antes de la auditoría de la interfaz, una investigación** (fase 19): plantear desde cero funciones dedicadas para el celular, cada una con pocas cosas en pantalla, en lugar del control total. Qué funciones, qué puede hacer cada una, qué tiene en pantalla y cómo se usa. La auditoría pasa a ser la fase 20 |
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
| 9 Auditoría | **Hecha la parte de código** · 2026-10-16 | 1.18.0 | Ver sección 8. Seguridad: 5 fallos corregidos (el más serio, una orden que cerraba Manna). Arquitectura e interfaz: 3 fallos y 6 estados o mensajes corregidos; descartados 4 hallazgos que no se sostenían en el código. Documentos: unos veinte datos al día. Rendimiento medido. Pruebas al cerrar: 161 automáticas, 445 en Chrome, auditoría de 9 tamaños sin problemas. **Falta la parte del equipo real** (pruebas del dueño); la 2.0 se publica cuando pase La parte del equipo real se sustituye por las pruebas en el PC de Leidy con `pruebas.manna-iglesia.es` (decisión 60); al pasarlas sale la 2.0, la primera versión de la nube. Lo que dejó anotado la auditoría pasa a las fases 35 y 36. |
| 10 Presentador | **Hecha** · 2026-10-14, publicada en la 1.10.0 | | Probada en Chrome (con dedos simulados) y en la auditoría de pantallas. Falta la prueba del dueño con un celular real y el proyector |
| 11 Páginas web | **Hecha** · 2026-10-14 | 1.11.0 | Probada con pruebas automáticas y en Chrome real, con páginas de un servidor del propio equipo. **Falta la prueba del dueño**: la ventana aparte con el proyector, Canva y Kahoot de verdad, y en Windows |
| 16 Videos | **Hecha** · 2026-10-17 | 1.19.0 | Videos es una pantalla propia del módulo de medios (`media/videos.js`), detrás del Himnario: los videos subidos, los de la carpeta y los de YouTube juntos, con el enlace de YouTube en la cabecera. Categorías con el nombre que se quiera (`media.category*`), un video en varias, que se renombran y se eliminan sin borrar videos. Medios queda con Imágenes y Audios; Alabanza recibe Videos. Salen también los arreglos de la tableta pequeña acostada y «Mover» con PowerPoint en vivo. Pruebas al cerrar: 166 automáticas (una nueva de las categorías), 454 en Chrome (con las cuatro órdenes nuevas pulsadas), auditoría de 10 tamaños sin problemas (con Videos, una categoría y YouTube). **Sin probar**: en celulares y tabletas reales, y en Windows |
| 17 Diapositivas en Medios | **Hecha** · 2026-10-17 | 1.20.0 | Medios tiene Imágenes, Audios y Diapositivas; Diapositivas sale del dock. La pestaña es `web/modules/slides/panel.js` (antes su `workspace.js`), con la forma de las de Medios, que la importa (excepción documentada). Arrastrar un PDF o un PowerPoint a Medios lo lleva a ella; «Añadir → Diapositivas» del orden abre esa pestaña (`ctx.go(id, parte)`). El servidor y el Presentador no cambian. Pruebas al cerrar: 166 automáticas, 454 en Chrome (la búsqueda de la Biblia falló con el equipo cargado y pasó al repetir su grupo; **otra quedó en rojo sin que se viera al publicar**: la de Videos esperaba que Medios tuviera solo Imágenes y Audios. Era la prueba, no la app; se corrigió en la fase 18), auditoría de 10 tamaños sin problemas. **Sin probar**: en celulares y tabletas reales |
| 18 Textos | **Hecha** · 2026-10-17 | 1.21.0 | Módulo nuevo (`server/modules/texts/`, `web/modules/texts/`, tipo `text`, permiso `texts.edit` solo en Control completo): textos y citas guardados, partidos en pantallas por las líneas en blanco, con el fondo y la letra de la proyección; la cita entre comillas y con su autor. En el orden del culto y en «Buscar en todo». Pruebas al cerrar: 169 automáticas (tres nuevas), 463 en Chrome (siete nuevas de Textos; la de Videos, que seguía esperando Medios sin Diapositivas, corregida y repetida en su grupo), auditoría de 10 tamaños sin problemas (con la lista y el editor). **Sin probar**: en celulares y tabletas reales, y en el proyector |
| 19 Investigación: funciones para el celular | **Cancelada** · 2026-10-25 (decisión 56); se hizo el 2026-10-17 y se aplazó (decisión 43) | sin versión | Propuesta retirada del repositorio (queda en el historial de git): en el celular, seis funciones de una sola tarea en lugar de «Control completo». En vivo, Pasar, Púlpito, Canto y Sonido (esta, opcional); sin tocar lo que está al aire, Preparar (edita el orden y sube, pero no proyecta) y Atril (lee en grande la letra o el versículo al aire, sin PIN en la red de la iglesia). Comparten una plantilla: arriba la función y lo que está al aire, abajo la acción principal y «Negro», nada se proyecta con un solo toque, y «Deshacer» 5 s. «Control completo» queda para la computadora y la tableta, con una válvula de escape. Un solo PIN. Se contrastó con una propuesta independiente de Gemini, que coincidió en lo esencial; se tomaron siete de sus ideas. Doce decisiones para el dueño (sección 10 del documento) y un orden de construcción en siete pasos. Segunda versión el mismo día, a pedido del dueño: más capacidades por función (lo de siempre a la vista, lo de vez en cuando en hojas), avisos entre funciones (estrofa marcada, avisos al frente, cronómetro del sermón, notas para quien pasa) y catorce decisiones; casi todo lo añadido ya existe en otra pantalla de Manna. **No se usó la skill impeccable entera**: solo su guía para herramientas de operación |
| 20 Auditoría de la interfaz | **Hecha** · 2026-10-17 | 1.22.0 | Con impeccable (`audit`: detector y revisión de código), break-ui (datos extremos en la demostración: nombres sin espacios, 14 categorías, emojis y otros alfabetos, un texto de 30 partes) y review-animations / emil-design-eng (inventario de animaciones). Nota de impeccable: accesibilidad 3, rendimiento 3, colores 3, adaptación 4, coherencia 4: **17/20, «Good»**. El detector dio 15 avisos de 4 tipos: la letra Geist Mono, la franja roja del versículo al aire y el brillo del logo son decisiones de `DESIGN.md`; la barra «sin avance» con reducir movimiento sí era un fallo. La revisión del código (Sonnet; Gemini pidió volver a iniciar sesión) dio 20 hallazgos comprobados, ninguno bloqueante. Corregido lo pequeño (foco en ventanas y menús, avisos de error anunciados, palabras largas en la proyección, categorías con ratón, contraste de notas y de lo ya pasado, `aria-pressed` en Solo fondo, Negro y la disposición del comparador, desplazamiento suave con reducir movimiento, borde del cajón para el dedo); lo que pedía rehacer piezas fue a la sección 11 (S43 a S45), hechas después en la 1.23.0. Sale también «Buscar en todo» en columnas. Pruebas al cerrar: 169 automáticas, 464 en Chrome (con la de las columnas del buscador) sin fallos, auditoría de 10 tamaños sin problemas. Con S43 a S45 (1.23.0): 169 automáticas, 467 en Chrome (tres nuevas de teclado) y auditoría de 10 tamaños, sin fallos. **Sin probar**: con un lector de pantalla real y en un celular real |
| 21 Un solo Manna a la vez | **Hecha** · 2026-10-17 | 1.28.0 | Dominio propio: antes de conectarse pregunta quién contesta en su dirección; si es otro Manna, estado `busy` y vuelve a mirar cada 60–90 s al azar; si lo nota ya conectado, se aparta. Red local: `rival()` mira los puertos de este equipo y, por mDNS (`probe`), si otro equipo contesta por el nombre, confirmándolo con `/api/ping` (que ahora dice su `name`); bloqueado, escucha pero no se anuncia, no proyecta, no abre el túnel y rechaza las órdenes salvo apagarse y «Volver a comprobar»; cada 15 s vuelve a mirar y, libre, se reinicia. Aviso a pantalla completa en el control y en la proyección. Una revisión del código (un agente, Sonnet) encontró siete defectos, corregidos antes de publicar: dos miradas a la vez podían dar por libre la red (ahora una a la vez, y dos miradas seguidas sin rival antes de arrancar), un solo sondeo perdido bastaba, la pestaña quedaba sin conexión al arrancar (ahora se abre el control), en otro equipo solo se miraban los puertos 80 y 8000, el aviso se rehacía cada 15 s, el texto decía «localhost» a los celulares y las subidas se colaban (ahora el bloqueo va en el router). Pruebas al cerrar: 183 automáticas (con dos Manna de verdad en `test/unico.test.js`), 511 en Chrome sin fallos y con todas las órdenes pulsadas (y el grupo «red» repetido tras los arreglos), auditoría de 10 tamaños sin problemas. **Sin probar**: dos equipos de verdad en la misma red y el túnel de verdad. Antes, el mismo día, ya se había corregido lo urgente: el instalador no toca una carpeta con git (1.25.3) y Cloudflare se cierra con Manna (1.24.0) |
| 22 Medios en un solo cajón | **Hecha** · 2026-10-17 (plan aprobado ese día, «separado por tipo») | 1.26.0 | Medios tiene imágenes, videos (con YouTube), audios y presentaciones en grupos por tipo, del más antiguo al más reciente, con la marca del tipo en cada tarjeta; sale Videos del dock. Categorías para todo, una por elemento («Principal» = sin categoría), que se cambian arrastrando hasta el chip (ratón, o dedo tras 350 ms) o desde el menú; lo subido con una categoría elegida entra en ella. Un solo «Subir». Las pruebas en Chrome las adaptó un agente (Sonnet) y encontraron cuatro fallos de la app, corregidos: la categoría elegida no se recordaba al recargar, una presentación movida seguía en Principal, faltaba sitio con una imagen elegida (el aviso de yt-dlp salía también con ella) y el ⋯ de la categoría quedaba fuera de la fila en el celular. Pruebas al cerrar: 179 automáticas, 484 en Chrome (con el ratón y el dedo simulados) sin fallos y todas las órdenes pulsadas, auditoría de 10 tamaños sin problemas. **Sin probar**: arrastrar con el dedo en un celular o una tableta reales |
| 23 Órdenes guardados | **Hecha** · 2026-10-17 (plan aprobado ese día, con el ajuste del dueño) | 1.27.0 | Un orden sin nombre (el de trabajo, que se vacía al cerrar Manna salvo en un reinicio o tras un corte de menos de 15 minutos) y los guardados con nombre; uno en uso, el de la cola, y cada cambio queda en él. Ventana «Órdenes guardados» desde el nombre, junto al título del Orden: guardar con un nombre (se propone «Sábado 18/10/26 19:30»), usar otro con confirmación, nuevo orden, cambiar el nombre, duplicar y eliminar. La cola muestra el nombre. El orden de antes pasa a ser «Orden del culto». Pruebas: 182 automáticas (tres nuevas en `test/ordenes.test.js`) y a mano en el navegador. Publicada antes de su prueba en Chrome y de la auditoría de pantallas, a pedido del dueño. **1.27.1**: las pruebas en Chrome (las añadió un agente, Sonnet) pulsan cada botón, también desde una segunda pestaña cuya cola cambia, y la auditoría revisa la ventana; encontraron un fallo, corregido: en la tableta baja la cita rápida quedaba sin sitio junto al botón del orden. Pruebas al cerrar: 182 automáticas, 507 en Chrome sin fallos y con todas las órdenes pulsadas, auditoría de 10 tamaños sin problemas. **Sin probar** en un celular o una tableta reales |
| 24 Biblia al aire | **Hecha** · 2026-10-17 | 1.29.0 | Con un pasaje al aire, «Versión», «Comparar» y «Versículos» en sus mandos (`web/modules/bible/onair.js`). Orden nueva `projection.swap`, solo entre `verses` y `compare`: cambia lo que está al aire conservando `source.orderId` y `source.step`; dentro del mismo elemento del orden, «Siguiente» sigue en lo que está al aire (hook `stepIds` de los tipos). Si a la otra versión le falta un versículo del pasaje del orden, 409 con su porqué. La capa de versículos: otro versículo (fuera del orden), un tramo (pulsación larga o Mayús), capítulos, teclado. La hizo un agente (Sonnet) en una copia aparte, mientras se cerraba la 21; otro agente la revisó y sus siete hallazgos se corrigieron antes de juntarla (el grave: al cambiar de versión podía salir otro versículo). Se publicó con la 25 (ver su fila). **Sin probar**: la pulsación larga con el dedo en un celular real |
| 25 Escenario más compacto | **Hecha** · 2026-10-17 | 1.29.0 (con la 24) | Un agente (Sonnet) escribió una propuesta medida y concreta (cajón, barra, tarjeta, tamaños, wifi y QR); otros dos la hicieron en paralelo (el wifi y el QR en una copia aparte); al de la barra y el cajón lo relevó el asistente (Opus) a pedido del dueño, que revisó lo hecho, juntó las dos partes y las probó. La primera auditoría dio 45 avisos: en la tableta y el celular en horizontal, ampliar y cerrar caían solos a una segunda fila; ahora quedan fijos arriba a la derecha de la cabecera (con su sitio reservado, `--acts-w`), lo demás cede o baja de fila, y en pantallas bajas o cajones de menos de 900 px junto a ellos solo va «AL AIRE». La 24 se publica con la 25: con sus botones, la barra de abajo pasaba a dos filas y la auditoría marcaba poco sitio en los cajones. Con la simulación de la 21 se añadió que la comprobación del dominio propio pregunte hasta tres veces. Pruebas al cerrar (con la 24): 187 automáticas, 557 en Chrome sin fallos y con todas las órdenes pulsadas, auditoría de 10 tamaños sin problemas. **Sin probar**: en un celular y una tableta reales |
| 26 Barra de arriba y Ajustes | **Hecha** · 2026-10-18 (plan aprobado ese día, con las observaciones del dueño; «Al aire» al centro, añadido a mitad de la fase) | 1.31.0 | Barra de arriba en tres columnas: la marca (el logo abre Ajustes, que sale del dock; cambiar de función aparte; la versión), «Solo fondo» y «Negro» como iconos, «Al aire» al centro y, a la derecha, el proyector, «Buscar en todo» y el wifi y el QR, que se abren en su sitio como una tarjeta (`conexion.js`). Fundidos de 140-180 ms en lo que se abre. Tamaño de la interfaz por dispositivo (zoom 1-1,08: las medidas de pantalla del CSS se dividen entre `--zoom` y lo que se coloca midiendo, entre `pageZoom()`). Borrar lo subido por categoría con dos confirmaciones. Versión nueva cada hora y «Buscar versión nueva». Tiempo máximo en las pruebas largas y la regla de vigilarlas. La primera ronda encontró, y se corrigió: la píldora perdía 2 px de alto al abrirse; al cambiar de wifi a QR la píldora volvía a encogerse; la auditoría contaba como fallo que la tarjeta tape el dock del celular pequeño (es una capa); y, al máximo, la auditoría medía en píxeles de pantalla con topes del tamaño normal (55 avisos falsos), un título largo no cabía en cinco líneas en el cajón más pequeño (ahora seis) y la cabecera de la Biblia del celular pequeño pasaba a cuatro filas (en un cajón de 380 px o menos va sin el título «Biblia», que ya dice el dock, y con la versión más estrecha: dos filas, también al tamaño normal, donde eran tres). Pruebas al cerrar: 189 automáticas, 579 comprobaciones en Chrome sin fallos y con todas las órdenes pulsadas (control y biblioteca repetidos tras los arreglos), auditoría de 10 tamaños sin problemas, también con la interfaz al máximo. **Sin probar**: en un celular y una tableta reales, Safari de iPhone con el tamaño agrandado y Firefox |
| 27 Citas de un texto o documento | **Hecha** · 2026-10-18 (decisión 47; el dueño aprobó todas las recomendaciones y pidió continuar) | 1.32.0 | «Añadir» → «Citas de un texto o documento» en el Orden, y pegar o escribir varias citas en la cita rápida. El navegador saca el texto de un Word (`.docx`, con `DecompressionStream`) o de un PDF (pdf.js, por páginas; su carga pasó a `web/core/pdf.js`, que comparte Diapositivas); el servidor encuentra las citas (`server/modules/bible/citas.js`, con los libros de `canon.js`, la numeración de las biblias instaladas y el contexto) y devuelve la lista preparada (`POST /api/bible/citas`); la ventana las muestra para revisar (seguras marcadas, dudosas con su opción y el porqué, «ya está en el orden», la página, grupos por página con más de 40) y las añade de una vez con la orden nueva `order.addMany`. Parte 1 (medir con sermones nuevos) **pendiente**: en la carpeta local seguían los mismos once documentos (sección 10). Con ellos: 403 citas, ninguna segura equivocada ni olvidada; una prueba local vigila que no cambie. La revisión en la demostración y en Chrome encontró, y se corrigió: el contexto mezclaba líneas, «Añadir» quedaba fuera de la vista en el celular (ahora solo se desplaza la lista) y, al pegar varias citas, la ventana se abría vacía (usaba algo aún sin definir). Pruebas al cerrar: 196 automáticas (siete nuevas en `test/citas.test.js`), 595 comprobaciones en Chrome sin fallos y con todas las órdenes pulsadas (con un Word y un PDF fabricados en el momento; el grupo «red» repetido tras corregir la propia prueba), auditoría de 10 tamaños sin problemas, también al máximo. **Sin probar**: sermones que el detector no haya visto, un PDF a dos columnas, un Word grande en un celular real y la memoria (unos 106 MB con 14 biblias) en el equipo de la iglesia |
| 28 Varios videos de YouTube | **Hecha** · 2026-10-18 (decisión 48) | 1.33.0 | «Varios» junto al enlace de Medios (y pegar un mensaje en el campo, o «Añadir» con el campo vacío) abre una lista para revisar: `youtubeLinks` saca los enlaces de un texto como venga (viñetas, nombres, notas, `?si=`, comas, invisibles), cada video una vez con lo demás de su línea; `POST /api/media/youtube/enlaces` dice lo que ya está por el identificador del video (aunque se haya renombrado) y `media.youtubeMany` pone en cola los elegidos (hasta 50), que bajan de uno en uno como siempre. Las tildes rotas del título: yt-dlp en Windows escribe en la codificación de la consola si no se le pide `--encoding utf-8`, y una letra partida entre dos trozos de la salida también se rompía (ahora se lee como texto UTF-8); el yt-dlp de mentira escribe como el de Windows y la prueba lo detecta. La lista para revisar es la misma de las citas: sus estilos pasaron a `app.css` (`review-*`). La revisión encontró, y se corrigió: el nombre tomado del mensaje dejaba comas sueltas y, en el celular pequeño (360 px), el campo del enlace quedaba bajo los botones de la esquina (ahí «Varios» no se muestra). Dos comprobaciones de Chrome con esperas fijas fallaron con el equipo muy cargado y pasaron a esperar la condición. Pruebas al cerrar: 197 automáticas, 600 comprobaciones en Chrome sin fallos y con todas las órdenes pulsadas, auditoría de 10 tamaños sin problemas, también al máximo (los tamaños que fallaron, repetidos tras el arreglo). **Sin probar**: el yt-dlp de verdad en Windows y descargas reales seguidas |
| 29 Carpeta de contenido | **Hecha** · 2026-10-18 (decisión 48) | 1.34.0 | Ajustes → «Carpeta de contenido»: la ruta, qué tiene, «Abrir la carpeta» y «Cambiar…» (la ventana del sistema, en el equipo principal; si la elegida no lo parece pero tiene una `Contenido` dentro, se usa esa, y si no, se pregunta). **Sin reiniciar**: `app.setContent` avisa a Biblia, Himnario y Medios (`app.onContent`), que vigilan la carpeta nueva y vuelven a leer; lo que se sirve se resuelve en cada petición. Se le añade lo que falte sin tocar nada y se guarda en `carpetas.json` (`elegida`) o en `data/ajustes.json`. Aviso arriba si no se encuentra o si solo tiene la Reina-Valera 1909 y ningún himno. Con la fase sale también la lectura del texto de los PDF hechos de imágenes (decisión 49). Pruebas al cerrar: 201 automáticas (`test/contenido.test.js`, y la del texto de una imagen en `test/citas.test.js`), 606 comprobaciones en Chrome sin fallos y con todas las órdenes pulsadas (la carpeta con una ventana de mentira; un PDF de imágenes leído de verdad por el Mac), auditoría de 10 tamaños sin problemas, también al máximo. **Sin probar en Windows**: la ventana para elegir carpeta, «Abrir la carpeta» y la lectura del texto de las imágenes |
| 30 Instalador de un solo archivo | **Hecha** · 2026-10-18 (decisión 48; `.exe` compilado en GitHub y `.pkg` en Mac, confirmados ese día) | 1.35.0 | Un instalador por sistema, de una sola fuente: en Windows, `instalacion/windows/instalar.ps1` (UTF-8 con BOM, con tildes, la consola con los pasos y una barra de avance), que lleva dentro `Instalar-Manna-Windows.exe` (un programa de C# mínimo, compilado con el `csc` de Windows en GitHub, con el icono de Manna) y que abre el `.bat` del programa para actualizar; en Mac, `Instalar Manna en Mac.command`, que lleva dentro `Instalar-Manna-Mac.pkg` (`pkgbuild` y `productbuild`, sin archivos: su `postinstall` lo ejecuta como la persona de la sesión) con una página de pasos y otra de lo que sigue. Los dos bajan el Node.js oficial (24, con su huella) a `Programa/node`, que usa el icono Manna. `ordenar.mjs` ya no deduce la carpeta Manna de la de contenido (la elegida en Ajustes puede estar en otro sitio) y conserva `elegida`. GitHub (`.github/workflows/instaladores.yml`) compila y prueba los dos en cada rama `fase-*` y, al publicar una versión, los adjunta. La prueba en GitHub encontró, y se corrigió: el PowerShell 5.1 heredaba las rutas de módulos del 7 y no encontraba `Get-FileHash` (ahora la huella y los `.zip` van con .NET, y el `.exe` y el `.bat` limpian esas rutas), y el `.pkg` preparaba el instalador en la carpeta temporal del administrador, donde la persona no puede entrar (ahora en `/tmp`). Pruebas al cerrar: 203 automáticas, 606 comprobaciones en Chrome sin fallos y con todas las órdenes pulsadas, auditoría de 10 tamaños sin problemas, y los dos instaladores en GitHub. **Sin probar**: el doble clic en el `.exe` en el Windows de la iglesia, el instalador de Apple de verdad y actualizar una instalación anterior |
| 31 Capas y páginas transparentes | **Hecha** · 2026-10-24 (decisión 51) | 1.36.0 | Módulo nuevo `layers` (cajón «Capas» en Control completo): tres capas encima de lo que se proyecte, que no se apagan con «Negro» ni con «Solo fondo» y vuelven siempre al arrancar (`data/capas.json`). Hoy, páginas web que se dejan mostrar dentro de Manna, con el marco transparente (botón «Capa» de Páginas web o «Poner aquí»); el ojo las oculta sin recargarlas. Una página de internet solo se carga cuando su dirección contesta (si no, espera oculta y se vuelve a mirar sola cada 15 s) y recibe `{ manna: 'capa', visible }`. Solo las dibuja la pantalla de proyección; arriba, junto a «Al aire», la pastilla de capas. Con una capa a la vista, PowerPoint en vivo va como imágenes y sus mandos lo dicen. Pruebas al cerrar: 207 automáticas (4 nuevas en `test/capas.test.js`), 627 comprobaciones en Chrome sin fallos y con todas las órdenes pulsadas (una página de prueba transparente, `LAYER_PAGE`), auditoría de 10 tamaños sin problemas (con la pastilla arriba en todas las pantallas). **Sin probar**: en el equipo Windows del SENA y con la página real del concurso |
| 32 Tiempo | **Hecha** · 2026-10-25 (decisión 51) | 1.37.0 | Módulo nuevo `time` (cajón «Tiempo» en Control completo) y tipo `clock`: la hora del equipo principal, cronómetros y temporizadores guardados (`data/tiempo.json`) con su reloj en el servidor; cinco estilos (Sencillo, Digital, Tarjeta, Anillo y Barra, que el dueño vio en una captura antes de cerrar la fase), tres tamaños, nueve sitios, sutil o normal y, la hora, 12 o 24 h; vista previa sobre el fondo de Ajustes. Proyectar, capa (también en «Poner aquí» de Capas, con su botón de empezar y ±1 min en el menú) y orden del culto (desde ahí, un temporizador en su principio empieza solo). Al llegar a cero se queda quieto, con tictac en los últimos 10 s (más marcado en los 5 últimos) y alarma suave, con Web Audio en la pantalla que suena. «Buscar en todo» los encuentra; el fondo del control dibuja las capas ligeras. Pruebas al cerrar: 213 automáticas (6 nuevas en `test/tiempo.test.js`), 643 comprobaciones en Chrome con todas las órdenes pulsadas (el sonido, con un sintetizador de mentira) y auditoría de 10 tamaños con la pantalla nueva. **Sin probar**: cómo suenan de verdad por los parlantes de la iglesia, y en Windows |
| 33 DeckCraft | **Partes 1 y 2 hechas** · 2026-10-25 (decisión 51; el dueño pidió seguir tras la medición) | 1.38.0 (parte 2) | Parte 1: 93 de 149 diapositivas idénticas, 54 leves, 2 graves (ver la fase). Parte 2: DeckCraft 0.10.0 como programa del equipo principal (`core/tools.js`, versión fija y huella; «Instalar por mí»), y un PowerPoint lo convierte él si está (`slides/deckcraft.js`: `info` y `render --all`, sin las ocultas, miniaturas en PNG); si no, PowerPoint. Pruebas: `test/deckcraft.test.js` con un DeckCraft de mentira y con el de verdad (también en el Windows de GitHub, que lo descarga en cada versión), presentaciones fabricadas con `scripts/lib/pptx.mjs`, y el paso en Chrome. **Sin probar**: instalarlo y convertir en el equipo de la iglesia. Parte 3: prueba de concepto hecha en este Mac (funciona abrir, empezar y pasar con animaciones; faltan la vista sin presentador y saber en qué diapositiva va); **en espera de la respuesta de DeckCraft** Parte 3: en la hoja de ruta (sección 11); al cerrarse, PowerPoint sale de Manna y con él la S25. |
| 34 Versículos en una capa y la barra de capas al estilo Dynamic Island | **Hecha** · 2026-10-25 (decisión 54: rehecha al planearla) | 1.40.0 | Parte 1: el tipo `verses` va en una capa (`layer: true`; en la web, `cover`: a pantalla completa con el fondo y el velo de Ajustes, con clases propias que «Negro» y «Solo fondo» no apagan), con «Capa» en la Biblia (Control completo; al comparar, no). Parte 2: la barra de capas como islas que se conservan (`layerSwitches`), con la burbuja que da el tipo (`island(item)`: la cuenta y los botones de un temporizador o un cronómetro) y un muelle sin rebote al aparecer. Pruebas: `test/capas.test.js` (un pasaje en una capa); en Chrome, «Capa» en la Biblia, un pasaje que tapa la presentación al aire y se apaga, y la burbuja del cronómetro; la auditoría con un temporizador en una capa. Fuera de la fase, por decisión del dueño: las capas como pasos del orden. |
| 35 Usuarios y el Orden rehecho | **Hecha** · 2026-10-25 (decisiones 55 y 59) | 1.41.0 | Parte 1, usuarios: `core/users.js` (nombre, PIN de 4 cifras como huella, funciones, administrador) y módulo `users` (Ajustes → Usuarios); entrar eligiendo el nombre de una lista y escribiendo su PIN; el equipo principal, administrador sin PIN; Ajustes y la conexión por internet, solo del administrador; 5 PIN equivocados bloquean al usuario 15 min; el PIN único de antes pasa al «Administrador»; como mucho 500 sesiones guardadas (lo anotado por la auditoría). Parte 2, cada orden con su dueño: nombre, dueño y fecha desde que se crea (sin orden sin nombre); el estado `orders` se filtra por quien mira (`store.register` con `view`, también en el tiempo real), y lo que cada uno añade va a su orden abierto; el en uso, el de la cola, lo ven todos. Parte 3, el cajón Orden: «Este orden», «Órdenes» por semanas (domingo a sábado) y «Favoritos»; salen el Mapa del culto y «Duplicar» |
| 36 La nube de la iglesia | **Aprobada** · 2026-10-25 (decisión 55). La prueba del hosting, hecha el mismo día: sirve, con los cambios de la fase. **Plan detallado aprobado** el mismo día (ver «Fase 36 · La nube de la iglesia»). **En curso**: hechas las partes 1 (modo nube) y 5 (lo de la auditoría), publicadas juntas como «parte 1» en la 1.43.0; hechas en la 1.44.0 la 2 (`/preparacion` en cinco pestañas, sin escuchar los himnos hasta R2) y la 4 (`/administrar` con la clave de alta). Hecha en la 1.45.0 la 3 (el himnario y las biblias en R2, subidos el 2026-10-25). Hecha la 6: `pruebas.manna-iglesia.es` desplegado el 2026-10-25 (1.47.0). Para cerrarla falta la prueba de verdad del dueño | | `nv.manna-iglesia.es` creado (página de espera), con su registro en Cloudflare |
| 37 Sincronización y equipo oficial | **Aprobada** · 2026-10-25 (decisión 55). **Plan detallado aprobado** el mismo día (decisión 63; ver «Fase 37 · Sincronización y equipo oficial»). **En curso**: hechas las partes 1 y 2 (emparejar y el equipo oficial, 1.46.0) y la 3 (usuarios, 1.47.0); la 4 (órdenes, textos y favoritos, 1.48.0); tras la prueba del dueño, las cuatro partes de la decisión 64 (la 1, en la 1.49.0; la 2, instalar el equipo principal desde la nube y el himnario en el equipo, en la 1.50.0) y después la 6 y la 7 | | |
| 38 El himnario en línea en la iglesia y los archivos | **Aprobada** · 2026-10-25 (decisión 55). El himnario en la iglesia y los archivos desde casa se adelantan en las partes 2 y 4 de la decisión 64; quedan las copias en Drive | | |
| 39 Superadministrador | **Aprobada** · 2026-10-25 (decisión 55). Qué hace, decidido el mismo día (decisión 64, parte 3): con contraseña, en `admin.manna-iglesia.es`; módulos, archivos y espacio, máximo de órdenes y activar o suspender cada iglesia; el espacio del plan; ordenar la interfaz | | |
| 40 Investigación desde cero: funciones para el celular | **En pausa** · se retoma cuando lo diga el dueño (decisiones 56 y 60) | | |
| 41 Organizar la interfaz desde el superadministrador | **Entra en la fase 39** · 2026-10-25 (decisión 64): el orden de los módulos de cada función y cuál se abre primero | | |
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
| 2026-10-25 | Tras probar la nube, cuatro partes: arreglos de Preparar y el administrador con PIN (sale la contraseña de la decisión 62); instalar el equipo principal desde la nube con un instalador emparejado (la opción que la decisión 63 dejó para después) y el himnario en la iglesia (de la fase 38); el superadministrador con contraseña, módulos por iglesia, el espacio del plan y ordenar la interfaz (la fase 41 entra en la 39); los archivos desde casa (fase 37, parte 5, y fase 38) | Decisión del dueño (decisión 64) |
| 2026-10-25 | Fase 36, partes 2 y 4: `/preparacion` en cinco pestañas (Orden, Biblia, Himnario, Medios y Textos) en vez de solo Orden, Biblia e Himnario, y el primer administrador con una clave de alta | Decisión del dueño (decisión 62) |
| 2026-10-25 | Fase 35 (tras cerrarla): máximo de 20 órdenes por iglesia con aviso de limpiar, el único orden de hoy pasa a la cola al abrir (S51) y los órdenes de quien se quita pasan al administrador (S52); la fase 39 cambiará el máximo | Decisión del dueño (decisión 61) |
| 2026-10-25 | Lo pendiente se ordena en cuatro grupos en la sección 11, que pasa a llamarse «Lo pendiente y los cambios sugeridos»: se eliminan S10, S11 y Electron; S9 entra en la fase 3; S25 se cierra con la 33; lo anotado por la auditoría entra en la 35 y la 36; la fase 40, S35 y S46, en pausa; S41 y S42, rehechas; la idea I5 es la fase 41; las pruebas del equipo real, en el PC de Leidy con `pruebas.manna-iglesia.es` | Decisión del dueño (decisión 60): una sola lista de pendientes, sin bandejas sueltas |
| 2026-10-25 | Fase 35: salen el «Mapa del culto» y «Duplicar» (un orden que se repite se marca favorito y se usa tal cual); cada persona edita el orden que tiene abierto, no siempre el que está en uso | Decisión del dueño (decisión 55: «sin copias») y diseño de la parte 3 |
| 2026-10-25 | Fase 35: se entra eligiendo el nombre de una lista, el orden sin nombre desaparece, la cola muestra a todos el orden en uso y Ajustes es solo del administrador | Decisión del dueño al planear la fase (decisión 59) |
| 2026-10-25 | Fases 37 y 39: la versión nueva va primero a la iglesia de pruebas y pasa a todas con un botón del superadministrador (antes, S49) | Decisión del dueño (decisión 58): con la actualización automática, un fallo no debe llegar a todas las iglesias a la vez |
| 2026-10-25 | Se añaden las fases 35 a 39 (Manna Iglesia: preparar en la nube, para varias iglesias) y se levanta el límite «siempre red local, sin nube» | Decisión del dueño (decisión 55) |
| 2026-10-25 | Fase 34: sale «Encender capa» y «Apagar capa» como pasos del orden; los versículos en una capa van con fondo, a pantalla completa (no en una franja); entra la barra de capas al estilo Dynamic Island, con los botones del temporizador y del cronómetro | Decisión del dueño al planearla (decisión 54) |
| 2026-10-25 | Fase 31, ya cerrada: las capas se encienden y se apagan también desde la barra de abajo (en el celular, «Historias»), con una ficha por capa con algo | Pedido del dueño tras probarlas en el Windows (decisión 53) |
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
| 2026-10-17 | Fuera de las fases (1.23.0): **S43, S44 y S45 hechas** a petición del dueño. Teclado en el escenario (foco al abrir y cerrar cajón y mandos, filas del orden con Tab e Intro, foco que no se pierde al rehacer listas, «Buscar en todo» como combobox, versículos como lista); listas que no se rehacen enteras (cola, detalle del orden, vista previa al escribir) y cajón sin animar el ancho; rojo `--live-strong` para las etiquetas «al aire» y fichas nuevas para los colores sueltos | Las propuso la revisión de la fase 20 |
| 2026-10-17 | Fuera de las fases (1.23.0): al enviar un archivo, nunca más bytes de los anunciados | La prueba «lo que el navegador ya tiene no se vuelve a enviar» falló dos veces sola: si el archivo cambiaba entre medir y leer, la respuesta salía rota |
| 2026-10-17 | La fase 20 se hace mientras el dueño sigue la 19 en otra sesión | Lo pidió el dueño: la investigación del celular queda para más adelante |
| 2026-10-17 | Fase 20: la revisión del código la hizo un revisor de Claude (Sonnet), no Gemini | Gemini pidió volver a iniciar sesión a mitad de la fase |
| 2026-10-17 | Fuera de las fases, dentro de la 1.22.0: «Buscar en todo» en columnas en el escritorio (Biblia, Himnario y Videos uno al lado de otro; los demás grupos debajo, en filas) | Lo pidió el dueño |
| 2026-10-17 | Fase 18: Textos solo en Control completo, no en Alabanza | Respuesta del dueño al empezar la fase |
| 2026-10-17 | Fase 18: lo escrito se guarda también al proyectar, al añadir al orden y al pasar a otro texto, no solo con «Guardar»; la cita abre comillas en su primera parte y las cierra en la última, y su autor va solo en la última | Para no perder lo escrito; y una cita partida en pantallas se lee como una sola |
| 2026-10-17 | Fase 18: un texto entero (sin elegir parte) se ofrece «Todo junto» hasta 3 partes; hasta 500 textos de 4000 letras | Como un pasaje bíblico: lo largo se pasa por partes |
| 2026-10-17 | Se añade la fase 19 (investigación de funciones especializadas para el celular) antes de la auditoría de la interfaz, que pasa a ser la 20 | Decisión 41 |
| 2026-10-17 | Fase 17: un módulo puede abrir la pestaña de otro (`ctx.go('medios', 'diapositivas')`, con `part(id)` en lo que devuelve su `mount`) | «Añadir → Diapositivas» del orden del culto llevaba al módulo que ya no está en el dock |
| 2026-10-17 | Fase 17: «Presentaciones» (volver a la lista en el cajón estrecho) va dentro de la pestaña, encima de las diapositivas, no en la cabecera | La cabecera es de Medios (sus pestañas y «Subir») |
| 2026-10-17 | Fase 17: la dirección `#diapositivas` ya no abre nada propio (lleva al primer módulo); `#medios` abre la última pestaña elegida | Diapositivas no tiene pantalla en el dock |
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
| 2026-10-17 | Se añade la fase 21 (decisión 42): un solo Manna a la vez, en internet y en la red local | El dueño abrió Manna en su Mac con el túnel de la iglesia mientras el de la iglesia estaba encendido, y en Windows una segunda copia se abrió sola en otro puerto |
| 2026-10-17 | Se aplaza la fase 19 y se añaden las fases 22 (Medios en un solo cajón) y 23 (órdenes guardados), que van antes de la 21; la 21 pasa a ser la 1.28 | Decisión 43, pedido del dueño |
| 2026-10-17 | Se añaden las fases 24 (Biblia al aire) y 25 (Escenario más compacto), tras la 21 | Decisión 44, pedidos del dueño |
| 2026-10-17 | Aviso de versión nueva (decisión 45), en la 1.30.0, sin fase propia | Pedido del dueño; pequeño y aparte de las fases |
| 2026-10-17 | La 24 y la 25 se publican juntas (1.29.0) | Con los botones de la 24, la barra de abajo pasaba a dos filas y quitaba sitio a los cajones; la 25 la deja en una |
| 2026-10-17 | Fase 23: se publica (1.27.0) antes de la prueba en Chrome y de la auditoría de pantallas, que van en la 1.27.1 | Pedido del dueño, para tenerla cuanto antes |
| 2026-10-17 | Fase 23: solo se guarda el orden que tiene nombre; el sin nombre se vacía al cerrar Manna y no se crea ningún orden al abrirlo | Ajuste del dueño al aprobar el plan |
| 2026-10-17 | Fase 22: el Servicio de alabanza tiene además el permiso de las presentaciones (`slides.edit`) | Recibe Medios entero, con su grupo de presentaciones: sin el permiso, subir un PDF lo devolvía a la pantalla de inicio |
| 2026-10-17 | Fase 22: el aviso de un programa que falta sale en Medios solo para lo elegido (sin nada elegido, todos) | Sin pestañas, el aviso de yt-dlp salía también con una imagen elegida y dejaba poco sitio a la lista (lo encontró la auditoría de pantallas) |
| 2026-10-18 | Fase 26 nueva (decisión 46): marca con la versión, el logo abre Ajustes, wifi y QR que se abren en su sitio, fundidos, tamaño de la interfaz, borrar por categoría; y, a mitad de la fase, «Al aire» al centro con «Solo fondo» y «Negro» como iconos | Pedidos del dueño del 2026-10-18 |
| 2026-10-18 | Fase 26: el botón del proyector pasa a la derecha, junto a «Buscar en todo» | Estaba dentro de la burbuja de «Al aire», que el dueño quiere solo para el estado, y junto a «Negro» se confundían sus iconos |
| 2026-10-18 | Fase 26: el icono de «Negro» es propio (una diapositiva negra, sin el pie de un monitor) | Con un monitor se confundía con el botón del proyector |
| 2026-10-18 | Fase 26: la versión nueva se busca cada hora (antes cada 20 minutos) | Observación del dueño al aprobar el plan |
| 2026-10-18 | Pruebas: tiempo máximo en `probar-chrome.mjs` (8 min) y en la auditoría (12 min), y la regla de vigilarlas | Una auditoría se quedó más de una hora en un bucle sin que nadie lo mirara |
| 2026-10-18 | Fase 27 nueva (decisión 47): citas de un texto pegado o de un documento Word o PDF al orden del culto, con una lista para revisar (I1 e I2; su investigación, en `docs/citas-de-documentos.md`) | Investigada y calibrada con documentos reales; el dueño aprobó todas las recomendaciones |
| 2026-10-18 | Fase 27, parte 1: la medición con sermones nuevos queda para después; se siguió con las partes 2 a 5 | El dueño dijo haberlos copiado y pidió continuar, pero en la carpeta local seguían los mismos once documentos. Queda en `docs/ESTADO.md` («Problemas conocidos»); lo que falle con ellos se corrige en una 1.32.x |
| 2026-10-18 | Fase 27: la ruta devuelve la lista ya preparada (`{ items, dropped, pages }`: una vez cada cita, con sus opciones y lo que se añadiría) en vez de `{ found, dropped }` | Para preparar las opciones hace falta saber cuántos versículos tiene cada capítulo, y eso está en el servidor |
| 2026-10-18 | Fase 27: los documentos largos van por página, no por título del sermón | Los títulos no se distinguen del resto del texto con seguridad; la página sí se sabe en un PDF |
| 2026-10-18 | Fase 27: el trozo de contexto de cada cita es solo su línea | En la demostración, el contexto de una línea corta mezclaba las citas de las líneas de al lado y confundía |
| 2026-10-18 | Fases 28 a 30 propuestas (sin aprobar): varios videos de YouTube de una vez, elegir la carpeta de contenido e instaladores con ventana y Node.js incluido | Pedidos del dueño del 2026-10-18, con la investigación de cómo hacerlos |
| 2026-10-18 | Fases 28 a 30 aprobadas (decisión 48). La 30 cambia: un único archivo con el icono de Manna (`.pkg` en Mac, `.exe` en Windows) en vez del `.bat` con ventana y la app en un `.zip`, y sin elegir la carpeta de contenido (pasa a ser un aviso de Manna, en la 29); la 29 cambia la carpeta sin reiniciar | Observaciones del dueño al aprobar |
| 2026-10-18 | Fase 28: los estilos de la lista para revisar (las citas) pasan a `app.css` como `review-*`, y la usa también «Varios videos de YouTube» | Un módulo no usa el CSS de otro; así las dos listas se ven y se comportan igual |
| 2026-10-18 | Fase 28: en un cajón de menos de 370 px no se muestra «Varios», y «Añadir» con el campo vacío abre la misma ventana | En el celular pequeño el campo del enlace quedaba bajo los botones de la esquina (auditoría) |
| 2026-10-18 | Tras la fase 28 (decisión 49): un PDF hecho de imágenes ya no se descarta: el equipo principal lee su texto con el reconocimiento del sistema (`server/modules/bible/ocr.js`) | El dueño entregó un PDF real así, hecho desde una web; se publica con la fase 29 |
| 2026-10-18 | Fase 29: «Cambiar…» propone la carpeta `Contenido` de dentro si la elegida no lo parece y la tiene, y el aviso también sale si la carpeta elegida está vacía o no se encuentra | Lo más fácil es elegir por error la carpeta Manna, que contiene `Contenido`; y una carpeta vacía o desconectada deja sin himnario igual que una sin elegir |
| 2026-10-18 | Fase 30: confirmados el `.exe` de Windows compilado en un Windows de GitHub (con archivos de prueba livianos) y el `.pkg` en Mac | Respuesta del dueño |
| 2026-10-18 | Fase 30: el instalador de Windows es un guion de PowerShell (`instalar.ps1`) que lleva dentro el `.exe` y que abre el `.bat` para actualizar; el de Mac es el `.command`, que lleva dentro el `.pkg` | Una sola fuente por sistema para instalar y para actualizar, probada en GitHub en las dos formas |
| 2026-10-18 | Fase 30: la carpeta Manna se apunta en `carpetas.json` (`raiz`) y ya no se deduce de la de contenido | Desde la fase 29 el contenido puede estar en otro sitio; al actualizar, el programa y los datos se habrían ido al lado de la carpeta elegida |
| 2026-10-18 | S47 aceptada (decisión 50): las pruebas automáticas corren también en un Windows de GitHub en cada versión, en el mismo flujo que los instaladores (`instaladores.yml`, trabajo `pruebas-windows`) | Medido: 47 s, en paralelo; los 4 fallos que dieron eran de las propias pruebas y se corrigieron antes |
| 2026-10-24 | Se añaden las fases 31 (capas y páginas transparentes), 32 (tiempo), 33 (DeckCraft en vez de PowerPoint) y 34 (capas en el orden y versículos en capa) | Decisión 51; la 31 tiene fecha, por el concurso del Sábado Joven del 31 de octubre |
| 2026-10-25 | Fase 33, parte 2: DeckCraft entra como programa del equipo principal (aprobado en la decisión 51 «cuando la medición salga bien»; el dueño pidió seguir con la fase tras ver la medición) | La medición salió bien: 93 de 149 diapositivas idénticas y ninguna presentación rota |
| 2026-10-25 | Fase 33, parte 2: mientras PowerPoint siga en el equipo, convierte DeckCraft si está y PowerPoint si no; PowerPoint en vivo sigue igual | Quitar PowerPoint del todo espera a que DeckCraft pase la prueba en el equipo de la iglesia (decisión 51) |
| 2026-10-25 | Fase 32: cada temporizador se puede dejar sin sonido (casilla al crearlo o cambiarlo) | Un temporizador a la vista durante la predicación no debe sonar si quien predica no lo quiere; por defecto suena, como pidió el dueño |
| 2026-10-25 | Fase 32: el aspecto de cada reloj lo recuerda cada dispositivo (`prefs`), y lo que se proyecta, se pone en una capa o va al orden lo lleva en su data | Es una preferencia de quien lo maneja; lo compartido es el reloj, no cómo se ve |
| 2026-10-25 | Fase 32: «Poner aquí» de Capas pone la hora y los relojes con su aspecto de siempre (la hora, pequeña y sutil abajo a la derecha; uno que cuenta, grande en el centro); con otro aspecto, se ponen desde Tiempo | Capas no sabe del aspecto de cada módulo; así no se acopla a Tiempo |
| 2026-10-24 | Fase 31: con una capa a la vista, PowerPoint en vivo pasa como imágenes por su cuenta y sus mandos lo dicen («oculta la capa para pasarla con PowerPoint»), en vez de preguntar al proyectar | La presentación se proyecta desde muchos sitios (el orden, «Siguiente», el Presentador, un celular): una pregunta en cada uno sería más código y más interrupciones, y PowerPoint va a dejar paso a DeckCraft (fase 33) |
| 2026-10-24 | Fase 31: el cajón «Capas» solo está en Control completo; las demás funciones que proyectan pueden usar las órdenes, pero no tienen el cajón | Lo que pidió el dueño es para quien maneja la proyección; confirmado por el dueño (decisión 52) |
| 2026-10-24 | Fase 31: la página de una capa no avisa que cargó (`capa-lista` descartado); el equipo principal comprueba que su dirección contesta antes de cargarla y lo reintenta solo cada 15 s | Observación del dueño: nadie debe tener que recargar nada, y la página del concurso no tiene que hacer nada especial |
| 2026-10-25 | Se cancela la fase 19 (se retiran `docs/funciones-celular.md` y su simulación) y se añade la fase 40: la misma investigación otra vez desde cero, a futuro | Decisión 56, pedido del dueño |

## 11. Lo pendiente y los cambios sugeridos (decisión 60)

Desde el 2026-10-25 **todo lo pendiente de Manna está aquí**, en cuatro grupos, y no hay otras listas: ni bandeja de ideas en el repositorio ni ideas en la nota del segundo cerebro. Una idea o una sugerencia nueva entra directamente en el grupo que le toque (si aún no se sabe, en el 4, como «cruda»), con qué se quiere, qué hay ya en Manna y qué falta decidir. Cuando el dueño decide algo, pasa a la sección 10 y se mueve o se borra de aquí.

**Dónde se prueba**: lo que no se pueda probar en el equipo de desarrollo se prueba en el PC de Leidy, el equipo oficial de la iglesia de pruebas (`pruebas.manna-iglesia.es`), con su segunda pantalla (`.claude/rules/pruebas.md`, «En un Windows de pruebas»). El equipo de la iglesia será el oficial de `nv.manna-iglesia.es`: ya no hace falta probar nada solo en él.

### 1. Hoja de ruta

| Qué | Estado |
| --- | --- |
| **Fases 35 a 39: Manna Iglesia en la nube** (decisiones 55, 57 a 59) | En curso: la prueba del hosting está hecha y la 35 (usuarios y el Orden rehecho) también (1.41.0); sigue la 36. Llevan dentro lo que dejó anotado la auditoría (fase 9): las sesiones sin límite, ya resuelto en la 35 (como mucho 500 guardadas); los enlaces que se siguen dentro de las carpetas, las direcciones del propio equipo en Páginas web y un video aceptado por su extensión sin ffmpeg, en la 36, antes de abrir Manna a internet |
| **Fase 33, parte 3**: el pase en vivo de las presentaciones dentro de Manna, con DeckCraft | Espera la respuesta de DeckCraft; si no llega, el camino B hacia el 31 de octubre (decisión 52). Al cerrarse, PowerPoint sale de Manna y con él la S25 (probar PowerPoint en vivo en Windows); hasta entonces, eso se prueba en el PC de Leidy |
| **Fase 41: organizar la interfaz desde el superadministrador** (la idea I5) | Se planea después de la 39 (ver la fase) |

### 2. Listas para hacer

| # | Qué | Detalle |
| --- | --- | --- |
| S42 | **Medios más ordenados y más compactos** (el dueño la quiere pronto) | Ordenar a mano las categorías y lo que hay dentro de cada una (arrastrar, en el escritorio y en el celular). Además, que los medios ocupen menos sitio en pantalla: miniaturas más pequeñas o una **vista en lista** con la miniatura en grande al tocar uno. Mediana |
| S48 | **Avisar si una página que va en su propia ventana tapa las capas** (Kahoot y las que no se dejan mostrar dentro de Manna) | Al ponerla al aire con una capa a la vista, sus mandos dirían «Hay una capa a la vista: la página la tapa» y ofrecerían apagar las capas. Pequeña |
| S41 | **«Letras sin música» en un proyector 16:9 sin franjas** (en la iglesia, los lados se ven negros) | Las diapositivas del himnario son 4:3: a cada lado, una extensión desenfocada de la propia diapositiva, como el fondo del Escenario, en lugar de negro. Que gaste poco: una sola imagen pequeña y desenfocada por diapositiva, sin animar; se mide en el PC de Leidy. Pequeña |
| S54 | **En el hosting, una clave de R2 de solo lectura** (vista al hacer la parte 3 de la fase 36) | La nube solo lista, baja y firma enlaces; la clave de `~/.manna-r2` también sube y borra. Con una clave aparte, de solo lectura y solo para ese depósito, en las variables del hosting, quien la obtuviera no podría cambiar ni borrar el himnario. La crea el dueño en Cloudflare (R2 → «Manage API tokens» → «Object Read only») al desplegar (parte 6). Pequeña |
| S53 | **En la nube, que la lista de nombres para entrar no sea pública** (vista al hacer la fase 36) | Hoy, quien abra la dirección de la iglesia ve los nombres de sus usuarios (no sus PIN), porque se entra eligiendo el nombre de una lista (decisión 59). En la red de la iglesia no importa; en internet expone quiénes son. Propuesta: en la nube, la lista sale tras escribir una palabra de la iglesia (la misma para todos, que da el administrador), o se escribe el nombre en vez de elegirlo. Pequeña |
| S50 | **Escribe y busca** (idea del dueño del 2026-10-24, «buscador siempre activo») | Con un módulo abierto, en el escritorio, lo que se teclea va a su buscador sin tener que pulsarlo antes. No con el cursor siempre en el buscador: en el celular saldría el teclado todo el rato y dejarían de funcionar los atajos. **Por decidir**: B y C (Negro, Solo fondo) son letras: o pasan a llevar una tecla más (Mayús), o la búsqueda empieza con «/». Pequeña |

### 3. Tareas del dueño

| Qué | Detalle |
| --- | --- |
| **Decidir la licencia del repositorio** | Hoy no tiene. El repositorio es público, el himnario irá a la nube con una nota de uso personal y no comercial, y Manna llegará a otras iglesias |
| **Probar en el PC de Leidy, con `pruebas.manna-iglesia.es`** | Junto con el asistente, cuando exista la iglesia de pruebas (fases 36 y 37). Sustituye a la parte del equipo real de la fase 9; al pasarlas sale la 2.0. La página con casillas de las pruebas en la iglesia ya no se usa |

### 4. En pausa o a futuro (se retoma cuando lo diga el dueño)

| Qué | Detalle |
| --- | --- |
| **Fase 3: televisores**, con la S9 (encenderlo y apagarlo desde Manna) | Construida (1.4.0); el televisor del dueño no carga la proyección. Al final de todo (decisiones 19 y 35) |
| **Fase 40: funciones para el celular**, desde cero | En pausa |
| S35 · **Proyectar una pestaña ya abierta en el Chrome del equipo principal**, como al compartir en Google Meet | Serviría para páginas que piden iniciar sesión (Canva, Kahoot). Mediana. Ver «S35 · lo que se sabe», abajo |
| S46 · **Medir las citas de un documento con sermones nuevos** | Hasta hoy funciona bien. Si un documento da problemas, el dueño trae esos casos y se revisan |
| **Aviso fijo en Textos** (idea del dueño, 2026-10-25; cruda) | **Qué**: un elemento más en Textos, el «aviso fijo»: un texto al que se le elige el estilo, el grosor, el color y el contenedor, y que se sitúa en la pantalla con una cuadrícula, como el reloj. Se pone en una de las capas, así queda encima de lo que esté al aire. **Lo que ya hay**: el tipo `text` de Textos (pantallas que se pasan, con el fondo y la letra de Ajustes; no va en capas); el tipo `clock` de Tiempo, que sí va en capas (`layer: true`) y ya tiene la cuadrícula de 3 × 3 sitios (`PLACES` de `server/modules/time/clock.js`, con su selector en `web/modules/time/workspace.js`), estilos, tamaños y aspecto «sutil» o «normal»; y las tres capas de la fase 31. Se puede copiar el camino del reloj: un tipo nuevo de Textos con `layer: true` y lo que se elija guardado en su `data`. **Por decidir**: qué estilos de letra (Manna trae Sora y Geist Mono), si el color se elige de una paleta o libre, qué contenedores (ninguno, una franja de lado a lado, una tarjeta, una píldora), si basta la cuadrícula de 9 sitios del reloj, si un aviso también se puede poner al aire o en el orden del culto como un texto normal, y si se queda quieto o también puede desplazarse como una franja de noticias. **Cuidado**: tiene que leerse sobre cualquier cosa que esté al aire (una diapositiva blanca, un video); sin contenedor, el texto lleva una sombra. Mediana |

**Eliminado** el 2026-10-25 (decisión 60): S10 (un video de YouTube directo a la aplicación del televisor: pondría anuncios, lo contrario de descargarlo), S11 (otras marcas de televisor: nadie lo ha pedido) y empaquetar Manna como aplicación con Electron (lo cubre el instalador de un solo archivo de la fase 30).

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
