/**
 * T09 — Watermark PDF
 * Tambahkan teks watermark ke semua halaman PDF.
 */
import { loadPdfLib, setupDropZone, readFileAsArrayBuffer, validatePdfFile,
         formatFileSize, downloadBytes, showProgress, hideProgress, setProgress,
         showResult, hideResult, toast, showLoader, hideLoader, applyTheme, loadAppHeader } from '../pdf-core.js';

applyTheme();
loadAppHeader();

const state = { file: null, buffer: null };

setupDropZone('drop-zone', handleFile, { accept: '.pdf', multiple: false });
document.getElementById('btn-apply').addEventListener('click', runWatermark);

// Quick presets
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('wm-text').value = btn.dataset.text;
    updateWmPreview();
  });
});

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

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

async function runWatermark() {
  const text = document.getElementById('wm-text').value.trim();
  if (!text) { toast('Masukkan teks watermark.', 'warning'); return; }

  showLoader('Memuat pdf-lib...');
  const PDFLib = await loadPdfLib();
  hideLoader();
  showProgress('Menambahkan watermark...');

  try {
    const doc      = await PDFLib.PDFDocument.load(state.buffer);
    const font     = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const pages    = doc.getPages();
    const fontSize = Number(document.getElementById('wm-size').value) || 48;
    const opacity  = Number(document.getElementById('wm-opacity').value) / 100 || 0.25;
    const rotation = Number(document.getElementById('wm-rotation').value) || 45;
    const colorHex = document.getElementById('wm-color').value || '#888888';
    const { r, g, b } = hexToRgb(colorHex);
    const position = document.getElementById('wm-position').value; // 'center', 'top-left', etc.

    pages.forEach((page, idx) => {
      setProgress(Math.round(((idx + 1) / pages.length) * 90), `Halaman ${idx + 1}...`);
      const { width, height } = page.getSize();
      const textW = font.widthOfTextAtSize(text, fontSize);

      let x, y, rot;
      if (position === 'center') {
        x = (width - textW) / 2;
        y = height / 2;
        rot = PDFLib.degrees(rotation);
      } else if (position === 'top-left') {
        x = 30; y = height - fontSize - 20; rot = PDFLib.degrees(0);
      } else if (position === 'top-right') {
        x = width - textW - 30; y = height - fontSize - 20; rot = PDFLib.degrees(0);
      } else if (position === 'bottom-left') {
        x = 30; y = 20; rot = PDFLib.degrees(0);
      } else {
        x = width - textW - 30; y = 20; rot = PDFLib.degrees(0);
      }

      page.drawText(text, {
        x, y,
        size:    fontSize,
        font,
        color:   PDFLib.rgb(r, g, b),
        opacity,
        rotate:  rot,
      });
    });

    setProgress(95, 'Menyimpan...');
    const bytes = await doc.save();
    hideProgress();

    const name = state.file.name.replace('.pdf', '') + '_watermarked.pdf';
    downloadBytes(bytes, name);
    showResult({
      icon: '✅', title: 'Watermark ditambahkan!',
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

// ── Watermark Preview ─────────────────────────────────────────────────────────

function updateWmPreview() {
  const textEl  = document.getElementById('wm-text-preview');
  if (!textEl) return;

  const text     = document.getElementById('wm-text').value.trim() || 'DRAFT';
  const position = document.getElementById('wm-position').value;
  const opacity  = Number(document.getElementById('wm-opacity').value) / 100 || 0.25;
  const rotation = Number(document.getElementById('wm-rotation').value) ?? 45;
  const color    = document.getElementById('wm-color').value || '#888888';
  const size     = Number(document.getElementById('wm-size').value) || 48;

  // Update text & style
  textEl.textContent = text;
  textEl.style.color   = color;
  textEl.style.opacity = opacity;

  // Scale font: A4 width ~595pt → preview 152px content → scale ≈ 0.018rem/pt
  const scaledFs = Math.max(0.45, size * 0.018);
  textEl.style.fontSize = `${scaledFs}rem`;

  // Reset all position styles first
  textEl.style.top    = 'auto';
  textEl.style.bottom = 'auto';
  textEl.style.left   = 'auto';
  textEl.style.right  = 'auto';

  let transformBase = '';
  switch (position) {
    case 'center':
      textEl.style.top  = '50%';
      textEl.style.left = '50%';
      transformBase = 'translate(-50%, -50%)';
      break;
    case 'top-left':
      textEl.style.top  = '8px';
      textEl.style.left = '8px';
      break;
    case 'top-right':
      textEl.style.top   = '8px';
      textEl.style.right = '8px';
      break;
    case 'bottom-left':
      textEl.style.bottom = '8px';
      textEl.style.left   = '8px';
      break;
    case 'bottom-right':
      textEl.style.bottom = '8px';
      textEl.style.right  = '8px';
      break;
  }

  // Apply rotation (always, so user sees effect of rotation control)
  const deg = position === 'center' ? rotation : 0;
  textEl.style.transform = `${transformBase} rotate(${deg}deg)`.trim();
}

// Listen to all watermark controls
['wm-text', 'wm-position', 'wm-opacity', 'wm-rotation', 'wm-color', 'wm-size'].forEach(id => {
  const el = document.getElementById(id);
  if (el) { el.addEventListener('input', updateWmPreview); el.addEventListener('change', updateWmPreview); }
});

// Render preview immediately with defaults
updateWmPreview();
