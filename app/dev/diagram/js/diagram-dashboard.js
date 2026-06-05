// app/dev/diagram/js/diagram-dashboard.js
import { openTmptDB, dbGetAll, dbPut, dbDelete } from '/shared/db.js';
const generateId = () => self.crypto.randomUUID();
const toast = (msg, type) => window.TMPT_UI.toast(msg, type);
const confirm = (msg, opts) => window.TMPT_UI.confirm(msg, opts);
import { broadcastTMPT as broadcastEvent, TMPT_EVENTS } from '/shared/broadcast.js';

const DB_NAME = 'tmpt_diagram';
const DB_VERSION = 2;
const STORE_NAME = 'documents';

let db;
let allDiagrams = [];

// Inisialisasi Database
async function init() {
  try {
    db = await openTmptDB(DB_NAME, DB_VERSION, (dbInstance) => {
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        const store = dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_updated', 'updated_at', { unique: false });
        store.createIndex('by_title', 'title', { unique: false });
      }
    });
    
    await loadDiagrams();
    setupEventListeners();
  } catch (err) {
    console.error('Gagal menginisialisasi database:', err);
    toast('Gagal memuat database TMPT Diagram', 'error');
  }
}

// Memuat data diagram dari IndexedDB
async function loadDiagrams() {
  allDiagrams = await dbGetAll(db, STORE_NAME);
  // Urutkan berdasarkan updated_at terbaru
  allDiagrams.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  renderDiagrams(allDiagrams);
}

// Render daftar kartu diagram
function renderDiagrams(diagrams) {
  const container = document.getElementById('diagrams-container');
  const emptyState = document.getElementById('empty-state');
  
  container.innerHTML = '';
  
  if (diagrams.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  
  diagrams.forEach(diag => {
    const card = document.createElement('article');
    card.className = 'diagram-card';
    card.style.margin = '0';
    card.style.padding = '1rem';
    card.style.borderRadius = '12px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.justifyContent = 'space-between';
    card.style.minHeight = '180px';
    card.style.border = '1px solid var(--pico-muted-border-color)';
    card.style.transition = 'transform 0.2s, box-shadow 0.2s';
    
    const formattedDate = new Date(diag.updated_at).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const moduleBadge = {
      draw: '<span class="badge" style="background:#4A90D9;color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem;">Draw</span>',
      code: '<span class="badge" style="background:#10B981;color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem;">Code</span>',
      data: '<span class="badge" style="background:#F59E0B;color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem;">Data</span>',
      arch: '<span class="badge" style="background:#8B5CF6;color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem;">Arch</span>'
    }[diag.module] || '';
    
    card.innerHTML = `
      <div style="flex-grow: 1;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <span style="font-size:1.5rem;">📊</span>
          ${moduleBadge}
        </div>
        <h6 style="margin: 0.5rem 0 0.25rem 0; font-weight: 600;">
          <a href="./editor.html?id=${diag.id}" style="text-decoration:none; color:var(--pico-heading-color);">${escapeHTML(diag.title)}</a>
        </h6>
        <p class="secondary" style="font-size: 0.72rem; margin: 0;">Terakhir diubah: ${formattedDate}</p>
        <p class="secondary" style="font-size: 0.75rem; margin-top: 0.5rem;">${diag.nodes.length} node • ${diag.edges.length} edge</p>
      </div>
      <div style="display: flex; gap: 0.5rem; margin-top: 1rem; border-top: 1px solid var(--pico-muted-border-color); padding-top: 0.75rem;">
        <a href="./editor.html?id=${diag.id}" class="button outline" style="margin-bottom:0; font-size:0.75rem; padding:0.3rem 0.6rem; flex-grow:1; text-align:center;">Buka</a>
        <button class="outline btn-export" data-id="${diag.id}" style="margin-bottom:0; font-size:0.75rem; padding:0.3rem 0.6rem;" title="Ekspor">💾</button>
        <button class="outline btn-delete" data-id="${diag.id}" style="margin-bottom:0; font-size:0.75rem; padding:0.3rem 0.6rem; border-color:#ef4444; color:#ef4444;" title="Hapus">🗑️</button>
      </div>
    `;
    
    container.appendChild(card);
  });

  // Attach dynamic handlers
  container.querySelectorAll('.btn-export').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-id');
      exportDiagram(id);
    });
  });

  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-id');
      deleteDiagram(id);
    });
  });
}

// Setup Event Listeners
function setupEventListeners() {
  const searchInput = document.getElementById('search-diagrams');
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const filtered = allDiagrams.filter(diag => 
      diag.title.toLowerCase().includes(query)
    );
    renderDiagrams(filtered);
  });

  const btnImport = document.getElementById('btn-import-diagram');
  const importInput = document.getElementById('import-file-input');

  btnImport.addEventListener('click', () => importInput.click());

  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const diagramData = JSON.parse(event.target.result);
        if (!diagramData.id || !diagramData.title || !Array.isArray(diagramData.nodes)) {
          throw new Error('Format berkas tidak valid.');
        }

        // Tanyakan apakah ingin mengimpor
        const ok = await confirm(`Impor diagram "${diagramData.title}"?`);
        if (!ok) return;

        // Generate id baru untuk menghindari konflik
        diagramData.id = generateId();
        diagramData.created_at = new Date().toISOString();
        diagramData.updated_at = new Date().toISOString();

        await dbPut(db, STORE_NAME, diagramData);
        broadcastEvent(TMPT_EVENTS.FILE_CREATED, {
          id: diagramData.id,
          type: 'diagram',
          title: diagramData.title,
          app_db: DB_NAME
        });

        toast('Diagram berhasil diimpor!', 'success');
        await loadDiagrams();
      } catch (err) {
        toast('Gagal mengimpor diagram: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    importInput.value = ''; // Reset input
  });
}

// Ekspor diagram sebagai file JSON (.diagram)
async function exportDiagram(id) {
  const diag = allDiagrams.find(d => d.id === id);
  if (!diag) return;
  
  const blob = new Blob([JSON.stringify(diag, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${diag.title.toLowerCase().replace(/\s+/g, '-')}.diagram`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Diagram berhasil diekspor!', 'success');
}

// Hapus diagram
async function deleteDiagram(id) {
  const diag = allDiagrams.find(d => d.id === id);
  if (!diag) return;

  const ok = await confirm(`Hapus diagram "${diag.title}"? Tindakan ini tidak dapat dibatalkan.`, { danger: true });
  if (!ok) return;

  try {
    await dbDelete(db, STORE_NAME, id);
    broadcastEvent(TMPT_EVENTS.FILE_DELETED, { id, type: 'diagram' });
    toast('Diagram telah dihapus', 'success');
    await loadDiagrams();
  } catch (err) {
    toast('Gagal menghapus diagram', 'error');
  }
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Run
window.addEventListener('DOMContentLoaded', init);
