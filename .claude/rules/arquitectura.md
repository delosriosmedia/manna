# Arquitectura

## Principio

El **servidor es la única fuente de verdad**. Los dispositivos son vistas: reciben el estado y envían órdenes. Ningún dato compartido vive solo en un navegador (`localStorage` se usa únicamente para preferencias de ese dispositivo, como la versión de la Biblia elegida).

## Piezas

- **Estado** (`server/core/store.js`): dividido por espacios, uno por módulo (`projection`, `order`, `bible`, `system`, `conexiones`). `store.set(ns, patch)` lo cambia y lo envía a todos.
- **Tiempo real** (`server/core/realtime.js`): SSE en `GET /api/events?rol=<rol>`. Eventos `state` (todo, al conectar), `patch` (un espacio, en cada cambio) y `ping` (latido cada 10 s). El cliente (`web/core/api.js`) rehace la conexión si pasan 25 s sin recibir nada y siempre recibe el estado completo al reconectar: ningún módulo necesita lógica propia de reconexión.
- **Acciones** (`POST /api/action` con `{ type, payload }`): toda orden que cambia algo. Se registran con `app.action('modulo.verbo', { permission }, handler)`.
- **Rutas** (`app.route`): solo para lecturas (`GET`) y subida de archivos.
- **Roles y permisos** (`server/roles.js`): cada rol lista sus permisos; `'*'` es todo. Las acciones declaran qué permiso exigen.
- **Sesiones** (`server/core/sessions.js`): una cookie por navegador con el rol. PIN para roles con `requiresPin`, salvo desde localhost.
- **Almacenamiento** (`app.storage('nombre', porDefecto)`): un JSON por módulo en `data/`.

## Módulos

Un módulo es una carpeta en `server/modules/<id>/` cuyo `index.js` exporta `setup(app)`, más su interfaz en `web/modules/<id>/`. Se registra en la lista `MODULES` de `server/app.js`.

- Un módulo **no importa archivos de otro módulo**. Si necesita algo de otro, usa `app.services.<nombre>` (lo que el otro publica) o `app.run('otro.accion', payload)`.
- Nombres de acción: `modulo.verbo` (`projection.show`, `order.add`).
- Nombres de permiso: `modulo.capacidad` (`projection.control`, `order.edit`).
- En la web, cada módulo es `web/modules/<id>/workspace.js` y se lista en `web/modules/registry.js`. La estructura común (barra de módulos, espacio de trabajo, panel "Al aire") es `web/core/shell.js`; las páginas de `web/roles/` solo eligen qué módulos recibe cada función.

Para crear uno, usa la skill `/nuevo-modulo`.

## Contenido proyectable y orden del culto

Todo lo que se proyecta es de un **tipo de contenido** (`kind`). Hoy existe `verses`; los módulos futuros añadirán `song`, `image`, `video`, `slides`. Un módulo registra el suyo con `app.kind(nombre, { label, describe, resolve, neighbor })`:

- `describe(data)` → `{ title, subtitle, steps, data }`: cómo se ve en el orden del culto y cuántos **pasos** tiene (versículos, estrofas, diapositivas). `null` si ya no existe.
- `resolve(data, step)` → lo que se proyecta. `step` `null` es el elemento entero; `0..n-1`, uno de sus pasos.
- `neighbor(data, step, delta)` (opcional) → qué sigue al avanzar fuera del orden del culto.

`data` es lo mínimo para localizar el contenido (para `verses`: `{ versionId, ref }`), nunca el contenido mismo.

**Estado de proyección**: `projection.item = { kind, ...contenido, source: { kind, data, step, orderId } }`. `source` dice de dónde salió y es lo único que se guarda en disco.

**Orden del culto** (`server/modules/order/`): `order.items` es una lista de `{ id, kind, title, subtitle, steps, data }` y de secciones `{ id, kind: 'section', title }`. Es el punto donde confluyen todos los módulos: cualquiera añade elementos con `order.add { kind, data }`.

**Anterior / siguiente** (`projection.step`): si lo proyectado viene del orden (`source.orderId`), recorre los pasos del elemento y luego pasa al elemento vecino, saltando secciones (`order/logic.js`). Si no, decide el `neighbor` del tipo.

**En la web**, un tipo nuevo necesita: su icono y nombre en `KINDS` (`web/core/icons.js`), su color en `.kind.k-<tipo>` (`web/core/app.css`) y cómo se dibuja en `web/modules/projection/stage.js`.

## Arranque y apagado

- El usuario abre Manna con un icono que ejecuta `node server/index.js --segundo-plano`. No hay ventana: la interfaz es el control en el navegador.
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
