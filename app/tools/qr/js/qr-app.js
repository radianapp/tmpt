// Main orchestrator script for TMPT QR
import { CONTENT_BUILDERS } from './content-builders.js';
import { createQR, downloadQR, renderWithFrame } from './qr-generator.js';
import { getDesignConfig, getFrameConfig, setupDesignListeners, applyTemplate, QR_TEMPLATES } from './design-panel.js';
import { saveQRToHistory, getAllQRHistory, deleteQRFromHistory, toggleFavoriteQR, getQRFromHistory } from './history.js';
import { startCameraScanner, stopCameraScanner, scanFromImage } from './qr-scanner.js';
import { detectContentType } from './content-detector.js';
import { checkQRHealth } from './health-check.js';
import { parseCSV, generateBulkQR, buildZIP } from './bulk-generator.js';
import { checkIncomingContext } from './integrations.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Global theme handling & authentication
  initGlobalFeatures();

  // Route/Page initialization based on DOM elements
  if (document.getElementById('dashboard-page')) {
    initDashboard();
  } else if (document.getElementById('generator-page')) {
    initGenerator();
  } else if (document.getElementById('scanner-page')) {
    initScanner();
  } else if (document.getElementById('bulk-page')) {
    initBulk();
  }
});

function initGlobalFeatures() {
  // Sync page theme
  const savedTheme = localStorage.getItem('tmpt_theme') || 'auto';
  applyTheme(savedTheme);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (localStorage.getItem('tmpt_theme') === 'auto') {
      applyTheme('auto');
    }
  });
}

function applyTheme(theme) {
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

// ----------------- DASHBOARD -----------------
async function initDashboard() {
  const container = document.getElementById('history-container');
  const searchInput = document.getElementById('search-qr');
  const filterSelect = document.getElementById('filter-type');
  
  let historyData = [];

  const renderHistory = () => {
    const query = searchInput.value.toLowerCase();
    const filter = filterSelect.value;

    const filtered = historyData.filter(item => {
      const matchesSearch = (item.title || '').toLowerCase().includes(query) || 
                            (item.content || '').toLowerCase().includes(query);
      const matchesFilter = filter === 'all' || item.type === filter || (filter === 'favorite' && item.is_favorite);
      return matchesSearch && matchesFilter;
    });

    if (filtered.length === 0) {
      container.innerHTML = `<p class="secondary" style="grid-column: 1/-1; text-align: center; padding: 2rem;">Tidak ada riwayat QR Code ditemukan.</p>`;
      return;
    }

    container.innerHTML = filtered.map(item => `
      <div class="qr-card" data-id="${item.id}">
        <button class="favorite-btn ${item.is_favorite ? 'starred' : ''}" aria-label="Favorit">★</button>
        <div class="qr-card-preview">
          <img src="${item.thumbnail}" alt="${item.title}">
        </div>
        <h4 class="qr-card-title">${item.title || 'Tanpa Judul'}</h4>
        <div class="qr-card-meta">
          <span class="qr-card-badge">${item.type}</span>
          <span>${new Date(item.updated_at).toLocaleDateString('id-ID')}</span>
        </div>
        <div class="qr-card-actions">
          <a href="generator.html?id=${item.id}" class="outline primary button">✏️ Edit</a>
          <button class="outline error delete-qr-btn">🗑 Hapus</button>
        </div>
      </div>
    `).join('');

    // Wire up events
    container.querySelectorAll('.qr-card').forEach(card => {
      const id = card.dataset.id;
      
      // Favorite
      card.querySelector('.favorite-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        const updated = await toggleFavoriteQR(id);
        if (updated) {
          e.target.classList.toggle('starred', updated.is_favorite);
          // Refresh list to persist sort
          loadData();
        }
      });

      // Delete
      card.querySelector('.delete-qr-btn').addEventListener('click', async (e) => {
        if (confirm('Apakah Anda yakin ingin menghapus QR Code ini dari riwayat?')) {
          await deleteQRFromHistory(id);
          loadData();
        }
      });
    });
  };

  const loadData = async () => {
    try {
      historyData = await getAllQRHistory();
      renderHistory();
    } catch (e) {
      console.error(e);
      container.innerHTML = `<p class="error" style="grid-column: 1/-1; text-align: center;">Gagal memuat riwayat.</p>`;
    }
  };

  searchInput.addEventListener('input', renderHistory);
  filterSelect.addEventListener('change', renderHistory);

  await loadData();
}

// ----------------- GENERATOR -----------------
let activeQRInstance = null;
let currentType = 'url';
let isEditMode = false;
let editId = null;

async function initGenerator() {
  const typeButtons = document.querySelectorAll('.type-btn');
  const forms = document.querySelectorAll('.type-form');
  const previewBox = document.getElementById('qr-preview-box');
  const saveBtn = document.getElementById('save-qr-btn');
  const qrTitleInput = document.getElementById('qr-title');
  const autosaveStatus = document.getElementById('save-status');

  // Load design configs
  setupDesignListeners(updatePreview);

  // Apply templates
  const templateContainer = document.getElementById('template-scroll-gallery');
  if (templateContainer) {
    templateContainer.innerHTML = QR_TEMPLATES.map(t => `
      <div class="template-item" data-template-id="${t.id}">
        <div class="template-item-preview" style="background: ${t.background_color}; color: ${t.foreground_color}; border-color: ${t.foreground_color}">QR</div>
        <span>${t.label}</span>
      </div>
    `).join('');

    templateContainer.querySelectorAll('.template-item').forEach(item => {
      item.addEventListener('click', () => {
        templateContainer.querySelectorAll('.template-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const template = QR_TEMPLATES.find(t => t.id === item.dataset.templateId);
        if (template) {
          applyTemplate(template);
          updatePreview();
        }
      });
    });
  }

  // Type Switchers
  typeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      typeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.type;

      forms.forEach(f => {
        if (f.id === `${currentType}-form`) f.classList.remove('hidden');
        else f.classList.add('hidden');
      });

      updatePreview();
    });
  });

  // Attach generic form field updates to trigger dynamic updates
  forms.forEach(form => {
    form.querySelectorAll('input, textarea, select').forEach(field => {
      field.addEventListener('input', updatePreview);
      field.addEventListener('change', updatePreview);
    });
  });

  // Handle incoming context or edit
  const incoming = checkIncomingContext();
  if (incoming && incoming.load_id) {
    // Load from DB
    isEditMode = true;
    editId = incoming.load_id;
    await loadExistingQR(editId);
  } else if (incoming) {
    // Prepopulate fields
    if (incoming.type === 'url') {
      const btn = document.querySelector(`.type-btn[data-type="url"]`);
      if (btn) btn.click();
      const urlInput = document.getElementById('url-input');
      if (urlInput) urlInput.value = incoming.data.url;
      if (qrTitleInput) qrTitleInput.value = incoming.data.title;
      updatePreview();
    }
  } else {
    // default preview
    updatePreview();
  }

  // Save QR Code button
  saveBtn.addEventListener('click', async () => {
    if (!activeQRInstance) return;
    
    autosaveStatus.textContent = 'Menyimpan...';
    try {
      const title = qrTitleInput.value.trim() || `QR Code ${currentType.toUpperCase()}`;
      const content = buildCurrentContent();
      const rawData = getRawFormData();
      const design = getDesignConfig();

      const qrData = {
        id: isEditMode ? editId : crypto.randomUUID(),
        title,
        type: currentType,
        content,
        raw_data: rawData,
        design,
        created_at: isEditMode ? undefined : new Date().toISOString()
      };

      const canvas = previewBox.querySelector('canvas');
      await saveQRToHistory(qrData, canvas);

      autosaveStatus.textContent = 'Tersimpan ✓';
      setTimeout(() => { autosaveStatus.textContent = ''; }, 3000);
      window.location.href = 'index.html';
    } catch(e) {
      console.error(e);
      autosaveStatus.textContent = 'Gagal menyimpan!';
    }
  });

  // Download Actions
  const downloadFormats = ['png', 'svg', 'webp', 'jpg', 'pdf'];
  downloadFormats.forEach(fmt => {
    const btn = document.getElementById(`download-${fmt}-btn`);
    if (btn) {
      btn.addEventListener('click', async () => {
        if (!activeQRInstance) return;
        const title = qrTitleInput.value.trim() || 'qr_code';
        const frame = getFrameConfig();
        await downloadQR(activeQRInstance, fmt, title, frame);
      });
    }
  });
}

function buildCurrentContent() {
  const data = getRawFormData();
  const builder = CONTENT_BUILDERS[currentType];
  return builder ? builder(data) : '';
}

function getRawFormData() {
  const form = document.getElementById(`${currentType}-form`);
  if (!form) return {};

  const formData = {};
  form.querySelectorAll('[name]').forEach(input => {
    const name = input.getAttribute('name');
    if (input.type === 'checkbox') {
      formData[name] = input.checked;
    } else {
      formData[name] = input.value;
    }
  });
  return formData;
}

async function loadExistingQR(id) {
  const qr = await getQRFromHistory(id);
  if (!qr) return;

  currentType = qr.type;
  
  // Set Title
  document.getElementById('qr-title').value = qr.title || '';

  // Select Type Button
  const btn = document.querySelector(`.type-btn[data-type="${currentType}"]`);
  if (btn) {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  // Show corresponding form
  document.querySelectorAll('.type-form').forEach(f => {
    if (f.id === `${currentType}-form`) f.classList.remove('hidden');
    else f.classList.add('hidden');
  });

  // Populate Form Fields
  const form = document.getElementById(`${currentType}-form`);
  if (form && qr.raw_data) {
    Object.entries(qr.raw_data).forEach(([key, val]) => {
      const input = form.querySelector(`[name="${key}"]`);
      if (input) {
        if (input.type === 'checkbox') input.checked = !!val;
        else input.value = val;
      }
    });
  }

  // Populate Design Options
  if (qr.design) {
    document.getElementById('qr-size').value = qr.design.size || 300;
    document.getElementById('error-correction').value = qr.design.ecl || 'H';
    document.getElementById('dot-style').value = qr.design.dot_style || 'square';
    document.getElementById('corner-style').value = qr.design.corner_style || 'square';
    
    document.getElementById('fg-color').value = qr.design.foreground_color || '#000000';
    document.getElementById('fg-color-hex').value = qr.design.foreground_color || '#000000';
    
    document.getElementById('bg-color').value = qr.design.background_color || '#FFFFFF';
    document.getElementById('bg-color-hex').value = qr.design.background_color || '#FFFFFF';

    if (qr.design.gradient) {
      document.getElementById('enable-gradient').checked = true;
      document.getElementById('gradient-options-pane').classList.remove('hidden');
      document.getElementById('grad-type').value = qr.design.gradient.type;
      document.getElementById('grad-color1').value = qr.design.gradient.color1;
      document.getElementById('grad-color1-hex').value = qr.design.gradient.color1;
      document.getElementById('grad-color2').value = qr.design.gradient.color2;
      document.getElementById('grad-color2-hex').value = qr.design.gradient.color2;
      document.getElementById('grad-angle').value = qr.design.gradient.angle || 0;
    }

    if (qr.design.logo) {
      const preview = document.getElementById('logo-preview');
      if (preview) {
        preview.src = qr.design.logo.data;
        preview.classList.remove('hidden');
      }
      document.getElementById('logo-size').value = qr.design.logo.size;
      document.getElementById('logo-padding').value = qr.design.logo.padding;
    }
  }

  updatePreview();
}

async function updatePreview() {
  const content = buildCurrentContent();
  const previewBox = document.getElementById('qr-preview-box');
  
  if (!content) {
    previewBox.innerHTML = `<p class="secondary">Isi formulir untuk membuat pratinjau QR Code</p>`;
    activeQRInstance = null;
    return;
  }

  const design = getDesignConfig();
  const qr = createQR(content, design);
  if (!qr) return;

  previewBox.innerHTML = '';
  activeQRInstance = qr;
  
  // Render to container (qr-code-styling appends)
  await qr.append(previewBox);

  // Apply frame preview overlay if enabled
  const frame = getFrameConfig();
  if (frame && frame.style !== 'none') {
    // Wait for the inner canvas to render
    await new Promise(resolve => setTimeout(resolve, 100));
    const canvas = previewBox.querySelector('canvas');
    if (canvas) {
      const framedCanvas = renderWithFrame(canvas, frame, design.size);
      previewBox.innerHTML = '';
      previewBox.appendChild(framedCanvas);
    }
  }
}

// ----------------- SCANNER -----------------
function initScanner() {
  const video = document.getElementById('scanner-video');
  const canvas = document.getElementById('scanner-canvas');
  const uploadInput = document.getElementById('upload-qr');
  const uploadZone = document.getElementById('upload-zone');
  const resultBox = document.getElementById('scanner-result-box');
  const resultContent = document.getElementById('scan-result-content');
  const resultMeta = document.getElementById('scan-result-meta');

  const openUrlBtn = document.getElementById('scan-open-url');
  const copyBtn = document.getElementById('scan-copy');
  const recreateBtn = document.getElementById('scan-recreate');
  
  const cameraTab = document.getElementById('tab-camera');
  const uploadTab = document.getElementById('tab-upload');
  const cameraSection = document.getElementById('scanner-camera-section');
  const uploadSection = document.getElementById('scanner-upload-section');

  let scannedData = '';

  const displayResult = async (data) => {
    scannedData = data;
    resultBox.classList.remove('hidden');
    resultContent.textContent = data;

    // Detect type
    const parsed = detectContentType(data);
    resultMeta.innerHTML = `<strong>Tipe Terdeteksi:</strong> ${parsed.type.toUpperCase()}`;

    // Enable/disable open URL
    if (parsed.type === 'url') {
      openUrlBtn.classList.remove('hidden');
      openUrlBtn.href = parsed.data.url;
      
      // Health Check
      resultMeta.innerHTML += ` (Memeriksa status URL...)`;
      const health = await checkQRHealth(parsed.data.url);
      if (health.is_url) {
        if (health.reachable) {
          resultMeta.innerHTML = `<strong>Tipe Terdeteksi:</strong> URL (Status: Valid/Dapat diakses)`;
        } else {
          resultMeta.innerHTML = `<strong>Tipe Terdeteksi:</strong> URL <span style="color: var(--pico-color-red);">(Peringatan: Tidak dapat diakses - ${health.error_message})</span>`;
        }
      }
    } else {
      openUrlBtn.classList.add('hidden');
    }

    // Action button listeners
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(data);
      alert('Berhasil menyalin konten ke clipboard!');
    };

    recreateBtn.onclick = () => {
      window.location.href = `generator.html?context=scanner&url=${encodeURIComponent(data)}`;
    };
  };

  // Tab switcher
  cameraTab.onclick = () => {
    cameraTab.classList.add('active');
    uploadTab.classList.remove('active');
    cameraSection.classList.remove('hidden');
    uploadSection.classList.add('hidden');
    startCameraScanner(video, canvas, displayResult, (err) => alert(err));
  };

  uploadTab.onclick = () => {
    uploadTab.classList.add('active');
    cameraTab.classList.remove('active');
    uploadSection.classList.remove('hidden');
    cameraSection.classList.add('hidden');
    stopCameraScanner();
  };

  // Camera start by default
  startCameraScanner(video, canvas, displayResult, (err) => alert(err));

  // File Upload Handling
  uploadZone.onclick = () => uploadInput.click();
  uploadInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      scanFromImage(file, displayResult, (err) => alert(err));
    }
  };
}

// ----------------- BULK -----------------
function initBulk() {
  const uploadZone = document.getElementById('bulk-upload-zone');
  const fileInput = document.getElementById('bulk-file');
  const previewZone = document.getElementById('bulk-preview-container');
  const previewList = document.getElementById('bulk-preview-list');
  const previewCountText = document.getElementById('bulk-preview-count');
  
  const generateBtn = document.getElementById('generate-bulk-btn');
  const progressPane = document.getElementById('bulk-progress-pane');
  const progressText = document.getElementById('bulk-progress-text');
  const progressIndicator = document.getElementById('bulk-progress-indicator');
  const downloadZipBtn = document.getElementById('download-zip-btn');

  let bulkRows = [];
  let zipBlob = null;

  uploadZone.onclick = () => fileInput.click();
  
  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        bulkRows = await parseCSV(file);
        if (bulkRows.length === 0) {
          alert('File CSV kosong.');
          return;
        }

        previewZone.classList.remove('hidden');
        generateBtn.removeAttribute('disabled');
        previewCountText.textContent = `Menemukan ${bulkRows.length} baris data.`;

        // Render preview (first 5 items)
        const keys = Object.keys(bulkRows[0]);
        const contentCol = keys.find(k => ['content', 'url', 'data', 'link', 'text'].includes(k.toLowerCase()));
        
        previewList.innerHTML = bulkRows.slice(0, 5).map((row, idx) => {
          const content = row[contentCol] || '';
          const title = row.title || row.name || `QR ${idx + 1}`;
          return `<div class="bulk-preview-item"><strong>${title}</strong>: ${content}</div>`;
        }).join('');

        if (bulkRows.length > 5) {
          previewList.innerHTML += `<div class="bulk-preview-item secondary">...dan ${bulkRows.length - 5} baris lainnya.</div>`;
        }
      } catch(err) {
        alert('Gagal memproses file CSV: ' + err.message);
      }
    }
  };

  generateBtn.onclick = async () => {
    if (bulkRows.length === 0) return;

    generateBtn.setAttribute('disabled', true);
    progressPane.classList.remove('hidden');
    downloadZipBtn.classList.add('hidden');

    try {
      const design = getDesignConfig();
      design.format = document.getElementById('bulk-format').value || 'png';

      const results = await generateBulkQR(bulkRows, design, (current, total) => {
        const pct = Math.round((current / total) * 100);
        progressText.textContent = `Memproses: ${current}/${total} QR (${pct}%)`;
        progressIndicator.value = pct;
      });

      progressText.textContent = 'Mengompresi berkas ZIP...';
      zipBlob = await buildZIP(results, design.format);

      progressText.textContent = 'Selesai! Berkas ZIP siap diunduh.';
      downloadZipBtn.classList.remove('hidden');
    } catch(err) {
      alert('Gagal saat memproses Bulk QR: ' + err.message);
      generateBtn.removeAttribute('disabled');
    }
  };

  downloadZipBtn.onclick = () => {
    if (zipBlob) {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `tmpt_qr_bulk_${Date.now()}.zip`;
      link.click();
    }
  };
}
