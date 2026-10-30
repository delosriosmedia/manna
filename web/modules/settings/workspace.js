import { action, api, disconnect, state, subscribe } from '../../core/api.js';
import { h, allowLeaving, dialog, go, guard, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { prefs } from '../../core/prefs.js';
import { chooseContent } from '../../core/contenido.js';
import { createDisplayToggle, createStylePanel, createTestCardButton, describeDisplay } from '../projection/controls.js';
import { netText } from '../system/conexion.js';
import { openDevicesDialog } from '../system/devices.js';
import { usersBody } from './usuarios.js';
import { cloudBody } from './nube.js';

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

  // Espacio en disco: lo subido o descargado desde Manna, con un botón de borrar en cada categoría.
  const diskList = h('div', { class: 'disk-list' });
  const diskFree = h('p', { class: 'muted' });
  let disk = null;

  // Tamaño de la interfaz (pedido del dueño, 2026-10-18): de como está (el mínimo) a un 8 % más, en este dispositivo.
  // Lo aplica el guion de la cabecera de cada página al abrirla (--zoom en app.css); aquí, además, al instante.
  const sizeSlider = h('input', { type: 'range', min: 1, max: 1.08, step: 0.01, value: prefs.get('interfaz.tamano', 1), 'aria-label': 'Tamaño de la interfaz',
    oninput: () => {
      const z = Number(sizeSlider.value);
      prefs.set('interfaz.tamano', z);
      if (z > 1) document.documentElement.style.setProperty('--zoom', z);
      else document.documentElement.style.removeProperty('--zoom');
    } });

  // Carpeta de contenido (fase 29): dónde está y qué tiene; se abre o se cambia en el equipo principal, sin reiniciar.
  const contentPath = h('p', { class: 'content-path' });
  const contentHas = h('p', { class: 'muted' });
  const showContent = () => {
    const content = state.system?.content;
    if (!content) return;
    contentPath.textContent = content.dir || '—';
    const folderMedia = ['videos', 'audios'].reduce((n, kind) => n + (state.media?.[kind] || []).filter((c) => c.source === 'folder').length, 0);
    const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    contentHas.textContent = !content.exists ? 'No se encuentra esa carpeta: puede estar en un disco desconectado.'
      : `${count(state.bible?.versions?.length || 0, 'versión de la Biblia', 'versiones de la Biblia')} · ${count(state.hymns?.count || 0, 'himno', 'himnos')} · ${count(folderMedia, 'video o audio', 'videos y audios')} de la carpeta Medios`;
  };
  for (const ns of ['system', 'bible', 'hymns', 'media']) subscribe(ns, showContent);

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
      section('Usuarios', 'Usuarios', 'Quién puede entrar en las funciones de control y en cuáles. Cada persona entra con su nombre y su PIN; el equipo principal entra sin PIN, como administrador.',
        ...usersBody(ctx.user)),
      section('Internet', 'Conexión por internet', 'Para usar Manna desde fuera de la iglesia. Desde internet todo pide entrar con nombre y PIN, también la pantalla de proyección.',
        net, netAddress, ctx.isLocal && h('div', { class: 'row', style: 'flex-wrap: wrap;' }, netToggle, netOwn)),
      section('Nube', 'Nube de la iglesia', 'Para preparar el culto desde casa. Este equipo se empareja con la nube de su iglesia con un código que da «Administrar la iglesia»; solo uno puede ser el equipo oficial.',
        ...cloudBody()),
      section('Programas', 'Programas del equipo principal', 'Lo que Manna usa para convertir videos, descargar de YouTube y abrir presentaciones. Ninguno que falte impide abrir Manna.',
        tools, h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => go('/requisitos') }, icon('check-circle', 16), 'Revisar el equipo'))),
      section('Contenido', 'Carpeta de contenido', 'Las biblias, el himnario y los videos y audios de la iglesia. Al cambiarla, Manna usa la nueva al momento, sin reiniciar; la anterior queda como estaba.',
        contentPath, contentHas,
        ctx.isLocal ? h('div', { class: 'row', style: 'flex-wrap: wrap;' },
          h('button', { class: 'btn', onclick: guard(() => action('system.contentOpen')) }, icon('folder-simple', 16), 'Abrir la carpeta'),
          h('button', { class: 'btn', onclick: () => chooseContent() }, icon('arrows-left-right', 16), 'Cambiar…'))
          : h('p', { class: 'muted' }, 'Se abre y se cambia desde el equipo principal.')),
      section('Disco', 'Espacio en disco', 'Lo que ocupa lo subido o descargado desde Manna. Lo de la carpeta Contenido (himnario, biblias y medios) no cuenta y nunca se borra.',
        diskList, diskFree),
      section('Este dispositivo', 'Este dispositivo', 'Solo cambia aquí: cada celular, tableta o equipo tiene lo suyo.',
        h('div', { class: 'label' }, 'Tamaño de la interfaz'),
        h('div', { class: 'ui-size' }, h('span', { class: 'ui-a', 'aria-hidden': 'true' }, 'A'), sizeSlider, h('span', { class: 'ui-a big', 'aria-hidden': 'true' }, 'A')),
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
          h('div', { class: 'row', style: 'flex-wrap: wrap; justify-content: center; margin-top: 14px;' },
            h('button', { class: 'btn', onclick: () => checkUpdate() }, icon('arrow-clockwise', 16), 'Buscar versión nueva'),
            h('a', { class: 'btn', href: 'https://github.com/delosriosmedia/manna', target: '_blank', rel: 'noopener' }, 'Sitio del proyecto'))))));

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
    const controls = n('control') + n('alabanza') + n('presentador') + n('orador-sencillo');
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
  // Qué borra el botón de cada categoría. Las copias para celulares no tienen: se van con su video (system.clean).
  const WHAT = {
    youtube: 'los videos descargados de YouTube',
    clips: 'los videos y audios subidos',
    images: 'las imágenes subidas',
    slides: 'las presentaciones (PDF y PowerPoint)',
    pages: 'las páginas web hechas con un archivo',
  };
  async function loadDisk() {
    if (!disk) diskList.replaceChildren(h('p', { class: 'muted' }, 'Calculando lo que ocupa…'));
    disk = await api('/api/system/disk');
    diskList.replaceChildren(...disk.groups.map((g) => h('div', { class: 'disk-row', dataset: { id: g.id } },
      h('span', {}, g.label, !WHAT[g.id] && h('small', { class: 'muted' }, ' · se borran con su video')),
      h('strong', {}, sizeOf(g.bytes)),
      WHAT[g.id] ? h('button', { class: 'icon-btn sm', 'aria-label': `Borrar: ${g.label}`, title: `Borrar ${WHAT[g.id]}`, disabled: !g.bytes, onclick: () => askClean(g) }, icon('trash', 15)) : h('span', { class: 'disk-gap' }))),
    h('div', { class: 'disk-row total' }, h('span', {}, 'En total'), h('strong', {}, sizeOf(disk.total)), h('span', { class: 'disk-gap' })));
    diskFree.textContent = disk.free == null ? '' : `Libre en el disco del equipo principal: ${sizeOf(disk.free)}${disk.size ? ` de ${sizeOf(disk.size)}` : ''}.`;
  }
  // Borrar pide confirmarlo dos veces: qué se borra y, luego, si está seguro.
  function askClean(g) {
    const size = sizeOf(g.bytes);
    const first = dialog(`Borrar: ${g.label}`,
      h('p', {}, `Se borrarán ${WHAT[g.id]} desde Manna (${size}). Lo que esté en el orden del culto también se quita de él.`),
      h('p', { class: 'muted' }, 'No se toca la carpeta Contenido (himnario, biblias y medios) ni las imágenes de fondo.'),
      h('div', { class: 'row', style: 'justify-content: flex-end;' },
        h('button', { class: 'btn', onclick: () => first.close() }, 'Cancelar'),
        h('button', { class: 'btn danger', onclick: () => { first.close(); askAgain(); } }, 'Borrar')));
    function askAgain() {
      const box = dialog('¿Seguro?',
        h('p', {}, `Vas a borrar ${WHAT[g.id]} (${size}). No se puede deshacer.`),
        h('div', { class: 'row', style: 'justify-content: flex-end;' },
          h('button', { class: 'btn', onclick: () => box.close() }, 'No, cancelar'),
          h('button', { class: 'btn danger', onclick: guard(async () => {
            const done = await action('system.clean', { group: g.id });
            box.close();
            toast(done.failed ? `Se liberaron ${sizeOf(done.freed)}; ${done.failed} no se pudieron borrar.` : `Listo: se liberaron ${sizeOf(done.freed)}.`, done.failed ? 'error' : 'info');
            await loadDisk();
          }) }, 'Sí, borrar')));
    }
  }

  // Pregunta ya a GitHub (el equipo principal lo hace solo cada hora). Si hay una nueva, sale el aviso de arriba, aunque
  // en este dispositivo se hubiera cerrado antes con su ×.
  const checkUpdate = guard(async () => {
    prefs.set('version.descartada', null);
    const { latest, newer } = await action('system.checkUpdate');
    toast(newer ? `Hay una versión nueva de Manna: ${latest}.` : `Tienes la versión más reciente (${latest}).`);
  });

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
