// La portada no llama a la app: las muestras recorren lo que hay en el HTML y en los datos de biblia/ y himnos.json.
// Sin este guion, cada muestra se ve quieta y sin mandos; los textos y la tabla se leen igual.
import { formatReference, parseReference } from './biblia/reference.js';

const todos = (selector, raiz = document) => [...raiz.querySelectorAll(selector)];
const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sinTildes = (texto) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const llenar = (plantilla) => document.querySelector(plantilla).content.firstElementChild.cloneNode(true);
for (const mando of todos('[data-control]')) mando.hidden = false;

// Elegir uno de un grupo de botones.
const elegir = (botones, alElegir) => {
  for (const boton of botones) {
    boton.addEventListener('click', () => {
      for (const otro of botones) otro.setAttribute('aria-pressed', otro === boton);
      alElegir?.(boton);
    });
  }
};

// Como en la app, la letra baja hasta que todo el texto cabe en la pantalla.
const ajustar = (pantalla) => {
  const parrafos = todos('p', pantalla);
  for (const p of parrafos) p.style.fontSize = '';
  if (!parrafos.length) return;
  for (let t = parseFloat(getComputedStyle(parrafos[0]).fontSize); pantalla.scrollHeight > pantalla.clientHeight + 1 && t > 6; t -= 0.5) {
    for (const p of parrafos) p.style.fontSize = `${t}px`;
  }
};

addEventListener('resize', () => { for (const pantalla of todos('.diapositiva:not(.comparada)')) ajustar(pantalla); });

// Lo que sale en una pantalla: un texto, una imagen o un video.
const mostrar = (pantalla, { texto, cita, imagen, video }) => {
  const bloque = pantalla.querySelector('blockquote');
  bloque.hidden = !texto;
  pantalla.querySelector(':scope > img, :scope > video')?.remove();
  if (imagen || video) {
    const medio = document.createElement(video ? 'video' : 'img');
    medio.src = video ?? imagen;
    medio.alt = '';
    if (video) Object.assign(medio, { muted: true, loop: true, autoplay: true, playsInline: true });
    pantalla.prepend(medio);
  }
  if (texto) {
    bloque.children[0].textContent = texto;
    bloque.children[1].textContent = cita;
    if (!quieto) bloque.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
    ajustar(pantalla);
  }
  pantalla.querySelector('.puntero')?.setAttribute('hidden', '');
};

// Casi todas las muestras son lo mismo: una lista de pasos, uno al aire, y lo que sale en la pantalla.
for (const muestra of todos('[data-recorre]')) {
  const pasos = () => todos('[data-paso]', muestra);
  const ocultas = todos('[data-oculta]', muestra);
  const pantalla = muestra.querySelector('.diapositiva');
  const anterior = muestra.querySelector('[data-anterior]');
  const siguiente = muestra.querySelector('[data-siguiente]');
  const titulo = muestra.querySelector('[data-titulo]');
  const cuenta = muestra.querySelector('[data-cuenta]');
  const estado = muestra.querySelector('[data-estado]');
  const actual = () => pasos().findIndex((paso) => paso.hasAttribute('aria-current'));

  const ocultar = (boton) => {
    for (const otro of ocultas) otro.setAttribute('aria-pressed', otro === boton);
    muestra.dataset.pantalla = boton?.dataset.oculta ?? '';
    if (estado) estado.textContent = boton?.textContent ?? 'Al aire';
  };
  const poner = (n) => {
    const lista = pasos();
    lista[actual()]?.removeAttribute('aria-current');
    const paso = lista[n];
    paso.setAttribute('aria-current', 'true');
    // Como en la app: «Siguiente» con la pantalla en negro vuelve al aire con lo que sigue.
    ocultar(null);
    if (pantalla) mostrar(pantalla, paso.dataset);
    if (titulo) titulo.textContent = paso.querySelector('b').textContent;
    if (cuenta) cuenta.textContent = `${n + 1} de ${lista.length}`;
    if (anterior) anterior.disabled = n === 0;
    if (siguiente) siguiente.disabled = n === lista.length - 1;
    const caja = paso.closest('.con-scroll');
    if (caja) caja.scrollTop += paso.getBoundingClientRect().top - caja.getBoundingClientRect().top - caja.clientHeight / 2;
    // Un botón apagado pierde el foco: el teclado pasa al otro.
    if (document.activeElement?.disabled) (anterior.disabled ? siguiente : anterior).focus({ preventScroll: true });
  };

  muestra.addEventListener('click', (evento) => {
    const paso = evento.target.closest('button[data-paso]');
    if (paso) poner(pasos().indexOf(paso));
  });
  anterior?.addEventListener('click', () => poner(actual() - 1));
  siguiente?.addEventListener('click', () => poner(actual() + 1));
  for (const boton of ocultas) {
    boton.addEventListener('click', () => ocultar(boton.getAttribute('aria-pressed') === 'true' ? null : boton));
  }
}

// La Biblia: cualquier cita, con el mismo analizador de la app. Cada libro se baja la primera vez que se usa.
const libros = new Map();
const libro = (n) => {
  if (!libros.has(n)) libros.set(n, fetch(`biblia/rv1909/${n}.json`).then((r) => r.json()));
  return libros.get(n);
};
{
  const muestra = document.querySelector('[data-biblia]');
  const campo = muestra.querySelector('[data-cita-campo]');
  const lista = muestra.querySelector('[data-versos]');
  const aviso = muestra.querySelector('[data-aviso]');
  const avisar = (texto) => { aviso.textContent = texto; aviso.hidden = false; };
  let ultima = 0;
  const buscar = async () => {
    const turno = ++ultima;
    aviso.hidden = true;
    if (!campo.value.trim()) return;
    const ref = parseReference(campo.value);
    if (!ref) { avisar('Escribe una cita, por ejemplo Salmos 23, sal 23:1 o 1 co 13 4.'); return; }
    const datos = await libro(ref.book);
    if (turno !== ultima) return;
    const versos = datos.chapters.find((c) => c.n === ref.chapter)?.verses.filter((v) => ref.verseStart === null || (v.n >= ref.verseStart && v.n <= ref.verseEnd));
    if (!versos?.length) { avisar(`Esa cita no existe en ${datos.name}.`); return; }
    lista.replaceChildren(...versos.map((v) => {
      const fila = llenar('[data-fila-verso]');
      const cita = formatReference({ ...ref, verseStart: v.n, verseEnd: v.n }, datos.name);
      const boton = fila.firstElementChild;
      boton.dataset.texto = v.text;
      boton.dataset.cita = `${cita} (RV1909)`;
      boton.querySelector('b').textContent = cita;
      boton.querySelector('i').textContent = v.text;
      return fila;
    }));
    lista.firstElementChild.firstElementChild.click();
    lista.scrollTop = 0;
  };
  campo.addEventListener('input', buscar);
}

// Los himnos y las citas de versiones con derechos no están en la página. En internet los sirve un Worker de Cloudflare
// desde R2 (scripts/himnos-publicos); en el equipo, scripts/sitio-local.mjs desde Contenido.
const BASE = location.hostname.endsWith('manna-iglesia.es') ? 'https://himnos.manna-iglesia.es/' : 'himnos/';

// Comparar: la RV1909 viene en la página; RVR60, NTV y PDT se piden por cita, con el mismo tope que tiene el Worker.
{
  const TOPE = 4;
  const muestra = document.querySelector('[data-comparar]');
  const campo = muestra.querySelector('[data-comparar-campo]');
  const versiones = todos('[data-version]', muestra);
  const pantalla = muestra.querySelector('.comparada');
  const aviso = muestra.querySelector('[data-comparar-aviso]');
  const anterior = muestra.querySelector('[data-comparar-anterior]');
  const siguiente = muestra.querySelector('[data-comparar-siguiente]');
  const avisar = (texto) => { aviso.textContent = texto; aviso.hidden = false; };
  let lados = [new Map(), new Map()];
  let numeros = [];
  let paso = 0;
  let cita = '';
  let ultima = 0;

  const pedir = async (version, ref, desde, hasta) => {
    if (version === 'RV1909') {
      const versos = (await libro(ref.book)).chapters.find((c) => c.n === ref.chapter)?.verses ?? [];
      return versos.filter((v) => v.n >= desde && v.n <= hasta).map((v) => [v.n, v.text]);
    }
    const respuesta = await fetch(`${BASE}biblia/${version}/${ref.book}/${ref.chapter}/${desde}-${hasta}`);
    if (respuesta.status === 404) return [];
    if (!respuesta.ok) throw new Error(`Respondió ${respuesta.status}`);
    return (await respuesta.json()).versos;
  };
  const dibujar = () => {
    const n = numeros[paso];
    todos('.lado', pantalla).forEach((lado, i) => {
      lado.querySelector('b').textContent = versiones[i].value;
      lado.querySelector('p').textContent = lados[i].get(n) ?? 'Este versículo no está en esta versión.';
    });
    pantalla.querySelector('cite').textContent = `${cita}:${n}`;
    anterior.disabled = paso === 0;
    siguiente.disabled = paso === numeros.length - 1;
    if (document.activeElement?.disabled) (anterior.disabled ? siguiente : anterior).focus({ preventScroll: true });
  };
  const buscar = async () => {
    const turno = ++ultima;
    aviso.hidden = true;
    if (!campo.value.trim()) return;
    const ref = parseReference(campo.value);
    if (!ref) { avisar('Escribe una cita, por ejemplo Salmos 23:1, rom 8:28 o Juan 3:16-18.'); return; }
    const desde = ref.verseStart ?? 1;
    const pedido = ref.verseEnd ?? desde + TOPE - 1;
    const hasta = Math.min(pedido, desde + TOPE - 1);
    try {
      const [a, b] = await Promise.all(versiones.map((v) => pedir(v.value, ref, desde, hasta)));
      const { name } = await libro(ref.book);
      if (turno !== ultima) return;
      if (!a.length && !b.length) { avisar(`Esa cita no existe en ${name}.`); return; }
      lados = [new Map(a), new Map(b)];
      numeros = [...new Set([...a, ...b].map(([n]) => n))].sort((x, y) => x - y);
      cita = `${name} ${ref.chapter}`;
      paso = 0;
      dibujar();
      if (ref.verseStart === null || pedido > hasta) avisar(`Esta muestra compara hasta ${TOPE} versículos por consulta. En tu iglesia no hay tope.`);
    } catch {
      if (turno === ultima) avisar('No se pudo traer esa versión. Espera un momento e inténtalo de nuevo.');
    }
  };
  let espera;
  campo.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(buscar, 400); });
  anterior.addEventListener('click', () => { paso -= 1; dibujar(); });
  siguiente.addEventListener('click', () => { paso += 1; dibujar(); });
  versiones.forEach((version, i) => version.addEventListener('change', () => {
    // Comparar una versión consigo misma no muestra nada: la otra pasa a la siguiente.
    const otra = versiones[1 - i];
    if (otra.value === version.value) otra.selectedIndex = (otra.selectedIndex + 1) % otra.options.length;
    buscar();
  }));
  elegir(todos('[data-forma-boton]', muestra), (boton) => { pantalla.dataset.forma = boton.dataset.formaBoton; });
  buscar();
}

// El himnario: los videos completos de la app.
fetch('himnos.json').then((r) => r.json()).then((himnos) => {
  const muestra = document.querySelector('[data-himnario]');
  const video = muestra.querySelector('video');
  const lista = muestra.querySelector('[data-himnos]');
  const campo = muestra.querySelector('[data-himno-campo]');
  const cuenta = muestra.querySelector('[data-himnos-cuenta]');
  const titulo = muestra.querySelector('[data-himno-titulo]');
  const estado = muestra.querySelector('[data-himno-estado]');
  const aviso = muestra.querySelector('[data-himno-aviso]');
  const tocar = muestra.querySelector('[data-himno-tocar]');
  const avance = muestra.querySelector('[data-himno-avance]');
  const tiempo = muestra.querySelector('[data-himno-tiempo]');
  const volumen = muestra.querySelector('[data-himno-volumen]');
  const nivel = muestra.querySelector('[data-himno-nivel]');
  const reloj = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  video.volume = 0.5;

  const cargar = (himno) => {
    video.src = BASE + encodeURIComponent(himno.f);
    aviso.hidden = true;
  };
  let elegido = himnos[0];
  const filas = himnos.map((himno) => {
    const fila = llenar('[data-fila-himno]');
    const boton = fila.firstElementChild;
    boton.querySelector('b').textContent = `${himno.n}. ${himno.t}`;
    boton.querySelector('i').textContent = himno.c;
    if (himno === elegido) boton.setAttribute('aria-current', 'true');
    boton.addEventListener('click', () => {
      lista.querySelector('[aria-current]')?.removeAttribute('aria-current');
      boton.setAttribute('aria-current', 'true');
      elegido = himno;
      titulo.textContent = `${himno.n}. ${himno.t}`;
      video.removeAttribute('poster');
      cargar(himno);
      video.play().catch(() => {});
    });
    return { fila, buscar: sinTildes(`${himno.t} ${himno.c}`) };
  });
  lista.replaceChildren(...filas.map((f) => f.fila));

  campo.addEventListener('input', () => {
    const texto = sinTildes(campo.value.trim());
    const palabras = texto.split(/\s+/).filter(Boolean);
    let hay = 0;
    himnos.forEach((himno, i) => {
      const entra = /^\d+$/.test(texto) ? String(himno.n).startsWith(texto) : palabras.every((p) => filas[i].buscar.includes(p));
      filas[i].fila.hidden = !entra;
      if (entra) hay += 1;
    });
    cuenta.textContent = hay === 1 ? '1 himno' : `${hay} himnos`;
    lista.scrollTop = 0;
  });

  tocar.addEventListener('click', () => {
    if (!video.currentSrc) cargar(elegido);
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  });
  muestra.querySelector('[data-himno-detener]').addEventListener('click', () => {
    video.pause();
    if (video.currentSrc) video.currentTime = 0;
  });
  const dibujar = (sonando) => {
    tocar.querySelector('span').textContent = sonando ? 'Pausar' : 'Reproducir';
    tocar.querySelector('[data-himno-icono]').setAttribute('href', sonando ? '#i-pausa' : '#i-tocar');
    estado.textContent = sonando ? 'Sonando' : video.currentTime === 0 ? 'Listo' : 'Pausado';
  };
  video.addEventListener('play', () => dibujar(true));
  video.addEventListener('pause', () => dibujar(false));
  video.addEventListener('ended', () => { estado.textContent = 'Listo'; });
  video.addEventListener('error', () => { if (video.getAttribute('src')) { aviso.hidden = false; estado.textContent = 'Listo'; } });
  video.addEventListener('timeupdate', () => {
    if (!video.duration) return;
    avance.value = (video.currentTime / video.duration) * 1000;
    tiempo.textContent = `${reloj(video.currentTime)} / ${reloj(video.duration)}`;
  });
  avance.addEventListener('input', () => {
    if (video.duration) video.currentTime = (avance.value / 1000) * video.duration;
  });
  volumen.addEventListener('input', () => {
    video.volume = volumen.value / 100;
    nivel.textContent = `${volumen.value} %`;
  });
});

// El orden del culto: lo que se añade entra al orden.
{
  const muestra = document.querySelector('[data-muestra="preparar"]');
  const orden = muestra.querySelector('[data-orden]');
  const botones = todos('[data-anadir]', muestra);
  for (const boton of botones) {
    boton.addEventListener('click', () => {
      const fila = document.createElement('li');
      fila.className = 'fila orden-nueva';
      fila.append(boton.parentNode.querySelector('.ic').cloneNode(true), boton.previousElementSibling.cloneNode(true));
      orden.append(fila);
      boton.disabled = true;
      boton.textContent = 'Añadido';
      (botones.find((otro) => !otro.disabled) ?? orden).focus({ preventScroll: true });
    });
  }
}

// El celular: cada función, su pantalla.
elegir(todos('.nombres button'), (boton) => {
  for (const vista of todos('.vista')) vista.hidden = vista.dataset.vistaDe !== boton.dataset.vista;
});

// Cantado o pista.
for (const grupo of todos('[data-elige]')) {
  if (!grupo.querySelector('[data-forma-boton]')) elegir(todos('button', grupo));
}

// El presentador: señalar con el dedo.
for (const pantalla of todos('[data-senalar]')) {
  const puntero = pantalla.querySelector('.puntero');
  pantalla.addEventListener('click', (evento) => {
    const caja = pantalla.getBoundingClientRect();
    puntero.style.left = `${((evento.clientX - caja.left) / caja.width) * 100}%`;
    puntero.style.top = `${((evento.clientY - caja.top) / caja.height) * 100}%`;
    puntero.hidden = false;
  });
}

// La conexión: qué queda encendido según cómo esté la iglesia.
{
  const conexion = document.querySelector('[data-conexion]');
  conexion.dataset.activo = 'sin-router';
  elegir(todos('[data-modo]', conexion), (boton) => { conexion.dataset.activo = boton.dataset.modo; });
}

// Entradas al hacer scroll. Nada queda oculto en reposo: sin guion, al imprimir o en una captura, todo se ve.
if (!quieto) {
  const curva = 'cubic-bezier(0.16, 1, 0.3, 1)';
  const observador = new IntersectionObserver((entradas) => {
    for (const { isIntersecting, target } of entradas) {
      if (!isIntersecting) continue;
      observador.unobserve(target);
      if (target.hasAttribute('data-mascara')) {
        target.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 1000, easing: curva, fill: 'backwards' });
      } else {
        target.animate(
          [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }],
          { duration: 600, easing: curva, delay: [...target.parentNode.children].indexOf(target) * 80, fill: 'backwards' },
        );
      }
    }
  });
  for (const bloque of todos('.aparece, [data-mascara]')) {
    if (bloque.getBoundingClientRect().top > innerHeight) observador.observe(bloque);
  }
}
