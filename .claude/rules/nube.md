# La nube (Manna Iglesia, fases 36 a 39)

Cómo se despliega Manna en «modo nube» en el hosting de Hostinger y lo que se aprendió. El código del modo nube está en `.claude/rules/arquitectura.md` («Modo nube»); las claves nunca van aquí ni al repositorio.

## Dónde vive

- **Hosting**: Hostinger, cuenta `u887958304`, pedido `1009683253` (plan Business, Node.js con LiteSpeed y Passenger). Una iglesia es un sitio (subdominio) con su propio proceso y su carpeta de datos. Hoy: `nv.manna-iglesia.es` (Nueva Vida, con Manna desde el 2026-10-29, la 1.58.0; su túnel, «servidor-nv»), `pruebas.manna-iglesia.es` (decisión 57; creado el 2026-10-25 con la 1.47.0) y `admin.manna-iglesia.es`, el del superadministrador (fase 39, decisión 64; creado el 2026-10-26: el mismo programa con `MANNA_SUPER=1`). En la misma cuenta hay sitios del dueño que no son de Manna (`milugar`, `biblia`): no se tocan.
- **El equipo de cada iglesia, desde internet**: su conexión por internet (módulo `internet`) con un túnel con nombre de Cloudflare, para que la portada de su nube («Entrar al equipo de la iglesia») lleve siempre a la misma dirección. **El nombre es siempre `servidor-<iglesia>.manna-iglesia.es`, y el túnel se llama igual que su primera parte** (decisión del dueño, 2026-10-29: «servidor» es el equipo que está en la iglesia). `pruebas`: `servidor-pruebas.manna-iglesia.es` (túnel «servidor-pruebas», creado el 2026-10-29, servicio `http://localhost:80`); **su clave va en la nube de la iglesia** (`MANNA_TUNEL_CLAVE`, abajo; desde la 1.58.0, S56): el equipo oficial la recibe al emparejarse y en cada comprobación y enciende solo su conexión por internet con esa dirección. Antes se pegaba a mano en Ajustes → Conexión por internet → «Usar un dominio propio»; `pruebas` la tiene en su nube desde el 2026-10-29. Nueva Vida usaba `manna-iglesia.es` (túnel «Manna-PC»); desde el 2026-10-29 esa dirección es la bienvenida (abajo) y su equipo, instalado desde `nv` ese mismo día, se abre desde fuera por `servidor-nv.manna-iglesia.es`. Sin túnel con nombre funciona igual, con una dirección `…trycloudflare.com` que cambia en cada arranque. La dirección de la nube no puede ser la del equipo: es de Hostinger.
- **La bienvenida y los manuales** (decisión 67): `manna-iglesia.es` (y `www`), un sitio sin programa en Hostinger, creado el 2026-10-29: qué es Manna Iglesia y los manuales de instalación, de los usuarios, del administrador y del superadministrador. Sus páginas están en `sitio/` y las arma `node scripts/sitio.mjs`: toma las capturas con la auditoría (`auditar-responsive.mjs capturas`, al doble con `MANNA_CAPTURAS_ESCALA=2`, datos inventados), las reduce a JPEG con ffmpeg y junta las páginas, las letras y el logo de Manna en `data/sitio/` y en `data/despliegue/sitio-<fecha>.zip` (`sin-capturas` reutiliza las de la última vez, para cambios de texto). Se publica subiendo el `.zip` por TUS a `public_html` de `manna-iglesia.es` y con `hosting_websites_deploy-static-site-archive`. Se vuelve a publicar cuando cambia un manual o una pantalla que sale en ellos. Para verlo aquí, `manna-sitio` de `.claude/launch.json` (puerto 8150).
- **DNS**: Cloudflare, zona `manna-iglesia.es`. Cada subdominio, un registro A al servidor de Hostinger (`31.97.208.163`), **solo DNS, sin proxy**: así Hostinger da el certificado.
- **Himnario y biblias**: R2 (`server/core/r2.js`), subidos con `scripts/subir-r2.mjs`. La nube los copia al abrirse.
- **Cómo arranca**: Passenger, desde la carpeta de la última compilación (`~/domains/<sitio>/hbuilds/current/nodejs`), con Node.js 24 y el archivo de entrada de la compilación (queda en el `.htaccess` del sitio como `PassengerStartupFile`). LiteSpeed lo carga con `require()`: la entrada es `server/inicio.cjs`. Espera que la aplicación abra su puerto en sus primeros 3 s (Manna lo abre en unos 0,2 s) y toma el primero que se abre: en la nube Manna abre uno solo.
- **Datos**: `MANNA_DATA`, fuera de `public_html` (`~/domains/<sitio>/manna-datos`): sobreviven a cada despliegue. El conector no puede mirar ahí (solo dentro de `public_html`); se mira en el administrador de archivos del panel.

## Variables de cada sitio

Las que no llevan claves (`MANNA_NUBE`, `MANNA_DATA`, `MANNA_NO_OPEN`, `MANNA_SIN_VENTANA`) las pone el asistente con `hosting_nodejs_replace-environment-variables` **antes del primer despliegue**: así Manna nunca arranca ahí fuera del modo nube, y sin la clave de alta nadie puede entrar. Las que llevan claves las añade **el dueño** en el panel (Sitio → Node.js → Variables de entorno), sin borrar las otras. Después, **nunca** se vuelve a usar el reemplazo por la API: borra las que no se envían, y las claves no se pueden leer para reenviarlas.

| Variable | Valor |
| --- | --- |
| `MANNA_NUBE` | `1` (el asistente) |
| `MANNA_NO_OPEN`, `MANNA_SIN_VENTANA` | `1` (el asistente) |
| `MANNA_DATA` | `/home/u887958304/domains/<sitio>/manna-datos` (el asistente) |
| `MANNA_CLAVE_ALTA` | la clave de un solo uso con la que entra el primer administrador (la elige el dueño) |
| `R2_ACCOUNT_ID`, `R2_BUCKET` | los de `~/.manna-r2` |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | una clave de R2 **de solo lectura**, solo para el depósito `manna-contenido` y **una por sitio** (S54): «manna-<sitio>-solo-lectura» (Cloudflare → R2 → Manage API tokens → Create Account API token, «Object Read only»). `pruebas` usa «manna-pruebas-solo-lectura» desde el 2026-10-29. Nunca la de subir («R2 Account Token», de lectura y escritura, la de `~/.manna-r2` de este Mac) |
| `MANNA_CLAVE_SUPER` | la clave con la que el superadministrador habla con la iglesia: **la misma** en cada sitio de iglesia y en `admin` (la elige el dueño) |
| `MANNA_TUNEL_CLAVE` | la clave del túnel «servidor-<iglesia>» (Cloudflare → Zero Trust → Networks → Tunnels → el túnel → la orden de instalar, que la lleva dentro), que el equipo oficial recibe sola (S56). La copia el dueño |

El sitio del superadministrador (`admin.manna-iglesia.es`) lleva `MANNA_NUBE=1`, `MANNA_SUPER=1`, `MANNA_NO_OPEN`, `MANNA_SIN_VENTANA` y su `MANNA_DATA` (el asistente), y `MANNA_CLAVE_ALTA` (con la que crea su cuenta, con contraseña) y `MANNA_CLAVE_SUPER` (el dueño); para las copias en Google Drive (fase 38), `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (el dueño, abajo). No lleva R2. Se despliega con el mismo paquete que las iglesias.

### Conectar Google Drive (una vez, lo hace el dueño)

Las copias de cada noche van a la carpeta «Manna Iglesia» del Drive que se conecte. Manna solo ve lo que crea él (permiso `drive.file`). Hecho el 2026-10-29 con la cuenta delosrios.media@gmail.com: proyecto «Manna Iglesia» (`manna-iglesia`), aplicación en producción, cliente web «admin.manna-iglesia.es»; conectada desde el panel y con la primera copia de `pruebas` hecha ese día. Para publicar la aplicación, Google pide en «Información de la marca» la página principal (`https://admin.manna-iglesia.es`), la política de privacidad (`https://admin.manna-iglesia.es/privacidad.html`, archivo `web/privacidad.html`, servido sin sesión en todos los sitios) y el dominio autorizado `manna-iglesia.es`.

1. En https://console.cloud.google.com, con la cuenta del Drive donde irán las copias (la de Los Ríos Multimedia), crear un proyecto: «Manna Iglesia».
2. «APIs y servicios» → «Biblioteca» → **Google Drive API** → «Habilitar».
3. «Google Auth Platform» (la pantalla de consentimiento): tipo **Externo**, nombre «Manna Iglesia» y el correo de asistencia. En «Público», **Publicar la app** para que quede «En producción»: en «Prueba», Google corta el acceso a los 7 días. Con solo `drive.file` no hace falta la verificación de Google.
4. «Clientes» → «Crear cliente» → **Aplicación web**, con el URI de redireccionamiento autorizado `https://admin.manna-iglesia.es/api/super/drive/vuelta`. Copiar el ID de cliente y el secreto.
5. En Hostinger, sitio `admin.manna-iglesia.es` → Node.js → Variables de entorno: añadir `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`, sin borrar las demás, y volver a desplegar.
6. En https://admin.manna-iglesia.es → **Copias** → «Conectar Google Drive» → elegir esa cuenta → «Permitir». Desde entonces, la copia de cada iglesia se hace sola cada noche (a las 3 de la madrugada de Colombia).

## Desplegar

1. `node scripts/desplegar.mjs probar`: arma `data/despliegue/manna-<versión>-<fecha-hora>.zip` con `git archive` del último commit (solo `package.json`, `server/` y `web/`, unos 3 MB: lo publicado, no lo que haya a medio hacer) y lo abre como el hosting, contra un R2 de mentira. Si falla, no se sube.
2. **Solo la primera vez, con permiso del dueño** (crear un sitio es un paso hacia fuera):
   - el sitio: `hosting_websites_start-setup` con `order_id` `1009683253` y el dominio; se espera con `hosting_websites_list-setups` (cada 10-15 s) a `status: completed`;
   - el registro A en Cloudflare, sin proxy;
   - el túnel «servidor-<iglesia>» en Cloudflare (`config_src: cloudflare`, servicio `http://localhost:80`) con su registro CNAME, con proxy, a `<id>.cfargotunnel.com`;
   - **la configuración guardada del sitio con la entrada de Manna**: `hosting_nodejs_update-build-settings` con `node_version` 24, `app_type` `express`, `root_directory` `.`, `entry_file` `server/inicio.cjs` y `package_manager` `npm`. «Apply changes» en las variables vuelve a compilar el sitio con esa configuración guardada, no con la del último despliegue: en `nv` tenía `server/index.js` (de cuando se creó el sitio) y Manna no arrancaba (`ERR_REQUIRE_ASYNC_MODULE`, 503), 2026-10-29;
   - el dueño pone las variables (arriba), también `MANNA_TUNEL_CLAVE`, y pulsa **«Apply changes»** (sin eso no se guardan).
3. Subir el paquete: `hosting_files_generate-upload-url` y, con su `url` y sus claves, el `.zip` por TUS a `public_html` (POST para crearlo y PATCH con el contenido; ver la descripción de la operación). El hosting gasta cada archivo al compilarlo: por eso cada paquete lleva la fecha y la hora en el nombre.
4. Compilar: `hosting_nodejs_start-build` con `node_version` 24, `app_type` `express`, `root_directory` `.`, `output_directory` y `build_script` vacíos, `entry_file` `server/inicio.cjs`, `package_manager` `npm`, `source_type` `archive` y `source_options.archive_path` el nombre del `.zip` (tarda unos 10 s). Antes se puede ver lo que propone con `hosting_nodejs_build-settings-from-archive`. Las operaciones son asíncronas: se consulta `hosting_nodejs_build` hasta `completed`; si falla, `hosting_nodejs_build-logs`.
5. Comprobar desde aquí: `https://<sitio>/api/ping` dice `"app":"manna"` con la versión; `GET /api/session` trae `preparacion` y `administrar` y, la primera vez, `alta: true`. Pasados unos 30 s (la copia de R2), con un usuario, `/api/hymns` trae los 613 himnos.
6. El dueño entra en `https://<sitio>/administrar` con la clave de alta, crea su administrador (nombre y PIN) y los usuarios, y prueba `/preparacion` desde un celular y desde el PC de Leidy.
7. El equipo oficial: en ese computador, la portada del sitio → «Instalar Manna en este equipo» (con el PIN de un administrador; decisión 64) baja el instalador ya emparejado; al abrirse, Manna se empareja y enciende su conexión por internet en `servidor-<iglesia>` (S56). O, con Manna ya instalado, `/administrar` → Equipo → «Emparejar un equipo» y, en el equipo, Ajustes → Nube con la dirección del sitio y el código.

**Cada versión** se despliega así como paso 9 de `/publicar` (fase 37, parte 7): con la nube en la versión nueva, cada equipo oficial se pone al día solo al encenderse.

**Las demás iglesias** (decisiones 58 y 64): una versión se despliega primero en `pruebas`; cuando el dueño la aprueba, el mismo paquete se despliega igual en cada sitio de iglesia (hoy, `nv.manna-iglesia.es`).

## Lo aprendido

- La prueba del hosting (2026-10-25, tabla en `docs/PLAN.md`, «Fases 35 a 39»): un proceso por subdominio, SSE sin cortes, `X-Forwarded-For` con la IP de quien llama, datos fuera del programa que sobreviven, subidas de 300 MB y el proceso vivo tras 10 minutos sin visitas.
- Cada «Apply changes» de las variables recompila el sitio y gasta el paquete subido: si después hace falta otra compilación por la API, se sube otra vez el paquete con otro nombre (2026-10-29, en `nv`).
- Listar el depósito de R2 tarda unos 20 s (son unas 5 500 claves): por eso la nube copia después de abrir su puerto, nunca antes.
