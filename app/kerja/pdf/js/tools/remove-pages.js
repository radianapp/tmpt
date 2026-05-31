/**
 * T05 — Remove Pages
 * Hapus halaman tertentu dari PDF.
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
document.getElementById('btn-apply').addEventListener('click', runRemove);

async function handleFile(fileList) {
  const f = fileList[0];
  try { validatePdfFile(f); } catch (e) { toast(e.message, 'error'); return; }

  state.file = f;
  state.selected.clear();

  showLoader('Memuat pratinjau...');
  state.buffer = await readFileAsArrayBuffer(f);
  state.numPages = await renderThumbnails(state.buffer, 'pages-grid', {
    scale: 0.35, selectable: true,
    onPageClick: (pageNum, el) => {
      if (state.selected.has(pageNum)) { state.selected.delete(pageNum); el.classList.remove('selected'); }
      else { state.selected.add(pageNum); el.classList.add('selected'); }
      updateSelectionLabel();
    },
  });
  hideLoader();

  document.getElementById('drop-zone').hidden = true;
  document.getElementById('file-info').textContent = `${f.name} • ${formatFileSize(f.size)} • ${state.numPages} halaman`;
  document.getElementById('tool-controls').hidden = false;
  document.getElementById('action-bar').hidden = false;
  hideResult();
}

function updateSelectionLabel() {
  document.getElementById('selection-label').textContent =
    state.selected.size > 0 ? `${state.selected.size} halaman dipilih` : '';
}

function selectAll() {
  document.querySelectorAll('.pdf-page-thumb').forEach(el => {
    const p = Number(el.dataset.page);
    state.selected.add(p);
    el.classList.add('selected');
  });
  updateSelectionLabel();
}

function deselectAll() {
  state.selected.clear();
  document.querySelectorAll('.pdf-page-thumb').forEach(el => el.classList.remove('selected'));
  updateSelectionLabel();
}

async function runRemove() {
  if (state.selected.size === 0) { toast('Pilih halaman yang ingin dihapus.', 'warning'); return; }
  if (state.selected.size >= state.numPages) { toast('Tidak bisa menghapus semua halaman.', 'error'); return; }

  showLoader('Memuat pdf-lib...');
  const PDFLib = await loadPdfLib();
  hideLoader();

  showProgress('Menghapus halaman...');
  try {
    const src = await PDFLib.PDFDocument.load(state.buffer);
    // Hapus dari belakang agar index tidak bergeser
    const toRemove = [...state.selected].sort((a, b) => b - a);
    toRemove.forEach(p => src.removePage(p - 1));

    setProgress(80, 'Menyimpan...');
    const bytes = await src.save();
    hideProgress();

    const remaining = state.numPages - state.selected.size;
    const name = state.file.name.replace('.pdf', '') + '_removed.pdf';
    downloadBytes(bytes, name);
    
    showResult({
      icon: '✅', title: `${state.selected.size} halaman dihapus`,
      meta: `Sisa ${remaining} halaman • ${formatFileSize(bytes.byteLength)}`,
      filename: name, bytes,
      onReset: () => {
        state.file = null; state.buffer = null; state.selected.clear();
        document.getElementById('drop-zone').hidden = false;
        document.getElementById('tool-controls').hidden = true;
        document.getElementById('action-bar').hidden = true;
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
