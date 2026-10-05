<p align="center"><img src="docs/logo.png" width="112" alt="Logo de Manna"></p>

# Manna - Church projection app

Aplicación web para proyectar en la iglesia. Un equipo principal (el que tiene el proyector) hace de servidor, y cualquier celular, tableta o PC de la misma red local se conecta por el navegador y elige qué función cumplir.

## Qué hace

- **Tres zonas, siempre iguales**: los módulos a la izquierda, el módulo activo al centro y el panel **Al aire** a la derecha, con el monitor de lo proyectado y los mandos (anterior, siguiente, negro, solo fondo).
- **Biblia**: los 66 libros a la vista en una rejilla; capítulos y versículos; pasajes recientes. Lee los archivos `.xmm` (OpenLP) y `.xml` de la carpeta `Contenido/Biblias/`; basta copiar un archivo y aparece solo.
- **Búsqueda**: por cita (`Juan 3:16-18`, `1 co 13 4`, `sal 23`) o por texto, mientras escribes. El texto se busca en la Reina-Valera 1960 (o en la versión elegida, si no está instalada) y el resultado se abre en la versión que tengas elegida. Los resultados salen por niveles (frase exacta, todas las palabras, parecidas), con lo encontrado resaltado, y se pueden limitar al Antiguo o al Nuevo Testamento.
- **Comparador**: el mismo pasaje en dos versiones, lado a lado o una sobre otra, cada una con su sigla. Se elige igual que en Biblia, se proyecta, se añade al orden como elemento propio, y la disposición se puede cambiar mientras está al aire.
- **Orden del culto**: la lista ordenada de todo lo que se va a proyectar, con secciones (Apertura, Mensaje…). Cada elemento muestra su tipo y sus pasos; "Siguiente" recorre los pasos y luego pasa al elemento que sigue. A cualquier elemento se le puede poner un nombre propio ("Lectura bíblica"). Se comparte entre todos los dispositivos.
- **Himnario**: los himnos en video de tu iglesia, en una rejilla por número o agrupados por categorías. Se llega a uno por su número, por su título o por un trozo de su letra; se elige si suena **cantado o solo la pista**, y se gobierna como cualquier video.
- **Medios**: la biblioteca de la iglesia, en pestañas.
  - **Imágenes** (anuncios, carteles, fotos): se suben desde el equipo principal o desde la galería del celular, con el nombre que quieras; se elige si la imagen se ve completa o llenando la pantalla; y, mientras está al aire, se acerca y se desplaza desde el panel.
  - **Videos y audios**: se suben o se copian a `Contenido/Medios/`. Lo habitual se usa tal cual y lo demás se convierte solo, en segundo plano. Al aire: pausa, saltos, barra de avance, subtítulos y el volumen de Manna. Todas las pantallas van a la par y suena una sola.
  - **YouTube**: se pega el enlace de un video y Manna lo descarga una vez, con su título, su imagen y sus subtítulos en español e inglés. Queda en la biblioteca y se proyecta sin anuncios, sin cortes y sin internet, con los mismos mandos que cualquier video.
- **Diapositivas**: las presentaciones de la iglesia, en PDF o en PowerPoint, convertidas en imágenes. Se recorren con «Siguiente», el panel muestra la diapositiva que viene y cuántas quedan, y cada una se puede acercar como una imagen.
- **Fondos**: seis colores y las imágenes que subas, que quedan guardadas junto a ellos en Ajustes.
- **Televisores** (en pausa y fuera de la barra, ver `docs/ESTADO.md`): un televisor Samsung de la misma red muestra la proyección desde su navegador, sin cables. Manna lo encuentra, le abre el navegador y le sirve de control remoto (teclas, puntero y texto); la primera vez le escribe la dirección por ti.
- **Mandos en vivo**: lo que está al aire trae sus propios mandos en el panel y en el orden del culto. Los tienen las imágenes, los videos, las diapositivas y la **imagen de prueba** (Ajustes → Proyector de este equipo), que sirve para encuadrar el proyector o un televisor y comprobar, con su cronómetro, que todas las pantallas van a la par.
- **Revisión del equipo**: al abrirse, Manna comprueba que el equipo principal tiene los programas que necesita. Si falta alguno, dice qué módulos se ven afectados y lo instala con un botón. Nunca impide abrir la app.
- **Preparado para crecer**: cada módulo nuevo aporta su pantalla y un tipo de elemento para el orden del culto.
- **Funciones por dispositivo**: cada dispositivo elige al entrar.
  - **Control completo**: todos los módulos. Pide PIN.
  - **Control del orden**: solo proyecta lo que ya está en el orden del culto. Pensado para el celular. Pide PIN.
  - **Pantalla de proyección**: espejo de la proyección principal. Sin PIN.
- **Celular, tableta y escritorio**: en pantallas estrechas se ve un módulo a la vez, con pestañas abajo y "Al aire" como barra compacta que se despliega.
- **Proyección automática**: al iniciar, detecta la segunda pantalla del equipo principal y abre ahí la proyección a pantalla completa. Si no hay segunda pantalla, lo avisa y no la abre.
- **Apariencia de la proyección**: tipografía, colores, sombra, fondos e imagen propia, con ajuste automático del tamaño del texto para que siempre quepa.
- **Reconexión automática**: si un dispositivo pierde la red o queda en segundo plano, reconecta solo y se pone al día. Si Manna se reinicia, recupera lo que estaba en pantalla.

## Requisitos (solo en el equipo principal)

| Programa | Para qué | Si falta |
| --- | --- | --- |
| Node.js 18 o superior | Hace funcionar el servidor | Manna no arranca. Se descarga de https://nodejs.org/es/download |
| Google Chrome (o Edge en Windows) | Ventana de proyección a pantalla completa | Manna se abre; la proyección no se abre sola en la segunda pantalla |
| ffmpeg | Convertir videos y audios, unir imagen y sonido de YouTube, sacar la pista instrumental de los himnos | Manna se abre; las funciones que lo usan no estarán disponibles |
| yt-dlp | Descargar videos de YouTube | Igual |
| Microsoft PowerPoint (opcional) | Convertir las presentaciones de PowerPoint en diapositivas | Se sube el PDF de la presentación, que no necesita ningún programa |

Solo Node.js se instala antes. Lo demás lo comprueba Manna cada vez que se abre: si falta algo, en vez del control muestra la **revisión del equipo**, que dice qué módulos funcionarán completos y cuáles no, para qué sirve cada programa, y ofrece **Abrir Manna** de todos modos e **Instalar por mí** (descarga ffmpeg y yt-dlp de sus sitios oficiales a la carpeta `data/herramientas/`, sin tocar el sistema) o los pasos para hacerlo a mano. La misma revisión está en **Ajustes → Programas del equipo principal**, y cada módulo avisa al abrirlo si le falta algo. Los demás dispositivos no instalan nada.

ffmpeg lo usa Medios para convertir los videos y audios que el navegador no reproduce; sin él, los MP4 y MP3 habituales funcionan igual. yt-dlp (con ffmpeg) descarga los videos de YouTube; como YouTube cambia a menudo, en **Ajustes → Programas del equipo principal** hay un botón **Actualizar** para ponerlo al día. PowerPoint lo usa Diapositivas para convertir una presentación `.pptx`; es opcional, porque un PDF se convierte en el propio navegador.

## Instalación (una sola vez por equipo)

1. Copia la carpeta de Manna al equipo principal y pon tu contenido en la carpeta `Contenido/` (ver abajo, "La carpeta de tu iglesia").
2. Abre con doble clic el archivo que corresponda:
   - **Windows**: `Instalar Manna en Windows.bat`
   - **Mac**: `Instalar Manna en Mac.command`
3. El instalador comprueba que está Node.js y crea el icono **Manna** en el Escritorio (y en el menú Inicio o en Aplicaciones). Al terminar, abre Manna, que revisa el resto del equipo.

Avisos que pueden salir la primera vez:

- **Windows**: el Firewall pregunta por Node.js. Elige *Permitir acceso* en redes privadas; sin eso los celulares no pueden conectarse.
- **Mac**: si macOS bloquea el instalador, ve a Ajustes del Sistema → Privacidad y seguridad → *Abrir igualmente*. Si pide permiso para leer la carpeta de Manna o para la red local, elige *Permitir*.

Si mueves la carpeta de Manna a otro sitio, vuelve a ejecutar el instalador. Para desinstalar, borra el icono (en Mac, también la app Manna de Aplicaciones) y la carpeta.

## La carpeta de tu iglesia

Todo lo que pone cada iglesia va en una sola carpeta, `Contenido/`. Manna lee lo que encuentra y lo muestra solo, sin importar nada ni reiniciar. Cada subcarpeta trae un `LEEME.txt` con el formato exacto.

| Carpeta | Qué va |
| --- | --- |
| `Contenido/Biblias/` | Las versiones de la Biblia, en `.xmm` o `.xml` |
| `Contenido/Himnario/videos/` | Los himnos en video, uno por archivo: `001 Cantad alegres al Señor.mp4` |
| `Contenido/Himnario/letras/` | Las letras de los himnos y sus categorías, en un archivo de texto `.md` (cómo se escribe, en su `LEEME.txt`) |
| `Contenido/Medios/` | Videos y audios para proyectar. También se pueden subir desde la app; para archivos grandes, copiarlos aquí es lo más rápido |

Al actualizar Manna, conserva `Contenido/` y `data/`; lo demás se reemplaza. Nada de `Contenido/` se publica en GitHub, salvo las instrucciones y la Reina-Valera 1909.

## Uso diario

1. Abre Manna con el icono **Manna**. No aparece ninguna ventana negra: se abre el control en el navegador y, si hay proyector conectado, la proyección en la segunda pantalla.
2. Si cierras la pestaña del control por error, Manna sigue funcionando y la proyección no se interrumpe. Vuelve a pulsar el icono para recuperar el control.
3. Para conectar otro dispositivo, con él en la misma red wifi:
   - escribe **`manna.local`** en su navegador, o
   - escanea el código QR de **Dispositivos**, en la barra izquierda del control (ahí está también el PIN).
4. Para apagar Manna: **Ajustes → Apagar Manna** (solo aparece en el equipo principal).

Al cerrar o recargar la pestaña del control, el navegador pide confirmación para evitar cierres por error.

Si Manna no abre, vuelve a pulsar el icono. Si sigue sin abrir, aparece una página con el motivo; el detalle queda en `data/manna.log`.

### Al actualizar Manna

Si el programa se actualiza con Manna abierto, las pantallas de control muestran el aviso **«Manna se actualizó mientras estaba abierto»**. En el equipo principal, pulsa **Reiniciar ahora**: Manna se cierra y vuelve a abrirse solo, y los demás dispositivos se reconectan sin hacer nada. También vale pulsar otra vez el icono **Manna**, o **Ajustes → Reiniciar Manna**. Hasta reiniciarlo, lo nuevo puede fallar con un mensaje como «Manna no reconoce esa orden».

### Si un dispositivo pierde la conexión

Reconecta solo; no hay que recargar la página. Si el aviso rojo no desaparece:

- Comprueba que el dispositivo sigue en la misma wifi y que Manna está abierto en el equipo principal.
- Si el router se reinició, el equipo principal pudo recibir otra dirección. Los dispositivos que entraron por `manna.local` reconectan solos en un minuto aproximadamente. Los que no admiten ese nombre (Android anterior a la versión 12) deben volver a escanear el código de **Dispositivos**.

### Sobre la dirección `manna.local`

- iPhone, iPad, Mac, Windows 10/11 y Android 12 o posterior entienden este tipo de dirección sin configurar nada (con Manna aún falta comprobarlo en celulares reales). En otros dispositivos, usa el código QR o la dirección numérica que aparece en **Dispositivos**.
- Si el navegador abre una búsqueda en vez de la página, escribe `manna.local/` con la barra final.
- Si no abre en ningún dispositivo: en Windows, permite Node.js en el Firewall para redes privadas; en Mac, revisa Ajustes del Sistema → Privacidad y seguridad → Red local.
- Si otro programa ya usa el puerto 80, Manna usa el 8000 y la dirección pasa a ser `manna.local:8000`. La dirección exacta siempre está en **Dispositivos**.
- **En un televisor**: su navegador suele convertir la dirección en una página segura (`https`). Manna atiende de las dos formas; escribe la dirección completa, por ejemplo `192.168.1.14:8000/proyeccion` (está en **Dispositivos → ¿Es un televisor?**). Si el televisor muestra un aviso de seguridad, elige "Avanzado" y "Continuar": la página es tu propio equipo. Para pantalla completa, pulsa OK en su control.
- Con dos Manna en la misma red, el segundo se llama `manna-2.local`.

### Imágenes

1. En el control, abre **Medios** y pulsa **Subir imágenes** (en el celular se abre la galería). También puedes arrastrar los archivos hasta la pantalla. Admite JPG, PNG, WebP y GIF.
2. Pon a cada una el nombre con el que quieres verla en el orden del culto y pulsa **Subir**. Las fotos grandes se reducen antes de enviarse.
3. Elige una imagen. Abajo, sobre dos miniaturas, decide el ajuste: **Completa** (entera, con bandas negras si no tiene la forma de la pantalla) o **Llenar** (sin bandas, recortando lo que sobre).
4. **Proyectar** (o doble clic), o **Añadir al orden**.
5. Con la imagen al aire, el panel muestra la imagen entera y un recuadro con lo que se ve. Arrástralo para moverlo; acerca con la rueda del ratón, con dos dedos o con el deslizador. **Vista completa** vuelve al principio.

Las imágenes se guardan en la carpeta `data/media/imagenes/` del equipo principal.

### Videos y audios

1. En **Medios**, pestaña **Videos** o **Audios**, pulsa **Subir**. O copia los archivos a la carpeta `Contenido/Medios/` del equipo principal: aparecen solos.
2. Si el formato no es de los habituales (un 4K en HEVC, un MKV, un AVI), Manna le hace una copia que reproduce cualquier pantalla. No hay que esperar: en unos segundos el equipo principal comprueba si puede con el archivo original y, si puede, la tarjeta dice **Ya se puede proyectar desde el equipo principal**. La copia sigue haciéndose de fondo para los celulares y las pantallas remotas, y se detiene sola mientras algo se reproduce. Si el equipo principal no puede con el original, la tarjeta muestra el avance de la conversión y queda listo al terminar.
3. Elige uno y pulsa **Proyectar**: empieza a reproducirse en todas las pantallas a la vez.
4. En el panel **Al aire** están sus mandos: volver al principio, pausar, −10 y +10 segundos, la barra de avance, el **volumen de Manna** y, si el video los tiene, **Subtítulos**.
5. Para ponerle subtítulos a un video: en su menú (⋯), **Añadir subtítulos**, y elige un archivo `.srt` o `.vtt`. En la carpeta, basta un archivo con el mismo nombre que el video.

El sonido sale siempre por el equipo principal, por el dispositivo de audio que tenga elegido: por su ventana de proyección o, si no hay proyector conectado, por su página de control. Nunca se corta de golpe: al pausar, al poner «Negro» o «Solo fondo» y al cambiar lo que hay en pantalla, se desvanece en un instante. «Negro» y «Solo fondo» también pausan lo que suena, y al terminar un video la pantalla pasa sola a «Solo fondo».

### Videos de YouTube

1. En **Medios**, pestaña **YouTube**, pega el enlace del video (el de «Compartir», en YouTube) y pulsa **Añadir**. Se puede hacer desde el equipo principal o desde un celular; quien descarga es el equipo principal, que necesita internet en ese momento.
2. La tarjeta muestra el avance. Mientras tanto puedes seguir usando Manna. Al terminar queda con su título, su imagen y su duración.
3. Desde ahí es un video más: **Proyectar**, **Añadir al orden**, cambiarle el nombre o eliminarlo. Ya no necesita internet.
4. Si el video tiene subtítulos en español o en inglés (los del autor o los automáticos de YouTube), Manna los trae. Con el video al aire, **Subtítulos** los muestra y la lista de al lado elige el idioma.
5. Si la tarjeta dice que no se pudo descargar, explica por qué (es privado, se quitó, no hay internet) y ofrece **Reintentar**. Si falla con todos los videos, actualiza yt-dlp en **Ajustes → Programas del equipo principal → Actualizar**.

Los videos se guardan en `data/media/youtube/` del equipo principal, a 1080p como mucho. Descargar de YouTube solo está permitido con videos propios o con permiso de su autor: úsalo con los de tu iglesia.

### Himnario

1. Copia los videos de los himnos a `Contenido/Himnario/videos/` del equipo principal, uno por himno y con su número delante (`001 Título.mp4`), y el archivo de letras a `Contenido/Himnario/letras/`. Aparecen solos en **Himnario**.
2. Busca el himno: escribe su **número**, parte de su **título** o un trozo de su **letra**. O recórrelos en **Todos** o por **Categorías**.
3. Elige el sonido: **Cantado** (con las voces) o **Pista** (solo la música, para que cante la iglesia). Manna recuerda lo último que elegiste en ese dispositivo.
4. **Proyectar** (o doble clic, o Enter), o **Añadir al orden**. Con el teclado: el número, Enter y Enter.
5. Con el himno al aire, el panel tiene **Cantado / Pista** (se puede cambiar sin perder el punto), pausa, volver al principio, saltos, barra de avance y el volumen de Manna.

**Letra** muestra la del himno elegido. El botón **avisos** aparece si en la carpeta hay algo que revisar: videos que faltan, himnos sin letra o letras cuyo título no es el de su video (esas no se usan, para que nunca salga la letra de un himno en otro).

La pista instrumental necesita ffmpeg en el equipo principal: los videos traen dos pistas de sonido y el navegador solo reproduce la primera, así que Manna prepara al momento una copia con la segunda. Sin ffmpeg, los himnos se proyectan cantados.

### Diapositivas

1. En **Diapositivas**, pulsa **Subir presentación** y elige un **PDF** o un **PowerPoint** (también puedes arrastrarlo hasta la pantalla).
2. Ponle el nombre con el que quieres verla en el orden del culto y pulsa **Subir**.
   - Un **PDF** lo convierte el propio navegador, página a página, con el avance a la vista. Se puede hacer desde un celular.
   - Un **PowerPoint** lo convierte el PowerPoint del equipo principal, de fondo; mientras tanto puedes seguir usando Manna. En Windows no se ve ninguna ventana. En Mac, PowerPoint se abre un momento, y la primera vez macOS pregunta si Manna puede controlarlo: hay que aceptar.
   - Si el equipo principal **no tiene PowerPoint**, guarda la presentación como PDF donde la hiciste (en PowerPoint: Archivo → Exportar → PDF; en Presentaciones de Google: Archivo → Descargar → PDF; en Keynote: Archivo → Exportar a → PDF) y sube el PDF.
3. Elige la presentación: a su lado aparecen sus diapositivas. Toca aquella por la que quieres empezar y pulsa **Proyectar** (o doble clic), o **Añadir al orden** para dejarla preparada.
4. Con una diapositiva al aire, **Siguiente** y **Anterior** (o ← →) las recorren. El panel **Al aire** dice por cuál vas, cuántas quedan y muestra la que sigue; debajo, el recuadro para acercar y desplazar, como en una imagen.

Cada diapositiva queda como una imagen: las **animaciones, las transiciones y los videos incrustados no se conservan**. Si una presentación lleva un video, súbelo aparte a Medios y ponlo en el orden del culto en su sitio. Las diapositivas se guardan en `data/media/diapositivas/` del equipo principal.

### Un televisor como pantalla

> **En pausa.** En la primera prueba con un televisor real, Manna le abrió el navegador pero el televisor no llegó a mostrar la proyección. El módulo no aparece en la barra; lo que sigue describe cómo está pensado y se retomará más adelante.

Sirve para un televisor que está en la misma red y no se puede (o no se quiere) conectar por cable: la salida del equipo principal queda para el proyector.

1. En el control, abre **Televisores** → **Añadir televisor** → **Buscar en la red**. Si no aparece, escribe su dirección (en el televisor: Configuración › Conexión › Red › Estado de red › Configuración IP).
2. El televisor muestra un aviso preguntando si permite a "Manna": acéptalo con su control. Solo lo pregunta la primera vez.
3. Pulsa **Abrir la proyección**: se abre el navegador del televisor.
4. **La primera vez**, abre **Control remoto** → *La primera vez*: entra a la barra de direcciones del navegador del televisor y pulsa *Escribe la dirección de Manna*. Si aparece un aviso de seguridad, "Avanzado" y "Continuar". Cuando veas la proyección, guárdala como **página de inicio** en el menú del navegador del televisor.
5. Desde entonces, **Abrir la proyección** basta. Al terminar, en el menú del televisor (⋯) está **Cerrar el navegador del televisor**.

Conviene fijar en el router la dirección del equipo principal y la del televisor, para que no cambien. Hoy funciona con televisores Samsung (2016 en adelante).

## Atajos de teclado

| Tecla | Acción |
| --- | --- |
| → ← | Siguiente / anterior de lo que está al aire, desde cualquier módulo |
| B | Pantalla en negro |
| C | Solo el fondo, sin texto |
| ↓ ↑ | Mover la selección (versículo en Biblia, elemento en el orden) |
| Enter | Proyectar lo seleccionado (versículo, elemento del orden o imagen) |
| / | Ir al buscador de la Biblia |
| ↓ ↑ en el buscador | Recorrer los resultados |
| Enter en el buscador | Ir al resultado señalado (o al pasaje, si es una cita). Enter otra vez lo proyecta |
| Esc | Cerrar los resultados |
| Mayús + clic | Seleccionar varios versículos seguidos |

"Siguiente" depende de lo que haya al aire: si viene del orden del culto, recorre sus pasos y luego pasa al elemento que sigue; si se proyectó suelto desde la Biblia, continúa con el versículo siguiente.

## Estructura del proyecto

```
Instalar Manna en ….    instaladores del icono (Windows y Mac)
instalacion/            aviso de que falta Node.js, lanzador de Windows e iconos
server/
  index.js, app.js      arranque y lista de módulos
  roles.js              funciones que puede elegir un dispositivo y sus permisos
  core/                 servidor HTTP y https en el mismo puerto (con certificado propio), huella del
                        código (para notar una actualización con Manna abierto), reconocer imágenes, archivos
                        grandes y subidas, cliente WebSocket, estado compartido, tiempo real,
                        sesiones, almacenamiento, reloj de reproducción, tareas con avance,
                        programas del equipo (detección e instalación), carpetas de contenido
                        y búsqueda de texto por niveles (la usan la Biblia y el himnario)
  modules/
    system/             sesiones, PIN, direcciones de red
    bible/              lectura de .xmm/.xml, libros, citas, búsqueda y comparación de dos versiones
    projection/         contenido en vivo, mandos en vivo, volumen, estilos, segunda pantalla,
                        imagen de prueba
    order/              orden del culto: elementos, secciones y pasos
    media/              biblioteca de imágenes, videos y audios: subir, reconocer, convertir con ffmpeg,
                        subtítulos, descargar de YouTube con yt-dlp (youtube.js), y la reproducción
                        a la par en todas las pantallas
    hymns/              el himnario: videos y letras de la carpeta de la iglesia, búsqueda por número,
                        título y letra, y la pista instrumental de cada himno
    slides/             presentaciones convertidas en diapositivas: recibir las páginas de un PDF, pedirle
                        a PowerPoint que exporte las de una presentación (powerpoint.js) y proyectarlas
    tv/                 televisores de la red como pantalla: buscarlos, vincularlos, abrirles
                        el navegador y hacerles de control remoto (samsung.js es lo propio de la marca)
web/
  core/                 estructura de la app, conexión con el servidor, tipos de contenido,
                        reloj, tareas, iconos y estilos base
  modules/              la pantalla de cada módulo (registry.js es la lista) y cómo se dibuja
                        cada tipo de contenido (kinds.js es la lista)
  roles/                una página por función: control, orden, proyeccion, y la revisión del equipo
  vendor/               tipografía Geist, iconos Phosphor, generador de QR y pdf.js (para leer los PDF
                        en el navegador), con sus licencias
DESIGN.md               sistema de diseño de la interfaz
Contenido/              lo de tu iglesia: biblias, himnos en video y letras (no se sube a GitHub,
                        salvo las instrucciones y la RV1909)
data/                   ajustes, PIN, orden del culto, fondos, programas instalados por Manna
                        y archivos temporales de este equipo (no se sube)
test/                   pruebas (npm test)
scripts/                pruebas en un Chrome real, auditoría de pantallas, logo e iconos
docs/ESTADO.md          estado actual: qué funciona, qué falta probar, qué sigue
docs/PLAN.md            plan de trabajo en curso, por fases, y lista de la auditoría final
CHANGELOG.md            historial de cambios por versión
CLAUDE.md, AGENTS.md    instrucciones para asistentes de programación
.claude/                reglas, procedimientos (skills) y automatizaciones de desarrollo
```

### Cómo funciona

- El servidor guarda **todo el estado** (qué se proyecta, estilos, orden del culto). Los dispositivos son vistas.
- Los cambios llegan a todos por un canal en tiempo real (`GET /api/events`).
- El equipo principal se anuncia en la red como `manna.local` (mDNS), sin instalar nada.
- Las órdenes se envían como **acciones** (`POST /api/action`), cada una con un permiso que se comprueba según la función del dispositivo.

### Añadir un módulo

El procedimiento completo está en `.claude/skills/nuevo-modulo/SKILL.md`. En resumen:

1. **Servidor**: `server/modules/<id>/index.js` exporta `setup(app)` y se registra en `server/app.js`. Usa `app.store.register()` para su estado, `app.action()` para sus órdenes y `app.storage()` para guardar datos.
2. **Tipo de contenido**: si aporta algo proyectable, lo registra con `app.kind()`. Con eso sus elementos ya se pueden añadir al orden del culto y recorrer con "Siguiente". Si tiene mandos mientras está al aire (zoom, reproducción), los declara ahí mismo.
3. **Interfaz**: `web/modules/<id>/workspace.js` y una línea en `web/modules/registry.js`. Aparece en la barra de módulos. Cómo se dibuja su tipo de contenido y sus mandos van en `web/modules/<id>/kind.js`.
4. **Aspecto**: siguiendo `DESIGN.md`.

El código no tiene dependencias: no hace falta `npm install`. Los programas externos del equipo principal (ffmpeg, yt-dlp, PowerPoint) se detectan en `server/core/tools.js` y se usan solo desde ahí o, PowerPoint, desde `server/modules/slides/powerpoint.js`. Lo de terceros que va dentro del proyecto (`web/vendor/`) se renueva con `scripts/actualizar-iconos.mjs` y `scripts/actualizar-pdfjs.mjs`.

### Para continuar el desarrollo

Para trabajar en el código no hace falta instalar el icono: `node server/index.js` arranca Manna en la terminal, con los mensajes a la vista, y `npm test` corre las pruebas. `node scripts/demo.mjs` lo arranca con un orden del culto de ejemplo y sin tocar tus datos; con él, `http://localhost:8123/vista-previa` muestra la app en el marco de un celular o una tableta.

Empieza por `CLAUDE.md` y `docs/ESTADO.md`. Las reglas del proyecto están en `.claude/rules/` y los procedimientos (crear un módulo, probar, publicar) en `.claude/skills/`. Son texto plano: sirven igual para una persona que para cualquier asistente de programación. Toda la documentación se actualiza con cada cambio.

## Biblias y derechos de autor

Se incluye la Reina-Valera 1909, de dominio público ([eBible.org](https://ebible.org/spaRV1909/)). Las demás versiones tienen derechos de autor y no forman parte de este repositorio: cada iglesia copia en `Contenido/Biblias/` las que tenga derecho a usar. Lo mismo vale para los himnos en video y sus letras.

## Créditos

- Logo: diseño del autor del proyecto, reconstruido en vector (`instalacion/icono/manna.svg`).
- Tipografía [Geist](https://github.com/vercel/geist-font) (SIL Open Font License).
- Iconos [Phosphor](https://phosphoricons.com) (licencia MIT).
- Lectura de PDF: [pdf.js](https://mozilla.github.io/pdf.js/) de Mozilla (licencia Apache 2.0), incluido en `web/vendor/pdfjs/`.
- Códigos QR: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) de Kazuhiko Arase (licencia MIT).
- Programas que Manna puede instalar en el equipo principal y usa sin incluirlos: [ffmpeg](https://ffmpeg.org) (compilación para Windows de [gyan.dev](https://www.gyan.dev/ffmpeg/builds/)) y [yt-dlp](https://github.com/yt-dlp/yt-dlp).
- Referencias de diseño: [taste-skill](https://github.com/Leonxlnx/taste-skill) y [awesome-design-md](https://github.com/voltagent/awesome-design-md).
