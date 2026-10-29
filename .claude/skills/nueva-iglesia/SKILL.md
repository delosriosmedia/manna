---
name: nueva-iglesia
description: Pone en marcha Manna Iglesia para una iglesia nueva (su nube en <iglesia>.manna-iglesia.es, su túnel servidor-<iglesia> y su equipo principal instalado desde la portada). Úsala cuando el dueño pida desplegar o abrir una iglesia nueva, o pasar una iglesia a su nube (como Nueva Vida a nv.manna-iglesia.es).
disable-model-invocation: true
---

# Una iglesia nueva en Manna Iglesia

Decisión 66. El detalle técnico de cada paso está en `.claude/rules/nube.md` («Desplegar» y «Variables de cada sitio»): aquí, el orden y quién hace qué. Todo lo que es «hacia fuera» (crear un sitio, un túnel, desplegar) se hace con el permiso del dueño para esa iglesia. El asistente nunca escribe ni repite claves: las pega el dueño.

Al final, para la gente de esa iglesia todo entra por `https://<iglesia>.manna-iglesia.es`: «Preparar el culto» desde casa y «Entrar al equipo de la iglesia» cuando el servidor está encendido (por la red de la iglesia o, desde fuera, por `servidor-<iglesia>.manna-iglesia.es`), siempre con nombre y PIN.

## 1. La nube (el asistente, salvo las claves)

1. **El sitio** en Hostinger y su registro A en Cloudflare, sin proxy (`nube.md`, «Desplegar», paso 2). Si ya existe (como `nv`), mirar sus variables: las que no llevan claves (`MANNA_NUBE=1`, `MANNA_NO_OPEN`, `MANNA_SIN_VENTANA`, `MANNA_DATA`) las pone el asistente, y solo mientras el sitio no tenga ninguna clave.
2. **Su carpeta de datos vacía**: si el sitio ya se usó para otra cosa, el dueño mira `~/domains/<sitio>/manna-datos` en el administrador de archivos del panel (el conector no llega ahí). Tras desplegar, `GET /api/session` debe decir `alta: true`.
3. **El túnel** «servidor-<iglesia>» en Cloudflare, con su CNAME (`nube.md`, paso 2).
4. **Las claves**, que pone el dueño en Hostinger (Sitio → Node.js → Variables de entorno, sin borrar las otras): `MANNA_CLAVE_ALTA` (una que invente), `MANNA_CLAVE_SUPER` (la de siempre), una clave de R2 de solo lectura propia del sitio («manna-<iglesia>-solo-lectura», con `R2_ACCOUNT_ID` y `R2_BUCKET`) y `MANNA_TUNEL_CLAVE` (la del túnel). Guiarlo pantalla por pantalla.
5. **Desplegar** la versión aprobada en `pruebas` (`nube.md`, pasos 1, 3, 4 y 5).
6. **El dueño**: en `admin.manna-iglesia.es` → Iglesias, añadirla (así entra en las copias de Google Drive); y en `https://<iglesia>.manna-iglesia.es/administrar`, con la clave de alta, su administrador (nombre y PIN).

## 2. El computador de la iglesia (un solo paso, en ese computador)

7. Abrir `https://<iglesia>.manna-iglesia.es` → «Instalar Manna en este equipo» → PIN de un administrador → elegir el himnario (desde la nube o completo) → ejecutar el instalador. Si ya tenía Manna, se conservan sus usuarios (suben a la nube, los del mismo nombre se juntan), sus órdenes y su contenido.
8. Comprobar, desde aquí: en `/administrar` → Equipo, el equipo conectado con su versión; la portada ofrece «Entrar al equipo de la iglesia»; `https://servidor-<iglesia>.manna-iglesia.es/api/ping` contesta con su `id`.

## 3. Después

- Si el equipo usaba otro túnel (Nueva Vida: «Manna-PC» en `manna-iglesia.es`), queda sin uso: borrarlo en Cloudflare con el permiso del dueño.
- Anotar en `.claude/rules/nube.md` («Dónde vive») el sitio y su túnel, y en `docs/ESTADO.md` lo hecho.
