# Estado del proyecto

Última actualización: 2026-10-04 · Versión: 1.0.0

Este documento es la foto actual del proyecto. Se actualiza con cada cambio (ver `.claude/rules/documentacion.md`). El historial está en `CHANGELOG.md`.

## Qué funciona

- Servidor en red local con estado central y tiempo real.
- **Interfaz en tres zonas** (ver `DESIGN.md`): barra de módulos, espacio de trabajo y panel "Al aire" con monitor y mandos. Adaptada a celular (vertical y horizontal), tableta y escritorio.
- Módulos: `system`, `bible`, `projection`, `order`. En la interfaz: Orden, Biblia y Ajustes; Himnario, Imágenes, Videos y Diapositivas aparecen atenuados como previstos.
- Roles por dispositivo: control completo, control del orden (solo operar), pantalla de proyección. PIN para los de control (el equipo principal no lo necesita).
- **Logo e identidad**: el logo del dueño, en vector, integrado en la interfaz, los iconos del sistema y la pestaña del navegador. La versión se muestra junto al logo y sale de `package.json`.
- **Biblia**: buscador por cita o por palabras, pasajes recientes, rejilla de libros, capítulos, versículos con selección de varios, vista previa en el panel.
- **Orden del culto** (antes "guion"): elementos con tipo y pasos, secciones, reordenar arrastrando o por menú, cita rápida, miniaturas de los pasos que se despliegan y se recogen con un clic, "todo junto" para pasajes cortos. El guion de versiones anteriores se convierte solo.
- **Tipos de contenido** (`app.kind`): hoy `verses`. "Siguiente" recorre los pasos de un elemento y luego el orden.
- Biblias desde `Biblias/` en formatos `.xmm` y `.xml`, con recarga automática al copiar archivos.
- Proyección con ajuste automático del tamaño, estilos e imagen de fondo propia (en Ajustes).
- Reconexión automática de los dispositivos, con detección de conexiones congeladas y aviso con instrucciones si no vuelve.
- Recuperación de lo que estaba en pantalla si el servidor se reinicia en menos de 15 minutos.
- Confirmación del navegador al cerrar la pestaña de control.
- Dirección con nombre `manna.local` (mDNS propio, sin dependencias) y puerto 80, con el 8000 de reserva. Si hay otro Manna en la red, toma `manna-2.local`.
- Paso automático de la dirección numérica al nombre en los dispositivos que lo admiten, y reconexión sola tras un cambio de IP del equipo principal.
- Ventana "Dispositivos" con un solo código QR, la dirección `manna.local` y direcciones alternativas plegadas.
- Instaladores del icono "Manna" para Windows y Mac, con comprobación de requisitos (`instalacion/requisitos.html`).
- Arranque en segundo plano desde el icono, una sola copia, registro en `data/manna.log` y página de error si no puede abrir.
- Apagado desde Ajustes, solo en el equipo principal.

## Probado y sin probar

| Área | Estado |
| --- | --- |
| Interfaz: Biblia, orden del culto (incluido desplegar y recoger), ajustes, dispositivos, versión junto al logo y permisos del rol "Control del orden" | Probado en Chrome real con `scripts/probar-chrome.mjs` (28 comprobaciones) |
| Logo: fidelidad del vector frente al arte original | Probado: las formas coinciden en un 98 %. El vector no reproduce las estelas tenues bajo las barras |
| Iconos generados (`.ico`, `.icns`, PNG) | Revisados a la vista en 32, 180 y 400 px. **Sin ver** en el Escritorio de Windows ni en la pantalla de inicio de un celular |
| Adaptación a pantallas: 9 tamaños (celular 360/390/430 vertical, celular horizontal, tableta vertical y horizontal, tableta grande, portátil, escritorio) | Probado con `scripts/auditar-responsive.mjs`: sin desborde, navegación y "Al aire" a la vista, acción principal sin desplazarse, botones de 40 px o más en táctil, títulos largos legibles. **Con emulación de Chrome, no en dispositivos reales** |
| Conversión del guion antiguo al orden del culto | Probado con un guion de ejemplo |
| PIN, permisos por rol, bloqueo por intentos | Probado por API desde la IP de red |
| Lectura y limpieza de las 14 biblias locales | Probado |
| Ventana de kiosco de Chrome: abrir, conectar, cerrar | Probado sobre la pantalla principal |
| Desconexión: servidor caído y reiniciado | Probado: reconecta solo, recupera lo proyectado, la sesión remota sigue válida |
| Desconexión: conexión congelada 33 s | Probado: aviso en unos 30 s, reconecta al reanudar |
| Desconexión: la dirección deja de responder | Probado: aviso con instrucciones, la página no se rompe, reconecta si la dirección vuelve |
| Doble clic sobre un versículo no centrado | Probado: proyecta ese versículo y la lista no se mueve |
| Confirmación al cerrar la pestaña | Probado en Chrome real (`scripts/probar-chrome.mjs`): aparece tras un clic en la página; "cambiar de función" no la pide |
| `manna.local` y puerto 80 en el Mac de desarrollo | Probado: el nombre resuelve, sin puerto; con el 80 ocupado pasa al 8000; al apagar, el nombre desaparece |
| Dos Manna en la misma red | Probado en el mismo equipo: el segundo toma `manna-prueba-2.local` |
| Paso automático de la IP al nombre | Probado en Chrome real (pantalla de inicio y proyección) |
| Cambio de IP con un dispositivo conectado por el nombre | Probado en Chrome real, simulado (el servidor deja una dirección y aparece en otra): reconecta solo a los 59 s, sin recargar, recupera lo proyectado y no vuelve a pedir PIN |
| `manna.local` desde **celulares reales** (iPhone, Android 12+, Android antiguo) | **Sin probar** |
| `manna.local` y puerto 80 con **Windows como servidor** | **Sin probar** |
| Cambio de IP con un **router real** | **Sin probar** (solo simulado) |
| Elección de la dirección recomendada con varias redes | Probado con pruebas automáticas y con direcciones simuladas; **sin probar en un equipo con dos redes reales** |
| Apertura automática en una **segunda pantalla real** | **Sin probar** (el equipo de desarrollo no tiene proyector) |
| Icono en **Mac**: instalador, app en segundo plano, segunda pulsación, registro | Probado en una copia temporal (carpeta con espacios), creando la app fuera de Aplicaciones. **Sin probar** con el proyecto dentro de Documentos, donde macOS pedirá permiso de acceso |
| Apagar Manna (Ajustes) | Probado en Chrome real: confirma, apaga el servidor y muestra la pantalla final; un dispositivo remoto con control completo no puede apagar |
| Fallo de arranque en segundo plano | Probado: escribe `data/error.html` y el registro |
| Icono en **Windows**: `Instalar Manna en Windows.bat` e `instalacion/abrir-windows.bat` | **Sin probar.** Es la primera prueba pendiente en el equipo de la iglesia |
| **Windows**: detección de pantallas y ventana de proyección | **Sin probar** |
| Conexión desde un celular real | Probada por el dueño (vuelve sola al regresar del segundo plano) |

## Problemas conocidos

- **El logo es cian y el acento de la interfaz es ámbar.** Se mantuvo el ámbar porque es lo que se aprobó en la maqueta; el cian aparece solo en el logo. Unificarlos es cambiar tres valores en `web/core/app.css` (pendiente de que el dueño lo decida).
- El nombre "MANNA" del logotipo se compone con la tipografía de la app (Geist, peso 700), no con la del arte original, que no se recibió como archivo.
- Las estelas tenues que el arte original tiene bajo las barras no están en el vector.
- Los tipos de elemento futuros (himno, imagen, video, diapositivas) tienen icono, color y sitio en la interfaz, pero no existen: no se pueden añadir ni proyectar.
- En el orden del culto cada versículo es un paso. Un pasaje se puede mostrar entero ("Todo junto") solo si tiene entre 2 y 6 versículos, y hay que elegirlo en sus miniaturas: no se recuerda por elemento.
- Reordenar arrastrando funciona con ratón. En pantallas táctiles se reordena con los botones Subir / Bajar.
- La vista previa `/vista-previa` muestra la app en marcos de celular y tableta, pero el navegador de escritorio no reproduce el teclado en pantalla ni las barras del navegador del celular.
- **Cambio de IP del equipo principal**: los dispositivos que no entienden nombres `.local` (Android anterior a la versión 12) no encuentran solos la dirección nueva; deben volver a escanear el QR y escribir el PIN. Los demás reconectan solos en un minuto aproximadamente; no puede ser más rápido porque el navegador recuerda la dirección anterior durante ese tiempo.
- **El nombre dejó de responder una vez** durante las pruebas, a los pocos minutos de arrancar, sin que el servidor lo notara. No se pudo reproducir ni hallar la causa. Desde entonces el servidor comprueba el nombre cada 10 s y lo rehace si falla (probado dejándolo mudo a propósito). Si reaparece en uso real, los dispositivos siguen pudiendo entrar por la dirección numérica.
- No se ha comprobado si al escribir `manna.local` sin `http://` algún navegador abre una búsqueda en vez de la página. El remedio es escribir `manna.local/`.
- En macOS puede aparecer una vez el permiso "buscar dispositivos en la red local". Si se deniega, el nombre no funciona; la dirección numérica sí.
- En Mac, la app Manna no se añade sola al Dock: hay que arrastrarla desde Aplicaciones.
- Manna abierto desde el icono no tiene ventana: si el botón "Apagar" no está a mano, solo se cierra apagando el equipo o terminando el proceso `node`.
- El equipo principal puede entrar en reposo durante una reunión: Manna no lo impide. Conviene desactivar el reposo en los ajustes de energía.
- La confirmación al cerrar solo aparece si se hizo algún clic en la página (regla de Chrome), y su texto no se puede cambiar.
- Un celular o tableta usado como pantalla de proyección puede apagar su pantalla por inactividad: la función del navegador que lo impide exige HTTPS o `localhost`. No afecta a la ventana del equipo principal.
- Biblia de Jerusalén: la limpieza de títulos es por reglas y deja restos, como las letras hebreas del Salmo 119 ("Alef.").
- Traducción en Lenguaje Actual (`SpanishTLABible.xml`): unos 26.500 versículos frente a unos 31.100 de las demás. No se revisó si une versículos o está incompleta.
- Versiones repetidas en dos formatos (Dios Habla Hoy, Palabra de Dios para Todos) aparecen con "(2)".
- Un navegador tiene una sola sesión: abrir "control completo" y "control del orden" en dos pestañas del mismo navegador hace que la más antigua vuelva a la pantalla de inicio al dar una orden.

## Decisiones tomadas

- **2026-10-03 · Equipo principal: Windows.** El desarrollo sigue en Mac; lo que afecte al arranque o al sistema debe funcionar en Windows.
- **2026-10-03 · Sin compilaciones por ahora.** Node.js y Chrome se aceptan como requisitos del equipo principal. Manna se abre con un icono creado por un instalador sencillo.
- **2026-10-03 · Dirección `manna.local` y puerto 80.** El QR sigue llevando la dirección numérica.
- **2026-10-04 · Rediseño de la interfaz aprobado** sobre una maqueta: tres zonas, módulo Biblia y módulo Orden del culto separados, y sitio previsto para himnario, imágenes, videos y presentaciones. El sistema quedó escrito en `DESIGN.md`.
- **2026-10-04 · "Guion de culto" pasa a llamarse "Orden del culto"** y es donde confluyen todos los módulos, con los elementos diferenciados por tipo.
- **2026-10-04 · "Al aire" en rojo.** El ámbar queda para la selección y la acción principal.
- **2026-10-04 · Tipografía Geist e iconos Phosphor incluidos en el repositorio** (licencias libres, sin internet en uso).
- **2026-10-04 · Los celulares se usan en vertical; las tabletas, también en horizontal.**
- **2026-10-04 · Versión 1.0.0**, con el logo del dueño integrado y la versión visible junto a él.
- **2026-10-04 · Módulos futuros visibles pero atenuados.** El dueño no eligió entre mostrarlos u ocultarlos; se dejaron como en la maqueta aprobada. Para ocultarlos basta quitar las entradas `soon` de `web/modules/registry.js`.

## Decisiones pendientes del dueño

### 1. Instaladores compilados (aplazada)

Propuesta: empaquetar el servidor como aplicación de escritorio con **Electron**. Los dispositivos remotos seguirían entrando por navegador. Aplazada el 2026-10-03: se revisará más adelante si es momento de crear compilaciones.

- Incluye su propio navegador y Node: desaparecen los requisitos de Chrome y Node.js.
- Abre la proyección en la segunda pantalla con funciones nativas, sin Chrome ni `osascript`/PowerShell, y puede impedir que el equipo se duerma.
- Entregables: instalador `.exe` para Windows (puede crear las reglas del Firewall porque se ejecuta como administrador) y `.dmg` para Mac.
- El desarrollo diario no cambia: `node server/index.js` y `npm test`. Electron solo interviene al empaquetar.
- Costes: instaladores de unos 100 MB; añade dependencias de empaquetado (requiere levantar el límite "sin dependencias" para esa parte); el instalador de Windows se compilaría en GitHub Actions; sin certificados de pago, Windows y macOS muestran una advertencia la primera vez.
- Las biblias pasarían a una carpeta visible del usuario (por ejemplo `Documentos/Manna/Biblias`) con un botón para abrirla.

### 2. Otras

- Acento de la interfaz: mantener el ámbar o pasarlo al cian del logo.
- Licencia del repositorio (hoy no tiene ninguna).

## Próximos pasos

- Que el dueño revise la versión para celular y tableta (se hizo sin maqueta previa) y diga qué ajustar.
- Primeros módulos nuevos sobre la estructura: himnario, imágenes, videos, presentaciones (por definir el orden).
- **Probar en el equipo Windows de la iglesia**, en este orden: `Instalar Manna en Windows.bat`, abrir con el icono, aviso del Firewall, proyección en la segunda pantalla, botón "Apagar", y `manna.local` desde un celular.
- Probar `manna.local` desde celulares reales (iPhone, Android 12 o posterior, Android antiguo) y con un router real.
- Gran actualización con nuevos módulos y funcionalidades: **por definir con el dueño**.
- Probar en el equipo principal real con proyector.

## Entorno de desarrollo

- Carpeta local del proyecto: `Manna/`.
- Node instalado con Homebrew en el Mac de desarrollo. El equipo principal de la iglesia es otro, con Windows.
- `data/` y las biblias con derechos de autor existen solo en local.
