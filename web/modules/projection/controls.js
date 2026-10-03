import { action, api, state, subscribe } from '../../core/api.js';
import { h, guard, toast } from '../../core/dom.js';

const BACKGROUNDS = [
  ['Noche azul', { backgroundType: 'gradient', bgGradient: 'radial-gradient(ellipse at center, #1e293b 0%, #0f172a 100%)' }],
  ['Púrpura', { backgroundType: 'gradient', bgGradient: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)' }],
  ['Esmeralda', { backgroundType: 'gradient', bgGradient: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)' }],
  ['Madera', { backgroundType: 'gradient', bgGradient: 'linear-gradient(135deg, #451a03 0%, #1c1917 100%)' }],
  ['Negro', { backgroundType: 'solid', bgColor: '#000000' }],
  ['Carbón', { backgroundType: 'solid', bgColor: '#18181b' }],
];

export const setMode = guard((mode) => action('projection.mode', { mode }));

// Botones Negro / Fondo: al pulsarlos de nuevo vuelven a mostrar el contenido.
export function createModeButtons() {
  const black = h('button', { class: 'btn', title: 'Pantalla en negro (tecla B)', onclick: () => toggleMode('black') }, 'Negro');
  const clear = h('button', { class: 'btn', title: 'Solo el fondo, sin texto (tecla C)', onclick: () => toggleMode('clear') }, 'Fondo');
  subscribe('projection', ({ mode, item }) => {
    black.classList.toggle('active', mode === 'black');
    clear.classList.toggle('active', mode === 'clear' && Boolean(item));
  });
  return [black, clear];
}

export function toggleMode(mode) {
  setMode(state.projection?.mode === mode ? 'live' : mode);
}

// Texto corto de lo que hay ahora mismo en pantalla.
export function describeLive({ mode, item }) {
  if (mode === 'black') return { text: 'Pantalla en negro', live: false };
  if (!item || mode === 'clear') return { text: item ? `Solo fondo · ${item.reference}` : 'Solo fondo', live: false };
  return { text: `${item.reference}${item.version ? ` (${item.version})` : ''}`, live: true };
}

// Encendido/apagado de la ventana en la segunda pantalla del equipo principal.
export function createDisplayToggle() {
  const button = h('button', { class: 'btn', onclick: guard(async () => {
    const { display } = state.projection;
    if (!display.hasSecond) {
      toast('No hay una segunda pantalla conectada al equipo principal. Conecta el proyector y se abrirá sola.', 'error');
      return;
    }
    await action('projection.display', { on: !display.on });
  }) });
  subscribe('projection', ({ display }) => {
    button.className = 'btn';
    if (!display.hasSecond) {
      button.textContent = '⚠ Sin segunda pantalla';
      button.classList.add('danger');
      button.title = 'El equipo principal no tiene un proyector o segunda pantalla conectada.';
    } else {
      button.textContent = display.on ? 'Proyector: encendido' : 'Proyector: apagado';
      button.classList.toggle('live', display.on && display.open);
      button.title = display.on ? 'Clic para cerrar la ventana de proyección' : 'Clic para abrir la ventana en la segunda pantalla';
    }
  });
  return button;
}

// Panel de estilos de la proyección.
export function createStylePanel(container) {
  const send = guard((patch) => action('projection.styles', patch));
  const controls = {};

  const range = (key, min, max, step, toView, fromView, suffix) => {
    const value = h('span', {});
    const input = h('input', { type: 'range', min, max, step, oninput: () => {
      value.textContent = `${input.value}${suffix}`;
      send({ [key]: fromView(Number(input.value)) });
    } });
    controls[key] = (v) => { input.value = toView(v); value.textContent = `${input.value}${suffix}`; };
    return [input, value];
  };
  const select = (key, options) => {
    const input = h('select', { class: 'input', onchange: () => send({ [key]: input.value }) },
      ...options.map(([v, label]) => h('option', { value: v }, label)));
    controls[key] = (v) => { input.value = v; };
    return input;
  };
  const color = (key) => {
    const input = h('input', { type: 'color', onchange: () => send({ [key]: input.value }) });
    controls[key] = (v) => { input.value = v; };
    return input;
  };
  const field = (label, input, value) => h('div', { class: 'field' }, h('div', { class: 'label' }, h('span', {}, label), value), input);

  const [size, sizeValue] = range('fontSize', 28, 84, 2, (v) => v, (v) => v, '');
  const [overlay, overlayValue] = range('overlayOpacity', 0, 90, 5, (v) => Math.round(v * 100), (v) => v / 100, '%');

  const upload = h('input', { class: 'input', type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', style: 'padding: 6px;',
    onchange: guard(async () => {
      const file = upload.files[0];
      upload.value = '';
      if (!file) return;
      await api('/api/projection/background', { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
      toast('Imagen de fondo actualizada');
    }) });

  container.replaceChildren(
    field('Tamaño de texto', size, sizeValue),
    field('Tipografía', select('fontFamily', [['sans', 'Moderna (sans-serif)'], ['serif', 'Elegante (serif)'], ['trebuchet', 'Dinámica (Trebuchet)'], ['impact', 'Impactante (gruesa)']])),
    h('div', { class: 'grid-2' }, field('Color del texto', color('textColor')), field('Color de la cita', color('refColor'))),
    h('div', { class: 'grid-2' },
      field('Posición de la cita', select('refPosition', [['bottom-center', 'Abajo, centro'], ['bottom-right', 'Abajo, derecha'], ['top-center', 'Arriba, centro']])),
      field('Sombra', select('textShadow', [['strong', 'Fuerte'], ['soft', 'Suave'], ['outline', 'Contorno'], ['none', 'Sin sombra']]))),
    field('Fondos', h('div', { class: 'swatches' }, ...BACKGROUNDS.map(([name, patch]) =>
      h('button', { title: name, 'aria-label': `Fondo ${name}`, style: `background: ${patch.bgGradient || patch.bgColor};`, onclick: () => send(patch) })))),
    field('Imagen de fondo propia', upload),
    field('Oscurecer el fondo', overlay, overlayValue),
  );

  subscribe('projection', ({ styles }) => {
    for (const [key, set] of Object.entries(controls)) {
      // No pisar el control que el usuario está moviendo en este momento.
      if (!container.contains(document.activeElement) || document.activeElement.type !== 'range') set(styles[key]);
    }
  });
}
