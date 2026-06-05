// app/kerja/slide/js/dashboard.js
import { initSlidesDB, getPresentations, putPresentation, deletePresentation } from './db.js';
import { TEMPLATES } from './templates.js';
import { broadcastTMPT, TMPT_EVENTS } from '/shared/broadcast.js';

let currentViewMode = localStorage.getItem('slides_view_mode') || 'grid';
let presentationsList = [];

document.addEventListener('DOMContentLoaded', async () => {
  await initSlidesDB();
  await refreshPresentations();
  initEventListeners();
});

function initEventListeners() {
  // New Presentation
  document.getElementById('new-blank-btn')?.addEventListener('click', () => createFromTemplate('blank'));
  
  // Template Gallery click
  document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      const templateName = card.dataset.template;
      createFromTemplate(templateName);
    });
  });

  // Search filter
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    renderPresentations(e.target.value);
  });

  // View switchers
  const gridBtn = document.getElementById('grid-view-btn');
  const listBtn = document.getElementById('list-view-btn');
  const container = document.getElementById('presentations-container');

  gridBtn?.addEventListener('click', () => {
    currentViewMode = 'grid';
    localStorage.setItem('slides_view_mode', 'grid');
    gridBtn.classList.add('active');
    gridBtn.classList.remove('secondary');
    listBtn.classList.remove('active');
    listBtn.classList.add('secondary');
    container.className = 'grid-view';
    renderPresentations();
  });

  listBtn?.addEventListener('click', () => {
    currentViewMode = 'list';
    localStorage.setItem('slides_view_mode', 'list');
    listBtn.classList.add('active');
    listBtn.classList.remove('secondary');
    gridBtn.classList.remove('active');
    gridBtn.classList.add('secondary');
    container.className = 'list-view';
    renderPresentations();
  });

  // Set initial view button state
  if (currentViewMode === 'list') {
    listBtn?.click();
  }

  // Import JSON Trigger
  const fileInput = document.getElementById('import-json-input');
  document.getElementById('import-json-btn')?.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data.id || !data.title || !Array.isArray(data.slides)) {
          throw new Error('Skema JSON tidak valid untuk TMPT Slides.');
        }

        // Save
        data.updated_at = new Date().toISOString();
        await putPresentation(data);
        
        broadcastTMPT(TMPT_EVENTS.FILE_CREATED, {
          id: data.id,
          type: 'slide',
          title: data.title,
          app_db: 'tmpt_slides'
        });

        if (window.TMPT_UI) window.TMPT_UI.toast('Presentasi berhasil diimpor!', 'success');
        await refreshPresentations();
      } catch (err) {
        console.error(err);
        if (window.TMPT_UI) window.TMPT_UI.toast('Format file tidak didukung: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    fileInput.value = ''; // Reset
  });
}

async function refreshPresentations() {
  try {
    presentationsList = await getPresentations() || [];
    // Sort by updated_at desc
    presentationsList.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    renderPresentations();
  } catch (err) {
    console.error('Gagal mengambil presentasi:', err);
    document.getElementById('presentations-container').innerHTML = '<div class="empty-state">Gagal memuat presentasi dari database.</div>';
  }
}

function renderPresentations(query = '') {
  const container = document.getElementById('presentations-container');
  if (!container) return;

  const filtered = presentationsList.filter(p => 
    p.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">🎞</span>
        <h3>Belum ada presentasi</h3>
        <p class="secondary">Pilih template di atas atau klik presentasi baru untuk memulai.</p>
      </div>
    `;
    return;
  }

  if (currentViewMode === 'grid') {
    container.innerHTML = filtered.map(p => {
      const slideCount = p.slides ? p.slides.length : 0;
      const dateStr = formatRelativeTime(p.updated_at);
      const thumbnailSrc = p.thumbnail || '';
      
      const thumbnailHtml = thumbnailSrc 
        ? `<img src="${thumbnailSrc}" alt="${escapeHtml(p.title)}">`
        : `<span class="pres-thumbnail-placeholder">🎞</span>`;

      return `
        <article class="pres-card" data-id="${p.id}">
          <div class="pres-thumbnail">
            ${thumbnailHtml}
          </div>
          <div class="pres-info">
            <h4 class="pres-title" title="${escapeHtml(p.title)}" onclick="window.location.href='./editor.html?id=${p.id}'">${escapeHtml(p.title)}</h4>
            <div class="pres-meta">
              <span>${slideCount} slide</span>
              <span>${dateStr}</span>
            </div>
            <div class="pres-actions">
              <button class="outline secondary" onclick="window.open('./present.html?id=${p.id}', '_blank')">▶</button>
              <button class="outline secondary" onclick="window.duplicatePres('${p.id}')" title="Duplikasi">📋</button>
              <button class="outline secondary" onclick="window.renamePres('${p.id}')" title="Ganti Nama">✏️</button>
              <button class="outline secondary" onclick="window.exportPres('${p.id}')" title="Ekspor JSON">📥</button>
              <button class="outline danger" onclick="window.deletePres('${p.id}')" title="Hapus">🗑️</button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  } else {
    container.innerHTML = `
      <div class="pres-list-wrapper" style="width: 100%;">
        ${filtered.map(p => {
          const slideCount = p.slides ? p.slides.length : 0;
          const dateStr = formatRelativeTime(p.updated_at);
          return `
            <div class="pres-row">
              <span class="pres-row-icon">🎞</span>
              <div class="pres-row-details">
                <h4 class="pres-row-title" onclick="window.location.href='./editor.html?id=${p.id}'">${escapeHtml(p.title)}</h4>
                <div class="pres-row-meta">
                  <span>${slideCount} slide</span>
                  <span>Terakhir diubah ${dateStr}</span>
                </div>
              </div>
              <div class="pres-row-actions">
                <button class="outline secondary" onclick="window.open('./present.html?id=${p.id}', '_blank')">Presentasi</button>
                <button class="outline secondary" onclick="window.duplicatePres('${p.id}')">Salin</button>
                <button class="outline secondary" onclick="window.renamePres('${p.id}')">Ubah Nama</button>
                <button class="outline secondary" onclick="window.exportPres('${p.id}')">Ekspor</button>
                <button class="outline danger" onclick="window.deletePres('${p.id}')">Hapus</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
}

async function createFromTemplate(templateName) {
  const template = TEMPLATES[templateName] || TEMPLATES.blank;
  const newId = crypto.randomUUID();
  const now = new Date().toISOString();

  const newPresentation = {
    id: newId,
    title: template.title,
    theme_id: template.theme_id,
    slides: JSON.parse(JSON.stringify(template.slides)),
    created_at: now,
    updated_at: now,
    thumbnail: '',
    slide_count: template.slides.length
  };

  await putPresentation(newPresentation);

  // Broadcast FILE_CREATED to update Berkas hub
  broadcastTMPT(TMPT_EVENTS.FILE_CREATED, {
    id: newId,
    type: 'slide',
    title: newPresentation.title,
    app_db: 'tmpt_slides'
  });

  window.location.href = `./editor.html?id=${newId}`;
}

window.renamePres = async function(id) {
  const pres = presentationsList.find(p => p.id === id);
  if (!pres) return;

  if (window.TMPT_UI) {
    const newTitle = await window.TMPT_UI.prompt('Masukkan nama baru untuk presentasi ini:', pres.title);
    if (newTitle && newTitle.trim()) {
      pres.title = newTitle.trim();
      pres.updated_at = new Date().toISOString();
      await putPresentation(pres);
      
      broadcastTMPT(TMPT_EVENTS.FILE_UPDATED, {
        id: id,
        type: 'slide',
        title: pres.title,
        updated_at: pres.updated_at
      });

      window.TMPT_UI.toast('Nama presentasi berhasil diubah.', 'success');
      await refreshPresentations();
    }
  }
};

window.duplicatePres = async function(id) {
  const pres = presentationsList.find(p => p.id === id);
  if (!pres) return;

  const now = new Date().toISOString();
  const dup = JSON.parse(JSON.stringify(pres));
  dup.id = crypto.randomUUID();
  dup.title = `Salinan ${pres.title}`;
  dup.created_at = now;
  dup.updated_at = now;

  await putPresentation(dup);

  broadcastTMPT(TMPT_EVENTS.FILE_CREATED, {
    id: dup.id,
    type: 'slide',
    title: dup.title,
    app_db: 'tmpt_slides'
  });

  if (window.TMPT_UI) window.TMPT_UI.toast('Presentasi berhasil diduplikasi.', 'success');
  await refreshPresentations();
};

window.exportPres = async function(id) {
  const pres = presentationsList.find(p => p.id === id);
  if (!pres) return;

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(pres, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `${pres.title.replace(/\s+/g, '_')}_backup.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
};

window.deletePres = async function(id) {
  const pres = presentationsList.find(p => p.id === id);
  if (!pres) return;

  if (window.TMPT_UI) {
    const confirm = await window.TMPT_UI.confirm(`Apakah Anda yakin ingin menghapus presentasi "${pres.title}"?`);
    if (confirm) {
      await deletePresentation(id);

      broadcastTMPT(TMPT_EVENTS.FILE_DELETED, {
        id: id,
        type: 'slide'
      });

      window.TMPT_UI.toast('Presentasi telah dihapus.', 'success');
      await refreshPresentations();
    }
  }
};

function formatRelativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

window.toggleSidebar = function() {};
