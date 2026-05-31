/**
 * T01 — Merge PDF
 * Gabungkan beberapa file PDF menjadi satu dokumen.
 */
import { loadPdfLib, loadSortable, setupDropZone, readFileAsArrayBuffer, validatePdfFile,
         formatFileSize, downloadBytes, showProgress, hideProgress, setProgress,
         showResult, hideResult, toast, showLoader, hideLoader, applyTheme, loadAppHeader } from '../pdf-core.js';
import { renderPageToCanvas } from '../pdf-preview.js';

applyTheme();
loadAppHeader();

const state = { files: [] }; // { file, buffer, thumbnailCanvas }
let sortDirection = 'asc';

// ── Init ──────────────────────────────────────────────────────────────────────
setupDropZone('drop-zone', handleFiles, { accept: '.pdf', multiple: true });
document.getElementById('btn-merge').addEventListener('click', runMerge);

const triggerFileInput = () => document.querySelector('#drop-zone input[type=file]').click();
document.getElementById('btn-add-more').addEventListener('click', triggerFileInput);
document.getElementById('btn-floating-add').addEventListener('click', triggerFileInput);

document.getElementById('btn-sort').addEventListener('click', () => {
  if (state.files.length < 2) return;
  if (sortDirection === 'asc') {
    state.files.sort((a, b) => a.file.name.localeCompare(b.file.name));
    sortDirection = 'desc';
    document.getElementById('btn-sort').textContent = 'Urutkan Z-A';
  } else {
    state.files.sort((a, b) => b.file.name.localeCompare(a.file.name));
    sortDirection = 'asc';
    document.getElementById('btn-sort').textContent = 'Urutkan A-Z';
  }
  renderFileList();
});

async function handleFiles(fileList) {
  showLoader('Membaca file...');
  for (const f of fileList) {
    try {
      validatePdfFile(f);
      const buf = await readFileAsArrayBuffer(f);
      state.files.push({
        file: f,
        buffer: buf,
        thumbnailCanvas: null
      });
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  hideLoader();
  renderFileList();
}

async function renderFileList() {
  const grid = document.getElementById('merge-preview-grid');
  const controlsBar = document.getElementById('merge-controls-bar');
  const zone = document.getElementById('drop-zone');
  const opts = document.getElementById('merge-options');
  const bar  = document.getElementById('action-bar');
  const badge = document.getElementById('file-count-badge');

  badge.textContent = state.files.length;

  // Set combined filename dynamically
  if (state.files.length > 0) {
    const combined = state.files.map(item => item.file.name.replace(/\.[^/.]+$/, "")).join("-");
    const outputNameInput = document.getElementById('output-name');
    if (outputNameInput) {
      outputNameInput.value = combined;
    }
  }

  if (state.files.length === 0) {
    grid.innerHTML = '';
    controlsBar.hidden = true;
    zone.hidden = false;
    opts.hidden = true;
    bar.hidden  = true;
    hideResult();
    return;
  }

  zone.hidden = false; // keep zone available to drag additional files
  controlsBar.hidden = false;
  opts.hidden = false;
  bar.hidden  = false;
  hideResult();

  grid.innerHTML = '';
  
  // Render cards
  state.files.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'merge-file-card';
    card.dataset.index = i;
    
    const delBtn = document.createElement('button');
    delBtn.className = 'card-delete-btn';
    delBtn.innerHTML = '✕';
    delBtn.ariaLabel = `Hapus ${item.file.name}`;
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.files.splice(i, 1);
      renderFileList();
    });

    const thumbContainer = document.createElement('div');
    thumbContainer.className = 'card-thumb-container';
    
    if (item.thumbnailCanvas) {
      thumbContainer.appendChild(item.thumbnailCanvas);
    } else {
      thumbContainer.innerHTML = '<span style="font-size: 1.5rem;">📄</span>';
      // Lazy render thumbnail
      lazyRenderThumbnail(item, i, thumbContainer);
    }

    const titleEl = document.createElement('div');
    titleEl.className = 'card-title';
    titleEl.textContent = item.file.name;
    titleEl.title = item.file.name;

    const sizeEl = document.createElement('div');
    sizeEl.className = 'card-size';
    sizeEl.textContent = formatFileSize(item.file.size);

    card.appendChild(delBtn);
    card.appendChild(thumbContainer);
    card.appendChild(titleEl);
    card.appendChild(sizeEl);
    grid.appendChild(card);
  });

  // Setup Sortable
  const SortableJS = await loadSortable();
  if (SortableJS) {
    SortableJS.create(grid, {
      animation: 150,
      onEnd: () => {
        const newFiles = [];
        grid.querySelectorAll('.merge-file-card').forEach(card => {
          const idx = Number(card.dataset.index);
          newFiles.push(state.files[idx]);
        });
        state.files = newFiles;
        // Rerender to reset data-index attributes without regenerating thumbnails
        renderFileListOnlyIndices();
      }
    });
  }
}

// Quick rerender only to update indices on cards to avoid screen flash
function renderFileListOnlyIndices() {
  const cards = document.querySelectorAll('.merge-preview-grid .merge-file-card');
  cards.forEach((card, i) => {
    card.dataset.index = i;
    const delBtn = card.querySelector('.card-delete-btn');
    if (delBtn) {
      // Re-bind delete event with correct index
      const newDelBtn = delBtn.cloneNode(true);
      newDelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.files.splice(i, 1);
        renderFileList();
      });
      delBtn.replaceWith(newDelBtn);
    }
  });
  document.getElementById('file-count-badge').textContent = state.files.length;
}

async function lazyRenderThumbnail(item, index, container) {
  try {
    const canvas = await renderPageToCanvas(item.buffer, 1, 0.25);
    item.thumbnailCanvas = canvas;
    // Replace placeholder if container is still in DOM
    if (container && container.parentNode) {
      container.innerHTML = '';
      container.appendChild(canvas);
    }
  } catch (e) {
    console.warn('Failed to render page thumbnail', e);
  }
}

async function runMerge() {
  if (state.files.length < 2) { toast('Tambahkan minimal 2 file PDF.', 'warning'); return; }

  showLoader('Memuat pdf-lib...');
  const PDFLib = await loadPdfLib();
  hideLoader();

  showProgress('Menggabungkan halaman...');
  hideResult();

  try {
    const merged = await PDFLib.PDFDocument.create();
    let done = 0;

    for (const item of state.files) {
      const src = await PDFLib.PDFDocument.load(item.buffer);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach(p => merged.addPage(p));
      done++;
      setProgress(Math.round((done / state.files.length) * 100),
        `Memproses file ${done} dari ${state.files.length}...`);
    }

    const outputName = document.getElementById('output-name').value.trim() || 'merged';
    const finalFilename = outputName.endsWith('.pdf') ? outputName : outputName + '.pdf';
    const bytes = await merged.save();
    hideProgress();

    // Auto-download merged PDF
    downloadBytes(bytes, finalFilename);

    showResult({
      icon: '✅', title: 'PDF berhasil digabungkan!',
      meta: `File diunduh secara otomatis • ${state.files.length} file • ${formatFileSize(bytes.byteLength)}`,
      filename: finalFilename,
      bytes,
      onReset: () => { state.files = []; renderFileList(); },
    });
    toast('Berhasil digabungkan!', 'success');
  } catch (err) {
    hideProgress();
    console.error(err);
    toast('Gagal menggabungkan: ' + err.message, 'error');
  }
}
