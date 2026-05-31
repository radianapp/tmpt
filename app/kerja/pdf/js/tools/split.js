/**
 * T02 — Split PDF
 * Pisahkan PDF menjadi beberapa bagian (Range, Pages, Size)
 */
import { loadPdfLib, loadJSZip, setupDropZone, readFileAsArrayBuffer, validatePdfFile,
         formatFileSize, downloadBlob, showProgress, hideProgress, setProgress,
         showResult, hideResult, toast, showLoader, hideLoader, applyTheme, loadAppHeader } from '../pdf-core.js';
import { renderPageToCanvas } from '../pdf-preview.js';

applyTheme();
loadAppHeader();

const state = {
  file: null,
  buffer: null,
  numPages: 0,
  activeTab: 'range',        // 'range', 'pages', 'size'
  rangeSubMode: 'custom',    // 'custom', 'fixed'
  pagesSubMode: 'extract-all', // 'extract-all', 'select-pages'
  sizeUnit: 'kb',            // 'kb' | 'mb'
  customRanges: [{ from: 1, to: 1 }],
  selectedPages: new Set(),
  renderedThumbnails: []
};

// ── Init ──────────────────────────────────────────────────────────────────────
setupDropZone('drop-zone', handleFile, { accept: '.pdf', multiple: false });
initEvents();

function initEvents() {
  // Tab Switchers
  const tabs = document.querySelectorAll('.split-tabs-header .tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      
      const targetTab = btn.dataset.tab;
      state.activeTab = targetTab;
      
      // Hide all contents
      document.getElementById('tab-content-range').hidden = true;
      document.getElementById('tab-content-pages').hidden = true;
      document.getElementById('tab-content-size').hidden = true;
      
      // Show target
      document.getElementById(`tab-content-${targetTab}`).hidden = false;
      renderPreviews();
    });
  });

  // Range Sub-mode Buttons
  const rangeBtns = [document.getElementById('sub-mode-custom'), document.getElementById('sub-mode-fixed')];
  rangeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      rangeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.rangeSubMode = btn.id.includes('custom') ? 'custom' : 'fixed';
      
      document.getElementById('range-mode-custom-controls').hidden = state.rangeSubMode !== 'custom';
      document.getElementById('range-mode-fixed-controls').hidden = state.rangeSubMode !== 'fixed';
      renderPreviews();
    });
  });

  // Fixed page count change
  const fixedInput = document.getElementById('fixed-pages-count');
  fixedInput.addEventListener('input', () => {
    let val = parseInt(fixedInput.value) || 1;
    if (val < 1) val = 1;
    if (val > state.numPages) val = state.numPages;
    fixedInput.value = val;
    updateFixedAlert();
    renderPreviews();
  });

  // Pages Sub-mode Buttons
  const pagesBtns = [document.getElementById('sub-mode-extract-all'), document.getElementById('sub-mode-select-pages')];
  pagesBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      pagesBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.pagesSubMode = btn.id.includes('extract-all') ? 'extract-all' : 'select-pages';
      
      document.getElementById('extract-all-info').hidden = state.pagesSubMode !== 'extract-all';
      document.getElementById('select-pages-controls').hidden = state.pagesSubMode !== 'select-pages';
      renderPreviews();
    });
  });

  // Custom pages selector text input
  const selectPagesInput = document.getElementById('select-pages-input');
  selectPagesInput.addEventListener('input', () => {
    parsePagesInputToSet(selectPagesInput.value);
    renderPreviewsOnlySelectStatus();
  });

  // Add Range Row
  document.getElementById('btn-add-range').addEventListener('click', () => {
    state.customRanges.push({ from: 1, to: state.numPages });
    renderCustomRangeRows();
    renderPreviews();
  });

  // Size unit toggle (KB / MB)
  const unitBtns = document.querySelectorAll('.unit-btn');
  unitBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      unitBtns.forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.color = 'var(--pico-muted-color)';
        b.style.fontWeight = 'normal';
      });
      btn.classList.add('active');
      btn.style.background = 'var(--pico-primary)';
      btn.style.color = '#fff';
      btn.style.fontWeight = '600';
      state.sizeUnit = btn.dataset.unit;
      // Reset input value to sensible default per unit
      const sizeInput = document.getElementById('max-file-size');
      if (state.sizeUnit === 'kb') {
        sizeInput.value = 500;
        sizeInput.min = 1;
      } else {
        sizeInput.value = 10;
        sizeInput.min = 1;
      }
      updateSizeAlert();
    });
  });

  // Size input change
  document.getElementById('max-file-size').addEventListener('input', updateSizeAlert);

  // Submit Apply Split
  document.getElementById('btn-apply-split').addEventListener('click', runSplit);
}

async function handleFile(fileList) {
  const f = fileList[0];
  try { validatePdfFile(f); } catch (e) { toast(e.message, 'error'); return; }

  showLoader('Memuat file PDF...');
  state.buffer = await readFileAsArrayBuffer(f);
  state.renderedThumbnails = [];
  
  const PDFLib = await loadPdfLib();
  const doc = await PDFLib.PDFDocument.load(state.buffer);
  state.numPages = doc.getPageCount();
  hideLoader();

  state.file = f;
  state.customRanges = [{ from: 1, to: state.numPages }];
  state.selectedPages = new Set();
  
  // Set original file size label in Tab Size
  const sizeLabel = document.getElementById('orig-size-label');
  if (sizeLabel) {
    sizeLabel.textContent = `(Ukuran asli: ${formatFileSize(f.size)})`;
  }

  // Set values on fixed input max boundary
  document.getElementById('fixed-pages-count').max = state.numPages;

  document.getElementById('drop-zone').hidden = true;
  document.getElementById('file-info').textContent = `${f.name} • ${formatFileSize(f.size)} • ${state.numPages} Halaman`;
  document.getElementById('tool-controls').hidden = false;
  hideResult();

  renderCustomRangeRows();
  updateFixedAlert();
  updateSizeAlert();
  // Init active unit button style
  document.querySelectorAll('.unit-btn').forEach(btn => {
    if (btn.dataset.unit === state.sizeUnit) {
      btn.classList.add('active');
      btn.style.background = 'var(--pico-primary)';
      btn.style.color = '#fff';
      btn.style.fontWeight = '600';
    }
  });
  renderPreviews();
}

function updateFixedAlert() {
  const count = Number(document.getElementById('fixed-pages-count').value) || 2;
  const numFiles = Math.ceil(state.numPages / count);
  document.getElementById('fixed-info-alert').textContent = 
    `PDF ini akan dibagi menjadi ${numFiles} file PDF (masing-masing maks ${count} halaman).`;
}

function updateSizeAlert() {
  const val  = Number(document.getElementById('max-file-size').value) || (state.sizeUnit === 'kb' ? 500 : 10);
  const unit = state.sizeUnit === 'kb' ? 'KB' : 'MB';
  const el   = document.getElementById('size-info-alert');
  if (el) el.textContent = `PDF ini akan dibagi menjadi file berukuran maksimal ${val} ${unit}.`;
}

function renderCustomRangeRows() {
  const container = document.getElementById('custom-ranges-list');
  container.innerHTML = '';
  
  state.customRanges.forEach((rng, idx) => {
    const row = document.createElement('div');
    row.className = 'custom-range-row';
    row.innerHTML = `
      <span>Dari hal.</span>
      <input type="number" class="range-from" value="${rng.from}" min="1" max="${state.numPages}">
      <span>ke hal.</span>
      <input type="number" class="range-to" value="${rng.to}" min="1" max="${state.numPages}">
      <button class="btn-remove-row" type="button" title="Hapus range">✕</button>
    `;
    
    const fromInput = row.querySelector('.range-from');
    const toInput   = row.querySelector('.range-to');
    const delBtn    = row.querySelector('.btn-remove-row');
    
    fromInput.addEventListener('input', () => {
      let val = parseInt(fromInput.value) || 1;
      if (val < 1) val = 1;
      if (val > state.numPages) val = state.numPages;
      rng.from = val;
      renderPreviews();
    });
    
    toInput.addEventListener('input', () => {
      let val = parseInt(toInput.value) || 1;
      if (val < 1) val = 1;
      if (val > state.numPages) val = state.numPages;
      rng.to = val;
      renderPreviews();
    });

    if (state.customRanges.length === 1) {
      delBtn.disabled = true;
      delBtn.style.opacity = 0.3;
    } else {
      delBtn.addEventListener('click', () => {
        state.customRanges.splice(idx, 1);
        renderCustomRangeRows();
        renderPreviews();
      });
    }
    
    container.appendChild(row);
  });
}

function cloneCanvas(originalCanvas) {
  const cloned = document.createElement('canvas');
  cloned.width = originalCanvas.width;
  cloned.height = originalCanvas.height;
  cloned.setAttribute('aria-label', originalCanvas.getAttribute('aria-label') || '');
  const ctx = cloned.getContext('2d');
  if (ctx) {
    ctx.drawImage(originalCanvas, 0, 0);
  }
  return cloned;
}

async function getCachedPageCanvas(pageNum) {
  if (state.renderedThumbnails[pageNum]) {
    return state.renderedThumbnails[pageNum];
  }
  const canvas = await renderPageToCanvas(state.buffer, pageNum, 0.22);
  state.renderedThumbnails[pageNum] = canvas;
  return canvas;
}

async function createPageCard(pageNum) {
  const card = document.createElement('div');
  card.className = 'range-card-item';
  
  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'card-canvas-container';
  
  const canvas = await getCachedPageCanvas(pageNum);
  canvasWrap.appendChild(cloneCanvas(canvas));
  
  const pageNumEl = document.createElement('div');
  pageNumEl.className = 'card-page-num';
  pageNumEl.textContent = pageNum;
  
  card.appendChild(canvasWrap);
  card.appendChild(pageNumEl);
  return card;
}

async function renderPreviews() {
  const container = document.getElementById('split-previews-container');
  if (!container) return;
  container.innerHTML = 'Memuat pratinjau...';

  const wrapper = document.createElement('div');

  if (state.activeTab === 'range') {
    if (state.rangeSubMode === 'custom') {
      for (let idx = 0; idx < state.customRanges.length; idx++) {
        const rng = state.customRanges[idx];
        const groupDiv = document.createElement('div');
        groupDiv.className = 'range-preview-group';
        groupDiv.innerHTML = `<div class="group-title">Range ${idx + 1}</div>`;
        
        const wrap = document.createElement('div');
        wrap.className = 'range-preview-cards-wrap';
        
        const fromCard = await createPageCard(rng.from);
        wrap.appendChild(fromCard);
        
        if (rng.to > rng.from) {
          const ellipsis = document.createElement('div');
          ellipsis.className = 'range-ellipsis';
          ellipsis.textContent = '...';
          wrap.appendChild(ellipsis);
          
          const toCard = await createPageCard(rng.to);
          wrap.appendChild(toCard);
        }
        
        groupDiv.appendChild(wrap);
        wrapper.appendChild(groupDiv);
      }
    } else if (state.rangeSubMode === 'fixed') {
      const fixedSize = Number(document.getElementById('fixed-pages-count').value) || 2;
      let rangeIdx = 1;
      for (let i = 1; i <= state.numPages; i += fixedSize) {
        const start = i;
        const end = Math.min(i + fixedSize - 1, state.numPages);
        
        const groupDiv = document.createElement('div');
        groupDiv.className = 'range-preview-group';
        groupDiv.innerHTML = `<div class="group-title">Range ${rangeIdx++}</div>`;
        
        const wrap = document.createElement('div');
        wrap.className = 'range-preview-cards-wrap';
        
        const fromCard = await createPageCard(start);
        wrap.appendChild(fromCard);
        
        if (end > start) {
          const ellipsis = document.createElement('div');
          ellipsis.className = 'range-ellipsis';
          ellipsis.textContent = '...';
          wrap.appendChild(ellipsis);
          
          const toCard = await createPageCard(end);
          wrap.appendChild(toCard);
        }
        
        groupDiv.appendChild(wrap);
        wrapper.appendChild(groupDiv);
      }
    }
  } else if (state.activeTab === 'pages') {
    const grid = document.createElement('div');
    grid.className = 'pages-grid-select';
    
    for (let p = 1; p <= state.numPages; p++) {
      const isSelected = state.pagesSubMode === 'extract-all' || state.selectedPages.has(p);
      const card = document.createElement('div');
      card.className = `page-select-card ${isSelected ? 'selected' : ''}`;
      card.dataset.page = p;
      
      const chk = document.createElement('div');
      chk.className = 'checkbox-indicator';
      chk.innerHTML = '✓';
      
      const thumbContainer = document.createElement('div');
      thumbContainer.className = 'card-canvas-container';
      
      const canvas = await getCachedPageCanvas(p);
      thumbContainer.appendChild(cloneCanvas(canvas));
      
      const label = document.createElement('div');
      label.className = 'page-label';
      label.textContent = p;
      
      card.appendChild(chk);
      card.appendChild(thumbContainer);
      card.appendChild(label);
      
      if (state.pagesSubMode === 'select-pages') {
        card.addEventListener('click', () => {
          if (state.selectedPages.has(p)) {
            state.selectedPages.delete(p);
            card.classList.remove('selected');
          } else {
            state.selectedPages.add(p);
            card.classList.add('selected');
          }
          updateSelectPagesInputFromSet();
        });
      }
      
      grid.appendChild(card);
    }
    wrapper.appendChild(grid);
  } else if (state.activeTab === 'size') {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'range-preview-group';
    groupDiv.innerHTML = `<div class="group-title">File PDF</div>`;
    const wrap = document.createElement('div');
    wrap.className = 'range-preview-cards-wrap';
    const card = await createPageCard(1);
    wrap.appendChild(card);
    groupDiv.appendChild(wrap);
    wrapper.appendChild(groupDiv);
  }

  container.innerHTML = '';
  container.appendChild(wrapper);
}

function renderPreviewsOnlySelectStatus() {
  const cards = document.querySelectorAll('.pages-grid-select .page-select-card');
  cards.forEach(card => {
    const pageNum = parseInt(card.dataset.page);
    const isSelected = state.pagesSubMode === 'extract-all' || state.selectedPages.has(pageNum);
    if (isSelected) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });
}

function parsePagesInputToSet(str) {
  state.selectedPages.clear();
  const parts = str.split(',');
  parts.forEach(part => {
    part = part.trim();
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      if (!isNaN(a) && !isNaN(b)) {
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) {
          if (i >= 1 && i <= state.numPages) state.selectedPages.add(i);
        }
      }
    } else {
      const num = Number(part);
      if (!isNaN(num) && num >= 1 && num <= state.numPages) {
        state.selectedPages.add(num);
      }
    }
  });
}

function updateSelectPagesInputFromSet() {
  const input = document.getElementById('select-pages-input');
  if (!input) return;
  
  const sorted = Array.from(state.selectedPages).sort((a, b) => a - b);
  // Simple compress array to ranges e.g. [1, 2, 3, 5] -> "1-3, 5"
  if (sorted.length === 0) {
    input.value = '';
    return;
  }
  
  const ranges = [];
  let start = sorted[0];
  let prev = sorted[0];
  
  for (let i = 1; i <= sorted.length; i++) {
    const curr = sorted[i];
    if (curr === prev + 1) {
      prev = curr;
    } else {
      if (start === prev) {
        ranges.push(start.toString());
      } else {
        ranges.push(`${start}-${prev}`);
      }
      start = curr;
      prev = curr;
    }
  }
  input.value = ranges.join(', ');
}

async function runSplit() {
  showLoader('Memuat pdf-lib...');
  const PDFLib = await loadPdfLib();
  const JSZip  = await loadJSZip();
  hideLoader();

  let groups = []; // 0-indexed page indices per output file

  if (state.activeTab === 'range') {
    if (state.rangeSubMode === 'custom') {
      state.customRanges.forEach(rng => {
        const from = Math.min(rng.from, rng.to);
        const to   = Math.max(rng.from, rng.to);
        const pages = [];
        for (let i = from; i <= to; i++) {
          if (i >= 1 && i <= state.numPages) pages.push(i - 1);
        }
        if (pages.length > 0) groups.push(pages);
      });
    } else {
      const fixedSize = Number(document.getElementById('fixed-pages-count').value) || 2;
      for (let i = 0; i < state.numPages; i += fixedSize) {
        const pages = [];
        for (let k = 0; k < fixedSize; k++) {
          if (i + k < state.numPages) pages.push(i + k);
        }
        groups.push(pages);
      }
    }
  } else if (state.activeTab === 'pages') {
    if (state.pagesSubMode === 'extract-all') {
      for (let i = 0; i < state.numPages; i++) {
        groups.push([i]);
      }
    } else {
      const selectVal = document.getElementById('select-pages-input').value.trim();
      parsePagesInputToSet(selectVal);
      if (state.selectedPages.size === 0) {
        toast('Pilih halaman yang ingin diekstrak terlebih dahulu.', 'warning');
        return;
      }
      // If select pages: typically each selected page is extracted into a separate PDF or all selected pages in one?
      // Usually "Extract pages" converts selected pages into individual PDF files. Let's make individual PDF files for each selected page.
      const sorted = Array.from(state.selectedPages).sort((a, b) => a - b);
      sorted.forEach(p => {
        groups.push([p - 1]);
      });
    }
  } else if (state.activeTab === 'size') {
    const rawVal   = Number(document.getElementById('max-file-size').value) || (state.sizeUnit === 'kb' ? 500 : 10);
    const maxBytes = state.sizeUnit === 'kb'
      ? rawVal * 1024
      : rawVal * 1024 * 1024;
    // Estimasi jumlah halaman per file berdasarkan rata-rata ukuran per halaman
    const avgPageSize   = state.file.size / state.numPages;
    const pagesPerFile  = Math.max(1, Math.floor(maxBytes / avgPageSize));
    for (let i = 0; i < state.numPages; i += pagesPerFile) {
      const pages = [];
      for (let k = 0; k < pagesPerFile; k++) {
        if (i + k < state.numPages) pages.push(i + k);
      }
      groups.push(pages);
    }
  }

  if (groups.length === 0) {
    toast('Konfigurasi pembagian tidak menghasilkan halaman apapun.', 'error');
    return;
  }

  if (state.activeTab === 'size' && groups.length === 1) {
    const rawVal   = Number(document.getElementById('max-file-size').value) || (state.sizeUnit === 'kb' ? 500 : 10);
    const unitLabel = state.sizeUnit === 'kb' ? 'KB' : 'MB';
    toast(`Ukuran file PDF (${formatFileSize(state.file.size)}) sudah lebih kecil dari batas maksimal (${rawVal} ${unitLabel}). Tidak perlu dibagi.`, 'warning');
    return;
  }

  const shouldMergeRanges = state.activeTab === 'range' && state.rangeSubMode === 'custom' && document.getElementById('chk-merge-ranges')?.checked;
  const baseName = state.file.name.replace('.pdf', '');

  showProgress(`Membagi dokumen menjadi ${shouldMergeRanges ? 1 : groups.length} file...`);

  try {
    const srcDoc = await PDFLib.PDFDocument.load(state.buffer);
    
    if (shouldMergeRanges) {
      // Merge all groups into one PDF
      const destDoc = await PDFLib.PDFDocument.create();
      for (const group of groups) {
        const copied = await destDoc.copyPages(srcDoc, group);
        copied.forEach(p => destDoc.addPage(p));
      }
      const bytes = await destDoc.save();
      hideProgress();
      
      const finalFilename = `${baseName}_split_ranges.pdf`;
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), finalFilename);
      
      showResult({
        icon: '✅', title: 'PDF berhasil dibagi & digabungkan!',
        meta: `File diunduh secara otomatis • 1 file PDF • ${formatFileSize(bytes.byteLength)}`,
        filename: finalFilename,
        bytes,
        onReset: resetState
      });
    } else {
      // Split into multiple files packed in a ZIP
      const zip = new JSZip();
      for (let gi = 0; gi < groups.length; gi++) {
        setProgress(Math.round(((gi + 1) / groups.length) * 85), `Memproses bagian ${gi + 1} dari ${groups.length}...`);
        const destDoc = await PDFLib.PDFDocument.create();
        const copied = await destDoc.copyPages(srcDoc, groups[gi]);
        copied.forEach(p => destDoc.addPage(p));
        const bytes = await destDoc.save();
        zip.file(`${baseName}_part${gi + 1}.pdf`, bytes);
      }
      
      setProgress(90, 'Mengompresi ke format ZIP...');
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      hideProgress();
      
      const finalFilename = `${baseName}_split.zip`;
      downloadBlob(zipBlob, finalFilename);
      
      showResult({
        icon: '✅', title: `PDF berhasil dibagi menjadi ${groups.length} berkas!`,
        meta: `File ZIP diunduh secara otomatis • ${groups.length} PDF • ${formatFileSize(zipBlob.size)}`,
        filename: finalFilename,
        zipBlob,
        onReset: resetState
      });
    }
    toast('Berhasil memisahkan PDF!', 'success');
  } catch (e) {
    hideProgress();
    console.error(e);
    toast('Gagal memisahkan PDF: ' + e.message, 'error');
  }
}

function resetState() {
  state.file = null;
  state.buffer = null;
  state.numPages = 0;
  state.renderedThumbnails = [];
  document.getElementById('drop-zone').hidden = false;
  document.getElementById('tool-controls').hidden = true;
  hideResult();
}
