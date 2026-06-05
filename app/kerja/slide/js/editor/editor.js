// app/kerja/slide/js/editor/editor.js
import { getPresentation, putPresentation } from '../db.js';
import { broadcastTMPT, TMPT_EVENTS } from '/shared/broadcast.js';
import { Canvas } from './canvas.js';
import { Elements } from './elements.js';
import { Properties } from './properties.js';
import { SlidePanel } from './slide-panel.js';
import { Export } from './export.js';

// --- Global State ---
export const state = {
  presentation: null,
  activeSlideIndex: 0,
  selectedElementId: null,
  zoomLevel: 100,
  autosaveTimer: null,
  isSaving: false
};

// --- Command/Snapshot History for Undo/Redo ---
class History {
  constructor(maxSteps = 50) {
    this.stack = [];
    this.cursor = -1;
    this.maxSteps = maxSteps;
  }
  
  push(snapshot) {
    // Clear future history if cursor is not at the end
    this.stack = this.stack.slice(0, this.cursor + 1);
    this.stack.push(JSON.stringify(snapshot));
    if (this.stack.length > this.maxSteps) {
      this.stack.shift();
    }
    this.cursor = this.stack.length - 1;
    this.updateButtons();
  }
  
  undo() {
    if (this.cursor <= 0) return null;
    this.cursor--;
    this.updateButtons();
    return JSON.parse(this.stack[this.cursor]);
  }
  
  redo() {
    if (this.cursor >= this.stack.length - 1) return null;
    this.cursor++;
    this.updateButtons();
    return JSON.parse(this.stack[this.cursor]);
  }

  updateButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.disabled = this.cursor <= 0;
    if (redoBtn) redoBtn.disabled = this.cursor >= this.stack.length - 1;
  }
}

export const history = new History();

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');

  if (!id) {
    window.location.href = './index.html';
    return;
  }

  state.presentation = await getPresentation(id);
  if (!state.presentation) {
    if (window.TMPT_UI) window.TMPT_UI.toast('Presentasi tidak ditemukan.', 'error');
    setTimeout(() => { window.location.href = './index.html'; }, 1500);
    return;
  }

  // Set Title
  const titleInput = document.getElementById('presentation-title');
  if (titleInput) {
    titleInput.value = state.presentation.title;
    titleInput.addEventListener('input', (e) => {
      state.presentation.title = e.target.value.trim() || 'Presentasi Tanpa Judul';
      triggerAutosave();
    });
  }

  // Push initial state to history
  history.push({
    slides: state.presentation.slides,
    theme_id: state.presentation.theme_id
  });

  // Init sub-modules
  Canvas.init();
  Elements.init();
  Properties.init();
  SlidePanel.init();
  Export.init();

  // Load interact.js event handlers for editor element manipulation
  Elements.setupInteract();

  initGlobalEvents();
  
  // Set initial save status
  updateSaveStatus('Tersimpan ✓');
});

// --- Save & Autosave System ---
export function triggerAutosave() {
  updateSaveStatus('Ada perubahan...');
  clearTimeout(state.autosaveTimer);
  state.autosaveTimer = setTimeout(async () => {
    await savePresentation();
  }, 2000);
}

export async function savePresentation(forceThumbnail = false) {
  if (!state.presentation) return;
  state.isSaving = true;
  updateSaveStatus('Menyimpan...');

  const now = new Date().toISOString();
  state.presentation.updated_at = now;
  state.presentation.slide_count = state.presentation.slides.length;

  // Generate thumbnail async via html2canvas (if html2canvas is needed or ready)
  if (forceThumbnail || !state.presentation.thumbnail) {
    try {
      await generateThumbnail();
    } catch (e) {
      console.warn("Gagal membuat thumbnail:", e);
    }
  }

  await putPresentation(state.presentation);

  broadcastTMPT(TMPT_EVENTS.FILE_UPDATED, {
    id: state.presentation.id,
    type: 'slide',
    title: state.presentation.title,
    updated_at: now
  });

  updateSaveStatus('Tersimpan ✓');
  state.isSaving = false;
}

export function updateSaveStatus(text) {
  const statusEl = document.getElementById('save-status');
  if (statusEl) {
    statusEl.textContent = text;
  }
}

// Push history snapshot
export function saveHistoryState() {
  history.push({
    slides: state.presentation.slides,
    theme_id: state.presentation.theme_id
  });
}

// --- Thumbnail Generation via html2canvas ---
async function generateThumbnail() {
  if (!window.html2canvas) {
    // Lazy load html2canvas from /app/feedback/vendor/html2canvas.min.js
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/app/feedback/vendor/html2canvas.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  const canvasNode = document.getElementById('editor-slide-canvas');
  if (!canvasNode) return;

  // Hide guides and selection wrapper temporarily for screenshot
  const guides = document.getElementById('guides-overlay');
  const selectionHandles = canvasNode.querySelectorAll('.resize-handle, .rotate-handle, .rotate-line');
  
  if (guides) guides.style.display = 'none';
  selectionHandles.forEach(h => h.style.display = 'none');

  const canvasShot = await html2canvas(canvasNode, {
    scale: 0.25, // Compress size
    logging: false,
    useCORS: true
  });

  if (guides) guides.style.display = 'block';
  selectionHandles.forEach(h => h.style.display = '');

  state.presentation.thumbnail = canvasShot.toDataURL('image/png');
}

// --- Global Events & Keyboard Shortcuts ---
function initGlobalEvents() {
  // Undo/Redo click
  document.getElementById('undo-btn')?.addEventListener('click', handleUndo);
  document.getElementById('redo-btn')?.addEventListener('click', handleRedo);

  // Present Mode click
  document.getElementById('present-btn')?.addEventListener('click', () => {
    window.open(`./present.html?id=${state.presentation.id}&slide=${state.activeSlideIndex + 1}`, '_blank');
  });

  // Global Keydown Handler
  window.addEventListener('keydown', (e) => {
    // Undo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      handleUndo();
    }
    // Redo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      handleRedo();
    }
    // Save (Force Save)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      savePresentation(true);
    }
    // Delete element
    if (state.selectedElementId && (e.key === 'Delete' || e.key === 'Backspace')) {
      // Don't trigger if typing in input/textarea/contenteditable
      if (document.activeElement.tagName !== 'INPUT' && 
          document.activeElement.tagName !== 'TEXTAREA' && 
          !document.activeElement.hasAttribute('contenteditable')) {
        e.preventDefault();
        Elements.deleteSelectedElement();
      }
    }
    // Duplicate element
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      if (state.selectedElementId) {
        e.preventDefault();
        Elements.duplicateSelectedElement();
      }
    }
    // Nudge element with arrows
    if (state.selectedElementId && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      if (document.activeElement.tagName !== 'INPUT' && 
          document.activeElement.tagName !== 'TEXTAREA' && 
          !document.activeElement.hasAttribute('contenteditable')) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        Elements.nudgeSelectedElement(e.key, step);
      }
    }
    // Escape to deselect
    if (e.key === 'Escape') {
      Elements.deselectAll();
    }
  });

  // Canvas zoom
  document.getElementById('zoom-out-btn')?.addEventListener('click', () => adjustZoom(-10));
  document.getElementById('zoom-in-btn')?.addEventListener('click', () => adjustZoom(10));

  // Sidebar toggle
  document.getElementById('sidebar-toggle-btn')?.addEventListener('click', () => {
    window.toggleSidebar();
  });
}

function handleUndo() {
  const previous = history.undo();
  if (previous) {
    state.presentation.slides = previous.slides;
    state.presentation.theme_id = previous.theme_id;
    Canvas.renderActiveSlide();
    SlidePanel.renderThumbnails();
    triggerAutosave();
  }
}

function handleRedo() {
  const next = history.redo();
  if (next) {
    state.presentation.slides = next.slides;
    state.presentation.theme_id = next.theme_id;
    Canvas.renderActiveSlide();
    SlidePanel.renderThumbnails();
    triggerAutosave();
  }
}

function adjustZoom(amount) {
  state.zoomLevel = Math.max(50, Math.min(150, state.zoomLevel + amount));
  const zoomLabel = document.getElementById('zoom-label');
  if (zoomLabel) zoomLabel.textContent = `${state.zoomLevel}%`;
  Canvas.scaleCanvas();
}

// --- Hamburger Toggle ---
window.toggleSidebar = function() {
  const sidebar = document.querySelector('.slide-panel');
  if (sidebar) {
    sidebar.classList.toggle('collapsed');
  }
};

