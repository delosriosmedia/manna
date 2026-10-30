# Pantallas de control desde el celular (fase 40)

Propuesta del 2026-10-29, hecha desde cero a pedido del dueño (decisión 56: sin partir de la propuesta cancelada de la fase 19). **No cambia la app**: lo que el dueño elija entra después como fases nuevas en `docs/PLAN.md`.

Los bocetos están en el lienzo «Pantallas de control» de claude.ai (privado del dueño): <https://claude.ai/artifact/R2NuBEJgcGYQfJrF7JCW9g>. Son 12 alternativas, cuatro por pantalla, y dos detalles comunes. Cada boceto mide 390 × 760, la pantalla útil de un celular con el navegador abierto, y usa los colores, la letra y los iconos de Manna. Aquí se describe cada uno por zonas, de arriba abajo, para que el documento se entienda sin el lienzo.

## 1. Lo que pidió el dueño

- **Control total**: todos los módulos, para añadir al orden o proyectar, y un módulo para manejar lo que está al aire con todos los mandos que hagan falta. Tener todo a la mano pesa más que el tamaño.
- **Alabanza**: Himnario, Medios y Biblia, en ese orden, y antes una vista de control para el momento de alabanza: el orden y lo que suena, todo a la mano.
- **Orador**: Biblia, Medios y Textos, en ese orden, y una vista para moverse por sus diapositivas y pasar a un versículo con facilidad desde el celular.
- En Control total y Alabanza, la prioridad es la vista previa de lo que está al aire, tal cual, comprimida.
- Si hace falta, mejorar también el escritorio.

## 2. Lo que hoy lo impide

Revisado en el código el 2026-10-29:

- En el celular **no hay Anterior ni Siguiente visibles**: solo hay zonas invisibles sobre el recuadro (`escenario.js:311`). Con un módulo abierto dejan de funcionar, porque el fondo oscuro del cajón se come el toque (`shell.js:97`, `shell.css:196`).
- Con un módulo abierto, el cajón **tapa** Solo fondo, Negro, el volumen, «A continuación» y el botón de los mandos (`shell.css:145`, `shell.css:201`).
- Los **mandos de lo que está al aire** están en una hoja aparte, detrás de un icono pequeño (`escenario.js:324`).
- La vista previa del celular **no es «tal cual»**: no dibuja las capas (solo lo hace el equipo principal, `escenario.js:393`) y un video se ve como imagen quieta (`stage.js:17`).
- «A continuación» enseña como mucho 8 elementos, sin secciones, sin lo ya pasado y sin pasos (`escenario.js:347`).
- Alabanza no tiene vista propia, y su Himnario reducido esconde Cantado/Pista, Letra y Favorito.
- El Presentador no llega a la Biblia. Si otro pone un versículo, «Empezar» vuelve a la diapositiva 1, no a donde iba (`presenter.js:40`).
- Al final del orden, Siguiente no hace nada y no lo dice (`order/logic.js:47`).
- Las capas solo se ven y se manejan en Control completo, y las tareas en curso no se ven en el celular.

## 3. Principios comunes

Valen para cualquier alternativa que se elija:

1. **La pantalla de control es la casa.** Se llama «En vivo», es la primera pestaña del dock y se abre al entrar en la función.
2. **Arriba, lo que está al aire tal cual**: la proyección dibujada de verdad, con las capas y el borde rojo. Un video, como su imagen con el avance (ver riesgos).
3. **La franja del pulgar**: Solo fondo, Negro, Anterior y Siguiente, abajo y **en el mismo sitio en las tres funciones**. Quien hace Alabanza un domingo y Orador el otro no reaprende nada.
4. **Ranura de mandos de alto fijo**: lo propio de lo que está al aire va en dos filas que cambian de contenido, nunca de tamaño. Lo raro va en «Más».
5. **Nada importante en hojas que tapan.** Un módulo sube entre la vista previa y la franja del pulgar, sin fondo oscuro, y lo que está al aire y Siguiente siguen vivos (boceto D1).
6. **«Volver a…»**: cuando algo sale del orden o de la presentación, una píldora ofrece volver exactamente donde iba.
7. **«Fin del orden»**: en el último paso, Siguiente lo dice en vez de no responder.
8. **Botones de verdad**: en las pantallas de control se apagan las zonas invisibles de tocar la vista previa, que queda para mirar y, con «Señalar», para señalar.
9. **Pensado para el alto real**: unos 660 px con las barras de Safari y 560 en un Android pequeño. Lo que sobre lo gana la lista del medio. Un manifiesto («Añadir a la pantalla de inicio») da la pantalla entera sin las barras del navegador.

## 4. Las funciones

| Función | Dock | Puede | No debería poder |
| --- | --- | --- | --- |
| Control total | En vivo, Orden, Biblia, Himnario, Medios, Textos y «Más» (Tiempo, Capas, Páginas web; Ajustes solo el administrador) | Todo, como hoy (`*`) | — |
| Alabanza | En vivo, Himnario, Medios, Biblia | Proyectar y manejar lo al aire, editar su orden, favoritos, subir medios; encender y apagar capas (decisión) | Escribir textos, crear relojes, poner o quitar capas, Ajustes |
| Orador completo | En vivo, Biblia, Medios, Textos | Proyectar y manejar lo al aire, subir su presentación, poner y quitar **su** versículo encima | Crear relojes, otras capas, cambiar órdenes ajenos, Ajustes; escribir textos y editar su parte del orden (por defecto) |
| Orador sencillo | Las mismas | Lo mismo: solo cambia su pantalla «En vivo» | Lo mismo |

- **Presentador de diapositivas → pasa a ser Orador completo** (decisiones 69 y 70): conserva el identificador `presentador`, y `/presentador` lleva a `/orador`. **Orador sencillo** es una función nueva, con los mismos permisos.
- **Control del orden → se quita**: su trabajo (pasar sin editar) lo hace la pantalla «En vivo» de Control total. Si hace falta alguien que solo pase, puede ser una opción por usuario («Solo pasar») en lugar de una función más (decisión).

## 5. Control total · «En vivo»

**Elegida (decisión 68): A1 · Consola.**

Al aire en los bocetos: Juan 3:16-17, paso 1 de 2, del orden «Culto del sábado» (8 de 12).

| | Idea | Zonas, de arriba abajo |
| --- | --- | --- |
| **A1 · Consola** | Todo a la vista, en zonas fijas; solo la lista del orden se desliza. | Barra · vista previa · lo al aire y la miniatura de lo que sigue · ranura (Versión, Comparar, Versículos; los pasos del elemento y «Todo junto») · capas y volumen · el orden con lo pasado, lo al aire y lo que sigue · franja del pulgar · dock |
| **A2 · Ahora y sigue** | Como una mesa de video: el monitor grande es lo que sale y el pequeño, lo que pondrá Siguiente. Tocar una tarjeta la prepara. | Barra · vista previa · monitor «Preparado» con su nombre · ranura · capas y volumen · tarjetas de lo que sigue, con imagen · «Todo el orden» y «Lo que pasó» · franja · dock |
| **A3 · Guion** | El orden es la pantalla: lo que está al aire se abre en su sitio con sus pasos y sus mandos. | Barra · vista previa · capas y volumen · el orden con secciones (lo al aire abierto, con sus pasos y su ranura; lo demás con ▶) · franja · dock |
| **A4 · Botonera** | Cada acción es un botón grande en un sitio fijo. Dos filas cambian según lo que está al aire; las demás, nunca. | Barra · vista previa · paso y lo que sigue · botonera (Versión, Comparar, Versículos, Encima; v. 16, v. 17, Juntos, Más; capas 1 a 4; Orden, Buscar, volumen) · franja · dock |

- **Toques**: en las cuatro, Siguiente, Anterior, Negro y Solo fondo cuestan 1. Otro elemento cuesta 2 en A1 (marcar y ▶), A2 (preparar y Siguiente) y A4 (abrir Orden y ▶), y 1 en A3 (▶).
- **Tableta en horizontal**: A1 y A3, dos columnas (la vista y los mandos a la izquierda, el orden a la derecha); A2, los dos monitores lado a lado; A4, la botonera a seis columnas junto a la vista.
- **Para quién**: A1, el operador fijo de cada semana; A2, voluntarios nuevos o iglesias que transmiten; A3, cultos largos y bien preparados; A4, quien opera de pie y con prisa.

## 6. Alabanza · «En vivo»

**Elegida (decisión 70): B1 · Reproductor con la lista de B2** (tablero B5).

Al aire en los bocetos: el himno 1, «Canto de la mañana clara», cantado, en el minuto 1:12 de 3:40.

| | Idea | Zonas, de arriba abajo |
| --- | --- | --- |
| **B1 · Reproductor** | Como un reproductor de música: lo que suena manda. | Barra · vista previa · número y título · Cantado o Pista y Letra · avance con lo que queda · volver al principio, −10, pausa grande, +10, más · volumen grande · los cantos que siguen · franja · dock |
| **B2 · Lista de cantos** | La lista de la alabanza manda: cada canto con su pista elegida y el que suena abierto en su sitio. | Barra · vista previa · la sección de alabanza (el que suena con Cantado o Pista, pausa, saltos y avance; los demás con Cantado o Pista y ▶) · volumen grande · franja · dock |
| **B3 · Letra a la vista** | Para quien dirige y canta: la letra del himno al aire y lo justo para gobernarlo. Con «Letras sin música», sus diapositivas en lugar del texto. | Barra · vista previa · pausa, Cantado o Pista, lo que queda y volumen · avance · la letra por partes · el siguiente canto · franja · dock |
| **B4 · Botonera de cantos** | Cada canto del día es un botón grande; el que suena se va llenando. | Barra · vista previa · seis botones de canto (y «Añadir himno») · pausa, pista y saltos · avance · volumen grande · favoritos · franja · dock |

- **Tableta en horizontal**: la vista y el reproductor a la izquierda, y la lista, la letra o la botonera a la derecha.
- **Para quién**: B1, cantos sobre los videos o las pistas del himnario; B2, equipos que preparan el repertorio; B3, iglesias pequeñas donde quien dirige se opera solo; B4, alabanza espontánea.

## 7. Orador · «En vivo»

**Elegidas (decisión 70): C2 · Pestañas del mensaje para el Orador completo y C4 · Control de bolsillo para el Orador sencillo**, con la hoja «Versículo» (tablero C5).

Al aire en los bocetos: la diapositiva 5 de 12 de «La fe que camina». Versículos del mensaje: Hebreos 11:1 (ya leído), Juan 3:16-17 y Romanos 8:28.

| | Idea | Zonas, de arriba abajo |
| --- | --- | --- |
| **C1 · Dos carriles** | Arriba, sus diapositivas; abajo, la Biblia siempre abierta. | Barra con el tiempo del sermón · vista previa · tira de diapositivas · Señalar, Mover, Volver · la cita, con «Encima» y ▶ · los versículos del mensaje · su texto · franja · dock |
| **C2 · Pestañas del mensaje** | Todo su material en tres pestañas: Diapositivas, Versículos y Textos. | Barra · vista previa · pestañas · (en Versículos) otra cita y cada versículo con su texto, «Encima de la diapositiva» y «Proyectar» · por dónde va la presentación · franja · dock |
| **C3 · Bosquejo** | Su parte del orden es la pantalla; Siguiente la recorre entera. | Barra · vista previa · «Mi parte»: lo ya leído, la presentación abierta en sus diapositivas, lo que sigue con ▶ · «+ Versículo», Volver, Señalar · franja · dock |
| **C4 · Control de bolsillo** | El celular como control remoto: casi toda la pantalla es Siguiente. | Barra · vista previa · por cuál va y la que sigue · Anterior y Siguiente enormes · Versículo, Volver, Todas, Solo fondo, Negro · dock |

- **Pasar a un versículo y volver** (boceto D2): el versículo **tapa** la diapositiva en una capa, sin quitarla. La presentación se queda donde estaba, también con DeckCraft. Siguiente pasa los versículos y «Volver a la diapositiva 5» quita la capa. La otra forma, **proyectarlo** en lugar de la diapositiva, también se ofrece; entonces «Volver» la vuelve a poner en la 5.
- **Para quién**: C1, predicadores que leen la Biblia a menudo; C2, mensajes con muchas citas y textos; C3, predicadores que preparan con tiempo (desde casa o con «Citas de un texto o documento»); C4, predicadores que caminan y no miran el celular.

## 8. Tamaños: del teléfono más pequeño hacia arriba

**Regla del dueño (decisión 70)**: se resuelve para el teléfono de menor resolución, y las listas mandan; en uno mejor se ve mejor. La medida es un teléfono de 360 × 640, el más pequeño de la auditoría, con las barras del navegador (unos 80 px) ya descontadas.

Las medidas y todas las reglas están en `DESIGN.md`, sección 12 ter (decisión 72); su origen, en `docs/auditoria-bocetos-moviles.md`. Mandan los tableros de la página «Aprobados» del lienzo; los de «Historial» (A1, B5, C2, C4, H1 a H4…) conservan medidas anteriores.

| Dispositivo y ventana | Disposición | Tableros |
| --- | --- | --- |
| **Móvil, de pie, menos de 600 px de ancho** (mínimo 360 × 560) | Teléfono: la vista arriba, los mandos debajo, y abajo la franja del pulgar y el dock | T1, T3, T5, T7 y T9 |
| **Móvil, acostado, menos de 480 px de alto** (mínimo 640 × 280) | Teléfono: el dock a la izquierda; la vista con «Solo fondo» y «Negro» bajo el pulgar izquierdo; los mandos, la lista, Anterior y Siguiente bajo el derecho | T2, T4, T6, T8 y T10 |
| **Móvil, de pie, 600 px de ancho o más** (mínimo 600 × 880) | Tableta: la de teléfono de pie, con más sitio | U1 a U4 |
| **Móvil, acostado, 480 px de alto o más** (mínimo 960 × 520) | Tableta: la de teléfono acostado, con más sitio; el orden entero a la derecha y lo marcado con su botón | U5 a U8 |
| **Computador, desde 860 px de ancho** | Sigue el Escenario, con «En vivo» como panel derecho | — |

**Un dispositivo móvil nunca ve la versión de computador (decisión 71).** Móvil es `pointer: coarse`, un iPad aunque tenga teclado o ratón, o un Android; el equipo principal es siempre computador. Se mira el lado corto de la ventana, así que girar el dispositivo no cambia de familia. Los dos límites son distintos porque, acostado, las barras del navegador se comen la altura: una tableta de 7 pulgadas (600 px) deja unos 520, y el teléfono más grande no pasa de unos 430.

Lo que cedió cada pantalla al bajar de tamaño:

- **Control total**: sale la línea «Sigue: …», que ya dicen Siguiente y la lista. El orden deja ver más de tres filas (116 px; antes, 54) y se desliza; entero, en «Orden». Las capas muestran su cuenta y su nombre corto. Acostado, el volumen sube a la barra.
- **Alabanza**: el título queda solo en la barra de arriba, el tiempo que queda va junto al avance (de 20 a 15 px) y el transporte comparte fila con el volumen. La lista deja ver más de tres filas (115 px; antes, 65).
- **Orador completo**: cada versículo es una fila con su «Encima», y su texto entero sale al tocarla; caben casi cuatro (151 px; antes, 130). «5 de 12» pasa a la barra y Señalar, a la fila de pestañas.
- **Orador sencillo**: no tiene lista; lo que ceden los demás botones se lo lleva Siguiente.
- **La hoja «Versículo»**: de pie caben los números de siempre (tres por cuatro) sin perder la vista; acostado van en dos filas de seis.

**Hallazgo**: en estos tamaños, el teclado del celular tapa casi toda la pantalla (acostado, deja unos 80 px). Por eso «Otra cita» abre el teclado de números propio también en el Orador completo.

**Sin probar en un teléfono de verdad**: los tableros miden lo que debería caber, con letras y botones reales; las barras del navegador cambian según el teléfono.

## 9. Lo que encontró la revisión

Cuatro revisores (Opus) miraron las capturas y el código: uno por pantalla y otro de viabilidad.

| Pantalla | Orden de la revisión | Lo que recomienda |
| --- | --- | --- |
| Control total | A1 > A3 > A4 > A2 | A1 de base, con los pasos del elemento de A3 (v. 16, v. 17, Todo junto), la línea «Sigue: v. 17, luego 9 · Romanos 8:28» de A4 y, en la tableta, el «Preparado» de A2 con su propio botón |
| Alabanza | B1 > B2 > B4 > B3 | B1 de base, con la lista de B2 (la pista de cada canto, cuando exista la orden nueva), una tira de diapositivas tocables para «Letras sin música» y la letra de B3 detrás de «Letra» |
| Orador | C1 > C3 > C2 > C4 | C1 de base, con el versículo siempre encima (D2) y el teclado de números de C4 para las citas no previstas |

Ya corregido en los bocetos tras la revisión: Solo fondo y Negro llevan su nombre y van apartados de Anterior; «Siguiente» dice qué va a poner; todo lo que se toca mide 38 px; en A1 y A4 la fila de versículos solo lleva los pasos del elemento (los demás versículos sacaban del orden sin avisar); «Sigue» solo marca lo que pone Siguiente; y en C1 y C2 el versículo se pone con una sola acción, «Poner encima», en lugar de un interruptor escondido.

Lo que falta en todas las alternativas, y conviene resolver antes de construir:

- **La ranura de mandos de cada tipo.** Los bocetos solo la dibujan para la Biblia y el himno. Con dos filas de 38 px a 366 px no caben un himno entero (Cantado/Pista/Letra, transporte y avance), un video con subtítulos ni una diapositiva con su encuadre: lo que no quepa va a un «Más» fijo, ordenado con las prioridades que ya existen (`shell.css`).
- **Cuando un canto termina**, la proyección pasa sola a «Solo fondo»: la pantalla debe ofrecer «Otra vez» y «Siguiente: …». Negro y Solo fondo **pausan la música y no la reanudan** al volver al aire.
- **Con «Letras sin música»**, Siguiente nunca sale del himno: hace falta la tira de sus diapositivas para repetir un coro, y decirlo en el botón.
- **Lo proyectado fuera del orden** (un versículo improvisado, algo de un módulo) no tiene fila: hace falta la píldora «Volver al orden: …».
- **Celular prestado**: la sesión con PIN dura un año en ese navegador (`sessions.js:153`). Se propone que caduque al día siguiente y un «Salir» a la vista.

## 10. Lo que haría falta nuevo

Ninguna alternativa se construye solo con la interfaz. La revisión de viabilidad encontró, contra el código:

- **Versículo encima (D2).** Hoy una capa sigue visible con Negro y Solo fondo, se guarda y vuelve al reiniciar, y no tiene pasos: Siguiente pasaría la diapositiva escondida (con DeckCraft, a escondidas). Haría falta una **capa momentánea del orador**, aparte de las 4 de Control total, que no se guarde, se quite sola cuando cambie lo que está al aire, obedezca a Negro y Solo fondo y avance sus propios versículos. Tampoco puede depender del módulo Capas, que el superadministrador puede apagar por iglesia.
- **«Volver a la diapositiva 5»**: nada recuerda lo anterior. Haría falta que el servidor guarde lo que estaba al aire antes y solo vuelva si nadie lo cambió (`projection.back`).
- **Siguiente sin pasos dobles**: que diga desde qué está al aire y el servidor ignore el segundo toque (`projection.step` con el `uid`).
- **«Sigue» que no mienta**: hoy solo el servidor sabe qué pondrá Siguiente (una animación de DeckCraft, la portada del himno). Haría falta que lo publique.
- **La pista de un canto antes de que salga** (B2): ninguna orden cambia hoy el `data` de un elemento del orden (`order.setTrack`).
- **Permisos por permiso, no por nombre**: la interfaz decide hoy por el nombre de la función (`ctx.canEdit`, `shell.js:32`). Un Orador nuevo no tendría «Añadir al orden» ni las capas aunque se le dieran. Y un permiso propio para encender y apagar capas.
- **Mover los usuarios de función**: si se quitan «presentador» u «orden», quienes las tienen las pierden sin aviso (`users.js:25`). Conviene conservar los identificadores y cambiar solo el nombre que se ve.
- **Las partes del orden**: el orden no sabe qué sección es de la alabanza o del orador, ni qué versículo ya se leyó. B2, C3 y «ya se leyó» lo necesitan.

## 11. Riesgos

- **La pantalla del celular se apaga a mitad del sermón.** Los celulares entran por `http`, donde el navegador no deja mantenerla encendida (Wake Lock). Opciones: un video mudo en bucle mientras «En vivo» está abierta (hecho a mano, sin librería; falta probarlo en un iPhone) o enseñar a abrir el `https` propio de Manna, con su aviso de certificado.
- **«Tal cual» tiene excepciones.** Dibujar las capas en el celular es barato (son texto). Un video en movimiento costaría unos 6 Mbps por celular sobre el wifi de la iglesia, y los himnos de la nube irían a internet: se propone su imagen con el avance. Las animaciones de DeckCraft y PowerPoint, una página web o una pestaña compartida se ven como imagen o tarjeta: la vista previa debe decirlo.
- **El alto real.** Con las barras de Safari quedan unos 660 px, y en un Android pequeño unos 560. Hay que dibujar cada alternativa también a 375 × 600 y 360 × 560 y fijar qué se pliega primero.
- **Dos o tres operadores a la vez**: pasos dobles, «Volver» que pisa lo que otro puso y capas sin dueño.
- **El teclado del celular** tapa media pantalla al escribir una cita: la vista previa se pliega mientras tanto (o el teclado de números de C4).
- **Alcance**: tres pantallas nuevas en varios tamaños, más la auditoría y las pruebas en Chrome de cada una. Conviene empezar por los principios comunes, que mejoran ya las funciones de hoy.

## 12. Decisiones del dueño

**Tomada el 2026-10-29 (decisión 68):**

1. **Una alternativa por pantalla**: **A1 · Consola** para Control total, **B1 · Reproductor** para Alabanza y **C1 · Dos carriles** para Orador, las que recomendó la revisión, con lo que tomó de las demás (sección 9): en A1, los pasos del elemento de A3 y la línea «Sigue: …, luego …» de A4; en B1, la lista de B2 y una tira de diapositivas para «Letras sin música»; en C1, el versículo encima (D2) y el teclado de números de C4.

**Tomadas el 2026-10-30 (decisión 69):** Presentador pasa a Orador y se quita Control del orden; el versículo del orador va encima, en una capa propia y momentánea; la pantalla del celular se mantiene encendida con un video mudo en bucle; y la vista previa del celular muestra el video en movimiento, sin sonido (con una copia de vista previa de baja resolución, para no cargar el wifi).

**Tomadas el 2026-10-30 (decisión 70):** el Orador pasa a dos funciones, Orador completo (C2) y Orador sencillo (C4); Alabanza es B1 con la lista de B2; y cada pantalla se resuelve primero para el teléfono de menor resolución, de pie y acostado, con las listas por encima de los mandos (sección 8). Cambia lo elegido en la decisión 68 para esas pantallas.

**Tomada el 2026-10-30 (decisión 72):** principios y reglas de móviles para todo Manna, tras auditar los bocetos: `DESIGN.md`, sección 12 ter. El reloj de los oradores es la hora del equipo principal.

**Tomada el 2026-10-30 (decisión 71):** un dispositivo móvil nunca ve la versión de computador; los límites, en la sección 8.

El plan está en `docs/PLAN.md`, fases 42 a 48, con una opción por defecto para cada pregunta que sigue abierta.

**Pendientes** (con la opción por defecto en el plan):
- ¿«Solo pasar» como opción por usuario, en lugar de la función Control del orden que se quita?
- Alabanza: ¿ve y apaga capas? ¿Edita el orden y sube medios, como hoy?
- Oradores: ¿escriben sus textos? ¿Editan su parte del orden?
- Con un versículo encima, ¿Siguiente pasa los versículos o la presentación? ¿Y si lo pulsa Control total desde otro celular?
- Con varios operadores, ¿manda Control total sobre los demás? ¿Se ve quién hizo el último cambio?
- Elegir otro versículo desde los mandos: ¿sigue en el orden o puede sacar de él (avisando)?
- ¿Se apagan las zonas invisibles de tocar la vista previa, para que solo se mire y se señale?
- ¿Acepta que «tal cual» tenga excepciones (animaciones, páginas web, pestaña compartida), dichas en la vista previa?
- ¿Cómo se marca en el orden la parte de la alabanza y la del orador?
- ¿Qué hace Siguiente con la pantalla en Negro: muestra lo que sigue o avanza a oscuras?
- Celular prestado: ¿la sesión con PIN caduca al día siguiente?
- Computador: ¿sigue el Escenario con «En vivo» como panel derecho? ¿Va primera aunque la iglesia ordene los módulos?
- ¿Siguiente siempre a la derecha, o una opción para zurdos?
- Nombres: «Control total», «Alabanza», «Orador completo», «Orador sencillo» y, para la pantalla, «En vivo».

## 13. Cómo se hizo

- Inventario de lo que hay hoy: cuatro lectores (Sonnet) sobre el código, uno por zona.
- Una propuesta de contraste independiente (Opus), hecha sin ver esta: coincidió en lo esencial (los mismos tipos de distribución en cada pantalla). De ella se tomaron la franja del pulgar común, la ranura de alto fijo, «Volver a…», «Fin del orden», el módulo entre la vista y la franja, diseñar para el alto real y el Siguiente que no pasa dos veces.
- Los bocetos, en el lienzo, revisados a tamaño real en Chrome.
- Una revisión crítica (Opus): una por pantalla y otra de viabilidad contra el código (sección 9 y 10).
