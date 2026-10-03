// ==========================================
// 1. CONSTANTES Y ESTADO DE LA APLICACIÓN
// ==========================================
const CHANNEL_NAME = 'biblia_projection_channel';
const STORAGE_KEY = 'biblia_projection_state';
const DB_NAME = 'BibliaProyectorDB';
const DB_VERSION = 1;
const BIBLE_STORE = 'biblias';
const PLAYLIST_KEY = 'biblia_playlist';
const STYLES_KEY = 'biblia_projection_styles';

let channel = null;
try {
  channel = new BroadcastChannel(CHANNEL_NAME);
} catch (e) {
  console.warn('BroadcastChannel no disponible, usando fallback', e);
}

// Estado global
let state = {
  db: null,
  biblias: [],              // Lista de biblias disponibles
  currentBibleId: null,     // ID de biblia activa
  currentBible: null,       // Datos de la biblia activa
  currentBook: null,        // Libro seleccionado
  currentChapter: 1,        // Capítulo seleccionado
  selectedVerse: null,      // Versículo en vista previa
  liveVerse: null,          // Versículo actualmente en pantalla
  displayMode: 'clear',     // 'live', 'black', 'clear', 'hidden'
  isProjectorOpen: false,
  projectorWindow: null,
  playlist: [],
  styles: {
    fontSize: 48,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    textColor: '#ffffff',
    refColor: '#ffd166',
    refPosition: 'bottom-center',
    backgroundType: 'gradient',
    bgColor: '#0f172a',
    bgGradient: 'radial-gradient(ellipse at center, #1e293b 0%, #0f172a 100%)',
    bgImage: '',
    overlayOpacity: 0.35,
    textShadow: 'strong',
    textAlign: 'center'
  }
};

// ==========================================
// 2. BASE DE DATOS LOCAL (IndexedDB)
// ==========================================
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(BIBLE_STORE)) {
        db.createObjectStore(BIBLE_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => {
      state.db = e.target.result;
      resolve(state.db);
    };
    request.onerror = (e) => {
      console.error('Error abriendo IndexedDB:', e);
      reject(e);
    };
  });
}

function saveBibleToDB(bibleObj) {
  return new Promise((resolve, reject) => {
    if (!state.db) return reject('DB no inicializada');
    const tx = state.db.transaction(BIBLE_STORE, 'readwrite');
    const store = tx.objectStore(BIBLE_STORE);
    store.put(bibleObj);
    tx.oncomplete = () => resolve(bibleObj);
    tx.onerror = (e) => reject(e);
  });
}

function getAllBiblesFromDB() {
  return new Promise((resolve, reject) => {
    if (!state.db) return reject('DB no inicializada');
    const tx = state.db.transaction(BIBLE_STORE, 'readonly');
    const store = tx.objectStore(BIBLE_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e);
  });
}

function deleteBibleFromDB(id) {
  return new Promise((resolve, reject) => {
    if (!state.db) return reject('DB no inicializada');
    const tx = state.db.transaction(BIBLE_STORE, 'readwrite');
    const store = tx.objectStore(BIBLE_STORE);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}

// ==========================================
// 3. PARSER PARA FORMATO .XMM (OPENLP XML)
// ==========================================
function parseXMM(xmlString, fileName = 'Biblia') {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  
  const parseError = xmlDoc.getElementsByTagName('parsererror');
  if (parseError.length > 0) {
    throw new Error('El archivo XML no tiene un formato válido.');
  }

  const bookNodes = xmlDoc.getElementsByTagName('b');
  if (!bookNodes || bookNodes.length === 0) {
    throw new Error('No se encontraron libros (<b n="...">) en el archivo .xmm');
  }

  const books = [];
  let totalVerses = 0;

  for (let i = 0; i < bookNodes.length; i++) {
    const bNode = bookNodes[i];
    const bookName = (bNode.getAttribute('n') || `Libro ${i+1}`).trim();
    const chapterNodes = bNode.getElementsByTagName('c');
    const chapters = [];

    for (let c = 0; c < chapterNodes.length; c++) {
      const cNode = chapterNodes[c];
      const chapterNum = parseInt(cNode.getAttribute('n') || (c + 1), 10);
      const verseNodes = cNode.getElementsByTagName('v');
      const verses = [];

      for (let v = 0; v < verseNodes.length; v++) {
        const vNode = verseNodes[v];
        const verseNum = parseInt(vNode.getAttribute('n') || (v + 1), 10);
        const text = vNode.textContent.replace(/\s+/g, ' ').trim();
        verses.push({
          num: verseNum,
          text: text
        });
        totalVerses++;
      }

      if (verses.length > 0) {
        chapters.push({
          num: chapterNum,
          verses: verses
        });
      }
    }

    if (chapters.length > 0) {
      books.push({
        name: bookName,
        chapters: chapters
      });
    }
  }

  const cleanName = fileName.replace(/\.xmm$/i, '').trim();

  return {
    id: 'bible_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    name: cleanName,
    fileName: fileName,
    bookCount: books.length,
    verseCount: totalVerses,
    importedAt: new Date().toLocaleDateString(),
    books: books
  };
}

// ==========================================
// 4. SINCRONIZACIÓN Y COMUNICACIÓN PROYECTOR
// ==========================================
function sendToProjector(action, payload = {}) {
  const message = { type: action, ...payload };
  
  if (channel) {
    try {
      channel.postMessage(message);
    } catch (e) {
      console.warn('Error enviando por BroadcastChannel', e);
    }
  }

  // Fallback con localStorage para cualquier navegador/pestaña
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      type: action,
      ...payload,
      _timestamp: Date.now()
    }));
  } catch (e) {}

  // Fallback directo a ventana emergente si fue abierta por script
  if (state.projectorWindow && !state.projectorWindow.closed) {
    try {
      state.projectorWindow.postMessage(message, '*');
    } catch (e) {}
  }
}

function syncFullState() {
  const currentText = state.liveVerse ? state.liveVerse.text : '';
  const currentRef = state.liveVerse ? `${state.liveVerse.book} ${state.liveVerse.chapter}:${state.liveVerse.num}` : '';
  const bibleName = state.currentBible ? state.currentBible.name : '';

  sendToProjector('UPDATE', {
    state: {
      mode: state.displayMode,
      text: currentText,
      reference: currentRef,
      version: bibleName,
      styles: state.styles
    }
  });

  updatePreview();
  updateLiveButtons();
  updateVerseListHighlights();
}

function checkProjectorStatus() {
  sendToProjector('PING');
  setTimeout(() => {
    // Si la ventana abierta por script está activa
    if (state.projectorWindow && !state.projectorWindow.closed) {
      setProjectorOnline(true);
    }
  }, 300);
}

function setProjectorOnline(isOnline) {
  state.isProjectorOpen = isOnline;
  const statusPill = document.getElementById('projector-status-pill');
  const indicator = document.getElementById('projector-indicator');
  const label = document.getElementById('projector-status-text');

  if (isOnline) {
    indicator.classList.add('online');
    label.textContent = 'Proyección Activa';
    statusPill.title = 'La ventana de proyección está conectada';
  } else {
    indicator.classList.remove('online');
    label.textContent = 'Proyector Desconectado';
    statusPill.title = 'Haz clic en "Abrir Pantalla de Proyección" para iniciar la ventana';
  }
}

// Receptor de mensajes del proyector
if (channel) {
  channel.onmessage = (event) => {
    handleProjectorMessage(event.data);
  };
}

window.addEventListener('storage', (e) => {
  if (e.key === 'biblia_projection_response' && e.newValue) {
    try {
      const data = JSON.parse(e.newValue);
      handleProjectorMessage(data);
    } catch (err) {}
  }
});

function handleProjectorMessage(msg) {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'PONG' || msg.type === 'PROJECTION_READY') {
    setProjectorOnline(true);
    // Sincronizar estado actual con la pantalla que recién abrió
    syncFullState();
  } else if (msg.type === 'NAV_NEXT') {
    navigateVerse(1);
  } else if (msg.type === 'NAV_PREV') {
    navigateVerse(-1);
  } else if (msg.type === 'TOGGLE_BLACK') {
    toggleBlackout();
  } else if (msg.type === 'TOGGLE_CLEAR') {
    toggleClear();
  }
}

// ==========================================
// 5. NAVEGACIÓN Y RENDERIZADO BÍBLICO
// ==========================================
function selectBible(bibleId) {
  const bible = state.biblias.find(b => b.id === bibleId);
  if (!bible) return;

  state.currentBibleId = bibleId;
  state.currentBible = bible;
  
  // Guardar última biblia seleccionada
  localStorage.setItem('biblia_active_id', bibleId);

  // Actualizar selector visual
  const selectEl = document.getElementById('bible-version-select');
  if (selectEl) selectEl.value = bibleId;

  // Renderizar libros
  renderBookList();
}

function renderBookList(filterQuery = '', testament = 'ALL') {
  const listEl = document.getElementById('book-list');
  if (!listEl || !state.currentBible) return;

  listEl.innerHTML = '';
  const books = state.currentBible.books || [];

  // 39 libros en AT para la mayoría de versiones estándar
  const otLimit = 39;

  books.forEach((book, index) => {
    const isOT = index < otLimit;
    if (testament === 'AT' && !isOT) return;
    if (testament === 'NT' && isOT) return;

    if (filterQuery && !book.name.toLowerCase().includes(filterQuery.toLowerCase())) {
      return;
    }

    const item = document.createElement('div');
    item.className = 'book-item';
    if (state.currentBook && state.currentBook.name === book.name) {
      item.classList.add('selected');
    }
    item.textContent = book.name;
    item.title = book.name;
    item.onclick = () => selectBook(book);
    listEl.appendChild(item);
  });

  // Si no hay libro seleccionado actualmente, seleccionar el primero disponible
  if (!state.currentBook && books.length > 0) {
    selectBook(books[0]);
  }
}

function selectBook(book) {
  state.currentBook = book;
  state.currentChapter = 1;

  // Actualizar estilos en lista de libros
  document.querySelectorAll('.book-item').forEach(el => {
    el.classList.toggle('selected', el.textContent === book.name);
  });

  renderChapterGrid();
  renderVerseList();
}

function renderChapterGrid() {
  const gridEl = document.getElementById('grid-chapters');
  if (!gridEl || !state.currentBook) return;

  gridEl.innerHTML = '';
  const chapters = state.currentBook.chapters || [];

  chapters.forEach(ch => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'btn-chip';
    if (ch.num === state.currentChapter) {
      chip.classList.add('selected');
    }
    chip.textContent = ch.num;
    chip.onclick = () => {
      state.currentChapter = ch.num;
      document.querySelectorAll('#grid-chapters .btn-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      renderVerseList();
    };
    gridEl.appendChild(chip);
  });
}

function renderVerseList() {
  const container = document.getElementById('verse-list-container');
  const titleEl = document.getElementById('current-reading-title');
  if (!container || !state.currentBook) return;

  const currentChObj = state.currentBook.chapters.find(c => c.num === state.currentChapter);
  if (!currentChObj) {
    container.innerHTML = '<div style="color:var(--text-dim); text-align:center; padding:2rem;">Capítulo no encontrado</div>';
    return;
  }

  titleEl.textContent = `${state.currentBook.name} ${state.currentChapter}`;
  container.innerHTML = '';

  currentChObj.verses.forEach(v => {
    const card = document.createElement('div');
    card.className = 'verse-card';
    card.id = `verse-card-${v.num}`;

    // Resaltados
    if (state.selectedVerse && 
        state.selectedVerse.book === state.currentBook.name && 
        state.selectedVerse.chapter === state.currentChapter && 
        state.selectedVerse.num === v.num) {
      card.classList.add('selected-preview');
    }

    if (state.liveVerse && 
        state.liveVerse.book === state.currentBook.name && 
        state.liveVerse.chapter === state.currentChapter && 
        state.liveVerse.num === v.num &&
        state.displayMode === 'live') {
      card.classList.add('is-live');
    }

    const verseData = {
      book: state.currentBook.name,
      chapter: state.currentChapter,
      num: v.num,
      text: v.text
    };

    card.innerHTML = `
      <span class="verse-num">${v.num}</span>
      <span class="verse-text">${v.text}</span>
    `;

    // Clic selecciona en preview
    card.onclick = () => {
      setPreviewVerse(verseData);
    };

    // Doble clic proyecta inmediatamente
    card.ondblclick = () => {
      setPreviewVerse(verseData);
      goLive();
    };

    container.appendChild(card);
  });

  // Si no hay versículo seleccionado en vista previa, seleccionar el primero
  if (!state.selectedVerse && currentChObj.verses.length > 0) {
    setPreviewVerse({
      book: state.currentBook.name,
      chapter: state.currentChapter,
      num: currentChObj.verses[0].num,
      text: currentChObj.verses[0].text
    });
  }
}

function updateVerseListHighlights() {
  document.querySelectorAll('.verse-card').forEach(card => {
    card.classList.remove('is-live');
    if (state.liveVerse && 
        state.currentBook &&
        state.liveVerse.book === state.currentBook.name && 
        state.liveVerse.chapter === state.currentChapter && 
        state.displayMode === 'live') {
      const liveCard = document.getElementById(`verse-card-${state.liveVerse.num}`);
      if (liveCard) liveCard.classList.add('is-live');
    }
  });
}

function setPreviewVerse(verseData) {
  state.selectedVerse = verseData;

  document.querySelectorAll('.verse-card').forEach(c => c.classList.remove('selected-preview'));
  const card = document.getElementById(`verse-card-${verseData.num}`);
  if (card) card.classList.add('selected-preview');

  updatePreview();
}

function updatePreview() {
  const pText = document.getElementById('preview-text');
  const pRef = document.getElementById('preview-reference');
  const pScreen = document.getElementById('preview-screen');
  const pOverlay = document.getElementById('preview-overlay');

  if (!pText || !pRef) return;

  const verseToShow = state.selectedVerse || state.liveVerse;

  if (verseToShow) {
    pText.textContent = verseToShow.text;
    pRef.textContent = `${verseToShow.book} ${verseToShow.chapter}:${verseToShow.num}`;
  } else {
    pText.textContent = 'Selecciona un versículo para ver la vista previa';
    pRef.textContent = '';
  }

  // Estilos del mini preview
  if (state.styles.backgroundType === 'image' && state.styles.bgImage) {
    pScreen.style.background = `url(${state.styles.bgImage}) center/cover no-repeat`;
  } else if (state.styles.backgroundType === 'gradient' && state.styles.bgGradient) {
    pScreen.style.background = state.styles.bgGradient;
  } else {
    pScreen.style.background = state.styles.bgColor || '#0f172a';
  }

  pOverlay.style.background = `rgba(0, 0, 0, ${state.styles.overlayOpacity || 0.35})`;
  pText.style.color = state.styles.textColor || '#ffffff';
  pRef.style.color = state.styles.refColor || '#ffd166';
  pText.style.fontFamily = state.styles.fontFamily;
}

// ==========================================
// 6. ACCIONES EN VIVO (BROADCAST)
// ==========================================
function goLive() {
  if (!state.selectedVerse) return;
  state.liveVerse = { ...state.selectedVerse };
  state.displayMode = 'live';
  syncFullState();
  showToast(`En vivo: ${state.liveVerse.book} ${state.liveVerse.chapter}:${state.liveVerse.num}`);
}

function toggleBlackout() {
  if (state.displayMode === 'black') {
    state.displayMode = state.liveVerse ? 'live' : 'clear';
  } else {
    state.displayMode = 'black';
  }
  syncFullState();
}

function toggleClear() {
  if (state.displayMode === 'clear') {
    state.displayMode = state.liveVerse ? 'live' : 'clear';
  } else {
    state.displayMode = 'clear';
  }
  syncFullState();
}

function clearProjection() {
  state.displayMode = 'clear';
  state.liveVerse = null;
  syncFullState();
  showToast('Pantalla limpiada');
}

function updateLiveButtons() {
  const btnLive = document.getElementById('btn-live');
  const btnBlack = document.getElementById('btn-black');
  const btnClear = document.getElementById('btn-clear');

  if (btnLive) btnLive.classList.toggle('active-live', state.displayMode === 'live');
  if (btnBlack) btnBlack.classList.toggle('active-black', state.displayMode === 'black');
  if (btnClear) btnClear.classList.toggle('active-clear', state.displayMode === 'clear');
}

// Navegar versículo (offset: +1 ó -1)
function navigateVerse(offset) {
  if (!state.currentBook) return;

  const currentChObj = state.currentBook.chapters.find(c => c.num === state.currentChapter);
  if (!currentChObj) return;

  const activeVerse = state.displayMode === 'live' ? state.liveVerse : state.selectedVerse;
  const currentNum = activeVerse ? activeVerse.num : 1;
  const targetNum = currentNum + offset;

  const nextVerse = currentChObj.verses.find(v => v.num === targetNum);

  if (nextVerse) {
    const verseData = {
      book: state.currentBook.name,
      chapter: state.currentChapter,
      num: nextVerse.num,
      text: nextVerse.text
    };
    setPreviewVerse(verseData);
    if (state.displayMode === 'live') {
      state.liveVerse = verseData;
      syncFullState();
    }
    // Scroll hacia el versículo
    const el = document.getElementById(`verse-card-${nextVerse.num}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    // Si llegamos al final del capítulo y avanzamos
    if (offset > 0) {
      const nextChapterNum = state.currentChapter + 1;
      const nextChObj = state.currentBook.chapters.find(c => c.num === nextChapterNum);
      if (nextChObj && nextChObj.verses.length > 0) {
        state.currentChapter = nextChapterNum;
        renderChapterGrid();
        renderVerseList();
        const firstVerse = nextChObj.verses[0];
        const verseData = {
          book: state.currentBook.name,
          chapter: nextChapterNum,
          num: firstVerse.num,
          text: firstVerse.text
        };
        setPreviewVerse(verseData);
        if (state.displayMode === 'live') {
          state.liveVerse = verseData;
          syncFullState();
        }
      }
    } else if (offset < 0) {
      // Retroceder al capítulo anterior
      const prevChapterNum = state.currentChapter - 1;
      const prevChObj = state.currentBook.chapters.find(c => c.num === prevChapterNum);
      if (prevChObj && prevChObj.verses.length > 0) {
        state.currentChapter = prevChapterNum;
        renderChapterGrid();
        renderVerseList();
        const lastVerse = prevChObj.verses[prevChObj.verses.length - 1];
        const verseData = {
          book: state.currentBook.name,
          chapter: prevChapterNum,
          num: lastVerse.num,
          text: lastVerse.text
        };
        setPreviewVerse(verseData);
        if (state.displayMode === 'live') {
          state.liveVerse = verseData;
          syncFullState();
        }
      }
    }
  }
}

// ==========================================
// 7. BUSCADOR INTELIGENTE
// ==========================================
function setupSmartSearch() {
  const searchInput = document.getElementById('search-input');
  const resultsPanel = document.getElementById('search-results-panel');

  if (!searchInput || !resultsPanel) return;

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (!query) return;

      // 1. Intentar interpretar como referencia bíblica (ej. "Juan 3:16" o "1 Juan 2:1" o "Génesis 1")
      if (tryJumpToReference(query)) {
        resultsPanel.style.display = 'none';
        searchInput.blur();
        return;
      }

      // 2. Si no es cita directa, buscar por texto
      performTextSearch(query);
    }
  });

  searchInput.addEventListener('input', () => {
    if (searchInput.value.trim().length === 0) {
      resultsPanel.style.display = 'none';
    }
  });
}

function tryJumpToReference(ref) {
  if (!state.currentBible) return false;

  // Regex para referencias como: "Juan 3:16", "1 Corintios 13:4", "Salmos 23", "Génesis 1:1"
  const match = ref.match(/^(([123]\s*)?[a-zA-ZáéíóúñÁÉÍÓÚÑ]+)\s*(\d+)(?::(\d+))?$/i);
  if (!match) return false;

  const rawBook = match[1].toLowerCase().replace(/\s+/g, '');
  const chapter = parseInt(match[3], 10);
  const verse = match[4] ? parseInt(match[4], 10) : 1;

  // Buscar coincidencia en libros
  const foundBook = state.currentBible.books.find(b => {
    const cleanB = b.name.toLowerCase().replace(/\s+/g, '');
    return cleanB.startsWith(rawBook) || cleanB.includes(rawBook);
  });

  if (!foundBook) return false;

  const foundChapter = foundBook.chapters.find(c => c.num === chapter);
  if (!foundChapter) return false;

  // Seleccionar libro y capítulo
  selectBook(foundBook);
  state.currentChapter = chapter;
  renderChapterGrid();
  renderVerseList();

  const foundVerse = foundChapter.verses.find(v => v.num === verse) || foundChapter.verses[0];
  if (foundVerse) {
    const vData = {
      book: foundBook.name,
      chapter: chapter,
      num: foundVerse.num,
      text: foundVerse.text
    };
    setPreviewVerse(vData);

    const el = document.getElementById(`verse-card-${foundVerse.num}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  showToast(`Saltando a ${foundBook.name} ${chapter}:${verse}`);
  return true;
}

function performTextSearch(term) {
  const resultsPanel = document.getElementById('search-results-panel');
  if (!state.currentBible || !resultsPanel) return;

  resultsPanel.innerHTML = '<div style="padding:0.5rem; color:var(--text-muted);">Buscando...</div>';
  resultsPanel.style.display = 'block';

  const query = term.toLowerCase();
  const matches = [];

  for (const book of state.currentBible.books) {
    for (const ch of book.chapters) {
      for (const v of ch.verses) {
        if (v.text.toLowerCase().includes(query)) {
          matches.push({
            book: book.name,
            chapter: ch.num,
            num: v.num,
            text: v.text
          });
          if (matches.length >= 40) break; // Límite razonable para rapidez
        }
      }
      if (matches.length >= 40) break;
    }
    if (matches.length >= 40) break;
  }

  if (matches.length === 0) {
    resultsPanel.innerHTML = `<div style="padding:0.75rem; color:var(--text-muted); text-align:center;">No se hallaron versículos con "${term}"</div>`;
    return;
  }

  resultsPanel.innerHTML = '';
  matches.forEach(m => {
    const item = document.createElement('div');
    item.className = 'search-result-item';

    // Resaltar coincidencia
    const regex = new RegExp(`(${query})`, 'gi');
    const highlightedText = m.text.replace(regex, '<mark style="background:#fef08a; color:#1e293b; padding:0 2px; border-radius:2px;">$1</mark>');

    item.innerHTML = `
      <div class="search-result-ref">${m.book} ${m.chapter}:${m.num}</div>
      <div style="color:var(--text-muted);">${highlightedText}</div>
    `;

    item.onclick = () => {
      // Saltar al libro y capítulo
      const bObj = state.currentBible.books.find(b => b.name === m.book);
      if (bObj) {
        selectBook(bObj);
        state.currentChapter = m.chapter;
        renderChapterGrid();
        renderVerseList();
        setPreviewVerse(m);

        const el = document.getElementById(`verse-card-${m.num}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      resultsPanel.style.display = 'none';
    };

    resultsPanel.appendChild(item);
  });
}

// ==========================================
// 8. GUION DE CULTO / PLAYLIST
// ==========================================
function addToPlaylist(verseData) {
  if (!verseData) return;
  const exists = state.playlist.some(p => p.book === verseData.book && p.chapter === verseData.chapter && p.num === verseData.num);
  if (exists) {
    showToast('Este versículo ya está en el guión');
    return;
  }

  state.playlist.push({ ...verseData });
  savePlaylist();
  renderPlaylist();
  showToast(`Añadido al guión: ${verseData.book} ${verseData.chapter}:${verseData.num}`);
}

function removeFromPlaylist(index) {
  state.playlist.splice(index, 1);
  savePlaylist();
  renderPlaylist();
}

function savePlaylist() {
  localStorage.setItem(PLAYLIST_KEY, JSON.stringify(state.playlist));
}

function loadPlaylist() {
  try {
    const data = localStorage.getItem(PLAYLIST_KEY);
    if (data) {
      state.playlist = JSON.parse(data);
    }
  } catch (e) {}
}

function renderPlaylist() {
  const container = document.getElementById('playlist-list');
  if (!container) return;

  if (state.playlist.length === 0) {
    container.innerHTML = '<div style="color:var(--text-dim); text-align:center; padding:1.5rem; font-size:0.8rem;">No hay versículos en el guión.<br>Usa el botón "+ Guión" para agregar los pasajes de la reunión.</div>';
    return;
  }

  container.innerHTML = '';
  state.playlist.forEach((p, idx) => {
    const item = document.createElement('div');
    item.className = 'playlist-item';
    item.innerHTML = `
      <div style="flex:1;">
        <strong style="color:#60a5fa;">${p.book} ${p.chapter}:${p.num}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:220px;">${p.text}</div>
      </div>
      <button class="btn btn-secondary" style="padding:2px 8px; font-size:0.75rem;" title="Eliminar del guión">&times;</button>
    `;

    // Clic en el cuerpo carga el versículo
    item.onclick = (e) => {
      if (e.target.tagName === 'BUTTON') {
        removeFromPlaylist(idx);
        return;
      }
      // Saltar al libro y capítulo
      const bObj = state.currentBible.books.find(b => b.name === p.book);
      if (bObj) {
        selectBook(bObj);
        state.currentChapter = p.chapter;
        renderChapterGrid();
        renderVerseList();
        setPreviewVerse(p);
        goLive();
      }
    };

    container.appendChild(item);
  });
}

// ==========================================
// 9. AJUSTES DE PROYECCIÓN Y ESTILOS
// ==========================================
function loadStyles() {
  try {
    const saved = localStorage.getItem(STYLES_KEY);
    if (saved) {
      state.styles = { ...state.styles, ...JSON.parse(saved) };
    }
  } catch (e) {}
}

function saveStyles() {
  localStorage.setItem(STYLES_KEY, JSON.stringify(state.styles));
  sendToProjector('SET_STYLES', { styles: state.styles });
  updatePreview();
}

function initStyleControls() {
  // Font Size
  const fontSizeSlider = document.getElementById('style-font-size');
  const fontSizeVal = document.getElementById('font-size-val');
  if (fontSizeSlider) {
    fontSizeSlider.value = state.styles.fontSize;
    fontSizeVal.textContent = `${state.styles.fontSize}px`;
    fontSizeSlider.oninput = () => {
      state.styles.fontSize = parseInt(fontSizeSlider.value, 10);
      fontSizeVal.textContent = `${state.styles.fontSize}px`;
      saveStyles();
    };
  }

  // Text Color
  const textColorInput = document.getElementById('style-text-color');
  if (textColorInput) {
    textColorInput.value = state.styles.textColor;
    textColorInput.onchange = () => {
      state.styles.textColor = textColorInput.value;
      saveStyles();
    };
  }

  // Ref Color
  const refColorInput = document.getElementById('style-ref-color');
  if (refColorInput) {
    refColorInput.value = state.styles.refColor;
    refColorInput.onchange = () => {
      state.styles.refColor = refColorInput.value;
      saveStyles();
    };
  }

  // Font Family
  const fontSelect = document.getElementById('style-font-family');
  if (fontSelect) {
    fontSelect.value = state.styles.fontFamily;
    fontSelect.onchange = () => {
      state.styles.fontFamily = fontSelect.value;
      saveStyles();
    };
  }

  // Ref Position
  const refPosSelect = document.getElementById('style-ref-position');
  if (refPosSelect) {
    refPosSelect.value = state.styles.refPosition;
    refPosSelect.onchange = () => {
      state.styles.refPosition = refPosSelect.value;
      saveStyles();
    };
  }

  // Text Shadow
  const shadowSelect = document.getElementById('style-text-shadow');
  if (shadowSelect) {
    shadowSelect.value = state.styles.textShadow;
    shadowSelect.onchange = () => {
      state.styles.textShadow = shadowSelect.value;
      saveStyles();
    };
  }

  // Overlay opacity
  const overlaySlider = document.getElementById('style-overlay-opacity');
  const overlayVal = document.getElementById('overlay-opacity-val');
  if (overlaySlider) {
    overlaySlider.value = state.styles.overlayOpacity * 100;
    overlayVal.textContent = `${Math.round(state.styles.overlayOpacity * 100)}%`;
    overlaySlider.oninput = () => {
      state.styles.overlayOpacity = parseInt(overlaySlider.value, 10) / 100;
      overlayVal.textContent = `${overlaySlider.value}%`;
      saveStyles();
    };
  }

  // Custom Image Upload
  const bgImageInput = document.getElementById('style-bg-image-input');
  if (bgImageInput) {
    bgImageInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          state.styles.backgroundType = 'image';
          state.styles.bgImage = event.target.result;
          saveStyles();
          showToast('Imagen de fondo cargada');
        };
        reader.readAsDataURL(file);
      }
    };
  }

  // Presets de Fondos
  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.onclick = () => {
      const grad = chip.getAttribute('data-gradient');
      const col = chip.getAttribute('data-color');
      if (grad) {
        state.styles.backgroundType = 'gradient';
        state.styles.bgGradient = grad;
        state.styles.bgImage = '';
      } else if (col) {
        state.styles.backgroundType = 'solid';
        state.styles.bgColor = col;
        state.styles.bgImage = '';
      }
      saveStyles();
      showToast('Fondo actualizado');
    };
  });
}

// ==========================================
// 10. GESTIÓN DE ARCHIVOS .XMM (MODAL)
// ==========================================
function openBibleModal() {
  const modal = document.getElementById('bible-modal');
  if (modal) {
    modal.style.display = 'flex';
    renderBibleTable();
  }
}

function closeBibleModal() {
  const modal = document.getElementById('bible-modal');
  if (modal) modal.style.display = 'none';
}

function renderBibleTable() {
  const tbody = document.getElementById('bible-list-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  state.biblias.forEach(b => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${b.name}</strong></td>
      <td>${b.bookCount} libros (${b.verseCount || '?'} versículos)</td>
      <td>${b.importedAt || '-'}</td>
      <td>
        <button class="btn btn-danger" style="padding:2px 8px; font-size:0.75rem;" onclick="removeBible('${b.id}')">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Actualizar dropdown del encabezado
  const selectEl = document.getElementById('bible-version-select');
  if (selectEl) {
    selectEl.innerHTML = '';
    state.biblias.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.name} (${b.bookCount} libros)`;
      selectEl.appendChild(opt);
    });
    if (state.currentBibleId) {
      selectEl.value = state.currentBibleId;
    }
  }
}

async function removeBible(id) {
  if (state.biblias.length <= 1) {
    alert('No puedes eliminar la única biblia disponible.');
    return;
  }
  if (!confirm('¿Deseas eliminar esta versión de la biblia?')) return;

  await deleteBibleFromDB(id);
  state.biblias = state.biblias.filter(b => b.id !== id);

  if (state.currentBibleId === id) {
    selectBible(state.biblias[0].id);
  }
  renderBibleTable();
  showToast('Biblia eliminada');
}

function handleFileInput(files) {
  if (!files || files.length === 0) return;

  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const xmlContent = e.target.result;
        showToast(`Procesando ${file.name}...`);
        const parsedBible = parseXMM(xmlContent, file.name);
        await saveBibleToDB(parsedBible);
        
        // Agregar a la lista
        state.biblias = state.biblias.filter(b => b.id !== parsedBible.id);
        state.biblias.push(parsedBible);

        selectBible(parsedBible.id);
        renderBibleTable();
        showToast(`Biblia "${parsedBible.name}" importada con éxito (${parsedBible.bookCount} libros)`);
      } catch (err) {
        alert(`Error al importar ${file.name}: ` + err.message);
      }
    };
    reader.readAsText(file, 'utf-8');
  });
}

function setupDragAndDrop() {
  const dropZone = document.getElementById('bible-drop-zone');
  const fileInput = document.getElementById('bible-file-input');

  if (!dropZone || !fileInput) return;

  dropZone.onclick = () => fileInput.click();

  fileInput.onchange = (e) => {
    handleFileInput(e.target.files);
    fileInput.value = '';
  };

  dropZone.ondragover = (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  };

  dropZone.ondragleave = () => {
    dropZone.classList.remove('dragover');
  };

  dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files) {
      handleFileInput(e.dataTransfer.files);
    }
  };
}

// Cargar la biblia de muestra por defecto si la base de datos está vacía
async function loadDefaultSampleIfEmpty() {
  if (state.biblias.length === 0) {
    try {
      const response = await fetch('ejemplo_biblia.xmm');
      if (response.ok) {
        const xml = await response.text();
        const sampleBible = parseXMM(xml, 'Reina-Valera 1960 (Muestra)');
        await saveBibleToDB(sampleBible);
        state.biblias.push(sampleBible);
      }
    } catch (e) {
      console.warn('No se pudo cargar ejemplo_biblia.xmm directamente', e);
    }
  }
}

// ==========================================
// 11. INICIALIZACIÓN DE LA APLICACIÓN
// ==========================================
function openProjectorWindow() {
  // Dimensiones para una ventana secundaria
  const w = 1280;
  const h = 720;
  const left = (screen.width / 2) - (w / 2);
  const top = (screen.height / 2) - (h / 2);

  state.projectorWindow = window.open(
    'proyeccion.html',
    'BibliaProyeccionVentana',
    `width=${w},height=${h},top=${top},left=${left},toolbar=no,location=no,status=no,menubar=no,scrollbars=no,resizable=yes`
  );

  if (state.projectorWindow) {
    state.projectorWindow.focus();
    setProjectorOnline(true);
    setTimeout(syncFullState, 500);
  } else {
    alert('El navegador bloqueó la ventana emergente. Por favor, permite ventanas emergentes para este sitio.');
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// Atajos globales de teclado
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Si el foco está en un input o select, no capturar flechas
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
      if (e.key === 'Escape') {
        e.target.blur();
      }
      return;
    }

    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault();
      navigateVerse(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      navigateVerse(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      goLive();
    } else if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      toggleBlackout();
    } else if (e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      toggleClear();
    } else if (e.key === 'Escape') {
      clearProjection();
      closeBibleModal();
    }
  });
}

// Inicializar al cargar el DOM
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await initDB();
    state.biblias = await getAllBiblesFromDB();
    await loadDefaultSampleIfEmpty();

    loadPlaylist();
    loadStyles();

    // Seleccionar última biblia o primera
    const lastBibleId = localStorage.getItem('biblia_active_id');
    const targetBible = state.biblias.find(b => b.id === lastBibleId) || state.biblias[0];
    
    if (targetBible) {
      selectBible(targetBible.id);
    }

    renderBibleTable();
    renderPlaylist();
    initStyleControls();
    setupSmartSearch();
    setupDragAndDrop();
    setupKeyboardShortcuts();

    // Botones de acción
    document.getElementById('btn-open-projector').onclick = openProjectorWindow;
    document.getElementById('btn-live').onclick = goLive;
    document.getElementById('btn-black').onclick = toggleBlackout;
    document.getElementById('btn-clear').onclick = toggleClear;
    document.getElementById('btn-preview-live').onclick = goLive;

    document.getElementById('btn-prev-verse').onclick = () => navigateVerse(-1);
    document.getElementById('btn-next-verse').onclick = () => navigateVerse(1);

    document.getElementById('btn-add-playlist').onclick = () => {
      addToPlaylist(state.selectedVerse);
    };

    document.getElementById('btn-manage-bibles').onclick = openBibleModal;
    document.getElementById('btn-modal-close').onclick = closeBibleModal;
    document.getElementById('btn-modal-done').onclick = closeBibleModal;

    // Selector de versión
    document.getElementById('bible-version-select').onchange = (e) => {
      selectBible(e.target.value);
    };

    // Filtros de testamento
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const testament = tab.getAttribute('data-testament');
        const filterQ = document.getElementById('book-filter-input').value;
        renderBookList(filterQ, testament);
      };
    });

    // Filtro de libros por texto
    document.getElementById('book-filter-input').oninput = (e) => {
      const activeTab = document.querySelector('.filter-tab.active');
      const testament = activeTab ? activeTab.getAttribute('data-testament') : 'ALL';
      renderBookList(e.target.value, testament);
    };

    // Sub-pestañas derecha (Ajustes / Guión)
    document.querySelectorAll('.sub-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-tab');
        const targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.classList.add('active');
      };
    });

    // Heartbeat para detectar proyector
    setInterval(checkProjectorStatus, 2000);
    checkProjectorStatus();

  } catch (err) {
    console.error('Error inicializando aplicación:', err);
    alert('Error al iniciar la aplicación: ' + err.message);
  }
});
