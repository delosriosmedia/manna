// Arrastrar archivos desde el escritorio hasta una pantalla (Medios, Videos): handle(archivos) decide qué
// hacer con ellos. Mientras se arrastra encima, la pantalla lleva la clase `dropping`.
export function acceptDrops(el, handle) {
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  el.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    el.classList.add('dropping');
  });
  el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('dropping'); });
  el.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    el.classList.remove('dropping');
    handle([...e.dataTransfer.files]);
  });
}
