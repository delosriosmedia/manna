# Arquitectura

## Principio

El **servidor es la única fuente de verdad**. Los dispositivos son vistas: reciben el estado y envían órdenes. Ningún dato compartido vive solo en un navegador (`localStorage` se usa únicamente para preferencias de ese dispositivo, como la versión de la Biblia elegida).

## Piezas

- **Estado** (`server/core/store.js`): dividido por espacios, uno por módulo (`projection`, `playlist`, `bible`, `system`, `conexiones`). `store.set(ns, patch)` lo cambia y lo envía a todos.
- **Tiempo real** (`server/core/realtime.js`): SSE en `GET /api/events?rol=<rol>`. Eventos `state` (todo, al conectar), `patch` (un espacio, en cada cambio) y `ping` (latido cada 10 s). El cliente (`web/core/api.js`) rehace la conexión si pasan 25 s sin recibir nada y siempre recibe el estado completo al reconectar: ningún módulo necesita lógica propia de reconexión.
- **Acciones** (`POST /api/action` con `{ type, payload }`): toda orden que cambia algo. Se registran con `app.action('modulo.verbo', { permission }, handler)`.
- **Rutas** (`app.route`): solo para lecturas (`GET`) y subida de archivos.
- **Roles y permisos** (`server/roles.js`): cada rol lista sus permisos; `'*'` es todo. Las acciones declaran qué permiso exigen.
- **Sesiones** (`server/core/sessions.js`): una cookie por navegador con el rol. PIN para roles con `requiresPin`, salvo desde localhost.
- **Almacenamiento** (`app.storage('nombre', porDefecto)`): un JSON por módulo en `data/`.

## Módulos

Un módulo es una carpeta en `server/modules/<id>/` cuyo `index.js` exporta `setup(app)`, más su interfaz en `web/modules/<id>/`. Se registra en la lista `MODULES` de `server/app.js`.

- Un módulo **no importa archivos de otro módulo**. Si necesita algo de otro, usa `app.services.<nombre>` (lo que el otro publica) o `app.run('otro.accion', payload)`.
- Nombres de acción: `modulo.verbo` (`projection.show`, `playlist.add`).
- Nombres de permiso: `modulo.capacidad` (`projection.control`, `playlist.edit`).
- Las páginas de `web/roles/` componen módulos; la lógica vive en `web/modules/`.

Para crear uno, usa la skill `/nuevo-modulo`.

## Contenido proyectable

`projection.item` describe lo que está en pantalla y lleva un campo `kind` (hoy solo `'verses'`). Un módulo nuevo que proyecte otra cosa (canciones, anuncios, imágenes) añade su propio `kind` y su forma de dibujarlo en `web/modules/projection/stage.js`, sin cambiar los existentes.

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
