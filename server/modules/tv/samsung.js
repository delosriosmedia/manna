import { openWebSocket } from '../../core/ws.js';

// Televisores Samsung (Tizen, 2016 en adelante), gobernados por la red local:
//   - Datos del televisor y abrir una aplicación:  http://TV:8001/api/v2/
//   - Mando a distancia (teclas, puntero, texto):  wss://TV:8002/api/v2/channels/samsung.remote.control
// El mando pide permiso la primera vez: el televisor muestra un aviso y, al aceptarlo, entrega una
// clave ("token") con la que las siguientes conexiones entran sin preguntar.
//
// Lo que NO permite (comprobado en un modelo de 2025): decirle al navegador qué dirección abrir.
// Por eso Manna abre el navegador y, la primera vez, escribe la dirección como lo haría un teclado.

// La aplicación "Internet" del televisor: su identificador actual y el de los modelos antiguos.
const BROWSERS = ['3202010022079', 'org.tizen.browser'];

// Las únicas teclas que Manna envía: moverse, aceptar, volver y el volumen.
export const KEYS = {
  up: 'KEY_UP', down: 'KEY_DOWN', left: 'KEY_LEFT', right: 'KEY_RIGHT',
  ok: 'KEY_ENTER', back: 'KEY_RETURN', home: 'KEY_HOME',
  volup: 'KEY_VOLUP', voldown: 'KEY_VOLDOWN', mute: 'KEY_MUTE',
};

const INFO_MS = 2500;
const PAIR_MS = 45_000;   // tiempo para aceptar el aviso en el televisor
const CONNECT_MS = 6000;
const IDLE_MS = 30_000;   // el mando se suelta si no se usa

// El televisor entrega su nombre preparado para una página web ("55&quot; Neo QLED").
const ENTITIES = { '&quot;': '"', '&amp;': '&', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>' };
const plain = (text) => String(text || '').replace(/&(quot|amp|#39|apos|lt|gt);/g, (m) => ENTITIES[m]);

export class TvError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// endpoints: solo para pruebas, cambia a dónde se conecta ({ rest, ws }).
export function createSamsung({ ip, token = null, endpoints = null, onToken = () => {} }) {
  const rest = endpoints?.rest || `http://${ip}:8001`;
  const wsBase = endpoints?.ws || `wss://${ip}:8002`;
  let channel = null;
  let opening = null;
  let idle = null;

  async function call(pathname, { method = 'GET', timeout = INFO_MS } = {}) {
    const res = await fetch(`${rest}/api/v2/${pathname}`, { method, signal: AbortSignal.timeout(timeout) });
    if (!res.ok) throw new TvError('rest', `El televisor respondió ${res.status}.`);
    return res.json();
  }

  // Datos básicos, o null si en esa dirección no hay un televisor Samsung encendido.
  async function info() {
    try {
      const { device } = await call('');
      if (!device) return null;
      return {
        name: plain(device.name || device.modelName || 'Televisor').slice(0, 60),
        model: plain(device.modelName).slice(0, 40),
        on: device.PowerState !== 'standby',
      };
    } catch {
      return null;
    }
  }

  function connect(wait) {
    const name = Buffer.from('Manna').toString('base64');
    const url = `${wsBase}/api/v2/channels/samsung.remote.control?name=${name}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
    return openWebSocket(url, { insecure: true }).then((socket) => new Promise((resolve, reject) => {
      const fail = (code, message) => {
        clearTimeout(timer);
        reject(new TvError(code, message)); // antes de cerrar: al cerrar se avisa otra vez, y vale el primer motivo
        socket.close();
      };
      const timer = setTimeout(() => fail('timeout', 'Nadie aceptó el aviso en el televisor.'), wait);
      socket.on('close', () => fail('closed', 'El televisor cerró la conexión.'));
      socket.on('message', (text) => {
        let msg = {};
        try { msg = JSON.parse(text); } catch { /* no es para nosotros */ }
        if (msg.event === 'ms.channel.connect') {
          clearTimeout(timer);
          const fresh = msg.data?.token ? String(msg.data.token) : null;
          if (fresh && fresh !== token) {
            token = fresh;
            onToken(fresh);
          }
          resolve(socket);
        } else if (msg.event === 'ms.channel.unauthorized' || msg.event === 'ms.channel.timeOut') {
          fail('unauthorized', 'El televisor no dio permiso.');
        }
      });
    }), (err) => { throw new TvError('unreachable', err?.message || 'No se pudo conectar con el televisor.'); });
  }

  function keep(socket) {
    channel = socket;
    socket.on('close', () => { if (channel === socket) channel = null; });
    touch();
  }
  function touch() {
    clearTimeout(idle);
    idle = setTimeout(close, IDLE_MS);
    idle.unref?.();
  }

  async function remote(params) {
    if (!channel) {
      opening ||= connect(CONNECT_MS).then((socket) => { keep(socket); }).finally(() => { opening = null; });
      await opening;
    }
    if (!channel) throw new TvError('closed', 'El televisor cerró la conexión.');
    touch();
    channel.send(JSON.stringify({ method: 'ms.remote.control', params }));
  }

  // Pide permiso al televisor (muestra un aviso en su pantalla) y guarda la clave que entrega.
  async function pair() {
    close();
    keep(await connect(PAIR_MS));
    return token;
  }

  async function openBrowser() {
    for (const id of BROWSERS) {
      try {
        await call(`applications/${id}`, { method: 'POST', timeout: 8000 });
        return true;
      } catch { /* ese identificador no existe en este modelo: se prueba el otro */ }
    }
    throw new TvError('browser', 'No se pudo abrir el navegador del televisor.');
  }

  // Quita el navegador de la vista: el televisor vuelve a lo que tenía antes.
  async function closeBrowser() {
    for (const id of BROWSERS) {
      try {
        await call(`applications/${id}`, { method: 'DELETE', timeout: 8000 });
        return true;
      } catch { /* se prueba el siguiente */ }
    }
    throw new TvError('browser', 'No se pudo cerrar el navegador del televisor.');
  }

  // 'open' (a la vista), 'hidden' (abierto pero detrás de otra cosa), 'closed', o null si no se sabe.
  async function browser() {
    for (const id of BROWSERS) {
      try {
        const app = await call(`applications/${id}`);
        return app.visible ? 'open' : app.running ? 'hidden' : 'closed';
      } catch { /* se prueba el siguiente */ }
    }
    return null;
  }

  function close() {
    clearTimeout(idle);
    channel?.close();
    channel = null;
  }

  return {
    info, pair, openBrowser, closeBrowser, browser, close,
    get paired() { return Boolean(token); },
    key: (name) => remote({ Cmd: 'Click', DataOfCmd: KEYS[name], Option: 'false', TypeOfRemote: 'SendRemoteKey' }),
    move: (x, y) => remote({ Cmd: 'Move', Position: { x, y, Time: '0' }, TypeOfRemote: 'ProcessMouseDevice' }),
    click: () => remote({ Cmd: 'LeftClick', TypeOfRemote: 'ProcessMouseDevice' }),
    // Escribe en el campo que el televisor tenga abierto con su teclado en pantalla.
    async text(value, { done = false } = {}) {
      await remote({ Cmd: Buffer.from(value, 'utf8').toString('base64'), DataOfCmd: 'base64', TypeOfRemote: 'SendInputString' });
      if (done) await remote({ TypeOfRemote: 'SendInputEnd' });
    },
  };
}
