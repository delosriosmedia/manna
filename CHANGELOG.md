# Historial de cambios

Lo más reciente arriba. Cada versión publicada lleva su fecha.

## Sin publicar

## 1.25.2 — 2026-10-17

- Arreglado: desde la 1.24.0, en Windows, Manna cerraba al abrirse cualquier programa de Cloudflare del equipo, también el servicio de Cloudflare que lleva un dominio propio aparte de Manna. Ahora solo se cierra el que abre Manna, y solo cuando Manna se cierra.

## 1.25.1 — 2026-10-17

- El instalador ordena la carpeta desde la que se abre, si es la de Manna (tiene su `Contenido`): sirve para quien actualizaba a mano, borrando y pegando lo de GitHub, aunque su icono «Manna» no apunte a esa carpeta. Antes habría creado otra en Documentos.

## 1.25.0 — 2026-10-17

- **La carpeta Manna, ordenada**: queda solo con los dos instaladores, `Contenido` (lo de la iglesia) y `Programa` (el programa y sus datos), para que nada se borre por error ni confunda al actualizar. Una instalación de antes se ordena sola al actualizar, sin borrar nada: los datos pasan a `Programa/datos` y lo que ya no se usa, a `Programa/antiguo`. Si Documentos está en OneDrive o iCloud, `Programa` va a una carpeta del sistema.
- **Los instaladores llevan el icono de Manna con un engranaje** (en Windows, el de la carpeta Manna es un acceso directo con ese icono).
- El instalador cierra solo el Manna que esté abierto antes de actualizarlo.

## 1.24.1 — 2026-10-17

- Arreglado: al terminar un himno (o un video) sonaba un instante de su principio antes de quedarse parado. Pasaba cuando el archivo acaba una fracción de segundo antes de lo que Manna calculaba.
- Arreglado: en Windows, «Cancelar» una descarga de YouTube no la detenía. Seguía descargando hasta el final, la siguiente en cola esperaba, y al terminar se descartaba.
- Las descargas de YouTube ya no salen en la cola del culto: su avance, con la velocidad, se ve en la ficha de cada video.
- Descargas de YouTube muy lentas: si YouTube frena una descarga, yt-dlp le pide otro enlace y sigue. Si aun así va lenta, Manna lo apunta en su registro (`manna.log`) con lo que dijo yt-dlp, para ver la causa.

## 1.24.0 — 2026-10-17

- **Conexión por internet comprobada de verdad**: «Encendida» ya no quiere decir solo que Cloudflare aceptó la conexión. Cada minuto Manna entra por su propia dirección de internet, como un celular de fuera, y comprueba que contesta él mismo. Si no, Ajustes dice el problema concreto (Cloudflare no llega a Manna y qué puerto poner en su panel, el mismo túnel abierto en otro equipo, o sin internet) y, tras varios fallos seguidos, Manna rehace la conexión solo.
- **El programa de Cloudflare se cierra con Manna**, aunque Manna se cierre de golpe (un cuelgue, el Administrador de tareas). En Windows, al abrirse, Manna cierra además cualquier cloudflared que se hubiera quedado abierto, que bloqueaba su archivo y dejaba el túnel conectado sin Manna detrás.

## 1.23.1 — 2026-10-17

- Arreglado: con algo de la Biblia al aire, abrir la Biblia por primera vez tras cargar la página fallaba a medias. Un trozo suyo se quedaba encima del módulo abierto, otro más con cada toque, y la Biblia no volvía a abrirse hasta reiniciar la página.

## 1.23.0 — 2026-10-17

- **Con el teclado, en toda la pantalla de control**: al abrir un módulo el foco entra en su cajón y al cerrarlo vuelve a su botón; lo mismo con los mandos. Las filas del orden del culto se alcanzan con Tab y se abren con Intro, y la cola del culto y el orden no pierden el foco cuando cambia lo que está al aire. Un lector de pantalla anuncia el resultado señalado de «Buscar en todo», los versículos elegidos y lo que está al aire.
- **Más ligero en un equipo modesto**: la cola del culto y el detalle del orden ya no se rehacen enteros con cada «Siguiente» (con una presentación larga eran hasta 60 miniaturas cada vez), escribir un texto ya no rehace la lista ni la cola en cada tecla, y el cajón cambia de tamaño sin animación.
- **Las etiquetas «al aire»** (y el botón «Al aire» del celular) usan un rojo un poco más oscuro para que su letra blanca se lea mejor.
- Arreglado: si un archivo cambiaba justo mientras Manna lo enviaba, la respuesta podía salir rota.
## 1.22.0 — 2026-10-17

- **Revisión de la interfaz** (fase 20, con las skills de diseño del dueño):
  - Con el teclado, las ventanas y los menús llevan el foco dentro: el cursor entra en el primer campo, ↑ ↓ recorren un menú y Esc lo cierra y vuelve al botón que lo abrió. Los avisos de error se anuncian en el acto a un lector de pantalla.
  - Una palabra muy larga en un texto ya no se sale de la proyección: se parte.
  - Con ratón, muchas categorías de videos pasan a otra línea en lugar de quedar escondidas a un lado.
  - Con «reducir movimiento» en el equipo, una barra sin avance conocido se ve entera y tenue (antes, quieta en un 35 %, parecía un avance).
  - Más legibles: las notas de los menús, los versículos que faltan en una versión y lo ya pasado del orden del culto. En la tableta acostada, el borde del cajón se agarra mejor con el dedo.
- **«Buscar en todo» en columnas** en el escritorio y la tableta acostada: los resultados de Biblia, Himnario y Videos salen uno al lado de otro, y los demás (Medios, Diapositivas, Textos, Páginas web) debajo, en filas. En el celular, como antes.
## 1.21.0 — 2026-10-17

- **Textos, un módulo nuevo** (fase 18): mensajes y **citas con su autor** para proyectar con el fondo y la letra de la Biblia. Se escriben y se guardan en una lista para volver a usarlos; una línea en blanco los parte en pantallas que se pasan con «Siguiente»; la cita va entre comillas, con «— Autor» debajo. Se añaden al orden del culto y aparecen en «Buscar en todo». Solo los crea «Control completo».
## 1.20.0 — 2026-10-17

- **Diapositivas dentro de Medios** (fase 17): Medios queda con Imágenes, Audios y Diapositivas, y Diapositivas sale de la barra de módulos. La pestaña funciona igual que el módulo de antes (subir un PDF o un PowerPoint, elegir por cuál empezar, pasar con PowerPoint), y arrastrar un PDF o un PowerPoint a Medios lo lleva a ella. «Añadir → Diapositivas» del orden del culto abre esa pestaña. El Presentador no cambia.
## 1.19.0 — 2026-10-17

- **Videos, un módulo propio** (fase 16): un botón «Videos» en la barra de módulos, detrás del Himnario, con todos los videos juntos: los subidos, los de la carpeta de la iglesia y los de YouTube. El enlace de YouTube se pega arriba, junto a «Subir videos», y el video descargado entra en la misma lista con su icono; ya no hay pestaña de YouTube. Medios queda con Imágenes y Audios.
- **Categorías de videos**, con el nombre que quieras («Niños», «Domingo»…): se crean arriba de la lista, se renombran y se eliminan sin borrar sus videos, y cada video se pone en una o varias desde su menú (⋯ → Categorías). Tocar una categoría muestra solo sus videos. Se ven igual en todos los dispositivos.
- El **Servicio de alabanza** trae Videos en lugar de Medios, y «Añadir» del orden del culto separa «Video» de «Imagen o audio». «Buscar en todo» agrupa los videos aparte.
- **La Biblia vuelve a verse en una tableta pequeña acostada**: el cajón dejaba ver un solo versículo. En pantallas bajas la cabecera va en una fila, sin «Recientes», y la barra de abajo también.
- **«Mover» y el pellizco también con PowerPoint en vivo** (Windows): al acercar o desplazar la diapositiva, PowerPoint se aparta y se ve la imagen de Manna acercada; al volver a la vista completa («Vista completa» o «Restablecer») o al pasar de diapositiva, PowerPoint sigue en la misma.
- **En la tableta acostada, los botones son más pequeños** (36 px en lugar de 44) y, si la pantalla es baja, las barras se acercan a los bordes: queda más sitio para cada módulo. El Himnario y Medios juntan sus pestañas en una fila, y «Buscar en todo» y el nombre de la función ya no se parten en dos líneas.

## 1.18.2 — 2026-10-16

- **yt-dlp ya no aparece como «Falta» en Mac** después de instalarlo: el de Mac tarda unos segundos en arrancar y Manna lo daba por ausente antes de que respondiera (y avisaba de que «este equipo no lo dejó abrir»).

## 1.18.1 — 2026-10-16

- Por dentro: código repetido unificado y una función sin usar quitada, tras revisar el grafo del proyecto. Nada cambia para quien usa Manna, salvo que un video o audio subido sin nombre ya no se propone como «Imagen» sino como «Sin nombre».

## 1.18.0 — 2026-10-16

- **La barra de abajo se aparta sola** en el escritorio, tras unos segundos sin mover el ratón ni pulsar una tecla, como en un reproductor de video: así se ve entera la proyección. Cualquier movimiento la trae.
- **Node.js para YouTube**: YouTube pide Node.js 22 o más nuevo. Si el del equipo principal es más viejo, la revisión del equipo ofrece instalar el oficial, solo para YouTube y sin tocar el del equipo, y Manna lo pone al día solo.
- **YouTube se arregla solo más a menudo**: si una descarga falla por algo que no es del video, Manna la reintenta sola dos veces, y antes pone al día yt-dlp si hay una versión nueva. También lo comprueba al abrirse con el icono.
- **Se quita «Escuchar aquí»** (oír en el celular lo que está al aire): en un celular de verdad se oía a saltos. «Escuchar» antes de añadir sigue igual.
- En el Presentador del celular ya no queda una barra vacía sobre las diapositivas.

Auditoría del proyecto (fase 9, parte de código):

- **Más seguro**: una orden de instalar un programa que no existe ya no cierra Manna; se rechazan las órdenes que llegan desde otro puerto u otro subdominio; desde internet, fallar el PIN bloquea solo a quien lo falla, no a todos; la pista instrumental de los himnos se prepara de una en una.
- **YouTube**: si el equipo principal tiene un Node.js anterior al 22, el aviso de error dice que hay que actualizarlo (versión LTS de nodejs.org).
- En el celular, con una letra sin música al aire, las barritas de «Historias» marcan bien por qué diapositiva va.
- «Añadir» del orden del culto lleva también **Página web**.
- El Himnario dice «Leyendo el himnario…» mientras llega la lista, en vez de «Aún no hay himnos»; «Espacio en disco» dice «Calculando…»; si no llegan los pasos de un elemento del orden, la ficha ya no se queda cargando.
- Mensajes más claros: un fallo inesperado dice qué hacer; el aviso de la imagen de prueba ya no nombra un botón que no existe; el botón para oír un elemento del orden se llama «Escuchar», como en el resto.
- Documentación al día con lo que hay (instrucciones, diseño, reglas, plan y estado).

## 1.17.0 — 2026-10-16

- **Himnario corregido**: Manna lee el himnario revisado por la iglesia (613 himnos, todos con su letra y sin avisos).
- **Categorías como en el índice del himnario**: las de una misma sección van bajo su nombre.
- **Letras sin música**, una pestaña nueva del Himnario: los himnos en diapositivas (de la carpeta `Contenido/Himnario/diapositivas`), que se pasan a mano mientras se canta. Tras la última diapositiva, «Siguiente» vuelve a la portada del mismo himno: no salta a otro himno ni al siguiente del orden. Con el cajón ancho se ven todas las diapositivas del himno y tocar una la proyecta. Se pueden añadir al orden del culto.

## 1.16.0 — 2026-10-16

- **Menos consumo**: con un video al aire, los paneles de cristal dejan de desenfocar lo que tienen detrás (es lo que más gasta la tarjeta gráfica) y se vuelven algo más opacos. En los celulares, la proyección de fondo ya no reproduce el video (muestra su imagen) salvo que se use «Escuchar aquí»: menos batería y menos red.
- **Espacio en disco** en Ajustes, con **«Limpiar multimedia temporales»**: borra todo lo subido o descargado (YouTube, videos, audios, imágenes, presentaciones y páginas hechas con un archivo), también del orden del culto; nunca la carpeta Contenido ni los fondos.
- **Tamaño de los subtítulos** en Ajustes → Apariencia.
- **PowerPoint en vivo con «Señalar»**: el punto rojo se dibuja encima del pase de PowerPoint, sin mover el ratón del equipo (sin probar aún en Windows).

- **Categorías del Himnario más limpias**: el nombre en una o dos líneas y, debajo, sus números y cuántos himnos tiene, con la flecha siempre en el mismo sitio; la abierta, en cian.
- «Buscar en todo» con más margen interior.
- **Cola del culto**: el botón de plegar se queda arriba a la derecha y cambia de forma (flecha hacia arriba para plegarla; la lista con una flecha hacia abajo para desplegarla).
- La proyección de fondo del control se desvanece en los bordes en vez de cortarse.

- **Mandos siempre a la vista**: en el escritorio, los mandos de lo que está al aire van fijos en la barra de abajo, encima de Anterior y Siguiente (un himno: Cantado/Pista, Letra, pausa y avance; un video: pausa, avance y subtítulos; una imagen o una diapositiva: acercar y «Vista completa»). Ya no hay que abrir «Mandos».
- **«Solo fondo» y «Negro» arriba**, junto a «AL AIRE».
- **«Señalar» y «Mover» también en Control completo, Control del orden y Alabanza**: con una imagen, una diapositiva o una página al aire, el dedo o el ratón señalan o mueven sobre la propia proyección (en el celular, sobre el recuadro de «Historias»).
- La hoja de mandos del celular tiene márgenes y sus filas bajan si no caben.
- Presentador en el escritorio: la anterior y la siguiente, pequeñas, debajo de la grande.

- **YouTube en Windows**: yt-dlp usa el Node de Manna para resolver lo que YouTube le pide en JavaScript (en un equipo sin Deno faltaban formatos o fallaba la descarga). El motivo exacto de un fallo queda en el registro (`manna.log`).
- **Actualizar un programa ya no lo rompe**: el nuevo se prueba (con un minuto de margen, porque en Windows el antivirus lo revisa la primera vez) antes de reemplazar al que funcionaba. Si no arranca, el aviso dice qué hacer.
- **«Escuchar aquí» sin cortes**: suena la propia proyección de fondo del celular, que baja el archivo una sola vez, con una sincronización más tolerante.
- «Escuchar» en el Himnario suena siempre cantado.
- **Presentador con el ratón**: arrastrar sobre la diapositiva para señalar o mover ya no la arrastra como una imagen. Sin el recuadro de zoom viejo: se acerca y se mueve sobre la diapositiva («Mover», «Restablecer»).

## 1.15.0 — 2026-10-16

- **Favoritos en el Himnario**: «Favorito», en la barra de abajo, deja el himno elegido en la nueva vista «Favoritos», con una estrella en su ficha. Los ven todos los dispositivos; los marcan Control completo y Servicio de alabanza.

## 1.14.0 — 2026-10-15

- **PowerPoint en vivo (Windows)**: un PowerPoint lo puede pasar el propio PowerPoint del equipo principal, a pantalla completa en el proyector, con sus videos, animaciones y transiciones. «Siguiente» y «Anterior» se siguen dando desde cualquier celular (y pasan también las animaciones); si alguien la pasa en el equipo, los celulares lo ven; al terminar, Manna sigue con el orden del culto. Los celulares y los televisores ven la foto de cada diapositiva. Un PowerPoint subido desde esta versión viene así; en el menú de la presentación se cambia con «Pasar como imágenes» o «Pasar con PowerPoint». Si PowerPoint falla, se pasa como imágenes y la cola lo avisa.
- Se guarda el PowerPoint original de cada presentación (para pasarla en vivo); se borra al eliminarla.
- Las pruebas en Chrome tardan menos de 3 minutos (antes, 3,5): YouTube y el himnario pasaron al grupo «red».

## 1.13.1 — 2026-10-15

- **Se lee mejor con diapositivas claras**: el texto secundario de lo que flota sobre la proyección (barras, cola, «Preparado», «Historias» y el cajón) es más claro, y la cola del culto, más opaca. Con una diapositiva blanca detrás ya se lee bien.
- Los avisos en rojo claro se leen mejor sobre una fila elegida.
- Las pruebas en Chrome corren en tres grupos a la vez: tardan la mitad (unos 3,5 minutos), y se puede pedir solo uno.

## 1.13.0 — 2026-10-15

- **El Comparador pasa a la Biblia**: ya no es un módulo aparte, sino el botón **«Comparar»**, que deja elegir la segunda versión y la disposición en una fila bajo la cabecera. Lo que ya estaba en el orden del culto se proyecta igual.
- **«Varios» en la Biblia**: elige un tramo de versículos con dos toques, el primero y el último, sin teclado.
- **Mapa del culto**: el Orden tiene una segunda vista que enseña todo el culto de un vistazo, con cuántos pasos tiene cada elemento, lo que ya pasó y por dónde va. Un paso se proyecta tocándolo.
- **Los módulos se adaptan al ancho de su cajón**: todos caben en el estrecho de 440 px, en el ancho y en el celular.
- **Himnario**: con el cajón ancho, la ficha del himno elegido va al lado de la rejilla, con su categoría, su duración y la letra.
- **Ajustes por secciones**: una fila arriba lleva a cada sección, y desde «Programas» se instala lo que falta.
- **Buscar en todo** (botón de la barra de arriba, o **Ctrl K**; ⌘ K en Mac): una sola búsqueda para versículos (una cita como «jn 3 16» o unas palabras), himnos (número, título o letra), imágenes, videos y audios, presentaciones y páginas web. Un toque prepara el resultado en la tarjeta «Preparado», con «Añadir al orden»; un doble toque o Intro lo proyecta. Se cierra al tocar fuera o con Esc. Está en el Control completo y en el Servicio de alabanza.
- **Nueva pantalla de inicio**: cada función en una tarjeta con su icono, y el **PIN en un teclado grande**, cómodo en el celular. El PIN es de **4 números** y entra solo al teclear el cuarto (si alguien tenía uno más largo, Manna pone uno nuevo, que se ve en «Dispositivos»).
- **Presentador**: la diapositiva al aire ocupa todo el sitio que deja la columna de la derecha, sin nada encima. En el celular se pasa **tocándola** (a la derecha avanza, a la izquierda vuelve), y con «Señalar» encendido el toque señala.
- La revisión del equipo, con la piel nueva.
- **Los módulos del celular se abren reducidos, con solo lo esencial**: en la Biblia, la versión, el buscador, la cita y los versículos (antes quedaba versículo y medio); en el Orden, solo la lista; en el Himnario, el buscador y los himnos. Lo demás aparece al ampliar el cajón. En un celular bajo se abre completo, y Ajustes, siempre.
- **El cajón reducido se agranda o se achica arrastrando su borde**: el derecho en el escritorio, el de arriba en el celular, sin tapar nunca la cola ni las barras. Cada dispositivo recuerda su tamaño.
- **Tocar el fondo cierra el cajón** también en el escritorio.
- **Nada se desplaza de lado sin tener nada al lado** (pasaba en el Orden del celular).
- **Himnario por categorías**: aparecen plegadas y se abre solo la que tocas.
- **«Letra»** en los mandos de un himno al aire, para leerla entera en tu dispositivo.
- **Presentador**: la diapositiva anterior al lado de la siguiente, y **«Restablecer»** el zoom junto a «Mover».
- El punto rojo del Presentador también se ve en el fondo del control.
- **Conexión por internet** desde el menú de la función (Control completo): se enciende y se apaga sin ir a Ajustes.
- **Escuchar en el celular** (o en cualquier equipo que no sea el principal): «Escuchar aquí» oye lo que está al aire, y «Escuchar» en el Himnario, en Medios y en el Orden lo oye antes de añadirlo. Solo en ese dispositivo: no cambia nada de lo que suena en la iglesia.
- Las pruebas tardan menos: la revisión de pantallas revisa tres tamaños a la vez y puede revisar solo algunas pantallas, y la prueba más lenta convierte un video más corto.

## 1.12.0 — 2026-10-14

- **La pantalla de control cambia de forma**, segundo paso del rediseño «Escenario»: lo que está al aire ocupa todo el fondo y, encima, flotan los módulos (en un cajón que se abre desde el dock de la izquierda), la **cola del culto** a la derecha y una barra abajo con Anterior, Siguiente, lo que sigue, Solo fondo, Negro, los mandos y el volumen.
- **Preparar y proyectar**: un toque en un elemento de la cola lo deja «Preparado» abajo a la derecha, e **Intro** (o «Proyectar») lo pone en pantalla; un doble toque lo proyecta directamente. Lo que está al aire muestra sus pasos para saltar a cualquiera.
- **En el celular, «Historias»**: arriba se ve lo que está en pantalla, con una marca por cada paso; tocar a la derecha de la imagen avanza y a la izquierda vuelve. Debajo, Al aire / Solo fondo / Negro, el volumen y lo que sigue en tarjetas. Los módulos están todos en el dock de abajo (ya no hay «Más») y suben en un cajón que se cierra tocando fuera.
- **El volumen de Manna está siempre a la vista** en todas las funciones.
- Los mandos de lo que está al aire se abren con «Mandos» y se cierran tocando fuera o con Esc; Esc también cierra el módulo abierto.

## 1.11.0 — 2026-10-14

- **Nueva piel «Escenario»**, primer paso del rediseño: el acento pasa a ser el cian de la M, la letra es Sora, los botones y las fichas son píldoras, y las ventanas, los menús y los avisos son de cristal oscuro. Todo sigue en su sitio: lo que cambia de lugar llega en los próximos pasos.
- **Instalar Manna con un solo archivo**: se descarga «Instalar Manna» para Windows o para Mac y él baja Manna, lo guarda donde no hace falta verlo y crea el icono. Para actualizar, se vuelve a abrir el mismo archivo. **La carpeta de contenido de la iglesia nunca se reemplaza ni se mueve**: en una instalación nueva está en Documentos/Manna/Contenido, y una instalación anterior sigue usando la suya donde está.
- **Conexión por internet dentro de Manna**: se enciende en **Ajustes → Conexión por internet** y desde entonces el icono Manna la abre solo (y «Apagar Manna» la cierra). Ajustes muestra la dirección para copiarla, y admite un dominio propio de Cloudflare. Desaparecen los archivos «Conectar Internet».
- **Desde internet todo pide el PIN**, también la pantalla de proyección: nadie de fuera ve las biblias, los himnos ni los medios sin él.
- cloudflared se instala desde la revisión del equipo con «Instalar por mí», como ffmpeg y yt-dlp.
- **Páginas web**, un módulo nuevo: presentaciones y juegos de internet (Canva, Google Slides, Genially, Kahoot) y archivos HTML propios, proyectados a pantalla completa. Se agregan con su dirección o subiendo el archivo, y se añaden al orden del culto como todo lo demás.
- Al agregar una dirección, Manna dice si la página **se deja mostrar dentro de Manna** (entonces se ve en todas las pantallas) o no (como Kahoot): entonces el proyector la abre en **su propia ventana**, encima de la proyección, y la cierra al pasar a otra cosa. Las direcciones necesitan internet durante el culto.
- Un **archivo HTML propio** se proyecta sin internet y encerrado, sin poder tocar Manna. «Anterior» y «Siguiente» en el panel «Al aire» lo pasan como las flechas del teclado, en todas las pantallas a la vez.
- Seguridad: Manna rechaza cualquier orden que llegue desde otro sitio web o desde una página encerrada.
- Lo que va en **su propia ventana** también se pasa desde el celular: «Anterior» y «Siguiente» le llegan como las flechas del teclado.
- El **Presentador** también presenta páginas web: aparecen en «Biblioteca» y en «Del orden», se ven en grande y se puede **señalar con el dedo** sobre ellas; «Anterior» y «Siguiente» las pasan si es un archivo HTML o va en su propia ventana.

## 1.10.0 — 2026-10-14

- **Presentador de diapositivas**, una función nueva para quien pasa las diapositivas (`/presentador`, con PIN). La presentación se elige del orden del culto o de la biblioteca, o se sube ahí mismo. Muestra en grande la diapositiva que está en pantalla, la siguiente al lado (debajo en el celular) y todas en una cuadrícula: tocar una la proyecta. «Siguiente» no salta al siguiente elemento del orden al llegar a la última.
- **Señalar con el dedo**: en el Presentador, tocar la diapositiva grande marca un punto rojo en la pantalla de proyección, que sigue al dedo y se borra al soltarlo. Cae en el mismo sitio de la diapositiva aunque la pantalla tenga otra forma o esté acercada.
- **Mover y acercar con los dedos** sobre la diapositiva grande del Presentador: pellizcar acerca y arrastrar desplaza, además del recuadro, el deslizador y «Vista completa» de siempre.
- **En iPhone, el orden del culto ya no se cierra con una presentación.** La página se recargaba sola dos o tres veces y Safari acababa diciendo «Ocurrió un problema varias veces», al abrir el orden o al pasar de diapositiva: en la pantalla de un iPhone cada miniatura cargaba la diapositiva a tamaño completo, y con todas a la vez el teléfono se quedaba sin memoria. Ahora las miniaturas del orden cargan siempre la imagen pequeña, en cualquier dispositivo.
- **Diapositivas en Mac: un PowerPoint ya se convierte.** Antes fallaba siempre («PowerPoint no pudo convertir esta presentación»): macOS ya no deja que otro programa entre en la carpeta de PowerPoint, y PowerPoint no exporta imágenes cuando se le pide desde fuera. Ahora PowerPoint guarda un PDF y macOS saca de él las imágenes. La primera vez, PowerPoint pide acceso a una carpeta de Manna: se pulsa «Seleccionar…» y «Conceder acceso», y no vuelve a preguntar. En Windows no cambia nada.
- **Encender y apagar el proyector desde el panel «Al aire»**: en el control del equipo principal, junto a «Al aire», hay un botón que abre o cierra la pantalla de proyección sin ir a Ajustes.
- **Servicio de alabanza**, una función nueva para quienes dirigen los cantos: Himnario, Medios, Orden y Biblia, con el **volumen de Manna siempre a la vista**, suene algo o no (en el celular, bajo la barra de «Al aire»). Puede proyectar, preparar el orden y subir medios, pero no toca los ajustes. Se elige en la pantalla de inicio y pide PIN.
- **Seguridad**: lo que llega a Manna por un túnel o un proxy abierto en el propio equipo principal (para entrar desde internet, por ejemplo) ya no se trata como si fuera el equipo principal. Antes entraba con control completo y sin PIN; ahora pide PIN y no puede ver el PIN ni apagar Manna.
- **Cambiar el PIN cierra todas las demás sesiones**: quien estuviera dentro vuelve a escribirlo. El equipo principal vuelve a entrar solo.
- Manna ya no se cierra si un momento no puede guardar sus datos (disco lleno, o un archivo que otro programa tiene abierto en Windows): sigue y lo guarda en el siguiente cambio. Tampoco si la carpeta de biblias desaparece o una biblia está dañada: esa versión queda sin usar y se anota en el registro.
- En la carpeta de biblias se ignoran los archivos ocultos que crea macOS.
- YouTube: si falta ffmpeg para unir la imagen y el sonido, lo dice.
- Abrir una función que el Manna abierto aún no conoce (porque se actualizó sin reiniciarlo) lo dice en pantalla, en vez de dejar la página en blanco.
- Biblia: al cambiar de capítulo muy deprisa ya no puede quedarse a la vista un capítulo anterior.

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
