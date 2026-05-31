/**
 * T14 — Sign PDF (Simple)
 * Tambahkan tanda tangan ke PDF menggunakan canvas drawing.
 */
import { loadPdfLib, setupDropZone, readFileAsArrayBuffer, validatePdfFile,
         formatFileSize, downloadBytes, showProgress, hideProgress, setProgress,
         showResult, hideResult, toast, showLoader, hideLoader, applyTheme, loadAppHeader } from '../pdf-core.js';

applyTheme();
loadAppHeader();

const state = { file: null, buffer: null, sigDataUrl: null, isDrawing: false, lastX: 0, lastY: 0 };

setupDropZone('drop-zone', handleFile, { accept: '.pdf', multiple: false });
document.getElementById('btn-apply').addEventListener('click', runSign);

// ── Signature Tabs ────────────────────────────────────────────────────────────
document.querySelectorAll('.sig-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sig-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sig-panel').forEach(p => p.hidden = true);
    tab.classList.add('active');
    document.getElementById('sig-panel-' + tab.dataset.tab).hidden = false;
  });
});

// ── Canvas Drawing ────────────────────────────────────────────────────────────
const canvas = document.getElementById('sig-canvas');
const ctx    = canvas?.getContext('2d');

if (canvas && ctx) {
  ctx.strokeStyle = '#000';
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    state.isDrawing = true;
    const pos = getPos(e);
    state.lastX = pos.x; state.lastY = pos.y;
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    if (!state.isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    state.lastX = pos.x; state.lastY = pos.y;
  };

  const endDraw = () => { state.isDrawing = false; };

  canvas.addEventListener('mousedown',  startDraw);
  canvas.addEventListener('mousemove',  draw);
  canvas.addEventListener('mouseup',    endDraw);
  canvas.addEventListener('mouseleave', endDraw);
  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove',  draw,       { passive: false });
  canvas.addEventListener('touchend',   endDraw);

  document.getElementById('btn-clear-sig')?.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
}

// ── Typed Signature ───────────────────────────────────────────────────────────
document.getElementById('sig-typed-input')?.addEventListener('input', e => {
  const preview = document.getElementById('sig-typed-preview');
  if (preview) preview.textContent = e.target.value || 'Pratinjau tanda tangan';
});

function getSignatureDataUrl() {
  const activeTab = document.querySelector('.sig-tab.active')?.dataset.tab ?? 'draw';

  if (activeTab === 'draw') {
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  }

  if (activeTab === 'type') {
    const text = document.getElementById('sig-typed-input')?.value?.trim();
    if (!text) return null;
    const c   = document.createElement('canvas');
    c.width   = 400; c.height = 100;
    const cx  = c.getContext('2d');
    cx.fillStyle   = 'transparent';
    cx.font        = 'italic 48px Georgia, serif';
    cx.fillStyle   = '#000';
    cx.textBaseline = 'middle';
    cx.fillText(text, 10, 50);
    return c.toDataURL('image/png');
  }

  if (activeTab === 'upload') {
    return state.sigDataUrl;
  }
  return null;
}

// Upload signature image
document.getElementById('sig-upload-input')?.addEventListener('change', e => {
  const f = e.target.files?.[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = ev => {
    state.sigDataUrl = ev.target.result;
    const preview = document.getElementById('sig-upload-preview');
    if (preview) { preview.src = ev.target.result; preview.hidden = false; }
  };
  reader.readAsDataURL(f);
});

// ── Preview Update ───────────────────────────────────────────────────────────
const sigWInput = document.getElementById('sig-width');
const sigHInput = document.getElementById('sig-height');
const sigXInput = document.getElementById('sig-x');
const sigYInput = document.getElementById('sig-y');
const sigBadge = document.getElementById('sig-badge');

function updateSigPreview() {
  if (!sigBadge) return;
  const sigW = Number(sigWInput.value) || 150;
  const sigH = Number(sigHInput.value) || 60;
  const sigX = Number(sigXInput.value) || 0;
  const sigY = Number(sigYInput.value) || 0;

  const pdfW = state.pdfWidth || 595;
  const pdfH = state.pdfHeight || 842;

  const previewW = 180;
  const previewH = 240;

  const scaleX = previewW / pdfW;
  const scaleY = previewH / pdfH;

  const wPx = Math.max(10, sigW * scaleX);
  const hPx = Math.max(5, sigH * scaleY);
  
  const xPx = Math.min(previewW - 5, Math.max(0, sigX * scaleX));
  const yPx = Math.min(previewH - 5, Math.max(0, previewH - (sigY * scaleY) - hPx));

  sigBadge.style.width = wPx + 'px';
  sigBadge.style.height = hPx + 'px';
  sigBadge.style.left = xPx + 'px';
  sigBadge.style.top = yPx + 'px';
}

[sigWInput, sigHInput, sigXInput, sigYInput].forEach(input => {
  input?.addEventListener('input', updateSigPreview);
});

document.getElementById('sig-page')?.addEventListener('change', async () => {
  if (!state.buffer) return;
  try {
    const PDFLib = await loadPdfLib();
    const doc = await PDFLib.PDFDocument.load(state.buffer);
    const pageVal = document.getElementById('sig-page').value;
    const pageIdx = pageVal === 'last' ? doc.getPageCount() - 1 : Math.max(0, Number(pageVal) - 1);
    const page = doc.getPage(pageIdx);
    const { width, height } = page.getSize();
    state.pdfWidth = width;
    state.pdfHeight = height;
    updateSigPreview();
  } catch (err) {
    console.error(err);
  }
});

// ── File Upload ───────────────────────────────────────────────────────────────
async function handleFile(fileList) {
  const f = fileList[0];
  try { validatePdfFile(f); } catch (e) { toast(e.message, 'error'); return; }
  state.file = f;
  state.buffer = await readFileAsArrayBuffer(f);

  // Muat PDF secara dinamis untuk mendapatkan ukuran halaman & jumlah halaman
  try {
    showLoader('Membaca informasi PDF...');
    const PDFLib = await loadPdfLib();
    const doc = await PDFLib.PDFDocument.load(state.buffer);
    const pageCount = doc.getPageCount();

    const pageSel = document.getElementById('sig-page');
    if (pageSel) {
      pageSel.innerHTML = '<option value="last">Halaman terakhir</option>';
      for (let i = 1; i <= pageCount; i++) {
        pageSel.innerHTML += `<option value="${i}">Halaman ${i}</option>`;
      }
    }

    const page = doc.getPage(0);
    const { width, height } = page.getSize();
    state.pdfWidth = width;
    state.pdfHeight = height;

    const sigW = Number(sigWInput.value) || 150;
    const sigH = Number(sigHInput.value) || 60;
    
    // Set posisi default di pojok kanan bawah
    sigXInput.value = Math.round(width - sigW - 30);
    sigYInput.value = 30;

    updateSigPreview();
  } catch (err) {
    console.error(err);
  } finally {
    hideLoader();
  }

  document.getElementById('drop-zone').hidden = true;
  document.getElementById('file-info').textContent = `${f.name} • ${formatFileSize(f.size)}`;
  document.getElementById('tool-controls').hidden = false;
  document.getElementById('action-bar').hidden = false;
  hideResult();
}

// ── Run Sign ──────────────────────────────────────────────────────────────────
async function runSign() {
  const sigDataUrl = getSignatureDataUrl();
  if (!sigDataUrl || sigDataUrl === 'data:,') {
    toast('Buat tanda tangan terlebih dahulu.', 'warning'); return;
  }
  if (!state.file) { toast('Upload file PDF terlebih dahulu.', 'warning'); return; }

  showLoader('Memuat pdf-lib...');
  const PDFLib = await loadPdfLib();
  hideLoader();
  showProgress('Menambahkan tanda tangan...');

  try {
    // Convert dataURL to PNG bytes
    const resp    = await fetch(sigDataUrl);
    const sigBuf  = await resp.arrayBuffer();

    const doc     = await PDFLib.PDFDocument.load(state.buffer);
    const pngImg  = await doc.embedPng(sigBuf);

    const page    = document.getElementById('sig-page').value || 'last';
    const pageIdx = page === 'last' ? doc.getPageCount() - 1 : Math.max(0, Number(page) - 1);
    const targetPage = doc.getPage(pageIdx);
    const { width, height } = targetPage.getSize();

    const sigW   = Number(document.getElementById('sig-width').value)  || 150;
    const sigH   = Number(document.getElementById('sig-height').value) || 60;
    const posX   = Number(document.getElementById('sig-x').value)      || width  - sigW - 30;
    const posY   = Number(document.getElementById('sig-y').value)      || 30;

    setProgress(60, 'Menyematkan tanda tangan...');
    targetPage.drawImage(pngImg, { x: posX, y: posY, width: sigW, height: sigH });

    setProgress(85, 'Menyimpan...');
    const bytes = await doc.save();
    hideProgress();
    const name = state.file.name.replace('.pdf', '') + '_signed.pdf';
    downloadBytes(bytes, name);
    showResult({
      icon: '✅', title: 'Tanda tangan ditambahkan!',
      meta: formatFileSize(bytes.byteLength),
      filename: name, bytes,
      onReset: () => {
        state.file = null; state.buffer = null; state.sigDataUrl = null;
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        document.getElementById('drop-zone').hidden = false;
        document.getElementById('tool-controls').hidden = true;
        document.getElementById('action-bar').hidden = true;
        hideResult();
      },
    });
    toast('Berhasil!', 'success');
  } catch (err) {
    hideProgress(); console.error(err);
    toast('Gagal: ' + err.message, 'error');
  }
}

