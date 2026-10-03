---
paths:
  - "web/**"
---

# Web

- JavaScript puro con módulos ES, cargado directo por el navegador. **Sin framework, sin compilación, sin CDN** (la red de la iglesia puede no tener internet). Las librerías de terceros se copian a `web/vendor/` con su licencia.
- Rutas siempre absolutas desde la raíz (`/core/api.js`, `/modules/...`).
- Comunicación con el servidor solo a través de `web/core/api.js`: `api()`, `action()`, `subscribe(ns, fn)`, `connect(rol)`.
- Construir el DOM con `h()` de `web/core/dom.js`. **No usar `innerHTML` con datos** (texto bíblico, nombres, lo que venga del servidor).
- Los manejadores de eventos que llaman al servidor se envuelven en `guard()`: muestra el error en pantalla y redirige al inicio si falta sesión.
- Cada módulo exporta funciones `createX(contenedor, opciones)` que montan su interfaz y se suscriben al estado. No guardan estado compartido por su cuenta.
- Una página por rol: `web/<rol>.html` + `web/roles/<rol>.js`. Las páginas con permisos empiezan con `await ensureRole('<rol>')`.
- Estilos: variables de `web/core/app.css`. Cada módulo trae su propio `.css` si lo necesita.
- **Todo debe funcionar en celular**: probar a 375 px de ancho. Botones de al menos 42 px de alto en pantallas pequeñas.
- La proyección se dibuja solo con `createStage()` (`web/modules/projection/stage.js`), que usa unidades relativas al contenedor (`cqh`/`cqw`) para que la vista previa y la pantalla real se vean iguales.
- Textos de la interfaz en español, claros para voluntarios sin conocimientos técnicos.
