# Manna - Church projection app

Aplicación web para proyectar en la iglesia. Un equipo principal (con el proyector como segunda pantalla) hace de servidor; celulares y PC de la red local entran por el navegador y eligen una función (rol).

Repositorio: https://github.com/delosriosmedia/manna

## Antes de empezar a trabajar

1. Lee `docs/ESTADO.md`: qué funciona, qué falta probar y qué sigue. El trabajo en curso sigue `docs/PLAN.md`, fase a fase.
2. Las reglas detalladas están en `.claude/rules/` (arquitectura, servidor, web, biblias, pruebas, documentación).
3. Antes de tocar cualquier pantalla, lee `DESIGN.md`: el sistema de diseño de la interfaz.

## Comandos

- Iniciar en desarrollo: `node server/index.js` (mensajes en la terminal; Ctrl+C para apagar)
- Como lo abre el usuario: icono **Manna**, creado por `Instalar Manna en Windows.bat` / `Instalar Manna en Mac.command`. Arranca con `--segundo-plano` (sin ventana, registro en `data/manna.log`) y se apaga con el botón "Apagar" del control
- Pruebas: `npm test` (incluye la revisión del código sin ejecutarlo: imports que no existen, nombres que tapan algo importado y órdenes que el servidor no tiene)
- Servidor de prueba sin abrir navegador ni tocar los datos reales:
  `MANNA_NAME=manna-prueba MANNA_NO_OPEN=1 MANNA_SIN_VENTANA=1 MANNA_DATA="$TMPDIR/manna-prueba" PORT=8123 node server/index.js`
  (`MANNA_SIN_VENTANA=1` es obligatorio en pruebas: sin él, si hay un proyector conectado, la prueba se proyecta y suena en él)
- Pruebas de extremo a extremo en un Chrome real: `node scripts/probar-chrome.mjs` (completas, 3 min) o `node scripts/probar-chrome.mjs rapido` (revisión del equipo e interfaz, 1 min). Usa los puertos 8123 y 8125: cierra antes la demostración
- Auditoría de adaptación a pantallas (celular, tableta, escritorio): `node scripts/auditar-responsive.mjs`
- Demostración con un orden del culto de ejemplo y datos temporales: `node scripts/demo.mjs` (puerto 8123). Con ella, `/vista-previa` muestra la app en el marco de un celular o una tableta

## Stack

- Servidor: Node.js 18+, módulos ES, **sin dependencias** (no hay `npm install`).
- Programas externos del equipo principal: Chrome o Edge, ffmpeg, yt-dlp y PowerPoint. Se detectan, se instalan y se ejecutan solo a través de `server/core/tools.js` (PowerPoint se gobierna desde `server/modules/slides/powerpoint.js`). Al abrirse, Manna revisa que estén (`/requisitos`).
- Web: HTML, CSS y JavaScript puro con módulos ES. **Sin framework ni paso de compilación.** Tipografía (Geist), iconos (Phosphor) y pdf.js incluidos en `web/vendor/`.
- Tiempo real: Server-Sent Events (`GET /api/events`). Órdenes: `POST /api/action`.
- Red: puerto 80 (8000 si está ocupado) y nombre `manna.local` anunciado por mDNS, hecho a mano en `server/modules/system/mdns.js`. Cada puerto atiende `http` y `https` a la vez (certificado propio, hecho a mano en `server/core/cert.js`); con el 80 se abren además el 8000 y el 443.
- Datos locales en `data/` (JSON, medios subidos, programas instalados por Manna y temporales). Lo que pone cada iglesia, en `Contenido/`: `Biblias/`, `Himnario/videos/`, `Himnario/letras/` y `Medios/` (ver `Contenido/LEEME.txt`).

## Límites fijados por el dueño del proyecto

- Siempre será una **web app en red local**. Nada de apps nativas ni servicios en la nube.
- No añadir dependencias externas, frameworks ni compilación sin aprobación explícita. Aprobados el 2026-10-04: **ffmpeg y yt-dlp** como programas del equipo principal, **PowerPoint** para las presentaciones si está instalado, y **pdf.js** dentro de `web/vendor/`. Nada más.
- La revisión inicial del equipo comprueba que está todo lo necesario y avisa de qué módulos funcionarán y cuáles no, pero **nunca bloquea**: Manna se abre igual, y cada módulo avisa al abrirlo de lo que le falta y ofrece instalarlo. Abrir Manna debe seguir siendo fácil para alguien sin conocimientos técnicos.
- Las biblias con derechos de autor **nunca** se suben al repositorio (solo la Reina-Valera 1909). Tampoco los himnos en video, los medios de cada iglesia ni las letras de los himnos. Todo eso vive en `Contenido/`, que no se publica: las letras se usan (las iglesias tienen la licencia y el dueño las entregó), pero solo en local. Las pruebas y la documentación no llevan letras reales: se usan textos inventados.
- La búsqueda de texto en la Biblia se hace **solo en la Reina-Valera 1960**, no en todas las versiones.
- El volumen que maneja Manna es el suyo (un volumen general para todo lo que suene). No se toca el del equipo.
- Sin modelos de lenguaje: la búsqueda se resuelve con índices propios.
- Interfaz, mensajes, comentarios y documentación en **español**.
- El equipo principal de la iglesia es **Windows**. Lo que afecte al arranque o al sistema debe funcionar ahí, aunque el desarrollo se haga en Mac.
- Por ahora se acepta que el equipo principal necesite programas instalados (Node.js antes de abrir; el resto lo revisa e instala Manna). Compilar instaladores (Electron) está aplazado; ver `docs/ESTADO.md`.
- La ventana de proyección del equipo principal solo se abre en una **segunda pantalla**; si no hay, se avisa y no se abre.
- Todo rol que no sea "proyección" exige PIN desde dispositivos remotos.
- El proyecto va a crecer con muchos módulos: todo lo nuevo entra como módulo, sin acoplarse a los existentes.
- Todo lo que un módulo produce se puede añadir al **Orden del culto** (antes "guion"), que es donde confluyen todos.
- Los celulares se usan en vertical; las tabletas, también en horizontal. Toda pantalla debe funcionar así.

## Forma de trabajar

- Cambios grandes: primero un plan y esperar aprobación; luego implementar.
- Probar de verdad antes de dar algo por hecho (`.claude/rules/pruebas.md`) y decir con claridad lo que no se pudo probar.
- El trabajo de la versión 2 sigue `docs/PLAN.md`: al cerrar cada fase se actualizan su seguimiento (sección 9), los cambios hechos al plan (sección 10) y los cambios sugeridos (sección 11), y se publica.
- **Informe al dueño al cerrar cada fase**: resultados de la fase; **el plan de nuevo, con las fases superadas marcadas y las observaciones**; la fase que sigue; y **un apartado con los cambios que se le sugieren al plan**.
- Publicar con la skill `/publicar`, que se detiene a mostrar el resumen antes del push. Excepción aprobada por el dueño el 2026-10-04: **al cerrar una fase del plan se publica sin esperar**, y el resumen se le entrega después.
- **Al terminar cualquier cambio, actualizar la documentación** según `.claude/rules/documentacion.md`. El proyecto debe poder retomarlo otra persona u otro asistente solo con lo que está en el repositorio.

## Skills del proyecto

- `/nuevo-modulo` — crea un módulo completo (servidor, web, permisos, pruebas, documentación).
- `/probar` — levanta un servidor de prueba y verifica en el navegador.
- `/publicar` — pruebas, documentación, versión, commit y push (con confirmación).
