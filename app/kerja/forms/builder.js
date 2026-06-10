import { openTmptDB, dbGet, dbPut } from '/shared/db.js';
import { getAppBridgeContext } from '/shared/app-bridge.js';
import { broadcastTMPT, TMPT_EVENTS } from '/shared/broadcast.js';

const DB_NAME = 'tmpt_forms';
const DB_VERSION = 3;
const STORE_NAME = 'forms';

let db = null;
let formId = null;
let formData = null;
let autosaveTimer = null;

// Initialize DB and Load Form
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

  if (!formId) {
    // Create new blank form
    formId = crypto.randomUUID();
    formData = {
      id: formId,
      title: 'Formulir Tanpa Judul',
      description: 'Deskripsi formulir Anda.',
      questions: [],
      logic_rules: [],
      settings: {
        success_message: 'Terima kasih! Jawaban Anda telah diterima.',
        mode: 'classic'
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
    await dbPut(db, STORE_NAME, formData);
    broadcastTMPT(TMPT_EVENTS.FILE_CREATED, { id: formId, type: 'forms', title: formData.title });
    // Replace URL state without reload
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('id', formId);
    window.history.replaceState({}, '', newUrl);
  } else {
    formData = await dbGet(db, STORE_NAME, formId);
    if (!formData) {
      alert('Formulir tidak ditemukan.');
      window.location.href = './index.html';
      return;
    }
  }

  renderFormMetadata();
  renderQuestions();
  setupSettingsUI();
  setupThemeUI();
  setupPublishUI();
  setupEvents();
}

function renderFormMetadata() {
  document.getElementById('form-file-title').value = formData.title;
  document.getElementById('form-display-title').value = formData.title;
  document.getElementById('form-display-desc').value = formData.description;
  document.body.setAttribute('data-form-theme', formData.theme.color || 'blue');
  document.getElementById('input-header-image').value = formData.theme.header_image || '';
}

function setupSettingsUI() {
  document.getElementById('success-msg-input').value = formData.settings.success_message || '';
  document.getElementById('select-layout-mode').value = formData.settings.mode || 'classic';
  document.getElementById('select-font').value = formData.theme.font || 'Inter';
}

function setupThemeUI() {
  const dots = document.querySelectorAll('.theme-color-dot');
  dots.forEach(dot => {
    dot.classList.toggle('active', dot.dataset.color === formData.theme.color);
    dot.onclick = () => {
      dots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      formData.theme.color = dot.dataset.color;
      document.body.setAttribute('data-form-theme', dot.dataset.color);
      triggerAutosave();
    };
  });
}

function setupPublishUI() {
  const publishModeSelect = document.getElementById('select-publish-mode');
  publishModeSelect.value = formData.publish_mode || 'local';

  // Toggle configs visibility
  const updateConfigsVisibility = () => {
    const val = publishModeSelect.value;
    document.getElementById('config-formspree').classList.toggle('hidden', val !== 'formspree');
    document.getElementById('config-google-sheets').classList.toggle('hidden', val !== 'google_sheets');
    document.getElementById('config-custom-api').classList.toggle('hidden', val !== 'custom');
  };

  publishModeSelect.onchange = () => {
    formData.publish_mode = publishModeSelect.value;
    updateConfigsVisibility();
    triggerAutosave();
  };

  updateConfigsVisibility();

  // Populate config fields
  if (formData.publish_config.formspree_url) {
    document.getElementById('formspree-url').value = formData.publish_config.formspree_url;
  }
  if (formData.publish_config.sheets_url) {
    document.getElementById('sheets-script-url').value = formData.publish_config.sheets_url;
  }
  if (formData.publish_config.custom_url) {
    document.getElementById('custom-api-url').value = formData.publish_config.custom_url;
  }

  // Links URLs
  const respondUrl = `${window.location.origin}/app/kerja/forms/respond.html?id=${formId}`;
  document.getElementById('respond-link-url').value = respondUrl;

  document.getElementById('btn-copy-link').onclick = () => {
    navigator.clipboard.writeText(respondUrl);
    if (window.TMPT_UI) window.TMPT_UI.toast('Tautan berhasil disalin!', 'success');
  };
}

function renderQuestions() {
  const container = document.getElementById('questions-container');
  container.innerHTML = '';

  formData.questions.forEach((q, index) => {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.dataset.id = q.id;

    // Build question type dropdown options
    const typeOptions = [
      { val: 'text_short', label: 'Teks Pendek' },
      { val: 'text_long', label: 'Teks Panjang' },
      { val: 'choice_single', label: 'Pilihan Ganda' },
      { val: 'choice_multiple', label: 'Kotak Centang' },
      { val: 'dropdown', label: 'Dropdown' },
      { val: 'linear_scale', label: 'Skala Linear' },
      { val: 'date', label: 'Tanggal' },
      { val: 'time', label: 'Waktu' }
    ].map(opt => `<option value="${opt.val}" ${q.type === opt.val ? 'selected' : ''}>${opt.label}</option>`).join('');

    // Generate options HTML for choice types
    let optionsHtml = '';
    if (['choice_single', 'choice_multiple', 'dropdown'].includes(q.type)) {
      const options = q.options || ['Opsi 1'];
      optionsHtml = `
        <div class="question-card-options">
          ${options.map((opt, optIndex) => `
            <div class="option-row" data-index="${optIndex}">
              <span>${q.type === 'choice_multiple' ? '☐' : '○'}</span>
              <input type="text" value="${escapeHtml(opt)}" oninput="updateQuestionOption('${q.id}', ${optIndex}, this.value)" aria-label="Opsi ${optIndex + 1}">
              <button onclick="removeQuestionOption('${q.id}', ${optIndex})" class="outline secondary">✕</button>
            </div>
          `).join('')}
          <button onclick="addQuestionOption('${q.id}')" class="outline secondary" style="width: auto; margin-top: 0.5rem; font-size: 0.85rem; padding: 0.25rem 0.75rem;">+ Tambah Opsi</button>
        </div>
      `;
    } else if (q.type === 'linear_scale') {
      const min = q.min || 1;
      const max = q.max || 5;
      optionsHtml = `
        <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap;">
          <label style="margin: 0;">Skala:
            <select onchange="updateLinearScale('${q.id}', 'min', this.value)" style="width: auto; display: inline-block; margin: 0 0.5rem;">
              <option value="0" ${min === 0 ? 'selected' : ''}>0</option>
              <option value="1" ${min === 1 ? 'selected' : ''}>1</option>
            </select>
          </label>
          <span style="font-weight: 600;">ke</span>
          <select onchange="updateLinearScale('${q.id}', 'max', this.value)" style="width: auto; display: inline-block; margin: 0;">
            ${[3,4,5,6,7,8,9,10].map(val => `<option value="${val}" ${max === val ? 'selected' : ''}>${val}</option>`).join('')}
          </select>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <input type="text" placeholder="Label Kiri (opsional)" value="${escapeHtml(q.minLabel || '')}" oninput="updateLinearLabel('${q.id}', 'minLabel', this.value)" aria-label="Label Kiri">
          <input type="text" placeholder="Label Kanan (opsional)" value="${escapeHtml(q.maxLabel || '')}" oninput="updateLinearLabel('${q.id}', 'maxLabel', this.value)" aria-label="Label Kanan">
        </div>
      `;
    }

    // Logic Display UI
    const rule = formData.logic_rules.find(r => r.question_id === q.id);
    const earlierQuestions = formData.questions.slice(0, index).filter(eq => ['choice_single', 'dropdown'].includes(eq.type));
    let logicBuilderHtml = '';
    
    if (earlierQuestions.length > 0) {
      const triggerSelect = earlierQuestions.map(eq => `<option value="${eq.id}" ${rule && rule.trigger_question_id === eq.id ? 'selected' : ''}>${escapeHtml(eq.label)}</option>`).join('');
      const selectedTriggerId = rule ? rule.trigger_question_id : earlierQuestions[0].id;
      const selectedTriggerQ = earlierQuestions.find(eq => eq.id === selectedTriggerId);
      const optionsSelect = selectedTriggerQ ? (selectedTriggerQ.options || []).map(opt => `<option value="${opt}" ${rule && rule.trigger_value === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('') : '';

      logicBuilderHtml = `
        <div class="logic-rule-card ${q.isLogicOpen ? '' : 'hidden'}" id="logic-${q.id}">
          <strong>⚡ Logika Kondisional (Tampilkan jika):</strong>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.5rem;">
            <select onchange="updateLogicQuestion('${q.id}', this.value)" aria-label="Pertanyaan Trigger">
              ${triggerSelect}
            </select>
            <select onchange="updateLogicValue('${q.id}', this.value)" aria-label="Nilai Trigger">
              ${optionsSelect}
            </select>
          </div>
          <button class="outline secondary" onclick="removeLogicRule('${q.id}')" style="width: auto; padding: 0.2rem 0.5rem; margin: 0; font-size: 0.75rem;">Hapus Logika</button>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="question-card-header">
        <input type="text" value="${escapeHtml(q.label)}" placeholder="Pertanyaan Baru" oninput="updateQuestionLabel('${q.id}', this.value)" aria-label="Label Pertanyaan">
        <select onchange="updateQuestionType('${q.id}', this.value)">
          ${typeOptions}
        </select>
      </div>
      
      <input type="text" value="${escapeHtml(q.description || '')}" placeholder="Keterangan tambahan / deskripsi pertanyaan (opsional)" oninput="updateQuestionDesc('${q.id}', this.value)" style="font-size: 0.85rem;" aria-label="Keterangan Pertanyaan">

      ${optionsHtml}

      ${logicBuilderHtml}

      <div class="question-card-footer">
        ${earlierQuestions.length > 0 ? `<button onclick="toggleLogicBuilder('${q.id}')" class="outline secondary">⚡ Logika</button>` : ''}
        <button onclick="duplicateQuestion('${q.id}')" class="outline secondary">📋 Duplikat</button>
        <button onclick="deleteQuestion('${q.id}')" class="outline secondary" style="color: var(--pico-danger-color); border-color: var(--pico-danger-color);">🗑️ Hapus</button>
        <label>
          <input type="checkbox" ${q.required ? 'checked' : ''} onchange="updateQuestionRequired('${q.id}', this.checked)"> Wajib Diisi
        </label>
      </div>
    `;

    container.appendChild(card);
  });
}

// Autosave mechanism
function triggerAutosave() {
  const saveStatus = document.getElementById('save-status');
  if (saveStatus) saveStatus.textContent = 'Ada perubahan...';
  
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    if (saveStatus) saveStatus.textContent = 'Menyimpan...';
    formData.updated_at = new Date().toISOString();
    await dbPut(db, STORE_NAME, formData);
    broadcastTMPT(TMPT_EVENTS.FILE_UPDATED, { id: formId, type: 'forms', title: formData.title });
    if (saveStatus) saveStatus.textContent = 'Tersimpan ✓';
  }, 2000);
}

// Question Mutators
window.updateQuestionLabel = (qId, val) => {
  const q = formData.questions.find(eq => eq.id === qId);
  if (q) {
    q.label = val;
    triggerAutosave();
  }
};

window.updateQuestionDesc = (qId, val) => {
  const q = formData.questions.find(eq => eq.id === qId);
  if (q) {
    q.description = val;
    triggerAutosave();
  }
};

window.updateQuestionType = (qId, type) => {
  const q = formData.questions.find(eq => eq.id === qId);
  if (q) {
    q.type = type;
    if (['choice_single', 'choice_multiple', 'dropdown'].includes(type) && !q.options) {
      q.options = ['Opsi 1', 'Opsi 2'];
    }
    renderQuestions();
    triggerAutosave();
  }
};

window.updateQuestionRequired = (qId, val) => {
  const q = formData.questions.find(eq => eq.id === qId);
  if (q) {
    q.required = val;
    triggerAutosave();
  }
};

window.updateQuestionOption = (qId, index, val) => {
  const q = formData.questions.find(eq => eq.id === qId);
  if (q && q.options) {
    q.options[index] = val;
    triggerAutosave();
  }
};

window.addQuestionOption = (qId) => {
  const q = formData.questions.find(eq => eq.id === qId);
  if (q && q.options) {
    q.options.push(`Opsi ${q.options.length + 1}`);
    renderQuestions();
    triggerAutosave();
  }
};

window.removeQuestionOption = (qId, index) => {
  const q = formData.questions.find(eq => eq.id === qId);
  if (q && q.options && q.options.length > 1) {
    q.options.splice(index, 1);
    renderQuestions();
    triggerAutosave();
  }
};

window.updateLinearScale = (qId, prop, val) => {
  const q = formData.questions.find(eq => eq.id === qId);
  if (q) {
    q[prop] = parseInt(val, 10);
    triggerAutosave();
  }
};

window.updateLinearLabel = (qId, prop, val) => {
  const q = formData.questions.find(eq => eq.id === qId);
  if (q) {
    q[prop] = val;
    triggerAutosave();
  }
};

window.toggleLogicBuilder = (qId) => {
  const q = formData.questions.find(eq => eq.id === qId);
  if (q) {
    q.isLogicOpen = !q.isLogicOpen;
    // ensure rule object exists
    let rule = formData.logic_rules.find(r => r.question_id === qId);
    if (!rule && q.isLogicOpen) {
      // Find first valid earlier question
      const index = formData.questions.findIndex(eq => eq.id === qId);
      const earlier = formData.questions.slice(0, index).filter(eq => ['choice_single', 'dropdown'].includes(eq.type));
      if (earlier.length > 0) {
        formData.logic_rules.push({
          question_id: qId,
          trigger_question_id: earlier[0].id,
          trigger_value: (earlier[0].options || [])[0] || ''
        });
      }
    }
    renderQuestions();
  }
};

window.updateLogicQuestion = (qId, triggerId) => {
  const rule = formData.logic_rules.find(r => r.question_id === qId);
  const triggerQ = formData.questions.find(eq => eq.id === triggerId);
  if (rule && triggerQ) {
    rule.trigger_question_id = triggerId;
    rule.trigger_value = (triggerQ.options || [])[0] || '';
    renderQuestions();
    triggerAutosave();
  }
};

window.updateLogicValue = (qId, val) => {
  const rule = formData.logic_rules.find(r => r.question_id === qId);
  if (rule) {
    rule.trigger_value = val;
    triggerAutosave();
  }
};

window.removeLogicRule = (qId) => {
  formData.logic_rules = formData.logic_rules.filter(r => r.question_id !== qId);
  const q = formData.questions.find(eq => eq.id === qId);
  if (q) q.isLogicOpen = false;
  renderQuestions();
  triggerAutosave();
};

window.duplicateQuestion = (qId) => {
  const index = formData.questions.findIndex(eq => eq.id === qId);
  if (index > -1) {
    const q = formData.questions[index];
    const newQ = JSON.parse(JSON.stringify(q));
    newQ.id = crypto.randomUUID();
    newQ.label = `${newQ.label} (Salinan)`;
    formData.questions.splice(index + 1, 0, newQ);
    renderQuestions();
    triggerAutosave();
  }
};

window.deleteQuestion = (qId) => {
  formData.questions = formData.questions.filter(eq => eq.id !== qId);
  // delete logic rules associated too
  formData.logic_rules = formData.logic_rules.filter(r => r.question_id !== qId && r.trigger_question_id !== qId);
  renderQuestions();
  triggerAutosave();
};

function setupEvents() {
  document.getElementById('form-file-title').addEventListener('input', (e) => {
    formData.title = e.target.value;
    document.getElementById('form-display-title').value = e.target.value;
    triggerAutosave();
  });

  document.getElementById('form-display-title').addEventListener('input', (e) => {
    formData.title = e.target.value;
    document.getElementById('form-file-title').value = e.target.value;
    triggerAutosave();
  });

  document.getElementById('form-display-desc').addEventListener('input', (e) => {
    formData.description = e.target.value;
    triggerAutosave();
  });

  document.getElementById('success-msg-input').addEventListener('input', (e) => {
    formData.settings.success_message = e.target.value;
    triggerAutosave();
  });

  document.getElementById('select-layout-mode').addEventListener('change', (e) => {
    formData.settings.mode = e.target.value;
    triggerAutosave();
  });

  document.getElementById('select-font').addEventListener('change', (e) => {
    formData.theme.font = e.target.value;
    triggerAutosave();
  });

  document.getElementById('input-header-image').addEventListener('input', (e) => {
    formData.theme.header_image = e.target.value;
    triggerAutosave();
  });

  document.getElementById('btn-add-question').addEventListener('click', () => {
    formData.questions.push({
      id: crypto.randomUUID(),
      type: 'text_short',
      label: 'Pertanyaan Baru',
      required: false
    });
    renderQuestions();
    triggerAutosave();
  });

  document.getElementById('btn-preview').addEventListener('click', () => {
    window.open(`./respond.html?id=${formId}&preview=1`, '_blank');
  });

  document.getElementById('btn-publish').addEventListener('click', () => {
    // Sync config fields
    setupPublishUI();
    document.getElementById('publish-modal').showModal();
  });

  // Save configurations when typing in the modal
  document.getElementById('formspree-url').addEventListener('input', (e) => {
    formData.publish_config.formspree_url = e.target.value;
    triggerAutosave();
  });

  document.getElementById('sheets-script-url').addEventListener('input', (e) => {
    formData.publish_config.sheets_url = e.target.value;
    triggerAutosave();
  });

  document.getElementById('custom-api-url').addEventListener('input', (e) => {
    formData.publish_config.custom_url = e.target.value;
    triggerAutosave();
  });
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
