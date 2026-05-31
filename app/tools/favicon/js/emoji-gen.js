import { resizeCanvas, generateFaviconZip, generateInstallSnippet } from './favicon-core.js';
import { EMOJI_DATA, EMOJI_CATEGORIES } from './emoji-data.js';

// Color presets
const COLOR_PRESETS = [
  '#f59e0b', '#0f172a', '#3b82f6', '#10b981', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16',
  '#ffffff', '#1e293b', '#1d4ed8', '#059669', '#b91c1c'
];

// DOM Elements
const emojiSearch = document.getElementById('emoji-search');
const categoryTabs = document.getElementById('emoji-category-tabs');
const emojiGrid = document.getElementById('emoji-selection-grid');
const emojiSelectedDisplay = document.getElementById('emoji-selected-display');
const emojiPaddingRange = document.getElementById('emoji-padding');

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

// State
let selectedEmoji = '🚀';
let activeCategory = 'popular';

// Initialize preset color grid for background
function initBgPresets() {
  COLOR_PRESETS.forEach(color => {
    const btn = document.createElement('button');
    btn.className = 'color-preset-btn';
    btn.style.backgroundColor = color;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      bgColorSolid.value = color;
      drawSourceCanvas();
    });
    bgColorPresets.appendChild(btn);
  });
}

// Initialize category tabs
function initCategoryTabs() {
  EMOJI_CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `emoji-tab-btn${cat.id === activeCategory ? ' active' : ''}`;
    btn.textContent = cat.name;
    btn.dataset.category = cat.id;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      activeCategory = cat.id;
      // Update active class
      document.querySelectorAll('.emoji-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      emojiSearch.value = '';
      renderEmojiGrid(EMOJI_DATA.filter(e => e.category === activeCategory));
    });
    categoryTabs.appendChild(btn);
  });
}

// Render emoji grid
function renderEmojiGrid(emojis) {
  emojiGrid.innerHTML = '';
  if (emojis.length === 0) {
    emojiGrid.innerHTML = '<p class="secondary" style="grid-column: 1/-1; text-align: center; padding: 1rem;">Emoji tidak ditemukan.</p>';
    return;
  }
  emojis.forEach(item => {
    const btn = document.createElement('button');
    btn.className = `emoji-grid-btn${item.emoji === selectedEmoji ? ' active' : ''}`;
    btn.textContent = item.emoji;
    btn.title = item.name;
    btn.setAttribute('aria-label', `Pilih emoji ${item.name}`);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      selectedEmoji = item.emoji;
      emojiSelectedDisplay.value = selectedEmoji;
      // Update active state
      document.querySelectorAll('.emoji-grid-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      drawSourceCanvas();
    });
    emojiGrid.appendChild(btn);
  });
}

// Draw main high-res canvas (512x512)
function drawSourceCanvas() {
  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) return;

  const size = 512;
  ctx.clearRect(0, 0, size, size);

  const bgStyle = bgStyleSelect.value;
  const padding = parseInt(emojiPaddingRange.value) / 100;

  // Draw Background Shape if not transparent
  if (bgStyle !== 'transparent') {
    ctx.save();
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
    ctx.clip();

    const bgType = bgTypeSelect.value;
    if (bgType === 'solid') {
      ctx.fillStyle = bgColorSolid.value;
      ctx.fill();
    } else {
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
      ctx.fill();
    }
    ctx.restore();
  }

  // Draw Emoji at center with padding
  const emoji = selectedEmoji || '🚀';
  const fontSize = size * padding;
  ctx.save();
  ctx.font = `${fontSize}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Slight vertical optical adjustment
  ctx.fillText(emoji, size / 2, size / 2 + fontSize * 0.05);
  ctx.restore();

  updateLivePreviews();
}

function updateLivePreviews() {
  const tabRes = resizeCanvas(sourceCanvas, 16, 16, 'contain', 'transparent');
  const tabCtx = tabCanvasPreview.getContext('2d');
  tabCtx.clearRect(0, 0, 16, 16);
  tabCtx.drawImage(tabRes, 0, 0);

  const phoneRes = resizeCanvas(sourceCanvas, 180, 180, 'contain', 'transparent');
  const phoneCtx = phoneCanvasPreview.getContext('2d');
  phoneCtx.clearRect(0, 0, 180, 180);
  phoneCtx.drawImage(phoneRes, 0, 0);

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

// Events
emojiSearch.addEventListener('input', () => {
  const query = emojiSearch.value.toLowerCase().trim();
  if (!query) {
    renderEmojiGrid(EMOJI_DATA.filter(e => e.category === activeCategory));
    return;
  }
  const results = EMOJI_DATA.filter(e =>
    e.name.includes(query) ||
    e.tags.some(t => t.includes(query)) ||
    e.emoji === query
  );
  renderEmojiGrid(results);
});

emojiPaddingRange.addEventListener('input', drawSourceCanvas);

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
  if (bgTypeSelect.value === 'solid') {
    solidControls.classList.remove('hidden');
    gradientControls.classList.add('hidden');
  } else {
    solidControls.classList.add('hidden');
    gradientControls.classList.remove('hidden');
  }
  drawSourceCanvas();
});

[bgColorSolid, gradientColor1, gradientColor2, gradientAngle, cornerRadiusInput].forEach(el => {
  el.addEventListener('input', drawSourceCanvas);
  el.addEventListener('change', drawSourceCanvas);
});

appNameInput.addEventListener('input', () => {
  tabTitlePreview.textContent = appNameInput.value || 'Pratinjau Tab';
  phoneLabelPreview.textContent = appShortNameInput.value || appNameInput.value || 'TMPT';
});
appShortNameInput.addEventListener('input', () => {
  phoneLabelPreview.textContent = appShortNameInput.value || appNameInput.value || 'TMPT';
});

btnGenerate.addEventListener('click', () => {
  outputSection.classList.remove('hidden');
  snippetSection.classList.remove('hidden');
  snippetCode.textContent = generateInstallSnippet();
  drawSourceCanvas();

  btnDownloadZip.onclick = async () => {
    if (typeof window.showLoader !== 'undefined') window.showLoader('Mengunduh paket ZIP...');
    try {
      const appName = appNameInput.value || 'TMPT App';
      const appShortName = appShortNameInput.value || 'TMPT';
      const zipBlob = await generateFaviconZip(sourceCanvas, 'contain', 'transparent', appName, appShortName);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `favicon_emoji_${appShortName.toLowerCase().replace(/[^a-z0-9]/g, '_')}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (typeof window.toast !== 'undefined') window.toast('Unduh ZIP berhasil!', 'success');
    } catch (err) {
      console.error(err);
      if (typeof window.toast !== 'undefined') window.toast('Gagal mengunduh ZIP!', 'error');
    } finally {
      if (typeof window.hideLoader !== 'undefined') window.hideLoader();
    }
  };

  if (typeof window.toast !== 'undefined') window.toast('Paket favicon emoji siap diunduh!', 'success');
});

btnCopySnippet.addEventListener('click', () => {
  navigator.clipboard.writeText(snippetCode.textContent).then(() => {
    if (typeof window.toast !== 'undefined') window.toast('Kode HTML berhasil disalin!', 'success');
  }).catch(() => {
    if (typeof window.toast !== 'undefined') window.toast('Gagal menyalin kode!', 'error');
  });
});

// Init
initBgPresets();
initCategoryTabs();
renderEmojiGrid(EMOJI_DATA.filter(e => e.category === 'popular'));
drawSourceCanvas();
