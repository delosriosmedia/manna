import { api } from './api.js';

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

// El código QR lleva la dirección numérica porque funciona en cualquier dispositivo. Pero esa
// dirección puede cambiar si el router se reinicia. Si este dispositivo sabe abrir la dirección
// con nombre ("manna.local"), se pasa a ella: así la conexión y el PIN sobreviven a un cambio de IP.
// info: lo que devuelve GET /api/session ({ nameUrl, serverId }).
export async function preferStableAddress({ nameUrl, serverId }) {
  if (!nameUrl || !IPV4.test(location.hostname) || location.hostname.startsWith('127.')) return;
  // Quien entró por https (un televisor que no admite otra cosa) se queda donde está: la dirección
  // con nombre se ofrece por http y el navegador no dejaría ni comprobarla.
  if (location.protocol !== 'http:') return;
  try {
    const ping = await api(`${nameUrl}/api/ping`, { timeout: 2500, cache: 'no-store' });
    // Otro Manna de la misma red podría tener ese nombre: solo vale si es este mismo servidor.
    if (ping.id !== serverId) return;
    // Si la persona ya está escribiendo el PIN, no se le cambia la página.
    if (document.querySelector('.modal-backdrop')) return;
    location.replace(nameUrl + location.pathname + location.search);
  } catch { /* este dispositivo no entiende nombres .local: sigue con la dirección numérica */ }
}
