---
name: publicar
description: Publica los cambios de Manna en GitHub. Corre las pruebas, revisa que la documentación esté al día, prepara la versión y el commit, y se detiene a mostrar el resumen antes del push.
disable-model-invocation: true
---

# Publicar cambios de Manna

El push espera la confirmación del dueño. No lo hagas antes.

**Excepción aprobada por el dueño el 2026-10-04**: al cerrar una fase de `docs/PLAN.md` se publica sin esperar (pasos 1 a 6 y 8), y el resumen del paso 7 se le entrega después, junto con los resultados de la fase, la fase que sigue y los cambios que necesite el plan. Antes de publicar una fase, además: su fila de la sección 9 del plan está al día y cada cambio al plan consta en la sección 10.

## 1. Revisar qué hay

```bash
git status --short
git diff --stat
```

Si no hay cambios, dilo y termina.

## 2. Pruebas

```bash
npm test
```

Si fallan, detente e informa. No se publica con pruebas rotas.

## 3. Nada indebido

Confirma que entre los archivos a publicar no hay:

- De `Contenido/`, solo los `LEEME.txt` y `Contenido/Biblias/Reina Valera 1909.xmm`. Ninguna otra biblia, ningún video ni ninguna letra de himno (tampoco dentro de pruebas o documentos).
- Nada de `data/` (incluye `manna.log`, `error.html` y los programas de `data/herramientas/`), ni archivos `.local`.
- PIN, contraseñas o claves.

## 4. Documentación

Recorre la tabla de `.claude/rules/documentacion.md` contra los archivos cambiados y actualiza lo que falte. Siempre:

- `docs/ESTADO.md`: fecha de hoy y contenido al día.
- `CHANGELOG.md`: los cambios están en "Sin publicar".

## 5. Versión

Propón el número según lo acumulado en "Sin publicar":

- Arreglos o cambios internos: sube el último número (0.2.0 → 0.2.1).
- Funcionalidad o módulo nuevo: sube el del medio (0.2.0 → 0.3.0).
- Solo documentación o estructura de trabajo: sin versión nueva.

Si hay versión nueva: actualiza `version` en `package.json`, la versión en `docs/ESTADO.md`, y convierte "Sin publicar" en `## <versión> — <fecha de hoy>` dejando una sección "Sin publicar" vacía arriba.

## 6. Commit

Un commit con mensaje en español: primera línea corta que diga qué cambia; debajo, una lista breve. Termina con la línea de atribución que indique la sesión.

## 7. Resumen y confirmación

Muestra al dueño:

- Versión (o "sin versión nueva").
- Qué cambia, en lenguaje llano.
- Resultado de las pruebas.
- Qué quedó sin probar.
- Documentos actualizados.

Pregunta si publica. **Espera la respuesta.**

## 8. Push

Solo tras un sí:

```bash
git push
```

Si hubo versión nueva, crea también la **versión de GitHub** (con su etiqueta). Es de donde se descargan los instaladores de un solo archivo (enlaces del README, «Instalación»), y **los adjunta GitHub solo**: al publicarla, `.github/workflows/instaladores.yml` compila `Instalar-Manna-Windows.exe` en un Windows, arma `Instalar-Manna-Mac.pkg` en un Mac, los prueba y los sube a la versión, y a la vez corre `npm test` en el Windows (alrededor de 1 minuto; medido el 2026-10-18: 46 s el más largo). Si las pruebas de Windows fallan, los instaladores se adjuntan igual: se dice al dueño qué falló:

```bash
gh release create v<versión> --target main --title "Manna <versión>" --notes "<lo de esta versión en CHANGELOG.md>"
gh run list --workflow instaladores.yml --limit 1   # y, al terminar, que la versión tenga los dos archivos
gh release view v<versión> --json assets --jq '.assets[].name'
```

Si la compilación falla, la versión queda sin instaladores: se arregla, se publica una versión de arreglo y se avisa al dueño. Para probar un cambio de los instaladores antes de publicar, se sube a una rama `fase-…`: el mismo flujo los compila y los prueba sin adjuntarlos.

## 9. La nube (fase 37, parte 7)

Con versión nueva, tras el push (los equipos que se ponen al día bajan la versión de `main`), se despliega en la nube, como dice `.claude/rules/nube.md` («Desplegar»):

1. `node scripts/desplegar.mjs probar`; si falla, no se sube.
2. El paquete, por TUS, a `public_html` de `pruebas.manna-iglesia.es` y de `admin.manna-iglesia.es`, y `hosting_nodejs_start-build` en los dos.
3. Comprobar que `https://<sitio>/api/ping` dice la versión nueva en los dos.
4. Las demás iglesias (hoy, `nv.manna-iglesia.es`) solo cuando el dueño apruebe esa versión en `pruebas` (decisiones 58 y 64).
5. Si cambió un manual de `sitio/` o una pantalla que sale en ellos: `node scripts/sitio.mjs` y publicar `manna-iglesia.es` (`.claude/rules/nube.md`, «La bienvenida y los manuales»).

Con la nube en la versión nueva, cada equipo oficial se pone al día solo la próxima vez que se encienda. Si la versión cambia la forma de lo que va y viene entre el equipo y la nube (órdenes, textos, favoritos, usuarios, Medios), se sube antes `PROTOCOL` en `server/modules/cloud/index.js`: así un equipo que aún no se puso al día no sincroniza con la forma nueva (lo dice en Ajustes → Nube y sigue en local).

Confirma con el enlace al repositorio: https://github.com/delosriosmedia/manna
