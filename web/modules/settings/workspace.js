import { action, api, disconnect, state, subscribe } from '../../core/api.js';
import { h, allowLeaving, dialog, go, guard, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { createDisplayToggle, createStylePanel, createTestCardButton, describeDisplay } from '../projection/controls.js';
import { netText } from '../system/conexion.js';
import { openDevicesDialog } from '../system/devices.js';

// Módulo Ajustes: lo que se prepara antes de la reunión y no hace falta tener a mano durante ella.
// Arriba, una fila con sus secciones para ir directo a una; los programas del equipo principal (la
// revisión del equipo) se instalan y se ponen al día desde su sección.
function mount(el, ctx) {
  const styles = h('div', {});
  const displayText = h('p', { class: 'muted' });
  const screens = h('p', { class: 'muted' });
  const tools = h('div', { class: 'tools' });
  const version = h('p', { class: 'version' });
  const net = h('p', { class: 'muted' });
  const netLink = h('a', { target: '_blank', rel: 'noopener' });
  const netAddress = h('p', { class: 'net-address', hidden: true }, netLink,
    h('button', { class: 'btn', onclick: guard(async () => {
      await navigator.clipboard.writeText(netLink.href);
      toast('Dirección copiada.');
    }) }, icon('copy', 15), 'Copiar'));
  const netToggle = h('button', { class: 'btn', onclick: guard(() => action('internet.set', { on: !state.internet?.on })) });
  const netOwn = h('button', { class: 'btn', onclick: () => openOwnTunnel() });

  // Espacio en disco: lo subido o descargado desde Manna, y el botón que lo borra todo.
  const diskList = h('div', { class: 'disk-list' });
  const diskFree = h('p', { class: 'muted' });
  const cleanButton = h('button', { class: 'btn danger', onclick: () => askClean() }, icon('trash', 16), 'Limpiar multimedia temporales');
  let disk = null;

  const nav = h('nav', { class: 'set-nav', 'aria-label': 'Secciones de Ajustes' });
  // short: el nombre corto en la fila de secciones.
  const section = (short, title, hint, ...content) => {
    const box = h('section', { class: 'set' },
      h('div', { class: 'set-title' }, h('h2', {}, title), hint && h('p', { class: 'muted' }, hint)),
      h('div', { class: 'set-body' }, ...content));
    nav.append(h('button', { class: 'btn', onclick: () => box.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }, short));
    return box;
  };

  el.replaceChildren(
    h('div', { class: 'ws-head' }, h('h1', {}, 'Ajustes')),
    nav,
    h('div', { class: 'settings' },
      section('Apariencia', 'Apariencia de la proyección', 'Los cambios se ven al instante en el monitor "Al aire" y en todas las pantallas.', styles),
      section('Proyector', 'Proyector de este equipo', 'La ventana a pantalla completa en la segunda pantalla del equipo principal.',
        displayText, h('div', { class: 'row', style: 'flex-wrap: wrap;' }, createDisplayToggle(), createTestCardButton())),
      section('Dispositivos', 'Dispositivos', 'Celulares, tabletas y otros equipos de la misma red.',
        screens, h('div', { class: 'row' }, h('button', { class: 'btn', onclick: guard(() => openDevicesDialog(ctx.isLocal)) }, icon('qr-code', 16), 'Conectar un dispositivo'))),
      section('Internet', 'Conexión por internet', 'Para usar Manna desde fuera de la iglesia. Desde internet todo pide el PIN, también la pantalla de proyección.',
        net, netAddress, ctx.isLocal && h('div', { class: 'row', style: 'flex-wrap: wrap;' }, netToggle, netOwn)),
      section('Programas', 'Programas del equipo principal', 'Lo que Manna usa para convertir videos, descargar de YouTube y abrir presentaciones. Ninguno que falte impide abrir Manna.',
        tools, h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => go('/requisitos') }, icon('check-circle', 16), 'Revisar el equipo'))),
      section('Disco', 'Espacio en disco', 'Lo que ocupa lo subido o descargado desde Manna. Lo de la carpeta Contenido (himnario, biblias y medios) no cuenta y nunca se borra.',
        diskList, diskFree, h('div', { class: 'row' }, cleanButton)),
      section('Este dispositivo', 'Este dispositivo', null,
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => go('/') }, icon('arrows-left-right', 16), 'Cambiar de función'))),
      ctx.isLocal && section('Apagar', 'Apagar o reiniciar', 'Manna funciona sin ventana propia. Al apagarlo se cierra la proyección y los demás dispositivos se desconectan. Reiniciarlo sirve para terminar una actualización: vuelve a abrirse solo.',
        h('div', { class: 'row', style: 'flex-wrap: wrap;' },
          h('button', { class: 'btn', onclick: askRestart }, icon('arrow-clockwise', 16), 'Reiniciar Manna'),
          h('button', { class: 'btn danger', onclick: askShutdown }, icon('power', 16), 'Apagar Manna'))),
      section('Acerca de', 'Acerca de', null,
        h('div', { class: 'lockup about' },
          h('img', { src: '/marca.svg', alt: '' }),
          h('p', { class: 'wordmark' }, 'MANNA'),
          h('p', { class: 'tagline' }, 'Church projection app'),
          version,
          h('a', { class: 'btn', style: 'margin-top: 14px;', href: 'https://github.com/delosriosmedia/manna', target: '_blank', rel: 'noopener' }, 'Sitio del proyecto')))));

  createStylePanel(styles);
  subscribe('system', (s) => { version.textContent = s.version ? `Versión ${s.version}` : ''; });

  subscribe('projection', ({ display }) => {
    const d = describeDisplay(display);
    displayText.textContent = d.warn
      ? 'No hay una segunda pantalla conectada. Al conectar el proyector, la ventana se abre sola.'
      : `${d.text}.`;
  });
  subscribe('tools', ({ list }) => {
    tools.replaceChildren(...list.map((t) => h('div', { class: `tool${t.found ? '' : ' missing'}`, dataset: { id: t.id } },
      icon(t.found ? 'check-circle' : 'warning-circle', 18),
      h('span', { class: 'item-text' }, h('strong', {}, t.name),
        h('small', {}, t.found ? [t.detail !== t.name && t.detail, t.version && `versión ${t.version}`].filter(Boolean).join(' · ') || 'Instalado' : t.level === 'optional' ? 'No está (opcional)' : 'Falta')),
      // Uno que falta y Manna sabe instalar, se instala desde aquí, en el equipo principal.
      !t.found && t.installable && ctx.isLocal && h('button', { class: 'btn', disabled: t.installing, onclick: guard(async () => {
        await action('tools.install', { id: t.id });
        toast(`Instalando ${t.name}. El avance está en la cola del culto.`);
      }) }, icon('download-simple', 15), t.installing ? 'Instalando…' : 'Instalar'),
      // Un programa que conviene tener al día (yt-dlp) se actualiza desde aquí, en el equipo principal.
      t.found && t.update && ctx.isLocal && h('button', { class: 'btn', title: t.update, disabled: t.installing, onclick: guard(async () => {
        await action('tools.install', { id: t.id });
        toast(`Actualizando ${t.name}. El avance está en la cola del culto.`);
      }) }, icon('arrow-clockwise', 15), t.installing ? 'Actualizando…' : 'Actualizar'))));
  });
  subscribe('internet', (s) => {
    net.textContent = netText(s);
    net.classList.toggle('warn', Boolean(s.error));
    netAddress.hidden = !(s.on && s.url);
    if (s.url) {
      netLink.href = s.url;
      netLink.textContent = s.url;
    }
    netToggle.replaceChildren(icon('power', 15), s.on ? 'Apagar' : 'Encender');
    netOwn.textContent = s.own ? 'Cambiar el dominio propio' : 'Usar un dominio propio';
  });
  // Un túnel propio de Cloudflare: su clave (no se vuelve a mostrar) y la dirección que se le dio.
  function openOwnTunnel() {
    const token = h('input', { class: 'input', type: 'password', autocomplete: 'off', placeholder: 'Clave del túnel (empieza por eyJ…)', 'aria-label': 'Clave del túnel' });
    const address = h('input', { class: 'input', placeholder: 'https://manna.tuiglesia.org', 'aria-label': 'Dirección' });
    const save = (value) => guard(async () => {
      await action('internet.own', value ? { token: token.value, address: address.value } : { token: '' });
      box.close();
      toast(value ? 'Dominio propio guardado.' : 'Se usará el túnel rápido, con una dirección nueva cada vez.');
    });
    const box = dialog('Dominio propio',
      h('p', { class: 'muted' }, `En el panel de Cloudflare (Zero Trust → Networks → Tunnels), crea un túnel, dale la dirección de tu dominio y que lleve a http://localhost:${location.port || '80'}. Copia aquí la clave que te muestra (puedes pegar la orden entera).`),
      h('div', { class: 'net-own' }, token, address),
      h('div', { class: 'row', style: 'justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin-top: 14px;' },
        state.internet?.own && h('button', { class: 'btn', onclick: save(false) }, 'Quitar el dominio propio'),
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn primary', onclick: save(true) }, 'Guardar')));
    token.focus();
  }

  subscribe('conexiones', ({ porRol = {} }) => {
    const n = (role) => porRol[role] || 0;
    const controls = n('control') + n('orden');
    screens.textContent = `Conectados ahora: ${n('proyeccion')} ${n('proyeccion') === 1 ? 'pantalla' : 'pantallas'} de proyección y ${controls} ${controls === 1 ? 'control' : 'controles'}.`;
  });

  function askRestart() {
    const box = dialog('Reiniciar Manna',
      h('p', {}, 'Manna se cerrará y volverá a abrirse solo. La proyección se interrumpe unos segundos y los demás dispositivos se reconectan sin hacer nada.'),
      h('div', { class: 'row', style: 'justify-content: flex-end;' },
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn primary', onclick: guard(async () => {
          await action('system.restart');
          box.close();
        }) }, 'Reiniciar')));
  }

  // ---- Espacio en disco ----
  const sizeOf = (bytes) => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB` : `${Math.max(bytes ? 1 : 0, Math.round(bytes / 1024 ** 2))} MB`);
  async function loadDisk() {
    if (!disk) diskList.replaceChildren(h('p', { class: 'muted' }, 'Calculando lo que ocupa…'));
    disk = await api('/api/system/disk');
    diskList.replaceChildren(...disk.groups.map((g) => h('div', { class: 'disk-row', dataset: { id: g.id } }, h('span', {}, g.label), h('strong', {}, sizeOf(g.bytes)))),
      h('div', { class: 'disk-row total' }, h('span', {}, 'En total'), h('strong', {}, sizeOf(disk.total))));
    diskFree.textContent = disk.free == null ? '' : `Libre en el disco del equipo principal: ${sizeOf(disk.free)}${disk.size ? ` de ${sizeOf(disk.size)}` : ''}.`;
    cleanButton.disabled = !disk.total;
  }
  function askClean() {
    const box = dialog('Limpiar multimedia temporales',
      h('p', {}, `Se borrará todo lo subido o descargado desde Manna${disk ? ` (${sizeOf(disk.total)})` : ''}: videos de YouTube, videos, audios e imágenes subidos, presentaciones y páginas web hechas con un archivo. Lo que esté en el orden del culto también se quita de él.`),
      h('p', { class: 'muted' }, 'No se toca la carpeta Contenido (himnario, biblias y medios) ni las imágenes de fondo. No se puede deshacer.'),
      h('div', { class: 'row', style: 'justify-content: flex-end;' },
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn danger', onclick: guard(async () => {
          const done = await action('system.clean');
          box.close();
          toast(done.failed ? `Se liberaron ${sizeOf(done.freed)}; ${done.failed} no se pudieron borrar.` : `Listo: se liberaron ${sizeOf(done.freed)}.`, done.failed ? 'error' : 'info');
          await loadDisk();
        }) }, 'Limpiar')));
  }

  function askShutdown() {
    const box = dialog('Apagar Manna',
      h('p', {}, 'Se cerrará la proyección y los demás dispositivos se desconectarán.'),
      h('div', { class: 'row', style: 'justify-content: flex-end;' },
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn danger', onclick: guard(async () => {
          await action('system.shutdown');
          disconnect();
          allowLeaving();
          document.title = 'Manna · Apagado';
          document.body.className = '';
          document.body.replaceChildren(h('main', { class: 'goodbye' },
            h('img', { src: '/marca.svg', alt: '', width: 96 }),
            h('h1', {}, 'Manna está apagado'),
            h('p', { class: 'muted' }, 'Ya puedes cerrar esta pestaña. Para volver a abrirlo, usa el icono Manna.')));
        }) }, 'Apagar Manna')));
  }

  return { onShow: guard(loadDisk) };
}

export default {
  // full: en el celular se abre siempre completo (no tiene una versión reducida).
  id: 'ajustes', name: 'Ajustes', icon: 'gear-six', place: 'bottom', full: true, mount,
  needs: [{ tools: ['navegador'], feature: 'abrir sola la proyección en la segunda pantalla de este equipo' }],
};
