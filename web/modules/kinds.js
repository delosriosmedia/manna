// Tipos de contenido de la interfaz. Cada módulo aporta el suyo en su carpeta; aquí solo se
// listan, igual que los módulos en registry.js. Lo carga el escenario (projection/stage.js),
// así que están disponibles en cualquier página que proyecte o muestre miniaturas.
import { kindOf, registerKind } from '../core/kinds.js';
import './bible/kind.js';
import './projection/testcard.js';
import './media/kind.js';

// Tipos previstos que todavía no tiene ningún módulo: solo icono y nombre, para que un orden
// del culto que los contenga se lea bien. No se pueden proyectar. Cuando un módulo registra
// el suyo, su entrada de aquí deja de usarse y se borra.
const PLANNED = {
  song: { icon: 'music-notes', label: 'Himno', unit: null },
  video: { icon: 'video', label: 'Video', unit: null },
  slides: { icon: 'presentation-chart', label: 'Diapositivas', unit: ['diapositiva', 'diapositivas'] },
};
for (const [name, def] of Object.entries(PLANNED)) if (!kindOf(name)) registerKind(name, def);
