# Auditoría de los bocetos móviles (2026-10-30)

Revisión de las pantallas «En vivo» antes de construirlas, pedida por el dueño (decisión 72). Sale de aquí la sección «Móviles» de `DESIGN.md`, que es lo que manda; este documento guarda de dónde sale cada regla y qué se dejó fuera.

## Cómo se hizo

- **Qué se revisó**: solo lo aprobado, en la página «Aprobados» del lienzo «Pantallas de control» (https://claude.ai/artifact/R2NuBEJgcGYQfJrF7JCW9g, privado del dueño). Lo descartado quedó aparte, en la página «Historial». Son 29 tableros en la revisión y 38 tras los arreglos: T (teléfono), U (tableta en su tamaño más pequeño) y E (estados, capas, pestañas, módulos y peores datos).
- **Medición**: cada tablero abierto a su tamaño real en un Chrome sin ventana, midiendo letra, contraste, cortes, zonas de toque y distancias.
- **Tres revisiones independientes**: diseño (`impeccable`, Claude Opus), peores datos (`break-ui`, Claude Sonnet) y ergonomía móvil (`mobile-native`, `apple-design` y `emil-design-eng`, Claude Opus).
- **Salud de los bocetos** antes de los arreglos: 20/40 en las heurísticas de Nielsen. Cuidaban bien la forma de operar y fallaban en lo que pasa cuando algo sale mal.

## Lo que se encontró y cómo quedó

Las cifras de «después» son medidas sobre los tableros arreglados. Las reglas citadas son las de `DESIGN.md`, «Móviles».

| Hallazgo | Antes | Después | Regla |
| --- | --- | --- | --- |
| Negro pegado a Anterior | 6 px | 20 px, y 12 a todo lo demás | 4 |
| Negro acostado, mucho más ancho que Anterior | 4,2 veces (8,3 en tableta) | Ancho fijo, bajo el otro pulgar | 4 |
| Orador sencillo: botones enormes a 3-5 px de los pequeños | 3-5 px | Solo fondo, Negro y demás arriba, a 20 px | 4 |
| Sin forma de deshacer en tres de las cuatro funciones | Solo en Orador sencillo | «Volver» 10 s en un sitio fijo (E14) | 3 |
| ▶ de un toque en cada fila, junto a Siguiente | En todas las filas | Un toque marca; solo la marcada lleva ▶ | 2 |
| Lista que se corre bajo el dedo si otro operador pasa | Sin regla | Quieta con un dedo encima y 1,5 s después | 2 |
| Sin dibujar: conexión caída, orden en camino, otro operador | Ningún tablero | E12 y la escalera de respuesta | 5 |
| En Negro seguía el rojo de «al aire» | Rojo y rótulo de 8,5 px | Ni un píxel rojo; «Quitar» lleno de blanco (E4, E13) | 6 |
| Siguiente enorme, cian lleno, deslumbra en lo oscuro | 26 % de pantalla clara | Fondo oscuro con borde cian; lo claro no pasa de 5,6 % | 7 |
| Letra sin escala, hasta 8,5 px | 10 tamaños en una pantalla | Mínimo 10 px; cinco tamaños | 8 |
| Texto atenuado o apagado, poco legible | 3,03:1 y 3,19:1 | 4,5:1 o más en todos | 8 |
| Cuatro capas con nombre largo sacaban el volumen de la pantalla | El volumen desaparecía | Islas fijas; el volumen pasa a un botón con su cifra (E1) | 9 |
| Rótulo de estado y cita de varios pasajes, cortados | «1 Crónicas 29…» | Cita compacta y el contador cede primero (E6) | 9 |
| Nombres gemelos indistinguibles en la lista | «Anuncios_semana…» tres veces | Se corta por el medio y se ve lo que distingue (E6) | 9 |
| Versículo que no existe, con su botón encendido | «Encima» activo | Apagado, y dice dónde sí está (E8) | 9 |
| Barra de pasos que desaparece con 176 pasos | 0 px por segmento | Una barra continua desde 25 pasos | 9 |
| Tocar la barra de avance salta el canto | Zona que pisa a Pausa | Solo se arrastra la bola; el volumen de Alabanza va a pasos | 2 |
| Principio, Reiniciar y Recargar a 3 px de lo más usado | A la vista | Dentro de «Más» | 3 |
| Marcas de los pasos encima de la vista previa (1,16:1 sobre crema) | Dentro de la vista | Fuera, debajo | 1 |
| Tecla 0 a 3 px de «Poner encima», y texto sin ver | 3 px | 12 px; dice qué pondrá y enseña el texto | 3 |
| Estados sin tablero | Solo fondo, vacío, terminó, última diapositiva y pestañas | Dibujados (E13, E15, E16, E19, E17, E18) | 10 |

## Lo que se decidió por defecto y el dueño puede cambiar

- **Saltar a otra fila pasa a dos toques** (marcar y ▶), a cambio de quitar el accidente más probable. «Encima», en el Orador completo, sigue a un toque, porque es lo que esa pantalla ofrece, y se deshace con «Volver».
- **Siguiente grande con fondo oscuro** en el Orador sencillo. Se ve menos llamativo en un boceto; está pensado para el salón a oscuras. Sin probar en uno.
- **Orador sencillo con «Bloquear»**: la pantalla no se apaga (decisión 69) y un tercio de ella manda al aire.
- **La tableta de pie muestra la tira de diapositivas** en el Orador completo, y las pestañas siguen.

## Cómo encaja con los ajustes de Medios del mismo día

La sesión principal cambió Medios en paralelo (sin publicar, la 1.59.1). Se revisó que no se pisen:

- **Tocar solo elige** (Medios) y **tocar solo marca** (orden) son la misma regla: quedó una sola, la 2.
- **«Vista previa»** nombraba dos cosas. La regla 1 habla de la vista de lo que está al aire, que no responde al toque; la vista previa de Medios sí deja colocar la imagen, porque aún no sale al proyector.
- **Las ventanas con campos no se cierran al tocar fuera**: la hoja «Versículo» sigue esa misma regla, y conserva lo escrito.
- **Completa y Llenar**: en Medios se eligen en su vista previa, viendo cómo queda. En «En vivo» siguen en los mandos de una imagen, porque ahí también se ve cómo queda.
- **Tarjetas de ancho fijo**: en pantallas angostas Medios ya pasa a dos columnas flexibles, sin huecos.

## Lo que no se adoptó, y por qué

- **Bajar el brillo de la vista previa al 80 %** en el Orador: rompe «tal cual» (decisión 68).
- **El mismo orden del dock en todas las funciones**: el dueño fijó el orden de cada una.
- **Una sola fila de mandos en el teléfono** (ganaría una fila de lista): el dueño pidió todos los mandos a la mano en Control total. Queda como opción si faltara lista en el uso real.
- **Quitar Solo fondo y Negro de la hoja «Versículo» o ponerlos en su cabecera**: se llega con un toque más, cerrando la hoja. Se revisará con la prueba en la mano.
- **Reducir la vista previa para dar 12 px al dock**: esos 8 px salen de la lista, no de la vista.

## Lo que sigue sin comprobar

Son bocetos: nada de esto se probó en la mano.

- Los toques, los gestos, el alcance del pulgar y el deslumbramiento salen de medidas y cálculos. Se prueban en un celular de verdad y en un salón oscuro desde la fase 44.
- **El tamaño más pequeño puede ser menor**: con los tres botones de Android en pantalla serían 360 × 512 de pie y 592 × 280 acostado. Es aritmética, no medida. Por eso la auditoría suma esos dos tamaños.
- Que el primer toque abajo en un iPhone no lo gaste Safari mostrando sus barras, qué navegadores reportan el tamaño del contacto y cómo se comporta el teclado del sistema.
- Los colores calculados (el fondo oscuro de Siguiente, entre otros) no se han visto en un panel real.
