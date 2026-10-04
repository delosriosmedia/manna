---
paths:
  - "server/**"
---

# Servidor

- Node 18 como mínimo: no usar APIs más nuevas. Solo módulos integrados (`node:fs`, `node:http`, `node:crypto`…). **Sin dependencias.**
- Módulos ES (`import`/`export`). `server/index.js` debe seguir siendo mínimo: solo comprueba la versión de Node antes de cargar el resto.
- Errores esperables: `throw new HttpError(estado, 'mensaje en español para el usuario')`. El mensaje se muestra tal cual en la interfaz.
- Toda entrada del cliente se valida en el servidor (ver `STYLE_RULES` en `modules/projection/index.js`). No confiar en lo que mande el navegador.
- Las acciones declaran siempre su permiso. Las rutas que no son de lectura llaman a `ctx.require('permiso')`.
- Lo que solo debe verse en el equipo principal se protege con `ctx.isLocal` (ejemplo: ver el PIN).
- Archivos subidos van a `data/media/` (`app.uploadsDir`) y se sirven por `/media/`. En el estado se guarda la URL, nunca el contenido. Se reciben con `ctx.save(archivo, límite)`, que escribe directo a disco; `ctx.raw()` solo para cuerpos pequeños. Todo archivo se sirve con trozos (Range): `app.mount()` para una carpeta, `ctx.file(ruta)` para uno suelto.
- Archivos de paso (descargas, conversiones al vuelo): `app.tmpDir` (`data/tmp/`), que se vacía al abrir y al cerrar Manna. Carpetas que el usuario llena a mano: `watchFolder` y `listFiles` de `core/folders.js`.
- Buscar texto (sin tildes, por niveles, con marcas): `core/search.js`. No escribir otra búsqueda por módulo.
- Trabajos largos: `const job = app.jobs.start({ title, owner, ref })`, luego `job.update({ progress })`, `job.done()` o `job.fail(mensaje)`. La acción que lo lanza responde enseguida.
- Guardado en disco: `storage.save()` (agrupa escrituras). No escribir JSON a mano.
- Procesos externos del sistema (Chrome, `osascript`, PowerShell): solo en `modules/projection/display.js` y `launcher.js`, con rama para macOS, Windows y Linux. Lo que se añada debe contemplar al menos macOS y Windows. Al lanzar programas de consola en Windows, usar `windowsHide: true` (salvo para Chrome, que quedaría invisible).
- Programas externos (ffmpeg, yt-dlp, PowerPoint): **solo con `app.tools.spawn(id, args)`**, siempre con lista de argumentos y nunca armando una orden con texto que venga del usuario. Un programa nuevo se añade al catálogo de `core/tools.js` con su nivel (`feature` u `optional`; ninguno bloquea el arranque), para qué sirve y cómo instalarlo. Antes de usar uno, comprobar `app.tools.has(id)`: `spawn` lanza un error con las instrucciones si falta.
- Descargar programas (`core/install.js`): solo de las direcciones fijadas en `core/tools.js`, comprobando la huella que publica el distribuidor, y solo cuando lo pide el equipo principal.
- Arranque (`server/app.js`): con `--segundo-plano` los mensajes van a `data/manna.log` y un fallo de arranque se muestra en una página (`data/error.html`). Antes de arrancar se comprueba si ya hay un Manna con los mismos datos; si lo hay, solo se abre el control. No escribir el PIN ni otros secretos en el registro.
- Los lanzadores viven fuera de `server/`: `Instalar Manna en ….` (raíz) e `instalacion/`. Los `.bat` van en ASCII puro (sin tildes) y con finales de línea CRLF; pasan rutas a PowerShell por variables de entorno, nunca pegadas en el comando.
- Recursos que hay que liberar al apagar (temporizadores, procesos, vigilancia de carpetas): registrar con `app.onClose()`.
- Puerto: sin `PORT` fijado se intenta el 80 y, si no se puede, del 8000 en adelante (`portCandidates` en `core/app.js`). Usar siempre `app.port` y `origin()` de `modules/system/network.js`; no escribir `:8000` a mano.
- Variables de entorno: `PORT`, `MANNA_DATA`, `MANNA_BIBLIAS`, `MANNA_NO_OPEN`, `MANNA_NAME` (nombre en la red, por defecto `manna`; en pruebas usar otro para no chocar con un Manna real) y `MANNA_HOST` (dirección en la que escucha y que se anuncia; por defecto todas. Solo para pruebas).
- Solo para pruebas de la revisión del equipo: `MANNA_FALTA=ffmpeg,yt-dlp,navegador` hace como si el equipo no tuviera esos programas (lo que Manna instale en `data/herramientas/` sí cuenta), y `MANNA_DESCARGAS='{"yt-dlp":{"url":…,"file":…}}'` cambia de dónde se descarga uno, para probar la instalación sin internet.
- Comentarios: en español, y solo donde expliquen el porqué.
