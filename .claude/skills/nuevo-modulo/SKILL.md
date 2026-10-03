---
name: nuevo-modulo
description: Crea un módulo nuevo de Manna con todas sus piezas (servidor, interfaz web, permisos, pruebas y documentación). Úsala cuando se pida añadir un módulo o una funcionalidad grande e independiente, como canciones, anuncios, temporizador o medios.
---

# Crear un módulo de Manna

Antes de escribir código, acuerda con el dueño: qué hace el módulo, qué roles lo usan y si proyecta algo en pantalla. Si el alcance es grande, presenta un plan y espera aprobación.

Lee `.claude/rules/arquitectura.md`. Toma `server/modules/playlist/` y `web/modules/playlist/` como ejemplo de módulo pequeño y completo.

## Pasos

1. **Identificador**: una palabra en minúsculas, en inglés como los existentes (`songs`, `media`). Se usa en carpetas, acciones y permisos.

2. **Servidor**: `server/modules/<id>/index.js`

   ```js
   import { HttpError } from '../../core/router.js';

   export default function setup(app) {
     const { store } = app;
     const saved = app.storage('<nombre-archivo>', { /* valores por defecto */ });

     store.register('<id>', { /* estado inicial */ });

     app.action('<id>.<verbo>', { permission: '<id>.<capacidad>' }, (payload) => {
       // validar payload, cambiar estado con store.set('<id>', {...}), guardar con saved.save()
     });

     // Solo lecturas o subida de archivos:
     // app.route('GET', '/api/<id>/...', (ctx) => ({ ... }));
   }
   ```

   La lógica que no depende del servidor (leer formatos, calcular, buscar) va en archivos aparte dentro de la carpeta, para poder probarla.

3. **Registro**: añade el módulo a la lista `MODULES` de `server/app.js`.

4. **Permisos**: en `server/roles.js`, añade los permisos nuevos a los roles que deban tenerlos (`control` ya tiene `'*'`). Si hace falta un rol nuevo, añádelo ahí con su `path` y crea su página.

5. **Interfaz**: `web/modules/<id>/` con funciones `createX(contenedor, opciones)` y su `.css` si lo necesita. Sigue `.claude/rules/web.md`.

6. **Páginas**: monta la interfaz en las páginas de `web/roles/` que correspondan (`control.js` casi siempre). Un rol nuevo necesita `web/<rol>.html` y `web/roles/<rol>.js`.

7. **Si proyecta contenido**: define un `kind` nuevo para `projection.item` y cómo se dibuja en `web/modules/projection/stage.js`. No cambies el dibujo de los `kind` existentes.

8. **Pruebas**: `test/<id>.test.js` para la lógica pura. Luego prueba en navegador con la skill `/probar`.

9. **Documentación**: aplica `.claude/rules/documentacion.md`. Como mínimo: `README.md` (qué hace y estructura), `.claude/rules/arquitectura.md` (si añade espacios de estado, permisos o `kind`), `docs/ESTADO.md` y `CHANGELOG.md`.

## Comprobación final

- [ ] No importa archivos de otros módulos (usa `app.services` o `app.run`).
- [ ] Toda acción tiene permiso y valida su entrada.
- [ ] Funciona en celular (375 px).
- [ ] `npm test` pasa.
- [ ] Un rol sin permiso no puede usarlo.
- [ ] Documentación al día.
