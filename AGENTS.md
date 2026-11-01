# Instrucciones para asistentes de programación

Este proyecto guarda sus instrucciones en archivos pensados para Claude Code, pero son texto plano y sirven para cualquier asistente o persona:

1. `CLAUDE.md` — resumen del proyecto, comandos, límites y forma de trabajar. **Léelo primero.**
2. `docs/ESTADO.md` — estado actual: qué funciona, qué falta probar, pendientes y próximos pasos. Pesa 150 KB: empieza por «Próximos pasos» y abre lo demás cuando haga falta.
3. `DESIGN.md` — sistema de diseño de la interfaz: colores, tipografía, estructura, comportamiento en celular y tableta.
4. `.claude/rules/*.md` — reglas por tema. Algunas indican en su encabezado (`paths:`) a qué carpetas aplican.
5. `.claude/skills/*/SKILL.md` — procedimientos paso a paso (crear un módulo, probar, publicar).
6. `CHANGELOG.md` — historial de cambios por versión.
7. `README.md` — documentación para quien usa la app.
8. `docs/odd.md` — riesgos, dónde se ensaya y cómo se vuelve atrás.

Al terminar cualquier cambio, actualiza estos documentos según `.claude/rules/documentacion.md`.
