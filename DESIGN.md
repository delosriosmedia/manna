# Sistema de diseño de Manna

Cómo se ve y se siente la interfaz de control de Manna, y por qué. Lo lee quien vaya a crear o tocar una pantalla, sea una persona o un asistente. Los valores viven en `web/core/app.css`; este documento explica las reglas para usarlos.

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
| `--canvas` | `#0b0d12` | Fondo de la app. Nunca negro puro. |
| `--s1` `--s2` `--s3` | `#11141b` `#171b24` `#1f2431` | Escalera de superficies: paneles, controles, estado activo o pulsado. |
| `--line` `--line-2` | `#222837` `#30384c` | Líneas de 1 px: separadores y bordes. |
| `--ink` `--ink-2` `--ink-3` | `#f2f4f8` `#b9c0cd` `#8a93a5` | Texto principal, de lectura y secundario. |
| `--ink-4` | `#5b6375` | Solo decorativo o deshabilitado: no alcanza el contraste mínimo. |
| `--accent` | `#eda93a` | **El único acento** de la interfaz: selección, acción principal, foco. |
| `--live` `--live-ink` | `#d93a40` `#ff8a8e` | **Rojo: solo "al aire"** y acciones destructivas. |

Reglas:

- **El cian es del logo y solo del logo** (sección 3). No se usa en botones, textos ni estados.
- **Un acento.** Si algo necesita destacar y no es selección, acción principal ni foco, no se colorea: se resuelve con peso o posición.
- **Rojo significa "al aire".** Un borde rojo en un monitor, una fila o una miniatura quiere decir que eso se está proyectando. No se usa para adornar.
- **El color por tipo vive solo en el icono del elemento** (`.kind.k-<tipo>`): azul Biblia, violeta himno, verde imagen, coral video, arena diapositivas. Nunca en botones, textos ni fondos de panel.
- La profundidad se da con la escalera de superficies y líneas. **Sin sombras**, salvo en lo que flota (menús, resultados de búsqueda).
- Texto sobre ámbar: `--on-accent`. Texto rojo sobre oscuro: `--live-ink`. Texto sobre rojo: blanco.

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

- El logo no se redibuja, no se recolorea y no se le quita el resplandor. Si cambia el dibujo, se edita el vector y se ejecuta `node scripts/generar-iconos.mjs`, que regenera todos los formatos.
- **Icono con ficha** para tamaños pequeños (44 px en la barra). **Marca sola con el nombre** para presentar la app: la marca, "MANNA" y "Church projection app" debajo, y la versión.
- El nombre "MANNA" del logotipo va en mayúsculas, peso 700 y espaciado amplio. Es la única excepción a las reglas de tipografía, y solo en el logotipo.
- **La versión se muestra junto al logo** (bajo el icono en la barra, bajo el nombre en inicio y en "Acerca de"). Sale de `package.json`.
- El logo vive sobre fondo oscuro. No se coloca sobre el ámbar ni sobre fondos claros.

## 4. Tipografía

- **Geist** para todo, **Geist Mono** para números de versículo, teclas y direcciones. Van incluidas en `web/vendor/geist/` (la iglesia puede no tener internet).
- Base de 13 px (15 px en pantallas táctiles). Texto bíblico de lectura: 15-16 px con interlineado 1.5.
- Pesos: 400 texto, 500 controles y etiquetas, 600 títulos y lo seleccionado. No se usa 700.
- Títulos de módulo: 17 px / 600 con espaciado -0.01em. Títulos de sección: 15 px / 600.
- Cifras tabulares activadas en toda la app (`font-feature-settings: 'tnum'`).
- **Mayúscula solo inicial.** Nada de TÍTULOS EN MAYÚSCULAS ni Cada Palabra Con Mayúscula (salvo el nombre del logotipo, sección 3).
- La tipografía de lo proyectado es otra cosa: la elige el usuario en Ajustes.

## 5. Forma y espacio

- **Radios:** 6 px fichas, teclas e iconos de tipo; 8 px controles; 12 px paneles, monitores y ventanas. Píldora solo en insignias de estado ("Al aire") y fichas de recientes.
- **Espaciado:** múltiplos de 4 px. Dentro de un control, 8-12; entre controles, 6-12; relleno de panel, 16-20.
- **Altura de control:** 34 px con ratón, 44 px con dedo (`--control`, cambia sola con `pointer: coarse`).
- **Listas densas:** filas separadas por espacio y un fondo al pasar o seleccionar. Sin tarjetas con borde y sombra.

## 6. Iconos

- Una sola familia: **Phosphor**, trazo regular. Se usan con `icon('nombre')` de `web/core/icons.js`.
- **Sin emojis** en la interfaz.
- Para añadir uno: `scripts/actualizar-iconos.mjs`. No se dibujan iconos a mano.
- Un botón que solo tiene icono lleva `aria-label`.

## 7. Estructura

Tres zonas fijas (`web/core/shell.js`):

| Zona | Qué contiene |
| --- | --- |
| **Barra de módulos** (izquierda) | Un botón por módulo. Los previstos pero no construidos se muestran atenuados. Abajo, lo que se prepara antes de la reunión: Dispositivos, Televisores y Ajustes. |
| **Espacio de trabajo** (centro) | Solo el módulo activo. Cabecera con el título y su buscador o acción de entrada. |
| **Panel "Al aire"** (derecha) | Monitor de lo proyectado, anterior / siguiente, negro, solo fondo, los mandos propios de lo que está al aire, las tareas en curso, vista previa de la selección y lo que sigue en el orden. Igual en todos los módulos. |

Reglas para un módulo:

- La **acción principal** (Proyectar) va abajo a la derecha de su espacio de trabajo y es el único botón ámbar de la pantalla.
- Un módulo que gobierna **equipos** (Televisores) muestra una tarjeta por equipo: icono, nombre, modelo y dirección, una línea de estado con su punto (verde cuando ya muestra la proyección, ámbar cuando pide algo a la persona, gris apagado), su acción principal en ámbar y lo demás en un menú. Si hay algo que la persona deba hacer en el equipo, se dice en una franja ámbar suave dentro de la tarjeta, con las palabras que verá en su pantalla.
- El **control remoto** de un equipo es una ventana: panel táctil arriba (se desliza para mover el puntero, un toque pulsa), teclas en rejilla de tres por tres con OK al centro, y los pasos de la primera vez plegados al final.
- Lo que se selecciona se resalta en ámbar suave y aparece como **vista previa** en el panel.
- Todo lo que un módulo produce puede **añadirse al orden del culto**, que es donde confluyen todos.
- Lo que se configura una vez (apariencia, dispositivos) va en **Ajustes**, no en la pantalla de operación.
- **Mandos en vivo**: los mandos propios de lo que está al aire (imagen de prueba, zoom, reproducción) van en un recuadro bajo "Negro / Solo fondo" del panel, y repetidos en el detalle del elemento en el orden. Solo aparecen cuando lo proyectado los tiene. Filas de botones que se reparten el ancho; la opción activa, en ámbar suave. Nunca un botón ámbar lleno: ese es de la acción principal.
- **Tareas**: lo que el equipo principal tarda en preparar se muestra como una ficha con título, barra fina ámbar y una línea "43 % · faltan 0:40". Al terminar pasa a verde un momento y desaparece; si falla, borde rojo, el motivo y un botón para quitarla. Nunca bloquea la pantalla ni usa una ventana.

- **Aviso de módulo**: si al módulo abierto le falta un programa del equipo principal, una franja ámbar suave sobre su cabecera dice qué no se podrá hacer, con "Instalar…" o "Cómo instalarlo" y una equis para cerrarla. Informa; nunca impide usar el módulo.
- **Resultados de búsqueda**: flotan bajo el buscador, sin empujar el contenido. La primera línea dice cuántos hay y en qué versión se buscó. Van por niveles, cada uno con su rótulo y su número ("Frase exacta 12"). Cada resultado: la cita en ámbar y el texto en hasta tres líneas con lo encontrado resaltado (fondo ámbar suave, texto claro). El resultado señalado con el teclado lleva una barra ámbar a la izquierda.
- **Elección única entre pocas opciones** (la disposición del comparador): un grupo de botones de icono dentro de un mismo marco (`.seg`); el elegido, con fondo más claro e icono ámbar.
- **Dos textos a comparar**: en la lista, dos columnas con la sigla de cada versión arriba; en celular, uno bajo otro, el segundo atenuado. En la proyección, las dos versiones separadas por una línea fina del color de la cita, cada una con su sigla debajo; la letra es algo menor que la de un pasaje solo y se reduce hasta que quepa.

Fuera de las tres zonas hay dos páginas de una sola columna centrada: la **pantalla de inicio** (elegir función) y la **revisión del equipo** (`/requisitos`). La revisión empieza por lo que importa al usuario, **qué funcionará en este equipo**, módulo por módulo; después, cada programa en una ficha con su estado (verde "Listo", ámbar "Falta"), para qué sirve en una frase y, si falta, la acción "Instalar por mí" y los pasos a mano plegados. Su acción principal es siempre "Abrir Manna".

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
- **Pulsado:** los botones se encogen un 2 % al pulsar. **Foco:** contorno ámbar de 2 px, siempre visible con teclado.

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

Lo que no puede perderse en ningún tamaño: **ver qué está al aire, avanzar y retroceder, y llegar a la acción principal sin desplazarse.**

| Ancho | Dispositivo | Disposición |
| --- | --- | --- |
| 1180 px o más | Escritorio, portátil, tableta grande en horizontal | Las tres zonas completas. Biblia en tres columnas. Orden con lista y pasos lado a lado. |
| 860 – 1179 px | Tableta en horizontal, portátil pequeño | Las tres zonas, más estrechas. En Biblia, libros y capítulos comparten columna. En Orden, los pasos se abren bajo el elemento elegido. |
| Menos de 860 px | Celular, tableta en vertical | Un módulo a la vez, con **pestañas abajo**. "Al aire" es una **barra compacta** con anterior / siguiente que se despliega a pantalla completa. Biblia avanza por pasos: libro, capítulo, versículos. |
| Menos de 860 px y menos de 480 px de alto | Celular en horizontal | Las pestañas pasan al lado izquierdo y las cabeceras quedan en una fila, para dejar el alto al contenido. |

Se comprueba con `node scripts/auditar-responsive.mjs`, que abre la app en nueve tamaños y verifica estas garantías. Hay que ejecutarlo al tocar cualquier disposición.

## 13. Lo que no se hace

- Degradados, brillos, vidrio esmerilado o sombras decorativas (el resplandor es solo del logo).
- Un segundo color de acento, o rojo que no signifique "al aire".
- Emojis, o iconos de otra familia.
- Tarjetas con borde y sombra para agrupar listas.
- Ventanas emergentes para lo que cabe en la propia pantalla.
- Avisos nativos del navegador (`alert`, `confirm`): se usa `dialog()` de `web/core/dom.js`.
- Cargar tipografías, iconos o código desde internet.
