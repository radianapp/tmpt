// app/kerja/tulis/js/dashboard.js
import { getDocuments, getDocumentMeta, putDocument, putDocumentMeta, deleteDocument } from './db.js';
import { TEMPLATES } from './templates.js';
// using native crypto.randomUUID()
const { toast, confirm } = window.TMPT_UI;
import { broadcastTMPT, TMPT_EVENTS } from '/shared/broadcast.js';

// Elements
const templateGrid = document.getElementById('template-grid-container');
const documentsContainer = document.getElementById('documents-container');
const searchInput = document.getElementById('search-input');
const gridViewBtn = document.getElementById('grid-view-btn');
const listViewBtn = document.getElementById('list-view-btn');
const newBlankBtn = document.getElementById('new-blank-btn');
const importBtn = document.getElementById('import-btn');
const importInput = document.getElementById('import-input');

// State
let allDocuments = [];
let viewMode = localStorage.getItem('tulis_view_mode') || 'grid';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  renderTemplateGallery();
  setupViewMode();
  await loadDocuments();
  setupEventListeners();
});

// Render Templates
function renderTemplateGallery() {
  templateGrid.innerHTML = '';
  Object.entries(TEMPLATES).forEach(([id, tmpl]) => {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.dataset.template = id;
    
    // Preview content preview mock
    let previewContent = '';
    if (id === 'blank') {
      previewContent = '<div class="template-preview blank-preview">➕</div>';
    } else {
      const textSample = tmpl.content.ops
        .map(op => (typeof op.insert === 'string' ? op.insert : ''))
        .join('')
        .substring(0, 150);
      previewContent = `
        <div class="template-preview">
          <div class="template-preview-text">${escapeHTML(textSample)}</div>
        </div>
      `;
    }

    card.innerHTML = `
      ${previewContent}
      <span class="template-name">${tmpl.name}</span>
    `;

    card.addEventListener('click', () => createFromTemplate(id));
    templateGrid.appendChild(card);
  });
}

// Setup View Mode
function setupViewMode() {
  if (viewMode === 'grid') {
    documentsContainer.className = 'grid-view';
    gridViewBtn.classList.add('active');
    listViewBtn.classList.remove('active');
  } else {
    documentsContainer.className = 'list-view';
    listViewBtn.classList.add('active');
    gridViewBtn.classList.remove('active');
  }
}

// Load Documents from IndexedDB
async function loadDocuments() {
  try {
    const docs = await getDocuments();
    // Sort by updated_at descending
    allDocuments = docs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    await renderDocuments();
  } catch (error) {
    console.error('Gagal mengambil dokumen:', error);
    documentsContainer.innerHTML = '<div class="loading-state">Gagal memuat dokumen. Coba muat ulang halaman.</div>';
  }
}

// Render Documents List
async function renderDocuments(filterText = '') {
  const filtered = allDocuments.filter(doc => 
    doc.title.toLowerCase().includes(filterText.toLowerCase())
  );

  if (filtered.length === 0) {
    documentsContainer.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">📝</span>
        <h3>Belum ada dokumen</h3>
        <p>${filterText ? 'Tidak ada dokumen yang cocok dengan pencarian Anda.' : 'Mulai buat dokumen baru dari pilihan di atas.'}</p>
      </div>
    `;
    return;
  }

  documentsContainer.innerHTML = '';

  for (const doc of filtered) {
    let meta = null;
    try {
      meta = await getDocumentMeta(doc.id);
    } catch (e) {
      console.warn('Gagal memuat meta:', e);
    }

    const snippet = meta?.thumbnail_html || 'Teks kosong...';

    if (viewMode === 'grid') {
      const card = document.createElement('div');
      card.className = 'doc-card';
      card.innerHTML = `
        <div class="doc-thumbnail" onclick="window.location.href='./editor.html?id=${doc.id}'">
          <div class="doc-thumbnail-content">${escapeHTML(snippet)}</div>
        </div>
        <div class="doc-info">
          <div class="doc-title-row">
            <h3 class="doc-title" onclick="window.location.href='./editor.html?id=${doc.id}'" title="${escapeHTML(doc.title)}">📄 ${escapeHTML(doc.title)}</h3>
            <button class="menu-btn" data-id="${doc.id}">⋮</button>
          </div>
          <div class="doc-meta">
            <span>${formatDate(doc.updated_at)}</span>
            <span>${doc.word_count || 0} kata</span>
          </div>
        </div>
      `;
      documentsContainer.appendChild(card);
    } else {
      const row = document.createElement('div');
      row.className = 'doc-row';
      row.innerHTML = `
        <span class="doc-row-icon">📄</span>
        <div class="doc-row-details">
          <h3 class="doc-row-title" onclick="window.location.href='./editor.html?id=${doc.id}'">${escapeHTML(doc.title)}</h3>
          <div class="doc-row-meta">
            <span>Diubah: ${formatDate(doc.updated_at)}</span>
            <span>${doc.word_count || 0} kata | ${doc.char_count || 0} karakter</span>
          </div>
        </div>
        <div class="doc-row-actions">
          <button class="outline secondary menu-btn" data-id="${doc.id}">Pilihan</button>
          <button onclick="window.location.href='./editor.html?id=${doc.id}'">Buka</button>
        </div>
      `;
      documentsContainer.appendChild(row);
    }
  }

  // Setup context menu events for ⋮ buttons
  document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showContextMenu(e.target.dataset.id, e.clientX, e.clientY);
    });
  });
}

// Show Right-Click/Dropdown Menu
function showContextMenu(id, x, y) {
  // Remove existing menu if any
  const existing = document.querySelector('.context-dropdown');
  if (existing) existing.remove();

  const doc = allDocuments.find(d => d.id === id);
  if (!doc) return;

  const menu = document.createElement('ul');
  menu.className = 'context-dropdown';
  menu.style.position = 'fixed';
  menu.style.left = `${Math.min(x, window.innerWidth - 160)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 200)}px`;

  menu.innerHTML = `
    <li data-action="open">📂 Buka</li>
    <li data-action="rename">✏️ Ubah Nama</li>
    <li data-action="duplicate">📋 Duplikat</li>
    <li data-action="export-html">🌐 Ekspor HTML</li>
    <li data-action="export-md">📝 Ekspor Markdown</li>
    <li data-action="export-txt">📄 Ekspor TXT</li>
    <li data-action="delete" style="color: var(--pico-red-color, #e53e3e)">🗑️ Hapus</li>
  `;

  document.body.appendChild(menu);

  const closeMenu = () => {
    menu.remove();
    document.removeEventListener('click', closeMenu);
  };

  // Prevent immediate close
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 10);

  menu.querySelectorAll('li').forEach(item => {
    item.addEventListener('click', async (e) => {
      const action = e.target.dataset.action;
      if (action === 'open') {
        window.location.href = `./editor.html?id=${id}`;
      } else if (action === 'rename') {
        await renameDoc(doc);
      } else if (action === 'duplicate') {
        await duplicateDoc(doc);
      } else if (action === 'export-html') {
        exportDoc(doc, 'html');
      } else if (action === 'export-md') {
        exportDoc(doc, 'md');
      } else if (action === 'export-txt') {
        exportDoc(doc, 'txt');
      } else if (action === 'delete') {
        await deleteDoc(id);
      }
    });
  });
}

// Rename Document
async function renameDoc(doc) {
  const newTitle = prompt('Masukkan nama baru untuk dokumen:', doc.title);
  if (!newTitle || newTitle.trim() === '') return;

  doc.title = newTitle.trim();
  doc.updated_at = new Date().toISOString();

  await putDocument(doc);
  broadcastTMPT(TMPT_EVENTS.FILE_UPDATED, { id: doc.id, type: 'tulis', title: doc.title });
  toast('Nama dokumen berhasil diubah', 'success');
  await loadDocuments();
}

// Duplicate Document
async function duplicateDoc(doc) {
  const newId = crypto.randomUUID();
  const duplicated = {
    ...doc,
    id: newId,
    title: `${doc.title} (Salinan)`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await putDocument(duplicated);
  
  // Duplicate meta if exists
  try {
    const meta = await getDocumentMeta(doc.id);
    if (meta) {
      await putDocumentMeta(newId, { thumbnail_html: meta.thumbnail_html });
    }
  } catch (e) {}

  broadcastTMPT(TMPT_EVENTS.FILE_CREATED, { id: newId, type: 'tulis', title: duplicated.title });
  toast('Dokumen berhasil diduplikasi', 'success');
  await loadDocuments();
}

// Delete Document
async function deleteDoc(id) {
  const ok = await confirm('Apakah Anda yakin ingin menghapus dokumen ini?', { danger: true });
  if (!ok) return;

  await deleteDocument(id);
  broadcastTMPT(TMPT_EVENTS.FILE_DELETED, { id, type: 'tulis' });
  toast('Dokumen telah dihapus', 'success');
  await loadDocuments();
}

// Export Document
function exportDoc(doc, format) {
  let content = '';
  let filename = `${doc.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
  let mimeType = 'text/plain';

  // Convert Delta content to Plain text for snippet
  const delta = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
  const rawText = delta.ops.map(op => (typeof op.insert === 'string' ? op.insert : '')).join('');

  if (format === 'txt') {
    content = rawText;
    filename += '.txt';
    mimeType = 'text/plain';
  } else if (format === 'md') {
    // Basic Markdown Export converter
    content = convertDeltaToMarkdown(delta);
    filename += '.md';
    mimeType = 'text/markdown';
  } else if (format === 'html') {
    // Basic HTML Export wrapper
    content = convertDeltaToHTML(delta, doc.title);
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

// Simple Delta converters
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
    
    // Simplistic line-by-line block logic
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

// Create Document from Template
async function createFromTemplate(templateId) {
  const tmpl = TEMPLATES[templateId];
  if (!tmpl) return;

  const newId = crypto.randomUUID();
  const rawText = tmpl.content.ops.map(op => (typeof op.insert === 'string' ? op.insert : '')).join('');
  const newDoc = {
    id: newId,
    title: tmpl.name === 'Kosong' ? 'Dokumen Tanpa Judul' : `Dokumen ${tmpl.name}`,
    content: JSON.stringify(tmpl.content),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    word_count: rawText.split(/\s+/).filter(Boolean).length,
    char_count: rawText.length
  };

  await putDocument(newDoc);
  
  // Write thumbnail meta snippet
  const snippet = rawText.substring(0, 150);
  await putDocumentMeta(newId, { thumbnail_html: snippet });

  broadcastTMPT(TMPT_EVENTS.FILE_CREATED, { id: newId, type: 'tulis', title: newDoc.title });
  window.location.href = `./editor.html?id=${newId}`;
}

// File Import Handler
async function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  const extension = file.name.split('.').pop().toLowerCase();

  reader.onload = async (event) => {
    let textContent = event.target.result;
    let title = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    let quillDelta = { ops: [] };

    // Dynamically loaded dependencies for import parsing if needed
    if (extension === 'md') {
      // Import marked.js dynamically from local vendor
      try {
        if (!window.marked) {
          await import('../markdown/vendor/marked.min.js');
        }
        const html = window.marked.parse(textContent);
        quillDelta = convertHTMLToDelta(html);
      } catch (err) {
        console.error('Gagal parsing Markdown:', err);
        quillDelta = { ops: [{ insert: textContent + '\n' }] };
      }
    } else if (extension === 'html') {
      try {
        if (!window.DOMPurify) {
          await import('../markdown/vendor/purify.min.js');
        }
        const sanitizedHTML = window.DOMPurify.sanitize(textContent);
        quillDelta = convertHTMLToDelta(sanitizedHTML);
      } catch (err) {
        console.error('Gagal parsing HTML:', err);
        quillDelta = { ops: [{ insert: textContent + '\n' }] };
      }
    } else {
      // txt or fallback
      quillDelta = { ops: [{ insert: textContent + '\n' }] };
    }

    const newId = crypto.randomUUID();
    const rawText = quillDelta.ops.map(op => (typeof op.insert === 'string' ? op.insert : '')).join('');
    const newDoc = {
      id: newId,
      title: title,
      content: JSON.stringify(quillDelta),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      word_count: rawText.split(/\s+/).filter(Boolean).length,
      char_count: rawText.length
    };

    await putDocument(newDoc);
    await putDocumentMeta(newId, { thumbnail_html: rawText.substring(0, 150) });

    broadcastTMPT(TMPT_EVENTS.FILE_CREATED, { id: newId, type: 'tulis', title: title });
    toast('File berhasil diimpor', 'success');
    window.location.href = `./editor.html?id=${newId}`;
  };

  reader.readAsText(file);
}

// Convert simple HTML string to Quill Delta (fallback method for importer)
function convertHTMLToDelta(html) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const ops = [];

  // Parse direct child nodes
  tempDiv.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent.trim()) {
        ops.push({ insert: node.textContent });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      let text = node.innerText || node.textContent;
      if (!text.endsWith('\n')) text += '\n';

      const attributes = {};
      if (tag === 'h1') attributes.header = 1;
      else if (tag === 'h2') attributes.header = 2;
      else if (tag === 'h3') attributes.header = 3;
      else if (tag === 'strong' || tag === 'b') attributes.bold = true;
      else if (tag === 'em' || tag === 'i') attributes.italic = true;
      else if (tag === 'u') attributes.underline = true;

      ops.push({ insert: text, attributes });
    }
  });

  if (ops.length === 0) ops.push({ insert: '\n' });
  return { ops };
}

// Listeners
function setupEventListeners() {
  newBlankBtn.addEventListener('click', () => createFromTemplate('blank'));
  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', handleFileImport);

  searchInput.addEventListener('input', (e) => {
    renderDocuments(e.target.value);
  });

  gridViewBtn.addEventListener('click', () => {
    viewMode = 'grid';
    localStorage.setItem('tulis_view_mode', 'grid');
    setupViewMode();
    renderDocuments(searchInput.value);
  });

  listViewBtn.addEventListener('click', () => {
    viewMode = 'list';
    localStorage.setItem('tulis_view_mode', 'list');
    setupViewMode();
    renderDocuments(searchInput.value);
  });
}

// Helpers
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

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
