/**
 * TMPT PDF Tools — pdf-preview.js
 * Thumbnail rendering via PDF.js (lazy loaded)
 */

const VENDOR_PATH = '/app/kerja/pdf/vendor/pdf.min.js';
let   _pdfjs     = null;

async function getPdfJs() {
  if (_pdfjs) return _pdfjs;
  // PDF.js 4.x ships as ESM module (.mjs), load as script for global pdfjsLib
  await new Promise((resolve, reject) => {
    const script   = document.createElement('script');
    script.src     = VENDOR_PATH;
    script.type    = 'module'; // pdf.min.mjs is ES module
    script.onload  = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  // Wait a tick for the module to self-assign
  await new Promise(r => setTimeout(r, 100));
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/app/kerja/pdf/vendor/pdf.worker.min.js';
    _pdfjs = window.pdfjsLib;
  }
  return _pdfjs;
}

/**
 * Render satu halaman PDF ke <canvas>.
 * @param {ArrayBuffer} buffer  - PDF bytes
 * @param {number}      pageNum - 1-indexed
 * @param {number}      scale   - render scale (default 0.5 untuk thumbnail)
 * @returns {HTMLCanvasElement}
 */
export async function renderPageToCanvas(buffer, pageNum, scale = 0.5) {
  const pdfjsLib = await getPdfJs();
  if (!pdfjsLib) throw new Error('PDF.js tidak tersedia.');

  const pdf  = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
  const page = await pdf.getPage(pageNum);
  const vp   = page.getViewport({ scale });

  const canvas    = document.createElement('canvas');
  canvas.width    = vp.width;
  canvas.height   = vp.height;
  canvas.setAttribute('aria-label', `Halaman ${pageNum}`);

  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  return canvas;
}

/**
 * Render semua halaman PDF sebagai grid thumbnail ke kontainer DOM.
 * @param {ArrayBuffer} buffer       - PDF bytes
 * @param {string}      containerId  - ID elemen grid
 * @param {object}      opts         - { scale, onPageClick, selectable, rotations }
 * @returns {number} jumlah halaman
 */
export async function renderThumbnails(buffer, containerId, opts = {}) {
  const {
    scale       = 0.4,
    onPageClick = null,
    selectable  = false,
    rotations   = {},   // { pageNum: degrees }
  } = opts;

  const pdfjsLib = await getPdfJs();
  if (!pdfjsLib) throw new Error('PDF.js tidak tersedia.');

  const container = document.getElementById(containerId);
  if (!container) throw new Error(`Elemen #${containerId} tidak ditemukan.`);

  const pdf      = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
  const numPages = pdf.numPages;
  container.innerHTML = '';

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const rot  = rotations[i] ?? 0;
    const vp   = page.getViewport({ scale, rotation: rot });

    const canvas  = document.createElement('canvas');
    canvas.width  = vp.width;
    canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

    const thumb = document.createElement('div');
    thumb.className = 'pdf-page-thumb';
    thumb.dataset.page = i;
    thumb.setAttribute('role', selectable ? 'checkbox' : 'img');
    thumb.setAttribute('aria-label', `Halaman ${i}`);
    thumb.setAttribute('tabindex', '0');

    const numBadge = document.createElement('div');
    numBadge.className = 'page-num';
    numBadge.textContent = i;

    thumb.appendChild(canvas);
    thumb.appendChild(numBadge);

    if (rot !== 0) {
      const rotBadge = document.createElement('div');
      rotBadge.className = 'rotate-badge';
      rotBadge.textContent = `${rot}°`;
      thumb.appendChild(rotBadge);
    }

    if (onPageClick) {
      const handler = () => onPageClick(i, thumb);
      thumb.addEventListener('click', handler);
      thumb.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
      });
    }

    container.appendChild(thumb);
  }

  return numPages;
}

/**
 * Dapatkan jumlah halaman dari PDF buffer tanpa render.
 */
export async function getPageCount(buffer) {
  const pdfjsLib = await getPdfJs();
  if (!pdfjsLib) return null;
  const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
  return pdf.numPages;
}
