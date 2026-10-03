---
name: probar
description: Levanta un servidor de prueba de Manna y verifica un cambio en el navegador (escritorio, celular, tiempo real y permisos) sin tocar los datos reales. Úsala después de cambiar la interfaz o el servidor, o cuando se pida probar o verificar la app.
---

# Probar Manna en el navegador

## 1. Pruebas automáticas

```bash
npm test
```

Si fallan, arréglalas antes de seguir.

## 2. Servidor de prueba

Puerto y datos aparte, para no tocar el PIN, el guion ni los ajustes reales. Ejecútalo en segundo plano:

```bash
MANNA_NO_OPEN=1 MANNA_DATA="$TMPDIR/manna-prueba" PORT=8123 node server/index.js
```

El PIN de prueba aparece en la salida del servidor.

## 3. Qué verificar

Abre `http://localhost:8123/control` y revisa, según lo que haya cambiado:

- **Consola** sin errores.
- **Flujo básico**: buscar `jn 3 16-17`, Enter para ir, Enter para proyectar. Cambiar de versión mantiene el pasaje.
- **Tiempo real**: con `/proyeccion` abierto en otra pestaña, el cambio aparece al instante.
- **Celular**: viewport de 375 px en `/control`, `/guion` y `/`. Sin desplazamiento horizontal. Al terminar, vuelve al tamaño de escritorio.
- **Permisos** (desde la IP de red, no desde localhost, para que pida PIN):

  ```bash
  curl -s -X POST http://<ip>:8123/api/action -H 'Content-Type: application/json' \
    -d '{"type":"<accion>","payload":{}}'
  ```

  Sin sesión debe responder error de permiso. Con sesión de un rol sin ese permiso, también.

- **Lo nuevo**: cada camino del cambio, incluidos los casos de error (datos vacíos, sin conexión, sin permiso).

La dirección de red y el estado completo están en `http://localhost:8123/api/state`.

## 4. Lo que no se puede probar aquí

La apertura en segunda pantalla, Windows y un celular real no se pueden verificar en el equipo de desarrollo. Si el cambio los toca, dilo con claridad y anótalo en la tabla "Probado y sin probar" de `docs/ESTADO.md`.

## 5. Al terminar

Detén el servidor de prueba y borra `$TMPDIR/manna-prueba`. Informa qué se probó, qué falló y qué quedó sin probar.
