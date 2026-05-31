/**
 * T07 — Organize PDF (Reorder Pages)
 * Atur ulang urutan halaman dengan drag & drop.
 */
import { loadPdfLib, loadSortable, setupDropZone, readFileAsArrayBuffer, validatePdfFile,
         formatFileSize, downloadBytes, showProgress, hideProgress, setProgress,
         showResult, hideResult, toast, showLoader, hideLoader, applyTheme, loadAppHeader } from '../pdf-core.js';
import { renderThumbnails } from '../pdf-preview.js';

applyTheme();
loadAppHeader();

const state = { file: null, buffer: null, numPages: 0, order: [] };

setupDropZone('drop-zone', handleFile, { accept: '.pdf', multiple: false });
document.getElementById('btn-apply').addEventListener('click', runOrganize);

async function handleFile(fileList) {
  const f = fileList[0];
  try { validatePdfFile(f); } catch (e) { toast(e.message, 'error'); return; }

  state.file = f;
  showLoader('Memuat pratinjau...');
  state.buffer = await readFileAsArrayBuffer(f);
  state.numPages = await renderThumbnails(state.buffer, 'pages-grid', { scale: 0.35 });
  state.order = Array.from({ length: state.numPages }, (_, i) => i); // 0-indexed

  // Init SortableJS
  const Sortable = await loadSortable();
  Sortable.create(document.getElementById('pages-grid'), {
    animation: 150,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    onEnd: () => {
      const thumbs = document.querySelectorAll('.pdf-page-thumb');
      state.order = [...thumbs].map(el => Number(el.dataset.page) - 1);
    },
  });

  hideLoader();
  document.getElementById('drop-zone').hidden = true;
  document.getElementById('file-info').textContent = `${f.name} • ${state.numPages} halaman — seret untuk mengurutkan`;
  document.getElementById('tool-controls').hidden = false;
  document.getElementById('action-bar').hidden = false;
  hideResult();
}

async function runOrganize() {
  showLoader('Memuat pdf-lib...');
  const PDFLib = await loadPdfLib();
  hideLoader();
  showProgress('Menyusun ulang halaman...');

  try {
    const src  = await PDFLib.PDFDocument.load(state.buffer);
    const dest = await PDFLib.PDFDocument.create();
    const copied = await dest.copyPages(src, state.order);
    copied.forEach(p => dest.addPage(p));
    setProgress(80, 'Menyimpan...');
    const bytes = await dest.save();
    hideProgress();

    const name = state.file.name.replace('.pdf', '') + '_organized.pdf';
    downloadBytes(bytes, name);
    
    showResult({
      icon: '✅', title: 'Halaman berhasil disusun ulang!',
      meta: formatFileSize(bytes.byteLength),
      filename: name, bytes,
      onReset: () => {
        state.file = null; state.buffer = null; state.order = [];
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
