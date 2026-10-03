# Estado del proyecto

Última actualización: 2026-10-03 · Versión: 0.3.0

Este documento es la foto actual del proyecto. Se actualiza con cada cambio (ver `.claude/rules/documentacion.md`). El historial está en `CHANGELOG.md`.

## Qué funciona

- Servidor en red local con estado central y tiempo real.
- Roles por dispositivo: control completo, control del guion, pantalla de proyección. PIN para los de control (el equipo principal no lo necesita).
- Módulos: `system`, `bible`, `projection`, `playlist`.
- Biblias desde `Biblias/` en formatos `.xmm` y `.xml`, con recarga automática al copiar archivos.
- Búsqueda por cita (con abreviaturas y rangos) y por palabras sin tildes.
- Proyección de uno o varios versículos, con ajuste automático del tamaño.
- Estilos de proyección e imagen de fondo propia.
- Guion de culto compartido entre dispositivos.
- Reconexión automática de los dispositivos, con detección de conexiones congeladas y aviso con instrucciones si no vuelve.
- Recuperación de lo que estaba en pantalla si el servidor se reinicia en menos de 15 minutos.
- Confirmación del navegador al cerrar la pestaña de control o de guion.
- Dirección con nombre `manna.local` (mDNS propio, sin dependencias) y puerto 80, con el 8000 de reserva. Si hay otro Manna en la red, toma `manna-2.local`.
- Paso automático de la dirección numérica al nombre en los dispositivos que lo admiten, y reconexión sola tras un cambio de IP del equipo principal.
- Ventana "Dispositivos" con un solo código QR (dirección numérica recomendada), la dirección `manna.local` para escribir a mano y direcciones alternativas plegadas.
- Instaladores del icono "Manna" para Windows y Mac, con comprobación de requisitos (`instalacion/requisitos.html`).
- Arranque en segundo plano desde el icono, sin ventana: registro en `data/manna.log`, página de error si no puede abrir, y una sola copia aunque se pulse el icono varias veces.
- Botón "Apagar" en el control, solo en el equipo principal.

## Probado y sin probar

| Área | Estado |
| --- | --- |
| Control, proyección, guion (escritorio y tamaño celular) | Probado en navegador en Mac |
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
| Botón "Apagar" | Probado: apaga, libera el nombre de red y muestra la pantalla final; un dispositivo remoto con control completo no puede apagar |
| Fallo de arranque en segundo plano | Probado: escribe `data/error.html` y el registro |
| Icono en **Windows**: `Instalar Manna en Windows.bat` e `instalacion/abrir-windows.bat` | **Sin probar.** Es la primera prueba pendiente en el equipo de la iglesia |
| **Windows**: detección de pantallas y ventana de proyección | **Sin probar** |
| Conexión desde un celular real | Probada por el dueño (vuelve sola al regresar del segundo plano) |

## Problemas conocidos

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
- Un navegador tiene una sola sesión: abrir control y guion en dos pestañas del mismo navegador hace que la más antigua vuelva a la pantalla de inicio al dar una orden.

## Decisiones tomadas

- **2026-10-03 · Equipo principal: Windows.** El desarrollo sigue en Mac; lo que afecte al arranque o al sistema debe funcionar en Windows.
- **2026-10-03 · Sin compilaciones por ahora.** Node.js y Chrome se aceptan como requisitos del equipo principal. Manna se abre con un icono creado por un instalador sencillo.
- **2026-10-03 · Dirección `manna.local` y puerto 80.** El QR sigue llevando la dirección numérica.

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

- Licencia del repositorio (hoy no tiene ninguna).

## Próximos pasos

- **Probar en el equipo Windows de la iglesia**, en este orden: `Instalar Manna en Windows.bat`, abrir con el icono, aviso del Firewall, proyección en la segunda pantalla, botón "Apagar", y `manna.local` desde un celular.
- Probar `manna.local` desde celulares reales (iPhone, Android 12 o posterior, Android antiguo) y con un router real.
- Gran actualización con nuevos módulos y funcionalidades: **por definir con el dueño**.
- Probar en el equipo principal real con proyector.

## Entorno de desarrollo

- Carpeta local del proyecto: `Manna/`.
- Node instalado con Homebrew en el Mac de desarrollo. El equipo principal de la iglesia es otro, con Windows.
- `data/` y las biblias con derechos de autor existen solo en local.
