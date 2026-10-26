import { action, state, subscribe, upload } from '../../core/api.js';
import { h, go, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { describeJob } from '../../core/jobs.js';
import { kindBadge } from '../../core/kinds.js';
import { formatTime } from '../../core/playback.js';
import { whenLabel } from '../../core/time.js';
import { askName, confirmRemove } from './dialogs.js';
import { CLIP_TYPES, extensionOf, megabytes, openClipUpload } from './upload-clips.js';
import { openYoutubeMany } from './youtube-many.js';

const WORDS = {
  video: { id: 'videos', label: 'Videos', one: 'el video', icon: 'video' },
  audio: { id: 'audios', label: 'Audios', one: 'el audio', icon: 'waveform' },
};

// Los videos y los audios de Medios: la lista, el estado de cada archivo (listo, convirtiéndose, descargándose,
// con error) y las acciones del elegido. kind: 'video' | 'audio'; lib es lo que le da Medios (workspace.js).
// La de videos junta los subidos, los de la carpeta y los de YouTube (tipo 'youtube', que no se suben:
// se pega su enlace en `entry` y Manna los descarga).
export function createClipsPanel(ctx, kind, lib) {
  const words = WORDS[kind];
  const visual = kind === 'video';
  let selected = null;
  const library = () => (visual ? [...(state.media?.videos || []), ...(state.media?.youtube || [])] : [...(state.media?.audios || [])]).sort((a, b) => a.added - b.added);
  const clips = () => lib.filter(library());
  const current = () => clips().find((c) => c.id === selected) || null;
  const jobOf = (id) => (state.jobs?.list || []).filter((j) => j.owner === 'media' && j.ref === id).at(-1) || null;

  const startUpload = (files) => openClipUpload(files, kind, { onDone: (ids) => { lib.added(ids); select(ids.at(-1)); } });

  // YouTube: en vez de subir, se pega el enlace.
  const link = h('input', { class: 'input', type: 'url', inputMode: 'url', placeholder: 'Pega aquí el enlace de YouTube', 'aria-label': 'Enlace de YouTube', autocomplete: 'off',
    // Varios enlaces (o uno con su nombre, de un mensaje) se revisan en «Varios videos de YouTube» (fase 28).
    onpaste: (e) => {
      const text = e.clipboardData?.getData('text') || '';
      if (!/[\s,;]/.test(text.trim())) return;
      e.preventDefault();
      openYoutubeMany({ text, onDone: addedMany });
    } });
  const addedMany = (ids) => { if (ids.length) { lib.added(ids); select(ids[0]); } };
  const addLink = guard(async () => {
    const value = link.value.trim();
    // Al preparar el culto en la nube (decisión 64), el enlace va al orden y el video lo descarga el equipo de la iglesia.
    if (!ctx.canProject) {
      if (!value) return;
      const item = await action('order.add', { kind: 'ytlink', data: { link: value } });
      link.value = '';
      toast(`«${item.title}» añadido al orden del culto. Se descargará en la iglesia.`);
      return;
    }
    // Vacío: la ventana para pegar uno o varios (en el celular pequeño no cabe el botón «Varios»).
    if (!value) { openYoutubeMany({ onDone: addedMany }); return; }
    const { id, already } = await action('media.youtube', { link: value });
    link.value = '';
    if (!already) lib.added([id]);
    select(id);
    toast(already ? 'Ese video ya está en la biblioteca.' : 'Descargando el video. Puedes seguir usando Manna mientras tanto.');
  });
  const entry = visual && ctx.canEdit ? h('form', { class: 'yt-add', onsubmit: (e) => { e.preventDefault(); addLink(); } },
    h('label', { class: 'search' }, icon('link-simple', 16), link),
    h('button', { class: 'btn', type: 'submit', 'aria-label': 'Añadir el video de YouTube', title: 'Añadir el video de YouTube' }, icon('download-simple', 16), h('span', {}, 'Añadir')),
    ctx.canProject && h('button', { class: 'btn yt-many', type: 'button', 'aria-label': 'Añadir varios videos de YouTube', title: 'Añadir varios videos de YouTube', onclick: () => openYoutubeMany({ onDone: addedMany }) }, icon('list-plus', 16), h('span', {}, 'Varios'))) : null;
  // Al preparar desde casa, delante del enlace puede ir su nombre («Canto de entrada: …»): ya no es una dirección pura.
  if (entry && !ctx.canProject) {
    entry.noValidate = true;
    link.placeholder = 'Enlace de YouTube, para el orden (si escribes algo antes, será su nombre)';
  }
  // Subtítulos de un video: un archivo .srt o .vtt.
  let captionsFor = null;
  const captions = h('input', { type: 'file', accept: '.srt,.vtt,text/vtt', hidden: true });
  captions.addEventListener('change', guard(async () => {
    const file = captions.files[0];
    captions.value = '';
    if (!file || !captionsFor) return;
    await upload(`/api/media/clips/${captionsFor}/subtitles`, file, { headers: { 'Content-Type': 'text/plain' } });
    toast('Subtítulos añadidos. Se activan desde los mandos mientras el video está al aire.');
  }));

  const grid = h('div', { class: `media-grid${visual ? '' : ' audios'}` });
  const el = h('div', { class: 'media-list', dataset: { panel: words.id } }, grid, captions);
  const name = h('span', { class: 'sel-ref' });
  const add = guard(async () => {
    const clip = current();
    await action('order.add', { kind: clip.kind, data: { id: clip.id } });
    toast(`«${clip.name}» añadido al orden del culto.`);
  });
  // Sin proyección (al preparar el culto en la nube), Intro añade al orden.
  const project = guard(async () => {
    const clip = current();
    if (clip && !ctx.canProject) await add();
    else if (clip) await action('projection.show', { kind: clip.kind, data: { id: clip.id } });
  });
  const show = ctx.canProject && h('button', { class: 'btn primary', onclick: () => project() }, icon('play', 16), 'Proyectar', h('kbd', {}, '↵'));
  const bar = h('div', { class: 'abar media-bar', hidden: true, dataset: { panel: words.id } },
    name, ctx.canProject && h('span', { class: 'hint' }, visual ? 'Al proyectarlo empieza a reproducirse' : 'Al proyectarlo empieza a sonar'),
    h('button', { class: `btn${ctx.canProject ? '' : ' primary'}`, onclick: () => add() }, icon('plus', 16), 'Añadir al orden'),
    // Oírlo solo en este dispositivo antes de proyectarlo o añadirlo (no en el equipo principal).
    ctx.listen && h('button', { class: 'btn media-listen', 'aria-label': 'Escuchar en este dispositivo', onclick: () => {
      const clip = current();
      if (clip?.url) ctx.listen({ url: clip.url, title: clip.name });
    } }, icon('speaker-high', 16), 'Escuchar'),
    show);

  // Lo recién subido puede no haber llegado aún con el estado (la respuesta de la subida se
  // adelanta al aviso del servidor): se recuerda, y queda elegido en cuanto aparece.
  let awaited = null;
  function select(id) {
    if (id) lib.picked();
    selected = id;
    awaited = id && !current() ? id : null;
    render();
  }

  // Lo que hay que saber de un archivo cuya copia para todas las pantallas aún no está.
  function statusOf(clip) {
    if (clip.status === 'ready') return null;
    // En la nube (decisión 64): lo convierte, si hace falta, el equipo de la iglesia; lo que ya llegó, solo se ve su imagen.
    if (!ctx.canProject) return h('div', { class: 'media-status usable' }, h('small', {}, clip.atChurch ? 'Ya está en la iglesia.' : 'Se prepara en el equipo de la iglesia.'));
    const job = jobOf(clip.id);
    const checking = clip.original && clip.original.playable == null;
    if (clip.status === 'downloading') {
      const progress = Math.round((job?.progress || 0) * 100);
      return h('div', { class: 'media-status' },
        h('div', { class: `bar${job?.progress == null ? ' busy' : ''}`, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': progress },
          h('span', { style: `width: ${progress}%;` })),
        h('small', {}, job ? describeJob(job) : 'Descargando de YouTube'));
    }
    if (clip.status === 'converting') {
      const progress = Math.round((job?.progress || 0) * 100);
      return h('div', { class: `media-status${clip.usable ? ' usable' : ''}` },
        clip.usable && h('strong', {}, 'Ya se puede proyectar desde el equipo principal.'),
        h('div', { class: `bar${job?.progress == null ? ' busy' : ''}`, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': progress },
          h('span', { style: `width: ${progress}%;` })),
        h('small', {}, [clip.usable ? 'Preparando la copia para celulares y pantallas remotas' : checking ? 'Comprobando si este equipo lo reproduce tal cual' : 'Convirtiendo', job && describeJob(job)].filter(Boolean).join(' · ')));
    }
    return h('div', { class: `media-status ${clip.usable ? 'usable' : 'error'}` },
      clip.usable && h('strong', {}, 'Se puede proyectar desde el equipo principal.'),
      h('small', {}, clip.usable ? `No hay copia para celulares y pantallas remotas: ${(clip.error || 'no se pudo convertir').replace(/\.$/, '')}.` : clip.error || 'No se puede reproducir.'),
      ctx.canEdit && h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: guard(() => action('media.retry', { id: clip.id })) }, 'Reintentar'),
        clip.status === 'needs-ffmpeg' && h('button', { class: 'btn', onclick: () => go('/requisitos') }, 'Instalar ffmpeg')));
  }

  const more = (clip, anchor) => menu(anchor, [
    { label: 'Cambiar el nombre', icon: 'pencil-simple', onclick: () => askName(clip) },
    ...lib.menu(clip, anchor),
    clip.kind === 'video' && ctx.canProject && { label: clip.subtitles ? 'Cambiar los subtítulos' : 'Añadir subtítulos', icon: 'closed-captioning', note: '.srt o .vtt', onclick: () => { captionsFor = clip.id; captions.click(); } },
    clip.kind === 'video' && clip.subtitles && { label: 'Quitar los subtítulos', icon: 'x', onclick: guard(() => action('media.subtitlesRemove', { id: clip.id })) },
    '-',
    clip.source === 'folder'
      ? { label: 'Eliminar', icon: 'trash', note: 'Está en Contenido/Medios', disabled: true }
      : { label: 'Eliminar', icon: 'trash', onclick: () => confirmRemove(clip, words.one) },
  ].filter(Boolean));

  function render() {
    const list = clips();
    if (current()) awaited = null;
    else if (selected !== awaited) selected = null;
    const live = state.projection?.item;
    const onAir = state.projection?.mode === 'live' && ['video', 'audio', 'youtube'].includes(live?.kind) ? live.source?.data?.id : null;
    grid.replaceChildren(...list.map((clip) => {
      const facts = [whenLabel(clip.added), clip.duration && formatTime(clip.duration), clip.bytes > 0 && megabytes(clip.bytes), clip.source === 'folder' && 'carpeta', clip.kind === 'youtube' && 'YouTube'].filter(Boolean).join(' · ');
      return h('div', { class: `media-card${clip.id === selected ? ' selected' : ''}${clip.id === onAir ? ' live' : ''}${clip.usable ? '' : ' pending'}`, dataset: { id: clip.id, status: clip.status, usable: String(clip.usable), ...(ctx.canEdit && { drag: clip.id, name: clip.name }) } },
        h('button', { class: 'media-pick', 'aria-pressed': clip.id === selected, onclick: () => select(clip.id), ondblclick: () => { select(clip.id); if (clip.usable) project(); } },
          h('span', { class: `media-thumb${!visual || !clip.poster ? ' blank' : ''}` },
            visual && clip.poster ? h('img', { src: clip.poster, alt: '', loading: 'lazy' }) : icon(clip.kind === 'youtube' ? 'youtube-logo' : words.icon, 30),
            kindBadge(clip.kind),
            clip.duration && h('span', { class: 'media-duration' }, formatTime(clip.duration)),
            clip.subtitles && h('span', { class: 'media-cc', title: 'Tiene subtítulos' }, icon('closed-captioning', 14)),
            clip.id === onAir && h('span', { class: 'badge live' }, 'Al aire')),
          h('span', { class: 'item-text' }, h('strong', {}, clip.name), h('small', {}, facts))),
        statusOf(clip),
        ctx.canEdit && h('button', { class: 'icon-btn sm media-more', 'aria-label': `Opciones de ${clip.name}`, onclick: (e) => more(clip, e.currentTarget) }, icon('dots-three', 16)));
    }));

    const clip = current();
    bar.hidden = !clip;
    if (clip) {
      name.textContent = clip.name;
      if (show) show.disabled = !clip.usable;
    }
  }
  subscribe('media', render);
  subscribe('projection', render);
  subscribe('jobs', () => { if (library().some((c) => c.status === 'converting' || c.status === 'downloading')) render(); });

  return {
    id: words.id, label: words.label, kind, el, bar,
    // Lo que va en la cabecera junto al botón de subir (videos: el enlace de YouTube).
    entry,
    items: clips,
    clear: () => select(null),
    render,
    accepts: (file) => Boolean(CLIP_TYPES[kind]?.includes(extensionOf(file.name))),
    upload: startUpload,
    onShow: render,
    keys(e) {
      if (e.key !== 'Enter' || !current()?.usable) return false;
      project();
      return true;
    },
  };
}
