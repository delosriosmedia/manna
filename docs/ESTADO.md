# Estado del proyecto

Última actualización: 2026-10-04 · Versión: 1.5.1

Este documento es la foto actual del proyecto. Se actualiza con cada cambio (ver `.claude/rules/documentacion.md`). El historial está en `CHANGELOG.md`.

## Qué funciona

- Servidor en red local con estado central y tiempo real.
- **Interfaz en tres zonas** (ver `DESIGN.md`): barra de módulos, espacio de trabajo y panel "Al aire" con monitor y mandos. Adaptada a celular (vertical y horizontal), tableta y escritorio.
- Módulos: `system`, `bible`, `projection`, `order`, `media`, `tv`. En la interfaz: Orden, Biblia, Comparador, Medios y Ajustes; Himnario y Diapositivas aparecen atenuados como previstos. Televisores existe pero está fuera de la barra (en pausa).
- **Versión 2 en construcción**, por fases, según `docs/PLAN.md`. Hechas las fases 0 (cimientos), 1 (búsqueda), 2 (comparador) y 4 (imágenes). La 3 (televisores) está construida pero **en pausa por decisión del dueño**: no logró que su televisor mostrara la proyección.
- **Carpeta de la iglesia**: todo lo que pone cada iglesia va en `Contenido/` (`Biblias/`, `Himnario/videos/`, `Himnario/letras/`), con un `LEEME.txt` por carpeta. Nada de ahí se publica, salvo las instrucciones y la Reina-Valera 1909.
- Roles por dispositivo: control completo, control del orden (solo operar), pantalla de proyección. PIN para los de control (el equipo principal no lo necesita).
- **Logo e identidad**: el logo del dueño, en vector, integrado en la interfaz, los iconos del sistema y la pestaña del navegador. La versión se muestra junto al logo y sale de `package.json`.
- **Biblia**: pasajes recientes, rejilla de libros, capítulos, versículos con selección de varios, vista previa en el panel.
- **Búsqueda en la Biblia**: mientras se escribe. Una cita ("jn 3 16") lleva al pasaje. Un texto se busca **solo en la Reina-Valera 1960** (en la versión elegida, si no está instalada) y sale por niveles: frase exacta, todas las palabras y parecidas (otras formas de la palabra y sinónimos bíblicos), con lo encontrado resaltado. El resultado se abre en la versión que esté elegida. Se puede limitar al Antiguo o al Nuevo Testamento. Con el teclado: flechas, Enter para ir al versículo y otro Enter para proyectarlo. El índice se prepara solo al arrancar.
- **Comparador de versiones**: el mismo pasaje en dos versiones, lado a lado o una sobre otra, con la sigla de cada una y el número delante de cada versículo. Se elige como en Biblia, viendo los dos textos junto a cada versículo; se proyecta, se añade al orden como elemento propio (tipo `compare`) y la disposición se cambia también al aire. Si a la segunda versión le falta un versículo, lo dice.
- **Orden del culto** (antes "guion"): elementos con tipo y pasos, secciones, reordenar arrastrando o por menú, cita rápida, miniaturas de los pasos que se despliegan y se recogen con un clic, "todo junto" para pasajes cortos, **nombre propio para cualquier elemento** (el original queda a la vista debajo y se recupera dejando el nombre vacío). Al abrir, la lista se coloca en lo que está al aire. El guion de versiones anteriores se convierte solo.
- **Medios: imágenes** (módulo `media`, tipo `image`): biblioteca con miniaturas; subida desde el equipo, la galería del celular o arrastrando, varias a la vez, con nombre propuesto y avance; reducción en el dispositivo (lado mayor de 2560 px) y miniatura; ajuste a la pantalla elegido sobre dos miniaturas y recordado por imagen; proyección, orden del culto, cambio de nombre y eliminación. Al aire: recuadro de encuadre (arrastrar, rueda, dos dedos, deslizador hasta 5×) que todas las pantallas siguen, y «Vista completa». Las imágenes viven en `data/media/imagenes/`.
- **«Más» en el celular**: con más de cinco módulos, la barra de abajo muestra los cuatro primeros y «Más» abre el resto. Hoy hay cinco y caben todos.
- **Fondos de la proyección** (Ajustes): los seis colores y, a su lado, las imágenes subidas, que se conservan (`data/media/fondos/`, hasta 30); se elige con un toque, se suben con «+» (reducidas en el dispositivo) y se elimina la que está puesta. Elegir un color no borra las imágenes.
- **Actualizar con Manna abierto**: el servidor guarda una huella de su código al arrancar y la compara cada 20 s con lo que hay en disco. Si cambió, avisa en todas las pantallas de control (`system.stale`) y ofrece «Reiniciar ahora» en el equipo principal. Reiniciar cierra y vuelve a abrir solo; las páginas notan que el servidor es otro y se recargan. Pulsar el icono con una copia anterior abierta la cierra y abre la actual.
- **Tipos de contenido** (`app.kind`): `verses`, `compare`, `image` y `testcard`. "Siguiente" recorre los pasos de un elemento y luego el orden. Cada tipo dice cómo se dibuja (`web/core/kinds.js`) y, si los tiene, qué **mandos en vivo** ofrece mientras está al aire; los mandos salen en el panel "Al aire" y en el detalle del elemento en el orden.
- **Imagen de prueba** (Ajustes → Proyector de este equipo): encuadre, barras de color o blanco, con un cronómetro que marca lo mismo en todas las pantallas.
- **Revisión del equipo** (`/requisitos`): al abrirse, Manna comprueba Chrome o Edge, ffmpeg, yt-dlp y PowerPoint. Si falta algo, se abre ahí en vez de en el control y dice qué módulos funcionarán completos y cuáles no; "Instalar por mí" descarga ffmpeg (Windows) y yt-dlp (Windows y Mac) a `data/herramientas/`. **Nada bloquea**: desde ahí se continúa a la app. También está en Ajustes.
- **Aviso por módulo**: al abrir un módulo al que le falta un programa, una franja dice qué no podrá hacer y ofrece instalarlo o ver cómo. Hoy solo lo usa Ajustes (sin Chrome o Edge no se abre sola la proyección en la segunda pantalla).
- **Cimientos para los módulos con medios** (aún sin módulo que los use): archivos servidos por trozos, subida directa a disco con avance, reloj de reproducción compartido, volumen general, tareas en segundo plano con avance y tiempo restante, carpeta temporal que se vacía al abrir y cerrar.
- Biblias desde `Contenido/Biblias/` en formatos `.xmm` y `.xml`, con recarga automática al copiar archivos.
- Proyección con ajuste automático del tamaño, estilos e imagen de fondo propia (en Ajustes).
- Reconexión automática de los dispositivos, con detección de conexiones congeladas y aviso con instrucciones si no vuelve.
- Recuperación de lo que estaba en pantalla si el servidor se reinicia en menos de 15 minutos.
- Confirmación del navegador al cerrar la pestaña de control.
- Dirección con nombre `manna.local` (mDNS propio, sin dependencias) y puerto 80, con el 8000 de reserva. Si hay otro Manna en la red, toma `manna-2.local`.
- Con el puerto 80, Manna atiende **también en el 8000**, para televisores cuyo navegador no abre una dirección sin puerto; "Dispositivos" lo explica en "¿Es un televisor?". Ya no se ofrecen direcciones de adaptadores sin red (`169.254…`).
- **`https` en los mismos puertos**: cada puerto de Manna atiende `http` y `https` a la vez, y con el 80 se abre además el 443. El certificado lo hace Manna la primera vez (`data/certificado/`, válido 825 días, se renueva solo) y no cambia aunque cambie la IP. Si no se puede crear, Manna sigue solo con `http`.
- **Televisores** (módulo `tv`, Samsung): buscar en la red, añadir por dirección, vincular (la clave que entrega el televisor se guarda en `data/televisores.json` y no sale del servidor), abrir y cerrar su navegador, control remoto (teclas, puntero, texto) y escribirle la dirección de la proyección. La tarjeta dice si está encendido, si tiene el navegador abierto, si muestra la proyección y, si llegó a Manna y cortó la conexión segura, qué hacer.
- **Pantalla completa en un televisor**: en la página de proyección, OK o un toque del puntero. Si el televisor abre la proyección tras pedírsela desde Manna, Manna le pulsa OK.
- Paso automático de la dirección numérica al nombre en los dispositivos que lo admiten, y reconexión sola tras un cambio de IP del equipo principal.
- Ventana "Dispositivos" con un solo código QR, la dirección `manna.local` y direcciones alternativas plegadas.
- Instaladores del icono "Manna" para Windows y Mac. Comprueban Node.js (`instalacion/requisitos.html` si falta); el resto lo revisa Manna al abrirse.
- Arranque en segundo plano desde el icono, una sola copia, registro en `data/manna.log` y página de error si no puede abrir.
- Apagado desde Ajustes, solo en el equipo principal.

## Probado y sin probar

| Área | Estado |
| --- | --- |
| Interfaz: Biblia, orden del culto (desplegar, recoger, nombre propio), ajustes, dispositivos, versión junto al logo y permisos del rol "Control del orden" | Probado en Chrome real con `scripts/probar-chrome.mjs` (138 comprobaciones en total) |
| Búsqueda en la Biblia: al escribir, niveles, resaltado, teclado, "ver más", cita, sin resultados | Probado en Chrome real, y con pruebas automáticas del orden, de las marcas y de en qué versión se busca |
| Búsqueda: velocidad y memoria | Con un solo índice (Reina-Valera 1960): unos milisegundos por búsqueda y unos 12 MB. **Sin medir en el equipo Windows de la iglesia** |
| Comparador: elegir versiones, ver las dos junto a cada versículo, vista previa, disposición antes y al aire, "siguiente", versículo que falta en una versión, añadir al orden | Probado en Chrome real con dos versiones de prueba, y con pruebas automáticas del tipo `compare` |
| `http` y `https` en los puertos 80, 443 y 8000 | Probado en el Mac de desarrollo, por la dirección de red, con un cliente que exige un certificado válido y con otro que lo rechaza. **Sin probar en Windows** (puertos 80 y 443 con el Firewall) |
| Medios: subir (dos imágenes, una mayor de lo que se guarda), nombre propuesto, reducción y miniatura, ajuste, proyectar, encuadre al aire con deslizador y arrastre, la misma parte en dos pantallas, vista completa, añadir al orden, renombrar, eliminar | Probado en Chrome real y con pruebas automáticas (reconocer JPG, PNG, WebP y GIF por su contenido, rechazar lo que no es imagen, permisos) |
| Subir, elegir y eliminar imágenes de fondo; conservarlas al reabrir el control | Probado en Chrome real y con pruebas automáticas |
| Actualización con Manna abierto: aviso, «Reiniciar ahora», recarga de la página, relevo al pulsar el icono | Probado con procesos de verdad sobre una copia del programa (`test/arranque.test.js`) y en Chrome real. **Sin probar en Windows** (lanzar la copia nueva sin ventana) ni con el icono de la app de Mac |
| Todos los botones que envían una orden | La prueba en Chrome real comprueba que la interfaz usó, pulsando, **todas** las órdenes y direcciones del servidor, salvo cinco declaradas con su motivo (`UNTOUCHED` en `scripts/probar-chrome.mjs`) |
| Medios desde un **celular real**: elegir de la galería, fotos HEIC de iPhone, acercar con dos dedos | **Sin probar.** El gesto de dos dedos está escrito pero solo se probaron el arrastre, la rueda y el deslizador |
| «Más» en la barra del celular | Probado en Chrome real con tamaño de celular y en la auditoría de pantallas |
| Televisor Samsung real (QN55QN85F): encontrarlo en la red, leer sus datos, vincular, abrir y cerrar el navegador, tecla "Inicio" | **Probado desde Manna con el televisor del dueño** (se comprobó en el propio televisor, por su estado) |
| Subida de imágenes a Medios desde el celular del dueño (2026-10-04) | Falló con «No encontrado» porque el Manna abierto era anterior al módulo. **Corregida la causa; falta que el dueño lo repita** tras reiniciar |
| Televisor real: puntero y texto | El dueño vio que el navegador se abrió y que el puntero **se movió brevemente**; no llegó a la barra de direcciones ni escribió la dirección |
| Televisor real: **abrir la proyección** | **No funciona.** Ni con las órdenes de Manna ni escribiendo la dirección a mano en el televisor (prueba del dueño, 2026-10-04). Sin diagnosticar: en pausa |
| Módulo Televisores en la interfaz: añadir, vincular, abrir, control remoto, panel táctil, escribir la dirección, quitar | Probado en Chrome real contra un televisor de mentira (`scripts/lib/tv-falso.mjs`), y con pruebas automáticas del mando y del módulo |
| Aviso por módulo cuando falta un programa | Probado en Chrome real con el navegador "ausente": aparece en Ajustes, no en Biblia, y se puede cerrar. **El botón de instalar desde el aviso no se probó** (usa la misma orden que la revisión, que sí) |
| Mandos en vivo (imagen de prueba): cambiar de imagen, cronómetro, pausa; en el panel, en el orden y desde "Control del orden" | Probado en Chrome real. **El cronómetro marca lo mismo en dos pantallas** (diferencia de 0,0 s) y coincide con el servidor. Las dos pantallas estaban en el mismo equipo: **sin probar entre dispositivos distintos** |
| Revisión del equipo: aviso de lo que falta y de los módulos afectados, "Instalar por mí" con avance, paso al control sin bloqueo | Probado en Chrome real y por HTTP, **con una descarga simulada** servida en el propio equipo |
| "Instalar por mí" con las **descargas reales** de ffmpeg y yt-dlp | **Sin probar.** Solo se comprobó que las direcciones responden. El camino del `.zip` (ffmpeg en Windows) está probado con un `.zip` simulado en Mac |
| Revisión del equipo en **Windows**: detección de Edge, ffmpeg, yt-dlp y PowerPoint; instalación | **Sin probar** |
| Servidor de archivos: trozos (Range), caché, salir de la carpeta, subida a disco con límite | Probado por HTTP en las pruebas automáticas. Subida probada hasta 21 MB: **sin probar con archivos de varios gigas** |
| Volumen general y salida única de sonido | El valor se guarda y se valida (probado). **No hay nada que suene todavía**: el efecto se probará en la fase 5 |
| Logo: fidelidad del vector frente al arte original | Probado: las formas coinciden en un 98 %. El vector no reproduce las estelas tenues bajo las barras |
| Iconos generados (`.ico`, `.icns`, PNG) | Revisados a la vista en 32, 180 y 400 px. **Sin ver** en el Escritorio de Windows ni en la pantalla de inicio de un celular |
| Adaptación a pantallas: 9 tamaños (celular 360/390/430 vertical, celular horizontal, tableta vertical y horizontal, tableta grande, portátil, escritorio) | Probado con `scripts/auditar-responsive.mjs`: sin desborde, navegación y "Al aire" a la vista, acción principal sin desplazarse, botones de 40 px o más en táctil, títulos largos legibles, mandos en vivo completos en el panel y en el orden, revisión del equipo. **Con emulación de Chrome, no en dispositivos reales** |
| Conversión del guion antiguo al orden del culto | Probado con un guion de ejemplo |
| PIN, permisos por rol, bloqueo por intentos | Probado por API desde la IP de red |
| Lectura y limpieza de las 14 biblias locales | Probado |
| Ventana de kiosco de Chrome: abrir, conectar, cerrar | Probado sobre la pantalla principal |
| Desconexión: servidor caído y reiniciado | Probado: reconecta solo, recupera lo proyectado, la sesión remota sigue válida |
| Desconexión: conexión congelada 33 s | Probado: aviso en unos 30 s, reconecta al reanudar |
| Desconexión: la dirección deja de responder | Probado: aviso con instrucciones, la página no se rompe, reconecta si la dirección vuelve |
| Doble clic sobre un versículo no centrado | Probado: proyecta ese versículo y la lista no se mueve |
| Confirmación al cerrar la pestaña | Probado en Chrome real (`scripts/probar-chrome.mjs`): aparece tras un clic en la página; "cambiar de función" no la pide |
| `manna.local` y puerto 80 en el Mac de desarrollo | Probado: el nombre resuelve, sin puerto; con el 80 ocupado pasa al 8000; al apagar, el nombre desaparece |
| Dos Manna en la misma red | Probado en el mismo equipo: el segundo toma `manna-prueba-2.local` |
| Paso automático de la IP al nombre | Probado en Chrome real (pantalla de inicio y proyección) |
| Cambio de IP con un dispositivo conectado por el nombre | Probado en Chrome real, simulado (el servidor deja una dirección y aparece en otra): reconecta solo a los 59 s, sin recargar, recupera lo proyectado y no vuelve a pedir PIN |
| `manna.local` desde **celulares reales** (iPhone, Android 12+, Android antiguo) | **Sin probar** |
| `manna.local` y puerto 80 con **Windows como servidor** | **Sin probar** |
| Cambio de IP con un **router real** | **Sin probar** (solo simulado) |
| Elección de la dirección recomendada con varias redes | Probado con pruebas automáticas y con direcciones simuladas; **sin probar en un equipo con dos redes reales** |
| Apertura automática en una **segunda pantalla real** | **Sin probar** (el equipo de desarrollo no tiene proyector) |
| Icono en **Mac**: instalador, app en segundo plano, segunda pulsación, registro | Probado en una copia temporal (carpeta con espacios), creando la app fuera de Aplicaciones. **Sin probar** con el proyecto dentro de Documentos, donde macOS pedirá permiso de acceso |
| Apagar Manna (Ajustes) | Probado en Chrome real: confirma, apaga el servidor y muestra la pantalla final; un dispositivo remoto con control completo no puede apagar |
| Fallo de arranque en segundo plano | Probado: escribe `data/error.html` y el registro |
| Icono en **Windows**: `Instalar Manna en Windows.bat` e `instalacion/abrir-windows.bat` | **Sin probar.** Es la primera prueba pendiente en el equipo de la iglesia |
| **Windows**: detección de pantallas y ventana de proyección | **Sin probar** |
| Conexión desde un celular real | Probada por el dueño (vuelve sola al regresar del segundo plano) |

## Problemas conocidos

- **El logo es cian y el acento de la interfaz es ámbar.** Se mantuvo el ámbar porque es lo que se aprobó en la maqueta; el cian aparece solo en el logo. Unificarlos es cambiar tres valores en `web/core/app.css` (pendiente de que el dueño lo decida).
- El nombre "MANNA" del logotipo se compone con la tipografía de la app (Geist, peso 700), no con la del arte original, que no se recibió como archivo.
- Las estelas tenues que el arte original tiene bajo las barras no están en el vector.
- **Manna abierto desde la carpeta de desarrollo**: mientras se programa, el aviso «Manna se actualizó» sale cada vez que cambia el código del servidor. Es correcto (hay que reiniciar para probar lo nuevo), pero si se reinicia a mitad de un cambio puede no abrir; en ese caso sale la página de error de arranque.
- **Televisores: en pausa.** El módulo está fuera de la barra (se abre escribiendo `#televisores` al final de la dirección del control) y hace lo que se comprobó (encontrar, vincular, abrir y cerrar el navegador, teclas), pero **el televisor del dueño no carga la proyección**, tampoco a mano. Falta saber por qué: Manna anota cómo llega cada equipo (`http`, `https` o conexión segura cortada) y la tarjeta del televisor lo muestra; ese dato es el punto de partida al retomarlo. No se trabaja en ello hasta terminar las demás fases.
- Los tipos de elemento futuros (himno, video, diapositivas) tienen icono, color y sitio en la interfaz, pero no existen: no se pueden añadir ni proyectar. Su icono y nombre provisionales están en `web/modules/kinds.js` y se quitan cuando llega cada módulo.
- **ffmpeg y yt-dlp se piden ya, aunque todavía ningún módulo los usa** (llegan en las fases 5 a 7). En un equipo sin ellos, la revisión del equipo aparece en cada arranque hasta instalarlos; se continúa con un clic.
- **Búsqueda sin tildes**: "oró" y "oro", o "creó" y "creo", son la misma palabra para el buscador. Las "parecidas" salen de reglas del español y de una lista de sinónimos (`server/core/search.js`), no de entender el texto: pueden traer alguna palabra que solo se parece. Van siempre al final.
- **Televisor Samsung: lo que su control por red permite y lo que no** (comprobado en el QN55QN85F, 2026-10-04). Permite leer sus datos, abrir y cerrar aplicaciones (el navegador) y hacer de mando (teclas; puntero y texto, sin confirmar). **No permite decirle al navegador qué dirección abrir**: las órdenes para eso que valían en modelos anteriores, este las ignora. Por eso la primera vez hay que llevar el navegador a la dirección de Manna (con el botón que la escribe) y guardarla como página de inicio.
- **El aviso de seguridad del televisor**: el certificado de Manna es propio, así que el navegador avisa y hay que elegir "Avanzado" y "Continuar". No se sabe cada cuánto lo vuelve a preguntar el televisor. No hay forma de evitarlo sin un nombre público en internet, que queda fuera de los límites del proyecto.
- Cambiar de equipo principal, o borrar `data/certificado/`, crea otro certificado: los televisores volverán a avisar una vez.
- El módulo Televisores solo conoce Samsung. Está hecho para añadir otras marcas (`server/modules/tv/samsung.js` es la única parte propia de la marca).
- **Letras del himnario**: están las 613, pero 15 himnos tienen alguna parte de una sola línea, señal de que al copiarlas se perdieron líneas (48, 57, 58, 68, 83, 116, 128, 244, 265, 280, 318, 327, 458, 546 y 590). Hay además erratas sueltas. No afecta a nada hasta la fase 5.
- En el comparador, dos archivos de la misma traducción (por ejemplo, las dos copias de Dios Habla Hoy) aparecen con la misma sigla.
- "Instalar por mí" no existe para ffmpeg en Mac (no hay una descarga oficial única): ahí se instala con Homebrew, y la revisión da la orden.
- La pantalla que suena es la de proyección abierta en el propio equipo principal. Si se abren dos pantallas de proyección en ese equipo, sonarían las dos (se resuelve en la fase 5, cuando haya sonido).
- La imagen de prueba se proyecta desde Ajustes; no tiene botón para añadirla al orden del culto (el servidor lo admite).
- En el orden del culto cada versículo es un paso. Un pasaje se puede mostrar entero ("Todo junto") solo si tiene entre 2 y 6 versículos, y hay que elegirlo en sus miniaturas: no se recuerda por elemento.
- Reordenar arrastrando funciona con ratón. En pantallas táctiles se reordena con los botones Subir / Bajar.
- La vista previa `/vista-previa` muestra la app en marcos de celular y tableta, pero el navegador de escritorio no reproduce el teclado en pantalla ni las barras del navegador del celular.
- **Cambio de IP del equipo principal**: los dispositivos que no entienden nombres `.local` (Android anterior a la versión 12) no encuentran solos la dirección nueva; deben volver a escanear el QR y escribir el PIN. Los demás reconectan solos en un minuto aproximadamente; no puede ser más rápido porque el navegador recuerda la dirección anterior durante ese tiempo.
- **El nombre dejó de responder una vez** durante las pruebas, a los pocos minutos de arrancar, sin que el servidor lo notara. No se pudo reproducir ni hallar la causa. Desde entonces el servidor comprueba el nombre cada 10 s y lo rehace si falla (probado dejándolo mudo a propósito). Si reaparece en uso real, los dispositivos siguen pudiendo entrar por la dirección numérica.
- No se ha comprobado si al escribir `manna.local` sin `http://` algún navegador abre una búsqueda en vez de la página. El remedio es escribir `manna.local/`.
- En macOS puede aparecer una vez el permiso "buscar dispositivos en la red local". Si se deniega, el nombre no funciona; la dirección numérica sí.
- En Mac, la app Manna no se añade sola al Dock: hay que arrastrarla desde Aplicaciones.
- Manna abierto desde el icono no tiene ventana: si el botón "Apagar" no está a mano, solo se cierra apagando el equipo o terminando el proceso `node`.
- El equipo principal puede entrar en reposo durante una reunión: Manna no lo impide. Conviene desactivar el reposo en los ajustes de energía.
- La confirmación al cerrar solo aparece si se hizo algún clic en la página (regla de Chrome), y su texto no se puede cambiar.
- Un celular o tableta usado como pantalla de proyección puede apagar su pantalla por inactividad: la función del navegador que lo impide exige HTTPS o `localhost`. No afecta a la ventana del equipo principal.
- Biblia de Jerusalén: la limpieza de títulos es por reglas y deja restos, como las letras hebreas del Salmo 119 ("Alef.").
- Traducción en Lenguaje Actual (`SpanishTLABible.xml`): unos 26.500 versículos frente a unos 31.100 de las demás. No se revisó si une versículos o está incompleta.
- Versiones repetidas en dos formatos (Dios Habla Hoy, Palabra de Dios para Todos) aparecen con "(2)".
- Un navegador tiene una sola sesión: abrir "control completo" y "control del orden" en dos pestañas del mismo navegador hace que la más antigua vuelva a la pantalla de inicio al dar una orden.

## Decisiones tomadas

- **2026-10-03 · Equipo principal: Windows.** El desarrollo sigue en Mac; lo que afecte al arranque o al sistema debe funcionar en Windows.
- **2026-10-03 · Sin compilaciones por ahora.** Node.js y Chrome se aceptan como requisitos del equipo principal. Manna se abre con un icono creado por un instalador sencillo.
- **2026-10-03 · Dirección `manna.local` y puerto 80.** El QR sigue llevando la dirección numérica.
- **2026-10-04 · Rediseño de la interfaz aprobado** sobre una maqueta: tres zonas, módulo Biblia y módulo Orden del culto separados, y sitio previsto para himnario, imágenes, videos y presentaciones. El sistema quedó escrito en `DESIGN.md`.
- **2026-10-04 · "Guion de culto" pasa a llamarse "Orden del culto"** y es donde confluyen todos los módulos, con los elementos diferenciados por tipo.
- **2026-10-04 · "Al aire" en rojo.** El ámbar queda para la selección y la acción principal.
- **2026-10-04 · Tipografía Geist e iconos Phosphor incluidos en el repositorio** (licencias libres, sin internet en uso).
- **2026-10-04 · Los celulares se usan en vertical; las tabletas, también en horizontal.**
- **2026-10-04 · Versión 1.0.0**, con el logo del dueño integrado y la versión visible junto a él.
- **2026-10-04 · Módulos futuros visibles pero atenuados.** El dueño no eligió entre mostrarlos u ocultarlos; se dejaron como en la maqueta aprobada. Para ocultarlos basta quitar las entradas `soon` de `web/modules/registry.js`.
- **2026-10-04 · Plan de la versión 2 aprobado** (`docs/PLAN.md`, sección 6, con las nueve respuestas):
  - Imágenes, videos, audios y YouTube en **un solo módulo "Medios"**.
  - **ffmpeg, yt-dlp y pdf.js aprobados**, con la condición de que la revisión inicial garantice que el equipo tiene todo y siga siendo fácil abrir la app.
  - **PowerPoint por defecto** para las presentaciones, en segundo plano si se puede.
  - **Búsqueda sin modelo de lenguaje**, con índice y velocidad garantizados en Biblia e himnario.
  - **Volumen: solo el de Manna**, como volumen general. No se toca el del equipo.
  - Himnos: la segunda pista es la instrumental; se ofrece **"Cantado / Pista"** antes de proyectar o añadir al orden.
  - Conversión de videos **en segundo plano, con el avance a la vista** en el módulo y en "Al aire". **Subtítulos de YouTube** con mando para activarlos.
  - **Se publica al cerrar cada fase.**
- **2026-10-04 · Ningún programa que falte bloquea el arranque**, tampoco el navegador. Se avisa de qué módulos funcionarán y cuáles no, y cada módulo avisa al abrirlo y ofrece instalar lo que le falta. (Sustituye a lo hecho en la fase 0, donde sin navegador no se entraba.)
- **2026-10-04 · Letras de los himnos: se usan, en local.** El dueño tiene la licencia y las entregó en 13 archivos `.md`; están en `Contenido/Himnario/letras/`, fuera de GitHub. Manna las leerá de ahí (fase 5). Las categorías del himnario se toman de la agrupación de nuevohimnario.com: solo los nombres y qué himnos van en cada una.
- **2026-10-04 · Una sola carpeta para lo de cada iglesia**: `Contenido/`, con las biblias, los himnos en video y las letras.
- **2026-10-04 · La búsqueda de texto se hace solo en la Reina-Valera 1960**, no en todas las versiones. Con filtro por testamento.
- **2026-10-04 · El televisor tiene que funcionar como pantalla remota por su navegador.** Usarlo como segunda pantalla no vale: esa salida es del proyector.
- **2026-10-04 · El himnario se queda después de las fases 3 y 4**, mientras el dueño revisa las letras. Las fases 3 (televisores) y 4 (imágenes) se trabajan a la vez.
- **2026-10-04 · Televisores en pausa.** La prueba remota no pasó de abrir el navegador y mover un poco el puntero, y a mano el televisor tampoco carga la página. Se retoma cuando estén hechas las demás modificaciones.
- **2026-10-04 · El himnario sigue pospuesto**: tras los ajustes de la 1.5.1 se pasa a la fase 6 (videos y audios), que estrena la reproducción.
- **2026-10-04 · La imagen de fondo se elige en Ajustes, no desde Medios** (se usa poco). Lo importante es que las imágenes subidas como fondo se conserven, salgan junto a los colores y se puedan eliminar.
- **2026-10-04 · La biblioteca de imágenes no se agrupa**: de la más reciente a la más antigua, con la hora en que se agregó cada una.
- **2026-10-04 · Televisores fuera de la barra** mientras esté en pausa.
- **2026-10-04 · Informe de cada fase**: muestra de nuevo el plan con las fases superadas y las observaciones, y un apartado de cambios sugeridos (`docs/PLAN.md`, sección 11).

## Decisiones pendientes del dueño

### 0. Sugerencias al plan de la versión 2

En `docs/PLAN.md`, sección 11.

### 1. Instaladores compilados (aplazada)

Propuesta: empaquetar el servidor como aplicación de escritorio con **Electron**. Los dispositivos remotos seguirían entrando por navegador. Aplazada el 2026-10-03: se revisará más adelante si es momento de crear compilaciones.

- Incluye su propio navegador y Node: desaparecen los requisitos de Chrome y Node.js.
- Abre la proyección en la segunda pantalla con funciones nativas, sin Chrome ni `osascript`/PowerShell, y puede impedir que el equipo se duerma.
- Entregables: instalador `.exe` para Windows (puede crear las reglas del Firewall porque se ejecuta como administrador) y `.dmg` para Mac.
- El desarrollo diario no cambia: `node server/index.js` y `npm test`. Electron solo interviene al empaquetar.
- Costes: instaladores de unos 100 MB; añade dependencias de empaquetado (requiere levantar el límite "sin dependencias" para esa parte); el instalador de Windows se compilaría en GitHub Actions; sin certificados de pago, Windows y macOS muestran una advertencia la primera vez.
- Las biblias pasarían a una carpeta visible del usuario (por ejemplo `Documentos/Manna/Biblias`) con un botón para abrirla.

### 2. Otras

- Acento de la interfaz: mantener el ámbar o pasarlo al cian del logo.
- Licencia del repositorio (hoy no tiene ninguna).

## Próximos pasos

- **Fase 6 (Medios: videos y audios, versión 1.6)**, que estrena la reproducción. El himnario (fase 5) va después. El orden completo está en `docs/PLAN.md`.
- Que el dueño repita, tras reiniciar Manna, las dos pruebas que fallaron: subir una imagen a Medios y subir una imagen de fondo, desde el equipo principal y desde el celular.
- **Televisores: al retomarlo**, lo primero es el diagnóstico: con Manna abierto, escribir la dirección en el navegador del televisor y mirar en su tarjeta (módulo Televisores) cómo dice Manna que llegó. Si no llegó de ninguna forma, el problema está antes de Manna (el televisor o la red); si llegó y cortó la conexión segura, es el certificado.
- Que el dueño pruebe Medios desde su celular: subir fotos de la galería y encuadrar con dos dedos.
- **Probar en el equipo Windows de la iglesia**, en este orden: `Instalar Manna en Windows.bat`, abrir con el icono, **revisión del equipo e "Instalar por mí"**, aviso del Firewall, proyección en la segunda pantalla, imagen de prueba, botón "Apagar", y `manna.local` desde un celular.
- El dueño revisa las letras de los himnos (15 con partes incompletas, lista arriba) antes de la fase 5.
- Que el dueño revise la versión para celular y tableta (se hizo sin maqueta previa) y diga qué ajustar.
- Probar `manna.local` desde celulares reales (iPhone, Android 12 o posterior, Android antiguo) y con un router real.

## Entorno de desarrollo

- Carpeta local del proyecto: `Manna/`.
- Node instalado con Homebrew en el Mac de desarrollo. El equipo principal de la iglesia es otro, con Windows.
- `data/` y casi todo `Contenido/` (13 biblias con derechos, 613 himnos en video que ocupan 5,4 GB, y sus letras) existen solo en local; están en `.gitignore`.
- El Mac de desarrollo tiene ffmpeg, yt-dlp y PowerPoint. Para simular un equipo sin ellos: `MANNA_FALTA=ffmpeg,yt-dlp` (ver `.claude/rules/servidor.md`).
