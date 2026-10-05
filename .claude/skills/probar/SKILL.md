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

Puerto y datos aparte, para no tocar el PIN, el orden del culto ni los ajustes reales. Ejecútalo en segundo plano:

```bash
MANNA_NAME=manna-prueba MANNA_NO_OPEN=1 MANNA_SIN_VENTANA=1 MANNA_DATA="$TMPDIR/manna-prueba" PORT=8123 node server/index.js
```

`MANNA_NAME` evita anunciar `manna.local` y chocar con un Manna real de la misma red. `MANNA_SIN_VENTANA` evita que la prueba abra su proyección (y suene) en el proyector, si hay uno conectado: no lo quites.

El PIN de prueba aparece en la salida del servidor.

## 3. Qué verificar

Primero lo automático, que cubre el recorrido básico:

```bash
node scripts/probar-chrome.mjs rapido
```

```bash
node scripts/auditar-responsive.mjs
```

El primero usa la revisión del equipo y la interfaz como un usuario (1 min). El segundo la abre en nueve tamaños y comprueba que nada se desborda, que "Al aire" y la acción principal están a la vista, que los mandos en vivo caben y que los botones tienen tamaño para el dedo; con `capturas` guarda además una imagen de cada pantalla. Ninguno debe correr a la vez que otro servidor en los puertos 8123, 8124 o 8125 (el primero avisa si la demostración sigue abierta).

Después, a mano, lo que el cambio tenga de nuevo. Abre `http://localhost:8123/control` y revisa:

- **Consola** sin errores.
- **Lo nuevo**: cada camino del cambio, incluidos los casos de error (datos vacíos, sin conexión, sin permiso).
- **Tiempo real**: con `/proyeccion` abierto en otra pestaña, el cambio aparece al instante.
- **Revisión del equipo**: para ver cómo se comporta un equipo al que le falta un programa, arranca el servidor de prueba con `MANNA_FALTA=ffmpeg,yt-dlp` (o `navegador`) y abre `/requisitos`. No pulses "Instalar por mí" sin permiso del dueño: descarga programas de internet.
- **Celular y tableta**: `http://localhost:8123/vista-previa` muestra la app real dentro del marco de un celular (vertical y horizontal) y de una tableta.
- **Permisos** (desde la IP de red, no desde localhost, para que pida PIN):

  ```bash
  curl -s -X POST http://<ip>:8123/api/action -H 'Content-Type: application/json' \
    -d '{"type":"<accion>","payload":{}}'
  ```

  Sin sesión debe responder error de permiso. Con sesión de un rol sin ese permiso, también.

La dirección de red y el estado completo están en `http://localhost:8123/api/state`.

## 4. Desconexiones

Con `/control` y `/proyeccion` abiertos y un pasaje en vivo. El aviso rojo aparece en el control; la proyección debe mantener lo último sin mostrar mensajes.

| Caso | Cómo simularlo | Qué debe pasar |
| --- | --- | --- |
| El servidor se cae y vuelve | `pkill -f server/index.js`, esperar, volver a iniciarlo con los mismos datos | Aviso a los 2 s, explicación a los 10 s. Al volver: reconecta solo, lo que estaba en pantalla se recupera y la sesión sigue válida sin PIN |
| Conexión congelada (wifi caída, router reiniciado) | `pkill -STOP -f server/index.js`, esperar 35 s, `pkill -CONT -f server/index.js` | Aviso en unos 30 s. Al reanudar: reconecta solo |
| La dirección deja de responder (cambio de IP) | Reiniciar con `MANNA_HOST=<ip de red>` y la página abierta en `localhost` | El aviso se queda con la explicación; la página no se rompe. Al volver la dirección: reconecta solo |

Los errores `ERR_CONNECTION_REFUSED` en la consola durante el corte son normales.

## 5. Dirección con nombre, aviso al cerrar y cambio de IP

El navegador integrado no abre nombres `.local` ni muestra el cuadro "¿Salir del sitio?". Eso se prueba en un Chrome real sin ventana:

```bash
node scripts/probar-chrome.mjs
```

Arranca sus propios servidores de prueba (no debe haber otro en el puerto 8123), tarda unos 2 minutos y termina con "Todo correcto" o con la lista de lo que falló. Ejecútalo al tocar `server/modules/system/`, `web/core/api.js`, `web/core/upgrade.js` o `confirmBeforeClose`.

Comprobaciones sueltas del nombre:

```bash
dscacheutil -q host -a name manna-prueba.local      # macOS: debe dar la IP de este equipo
curl -s http://manna-prueba.local:8123/api/ping
```

## 6. Lo que no se puede probar aquí

La apertura en segunda pantalla, Windows como servidor y celulares reales (en especial si abren `manna.local`) no se pueden verificar en el equipo de desarrollo. Si el cambio los toca, dilo con claridad y anótalo en la tabla "Probado y sin probar" de `docs/ESTADO.md`.

## 7. Al terminar

Detén el servidor de prueba y borra `$TMPDIR/manna-prueba`. Informa qué se probó, qué falló y qué quedó sin probar.
