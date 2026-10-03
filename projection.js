// Communication Channel
const CHANNEL_NAME = 'biblia_projection_channel';
const STORAGE_KEY = 'biblia_projection_state';

let channel = null;
try {
  channel = new BroadcastChannel(CHANNEL_NAME);
} catch (e) {
  console.warn('BroadcastChannel no soportado, usando localStorage fallback', e);
}

// DOM Elements
const bodyEl = document.body;
const stageEl = document.getElementById('stage');
const overlayEl = document.getElementById('overlay');
const containerEl = document.getElementById('content-container');
const verseTextEl = document.getElementById('verse-text');
const verseRefEl = document.getElementById('verse-reference');
const startHintEl = document.getElementById('start-hint');

// Current State
let currentState = {
  mode: 'clear', // 'live', 'black', 'clear', 'hidden'
  text: '',
  reference: '',
  version: '',
  styles: {
    fontSize: 48,
    fontFamily: 'sans-serif',
    textColor: '#ffffff',
    refColor: '#ffd166',
    refPosition: 'bottom-center',
    backgroundType: 'gradient',
    bgColor: '#0f172a',
    bgGradient: 'radial-gradient(ellipse at center, #1e293b 0%, #0f172a 100%)',
    bgImage: '',
    overlayOpacity: 0.3,
    textShadow: 'strong',
    textAlign: 'center'
  }
};

// Apply Styles
function applyStyles(styles) {
  if (!styles) return;

  // Background
  if (styles.backgroundType === 'image' && styles.bgImage) {
    stageEl.style.background = `url(${styles.bgImage}) center center / cover no-repeat`;
  } else if (styles.backgroundType === 'gradient' && styles.bgGradient) {
    stageEl.style.background = styles.bgGradient;
  } else if (styles.bgColor) {
    stageEl.style.background = styles.bgColor;
  }

  // Overlay
  if (styles.overlayOpacity !== undefined) {
    overlayEl.style.background = `rgba(0, 0, 0, ${styles.overlayOpacity})`;
  }

  // Typography
  if (styles.fontSize) {
    verseTextEl.style.fontSize = `${styles.fontSize}px`;
    // Reference scales proportionally with minimum 18px
    const refSize = Math.max(18, Math.round(styles.fontSize * 0.45));
    verseRefEl.style.fontSize = `${refSize}px`;
  }

  if (styles.fontFamily) {
    verseTextEl.style.fontFamily = styles.fontFamily;
    verseRefEl.style.fontFamily = styles.fontFamily;
  }

  if (styles.textColor) {
    verseTextEl.style.color = styles.textColor;
  }

  if (styles.refColor) {
    verseRefEl.style.color = styles.refColor;
  }

  if (styles.textAlign) {
    containerEl.style.textAlign = styles.textAlign;
  }

  // Text Shadow
  if (styles.textShadow === 'none') {
    verseTextEl.style.textShadow = 'none';
    verseRefEl.style.textShadow = 'none';
  } else if (styles.textShadow === 'soft') {
    verseTextEl.style.textShadow = '0 2px 8px rgba(0,0,0,0.6)';
    verseRefEl.style.textShadow = '0 2px 6px rgba(0,0,0,0.6)';
  } else if (styles.textShadow === 'outline') {
    verseTextEl.style.textShadow = '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 4px 12px rgba(0,0,0,0.9)';
    verseRefEl.style.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
  } else { // strong
    verseTextEl.style.textShadow = '0 4px 20px rgba(0,0,0,0.95), 0 2px 6px rgba(0,0,0,0.85)';
    verseRefEl.style.textShadow = '0 3px 12px rgba(0,0,0,0.9)';
  }

  // Reference Position
  verseRefEl.classList.remove('ref-bottom-center', 'ref-bottom-right', 'ref-top-center');
  if (styles.refPosition === 'bottom-right') {
    verseRefEl.classList.add('ref-bottom-right');
  } else if (styles.refPosition === 'top-center') {
    verseRefEl.classList.add('ref-top-center');
  } else {
    verseRefEl.classList.add('ref-bottom-center');
  }
}

// Render Content according to mode
function renderState() {
  bodyEl.classList.remove('state-black', 'state-clear', 'state-hidden');

  if (currentState.mode === 'black') {
    bodyEl.classList.add('state-black');
    return;
  }
  
  if (currentState.mode === 'clear' || currentState.mode === 'hidden') {
    bodyEl.classList.add('state-clear');
    return;
  }

  // Mode is 'live'
  verseTextEl.textContent = currentState.text || '';
  
  let refString = currentState.reference || '';
  if (currentState.version && refString) {
    refString += ` (${currentState.version})`;
  }
  verseRefEl.textContent = refString;
  verseRefEl.style.display = refString ? 'inline-block' : 'none';

  applyStyles(currentState.styles);
}

// Handle Incoming Messages
function handleMessage(msg) {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'PING') {
    sendToController({ type: 'PONG', timestamp: Date.now() });
    return;
  }

  if (msg.type === 'UPDATE') {
    if (msg.state) {
      currentState = { ...currentState, ...msg.state };
      if (msg.state.styles) {
        currentState.styles = { ...currentState.styles, ...msg.state.styles };
      }
      renderState();
    }
  } else if (msg.type === 'SET_MODE') {
    currentState.mode = msg.mode;
    renderState();
  } else if (msg.type === 'SET_STYLES') {
    currentState.styles = { ...currentState.styles, ...msg.styles };
    applyStyles(currentState.styles);
  }
}

function sendToController(data) {
  if (channel) {
    channel.postMessage(data);
  }
  try {
    localStorage.setItem('biblia_projection_response', JSON.stringify({ ...data, _t: Date.now() }));
  } catch (e) {}
}

// Listen on BroadcastChannel
if (channel) {
  channel.onmessage = (event) => {
    handleMessage(event.data);
  };
}

// Fallback to localStorage
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY && event.newValue) {
    try {
      const data = JSON.parse(event.newValue);
      handleMessage(data);
    } catch (e) {}
  }
});

// Window postMessage support
window.addEventListener('message', (event) => {
  if (event.data && typeof event.data === 'object') {
    handleMessage(event.data);
  }
});

// Load initial state from localStorage if available
try {
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) {
    const data = JSON.parse(cached);
    handleMessage(data);
  }
} catch (e) {}

// Fullscreen toggle helpers
function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}

// Event Listeners
document.addEventListener('dblclick', toggleFullScreen);

document.addEventListener('keydown', (e) => {
  if (e.key === 'F11' || e.key === 'f' || e.key === 'F') {
    e.preventDefault();
    toggleFullScreen();
  } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
    e.preventDefault();
    sendToController({ type: 'NAV_NEXT' });
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    e.preventDefault();
    sendToController({ type: 'NAV_PREV' });
  } else if (e.key === 'b' || e.key === 'B') {
    sendToController({ type: 'TOGGLE_BLACK' });
  } else if (e.key === 'c' || e.key === 'C') {
    sendToController({ type: 'TOGGLE_CLEAR' });
  }
});

// Notify controller that projector is ready
sendToController({ type: 'PROJECTION_READY', timestamp: Date.now() });

// Hide start hint after 5 seconds
setTimeout(() => {
  if (startHintEl) {
    startHintEl.style.opacity = '0';
  }
}, 5000);
