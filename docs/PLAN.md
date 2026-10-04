# Plan de trabajo: versión 2

Estado: **aprobado por el dueño el 2026-10-04. En curso: fase 0 terminada, sigue la fase 1.**
Parte de la versión 1.0.0 y termina en la 2.0.0.

Este documento es el plan y, al terminar, la base de la auditoría (sección 8). Se actualiza al cerrar cada fase: la sección 9 lleva el avance y la 10, cada cambio que se le hace al plan y por qué.

## 1. Qué se pide

| # | Petición | Dónde queda |
| --- | --- | --- |
| A | Módulo comparador de versiones | Fase 2 |
| B | Búsqueda mejor: exactas primero, parecidas después, resaltado, versión de cada resultado; rápida, con las biblias indexadas | Fase 1 |
| C | Pantalla de proyección en televisores (Samsung, LG, Android TV), a pantalla completa | Fase 3 |
| D | Imágenes: subir, nombrar, ajustar a pantalla, zoom y desplazamiento en vivo | Fase 4 |
| E | Himnario: 613 videos, dos vistas, buscador con letra, volumen, barra de avance, **cantado o pista** | Fase 5 |
| F | Videos y audios locales en cualquier formato, con **conversión en segundo plano y avance a la vista** | Fase 6 |
| G | YouTube: descargar al añadir el enlace, proyectar sin anuncios, **con subtítulos opcionales** | Fase 7 |
| H | Diapositivas: PDF y PowerPoint, con vista de la siguiente, cuántas faltan y zoom | Fase 8 |
| I | Imágenes y medios en un solo módulo | Decidido: sí (3.1) |
| J | Que la **revisión inicial del equipo** garantice que está todo lo necesario antes de abrir la app | Fase 0 (hecho) |
| K | Un **volumen general** de Manna, sin tocar el del equipo | Base en fase 0; mando en fase 5 |

## 2. Lo que se midió

Datos medidos en el proyecto, no supuestos.

- **Himnos.** `Himnario/` tiene 613 archivos `.mp4` (5,4 GB) con nombre `NNN Título.mp4`: H.264 a 1080p con **dos pistas de audio**. La primera es la cantada; la segunda, la instrumental (confirmado por el dueño). Elegir la pista con ffmpeg, sin recodificar, tarda **0,09 s** para un himno de 3 minutos.
- **Búsqueda en todas las versiones.** Cargar las 14 biblias (430.000 versículos) tarda 1,2 s y ocupa unos 440 MB. Buscar una frase en todas tarda entre 30 y 85 ms sin índice.
- **Conversión de video con ffmpeg** (Mac de desarrollo, M3 Pro, video de 1080p):

  | Caso | Qué hace Manna | Un video de 10 minutos |
  | --- | --- | --- |
  | MP4, M4V o MOV con H.264 (lo habitual de un celular, una cámara o una edición) | Nada: se usa tal cual | 0 s |
  | MKV con H.264 dentro, o elegir otra pista de audio | Cambia el envoltorio, sin recodificar | 1 a 3 s |
  | YouTube a 1080p | Descarga imagen y sonido ya compatibles y los une | Lo que tarde la descarga (1 min aprox. con 20 Mb/s) más 2 s |
  | AVI, MPEG, WMV y otros que el navegador no reproduce | Conversión completa | Entre 30 s (imagen tranquila, 21 veces más rápido que el video) y 4 min (mucho movimiento, 2,6 veces). Con el chip de video, 1,5 min constantes |

  En un equipo Windows de gama media la conversión completa será de 2 a 5 minutos; en uno antiguo, hasta unos 10. **La mayoría de los videos no necesita conversión.**
- **Televisor del dueño: Samsung 55QN85F (Neo QLED, 2025).** Su navegador es reciente, así que debería poder abrir la pantalla de proyección normal. En la prueba no abrió ni `manna.local` ni las dos direcciones numéricas, mientras un iPhone entraba al instante. Que hubiera **dos direcciones** indica que el equipo principal estaba en dos redes: lo más probable es que el televisor esté en una red distinta de las dos (cable a otro router, red de invitados o wifi con aislamiento). Se diagnostica en la fase 3.
- **Video en el navegador.** Chrome reproduce MP4, M4V y MOV con H.264, y WebM. No reproduce AVI, MPEG ni WMV.
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
| `compare` | Comparador | Un versículo por paso | Disposición vertical u horizontal | Fase 2 |
| `image` | Medios | Uno | Ajuste, zoom, desplazamiento | Fase 4 |
| `song` | Himnario | Uno (el video) | Pausa, reinicio, avance; cantado o pista | Fase 5 |
| `video`, `audio`, `youtube` | Medios | Uno | Pausa, reinicio, avance; subtítulos | Fases 6 y 7 |
| `slides` | Diapositivas | Una diapositiva por paso | Zoom, desplazamiento, vista de la siguiente | Fase 8 |

"Cantado o pista" se elige **antes** de proyectar o de añadir al orden (queda guardado en el elemento) y también se puede cambiar al aire.

### 3.3 Cimientos

Lo que varias fases necesitan, construido una sola vez. Dónde quedó cada pieza:

| # | Pieza | Estado | Dónde |
| --- | --- | --- | --- |
| 1 | Cómo se dibuja cada tipo (también en miniatura) | Hecho | `web/core/kinds.js`, `web/modules/kinds.js`, `web/modules/<id>/kind.js`, `web/modules/projection/stage.js` |
| 2 | Mandos en vivo por tipo | Hecho | Espacio `live` del estado y acción `projection.control` (`server/modules/projection/index.js`); `web/modules/projection/live.js` |
| 3 | Reloj de reproducción compartido | Hecho | `server/core/playback.js`, `web/core/playback.js`; la hora del servidor viaja en el latido |
| 4 | Una sola salida de sonido | Base hecha | La pantalla de proyección del equipo principal es la que suena (`sound` en `createStage`). El volumen general está en `live.volume` (acción `projection.volume`). El mando se construye en la fase 5 |
| 5 | Archivos grandes | Hecho | Trozos (Range) y subida directa a disco en `server/core/router.js`; `upload()` con avance en `web/core/api.js` |
| 6 | Carpetas de contenido | Base hecha | `server/core/folders.js` (vigilar y listar), `app.mount()` para servirlas, `data/tmp/` que se vacía al abrir y al cerrar. `Himnario/` y `Medios/` se conectan con su módulo (fases 5 y 6) |
| 7 | Programas externos | Hecho | `server/core/tools.js` e `install.js`; página `/requisitos`; sección en Ajustes |
| 8 | "Más" en la barra de pestañas del celular | **Pasa a la fase 4** | Ver sección 10 |
| 9 | Nombre editable en cualquier elemento del orden | Hecho | `order.rename`, `renameItem` en `server/modules/order/logic.js` |
| 10 | Búsqueda compartida | **Pasa a la fase 1** | Ver sección 10 |
| 11 | Selector de pasajes reutilizable | **Pasa a la fase 2** | Ver sección 10 |
| 12 | Tareas en segundo plano con avance y tiempo restante (añadido) | Hecho | `server/core/jobs.js`, espacio `jobs`; `web/core/jobs.js`; se ven en el panel "Al aire" |

### 3.4 Programas del equipo principal

El código sigue sin dependencias. Lo aprobado son **programas aparte** y una biblioteca dentro del proyecto:

| Qué | Para qué | Nivel |
| --- | --- | --- |
| Node.js 18+ | El servidor | Sin él no arranca (lo comprueba el instalador del icono) |
| Chrome o Edge | Ventana de proyección | Imprescindible: sin él no se entra a la app |
| ffmpeg | Convertir, unir YouTube, pista de los himnos | Necesario para esas funciones |
| yt-dlp | Descargar de YouTube | Necesario para YouTube |
| PowerPoint | Convertir `.pptx` | Opcional: se usa por defecto si está; si no, se pide el PDF |
| pdf.js (Mozilla, Apache 2.0) | Leer PDF en el navegador | Archivo en `web/vendor/`; llega en la fase 8 |

**Revisión del equipo.** Cada vez que Manna se abre comprueba todo lo anterior. Si falta algo se abre en `/requisitos` en vez de en el control: para cada programa dice para qué sirve, ofrece **Instalar por mí** (ffmpeg y yt-dlp, descargados de su sitio oficial a `data/herramientas/`, con comprobación de la huella, sin tocar el sistema) y los pasos para hacerlo a mano. Si falta algo imprescindible, ninguna página de la app se abre. Si falta algo de una función, deja continuar con un clic y vuelve a avisar en el siguiente arranque.

## 4. Fases, en orden

De menor a mayor riesgo; cada fase deja algo usable y **se publica al cerrarla** (decisión 9). Tamaño: S pequeño, M mediano, L grande.

| Fase | Entrega | Tamaño | Versión |
| --- | --- | --- | --- |
| 0 | Cimientos, revisión del equipo e imagen de prueba | M | 1.1 |
| 1 | Búsqueda mejorada | S | 1.2 |
| 2 | Comparador de versiones | M | 1.3 |
| 3 | Pantalla para televisores | M | 1.4 |
| 4 | Medios: imágenes | M | 1.5 |
| 5 | Reproducción y Himnario | L | 1.6 |
| 6 | Medios: videos y audios locales | M | 1.7 |
| 7 | Medios: YouTube | M | 1.8 |
| 8 | Diapositivas | L | 1.9 |
| 9 | Auditoría del proyecto completo | M | 2.0 |

Por qué este orden: búsqueda y comparador usan datos que ya existen; los televisores dependen de pruebas del dueño, que conviene empezar pronto; las imágenes estrenan biblioteca y subidas sin la complejidad del sonido; el himnario estrena la reproducción con archivos que ya son compatibles; YouTube y diapositivas, los que dependen de programas de terceros, al final.

### Fase 0 · Cimientos — hecha (1.1.0)

Construido: la tabla de 3.3, la revisión del equipo de 3.4 y la **imagen de prueba**, que es el "tipo de prueba" que pedía el criterio de cierre y además sirve para encuadrar el proyector o un televisor y ver que las pantallas van a la par.

**Criterio de cierre, cumplido**: todas las pruebas anteriores pasan, y un tipo nuevo se dibuja, se gobierna en vivo, va a la par en dos pantallas y se añade al orden. Resultados y lo que quedó sin probar, en la sección 9.

### Fase 1 · Búsqueda mejorada

Resultados en tres niveles, en este orden:

1. **Frase exacta** (sin importar tildes ni mayúsculas). Primero la versión elegida; después las demás, cada resultado con la versión donde se encontró. El mismo versículo no se repite por versión: se agrupa.
2. **Todas las palabras**, en cualquier orden.
3. **Parecidas**: otras formas de la misma palabra ("amó", "amar", "amor") y una lista corta de sinónimos bíblicos escrita a mano (Señor / Jehová).

En todos se **resalta** lo encontrado. Sin modelo de lenguaje (decisión 4). Para que sea rápida:

- **Índice** de todas las biblias instaladas, hecho en segundo plano al arrancar y rehecho al copiar o borrar una biblia: el texto ya normalizado y un índice de palabras. La primera búsqueda no espera.
- La pieza de búsqueda (normalizar, ordenar por relevancia, resaltar) va en `server/core/search.js` para que el himnario use la misma.
- Buscar mientras se escribe, con una pausa de 150 ms; 50 resultados por nivel con "ver más".
- Si la memoria del equipo de la iglesia es justa, limitar la búsqueda global a unas versiones favoritas elegidas en Ajustes.
- Moverse por los resultados con el teclado y proyectar con Enter.

**Terminado cuando**: una búsqueda en todas las versiones responde en menos de 100 ms en el equipo de desarrollo (medido y anotado), con pruebas del orden de los resultados y del resaltado.

### Fase 2 · Comparador de versiones

- Módulo propio. El selector de pasajes de Biblia (libros, capítulos, versículos) se separa a una pieza reutilizable y los dos módulos la usan.
- Dos selectores de versión y un botón de disposición: lado a lado o una sobre otra. La disposición también se cambia al aire (mando en vivo).
- En pantalla: las dos versiones con una línea fina de separación, cada una con su sigla. El tamaño del texto se ajusta para que quepan.
- En el orden: tipo propio (`compare`), con icono, color y la etiqueta "Comparador", y las dos siglas en la línea secundaria.
- Si un versículo no existe en una de las versiones, ese lado lo indica.

### Fase 3 · Pantalla para televisores

1. **Diagnóstico con el Samsung 55QN85F.** En el televisor: Ajustes → General → Red → Estado de red → Config. IP, y comparar sus tres primeros números con los de la dirección de Manna. Si no coinciden, el televisor está en otra red: esa es la causa. Si coinciden: revisar el puerto (si Manna no pudo usar el 80, hay que escribir `:8000`) y el Firewall de Windows.
2. **Ayuda dentro de Manna**: "Dispositivos" indicará la dirección exacta para escribir en un televisor y, con dos redes, cuál corresponde a cada una; Manna escuchará en el 80 **y** en el 8000 a la vez. La imagen de prueba (fase 0) confirma el encuadre y la sincronía.
3. **Pantalla completa con el mando**: botón grande que se activa con OK. `manna.local` no funciona en la mayoría de televisores: se usa la dirección numérica, y conviene fijarla en el router.
4. **Página sencilla para televisores antiguos** (`/tv`, escrita para navegadores viejos): **solo si** las pruebas muestran que la página normal no abre en algún televisor. El del dueño es de 2025 y no debería necesitarla.
5. **Alternativas sin navegador**, documentadas porque a menudo son mejores: el 55QN85F admite **proyección inalámbrica desde Windows** (Win + K: el televisor pasa a ser la segunda pantalla y Manna abre ahí la proyección sola) y **AirPlay** desde Mac o iPhone; también Chromecast o cable HDMI.

**Límite**: no hay televisor en el equipo de desarrollo. Esta fase se cierra con las pruebas del dueño.

### Fase 4 · Medios: imágenes

- Biblioteca con miniaturas. Se sube desde el equipo principal o desde la galería de un celular (control completo), con barra de avance. La imagen se reduce en el propio dispositivo antes de enviarla.
- Al subir se propone un nombre, que es el que se ve en el orden.
- **Ajuste a pantalla** sobre dos miniaturas: completa con bandas negras, o llenando la pantalla.
- **Al aire**: un recuadro donde se arrastra y se hace zoom (rueda, dos dedos o deslizador); la proyección lo sigue. Botón para volver a la vista completa.
- **Navegación**: con este módulo las pestañas del celular pasan de cuatro; se añade "Más".

### Fase 5 · Reproducción y Himnario

Reproducción (para todo lo que suena): reloj compartido (hecho), pausa, reinicio, avance, y un **control de volumen grande** en el panel "Al aire" y en el orden mientras haya algo con sonido. Es el **volumen general de Manna**: uno solo para todo, sin tocar el del equipo (decisión 6).

Himnario:

- Lee `Himnario/` (`.mp4`, `.m4v`). Avisa si faltan números.
- **Vista en cuadrícula** (nota musical, número, título) y **vista por categorías** (grupos con el nombre grande).
- **Buscador** por número, título y letra, con el índice y el resaltado de la fase 1.
- **Cantado o pista**: se elige antes de proyectar o de añadir al orden, y queda en el elemento. La pista se prepara con ffmpeg en 0,1 s, sin recodificar, en `data/tmp/`.
- En el orden: barra de avance, pausa y reinicio en la propia fila.

**Letras.** Pendiente de acuerdo: ver decisión 5. El buscador indexa las letras que haya en el equipo; sin ellas busca por número y título.

### Fase 6 · Medios: videos y audios locales

- Carpeta `Medios/` (se copian archivos y aparecen) y subida desde la app, con nombre propuesto.
- **Qué se convierte**: nada si el navegador ya lo reproduce; solo el envoltorio si dentro hay H.264 (segundos); conversión completa en el resto, usando el chip de video del equipo si lo tiene. Tiempos en la sección 2.
- **La conversión no detiene nada**: corre en segundo plano como una tarea, con porcentaje y tiempo restante a la vista **en el módulo, junto al elemento, y en el panel "Al aire"**. El elemento se puede añadir al orden mientras tanto; al terminar queda listo para proyectar. El resultado se guarda: se convierte una sola vez.
- Subtítulos de un archivo `.srt` o `.vtt` con el mismo nombre que el video, con el mismo mando que YouTube.
- Audios: se proyecta el fondo con el nombre, y suenan con los mismos mandos.

### Fase 7 · Medios: YouTube

- Se pega el enlace (desde el equipo principal o desde un celular); Manna lo descarga con yt-dlp a 1080p como máximo en `data/tmp/`, como tarea con avance. Se pide imagen H.264 y sonido AAC, que solo hay que unir.
- **Subtítulos**: viable. yt-dlp baja los que tenga el video (los del autor y, si no hay, los automáticos) en formato WebVTT, que lleva los tiempos; el navegador los muestra sincronizados por sí solo. Un mando en vivo los **activa o desactiva** y elige el idioma. Se dibujan con el estilo de la proyección. Los automáticos de YouTube son menos fiables y traen líneas repetidas que hay que limpiar.
- Los archivos se borran al cerrar Manna. Si el elemento sigue en el orden al volver a abrir, se descarga de nuevo cuando se necesite.
- Solo se aceptan enlaces de YouTube, y nunca se pasa texto del usuario a una línea de órdenes.

**Límites**: hace falta internet al añadir el enlace, no al proyectar. yt-dlp deja de funcionar cada cierto tiempo cuando YouTube cambia algo: Ajustes tendrá un botón para actualizarlo. Descargar de YouTube va contra sus condiciones salvo contenido propio o con permiso: úsalo con los videos de la iglesia.

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
| 5 | Letras de los himnos | **Pendiente de acuerdo**: ver nota |
| 6 | Volumen | **Solo el de Manna**, como volumen general de todo lo que suene. No se toca el del equipo |
| 7 | Televisor | Samsung 55QN85F. No abrió con el nombre ni con las dos direcciones; un iPhone sí |
| 8 | Segunda pista de audio de los himnos | **Es la instrumental**: ofrecer "Cantado / Pista" |
| 9 | ¿Publicar al cerrar cada fase? | **Sí** |

**Decisión 5 · Letras.** El dueño pidió copiar las letras de nuevohimnario.com y dar los créditos. No se hizo así, y se le explicó: las letras tienen derechos de autor, citar la fuente no equivale a tener permiso, y el repositorio es público. Lo que el plan sí contempla: el himnario lee las letras de una carpeta local (`Himnario/letras/`, un archivo de texto por himno) que vive solo en el equipo, como las biblias, y las indexa para el buscador. Las letras las aporta quien tenga derecho a usarlas. Queda por acordar con el dueño de dónde saldrán. Sin letras, el buscador funciona por número y título.

**Sobre la condición de la decisión 2.** "Garantizar que el equipo tiene todo" se resolvió así: sin el navegador, la app no se abre; sin ffmpeg o yt-dlp, la revisión aparece en cada arranque pero deja continuar, para que un domingo no se quede la iglesia sin proyectar la Biblia porque falta el programa de YouTube. Si el dueño prefiere que también bloqueen, es cambiar su nivel de `feature` a `required` en `server/core/tools.js`.

## 7. Riesgos

| Riesgo | Cómo se reduce |
| --- | --- |
| "Instalar por mí" no se ha probado en Windows | Probado en Mac con descargas simuladas y con el camino del `.zip`; siempre quedan los pasos a mano. Primera prueba pendiente en el equipo de la iglesia |
| Los sitios de descarga cambian de dirección | Las direcciones están en un solo lugar (`server/core/tools.js`); el error dice que se instale a mano |
| Navegadores de televisor muy antiguos | Página aparte solo si hace falta; alternativas sin navegador documentadas |
| yt-dlp deja de funcionar | Botón de actualizar; mensaje claro; el resto de Manna no depende de él |
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
- [ ] Descargas de programas: solo de las direcciones fijadas en el código, con huella comprobada, y solo a petición desde el equipo principal.
- [ ] Enlaces de YouTube validados.
- [ ] Un dispositivo remoto sin PIN no puede cambiar nada.

**Calidad**
- [ ] Pruebas automáticas para toda la lógica; recorrido completo en Chrome real; auditoría de pantallas limpia.
- [ ] Mensajes de error en español y con qué hacer.
- [ ] Cada pantalla sigue `DESIGN.md`: un acento, iconos de la familia, estados vacío, cargando y error.

**Rendimiento**
- [ ] Arranque, memoria y tiempo de búsqueda medidos y anotados.
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
| 1 Búsqueda | Siguiente | 1.2 | |
| 2 Comparador | Pendiente | 1.3 | |
| 3 Televisores | Pendiente | 1.4 | Necesita pruebas del dueño con el televisor |
| 4 Imágenes | Pendiente | 1.5 | |
| 5 Himnario | Pendiente | 1.6 | Necesita acordar las letras (decisión 5) |
| 6 Videos y audios | Pendiente | 1.7 | |
| 7 YouTube | Pendiente | 1.8 | |
| 8 Diapositivas | Pendiente | 1.9 | PowerPoint oculto: solo se puede probar en Windows |
| 9 Auditoría | Pendiente | 2.0 | |

### Fase 0 · resultados

- **Pruebas automáticas**: de 24 a 51, todas pasan (`npm test`, 1,4 s). Nuevas: trozos de archivo, reloj de reproducción, tareas, nombre propio, instalador de programas (con un sitio de descargas simulado, incluido un `.zip`) y el servidor completo por HTTP (trozos, caché, subidas con límite, salir de la carpeta servida, mandos en vivo, volumen, revisión del equipo).
- **Chrome real** (`scripts/probar-chrome.mjs`): de 28 a 57 comprobaciones, todas pasan. Nuevas: la revisión del equipo de principio a fin (falta un programa → instalar con avance → abrir Manna), nombre propio en el orden, y la imagen de prueba con sus mandos: **el cronómetro marca lo mismo en dos pantallas y coincide con el servidor**.
- **Pantallas** (`scripts/auditar-responsive.mjs`): 9 tamaños, ahora con cuatro pantallas más (mandos en vivo en el panel y en el orden, inicio y revisión del equipo). Sin problemas. Encontró y se corrigió un desborde de los mandos en el panel estrecho de tableta.
- **Sin probar**: "Instalar por mí" con las descargas reales y en Windows; la detección de PowerPoint y de programas en Windows; la subida de un archivo de varios gigas (probado con 21 MB); el sonido (no hay nada que suene hasta la fase 5).

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
| 2026-10-04 | Letras de los himnos: de carpeta local, no copiadas de un sitio web | Derechos de autor (decisión 5, pendiente de acuerdo) |
