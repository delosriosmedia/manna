import { api, session } from '../core/api.js';
import { $, h, dialog, toast } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { preferStableAddress } from '../core/upgrade.js';
import { newer } from '../core/versiones.js';

// Pantalla de inicio: cada dispositivo elige su función. Las de control piden, una vez, quién eres (tu nombre, de una
// lista) y tu PIN (fase 35); quien ya entró cambia de función sin volver a escribirlo.
const info = await session.get();
preferStableAddress(info);
$('#version').textContent = `Church projection app${info.version ? ` · ${info.version}` : ''}`;
const back = new URLSearchParams(location.search).get('volver');
const ICONS = { control: 'sliders-horizontal', alabanza: 'music-notes', presentador: 'hand-pointing', orden: 'list-numbers', proyeccion: 'monitor', preparacion: 'list-plus', administrar: 'key', superadmin: 'key' };
// Las que usa cualquiera de la lista (la de proyección y, en la nube, preparar el culto).
const FOR_ALL = ['proyeccion', 'preparacion'];

// El PIN (4 cifras) se escribe en un teclado grande, también con las teclas del teclado, y entra solo
// al teclear la cuarta.
// done: lo que se hace al entrar (si no, se va a la página de la función).
function askPin(role, user, done = () => { location.href = role.path; }) {
  let typed = '';
  let busy = false;
  const dots = h('div', { class: 'pin-dots', role: 'img' });
  const error = h('p', { class: 'pin-error', role: 'alert' });
  // Al apoyar el dedo, no al soltarlo: así se siente al instante. El clic que llega justo después no cuenta otra vez;
  // uno sin dedo antes (el teclado, un lector de pantalla) sí.
  let pressed = 0;
  const press = (fn) => ({ onpointerdown: (e) => { e.preventDefault(); pressed = Date.now(); fn(); }, onclick: () => { if (Date.now() - pressed > 600) fn(); } });
  const key = (digit) => h('button', { 'aria-label': digit, ...press(() => type(digit)) }, digit);
  const box = h('div', { class: 'pin-pad' },
    h('p', {}, `${user.name}, escribe tu PIN. Si no lo sabes, pídeselo al administrador de Manna.`),
    dots, error,
    h('div', { class: 'pin-keys' }, ...'123456789'.split('').map(key),
      h('span', {}), key('0'), h('button', { 'aria-label': 'Borrar', ...press(() => erase()) }, icon('arrow-left', 22))));
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
      done();
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

// La primera vez en la nube, la clave de alta que puso el dueño en el hosting crea el administrador (decisión 62), con
// su PIN; en el sitio del superadministrador (fase 39), su cuenta, con una contraseña.
function askAlta(role) {
  const sup = role.id === 'superadmin';
  const field = (label, attrs) => h('label', { class: 'login-field' }, h('span', {}, label), h('input', { class: 'input', ...attrs }));
  const fields = {
    clave: field('Clave de alta', { type: 'password', autocomplete: 'off' }),
    name: field('Tu nombre', { maxLength: 40, autocomplete: 'name', placeholder: 'Por ejemplo, Ana' }),
    ...(sup ? { password: field('Tu contraseña', { type: 'password', autocomplete: 'new-password', placeholder: 'Al menos 10 caracteres' }) }
      : { pin: field('Tu PIN, para preparar y administrar', { inputMode: 'numeric', pattern: '[0-9]*', maxLength: 4, autocomplete: 'off', placeholder: '4 números' }) }),
  };
  const value = (id) => fields[id]?.querySelector('input').value;
  const error = h('p', { class: 'pin-error', role: 'alert' });
  dialog(role.name, h('form', { class: 'login-form', onsubmit: async (e) => {
    e.preventDefault();
    try {
      await session.alta({ clave: value('clave'), name: value('name'), pin: value('pin'), password: value('password') });
      location.href = role.path;
    } catch (err) {
      error.textContent = err.message;
    }
  } }, h('p', {}, `Es la primera vez: escribe la clave de alta que te dio quien instaló Manna y crea tu cuenta de ${sup ? 'superadministrador' : 'administrador'}. La clave sirve una sola vez.`),
  ...Object.values(fields), error, h('button', { class: 'btn primary', type: 'submit' }, sup ? 'Crear el superadministrador' : 'Crear el administrador')));
}

// El superadministrador entra con su contraseña (fase 39, decisión 64).
function askPassword(role) {
  const input = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', 'aria-label': 'Contraseña' });
  const error = h('p', { class: 'pin-error', role: 'alert' });
  dialog(role.name, h('form', { class: 'login-form', onsubmit: async (e) => {
    e.preventDefault();
    try {
      await session.open(role.id, undefined, undefined, input.value);
      location.href = role.path;
    } catch (err) {
      error.textContent = err.message;
      input.select();
    }
  } }, h('p', {}, 'Escribe tu contraseña.'), input, error, h('button', { class: 'btn primary', type: 'submit' }, 'Entrar')));
  input.focus();
}

// Quién eres: los nombres de quienes pueden usar esa función (administrar, solo los administradores).
function askWho(role, done) {
  const people = info.users.filter((u) => (role.id === 'administrar' ? u.admin : FOR_ALL.includes(role.id) || u.functions.includes(role.id)));
  const { close } = dialog(role.name, people.length
    ? h('div', { class: 'people', role: 'list', 'aria-label': '¿Quién eres?' }, ...people.map((user) => h('button', { class: 'person', role: 'listitem', onclick: () => { close(); askPin(role, user, done); } },
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
// Quien ya entró usa sin PIN las funciones que tiene (Administrar, si es administrador).
const me = info.user && info.users.find((u) => u.id === info.user.id);
const mine = (role) => Boolean(me) && (role.id === 'administrar' ? me.admin : FOR_ALL.includes(role.id) || me.functions.includes(role.id));
async function choose(role) {
  if (!role.requiresPin) {
    location.href = role.path;
    return;
  }
  if (role.id === 'superadmin') return info.alta ? askAlta(role) : askPassword(role);
  if (role.id === 'administrar' && info.alta) return askAlta(role);
  if (info.isLocal || (!switching && mine(role))) return enter(role);
  askWho(role);
}

if (info.user && !info.isLocal) {
  const who = $('#who');
  who.hidden = false;
  who.append(`Entraste como ${info.user.name} · `, h('button', { onclick: () => { switching = true; who.firstChild.textContent = 'Elige la función y luego tu nombre · '; } }, 'Entrar como otra persona'));
}

// Una iglesia suspendida por el superadministrador (fase 39): su nube no deja entrar.
if (info.church?.active === false) $('#roles').append(h('p', { class: 'empty' }, 'Esta iglesia está suspendida en Manna Iglesia. Su equipo de la iglesia sigue funcionando; pregunta a quien administra Manna Iglesia.'));
else $('#roles').append(...info.roles.map((role) => {
  const current = info.role === role.id;
  const asks = role.requiresPin && !info.isLocal && !mine(role);
  return h('button', { class: `role${current ? ' current' : ''}`, onclick: () => choose(role) },
    h('span', { class: 'role-icon' }, icon(ICONS[role.id] || 'monitor', 22)),
    h('span', { class: 'role-text' }, h('strong', {}, role.name), h('span', {}, role.description)),
    h('span', { class: `tag${asks && !current ? ' asks' : ''}` }, current ? 'Función actual' : role.id === 'superadmin' ? 'Contraseña' : asks ? 'Pide PIN' : 'Sin PIN'));
}));

// Si llegó aquí rebotado desde una página de control, entra directo (o pide el PIN de esa función).
const wanted = back && info.roles.find((r) => r.path === back);
if (wanted && info.role !== wanted.id) choose(wanted);

// En la nube, en un computador (decisión 64): instalar Manna para que este sea el equipo principal de la iglesia, con
// el PIN de un administrador. El instalador se baja ya emparejado con esta nube (el código va en su nombre). Si ya se
// instaló desde este navegador y ese equipo sigue siendo el oficial, «Instalar» queda deshabilitado y «Abrir Manna» lo
// enciende con el enlace manna:// que registra el instalador. En el celular y la tableta no sale: ahí no se instala.
const SYSTEM = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? null
  : /Windows/.test(navigator.userAgent) ? 'windows' : /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints < 2 ? 'mac' : null;
const INSTALLED = 'manna.instalacion'; // el número de la instalación bajada desde aquí
const stored = () => { try { return localStorage.getItem(INSTALLED); } catch { return null; } };
const installState = async () => (stored() ? api(`/api/nube/instalado?id=${stored()}`).catch(() => ({})) : {});
const installedHere = async () => (await installState()).installed === true;
const card = (glyph, title, text, tag, onclick) => h('button', { class: 'role install-role', disabled: !onclick, onclick },
  h('span', { class: 'role-icon' }, icon(glyph, 22)), h('span', { class: 'role-text' }, h('strong', {}, title), h('span', {}, text)), tag && h('span', { class: 'tag asks' }, tag));

// front: lo que dijo la portada (abajo). Con el equipo de la iglesia encendido en este mismo computador, «Abrir» sobra.
async function installCards(front = {}) {
  const { installed, version, latest } = await installState();
  // Con una versión nueva en la nube (decisión 58: la nube va primero), «Actualizar» en lugar de «Instalar».
  const update = installed && version && latest && newer(latest, version);
  $('#roles').querySelectorAll('.install-role').forEach((el) => el.remove());
  $('#roles').append(...(installed
    ? [!(front.online && front.here) && card('power', 'Abrir Manna en este equipo', 'Enciende Manna en este computador, el equipo principal de la iglesia.', null, () => { location.href = 'manna://abrir'; }),
      update ? card('arrow-clockwise', 'Actualizar Manna en este equipo', `Hay una versión nueva, la ${latest}; este equipo tiene la ${version}.`, null, () => updateHere())
        : card('download-simple', 'Instalar Manna en este equipo', 'Ya está instalado en este equipo.', null, null)]
    : [card('download-simple', 'Instalar Manna en este equipo', 'Para que este computador sea el equipo principal de la iglesia, el que proyecta en el culto.', 'Pide PIN', () => startInstall())]).filter(Boolean));
}

// El instalador de siempre: pone Manna al día sin tocar los datos ni el contenido, y lo vuelve a abrir.
function updateHere() {
  location.href = `/api/nube/actualizador?so=${SYSTEM}`;
  const box = dialog('Actualizar Manna', h('div', { class: 'login-form' },
    h('p', {}, `Abre el instalador cuando termine de bajar${SYSTEM === 'windows' ? ' (si Windows avisa, pulsa «Más información» y «Ejecutar de todas formas»)' : ''}. Pone Manna al día y lo vuelve a abrir, sin tocar los datos ni el contenido de la iglesia. Mientras tanto, Manna se cierra un momento: no lo hagas durante un culto.`),
    h('button', { class: 'btn primary', onclick: () => box.close() }, 'Entendido')));
}

function startInstall() {
  const admin = info.roles.find((r) => r.id === 'administrar');
  if (info.role === 'administrar') return installDialog();
  if (me?.admin) return session.open('administrar', undefined, me.id).then(installDialog, (err) => toast(err.message, 'error'));
  return askWho(admin, () => installDialog());
}

async function installDialog() {
  // Con la sesión de administrar, el estado dice cuál es hoy el equipo oficial.
  const official = (await api('/api/state').catch(() => ({}))).cloud?.official;
  let hymnal = 'nube';
  const choice = (id, title, text) => h('label', { class: 'install-choice' },
    h('input', { type: 'radio', name: 'himnario', value: id, checked: id === hymnal, onchange: () => { hymnal = id; } }),
    h('span', {}, h('strong', {}, title), h('small', {}, text)));
  const after = h('p', { class: 'install-after', role: 'status', hidden: true });
  const download = h('button', { class: 'btn primary', onclick: () => {
    const id = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(INSTALLED, id); } catch { /* sin guardar: la portada volverá a ofrecer instalar */ }
    location.href = `/api/nube/instalador?so=${SYSTEM}&himnario=${hymnal}&id=${id}`;
    after.hidden = false;
    after.textContent = `Abre el instalador cuando termine de bajar${SYSTEM === 'windows' ? ' (si Windows avisa, pulsa «Más información» y «Ejecutar de todas formas»)' : ' y sigue sus pasos'}. Al terminar, Manna se abre solo como el equipo principal de la iglesia.`;
    const wait = setInterval(async () => {
      if (!box.el.isConnected) return clearInterval(wait);
      if (!(await installedHere())) return undefined;
      clearInterval(wait);
      after.textContent = 'Listo: Manna quedó instalado en este equipo, y es el equipo principal de la iglesia.';
      return installCards();
    }, 5000);
  } }, icon('download-simple', 16), 'Descargar el instalador');
  const box = dialog('Instalar Manna en este equipo', h('div', { class: 'login-form' },
    official && h('p', { class: 'install-warn' }, `«${official.name}» es hoy el equipo principal de la iglesia. Si instalas Manna aquí, ese quedará bloqueado hasta que se vuelva a emparejar.`),
    h('p', {}, 'Este computador será el equipo principal: el que proyecta en el culto, aunque no haya internet. ¿Cómo quieres el himnario?'),
    choice('nube', 'Desde la nube', 'Los himnos de los órdenes se bajan antes del culto; cualquier otro, al usarlo, con internet.'),
    choice('completo', 'Completo en este equipo', 'Cantados, pistas, letras y diapositivas: unos 6 GB, que se bajan en segundo plano.'),
    download, after));
}

// La portada (fase 37, parte 6): si el equipo de la iglesia está encendido, se ofrece entrar en él, directo si se está en
// su red (sin pasar por internet) y si no por su conexión por internet; si está apagado, se dice y queda Preparar.
async function frontPage() {
  const front = await api('/api/nube/portada').catch(() => ({}));
  const where = front.online && (front.here || front.tunnel);
  if (where) {
    $('#roles').prepend(h('a', { class: 'role church-role', href: where },
      h('span', { class: 'role-icon' }, icon('house', 22)),
      h('span', { class: 'role-text' }, h('strong', {}, 'Entrar al equipo de la iglesia'),
        h('span', {}, front.here ? 'Estás en la red de la iglesia: entra directo, sin pasar por internet.' : 'Está encendido: entra por su conexión por internet, con tu PIN.'))));
  } else {
    $('#roles').prepend(h('p', { class: 'church-note' }, front.online ? 'El equipo de la iglesia está encendido. Desde fuera de la iglesia, el culto se prepara aquí.'
      : 'El equipo de la iglesia está apagado. Aquí puedes preparar el culto: le llegará cuando se encienda.'));
  }
  return front;
}

if (info.roles.some((r) => r.id === 'preparacion') && info.church?.active !== false) {
  frontPage().then((front) => { if (SYSTEM) installCards(front); });
}
