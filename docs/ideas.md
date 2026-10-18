# Bandeja de ideas

Ideas del dueño para más adelante, todavía sin compromiso. **No son el plan**: aquí se anotan como llegan y se van puliendo (qué se quiere, para qué, qué hay ya en Manna, qué falta decidir). Cuando una está madura pasa a `docs/PLAN.md` como cambio sugerido (sección 11), y solo entra como fase cuando el dueño la aprueba.

Estados: **cruda** (recién anotada), **en desarrollo** (con preguntas en curso), **lista** (para proponerla al plan), **al plan** (ya es una sugerencia o una fase; se deja aquí el enlace).

## I1 · Varias citas de una vez al orden del culto

**Estado**: al plan · 2026-10-18: **fase 27** de `docs/PLAN.md` (decisión 47), junto con I2

**Qué**: pegar de una vez muchas citas bíblicas (una por línea, o separadas por comas o punto y coma, como vengan) y que Manna las añada todas al orden del culto, en ese orden.

**Para qué**: preparar una predicación con muchas citas sin escribirlas una por una en la cita rápida.

**Lo que ya hay**: la cita rápida del Orden añade una cita (`quickAdd` en `web/modules/order/workspace.js`), con el reconocimiento de citas del servidor (`parseReference` en `server/modules/bible/reference.js`). Ese lector sirve para una cita escrita a propósito, pero **no para un texto libre**: acepta el principio de cualquier nombre («es» → Esdras) y no mira lo que rodea al número.

## I2 · Sacar las citas de un documento Word o PDF

**Estado**: al plan · 2026-10-18: **fase 27** de `docs/PLAN.md` (decisión 47), junto con I1, con quien comparte el detector y la lista para revisar

**Qué**: entregar a Manna un documento Word (`.docx`) o PDF, como el bosquejo del sermón, y que encuentre las citas bíblicas que menciona y las añada al orden del culto.

**Decidido por el dueño (2026-10-18)**: un documento sin texto (un PDF escaneado, una foto del papel) se descarta con un aviso; no se intenta leer. Lo importante es que el detector distinga bien qué es una cita y qué no, sin errores.

## Investigación de I1 e I2 (2026-10-18)

**Conclusión: viable, sin programas ni dependencias nuevas y sin modelos de lenguaje.** Un prototipo (`scripts/prototipos/citas/`) lo comprobó con textos de prueba y lo calibró con once documentos reales de la iglesia (abajo).

**Sacar el texto** (en el navegador de quien lo sube, también un celular):
- `.docx`: es un `.zip`; se lee su índice y se descomprime `word/document.xml` con `DecompressionStream`, que traen los navegadores (`leer.mjs`, unas 30 líneas). Probado: el texto salió idéntico al original.
- PDF: pdf.js, que Manna ya trae para las presentaciones (`getTextContent`). Probado en Chrome con un PDF de dos páginas: texto idéntico.
- Un PDF sin texto (escaneado) se reconoce porque no da texto, y se avisa. `.doc` antiguo: pedir que se guarde como `.docx` o PDF. `.txt` y pegar texto (I1) entran directos.

**El detector** (`detector.mjs`, en el servidor, que tiene las biblias). Por qué no «una inteligencia artificial»: `CLAUDE.md` lo prohíbe («sin modelos de lenguaje»), necesitaría internet o un programa grande, y **puede inventarse una cita**, que es justo el error que no se quiere. Este va por reglas comprobables, y se «entrena» con ejemplos: cada caso real que falle pasa a ser una prueba, y ya no vuelve a fallar.
1. **El libro**: nombres y abreviaturas de una lista cerrada (nunca un trozo de palabra), con o sin tilde, con ordinal («1 Co», «I Corintios», «1ra de Corintios», «Primera de Juan»). Un romano necesita espacio o punto detrás: si no, «Is 53» se leía «I S 53» (1 Samuel).
2. **Los números**: «3:16», «3.16», tramos («16-18», «11 al 32», «5:1–7:29»), listas («8:1,28,31-39», «Hch 2:38; 3:19»), capítulos («Mt 5–7», «Juan capítulo 3 versículo 16», «el cap. 3 de Colosenses»), y los libros de un solo capítulo («Judas 24-25» es 1:24-25).
3. **Que exista**: cada capítulo y versículo se comprueba contra las biblias instaladas. Así caen «Hechos 2023», «Rut 5 años», «Ester 15 de agosto». Las versiones no numeran igual (2 Corintios 13 tiene 13 versículos en la 1909 y 14 en la 1960): vale el mayor, y al añadir se avisa si no existe en la versión elegida.
4. **El contexto**:
   - horas («Am 9:00», «a las 10:30», «Juan 10:30 de la mañana»);
   - cantidades («Juan 3 hermanos», «Romanos 12 personas», «Filemón 2 boletos»): un libro que es nombre de persona, o un plural detrás de un número solo;
   - minúsculas dentro de una frase;
   - la versión que la acompaña («(RVR1960)», «NVI»).
5. **Lo que depende de otra cita** («v. 18», «vv. 20-22», «versículo 5 de dicho capítulo»): se deduce de la cita anterior en el texto, y va siempre a revisar.

**Resultado**: tres grupos, y nada entra al orden sin pasar por la lista:
- **seguras**: marcadas;
- **a revisar**: con el motivo (««3, 16»: se entendió 3:16», «“ss”: ¿hasta dónde?», «deducido de Jn 3.16», «le sigue “nos”: ¿es la cita?»);
- **descartadas**: plegadas, con el porqué, por si alguna sí era cita.

**Medido con el prototipo** (`run.mjs`):

| Prueba | Resultado |
| --- | --- |
| 45 casos difíciles escritos a mano | 45 de 45 bien |
| 40 trampas que parecen citas y no lo son | 0 falsos positivos |
| Un bosquejo realista (Gemini, unas 70 citas en unas 30 formas) | 65 seguras, todas bien; 6 a revisar con la propuesta correcta; ninguna olvidada |
| Unas notas rápidas (53 citas abreviadas) | 53 de 53 |
| Los documentos de Manna (74.000 palabras con números, versiones y horas) | 0 falsos positivos; las 9 que encontró son citas de verdad puestas como ejemplo |

Los textos de prueba son inventados, como en el resto de las pruebas.

**Calibrado con documentos reales (2026-10-18)**: el dueño entregó once documentos de la iglesia (diez sermones en Word y un PDF de 185 páginas con sermones y estudios). Se usaron **solo en este equipo**: su carpeta está fuera de git y no se mandaron a Gemini. Se revisó **cita por cita contra su contexto**.

| | Primera pasada | Tras corregir |
| --- | --- | --- |
| Citas encontradas | 367 | **403** (101 en Word, 302 en el PDF) |
| Seguras equivocadas | 1 («1 S. Juan 5:14» = Primera de San Juan, leída como el Evangelio) | **0** |
| Seguras incompletas (faltaba un versículo) | unas 10 («Marcos 5:33, 34.», «Gen. 1:26,27.», «Mateo 13:31 y 32») | **0** |
| Olvidadas | unas 30 | **0** |
| A revisar | 52, varias con una propuesta equivocada | **68**, todas con la propuesta buena (o la buena entre las dos que ofrece) |
| Descartadas | 18, de ellas unas 16 citas reales | **2**, las dos bien descartadas («versículo 28 y 29» que el sermón imagina y no existen; «los hechos. 2.», que es una lista) |
| Confirmadas por el texto copiado | — | **177** |

Las citas olvidadas de la primera pasada:
- las «Corintios» del PDF, sin la sílaba «ti»;
- «Ecle.», «Deu.», «Hebr.», «Ose»;
- «Heb: 13:5», «Mateo (26:51-52)»;
- citas sin libro como «(25:22)».

Lo que se aprendió, ya en el prototipo:
- **El PDF de Word pierde la ligadura «ti» de Calibri** («Corin\0os», «\0ene»): se repone antes de buscar.
- **Los números de una cita no saltan de línea**, salvo tras un guion: debajo suele ir el versículo copiado con su número, y «19:4,5:⏎4 Y él…» se leía «5:4».
- En Word, **el espacio tras «;» suele ser uno que no se parte**.
- **Las versiones no numeran igual** (2 Co 13: 13 o 14 versículos): vale el mayor de las instaladas.
- **El nombre de una persona seguido de un número no siempre es una cantidad**: «En Mateo 9 encontramos», «Ezequiel 28 son conocidos». Va a revisar; se descarta solo con una unidad detrás («Romanos 12 personas»).
- **«v. 18» y «versículo 35 de este capítulo»** van con la cita anterior, salvo que sea de paso (entre paréntesis o tras unas comillas). Entonces van con el texto del sermón («Texto:», «Leer…»), y se ofrece la otra opción.
- **Comparar con el texto copiado decide** cuando hay duda: los «versículos 11-15» se pasan solos a Juan 11 (y no a Juan 16), y el «v.5» a Salmo 100 (no a Levítico 22). También precisa un capítulo entero («Salmos 19» seguido de los versículos 12-14).
- Avisar de que **«el texto copiado es de otro versículo»** solo con lo que va entre comillas o en líneas de versículo: con la prosa del sermón daba falsas alarmas.
- Las referencias a libros de Elena G. de White («pág. 144:1», «135:2») y a comentarios («1:188») **no son citas**, y no salen.

**Cuidado al leer estos números**: el detector se ajustó con estos mismos documentos. Para medir de verdad cuánto acierta hacen falta documentos nuevos que no haya visto; los casos de estos ya son pruebas (66 en `casos.json`, con frases inventadas de la misma forma).

**Lo que falta saber**: casos aún sin cubrir:
- una cita en palabras («Juan tres dieciséis»);
- un PDF a dos columnas.

**Decidido por el dueño (2026-10-18, decisión 47)**: aprobó todas las recomendaciones.
- **Dónde**: en el Orden, «Añadir» → «Citas de un texto o documento», con un recuadro para pegar y «Elegir documento». Si en la cita rápida se pegan varias citas, la lista se abre sola.
- **La lista para revisar**: cada cita ya escrita bien («1 Corintios 13:4-7»), el trozo del documento donde aparece, su casilla y el motivo si hay duda; se puede corregir a mano con la cita rápida. Abajo, «Añadir 12 al orden».
- **Qué sale marcado**:
  - las seguras;
  - las de revisar no, con la propuesta lista para marcar de un toque, salvo las que confirma el texto copiado;
  - las citas de paso («(Ro 3.23)») también.
- **Sección**: por defecto, una nueva con el nombre del documento, que se puede cambiar, o una del orden que ya exista.
- **Cita sin versículo** («Salmo 23»): el capítulo entero. Si el texto copiado debajo dice cuáles, se proponen esos versículos; se avisa si el capítulo pasa de 40 versículos.
- **Repetidas**: una vez, con «aparece 10 veces». Si ya está en el orden: sin marcar, con «ya está».
- **Versión**: la elegida en la Biblia. Si el documento dice otra instalada («NVI»), esa; si no está instalada, se avisa y se usa la elegida.
- **Orden**: el del documento.
- **«Hebreos 11:1ss»**: hasta el final del capítulo, sin marcar y con el final para cambiarlo.
- **Documentos largos** (más de 40 citas): la lista se agrupa por página o por título del sermón, y cada grupo se marca o desmarca de una vez.
- **Word antiguo (.doc)**: un aviso para guardarlo como .docx o PDF. **Sin texto** (escaneado): se descarta con un aviso.
- **Dispositivos**: todos los que pueden editar el orden, también el celular.

**Más adelante, si se quiere**: un párrafo citado sin su referencia podría encontrarse con el buscador de la Biblia, como sugerencia (sin modelos de lenguaje).
