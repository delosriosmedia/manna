---
name: nuevo-modulo
description: Crea un módulo nuevo de Manna con todas sus piezas (servidor, tipo de contenido, pantalla, permisos, pruebas y documentación). Úsala cuando se pida añadir un módulo o una funcionalidad grande e independiente, como himnario, imágenes, videos o presentaciones.
---

# Crear un módulo de Manna

Antes de escribir código, acuerda con el dueño: qué hace el módulo, qué roles lo usan y qué aporta al orden del culto. Si el alcance es grande, presenta un plan y espera aprobación.

Lee `.claude/rules/arquitectura.md` y `DESIGN.md`, y la fase correspondiente de `docs/PLAN.md`. Ejemplos completos para copiar la forma: `server/modules/bible/` + `web/modules/bible/` (un módulo que aporta contenido), `server/modules/media/` + `web/modules/media/` (una biblioteca de archivos subidos, con un tipo que ocupa toda la pantalla y mandos que se arrastran), `server/modules/order/` + `web/modules/order/`, y la imagen de prueba (`server/modules/projection/testcard.js` + `web/modules/projection/testcard.js`), que es el tipo con mandos en vivo más pequeño.

## Pasos

1. **Identificador**: una palabra en minúsculas. En el servidor, en inglés como los existentes (`songs`, `media`); en la interfaz, el `id` del módulo va en español porque aparece en la dirección (`himnario`, `medios`).

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

3. **Tipo de contenido**, si el módulo aporta algo proyectable. Se registra en su `setup`:

   ```js
   app.kind('<tipo>', {
     label: 'Himno',
     // Cómo se ve en el orden del culto. null si ese contenido ya no existe.
     describe: (data) => ({ title, subtitle, steps, data }),
     // Qué se proyecta. step null = el elemento entero; 0..n-1 = uno de sus pasos.
     resolve: (data, step) => ({ /* contenido para dibujar */ }),
     // Solo si tiene mandos mientras está al aire (zoom, reproducción):
     live: (content, previous) => ({ /* estado inicial de los mandos */ }),
     control: (state, patch, { content, now }) => ({ /* estado nuevo, tras validar patch */ }),
   });
   ```

   `data` es lo mínimo para localizar el contenido (un identificador, una ruta), nunca el contenido mismo. Con esto el elemento ya se puede añadir al orden con `order.add { kind, data }` y recorrer con "Siguiente".

   Para lo que el módulo necesite del núcleo: archivos del usuario con `watchFolder`/`listFiles` y `app.mount()`; subidas con `ctx.save()`; trabajos largos con `app.jobs`; programas externos con `app.tools`; reproducción con `server/core/playback.js`. Ver `.claude/rules/servidor.md`.

4. **Registro**: añade el módulo a la lista `MODULES` de `server/app.js`.

5. **Permisos**: en `server/roles.js`, añade los permisos nuevos a los roles que deban tenerlos (`control` ya tiene `'*'`).

6. **Pantalla**: `web/modules/<id>/workspace.js`

   ```js
   function mount(el, ctx) {
     // Dibuja con h() dentro de el: una cabecera .ws-head y el contenido.
     // Se suscribe al estado con subscribe('<id>', ...).
     // ctx.setPreview(elemento) muestra en el panel lo que se proyectaría.
     return { keys(e) { /* true si atendió la tecla */ } };
   }
   export default {
     id: '<id>', name: 'Himnario', icon: 'music-notes', mount,
     // Programas del equipo principal que necesita, si alguno. feature completa "no se podrá…".
     needs: [{ tools: ['ffmpeg'], feature: 'elegir la pista instrumental de un himno' }],
   };
   ```

   Con `needs`, la revisión del equipo y la franja de aviso del módulo salen solas. Si el módulo llega por partes (Medios: primero imágenes, luego videos), lo que pedirán las partes que faltan se marca con `soon: true`. Dentro del módulo, lo que dependa de un programa que falta se muestra deshabilitado con su explicación (`state.tools`), nunca oculto ni roto.

   Regístrala en `web/modules/registry.js` (sustituyendo la entrada `soon` si ya estaba prevista) y enlaza su `.css` en `web/control.html`.

7. **Aspecto del tipo**, si registró uno: `web/modules/<id>/kind.js` con `registerKind('<tipo>', { icon, label, unit, title, key, background, draw, controls })` (contrato en `web/core/kinds.js`), una línea en `web/modules/kinds.js` (y quitar su entrada de la tabla de tipos previstos, si estaba), y su color en `.kind.k-<tipo>` (`web/core/app.css`). Si falta un icono, `scripts/actualizar-iconos.mjs`.

8. **Pruebas**: `test/<id>.test.js` para la lógica pura. Añade su recorrido a `scripts/probar-chrome.mjs` y su pantalla a `SCREENS` en `scripts/auditar-responsive.mjs`.

9. **Documentación**: aplica `.claude/rules/documentacion.md`. Como mínimo: `README.md`, `.claude/rules/arquitectura.md` (si añade estado, permisos o un tipo), `docs/ESTADO.md` y `CHANGELOG.md`.

## Comprobación final

- [ ] En el servidor no importa archivos de otros módulos (usa `app.services`, `app.kinds` o `app.run`).
- [ ] Toda acción tiene permiso y valida su entrada. Los mandos en vivo se validan en el `control()` del tipo.
- [ ] Nada largo hace esperar a una acción: va como tarea (`app.jobs`).
- [ ] Los programas externos se usan solo con `app.tools.spawn()`, y el módulo declara en `needs` los que necesita. Sin ellos se abre igual y avisa.
- [ ] Si busca texto, usa `server/core/search.js`.
- [ ] Lo que produce se puede añadir al orden del culto.
- [ ] Sigue `DESIGN.md`: un solo acento, iconos de la familia, acción principal abajo a la derecha, estados vacío y de error.
- [ ] `npm test`, `node scripts/probar-chrome.mjs rapido` y `node scripts/auditar-responsive.mjs` pasan.
- [ ] Un rol sin permiso no puede usarlo.
- [ ] Documentación al día.
