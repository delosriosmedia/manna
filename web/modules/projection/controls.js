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

const setMode = guard((mode) => action('projection.mode', { mode }));

// Negro / Solo fondo: al pulsarlos de nuevo vuelven a mostrar el contenido.
export function toggleMode(mode) {
  setMode(state.projection?.mode === mode ? 'live' : mode);
}

// Qué hay ahora mismo en pantalla, en palabras.
//   state  'live' | 'clear' | 'black' | 'empty'
//   label  estado ("Al aire", "Solo fondo"…)   text  el contenido, si lo hay
export function describeLive({ mode, item }) {
  const text = item ? `${item.reference}${item.version ? ` (${item.version})` : ''}` : '';
  if (mode === 'black') return { state: 'black', label: 'Pantalla en negro', text };
  if (!item) return { state: 'empty', label: 'Nada en pantalla', text: '' };
  if (mode === 'clear') return { state: 'clear', label: 'Solo fondo', text };
  return { state: 'live', label: 'Al aire', text };
}

// Texto del estado del proyector del equipo principal.
export function describeDisplay(display) {
  if (!display.hasSecond) return { text: 'Sin segunda pantalla', warn: true };
  if (display.on && display.open) return { text: 'Proyector encendido', warn: false };
  return { text: 'Proyector apagado', warn: false };
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
    button.textContent = !display.hasSecond ? 'Sin segunda pantalla' : display.on ? 'Apagar proyector' : 'Encender proyector';
    button.disabled = !display.hasSecond;
  });
  return button;
}

// Controles de apariencia de la proyección.
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
    const input = h('select', { class: 'select', style: 'width: 100%;', onchange: () => send({ [key]: input.value }) },
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
  const [overlay, overlayValue] = range('overlayOpacity', 0, 90, 5, (v) => Math.round(v * 100), (v) => v / 100, ' %');

  const upload = h('input', { class: 'input', type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif',
    onchange: guard(async () => {
      const file = upload.files[0];
      upload.value = '';
      if (!file) return;
      await api('/api/projection/background', { method: 'POST', headers: { 'Content-Type': file.type }, body: file, timeout: 120_000 });
      toast('Imagen de fondo actualizada');
    }) });

  container.replaceChildren(
    field('Tamaño del texto', size, sizeValue),
    field('Tipografía', select('fontFamily', [['sans', 'Moderna (sin remates)'], ['serif', 'Clásica (con remates)'], ['trebuchet', 'Trebuchet'], ['impact', 'Gruesa']])),
    h('div', { class: 'grid-2' }, field('Color del texto', color('textColor')), field('Color de la cita', color('refColor'))),
    h('div', { class: 'grid-2' },
      field('Posición de la cita', select('refPosition', [['bottom-center', 'Abajo, centro'], ['bottom-right', 'Abajo, derecha'], ['top-center', 'Arriba, centro']])),
      field('Sombra del texto', select('textShadow', [['strong', 'Fuerte'], ['soft', 'Suave'], ['outline', 'Contorno'], ['none', 'Sin sombra']]))),
    field('Fondo', h('div', { class: 'swatches' }, ...BACKGROUNDS.map(([name, patch]) =>
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
