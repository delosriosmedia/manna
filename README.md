<p align="center"><img src="docs/logo.png" width="112" alt="Logo de Manna"></p>

# Manna - Church projection app

Aplicación web para proyectar en la iglesia. Un equipo principal (el que tiene el proyector) hace de servidor, y cualquier celular, tableta o PC de la misma red local se conecta por el navegador y elige qué función cumplir.

## Qué hace

- **Tres zonas, siempre iguales**: los módulos a la izquierda, el módulo activo al centro y el panel **Al aire** a la derecha, con el monitor de lo proyectado y los mandos (anterior, siguiente, negro, solo fondo).
- **Biblia**: buscador por cita (`Juan 3:16-18`, `1 co 13 4`, `sal 23`) o por palabras sin importar tildes; los 66 libros a la vista en una rejilla; capítulos y versículos; pasajes recientes. Lee los archivos `.xmm` (OpenLP) y `.xml` de la carpeta `Biblias/`; basta copiar un archivo y aparece solo.
- **Orden del culto**: la lista ordenada de todo lo que se va a proyectar, con secciones (Apertura, Mensaje…). Cada elemento muestra su tipo y sus pasos; "Siguiente" recorre los pasos y luego pasa al elemento que sigue. Se comparte entre todos los dispositivos.
- **Preparado para crecer**: himnario, imágenes, videos y presentaciones ya tienen su sitio en la interfaz. Cada módulo nuevo aporta su pantalla y un tipo de elemento para el orden del culto.
- **Funciones por dispositivo**: cada dispositivo elige al entrar.
  - **Control completo**: todos los módulos. Pide PIN.
  - **Control del orden**: solo proyecta lo que ya está en el orden del culto. Pensado para el celular. Pide PIN.
  - **Pantalla de proyección**: espejo de la proyección principal. Sin PIN.
- **Celular, tableta y escritorio**: en pantallas estrechas se ve un módulo a la vez, con pestañas abajo y "Al aire" como barra compacta que se despliega.
- **Proyección automática**: al iniciar, detecta la segunda pantalla del equipo principal y abre ahí la proyección a pantalla completa. Si no hay segunda pantalla, lo avisa y no la abre.
- **Apariencia de la proyección**: tipografía, colores, sombra, fondos e imagen propia, con ajuste automático del tamaño del texto para que siempre quepa.
- **Reconexión automática**: si un dispositivo pierde la red o queda en segundo plano, reconecta solo y se pone al día. Si Manna se reinicia, recupera lo que estaba en pantalla.

## Requisitos (solo en el equipo principal)

| Programa | Para qué | Descarga |
| --- | --- | --- |
| Node.js 18 o superior | Hace funcionar el servidor | https://nodejs.org/es/download |
| Google Chrome (o Edge en Windows) | Ventana de proyección a pantalla completa | https://www.google.com/chrome/ |

Si falta alguno, Manna no arranca y abre una página con las instrucciones (`instalacion/requisitos.html`). Los demás dispositivos no instalan nada.

## Instalación (una sola vez por equipo)

1. Copia la carpeta de Manna al equipo principal y pon tus biblias en la carpeta `Biblias/`.
2. Abre con doble clic el archivo que corresponda:
   - **Windows**: `Instalar Manna en Windows.bat`
   - **Mac**: `Instalar Manna en Mac.command`
3. El instalador comprueba los requisitos y crea el icono **Manna** en el Escritorio (y en el menú Inicio o en Aplicaciones). Al terminar, abre Manna.

Avisos que pueden salir la primera vez:

- **Windows**: el Firewall pregunta por Node.js. Elige *Permitir acceso* en redes privadas; sin eso los celulares no pueden conectarse.
- **Mac**: si macOS bloquea el instalador, ve a Ajustes del Sistema → Privacidad y seguridad → *Abrir igualmente*. Si pide permiso para leer la carpeta de Manna o para la red local, elige *Permitir*.

Si mueves la carpeta de Manna a otro sitio, vuelve a ejecutar el instalador. Para desinstalar, borra el icono (en Mac, también la app Manna de Aplicaciones) y la carpeta.

## Uso diario

1. Abre Manna con el icono **Manna**. No aparece ninguna ventana negra: se abre el control en el navegador y, si hay proyector conectado, la proyección en la segunda pantalla.
2. Si cierras la pestaña del control por error, Manna sigue funcionando y la proyección no se interrumpe. Vuelve a pulsar el icono para recuperar el control.
3. Para conectar otro dispositivo, con él en la misma red wifi:
   - escribe **`manna.local`** en su navegador, o
   - escanea el código QR de **Dispositivos**, en la barra izquierda del control (ahí está también el PIN).
4. Para apagar Manna: **Ajustes → Apagar Manna** (solo aparece en el equipo principal).

Al cerrar o recargar la pestaña del control, el navegador pide confirmación para evitar cierres por error.

Si Manna no abre, vuelve a pulsar el icono. Si sigue sin abrir, aparece una página con el motivo; el detalle queda en `data/manna.log`.

### Si un dispositivo pierde la conexión

Reconecta solo; no hay que recargar la página. Si el aviso rojo no desaparece:

- Comprueba que el dispositivo sigue en la misma wifi y que Manna está abierto en el equipo principal.
- Si el router se reinició, el equipo principal pudo recibir otra dirección. Los dispositivos que entraron por `manna.local` reconectan solos en un minuto aproximadamente. Los que no admiten ese nombre (Android anterior a la versión 12) deben volver a escanear el código de **Dispositivos**.

### Sobre la dirección `manna.local`

- iPhone, iPad, Mac, Windows 10/11 y Android 12 o posterior entienden este tipo de dirección sin configurar nada (con Manna aún falta comprobarlo en celulares reales). En otros dispositivos, usa el código QR o la dirección numérica que aparece en **Dispositivos**.
- Si el navegador abre una búsqueda en vez de la página, escribe `manna.local/` con la barra final.
- Si no abre en ningún dispositivo: en Windows, permite Node.js en el Firewall para redes privadas; en Mac, revisa Ajustes del Sistema → Privacidad y seguridad → Red local.
- Si otro programa ya usa el puerto 80, Manna usa el 8000 y la dirección pasa a ser `manna.local:8000`. La dirección exacta siempre está en **Dispositivos**.
- Con dos Manna en la misma red, el segundo se llama `manna-2.local`.

## Atajos de teclado

| Tecla | Acción |
| --- | --- |
| → ← | Siguiente / anterior de lo que está al aire, desde cualquier módulo |
| B | Pantalla en negro |
| C | Solo el fondo, sin texto |
| ↓ ↑ | Mover la selección (versículo en Biblia, elemento en el orden) |
| Enter | Proyectar lo seleccionado |
| / | Ir al buscador de la Biblia |
| Mayús + clic | Seleccionar varios versículos seguidos |

"Siguiente" depende de lo que haya al aire: si viene del orden del culto, recorre sus pasos y luego pasa al elemento que sigue; si se proyectó suelto desde la Biblia, continúa con el versículo siguiente.

## Estructura del proyecto

```
Instalar Manna en ….    instaladores del icono (Windows y Mac)
instalacion/            página de requisitos, lanzador de Windows e iconos
server/
  index.js, app.js      arranque y lista de módulos
  roles.js              funciones que puede elegir un dispositivo y sus permisos
  preflight.js          comprobación de requisitos
  core/                 servidor HTTP, estado compartido, tiempo real, sesiones, almacenamiento
  modules/
    system/             sesiones, PIN, direcciones de red
    bible/              lectura de .xmm/.xml, libros, citas, búsqueda
    projection/         contenido en vivo, estilos, segunda pantalla
    order/              orden del culto: elementos, secciones y pasos
web/
  core/                 estructura de la app, conexión con el servidor, iconos y estilos base
  modules/              la pantalla de cada módulo (registry.js es la lista)
  roles/                una página por función: control, orden, proyeccion
  vendor/               tipografía Geist, iconos Phosphor y generador de QR, con sus licencias
DESIGN.md               sistema de diseño de la interfaz
Biblias/                tus biblias (no se suben a GitHub, salvo la RV1909)
data/                   ajustes, PIN, orden del culto y fondos de este equipo (no se sube)
test/                   pruebas (npm test)
scripts/                pruebas en un Chrome real, auditoría de pantallas, logo e iconos
docs/ESTADO.md          estado actual: qué funciona, qué falta probar, qué sigue
CHANGELOG.md            historial de cambios por versión
CLAUDE.md, AGENTS.md    instrucciones para asistentes de programación
.claude/                reglas, procedimientos (skills) y automatizaciones de desarrollo
```

### Cómo funciona

- El servidor guarda **todo el estado** (qué se proyecta, estilos, orden del culto). Los dispositivos son vistas.
- Los cambios llegan a todos por un canal en tiempo real (`GET /api/events`).
- El equipo principal se anuncia en la red como `manna.local` (mDNS), sin instalar nada.
- Las órdenes se envían como **acciones** (`POST /api/action`), cada una con un permiso que se comprueba según la función del dispositivo.

### Añadir un módulo

El procedimiento completo está en `.claude/skills/nuevo-modulo/SKILL.md`. En resumen:

1. **Servidor**: `server/modules/<id>/index.js` exporta `setup(app)` y se registra en `server/app.js`. Usa `app.store.register()` para su estado, `app.action()` para sus órdenes y `app.storage()` para guardar datos.
2. **Tipo de contenido**: si aporta algo proyectable, lo registra con `app.kind()`. Con eso sus elementos ya se pueden añadir al orden del culto y recorrer con "Siguiente".
3. **Interfaz**: `web/modules/<id>/workspace.js` y una línea en `web/modules/registry.js`. Aparece en la barra de módulos.
4. **Aspecto**: siguiendo `DESIGN.md`.

No tiene dependencias externas: no hace falta `npm install`.

### Para continuar el desarrollo

Para trabajar en el código no hace falta instalar el icono: `node server/index.js` arranca Manna en la terminal, con los mensajes a la vista, y `npm test` corre las pruebas. `node scripts/demo.mjs` lo arranca con un orden del culto de ejemplo y sin tocar tus datos; con él, `http://localhost:8123/vista-previa` muestra la app en el marco de un celular o una tableta.

Empieza por `CLAUDE.md` y `docs/ESTADO.md`. Las reglas del proyecto están en `.claude/rules/` y los procedimientos (crear un módulo, probar, publicar) en `.claude/skills/`. Son texto plano: sirven igual para una persona que para cualquier asistente de programación. Toda la documentación se actualiza con cada cambio.

## Biblias y derechos de autor

Se incluye la Reina-Valera 1909, de dominio público ([eBible.org](https://ebible.org/spaRV1909/)). Las demás versiones tienen derechos de autor y no forman parte de este repositorio: cada iglesia copia en `Biblias/` las que tenga derecho a usar.

## Créditos

- Logo: diseño del autor del proyecto, reconstruido en vector (`instalacion/icono/manna.svg`).
- Tipografía [Geist](https://github.com/vercel/geist-font) (SIL Open Font License).
- Iconos [Phosphor](https://phosphoricons.com) (licencia MIT).
- Códigos QR: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) de Kazuhiko Arase (licencia MIT).
- Referencias de diseño: [taste-skill](https://github.com/Leonxlnx/taste-skill) y [awesome-design-md](https://github.com/voltagent/awesome-design-md).
