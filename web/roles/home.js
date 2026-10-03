import { session } from '../core/api.js';
import { $, h, dialog, toast } from '../core/dom.js';

// Pantalla de inicio: cada dispositivo elige su función. Las de control piden el PIN una vez.
const info = await session.get();
const back = new URLSearchParams(location.search).get('volver');

function askPin(role) {
  const input = h('input', { class: 'input', type: 'password', inputMode: 'numeric', autocomplete: 'off', placeholder: 'PIN', maxLength: 8 });
  const error = h('p', { class: 'muted', style: 'color: var(--danger); min-height: 1.4em; margin: 8px 0;' });
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      try {
        await session.open(role.id, input.value);
        location.href = role.path;
      } catch (err) {
        error.textContent = err.message;
        input.select();
      }
    },
  },
  h('p', { class: 'muted', style: 'margin-top: 0;' }, 'Escribe el PIN que aparece en el equipo principal (botón "Dispositivos").'),
  input, error,
  h('button', { class: 'btn primary big', style: 'width: 100%;' }, 'Entrar'));
  dialog(role.name, form);
  input.focus();
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
  return h('button', { class: `role${current ? ' current' : ''}`, onclick: () => choose(role) },
    h('h2', {}, role.name,
      h('span', { class: 'tag' }, current ? 'Función actual' : role.requiresPin && !info.isLocal ? 'Requiere PIN' : 'Libre')),
    h('p', {}, role.description));
}));

// Si llegó aquí rebotado desde una página de control, entra directo (o pide el PIN de esa función).
const wanted = back && info.roles.find((r) => r.path === back);
if (wanted && info.role !== wanted.id) choose(wanted);
