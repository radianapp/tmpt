import { openTmptDB, dbGet, dbGetAll, dbPut, dbDelete } from '/shared/db.js';
import { broadcastTMPT, TMPT_EVENTS } from '/shared/broadcast.js';

const DB_NAME = 'tmpt_forms';
const DB_VERSION = 1;
const STORE_NAME = 'forms';

let db = null;

async function initDB() {
  db = await openTmptDB(DB_NAME, DB_VERSION, (database) => {
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('by_updated', 'updated_at', { unique: false });
      store.createIndex('by_title', 'title', { unique: false });
    }
    if (!database.objectStoreNames.contains('responses')) {
      const store = database.createObjectStore('responses', { keyPath: 'id' });
      store.createIndex('by_form', 'form_id', { unique: false });
      store.createIndex('by_submitted', 'submitted_at', { unique: false });
    }
  });
}

// Global functions for inline HTML events
window.createFromTemplate = async function(templateId) {
  let title = 'Formulir Baru';
  let desc = 'Deskripsi formulir Anda.';
  let questions = [];

  if (templateId === 'survey-satisfaction') {
    title = 'Survei Kepuasan Layanan';
    desc = 'Kami ingin mendengar pendapat Anda untuk menyempurnakan layanan kami.';
    questions = [
      { id: crypto.randomUUID(), type: 'text_short', label: 'Nama Lengkap', required: true, description: 'Masukkan nama Anda' },
      { id: crypto.randomUUID(), type: 'text_short', label: 'Email', required: true, description: 'Masukkan alamat email aktif' },
      { id: crypto.randomUUID(), type: 'linear_scale', label: 'Seberapa puas Anda dengan layanan kami?', required: true, min: 1, max: 5, minLabel: 'Sangat Kecewa', maxLabel: 'Sangat Puas' },
      { id: crypto.randomUUID(), type: 'choice_multiple', label: 'Layanan apa yang paling sering Anda gunakan?', required: false, options: ['Konsultasi', 'Pembelian', 'Dukungan Teknis', 'Lainnya'] },
      { id: crypto.randomUUID(), type: 'text_long', label: 'Umpan balik atau saran tambahan', required: false }
    ];
  } else if (templateId === 'event-registration') {
    title = 'Pendaftaran Kegiatan';
    desc = 'Isi formulir ini untuk mendaftarkan diri Anda pada kegiatan mendatang.';
    questions = [
      { id: crypto.randomUUID(), type: 'text_short', label: 'Nama Lengkap', required: true },
      { id: crypto.randomUUID(), type: 'text_short', label: 'Nomor Telepon', required: true, placeholder: 'Contoh: 08123456789' },
      { id: crypto.randomUUID(), type: 'dropdown', label: 'Sesi yang Ingin Diikuti', required: true, options: ['Sesi Pagi (09:00 - 12:00)', 'Sesi Siang (13:00 - 16:00)', 'Sesi Malam (19:00 - 21:00)'] },
      { id: crypto.randomUUID(), type: 'choice_single', label: 'Apakah Anda membutuhkan konsumsi vegetarian?', required: true, options: ['Ya', 'Tidak'] },
      { id: crypto.randomUUID(), type: 'date', label: 'Tanggal Kehadiran', required: true }
    ];
  } else if (templateId === 'contact-form') {
    title = 'Hubungi Kami';
    desc = 'Tinggalkan pesan Anda di bawah ini dan kami akan membalas secepatnya.';
    questions = [
      { id: crypto.randomUUID(), type: 'text_short', label: 'Nama', required: true },
      { id: crypto.randomUUID(), type: 'text_short', label: 'Email', required: true },
      { id: crypto.randomUUID(), type: 'dropdown', label: 'Topik Hubungan', required: true, options: ['Pertanyaan Umum', 'Masalah Teknis', 'Penawaran Bisnis'] },
      { id: crypto.randomUUID(), type: 'text_long', label: 'Pesan Anda', required: true }
    ];
  }

  const newForm = {
    id: crypto.randomUUID(),
    title,
    description: desc,
    questions,
    logic_rules: [],
    settings: {
      success_message: 'Terima kasih! Jawaban Anda telah diterima.',
      mode: 'classic' // classic or slide
    },
    theme: {
      color: 'blue',
      font: 'Inter'
    },
    status: 'active',
    publish_mode: 'local',
    publish_config: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await dbPut(db, STORE_NAME, newForm);
  
  // Broadcast platform creation event
  broadcastTMPT(TMPT_EVENTS.FILE_CREATED, {
    id: newForm.id,
    type: 'forms',
    title: newForm.title
  });

  window.location.href = `./builder.html?id=${newForm.id}`;
};

window.deleteForm = async function(id) {
  const confirmed = await window.showConfirmDialog('Apakah Anda yakin ingin menghapus formulir ini? Semua responses terkait juga akan dihapus.');
  if (!confirmed) return;

  await dbDelete(db, STORE_NAME, id);
  
  // Clean up responses associated with this form
  const tx = db.transaction('responses', 'readwrite');
  const store = tx.objectStore('responses');
  const index = store.index('by_form');
  const req = index.openCursor(IDBKeyRange.only(id));
  req.onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };

  broadcastTMPT(TMPT_EVENTS.FILE_DELETED, {
    id,
    type: 'forms'
  });

  if (window.TMPT_UI) {
    window.TMPT_UI.toast('Formulir berhasil dihapus.', 'success');
  }
  loadForms();
};

window.showConfirmDialog = function(message) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirm-modal');
    if (!modal) {
      resolve(confirm(message));
      return;
    }
    const msgEl = document.getElementById('confirm-message');
    if (msgEl) msgEl.textContent = message;
    
    modal._resolve = resolve;
    modal.showModal();
  });
};

async function loadForms() {
  const forms = await dbGetAll(db, STORE_NAME);
  const container = document.getElementById('forms-list-container');
  const emptyState = document.getElementById('forms-empty-state');
  const searchQuery = document.getElementById('search-forms').value.toLowerCase();

  // Get total responses count per form from DB
  const responses = await dbGetAll(db, 'responses');
  const responseCountMap = {};
  responses.forEach(r => {
    responseCountMap[r.form_id] = (responseCountMap[r.form_id] || 0) + 1;
  });

  const filteredForms = forms.filter(f => f.title.toLowerCase().includes(searchQuery) && f.status !== 'trash');

  container.innerHTML = '';

  if (filteredForms.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  } else {
    emptyState.classList.add('hidden');
  }

  filteredForms.forEach(form => {
    const respCount = responseCountMap[form.id] || 0;
    const card = document.createElement('div');
    card.className = 'form-card';
    card.innerHTML = `
      <div>
        <div class="form-card-title">${escapeHtml(form.title)}</div>
        <div class="form-card-meta">${form.questions.length} pertanyaan • ${respCount} tanggapan</div>
        <span class="form-card-status status-${form.status}">${form.status === 'active' ? '🟢 Aktif' : '⚪ Draft'}</span>
      </div>
      <div class="form-card-actions">
        <a href="./builder.html?id=${form.id}" class="button">✏️ Edit</a>
        <a href="./responses.html?id=${form.id}" class="button secondary">📊 Respons</a>
        <button onclick="deleteForm('${form.id}')" class="button outline secondary" style="color: var(--pico-danger-color); border-color: var(--pico-danger-color);">🗑️</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', async () => {
  // Check Auth
  if (window.TMPT_Auth) {
    await window.TMPT_Auth.init();
    if (!window.TMPT_Auth.isUnlocked()) {
      window.location.href = '/app/auth/login/?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
      return;
    }
  }

  await initDB();
  await loadForms();

  document.getElementById('btn-create-blank').addEventListener('click', () => {
    window.createFromTemplate('blank');
  });

  document.getElementById('search-forms').addEventListener('input', () => {
    loadForms();
  });
});
