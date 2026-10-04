<p align="center"><img src="docs/logo.png" width="112" alt="Logo de Manna"></p>

# Manna - Church projection app

Aplicación web para proyectar en la iglesia. Un equipo principal (el que tiene el proyector) hace de servidor, y cualquier celular, tableta o PC de la misma red local se conecta por el navegador y elige qué función cumplir.

## Qué hace

- **Tres zonas, siempre iguales**: los módulos a la izquierda, el módulo activo al centro y el panel **Al aire** a la derecha, con el monitor de lo proyectado y los mandos (anterior, siguiente, negro, solo fondo).
- **Biblia**: los 66 libros a la vista en una rejilla; capítulos y versículos; pasajes recientes. Lee los archivos `.xmm` (OpenLP) y `.xml` de la carpeta `Contenido/Biblias/`; basta copiar un archivo y aparece solo.
- **Búsqueda**: por cita (`Juan 3:16-18`, `1 co 13 4`, `sal 23`) o por texto, mientras escribes. El texto se busca en la Reina-Valera 1960 (o en la versión elegida, si no está instalada) y el resultado se abre en la versión que tengas elegida. Los resultados salen por niveles (frase exacta, todas las palabras, parecidas), con lo encontrado resaltado.
- **Comparador**: el mismo pasaje en dos versiones, lado a lado o una sobre otra, cada una con su sigla. Se elige igual que en Biblia, se proyecta, se añade al orden como elemento propio, y la disposición se puede cambiar mientras está al aire.
- **Orden del culto**: la lista ordenada de todo lo que se va a proyectar, con secciones (Apertura, Mensaje…). Cada elemento muestra su tipo y sus pasos; "Siguiente" recorre los pasos y luego pasa al elemento que sigue. A cualquier elemento se le puede poner un nombre propio ("Lectura bíblica"). Se comparte entre todos los dispositivos.
- **Mandos en vivo**: lo que está al aire trae sus propios mandos en el panel y en el orden del culto. Hoy los estrena la **imagen de prueba** (Ajustes → Proyector de este equipo), que sirve para encuadrar el proyector o un televisor y comprobar, con su cronómetro, que todas las pantallas van a la par.
- **Revisión del equipo**: al abrirse, Manna comprueba que el equipo principal tiene los programas que necesita. Si falta alguno, dice qué módulos se ven afectados y lo instala con un botón. Nunca impide abrir la app.
- **Preparado para crecer**: himnario, medios (imágenes, videos, audios y YouTube) y presentaciones ya tienen su sitio en la interfaz. Cada módulo nuevo aporta su pantalla y un tipo de elemento para el orden del culto.
- **Funciones por dispositivo**: cada dispositivo elige al entrar.
  - **Control completo**: todos los módulos. Pide PIN.
  - **Control del orden**: solo proyecta lo que ya está en el orden del culto. Pensado para el celular. Pide PIN.
  - **Pantalla de proyección**: espejo de la proyección principal. Sin PIN.
- **Celular, tableta y escritorio**: en pantallas estrechas se ve un módulo a la vez, con pestañas abajo y "Al aire" como barra compacta que se despliega.
- **Proyección automática**: al iniciar, detecta la segunda pantalla del equipo principal y abre ahí la proyección a pantalla completa. Si no hay segunda pantalla, lo avisa y no la abre.
- **Apariencia de la proyección**: tipografía, colores, sombra, fondos e imagen propia, con ajuste automático del tamaño del texto para que siempre quepa.
- **Reconexión automática**: si un dispositivo pierde la red o queda en segundo plano, reconecta solo y se pone al día. Si Manna se reinicia, recupera lo que estaba en pantalla.

## Requisitos (solo en el equipo principal)

| Programa | Para qué | Si falta |
| --- | --- | --- |
| Node.js 18 o superior | Hace funcionar el servidor | Manna no arranca. Se descarga de https://nodejs.org/es/download |
| Google Chrome (o Edge en Windows) | Ventana de proyección a pantalla completa | Manna se abre; la proyección no se abre sola en la segunda pantalla |
| ffmpeg | Convertir videos y audios, unir imagen y sonido de YouTube, elegir la pista de los himnos | Manna se abre; las funciones que lo usan no estarán disponibles |
| yt-dlp | Descargar videos de YouTube | Igual |
| Microsoft PowerPoint (opcional) | Convertir presentaciones `.pptx` | Se usa el PDF de la presentación |

Solo Node.js se instala antes. Lo demás lo comprueba Manna cada vez que se abre: si falta algo, en vez del control muestra la **revisión del equipo**, que dice qué módulos funcionarán completos y cuáles no, para qué sirve cada programa, y ofrece **Abrir Manna** de todos modos e **Instalar por mí** (descarga ffmpeg y yt-dlp de sus sitios oficiales a la carpeta `data/herramientas/`, sin tocar el sistema) o los pasos para hacerlo a mano. La misma revisión está en **Ajustes → Programas del equipo principal**, y cada módulo avisa al abrirlo si le falta algo. Los demás dispositivos no instalan nada.

ffmpeg, yt-dlp y PowerPoint los usarán los módulos de himnario, medios y diapositivas, que están en construcción (ver `docs/PLAN.md`).

## Instalación (una sola vez por equipo)

1. Copia la carpeta de Manna al equipo principal y pon tu contenido en la carpeta `Contenido/` (ver abajo, "La carpeta de tu iglesia").
2. Abre con doble clic el archivo que corresponda:
   - **Windows**: `Instalar Manna en Windows.bat`
   - **Mac**: `Instalar Manna en Mac.command`
3. El instalador comprueba que está Node.js y crea el icono **Manna** en el Escritorio (y en el menú Inicio o en Aplicaciones). Al terminar, abre Manna, que revisa el resto del equipo.

Avisos que pueden salir la primera vez:

- **Windows**: el Firewall pregunta por Node.js. Elige *Permitir acceso* en redes privadas; sin eso los celulares no pueden conectarse.
- **Mac**: si macOS bloquea el instalador, ve a Ajustes del Sistema → Privacidad y seguridad → *Abrir igualmente*. Si pide permiso para leer la carpeta de Manna o para la red local, elige *Permitir*.

Si mueves la carpeta de Manna a otro sitio, vuelve a ejecutar el instalador. Para desinstalar, borra el icono (en Mac, también la app Manna de Aplicaciones) y la carpeta.

## La carpeta de tu iglesia

Todo lo que pone cada iglesia va en una sola carpeta, `Contenido/`. Manna lee lo que encuentra y lo muestra solo, sin importar nada ni reiniciar. Cada subcarpeta trae un `LEEME.txt` con el formato exacto.

| Carpeta | Qué va |
| --- | --- |
| `Contenido/Biblias/` | Las versiones de la Biblia, en `.xmm` o `.xml` |
| `Contenido/Himnario/videos/` | Los himnos en video, uno por archivo: `001 Cantad alegres al Señor.mp4` |
| `Contenido/Himnario/letras/` | Las letras de los himnos, en archivos de texto `.md` |

Al actualizar Manna, conserva `Contenido/` y `data/`; lo demás se reemplaza. Nada de `Contenido/` se publica en GitHub, salvo las instrucciones y la Reina-Valera 1909. (El himnario se está construyendo: ver `docs/PLAN.md`.)

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
- **En un televisor**: su navegador suele convertir la dirección en una página segura (`https`) que Manna no ofrece, y dice "No se encontró el servidor". Escribe la dirección completa con el segundo puerto, por ejemplo `http://192.168.1.14:8000` (está en **Dispositivos → ¿Es un televisor?**). Si aun así no abre, usa el televisor como segunda pantalla del equipo principal (duplicar pantalla en Windows con Win + K, o AirPlay en Mac): Manna abre ahí la proyección sola.
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
| ↓ ↑ en el buscador | Recorrer los resultados |
| Enter en el buscador | Ir al resultado señalado (o al pasaje, si es una cita). Enter otra vez lo proyecta |
| Esc | Cerrar los resultados |
| Mayús + clic | Seleccionar varios versículos seguidos |

"Siguiente" depende de lo que haya al aire: si viene del orden del culto, recorre sus pasos y luego pasa al elemento que sigue; si se proyectó suelto desde la Biblia, continúa con el versículo siguiente.

## Estructura del proyecto

```
Instalar Manna en ….    instaladores del icono (Windows y Mac)
instalacion/            aviso de que falta Node.js, lanzador de Windows e iconos
server/
  index.js, app.js      arranque y lista de módulos
  roles.js              funciones que puede elegir un dispositivo y sus permisos
  core/                 servidor HTTP (archivos grandes, subidas), estado compartido, tiempo real,
                        sesiones, almacenamiento, reloj de reproducción, tareas con avance,
                        programas del equipo (detección e instalación), carpetas de contenido
                        y búsqueda de texto por niveles (la usan la Biblia y, después, el himnario)
  modules/
    system/             sesiones, PIN, direcciones de red
    bible/              lectura de .xmm/.xml, libros, citas, búsqueda y comparación de dos versiones
    projection/         contenido en vivo, mandos en vivo, volumen, estilos, segunda pantalla,
                        imagen de prueba
    order/              orden del culto: elementos, secciones y pasos
web/
  core/                 estructura de la app, conexión con el servidor, tipos de contenido,
                        reloj, tareas, iconos y estilos base
  modules/              la pantalla de cada módulo (registry.js es la lista) y cómo se dibuja
                        cada tipo de contenido (kinds.js es la lista)
  roles/                una página por función: control, orden, proyeccion, y la revisión del equipo
  vendor/               tipografía Geist, iconos Phosphor y generador de QR, con sus licencias
DESIGN.md               sistema de diseño de la interfaz
Contenido/              lo de tu iglesia: biblias, himnos en video y letras (no se sube a GitHub,
                        salvo las instrucciones y la RV1909)
data/                   ajustes, PIN, orden del culto, fondos, programas instalados por Manna
                        y archivos temporales de este equipo (no se sube)
test/                   pruebas (npm test)
scripts/                pruebas en un Chrome real, auditoría de pantallas, logo e iconos
docs/ESTADO.md          estado actual: qué funciona, qué falta probar, qué sigue
docs/PLAN.md            plan de trabajo en curso, por fases, y lista de la auditoría final
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
2. **Tipo de contenido**: si aporta algo proyectable, lo registra con `app.kind()`. Con eso sus elementos ya se pueden añadir al orden del culto y recorrer con "Siguiente". Si tiene mandos mientras está al aire (zoom, reproducción), los declara ahí mismo.
3. **Interfaz**: `web/modules/<id>/workspace.js` y una línea en `web/modules/registry.js`. Aparece en la barra de módulos. Cómo se dibuja su tipo de contenido y sus mandos van en `web/modules/<id>/kind.js`.
4. **Aspecto**: siguiendo `DESIGN.md`.

El código no tiene dependencias: no hace falta `npm install`. Los programas externos del equipo principal (ffmpeg, yt-dlp, PowerPoint) se usan solo a través de `server/core/tools.js`.

### Para continuar el desarrollo

Para trabajar en el código no hace falta instalar el icono: `node server/index.js` arranca Manna en la terminal, con los mensajes a la vista, y `npm test` corre las pruebas. `node scripts/demo.mjs` lo arranca con un orden del culto de ejemplo y sin tocar tus datos; con él, `http://localhost:8123/vista-previa` muestra la app en el marco de un celular o una tableta.

Empieza por `CLAUDE.md` y `docs/ESTADO.md`. Las reglas del proyecto están en `.claude/rules/` y los procedimientos (crear un módulo, probar, publicar) en `.claude/skills/`. Son texto plano: sirven igual para una persona que para cualquier asistente de programación. Toda la documentación se actualiza con cada cambio.

## Biblias y derechos de autor

Se incluye la Reina-Valera 1909, de dominio público ([eBible.org](https://ebible.org/spaRV1909/)). Las demás versiones tienen derechos de autor y no forman parte de este repositorio: cada iglesia copia en `Contenido/Biblias/` las que tenga derecho a usar. Lo mismo vale para los himnos en video y sus letras.

## Créditos

- Logo: diseño del autor del proyecto, reconstruido en vector (`instalacion/icono/manna.svg`).
- Tipografía [Geist](https://github.com/vercel/geist-font) (SIL Open Font License).
- Iconos [Phosphor](https://phosphoricons.com) (licencia MIT).
- Códigos QR: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) de Kazuhiko Arase (licencia MIT).
- Programas que Manna puede instalar en el equipo principal y usa sin incluirlos: [ffmpeg](https://ffmpeg.org) (compilación para Windows de [gyan.dev](https://www.gyan.dev/ffmpeg/builds/)) y [yt-dlp](https://github.com/yt-dlp/yt-dlp).
- Referencias de diseño: [taste-skill](https://github.com/Leonxlnx/taste-skill) y [awesome-design-md](https://github.com/voltagent/awesome-design-md).
