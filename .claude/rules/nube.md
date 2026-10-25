# La nube (Manna Iglesia, fases 36 a 39)

Cómo se despliega Manna en «modo nube» en el hosting de Hostinger y lo que se aprendió. El código del modo nube está en `.claude/rules/arquitectura.md` («Modo nube»); las claves nunca van aquí ni al repositorio.

## Dónde vive

- **Hosting**: Hostinger, cuenta `u887958304`, pedido `1009683253` (plan Business, Node.js con LiteSpeed y Passenger). Una iglesia es un sitio (subdominio) con su propio proceso y su carpeta de datos. Hoy: `nv.manna-iglesia.es` (página de espera) y `pruebas.manna-iglesia.es` (decisión 57; creado el 2026-10-25 con la 1.47.0). En la misma cuenta hay sitios del dueño que no son de Manna (`milugar`, `biblia`): no se tocan.
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
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | una clave de R2 **de solo lectura** para ese depósito (S54), no la de subir |

## Desplegar

1. `node scripts/desplegar.mjs probar`: arma `data/despliegue/manna-<versión>-<fecha-hora>.zip` con `git archive` del último commit (solo `package.json`, `server/` y `web/`, unos 3 MB: lo publicado, no lo que haya a medio hacer) y lo abre como el hosting, contra un R2 de mentira. Si falla, no se sube.
2. **Solo la primera vez, con permiso del dueño** (crear un sitio es un paso hacia fuera):
   - el sitio: `hosting_websites_start-setup` con `order_id` `1009683253` y el dominio; se espera con `hosting_websites_list-setups` (cada 10-15 s) a `status: completed`;
   - el registro A en Cloudflare, sin proxy;
   - el dueño pone las variables (arriba).
3. Subir el paquete: `hosting_files_generate-upload-url` y, con su `url` y sus claves, el `.zip` por TUS a `public_html` (POST para crearlo y PATCH con el contenido; ver la descripción de la operación). El hosting gasta cada archivo al compilarlo: por eso cada paquete lleva la fecha y la hora en el nombre.
4. Compilar: `hosting_nodejs_start-build` con `node_version` 24, `app_type` `express`, `root_directory` `.`, `output_directory` y `build_script` vacíos, `entry_file` `server/inicio.cjs`, `package_manager` `npm`, `source_type` `archive` y `source_options.archive_path` el nombre del `.zip` (tarda unos 10 s). Antes se puede ver lo que propone con `hosting_nodejs_build-settings-from-archive`. Las operaciones son asíncronas: se consulta `hosting_nodejs_build` hasta `completed`; si falla, `hosting_nodejs_build-logs`.
5. Comprobar desde aquí: `https://<sitio>/api/ping` dice `"app":"manna"` con la versión; `GET /api/session` trae `preparacion` y `administrar` y, la primera vez, `alta: true`. Pasados unos 30 s (la copia de R2), con un usuario, `/api/hymns` trae los 613 himnos.
6. El dueño entra en `https://<sitio>/administrar` con la clave de alta, crea su administrador y los usuarios, y prueba `/preparacion` desde un celular y desde el PC de Leidy.
7. Empareja el equipo oficial: en `/administrar` → Equipo, «Emparejar un equipo»; en el equipo (para `pruebas`, el PC de Leidy), Ajustes → Nube con la dirección del sitio y el código.

## Lo aprendido

- La prueba del hosting (2026-10-25, tabla en `docs/PLAN.md`, «Fases 35 a 39»): un proceso por subdominio, SSE sin cortes, `X-Forwarded-For` con la IP de quien llama, datos fuera del programa que sobreviven, subidas de 300 MB y el proceso vivo tras 10 minutos sin visitas.
- Listar el depósito de R2 tarda unos 20 s (son unas 5 500 claves): por eso la nube copia después de abrir su puerto, nunca antes.
