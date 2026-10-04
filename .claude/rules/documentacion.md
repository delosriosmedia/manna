# Documentación viva

**Regla del dueño del proyecto:** cada vez que haya cambios, se actualizan todos los documentos que correspondan, en el mismo commit que el cambio. El proyecto debe poder retomarse en cualquier momento, incluso por otra persona con otro asistente, solo con lo que hay en el repositorio. Nada importante puede quedar únicamente en una conversación.

## Qué actualizar según el cambio

| Si cambia… | Actualizar |
| --- | --- |
| Cualquier cosa | `CHANGELOG.md` (sección "Sin publicar") y `docs/ESTADO.md` (fecha y lo que aplique) |
| Lo que ve o hace el usuario | `README.md` |
| Un módulo nuevo, un tipo de contenido, un rol o un permiso | `README.md` (estructura), `.claude/rules/arquitectura.md`, `docs/ESTADO.md` |
| Colores, tipografía, estructura de pantalla o comportamiento en celular y tableta | `DESIGN.md` |
| El logo | El vector `instalacion/icono/manna.svg` (y `web/marca.svg`), luego `node scripts/generar-iconos.mjs`; `DESIGN.md` si cambian las reglas de uso |
| El número de versión | Solo `package.json`; la interfaz lo lee de ahí. `CHANGELOG.md` y `docs/ESTADO.md` al publicar |
| Una convención o forma de programar | La regla correspondiente en `.claude/rules/` |
| Comandos, stack o límites del proyecto | `CLAUDE.md` |
| Requisitos del equipo principal o forma de abrir Manna | `README.md`, `instalacion/requisitos.html`, `server/preflight.js`, los instaladores de la raíz e `instalacion/abrir-windows.bat` |
| Formatos o limpieza de biblias | `.claude/rules/biblias.md` y `Biblias/LEEME.txt` |
| Un procedimiento repetible | La skill en `.claude/skills/` |
| Algo queda sin probar o con un problema conocido | `docs/ESTADO.md` |
| El dueño toma una decisión o fija un límite | `CLAUDE.md` (límites) o `docs/ESTADO.md` (decisiones) |

## Cómo escribir

- En español, breve y concreto. Hechos, no intenciones.
- `docs/ESTADO.md` es la foto actual: se reescribe, no se acumula. Lo resuelto se borra de "Problemas conocidos" y pasa al `CHANGELOG.md`.
- `CHANGELOG.md` es el historial: solo se añade. Escrito para quien usa la app, no para quien la programa.
- Las fechas, absolutas (`2026-10-03`).
- No duplicar: cada dato vive en un solo documento y los demás lo enlazan.
- No documentar lo que el código ya dice por sí mismo.

## Antes de dar un trabajo por terminado

Repasar la tabla de arriba y confirmar que cada documento afectado está al día. La skill `/publicar` lo comprueba de nuevo.
