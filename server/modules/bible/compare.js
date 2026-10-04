import { HttpError } from '../../core/router.js';

const LAYOUTS = ['columns', 'rows']; // lado a lado, o una sobre otra

// Tipo de contenido "comparación": el mismo pasaje en dos versiones a la vez.
//   data: { versions: [primera, segunda], ref, layout }
// Los pasos y "siguiente" los marca la primera versión; si a la segunda le falta un versículo,
// su lado va vacío y la pantalla lo dice. La disposición es un mando en vivo.
export function registerCompare(app, library) {
  const label = (id) => library.version(id)?.abbr || library.version(id)?.name || '';

  // El pasaje en las dos versiones, o null si no existe en la primera o falta alguna versión.
  function build(data, ref) {
    const [a, b] = Array.isArray(data?.versions) ? data.versions : [];
    if (!library.version(a) || !library.version(b) || a === b) return null;
    const main = library.passage(a, ref);
    if (!main) return null;
    const other = library.passage(b, main.ref);
    return {
      reference: main.reference,
      ref: main.ref,
      layout: LAYOUTS.includes(data.layout) ? data.layout : 'columns',
      sides: [
        { versionId: a, version: label(a), verses: main.verses },
        // passage() ajusta el rango a lo que exista: aquí solo valen los versículos pedidos.
        { versionId: b, version: label(b), verses: (other?.verses || []).filter((v) => v.n >= main.ref.verseStart && v.n <= main.ref.verseEnd) },
      ],
    };
  }

  app.kind('compare', {
    label: 'Comparador',
    describe(data) {
      const c = build(data, data?.ref);
      if (!c) return null;
      return {
        title: c.reference,
        subtitle: c.sides.map((side) => side.version).join(' · '),
        steps: c.sides[0].verses.length,
        data: { versions: c.sides.map((side) => side.versionId), ref: c.ref, layout: c.layout },
      };
    },
    resolve(data, step) {
      const c = build(data, data?.ref);
      if (!c || step == null) return c;
      const verse = c.sides[0].verses[step];
      return verse ? build(data, { ...c.ref, verseStart: verse.n, verseEnd: verse.n }) : null;
    },
    // Fuera del orden del culto, "siguiente" sigue leyendo en las dos versiones.
    neighbor(data, step, delta) {
      const c = this.resolve(data, step);
      const ref = c && library.step(c.sides[0].versionId, c.ref, delta);
      return ref ? { data: { ...data, ref }, step: null } : null;
    },
    live(content, previous) {
      return { layout: LAYOUTS.includes(previous?.state?.layout) ? previous.state.layout : content.layout };
    },
    control(state, patch) {
      if (patch.layout !== undefined && !LAYOUTS.includes(patch.layout)) throw new HttpError(400, 'Esa disposición no existe.');
      return { layout: patch.layout ?? state.layout };
    },
  });
}
