# Funciones especializadas para el celular

Investigación de la fase 19 de `docs/PLAN.md` (decisión 41), del 2026-10-17. **No cambia la app**: es la propuesta para que el dueño decida. Lo que apruebe entra en el plan como fases nuevas.

**Simulación visual**: `docs/funciones-celular.html` muestra cada función en un teléfono que se puede tocar (ábrelo en el navegador), con lo que puede y no puede al lado y la tabla que las compara.

**Segunda versión (2026-10-17).** El dueño vio algunas funciones demasiado simples. Cada una recibió lo que le faltaba, sin volverse un control total: lo de cada momento, a la vista; lo de vez en cuando, en una hoja que sube desde abajo. Lo marcado **(nuevo)** Manna aún no lo hace; todo lo demás ya existe en otra pantalla y se reutiliza.

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
- **Lo de siempre a la vista, lo demás a un toque.** Lo que se usa en cada momento está en la pantalla; lo de vez en cuando (el orden completo, buscar, avisar, todas las diapositivas) sube en una hoja desde abajo y se cierra tocando fuera.
- **Se avisan entre ellas** (nuevo). «Poner a continuación» le llega a Pasar con quién lo puso; la estrofa que marca Canto, los avisos al frente («Repetir el coro») y el cronómetro del sermón, a Atril. Nunca salen en la proyección.
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
│ Pasar ▾  ● AL AIRE Himno 12  │
├──────────────────────────────┤
│ 11:24 · culto 38 min  faltan 2:05│  ← la hora, el tiempo del culto y lo que falta de lo que suena
│ ┌──────────────────────────┐ │
│ │   (la proyección)        │ │  ← lo que está al aire, 16:9, borde rojo; solo se mira
│ └──────────────────────────┘ │
│ ▬▬▬▬ ▬▬▬▬ ▭▭▭▭ ▭▭▭▭          │  ← los pasos; tocar uno lo prepara
│ [0:00][−10][❚❚][+10][Vol]    │  ← los mandos de lo que está al aire, según lo que sea
│ SIGUE · puesto por Púlpito   │
│ ┌────┐ Romanos 8:28  [Quitar]│  ← lo que viene, con quién lo puso o la nota de Preparar
│ [Orden] [Buscar] [Avisar]    │  ← hojas que suben desde abajo
├──────────────────────────────┤
│ [Negro] [◀]  [ Siguiente ▶ ] │
└──────────────────────────────┘
```

- **Puede, a la vista:**
  - Ver lo que está al aire, en qué paso va (2 de 4) y lo que sigue.
  - Siguiente y Anterior: los pasos (versículos, diapositivas) y luego los elementos del orden.
  - Tocar un paso de la barra para ir directo a ese versículo o diapositiva.
  - Los mandos de lo que está al aire, según lo que sea: pausa, −10 y +10, desde el principio, subtítulos, Cantado o Pista, Completa o Llenar (los mismos de la barra de abajo de hoy).
  - La hora, cuánto lleva el culto y cuánto falta de lo que suena (nuevo).
  - Lo que otra función dejó a continuación («puesto por Púlpito»), con «Quitar» si ya no hace falta (nuevo).
  - La nota que dejó Preparar en lo que sigue («Esperar a que el pastor lo anuncie») (nuevo).
  - «Negro», «Solo fondo» y deshacer 5 segundos.
- **Puede, a un toque:**
  - El orden completo: preparar cualquier elemento y «Proyectar este».
  - «A continuación»: mover lo que falta (el especial antes de los anuncios) (nuevo: hoy mover pide el permiso de editar el orden).
  - La lupa («Buscar en todo») para lo que no estaba en el programa: lo prepara, y se proyecta o queda a continuación.
  - Avisar al frente: «Un momento», «Alargar un poco», «Repetir el coro», «Última estrofa», «Terminar» (nuevo).
  - El volumen de Manna y «Silencio».
- **No puede:**
  - Añadir, quitar o renombrar elementos del orden, ni subir archivos.
  - Acercar, mover o señalar sobre lo que está al aire (eso es de Púlpito).
  - Pasar tocando la imagen: solo con los botones de abajo.
  - Escribir avisos: solo los de la lista.
  - Ajustes, PIN, programas ni apagar.
- **Tocar el recuadro no pasa.** En «Historias» tocarlo avanza, pero al sostener el teléfono con una mano se toca sin querer. Aquí solo se pasa con los botones de abajo.
- **Con algo de fuera al aire** (un versículo de Púlpito, un himno de Canto), «Sigue» dice qué hará «Siguiente»: el versículo siguiente, la estrofa siguiente o volver al orden.
- **Errores que evita:** proyectar lo que no tocaba (siempre se ve qué sigue y quién lo puso ahí), avanzar por rozar la pantalla, que el especial se pierda porque cambió de sitio, tocar módulos que no son suyos.

### 3.2 Púlpito

Para quien predica o da un estudio. Arriba, su cronómetro; debajo, dos pestañas: **Pasajes** y **Diapositivas**.

```
Pasajes                              Diapositivas
┌──────────────────────────────┐     ┌──────────────────────────────┐
│ Púlpito ▾ ● AL AIRE Rom 8:28 │     │ Púlpito ▾ ● AL AIRE Diap. 4  │
├──────────────────────────────┤     ├──────────────────────────────┤
│ MI TIEMPO 18:20 de 30 [Pausar]│    │ MI TIEMPO 18:20 de 30 [Pausar]│
│ [ Pasajes | Diapositivas ]   │     │ [ Pasajes | Diapositivas ]   │
│ ( juan 3 16               )  │     │ ┌──────────────────────────┐ │
│ PARA HOY · sección Mensaje   │     │ │  (diapositiva al aire)   │ │
│  Juan 3:16-17 · Romanos 8:28 │     │ │  tocar = pasar           │ │
│  Cita · Mapa de Galilea      │     │ └──────────────────────────┘ │
│ RECIENTES Salmo 23 · Isa 40  │     │ [Señalar][Acercar][Todas]    │
│ Juan 3:16-17  [RV60·Comparar]│     │ Sigue: diapositiva 5 · 8 más │
│  16 (texto)  17 (texto)      │     │                              │
├──────────────────────────────┤     ├──────────────────────────────┤
│ [A continuación] [Solo fondo]│     │ [Negro] [◀] [ Siguiente ▶ ]  │
│ [Negro] [ Proyectar Jn 3:16 ]│     │                              │
└──────────────────────────────┘     └──────────────────────────────┘
```

- **Puede, a la vista:**
  - Escribir la cita como se dice («juan 3 16», «sal 23 1-4») o unas palabras, que se buscan en la RV1960, como en la Biblia de hoy.
  - «Para hoy»: lo de la sección del sermón en el orden (pasajes, citas, una imagen, un video corto o una página de Canva).
  - Recientes: volver al texto base con un toque.
  - El pasaje entero en su teléfono antes de proyectarlo; tocar un versículo empieza desde ahí.
  - Al aire, versículo a versículo, y seguir leyendo el capítulo después de la cita.
  - Diapositivas: pasar (con los botones o tocando la diapositiva), ver la siguiente y cuántas quedan, señalar, acercar.
  - Mi tiempo: cronómetro del sermón con el tiempo asignado; vibra a 5 minutos y al terminar (Android) y se ve en grande en Atril (nuevo).
  - «Negro», «Solo fondo» y deshacer 5 segundos.
- **Puede, a un toque:**
  - Todas las diapositivas en cuadrícula, para saltar a la conclusión.
  - Comparar: el mismo pasaje en otra versión, al lado de la de la iglesia.
  - «Poner a continuación», para que quien usa Pasar solo pulse Siguiente. Así el predicador (o quien lo ayuda) no proyecta nada si no quiere.
- **No puede:**
  - Himnos, ni videos, imágenes o páginas que no estén en su sección.
  - Cambiar la versión de la iglesia (comparar, sí).
  - Editar el orden (salvo «Poner a continuación»).
  - Pasar de su última diapositiva a lo siguiente del orden: se detiene en «Fin de la presentación».
  - El volumen ni los ajustes.
- **Errores que evita:** buscar libro, capítulo y versículo con todos mirando; proyectar otra versión por error (la de la iglesia va siempre primero); saltar al himno final al pasarse de la última diapositiva; pasarse del tiempo sin darse cuenta.

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

- Con un himno al aire, la zona de trabajo cambia a sus mandos: Cantado o Pista, el avance, 0:00, −10 y +10, el volumen, la estrofa que se canta, «Terminar» y «Otro himno»; abajo, «Negro» y «Pausar» en grande.
- **Letras sin música:** el botón «Letra» lo pone como diapositivas; abajo, «Siguiente» en grande, y arriba una tira con todas (portada, estrofa 1, 2…) para repetir el coro o saltar.
- ★ abre los favoritos de la iglesia.
- **Puede, a la vista:**
  - El número en un teclado grande, con el título antes de proyectar.
  - Cantado, Pista o Letra (sin música).
  - «Hoy» (los himnos del orden) y los favoritos ★, que también marca y quita.
  - Al aire: pausa, −10 y +10, desde el principio, el avance y cambiar Cantado o Pista sin perder el punto.
  - Letra sin música: las diapositivas del himno en una tira; tocar una repite el coro o salta a la última.
  - Marcar la estrofa que se canta («la 2», «Coro»): se resalta en Atril para los del frente (nuevo).
  - «Terminar»: el sonido se desvanece y queda el fondo (es «Solo fondo»).
  - El volumen de Manna y «Negro».
- **Puede, a un toque:**
  - Buscar por título, por un trozo de la letra o por categoría.
  - La letra completa en su teléfono mientras suena.
  - Escuchar antes, solo en su teléfono, con audífonos.
  - Añadir a «Hoy» (al final de la alabanza en el orden) o «Poner a continuación».
  - Avisar al frente: «Repetir el coro», «Última estrofa», «Más despacio», «Un momento» (nuevo).
  - Los **audios** (pistas para especiales musicales) y los videos de la categoría de Videos que la iglesia elija («Alabanza»).
- **No puede:**
  - La Biblia, imágenes, diapositivas ni páginas web.
  - Videos fuera de su categoría.
  - Quitar o mover elementos del orden.
  - Subir archivos ni ajustes.
- **Errores que evita:** poner el himno equivocado (el título se ve antes de proyectar), confundir cantado y pista (un botón doble muy visible), que los músicos se pierdan cuando se repite el coro (lo ven marcado en Atril).

### 3.4 Sonido

Para quien atiende el sonido, si la iglesia tiene a alguien solo para eso. Ve todo lo que suena y lo que va a sonar, pero no cambia lo que se proyecta.

```
┌──────────────────────────────┐
│ Sonido ▾ ● AL AIRE Video     │
├──────────────────────────────┤
│ ● Suena por la ventana de proyección del equipo principal
│ SUENA AHORA                  │
│  Informe misionero · video   │
│  ▬▬▬▬▬▬▬▬▬▬▬▬▭  3:32 / 3:40  │
│  faltan 0:08 (en ámbar; vibra)│
│  [0:00] [−10] [+10]          │
│  [ Subtítulos ]              │
│  Volumen de Manna      70 %  │
│  ▕████████████▁▁▁▁▏          │
│  [Silencio] [Bajar poco a poco]│
│ LO QUE VIENE EN EL ORDEN     │
│  Sermón · sin sonido         │
│  Himno 210 · suena · 2:52 [Escuchar]│
│  [Prueba de sonido]          │
├──────────────────────────────┤
│ [Negro]  [   ❚❚ Pausar    ]  │
└──────────────────────────────┘
```

- **Puede, a la vista:**
  - Por dónde sale el sonido (la ventana de proyección o el control del equipo principal) y el aviso si ninguna pantalla puede sonar.
  - Qué suena, cuánto lleva y cuánto falta.
  - Aviso cuando faltan 10 segundos: se pone en ámbar y vibra (Android) (nuevo).
  - Pausa, −10 y +10, desde el principio; Cantado o Pista en un himno; subtítulos en un video.
  - El volumen de Manna, grande, y «Silencio».
  - «Bajar poco a poco»: desvanece en 3 segundos y pausa, para cuando alguien pasa a orar (nuevo).
  - Lo que viene en el orden, con su duración y si suena.
  - «Negro».
- **Puede, a un toque:**
  - Escuchar antes con audífonos lo que viene, para comprobar que no esté mudo.
  - Prueba de sonido antes del culto: un tono o un audio de la biblioteca, sin cambiar la imagen (nuevo).
- **No puede:**
  - Elegir o cambiar lo que se proyecta, ni Siguiente o Anterior.
  - Editar el orden.
  - El volumen del equipo o de la consola (solo el de Manna).
  - Un volumen distinto para cada video.
  - Ajustes.
- **Errores que evita:** que el sonidista cambie la pantalla buscando el volumen; buscar el fallo en la consola cuando el silencio viene de la computadora (lo dice arriba); que un video termine de golpe sin abrir los micrófonos a tiempo.
- Si la iglesia no tiene a alguien para el sonido, esta función sobra: el volumen y los mandos ya están en «Pasar» y «Canto». **Decisión del dueño.**

### 3.5 Preparar

Para los departamentos y para quien arma el programa, en los días o las horas antes del culto, también desde casa (por la conexión por internet, con PIN). **No puede proyectar nada**: entrar en ella durante el culto no cambia lo que se ve. Dos pestañas: **Orden** y **Por revisar**.

```
┌──────────────────────────────┐
│ Preparar ▾   Al aire: Himno 12│  ← sin rojo: aquí nada sale al aire
├──────────────────────────────┤
│ [ Orden | Por revisar · 3 ]  │
│ ORDEN DEL SÁBADO 26  [Empezar desde el anterior]
│ APERTURA                     │
│  ≡ Himno 12 · Cantado     ⋯  │  ← ⋯: cómo va, nota, duplicar, nombre, ver, quitar
│  ≡ Bienvenida (imagen)    ⋯  │
│ ANUNCIOS                     │
│  ≡ Informe misionero      ⋯  │
│    Nota: esperar a que el pastor lo anuncie
│  ≡ Campaña de oración  ↑ 72 %│  ← una foto subiéndose
│ MENSAJE                      │
│  ≡ Sermón (presentación)  ⋯  │
├──────────────────────────────┤
│ [Ensayar]   [ +  Añadir  ]   │
└──────────────────────────────┘

«Añadir» abre una hoja:
  Desde el teléfono: Foto o imagen · Video · Presentación (PDF o PowerPoint) · Texto o cita
  Por enlace: YouTube · Página web (Canva, Kahoot)
  Lo que ya está en Manna: Imagen guardada · Video por categoría · Audio · Texto guardado ·
                           Himno (número, título o letra) · Pasaje (cita o palabras)
  Para ordenar: Sección
```

- **Puede, a la vista:**
  - El orden: añadir, mover arrastrando (≡), renombrar, quitar y crear secciones.
  - El avance de lo que se sube o se descarga (YouTube, conversiones) y «Reintentar» si falla.
  - «Por revisar»: lo que aún no está listo (un video que se convierte, un YouTube que falló, una página que necesita internet) (nuevo; con avisos que Manna ya tiene).
  - Ver en una línea qué está al aire (solo leer).
- **Puede, a un toque:**
  - Subir fotos, videos o una presentación (PDF o PowerPoint) desde el teléfono, o pegar un enlace de YouTube o de una página (Canva, Kahoot).
  - Elegir de la biblioteca lo que ya está: el cartel de siempre, un video por categoría, un audio, un texto guardado.
  - Himnos por número, título o letra; pasajes por cita o por palabras.
  - Dejar decidido cómo va cada cosa: Cantado, Pista o Letra; Completa o Llenar; Comparar; la categoría y los subtítulos de un video.
  - Nota para quien pasa en cualquier elemento (nuevo).
  - Duplicar un elemento (nuevo).
  - Ensayar: recorrer el orden en su teléfono como en el culto, sin proyectar (nuevo).
  - Empezar el orden siguiente desde el anterior: se quedan las secciones y se vacían los elementos (nuevo; ver la decisión 8).
  - Escribir textos y citas con su autor (nuevo permiso: hoy, solo en «Control completo»).
- **No puede:**
  - Proyectar, «Negro», «Solo fondo», Siguiente ni Anterior.
  - Los mandos de lo que está al aire (pausa, volumen).
  - Borrar de la biblioteca (videos, imágenes, presentaciones) ni categorías.
  - Ajustes.
- **Errores que evita:** cambiar la pantalla sin querer durante el culto; descubrir en el culto que el video no terminó de bajar («Por revisar» lo dice antes); subir lo mismo dos veces (avisa si ya está). Un video muy pesado lo advierte: es mejor copiarlo en el equipo principal.

### 3.6 Atril

Para quienes están al frente y necesitan leer lo que se proyecta sin voltear: los que cantan, los músicos, quien lee la Biblia, el predicador como monitor de apoyo. **Solo muestra**; no tiene botones de control.

```
┌──────────────────────────────┐
│ Atril ▾  ● AL AIRE Himno 45  │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ CANTO AVISA              │ │  ← los avisos de Pasar y Canto, en grande
│ │ Repetir el coro          │ │
│ └──────────────────────────┘ │
│ 11:24        sermón 18:20 de 30│ ← la hora y el cronómetro de Púlpito
│ [ Letra | Pantalla ]         │
│ ESTROFA 1 (en gris)          │
│ ┌ CORO ────────────────────┐ │
│ │ Canta, alma, canta ya,   │ │  ← la estrofa que marcó Canto, resaltada
│ │ que la luz no se apaga…  │ │     (texto inventado de ejemplo)
│ └──────────────────────────┘ │
│ ESTROFA 2 (en gris)          │
│ ── SIGUE EN EL ORDEN ─────── │
│  Sermón: El camino de la fe  │
├──────────────────────────────┤
│        [ A− ]   [ A+ ]       │
└──────────────────────────────┘
```

- **Puede, a la vista:**
  - Lo que está al aire, para leer: la letra del himno con sus partes (Estrofa 1, Coro), el pasaje con el versículo al aire resaltado; con un video, cuánto falta; con una diapositiva o una imagen, verla y la que sigue.
  - La estrofa que marca Canto, resaltada, y la pantalla baja sola hasta ella (nuevo).
  - Los avisos de Pasar y Canto, en grande; tocarlo lo quita solo en ese teléfono (nuevo).
  - La hora y, si Púlpito lo usa, el cronómetro del sermón (nuevo).
  - Lo que sigue, en gris.
  - Agrandar o achicar la letra, solo en su teléfono.
- **Puede, a un toque:**
  - «Letra» o «Pantalla»: leer en grande o ver la proyección tal cual.
  - Adelantarse por el himno o el pasaje y volver con «Volver al aire».
  - Acercar con dos dedos una diapositiva, solo en su teléfono (nuevo).
- **No puede:**
  - Nada que cambie la proyección o el orden: ni Siguiente (lo abren varios a la vez y se acomoda en un soporte).
  - No pide PIN en la red de la iglesia, como la pantalla de proyección (desde internet, sí).
- **Errores que evita:** que quien canta o lee se pierda o tenga que mirar atrás; los gestos desde la cabina para «repetir el coro» o «terminar».
- Con un himno en video, Manna no sabe qué estrofa suena: por eso la marca Canto. Sin marca, Atril muestra la letra entera y quien lee la sigue.

### Qué puede hacer cada función, de un vistazo

| Acción | Pasar | Púlpito | Canto | Sonido | Preparar | Atril | Computadora o tableta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ver lo que está al aire | ✓ | ✓ | ✓ | ✓ | en una línea | ✓ | ✓ |
| Siguiente y Anterior | ✓ | sus versículos y diapositivas | diapositivas de la letra | — | en el ensayo, sin proyectar | — | ✓ |
| Saltar a otro elemento del orden | ✓ | — | — | — | — | — | ✓ |
| Mover lo que falta del orden | «a continuación» | «poner a continuación» | «poner a continuación» | — | ✓ | — | ✓ |
| «Negro» y «Solo fondo» | ✓ | ✓ | ✓ | Negro | — | — | ✓ |
| Mandos de lo que está al aire | ✓ | señalar y acercar sus diapositivas | los de su himno | los de lo que suena | — | — | ✓ |
| Volumen de Manna | ✓ | — | ✓ | ✓ | — | — | ✓ |
| Buscar | en todo, para un imprevisto | versículos por cita o palabras | himnos por número, título o letra | — | para añadir al orden | — | ✓ |
| Proyectar un versículo | del orden o de la lupa | ✓ | — | — | — | — | ✓ |
| Comparar dos versiones | — | ✓ | — | — | dejarlo elegido | — | ✓ |
| Proyectar un himno | del orden o de la lupa | — | ✓ | — | — | — | ✓ |
| Proyectar videos, imágenes o audios | del orden o de la lupa | los de su sección | audios y su categoría | — | — | — | ✓ |
| Pasar diapositivas | si están en el orden | ✓ | — | — | — | — | ✓ |
| Ver lo que viene y escucharlo antes | ver | — | escuchar himnos | ✓ | ✓ | ver lo que sigue | ✓ |
| Avisos al frente | los envía | — | los envía y marca la estrofa | — | — | los recibe | ✓ |
| Hora y cronómetros | hora y tiempo del culto | el del sermón | — | cuánto falta de lo que suena | — | la hora y el del sermón | ✓ |
| Añadir, quitar y renombrar en el orden | — | — | añadir a «Hoy» | — | ✓ | — | ✓ |
| Notas para quien pasa | las lee | — | — | — | las escribe | — | ✓ |
| Subir fotos, videos, PDF, YouTube o páginas | — | — | — | — | ✓ | — | ✓ |
| Escribir textos y citas | — | — | — | — | si lo decides | — | ✓ |
| Ensayar el orden sin proyectar | — | — | — | — | ✓ | — | — |
| Prueba de sonido | — | — | — | ✓ | — | — | ✓ |
| Leer en grande la letra o el versículo | — | — | la letra, en su teléfono | — | — | ✓ | — |
| Borrar de la biblioteca, categorías | — | — | — | — | — | — | ✓ |
| Ajustes, PIN, programas, apagar | — | — | — | — | — | — | ✓ |
| Pide PIN | ✓ | ✓ | ✓ | ✓ | ✓ | no, en la red de la iglesia | ✓ |

### Lo que no se añade, y por qué

- **Juntar Pasar, Púlpito y Canto en una pantalla.** Volvería a ser el control total. Para quien lleva solo el culto están el cambio de función de arriba y la lupa de Pasar.
- **«Proyectar ahora» en Preparar.** Se perdería lo que la hace segura: armar el culto desde casa o cinco minutos antes sin sacar nada al aire.
- **«Siguiente» en Atril.** Lo abren varias personas a la vez, sin PIN, y se acomoda en un soporte: habría toques dobles y avances sin querer.
- **«Siguiente» en Sonido.** Al ajustar el volumen a oscuras se pasaría la diapositiva del predicador.
- **Un volumen distinto para cada video.** Rompe la regla de un solo volumen de Manna. Si un video suena muy fuerte, mejor igualarlo al subirlo (sería otra fase).
- **Ajustes, televisores o «Limpiar» en el celular.** Son tareas de cabina, casi nunca en vivo, y un toque en falso cambia la letra a mitad del sermón o borra archivos.

## 4. Lo que queda para la computadora y la tableta

**«Control completo» deja de ofrecerse en el celular** y queda para el equipo principal, una computadora o una tableta. Ahí sigue todo: los módulos completos, la Biblia con «Varios», el Mapa del culto, las Páginas web, las categorías y la biblioteca entera (renombrar, eliminar), el Presentador completo y **Ajustes** (apariencia, proyector, PIN, programas, internet, disco).

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
| Plantilla común | El recuadro de «Historias», la franja de estado, los modos, el volumen, `guard()` | La plantilla de una pantalla sin dock, la zona del pulgar, las hojas que suben, «Deshacer» y mantener la pantalla encendida |
| Pasar | «Control del orden», la cola del culto, los pasos, los mandos en vivo, «Buscar en todo» | La pantalla nueva, la lista con «Proyectar este», el reloj del culto, mover sin el permiso de editar |
| Púlpito | La búsqueda de citas y de palabras, los recientes, «Comparar», el Presentador, los gestos | Unirlos en una pantalla, «Para hoy», seguir el capítulo después de la cita, el cronómetro |
| Canto | El himnario (número, título, letra, categorías, favoritos), el teclado del PIN, los mandos de lo que suena, «Letras sin música», «Escuchar» | El teclado de números de himno, la vista de mandos, marcar la estrofa |
| Sonido | El volumen, los mandos de lo que suena, `conexiones.sonido`, «Escuchar» | La pantalla, el aviso de los 10 segundos, «Bajar poco a poco», la prueba de sonido |
| Preparar | Las subidas de Medios, Videos y Diapositivas, YouTube, Páginas web, el orden del culto, las tareas (`jobs`), Textos (fase 18) | La lista del orden para el dedo, la hoja «Añadir», un permiso que edita sin proyectar, «Por revisar», notas, duplicar, ensayo, empezar desde el anterior |
| Atril | El estado de lo al aire, la letra con sus partes, el reloj del servidor | La pantalla de lectura, la estrofa marcada, los avisos |
| Inicio | Las tarjetas de función y el PIN | Mostrar solo las del celular en el teléfono, el icono por función |

En el servidor, cada función nueva es una entrada en `server/roles.js` con sus permisos. Lo nuevo de fondo:

- **Preparar edita sin poder proyectar** (hoy editar el orden y proyectar van juntos en las funciones que editan), y **Pasar mueve sin editar** el resto.
- **Un espacio pequeño para lo que se dicen las funciones** (el último aviso, la estrofa marcada, el cronómetro del sermón y quién puso algo a continuación), que no se guarda en disco ni sale en la proyección.
- **Una nota opcional en cada elemento del orden**, como el nombre propio que ya tienen.
- **La prueba de sonido**: un tono que suena por la pantalla que suena, sin cambiar lo proyectado.

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
- Dos de las decisiones de la sección 10 (varios celulares proyectando y quien lleva solo el culto).

Lo que no se tomó, y por qué:

- **«Videos e imágenes» como función en vivo aparte.** Subir lo de última hora ya está en «Preparar», y con «Poner a continuación» lo proyecta quien pasa el programa. Una función más que también proyecta es otra tarjeta en el inicio y otro teléfono que puede sacar algo al aire.
- **«Comparar» en el celular.** Dos versiones a la vez no se leen bien en un teléfono. (Se cambió en la segunda ronda: ahora está en Púlpito, a un toque.)

Lo que trae esta propuesta y la otra no: **Atril** (leer lo que está al aire, sin controles) y **Sonido**.

**Segunda ronda (más capacidades por función).** Se le pidió a Gemini qué le faltaba a cada una de estas seis, sin volverlas un control total. Casi todo lo que propuso ya existe en otra pantalla de Manna. Se tomó:

- En **Pasar**: tocar un paso para ir a él, la lupa para un imprevisto (resuelve la antigua decisión 11), los mandos de lo que está al aire, cuánto falta de lo que suena y quitar lo que otro puso a continuación.
- En **Púlpito**: buscar por palabras, la cuadrícula de diapositivas, seguir leyendo el capítulo después de la cita, los recientes, acercar y «Solo fondo». También **Comparar**, que en la primera ronda se había dejado fuera: el predicador lo pide para contrastar una palabra, y la versión de la iglesia sigue yendo primero.
- En **Canto**: la tira de diapositivas para repetir el coro, buscar por título o letra, ver la letra mientras suena, volver al principio, añadir a «Hoy» y marcar favoritos.
- En **Sonido**: lo que viene y si suena, Cantado o Pista, los mandos, escuchar antes, por dónde sale el sonido, los subtítulos y «Bajar poco a poco».
- En **Preparar**: elegir de la biblioteca, buscar himnos y pasajes, dejar decidido cómo va cada elemento, el avance de las descargas, las páginas web, duplicar y empezar desde el orden anterior.
- En **Atril**: «Volver al aire», lo que sigue en el orden, la hora, cuánto falta y acercar solo en el teléfono.
- Y su lista de lo que no se añade (arriba, en la sección 3).

Por su cuenta, esta versión suma los **avisos entre funciones**: la estrofa marcada, los avisos al frente, el cronómetro del sermón, las notas para quien pasa, el ensayo y «Por revisar».

## 9. Riesgos

- **La pantalla que se apaga.** Mantenerla encendida (la función del navegador que lo hace) pide una conexión segura (`https`), y Manna la ofrece con un certificado propio que el celular avisa como «no seguro». Habría que probar en celulares reales si basta con aceptarlo una vez o si conviene otra salida (pedir que no se bloquee mientras se usa, o un aviso para subir el tiempo de bloqueo).
- **Vibrar al proyectar** solo funciona en Android; en iPhone no hay forma desde el navegador.
- **Memoria del iPhone.** Safari cierra la página si una lista carga muchas imágenes grandes (ya pasó el 2026-10-10 con las miniaturas del orden). «Púlpito», «Preparar» y «Atril» tienen que cargar siempre la imagen pequeña.
- **Dos funciones en vivo a la vez** (Pasar y Púlpito) pueden pisarse: si el predicador saca un versículo, «Pasar» debe mostrarlo al instante como lo al aire y no seguir con el orden a ciegas. El estado compartido ya lo hace; hay que cuidar el mensaje («El predicador proyectó Juan 3:16»).
- **Más funciones que explicar.** Si son demasiadas, el inicio confunde. Por eso «Sonido» es opcional y las tarjetas dicen para quién es cada una.
- **Más capacidades, más pantalla.** Cada función hace ahora bastante más. Lo que la mantiene simple es la regla de lo de siempre a la vista y lo demás en hojas; si una pantalla se llena, lo primero que se mueve a una hoja es lo menos usado.
- **Los avisos al frente solo sirven si alguien mira.** Si nadie abre Atril, se pierden. Conviene empezar con la lista corta y ver en el culto si se usan.
- **Quitar «Control completo» del celular** puede molestar a quien hoy lo usa así. La válvula de escape lo cubre, pero conviene probarlo un mes antes de quitar el acceso.

## 10. Lo que tiene que decidir el dueño

1. **Las funciones:** ¿estas seis? ¿Sus nombres (Pasar, Púlpito, Canto, Sonido, Preparar, Atril)?
2. **Sonido:** ¿función aparte o basta con el volumen y los mandos dentro de Pasar y Canto?
3. **«Control completo» en el celular:** ¿se quita con la válvula de escape, se deja como una tarjeta más al final, o se quita del todo?
4. **El PIN:** ¿uno para todas las funciones que tocan algo, o un segundo PIN para Preparar?
5. **Atril sin PIN** en la red de la iglesia: ¿sí?
6. **Canto:** ¿qué categoría de Videos ve (una que se llame «Alabanza», o la que se elija en Ajustes)? ¿Puede añadir himnos a «Hoy» y ponerlos a continuación?
7. **Púlpito:** ¿«Para hoy» sale de una sección del orden del culto («Mensaje») o de una lista propia del predicador? ¿Puede comparar con otra versión?
8. **Preparar:** ¿basta con un solo orden del culto, o hace falta preparar el del sábado siguiente mientras se usa el de hoy? (Hoy Manna tiene un solo orden.)
9. **Las funciones de hoy en la tableta y la computadora** (Servicio de alabanza, Presentador, Control del orden): ¿se quedan como están ahí, o se sustituyen también por las nuevas?
10. **Varios celulares proyectando a la vez:** ¿cualquier función en vivo puede proyectar, o se añade en «Pasar» un interruptor «Solo este teléfono saca al aire; los demás ponen a continuación»?
11. **La lupa de Pasar** («Buscar en todo», para un imprevisto o para quien lleva solo el culto): ¿se queda, o Pasar solo pasa?
12. **Los avisos al frente:** ¿bastan los de la lista («Un momento», «Alargar», «Repetir el coro», «Última estrofa», «Terminar», «Más despacio») o se pueden escribir?
13. **Lo nuevo:** de lo marcado (nuevo) (avisos, la estrofa marcada, los cronómetros, las notas para quien pasa, mover desde Pasar, el ensayo, «Por revisar», la prueba de sonido, empezar desde el orden anterior, duplicar), ¿qué entra en la primera versión y qué después?
14. **El orden de construcción** de la sección 7.
