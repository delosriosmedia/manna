# Manna - Church projection app

Aplicación web para proyectar en la iglesia. Un equipo principal (con el proyector como segunda pantalla) hace de servidor; celulares y PC de la red local entran por el navegador y eligen una función (rol).

Repositorio: https://github.com/delosriosmedia/manna

## Antes de empezar a trabajar

1. Lee `docs/ESTADO.md`: qué funciona, qué falta probar y qué sigue.
2. Las reglas detalladas están en `.claude/rules/` (arquitectura, servidor, web, biblias, pruebas, documentación).

## Comandos

- Iniciar en desarrollo: `node server/index.js` (mensajes en la terminal; Ctrl+C para apagar)
- Como lo abre el usuario: icono **Manna**, creado por `Instalar Manna en Windows.bat` / `Instalar Manna en Mac.command`. Arranca con `--segundo-plano` (sin ventana, registro en `data/manna.log`) y se apaga con el botón "Apagar" del control
- Pruebas: `npm test`
- Servidor de prueba sin abrir navegador ni tocar los datos reales:
  `MANNA_NAME=manna-prueba MANNA_NO_OPEN=1 MANNA_DATA="$TMPDIR/manna-prueba" PORT=8123 node server/index.js`
- Pruebas en un Chrome real (paso a `manna.local`, aviso al cerrar, cambio de IP): `node scripts/probar-chrome.mjs`

## Stack

- Servidor: Node.js 18+, módulos ES, **sin dependencias** (no hay `npm install`).
- Web: HTML, CSS y JavaScript puro con módulos ES. **Sin framework ni paso de compilación.**
- Tiempo real: Server-Sent Events (`GET /api/events`). Órdenes: `POST /api/action`.
- Red: puerto 80 (8000 si está ocupado) y nombre `manna.local` anunciado por mDNS, hecho a mano en `server/modules/system/mdns.js`.
- Datos locales en `data/` (JSON y medios). Biblias en `Biblias/`.

## Límites fijados por el dueño del proyecto

- Siempre será una **web app en red local**. Nada de apps nativas ni servicios en la nube.
- No añadir dependencias externas, frameworks ni compilación sin aprobación explícita.
- Las biblias con derechos de autor **nunca** se suben al repositorio (solo la Reina-Valera 1909).
- Interfaz, mensajes, comentarios y documentación en **español**.
- El equipo principal de la iglesia es **Windows**. Lo que afecte al arranque o al sistema debe funcionar ahí, aunque el desarrollo se haga en Mac.
- Por ahora se aceptan Node.js y Chrome como requisitos del equipo principal. Compilar instaladores (Electron) está aplazado; ver `docs/ESTADO.md`.
- La ventana de proyección del equipo principal solo se abre en una **segunda pantalla**; si no hay, se avisa y no se abre.
- Todo rol que no sea "proyección" exige PIN desde dispositivos remotos.
- El proyecto va a crecer con muchos módulos: todo lo nuevo entra como módulo, sin acoplarse a los existentes.

## Forma de trabajar

- Cambios grandes: primero un plan y esperar aprobación; luego implementar.
- Probar de verdad antes de dar algo por hecho (`.claude/rules/pruebas.md`) y decir con claridad lo que no se pudo probar.
- Publicar con la skill `/publicar`, que se detiene a mostrar el resumen antes del push.
- **Al terminar cualquier cambio, actualizar la documentación** según `.claude/rules/documentacion.md`. El proyecto debe poder retomarlo otra persona u otro asistente solo con lo que está en el repositorio.

## Skills del proyecto

- `/nuevo-modulo` — crea un módulo completo (servidor, web, permisos, pruebas, documentación).
- `/probar` — levanta un servidor de prueba y verifica en el navegador.
- `/publicar` — pruebas, documentación, versión, commit y push (con confirmación).
