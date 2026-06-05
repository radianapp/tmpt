// app/kerja/tulis/js/editor.js
import { getDocument, putDocument, putDocumentMeta } from './db.js';
const { toast } = window.TMPT_UI;
import { broadcastTMPT, TMPT_EVENTS } from '/shared/broadcast.js';

// URL Parsing
const urlParams = new URLSearchParams(window.location.search);
const docId = urlParams.get('id');

if (!docId) {
  window.location.href = './index.html';
}

// Elements
const documentTitle = document.getElementById('document-title');
const saveStatus = document.getElementById('save-status');
const btnFocusMode = document.getElementById('btn-focus-mode');
const btnExitFocus = document.getElementById('btn-exit-focus');
const outlineSidebar = document.getElementById('outline-sidebar');
const outlineList = document.getElementById('outline-list');
const paperSheet = document.getElementById('paper-sheet');
const scrollContainer = document.getElementById('editor-scroll-container');
const wordCountEl = document.getElementById('word-count');
const charCountEl = document.getElementById('char-count');
const pageCountEl = document.getElementById('page-count');
const zoomSelect = document.getElementById('zoom-select');
const editorLayout = document.getElementById('editor-layout');

// App State
let docData = null;
let quill = null;
let autosaveTimer = null;
const AUTOSAVE_DELAY = 2000; // 2 seconds

// Toolbar configuration for Quill
const toolbarOptions = [
  ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
  ['blockquote', 'code-block'],
  [{ 'header': 1 }, { 'header': 2 }, { 'header': 3 }, { 'header': false }], // header styles
  [{ 'align': [] }],
  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
  ['link', 'image'],                                // link and image
  [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults
  ['clean']                                         // remove formatting
];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadAndInitEditor();
  setupEventListeners();
});

// Load document and initialize Quill
async function loadAndInitEditor() {
  try {
    docData = await getDocument(docId);
    if (!docData) {
      toast('Dokumen tidak ditemukan', 'error');
      setTimeout(() => {
        window.location.href = './index.html';
      }, 1500);
      return;
    }

    // Set title
    documentTitle.value = docData.title;

    // Initialize Quill with custom Google Docs styled toolbar container
    quill = new Quill('#quill-editor', {
      modules: {
        toolbar: {
          container: '#quill-toolbar-container'
        }
      },
      theme: 'snow',
      placeholder: 'Mulai menulis di sini...'
    });

    // Load content
    if (docData.content) {
      try {
        const delta = typeof docData.content === 'string' ? JSON.parse(docData.content) : docData.content;
        quill.setContents(delta);
      } catch (err) {
        console.error('Gagal memuat isi dokumen:', err);
        quill.setText(docData.content);
      }
    }

    // Set initial stats & outline
    updateDocumentStats();
    updateOutline();
    saveStatus.textContent = 'Tersimpan ✓';

    // Quill events
    quill.on('text-change', () => {
      updateDocumentStats();
      updateOutline();
      triggerAutosave();
    });

  } catch (error) {
    console.error('Gagal menginisialisasi editor:', error);
    toast('Gagal memuat dokumen', 'error');
  }
}

// Stats counter (words, chars, pages)
function updateDocumentStats() {
  const text = quill.getText();
  const charCount = text.length - 1; // Quill adds a trailing newline
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Estimation: ~500 words per A4 page
  const pageCount = Math.max(1, Math.ceil(wordCount / 500));

  wordCountEl.textContent = `${wordCount} kata`;
  charCountEl.textContent = `${charCount} karakter`;
  pageCountEl.textContent = `Estimasi: ${pageCount} halaman`;

  if (docData) {
    docData.word_count = wordCount;
    docData.char_count = charCount;
  }
}

// Generate Outline dynamically from headings
function updateOutline() {
  outlineList.innerHTML = '';
  const editorArea = document.querySelector('.ql-editor');
  if (!editorArea) return;

  const headings = editorArea.querySelectorAll('h1, h2, h3');
  
  if (headings.length === 0) {
    outlineList.innerHTML = '<div class="outline-item secondary" style="font-style: italic;">Tidak ada heading</div>';
    return;
  }

  headings.forEach((heading, idx) => {
    // Ensure headings have unique ID for navigation targeting
    const headingId = `heading-${idx}`;
    heading.id = headingId;

    const item = document.createElement('div');
    const level = heading.tagName.toLowerCase();
    item.className = `outline-item ${level}-level`;
    item.textContent = heading.innerText || heading.textContent;
    item.title = item.textContent;

    item.addEventListener('click', () => {
      heading.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    outlineList.appendChild(item);
  });
}

// Trigger Autosave (Debounced)
function triggerAutosave() {
  saveStatus.textContent = 'Ada perubahan';
  clearTimeout(autosaveTimer);

  autosaveTimer = setTimeout(async () => {
    saveStatus.textContent = 'Menyimpan...';
    try {
      await saveDocumentData();
      saveStatus.textContent = 'Tersimpan ✓';
    } catch (error) {
      console.error('Gagal menyimpan otomatis:', error);
      saveStatus.textContent = 'Gagal menyimpan ⚠️';
    }
  }, AUTOSAVE_DELAY);
}

// Save document data to IndexedDB
async function saveDocumentData() {
  if (!docData || !quill) return;

  const contentJSON = JSON.stringify(quill.getContents());
  
  docData.title = documentTitle.value.trim() || 'Dokumen Tanpa Judul';
  docData.content = contentJSON;
  docData.updated_at = new Date().toISOString();

  await putDocument(docData);

  // Generate thumbnail meta snippet (first 150 characters)
  const text = quill.getText().trim();
  const snippet = text.substring(0, 150) || 'Teks kosong...';
  await putDocumentMeta(docData.id, { thumbnail_html: snippet });

  // Broadcast event
  broadcastTMPT(TMPT_EVENTS.FILE_UPDATED, { 
    id: docData.id, 
    type: 'tulis', 
    title: docData.title 
  });
}

// Setup Event Listeners
function setupEventListeners() {
  // Title rename
  documentTitle.addEventListener('change', () => {
    triggerAutosave();
  });

  // Share button
  document.querySelector('.gdocs-share-btn')?.addEventListener('click', () => {
    toast('Tautan lokal disalin ke clipboard!', 'success');
    navigator.clipboard.writeText(window.location.href);
  });

  // Custom undo/redo button triggers
  document.querySelector('.ql-undo')?.addEventListener('click', () => {
    quill.history.undo();
  });
  document.querySelector('.ql-redo')?.addEventListener('click', () => {
    quill.history.redo();
  });

  // Focus Mode toggles
  btnFocusMode.addEventListener('click', () => {
    editorLayout.classList.add('focus-mode');
    btnExitFocus.classList.remove('hidden');
    toast('Mode Fokus aktif (Tekan ESC atau tombol ✕ untuk keluar)', 'info');
  });

  btnExitFocus.addEventListener('click', () => {
    editorLayout.classList.remove('focus-mode');
    btnExitFocus.classList.add('hidden');
  });

  // ESC key listener to exit Focus Mode
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && editorLayout.classList.contains('focus-mode')) {
      editorLayout.classList.remove('focus-mode');
      btnExitFocus.classList.add('hidden');
    }
    // Ctrl+S Manual Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveDocumentData().then(() => toast('Dokumen disimpan secara lokal', 'success'));
    }
    // Ctrl+P Print
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      window.print();
    }
  });

  // Zoom control
  zoomSelect.addEventListener('change', (e) => {
    const val = parseFloat(e.target.value);
    paperSheet.style.transform = `scale(${val})`;
    
    // Scale container scroll logic adjustments
    if (val > 1.0) {
      scrollContainer.style.paddingTop = `${2 * val}rem`;
    } else {
      scrollContainer.style.paddingTop = '2rem';
    }
  });

  // Sidebar Toggle Button
  document.getElementById('btn-sidebar-toggle').addEventListener('click', () => {
    outlineSidebar.classList.toggle('collapsed');
  });

  // Menu: New document
  document.getElementById('menu-new-doc').addEventListener('click', () => {
    window.location.href = './index.html';
  });

  // Menu: Outline toggle
  document.getElementById('menu-toggle-outline').addEventListener('click', () => {
    outlineSidebar.classList.toggle('collapsed');
  });

  // Menu: Toggle Rulers
  document.getElementById('menu-toggle-ruler').addEventListener('click', () => {
    document.getElementById('vertical-ruler').classList.toggle('hidden');
    document.getElementById('horizontal-ruler').classList.toggle('hidden');
  });

  // Menu: Print / Cetak PDF
  document.getElementById('menu-print').addEventListener('click', () => {
    window.print();
  });

  // Menu: Edit
  document.getElementById('menu-undo').addEventListener('click', () => {
    quill.history.undo();
  });
  document.getElementById('menu-redo').addEventListener('click', () => {
    quill.history.redo();
  });
  document.getElementById('menu-clear-format').addEventListener('click', () => {
    const range = quill.getSelection();
    if (range) {
      quill.removeFormat(range.index, range.length);
    } else {
      quill.removeFormat(0, quill.getLength());
    }
  });

  // Menu: Insert
  document.getElementById('menu-insert-image').addEventListener('click', () => {
    const btn = document.querySelector('.ql-image');
    if (btn) btn.click();
  });
  document.getElementById('menu-insert-link').addEventListener('click', () => {
    const btn = document.querySelector('.ql-link');
    if (btn) btn.click();
  });

  // Menu: Format
  document.getElementById('menu-bold').addEventListener('click', () => {
    const active = quill.getFormat().bold;
    quill.format('bold', !active);
  });
  document.getElementById('menu-italic').addEventListener('click', () => {
    const active = quill.getFormat().italic;
    quill.format('italic', !active);
  });
  document.getElementById('menu-underline').addEventListener('click', () => {
    const active = quill.getFormat().underline;
    quill.format('underline', !active);
  });
  document.getElementById('menu-strike').addEventListener('click', () => {
    const active = quill.getFormat().strike;
    quill.format('strike', !active);
  });

  // Menu Exports
  document.getElementById('menu-export-txt').addEventListener('click', () => {
    exportCurrentDoc('txt');
  });
  document.getElementById('menu-export-md').addEventListener('click', () => {
    exportCurrentDoc('md');
  });
  document.getElementById('menu-export-html').addEventListener('click', () => {
    exportCurrentDoc('html');
  });
}

// Export Helper
function exportCurrentDoc(format) {
  if (!docData) return;
  const delta = quill.getContents();
  const rawText = quill.getText();
  let content = '';
  let filename = `${documentTitle.value.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
  let mimeType = 'text/plain';

  if (format === 'txt') {
    content = rawText;
    filename += '.txt';
    mimeType = 'text/plain';
  } else if (format === 'md') {
    content = convertDeltaToMarkdown(delta);
    filename += '.md';
    mimeType = 'text/markdown';
  } else if (format === 'html') {
    content = convertDeltaToHTML(delta, documentTitle.value);
    filename += '.html';
    mimeType = 'text/html';
  }

  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`Dokumen diekspor sebagai ${format.toUpperCase()}`, 'success');
}

// Delta Converters
function convertDeltaToMarkdown(delta) {
  let markdown = '';
  delta.ops.forEach(op => {
    if (typeof op.insert !== 'string') return;
    let text = op.insert;
    if (op.attributes) {
      if (op.attributes.bold) text = `**${text}**`;
      if (op.attributes.italic) text = `*${text}*`;
      if (op.attributes.underline) text = `<u>${text}</u>`;
      if (op.attributes.header) {
        const level = op.attributes.header;
        text = `\n${'#'.repeat(level)} ${text}`;
      }
    }
    markdown += text;
  });
  return markdown;
}

function convertDeltaToHTML(delta, title) {
  let bodyHTML = '';
  delta.ops.forEach(op => {
    if (typeof op.insert !== 'string') return;
    let text = escapeHTML(op.insert);
    if (op.attributes) {
      if (op.attributes.bold) text = `<strong>${text}</strong>`;
      if (op.attributes.italic) text = `<em>${text}</em>`;
      if (op.attributes.underline) text = `<u>${text}</u>`;
      if (op.attributes.header) {
        const h = op.attributes.header;
        text = `<h${h}>${text}</h${h}>`;
      }
    }
    bodyHTML += text.replace(/\n/g, '<br>');
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHTML(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; }
    h1, h2, h3 { color: #111; }
  </style>
</head>
<body>
  ${bodyHTML}
</body>
</html>`;
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
