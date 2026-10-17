<p align="center"><img src="docs/logo.png" width="112" alt="Logo de Manna"></p>

# Manna - Church projection app

Aplicación web para proyectar en la iglesia. Un equipo principal (el que tiene el proyector) hace de servidor, y cualquier celular, tableta o PC de la misma red local se conecta por el navegador y elige qué función cumplir.

## Qué hace

- **«Escenario»**: lo que está al aire ocupa el fondo de la pantalla y, encima, los módulos (en un cajón que se abre desde el dock de la izquierda), la **cola del culto** (un toque prepara, doble toque proyecta), la tarjeta **Preparado** (Intro la proyecta) y la barra de abajo: anterior, siguiente, lo que sigue, solo fondo, negro, mandos y volumen. En el control del equipo principal, arriba junto al estado, está el botón que **enciende y apaga el proyector**.
- **Buscar en todo** (Ctrl K): versículos, himnos, medios, presentaciones y páginas web en una sola búsqueda. Un toque prepara lo encontrado; doble toque o Intro lo proyecta.
- **Biblia**: los 66 libros a la vista en una rejilla; capítulos y versículos; pasajes recientes. Lee los archivos `.xmm` (OpenLP) y `.xml` de la carpeta `Contenido/Biblias/`; basta copiar un archivo y aparece solo.
- **Búsqueda**: por cita (`Juan 3:16-18`, `1 co 13 4`, `sal 23`) o por texto, mientras escribes. El texto se busca en la Reina-Valera 1960 (o en la versión elegida, si no está instalada) y el resultado se abre en la versión que tengas elegida. Los resultados salen por niveles (frase exacta, todas las palabras, parecidas), con lo encontrado resaltado, y se pueden limitar al Antiguo o al Nuevo Testamento.
- **Comparar** (en la Biblia): el mismo pasaje en dos versiones, lado a lado o una sobre otra, cada una con su sigla. Se elige igual que cualquier pasaje, se proyecta, se añade al orden como elemento propio, y la disposición se puede cambiar mientras está al aire.
- **Biblia al aire**: con un pasaje proyectado, sus mandos (en la barra de abajo; en el celular, en la hoja de mandos) llevan tres botones, para no ir a buscar la cita: **la versión** (la lista de versiones: el mismo pasaje pasa a la que elijas), **comparar** (el mismo pasaje en dos versiones; con una comparación al aire, «Una sola» vuelve a una) y **los versículos** (los números del capítulo, con lo que está al aire marcado: un toque proyecta ese versículo; mantener pulsado, o Mayús y clic, amplía el tramo; las flechas cambian de capítulo). Si el pasaje salió del orden del culto, cambiar la versión o comparar no lo saca del orden: «Siguiente» sigue por el orden, con la versión o la comparación que está al aire, y al pasar al elemento que viene vale la de ese elemento (el elemento del orden no cambia). Elegir otro versículo sí lo saca del orden: «Siguiente» sigue entonces por la Biblia.
- **Orden del culto**: la lista ordenada de todo lo que se va a proyectar, con secciones (Apertura, Mensaje…). Cada elemento muestra su tipo y sus pasos; "Siguiente" recorre los pasos y luego pasa al elemento que sigue. A cualquier elemento se le puede poner un nombre propio ("Lectura bíblica"). Se comparte entre todos los dispositivos. **Órdenes guardados**: el orden de un culto se guarda con un nombre para volver a él más tarde con todos sus elementos, mientras tanto se usa otro; el que no tiene nombre se vacía al cerrar Manna.
- **Himnario**: los himnos en video de tu iglesia, en una rejilla por número o agrupados por categorías (bajo su sección, como en el índice del himnario). Se llega a uno por su número, por su título o por un trozo de su letra; se elige si suena **cantado o solo la pista**, y se gobierna como cualquier video. Con el cajón ancho, la letra del elegido se lee al lado. **Letras sin música**: los mismos himnos en diapositivas, que se pasan a mano mientras se canta; tras la última, «Siguiente» vuelve a la portada del mismo himno.
- **Medios**: toda la biblioteca de la iglesia en un mismo cajón, venga de donde venga: imágenes, videos (también de YouTube), audios y presentaciones. Va **separada por tipo**, cada grupo con su título, su color y cuántos hay, y dentro de cada uno del más antiguo al más reciente; cada elemento lleva la marca de su tipo. Un solo botón **Subir** para cualquier archivo.
  - **Categorías** con el nombre que quieras («Niños», «Domingo»…). **Principal** tiene lo que no está en ninguna; al poner algo en una categoría sale de Principal y queda solo ahí. Se pone **arrastrándolo hasta el nombre de la categoría** (con el dedo, manteniéndolo pulsado un momento) o desde su menú.
  - **Videos**: se suben o se copian a `Contenido/Medios/`, y en la cabecera se **pega el enlace de un video de YouTube**: Manna lo descarga una vez, con su título, su imagen y sus subtítulos en español e inglés, y desde ahí se proyecta sin anuncios, sin cortes y sin internet. Lo habitual se usa tal cual y lo demás se convierte solo, en segundo plano. Al aire: pausa, saltos, barra de avance, subtítulos y el volumen de Manna; todas las pantallas van a la par y suena una sola.
  - **Imágenes** (anuncios, carteles, fotos): se suben desde el equipo principal o desde la galería del celular, con el nombre que quieras; se elige si la imagen se ve completa o llenando la pantalla; y, mientras está al aire, se acerca y se desplaza desde la barra de abajo.
  - **Audios**: se suben o se copian a `Contenido/Medios/`, y se gobiernan como un video.
  - **Presentaciones**: las de la iglesia, en PDF o en PowerPoint, convertidas en imágenes. Se recorren con «Siguiente», la barra de abajo muestra la diapositiva que viene y cuántas quedan, y cada una se puede acercar como una imagen. En Windows, un PowerPoint lo puede pasar **el propio PowerPoint en el proyector**, con sus videos y animaciones, y se sigue pasando desde cualquier celular.
- **Textos**: mensajes (un anuncio, una bienvenida, un motivo de oración) y **citas con su autor**, para proyectarlos con el fondo y la letra de la Biblia. Se guardan para volver a usarlos y se añaden al orden del culto. Una línea en blanco parte un texto largo en pantallas, que se pasan con «Siguiente».
- **Páginas web**: presentaciones y juegos de internet (Canva, Google Slides, Genially, Kahoot) o un archivo HTML propio, a pantalla completa. Una dirección necesita internet durante el culto; si la página no se deja mostrar dentro de Manna, el proyector la abre en su propia ventana. Un archivo HTML se pasa con «Anterior» y «Siguiente» desde cualquier dispositivo.
- **Fondos**: seis colores y las imágenes que subas, que quedan guardadas junto a ellos en Ajustes.
- **Espacio en disco** (Ajustes): cuánto ocupa lo subido o descargado desde Manna (YouTube, videos, imágenes, presentaciones…) y lo libre del disco. **Limpiar multimedia temporales** lo borra todo, también del orden del culto, tras confirmarlo; la carpeta Contenido (himnario, biblias y medios) y los fondos no se tocan.
- **Tamaño de los subtítulos** (Ajustes → Apariencia): para los videos, YouTube y los himnos.
- **Televisores** (en pausa y fuera de la barra, ver `docs/ESTADO.md`): un televisor Samsung de la misma red muestra la proyección desde su navegador, sin cables. Manna lo encuentra, le abre el navegador y le sirve de control remoto (teclas, puntero y texto); la primera vez le escribe la dirección por ti.
- **Mandos en vivo**: lo que está al aire trae sus propios mandos, siempre a la vista en la barra de abajo (en el celular, en su hoja) y en el orden del culto. Con una imagen, una diapositiva o una página al aire, **Señalar** y **Mover** actúan sobre la propia proyección, como en el Presentador. Los tienen las imágenes, los videos, las diapositivas y la **imagen de prueba** (Ajustes → Proyector de este equipo), que sirve para encuadrar el proyector o un televisor y comprobar, con su cronómetro, que todas las pantallas van a la par.
- **Revisión del equipo**: al abrirse, Manna comprueba que el equipo principal tiene los programas que necesita. Si falta alguno, dice qué módulos se ven afectados y lo instala con un botón. Nunca impide abrir la app.
- **Preparado para crecer**: cada módulo nuevo aporta su pantalla y un tipo de elemento para el orden del culto.
- **Funciones por dispositivo**: cada dispositivo elige al entrar, en una tarjeta por función; desde otro dispositivo, el PIN (4 números) se escribe en un teclado grande en pantalla y entra solo.
  - **Control completo**: todos los módulos. Pide PIN.
  - **Presentador de diapositivas**: una sola pantalla para pasar una presentación (del orden, de la biblioteca o subida ahí mismo): la diapositiva al aire en grande (en el celular, se pasa tocándola), la siguiente y todas en cuadrícula, con **señalar con el dedo** en la proyección y mover o acercar con los dedos. Pide PIN. También presenta las **páginas web**, con el puntero.
  - **Servicio de alabanza**: Himnario, Medios, Orden y Biblia, con el volumen de Manna siempre a la vista. Proyecta, prepara el orden y sube medios, pero no toca los ajustes. Pide PIN.
  - **Control del orden**: solo pasa el orden del culto, sin editarlo. Pensado para el celular. Pide PIN.
  - **Pantalla de proyección**: espejo de la proyección principal. Sin PIN.
- **Celular, tableta y escritorio**: en el celular, «Historias»: arriba lo que está en pantalla (tocar a la derecha avanza, a la izquierda vuelve), debajo los modos, el volumen y lo que sigue; los módulos, en el dock de abajo, suben en un cajón reducido con solo lo esencial, que se agranda arrastrando su borde o a pantalla completa con un toque, y se cierra tocando fuera. En el escritorio el cajón estrecho se ensancha arrastrando su borde derecho, y tocar el fondo lo cierra.
- **Escuchar en el celular**: «Escuchar» en el Himnario (siempre cantado), en Medios y en el Orden lo oye antes de añadirlo, solo en ese dispositivo (con audífonos), sin que lo note lo que suena en la iglesia. (Oír en el celular lo que está al aire se quitó el 2026-10-16: en un celular de verdad se oía a saltos.)
- **Barra de abajo** (escritorio, con ratón): se aparta sola tras unos segundos sin mover el ratón ni pulsar una tecla, como en un reproductor de video, para que la proyección se vea entera; cualquier movimiento la trae.
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
| Node.js para YouTube | Lo pide YouTube para dejar descargar: el mismo Node.js de Manna, si es de la 22 o más nuevo; si no, Manna instala uno propio (Windows) y lo pone al día solo | Igual |
| Microsoft PowerPoint (opcional) | Convertir las presentaciones de PowerPoint en diapositivas y, en Windows, pasarlas en vivo | Se sube el PDF de la presentación, que no necesita ningún programa |
| cloudflared (opcional) | La conexión por internet (Ajustes) | Manna funciona igual en la red de la iglesia; la conexión por internet avisa de que falta |

Manna corre con Node.js 18 o superior. Descargar de YouTube necesita Node.js 22 o superior: si el del equipo es más viejo, la revisión del equipo ofrece instalar «Node.js para YouTube» (el oficial, solo para eso, sin tocar el del equipo). Los guiones de pruebas en Chrome también necesitan Node.js 22.
Solo Node.js se instala antes. Lo demás lo comprueba Manna cada vez que se abre: si falta algo, en vez del control muestra la **revisión del equipo**, que dice qué módulos funcionarán completos y cuáles no, para qué sirve cada programa, y ofrece **Abrir Manna** de todos modos e **Instalar por mí** (descarga ffmpeg, yt-dlp y cloudflared de sus sitios oficiales, comprobando su huella, a la carpeta `herramientas` de los datos de Manna, sin tocar el sistema) o los pasos para hacerlo a mano. La misma revisión está en **Ajustes → Programas del equipo principal**, y cada módulo avisa al abrirlo si le falta algo. Los demás dispositivos no instalan nada.

ffmpeg lo usa Medios para convertir los videos y audios que el navegador no reproduce; sin él, los MP4 y MP3 habituales funcionan igual. yt-dlp (con ffmpeg) descarga los videos de YouTube; como YouTube cambia a menudo, Manna lo pone al día solo cuando sale una versión nueva (al abrirse con el icono y antes de reintentar una descarga), y en **Ajustes → Programas del equipo principal** hay un botón **Actualizar** para hacerlo a mano. PowerPoint lo usa Medios para convertir una presentación `.pptx`; es opcional, porque un PDF se convierte en el propio navegador.

## Instalación

Solo hay que descargar **un archivo** (y tener Node.js; ver arriba):

- **Windows**: [Instalar-Manna-Windows.bat](https://github.com/delosriosmedia/manna/releases/latest/download/Instalar-Manna-Windows.bat)
- **Mac**: [Instalar-Manna-Mac.zip](https://github.com/delosriosmedia/manna/releases/latest/download/Instalar-Manna-Mac.zip) (al abrirlo queda `Instalar Manna en Mac.command`)

Ábrelo con doble clic. El instalador comprueba que está Node.js, **baja Manna** de GitHub a la carpeta **Manna** de Documentos y crea el icono **Manna** en el Escritorio (y en el menú Inicio o en Aplicaciones). Al terminar abre Manna, que revisa el resto del equipo.

La carpeta Manna tiene solo cuatro cosas:

| | Qué es |
| --- | --- |
| **Instalar Manna en Windows** / **Instalar Manna en Mac** | Para actualizar Manna: ábrelo y lo pone al día. Llevan el icono de Manna con un engranaje (en Windows es un acceso directo; el archivo que se baja de GitHub la primera vez tiene el icono normal de Windows) |
| **Contenido** | Lo de la iglesia: biblias, himnos y medios (ver «La carpeta de tu iglesia»). **Nunca se reemplaza ni se mueve**: el instalador solo le añade lo que falte (sus instrucciones y la Reina-Valera 1909) |
| **Programa** | El programa y sus datos (PIN, orden del culto, lo subido, `datos/manna.log`). No hace falta abrirla. **No la borres** |

- **Para actualizar Manna**, abre el instalador de esa carpeta (o vuelve a bajarlo): si Manna está abierto lo cierra, reemplaza el programa y no toca los datos ni el contenido.
- Si la carpeta Documentos se sincroniza con **OneDrive o iCloud**, `Programa` va a una carpeta del sistema (`%LOCALAPPDATA%\Manna` o `~/Library/Application Support/Manna`): sus datos cambian a cada rato y pueden pesar gigas. En la carpeta Manna quedan los instaladores y `Contenido`.
- **Si actualizabas a mano** (borrando y pegando lo de GitHub), pon el instalador dentro de tu carpeta, junto a `Contenido`, y ábrelo desde ahí: ordena esa misma carpeta. Desde entonces, para actualizar basta con abrir el instalador de la carpeta.
- Si Manna ya estaba instalado de antes, el instalador lo ordena así sin borrar nada: la carpeta Manna es **la que ya tiene tu `Contenido`** (también una instalación a la antigua, con la carpeta entera del proyecto), los datos pasan a `Programa/datos` y lo de la versión anterior que ya no se usa queda en `Programa/antiguo`. Cuando compruebes que todo funciona, puedes borrar `antiguo`.
- Para desinstalar: borra el icono (en Mac, también la app Manna de Aplicaciones) y la carpeta `Programa`. El contenido de la iglesia queda en su carpeta.

Avisos que pueden salir la primera vez (el archivo no está firmado, porque firmarlo cuesta dinero):

- **Windows**: «Windows protegió su PC» → *Más información* → *Ejecutar de todas formas*. Luego el Firewall pregunta por Node.js: elige *Permitir acceso* en redes privadas; sin eso los celulares no pueden conectarse.
- **Mac**: si macOS no deja abrir el instalador, ve a Ajustes del Sistema → Privacidad y seguridad → *Abrir igualmente*. Si pide permiso para leer una carpeta o para la red local, elige *Permitir*.

Quien desarrolla Manna lo abre desde su copia del proyecto con `node server/index.js`: así usa `data/` y `Contenido/` de esa copia.

## La carpeta de tu iglesia

Todo lo que pone cada iglesia va en una sola carpeta, `Contenido` (en Documentos/Manna; ver «Instalación»). Manna lee lo que encuentra y lo muestra solo, sin importar nada ni reiniciar. Cada subcarpeta trae un `LEEME.txt` con el formato exacto.

| Carpeta | Qué va |
| --- | --- |
| `Contenido/Biblias/` | Las versiones de la Biblia, en `.xmm` o `.xml` |
| `Contenido/Himnario/videos/` | Los himnos en video, uno por archivo: `001 Cantad alegres al Señor.mp4` |
| `Contenido/Himnario/letras/` | Las letras de los himnos y sus categorías, en un archivo de texto `.md` (cómo se escribe, en su `LEEME.txt`) |
| `Contenido/Himnario/diapositivas/` | Los himnos en diapositivas, para «Letras sin música»: una carpeta por himno con el nombre de su video (`001 Cantad alegres al Señor`) y dentro `01.jpg` (la portada), `02.jpg`… |
| `Contenido/Medios/` | Videos y audios para proyectar. También se pueden subir desde la app; para archivos grandes, copiarlos aquí es lo más rápido |

Al actualizar Manna con el instalador, el contenido y los datos no se tocan. Nada de `Contenido/` se publica en GitHub, salvo las instrucciones y la Reina-Valera 1909.

## Uso diario

1. Abre Manna con el icono **Manna**. No aparece ninguna ventana negra: se abre el control en el navegador y, si hay proyector conectado, la proyección en la segunda pantalla.
2. Si cierras la pestaña del control por error, Manna sigue funcionando y la proyección no se interrumpe. Vuelve a pulsar el icono para recuperar el control.
3. Para conectar otro dispositivo, con él en la misma red wifi:
   - escribe **`manna.local`** en su navegador, o
   - escanea el código QR de **Dispositivos**, en el menú de la función (arriba) o en Ajustes (ahí está también el PIN).
4. Para apagar Manna: **Ajustes → Apagar Manna** (solo aparece en el equipo principal).

Al cerrar o recargar la pestaña del control, el navegador pide confirmación para evitar cierres por error.

Si Manna no abre, vuelve a pulsar el icono. Si sigue sin abrir, aparece una página con el motivo; el detalle queda en `manna.log`, en la carpeta de datos (ver «Instalación»).

### Al actualizar Manna

Si el programa se actualiza con Manna abierto, las pantallas de control muestran el aviso **«Manna se actualizó mientras estaba abierto»**. En el equipo principal, pulsa **Reiniciar ahora**: Manna se cierra y vuelve a abrirse solo, y los demás dispositivos se reconectan sin hacer nada. También vale pulsar otra vez el icono **Manna**, o **Ajustes → Reiniciar Manna**. Hasta reiniciarlo, lo nuevo puede fallar con un mensaje como «Manna no reconoce esa orden».

### Conexión por internet

Para usar Manna desde fuera de la iglesia (un celular con datos, otra casa), en el equipo principal: **Ajustes → Conexión por internet → Encender**. Manna lo recuerda: desde entonces, el icono **Manna** abre también la conexión, y **Apagar Manna** la cierra. La primera vez hace falta cloudflared, el programa de Cloudflare: **Revisar el equipo → Instalar por mí**.

- **Desde internet todo pide el PIN**, también la pantalla de proyección: nadie de fuera ve las biblias, los himnos ni los medios de la iglesia sin él. En la red de la iglesia todo sigue igual.
- Sin más, la dirección es de prueba (`…trycloudflare.com`) y cambia cada vez que se abre: Ajustes la muestra con un botón para copiarla.
- **Con un dominio propio**, la dirección es siempre la misma (por ejemplo `https://manna.tuiglesia.org`). En [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) (gratis), *Networks → Tunnels → Create a tunnel* (tipo *Cloudflared*). En *Public Hostname* pon la dirección y, como servicio, `HTTP` y `localhost:80` (o el puerto que muestre Manna). Copia la clave que empieza por `eyJ…` (vale pegar la orden entera) y pégala en **Ajustes → Conexión por internet → Usar un dominio propio**, con la dirección. La clave se guarda solo en el equipo principal y no se vuelve a mostrar.
- **Encendida** quiere decir que funciona de verdad: cada minuto Manna entra por su propia dirección de internet, como un celular de fuera, y comprueba que contesta él mismo. Mientras no lo consigue, Ajustes dice «Comprobando…» o el problema concreto (por ejemplo, que en Cloudflare el servicio del túnel apunta a otro puerto, o que el mismo túnel está abierto en otro equipo), y si falla varias veces seguidas, Manna rehace la conexión solo.
- El programa de Cloudflare que abre Manna vive solo mientras Manna está abierto: si Manna se cierra de cualquier forma (también de golpe, desde el Administrador de tareas), se cierra con él. Un cloudflared que no abrió Manna (por ejemplo, el servicio de Cloudflare de Windows) no se toca.
- Por internet viaja todo lo que se ve: también los videos y las imágenes que cargue un control remoto. Con una conexión lenta, mejor proyectar desde la red de la iglesia.

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

### Órdenes del culto guardados

Al abrir Manna, el orden del culto empieza vacío y **sin nombre**. Solo se guarda el que tiene nombre; el sin nombre se vacía al cerrar Manna (si Manna se reinicia, o se cortó y vuelve a abrirse antes de 15 minutos, conserva lo que tenía).

1. En **Orden**, junto al título, el nombre del orden en uso («Sin nombre») abre **Órdenes guardados**.
2. **Guardar con un nombre** lo deja en la lista; el nombre que se propone es el día, la fecha y la hora («Sábado 18/10/26 19:30»). Sigue en uso, y cada cambio queda guardado solo.
3. **Nuevo orden** empieza otro vacío (si el sin nombre tenía algo, avisa y ofrece guardarlo antes).
4. **Usar** pone otro en uso: todos los dispositivos lo ven en la cola del culto, que muestra su nombre. Lo que está al aire sigue al aire. Si algo de ese orden ya no está en la biblioteca, se quita y se avisa.
5. En el menú (⋯) de un orden guardado: **Cambiar el nombre**, **Duplicar** (para preparar el de la semana siguiente a partir de este) y **Eliminar**.

La función «Control del orden» ve el nombre del orden en uso, pero no cambia de orden.

### Medios y sus categorías

En **Medios** está todo lo que la iglesia proyecta: imágenes, videos (también los de YouTube), audios y presentaciones, en grupos por tipo. **Subir** sirve para cualquier archivo, y también se pueden arrastrar hasta la pantalla.

1. **Nueva categoría**, en la fila de arriba, crea una con el nombre que quieras.
2. Para poner algo en ella, **arrástralo hasta su nombre**. Con el dedo, mantenlo pulsado un momento y luego arrástralo. También desde su menú (⋯): **Mover a una categoría**.
3. Lo que está en una categoría sale de **Principal** y queda solo ahí. Para devolverlo, arrástralo hasta **Principal** o, en su menú, **Sacar de** la categoría.
4. Con una categoría elegida, lo que subas o descargues entra en ella.
5. Con una categoría elegida, su menú (⋯) la renombra o la elimina. Al eliminarla, lo que tenía vuelve a Principal: no se borra nada. Se ven igual en todos los dispositivos.

### Imágenes

1. En el control, abre **Medios** y pulsa **Subir** (en el celular se abre la galería). También puedes arrastrar los archivos hasta la pantalla. Admite JPG, PNG, WebP y GIF.
2. Pon a cada una el nombre con el que quieres verla en el orden del culto y pulsa **Subir**. Las fotos grandes se reducen antes de enviarse.
3. Elige una imagen. Abajo, sobre dos miniaturas, decide el ajuste: **Completa** (entera, con bandas negras si no tiene la forma de la pantalla) o **Llenar** (sin bandas, recortando lo que sobre).
4. **Proyectar** (o doble clic), o **Añadir al orden**.
5. Con la imagen al aire, sus mandos (en la barra de abajo; en el celular, con el botón de los mandos) muestran la imagen entera y un recuadro con lo que se ve. Arrástralo para moverlo; acerca con la rueda del ratón, con dos dedos o con el deslizador. **Vista completa** vuelve al principio.

Las imágenes se guardan en la carpeta `data/media/imagenes/` del equipo principal.

### Videos y audios

1. En **Medios**, pulsa **Subir**. O copia los archivos a la carpeta `Contenido/Medios/` del equipo principal: aparecen solos. También puedes arrastrarlos hasta la pantalla.
2. Si el formato no es de los habituales (un 4K en HEVC, un MKV, un AVI), Manna le hace una copia que reproduce cualquier pantalla. No hay que esperar: en unos segundos el equipo principal comprueba si puede con el archivo original y, si puede, la tarjeta dice **Ya se puede proyectar desde el equipo principal**. La copia sigue haciéndose de fondo para los celulares y las pantallas remotas, y se detiene sola mientras algo se reproduce. Si el equipo principal no puede con el original, la tarjeta muestra el avance de la conversión y queda listo al terminar.
3. Elige uno y pulsa **Proyectar**: empieza a reproducirse en todas las pantallas a la vez.
4. En la barra de abajo están sus mandos: volver al principio, pausar, −10 y +10 segundos, la barra de avance, el **volumen de Manna** y, si el video los tiene, **Subtítulos**.
5. Para ponerle subtítulos a un video: en su menú (⋯), **Añadir subtítulos**, y elige un archivo `.srt` o `.vtt`. En la carpeta, basta un archivo con el mismo nombre que el video.

El sonido sale siempre por el equipo principal, por el dispositivo de audio que tenga elegido: por su ventana de proyección o, si no hay proyector conectado, por su página de control. Nunca se corta de golpe: al pausar, al poner «Negro» o «Solo fondo» y al cambiar lo que hay en pantalla, se desvanece en un instante. «Negro» y «Solo fondo» también pausan lo que suena, y al terminar un video la pantalla pasa sola a «Solo fondo».

### Videos de YouTube

1. En **Medios**, pega el enlace del video en la casilla de arriba (el de «Compartir», en YouTube) y pulsa **Añadir**. Se puede hacer desde el equipo principal o desde un celular; quien descarga es el equipo principal, que necesita internet en ese momento.
2. El video aparece en la lista, con el icono de YouTube, y su tarjeta muestra el avance. Mientras tanto puedes seguir usando Manna. Al terminar queda con su título, su imagen y su duración.
3. Desde ahí es un video más: **Proyectar**, **Añadir al orden**, ponerlo en una categoría, cambiarle el nombre o eliminarlo. Ya no necesita internet.
4. Si el video tiene subtítulos en español o en inglés (los del autor o los automáticos de YouTube), Manna los trae. Con el video al aire, **Subtítulos** los muestra y la lista de al lado elige el idioma.
5. Si una descarga falla por algo que no es del video, Manna la **reintenta sola** dos veces en unos segundos, y antes pone al día yt-dlp si hay una versión nueva (también lo comprueba al abrirse con el icono). Si aun así falla, la tarjeta explica por qué (es privado, se quitó, no hay internet) y ofrece **Reintentar**. Si falla con todos los videos, actualiza yt-dlp en **Ajustes → Programas del equipo principal → Actualizar**: el nuevo se prueba antes de reemplazar al que había, así que si no arranca, el anterior sigue funcionando. El motivo exacto de cada fallo queda en el registro de Manna (`manna.log`).

Los videos se guardan en `data/media/youtube/` del equipo principal, a 1080p como mucho. Descargar de YouTube solo está permitido con videos propios o con permiso de su autor: úsalo con los de tu iglesia.

### Himnario

1. Copia los videos de los himnos a `Contenido/Himnario/videos/` del equipo principal, uno por himno y con su número delante (`001 Título.mp4`), y el archivo de letras a `Contenido/Himnario/letras/`. Aparecen solos en **Himnario**.
2. Busca el himno: escribe su **número**, parte de su **título** o un trozo de su **letra**. O recórrelos en **Todos**, por **Categorías** o en **Favoritos**.
3. Elige el sonido: **Cantado** (con las voces) o **Pista** (solo la música, para que cante la iglesia). Manna recuerda lo último que elegiste en ese dispositivo.
4. **Proyectar** (o doble clic, o Enter), o **Añadir al orden**. Con el teclado: el número, Enter y Enter.
5. Con el himno al aire, la barra de abajo tiene **Cantado / Pista** (se puede cambiar sin perder el punto), pausa, volver al principio, saltos, barra de avance y el volumen de Manna.

**Favorito** (en la barra de abajo, desde Control completo y Servicio de alabanza) deja el himno elegido en la vista **Favoritos**, con una estrella, para todos los dispositivos; otro toque lo quita. **Letra** muestra la del himno elegido. El botón **avisos** aparece si en la carpeta hay algo que revisar: videos que faltan, himnos sin letra o letras cuyo título no es el de su video (esas no se usan, para que nunca salga la letra de un himno en otro).

**Letras sin música** es otra pestaña con los himnos que tienen diapositivas en `Contenido/Himnario/diapositivas/`. Se proyectan como una presentación: **Proyectar** pone la portada y cada «Siguiente» pasa una diapositiva, a mano; tras la última vuelve a la portada del mismo himno (no salta al siguiente del orden ni a otro himno), y en la portada «Anterior» se queda en ella. Con el cajón ancho, la ficha muestra todas sus diapositivas y tocar una la proyecta. Se añade al orden como elemento propio, sin sonido.

La pista instrumental necesita ffmpeg en el equipo principal: los videos traen dos pistas de sonido y el navegador solo reproduce la primera, así que Manna prepara al momento una copia con la segunda. Sin ffmpeg, los himnos se proyectan cantados.

### Diapositivas

1. En **Medios**, pulsa **Subir** y elige un **PDF** o un **PowerPoint** (también puedes arrastrarlo hasta la pantalla).
2. Ponle el nombre con el que quieres verla en el orden del culto y pulsa **Subir**.
   - Un **PDF** lo convierte el propio navegador, página a página, con el avance a la vista. Se puede hacer desde un celular.
   - Un **PowerPoint** lo convierte el PowerPoint del equipo principal, de fondo; mientras tanto puedes seguir usando Manna. En Windows no se ve ninguna ventana. En Mac, PowerPoint se abre un momento. La primera vez hay que aceptar dos avisos: el de macOS, que pregunta si Manna puede controlar PowerPoint, y el de PowerPoint, que pide acceso a una carpeta de Manna («Seleccionar…» y luego «Conceder acceso»). No vuelven a salir.
   - Si el equipo principal **no tiene PowerPoint**, guarda la presentación como PDF donde la hiciste (en PowerPoint: Archivo → Exportar → PDF; en Presentaciones de Google: Archivo → Descargar → PDF; en Keynote: Archivo → Exportar a → PDF) y sube el PDF.
3. Elige la presentación (en el grupo **Presentaciones**): aparecen sus diapositivas, y **Presentaciones** vuelve a la lista. Toca aquella por la que quieres empezar y pulsa **Proyectar** (o doble clic), o **Añadir al orden** para dejarla preparada.
4. Con una diapositiva al aire, **Siguiente** y **Anterior** (o ← →) las recorren. La barra de abajo dice por cuál vas, cuántas quedan y muestra la que sigue; debajo, el recuadro para acercar y desplazar, como en una imagen.

Cada diapositiva queda como una imagen: las **animaciones, las transiciones y los videos incrustados no se conservan**. Si una presentación lleva un video, súbelo aparte a Medios y ponlo en el orden del culto en su sitio. Las diapositivas se guardan en `data/media/diapositivas/` del equipo principal.

**PowerPoint en vivo (solo Windows).** En un equipo principal con Windows y PowerPoint, un PowerPoint subido desde la versión 1.14 lo pasa **el propio PowerPoint**, a pantalla completa en el proyector, encima de la proyección de Manna: con sus **videos, animaciones y transiciones**. Así viene al subirlo; en el menú de la presentación (⋯) se cambia con **Pasar como imágenes** o **Pasar con PowerPoint**.

- **Siguiente** y **Anterior**, desde cualquier dispositivo, los da PowerPoint: pasan también las animaciones. Al terminar la presentación, Manna sigue con lo que venga en el orden del culto.
- Si alguien la pasa en el propio equipo (con el teclado o un control de presentaciones), los celulares lo ven.
- Los celulares, las tabletas y la propia proyección de Manna (debajo de PowerPoint) ven la foto de la diapositiva por la que va. «Señalar» se ve encima del pase con un punto rojo. Con **Mover** (o dos dedos, o la rueda) se acerca: mientras está acercada, PowerPoint se aparta y se ve la imagen de Manna; con **Vista completa**, o al pasar de diapositiva, PowerPoint vuelve. El sonido de sus videos no lo gobierna el volumen de Manna.
- Hace falta la pantalla de proyección abierta (el proyector conectado). Si PowerPoint falla, la presentación se ve como imágenes y la cola del culto lo avisa.
- El PowerPoint original se guarda en `data/presentaciones/` del equipo principal.

### Textos

1. En **Textos**, pulsa **Nuevo texto** y elige **Texto** (un mensaje) o **Cita** (con su autor debajo).
2. Escríbelo. Para que pase en varias pantallas, deja una línea en blanco entre una parte y otra: se pasan con **Siguiente**, como los versículos.
3. **Guardar** lo deja en la lista de la izquierda (en el celular, «Textos» vuelve a ella). También se guarda solo al proyectarlo, al añadirlo al orden o al pasar a otro.
4. **Proyectar** lo pone con el fondo, la letra y los colores de la proyección (Ajustes → Apariencia); la letra se reduce sola para que quepa. La cita va entre comillas y con «— Autor» debajo.
5. Para quitar uno, en su menú (⋯), **Eliminar**.

Solo «Control completo» crea y cambia textos; las demás funciones los proyectan desde el orden del culto.

### Páginas web

1. En **Páginas web**, pulsa **Agregar página** y pega la dirección (por ejemplo, la de una presentación de Canva o la de un Kahoot). Manna la abre un momento para ver cómo se puede mostrar y te lo dice:
   - **Se verá en todas las pantallas**: va dentro de la proyección. Se maneja con el ratón sobre la pantalla de proyección del equipo principal. En Canva conviene el enlace de «Compartir → Insertar».
   - **Se abrirá en su propia ventana**: la página no deja que otra la muestre (Kahoot, por ejemplo). Al proyectarla, el proyector la abre a pantalla completa encima de la proyección, y se cierra al proyectar otra cosa o al poner «Negro». Se maneja con el ratón y el teclado del equipo principal, y desde cualquier dispositivo con **Anterior** y **Siguiente** (le llegan como las flechas); los demás dispositivos ven una tarjeta con su nombre.
2. Para una presentación hecha como página propia, pulsa **Subir un archivo HTML** en la misma ventana. Se proyecta sin internet y, con ella al aire, **Anterior** y **Siguiente** de la barra de abajo la pasan como las flechas del teclado, en todas las pantallas a la vez. Lo que use (imágenes, estilos) debe ir dentro del archivo o en internet.
3. **Proyectar** o **Añadir al orden**, como cualquier otra cosa.

Las direcciones **necesitan internet durante el culto**. Los archivos se guardan en `data/paginas/` del equipo principal.

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
| → ← (o Av Pág / Re Pág) | Siguiente / anterior de lo que está al aire, desde cualquier módulo |
| Ctrl K (⌘ K en Mac) | Buscar en todo: versículos, himnos, medios, presentaciones y páginas |
| B | Pantalla en negro |
| C | Solo el fondo, sin texto |
| ↓ ↑ | Mover la selección (versículo en Biblia, elemento en el orden) |
| Enter | Proyectar lo preparado (la tarjeta «Preparado»: versículo, elemento del orden, himno o imagen) |
| / | Ir al buscador de la Biblia |
| ↓ ↑ en el buscador | Recorrer los resultados |
| Enter en el buscador | Ir al resultado señalado (o al pasaje, si es una cita). Enter otra vez lo proyecta |
| Esc | Cerrar lo de arriba: los resultados, los mandos, «Buscar en todo» o el cajón |
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
                        subtítulos, descargar de YouTube con yt-dlp (youtube.js), las categorías (de
                        cualquier elemento, también las presentaciones) y la reproducción a la par en todas
                        las pantallas. En la web, una pantalla (workspace.js) con un grupo por tipo y
                        arrastrar hasta una categoría (drag.js)
    hymns/              el himnario: videos, letras y diapositivas de la carpeta de la iglesia, búsqueda por
                        número, título y letra, la pista instrumental y las letras sin música
    slides/             presentaciones convertidas en diapositivas (en la web, su grupo de Medios, panel.js, y el Presentador): recibir las páginas de un PDF, pedirle
                        a PowerPoint que exporte las de una presentación o que la pase en vivo (powerpoint.js) y proyectarlas
    texts/              textos y citas para proyectar: guardarlos, partirlos en pantallas (text.js)
    web/                páginas web y archivos HTML: comprobar si una dirección se deja mostrar
                        dentro de otra página y servir los archivos encerrados
    internet/           conexión por internet: abre el túnel de Cloudflare (cloudflared) mientras
                        esté encendida en Ajustes
    tv/                 televisores de la red como pantalla: buscarlos, vincularlos, abrirles
                        el navegador y hacerles de control remoto (samsung.js es lo propio de la marca)
web/
  core/                 estructura de la app, conexión con el servidor, tipos de contenido,
                        reloj, tareas, iconos y estilos base
  modules/              la pantalla de cada módulo (registry.js es la lista) y cómo se dibuja
                        cada tipo de contenido (kinds.js es la lista)
  roles/                una página por función: control, alabanza, presentador, orden, proyeccion, y la revisión del equipo
  vendor/               tipografías Sora y Geist Mono, iconos Phosphor, generador de QR y pdf.js (para leer los PDF
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
3. **Interfaz**: `web/modules/<id>/workspace.js` y una línea en `web/modules/registry.js`. Aparece en el dock de módulos. Cómo se dibuja su tipo de contenido y sus mandos van en `web/modules/<id>/kind.js`.
4. **Aspecto**: siguiendo `DESIGN.md`.

El código no tiene dependencias: no hace falta `npm install`. Los programas externos del equipo principal (ffmpeg, yt-dlp, cloudflared, PowerPoint) se detectan en `server/core/tools.js` y se usan solo desde ahí o, PowerPoint, desde `server/modules/slides/powerpoint.js`. Lo de terceros que va dentro del proyecto (`web/vendor/`) se renueva con `scripts/actualizar-iconos.mjs` y `scripts/actualizar-pdfjs.mjs`.

### Para continuar el desarrollo

Para trabajar en el código no hace falta instalar el icono: `node server/index.js` arranca Manna en la terminal, con los mensajes a la vista, y `npm test` corre las pruebas. `node scripts/demo.mjs` lo arranca con un orden del culto de ejemplo y sin tocar tus datos; con él, `http://localhost:8123/vista-previa` muestra la app en el marco de un celular o una tableta.

Empieza por `CLAUDE.md` y `docs/ESTADO.md`. Las reglas del proyecto están en `.claude/rules/` y los procedimientos (crear un módulo, probar, publicar) en `.claude/skills/`. Son texto plano: sirven igual para una persona que para cualquier asistente de programación. Toda la documentación se actualiza con cada cambio.

## Biblias y derechos de autor

Se incluye la Reina-Valera 1909, de dominio público ([eBible.org](https://ebible.org/spaRV1909/)). Las demás versiones tienen derechos de autor y no forman parte de este repositorio: cada iglesia copia en `Contenido/Biblias/` las que tenga derecho a usar. Lo mismo vale para los himnos en video y sus letras.

## Créditos

- Logo: diseño del autor del proyecto, reconstruido en vector (`instalacion/icono/manna.svg`).
- Tipografías [Sora](https://github.com/sora-xor/sora-font) y [Geist Mono](https://github.com/vercel/geist-font) (SIL Open Font License).
- Iconos [Phosphor](https://phosphoricons.com) (licencia MIT).
- Lectura de PDF: [pdf.js](https://mozilla.github.io/pdf.js/) de Mozilla (licencia Apache 2.0), incluido en `web/vendor/pdfjs/`.
- Códigos QR: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) de Kazuhiko Arase (licencia MIT).
- Programas que Manna puede instalar en el equipo principal y usa sin incluirlos, cada uno con su licencia: [ffmpeg](https://ffmpeg.org) (compilación para Windows de [gyan.dev](https://www.gyan.dev/ffmpeg/builds/), licencia GPL v3), [yt-dlp](https://github.com/yt-dlp/yt-dlp) (Unlicense) y [cloudflared](https://github.com/cloudflare/cloudflared) de Cloudflare (licencia Apache 2.0).
- Referencias de diseño: [taste-skill](https://github.com/Leonxlnx/taste-skill) y [awesome-design-md](https://github.com/voltagent/awesome-design-md).
