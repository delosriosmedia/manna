import { action, subscribe } from '../../core/api.js';
import { h, dialog, guard, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';

// Ajustes → Usuarios (fase 35): cada persona entra con su nombre y su PIN, y solo en las funciones que tenga. Solo lo
// ve el administrador. Los PIN nunca vuelven del servidor: aquí solo se escriben.
const FUNCTIONS = [['control', 'Control completo'], ['alabanza', 'Servicio de alabanza'], ['orden', 'Control del orden'], ['presentador', 'Presentador']];
const NAMES = Object.fromEntries(FUNCTIONS);

function pinInput(label) {
  const input = h('input', { class: 'input', inputMode: 'numeric', pattern: '[0-9]*', maxLength: 4, autocomplete: 'off', placeholder: '4 números', 'aria-label': label,
    oninput: () => { input.value = input.value.replace(/\D/g, '').slice(0, 4); } });
  return input;
}

const buttons = (box, label, save) => h('div', { class: 'row', style: 'justify-content: flex-end; margin-top: 14px;' },
  h('button', { class: 'btn', onclick: () => box().close() }, 'Cancelar'),
  h('button', { class: 'btn primary', onclick: save }, label));

export function usersBody(me) {
  const list = h('div', { class: 'user-list' });
  subscribe('users', ({ list: users = [] }) => {
    list.replaceChildren(...users.map((u) => h('div', { class: 'user-row', dataset: { id: u.id } },
      h('span', { class: 'initial', 'aria-hidden': 'true' }, u.name.slice(0, 1).toUpperCase()),
      h('span', { class: 'item-text' }, h('strong', {}, u.name, u.id === me?.id ? ' (tú)' : ''),
        h('small', {}, u.admin ? 'Administrador · todas las funciones' : u.functions.map((f) => NAMES[f]).join(' · '))),
      h('button', { class: 'icon-btn sm', title: 'Cambiar', 'aria-label': `Cambiar a ${u.name}`, onclick: () => edit(u) }, icon('pencil-simple', 15)),
      h('button', { class: 'icon-btn sm', title: 'Cambiar el PIN', 'aria-label': `Cambiar el PIN de ${u.name}`, onclick: () => changePin(u) }, icon('key', 15)),
      h('button', { class: 'icon-btn sm', title: u.id === me?.id ? 'No puedes quitarte a ti mismo' : 'Quitar', 'aria-label': `Quitar a ${u.name}`, disabled: u.id === me?.id, onclick: () => remove(u) }, icon('trash', 15)))));
  });

  // Nuevo (user null) o cambiar nombre, funciones y si es administrador. El administrador tiene todas las funciones.
  function edit(user) {
    const name = h('input', { class: 'input', maxLength: 40, value: user?.name || '', placeholder: 'Por ejemplo, Ana', 'aria-label': 'Nombre' });
    const pin = !user && pinInput('PIN');
    const checks = FUNCTIONS.map(([id, label]) => ({ id, label, input: h('input', { type: 'checkbox', checked: user ? user.functions.includes(id) : id === 'orden' }) }));
    const admin = h('input', { type: 'checkbox', checked: Boolean(user?.admin), onchange: () => paint() });
    const paint = () => { for (const c of checks) { c.input.disabled = admin.checked; if (admin.checked) c.input.checked = true; } };
    const save = guard(async () => {
      const payload = { name: name.value, admin: admin.checked, functions: checks.filter((c) => c.input.checked).map((c) => c.id) };
      if (user) await action('users.update', { id: user.id, ...payload });
      else await action('users.create', { ...payload, pin: pin.value });
      box.close();
      toast(user ? 'Cambios guardados.' : `${name.value.trim()} ya puede entrar con su nombre y su PIN.`);
    });
    const box = dialog(user ? `Cambiar a ${user.name}` : 'Nuevo usuario',
      h('div', { class: 'user-form' },
        h('label', { class: 'user-field' }, h('span', {}, 'Nombre'), name),
        pin && h('label', { class: 'user-field' }, h('span', {}, 'PIN'), pin),
        h('fieldset', { class: 'user-functions' }, h('legend', {}, 'Puede usar'),
          ...checks.map((c) => h('label', { class: 'row' }, c.input, h('span', {}, c.label)))),
        h('label', { class: 'row' }, admin, h('span', {}, 'Administrador: ve y cambia todos los órdenes, entra en Ajustes y gestiona los usuarios'))),
      buttons(() => box, 'Guardar', save));
    paint();
    name.focus();
  }

  function changePin(user) {
    const pin = pinInput('PIN nuevo');
    const save = guard(async () => {
      await action('users.setPin', { id: user.id, pin: pin.value });
      box.close();
      toast(user.id === me?.id ? 'PIN cambiado.' : `PIN cambiado. ${user.name} tendrá que entrar de nuevo con el nuevo.`);
    });
    pin.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    const box = dialog(`PIN de ${user.name}`,
      h('label', { class: 'user-field' }, h('span', {}, 'PIN nuevo'), pin),
      buttons(() => box, 'Cambiar', save));
  }

  function remove(user) {
    const box = dialog(`Quitar a ${user.name}`,
      h('p', {}, `${user.name} ya no podrá entrar, y los dispositivos donde haya entrado se cierran.`),
      buttons(() => box, 'Quitar', guard(async () => {
        await action('users.remove', { id: user.id });
        box.close();
        toast(`${user.name} ya no está en la lista.`);
      })));
  }

  return [list, h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => edit(null) }, icon('user-plus', 16), 'Añadir usuario'))];
}
