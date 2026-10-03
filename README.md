# Manna - Church projection app

Aplicación web para proyectar la Biblia en la iglesia. Un equipo principal (el que tiene el proyector) hace de servidor, y cualquier celular, tableta o PC de la misma red local se conecta por el navegador y elige qué función cumplir.

## Qué hace

- **Proyección automática**: al iniciar, detecta la segunda pantalla del equipo principal y abre ahí la proyección a pantalla completa. Si no hay segunda pantalla, lo avisa y no la abre. Se puede apagar y encender desde el control.
- **Funciones por dispositivo**: cada dispositivo elige al entrar.
  - **Control completo**: Biblia, búsqueda, estilos, guion y pantalla. Pide PIN.
  - **Control del guion**: solo proyecta los pasajes guardados. Pensado para el celular. Pide PIN.
  - **Pantalla de proyección**: espejo de la proyección principal. Sin PIN.
- **Biblias**: lee los archivos `.xmm` (OpenLP) y `.xml` de la carpeta `Biblias/`. Basta copiar un archivo; aparece solo.
- **Búsqueda**: por cita (`Juan 3:16-18`, `1 co 13 4`, `sal 23`) o por palabras, sin importar tildes ni mayúsculas.
- **Rangos de versículos** y **ajuste automático** del tamaño del texto para que siempre quepa.
- **Estilos**: tipografía, colores, sombra, fondos e imagen propia.
- **Guion de culto**: lista de pasajes preparados, compartida entre todos los dispositivos.
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
   - escanea el código QR del botón **Dispositivos** del control (ahí está también el PIN).
4. Para apagar Manna, usa el botón **Apagar** del control (solo aparece en el equipo principal).

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

## Atajos de teclado (control completo)

| Tecla | Acción |
| --- | --- |
| Enter | Proyectar lo seleccionado |
| ← → | Versículo anterior / siguiente (avanza la proyección si hay algo en vivo) |
| B | Pantalla en negro |
| C | Solo el fondo, sin texto |
| / | Ir al buscador |
| Mayús + clic | Seleccionar un rango de versículos |

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
    playlist/           guion de culto
web/
  core/                 conexión con el servidor y utilidades de interfaz
  modules/              piezas de interfaz de cada módulo
  roles/                una página por función: control, guion, proyeccion
Biblias/                tus biblias (no se suben a GitHub, salvo la RV1909)
data/                   ajustes, PIN, guion y fondos de este equipo (no se sube)
test/                   pruebas (npm test)
scripts/                pruebas en un Chrome real y generación de iconos
docs/ESTADO.md          estado actual: qué funciona, qué falta probar, qué sigue
CHANGELOG.md            historial de cambios por versión
CLAUDE.md, AGENTS.md    instrucciones para asistentes de programación
.claude/                reglas, procedimientos (skills) y automatizaciones de desarrollo
```

### Cómo funciona

- El servidor guarda **todo el estado** (qué se proyecta, estilos, guion). Los dispositivos son vistas.
- Los cambios llegan a todos por un canal en tiempo real (`GET /api/events`).
- El equipo principal se anuncia en la red como `manna.local` (mDNS), sin instalar nada.
- Las órdenes se envían como **acciones** (`POST /api/action`), cada una con un permiso que se comprueba según la función del dispositivo.

### Añadir un módulo

1. Crea `server/modules/<nombre>/index.js` que exporte `setup(app)` y regístralo en `server/app.js`.
2. Dentro usa `app.store.register()` para su estado, `app.action()` para sus órdenes, `app.route()` para sus rutas y `app.storage()` para guardar datos.
3. Crea su interfaz en `web/modules/<nombre>/` y úsala en las páginas de `web/roles/`.
4. Si necesita una función nueva (o permisos nuevos para una existente), edita `server/roles.js`.

No tiene dependencias externas: no hace falta `npm install`.

### Para continuar el desarrollo

Para trabajar en el código no hace falta instalar el icono: `node server/index.js` arranca Manna en la terminal, con los mensajes a la vista, y `npm test` corre las pruebas.

Empieza por `CLAUDE.md` y `docs/ESTADO.md`. Las reglas del proyecto están en `.claude/rules/` y los procedimientos (crear un módulo, probar, publicar) en `.claude/skills/`. Son texto plano: sirven igual para una persona que para cualquier asistente de programación. Toda la documentación se actualiza con cada cambio.

## Biblias y derechos de autor

Se incluye la Reina-Valera 1909, de dominio público ([eBible.org](https://ebible.org/spaRV1909/)). Las demás versiones tienen derechos de autor y no forman parte de este repositorio: cada iglesia copia en `Biblias/` las que tenga derecho a usar.

## Créditos

Generación de códigos QR: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) de Kazuhiko Arase (licencia MIT).
