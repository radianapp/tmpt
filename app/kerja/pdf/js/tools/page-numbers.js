/**
 * T08 — Add Page Numbers
 * Tambahkan nomor halaman ke PDF.
 */
import { loadPdfLib, setupDropZone, readFileAsArrayBuffer, validatePdfFile,
         formatFileSize, downloadBytes, showProgress, hideProgress, setProgress,
         showResult, hideResult, toast, showLoader, hideLoader, applyTheme, loadAppHeader } from '../pdf-core.js';

applyTheme();
loadAppHeader();

const state = { file: null, buffer: null };

setupDropZone('drop-zone', handleFile, { accept: '.pdf', multiple: false });
document.getElementById('btn-apply').addEventListener('click', runAddNumbers);

async function handleFile(fileList) {
  const f = fileList[0];
  try { validatePdfFile(f); } catch (e) { toast(e.message, 'error'); return; }
  state.file = f;
  state.buffer = await readFileAsArrayBuffer(f);
  document.getElementById('drop-zone').hidden = true;
  document.getElementById('file-info').textContent = `${f.name} • ${formatFileSize(f.size)}`;
  document.getElementById('tool-controls').hidden = false;
  document.getElementById('action-bar').hidden = false;
  hideResult();
}

async function runAddNumbers() {
  showLoader('Memuat pdf-lib...');
  const PDFLib = await loadPdfLib();
  hideLoader();
  showProgress('Menambahkan nomor halaman...');

  try {
    const doc      = await PDFLib.PDFDocument.load(state.buffer);
    const pages    = doc.getPages();
    const font     = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const position = document.getElementById('position').value;    // 'footer-center', 'header-right', etc.
    const format   = document.getElementById('format').value;      // '1', 'Halaman 1', '1 dari N', '- 1 -'
    const startNum = Number(document.getElementById('start-num').value) || 1;
    const fontSize = Number(document.getElementById('font-size').value) || 10;
    const skipFirst = document.getElementById('skip-first').checked;
    const total    = pages.length;

    pages.forEach((page, idx) => {
      if (skipFirst && idx === 0) return;
      const n = idx + startNum;
      let text;
      switch (format) {
        case 'page-of': text = `${n} dari ${total}`; break;
        case 'dash':    text = `- ${n} -`; break;
        case 'label':   text = `Halaman ${n}`; break;
        default:        text = String(n);
      }

      const { width, height } = page.getSize();
      const textW = font.widthOfTextAtSize(text, fontSize);
      const margin = 20;

      let x, y;
      if (position.startsWith('header')) {
        y = height - margin - fontSize;
      } else {
        y = margin;
      }
      if (position.endsWith('left'))   x = margin;
      else if (position.endsWith('right')) x = width - textW - margin;
      else x = (width - textW) / 2;

      page.drawText(text, { x, y, size: fontSize, font, color: PDFLib.rgb(0.3, 0.3, 0.3) });
    });

    setProgress(90, 'Menyimpan...');
    const bytes = await doc.save();
    hideProgress();

    const name = state.file.name.replace('.pdf', '') + '_numbered.pdf';
    downloadBytes(bytes, name);
    
    showResult({
      icon: '✅', title: 'Nomor halaman ditambahkan!',
      meta: formatFileSize(bytes.byteLength),
      filename: name, bytes,
      onReset: () => {
        state.file = null; state.buffer = null;
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

// ── Preview Lokasi Nomor Halaman ──────────────────────────────────────────────

function buildPreviewText() {
  const format   = document.getElementById('format').value;
  const startNum = Number(document.getElementById('start-num').value) || 1;
  switch (format) {
    case 'page-of': return `${startNum} dari N`;
    case 'dash':    return `- ${startNum} -`;
    case 'label':   return `Halaman ${startNum}`;
    default:        return String(startNum);
  }
}

function updatePreview() {
  const preview  = document.getElementById('pn-page-preview');
  const badge    = document.getElementById('pn-badge');
  if (!preview || !badge) return;

  const position = document.getElementById('position').value; // e.g. 'footer-center'
  const [valign, halign] = position.split('-');               // ['footer','center']

  preview.setAttribute('data-valign', valign);
  preview.setAttribute('data-halign', halign);

  badge.textContent = buildPreviewText();

  // Font-size feedback — scale badge font slightly
  const fs = Number(document.getElementById('font-size').value) || 10;
  badge.style.fontSize = `${Math.max(0.5, fs * 0.055)}rem`;
}

// Listen to all relevant controls
['position', 'format', 'font-size', 'start-num'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', updatePreview);
  if (el) el.addEventListener('input',  updatePreview);
});

// Render preview immediately with defaults
updatePreview();
