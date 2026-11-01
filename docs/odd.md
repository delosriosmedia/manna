# Cómo se trabaja en Manna: ODD

Principios generales: skill `odd`. Antes de cada avance, una línea: **Ruta ODD:** tamaño · riesgo · dónde se hace · cómo se revierte · siguiente paso. Aquí va lo propio del proyecto. Los cambios grandes siguen el plan por fases de `docs/PLAN.md`, y sus excepciones las aprobó el dueño (`CLAUDE.md`).

## Riesgo alto
- **El culto en vivo:** lo que se proyecta o suena en la iglesia. Una prueba sin `MANNA_SIN_VENTANA=1` puede salir por el proyector conectado. No se publica justo antes de un culto.
- **Una versión publicada en GitHub:** las iglesias la reciben como aviso de versión nueva, así que no se recoge solo con borrarla.
- **Manna Iglesia en la nube:** lo que se despliega y lo que se sube a R2, con sus límites de uso de biblias e himnario (`.claude/rules/nube.md`).
- **El `Contenido` y los datos de cada iglesia:** las pruebas usan carpetas temporales, nunca `Contenido/` ni `data/`.

## Dónde se ensaya
| Qué se toca | Cómo se ensaya |
|---|---|
| Lógica | `npm test`, sin red |
| Pantallas y flujos | Servidor de prueba de `CLAUDE.md`; `node scripts/probar-chrome.mjs` y `node scripts/auditar-responsive.mjs`, con las reglas de cuántas correr en `.claude/rules/pruebas.md` |
| La nube | `node scripts/desplegar.mjs probar` |
| Una propuesta visual | Una copia en `.claude/worktrees/`, en su rama `prueba/…` |

## Cómo se vuelve atrás
- **Antes de publicar:** `git revert` del commit.
- **Después de publicar:** `git revert` y una versión nueva con `/publicar`. Quien ya actualizó recibe el arreglo como otra versión.
- **Lo que un cambio hizo en el `Contenido` o los datos de una iglesia** no lo deshace git: decirlo antes de hacerlo.

## Dónde queda cada cosa
Lo vigente, en `docs/ESTADO.md`; lo pendiente, en `docs/PLAN.md`, sección 11, que es la única lista (decisión 60). Al empezar no se leen enteros: pesan 150 y 330 KB.
