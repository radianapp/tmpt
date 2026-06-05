import { openTmptDB, dbGet, dbPut } from '/shared/db.js';

const DB_NAME = 'tmpt_forms';
const DB_VERSION = 1;

let db = null;
let formId = null;
let formData = null;
let isPreview = false;

let currentSlideIndex = -1; // -1 for header in slide mode, 0+ for questions
let visibleQuestions = [];
const answers = {};

async function init() {
  const params = new URLSearchParams(window.location.search);
  formId = params.get('id');
  isPreview = params.get('preview') === '1';

  if (!formId) {
    alert('Formulir tidak valid.');
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
    return;
  }

  // Set Theme
  document.body.setAttribute('data-form-theme', formData.theme.color || 'blue');
  document.body.setAttribute('data-font', formData.theme.font || 'Inter');
  
  // Set page title
  document.title = formData.title;

  evaluateVisibleQuestions();
  setupUI();
}

function evaluateVisibleQuestions() {
  // Filters questions based on logic rules
  visibleQuestions = formData.questions.filter(q => {
    const rule = formData.logic_rules.find(r => r.question_id === q.id);
    if (!rule) return true;

    // Check if the trigger question is answered with the trigger value
    const triggerVal = answers[rule.trigger_question_id];
    if (Array.isArray(triggerVal)) {
      return triggerVal.includes(rule.trigger_value);
    }
    return triggerVal === rule.trigger_value;
  });
}

function setupUI() {
  document.getElementById('respond-title').textContent = formData.title;
  document.getElementById('respond-desc').textContent = formData.description;
  document.getElementById('success-message-text').textContent = formData.settings.success_message || 'Terima kasih! Jawaban Anda telah diterima.';

  // Render header image
  const headerImgUrl = formData.theme.header_image;
  const imgContainer = document.getElementById('form-header-image-container');
  const imgEl = document.getElementById('form-header-img');
  if (imgContainer && imgEl) {
    if (headerImgUrl) {
      imgEl.src = headerImgUrl;
      imgContainer.classList.remove('hidden');
    } else {
      imgContainer.classList.add('hidden');
    }
  }

  if (formData.settings.mode === 'slide') {
    document.getElementById('progress-container').classList.remove('hidden');
    renderSlide();
  } else {
    renderClassic();
  }
}

function renderClassic() {
  const container = document.getElementById('respond-questions-container');
  container.innerHTML = '';

  visibleQuestions.forEach(q => {
    const group = document.createElement('div');
    group.className = 'respond-form-card respond-question-group';
    group.dataset.id = q.id;

    const reqIndicator = q.required ? '<span style="color: var(--pico-danger-color);"> *</span>' : '';
    const desc = q.description ? `<span class="respond-question-desc">${escapeHtml(q.description)}</span>` : '';

    group.innerHTML = `
      <label class="respond-question-label">${escapeHtml(q.label)}${reqIndicator}</label>
      ${desc}
      <div class="question-input-wrapper">
        ${renderInput(q)}
      </div>
    `;
    container.appendChild(group);
  });

  // Attach dynamic event listeners to inputs to evaluate conditional logic
  container.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('change', (e) => {
      saveAnswerFromInput(e.target);
      evaluateVisibleQuestions();
      updateClassicVisibility();
    });
  });
}

function updateClassicVisibility() {
  // Update visibility of cards in classic view to avoid total redraw and preserve entered answers
  const container = document.getElementById('respond-questions-container');
  const visibleIds = visibleQuestions.map(q => q.id);
  
  // Rerender classic list to add missing fields or hide dynamically
  renderClassic();
}

function renderSlide() {
  const container = document.getElementById('respond-questions-container');
  const headerCard = document.getElementById('form-header-view');
  const btnPrev = document.getElementById('btn-prev-slide');
  const btnSubmit = document.getElementById('btn-submit-form');
  
  container.innerHTML = '';

  if (currentSlideIndex === -1) {
    headerCard.classList.remove('hidden');
    btnPrev.classList.add('hidden');
    btnSubmit.textContent = 'Mulai →';
    updateProgressBar(0);
  } else {
    headerCard.classList.add('hidden');
    btnPrev.classList.remove('hidden');
    
    const q = visibleQuestions[currentSlideIndex];
    if (q) {
      const group = document.createElement('div');
      group.className = 'respond-form-card respond-question-group';
      group.dataset.id = q.id;

      const reqIndicator = q.required ? '<span style="color: var(--pico-danger-color);"> *</span>' : '';
      const desc = q.description ? `<span class="respond-question-desc">${escapeHtml(q.description)}</span>` : '';

      group.innerHTML = `
        <label class="respond-question-label">${escapeHtml(q.label)}${reqIndicator}</label>
        ${desc}
        <div class="question-input-wrapper">
          ${renderInput(q)}
        </div>
      `;
      container.appendChild(group);

      // Attach listener
      group.querySelectorAll('input, select, textarea').forEach(input => {
        input.addEventListener('change', (e) => {
          saveAnswerFromInput(e.target);
          evaluateVisibleQuestions();
        });
      });

      // Update submit button text
      const isLast = currentSlideIndex === visibleQuestions.length - 1;
      btnSubmit.textContent = isLast ? 'Kirim Jawaban' : 'Selanjutnya →';
    }

    updateProgressBar(((currentSlideIndex + 1) / visibleQuestions.length) * 100);
  }
}

function updateProgressBar(percent) {
  const progressText = document.getElementById('slide-progress-text');
  const progressPercent = document.getElementById('slide-progress-percent');
  const progressBar = document.getElementById('slide-progress-bar');

  progressBar.value = percent;
  progressPercent.textContent = `${Math.round(percent)}%`;

  if (currentSlideIndex === -1) {
    progressText.textContent = 'Mulai Mengisi';
  } else {
    progressText.textContent = `Pertanyaan ${currentSlideIndex + 1} dari ${visibleQuestions.length}`;
  }
}

function renderInput(q) {
  const savedVal = answers[q.id];

  switch (q.type) {
    case 'text_short':
      return `<input type="text" data-q-id="${q.id}" value="${escapeHtml(savedVal || '')}" placeholder="Ketik jawaban Anda..." ${q.required ? 'required' : ''}>`;
    case 'text_long':
      return `<textarea data-q-id="${q.id}" placeholder="Ketik jawaban panjang Anda..." rows="3" ${q.required ? 'required' : ''}>${escapeHtml(savedVal || '')}</textarea>`;
    case 'choice_single':
      return (q.options || []).map((opt, i) => {
        const checked = savedVal === opt ? 'checked' : '';
        return `
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-bottom: 0.5rem;">
            <input type="radio" name="q-${q.id}" data-q-id="${q.id}" value="${escapeHtml(opt)}" ${checked} ${q.required ? 'required' : ''}>
            <span>${escapeHtml(opt)}</span>
          </label>
        `;
      }).join('');
    case 'choice_multiple':
      return (q.options || []).map((opt, i) => {
        const checked = Array.isArray(savedVal) && savedVal.includes(opt) ? 'checked' : '';
        return `
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-bottom: 0.5rem;">
            <input type="checkbox" name="q-${q.id}" data-q-id="${q.id}" value="${escapeHtml(opt)}" ${checked}>
            <span>${escapeHtml(opt)}</span>
          </label>
        `;
      }).join('');
    case 'dropdown':
      const options = (q.options || []).map(opt => `<option value="${opt}" ${savedVal === opt ? 'selected' : ''}>${opt}</option>`).join('');
      return `
        <select data-q-id="${q.id}" ${q.required ? 'required' : ''}>
          <option value="" disabled ${!savedVal ? 'selected' : ''}>Pilih salah satu...</option>
          ${options}
        </select>
      `;
    case 'linear_scale':
      const min = q.min || 1;
      const max = q.max || 5;
      let scaleHtml = '<div style="display: flex; gap: 0.5rem; align-items: center; justify-content: space-between; margin-top: 0.5rem;">';
      if (q.minLabel) scaleHtml += `<span style="font-size: 0.85rem; font-weight: 600;">${escapeHtml(q.minLabel)}</span>`;
      
      for (let i = min; i <= max; i++) {
        const checked = savedVal === i.toString() ? 'checked' : '';
        scaleHtml += `
          <label style="display: flex; flex-direction: column; align-items: center; gap: 0.25rem; cursor: pointer; margin: 0;">
            <span>${i}</span>
            <input type="radio" name="q-${q.id}" data-q-id="${q.id}" value="${i}" ${checked} ${q.required ? 'required' : ''}>
          </label>
        `;
      }
      
      if (q.maxLabel) scaleHtml += `<span style="font-size: 0.85rem; font-weight: 600;">${escapeHtml(q.maxLabel)}</span>`;
      scaleHtml += '</div>';
      return scaleHtml;
    case 'date':
      return `<input type="date" data-q-id="${q.id}" value="${escapeHtml(savedVal || '')}" ${q.required ? 'required' : ''}>`;
    case 'time':
      return `<input type="time" data-q-id="${q.id}" value="${escapeHtml(savedVal || '')}" ${q.required ? 'required' : ''}>`;
    default:
      return '';
  }
}

function saveAnswerFromInput(el) {
  const qId = el.dataset.qId;
  if (!qId) return;

  if (el.type === 'checkbox') {
    if (!answers[qId]) answers[qId] = [];
    if (el.checked) {
      if (!answers[qId].includes(el.value)) answers[qId].push(el.value);
    } else {
      answers[qId] = answers[qId].filter(v => v !== el.value);
    }
  } else if (el.type === 'radio') {
    if (el.checked) answers[qId] = el.value;
  } else {
    answers[qId] = el.value;
  }
}

// Validation logic
function validateCurrentAnswers() {
  const currentQuestions = formData.settings.mode === 'slide' 
    ? (currentSlideIndex === -1 ? [] : [visibleQuestions[currentSlideIndex]])
    : visibleQuestions;

  for (const q of currentQuestions) {
    if (q.required) {
      const ans = answers[q.id];
      if (ans === undefined || ans === '' || (Array.isArray(ans) && ans.length === 0)) {
        toast(`Pertanyaan "${q.label}" wajib diisi.`, 'error');
        return false;
      }
    }
  }
  return true;
}

// Submit action
async function handleSubmit() {
  if (isPreview) {
    toast('Tanggapan disubmit (Mode Preview — Data tidak disimpan).', 'info');
    document.getElementById('respond-form').classList.add('hidden');
    document.getElementById('success-view').classList.remove('hidden');
    return;
  }

  // Build payload
  const submission = {
    id: crypto.randomUUID(),
    form_id: formId,
    answers: {},
    submitted_at: new Date().toISOString()
  };

  // Map answers to question labels for external connectors if needed, or keeping standard IDs
  visibleQuestions.forEach(q => {
    submission.answers[q.label] = answers[q.id] || '';
  });

  try {
    if (formData.publish_mode === 'local') {
      // Save locally
      await dbPut(db, 'responses', {
        id: submission.id,
        form_id: formId,
        answers: answers, // Save with question IDs for reliable local aggregation
        submitted_at: submission.submitted_at
      });
    } else if (formData.publish_mode === 'formspree') {
      const url = formData.publish_config.formspree_url;
      if (!url) throw new Error('Endpoint Formspree belum dikonfigurasi.');
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(submission)
      });
    } else if (formData.publish_mode === 'google_sheets') {
      const url = formData.publish_config.sheets_url;
      if (!url) throw new Error('Endpoint Google Sheets belum dikonfigurasi.');
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
        mode: 'no-cors' // Google Apps Script doPost redirects can throw CORS checks even on successful POST
      });
    } else if (formData.publish_mode === 'custom') {
      const url = formData.publish_config.custom_url;
      if (!url) throw new Error('Endpoint Custom API belum dikonfigurasi.');
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission)
      });
    }

    // Show Success UI
    document.getElementById('respond-form').classList.add('hidden');
    document.getElementById('success-view').classList.remove('hidden');

  } catch (err) {
    toast(`Gagal mengirimkan tanggapan: ${err.message}`, 'error');
  }
}

function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('article');
  el.className = `tmpt-toast tmpt-toast--${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.textContent = message;
  
  // Custom toast stylesheet injection if missing
  if (!document.getElementById('toast-style-override')) {
    const style = document.createElement('style');
    style.id = 'toast-style-override';
    style.textContent = `
      .tmpt-toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 99999;
        padding: 0.75rem 1.25rem;
        border-radius: 8px;
        color: white;
        background-color: #3b82f6;
        box-shadow: 0 4px 10px rgba(0,0,0,0.15);
      }
      .tmpt-toast--error { background-color: #ef4444; }
      .tmpt-toast--success { background-color: #10b981; }
    `;
    document.head.appendChild(style);
  }

  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Navigation actions
document.addEventListener('DOMContentLoaded', () => {
  init();

  document.getElementById('respond-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Save current slide values
    const currentQCard = document.getElementById('respond-questions-container').firstElementChild;
    if (currentQCard) {
      currentQCard.querySelectorAll('input, select, textarea').forEach(input => saveAnswerFromInput(input));
    }

    if (!validateCurrentAnswers()) return;

    if (formData.settings.mode === 'slide') {
      if (currentSlideIndex === -1) {
        currentSlideIndex = 0;
        renderSlide();
      } else if (currentSlideIndex < visibleQuestions.length - 1) {
        currentSlideIndex++;
        renderSlide();
      } else {
        handleSubmit();
      }
    } else {
      handleSubmit();
    }
  });

  document.getElementById('btn-prev-slide').addEventListener('click', () => {
    if (currentSlideIndex > -1) {
      currentSlideIndex--;
      renderSlide();
    }
  });
});
