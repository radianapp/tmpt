// app/kerja/forms/responses.js
import { openTmptDB, dbGet, dbGetAll, dbDelete } from '/shared/db.js';
import { getAppBridgeContext } from '/shared/app-bridge.js';

const DB_NAME = 'tmpt_forms';
const DB_VERSION = 2;

let db = null;
let formId = null;
let formData = null;
let responses = [];

async function init() {
  if (window.TMPT_Auth) {
    await window.TMPT_Auth.init();
    if (!window.TMPT_Auth.isUnlocked()) {
      window.location.href = '/app/auth/login/?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
      return;
    }
  }

  const context = getAppBridgeContext();
  formId = context.id;

  if (!formId) {
    alert('Formulir tidak valid.');
    window.location.href = './index.html';
    return;
  }

  db = await openTmptDB(DB_NAME, DB_VERSION, (database) => {
    if (!database.objectStoreNames.contains('forms')) {
      const store = database.createObjectStore('forms', { keyPath: 'id' });
      store.createIndex('by_updated', 'updated_at', { unique: false });
      store.createIndex('by_title', 'title', { unique: false });
    }
    if (!database.objectStoreNames.contains('responses')) {
      const store = database.createObjectStore('responses', { keyPath: 'id' });
      store.createIndex('by_form', 'form_id', { unique: false });
      store.createIndex('by_submitted', 'submitted_at', { unique: false });
    }
  });
  formData = await dbGet(db, 'forms', formId);

  if (!formData) {
    alert('Formulir tidak ditemukan.');
    window.location.href = './index.html';
    return;
  }

  document.getElementById('responses-form-title').textContent = `Respons: ${formData.title}`;
  document.body.setAttribute('data-form-theme', formData.theme.color || 'blue');

  await loadResponses();
  setupTabs();
  setupActions();
}

async function loadResponses() {
  const allResponses = await dbGetAll(db, 'responses');
  responses = allResponses.filter(r => r.form_id === formId);

  // Sort by date descending
  responses.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

  document.getElementById('responses-count-badge').textContent = responses.length;

  renderSummary();
  renderIndividual();
}

function renderSummary() {
  const container = document.getElementById('summary-view-content');
  container.innerHTML = '';

  if (responses.length === 0) {
    container.innerHTML = `
      <div class="tmpt-empty-state" style="text-align: center; padding: 3rem 1rem;">
        <span style="font-size: 3rem;">📊</span>
        <h3>Belum ada respons</h3>
        <p class="secondary">Bagikan formulir ini agar responden dapat mulai mengisi data.</p>
      </div>
    `;
    return;
  }

  formData.questions.forEach(q => {
    const card = document.createElement('div');
    card.className = 'analytics-card';
    
    const cardTitle = document.createElement('div');
    cardTitle.className = 'analytics-card-title';
    cardTitle.textContent = q.label;
    card.appendChild(cardTitle);

    // Aggregate answers for this question
    const answersList = responses.map(r => r.answers[q.id]).filter(val => val !== undefined && val !== null && val !== '');

    if (answersList.length === 0) {
      card.appendChild(document.createTextNode('Belum ada jawaban untuk pertanyaan ini.'));
      container.appendChild(card);
      return;
    }

    if (['choice_single', 'choice_multiple', 'dropdown'].includes(q.type)) {
      // Bar Chart for choices
      const counts = {};
      (q.options || []).forEach(opt => counts[opt] = 0);
      
      answersList.forEach(ans => {
        if (Array.isArray(ans)) {
          ans.forEach(val => counts[val] = (counts[val] || 0) + 1);
        } else {
          counts[ans] = (counts[ans] || 0) + 1;
        }
      });

      const maxCount = Math.max(...Object.values(counts), 1);
      const chartContainer = document.createElement('div');
      chartContainer.className = 'chart-bar-container';

      Object.entries(counts).forEach(([opt, count]) => {
        const percent = (count / maxCount) * 100;
        const row = document.createElement('div');
        row.className = 'chart-bar-row';
        row.innerHTML = `
          <div class="chart-bar-label" title="${escapeHtml(opt)}">${escapeHtml(opt)}</div>
          <div class="chart-bar-track">
            <div class="chart-bar-fill" style="width: ${percent}%"></div>
          </div>
          <div class="chart-bar-count">${count}</div>
        `;
        chartContainer.appendChild(row);
      });

      card.appendChild(chartContainer);
    } else if (q.type === 'linear_scale') {
      // Linear Scale Chart
      const min = q.min || 1;
      const max = q.max || 5;
      const counts = {};
      for (let i = min; i <= max; i++) counts[i] = 0;
      
      let sum = 0;
      answersList.forEach(ans => {
        const val = parseInt(ans, 10);
        if (!isNaN(val)) {
          counts[val] = (counts[val] || 0) + 1;
          sum += val;
        }
      });

      const avg = (sum / answersList.length).toFixed(1);
      const maxCount = Math.max(...Object.values(counts), 1);

      const scaleContainer = document.createElement('div');
      scaleContainer.className = 'chart-scale-container';

      for (let i = min; i <= max; i++) {
        const count = counts[i];
        const heightPercent = (count / maxCount) * 80; // max 80% height for space
        const col = document.createElement('div');
        col.className = 'chart-scale-col';
        col.innerHTML = `
          <div style="font-size: 0.75rem; font-weight: 600;">${count}</div>
          <div class="chart-scale-bar" style="height: ${heightPercent}px;"></div>
          <div class="chart-scale-label">${i}</div>
        `;
        scaleContainer.appendChild(col);
      }

      card.appendChild(scaleContainer);

      const avgInfo = document.createElement('p');
      avgInfo.style.marginTop = '0.5rem';
      avgInfo.style.marginBottom = '0';
      avgInfo.innerHTML = `Rata-rata: <strong>${avg}</strong> dari total ${answersList.length} penilaian.`;
      card.appendChild(avgInfo);
    } else {
      // List of Text Responses
      const list = document.createElement('ul');
      list.style.fontSize = '0.9rem';
      list.style.maxHeight = '200px';
      list.style.overflowY = 'auto';
      list.style.paddingLeft = '1.25rem';
      list.style.marginBottom = '0';

      answersList.slice(0, 50).forEach(ans => {
        const item = document.createElement('li');
        item.textContent = ans;
        list.appendChild(item);
      });
      card.appendChild(list);
    }

    container.appendChild(card);
  });
}

function renderIndividual() {
  const tableHeaders = document.getElementById('individual-table-headers');
  const tableRows = document.getElementById('individual-table-rows');

  // Reset headers
  tableHeaders.innerHTML = '<th>Waktu Submit</th>';
  formData.questions.forEach(q => {
    const th = document.createElement('th');
    th.textContent = q.label;
    tableHeaders.appendChild(th);
  });

  // Reset rows
  tableRows.innerHTML = '';

  if (responses.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="${formData.questions.length + 1}" style="text-align: center;">Belum ada data tanggapan.</td>`;
    tableRows.appendChild(tr);
    return;
  }

  responses.forEach(r => {
    const tr = document.createElement('tr');
    
    // Format timestamp
    const date = new Date(r.submitted_at);
    const dateStr = `${date.toLocaleDateString('id-ID')} ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    
    let tds = `<td>${dateStr}</td>`;
    
    formData.questions.forEach(q => {
      let ans = r.answers[q.id] || '';
      if (Array.isArray(ans)) ans = ans.join(', ');
      tds += `<td>${escapeHtml(ans)}</td>`;
    });

    tr.innerHTML = tds;
    tableRows.appendChild(tr);
  });
}

function setupTabs() {
  const tabSummary = document.getElementById('tab-summary');
  const tabIndividual = document.getElementById('tab-individual');
  const summaryView = document.getElementById('summary-view-content');
  const individualView = document.getElementById('individual-view-content');

  tabSummary.onclick = () => {
    tabSummary.classList.add('active');
    tabIndividual.classList.remove('active');
    summaryView.classList.add('visible');
    summaryView.classList.remove('hidden');
    individualView.classList.add('hidden');
    individualView.classList.remove('visible');
  };

  tabIndividual.onclick = () => {
    tabIndividual.classList.add('active');
    tabSummary.classList.remove('active');
    individualView.classList.add('visible');
    individualView.classList.remove('hidden');
    summaryView.classList.add('hidden');
    summaryView.classList.remove('visible');
  };
}

function setupActions() {
  document.getElementById('btn-export-csv').onclick = () => {
    if (responses.length === 0) {
      if (window.TMPT_UI) window.TMPT_UI.toast('Tidak ada data untuk diekspor.', 'warning');
      return;
    }

    // Build CSV Content
    const headers = ['Waktu Submit', ...formData.questions.map(q => q.label)];
    const rows = responses.map(r => {
      return [
        r.submitted_at,
        ...formData.questions.map(q => {
          let ans = r.answers[q.id] || '';
          if (Array.isArray(ans)) ans = ans.join(', ');
          // Escape quotes in CSV field
          return `"${ans.toString().replace(/"/g, '""')}"`;
        })
      ];
    });

    const csvContent = "\ufeff" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    triggerDownload(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), `${formData.title}_Respons.csv`);
  };

  document.getElementById('btn-export-json').onclick = () => {
    if (responses.length === 0) {
      if (window.TMPT_UI) window.TMPT_UI.toast('Tidak ada data untuk diekspor.', 'warning');
      return;
    }

    // Build structured output mapping label to answer
    const exportData = responses.map(r => {
      const mapped = { submitted_at: r.submitted_at };
      formData.questions.forEach(q => {
        mapped[q.label] = r.answers[q.id] || '';
      });
      return mapped;
    });

    triggerDownload(new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }), `${formData.title}_Respons.json`);
  };

  document.getElementById('btn-delete-responses').onclick = async () => {
    const confirmed = await window.showConfirmDialog('Apakah Anda yakin ingin menghapus seluruh tanggapan? Tindakan ini tidak dapat dibatalkan.');
    if (!confirmed) return;

    // Delete responses in IDB
    const tx = db.transaction('responses', 'readwrite');
    const store = tx.objectStore('responses');
    const index = store.index('by_form');
    const req = index.openCursor(IDBKeyRange.only(formId));
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    
    tx.oncomplete = async () => {
      if (window.TMPT_UI) window.TMPT_UI.toast('Semua tanggapan berhasil dihapus.', 'success');
      await loadResponses();
    };
  };
}

function triggerDownload(blob, filename) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

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

document.addEventListener('DOMContentLoaded', init);
