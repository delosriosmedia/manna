# Arquitectura

## Principio

El **servidor es la única fuente de verdad**. Los dispositivos son vistas: reciben el estado y envían órdenes. Ningún dato compartido vive solo en un navegador (`localStorage` se usa únicamente para preferencias de ese dispositivo, como la versión de la Biblia elegida).

## Piezas

- **Estado** (`server/core/store.js`): dividido por espacios, uno por módulo (`projection`, `playlist`, `bible`, `system`, `conexiones`). `store.set(ns, patch)` lo cambia y lo envía a todos.
- **Tiempo real** (`server/core/realtime.js`): SSE en `GET /api/events?rol=<rol>`. Evento `state` (todo, al conectar) y `patch` (un espacio, en cada cambio).
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

## Referencias bíblicas

Siempre por **posición**: `{ book: 1-66, chapter, verseStart, verseEnd }`. Nunca por nombre de libro ni por texto. El texto se resuelve en el servidor con `services.bible.passage(versionId, ref)`.
