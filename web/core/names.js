// El nombre que se propone para algo subido, a partir del nombre de su archivo (Medios, Diapositivas, Páginas web):
// "IMG_2024-anuncios_octubre.jpg" -> "IMG 2024 anuncios octubre". fallback, si no queda nada.
export const nameFromFile = (fileName, fallback) => fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || fallback;
