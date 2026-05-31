/**
 * TMPT PDF Tools — pdf-core.js
 * Utility inti bersama: drop zone, lazy loader, download helper, progress
 */

/* ── Lazy Script Loader ─────────────────────────────────────────────────────── */
const _loadedScripts = new Set();

export function lazyLoadScript(src) {
  if (_loadedScripts.has(src)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script   = document.createElement('script');
    script.src     = src;
    script.onload  = () => { _loadedScripts.add(src); resolve(); };
    script.onerror = () => reject(new Error(`Gagal memuat: ${src}`));
    document.head.appendChild(script);
  });
}

export async function loadPdfLib() {
  if (window.PDFLib) return window.PDFLib;
  await lazyLoadScript('/app/kerja/pdf/vendor/pdf-lib.min.js');
  return window.PDFLib;
}

export async function loadJSZip() {
  if (window.JSZip) return window.JSZip;
  await lazyLoadScript('/app/kerja/pdf/vendor/jszip.min.js');
  return window.JSZip;
}

export async function loadSortable() {
  if (window.Sortable) return window.Sortable;
  await lazyLoadScript('/app/kerja/pdf/vendor/sortable.min.js');
  return window.Sortable;
}

/* ── File Helpers ───────────────────────────────────────────────────────────── */
export function formatFileSize(bytes) {
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export function validatePdfFile(file) {
  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('File harus berformat PDF.');
  }
  if (file.size > 100 * 1024 * 1024) {
    throw new Error('Ukuran file melebihi batas maksimal 100MB.');
  }
  if (file.size > 50 * 1024 * 1024) {
    return 'warning'; // Besar tapi masih bisa diproses
  }
  return 'ok';
}

export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsArrayBuffer(file);
  });
}

/* ── Download Helper ────────────────────────────────────────────────────────── */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function downloadBytes(bytes, filename) {
  downloadBlob(new Blob([bytes], { type: 'application/pdf' }), filename);
}

/* ── Progress UI ────────────────────────────────────────────────────────────── */
export function setProgress(percent, label = '') {
  const bar = document.getElementById('pdf-progress-bar');
  const lbl = document.getElementById('pdf-progress-label');
  if (bar) {
    bar.value = percent;
    bar.setAttribute('aria-valuenow', percent);
  }
  if (lbl) lbl.textContent = label;
}

export function showProgress(label = 'Memproses...') {
  const wrap = document.getElementById('pdf-progress-wrap');
  if (wrap) { wrap.hidden = false; setProgress(0, label); }
}

export function hideProgress() {
  const wrap = document.getElementById('pdf-progress-wrap');
  if (wrap) wrap.hidden = true;
}

/* ── Drop Zone Setup ────────────────────────────────────────────────────────── */
/**
 * Setup drop zone interaktif.
 * @param {string} zoneId  - ID elemen .pdf-drop-zone
 * @param {Function} onFiles - callback(FileList)
 * @param {object} opts    - { accept, multiple }
 */
export function setupDropZone(zoneId, onFiles, opts = {}) {
  const zone  = document.getElementById(zoneId);
  if (!zone) return;

  const input = zone.querySelector('input[type="file"]');
  if (input) {
    if (opts.accept)   input.accept   = opts.accept ?? '.pdf';
    if (opts.multiple !== undefined) input.multiple = opts.multiple;
    input.addEventListener('change', e => {
      if (e.target.files?.length) onFiles(e.target.files);
    });
  }

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
  });

  zone.addEventListener('click', e => {
    if (e.target === input) return;
    input?.click();
  });

  zone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input?.click(); }
  });
}

/* ── Result Panel ───────────────────────────────────────────────────────────── */
export function showResult({ icon = '✅', title, meta, filename, bytes, zipBlob, onReset }) {
  const panel = document.getElementById('pdf-result-panel');
  if (!panel) return;

  panel.querySelector('.result-icon').textContent = icon;
  panel.querySelector('.result-title').textContent = title;
  panel.querySelector('.result-meta').textContent  = meta ?? '';

  const dlBtn = panel.querySelector('#btn-result-download');
  if (dlBtn) {
    dlBtn.onclick = () => {
      if (zipBlob) downloadBlob(zipBlob, filename);
      else if (bytes) downloadBytes(bytes, filename);
    };
  }

  const resetBtn = panel.querySelector('#btn-result-reset');
  if (resetBtn && onReset) resetBtn.onclick = onReset;

  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function hideResult() {
  const panel = document.getElementById('pdf-result-panel');
  if (panel) panel.hidden = true;
}

/* ── Toast (fallback jika ui.js belum diimport) ─────────────────────────────── */
export function toast(msg, type = 'info') {
  if (window.TMPT_UI?.toast) { window.TMPT_UI.toast(msg, type); return; }
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(100%)';
    setTimeout(() => el.remove(), 300);
  }, type === 'error' || type === 'warning' ? 5000 : 3000);
}

/* ── Loader ──────────────────────────────────────────────────────────────────── */
export function showLoader(msg = 'Memuat...') {
  if (window.TMPT_UI?.showLoader) { window.TMPT_UI.showLoader(msg); return; }
  let el = document.getElementById('tmpt-loader');
  if (!el) { el = document.createElement('div'); el.id = 'tmpt-loader'; document.body.appendChild(el); }
  el.innerHTML = `<div class="tmpt-loader-inner"><span aria-hidden="true">⏳</span><span>${msg}</span></div>`;
  el.hidden = false;
}

export function hideLoader() {
  if (window.TMPT_UI?.hideLoader) { window.TMPT_UI.hideLoader(); return; }
  const el = document.getElementById('tmpt-loader');
  if (el) el.hidden = true;
}

/* ── Theme ───────────────────────────────────────────────────────────────────── */
export function applyTheme() {
  const saved = localStorage.getItem('tmpt_theme') || 'auto';
  if (saved === 'auto') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', saved);
  }
}

/* ── App Header Loader ───────────────────────────────────────────────────────── */
export async function loadAppHeader() {
  const placeholder = document.getElementById('tmpt-header-placeholder');
  if (!placeholder) return;
  try {
    if (!window.TMPT_UI) {
      await lazyLoadScript('/shared/ui.js');
    }
    const res  = await fetch('/shared/app-header.html');
    const html = await res.text();
    const tmp  = document.createElement('div');
    tmp.innerHTML = html;
    placeholder.replaceWith(...tmp.childNodes);
    // Load HTMX if needed
    if (window.htmx) window.htmx.process(document.body);
  } catch (err) {
    console.error("Gagal memuat header:", err);
  }
}
