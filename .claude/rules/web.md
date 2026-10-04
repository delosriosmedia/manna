---
paths:
  - "web/**"
  - "DESIGN.md"
---

# Web

**Antes de crear o cambiar una pantalla, lee `DESIGN.md`.** Ahí están los colores, la tipografía, la estructura y cómo se adapta a celular y tableta. Esto son las reglas de código.

- JavaScript puro con módulos ES, cargado directo por el navegador. **Sin framework, sin compilación, sin CDN** (la red de la iglesia puede no tener internet). Lo de terceros se copia a `web/vendor/` con su licencia.
- Rutas siempre absolutas desde la raíz (`/core/api.js`, `/modules/...`).
- Comunicación con el servidor solo a través de `web/core/api.js`: `api()`, `action()`, `upload()` (subida con avance), `subscribe(ns, fn)` (devuelve cómo cancelarla), `connect(rol)` y `serverNow()`. Siempre con rutas relativas: la misma página puede estar abierta por `localhost`, por la IP o por `manna.local`.
- Construir el DOM con `h()` de `web/core/dom.js`. **No usar `innerHTML` con datos** (texto bíblico, nombres, lo que venga del servidor). Ojo: `h()` descarta los hijos `false` o `null`, pero `replaceChildren()` y `append()` del navegador no; si hay hijos condicionales fuera de `h()`, filtrarlos con `.filter(Boolean)`.
- Los manejadores que llaman al servidor se envuelven en `guard()`: muestra el error en pantalla y vuelve al inicio si falta sesión.
- Ventanas y menús: `dialog()` y `menu()` de `web/core/dom.js`. Nunca `alert()` ni `confirm()`.
- Iconos: `icon('nombre')` de `web/core/icons.js`. Una sola familia (Phosphor); sin emojis. Para añadir uno, `scripts/actualizar-iconos.mjs`.
- Estilos: fichas de `web/core/app.css` (`--s1`, `--ink-2`, `--accent`…). No escribir colores ni radios sueltos. Cada módulo trae su propio `.css`.
- Preferencias de este dispositivo (versión elegida, último módulo): `prefs` de `web/core/prefs.js`. Lo compartido vive en el servidor.

## Estructura de la app

- `web/core/shell.js` monta las tres zonas: barra de módulos, espacio de trabajo y panel "Al aire" (`web/modules/projection/dock.js`). También pone los atajos globales (← → B C), el aviso de conexión y la confirmación al cerrar.
- Un **módulo** es `web/modules/<id>/workspace.js`, que exporta `{ id, name, icon, place?, needs?, mount(el, ctx) }`, y una línea en `web/modules/registry.js`.
  - `needs` lista los programas del equipo principal que necesita: `[{ tools: ['ffmpeg'], feature: 'convertir videos' }]`, donde `feature` completa la frase "no se podrá…". Con eso la barra superior del módulo avisa si falta alguno (`web/core/shell.js`) y la revisión del equipo lo cuenta. Nunca se impide abrir un módulo por esto.
  - `mount` dibuja el módulo dentro de `el`, se suscribe al estado y puede devolver `{ onShow(), keys(evento) }`. `keys` devuelve `true` si atendió la tecla.
  - `ctx`: `{ role, isLocal, canEdit, go(id), setPreview(elemento | null) }`. `setPreview` muestra en el panel lo que se proyectaría.
  - El espacio de trabajo empieza con `.ws-head` (título y buscador o acción de entrada) y pone su acción principal abajo a la derecha.
- Un módulo puede usar piezas de interfaz de `projection` (`stage.js` para dibujar miniaturas, `controls.js`) y de `system` (`devices.js`). Fuera de eso, no importa archivos de otros módulos.
- Una página por función: `web/<rol>.html` + `web/roles/<rol>.js`, que empieza con `await ensureRole('<rol>')` y llama a `createShell()` con los módulos de esa función. Aparte está `web/requisitos.html`, la revisión del equipo: no es una función, se abre sin PIN, solo deja actuar desde el equipo principal y nunca bloquea el paso a la app.
- Lo encontrado en una búsqueda llega del servidor como tramos `[inicio, fin)` del texto (`marks`) y se pinta con `<mark>`; ver `highlighted()` en `web/modules/bible/passages.js`.
- Varias pantallas de un mismo módulo comparten su pieza común dentro de la carpeta del módulo: `web/modules/bible/passages.js` (elegir un pasaje) la usan `workspace.js` (Biblia) y `compare.js` (Comparador), que solo deciden qué se hace con el pasaje elegido.
- Un recuadro flotante bajo la cabecera se coloca midiendo la cabecera (`head.offsetHeight`), no con un número fijo: en pantallas estrechas la cabecera ocupa varias filas.
- La página de proyección (`web/roles/proyeccion.js`) entra a pantalla completa con doble clic o F y, pensando en el control de un televisor, con Enter (OK) o un toque del puntero; estas dos solo entran, nunca salen, para que dos pulsaciones seguidas no se anulen.
- La proyección se dibuja solo con `createStage()` (`web/modules/projection/stage.js`), que usa unidades relativas al contenedor (`cqh`/`cqw`) para que una miniatura y la pantalla real se vean iguales. El escenario pone el fondo y el modo; **el contenido lo dibuja el tipo de cada elemento**.
- Un **tipo de contenido** es `web/modules/<id>/kind.js`, que llama a `registerKind()` (contrato en `web/core/kinds.js`), y una línea en `web/modules/kinds.js`. Un `kind.js` no importa `stage.js` (se importarían en círculo); lo que comparten los tipos de texto está en `projection/text.js`.
- Los **mandos en vivo** de un tipo (`controls` en su `registerKind`) se muestran con `createLiveControls(contenedor)` de `projection/live.js`. Se crea **una vez** por pantalla y se recoloca; no se crea en cada redibujado, porque se suscribe al estado.
- Lo que depende del tiempo (un cronómetro, el avance de un video) se calcula con `positionAt(reloj)` de `web/core/playback.js`, nunca contando segundos en el navegador.
- Las tareas en curso se muestran con `createJobsList()` o `jobRow()` de `web/core/jobs.js`.

## Pantallas táctiles y tamaños

- Tres disposiciones por ancho: 1180 px o más, 860-1179 px y menos de 860 px (ver `DESIGN.md`, sección 12). Los cortes están en `web/core/shell.css` y en el `.css` de cada módulo.
- Lo táctil se detecta con la clase `touch` en `<html>` (la pone un script mínimo en la cabecera de cada página). Los controles usan `var(--control)`, que vale 34 px con ratón y 44 px con dedo. Nada pulsable por debajo de 40 px en táctil.
- Garantías en cualquier tamaño: ver qué está al aire, avanzar y retroceder, y llegar a la acción principal sin desplazarse.
- **Al tocar cualquier disposición, ejecutar `node scripts/auditar-responsive.mjs`.**

## Detalles que ya dieron problemas

- En la lista de versículos, un clic nunca desplaza la lista (rompería el doble clic). Solo la desplazan el teclado, los botones y las búsquedas.
- La conexión en tiempo real se suelta en `pagehide` (`web/core/api.js`). Sin eso, tras unas cuantas navegaciones el navegador agota sus seis conexiones por servidor y la app deja de cargar.
- Dentro de un contenedor flex con desplazamiento, los hijos necesitan `flex-shrink: 0` o los monitores se aplastan.
- El panel "Al aire" mide 288 px en tableta: una fila de tres botones con texto se sale si no pueden encoger (`min-width: 0`).
- Las capturas del navegador integrado pueden mostrar un cuadro anterior. Para comprobar algo que cambia en el tiempo, leer el DOM o usar `scripts/auditar-responsive.mjs capturas`.
- Textos de la interfaz en español, claros para voluntarios sin conocimientos técnicos.
