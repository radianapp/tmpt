import { resizeCanvas, generateFaviconZip, generateInstallSnippet } from './favicon-core.js';

// Palette presets: [color1, color2, angle]
const PALETTE_PRESETS = [
  ['#3b82f6', '#1d4ed8', 135], // Blue Classic
  ['#8b5cf6', '#6d28d9', 135], // Purple Deep
  ['#10b981', '#059669', 135], // Green Fresh
  ['#f59e0b', '#d97706', 135], // Amber Warm
  ['#ef4444', '#b91c1c', 135], // Red Bold
  ['#ec4899', '#be185d', 135], // Pink Pop
  ['#06b6d4', '#0891b2', 135], // Cyan Cool
  ['#0f172a', '#334155', 135], // Dark Slate
  ['#f97316', '#ea580c', 135], // Orange Fire
  ['#6366f1', '#4338ca', 135], // Indigo
  ['#14b8a6', '#0f766e', 135], // Teal
  ['#3b82f6', '#ec4899', 135], // Blue-Pink Vibe
  ['#10b981', '#3b82f6', 135], // Green-Blue
  ['#f59e0b', '#ef4444', 135], // Gold-Red
  ['#8b5cf6', '#ec4899', 135], // Purple-Pink
];

const TEXT_COLOR_PRESETS = [
  '#ffffff', '#0f172a', '#fef9c3', '#d1fae5', '#fce7f3',
  '#dbeafe', '#ede9fe', '#fef3c7', '#ffedd5', '#f1f5f9'
];

// DOM Elements
const textInput    = document.getElementById('text-input');
const fontSelect   = document.getElementById('font-select');
const textColorInput = document.getElementById('text-color');
const textColorPresetsEl = document.getElementById('text-color-presets');

const shapeBtns    = document.querySelectorAll('.shape-btn');
const bgTypeSelect = document.getElementById('bg-type-select');

const gradientControls  = document.getElementById('gradient-controls');
const palettePresetsEl  = document.getElementById('palette-presets');
const gradientColor1    = document.getElementById('gradient-color-1');
const gradientColor2    = document.getElementById('gradient-color-2');
const gradientAngle     = document.getElementById('gradient-angle');

const solidControls    = document.getElementById('solid-controls');
const bgColorSolid     = document.getElementById('bg-color-solid');
const solidColorPresets = document.getElementById('solid-color-presets');

const shadowToggle    = document.getElementById('shadow-toggle');
const shadowControls  = document.getElementById('shadow-controls');
const shadowIntensity = document.getElementById('shadow-intensity');

const borderToggle  = document.getElementById('border-toggle');
const borderControls = document.getElementById('border-controls');
const borderColor   = document.getElementById('border-color');
const borderWidth   = document.getElementById('border-width');

const appNameInput      = document.getElementById('app-name');
const appShortNameInput = document.getElementById('app-short-name');
const btnGenerate       = document.getElementById('btn-generate');

const sourceCanvas      = document.getElementById('source-canvas');
const tabCanvasPreview  = document.getElementById('tab-canvas-preview');
const phoneCanvasPreview = document.getElementById('phone-canvas-preview');
const tabTitlePreview   = document.getElementById('tab-title-preview');
const phoneLabelPreview = document.getElementById('phone-label-preview');
const outputSection     = document.getElementById('output-section');
const btnDownloadZip    = document.getElementById('btn-download-zip');
const btnDownloadLogo   = document.getElementById('btn-download-logo');

// State
let selectedShape = 'square';

// --- Init Preset Grids ---
function initPresets() {
  // Palette presets
  PALETTE_PRESETS.forEach(([c1, c2, angle]) => {
    const btn = document.createElement('button');
    btn.className = 'color-preset-btn';
    btn.style.background = `linear-gradient(${angle}deg, ${c1}, ${c2})`;
    btn.setAttribute('aria-label', `Palet ${c1} ke ${c2}`);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      gradientColor1.value = c1;
      gradientColor2.value = c2;
      gradientAngle.value  = angle;
      drawLogo();
    });
    palettePresetsEl.appendChild(btn);
  });

  // Text color presets
  TEXT_COLOR_PRESETS.forEach(color => {
    const btn = document.createElement('button');
    btn.className = 'color-preset-btn';
    btn.style.backgroundColor = color;
    btn.style.border = color === '#ffffff' ? '1px solid #cbd5e1' : '';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      textColorInput.value = color;
      drawLogo();
    });
    textColorPresetsEl.appendChild(btn);
  });

  // Solid color presets
  ['#1d4ed8','#0f172a','#10b981','#ef4444','#8b5cf6','#f59e0b','#ec4899','#06b6d4'].forEach(color => {
    const btn = document.createElement('button');
    btn.className = 'color-preset-btn';
    btn.style.backgroundColor = color;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      bgColorSolid.value = color;
      drawLogo();
    });
    solidColorPresets.appendChild(btn);
  });
}

// --- Draw Shape Path ---
function drawShapePath(ctx, size, shape) {
  const pad = size * 0.04;
  const s   = size - pad * 2;
  const cx  = size / 2;
  const cy  = size / 2;

  ctx.beginPath();
  switch (shape) {
    case 'square':
      ctx.rect(pad, pad, s, s);
      break;
    case 'rounded':
      ctx.roundRect(pad, pad, s, s, s * 0.2);
      break;
    case 'circle':
      ctx.arc(cx, cy, s / 2, 0, Math.PI * 2);
      break;
    case 'shield': {
      // Classic shield shape
      const w = s;
      const h = s;
      const x = pad;
      const y = pad;
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h * 0.1);
      ctx.lineTo(x + w, y + h * 0.55);
      ctx.quadraticCurveTo(x + w, y + h * 0.9, x + w / 2, y + h);
      ctx.quadraticCurveTo(x, y + h * 0.9, x, y + h * 0.55);
      ctx.lineTo(x, y + h * 0.1);
      ctx.closePath();
      break;
    }
    case 'diamond': {
      const cx2 = cx;
      const cy2 = cy;
      const r   = s / 2;
      ctx.moveTo(cx2, cy2 - r);
      ctx.lineTo(cx2 + r, cy2);
      ctx.lineTo(cx2, cy2 + r);
      ctx.lineTo(cx2 - r, cy2);
      ctx.closePath();
      break;
    }
    case 'hexagon': {
      const r2 = s / 2;
      for (let i = 0; i < 6; i++) {
        const angleDeg = 60 * i - 30;
        const angleRad = (Math.PI / 180) * angleDeg;
        const px = cx + r2 * Math.cos(angleRad);
        const py = cy + r2 * Math.sin(angleRad);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    default:
      ctx.rect(pad, pad, s, s);
  }
}

// --- Draw Logo on Canvas ---
function drawLogo() {
  const ctx  = sourceCanvas.getContext('2d');
  const size = 512;
  ctx.clearRect(0, 0, size, size);

  const shape = selectedShape;

  // Drop shadow
  if (shadowToggle.checked) {
    const intensity = parseInt(shadowIntensity.value);
    ctx.shadowColor   = `rgba(0,0,0,0.45)`;
    ctx.shadowBlur    = intensity;
    ctx.shadowOffsetX = intensity * 0.3;
    ctx.shadowOffsetY = intensity * 0.5;
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur  = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // Draw Background
  ctx.save();
  drawShapePath(ctx, size, shape);
  ctx.clip();

  // Fill
  if (bgTypeSelect.value === 'gradient') {
    const angleDeg = parseInt(gradientAngle.value);
    const angleRad = (angleDeg * Math.PI) / 180;
    const x1 = size / 2 - Math.cos(angleRad) * (size / 2);
    const y1 = size / 2 - Math.sin(angleRad) * (size / 2);
    const x2 = size / 2 + Math.cos(angleRad) * (size / 2);
    const y2 = size / 2 + Math.sin(angleRad) * (size / 2);
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, gradientColor1.value);
    grad.addColorStop(1, gradientColor2.value);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = bgColorSolid.value;
  }
  ctx.fill();
  ctx.restore();

  // Reset shadow before drawing text/border
  ctx.shadowColor   = 'transparent';
  ctx.shadowBlur    = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Border
  if (borderToggle.checked) {
    ctx.save();
    drawShapePath(ctx, size, shape);
    const bw = (parseInt(borderWidth.value) / 100) * size;
    ctx.strokeStyle = borderColor.value;
    ctx.lineWidth   = bw;
    ctx.stroke();
    ctx.restore();
  }

  // Text
  const text = textInput.value || '';
  if (text) {
    const font      = fontSelect.value;
    let   fontSize  = size * 0.42;
    if (text.length === 2) fontSize = size * 0.34;
    if (text.length >= 3) fontSize = size * 0.26;

    ctx.save();
    ctx.fillStyle    = textColorInput.value;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = `bold ${fontSize}px ${font}, sans-serif`;
    ctx.fillText(text, size / 2, size / 2 + fontSize * 0.03);
    ctx.restore();
  }

  updatePreviews();
}

function updatePreviews() {
  // Tab (16x16)
  const tabRes = resizeCanvas(sourceCanvas, 16, 16, 'contain', 'transparent');
  const tabCtx = tabCanvasPreview.getContext('2d');
  tabCtx.clearRect(0, 0, 16, 16);
  tabCtx.drawImage(tabRes, 0, 0);

  // Phone (180x180)
  const phoneRes = resizeCanvas(sourceCanvas, 180, 180, 'contain', 'transparent');
  const phoneCtx = phoneCanvasPreview.getContext('2d');
  phoneCtx.clearRect(0, 0, 180, 180);
  phoneCtx.drawImage(phoneRes, 0, 0);
}

// --- Events ---
shapeBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    selectedShape = btn.dataset.shape;
    shapeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    drawLogo();
  });
});

bgTypeSelect.addEventListener('change', () => {
  if (bgTypeSelect.value === 'gradient') {
    gradientControls.classList.remove('hidden');
    solidControls.classList.add('hidden');
  } else {
    gradientControls.classList.add('hidden');
    solidControls.classList.remove('hidden');
  }
  drawLogo();
});

shadowToggle.addEventListener('change', () => {
  if (shadowToggle.checked) shadowControls.classList.remove('hidden');
  else shadowControls.classList.add('hidden');
  drawLogo();
});

borderToggle.addEventListener('change', () => {
  if (borderToggle.checked) borderControls.classList.remove('hidden');
  else borderControls.classList.add('hidden');
  drawLogo();
});

const redrawTriggers = [
  textInput, fontSelect, textColorInput,
  gradientColor1, gradientColor2, gradientAngle,
  bgColorSolid, shadowIntensity, borderColor, borderWidth
];
redrawTriggers.forEach(el => {
  el.addEventListener('input', drawLogo);
  el.addEventListener('change', drawLogo);
});

appNameInput.addEventListener('input', () => {
  tabTitlePreview.textContent  = appNameInput.value || 'Pratinjau Tab';
  phoneLabelPreview.textContent = appShortNameInput.value || appNameInput.value || 'TMPT';
});
appShortNameInput.addEventListener('input', () => {
  phoneLabelPreview.textContent = appShortNameInput.value || appNameInput.value || 'TMPT';
});

btnGenerate.addEventListener('click', () => {
  outputSection.classList.remove('hidden');
  drawLogo();

  // Download 1024x1024 logo PNG
  btnDownloadLogo.onclick = () => {
    const logo1024 = document.createElement('canvas');
    logo1024.width  = 1024;
    logo1024.height = 1024;
    const ctx = logo1024.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0, 1024, 1024);
    logo1024.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `logo_${(appShortNameInput.value || 'tmpt').toLowerCase()}_1024.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (typeof window.toast !== 'undefined') window.toast('Logo 1024px berhasil diunduh!', 'success');
    }, 'image/png');
  };

  // Download full favicon bundle
  btnDownloadZip.onclick = async () => {
    if (typeof window.showLoader !== 'undefined') window.showLoader('Memproses bundel ZIP...');
    try {
      const appName      = appNameInput.value || 'TMPT App';
      const appShortName = appShortNameInput.value || 'TMPT';
      const zipBlob      = await generateFaviconZip(sourceCanvas, 'contain', 'transparent', appName, appShortName);
      const url = URL.createObjectURL(zipBlob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `favicon_logo_${appShortName.toLowerCase().replace(/[^a-z0-9]/g, '_')}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (typeof window.toast !== 'undefined') window.toast('Bundel ZIP berhasil diunduh!', 'success');
    } catch (err) {
      console.error(err);
      if (typeof window.toast !== 'undefined') window.toast('Gagal mengunduh ZIP!', 'error');
    } finally {
      if (typeof window.hideLoader !== 'undefined') window.hideLoader();
    }
  };

  if (typeof window.toast !== 'undefined') window.toast('Logo siap diunduh!', 'success');
});

// Init
initPresets();
drawLogo();
