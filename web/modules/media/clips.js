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
};

// Pestañas Videos y Audios de Medios: la biblioteca, el estado de cada archivo (listo, convirtiéndose,
// con error) y las acciones del elegido. kind: 'video' | 'audio'.
export function createClipsPanel(ctx, kind) {
  const words = WORDS[kind];
  let selected = null;
  const clips = () => state.media?.[words.id] || [];
  const current = () => clips().find((c) => c.id === selected) || null;
  const jobOf = (id) => (state.jobs?.list || []).filter((j) => j.owner === 'media' && j.ref === id).at(-1) || null;

  const picker = h('input', { type: 'file', accept: CLIP_ACCEPT[kind], multiple: true, hidden: true });
  const startUpload = (files) => openClipUpload(files, kind, { onDone: (ids) => select(ids.at(-1)) });
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
    name, h('span', { class: 'hint' }, kind === 'video' ? 'Al proyectarlo empieza a reproducirse' : 'Al proyectarlo empieza a sonar'),
    h('button', { class: 'btn', onclick: guard(async () => {
      const clip = current();
      await action('order.add', { kind, data: { id: clip.id } });
      toast(`«${clip.name}» añadido al orden del culto.`);
    }) }, icon('plus', 16), 'Añadir al orden'),
    show);

  function select(id) {
    selected = id;
    render();
  }

  // Lo que hay que saber de un archivo que aún no se puede proyectar.
  function statusOf(clip) {
    if (clip.status === 'ready') return null;
    const job = jobOf(clip.id);
    if (clip.status === 'converting') {
      return h('div', { class: 'media-status' },
        h('div', { class: `bar${job?.progress == null ? ' busy' : ''}`, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round((job?.progress || 0) * 100) },
          h('span', { style: `width: ${Math.round((job?.progress || 0) * 100)}%;` })),
        h('small', {}, job ? describeJob(job) : 'Convirtiendo…'));
    }
    return h('div', { class: 'media-status error' },
      h('small', {}, clip.error || 'No se puede reproducir.'),
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
    if (selected && !current()) selected = null;
    const live = state.projection?.item;
    const onAir = state.projection?.mode === 'live' && live?.kind === kind ? live.source?.data?.id : null;

    if (!list.length) {
      el.replaceChildren(h('div', { class: 'empty' }, h('strong', {}, words.empty), words.hint,
        ctx.canEdit && h('div', { class: 'row', style: 'justify-content: center; margin-top: 14px;' },
          h('button', { class: 'btn primary', onclick: () => picker.click() }, icon('upload-simple', 16), words.upload))), picker, captions);
    } else {
      if (!grid.isConnected) el.replaceChildren(grid, picker, captions);
      grid.replaceChildren(...list.map((clip) => {
        const facts = [whenLabel(clip.added), clip.duration && formatTime(clip.duration), megabytes(clip.bytes), clip.source === 'folder' && 'carpeta'].filter(Boolean).join(' · ');
        return h('div', { class: `media-card${clip.id === selected ? ' selected' : ''}${clip.id === onAir ? ' live' : ''}${clip.status === 'ready' ? '' : ' pending'}`, dataset: { id: clip.id, status: clip.status } },
          h('button', { class: 'media-pick', 'aria-pressed': clip.id === selected, onclick: () => select(clip.id), ondblclick: () => { select(clip.id); if (clip.status === 'ready') project(); } },
            h('span', { class: `media-thumb${kind === 'audio' || !clip.poster ? ' blank' : ''}` },
              kind === 'video' && clip.poster ? h('img', { src: clip.poster, alt: '', loading: 'lazy' }) : icon(words.icon, 30),
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
      show.disabled = clip.status !== 'ready';
    }
    if (el.isConnected && !el.hidden) ctx.setPreview(clip && clip.status === 'ready' ? { kind, title: clip.name, url: clip.url, poster: clip.poster, duration: clip.duration } : null);
  }
  subscribe('media', render);
  subscribe('projection', render);
  subscribe('jobs', () => { if (clips().some((c) => c.status === 'converting')) render(); });

  return {
    id: words.id, label: words.label, uploadLabel: words.upload, el, bar,
    pick: () => picker.click(),
    accepts: (file) => CLIP_TYPES[kind].includes(extensionOf(file.name)),
    upload: startUpload,
    onShow: render,
    keys(e) {
      if (e.key !== 'Enter' || current()?.status !== 'ready') return false;
      project();
      return true;
    },
  };
}
