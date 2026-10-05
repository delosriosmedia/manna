import { action, state, subscribe, upload } from '../../core/api.js';
import { h, go, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { describeJob } from '../../core/jobs.js';
import { formatTime } from '../../core/playback.js';
import { whenLabel } from '../../core/time.js';
import { askName, confirmRemove } from './dialogs.js';
import { CLIP_ACCEPT, CLIP_TYPES, extensionOf, megabytes, openClipUpload } from './upload-clips.js';

const WORDS = {
  video: { id: 'videos', label: 'Videos', one: 'el video', icon: 'video', upload: 'Subir videos', empty: 'Aún no hay videos', hint: 'Sube videos desde este equipo o desde el celular. Los archivos grandes es más rápido copiarlos a la carpeta Contenido/Medios del equipo principal: aparecen aquí solos.' },
  audio: { id: 'audios', label: 'Audios', one: 'el audio', icon: 'waveform', upload: 'Subir audios', empty: 'Aún no hay audios', hint: 'Sube pistas o grabaciones desde este equipo o desde el celular, o cópialas a la carpeta Contenido/Medios del equipo principal: aparecen aquí solas.' },
  youtube: { id: 'youtube', label: 'YouTube', one: 'el video', icon: 'youtube-logo', empty: 'Aún no hay videos de YouTube', hint: 'Pega arriba el enlace de un video. Manna lo descarga una vez y lo guarda aquí, para proyectarlo sin anuncios, sin cortes y sin internet. Usa videos de tu iglesia o que tengas permiso para proyectar.' },
};
// Para lo que no sea un audio vale todo lo de un video (imagen, subtítulos).
const isVisual = (kind) => kind !== 'audio';

// Pestañas Videos y Audios de Medios: la biblioteca, el estado de cada archivo (listo, convirtiéndose,
// con error) y las acciones del elegido. kind: 'video' | 'audio' | 'youtube'. Los de YouTube no
// se suben: se pega su enlace y Manna los descarga.
export function createClipsPanel(ctx, kind) {
  const words = WORDS[kind];
  let selected = null;
  const clips = () => state.media?.[words.id] || [];
  const current = () => clips().find((c) => c.id === selected) || null;
  const jobOf = (id) => (state.jobs?.list || []).filter((j) => j.owner === 'media' && j.ref === id).at(-1) || null;

  const picker = h('input', { type: 'file', accept: CLIP_ACCEPT[kind] || '', multiple: true, hidden: true });
  const startUpload = (files) => openClipUpload(files, kind, { onDone: (ids) => select(ids.at(-1)) });

  // YouTube: en vez de subir, se pega el enlace.
  const link = h('input', { class: 'input', type: 'url', inputMode: 'url', placeholder: 'Pega aquí el enlace de YouTube', 'aria-label': 'Enlace de YouTube', autocomplete: 'off' });
  const addLink = guard(async () => {
    const value = link.value.trim();
    if (!value) { link.focus(); return; }
    const { id, already } = await action('media.youtube', { link: value });
    link.value = '';
    select(id);
    toast(already ? 'Ese video ya está en la biblioteca.' : 'Descargando el video. Puedes seguir usando Manna mientras tanto.');
  });
  const entry = kind === 'youtube' && ctx.canEdit ? h('form', { class: 'yt-add', onsubmit: (e) => { e.preventDefault(); addLink(); } },
    h('label', { class: 'search' }, icon('link-simple', 16), link),
    h('button', { class: 'btn', type: 'submit' }, icon('download-simple', 16), 'Añadir')) : null;
  picker.addEventListener('change', () => {
    if (picker.files.length) startUpload(picker.files);
    picker.value = '';
  });
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

  const grid = h('div', { class: `media-grid${kind === 'audio' ? ' audios' : ''}` });
  const el = h('div', { class: 'media-body', dataset: { panel: words.id } }, grid, picker, captions);
  const name = h('span', { class: 'sel-ref' });
  const project = guard(async () => {
    const clip = current();
    if (clip) await action('projection.show', { kind, data: { id: clip.id } });
  });
  const show = h('button', { class: 'btn primary', onclick: () => project() }, icon('play', 16), 'Proyectar', h('kbd', {}, '↵'));
  const bar = h('div', { class: 'abar media-bar', hidden: true, dataset: { panel: words.id } },
    name, h('span', { class: 'hint' }, isVisual(kind) ? 'Al proyectarlo empieza a reproducirse' : 'Al proyectarlo empieza a sonar'),
    h('button', { class: 'btn', onclick: guard(async () => {
      const clip = current();
      await action('order.add', { kind, data: { id: clip.id } });
      toast(`«${clip.name}» añadido al orden del culto.`);
    }) }, icon('plus', 16), 'Añadir al orden'),
    show);

  // Lo recién subido puede no haber llegado aún con el estado (la respuesta de la subida se
  // adelanta al aviso del servidor): se recuerda, y queda elegido en cuanto aparece.
  let awaited = null;
  function select(id) {
    selected = id;
    awaited = id && !current() ? id : null;
    render();
  }

  // Lo que hay que saber de un archivo cuya copia para todas las pantallas aún no está.
  function statusOf(clip) {
    if (clip.status === 'ready') return null;
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
    kind === 'video' && { label: clip.subtitles ? 'Cambiar los subtítulos' : 'Añadir subtítulos', icon: 'closed-captioning', note: '.srt o .vtt', onclick: () => { captionsFor = clip.id; captions.click(); } },
    kind === 'video' && clip.subtitles && { label: 'Quitar los subtítulos', icon: 'x', onclick: guard(() => action('media.subtitlesRemove', { id: clip.id })) },
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
    const onAir = state.projection?.mode === 'live' && live?.kind === kind ? live.source?.data?.id : null;

    if (!list.length) {
      el.replaceChildren(h('div', { class: 'empty' }, h('strong', {}, words.empty), words.hint,
        ctx.canEdit && words.upload && h('div', { class: 'row', style: 'justify-content: center; margin-top: 14px;' },
          h('button', { class: 'btn primary', onclick: () => picker.click() }, icon('upload-simple', 16), words.upload))), picker, captions);
    } else {
      if (!grid.isConnected) el.replaceChildren(grid, picker, captions);
      grid.replaceChildren(...list.map((clip) => {
        const facts = [whenLabel(clip.added), clip.duration && formatTime(clip.duration), clip.bytes > 0 && megabytes(clip.bytes), clip.source === 'folder' && 'carpeta'].filter(Boolean).join(' · ');
        return h('div', { class: `media-card${clip.id === selected ? ' selected' : ''}${clip.id === onAir ? ' live' : ''}${clip.usable ? '' : ' pending'}`, dataset: { id: clip.id, status: clip.status, usable: String(clip.usable) } },
          h('button', { class: 'media-pick', 'aria-pressed': clip.id === selected, onclick: () => select(clip.id), ondblclick: () => { select(clip.id); if (clip.usable) project(); } },
            h('span', { class: `media-thumb${!isVisual(kind) || !clip.poster ? ' blank' : ''}` },
              isVisual(kind) && clip.poster ? h('img', { src: clip.poster, alt: '', loading: 'lazy' }) : icon(words.icon, 30),
              clip.duration && h('span', { class: 'media-duration' }, formatTime(clip.duration)),
              clip.subtitles && h('span', { class: 'media-cc', title: 'Tiene subtítulos' }, icon('closed-captioning', 14)),
              clip.id === onAir && h('span', { class: 'badge live' }, 'Al aire')),
            h('span', { class: 'item-text' }, h('strong', {}, clip.name), h('small', {}, facts))),
          statusOf(clip),
          ctx.canEdit && h('button', { class: 'icon-btn sm media-more', 'aria-label': `Opciones de ${clip.name}`, onclick: (e) => more(clip, e.currentTarget) }, icon('dots-three', 16)));
      }));
    }

    const clip = current();
    bar.hidden = !clip;
    if (clip) {
      name.textContent = clip.name;
      show.disabled = !clip.usable;
    }
    if (el.isConnected && !el.hidden) ctx.setPreview(clip?.usable ? { kind, id: clip.id, title: clip.name, url: clip.url, poster: clip.poster, duration: clip.duration } : null);
  }
  subscribe('media', render);
  subscribe('projection', render);
  subscribe('jobs', () => { if (clips().some((c) => c.status === 'converting' || c.status === 'downloading')) render(); });

  return {
    id: words.id, label: words.label, uploadLabel: words.upload, el, bar,
    // Lo que esta pestaña pone en la cabecera en lugar del botón de subir (YouTube: su enlace).
    entry,
    pick: () => picker.click(),
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
