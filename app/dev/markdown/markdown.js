// app/dev/markdown/markdown.js
import { broadcastTMPT } from '/shared/broadcast.js';
window.broadcastTMPT = broadcastTMPT;

let editorInstance = null;
let currentDocId = null;
let activeFolderId = null;
let autosaveTimer = null;
let db = null;
let filesCache = [];
let foldersCache = [];
let currentViewFilter = 'all';
let isSyncingScroll = false;   // Flag untuk mencegah loop scroll
let scrollSyncEnabled = true;  // Bisa dinonaktifkan sementara


// Emoji Map Sederhana (v1.0 MVP)
const EMOJI_MAP = {
  'smile': '😊',
  'rocket': '🚀',
  'heart': '❤️',
  'warning': '⚠️',
  'white_check_mark': '✅',
  'thumbsup': '👍',
  'thumbsdown': '👎',
  'sparkles': '✨',
  'tada': '🎉',
  'fire': '🔥',
  'bulb': '💡',
  'lock': '🔐',
  'memo': '📝',
  'folder': '📁',
  'chart': '📊'
};

// Inisialisasi Aplikasi saat DOM dimuat
document.addEventListener('DOMContentLoaded', async () => {
  console.log("[MARKDOWN] Menginisialisasi aplikasi...");
  
  // Validasi Auth & Kunci Vault
  if (window.TMPT_Auth) {
    await window.TMPT_Auth.init();
    if (!window.TMPT_Auth.isUnlocked()) {
      console.warn("[MARKDOWN] Vault terkunci, mengalihkan ke login...");
      window.location.href = '/app/auth/login/';
      return;
    }
    window.TMPT_Auth.setupIdleListeners();
  }

  // Setup tema PWA/PicoCSS
  applySavedTheme();

  // Inisialisasi Database IndexedDB
  await initDatabase();

  // Load Folder & Berkas
  await reloadFileTree();

  // Inisialisasi Monaco Editor
  initMonaco();

  // Setup Event Listeners
  setupEventListeners();

  // Sisipkan hamburger di header global jika header sudah ter-load
  insertHamburgerInHeader();

  // Buka dokumen terakhir atau buat dokumen kosong
  const params = new URLSearchParams(window.location.search);
  const docIdParam = params.get('id');
  if (docIdParam) {
    await openDocument(docIdParam);
  } else {
    await openLatestOrCreate();
  }
});

// Listener swap HTMX untuk menyisipkan hamburger saat shared header selesai di-load
document.addEventListener('htmx:afterSwap', (e) => {
  if (e.target.id === 'header-container' || e.target.tagName === 'HEADER') {
    insertHamburgerInHeader();
  }
});

function insertHamburgerInHeader() {
  const hamburgerContainer = document.getElementById('header-hamburger-container');
  if (hamburgerContainer) {
    hamburgerContainer.style.display = 'block';
  }
}

document.addEventListener('tmpt:sidebar-toggle', (e) => {
  e.preventDefault();
  const sidebar = document.getElementById('sidebar-panel');
  if (sidebar) {
    sidebar.classList.toggle('collapsed');
  }
});

// === DATABASE MODULE (IndexedDB) ===
async function initDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('tmpt_markdown');
    
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id' });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = (e) => {
      console.error("Gagal inisialisasi IndexedDB tmpt_markdown:", e.target.error);
      reject(e.target.error);
    };
  });
}

async function dbGet(storeName, key) {
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function dbPut(storeName, value) {
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
  });
}

async function dbDelete(storeName, key) {
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
  });
}

async function dbGetAll(storeName) {
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

// === FILE TREE MODULE ===
async function reloadFileTree() {
  filesCache = await dbGetAll('documents');
  foldersCache = await dbGetAll('folders');
  
  renderFileTree();
  updateStorageUsage();
}

function renderFileTree() {
  const container = document.getElementById('file-tree-container');
  if (!container) return;
  container.innerHTML = '';

  const searchInput = document.getElementById('search-docs');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  // Filter berkas berdasarkan trash status dan query
  const isTrashView = (currentViewFilter === 'trash');
  
  const trashActions = document.getElementById('trash-actions-row');
  if (trashActions) {
    if (isTrashView) {
      trashActions.classList.remove('hidden');
    } else {
      trashActions.classList.add('hidden');
    }
  }
  
  const activeFiles = filesCache.filter(file => {
    const matchesTrash = isTrashView ? file.trashed : !file.trashed;
    const matchesQuery = query ? (file.title.toLowerCase().includes(query) || file.content.toLowerCase().includes(query)) : true;
    return matchesTrash && matchesQuery;
  });

  if (isTrashView) {
    // Tampilan Sampah
    if (activeFiles.length === 0) {
      container.innerHTML = '<p class="secondary" style="font-size:0.8rem; padding: 0.5rem; text-align:center;">Kotak sampah kosong.</p>';
      return;
    }
    activeFiles.forEach(file => {
      const fileEl = createFileNode(file);
      container.appendChild(fileEl);
    });
    return;
  }

  // Tampilan Folder & File Utama
  // Render Folder
  foldersCache.forEach(folder => {
    const folderEl = document.createElement('div');
    folderEl.className = 'tree-folder-node';
    folderEl.innerHTML = `
      <div class="tree-folder-header" data-id="${folder.id}">
        <span>📂</span>
        <span class="folder-title" style="flex-grow:1;">${escapeHtml(folder.name)}</span>
      </div>
      <div class="tree-folder-content hidden" id="folder-content-${folder.id}"></div>
    `;

    // Ambil file di dalam folder ini
    const folderContentEl = folderEl.querySelector('.tree-folder-content');
    const folderFiles = activeFiles.filter(f => f.folder_id === folder.id);
    
    folderFiles.forEach(file => {
      const fileNode = createFileNode(file);
      folderContentEl.appendChild(fileNode);
    });

    const folderHeader = folderEl.querySelector('.tree-folder-header');

    // Event toggle folder collapse
    folderHeader.addEventListener('click', (e) => {
      folderContentEl.classList.toggle('hidden');
    });

    // Event right-click context menu
    folderHeader.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showFolderContextMenu(folder.id, e.clientX, e.clientY);
    });

    // Drag & Drop pada Folder
    folderHeader.addEventListener('dragover', (e) => {
      e.preventDefault();
      folderHeader.classList.add('drag-hover');
    });
    folderHeader.addEventListener('dragleave', () => {
      folderHeader.classList.remove('drag-hover');
    });
    folderHeader.addEventListener('drop', async (e) => {
      e.preventDefault();
      folderHeader.classList.remove('drag-hover');
      const fileId = e.dataTransfer.getData('text/plain');
      if (fileId) {
        const file = filesCache.find(f => f.id === fileId);
        if (file && file.folder_id !== folder.id) {
          file.folder_id = folder.id;
          file.updated_at = new Date().toISOString();
          await dbPut('documents', file);
          await reloadFileTree();
        }
      }
    });

    container.appendChild(folderEl);
  });

  // Render Root Files (Berkas tanpa folder)
  const rootFiles = activeFiles.filter(f => !f.folder_id);
  rootFiles.forEach(file => {
    const fileNode = createFileNode(file);
    container.appendChild(fileNode);
  });

  // Drag & Drop pada container utama (untuk memindahkan kembali berkas ke root / tanpa folder)
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  container.addEventListener('drop', async (e) => {
    // Pastikan item tidak dilepas di dalam folderHeader
    if (e.target === container || e.target.classList.contains('tree-file-item') || e.target.id === 'file-tree-container') {
      e.preventDefault();
      const fileId = e.dataTransfer.getData('text/plain');
      if (fileId) {
        const file = filesCache.find(f => f.id === fileId);
        if (file && file.folder_id !== null) {
          file.folder_id = null;
          file.updated_at = new Date().toISOString();
          await dbPut('documents', file);
          await reloadFileTree();
        }
      }
    }
  });
}

function createFileNode(file) {
  const el = document.createElement('div');
  el.className = `tree-file-item ${file.id === currentDocId ? 'active' : ''}`;
  el.dataset.id = file.id;
  el.setAttribute('draggable', 'true');
  el.innerHTML = `
    <span style="display:flex; align-items:center; gap:0.4rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width: 100%;">
      <span>📄</span>
      <span class="file-title-txt">${escapeHtml(file.title || 'Tanpa Judul')}</span>
    </span>
  `;

  el.addEventListener('click', (e) => {
    openDocument(file.id);
  });

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showFileContextMenu(file, e.clientX, e.clientY);
  });

  el.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', file.id);
    el.classList.add('dragging');
  });

  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
  });

  return el;
}

// === MONACO EDITOR MODULE ===
function updateMonacoTheme() {
  if (typeof monaco !== 'undefined' && editorInstance) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs');
  }
}

function initMonaco() {
  if (typeof require === 'undefined') {
    console.error("Monaco loader tidak ditemukan!");
    return;
  }

  require.config({ paths: { vs: '/app/dev/code/vendor/monaco/vs' } });
  
  require(['vs/editor/editor.main'], () => {
    console.log("[MARKDOWN] Monaco Editor berhasil dimuat.");
    
    const host = document.getElementById('monaco-editor-host');
    if (!host) return;

    // Baca settings
    const fontSize = parseInt(localStorage.getItem('md_font_size')) || 16;
    const wordWrap = localStorage.getItem('md_word_wrap') !== 'false';
    const lineNumbers = localStorage.getItem('md_line_numbers') !== 'false';

    const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'vs-dark' : 'vs';

    editorInstance = monaco.editor.create(host, {
      value: '',
      language: 'markdown',
      theme: currentTheme,
      fontSize: fontSize,
      wordWrap: wordWrap ? 'on' : 'off',
      lineNumbers: lineNumbers ? 'on' : 'off',
      minimap: { enabled: false },
      automaticLayout: true,
      scrollbar: {
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8
      }
    });

    // Observer untuk sinkronisasi tema dengan Monaco secara realtime
    const themeObserver = new MutationObserver(() => {
      updateMonacoTheme();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Listener Perubahan Teks
    editorInstance.onDidChangeModelContent(() => {
      const content = editorInstance.getValue();
      triggerAutosave(content);
      renderPreview(content);
      updateStatusBarStats(content);
    });

    // Listener Perubahan Posisi Kursor
    editorInstance.onDidChangeCursorPosition((e) => {
      const statCursor = document.getElementById('stat-cursor');
      if (statCursor) {
        statCursor.textContent = `Baris ${e.position.lineNumber}, Kolom ${e.position.column}`;
      }
    });

    // Listener Scroll (Scroll Sync: Editor → Preview)
    editorInstance.onDidScrollChange(() => {
      if (!scrollSyncEnabled || isSyncingScroll) return;
      const splitBtn = document.getElementById('btn-mode-split');
      if (splitBtn && splitBtn.classList.contains('active')) {
        syncScrollEditorToPreview();
      }
    });

    // Buka file jika sudah ter-load
    if (currentDocId) {
      loadDocContentIntoEditor();
    }

    // Pasang listener scroll preview → editor setelah Monaco ready
    setTimeout(initPreviewScrollSync, 300);
  });
}

async function openDocument(id) {
  currentDocId = id;
  const doc = await dbGet('documents', id);
  if (!doc) return;

  // Hapus tanda aktif tree
  document.querySelectorAll('.tree-file-item').forEach(el => el.classList.remove('active'));
  const activeTreeItem = document.querySelector(`.tree-file-item[data-id="${id}"]`);
  if (activeTreeItem) activeTreeItem.classList.add('active');

  if (editorInstance) {
    loadDocContentIntoEditor();
  }
}

async function loadDocContentIntoEditor() {
  const doc = await dbGet('documents', currentDocId);
  if (!doc) return;

  editorInstance.setValue(doc.content);
  renderPreview(doc.content);
  updateStatusBarStats(doc.content);
  
  // Reset Save Status
  updateSaveIndicator('saved');
}

// === RENDER PREVIEW MODULE (Marked + DOMPurify) ===
async function renderPreview(markdown) {
  const previewContainer = document.getElementById('preview-html-content');
  if (!previewContainer) return;

  // 1. Parsing frontmatter YAML (jika ada) dan menyembunyikannya
  let cleanedMarkdown = markdown;
  let frontmatter = {};
  if (markdown.startsWith('---')) {
    const nextDashIndex = markdown.indexOf('---', 3);
    if (nextDashIndex !== -1) {
      const yamlContent = markdown.substring(3, nextDashIndex);
      cleanedMarkdown = markdown.substring(nextDashIndex + 3);
      
      // Parse YAML sederhana
      yamlContent.split('\n').forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts.slice(1).join(':').trim();
          frontmatter[key] = val;
        }
      });
    }
  }

  // 2. Emoji replacement :name: -> unicode
  cleanedMarkdown = cleanedMarkdown.replace(/:([a-z0-9_]+):/g, (match, emojiName) => {
    return EMOJI_MAP[emojiName] || match;
  });

  // 3. Render TOC [[TOC]]
  if (cleanedMarkdown.includes('[[TOC]]')) {
    const tocHtml = generateTOCHtml(cleanedMarkdown);
    cleanedMarkdown = cleanedMarkdown.replace('[[TOC]]', tocHtml);
  }

  // 4. Render dengan Marked
  let renderedHtml = marked.parse(cleanedMarkdown);

  // 5. Sanitasi DOMPurify
  renderedHtml = DOMPurify.sanitize(renderedHtml, {
    ADD_TAGS: ['math', 'svg', 'foreignobject'],
    ADD_ATTR: ['class', 'style']
  });

  previewContainer.innerHTML = renderedHtml;

  // Post-processing extensions
  const latexEnabled = localStorage.getItem('md_ext_latex') !== 'false';
  const mermaidEnabled = localStorage.getItem('md_ext_mermaid') !== 'false';

  if (latexEnabled) {
    await renderKaTeX(previewContainer);
  }
  if (mermaidEnabled) {
    await renderMermaid(previewContainer);
  }
}

// LaTeX KaTeX Renderer
async function renderKaTeX(container) {
  // Parsing rumus matematika secara lokal
  const katexNode = document.createElement('script');
  if (typeof katex === 'undefined') {
    await loadScript('./vendor/katex.min.js');
    await loadCSS('./vendor/katex.min.css');
  }

  // Render inline math $...$
  const textNodes = findTextNodes(container);
  textNodes.forEach(node => {
    const parent = node.parentNode;
    if (parent.tagName === 'CODE' || parent.tagName === 'PRE') return;
    
    const text = node.nodeValue;
    if (!text.includes('$')) return;

    // Inline regex
    const regex = /\$([^$]+)\$/g;
    let match;
    let hasMatch = false;
    let newHtml = text;

    while ((match = regex.exec(text)) !== null) {
      hasMatch = true;
      try {
        const rendered = katex.renderToString(match[1], { displayMode: false, throwOnError: false });
        newHtml = newHtml.replace(match[0], rendered);
      } catch (err) {
        console.error(err);
      }
    }

    if (hasMatch) {
      const span = document.createElement('span');
      span.innerHTML = newHtml;
      parent.replaceChild(span, node);
    }
  });

  // Render block math $$...$$
  container.querySelectorAll('p').forEach(p => {
    const text = p.textContent.trim();
    if (text.startsWith('$$') && text.endsWith('$$')) {
      const formula = text.substring(2, text.length - 2);
      try {
        p.innerHTML = katex.renderToString(formula, { displayMode: true, throwOnError: false });
      } catch (err) {
        console.error(err);
      }
    }
  });
}

// Mermaid Renderer
async function renderMermaid(container) {
  const codeBlocks = container.querySelectorAll('pre code.language-mermaid');
  if (codeBlocks.length === 0) return;

  if (typeof mermaid === 'undefined') {
    await loadScript('./vendor/mermaid.min.js');
    mermaid.initialize({ startOnLoad: false, theme: 'default' });
  }

  for (let i = 0; i < codeBlocks.length; i++) {
    const block = codeBlocks[i];
    const pre = block.parentNode;
    if (pre && pre.parentNode) {
      const code = block.textContent;
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.id = `mermaid-svg-${i}`;
      div.textContent = code;
      pre.parentNode.replaceChild(div, pre);
    }
  }

  try {
    await mermaid.run();
  } catch (err) {
    console.error("Gagal merender Mermaid diagram:", err);
  }
}

// Generate Table of Contents (TOC)
function generateTOCHtml(markdown) {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match;
  let tocItems = [];

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const title = match[2].trim();
    const anchor = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    tocItems.push({ level, title, anchor });
  }

  if (tocItems.length === 0) return '';

  let html = '<div class="toc-container" style="background: var(--pico-form-element-background-color); padding: 1rem; border-radius: 8px; margin: 1rem 0;">';
  html += '<strong>Daftar Isi</strong><ul style="padding-left:1.5rem; margin-top:0.5rem; margin-bottom:0;">';
  
  tocItems.forEach(item => {
    const indent = (item.level - 1) * 15;
    html += `<li style="margin-left:${indent}px; list-style-type:none;"><a href="#${item.anchor}">${escapeHtml(item.title)}</a></li>`;
  });
  
  html += '</ul></div>';
  return html;
}

// Helpers
function findTextNodes(el) {
  let textNodes = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while(node = walk.nextNode()) {
    textNodes.push(node);
  }
  return textNodes;
}

async function loadScript(src) {
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`Gagal memuat URL script: ${response.status}`);
    const code = await response.text();
    // Jalankan kode dalam cakupan lokal di mana define diset ke undefined
    const scriptFunc = new Function('define', code + '\n//# sourceURL=' + src);
    scriptFunc(undefined);
  } catch (err) {
    console.error(`Gagal memuat script offline: ${src}`, err);
    throw err;
  }
}

function loadCSS(href) {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = resolve;
    document.head.appendChild(link);
  });
}

// === SCROLL SYNC MODULE ===

/**
 * Build a mapping antara baris editor dan elemen heading di preview.
 * Mengembalikan array: [{ line, el }, ...] diurutkan berdasarkan nomor baris.
 */
function buildHeadingMap() {
  if (!editorInstance) return [];
  const model = editorInstance.getModel();
  if (!model) return [];

  const content = model.getValue();
  const lines = content.split('\n');
  const previewEl = document.getElementById('preview-html-content');
  if (!previewEl) return [];

  // Ambil semua heading dari preview (h1-h6) dalam urutan DOM
  const headingEls = Array.from(previewEl.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  if (headingEls.length === 0) return [];

  // Buat map: teks heading → nomor baris di editor
  const map = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/;

  let headingIdx = 0;
  for (let i = 0; i < lines.length && headingIdx < headingEls.length; i++) {
    const match = lines[i].match(headingRegex);
    if (match) {
      // Cocokkan dengan heading DOM berdasarkan urutan kemunculan
      const el = headingEls[headingIdx];
      map.push({ line: i + 1, el }); // Monaco line numbers are 1-based
      headingIdx++;
    }
  }

  return map;
}

/**
 * Sync scroll: Editor → Preview.
 * Menggunakan interpolasi antara heading-heading terdekat.
 */
function syncScrollEditorToPreview() {
  if (!editorInstance) return;
  const model = editorInstance.getModel();
  if (!model) return;

  const previewPanel = document.getElementById('preview-panel-host');
  if (!previewPanel) return;

  const visibleRanges = editorInstance.getVisibleRanges();
  if (visibleRanges.length === 0) return;

  const firstVisibleLine = visibleRanges[0].startLineNumber;
  const lastVisibleLine = visibleRanges[0].endLineNumber;
  const totalLines = model.getLineCount();
  const visibleLines = lastVisibleLine - firstVisibleLine;

  const headingMap = buildHeadingMap();

  isSyncingScroll = true;

  if (headingMap.length >= 2) {
    // === Heading-based interpolation ===
    // Cari dua heading yang mengapit baris saat ini
    let prevEntry = headingMap[0];
    let nextEntry = headingMap[headingMap.length - 1];

    for (let i = 0; i < headingMap.length - 1; i++) {
      if (headingMap[i].line <= firstVisibleLine && headingMap[i + 1].line > firstVisibleLine) {
        prevEntry = headingMap[i];
        nextEntry = headingMap[i + 1];
        break;
      }
    }

    // Posisi offset heading di preview (relatif ke previewPanel)
    const prevTop = prevEntry.el.offsetTop - previewPanel.offsetTop;
    const nextTop = nextEntry.el.offsetTop - previewPanel.offsetTop;

    // Rasio posisi di antara dua heading (0 = di heading sebelumnya, 1 = di heading berikutnya)
    const sectionLines = Math.max(1, nextEntry.line - prevEntry.line);
    const t = Math.min(1, Math.max(0, (firstVisibleLine - prevEntry.line) / sectionLines));

    // Interpolasi posisi scroll target
    const targetScrollTop = prevTop + t * (nextTop - prevTop);

    previewPanel.scrollTo({ top: Math.max(0, targetScrollTop - 20), behavior: 'auto' });

  } else {
    // === Fallback: rasio baris sederhana (untuk dokumen tanpa heading) ===
    const scrollableLines = Math.max(1, totalLines - visibleLines);
    const scrollRatio = Math.min(1, Math.max(0, (firstVisibleLine - 1) / scrollableLines));
    const maxPreviewScroll = previewPanel.scrollHeight - previewPanel.clientHeight;
    previewPanel.scrollTop = scrollRatio * maxPreviewScroll;
  }

  // Release flag setelah satu frame agar preview listener tidak trigger balik
  requestAnimationFrame(() => { isSyncingScroll = false; });
}

/**
 * Sync scroll: Preview → Editor.
 * Dipanggil saat user men-scroll di panel preview.
 */
function syncScrollPreviewToEditor() {
  if (!editorInstance || isSyncingScroll) return;

  const previewPanel = document.getElementById('preview-panel-host');
  if (!previewPanel) return;

  const maxScroll = previewPanel.scrollHeight - previewPanel.clientHeight;
  if (maxScroll <= 0) return;

  const scrollRatio = previewPanel.scrollTop / maxScroll;

  const model = editorInstance.getModel();
  if (!model) return;

  const totalLines = model.getLineCount();
  const headingMap = buildHeadingMap();

  isSyncingScroll = true;

  if (headingMap.length >= 2) {
    // Cari heading yang sesuai dengan posisi scroll preview saat ini
    const currentPreviewTop = previewPanel.scrollTop;
    const previewOffset = previewPanel.offsetTop;

    let prevEntry = headingMap[0];
    let nextEntry = headingMap[headingMap.length - 1];

    for (let i = 0; i < headingMap.length - 1; i++) {
      const prevTop = headingMap[i].el.offsetTop - previewOffset;
      const nextTop = headingMap[i + 1].el.offsetTop - previewOffset;
      if (prevTop <= currentPreviewTop && nextTop > currentPreviewTop) {
        prevEntry = headingMap[i];
        nextEntry = headingMap[i + 1];
        break;
      }
    }

    const prevTop = prevEntry.el.offsetTop - previewOffset;
    const nextTop = nextEntry.el.offsetTop - previewOffset;
    const sectionHeight = Math.max(1, nextTop - prevTop);
    const t = Math.min(1, Math.max(0, (currentPreviewTop - prevTop) / sectionHeight));

    const sectionLines = nextEntry.line - prevEntry.line;
    const targetLine = Math.round(prevEntry.line + t * sectionLines);

    editorInstance.revealLineNearTop(Math.max(1, targetLine));

  } else {
    // Fallback: rasio sederhana
    const targetLine = Math.max(1, Math.round(scrollRatio * (totalLines - 1)) + 1);
    editorInstance.revealLineNearTop(targetLine);
  }

  requestAnimationFrame(() => { isSyncingScroll = false; });
}

/** @deprecated Gunakan syncScrollEditorToPreview */
function syncScrollFromEditor() {
  syncScrollEditorToPreview();
}

// Setup listener scroll preview → editor (dipasang sekali saat init)
function initPreviewScrollSync() {
  const previewPanel = document.getElementById('preview-panel-host');
  if (!previewPanel || previewPanel._scrollSyncBound) return;

  previewPanel._scrollSyncBound = true;
  previewPanel.addEventListener('scroll', () => {
    if (!scrollSyncEnabled || isSyncingScroll) return;
    const splitBtn = document.getElementById('btn-mode-split');
    if (splitBtn && splitBtn.classList.contains('active')) {
      syncScrollPreviewToEditor();
    }
  }, { passive: true });
}


// === AUTOSAVE MODULE ===
function triggerAutosave(content) {
  updateSaveIndicator('saving');
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    await saveDocumentToDB(content);
  }, 100);
}

async function saveDocumentToDB(content) {
  if (!currentDocId) return;
  
  const doc = await dbGet('documents', currentDocId);
  if (!doc) return;

  // Hitung metadata
  const title = deriveTitle(content);
  const words = countWords(content);
  const chars = content.length;
  
  doc.content = content;
  doc.title = title;
  doc.word_count = words;
  doc.char_count = chars;
  doc.updated_at = new Date().toISOString();

  await dbPut('documents', doc);
  updateSaveIndicator('saved');

  // Sync title di sidebar tree
  const activeTreeFile = document.querySelector(`.tree-file-item[data-id="${currentDocId}"] .file-title-txt`);
  if (activeTreeFile) {
    activeTreeFile.textContent = title;
  }

  // Sync dengan Berkas global via BroadcastChannel
  if (window.broadcastTMPT) {
    window.broadcastTMPT('FILE_UPDATED', {
      id: doc.id,
      type: 'markdown',
      title: doc.title,
      app_db: 'tmpt_markdown',
      app_link: `/app/dev/markdown/?id=${doc.id}`
    });
  }
}

function deriveTitle(markdown) {
  // Cari H1 pertama
  const match = markdown.match(/^#\s+(.+)$/m);
  if (match && match[1]) {
    return match[1].trim();
  }
  return 'Tanpa Judul';
}

// === INTERACTIVE EVENT LISTENERS ===
function setupEventListeners() {
  // Folder Baru
  document.getElementById('btn-new-folder').addEventListener('click', () => {
    openFolderModal();
  });

  // Berkas Baru
  document.getElementById('btn-new-file').addEventListener('click', async () => {
    await createNewDocument();
  });

  // Buka Settings
  document.getElementById('btn-open-settings').addEventListener('click', () => {
    openSettingsModal();
  });

  // Impor Berkas
  document.getElementById('btn-import-md').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('import-file-input').click();
  });

  document.getElementById('import-file-input').addEventListener('change', handleImportFile);

  // Search filter
  document.getElementById('search-docs').addEventListener('input', () => {
    renderFileTree();
  });

  // Mode View Toggles
  document.getElementById('btn-mode-split').addEventListener('click', (e) => setViewMode('split', e.target));
  document.getElementById('btn-mode-editor').addEventListener('click', (e) => setViewMode('editor', e.target));
  document.getElementById('btn-mode-preview').addEventListener('click', (e) => setViewMode('preview', e.target));
  document.getElementById('btn-mode-focus').addEventListener('click', (e) => setViewMode('focus', e.target));

  // Toolbar Formatting Actions
  setupToolbarActions();

  // Settings Save
  document.getElementById('btn-save-settings').addEventListener('click', saveSettingsFromModal);

  // View All Documents Toggle
  document.getElementById('btn-view-all').addEventListener('click', () => {
    currentViewFilter = 'all';
    document.getElementById('btn-view-all').classList.add('active');
    document.getElementById('btn-trash-view').classList.remove('active');
    renderFileTree();
  });

  // Trash View Toggle
  document.getElementById('btn-trash-view').addEventListener('click', () => {
    currentViewFilter = 'trash';
    document.getElementById('btn-trash-view').classList.add('active');
    document.getElementById('btn-view-all').classList.remove('active');
    renderFileTree();
  });

  // Bersihkan Sampah (Empty Trash)
  document.getElementById('btn-empty-trash').addEventListener('click', async () => {
    const confirmed = await confirmPico("Apakah Anda yakin ingin menghapus permanen semua berkas di Kotak Sampah? Tindakan ini tidak dapat dibatalkan.");
    if (confirmed) {
      // Hapus fisik berkas yang ditandai trashed
      const filesToDelete = filesCache.filter(file => file.trashed);
      for (const file of filesToDelete) {
        await dbDelete('documents', file.id);
        if (window.broadcastTMPT) {
          window.broadcastTMPT('FILE_DELETED', { id: file.id, type: 'markdown' });
        }
      }
      if (window.TMPT_UI) window.TMPT_UI.toast("Kotak sampah berhasil dibersihkan", "success");
      await reloadFileTree();
      await openLatestOrCreate();
    }
  });

  // Pulihkan Semua (Restore All)
  document.getElementById('btn-restore-all-trash').addEventListener('click', async () => {
    const confirmed = await confirmPico("Apakah Anda yakin ingin memulihkan semua berkas dari Kotak Sampah?");
    if (confirmed) {
      const filesToRestore = filesCache.filter(file => file.trashed);
      for (const file of filesToRestore) {
        file.trashed = false;
        await dbPut('documents', file);
        if (window.broadcastTMPT) {
          window.broadcastTMPT('FILE_CREATED', {
            id: file.id,
            type: 'markdown',
            title: file.title,
            app_db: 'tmpt_markdown',
            app_link: `/app/dev/markdown/?id=${file.id}`
          });
        }
      }
      if (window.TMPT_UI) window.TMPT_UI.toast("Semua berkas berhasil dipulihkan", "success");
      await reloadFileTree();
    }
  });

  // Export Buttons
  document.getElementById('export-md').addEventListener('click', () => exportFile('md'));
  document.getElementById('export-html').addEventListener('click', () => exportFile('html'));
  document.getElementById('export-html-github').addEventListener('click', () => exportFile('html-github'));
  document.getElementById('export-pdf').addEventListener('click', async () => {
    const originalTitle = document.title;
    if (currentDocId) {
      const doc = await dbGet('documents', currentDocId);
      if (doc && doc.title && doc.title !== 'Tanpa Judul') {
        document.title = doc.title;
      }
    }
    window.print();
    // Pulihkan judul halaman setelah dialog print ditutup
    document.title = originalTitle;
  });

  // Exit Focus Mode buttons
  document.getElementById('btn-exit-focus-float').addEventListener('click', () => {
    setViewMode('split', document.getElementById('btn-mode-split'));
  });
  document.getElementById('btn-exit-focus-toolbar').addEventListener('click', () => {
    setViewMode('split', document.getElementById('btn-mode-split'));
  });

  // Escape key to exit focus mode
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const appContainer = document.getElementById('markdown-app-container');
      if (appContainer && appContainer.classList.contains('focus-mode')) {
        setViewMode('split', document.getElementById('btn-mode-split'));
      }
    }
  });

  // Listen to fullscreen changes to sync with focus mode state
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      const appContainer = document.getElementById('markdown-app-container');
      if (appContainer && appContainer.classList.contains('focus-mode')) {
        setViewMode('split', document.getElementById('btn-mode-split'));
      }
    }
  });
}

// === VIEW LAYOUT STATE ===
function setViewMode(mode, targetBtn) {
  const container = document.getElementById('workspace-container');
  const appContainer = document.getElementById('markdown-app-container');
  
  // Reset active classes
  document.querySelectorAll('.view-toggles button').forEach(b => b.classList.remove('active'));
  if (targetBtn) {
    targetBtn.classList.add('active');
  }

  // Reset Focus Mode
  if (appContainer.classList.contains('focus-mode')) {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.log('Error exiting fullscreen:', err));
    }
  }
  appContainer.classList.remove('focus-mode');
  document.body.classList.remove('focus-mode');

  if (mode === 'split') {
    container.className = 'markdown-content split';
  } else if (mode === 'editor') {
    container.className = 'markdown-content editor-only';
  } else if (mode === 'preview') {
    container.className = 'markdown-content preview-only';
  } else if (mode === 'focus') {
    container.className = 'markdown-content editor-only';
    appContainer.classList.add('focus-mode');
    document.body.classList.add('focus-mode');
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(err => console.log('Error entering fullscreen:', err));
    }
  }

  // Relayout Monaco
  if (editorInstance) {
    editorInstance.layout();
  }
}

// === TOOLBAR VISUAL FORMATTING MODULE ===
function setupToolbarActions() {
  const actions = {
    'tb-bold': '**',
    'tb-italic': '*',
    'tb-strike': '~~',
    'tb-code-inline': '`',
    'tb-quote': '> ',
    'tb-code-block': '```\n',
    'tb-hr': '\n---\n',
    'tb-link': '[Teks](https://)',
    'tb-image': '![Deskripsi](https://)',
    'tb-table': '\n| Kolom 1 | Kolom 2 |\n| --- | --- |\n| Baris 1 | Data |\n',
    'tb-latex-inline': '$',
    'tb-latex-block': '\n$$\n\n$$\n',
    'tb-mermaid': '\n```mermaid\nflowchart TD\n  A[Mulai] --> B[Proses]\n```\n',
    'tb-footnote': '[^1]',
    'tb-toc': '\n[[TOC]]\n'
  };

  Object.keys(actions).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', () => {
        insertTextAtCursor(actions[id]);
      });
    }
  });

  // Headings
  document.querySelectorAll('.btn-heading').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const level = parseInt(el.dataset.level);
      const prefix = '#'.repeat(level) + ' ';
      insertTextAtCursor(prefix);
    });
  });

  // Bullet & Numbered List
  document.getElementById('tb-list-ul').addEventListener('click', () => insertTextAtCursor('- '));
  document.getElementById('tb-list-ol').addEventListener('click', () => insertTextAtCursor('1. '));
  document.getElementById('tb-list-task').addEventListener('click', () => insertTextAtCursor('- [ ] '));
}

function insertTextAtCursor(text) {
  if (!editorInstance) return;

  const selection = editorInstance.getSelection();
  const range = new monaco.Range(
    selection.startLineNumber,
    selection.startColumn,
    selection.endLineNumber,
    selection.endColumn
  );

  const id = { major: 1, minor: 1 };
  const textValue = editorInstance.getModel().getValueInRange(range);

  let opText = text;
  // Jika formatnya wrap (seperti bold atau italic)
  if ((text === '**' || text === '*' || text === '~~' || text === '`' || text === '$') && textValue) {
    opText = `${text}${textValue}${text}`;
  } else if (text === '```\n') {
    opText = `\`\`\`javascript\n${textValue || 'code'}\n\`\`\``;
  } else if (text === '[^1]') {
    opText = `${textValue || ''}[^1]`;
  }

  const op = { identifier: id, range: range, text: opText, forceMoveMarkers: true };
  editorInstance.executeEdits("my-source", [op]);
  editorInstance.focus();
}

// === FILE & FOLDER CRUD LOGIC ===
async function createNewDocument(folderId = null) {
  const newId = 'doc_' + crypto.randomUUID();
  
  // Hitung counter dokumen baru berdasarkan judul terbesar yang ada
  let maxNum = 0;
  filesCache.forEach(f => {
    const m = f.title.match(/^Judul Dokumen Baru (\d+)$/);
    if (m) {
      const num = parseInt(m[1]);
      if (num > maxNum) maxNum = num;
    }
  });
  const nextNum = maxNum + 1;
  const title = `Judul Dokumen Baru ${nextNum}`;
  const sampleContent = `# ${title}\n\nTulis isi dokumen Markdown Anda di sini...`;
  
  const doc = {
    id: newId,
    title: title,
    content: sampleContent,
    folder_id: folderId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    word_count: 5,
    char_count: sampleContent.length,
    trashed: false
  };

  await dbPut('documents', doc);
  await reloadFileTree();
  await openDocument(newId);

  // Kirim broadcast FILE_CREATED agar Berkas sinkron dan melacak file baru ini
  if (window.broadcastTMPT) {
    window.broadcastTMPT('FILE_CREATED', {
      id: doc.id,
      type: 'markdown',
      title: doc.title,
      app_db: 'tmpt_markdown',
      app_link: `/app/dev/markdown/?id=${doc.id}`
    });
  }

  if (window.TMPT_UI) {
    window.TMPT_UI.toast("Dokumen baru berhasil dibuat", "success");
  }
}

async function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    const content = event.target.result;
    const title = file.name.replace(/\.[^/.]+$/, "");
    const newId = 'doc_' + crypto.randomUUID();

    const doc = {
      id: newId,
      title: title,
      content: content,
      folder_id: activeFolderId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      word_count: countWords(content),
      char_count: content.length,
      trashed: false
    };

    await dbPut('documents', doc);
    await reloadFileTree();
    await openDocument(newId);
    
    // Broadcast FILE_CREATED untuk impor
    if (window.broadcastTMPT) {
      window.broadcastTMPT('FILE_CREATED', {
        id: doc.id,
        type: 'markdown',
        title: doc.title,
        app_db: 'tmpt_markdown',
        app_link: `/app/dev/markdown/?id=${doc.id}`
      });
    }

    if (window.TMPT_UI) {
      window.TMPT_UI.toast(`Dokumen "${title}" berhasil diimpor`, "success");
    }
  };
  reader.readAsText(file);
}

// === SETTINGS PANEL MODULE ===
function openSettingsModal() {
  const modal = document.getElementById('modal-settings');
  
  // Load values
  document.getElementById('setting-font-size').value = localStorage.getItem('md_font_size') || '16';
  document.getElementById('setting-word-wrap').checked = localStorage.getItem('md_word_wrap') !== 'false';
  document.getElementById('setting-line-numbers').checked = localStorage.getItem('md_line_numbers') !== 'false';
  document.getElementById('setting-preview-theme').value = localStorage.getItem('md_preview_theme') || 'default';

  document.getElementById('setting-ext-latex').checked = localStorage.getItem('md_ext_latex') !== 'false';
  document.getElementById('setting-ext-mermaid').checked = localStorage.getItem('md_ext_mermaid') !== 'false';
  document.getElementById('setting-ext-emoji').checked = localStorage.getItem('md_ext_emoji') !== 'false';

  modal.showModal();
}

function saveSettingsFromModal() {
  const fontSize = document.getElementById('setting-font-size').value;
  const wordWrap = document.getElementById('setting-word-wrap').checked;
  const lineNumbers = document.getElementById('setting-line-numbers').checked;
  const previewTheme = document.getElementById('setting-preview-theme').value;

  const extLatex = document.getElementById('setting-ext-latex').checked;
  const extMermaid = document.getElementById('setting-ext-mermaid').checked;
  const extEmoji = document.getElementById('setting-ext-emoji').checked;

  localStorage.setItem('md_font_size', fontSize);
  localStorage.setItem('md_word_wrap', wordWrap);
  localStorage.setItem('md_line_numbers', lineNumbers);
  localStorage.setItem('md_preview_theme', previewTheme);

  localStorage.setItem('md_ext_latex', extLatex);
  localStorage.setItem('md_ext_mermaid', extMermaid);
  localStorage.setItem('md_ext_emoji', extEmoji);

  // Apply to Monaco
  if (editorInstance) {
    editorInstance.updateOptions({
      fontSize: parseInt(fontSize),
      wordWrap: wordWrap ? 'on' : 'off',
      lineNumbers: lineNumbers ? 'on' : 'off'
    });
  }

  // Apply preview theme classes
  const previewPanel = document.getElementById('preview-panel-host');
  previewPanel.className = 'preview-panel';
  if (previewTheme !== 'default') {
    previewPanel.classList.add(`preview-${previewTheme}`);
  }

  // Rerender preview
  if (editorInstance) {
    renderPreview(editorInstance.getValue());
  }

  document.getElementById('modal-settings').close();
  if (window.TMPT_UI) {
    window.TMPT_UI.toast("Pengaturan disimpan", "success");
  }
}

// === CONTEXT MENUS ===
async function confirmPico(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    if (!modal) {
      resolve(window.confirm(message));
      return;
    }
    const msgEl = document.getElementById('confirm-message');
    if (msgEl) msgEl.textContent = message;
    modal._resolve = resolve;
    modal.showModal();
  });
}

function showFileContextMenu(file, x, y) {
  const modal = document.getElementById('modal-file-options');
  
  const btnRename = document.getElementById('btn-opt-rename');
  const btnDuplicate = document.getElementById('btn-opt-duplicate');
  const btnTrash = document.getElementById('btn-opt-trash');
  const btnDeletePermanent = document.getElementById('btn-opt-delete-permanent');

  // Clone nodes to clear previous event listeners
  const newRename = btnRename.cloneNode(true);
  const newDuplicate = btnDuplicate.cloneNode(true);
  const newTrash = btnTrash.cloneNode(true);
  const newDeletePermanent = btnDeletePermanent.cloneNode(true);

  btnRename.parentNode.replaceChild(newRename, btnRename);
  btnDuplicate.parentNode.replaceChild(newDuplicate, btnDuplicate);
  btnTrash.parentNode.replaceChild(newTrash, btnTrash);
  btnDeletePermanent.parentNode.replaceChild(newDeletePermanent, btnDeletePermanent);

  // 1. Rename action
  newRename.addEventListener('click', async () => {
    modal.close();
    let newName = null;
    if (window.TMPT_UI && typeof window.TMPT_UI.prompt === 'function') {
      newName = await window.TMPT_UI.prompt("Masukkan nama baru untuk berkas:", file.title);
    } else {
      newName = prompt("Masukkan nama baru untuk berkas:", file.title);
    }
    if (newName !== null) {
      const trimmed = newName.trim();
      if (trimmed) {
        file.title = trimmed;
        // If content starts with a title, replace H1 if wanted, else just update title metadata
        file.updated_at = new Date().toISOString();
        await dbPut('documents', file);
        await reloadFileTree();
        if (currentDocId === file.id) {
          // Sync H1 title in Monaco editor if it's active
          const val = editorInstance.getValue();
          if (val.startsWith('# ')) {
            const lines = val.split('\n');
            lines[0] = `# ${trimmed}`;
            editorInstance.setValue(lines.join('\n'));
          }
        }
        if (window.TMPT_UI) window.TMPT_UI.toast("Nama berkas berhasil diubah", "success");
      }
    }
  });

  // 2. Duplicate action
  newDuplicate.addEventListener('click', async () => {
    modal.close();
    const newId = 'doc_' + crypto.randomUUID();
    const dupDoc = {
      ...file,
      id: newId,
      title: `${file.title} (Salinan)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await dbPut('documents', dupDoc);
    await reloadFileTree();
    await openDocument(newId);
    if (window.TMPT_UI) window.TMPT_UI.toast("Berkas berhasil diduplikasi", "success");
  });

  // 3. Trash / Restore action
  if (file.trashed) {
    newTrash.innerHTML = '🔄 Pulihkan Berkas';
    newTrash.style.color = '#10b981';
    newTrash.style.borderColor = '#10b981';
    newDeletePermanent.classList.remove('hidden');
  } else {
    newTrash.innerHTML = '🗑️ Hapus ke Sampah';
    newTrash.style.color = '#ef4444';
    newTrash.style.borderColor = '#ef4444';
    newDeletePermanent.classList.add('hidden');
  }

  newTrash.addEventListener('click', async () => {
    modal.close();
    if (file.trashed) {
      file.trashed = false;
      await dbPut('documents', file);
      if (window.broadcastTMPT) {
        window.broadcastTMPT('FILE_CREATED', {
          id: file.id,
          type: 'markdown',
          title: file.title,
          app_db: 'tmpt_markdown',
          app_link: `/app/dev/markdown/?id=${file.id}`
        });
      }
      if (window.TMPT_UI) window.TMPT_UI.toast("Berkas berhasil dipulihkan", "success");
    } else {
      file.trashed = true;
      await dbPut('documents', file);
      if (window.broadcastTMPT) {
        window.broadcastTMPT('FILE_DELETED', { id: file.id, type: 'markdown' });
      }
      if (window.TMPT_UI) window.TMPT_UI.toast("Berkas dipindahkan ke Sampah", "info");
    }
    await reloadFileTree();
    await openLatestOrCreate();
  });

  // 4. Delete Permanent action
  newDeletePermanent.addEventListener('click', async () => {
    modal.close();
    const confirmed = await confirmPico(`Apakah Anda yakin ingin menghapus "${file.title}" secara permanen? Tindakan ini tidak dapat dibatalkan.`);
    if (confirmed) {
      await dbDelete('documents', file.id);
      if (window.broadcastTMPT) {
        window.broadcastTMPT('FILE_DELETED', { id: file.id, type: 'markdown' });
      }
      if (window.TMPT_UI) window.TMPT_UI.toast("Berkas berhasil dihapus secara permanen", "success");
      await reloadFileTree();
      await openLatestOrCreate();
    }
  });

  modal.showModal();
}

async function showFolderContextMenu(folderId, x, y) {
  const folder = foldersCache.find(f => f.id === folderId);
  if (!folder) return;

  const modal = document.getElementById('modal-folder-options');
  if (!modal) return;

  const btnNewFile = document.getElementById('btn-fopt-newfile');
  const btnRename = document.getElementById('btn-fopt-rename');
  const btnDelete = document.getElementById('btn-fopt-delete');

  // Clone nodes to clear previous event listeners
  const newNewFile = btnNewFile.cloneNode(true);
  const newRename = btnRename.cloneNode(true);
  const newDelete = btnDelete.cloneNode(true);

  btnNewFile.parentNode.replaceChild(newNewFile, btnNewFile);
  btnRename.parentNode.replaceChild(newRename, btnRename);
  btnDelete.parentNode.replaceChild(newDelete, btnDelete);

  newNewFile.addEventListener('click', async () => {
    modal.close();
    await createNewDocument(folderId);
  });

  newRename.addEventListener('click', async () => {
    modal.close();
    let newName = null;
    if (window.TMPT_UI && typeof window.TMPT_UI.prompt === 'function') {
      newName = await window.TMPT_UI.prompt("Masukkan nama baru untuk folder:", folder.name);
    } else {
      newName = prompt("Masukkan nama baru untuk folder:", folder.name);
    }
    if (newName !== null) {
      const trimmed = newName.trim();
      if (trimmed) {
        folder.name = trimmed;
        await dbPut('folders', folder);
        await reloadFileTree();
        if (window.TMPT_UI) window.TMPT_UI.toast("Nama folder berhasil diubah", "success");
      }
    }
  });

  newDelete.addEventListener('click', async () => {
    modal.close();
    const confirmed = await confirmPico(`Apakah Anda yakin ingin menghapus folder "${folder.name}" beserta seluruh berkas di dalamnya?`);
    if (confirmed) {
      await dbDelete('folders', folderId);
      // Trash files inside folder
      for (const file of filesCache) {
        if (file.folder_id === folderId) {
          file.trashed = true;
          await dbPut('documents', file);
          if (window.broadcastTMPT) {
            window.broadcastTMPT('FILE_DELETED', { id: file.id, type: 'markdown' });
          }
        }
      }
      if (window.TMPT_UI) window.TMPT_UI.toast("Folder berhasil dihapus", "success");
      await reloadFileTree();
      await openLatestOrCreate();
    }
  });

  modal.showModal();
}

// Folder Create/Rename Modal
function openFolderModal() {
  const modal = document.getElementById('modal-folder-crud');
  document.getElementById('folder-name-input').value = '';
  
  const form = document.getElementById('form-folder-crud');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('folder-name-input').value.trim();
    if (!name) return;

    const folder = {
      id: 'folder_' + crypto.randomUUID(),
      name: name,
      created_at: new Date().toISOString()
    };

    await dbPut('folders', folder);
    modal.close();
    await reloadFileTree();
  };

  modal.showModal();
}

// === EXPORT UTILITIES ===
async function exportFile(format) {
  if (!currentDocId) return;
  const doc = await dbGet('documents', currentDocId);
  if (!doc) return;

  // Sanitasi nama file: hapus karakter yang tidak valid di sistem file
  const rawTitle = doc.title || 'tanpa-judul';
  const safeFilename = rawTitle
    .trim()
    .replace(/[\\/:\*\?"<>\|]/g, '') // hapus karakter tidak valid di Windows
    .replace(/\s+/g, '-')             // spasi jadi tanda hubung
    .replace(/^-+|-+$/g, '')          // hapus tanda hubung di awal/akhir
    || 'tanpa-judul';

  let content = '';
  let filename = safeFilename;

  if (format === 'md') {
    content = doc.content;
    filename += '.md';
    downloadBlob(content, filename, 'text/markdown');
  } else if (format === 'html' || format === 'html-github') {
    let previewHtml = document.getElementById('preview-html-content').innerHTML;
    let cssStyles = '';

    if (format === 'html-github') {
      cssStyles = `
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial; padding: 2rem; max-width: 800px; margin: 0 auto; line-height: 1.6; }
        h1, h2 { border-bottom: 1px solid var(--border-color, #eaecef); padding-bottom: 0.3em; }
        pre { background: #f6f8fa; padding: 1rem; border-radius: 6px; }
        code { background: rgba(27,31,35,0.05); padding: 0.2rem 0.4rem; border-radius: 3px; }
      `;
    }

    content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(rawTitle)}</title>
  <style>${cssStyles}</style>
</head>
<body>
  ${previewHtml}
</body>
</html>`;
    filename += '.html';
    downloadBlob(content, filename, 'text/html');
  }
}

function downloadBlob(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// === STATS & HELPERS ===
function updateStatusBarStats(content) {
  const statSize = document.getElementById('stat-size');
  const statWords = document.getElementById('stat-words');
  const statTime = document.getElementById('stat-time');

  const byteSize = new Blob([content]).size;
  const wordCount = countWords(content);
  const readingTime = Math.ceil(wordCount / 200);

  if (statSize) statSize.textContent = formatBytes(byteSize);
  if (statWords) statWords.textContent = `${wordCount} kata`;
  if (statTime) statTime.textContent = `~${readingTime} menit baca`;
}

function countWords(str) {
  const clean = str.replace(/[#*`~>]/g, '').trim();
  if (!clean) return 0;
  return clean.split(/\s+/).length;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  return (bytes / 1024).toFixed(1) + " KB";
}

function updateSaveIndicator(status) {
  const el = document.getElementById('save-status');
  if (!el) return;

  if (status === 'saving') {
    el.textContent = 'Menyimpan...';
    el.style.opacity = '0.7';
  } else if (status === 'saved') {
    el.textContent = 'Tersimpan ✓';
    el.style.opacity = '1';
  }
}

function applySavedTheme() {
  const theme = localStorage.getItem('tmpt_theme') || 'auto';
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

async function openLatestOrCreate() {
  if (filesCache.length > 0) {
    // Cari yang tidak trashed
    const nonTrash = filesCache.filter(f => !f.trashed);
    if (nonTrash.length > 0) {
      await openDocument(nonTrash[0].id);
      return;
    }
  }

  // Buat dokumen perdana jika database benar-benar kosong
  await createNewDocument();
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function updateStorageUsage() {
  // Perkiraan penggunaan penyimpanan local
  const size = new Blob([JSON.stringify(filesCache)]).size;
  const display = formatBytes(size);
  document.getElementById('storage-use-indicator').textContent = `${display} digunakan`;
}
