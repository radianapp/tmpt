import { resizeCanvas, generateFaviconZip, generateInstallSnippet } from './favicon-core.js';

// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const btnSelectFile = document.getElementById('btn-select-file');
const fitModeSelect = document.getElementById('fit-mode');
const bgTypeSelect = document.getElementById('bg-type');
const customColorContainer = document.getElementById('custom-color-container');
const customBgColor = document.getElementById('custom-bg-color');
const appNameInput = document.getElementById('app-name');
const appShortNameInput = document.getElementById('app-short-name');
const btnGenerate = document.getElementById('btn-generate');
const outputSection = document.getElementById('output-section');
const btnDownloadZip = document.getElementById('btn-download-zip');
const snippetSection = document.getElementById('snippet-section');
const snippetCode = document.getElementById('snippet-code');
const btnCopySnippet = document.getElementById('btn-copy-snippet');

// Live Preview Canvases
const tabCanvasPreview = document.getElementById('tab-canvas-preview');
const phoneCanvasPreview = document.getElementById('phone-canvas-preview');
const tabTitlePreview = document.getElementById('tab-title-preview');
const phoneLabelPreview = document.getElementById('phone-label-preview');

// List Previews
const canvas16 = document.getElementById('canvas-16');
const canvas32 = document.getElementById('canvas-32');
const canvas180 = document.getElementById('canvas-180');
const canvas192 = document.getElementById('canvas-192');

// Core state
let sourceImage = null; // HTMLImageElement
let sourceCanvas = null; // High-res source canvas

// Setup listeners
btnSelectFile.addEventListener('click', (e) => {
  e.preventDefault();
  fileInput.click();
});

fileInput.addEventListener('change', handleFileSelect);

// Drag & drop events
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    processFile(files[0]);
  }
});

// Settings events
fitModeSelect.addEventListener('change', updatePreviews);
bgTypeSelect.addEventListener('change', () => {
  if (bgTypeSelect.value === 'custom') {
    customColorContainer.classList.remove('hidden');
  } else {
    customColorContainer.classList.add('hidden');
  }
  updatePreviews();
});
customBgColor.addEventListener('input', updatePreviews);
appNameInput.addEventListener('input', () => {
  tabTitlePreview.textContent = appNameInput.value || 'Pratinjau Tab';
  phoneLabelPreview.textContent = appShortNameInput.value || appNameInput.value || 'TMPT';
});
appShortNameInput.addEventListener('input', () => {
  phoneLabelPreview.textContent = appShortNameInput.value || appNameInput.value || 'TMPT';
});

btnGenerate.addEventListener('click', generateFavicon);

function handleFileSelect(e) {
  const files = e.target.files;
  if (files.length > 0) {
    processFile(files[0]);
  }
}

function processFile(file) {
  if (!file.type.startsWith('image/')) {
    if (typeof window.toast !== 'undefined') {
      window.toast('Berkas harus berupa gambar (PNG, JPG, WebP, SVG)!', 'error');
    } else {
      alert('Berkas harus berupa gambar!');
    }
    return;
  }

  if (file.size > 50 * 1024 * 1024) {
    if (typeof window.toast !== 'undefined') {
      window.toast('Ukuran berkas melebihi 50MB!', 'error');
    } else {
      alert('Ukuran berkas melebihi 50MB!');
    }
    return;
  }

  const reader = new FileReader();
  reader.onload = function(event) {
    sourceImage = new Image();
    sourceImage.onload = function() {
      // Create high-res source canvas
      sourceCanvas = document.createElement('canvas');
      
      // Limit resolution to max 2048px to save memory and performance
      const maxDim = 2048;
      let w = sourceImage.width;
      let h = sourceImage.height;
      
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      sourceCanvas.width = w;
      sourceCanvas.height = h;
      const ctx = sourceCanvas.getContext('2d');
      ctx.drawImage(sourceImage, 0, 0, w, h);

      // Enable generate button
      btnGenerate.removeAttribute('disabled');
      
      // Update label previews
      tabTitlePreview.textContent = appNameInput.value || 'Pratinjau Tab';
      phoneLabelPreview.textContent = appShortNameInput.value || 'TMPT';

      updatePreviews();
      if (typeof window.toast !== 'undefined') {
        window.toast('Gambar berhasil diunggah! Tekan tombol "Buat Paket Favicon" di bawah.', 'success');
      }
    };
    sourceImage.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function getBackgroundColor() {
  const bgType = bgTypeSelect.value;
  if (bgType === 'transparent') return 'transparent';
  if (bgType === 'white') return '#ffffff';
  if (bgType === 'black') return '#000000';
  if (bgType === 'custom') return customBgColor.value;
  return 'transparent';
}

function updatePreviews() {
  if (!sourceCanvas) return;

  const fitMode = fitModeSelect.value;
  const bg = getBackgroundColor();

  // 1. Browser tab (16x16)
  const tabRes = resizeCanvas(sourceCanvas, 16, 16, fitMode, bg);
  const tabCtx = tabCanvasPreview.getContext('2d');
  tabCtx.clearRect(0, 0, 16, 16);
  tabCtx.drawImage(tabRes, 0, 0);

  // 2. Phone home icon (180x180)
  const phoneRes = resizeCanvas(sourceCanvas, 180, 180, fitMode, bg);
  const phoneCtx = phoneCanvasPreview.getContext('2d');
  phoneCtx.clearRect(0, 0, 180, 180);
  phoneCtx.drawImage(phoneRes, 0, 0);

  // 3. Update list preview canvases if outputs already generated
  updateListCanvas(canvas16, 16);
  updateListCanvas(canvas32, 32);
  updateListCanvas(canvas180, 180);
  updateListCanvas(canvas192, 192);
}

function updateListCanvas(canvas, size) {
  if (!sourceCanvas) return;
  const fitMode = fitModeSelect.value;
  const bg = getBackgroundColor();
  const res = resizeCanvas(sourceCanvas, size, size, fitMode, bg);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(res, 0, 0);
}

async function generateFavicon() {
  if (!sourceCanvas) return;

  if (typeof window.showLoader !== 'undefined') {
    window.showLoader('Sedang membuat paket favicon...');
  }

  try {
    const fitMode = fitModeSelect.value;
    const bg = getBackgroundColor();
    const appName = appNameInput.value || 'TMPT App';
    const appShortName = appShortNameInput.value || 'TMPT';

    // Update list preview canvases visually
    updatePreviews();

    // Show output sections
    outputSection.classList.remove('hidden');
    snippetSection.classList.remove('hidden');

    // Populate install snippet
    snippetCode.textContent = generateInstallSnippet();

    // Prepare ZIP download handler
    btnDownloadZip.onclick = async () => {
      try {
        if (typeof window.showLoader !== 'undefined') {
          window.showLoader('Mengompres berkas ke ZIP...');
        }
        
        const zipBlob = await generateFaviconZip(sourceCanvas, fitMode, bg, appName, appShortName);
        
        // Trigger download
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `favicon_${appShortName.toLowerCase().replace(/[^a-z0-9]/g, '_')}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (typeof window.toast !== 'undefined') {
          window.toast('Unduh ZIP berhasil dimulai!', 'success');
        }
      } catch (err) {
        console.error(err);
        if (typeof window.toast !== 'undefined') {
          window.toast('Gagal membuat bundel ZIP!', 'error');
        }
      } finally {
        if (typeof window.hideLoader !== 'undefined') {
          window.hideLoader();
        }
      }
    };

    if (typeof window.toast !== 'undefined') {
      window.toast('Paket favicon siap diunduh!', 'success');
    }
  } catch (err) {
    console.error(err);
    if (typeof window.toast !== 'undefined') {
      window.toast('Gagal memproses gambar!', 'error');
    }
  } finally {
    if (typeof window.hideLoader !== 'undefined') {
      window.hideLoader();
    }
  }
}

// Copy HTML Snippet handler
btnCopySnippet.addEventListener('click', () => {
  navigator.clipboard.writeText(snippetCode.textContent).then(() => {
    if (typeof window.toast !== 'undefined') {
      window.toast('Kode HTML berhasil disalin ke clipboard!', 'success');
    } else {
      alert('Kode HTML berhasil disalin!');
    }
  }).catch(() => {
    if (typeof window.toast !== 'undefined') {
      window.toast('Gagal menyalin kode!', 'error');
    }
  });
});
