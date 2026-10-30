import { action, connectionId, connectionIsLocal, connectionRole, onConnection, onSignal, subscribe } from '../../core/api.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { registerKind } from '../../core/kinds.js';
import { notaMando } from '../projection/slot.js';

// S35 · compartir una pestaña de Chrome en el proyector (ver server/modules/web/share.js). Quien comparte es el control
// del equipo principal: captura la pestaña (Chrome pregunta cuál, cada vez) y la manda por WebRTC a cada pantalla de
// proyección de este equipo que se la pida. Las dos puntas están en el mismo equipo: no hace falta ningún servidor
// de fuera. Cada lado espera a tener sus direcciones antes de mandar lo suyo, así basta un mensaje de cada lado.
const signal = (body) => fetch('/api/web/share/signal', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: connectionId(), ...body }) }).catch(() => {});
const gathered = (pc) => new Promise((resolve) => {
  if (pc.iceGatheringState === 'complete') resolve();
  pc.addEventListener('icegatheringstatechange', () => pc.iceGatheringState === 'complete' && resolve());
  setTimeout(resolve, 3000);
});

// ---- Quien comparte ----
let sharing = null; // { id, key, stream, peers: Map(conexión -> RTCPeerConnection) }

// Solo en el equipo principal y abierto en localhost: Chrome no deja capturar en una dirección que no sea segura.
export const canShare = () => connectionIsLocal() && Boolean(navigator.mediaDevices?.getDisplayMedia);

function end() {
  sharing?.stream.getTracks().forEach((t) => t.stop());
  sharing?.peers.forEach((pc) => pc.close());
  sharing = null;
}

export async function share() {
  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false,
      selfBrowserSurface: 'exclude', surfaceSwitching: 'include', monitorTypeSurfaces: 'exclude' });
  } catch (e) {
    if (e.name === 'NotAllowedError') return; // cerró el selector sin elegir
    throw new Error('Chrome no dejó compartir la pestaña.');
  }
  end();
  const [track] = stream.getVideoTracks();
  track.contentHint = 'detail'; // la letra nítida antes que el movimiento suave
  track.addEventListener('ended', () => action('web.shareStop').catch(() => {}));
  sharing = { stream, peers: new Map() };
  try {
    Object.assign(sharing, await action('web.share', { conn: connectionId() }));
  } catch (e) {
    end();
    throw e;
  }
}

// Se dejó de compartir (aquí, desde la barra de Chrome o desde otro dispositivo): se suelta la captura.
subscribe('web', (web) => { if (sharing?.id && web?.share?.id !== sharing.id) end(); });
// Al volver a conectarse, Manna se entera de por dónde avisarle.
onConnection((online) => { if (online && sharing?.key) signal({ key: sharing.key }); });

// ---- Una pantalla de proyección ----
const offers = new Map(); // id de lo compartido -> qué hacer con la oferta

function receive(id, video) {
  let pc = null;
  let tries = 0;
  // Se pide hasta que llega la oferta: quien comparte pudo no estar listo todavía.
  const ask = () => {
    tries += 1;
    if (tries > 10) clearInterval(retry);
    else signal({ data: { want: true } });
  };
  const retry = setInterval(ask, 2000);
  offers.set(id, async (offer) => {
    clearInterval(retry);
    pc?.close();
    const mine = new RTCPeerConnection();
    pc = mine;
    mine.addEventListener('track', (e) => {
      video.srcObject = e.streams[0];
      video.play().catch(() => {}); // con solo autoplay se quedaba en pausa en la pantalla de proyección
    });
    await mine.setRemoteDescription(offer);
    await mine.setLocalDescription(await mine.createAnswer());
    await gathered(mine);
    if (pc === mine) signal({ data: { answer: mine.localDescription } });
  });
  ask();
  return () => {
    clearInterval(retry);
    offers.delete(id);
    pc?.close();
    video.srcObject = null;
  };
}

onSignal(async ({ share: id, from, data }) => {
  if (data?.offer) return offers.get(id)?.(data.offer);
  if (data?.answer) return sharing?.peers.get(from)?.setRemoteDescription(data.answer).catch(() => {});
  if (!data?.want || !sharing) return;
  const { stream, peers } = sharing;
  peers.get(from)?.close();
  const pc = new RTCPeerConnection();
  peers.set(from, pc);
  stream.getTracks().forEach((t) => pc.addTrack(t, stream));
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  if (sharing?.key && peers.get(from) === pc) signal({ key: sharing.key, to: from, data: { offer: pc.localDescription } });
});

registerKind('share', {
  icon: 'screencast',
  label: 'Pestaña compartida',
  title: () => 'Pestaña compartida',
  key: (item) => item.id,
  background: false,
  slot(host) {
    host.replaceChildren(notaMando('Sin mandos. Se detiene en Páginas web.'));
    return {};
  },

  // La recibe solo una pantalla de proyección del equipo principal; las demás y las miniaturas ven una tarjeta.
  draw(host, { thumbnail }) {
    if (thumbnail || connectionRole() !== 'proyeccion' || !connectionIsLocal()) {
      host.replaceChildren(h('div', { class: 'web-card' }, icon('screencast', 48), h('strong', {}, 'Pestaña compartida'), h('small', {}, 'Se ve en el proyector')));
      return { update() {} };
    }
    const video = h('video', { class: 'share-video', autoplay: true, muted: true, playsInline: true });
    host.replaceChildren(video);
    let id = null;
    let stop = null;
    return {
      update(item) {
        if (item.id === id) return;
        stop?.();
        id = item.id;
        stop = receive(id, video);
      },
      destroy: () => stop?.(),
    };
  },
});
