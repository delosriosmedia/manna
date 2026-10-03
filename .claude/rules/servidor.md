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
- Archivos subidos van a `data/media/` y se sirven por `/media/`. En el estado se guarda la URL, nunca el contenido.
- Guardado en disco: `storage.save()` (agrupa escrituras). No escribir JSON a mano.
- Procesos externos (Chrome, `osascript`, PowerShell): solo en `modules/projection/display.js` y `launcher.js`, con rama para macOS, Windows y Linux. Lo que se añada debe contemplar al menos macOS y Windows.
- Recursos que hay que liberar al apagar (temporizadores, procesos, vigilancia de carpetas): registrar con `app.onClose()`.
- Variables de entorno: `PORT`, `MANNA_DATA`, `MANNA_BIBLIAS`, `MANNA_NO_OPEN`.
- Comentarios: en español, y solo donde expliquen el porqué.
