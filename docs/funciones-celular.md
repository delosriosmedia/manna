# Funciones especializadas para el celular

Investigación de la fase 19 de `docs/PLAN.md` (decisión 41), del 2026-10-17. **No cambia la app**: es la propuesta para que el dueño decida. Lo que apruebe entra en el plan como fases nuevas.

El encargo: en vez de entrar desde el teléfono a «Control completo», que en el celular solo haya funciones dedicadas a una necesidad, con pocas cosas en pantalla. Se plantea **desde cero**, sin partir de cómo está repartido hoy, pensando en quién usa cada una, en qué momento del culto y qué errores hay que evitarle.

## 1. De dónde se parte

Hoy el celular entra a las mismas funciones que la computadora. En «Control completo» ve «Historias» (el recuadro de lo que está al aire, los modos, el volumen y lo que sigue), un dock con siete módulos abajo y cada módulo en un cajón que sube. Funciona, pero en un teléfono es mucho:

- **Todo a la vez.** Quien solo pasa el programa ve Biblia, Himnario, Videos, Medios, Páginas web y Ajustes. Cada botón de más es una ocasión de tocar lo que no era, con la iglesia mirando.
- **Dos manos y varios pasos.** Llegar a un versículo es abrir el dock, abrir el cajón, ampliarlo, elegir libro, capítulo y versículo, y proyectar. Con el teléfono en una mano, de pie junto al púlpito, es lento.
- **Nada separa preparar de operar.** Quien sube los anuncios del sábado puede, con la misma función, cambiar lo que está al aire.
- **La misma pantalla para tareas distintas.** El que dirige el canto, el que predica y el que pasa el programa necesitan cosas diferentes y comparten una interfaz pensada para el operador de cabina.

Lo que sí funciona bien y conviene conservar: el recuadro de «Historias» (ver lo que está al aire y pasar tocándolo), el teclado del PIN (grande y que entra solo), el Presentador (pasar y señalar con el dedo), la cola del culto y «Escuchar antes de añadir».

## 2. Cómo se usa el celular en un culto

| Quién | Cuándo | Qué necesita del celular |
| --- | --- | --- |
| Quien dirige el programa (anciano, director de culto, maestro de ceremonias) | Todo el culto | Pasar al siguiente, volver, saber qué viene, poner negro si algo sale mal |
| Quien predica o da el estudio | El sermón, la lección, un devocional | Sacar un versículo al instante, pasar su presentación, señalar algo |
| Quien dirige el canto, el pianista | La alabanza | Poner un himno por su número, cantado o con pista, pausar, el volumen |
| Los departamentos (anuncios, Escuela Sabática, jóvenes, niños) | Días u horas antes | Subir fotos, videos y presentaciones, escribir un texto, ordenarlos en el programa |
| Quienes cantan, tocan o leen al frente | Mientras se proyecta | Ver la letra o el versículo que está al aire sin voltear a la pantalla |
| Quien atiende el sonido | Todo el culto | El volumen y pausar lo que suena |

De ahí sale una idea simple: **en el celular hay dos familias de funciones**.

- **En vivo**: tocan lo que está al aire. Cada una hace un solo trabajo y tiene a mano «Negro».
- **Sin tocar lo que está al aire**: preparar el culto y leer lo que se proyecta. No pueden proyectar nada, así que no hay forma de equivocarse en directo.

## 3. Las funciones propuestas

Seis, más la pantalla de proyección que ya existe. Los nombres son una propuesta.

| Función | Familia | Para quién | Su trabajo | PIN |
| --- | --- | --- | --- | --- |
| **Pasar** | En vivo | Quien dirige el programa | Siguiente, anterior y saltar en el orden del culto | Sí |
| **Púlpito** | En vivo | Quien predica | Versículos al instante y su presentación | Sí |
| **Canto** | En vivo | Quien dirige la alabanza | Himnos por número, pista y volumen | Sí |
| **Sonido** | En vivo | Quien atiende el sonido | Volumen, pausar y silenciar | Sí |
| **Preparar** | Sin tocar el aire | Departamentos y quien arma el programa | Subir, escribir y ordenar el culto | Sí |
| **Atril** | Sin tocar el aire | Quienes cantan, tocan o leen al frente | Leer en grande lo que está al aire | No, en la red de la iglesia |
| Pantalla de proyección | Sin tocar el aire | Un televisor o una pantalla más | Mostrar la proyección | No (ya existe) |

### Lo que comparten todas

Una sola plantilla para las seis, para que quien aprende una sepa usar las demás:

```
┌──────────────────────────────┐
│ Pasar ▾   ● AL AIRE Juan 3:16│  ← franja de estado: la función (▾ cambia a otra) y lo que está al aire, en rojo solo si hay algo
├──────────────────────────────┤
│                              │
│   la zona de trabajo         │  ← una sola tarea; dos pestañas como mucho
│   (lo propio de la función)  │
│                              │
├──────────────────────────────┤
│ [ Negro ]   [  ACCIÓN  ▶  ]  │  ← zona del pulgar: la acción principal grande, «Negro» al lado
└──────────────────────────────┘
```

- **Sin dock ni cajones.** Una pantalla por función; si hace falta otra tarea, se cambia de función desde la franja de arriba (ver la sección 5).
- **Arriba, qué está al aire; abajo, lo que se toca.** Lo que se pulsa vive en el tercio de abajo, al alcance del pulgar. La acción principal mide 56 px de alto y ocupa el ancho; lo demás, 48 px como mínimo.
- **Nada sale al aire con un solo toque accidental.** Tocar algo lo **prepara** (se ve en grande, con su nombre); el botón grande lo **proyecta**. En el celular no hay doble toque para proyectar: se dispara sin querer al desplazar una lista.
- **«Deshacer» unos segundos.** Al proyectar, una barra abajo ofrece «Volver a lo anterior» durante 5 segundos. Si se proyectó lo que no era, un toque lo arregla.
- **«Negro» siempre a un toque** en las funciones en vivo.
- **Letra grande** (17 px de base, 22 a 28 en lo que se lee de lejos), solo modo oscuro, el cian para la acción y el rojo solo para lo que está al aire, como en el resto de Manna.
- **La pantalla no se apaga** mientras la función está abierta (ver «Riesgos»).
- **Un icono por función** en la pantalla de inicio del teléfono: cada voluntario guarda la suya («Manna · Canto») y entra directo, sin elegir cada vez.

### 3.1 Pasar

Para quien dirige el programa. Reemplaza a «Control del orden» y hace mejor lo mismo.

```
┌──────────────────────────────┐
│ ● AL AIRE   Himno 45  2 de 4 │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │                          │ │  ← lo que está al aire, 16:9, borde rojo
│ │   (la proyección)        │ │     solo se mira: tocarlo no pasa
│ └──────────────────────────┘ │
│ ▬▬▬▬ ▬▬▬▬ ▭▭▭▭ ▭▭▭▭          │  ← los pasos (estrofas, versículos, diapositivas)
│                              │
│ SIGUE                        │
│ ┌────┐ Lectura: Salmo 23     │  ← lo que viene, con su miniatura
│ └────┘ Biblia · 6 versículos │
│                              │
│ [ Ver el orden completo ]    │
├──────────────────────────────┤
│ [Negro] [◀]  [ Siguiente ▶ ] │
└──────────────────────────────┘
```

- **Puede:** avanzar y volver (por pasos y por elementos), saltar a cualquier elemento del orden, «Negro» y «Solo fondo», pausar o reanudar lo que suena (un botón grande aparece solo si lo al aire suena) y el volumen (en una hoja que se abre desde ⋯).
- **No puede:** editar el orden, buscar ni elegir nada fuera del orden, ni tocar ajustes.
- **Saltar en el orden:** «Ver el orden completo» abre la lista entera (secciones, lo ya pasado atenuado, lo al aire en rojo). Tocar un elemento lo prepara y muestra «Proyectar este»; no salta solo.
- **Tocar el recuadro no pasa.** En «Historias» tocarlo avanza, pero al sostener el teléfono con una mano se toca sin querer. Aquí solo se pasa con los botones de abajo.
- **Errores que evita:** proyectar lo que no tocaba (siempre se ve qué sigue antes de pulsar), avanzar por rozar la pantalla, perderse en el programa (el número de paso y lo que viene), tocar módulos que no son suyos.

### 3.2 Púlpito

Para quien predica o da un estudio. Dos pestañas: **Pasajes** y, si el sermón tiene una presentación en el orden, **Diapositivas**.

```
Pasajes                              Diapositivas
┌──────────────────────────────┐     ┌──────────────────────────────┐
│ ● AL AIRE  Romanos 8:28      │     │ ● AL AIRE  Diapositiva 4/12  │
├──────────────────────────────┤     ├──────────────────────────────┤
│ [ Pasajes | Diapositivas ]   │     │ [ Pasajes | Diapositivas ]   │
│ ┌──────────────────────────┐ │     │ ┌──────────────────────────┐ │
│ │ Buscar: juan 3 16        │ │     │ │  (diapositiva al aire)   │ │
│ └──────────────────────────┘ │     │ │  tocar = pasar           │ │
│ PARA HOY                     │     │ └──────────────────────────┘ │
│  Romanos 8:28        ● aire  │     │ Sigue ┌────┐  [Señalar]    │
│  Juan 3:16-17                │     │       └────┘                 │
│  Salmo 46:1                  │     │                              │
│                              │     │                              │
│ RESULTADO                    │     │                              │
│  16 Porque de tal manera...  │     │                              │
├──────────────────────────────┤     ├──────────────────────────────┤
│ [Negro]  [ Proyectar Jn 3:16]│     │ [Negro] [◀] [ Siguiente ▶ ]  │
└──────────────────────────────┘     └──────────────────────────────┘
```

- **Pasajes:**
  - Un solo campo que entiende cómo se dice una cita («juan 3 16», «1 cor 13», «sal 23 1-4»), con el teclado de números a mano. Es la búsqueda de citas que Manna ya tiene; aquí va sola y en grande.
  - **«Para hoy»**: lo que se preparó para el sermón (en «Preparar» o en el control, en una sección del orden): pasajes y también citas y textos (fase 18). Un toque lo prepara.
  - Junto a «Proyectar», **«Poner a continuación»**: lo deja como lo siguiente del orden, para que quien usa «Pasar» solo pulse Siguiente. Así el predicador (o quien lo ayuda) no proyecta nada si no quiere.
  - Proyectado un pasaje de varios versículos, el botón grande pasa a «Siguiente versículo».
- **Diapositivas:** la del aire en grande (tocar a la derecha pasa), la que sigue en pequeño y «Señalar» con el dedo. Es el Presentador, reducido a lo esencial. **Se detiene en la última** («Fin de la presentación»): no salta solo a lo que siga en el orden, como el himno final.
- **Puede:** proyectar cualquier pasaje en la versión de la iglesia, pasar su presentación, señalar y «Negro».
- **No puede:** himnos, videos, editar el orden ni ajustes.
- **Errores que evita:** perder tiempo buscando en libro, capítulo y versículo con todos mirando, y proyectar otra versión de la Biblia por error.

### 3.3 Canto

Para quien dirige la alabanza o toca. El himno se pide por su **número**, como se anuncia en la iglesia, en un teclado grande igual al del PIN.

```
┌──────────────────────────────┐
│ ● AL AIRE  Himno 45    1:45  │
├──────────────────────────────┤
│        ┌──────────────┐      │
│        │     045      │      │  ← el número que se escribe
│        └──────────────┘      │
│   Canto de la mañana clara   │  ← el título, para confirmar
│   [ Cantado | Pista ] [Letra]│
│                              │
│    [1]   [2]   [3]           │
│    [4]   [5]   [6]           │  ← teclado grande
│    [7]   [8]   [9]           │
│    [★]   [0]   [⌫]           │
│ HOY: 12 · 45 · 210 · 318     │  ← los himnos del orden, un toque los prepara
├──────────────────────────────┤
│ [Negro]   [ Proyectar 045 ▶] │
└──────────────────────────────┘
```

- Con un himno al aire, la zona de trabajo cambia a sus mandos: pausar en grande, −10 / +10, el avance, cantado o pista y el volumen. «Otro himno» vuelve al teclado.
- **Letras sin música:** el botón «Letra» lo pone como diapositivas que se pasan a mano, con «Siguiente estrofa» en grande.
- ★ abre los favoritos de la iglesia.
- **Puede:** proyectar himnos (cantado, pista o letra), pausar, el volumen, los **audios** (pistas para especiales musicales) y los videos de una categoría de Videos que la iglesia elija («Alabanza»). También «Poner a continuación», como en «Púlpito».
- **No puede:** la Biblia, el resto de videos y medios, editar el orden ni ajustes.
- **Errores que evita:** poner el himno equivocado (el título se ve antes de proyectar), confundir cantado y pista (un botón doble muy visible), saltos de volumen (el volumen de Manna se desvanece).

### 3.4 Sonido

Para quien atiende el sonido, si la iglesia tiene a alguien solo para eso. Es la función más pequeña.

```
┌──────────────────────────────┐
│ ● AL AIRE  Video: Misiones   │
├──────────────────────────────┤
│  Video de misiones           │
│  ▬▬▬▬▬▬▬▬▬▭▭▭▭  1:12 / 3:40  │
│                              │
│        [  ❚❚ Pausar  ]       │
│                              │
│  Volumen de Manna            │
│  ▕████████████▁▁▁▁▏  70 %   │  ← deslizador grande, vertical u horizontal
│                              │
│  [ Silencio ]                │
├──────────────────────────────┤
│ [Negro]                      │
└──────────────────────────────┘
```

- **Puede:** el volumen general, pausar y reanudar, silenciar y «Negro».
- **No puede:** cambiar lo que se proyecta.
- Si la iglesia no tiene a alguien para el sonido, esta función sobra: el volumen ya está en «Pasar» y «Canto». **Decisión del dueño.**

### 3.5 Preparar

Para los departamentos y para quien arma el programa, en los días o las horas antes del culto. **No puede proyectar nada**: entrar en ella durante el culto no cambia lo que se ve.

```
┌──────────────────────────────┐
│ Orden del sábado 26 de oct.  │  ← sin franja roja: aquí nada sale al aire
├──────────────────────────────┤
│ APERTURA                     │
│  ≡ Himno 12 · Cantado     ⋯  │
│  ≡ Bienvenida (imagen)    ⋯  │
│ ANUNCIOS                     │
│  ≡ Campaña de oración  ↑ 72 %│  ← una foto subiéndose
│  ≡ Cita: «La oración es…» ⋯  │
│ MENSAJE                      │
│  ≡ Romanos 8:28           ⋯  │
│                              │
├──────────────────────────────┤
│        [ +  Añadir  ]        │
└──────────────────────────────┘

«Añadir» abre una hoja:
  Foto o imagen (de la galería)    Video (de la galería)
  Enlace de YouTube                Presentación (PDF)
  Texto o cita                     Himno (por número)
  Pasaje bíblico                   Sección
```

- **Puede:** añadir al orden (subiendo lo que haga falta desde el teléfono), escribir textos y citas, cambiar nombres, mover elementos (arrastrando ≡) y quitarlos, y escuchar o ver algo antes en el propio teléfono.
- **No puede:** proyectar, «Negro», mandos en vivo, borrar de la biblioteca ni ajustes.
- **Errores que evita:** cambiar la pantalla sin querer durante el culto, y subir lo mismo dos veces (avisa si ya está). Un video muy pesado lo advierte: es mejor copiarlo en el equipo principal.

### 3.6 Atril

Para quienes están al frente y necesitan leer lo que se proyecta sin voltear: los que cantan, los músicos, quien lee la Biblia, el predicador como monitor de apoyo. **Solo muestra**; no tiene botones de control.

```
┌──────────────────────────────┐
│ ● Himno 45 · estrofa 2 de 4  │
├──────────────────────────────┤
│                              │
│  Cantemos juntos al nacer    │
│  la luz sobre el camino,     │  ← lo que está al aire, en letra muy grande
│  que el día empieza en paz…  │     (texto inventado de ejemplo)
│                              │
│ ─────────────── SIGUE ────── │
│  Y cuando caiga la tarde     │  ← la siguiente parte, en gris
│  seguiremos cantando…        │
│                              │
├──────────────────────────────┤
│        [ A− ]   [ A+ ]       │
└──────────────────────────────┘
```

- Muestra la **letra** del himno o el **versículo** que está al aire y, debajo, lo que sigue. Con una diapositiva o una imagen, la imagen; con un video, su nombre y cuánto falta.
- **No pide PIN** en la red de la iglesia (como la pantalla de proyección) porque no cambia nada; desde internet sí.
- **Errores que evita:** que quien canta o lee se pierda o tenga que mirar atrás.
- Necesita la letra por estrofas, que Manna ya tiene para buscar en el himnario.

## 4. Lo que queda para la computadora y la tableta

**«Control completo» deja de ofrecerse en el celular** y queda para el equipo principal, una computadora o una tableta. Ahí sigue todo: los módulos completos, la Biblia con «Comparar» y «Varios», el Mapa del culto, las Páginas web, las categorías y la biblioteca entera (renombrar, eliminar), el Presentador completo y **Ajustes** (apariencia, proyector, PIN, programas, internet, disco).

Por qué: son tareas de configuración o de cabina que piden una pantalla grande y calma, y son las que más daño hacen si se tocan por error.

**Válvula de escape:** al pie de la pantalla de inicio del celular, un enlace pequeño «Otras funciones (para computadora o tableta)» deja entrar igual, avisando que no está pensado para el teléfono. Así el dueño nunca se queda sin acceso en una emergencia.

## 5. Elegir, cambiar y el PIN

- **Inicio en el celular:** «¿Qué vas a hacer hoy?» con las seis funciones en tarjetas grandes, primero las de en vivo. Manna recuerda la última de ese teléfono y la ofrece arriba («Seguir en Canto»).
- **Icono propio:** dentro de cada función, «Guardar en la pantalla de inicio» explica cómo dejar su icono en el teléfono. Al abrirlo entra directo a esa función (el PIN solo la primera vez, como hoy).
- **Cambiar de función sin salir:** tocar el nombre de la función en la franja de arriba (`Canto ▾`) abre una hoja con las demás. Cambia al instante, sin volver al inicio ni pedir otra vez el PIN, y cada función recuerda dónde se quedó durante el culto. Sirve sobre todo al que lleva solo todo el culto desde su teléfono.
- **PIN:**
  - Propuesta: **un solo PIN para las funciones que tocan algo** (Pasar, Púlpito, Canto, Sonido, Preparar), como hoy, y **ninguno para Atril y la pantalla** en la red de la iglesia. Con voluntarios que rotan, varios PIN acaban en un papel pegado en la pared. Lo que se protege con funciones separadas no es la desconfianza sino el **toque por error**, y eso lo resuelve el servidor: cada función solo puede dar sus órdenes (en «Preparar», proyectar se rechaza).
  - Alternativa para decidir: un **segundo PIN solo para Preparar**, que se puede dar a los departamentos sin que puedan entrar a las funciones en vivo.

## 6. Qué se aprovecha y qué hay que hacer

| Función | Se aprovecha | Hay que hacer |
| --- | --- | --- |
| Plantilla común | El recuadro de «Historias», la franja de estado, los modos, el volumen, `guard()` | La plantilla de una pantalla sin dock, la zona del pulgar, «Deshacer» y mantener la pantalla encendida |
| Pasar | «Control del orden», la cola del culto, los pasos | La pantalla nueva y la lista a pantalla completa con «Proyectar este» |
| Púlpito | La búsqueda de citas de la Biblia, el Presentador, los gestos | Unirlos en una pantalla, «Para hoy» |
| Canto | El himnario, el teclado del PIN, los mandos de lo que suena, favoritos | El teclado de números de himno y la vista de mandos a pantalla completa |
| Sonido | El volumen, los mandos de lo que suena | Una pantalla pequeña |
| Preparar | Las subidas de Medios, Videos y Diapositivas, el orden del culto, Textos (fase 18) | La lista del orden para el dedo (mover arrastrando) y la hoja «Añadir»; un permiso que edita sin proyectar |
| Atril | El estado de lo al aire, la letra por estrofas | La pantalla de lectura y que el servidor dé la parte que sigue |
| Inicio | Las tarjetas de función y el PIN | Mostrar solo las del celular en el teléfono, el icono por función |

En el servidor, cada función nueva es una entrada en `server/roles.js` con sus permisos. Lo único nuevo de fondo es que **Preparar edite sin poder proyectar** (hoy editar el orden y proyectar van juntos en las funciones que editan) y que **Atril** reciba el texto de lo que sigue.

## 7. En qué orden se construiría

1. **Plantilla común e inicio del celular**, con **Atril** (la más sencilla y no toca el aire: sirve para probar la plantilla sin riesgo).
2. **Pasar** (reemplaza a «Control del orden»).
3. **Canto**.
4. **Púlpito**.
5. **Preparar** (con el permiso que edita sin proyectar).
6. **Sonido**, si se aprueba.
7. **Iconos por función** y quitar «Control completo» del celular, con la válvula de escape.

Cada paso sería una fase con sus pruebas en Chrome y en la auditoría de pantallas, y se puede probar en el culto antes de seguir con la siguiente.

## 8. Contraste con una propuesta independiente

Se le pidió a Gemini (otro modelo) la misma investigación, sin ver esta. Llegó a lo mismo en lo esencial:

- Seis funciones en el celular, con nombres parecidos: «Mando del culto» (Pasar), «Himnario y música» (Canto), «Presentador de atril» (las diapositivas de Púlpito), «Biblia y textos» (los pasajes de Púlpito), «Armar el orden» (Preparar) y «Videos e imágenes».
- «Control completo» fuera del celular y Ajustes solo en el equipo principal o la tableta.
- Un solo PIN y una función de preparar que no puede proyectar.
- Tocar para elegir nunca proyecta: siempre hace falta el botón.

Lo que se tomó de su propuesta:

- Que tocar el recuadro de «Pasar» no avance.
- Cambiar de función desde la franja de arriba.
- «Poner a continuación».
- Que la presentación se detenga en la última diapositiva.
- Los audios en «Canto».
- El motivo del PIN único.
- Dos de las decisiones de la sección 9 (varios celulares proyectando y quien lleva solo el culto).

Lo que no se tomó, y por qué:

- **«Videos e imágenes» como función en vivo aparte.** Subir lo de última hora ya está en «Preparar», y con «Poner a continuación» lo proyecta quien pasa el programa. Una función más que también proyecta es otra tarjeta en el inicio y otro teléfono que puede sacar algo al aire.
- **«Comparar» en el celular.** Dos versiones a la vez no se leen bien en un teléfono, y en el púlpito no hace falta. Sigue en la computadora y la tableta.

Lo que trae esta propuesta y la otra no: **Atril** (leer lo que está al aire, sin controles) y **Sonido**.

## 9. Riesgos

- **La pantalla que se apaga.** Mantenerla encendida (la función del navegador que lo hace) pide una conexión segura (`https`), y Manna la ofrece con un certificado propio que el celular avisa como «no seguro». Habría que probar en celulares reales si basta con aceptarlo una vez o si conviene otra salida (pedir que no se bloquee mientras se usa, o un aviso para subir el tiempo de bloqueo).
- **Vibrar al proyectar** solo funciona en Android; en iPhone no hay forma desde el navegador.
- **Memoria del iPhone.** Safari cierra la página si una lista carga muchas imágenes grandes (ya pasó el 2026-10-10 con las miniaturas del orden). «Púlpito», «Preparar» y «Atril» tienen que cargar siempre la imagen pequeña.
- **Dos funciones en vivo a la vez** (Pasar y Púlpito) pueden pisarse: si el predicador saca un versículo, «Pasar» debe mostrarlo al instante como lo al aire y no seguir con el orden a ciegas. El estado compartido ya lo hace; hay que cuidar el mensaje («El predicador proyectó Juan 3:16»).
- **Más funciones que explicar.** Si son demasiadas, el inicio confunde. Por eso «Sonido» es opcional y las tarjetas dicen para quién es cada una.
- **Quitar «Control completo» del celular** puede molestar a quien hoy lo usa así. La válvula de escape lo cubre, pero conviene probarlo un mes antes de quitar el acceso.

## 10. Lo que tiene que decidir el dueño

1. **Las funciones:** ¿estas seis? ¿Sus nombres (Pasar, Púlpito, Canto, Sonido, Preparar, Atril)?
2. **Sonido:** ¿función aparte o basta con el volumen dentro de Pasar y Canto?
3. **«Control completo» en el celular:** ¿se quita con la válvula de escape, se deja como una tarjeta más al final, o se quita del todo?
4. **El PIN:** ¿uno para todas las funciones que tocan algo, o un segundo PIN para Preparar?
5. **Atril sin PIN** en la red de la iglesia: ¿sí?
6. **Canto:** ¿qué categoría de Videos ve (una que se llame «Alabanza», o la que se elija en Ajustes)? ¿Puede añadir himnos a la lista de hoy?
7. **Púlpito:** ¿«Para hoy» sale de una sección del orden del culto («Mensaje») o de una lista propia del predicador?
8. **Preparar:** ¿basta con un solo orden del culto, o hace falta preparar el del sábado siguiente mientras se usa el de hoy? (Hoy Manna tiene un solo orden.)
9. **Las funciones de hoy en la tableta y la computadora** (Servicio de alabanza, Presentador, Control del orden): ¿se quedan como están ahí, o se sustituyen también por las nuevas?
10. **Varios celulares proyectando a la vez:** ¿cualquier función en vivo puede proyectar, o se añade en «Pasar» un interruptor «Solo este teléfono saca al aire; los demás ponen a continuación»?
11. **El que lleva solo todo el culto:** ¿le basta con cambiar de función desde la franja de arriba, o «Pasar» debería tener además una búsqueda rápida de versículos?
12. **El orden de construcción** de la sección 7.
