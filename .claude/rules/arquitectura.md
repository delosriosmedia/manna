# Arquitectura

## Principio

El **servidor es la única fuente de verdad**. Los dispositivos son vistas: reciben el estado y envían órdenes. Ningún dato compartido vive solo en un navegador (`localStorage` se usa únicamente para preferencias de ese dispositivo, como la versión de la Biblia elegida).

## Piezas

- **Estado** (`server/core/store.js`): dividido por espacios. De los módulos: `system`, `bible`, `projection`, `live`, `order`. Del núcleo: `conexiones`, `jobs`, `tools`. `store.set(ns, patch)` lo cambia y lo envía a todos.
- **Tiempo real** (`server/core/realtime.js`): SSE en `GET /api/events?rol=<rol>`. Eventos `state` (todo, al conectar), `patch` (un espacio, en cada cambio) y `ping` (latido cada 10 s, con la hora del servidor). El cliente (`web/core/api.js`) rehace la conexión si pasan 25 s sin recibir nada y siempre recibe el estado completo al reconectar: ningún módulo necesita lógica propia de reconexión.
- **Acciones** (`POST /api/action` con `{ type, payload }`): toda orden que cambia algo. Se registran con `app.action('modulo.verbo', { permission }, handler)`.
- **Rutas** (`app.route`): solo para lecturas (`GET`) y subida de archivos. `app.mount('/prefijo/', carpeta)` sirve una carpeta de contenido.
- **Roles y permisos** (`server/roles.js`): cada rol lista sus permisos; `'*'` es todo. Las acciones declaran qué permiso exigen.
- **Sesiones** (`server/core/sessions.js`): una cookie por navegador con el rol. PIN para roles con `requiresPin`, salvo desde localhost.
- **Almacenamiento** (`app.storage('nombre', porDefecto)`): un JSON por módulo en `data/`.
- **Tareas** (`app.jobs`, `server/core/jobs.js`): lo que tarda (convertir, descargar) corre en segundo plano y publica su avance y el tiempo que falta en el espacio `jobs`. Nunca se hace esperar a una acción por un trabajo largo.
- **Programas externos** (`app.tools`, `server/core/tools.js`): única puerta a ffmpeg, yt-dlp, PowerPoint y el navegador: `tools.has(id)`, `tools.path(id)`, `tools.spawn(id, args)`. Publica el espacio `tools`. **Ninguno bloquea**: si falta, lo que falla es la función que lo usa, con un mensaje que dice cómo instalarlo. Qué necesita cada módulo lo declara él mismo en la web (`needs`, ver `web/core/needs.js`); con eso la revisión del equipo y el propio módulo avisan.
- **Búsqueda de texto** (`server/core/search.js`): índice de palabras y búsqueda por niveles (frase exacta, todas las palabras, parecidas) con marcas de lo encontrado. La usa la Biblia (un índice por versión, `bible.indexed` dice cuántas están listas) y la usará el himnario.
- **Reloj de reproducción** (`server/core/playback.js`): el servidor guarda `{ playing, position, at, duration }`; cada pantalla calcula la posición con la hora del servidor (`serverNow()` en `web/core/api.js`).

## Módulos

Un módulo es una carpeta en `server/modules/<id>/` cuyo `index.js` exporta `setup(app)`, más su interfaz en `web/modules/<id>/`. Se registra en la lista `MODULES` de `server/app.js`.

- Un módulo **no importa archivos de otro módulo**. Si necesita algo de otro, usa `app.services.<nombre>` (lo que el otro publica) o `app.run('otro.accion', payload)`.
- Nombres de acción: `modulo.verbo` (`projection.show`, `order.add`).
- Nombres de permiso: `modulo.capacidad` (`projection.control`, `order.edit`).
- En la web, cada módulo es `web/modules/<id>/workspace.js` y se lista en `web/modules/registry.js`. La estructura común (barra de módulos, espacio de trabajo, panel "Al aire") es `web/core/shell.js`; las páginas de `web/roles/` solo eligen qué módulos recibe cada función.

Para crear uno, usa la skill `/nuevo-modulo`.

## Contenido proyectable y orden del culto

Todo lo que se proyecta es de un **tipo de contenido** (`kind`). Hoy existen `verses` (Biblia) y `testcard` (imagen de prueba, en `projection`: el ejemplo más pequeño de un tipo con mandos). Los que faltan están en `docs/PLAN.md`, sección 3.2. Un módulo registra el suyo con `app.kind(nombre, { label, describe, resolve, neighbor, live, control })`:

- `describe(data)` → `{ title, subtitle, steps, data }`: cómo se ve en el orden del culto y cuántos **pasos** tiene (versículos, estrofas, diapositivas). `null` si ya no existe.
- `resolve(data, step)` → lo que se proyecta. `step` `null` es el elemento entero; `0..n-1`, uno de sus pasos.
- `neighbor(data, step, delta)` (opcional) → qué sigue al avanzar fuera del orden del culto.
- `live(content, previous)` y `control(state, patch, { content, now })` (opcionales) → sus mandos en vivo. Ver abajo.

`data` es lo mínimo para localizar el contenido (para `verses`: `{ versionId, ref }`), nunca el contenido mismo.

**Estado de proyección**: `projection.item = { kind, uid, ...contenido, source: { kind, data, step, orderId } }`. `source` dice de dónde salió y es lo que se guarda en disco (junto con los mandos en vivo). `uid` cambia en cada proyección.

**Mandos en vivo**: lo que cambia mientras algo está al aire (el zoom de una imagen, el punto de un video) vive en el espacio `live`, aparte de `projection`, para que mover un mando no reenvíe el contenido ni redibuje el orden.

- `live = { uid, state, volume }`. `uid` dice a qué proyección pertenece `state`; una pantalla ignora un `state` de otro `uid`.
- El estado inicial lo da `live()` del tipo. `previous = { state, at }` llega al recuperar lo proyectado tras un reinicio.
- Las órdenes van por la acción `projection.control`, que entrega el patch al `control()` del tipo: este **valida** y devuelve el estado nuevo.
- `volume` es el volumen general de Manna (acción `projection.volume`). Suena una sola pantalla: la de proyección abierta en el equipo principal.

**Orden del culto** (`server/modules/order/`): `order.items` es una lista de `{ id, kind, title, subtitle, steps, data }` y de secciones `{ id, kind: 'section', title }`. Es el punto donde confluyen todos los módulos: cualquiera añade elementos con `order.add { kind, data }`. Un elemento con nombre propio (`order.rename`) lleva además `original`, el título que le da su contenido.

**Anterior / siguiente** (`projection.step`): si lo proyectado viene del orden (`source.orderId`), recorre los pasos del elemento y luego pasa al elemento vecino, saltando secciones (`order/logic.js`). Si no, decide el `neighbor` del tipo.

**En la web**, un tipo es `web/modules/<id>/kind.js`, que llama a `registerKind(nombre, { icon, label, unit, title, key, background, draw, controls })` (contrato en `web/core/kinds.js`) y se lista en `web/modules/kinds.js`; su color va en `.kind.k-<tipo>` (`web/core/app.css`). El escenario (`web/modules/projection/stage.js`) solo pone el fondo y el modo: un tipo nuevo no lo toca.

## Arranque y apagado

- El usuario abre Manna con un icono que ejecuta `node server/index.js --segundo-plano`. No hay ventana: la interfaz es el control en el navegador.
- Antes de abrir el navegador, `app.tools.scan()` revisa los programas del equipo. Si falta alguno que no sea opcional, Manna se abre en `/requisitos` (revisión del equipo) en vez de en `/control`. Es solo un aviso: ninguna página se bloquea.
- Pulsar el icono con Manna ya abierto no crea otra copia: `server/app.js` reconoce su propia instalación por `ajustes.json → id` (el mismo que devuelve `GET /api/ping`) y solo abre el control.
- Se apaga con la acción `system.shutdown` (botón "Apagar"), que exige estar en el equipo principal (`ctx.isLocal`) y llama a `app.shutdown()`. Cerrar la pestaña del control no apaga nada.
- Lo que un módulo deba liberar al apagar se registra con `app.onClose()`.

## Cómo llegan los dispositivos al servidor

- `system.addresses`: direcciones numéricas, ordenadas; la primera es la recomendada y la que lleva el código QR. `system.nameUrl`: dirección con nombre (`http://manna.local`), o `null` si no se pudo anunciar.
- El nombre lo anuncia `server/modules/system/mdns.js`. Se comprueba a sí mismo cada 10 s y se rehace solo si deja de funcionar o cambia la IP.
- Una página abierta por la dirección numérica pasa sola a la del nombre si el dispositivo la entiende (`web/core/upgrade.js`, que consulta `GET /api/ping`). Solo lo hacen la pantalla de inicio y la de proyección, antes de que exista sesión: la sesión es una cookie atada a la dirección, y cambiar de dirección con sesión abierta obligaría a repetir el PIN.
- Las páginas no deben construir direcciones con la IP ni asumir un puerto: rutas relativas para lo propio, `state.system` para mostrar direcciones.

## Lo que debe sobrevivir a un reinicio

El estado vive en memoria. Lo que deba conservarse si el servidor se reinicia lo guarda cada módulo con `app.storage()` y lo restaura en su `setup()`. Ejemplo: lo que está en pantalla (`server/modules/projection/live.js`, se recupera si el reinicio ocurre en menos de 15 minutos).

## Referencias bíblicas

Siempre por **posición**: `{ book: 1-66, chapter, verseStart, verseEnd }`. Nunca por nombre de libro ni por texto. El texto se resuelve en el servidor con `services.bible.passage(versionId, ref)`.
