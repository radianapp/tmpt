/**
 * T13 — PDF to JPG
 * Konversi setiap halaman PDF menjadi gambar JPG dan zip.
 */
import { loadJSZip, setupDropZone, readFileAsArrayBuffer, validatePdfFile,
         formatFileSize, downloadBlob, showProgress, hideProgress, setProgress,
         showResult, hideResult, toast, showLoader, hideLoader, applyTheme, loadAppHeader } from '../pdf-core.js';

applyTheme();
loadAppHeader();

const state = { file: null, buffer: null };
const DPI_SCALE = { '72': 1.0, '150': 2.08, '300': 4.17 };

setupDropZone('drop-zone', handleFile, { accept: '.pdf', multiple: false });
document.getElementById('btn-apply').addEventListener('click', runConvert);

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

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/app/kerja/pdf/vendor/pdf.min.js';
    s.type = 'module'; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  await new Promise(r => setTimeout(r, 150));
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/app/kerja/pdf/vendor/pdf.worker.min.js';
  }
  return window.pdfjsLib;
}

async function runConvert() {
  const format  = document.getElementById('img-format').value || 'jpeg';
  const dpi     = document.getElementById('img-dpi').value || '150';
  const scale   = DPI_SCALE[dpi] ?? 2.08;
  const quality = format === 'jpeg' ? 0.92 : 1.0;

  showLoader('Memuat PDF.js...');
  const pdfjsLib = await loadPdfJs();
  if (!pdfjsLib) { hideLoader(); toast('PDF.js gagal dimuat.', 'error'); return; }
  hideLoader();

  showProgress('Merender halaman...');
  try {
    const pdf      = await pdfjsLib.getDocument({ data: state.buffer.slice(0) }).promise;
    const numPages = pdf.numPages;
    const JSZip    = await loadJSZip();
    const zip      = new JSZip();
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const ext      = format === 'png' ? 'png' : 'jpg';
    const baseName = state.file.name.replace('.pdf', '');

    for (let i = 1; i <= numPages; i++) {
      setProgress(Math.round((i / numPages) * 90), `Merender halaman ${i} dari ${numPages}...`);
      const page = await pdf.getPage(i);
      const vp   = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width  = vp.width;
      canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      const blob = await new Promise(res => canvas.toBlob(res, mimeType, quality));
      const buf  = await blob.arrayBuffer();
      zip.file(`${baseName}_halaman${String(i).padStart(3, '0')}.${ext}`, buf);
    }

    setProgress(95, 'Membuat ZIP...');
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    hideProgress();

    downloadBlob(zipBlob, `${baseName}_images.zip`);
    showResult({
      icon: '✅', title: `${numPages} halaman dikonversi ke ${ext.toUpperCase()}`,
      meta: formatFileSize(zipBlob.size),
      filename: `${baseName}_images.zip`, zipBlob,
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
