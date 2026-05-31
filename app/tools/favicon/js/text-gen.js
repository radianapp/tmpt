import { resizeCanvas, generateFaviconZip, generateInstallSnippet } from './favicon-core.js';

// tailwind-like gorgeous color presets
const COLOR_PRESETS = [
  '#ffffff', '#0f172a', '#3b82f6', '#1d4ed8', '#10b981', 
  '#059669', '#ef4444', '#b91c1c', '#f59e0b', '#d97706', 
  '#8b5cf6', '#6d28d9', '#ec4899', '#be185d', '#06b6d4',
  '#0891b2', '#14b8a6', '#0f766e', '#f97316', '#c2410c'
];

// DOM Elements
const textInput = document.getElementById('text-input');
const fontSelect = document.getElementById('font-select');
const fontSizeRange = document.getElementById('font-size');
const textColorInput = document.getElementById('text-color');
const textColorPresets = document.getElementById('text-color-presets');

const bgStyleSelect = document.getElementById('bg-style-select');
const bgColorControls = document.getElementById('bg-color-controls');
const bgTypeSelect = document.getElementById('bg-type-select');

const solidControls = document.getElementById('solid-controls');
const bgColorSolid = document.getElementById('bg-color-solid');
const bgColorPresets = document.getElementById('bg-color-presets');

const gradientControls = document.getElementById('gradient-controls');
const gradientColor1 = document.getElementById('gradient-color-1');
const gradientColor2 = document.getElementById('gradient-color-2');
const gradientAngle = document.getElementById('gradient-angle');

const cornerRadiusContainer = document.getElementById('corner-radius-container');
const cornerRadiusInput = document.getElementById('corner-radius');

const appNameInput = document.getElementById('app-name');
const appShortNameInput = document.getElementById('app-short-name');
const btnGenerate = document.getElementById('btn-generate');

// Previews
const sourceCanvas = document.getElementById('source-canvas');
const tabCanvasPreview = document.getElementById('tab-canvas-preview');
const phoneCanvasPreview = document.getElementById('phone-canvas-preview');
const tabTitlePreview = document.getElementById('tab-title-preview');
const phoneLabelPreview = document.getElementById('phone-label-preview');

const outputSection = document.getElementById('output-section');
const btnDownloadZip = document.getElementById('btn-download-zip');
const snippetSection = document.getElementById('snippet-section');
const snippetCode = document.getElementById('snippet-code');
const btnCopySnippet = document.getElementById('btn-copy-snippet');

const canvas16 = document.getElementById('canvas-16');
const canvas32 = document.getElementById('canvas-32');
const canvas180 = document.getElementById('canvas-180');
const canvas192 = document.getElementById('canvas-192');

// Initialize Preset Grids
function initPresetGrids() {
  COLOR_PRESETS.forEach(color => {
    // Text presets
    const btnText = document.createElement('button');
    btnText.className = 'color-preset-btn';
    btnText.style.backgroundColor = color;
    btnText.addEventListener('click', (e) => {
      e.preventDefault();
      textColorInput.value = color;
      drawSourceCanvas();
    });
    textColorPresets.appendChild(btnText);

    // Bg solid presets
    const btnBg = document.createElement('button');
    btnBg.className = 'color-preset-btn';
    btnBg.style.backgroundColor = color;
    btnBg.addEventListener('click', (e) => {
      e.preventDefault();
      bgColorSolid.value = color;
      drawSourceCanvas();
    });
    bgColorPresets.appendChild(btnBg);
  });
}

// Draw main high-res canvas (512x512)
function drawSourceCanvas() {
  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) return;

  const size = 512;
  ctx.clearRect(0, 0, size, size);

  const bgStyle = bgStyleSelect.value;
  const text = textInput.value || '';
  const font = fontSelect.value;
  const fSizePercent = parseInt(fontSizeRange.value);
  const textColor = textColorInput.value;

  // Draw Background Shape if not transparent
  if (bgStyle !== 'transparent') {
    ctx.save();
    
    // Draw path based on style
    ctx.beginPath();
    if (bgStyle === 'circle') {
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    } else if (bgStyle === 'rounded') {
      const radiusPercent = parseInt(cornerRadiusInput.value) / 100;
      const radius = size * radiusPercent;
      ctx.roundRect(0, 0, size, size, radius);
    } else {
      ctx.rect(0, 0, size, size);
    }
    ctx.closePath();

    // Clip background shape
    ctx.clip();

    // Fill background color
    const bgType = bgTypeSelect.value;
    if (bgType === 'solid') {
      ctx.fillStyle = bgColorSolid.value;
      ctx.fill();
    } else {
      // Gradient
      const color1 = gradientColor1.value;
      const color2 = gradientColor2.value;
      const angleDeg = parseInt(gradientAngle.value);
      
      // Calculate start and end coordinates of gradient based on angle
      const angleRad = (angleDeg * Math.PI) / 180;
      const x1 = size / 2 - Math.cos(angleRad) * (size / 2);
      const y1 = size / 2 - Math.sin(angleRad) * (size / 2);
      const x2 = size / 2 + Math.cos(angleRad) * (size / 2);
      const y2 = size / 2 + Math.sin(angleRad) * (size / 2);

      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, color1);
      grad.addColorStop(1, color2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
    
    ctx.restore();
  }

  // Draw Text
  if (text.length > 0) {
    ctx.save();
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Auto-fit font size based on character count and selected slider
    let finalFSize = (size * fSizePercent) / 100;
    if (text.length > 1) {
      finalFSize = finalFSize / (text.length * 0.7);
    }

    ctx.font = `bold ${finalFSize}px ${font}, sans-serif`;
    
    // Draw text in middle of canvas
    // Canvas vertical alignment baseline 'middle' works great but we can add minor offset for premium optical balance
    const opticalOffset = finalFSize * 0.02;
    ctx.fillText(text, size / 2, size / 2 + opticalOffset);
    ctx.restore();
  }

  updateLivePreviews();
}

function updateLivePreviews() {
  // 1. Browser tab mockup (16x16)
  const tabRes = resizeCanvas(sourceCanvas, 16, 16, 'contain', 'transparent');
  const tabCtx = tabCanvasPreview.getContext('2d');
  tabCtx.clearRect(0, 0, 16, 16);
  tabCtx.drawImage(tabRes, 0, 0);

  // 2. Phone home icon (180x180)
  const phoneRes = resizeCanvas(sourceCanvas, 180, 180, 'contain', 'transparent');
  const phoneCtx = phoneCanvasPreview.getContext('2d');
  phoneCtx.clearRect(0, 0, 180, 180);
  phoneCtx.drawImage(phoneRes, 0, 0);

  // Update output canvases if generated
  updateListCanvas(canvas16, 16);
  updateListCanvas(canvas32, 32);
  updateListCanvas(canvas180, 180);
  updateListCanvas(canvas192, 192);
}

function updateListCanvas(canvas, size) {
  const res = resizeCanvas(sourceCanvas, size, size, 'contain', 'transparent');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(res, 0, 0);
}

// Setup Event Listeners for Live Updates
const triggerDrawEvents = [
  textInput, fontSelect, fontSizeRange, textColorInput,
  bgStyleSelect, bgTypeSelect, bgColorSolid,
  gradientColor1, gradientColor2, gradientAngle,
  cornerRadiusInput
];

triggerDrawEvents.forEach(el => {
  el.addEventListener('input', drawSourceCanvas);
  el.addEventListener('change', drawSourceCanvas);
});

bgStyleSelect.addEventListener('change', () => {
  const style = bgStyleSelect.value;
  if (style === 'transparent') {
    bgColorControls.classList.add('hidden');
    cornerRadiusContainer.classList.add('hidden');
  } else {
    bgColorControls.classList.remove('hidden');
    if (style === 'rounded') {
      cornerRadiusContainer.classList.remove('hidden');
    } else {
      cornerRadiusContainer.classList.add('hidden');
    }
  }
  drawSourceCanvas();
});

bgTypeSelect.addEventListener('change', () => {
  const type = bgTypeSelect.value;
  if (type === 'solid') {
    solidControls.classList.remove('hidden');
    gradientControls.classList.add('hidden');
  } else {
    solidControls.classList.add('hidden');
    gradientControls.classList.remove('hidden');
  }
  drawSourceCanvas();
});

appNameInput.addEventListener('input', () => {
  tabTitlePreview.textContent = appNameInput.value || 'Pratinjau Tab';
  phoneLabelPreview.textContent = appShortNameInput.value || appNameInput.value || 'TMPT';
});
appShortNameInput.addEventListener('input', () => {
  phoneLabelPreview.textContent = appShortNameInput.value || appNameInput.value || 'TMPT';
});

btnGenerate.addEventListener('click', () => {
  // Show section
  outputSection.classList.remove('hidden');
  snippetSection.classList.remove('hidden');
  
  snippetCode.textContent = generateInstallSnippet();
  drawSourceCanvas();

  // Setup Download ZIP
  btnDownloadZip.onclick = async () => {
    if (typeof window.showLoader !== 'undefined') {
      window.showLoader('Mengunduh paket ZIP...');
    }

    try {
      const appName = appNameInput.value || 'TMPT App';
      const appShortName = appShortNameInput.value || 'TMPT';

      const zipBlob = await generateFaviconZip(sourceCanvas, 'contain', 'transparent', appName, appShortName);
      
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
        window.toast('Gagal mengunduh ZIP!', 'error');
      }
    } finally {
      if (typeof window.hideLoader !== 'undefined') {
        window.hideLoader();
      }
    }
  };

  if (typeof window.toast !== 'undefined') {
    window.toast('Paket favicon teks siap diunduh!', 'success');
  }
});

btnCopySnippet.addEventListener('click', () => {
  navigator.clipboard.writeText(snippetCode.textContent).then(() => {
    if (typeof window.toast !== 'undefined') {
      window.toast('Kode HTML berhasil disalin ke clipboard!', 'success');
    }
  }).catch(() => {
    if (typeof window.toast !== 'undefined') {
      window.toast('Gagal menyalin kode!', 'error');
    }
  });
});

// Init
initPresetGrids();
drawSourceCanvas();
