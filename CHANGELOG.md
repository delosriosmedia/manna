# Historial de cambios

Lo más reciente arriba. Cada versión publicada lleva su fecha.

## Sin publicar

## 1.1.0 — 2026-10-04

Primera etapa de la versión 2: los cimientos para los módulos que vienen (himnario, medios, diapositivas).

- **Revisión del equipo.** Cada vez que se abre, Manna comprueba que el equipo principal tiene los programas que necesita: Chrome o Edge, ffmpeg, yt-dlp y PowerPoint. Si falta alguno, en vez del control aparece una página que dice para qué sirve cada uno y cómo instalarlo.
- **"Instalar por mí"**: Manna descarga ffmpeg y yt-dlp de sus sitios oficiales y los guarda en su propia carpeta, sin tocar el sistema, mostrando el avance. (ffmpeg en Mac se instala a mano; la página da la orden.)
- La misma revisión está en **Ajustes → Programas del equipo principal**.
- **Nombre propio para cualquier elemento del orden del culto**: "Lectura bíblica" en vez de "Salmos 23:1-3". El original sigue a la vista debajo, y se recupera dejando el nombre vacío. Antes solo se podían renombrar las secciones.
- **Imagen de prueba** (Ajustes → Proyector de este equipo → Mostrar imagen de prueba): un encuadre con bordes y esquinas, barras de color o blanco, para ajustar el proyector o un televisor. Su cronómetro debe marcar lo mismo en todas las pantallas.
- **Mandos de lo que está al aire.** El panel "Al aire" y el detalle del elemento en el orden muestran los mandos propios de lo que se proyecta. Hoy los usa la imagen de prueba; los usarán las imágenes (zoom), los himnos y los videos (pausa, avance, volumen).
- **Tareas con avance.** Lo que el equipo principal tarda en preparar (hoy una instalación; después, convertir un video o descargarlo) se ve en el panel "Al aire" con su porcentaje y el tiempo que falta, sin detener la app.
- Al abrir el orden del culto, la lista se coloca en lo que está al aire.
- La app carga más rápido al volver a entrar: el navegador ya no vuelve a descargar lo que no cambió.
- Por dentro: el servidor ya entrega archivos por trozos (lo que necesita un video para saltar a un punto) y recibe subidas grandes directamente a disco.

## 1.0.0 — 2026-10-04

Primera versión estable.

- **Logo de Manna** en toda la app: en la barra de módulos, la pantalla de inicio, "Acerca de" en Ajustes, la pestaña del navegador, el icono del Escritorio (Windows y Mac) y al añadir Manna a la pantalla de inicio del celular.
- **La versión se ve junto al logo.**
- En el orden del culto, **un segundo clic sobre un elemento lo recoge**. Recogido se queda así hasta que elijas otro; antes solo se cerraba al seleccionar un elemento distinto.
- **Interfaz rediseñada por completo.** Tres zonas fijas: los módulos a la izquierda, el módulo activo al centro y el panel "Al aire" a la derecha, con el monitor de lo proyectado y los mandos siempre a la vista. Aspecto nuevo, con tipografía e iconos propios.
- **Módulo Biblia** con todo el espacio para elegir el pasaje: buscador, pasajes recientes, los 66 libros en una rejilla, capítulos y versículos. La vista previa de lo seleccionado aparece en el panel.
- **Orden del culto** (antes "Guion de culto") con su propia pantalla: secciones, reordenar arrastrando, añadir una cita escribiéndola, y los pasos de cada elemento en miniaturas. Los títulos largos se leen enteros.
- **"Siguiente" recorre el orden**: avanza por los versículos de un pasaje y luego pasa al elemento que sigue.
- **Versión para celular y tableta**: un módulo a la vez con pestañas abajo, "Al aire" como barra que se despliega, y la Biblia por pasos (libro, capítulo, versículos).
- La función "Control del guion" pasa a llamarse **"Control del orden"**. El guion que ya tenías se conserva.
- Los estilos de la proyección, el proyector y **Apagar Manna** están ahora en **Ajustes**.
- Himnario, Imágenes, Videos y Diapositivas ya aparecen en la barra, atenuados: son los próximos módulos.
- Corregido: tras cambiar varias veces de pantalla o de función en la misma pestaña, la app podía dejar de cargar.

## 0.3.0 — 2026-10-03

- **Manna se abre con un icono.** Un instalador de un solo paso (`Instalar Manna en Windows.bat` / `Instalar Manna en Mac.command`) crea el icono "Manna" en el Escritorio. Al pulsarlo, Manna arranca sin ventana negra y abre el control en el navegador. Sustituye a los archivos "Iniciar Manna".
- Pulsar el icono con Manna ya abierto solo vuelve a mostrar el control; no abre otra copia. Cerrar la pestaña del control ya no apaga nada.
- **Botón "Apagar"** en el control, solo en el equipo principal.
- Si Manna no puede abrir, aparece una página con el motivo; el detalle queda en `data/manna.log`.
- Icono propio también en la pestaña del navegador.
- **Dirección corta `manna.local`**: los dispositivos pueden entrar escribiendo `manna.local` en el navegador, sin números. Manna usa el puerto 80 para no tener que escribir `:8000`; si ese puerto está ocupado, sigue usando el 8000.
- **El cambio de IP ya no corta a los dispositivos**: quien entra por `manna.local` reconecta solo (en un minuto aproximadamente) si el router le da otra dirección al equipo principal, sin recargar ni volver a escribir el PIN.
- El código QR sigue llevando la dirección numérica, que funciona en cualquier dispositivo; al abrirla, la página pasa sola a `manna.local` si el dispositivo lo admite.
- Si hay dos Manna en la misma red, el segundo toma el nombre `manna-2.local` para no pisarse.
- **Reconexión más robusta**: los dispositivos detectan en unos 30 segundos una conexión que quedó "congelada" (wifi caída, router reiniciado) y reconectan solos. Al volver reciben todo el estado, sin recargar la página.
- Si la conexión no vuelve, el control explica qué revisar y ofrece un botón "Reintentar". La pantalla de proyección mantiene lo último que mostró, sin mensajes a la vista del público.
- Si Manna se cierra y se vuelve a abrir en menos de 15 minutos, recupera lo que estaba en pantalla.
- Pulsar un botón sin conexión avisa de inmediato en español, en lugar de quedarse esperando.
- **Confirmación al cerrar**: el navegador pide confirmar antes de cerrar o recargar la pestaña del control o del guion.
- **Un solo código QR** en "Dispositivos": el de la dirección recomendada. Si el equipo está en más de una red, las otras direcciones quedan como alternativa plegada.
- **Doble clic**: la lista de versículos ya no se mueve al hacer clic, así que el doble clic proyecta el versículo correcto. Con las flechas la lista solo se desplaza si el versículo no está a la vista.
- Dios Habla Hoy (`.xmm`): ya no aparecen 332 versículos con el texto "(TEXT OMITTED)".
- Estructura de trabajo para desarrollo asistido: `CLAUDE.md`, `AGENTS.md`, `.claude/` (reglas, skills, hook de pruebas, permisos), `docs/ESTADO.md` y este historial.
- La carpeta local del proyecto pasa a llamarse `Manna`.

## 0.2.0 — 2026-10-03

Reescritura como aplicación de red local.

- Servidor Node sin dependencias: estado central, tiempo real (SSE) y acciones con permisos.
- Estructura por módulos (`system`, `bible`, `projection`, `playlist`) en servidor y web.
- Biblias desde la carpeta `Biblias/` en formatos `.xmm` y `.xml`, con limpieza de notas y títulos.
- Citas por posición: cambiar de versión mantiene el pasaje. Rangos de versículos.
- Búsqueda por cita con abreviaturas o por palabras sin tildes.
- Roles: control completo, control del guion y pantalla de proyección. PIN para los de control.
- Ventana de proyección automática en la segunda pantalla, con encendido y apagado.
- Texto con ajuste automático. Imagen de fondo guardada como archivo.
- Lanzadores para Mac y Windows con comprobación de requisitos.
- Reina-Valera 1909 (dominio público) como biblia incluida.

## 0.1.0 — 2026-09-30

Versión inicial generada con Gemini: app de un solo navegador, biblias importadas a mano en IndexedDB, ventana de proyección emergente.
