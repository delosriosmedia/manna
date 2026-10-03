# Historial de cambios

Lo más reciente arriba. Cada versión publicada lleva su fecha.

## Sin publicar

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
