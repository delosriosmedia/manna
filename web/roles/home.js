import { session } from '../core/api.js';
import { $, h, dialog, toast } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { preferStableAddress } from '../core/upgrade.js';

// Pantalla de inicio: cada dispositivo elige su función. Las de control piden, una vez, quién eres (tu nombre, de una
// lista) y tu PIN (fase 35); quien ya entró cambia de función sin volver a escribirlo.
const info = await session.get();
preferStableAddress(info);
$('#version').textContent = `Church projection app${info.version ? ` · ${info.version}` : ''}`;
const back = new URLSearchParams(location.search).get('volver');
const ICONS = { control: 'sliders-horizontal', alabanza: 'music-notes', presentador: 'hand-pointing', orden: 'list-numbers', proyeccion: 'monitor', preparacion: 'list-plus', administrar: 'key' };
// Las que usa cualquiera de la lista (la de proyección y, en la nube, preparar el culto).
const FOR_ALL = ['proyeccion', 'preparacion'];

// El PIN (4 cifras) se escribe en un teclado grande, también con las teclas del teclado, y entra solo
// al teclear la cuarta.
function askPin(role, user) {
  let typed = '';
  let busy = false;
  const dots = h('div', { class: 'pin-dots', role: 'img' });
  const error = h('p', { class: 'pin-error', role: 'alert' });
  const key = (digit) => h('button', { 'aria-label': digit, onclick: () => type(digit) }, digit);
  const box = h('div', { class: 'pin-pad' },
    h('p', {}, `${user.name}, escribe tu PIN. Si no lo sabes, pídeselo al administrador de Manna.`),
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
      await session.open(role.id, typed, user.id);
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

// Administrar, en la nube (fase 36): con la contraseña del administrador, no con el PIN.
function askPassword(role, user) {
  const input = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', 'aria-label': 'Contraseña' });
  const error = h('p', { class: 'pin-error', role: 'alert' });
  dialog(role.name, h('form', { class: 'login-form', onsubmit: async (e) => {
    e.preventDefault();
    try {
      await session.open(role.id, undefined, user.id, input.value);
      location.href = role.path;
    } catch (err) {
      error.textContent = err.message;
      input.select();
    }
  } }, h('p', {}, `${user.name}, escribe tu contraseña.`), input, error, h('button', { class: 'btn primary', type: 'submit' }, 'Entrar')));
}

// La primera vez en la nube, la clave de alta que puso el dueño en el hosting crea el administrador (decisión 62).
function askAlta(role) {
  const field = (label, attrs) => h('label', { class: 'login-field' }, h('span', {}, label), h('input', { class: 'input', ...attrs }));
  const fields = {
    clave: field('Clave de alta', { type: 'password', autocomplete: 'off' }),
    name: field('Tu nombre', { maxLength: 40, autocomplete: 'name', placeholder: 'Por ejemplo, Ana' }),
    pin: field('Tu PIN, para preparar el culto', { inputMode: 'numeric', pattern: '[0-9]*', maxLength: 4, autocomplete: 'off', placeholder: '4 números' }),
    password: field('Tu contraseña, para administrar', { type: 'password', autocomplete: 'new-password', placeholder: 'Al menos 10 caracteres' }),
  };
  const value = (id) => fields[id].querySelector('input').value;
  const error = h('p', { class: 'pin-error', role: 'alert' });
  dialog(role.name, h('form', { class: 'login-form', onsubmit: async (e) => {
    e.preventDefault();
    try {
      await session.alta({ clave: value('clave'), name: value('name'), pin: value('pin'), password: value('password') });
      location.href = role.path;
    } catch (err) {
      error.textContent = err.message;
    }
  } }, h('p', {}, 'Es la primera vez: escribe la clave de alta que te dio quien instaló Manna y crea tu cuenta de administrador. La clave sirve una sola vez.'),
  ...Object.values(fields), error, h('button', { class: 'btn primary', type: 'submit' }, 'Crear el administrador')));
}

// Quién eres: los nombres de quienes pueden usar esa función (administrar, solo los administradores).
function askWho(role) {
  const people = info.users.filter((u) => (role.id === 'administrar' ? u.admin : FOR_ALL.includes(role.id) || u.functions.includes(role.id)));
  const { close } = dialog(role.name, people.length
    ? h('div', { class: 'people', role: 'list', 'aria-label': '¿Quién eres?' }, ...people.map((user) => h('button', { class: 'person', role: 'listitem', onclick: () => { close(); (role.id === 'administrar' ? askPassword : askPin)(role, user); } },
      h('span', { class: 'initial', 'aria-hidden': 'true' }, user.name.slice(0, 1).toUpperCase()), h('span', { class: 'name' }, user.name))))
    : h('p', { class: 'empty' }, `Nadie puede usar «${role.name}» todavía. Se lo da el administrador, en Ajustes → Usuarios.`));
}

async function enter(role) {
  try {
    await session.open(role.id, undefined, info.user?.id);
    location.href = role.path;
  } catch (err) {
    toast(err.message, 'error');
  }
}

let switching = false; // «Entrar como otra persona»
// Quien ya entró usa sin PIN las funciones que tiene. Administrar pide siempre la contraseña.
const mine = (role) => Boolean(info.user) && role.id !== 'administrar' && (FOR_ALL.includes(role.id) || Boolean(info.users.find((u) => u.id === info.user.id)?.functions.includes(role.id)));
async function choose(role) {
  if (!role.requiresPin) {
    location.href = role.path;
    return;
  }
  if (role.id === 'administrar' && info.alta) return askAlta(role);
  if (info.isLocal || (!switching && mine(role))) return enter(role);
  askWho(role);
}

if (info.user && !info.isLocal) {
  const who = $('#who');
  who.hidden = false;
  who.append(`Entraste como ${info.user.name} · `, h('button', { onclick: () => { switching = true; who.firstChild.textContent = 'Elige la función y luego tu nombre · '; } }, 'Entrar como otra persona'));
}

$('#roles').append(...info.roles.map((role) => {
  const current = info.role === role.id;
  const asks = role.requiresPin && !info.isLocal && !mine(role);
  return h('button', { class: `role${current ? ' current' : ''}`, onclick: () => choose(role) },
    h('span', { class: 'role-icon' }, icon(ICONS[role.id] || 'monitor', 22)),
    h('span', { class: 'role-text' }, h('strong', {}, role.name), h('span', {}, role.description)),
    h('span', { class: `tag${asks && !current ? ' asks' : ''}` }, current ? 'Función actual' : role.id === 'administrar' ? 'Contraseña' : asks ? 'Pide PIN' : 'Sin PIN'));
}));

// Si llegó aquí rebotado desde una página de control, entra directo (o pide el PIN de esa función).
const wanted = back && info.roles.find((r) => r.path === back);
if (wanted && info.role !== wanted.id) choose(wanted);
