import { action, state, subscribe, upload } from '../../core/api.js';
import { h, dialog, guard, toast } from '../../core/dom.js';
import { IMAGE_ACCEPT, prepareImage } from '../../core/images.js';
import { icon } from '../../core/icons.js';
import { titleOf } from '../../core/kinds.js';

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
  const text = titleOf(item);
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

// Imagen de prueba: para encuadrar el proyector o un televisor y ver que las pantallas van a la par.
export function createTestCardButton() {
  return h('button', { class: 'btn', onclick: guard(async () => {
    await action('projection.show', { kind: 'testcard', data: {} });
    toast('Imagen de prueba en pantalla. Sus mandos están en el panel "Al aire".');
  }) }, icon('frame-corners', 16), 'Mostrar imagen de prueba');
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

  // Fondo: los colores de siempre y, a su lado, las imágenes subidas, que se conservan.
  const swatches = h('div', { class: 'swatches' });
  const progress = h('div', { class: 'bar', hidden: true }, h('span', { style: 'width: 0%;' }));
  const removeCurrent = h('button', { class: 'btn', hidden: true, onclick: () => askRemove() }, icon('trash', 15), 'Eliminar esta imagen');
  const picker = h('input', { type: 'file', accept: IMAGE_ACCEPT, hidden: true });
  picker.addEventListener('change', guard(async () => {
    const file = picker.files[0];
    picker.value = '';
    if (!file) return;
    progress.hidden = false;
    progress.firstChild.style.width = '0%';
    try {
      // Como en Medios: la foto se reduce aquí antes de enviarla.
      const ready = await prepareImage(file, { thumb: false });
      await upload('/api/projection/background', ready.blob, {
        headers: { 'Content-Type': ready.type },
        onProgress: (fraction) => { progress.firstChild.style.width = `${Math.round(fraction * 100)}%`; },
      });
      toast('Imagen de fondo añadida. Queda guardada junto a los colores.');
    } finally {
      progress.hidden = true;
    }
  }));

  const currentImage = () => {
    const { styles, backgrounds = [] } = state.projection || {};
    return styles?.backgroundType === 'image' ? backgrounds.find((b) => b.url === styles.bgImage) || null : null;
  };
  function askRemove() {
    const image = currentImage();
    if (!image) return;
    const box = dialog('Eliminar la imagen de fondo',
      h('p', {}, 'La imagen se borrará de Manna y la proyección volverá al fondo de color.'),
      h('div', { class: 'row', style: 'justify-content: flex-end;' },
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn danger', onclick: guard(async () => {
          await action('projection.backgroundRemove', { id: image.id });
          box.close();
        }) }, 'Eliminar')));
  }
  function renderBackgrounds({ styles, backgrounds = [] }) {
    const onImage = styles.backgroundType === 'image';
    swatches.replaceChildren(
      ...BACKGROUNDS.map(([name, patch]) => {
        const on = !onImage && styles.backgroundType === patch.backgroundType
          && (patch.backgroundType === 'gradient' ? styles.bgGradient === patch.bgGradient : styles.bgColor === patch.bgColor);
        return h('button', { class: on ? 'on' : '', title: name, 'aria-label': `Fondo ${name}`, 'aria-pressed': on, style: `background: ${patch.bgGradient || patch.bgColor};`, onclick: () => send(patch) });
      }),
      ...backgrounds.map((image, i) => {
        const on = onImage && styles.bgImage === image.url;
        return h('button', { class: `swatch-image${on ? ' on' : ''}`, title: `Imagen ${i + 1}`, 'aria-label': `Fondo con la imagen ${i + 1}`, 'aria-pressed': on, dataset: { id: image.id },
          onclick: guard(() => action('projection.background', { id: image.id })) }, h('img', { src: image.url, alt: '', loading: 'lazy' }));
      }),
      h('button', { class: 'swatch-add', title: 'Subir una imagen de fondo', 'aria-label': 'Subir una imagen de fondo', onclick: () => picker.click() }, icon('plus', 18)));
    removeCurrent.hidden = !currentImage();
  }

  container.replaceChildren(
    field('Tamaño del texto', size, sizeValue),
    field('Tipografía', select('fontFamily', [['sans', 'Moderna (sin remates)'], ['serif', 'Clásica (con remates)'], ['trebuchet', 'Trebuchet'], ['impact', 'Gruesa']])),
    h('div', { class: 'grid-2' }, field('Color del texto', color('textColor')), field('Color de la cita', color('refColor'))),
    h('div', { class: 'grid-2' },
      field('Posición de la cita', select('refPosition', [['bottom-center', 'Abajo, centro'], ['bottom-right', 'Abajo, derecha'], ['top-center', 'Arriba, centro']])),
      field('Sombra del texto', select('textShadow', [['strong', 'Fuerte'], ['soft', 'Suave'], ['outline', 'Contorno'], ['none', 'Sin sombra']]))),
    field('Fondo', h('div', {}, swatches, progress, picker,
      h('p', { class: 'muted swatch-note' }, 'Con + se sube una imagen: queda guardada aquí, junto a los colores.'),
      removeCurrent)),
    field('Oscurecer el fondo', overlay, overlayValue),
  );

  subscribe('projection', (projection) => {
    const { styles } = projection;
    renderBackgrounds(projection);
    for (const [key, set] of Object.entries(controls)) {
      // No pisar el control que el usuario está moviendo en este momento.
      if (!container.contains(document.activeElement) || document.activeElement.type !== 'range') set(styles[key]);
    }
  });
}
