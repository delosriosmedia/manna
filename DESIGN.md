# Sistema de diseño de Manna

Cómo se ve y se siente la interfaz de control de Manna, y por qué. Lo lee quien vaya a crear o tocar una pantalla, sea una persona o un asistente. Los valores viven en `web/core/app.css`; este documento explica las reglas para usarlos.

**Rediseño «Escenario» en curso** (fase 13 de `docs/PLAN.md`, decisión 32). Están aplicadas la parte 1, la piel (color, letra, formas y cristal: secciones 2, 4 y 5), la 2, la estructura de capas (secciones 7 y 12), la 3, «Buscar en todo», la 4, los módulos medidos por su cajón, la 5, las funciones (Inicio y PIN, Presentador, revisión del equipo), y la 6, los ajustes del dueño (PIN de 4 cifras, cajones que se redimensionan y versión reducida con lo esencial, escuchar en el celular). Falta la 7, pruebas y documentos, descrita en el plan.

Referencias: [taste-skill](https://github.com/Leonxlnx/taste-skill) (disciplina contra el aspecto genérico) y [awesome-design-md](https://github.com/voltagent/awesome-design-md) (este formato, y los sistemas de Linear, Raycast y Spotify).

## 1. Carácter

Manna es una **herramienta de operación en vivo**: la usa un voluntario, durante una reunión, con el tiempo justo y a veces a oscuras junto al proyector. No es una página de presentación.

- **El contenido manda.** La interfaz es oscura y neutra; el color lo pone lo que se proyecta.
- **Memoria muscular.** Cada cosa está siempre en el mismo sitio. Nada se mueve solo, nada parpadea.
- **Densa pero tranquila.** Mucha información a la vista, separada por líneas finas y espacio, no por cajas.
- **Sin sorpresas en directo.** Lo que está al aire es inconfundible y los mandos para gobernarlo están siempre a la vista.

Diales (escala de taste-skill): variedad 3, movimiento 3, densidad 7.

## 2. Color

Solo modo oscuro: se usa junto a un proyector, y un panel claro deslumbra.

| Ficha | Valor | Uso |
| --- | --- | --- |
| `--canvas` | `#05070a` | Suelo de la app. Nunca negro puro. |
| `--s1` `--s2` `--s3` | `#0c0f14` `#131720` `#1b202a` | Escalera de superficies sólidas: paneles, controles, estado activo o pulsado. |
| `--line` `--line-2` | `#1e2430` `#2b3341` | Líneas de 1 px: separadores y bordes. |
| `--glass-1` `--glass-2` `--glass-3` | 55 %, 74 % y 92 % de opacidad | **Cristal** para lo que flota: barras y fichas, cajones (también la cola del culto), y hojas (ventanas, menús, avisos). Con `--glass-line` de borde y `--blur-1` / `--blur-2` de desenfoque. Lo que flota sobre la proyección, que puede ser una diapositiva blanca, lleva el texto secundario más claro (`--ink-3` pasa a `#cdd3dd` en barras, dock, cola, «Preparado» e «Historias», y a `#b9c1cd` en el cajón): así se lee a 4,5:1 sobre blanco y sobre negro (lo mide la auditoría). |
| `--ink` `--ink-2` `--ink-3` | `#f1f4f8` `#c4cbd6` `#9aa3b2` | Texto principal, de lectura y secundario. |
| `--ink-4` | `#5b6375` | Solo decorativo o deshabilitado: no alcanza el contraste mínimo. |
| `--accent` `--accent-hover` | `#5ce8ff` `#8af0ff` | **El único acento**, el cian de la M: selección, acción principal, foco. |
| `--live` `--live-ink` | `#e0383e` `#ffaaad` | **Rojo: solo "al aire"** y acciones destructivas. |

Reglas:

- **Un acento, el cian de la M.** Si algo necesita destacar y no es selección, acción principal ni foco, no se colorea: se resuelve con peso o posición.
- **Rojo significa "al aire".** Un borde rojo en un monitor, una fila o una miniatura quiere decir que eso se está proyectando. No se usa para adornar.
- **El color por tipo vive solo en el icono del elemento** (`.kind.k-<tipo>`): azul Biblia, violeta himno, verde imagen, coral video, arena diapositivas, verde claro páginas. Nunca en botones, textos ni fondos de panel.
- **Cristal solo en lo que flota** (ventanas, menús, avisos y, desde la parte 2, todo lo que va sobre la proyección). Donde el navegador no desenfoca (televisores, celulares viejos), las fichas de cristal pasan solas a sólidas (`@supports` en `app.css`), para que el texto se siga leyendo.
- Sombras solo en lo que flota.
- Texto sobre cian: `--on-accent`. Texto rojo sobre oscuro: `--live-ink`. Texto sobre rojo: blanco.

## 3. Marca

El logo es una **M de luz**: tres barras a cada lado y la M al centro, con un degradado de cian (`#00ffff`) a blanco y un resplandor. Está en vector, reconstruido a partir del arte original del dueño.

| Archivo | Qué es | Dónde se usa |
| --- | --- | --- |
| `instalacion/icono/manna.svg` | **Original en vector**: la marca sobre su ficha oscura de esquinas redondeadas. De aquí sale todo lo demás. | — |
| `web/logo.svg` | Copia del anterior para la interfaz. | Barra de módulos, pestaña del navegador. |
| `web/marca.svg` | La marca sola, sin ficha, con su resplandor. | Pantalla de inicio, "Acerca de", pantalla de apagado. |
| `web/icono.png`, `web/icono-180.png` | PNG de 128 px y de 180 px a sangre. | Pestaña en navegadores sin SVG; icono al añadir a la pantalla de inicio del celular. |
| `instalacion/icono/manna.ico`, `manna.icns` | Iconos del sistema. | Acceso directo en Windows, app en Mac. |
| `docs/logo.png` | PNG de 256 px. | README. |

Reglas:

- El cian del logo es también el acento de la interfaz (sección 2). El logo no se redibuja, no se recolorea y no se le quita el resplandor. Si cambia el dibujo, se edita el vector y se ejecuta `node scripts/generar-iconos.mjs`, que regenera todos los formatos.
- **Icono con ficha** para tamaños pequeños (44 px en la barra). **Marca sola con el nombre** para presentar la app: la marca, "MANNA" y "Church projection app" debajo, y la versión.
- El nombre "MANNA" del logotipo va en mayúsculas, peso 700 y espaciado amplio. Es la única excepción a las reglas de tipografía, y solo en el logotipo.
- **La versión se muestra junto al logo** (bajo el icono en la barra, bajo el nombre en inicio y en "Acerca de"). Sale de `package.json`.
- El logo vive sobre fondo oscuro. No se coloca sobre el cian ni sobre fondos claros.

## 4. Tipografía

- **Sora** para toda la interfaz, **Geist Mono** para números de versículo, teclas y direcciones. Van incluidas en `web/vendor/sora/` y `web/vendor/geist/`, con su licencia libre (la iglesia puede no tener internet).
- Base de 13 px (15 px en pantallas táctiles). Texto bíblico de lectura: 15-16 px con interlineado 1.5. Sora es algo más ancha que la letra anterior: los textos de botones y pestañas se prueban en la auditoría de pantallas.
- Pesos: 400 texto, 500 controles y etiquetas, 600 títulos y lo seleccionado. 800 solo en la acción principal grande y en el nombre del logotipo.
- Títulos de módulo: 17 px / 600 con espaciado -0.01em. Títulos de sección: 15 px / 600.
- Cifras tabulares activadas en toda la app (`font-feature-settings: 'tnum'`).
- **Mayúscula solo inicial.** Nada de TÍTULOS EN MAYÚSCULAS ni Cada Palabra Con Mayúscula (salvo el nombre del logotipo y las etiquetas pequeñas de sección, como «AL AIRE» o «SIGUE»).
- La tipografía de lo proyectado es otra cosa: la elige el usuario en Ajustes.

## 5. Forma y espacio

- **Formas:** **píldora** en botones, fichas, búsquedas y grupos de una sola elección; 10 px piezas pequeñas e iconos de tipo; 14 px campos y filas; 22 px paneles y monitores; 28 px ventanas.
- **Espaciado:** múltiplos de 4 px. Dentro de un control, 8-12; entre controles, 6-12; relleno de panel, 16-20.
- **Altura de control:** 34 px con ratón, 44 px con dedo (`--control`, cambia sola con `pointer: coarse`).
- **Listas densas:** filas separadas por espacio y un fondo al pasar o seleccionar. Sin tarjetas con borde y sombra.

## 6. Iconos

- Una sola familia: **Phosphor**, trazo regular. Se usan con `icon('nombre')` de `web/core/icons.js`.
- **Sin emojis** en la interfaz.
- Para añadir uno: `scripts/actualizar-iconos.mjs`. No se dibujan iconos a mano.
- Un botón que solo tiene icono lleva `aria-label`.

## 7. Estructura

«Escenario» (`web/core/shell.js` coloca las piezas; `web/modules/projection/escenario.js` las hace): lo que está al aire ocupa el fondo de la pantalla y, encima, en cristal, lo que lo gobierna. Cada capa flotante se cierra al tocar fuera y con Esc.

| Pieza | Qué contiene |
| --- | --- |
| **Fondo** | La proyección en vivo, entera (16:9) y centrada, con lo que se ve en ella: el zoom de una imagen y el **punto rojo** del Presentador; lo que sobra alrededor, su propio fondo desenfocado, y la proyección se desvanece en sus bordes hacia él (a los lados o arriba y abajo, según la forma de la pantalla), sin corte. Con «Señalar» o «Mover» encendido, el dedo o el ratón sobre el fondo señalan o mueven. Fuera del equipo principal se dibuja ligera (un video muestra su imagen). Un velo oscuro arriba y abajo para que se lea lo de encima. |
| **Barra de arriba** | A la izquierda, el logo (vuelve al inicio), el estado («● AL AIRE» en rojo, «SOLO FONDO», «NEGRO», «NADA») con lo que se ve, **«Solo fondo» (C) y «Negro» (B)** a su lado y, en el control del equipo principal, el botón del proyector. A la derecha, «Buscar en todo» (en el celular, solo la lupa) y la función con la versión; su menú tiene lo de esa función (Dispositivos) y «Cambiar de función». |
| **Dock** (izquierda, centrado) | Un icono por módulo; Ajustes al final. Pulsar el del módulo abierto cierra su cajón. |
| **Cajón** | El módulo abierto, con su nombre, ampliar o estrechar, y cerrar. Ancho por defecto (hasta la cola); estrecho, 440 px, que se **ensancha arrastrando su borde derecho** (una rayita que se vuelve cian) entre 360 px y la cola, sin moverse ni taparla, y se recuerda. Se cierra con su icono, con Esc o **tocando el fondo** (la proyección); la cola, «Preparado» y la barra de abajo funcionan con él abierto. Al abrir la función no hay ninguno abierto, salvo que la dirección lo diga (`#biblia`). El módulo se adapta al ancho del cajón, no al de la pantalla (ver «Módulos según su cajón», abajo). |
| **Cola del culto** (derecha) | El orden del culto para operar: secciones, elementos, lo ya pasado atenuado, lo preparado en cian y lo que está al aire en rojo, con sus pasos debajo (el actual en rojo). Un toque prepara; doble toque proyecta. Arriba, el título, «2 de 10» y, a la derecha, el botón de plegar (flecha hacia arriba); plegada queda solo ese botón, en el mismo sitio, con la lista y una flecha hacia abajo. Debajo, las tareas en curso. |
| **Preparado** (abajo a la derecha) | Lo elegido para proyectar: «PREPARADO» con su título y «Proyectar ↵» (Intro lo proyecta desde cualquier módulo) y, si viene de un módulo, «Añadir al orden». Lo seleccionado en un módulo sale como «SELECCIONADO», con su miniatura: se proyecta desde el módulo. Desaparece cuando eso ya está al aire. |
| **Transporte** (abajo, centrado) | Dos niveles en la misma barra de cristal. Arriba, **siempre a la vista, los mandos de lo que está al aire** (si los tiene) en filas que bajan si no caben: un himno, Cantado/Pista, Letra, pausa, saltos y avance; un video, pausa, saltos, avance y subtítulos; una imagen o una diapositiva, **«Señalar» y «Mover»** (sobre la propia proyección de fondo, como en el Presentador), Completa/Llenar, acercar y «Vista completa». Abajo, Anterior, «Siguiente» (cian), «SIGUE» y lo que viene, y el volumen de Manna. El cajón, la cola y «Preparado» se apoyan en su borde de arriba, crezca lo que crezca. |
| **Mandos** (celular) | En «Historias», los de lo que está al aire se abren en una hoja con márgenes desde el botón de la tarjeta; «Señalar», «Mover» y «Restablecer» van bajo el recuadro (con una herramienta encendida, el recuadro es para el dedo y no pasa). |
| **Buscar en todo** (Ctrl K) | Un recuadro arriba, centrado (en el celular, toda la anchura): el campo y lo encontrado por grupos (Biblia, Himnario, Medios, Diapositivas, Páginas web), cinco de cada uno como mucho, con su tipo a la izquierda y lo hallado resaltado. El primero va señalado en cian; las flechas mueven la señal. Un toque prepara (la tarjeta «Preparado» se ve encima de la capa y la búsqueda le deja sitio); doble toque o Intro proyecta y cierra. Solo en las funciones que preparan el culto (Control completo y Servicio de alabanza). |

Reglas para un módulo:

- **Módulos según su cajón**: el mismo módulo va en el cajón ancho, en el estrecho de 440 px y en el del celular, y se ordena según el sitio que tiene. Biblia: con 900 px o más, libros, capítulos y versículos en tres columnas; de 600 a 899, libros y capítulos comparten columna; con menos, una columna cada vez (libro → capítulo → versículos) con la ruta arriba. Orden: con 1000 px o más, los pasos del elegido en su columna a la derecha; con menos, bajo el elemento, para que los títulos largos se lean enteros. Himnario: con 900 px o más, la ficha del elegido al lado de la rejilla. Diapositivas: con 600 px o más, presentaciones y diapositivas lado a lado; con menos, una cosa cada vez. Por debajo de 600 px la cabecera de un módulo baja su buscador a otra fila, y en la Biblia «Comparar» y «Varios» se quedan solo con su icono. En un celular en horizontal el cajón es ancho pero bajo: la Biblia va una columna cada vez, salvo al comparar.
- **Versión reducida** (cajón reducido del celular, clase `compact`): solo lo vital para la tarea; lo demás, al ampliarlo. Biblia: la versión y el buscador en una fila, la cita, los versículos y abajo «Añadir» (el icono) y «Proyectar». Orden: solo la lista. Himnario: el buscador, los himnos y abajo el elegido, «Escuchar» y «Proyectar». Medios: las pestañas y la lista. Diapositivas: las presentaciones o las diapositivas de una. Páginas web: la lista.
- **Nada se desplaza de lado si no tiene nada al lado**: las filas de botones que no caben bajan a otra (el elemento abierto del Orden); solo se deslizan las tiras hechas para eso (el dock, pestañas, lo reciente, «A continuación», el Mapa del culto, las secciones de Ajustes).
- **Himnario por categorías**: todas plegadas, cada una con su número de himnos y una flecha; se abre la que se toca y se pliega la que estaba abierta. Las de una misma sección del índice van bajo su nombre, un rótulo pequeño en mayúsculas.
- **Letras sin música** (Himnario): una pestaña más, con la misma rejilla (solo los himnos con diapositivas). La barra de abajo pierde el sonido, «Letra» y «Escuchar»; la ficha del elegido muestra sus diapositivas en miniatura, de dos en dos, la primera rotulada «Portada», y tocar una la proyecta.
- **Escuchar en este dispositivo** (fuera del equipo principal): «Escuchar aquí», junto al volumen, oye lo que está al aire (apagado de partida; encendido, en cian); «Escuchar» en el Himnario, en Medios y en un elemento del Orden lo oye antes de añadirlo, en una barra de cristal arriba («Solo en este dispositivo», el título, pausa, avance, tiempo y ×).
- La **ficha del himno elegido** (Himnario, cajón de 900 px o más): a la derecha de la rejilla, con borde a la izquierda; el número grande en cian y la tipografía de cifras, el título y, debajo, la categoría y la duración; luego la letra por partes, con el nombre de cada parte en cian. Sin letra, lo dice. Con la ficha a la vista, la barra de abajo no lleva el botón «Letra».
- **Ajustes** empieza con una fila de botones, uno por sección («Apariencia», «Proyector», «Dispositivos», «Internet», «Programas», «Este dispositivo», «Apagar», «Acerca de»), que lleva a ella; se desliza de lado si no caben. En «Programas», el que falta y Manna sabe instalar lleva «Instalar», y el que conviene tener al día, «Actualizar».
- **Comparar** (Biblia) es un botón que se queda encendido en cian: debajo de la cabecera aparece una fila con «Comparar con», la segunda versión y la disposición, y junto a cada versículo se lee el de esa versión.
- **Varios** (Biblia) elige un tramo con dos toques, para el dedo: encendido, una franja cian dice qué toca ahora («Toca el primer versículo del tramo», «Desde el 3: toca el último»), y el primero queda marcado con un borde cian hasta el segundo toque. Mayús + clic sigue sirviendo con ratón.
- El **Mapa del culto** (Orden, segunda vista junto a «Lista») enseña el culto de un vistazo: una columna por elemento (sin secciones) con su número y su tipo, debajo cuántos pasos tiene y si ya pasó (una marca cian) o está al aire (el paso, en un cuadro rojo). Se desliza de lado si no caben. Bajo la rejilla, los pasos del elegido como casillas; tocar una la proyecta. Junto a las vistas, cuántos elementos y pasos tiene el culto.

- La **acción principal** (Proyectar) va abajo a la derecha de su espacio de trabajo y es el único botón cian de la pantalla.
- Un módulo que gobierna **equipos** (Televisores) muestra una tarjeta por equipo: icono, nombre, modelo y dirección, una línea de estado con su punto (verde cuando ya muestra la proyección, cian cuando pide algo a la persona, gris apagado), su acción principal en cian y lo demás en un menú. Si hay algo que la persona deba hacer en el equipo, se dice en una franja cian suave dentro de la tarjeta, con las palabras que verá en su pantalla.
- Los **fondos** (Ajustes) son una sola rejilla de cuadros iguales: primero los colores, luego las imágenes subidas y al final un cuadro con «+» y borde punteado para subir otra. El que está puesto lleva borde cian. Lo que se puede hacer con la imagen puesta (eliminarla) aparece debajo, como botón con texto: nada de aspas pequeñas sobre el cuadro, que en un celular no se aciertan.
- Un **aviso que afecta a toda la app** (Manna se actualizó y hay que reiniciarlo) es una franja de cristal con borde cian bajo la barra de arriba, en todos los módulos, con su botón; no se puede cerrar, porque no deja de ser cierto hasta que se resuelve.
- Una **biblioteca** (Medios) es una rejilla de tarjetas: miniatura en 16:9 sobre negro, nombre y debajo cuándo se agregó y sus medidas, de la más reciente a la más antigua, y un menú de tres puntos para lo que no es de todos los días (renombrar, eliminar). La elegida lleva borde cian; la que está al aire, borde rojo y la insignia "Al aire". Al elegir una aparece la barra de acciones.
- Una **elección que se entiende mejor viéndola** (el ajuste de una imagen a la pantalla) se ofrece sobre miniaturas del propio contenido, no con palabras solas: dos botones pequeños con la imagen ya ajustada de cada forma y su nombre debajo.
- El **encuadre** de una imagen al aire se gobierna sobre la imagen entera, atenuada, con un marco cian que señala lo que se ve; debajo, el deslizador de acercar con su valor, y el botón para volver a la vista completa.
- La tarjeta de un **video o audio** lleva sobre la imagen lo que dura (abajo a la derecha) y, si tiene subtítulos, su marca (abajo a la izquierda). Si ya se puede proyectar pero su copia para otras pantallas está en camino, la tarjeta no se atenúa: lo dice en verde («Ya se puede proyectar desde el equipo principal») y debajo va el avance de la copia. Si aún no se puede proyectar, la imagen se atenúa y debajo se dice por qué: una barra con el avance mientras se convierte, o el motivo en rojo con el botón que lo resuelve (Reintentar, Instalar ffmpeg).
- **Páginas web** es una lista de una columna (dos o más en pantallas anchas): cada página en una fila con el icono del globo, su nombre y dónde se ve («Archivo HTML», su sitio, o «en su propia ventana»). La elegida, con la barra de abajo (Añadir al orden, Proyectar). Lo que va en su propia ventana se ve en las demás pantallas como una tarjeta oscura con el globo, el nombre y «Se ve en su propia ventana en el proyector».
- El **Presentador** (función «Presentador de diapositivas») no lleva escenario: la diapositiva al aire es la pantalla, 16:9 y lo más grande que quepa en todo lo que deja la columna de la derecha (todas las diapositivas); debajo, la anterior y la siguiente, pequeñas y lado a lado (en el celular, tras los botones); con borde rojo y **nada encima** (se puede señalar en cualquier punto). Arriba, «Señalar», «Mover» y «Restablecer» (deja la imagen entera; apagado si ya lo está) en una píldora de cristal con una línea que dice qué hace el dedo; debajo, en otra píldora, Anterior (solo flecha), «Siguiente» (ancho, cian; «Empezar» si no hay ninguna de esa presentación en pantalla) y «Negro». La columna de la derecha, en cristal: la **anterior** y la **siguiente**, del mismo tamaño y una al lado de la otra («Es la primera» y «Fin de la presentación» en los extremos), los mandos del encuadre y todas las diapositivas, con la que está al aire en rojo. «Señalar» y «Mover» se apagan con otro toque: sin ninguno, tocar la grande pasa como en «Historias» (a la derecha avanza, a la izquierda vuelve). En el escritorio se empieza con «Señalar»; en el celular, sin ninguno, y todo va en una columna que se desplaza: la grande arriba, los botones, las herramientas y después la columna de la derecha. El puntero en la proyección es un punto rojo con halo y borde blanco fino, como un láser. Con una **página web** elegida no hay «Mover», ni siguiente, ni rejilla: la grande, «Señalar» y la fila de botones, cuyo botón ancho dice «Proyectar» hasta que la página está al aire.
- El **volumen de Manna** está siempre a la vista, suene algo o no: en la barra de transporte y, en el celular, bajo los modos. En el Servicio de alabanza, en el celular, es más grande. Los mandos de lo que suena no lo repiten.
- Los **mandos de lo que suena** van en este orden, de arriba abajo: transporte (volver al principio, el botón ancho de pausar o reproducir, −10 y +10), barra de avance con el tiempo a cada lado, volumen de Manna (silencio, deslizador y porcentaje) y, solo si los hay, subtítulos: un botón que los muestra y, si vienen en más de un idioma, una lista a su lado para elegirlo. Si ninguna pantalla puede sonar, se dice en cian bajo el volumen.
- Una pestaña cuyo contenido **no se sube, sino que se pide con un dato** (YouTube: un enlace) pone en la cabecera, en el sitio del botón de subir, un campo con su icono y su botón («Añadir»). En el celular ocupa una fila entera bajo las pestañas. Lo que tarda en llegar aparece enseguida como tarjeta atenuada con su barra de avance, igual que una conversión.
- El **aviso de que falta un programa** sale solo en la parte del módulo a la que afecta (en Medios, el de yt-dlp solo en la pestaña YouTube). En el celular ocupa lo justo: el texto, los botones en una fila y el aspa de cerrar en la esquina.
- Un **catálogo grande y numerado** (Himnario, más de seiscientos himnos) es una rejilla de fichas pequeñas e iguales: el número arriba, grande y en la tipografía de cifras, y el título debajo en dos líneas como mucho. No llevan imagen: se reconocen por el número. La elegida va en cian; la que está al aire, con borde rojo y su insignia. La misma rejilla se ve entera («Todos»), partida en grupos («Categorías»), cada uno con su nombre grande y cuántos himnos tiene, o solo con los favoritos («Favoritos»). Un favorito lleva una estrella cian arriba a la derecha (la insignia «Al aire» la tapa).
- **Buscar en un catálogo** sustituye la rejilla por una lista de lo encontrado, por niveles, con el número a la izquierda y, si se encontró en la letra, la parte («Estrofa 2») y el renglón con lo encontrado resaltado. Enter va al primero (o al señalado con las flechas) y deja el buscador, para que otro Enter lo proyecte.
- Una **elección entre dos formas del mismo contenido** (un himno cantado o con la pista) son dos botones juntos, uno encendido en cian: en la barra de acciones antes de proyectar, y arriba de los mandos mientras está al aire. Lo que no se puede elegir en ese equipo se ve apagado y dice por qué al pasar el cursor.
- Lo que conviene **revisar en una carpeta de contenido** (videos que faltan, letras que no cuadran) no interrumpe: es un botón discreto en cian en la cabecera («2 avisos») que abre la lista, dicha en frases.
- Una **biblioteca de cosas con partes** (Diapositivas) tiene dos columnas: a la izquierda, las presentaciones, cada una en una fila con su portada, su nombre (hasta dos líneas) y cuántas diapositivas tiene; a la derecha, las diapositivas de la elegida en rejilla, con su número debajo. La elegida va en cian; la que está al aire, en rojo con su insignia. En pantallas estrechas se ve una columna cada vez: primero las presentaciones y, al tocar una, sus diapositivas con un botón «Presentaciones» para volver. La barra de acciones dice qué diapositiva se va a proyectar ("Diapositiva 3 de 12") y, en gris, de qué presentación.
- Los **mandos de una diapositiva** empiezan por lo que el operador necesita saber sin mirar la pantalla: por cuál va y cuántas quedan en una línea, y debajo la miniatura de la que sigue con su número. Después, el recuadro del encuadre y el deslizador de acercar, iguales que en una imagen (sin «Completa / Llenar»: una diapositiva va siempre entera).
- El **control remoto** de un equipo es una ventana: panel táctil arriba (se desliza para mover el puntero, un toque pulsa), teclas en rejilla de tres por tres con OK al centro, y los pasos de la primera vez plegados al final.
- Lo que se selecciona se resalta en cian suave y aparece como **vista previa** en el panel.
- Todo lo que un módulo produce puede **añadirse al orden del culto**, que es donde confluyen todos.
- Lo que se configura una vez (apariencia, dispositivos) va en **Ajustes**, no en la pantalla de operación.
- **Mandos en vivo**: los mandos propios de lo que está al aire (imagen de prueba, zoom, reproducción) van en la barra de abajo (en el celular, en su hoja), y repetidos en el detalle del elemento en el orden. Solo aparecen cuando lo proyectado los tiene. Filas de botones que se reparten el ancho; la opción activa, en cian suave. Nunca un botón cian lleno: ese es de la acción principal.
- **Tareas**: lo que el equipo principal tarda en preparar se muestra como una ficha con título, barra fina cian y una línea "43 % · faltan 0:40". Al terminar pasa a verde un momento y desaparece; si falla, borde rojo, el motivo y un botón para quitarla. Nunca bloquea la pantalla ni usa una ventana.

- **Aviso de módulo**: si al módulo abierto le falta un programa del equipo principal, una franja cian suave sobre su cabecera dice qué no se podrá hacer, con "Instalar…" o "Cómo instalarlo" y una equis para cerrarla. Informa; nunca impide usar el módulo.
- **Resultados de búsqueda**: flotan bajo el buscador, sin empujar el contenido. La primera línea dice cuántos hay y en qué versión se buscó. Van por niveles, cada uno con su rótulo y su número ("Frase exacta 12"). Cada resultado: la cita en cian y el texto en hasta tres líneas con lo encontrado resaltado (fondo cian suave, texto claro). El resultado señalado con el teclado lleva una barra cian a la izquierda.
- **Elección única entre pocas opciones** (la disposición al comparar versiones): un grupo de botones de icono dentro de un mismo marco (`.seg`); el elegido, con fondo más claro e icono cian.
- **Dos textos a comparar**: en la lista, dos columnas con la sigla de cada versión arriba; en celular, uno bajo otro, el segundo atenuado. En la proyección, las dos versiones separadas por una línea fina del color de la cita, cada una con su sigla debajo; la letra es algo menor que la de un pasaje solo y se reduce hasta que quepa.

Fuera de las tres zonas hay dos páginas sobre el resplandor de la M (`body.glow`), con tarjetas de cristal: la **pantalla de inicio** y la **revisión del equipo** (`/requisitos`). El inicio pregunta «¿Qué vas a hacer hoy?» y da cada función en una tarjeta con su icono en un cuadrado cian, su nombre, para qué sirve y si pide PIN (ámbar) o no (cian); en rejilla de columnas de 300 px o más. El **PIN** (4 cifras, solo números) se escribe en un teclado grande en una ventana: tres columnas de teclas de 72 × 64 px, con el 0 en el centro de la última fila y borrar (←) a su derecha; cuatro puntos, uno por cifra, y **entra solo al teclear la cuarta** (al fallar, los puntos en rojo y vacíos). También con el teclado del equipo. La revisión empieza por lo que importa al usuario, **qué funcionará en este equipo**, módulo por módulo; después, cada programa en una ficha con su estado (verde "Listo", cian "Falta"), para qué sirve en una frase y, si falta, la acción "Instalar por mí" y los pasos a mano plegados. Su acción principal es siempre "Abrir Manna".

## 8. Orden del culto

- Cada elemento muestra: número, icono de su tipo, **título** y una línea secundaria (tipo · detalle · cuántos pasos).
- **Los títulos largos se leen**: hasta tres líneas en escritorio y cinco en celular, y enteros en el elemento elegido. La lista es la columna ancha.
- Las **secciones** ("Apertura", "Mensaje") son separadores: texto pequeño y una línea. No se proyectan.
- Un elemento con **nombre propio** muestra ese nombre como título, y el que le da su contenido pasa al principio de la línea secundaria ("Juan 3:16 · Biblia · …").
- Lo que ya pasó se atenúa; lo que está al aire lleva fondo rojo suave y la insignia "Al aire".
- Al elegir un elemento se despliegan sus **pasos** como miniaturas (versículos, estrofas, diapositivas). Un toque en una miniatura proyecta ese paso. **Otro clic sobre el mismo elemento lo recoge**, y recogido se queda hasta que se elija otro.

## 9. Estados

Toda pantalla contempla, además del caso normal:

- **Vacío:** qué es este espacio y cómo llenarlo, con el botón para hacerlo.
- **Cargando:** siluetas con la forma de lo que va a aparecer. Sin ruedas giratorias.
- **Error:** aviso flotante con lo que pasó y qué hacer, en una frase. Sin "¡Ups!" ni signos de exclamación.
- **Sin conexión:** barra roja arriba; la reconexión es automática.
- **Pulsado:** los botones se encogen un 2 % al pulsar. **Foco:** contorno cian de 2 px, siempre visible con teclado.

## 10. Movimiento

- Solo transiciones de 120-200 ms en fondo, borde y opacidad, con la curva `--ease`.
- Se anima `transform` y `opacity`; nunca tamaño ni posición.
- Nada se mueve en bucle, salvo dos indicadores de espera: la silueta de carga y la barra de una tarea cuyo avance aún no se conoce. Con "reducir movimiento" activado en el sistema, no se anima nada.

## 11. Texto de la interfaz

- Español llano, para voluntarios sin conocimientos técnicos.
- Botones: verbo primero, una a tres palabras ("Proyectar", "Añadir al orden").
- Los atajos de teclado se muestran en el propio botón, como una tecla (`<kbd>`). Se ocultan en pantallas táctiles.
- Los nombres se mantienen: **Orden del culto**, **Al aire**, **Vista previa**, **Solo fondo**, **Negro**.

## 12. Comportamiento adaptable

Lo que no puede perderse en ningún tamaño: **ver qué está al aire, avanzar y retroceder, y llegar a la acción principal sin desplazarse.** En el celular, con un cajón abierto, lo que está al aire sigue a la vista (el recuadro encima y, siempre, el estado en la cabecera del cajón) y un toque fuera del cajón devuelve a los mandos.

| Ancho | Dispositivo | Disposición |
| --- | --- | --- |
| 1180 px o más | Escritorio, portátil, tableta grande en horizontal | «Escenario» completo. Cola y Preparado de 340 px. |
| 860 – 1179 px | Tableta en horizontal, portátil pequeño | «Escenario», con cola y Preparado de 290 px y sin las teclas en el transporte. |
| Menos de 860 px | Celular, tableta en vertical | **«Historias»**: arriba la proyección en su recuadro (borde rojo al aire, segmentos de los pasos; tocar a la derecha avanza y a la izquierda vuelve), lo que se ve con el botón de mandos, «Al aire / Solo fondo / Negro», el volumen y «A continuación» en tarjetas que se deslizan (un toque prepara, doble toque proyecta). El dock va abajo con el nombre de cada módulo y se desliza. Un módulo sube en un **cajón reducido**, bajo el recuadro, que enseña **solo lo esencial** de ese módulo (ver «Versión reducida», arriba); se agranda arrastrando su borde de arriba (una rayita de 44 × 4 px), entre la barra de arriba y un mínimo de un tercio de la pantalla o 400 px, se amplía a pantalla completa con su botón y se cierra tocando fuera. En un celular de menos de 700 px de alto empieza completo. Su cabecera lleva el nombre del módulo y el estado de lo al aire («SOLO FONDO»); completo, lo que está al aire. Ajustes se abre siempre completo. Arriba, sin píldora vacía: solo la M. Preparado es una barra sobre el dock. |
| Menos de 860 px y menos de 480 px de alto | Celular en horizontal | El dock pasa a la izquierda; el recuadro y lo demás, lado a lado. El cajón ocupa la mitad derecha y se ensancha arrastrando su borde izquierdo, hasta el 40 % de la pantalla (ampliado, todo menos el dock). |

Se comprueba con `node scripts/auditar-responsive.mjs`, que abre la app en nueve tamaños y verifica estas garantías. Hay que ejecutarlo al tocar cualquier disposición.

## 13. Lo que no se hace

- Degradados, brillos o sombras decorativas. El cristal (`.glass`, fichas `--glass-*`) es solo para lo que flota sobre la proyección; el resplandor, solo del logo.
- Un segundo color de acento, o rojo que no signifique "al aire".
- Emojis, o iconos de otra familia.
- Tarjetas con borde y sombra para agrupar listas.
- Ventanas emergentes para lo que cabe en la propia pantalla.
- Avisos nativos del navegador (`alert`, `confirm`): se usa `dialog()` de `web/core/dom.js`.
- Cargar tipografías, iconos o código desde internet.
