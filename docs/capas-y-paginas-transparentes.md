# Capas (overlays) y páginas web transparentes

> **Decidido el 2026-10-24 (decisión 51 de `docs/PLAN.md`)**: lo que vale es la fase 31 del plan, que cambia tres puntos de este documento: «Negro» no oculta las capas; la página no avisa que cargó (`capa-lista` descartado): el equipo principal comprueba que su dirección contesta antes de cargarla y lo reintenta solo; y habrá tres capas, no una lista libre.

Propuesta escrita el 2026-10-24 desde la sesión «Sábado Joven» (proyecto NUEVA VIDA), a pedido del dueño. Es un encargo para planear e implementar en Manna, siguiendo su forma de trabajo: **primero el plan como fase nueva en `docs/PLAN.md`, esperar la aprobación del dueño y luego implementar**. Lo que dice aquí del código se revisó leyendo los archivos citados, sin ejecutar nada.

El dueño lo llama «módulo de navegador» y «módulo de overlay». En Manna, el navegador es el módulo `web` («Páginas web»). Si el dueño quiere decir otra cosa (por ejemplo, un navegador con barra de direcciones), pregúntale antes de planear.

## Para qué: el caso real, con fecha

El **sábado 31 de octubre de 2026** (Sábado Joven, Auditorio SENA de Barrancabermeja) hay un concurso: se proyectan 21 palabras por sorpresa durante la jornada y los jóvenes las escriben en una web (`milugar.manna-iglesia.es`). La página que muestra la palabra es:

`https://milugar.manna-iglesia.es/word?k=<llave>` (la llave la entrega la plataforma cuando esté publicada).

Esa página tiene que quedar puesta en Manna **como capa durante toda la jornada**, encima de lo que esté al aire (videos, Biblia, himnos, imágenes). Casi todo el tiempo es transparente. Cuando el administrador del concurso libera una palabra, aparece en grande en menos de un segundo, y se quita a los pocos segundos. El reloj del concurso arranca cuando la palabra está de verdad en pantalla, así que la capa tiene que estar encendida y visible de forma fiable.

Tiene que estar probado en el equipo que proyectará en el SENA antes del **ensayo del jueves 29 de octubre**.

## Lo que hay hoy

- `web` es un **tipo de contenido**: reemplaza lo que está al aire, no puede ir encima de otra cosa (`web/modules/web/kind.js`).
- El marco tiene **fondo blanco fijo**: `.web-frame { … background: #fff; … pointer-events: none; }` (`web/modules/projection/stage.css:293`). Aunque la página sea transparente, se ve blanca. Ya deja pasar los clics y se dibuja a 1920 × 1080 escalado, que es lo que hace falta.
- Una página que no se deja enmarcar (`X-Frame-Options`, `frame-ancestors`) se abre en **su propia ventana de Chrome**: esa no puede ser una capa.
- Modos de la proyección: `live`, `clear` (solo fondo) y `black` (negro) (`server/modules/projection/index.js:66`).
- **PowerPoint en vivo** pasa las diapositivas en su propia ventana, encima de la ventana de proyección: taparía cualquier capa que se dibuje dentro de Manna.
- `web/proyeccion.html` no declara `color-scheme` (queda en `normal`).

## Módulo de capas (nuevo)

Entra como módulo propio, sin acoplarse a los demás (regla del proyecto).

- **Estado en el servidor**: una lista de capas `{ id, nombre, tipo, fuente, visible, orden }`. Para el sábado basta el tipo `web`. Imagen (PNG con transparencia) y texto pueden ir en una parte posterior: es decisión del dueño.
- **Se guarda en `data/`** y sobrevive a un reinicio de Manna y a recargar la ventana de proyección. Así una capa queda encendida «para siempre» hasta que alguien la apague (ver «Lo que debe sobrevivir a un reinicio» en `.claude/rules/arquitectura.md`).
- **Órdenes** por `POST /api/action`, con el permiso de controlar la proyección: añadir, cambiar, mostrar, ocultar, recargar y quitar. El estado llega a las pantallas por SSE, como el resto.
- **Ventana de proyección**: un contenedor de capas encima de `#stage`, con el mismo encaje 16:9 y `pointer-events: none`. Es independiente de lo que esté al aire: cambiar de contenido no lo toca.
- **Modos**:
  - Con «Solo fondo», las capas siguen.
  - Con «Negro», se ocultan también (recomendado: «Negro» tiene que dar negro siempre). Confírmalo con el dueño.
- **Otras pantallas** (control, celulares, Presentador): no cargan la página de la capa. Muestran una pastilla «Capa: <nombre>» cerca de «Al aire», para que nadie olvide que hay algo encendido encima. Así la página no se abre diez veces ni corre en todos los dispositivos.
- **Interfaz**: «Capas» en el dock. Trae la lista con el ojo para mostrar u ocultar, y las acciones añadir (página por dirección; luego imagen y texto), recargar y quitar. Sigue `DESIGN.md`.
- **Orden del culto**: por regla del proyecto, todo lo que produce un módulo se puede añadir al orden, con pasos como «Encender capa X» y «Apagar capa X». Puede ir en una parte posterior si no cabe antes del sábado: dilo en el plan.

## Página web dentro de una capa (para que haya transparencia)

1. **Reusar el marco del tipo `web`**: 1920 × 1080 escalado, el mismo `sandbox` de las páginas de internet y `pointer-events: none`.
2. **Marco con `background: transparent`, solo en las capas.** El contenido `web` normal sigue en blanco, porque muchas páginas lo suponen.
3. **Esquema de color.** Chrome pinta un fondo opaco detrás de un marco cuando el `color-scheme` de la página de adentro no coincide con el del marco. Hay que dejar el marco y la proyección en `normal`, como hoy, y documentar que una página que declare `color-scheme: dark` se verá con fondo.
4. **Lo que debe cumplir una página para ir en capa**:
   - `html` y `body` con fondo transparente.
   - No declarar `color-scheme: dark`.
   - Dejarse enmarcar.
   - Estar pensada para 1920 × 1080.

   Al añadir una capa web, reusar la revisión que ya hace `server/modules/web/index.js` para saber si se deja enmarcar. Si no se deja, rechazarla como capa y decir por qué.
5. **El marco no se recarga** al cambiar lo que está al aire ni al mostrar u ocultar la capa: ocultar es `visibility: hidden`, no quitar el `iframe`. Solo se recarga con «Recargar» o si cambia la dirección.
6. **Nada de páginas de error encima del culto.** Si la proyección se recarga sin internet, Chrome pondría su página de error dentro del marco, y es opaca. Para evitarlo, el marco de una capa se muestra solo cuando la página avisa que cargó, con `postMessage({ manna: 'capa-lista' }, '*')`.
   - Manna comprueba que el mensaje viene de ese marco (`event.source === frame.contentWindow`).
   - Ese aviso solo cambia la visibilidad del propio marco: no es una orden.
   - Que la capa espere ese aviso puede ser una opción por capa, encendida para la del concurso. Una página que no lo manda se muestra al cargar.
7. **Aviso de visibilidad, de Manna a la página.** Manna le envía `postMessage({ manna: 'capa', visible: true | false }, '*')` al cargar y cada vez que cambie: mostrar u ocultar la capa, entrar o salir de «Negro», o la ventana de proyección oculta.
   - Con eso la plataforma del concurso sabe cuándo la palabra está de verdad en pantalla.
   - Una página que no escuche el mensaje no se entera, y no pasa nada.
   - Ya existe algo parecido: `kind.js` le pasa las flechas al marco con `postMessage`.
8. **Seguridad.** Igual que hoy: Manna no acepta órdenes que vengan de la página. El único mensaje que escucha es `capa-lista`, y solo del propio marco.

## PowerPoint en vivo y páginas en ventana propia

- Con una capa visible, PowerPoint en vivo la tapa. Lo recomendado por ahora es que, mientras haya una capa encendida, las presentaciones pasen «como imágenes», o que Manna avise y deje elegir.
- Más adelante, PowerPoint se podría apartar, como ya hace con «Mover», mientras la capa tenga algo visible. Eso pide que la página avise cuándo muestra algo; no es para esta fase.
- Una página que va en su propia ventana también tapa las capas: avisar al proyectarla con una capa encendida.

## Pruebas, antes del jueves 29

- Una **página de prueba local** con el fondo transparente, un recuadro semitransparente y un texto que cambie cada 5 s, que mande `capa-lista` y muestre en pantalla el último `visible` que recibió.
- **Encima de** una imagen, un video en reproducción, versículos, un himno y «Solo fondo». Con «Negro», que se oculte.
- **El marco no se recarga** al cambiar de contenido.
- **Vuelve sola** al recargar la proyección y al reiniciar Manna.
- **Sin internet**: no aparece la página de error.
- **El aviso de visibilidad** llega en cada cambio.
- **En el equipo Windows** que proyectará en el SENA, con el Chrome o el Edge de Manna.
- **Con la página real** del concurso (`/word?k=…`), cuando la sesión del Sábado Joven avise que está publicada.

## Decisiones para el dueño

1. ¿«Negro» oculta las capas? Lo recomendado es que sí.
2. ¿Qué tipos de capa entran en esta fase? Para el sábado solo hace falta `web`.
3. Con una capa encendida, ¿las presentaciones van «como imágenes» o Manna avisa y deja elegir?
4. ¿Los pasos de capa en el orden del culto van en esta fase o en una posterior?
