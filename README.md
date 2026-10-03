# 📖 Proyector Bíblico Local (Formato .XMM)

Aplicación web local profesional diseñada para iglesias, conferencias y presentaciones bíblicas. Permite gestionar múltiples versiones de la Biblia en formato `.xmm` (usadas por aplicaciones como OpenLP), controlar la selección de pasajes desde una interfaz de operador y proyectar a pantalla completa en un segundo monitor o proyector.

---

## 🚀 Cómo iniciar la aplicación

Tienes dos formas muy sencillas de abrirla:

### Opción 1: Ejecutable directo (Recomendado en Mac)
1. Ve a la carpeta `proyector-biblico` en tu Finder.
2. Haz doble clic en el archivo **`iniciar.command`**.
3. Se abrirá automáticamente tu navegador web en `http://localhost:8000/index.html`.

### Opción 2: Abrir directamente en el navegador
- Puedes hacer doble clic directamente en el archivo **`index.html`** y abrirlo en Chrome, Edge, Safari o Firefox.

---

## 🖥️ Cómo funciona el sistema de doble ventana

1. **Ventana de Control (`index.html`)**:
   - Es la pantalla que maneja el operador / técnico de proyección en la computadora principal.
   - En la barra superior, haz clic en el botón **"Abrir Proyector"**.
   - Se abrirá una nueva ventana emergente llamada **Pantalla de Proyección** (`proyeccion.html`).

2. **Ventana de Proyección (`proyeccion.html`)**:
   - Arrastra esta ventana hacia tu **segundo monitor o proyector**.
   - Haz **doble clic** sobre cualquier parte de la pantalla o presiona **F** / **F11** para ponerla en **Pantalla Completa**.
   - La pantalla permanecerá limpia, sin barras de herramientas, bordes ni elementos distractores.

---

## 📚 Gestión de Biblias (.xmm)

- La aplicación incluye una biblia de muestra precargada para que comiences de inmediato.
- Para agregar tus propias biblias en formato `.xmm`:
  1. En el panel izquierdo, haz clic en el botón **"📁 Biblias"**.
  2. Arrastra y suelta tus archivos `.xmm` dentro de la zona punteada, o haz clic para seleccionarlos desde tu Mac.
  3. Puedes subir tantas versiones como desees (por ejemplo: *Reina-Valera 1960*, *NVI*, *DHH*, *LBLA*, etc.).
  4. Tus biblias se guardan localmente en el navegador (IndexedDB), por lo que **no tendrás que volver a cargarlas** cuando cierres y abras la aplicación.

---

## 🔍 Búsqueda Rápida y Navegación

1. **Buscador Inteligente**:
   - **Por cita bíblica**: Escribe por ejemplo `Juan 3:16`, `Gn 1:1`, `Salmo 23` o `Rom 8:28` y presiona **Enter**. La aplicación saltará inmediatamente al libro, capítulo y versículo exacto.
   - **Por texto o palabra clave**: Escribe cualquier palabra o frase (ej. `amor`, `principio`, `pastor`) y presiona **Enter** para ver todos los versículos coincidentes con resaltado.
2. **Navegación tradicional**:
   - Filtra por **Antiguo Testamento**, **Nuevo Testamento** o **Todos**.
   - Elige el libro en la columna izquierda.
   - Selecciona el número de capítulo en la cuadrícula superior.
   - Haz **un clic** en cualquier versículo para verlo en el monitor de vista previa.
   - Haz **doble clic** o presiona **Enter** para enviarlo de inmediato a la pantalla en vivo.

---

## 🎮 Controles en Vivo y Atajos de Teclado

| Tecla / Botón | Función |
| :--- | :--- |
| **Enter** / Botón `EN VIVO` | Transmite el versículo seleccionado a la pantalla de proyección |
| **Flecha Derecha (▶)** | Avanza al siguiente versículo |
| **Flecha Izquierda (◀)** | Retrocede al versículo anterior |
| **Tecla B** / Botón `Negro` | Modo Blackout: Pantalla completamente negra para transiciones |
| **Tecla C** / Botón `Fondo` | Oculta el texto pero mantiene el fondo artístico visible |
| **Escape** | Desactiva la transmisión en vivo / cierra modales |
| **F / F11** (en proyector) | Alterna modo Pantalla Completa |

---

## 🎨 Personalización Visual del Proyector

En el panel derecho puedes ajustar el diseño visual en tiempo real:
- **Tamaño de letra**: Ajustable desde 28px hasta 84px mediante slider.
- **Tipografías**: Estilos modernos sans-serif, serif clásico, trebuchet e impact.
- **Colores**: Personaliza el color del versículo y el color de la cita bíblica.
- **Sombra de texto**: Opciones fuerte, suave o contorno para garantizar 100% de legibilidad sobre cualquier fondo.
- **Fondos**: Elige entre degradados profesionales predefinidos, colores planos, o sube tu propia imagen de fondo personalizada.
- **Filtro de Oscurecimiento**: Regula la opacidad de la capa negra sobre el fondo para mayor contraste.

---

## 📋 Guión de Culto (Playlist)

- Si preparas los pasajes bíblicos antes de la reunión, selecciona el versículo y presiona **"+ Guión"**.
- En la pestaña **Guión de Culto** tendrás la lista de lecturas programadas.
- Haz clic en cualquier lectura de la lista durante la reunión para proyectarla al instante sin tener que buscarla.
