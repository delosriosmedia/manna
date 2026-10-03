---
paths:
  - "server/modules/bible/**"
  - "Biblias/**"
  - "test/bible.test.js"
  - "test/library.test.js"
---

# Biblias

## Derechos de autor

- En git solo entran `Biblias/LEEME.txt` y `Biblias/Reina Valera 1909.xmm` (dominio público). El `.gitignore` excluye lo demás: no cambiarlo ni forzar con `git add -f`.
- No pegar pasajes largos de versiones con derechos en código, pruebas ni documentación. Para pruebas, usar texto de la RV1909 o inventado.

## Formatos

- `.xmm` (OpenLP): `<b n="Génesis"><c n="1"><v n="1">texto</v>`
- `.xml`: `<book number="1"><chapter number="1"><verse number="1">texto</verse>`. No trae nombres de libro; se toman de `canon.js`.

Un formato nuevo se añade como entrada en `FORMATS` de `parsers.js`.

## Limpieza del texto (`cleanVerse`)

Se aplica al cargar, no al mostrar. Hoy quita: llamadas de nota `[1]`, asteriscos, títulos de sección incrustados (bloques que empiezan con línea en blanco, típicos de la Biblia de Jerusalén), el número de versículo repetido al inicio y los versículos que solo contienen `--`.

Al tocar la limpieza: comprobar contra **todas** las biblias de `Biblias/` que no se pierde texto bíblico. Es preferible dejar un título de más que borrar un versículo.

## Otras reglas

- Los libros se identifican por número canónico (1-66). `findBook()` resuelve nombres, abreviaturas y prefijos sin tildes.
- Las versiones se cargan la primera vez que se usan y quedan en memoria. El identificador de versión sale del nombre del archivo.
- Nombres legibles de versiones conocidas: tabla `KNOWN` en `versions.js`.
