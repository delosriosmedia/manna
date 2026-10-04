---
paths:
  - "server/modules/bible/**"
  - "Contenido/**"
  - "test/bible.test.js"
  - "test/library.test.js"
---

# Biblias

## Derechos de autor

- Las biblias están en `Contenido/Biblias/`. En git solo entran su `LEEME.txt` y `Reina Valera 1909.xmm` (dominio público). El `.gitignore` excluye lo demás: no cambiarlo ni forzar con `git add -f`.
- No pegar pasajes largos de versiones con derechos en código, pruebas ni documentación. Para pruebas, usar texto de la RV1909 o inventado.
- Lo mismo vale para el himnario (`Contenido/Himnario/videos/` y `letras/`): nada de eso entra en git, y **ninguna letra real** se escribe en código, pruebas, documentación ni mensajes.

## Búsqueda y comparación

- El texto se busca en una sola versión: la Reina-Valera 1960 (`SEARCH_VERSION` en `library.js`), o la elegida si no está instalada. Las citas se resuelven en la versión elegida. Un resultado es una posición: se abre en la versión elegida.
- El comparador (`compare.js`) es un segundo tipo de contenido del mismo módulo: `data = { versions: [a, b], ref, layout }`. Los pasos los marca la primera versión.

## Formatos

- `.xmm` (OpenLP): `<b n="Génesis"><c n="1"><v n="1">texto</v>`
- `.xml`: `<book number="1"><chapter number="1"><verse number="1">texto</verse>`. No trae nombres de libro; se toman de `canon.js`.

Un formato nuevo se añade como entrada en `FORMATS` de `parsers.js`.

## Limpieza del texto (`cleanVerse`)

Se aplica al cargar, no al mostrar. Hoy quita: llamadas de nota `[1]`, asteriscos, títulos de sección incrustados (bloques que empiezan con línea en blanco, típicos de la Biblia de Jerusalén), el número de versículo repetido al inicio y los versículos omitidos (los que solo contienen `--` o `(TEXT OMITTED)`).

Al tocar la limpieza: comprobar contra **todas** las biblias de `Contenido/Biblias/` que no se pierde texto bíblico. Es preferible dejar un título de más que borrar un versículo.

## Otras reglas

- Los libros se identifican por número canónico (1-66). `findBook()` resuelve nombres, abreviaturas y prefijos sin tildes.
- Las versiones se cargan la primera vez que se usan y quedan en memoria. El identificador de versión sale del nombre del archivo.
- Nombres legibles de versiones conocidas: tabla `KNOWN` en `versions.js`.
