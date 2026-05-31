/**
 * T06 — Extract Pages
 * Ambil subset halaman dari PDF menjadi PDF baru.
 */
import { loadPdfLib, setupDropZone, readFileAsArrayBuffer, validatePdfFile,
         formatFileSize, downloadBytes, showProgress, hideProgress, setProgress,
         showResult, hideResult, toast, showLoader, hideLoader, applyTheme, loadAppHeader } from '../pdf-core.js';
import { renderThumbnails } from '../pdf-preview.js';

applyTheme();
loadAppHeader();

const state = { file: null, buffer: null, numPages: 0, selected: new Set() };

setupDropZone('drop-zone', handleFile, { accept: '.pdf', multiple: false });
document.getElementById('btn-select-all').addEventListener('click', selectAll);
document.getElementById('btn-deselect').addEventListener('click', deselectAll);
document.getElementById('btn-apply').addEventListener('click', runExtract);

// Sinkronisasi input teks -> Visual thumbnails saat diketik
document.getElementById('range-input').addEventListener('input', (e) => {
  const val = e.target.value.trim();
  state.selected.clear();
  document.querySelectorAll('.pdf-page-thumb').forEach(el => el.classList.remove('selected'));
  if (!val) return;
  try {
    const parsed = parseRange(val, state.numPages);
    parsed.forEach(idx => {
      const pageNum = idx + 1;
      state.selected.add(pageNum);
      const thumb = document.querySelector(`#pages-grid .pdf-page-thumb[data-page="${pageNum}"]`);
      if (thumb) thumb.classList.add('selected');
    });
  } catch (err) {
    // Abaikan error saat user sedang mengetik (belum selesai)
  }
});

async function handleFile(fileList) {
  const f = fileList[0];
  try { validatePdfFile(f); } catch (e) { toast(e.message, 'error'); return; }

  showLoader('Memuat pratinjau...');
  state.buffer = await readFileAsArrayBuffer(f);
  state.selected.clear();
  
  state.numPages = await renderThumbnails(state.buffer, 'pages-grid', {
    scale: 0.35, selectable: true,
    onPageClick: (pageNum, el) => {
      if (state.selected.has(pageNum)) {
        state.selected.delete(pageNum);
        el.classList.remove('selected');
      } else {
        state.selected.add(pageNum);
        el.classList.add('selected');
      }
      document.getElementById('range-input').value = pagesToRangeString(state.selected);
    },
  });

  // Auto-select halaman pertama secara default
  const firstPageEl = document.querySelector('#pages-grid .pdf-page-thumb[data-page="1"]');
  if (firstPageEl) {
    state.selected.add(1);
    firstPageEl.classList.add('selected');
    document.getElementById('range-input').value = '1';
  }

  hideLoader();

  state.file = f;
  document.getElementById('drop-zone').hidden = true;
  document.getElementById('file-info').textContent = `${f.name} • ${formatFileSize(f.size)}`;
  document.getElementById('page-count-info').textContent = `Total: ${state.numPages} halaman`;
  document.getElementById('range-input').placeholder = `mis: 1-3, 5, 7-${state.numPages}`;
  document.getElementById('tool-controls').hidden = false;
  document.getElementById('action-bar').hidden = false;
  hideResult();
}

/** Ubah Set halaman (1-indexed) -> string range "1-3, 5, 7-8" */
function pagesToRangeString(pagesSet) {
  if (pagesSet.size === 0) return '';
  const sorted = [...pagesSet].sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(', ');
}

function selectAll() {
  state.selected.clear();
  document.querySelectorAll('.pdf-page-thumb').forEach(el => {
    const p = Number(el.dataset.page);
    state.selected.add(p);
    el.classList.add('selected');
  });
  document.getElementById('range-input').value = pagesToRangeString(state.selected);
}

function deselectAll() {
  state.selected.clear();
  document.querySelectorAll('.pdf-page-thumb').forEach(el => el.classList.remove('selected'));
  document.getElementById('range-input').value = '';
}

/** Parse range string "1-3, 5, 7" → sorted unique 0-indexed array */
function parseRange(str, maxPage) {
  const pages = new Set();
  const parts = str.split(',').map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      if (isNaN(a) || isNaN(b)) throw new Error(`Range tidak valid: "${part}"`);
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) {
        if (i >= 1 && i <= maxPage) pages.add(i - 1);
      }
    } else {
      const n = Number(part);
      if (isNaN(n)) throw new Error(`Nomor halaman tidak valid: "${part}"`);
      if (n >= 1 && n <= maxPage) pages.add(n - 1);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

async function runExtract() {
  const rangeStr = document.getElementById('range-input').value.trim();
  if (!rangeStr) { toast('Masukkan range halaman yang ingin diekstrak.', 'warning'); return; }

  let indices;
  try { indices = parseRange(rangeStr, state.numPages); }
  catch (e) { toast(e.message, 'error'); return; }
  if (indices.length === 0) { toast('Tidak ada halaman valid dalam range tersebut.', 'error'); return; }

  showLoader('Memuat pdf-lib...');
  const PDFLib = await loadPdfLib();
  hideLoader();

  showProgress('Mengekstrak halaman...');
  try {
    const src  = await PDFLib.PDFDocument.load(state.buffer);
    const dest = await PDFLib.PDFDocument.create();
    const copied = await dest.copyPages(src, indices);
    copied.forEach(p => dest.addPage(p));
    setProgress(80, 'Menyimpan...');
    const bytes = await dest.save();
    hideProgress();

    const name = state.file.name.replace('.pdf', '') + '_extracted.pdf';
    downloadBytes(bytes, name);

    showResult({
      icon: '✅', title: `${indices.length} halaman diekstrak`,
      meta: formatFileSize(bytes.byteLength),
      filename: name, bytes,
      onReset: () => {
        state.file = null; state.buffer = null; state.selected.clear();
        document.getElementById('drop-zone').hidden = false;
        document.getElementById('tool-controls').hidden = true;
        document.getElementById('action-bar').hidden = true;
        document.getElementById('range-input').value = '';
        document.getElementById('pages-grid').innerHTML = '';
        hideResult();
      },
    });
    toast('Berhasil!', 'success');
  } catch (err) {
    hideProgress(); console.error(err);
    toast('Gagal: ' + err.message, 'error');
  }
}
