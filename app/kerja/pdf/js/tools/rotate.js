/**
 * T04 — Rotate PDF
 * Putar orientasi halaman PDF (90°, 180°, 270°).
 */
import { loadPdfLib, setupDropZone, readFileAsArrayBuffer, validatePdfFile,
         formatFileSize, downloadBytes, showProgress, hideProgress, setProgress,
         showResult, hideResult, toast, showLoader, hideLoader, applyTheme, loadAppHeader } from '../pdf-core.js';
import { renderThumbnails } from '../pdf-preview.js';

applyTheme();
loadAppHeader();

const state = { file: null, buffer: null, numPages: 0, rotations: {} };

setupDropZone('drop-zone', handleFile, { accept: '.pdf', multiple: false });
document.getElementById('btn-rotate-cw').addEventListener('click',  () => rotateSelected(90));
document.getElementById('btn-rotate-ccw').addEventListener('click', () => rotateSelected(-90));
document.getElementById('btn-rotate-180').addEventListener('click', () => rotateSelected(180));
document.getElementById('btn-rotate-all').addEventListener('click', rotateAll);
document.getElementById('btn-apply').addEventListener('click', runRotate);

async function handleFile(fileList) {
  const f = fileList[0];
  try { validatePdfFile(f); } catch (e) { toast(e.message, 'error'); return; }

  state.file = f;
  state.rotations = {};
  document.getElementById('drop-zone').hidden = true;
  document.getElementById('file-info').textContent = `${f.name} • ${formatFileSize(f.size)}`;

  showLoader('Memuat pratinjau...');
  state.buffer = await readFileAsArrayBuffer(f);
  state.numPages = await renderThumbnails(state.buffer, 'pages-grid', {
    scale: 0.35,
    selectable: true,
    onPageClick: (pageNum, el) => toggleSelect(pageNum, el),
    rotations: state.rotations,
  });
  
  // Auto-select halaman pertama
  const firstPageEl = document.querySelector('#pages-grid .pdf-page-thumb[data-page="1"]');
  if (firstPageEl) {
    toggleSelect(1, firstPageEl);
  }
  
  hideLoader();

  document.getElementById('tool-controls').hidden = false;
  document.getElementById('action-bar').hidden = false;
  hideResult();
}

function toggleSelect(pageNum, el) {
  el.classList.toggle('selected');
}

function getSelected() {
  return [...document.querySelectorAll('.pdf-page-thumb.selected')].map(el => Number(el.dataset.page));
}

function rotateSelected(deg) {
  const sel = getSelected();
  if (sel.length === 0) { toast('Pilih halaman terlebih dahulu.', 'warning'); return; }
  sel.forEach(p => {
    state.rotations[p] = ((state.rotations[p] ?? 0) + deg + 360) % 360;
  });
  refreshThumbnails();
}

function rotateAll() {
  for (let i = 1; i <= state.numPages; i++) {
    state.rotations[i] = ((state.rotations[i] ?? 0) + 90) % 360;
  }
  refreshThumbnails();
}

async function refreshThumbnails() {
  showLoader('Memperbarui pratinjau...');
  await renderThumbnails(state.buffer, 'pages-grid', {
    scale: 0.35, selectable: true,
    onPageClick: (p, el) => toggleSelect(p, el),
    rotations: state.rotations,
  });
  hideLoader();
}

async function runRotate() {
  const hasRotation = Object.values(state.rotations).some(r => r !== 0);
  if (!hasRotation) { toast('Belum ada rotasi yang diterapkan.', 'warning'); return; }

  showLoader('Memuat pdf-lib...');
  const PDFLib = await loadPdfLib();
  hideLoader();

  showProgress('Memutar halaman...');
  try {
    const src  = await PDFLib.PDFDocument.load(state.buffer);
    const pages = src.getPages();
    pages.forEach((page, idx) => {
      const rot = state.rotations[idx + 1] ?? 0;
      if (rot !== 0) page.setRotation(PDFLib.degrees(rot));
    });
    setProgress(80, 'Menyimpan...');
    const bytes = await src.save();
    hideProgress();

    const name = state.file.name.replace('.pdf', '') + '_rotated.pdf';
    downloadBytes(bytes, name);
    
    showResult({
      icon: '✅', title: 'PDF berhasil diputar!',
      meta: formatFileSize(bytes.byteLength),
      filename: name, bytes,
      onReset: () => { state.file = null; state.buffer = null; state.rotations = {};
        document.getElementById('drop-zone').hidden = false;
        document.getElementById('tool-controls').hidden = true;
        document.getElementById('action-bar').hidden = true;
        document.getElementById('pages-grid').innerHTML = '';
        hideResult(); },
    });
    toast('Berhasil!', 'success');
  } catch (err) {
    hideProgress(); console.error(err);
    toast('Gagal: ' + err.message, 'error');
  }
}
