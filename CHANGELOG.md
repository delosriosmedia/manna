# Historial de cambios

Lo más reciente arriba. Cada versión publicada lleva su fecha.

## Sin publicar

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
