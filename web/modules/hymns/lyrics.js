import { api } from '../../core/api.js';
import { h, dialog } from '../../core/dom.js';

// La letra de un himno, por partes (estrofas y coro). La usan la ficha del Himnario, su ventana «Letra»
// y el botón «Letra» de los mandos de un himno al aire (para leerla entera en el propio dispositivo).
export const lyricsOf = (full) => h('div', { class: 'hymn-lyrics' }, ...full.parts.map((part) => h('section', {}, part.label && h('h3', {}, part.label), ...part.lines.map((line) => h('p', {}, line)))));

export async function openLyrics(number) {
  const full = await api(`/api/hymns/${number}`);
  const box = dialog(`${full.number} · ${full.title}`,
    full.parts.length ? lyricsOf(full) : h('p', { class: 'muted' }, 'Este himno no tiene su letra en la carpeta del himnario.'),
    h('div', { class: 'row', style: 'justify-content: flex-end; margin-top: 14px;' }, h('button', { class: 'btn primary', onclick: () => box.close() }, 'Cerrar')));
}
