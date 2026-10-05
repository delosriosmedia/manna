# Historial de cambios

Lo más reciente arriba. Cada versión publicada lleva su fecha.

## Sin publicar

## 1.9.0 — 2026-10-05

- **Himnario**, un módulo nuevo: los himnos en video de la carpeta de la iglesia (`Contenido/Himnario/videos/`), cada uno en una ficha con su número y su título.
- **Dos vistas**: **Todos**, en una rejilla por número, y **Categorías**, con los himnos agrupados bajo el nombre de cada una.
- **Buscador por número, título y letra**, mientras se escribe y sin importar las tildes. Lo encontrado sale por niveles (frase exacta, todas las palabras, parecidas) con el renglón de la letra donde está, resaltado. Escribir el número y pulsar Enter dos veces proyecta el himno.
- **Cantado o pista**: antes de proyectar o de añadir al orden se elige si el himno suena con las voces o solo con la música, y también se puede cambiar **mientras está al aire**, sin perder el punto. (La pista necesita ffmpeg en el equipo principal; cantados funcionan siempre.)
- **Al aire**, un himno se gobierna como cualquier video: pausa, volver al principio, saltos, barra de avance y el volumen de Manna. En el orden del culto es un elemento propio, con su número y su sonido.
- **Letra**: el botón «Letra» muestra la del himno elegido, por partes (estrofas y coro), para leerla en el control.
- **Las letras y las categorías salen de un archivo de texto** en `Contenido/Himnario/letras/` (su `LEEME.txt` explica cómo se escribe). Manna lo lee solo y lo vuelve a leer al guardarlo. El título de cada himno se muestra con sus tildes y signos.
- **Una letra nunca aparece en el himno equivocado**: la de un número solo se usa si su título es el del video de ese número. Lo que no cuadra (videos que faltan, letras con otro título, himnos sin letra) se dice en el botón **avisos** del himnario.
- En el celular, la barra de abajo muestra **Orden, Biblia, Himnario y Medios**; Comparador, Diapositivas y Ajustes están en «Más».
- Las pruebas ya no hacen sonar nada en el equipo donde se ejecutan.

## 1.8.0 — 2026-10-05

- **Diapositivas**, un módulo nuevo: las presentaciones de la iglesia, en **PDF o en PowerPoint**, convertidas en imágenes, una por diapositiva. Así se ven igual en todas las pantallas.
- **Subir un PDF** desde el equipo principal o desde un celular: el propio navegador convierte cada página y muestra el avance. No hace falta instalar nada.
- **Subir un PowerPoint** (`.pptx`, `.ppt`, `.ppsx`): lo convierte el PowerPoint del equipo principal, de fondo y con su avance a la vista; en Windows, sin que se abra ninguna ventana. Si el equipo no tiene PowerPoint, Manna explica cómo guardar la presentación como PDF.
- **La biblioteca**: a un lado las presentaciones, con su portada; al otro, las diapositivas de la elegida, para empezar por la que haga falta. En el celular se ve una cosa cada vez.
- **Al aire**: «Siguiente» y «Anterior» recorren las diapositivas. El panel dice por cuál va ("Diapositiva 3 de 24"), cuántas quedan y **muestra la que sigue**. Una diapositiva se acerca y se desplaza como una imagen, y la siguiente vuelve a verse entera.
- **En el orden del culto**, una presentación es un elemento con una diapositiva por paso, con sus miniaturas (ligeras: no cargan la imagen grande); tras la última, «Siguiente» pasa al elemento que sigue.
- **Lo que no se conserva**: animaciones, transiciones y videos incrustados. Cada diapositiva queda como una imagen fija.
- En el celular, la barra de abajo muestra cuatro módulos y **«Más»**, que abre Diapositivas y Ajustes.
- Corregido: al terminar de subir algo a Medios, a veces no quedaba elegido lo recién subido.
- El aviso de que falta un programa ya no sale por uno que es opcional (PowerPoint): el módulo lo explica cuando hace falta.

## 1.7.0 — 2026-10-05

- **YouTube en Medios**, en su propia pestaña. Se **pega el enlace** de un video (desde el equipo principal o desde un celular) y Manna lo descarga una sola vez, a 1080p como mucho, con su título, su imagen y su duración. Queda guardado en la biblioteca: se proyecta **sin anuncios, sin cortes y sin internet**.
- **La descarga no detiene nada.** El avance se ve en la tarjeta del video y en el panel "Al aire"; mientras tanto se sigue usando Manna. Si YouTube no deja descargarlo (es privado, se quitó, no hay internet), la tarjeta dice por qué y ofrece **Reintentar**.
- **Subtítulos de YouTube**: Manna trae los que tenga el video en español y en inglés (los del autor o, si no hay, los automáticos, ya sin las líneas repetidas con que llegan). Al aire, el botón **Subtítulos** los muestra y una lista deja **elegir el idioma**.
- Un video de YouTube se **añade al orden del culto** como elemento propio, se renombra y se elimina como cualquier otro video, con los mismos mandos (pausa, saltos, barra, volumen). Pegar dos veces el mismo enlace no lo descarga dos veces.
- Solo se aceptan enlaces de YouTube. Pensado para los videos de la iglesia o los que se tenga permiso para proyectar.
- **Actualizar yt-dlp desde Ajustes**: en "Programas del equipo principal", el botón **Actualizar** vuelve a descargarlo. YouTube cambia a menudo; si las descargas empiezan a fallar, es lo primero que hay que probar.
- Para YouTube hacen falta **yt-dlp y ffmpeg** en el equipo principal (la revisión del equipo ofrece instalarlos) e internet solo en el momento de descargar.
- Los avisos de que falta un programa, en Medios, salen **solo en la pestaña a la que afectan** (el de yt-dlp, en YouTube; el de ffmpeg, en Videos y Audios). En el celular ocupan menos.
- En el orden del culto, **Añadir → Imagen, video o audio** lleva a Medios.

## 1.6.2 — 2026-10-04

- **Un video recién agregado se puede usar al instante.** Si hay que convertirlo (un 4K en HEVC, un MKV…), el equipo principal comprueba solo, en unos segundos, si su navegador lo reproduce tal cual. Si puede, la tarjeta dice **«Ya se puede proyectar desde el equipo principal»** y se proyecta con el archivo original, sin esperar.
- **La copia para celulares y pantallas remotas se hace de fondo.** Esas pantallas muestran la imagen del video hasta que su copia está lista, y entonces la usan sin que nadie haga nada. Las pantallas del equipo principal siguen con el original, a toda su calidad.
- **La conversión es más rápida**: ahora también lee el video con el chip del equipo. Con un video de 4K de 2:24, la copia pasó de 59 a 26 segundos en el equipo de desarrollo.
- **La conversión nunca estorba a lo que se reproduce**: mientras algo suena en pantalla se detiene, y sigue al terminar. Además corre con prioridad baja.
- Si el equipo principal no puede con el original, todo es como antes: se espera a la conversión, con su avance a la vista.

## 1.6.1 — 2026-10-04

- **Quitado el aviso «Toca aquí para que suene»**, que se quedaba en la pantalla de proyección aunque ya estuviera sonando.
- **El sonido sale siempre por el equipo principal**, por el dispositivo de audio que tenga elegido, sin tocar nada: por su ventana de proyección y, si no hay proyector conectado, por su página de control.
- **El sonido ya no se corta de golpe.** Al pausar, al poner «Negro» o «Solo fondo» y al cambiar lo que está en pantalla, se desvanece en un instante. La pantalla y los mandos reaccionan enseguida, sin esperar.
- **«Negro» y «Solo fondo» pausan lo que suena.** Al quitarlos queda en pausa; «Reproducir» lo vuelve a mostrar y sigue.
- **Al terminar un video o un audio**, la proyección pasa sola a «Solo fondo», con un desvanecido.

## 1.6.0 — 2026-10-04

- **Videos y audios en Medios**, cada uno en su pestaña. Se suben desde el equipo principal o desde el celular (varios a la vez, con nombre propuesto y avance), o se **copian a la carpeta `Contenido/Medios/`** del equipo principal y aparecen solos: para archivos grandes es lo más rápido.
- **Lo habitual se usa tal cual** (un MP4 de una cámara, un celular o una edición; un MP3). **Lo demás se convierte solo**, una sola vez y en segundo plano: AVI, MKV, WMV, el video de "alta eficiencia" de un iPhone… El avance se ve en la tarjeta y en el panel "Al aire". El archivo original no se toca. (Para convertir hace falta ffmpeg; sin él, lo habitual funciona igual.)
- **Reproducción**: al proyectar un video o un audio empieza a reproducirse. En el panel "Al aire" y en el orden del culto están sus mandos: **pausa, volver al principio, saltos de 10 segundos y barra de avance**. Todas las pantallas van a la par.
- **Volumen de Manna**: un deslizador grande con silencio, uno solo para todo lo que suene. No toca el volumen del equipo.
- **Suena una sola pantalla**: la de proyección abierta en el equipo principal. Las demás van en silencio, sin eco. Si ninguna puede sonar, el control lo avisa.
- **Subtítulos**: un archivo `.srt` o `.vtt` con el mismo nombre que el video (en la carpeta) o añadido desde su menú; se muestran con un botón mientras el video está al aire.
- Un video o audio se **añade al orden del culto** con su duración. Mientras se convierte ya se puede añadir; se proyecta cuando está listo.
- Cada tarjeta muestra la imagen del video, lo que dura, cuándo se agregó y lo que pesa.
- La demostración trae un video y un audio de ejemplo (si el equipo tiene ffmpeg).
- Las pruebas y la demostración ya no abren su proyección en el proyector de verdad cuando hay uno conectado.

## 1.5.1 — 2026-10-04

- **Corregido: no se podía subir una imagen de fondo** ("upload is not a function"). Estaba roto desde la versión 1.1.
- **Corregido: "No encontrado" al subir imágenes a Medios.** Pasaba cuando Manna se actualizaba estando abierto: la pantalla era la nueva y el programa que atendía, el de antes. Ahora:
  - Manna **nota que se actualizó estando abierto** y lo avisa en todas las pantallas de control, con un botón **Reiniciar ahora** en el equipo principal.
  - **Reiniciar Manna** (también en Ajustes): se cierra y vuelve a abrirse solo; los dispositivos se reconectan y sus páginas se recargan solas.
  - Al **pulsar el icono** con un Manna anterior abierto, el nuevo lo cierra y ocupa su sitio, en vez de mostrar el viejo.
  - Si aun así la pantalla pide algo que el programa abierto no conoce, el mensaje lo dice y cómo resolverlo.
- **Fondos de la proyección**: las imágenes de fondo que subas **quedan guardadas** y aparecen junto a los colores, en Ajustes; se elige entre ellas con un toque y se pueden eliminar. Las fotos grandes se reducen antes de subir. Elegir un color ya no borra la imagen.
- **Medios**: cada imagen dice **cuándo se agregó** ("hoy, 20:34"). Siguen ordenadas de la más reciente a la más antigua.
- En el orden del culto, **Añadir → Imagen** lleva a la biblioteca.
- **Televisores** sale de la barra de módulos mientras está en pausa.

## 1.5.0 — 2026-10-04

- **Medios**, un módulo nuevo, con su primera pestaña: **Imágenes**. Una biblioteca con miniaturas de los anuncios, carteles y fotos de la iglesia. (Videos, Audios y YouTube ya tienen su pestaña y llegan en las próximas versiones.)
- **Subir** desde el equipo principal, desde la galería del celular o arrastrando los archivos hasta la pantalla; varias a la vez. Antes de enviar, Manna propone un nombre para cada una (el que se verá en el orden del culto) y muestra el avance.
- Las fotos grandes **se reducen en el propio dispositivo** antes de subir: una foto de celular llega en segundos y ocupa una fracción.
- **Ajuste a la pantalla**: se elige sobre dos miniaturas de la propia imagen, **Completa** (se ve entera, con bandas negras si hace falta) o **Llenar** (llena la pantalla, recortando lo que sobre). Manna lo recuerda para cada imagen.
- **Al aire**, el panel muestra la imagen entera con un recuadro que marca lo que se ve: se arrastra para moverlo y se acerca con la rueda, con dos dedos o con el deslizador (hasta 5 veces). «Vista completa» lo deshace. Todas las pantallas lo siguen.
- Una imagen se **añade al orden del culto** como elemento propio, con su ajuste.
- **En el celular**, la barra de abajo muestra cuatro módulos y **«Más»**, que abre los demás.
- La demostración (`node scripts/demo.mjs`) trae dos imágenes de ejemplo.

## 1.4.0 — 2026-10-04

- **Televisores**, un módulo nuevo: un televisor de la misma red muestra la proyección desde su navegador, sin cables y sin ocupar la salida del proyector. Manna lo busca en la red, se vincula (el televisor pide permiso una vez), le **abre y le cierra el navegador** y le sirve de **control remoto**: teclas, un panel táctil para el puntero y texto. Por ahora, televisores Samsung.
- **La dirección se escribe sola**: con el teclado del televisor abierto, un botón le teclea la dirección de la proyección. Guardándola como página de inicio del navegador del televisor, después basta con «Abrir la proyección».
- **Manna atiende también por `https`**, que es lo que exigen los navegadores de muchos televisores. Usa un certificado hecho por el propio Manna; el televisor avisa una vez de que no lo conoce y deja continuar. Todas las direcciones de siempre siguen funcionando igual.
- En cada televisor de la lista se ve si está encendido, si tiene el navegador abierto y si ya muestra la proyección. Si llegó a Manna pero se quedó en el aviso de seguridad, Manna lo dice y explica qué pulsar.
- **Pantalla completa con el control del televisor**: en la página de proyección basta pulsar OK. Cuando el televisor abre la proyección que se le pidió, Manna pulsa OK por ti.
- "Dispositivos → ¿Es un televisor?" explica qué escribir y qué esperar.

## 1.3.1 — 2026-10-04

- **Comparador**: cada versículo lleva su número delante en las dos versiones, también cuando se proyecta uno solo.
- **Búsqueda**: se puede buscar en toda la Biblia, solo en el Antiguo Testamento o solo en el Nuevo, con tres botones sobre los resultados. Manna recuerda la elección en cada dispositivo.

## 1.3.0 — 2026-10-04

- **Comparador de versiones**, un módulo nuevo: el mismo pasaje en dos versiones, lado a lado o una sobre otra, cada una con su sigla y separadas por una línea. Se elige igual que en Biblia, viendo los dos textos junto a cada versículo.
- La comparación se proyecta, se añade al **orden del culto** como elemento propio ("Comparador", con sus dos versiones) y avanza versículo a versículo con "Siguiente".
- La **disposición** se elige antes de proyectar y también se cambia mientras está al aire, desde el panel.
- Si a una de las versiones le falta un versículo, la pantalla lo dice en vez de dejar el hueco.
- **La búsqueda de texto se hace ahora solo en la Reina-Valera 1960.** El resultado se abre en la versión que tengas elegida. (Si no tienes la 1960, busca en la versión elegida.)
- **Una sola carpeta para lo tuyo: `Contenido/`.** Ahí van las biblias (`Contenido/Biblias/`), los himnos en video (`Contenido/Himnario/videos/`) y sus letras (`Contenido/Himnario/letras/`). Cada carpeta explica su formato en un `LEEME.txt`. **Si ya tenías biblias en la carpeta `Biblias/`, muévelas a `Contenido/Biblias/`.**
- **Televisores**: Manna atiende también en el puerto 8000, para los navegadores de televisor que no abren una dirección sin puerto. "Dispositivos" lo explica en "¿Es un televisor?".
- "Dispositivos" ya no ofrece direcciones de adaptadores sin red, que no servían.
- Corregido: en tabletas, los resultados de la búsqueda ya no tapan la cabecera cuando esta ocupa dos filas.

## 1.2.0 — 2026-10-04

- **Búsqueda nueva en la Biblia.** Busca mientras escribes, en todas las versiones instaladas a la vez, y ordena lo que encuentra:
  1. **Frase exacta**, sin importar tildes ni mayúsculas.
  2. **Todas las palabras**, en cualquier orden.
  3. **Parecidas**: otras formas de la misma palabra ("amó", "amar", "amor") y sinónimos bíblicos ("Jehová" y "Señor", "caridad" y "amor").
- Lo encontrado va **resaltado**. Cada resultado dice de qué versión es el texto cuando no es la que tienes elegida, y en cuántas versiones más coincide. Un versículo sale una sola vez.
- Al elegir un resultado de otra versión, Manna pasa a esa versión: proyectas lo mismo que leíste.
- Con el teclado: **flechas** para recorrer los resultados, **Enter** para ir al versículo y **Enter** otra vez para proyectarlo. Una cita ("jn 3 16") sigue llevando directo al pasaje.
- Es rápida: milésimas de segundo con 14 versiones. Manna prepara el índice solo al abrirse y cuando copias una biblia nueva.
- **La revisión del equipo ya no bloquea nada.** Si falta un programa, dice qué módulos funcionarán completos y cuáles no, y deja abrir Manna. Dentro, el módulo al que le falte algo avisa al abrirlo y ofrece instalarlo.
- En la barra, "Imágenes" y "Videos" pasan a ser un solo módulo previsto: **Medios**.

## 1.1.0 — 2026-10-04

Primera etapa de la versión 2: los cimientos para los módulos que vienen (himnario, medios, diapositivas).

- **Revisión del equipo.** Cada vez que se abre, Manna comprueba que el equipo principal tiene los programas que necesita: Chrome o Edge, ffmpeg, yt-dlp y PowerPoint. Si falta alguno, en vez del control aparece una página que dice para qué sirve cada uno y cómo instalarlo.
- **"Instalar por mí"**: Manna descarga ffmpeg y yt-dlp de sus sitios oficiales y los guarda en su propia carpeta, sin tocar el sistema, mostrando el avance. (ffmpeg en Mac se instala a mano; la página da la orden.)
- La misma revisión está en **Ajustes → Programas del equipo principal**.
- **Nombre propio para cualquier elemento del orden del culto**: "Lectura bíblica" en vez de "Salmos 23:1-3". El original sigue a la vista debajo, y se recupera dejando el nombre vacío. Antes solo se podían renombrar las secciones.
- **Imagen de prueba** (Ajustes → Proyector de este equipo → Mostrar imagen de prueba): un encuadre con bordes y esquinas, barras de color o blanco, para ajustar el proyector o un televisor. Su cronómetro debe marcar lo mismo en todas las pantallas.
- **Mandos de lo que está al aire.** El panel "Al aire" y el detalle del elemento en el orden muestran los mandos propios de lo que se proyecta. Hoy los usa la imagen de prueba; los usarán las imágenes (zoom), los himnos y los videos (pausa, avance, volumen).
- **Tareas con avance.** Lo que el equipo principal tarda en preparar (hoy una instalación; después, convertir un video o descargarlo) se ve en el panel "Al aire" con su porcentaje y el tiempo que falta, sin detener la app.
- Al abrir el orden del culto, la lista se coloca en lo que está al aire.
- La app carga más rápido al volver a entrar: el navegador ya no vuelve a descargar lo que no cambió.
- Por dentro: el servidor ya entrega archivos por trozos (lo que necesita un video para saltar a un punto) y recibe subidas grandes directamente a disco.

## 1.0.0 — 2026-10-04

Primera versión estable.

- **Logo de Manna** en toda la app: en la barra de módulos, la pantalla de inicio, "Acerca de" en Ajustes, la pestaña del navegador, el icono del Escritorio (Windows y Mac) y al añadir Manna a la pantalla de inicio del celular.
- **La versión se ve junto al logo.**
- En el orden del culto, **un segundo clic sobre un elemento lo recoge**. Recogido se queda así hasta que elijas otro; antes solo se cerraba al seleccionar un elemento distinto.
- **Interfaz rediseñada por completo.** Tres zonas fijas: los módulos a la izquierda, el módulo activo al centro y el panel "Al aire" a la derecha, con el monitor de lo proyectado y los mandos siempre a la vista. Aspecto nuevo, con tipografía e iconos propios.
- **Módulo Biblia** con todo el espacio para elegir el pasaje: buscador, pasajes recientes, los 66 libros en una rejilla, capítulos y versículos. La vista previa de lo seleccionado aparece en el panel.
- **Orden del culto** (antes "Guion de culto") con su propia pantalla: secciones, reordenar arrastrando, añadir una cita escribiéndola, y los pasos de cada elemento en miniaturas. Los títulos largos se leen enteros.
- **"Siguiente" recorre el orden**: avanza por los versículos de un pasaje y luego pasa al elemento que sigue.
- **Versión para celular y tableta**: un módulo a la vez con pestañas abajo, "Al aire" como barra que se despliega, y la Biblia por pasos (libro, capítulo, versículos).
- La función "Control del guion" pasa a llamarse **"Control del orden"**. El guion que ya tenías se conserva.
- Los estilos de la proyección, el proyector y **Apagar Manna** están ahora en **Ajustes**.
- Himnario, Imágenes, Videos y Diapositivas ya aparecen en la barra, atenuados: son los próximos módulos.
- Corregido: tras cambiar varias veces de pantalla o de función en la misma pestaña, la app podía dejar de cargar.

## 0.3.0 — 2026-10-03

- **Manna se abre con un icono.** Un instalador de un solo paso (`Instalar Manna en Windows.bat` / `Instalar Manna en Mac.command`) crea el icono "Manna" en el Escritorio. Al pulsarlo, Manna arranca sin ventana negra y abre el control en el navegador. Sustituye a los archivos "Iniciar Manna".
- Pulsar el icono con Manna ya abierto solo vuelve a mostrar el control; no abre otra copia. Cerrar la pestaña del control ya no apaga nada.
- **Botón "Apagar"** en el control, solo en el equipo principal.
- Si Manna no puede abrir, aparece una página con el motivo; el detalle queda en `data/manna.log`.
- Icono propio también en la pestaña del navegador.
- **Dirección corta `manna.local`**: los dispositivos pueden entrar escribiendo `manna.local` en el navegador, sin números. Manna usa el puerto 80 para no tener que escribir `:8000`; si ese puerto está ocupado, sigue usando el 8000.
- **El cambio de IP ya no corta a los dispositivos**: quien entra por `manna.local` reconecta solo (en un minuto aproximadamente) si el router le da otra dirección al equipo principal, sin recargar ni volver a escribir el PIN.
- El código QR sigue llevando la dirección numérica, que funciona en cualquier dispositivo; al abrirla, la página pasa sola a `manna.local` si el dispositivo lo admite.
- Si hay dos Manna en la misma red, el segundo toma el nombre `manna-2.local` para no pisarse.
- **Reconexión más robusta**: los dispositivos detectan en unos 30 segundos una conexión que quedó "congelada" (wifi caída, router reiniciado) y reconectan solos. Al volver reciben todo el estado, sin recargar la página.
- Si la conexión no vuelve, el control explica qué revisar y ofrece un botón "Reintentar". La pantalla de proyección mantiene lo último que mostró, sin mensajes a la vista del público.
- Si Manna se cierra y se vuelve a abrir en menos de 15 minutos, recupera lo que estaba en pantalla.
- Pulsar un botón sin conexión avisa de inmediato en español, en lugar de quedarse esperando.
- **Confirmación al cerrar**: el navegador pide confirmar antes de cerrar o recargar la pestaña del control o del guion.
- **Un solo código QR** en "Dispositivos": el de la dirección recomendada. Si el equipo está en más de una red, las otras direcciones quedan como alternativa plegada.
- **Doble clic**: la lista de versículos ya no se mueve al hacer clic, así que el doble clic proyecta el versículo correcto. Con las flechas la lista solo se desplaza si el versículo no está a la vista.
- Dios Habla Hoy (`.xmm`): ya no aparecen 332 versículos con el texto "(TEXT OMITTED)".
- Estructura de trabajo para desarrollo asistido: `CLAUDE.md`, `AGENTS.md`, `.claude/` (reglas, skills, hook de pruebas, permisos), `docs/ESTADO.md` y este historial.
- La carpeta local del proyecto pasa a llamarse `Manna`.

## 0.2.0 — 2026-10-03

Reescritura como aplicación de red local.

- Servidor Node sin dependencias: estado central, tiempo real (SSE) y acciones con permisos.
- Estructura por módulos (`system`, `bible`, `projection`, `playlist`) en servidor y web.
- Biblias desde la carpeta `Biblias/` en formatos `.xmm` y `.xml`, con limpieza de notas y títulos.
- Citas por posición: cambiar de versión mantiene el pasaje. Rangos de versículos.
- Búsqueda por cita con abreviaturas o por palabras sin tildes.
- Roles: control completo, control del guion y pantalla de proyección. PIN para los de control.
- Ventana de proyección automática en la segunda pantalla, con encendido y apagado.
- Texto con ajuste automático. Imagen de fondo guardada como archivo.
- Lanzadores para Mac y Windows con comprobación de requisitos.
- Reina-Valera 1909 (dominio público) como biblia incluida.

## 0.1.0 — 2026-09-30

Versión inicial generada con Gemini: app de un solo navegador, biblias importadas a mano en IndexedDB, ventana de proyección emergente.
