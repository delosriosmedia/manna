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

## Requisitos (solo en el equipo principal)

| Programa | Para qué | Descarga |
| --- | --- | --- |
| Node.js 18 o superior | Hace funcionar el servidor | https://nodejs.org/es/download |
| Google Chrome (o Edge en Windows) | Ventana de proyección a pantalla completa | https://www.google.com/chrome/ |

Si falta alguno, Manna no arranca y abre `instalar.html` con las instrucciones. Los demás dispositivos no instalan nada.

## Cómo iniciar

1. Copia tus biblias a la carpeta `Biblias/`.
2. Abre el lanzador:
   - **Mac**: doble clic en `Iniciar Manna.command`. La primera vez, si macOS lo bloquea: clic derecho → *Abrir*.
   - **Windows**: doble clic en `Iniciar Manna.bat`. Si el Firewall pregunta, permite el acceso en redes privadas.
3. Se abre el control en el navegador y, si hay proyector conectado, la proyección en la segunda pantalla.
4. Para conectar otro dispositivo: botón **Dispositivos** del control. Muestra la dirección, un código QR y el PIN.

Para apagar Manna, cierra la ventana del lanzador.

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
docs/ESTADO.md          estado actual: qué funciona, qué falta probar, qué sigue
CHANGELOG.md            historial de cambios por versión
CLAUDE.md, AGENTS.md    instrucciones para asistentes de programación
.claude/                reglas, procedimientos (skills) y automatizaciones de desarrollo
```

### Cómo funciona

- El servidor guarda **todo el estado** (qué se proyecta, estilos, guion). Los dispositivos son vistas.
- Los cambios llegan a todos por un canal en tiempo real (`GET /api/events`).
- Las órdenes se envían como **acciones** (`POST /api/action`), cada una con un permiso que se comprueba según la función del dispositivo.

### Añadir un módulo

1. Crea `server/modules/<nombre>/index.js` que exporte `setup(app)` y regístralo en `server/app.js`.
2. Dentro usa `app.store.register()` para su estado, `app.action()` para sus órdenes, `app.route()` para sus rutas y `app.storage()` para guardar datos.
3. Crea su interfaz en `web/modules/<nombre>/` y úsala en las páginas de `web/roles/`.
4. Si necesita una función nueva (o permisos nuevos para una existente), edita `server/roles.js`.

No tiene dependencias externas: no hace falta `npm install`.

### Para continuar el desarrollo

Empieza por `CLAUDE.md` y `docs/ESTADO.md`. Las reglas del proyecto están en `.claude/rules/` y los procedimientos (crear un módulo, probar, publicar) en `.claude/skills/`. Son texto plano: sirven igual para una persona que para cualquier asistente de programación. Toda la documentación se actualiza con cada cambio.

## Biblias y derechos de autor

Se incluye la Reina-Valera 1909, de dominio público ([eBible.org](https://ebible.org/spaRV1909/)). Las demás versiones tienen derechos de autor y no forman parte de este repositorio: cada iglesia copia en `Biblias/` las que tenga derecho a usar.

## Créditos

Generación de códigos QR: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) de Kazuhiko Arase (licencia MIT).
