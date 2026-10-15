import { session } from '../core/api.js';
import { $, h, dialog, toast } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { preferStableAddress } from '../core/upgrade.js';

// Pantalla de inicio: cada dispositivo elige su función. Las de control piden el PIN una vez.
const info = await session.get();
preferStableAddress(info);
$('#version').textContent = `Church projection app${info.version ? ` · ${info.version}` : ''}`;
const back = new URLSearchParams(location.search).get('volver');
const ICONS = { control: 'sliders-horizontal', alabanza: 'music-notes', presentador: 'hand-pointing', orden: 'list-numbers', proyeccion: 'monitor' };

// El PIN (4 cifras) se escribe en un teclado grande, también con las teclas del teclado, y entra solo
// al teclear la cuarta.
function askPin(role) {
  let typed = '';
  let busy = false;
  const dots = h('div', { class: 'pin-dots', role: 'img' });
  const error = h('p', { class: 'pin-error', role: 'alert' });
  const key = (digit) => h('button', { 'aria-label': digit, onclick: () => type(digit) }, digit);
  const box = h('div', { class: 'pin-pad' },
    h('p', {}, 'Escribe el PIN de Manna. Está en el equipo principal, en «Dispositivos».'),
    dots, error,
    h('div', { class: 'pin-keys' }, ...'123456789'.split('').map(key),
      h('span', {}), key('0'), h('button', { 'aria-label': 'Borrar', onclick: () => erase() }, icon('arrow-left', 22))));
  const paint = () => {
    dots.replaceChildren(...Array.from({ length: 4 }, (_, i) => h('span', { class: i < typed.length ? 'on' : '' })));
    dots.setAttribute('aria-label', `${typed.length} de 4 cifras`);
  };
  const type = (digit) => {
    if (busy || typed.length >= 4) return;
    typed += digit;
    box.classList.remove('wrong');
    error.textContent = '';
    paint();
    if (typed.length === 4) submit();
  };
  const erase = () => { if (!busy) { typed = typed.slice(0, -1); paint(); } };
  async function submit() {
    busy = true;
    try {
      await session.open(role.id, typed);
      location.href = role.path;
    } catch (err) {
      typed = '';
      box.classList.add('wrong');
      error.textContent = err.message;
      paint();
    }
    busy = false;
  }
  const { el } = dialog(role.name, box);
  const onKey = (e) => {
    if (!el.isConnected) { document.removeEventListener('keydown', onKey); return; }
    if (/^\d$/.test(e.key)) type(e.key);
    else if (e.key === 'Backspace') erase();
    else return;
    e.preventDefault();
  };
  document.addEventListener('keydown', onKey);
  paint();
}

async function choose(role) {
  if (!role.requiresPin) {
    location.href = role.path;
    return;
  }
  if (info.isLocal || info.role === role.id) {
    try {
      await session.open(role.id);
      location.href = role.path;
    } catch (err) {
      toast(err.message, 'error');
    }
    return;
  }
  askPin(role);
}

$('#roles').append(...info.roles.map((role) => {
  const current = info.role === role.id;
  const asks = role.requiresPin && !info.isLocal;
  return h('button', { class: `role${current ? ' current' : ''}`, onclick: () => choose(role) },
    h('span', { class: 'role-icon' }, icon(ICONS[role.id] || 'monitor', 22)),
    h('span', { class: 'role-text' }, h('strong', {}, role.name), h('span', {}, role.description)),
    h('span', { class: `tag${asks && !current ? ' asks' : ''}` }, current ? 'Función actual' : asks ? 'Pide PIN' : 'Sin PIN'));
}));

// Si llegó aquí rebotado desde una página de control, entra directo (o pide el PIN de esa función).
const wanted = back && info.roles.find((r) => r.path === back);
if (wanted && info.role !== wanted.id) choose(wanted);
