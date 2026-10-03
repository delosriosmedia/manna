# Estado del proyecto

Última actualización: 2026-10-03 · Versión: 0.2.0

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
- Lanzadores para Mac y Windows con comprobación de requisitos (`instalar.html`).

## Probado y sin probar

| Área | Estado |
| --- | --- |
| Control, proyección, guion (escritorio y tamaño celular) | Probado en navegador en Mac |
| PIN, permisos por rol, bloqueo por intentos | Probado por API desde la IP de red |
| Lectura y limpieza de las 14 biblias locales | Probado |
| Ventana de kiosco de Chrome: abrir, conectar, cerrar | Probado sobre la pantalla principal |
| Apertura automática en una **segunda pantalla real** | **Sin probar** (el equipo de desarrollo no tiene proyector) |
| **Windows**: `Iniciar Manna.bat` y detección de pantallas | **Sin probar** |
| Conexión desde un celular real | **Sin probar** |

## Problemas conocidos

- Biblia de Jerusalén: la limpieza de títulos es por reglas y deja restos, como las letras hebreas del Salmo 119 ("Alef.").
- Traducción en Lenguaje Actual (`SpanishTLABible.xml`): unos 26.500 versículos frente a unos 31.100 de las demás. No se revisó si une versículos o está incompleta.
- Versiones repetidas en dos formatos (Dios Habla Hoy, Palabra de Dios para Todos) aparecen con "(2)".
- Un navegador tiene una sola sesión: abrir control y guion en dos pestañas del mismo navegador hace que la más antigua vuelva a la pantalla de inicio al dar una orden.

## Decisiones pendientes del dueño

- Licencia del repositorio (hoy no tiene ninguna).
- Sistema operativo del equipo principal definitivo (define la primera prueba real).

## Próximos pasos

- Gran actualización con nuevos módulos y funcionalidades: **por definir con el dueño**.
- Probar en el equipo principal real con proyector.

## Entorno de desarrollo

- Carpeta local del proyecto: `Manna/`.
- Node instalado con Homebrew en el Mac de desarrollo. El equipo principal de la iglesia es otro.
- `data/` y las biblias con derechos de autor existen solo en local.
