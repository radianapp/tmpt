// app/dev/regex/js/regex-app.js
import { broadcastTMPT } from '/shared/broadcast.js';

// Import core modules
import { initSessionDB, saveSession, deleteSession, getAllSessions, getSession } from './session-manager.js';
import { setupKeyboardShortcuts } from './shortcuts.js';

// Import tab modules
import { setupEditorSync } from './modules/studio/editor.js';
import { highlightMatches } from './modules/studio/highlight.js';
import { getMatchDetails } from './modules/studio/match-details.js';
import { applyReplace } from './modules/studio/replace.js';
import { explainRegex } from './modules/studio/explain.js';
import { regexToMermaid } from './modules/studio/visual-graph.js';

import { generateRegex } from './modules/ai/generate.js';
import { explainRegexWithAI } from './modules/ai/explain.js';
import { fixRegexWithAI } from './modules/ai/fix.js';
import { generateDatasetWithAI } from './modules/ai/dataset.js';

import { detectReDoS } from './modules/security/redos.js';
import { analyzePerformance } from './modules/security/performance.js';
import { loadEngineCompatibility, checkPortabilityIssues } from './modules/security/multi-engine.js';

import { runTestSuite } from './modules/devops/unit-test.js';
import { benchmarkRegex } from './modules/devops/benchmark.js';
import { testRegexOnFile } from './modules/devops/file-test.js';
import { generateCode } from './modules/devops/code-gen.js';
import { regexToSQL } from './modules/devops/sql-gen.js';

import { loadBuiltInPatterns, filterPatterns } from './modules/library/patterns.js';
import { getCheatsheetData } from './modules/library/cheatsheet.js';

// State management
let currentSession = {
  id: crypto.randomUUID(),
  title: 'Sesi Baru',
  pattern: '([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)\\.([a-zA-Z]{2,})',
  flags: 'g',
  test_string: 'Hubungi kami di sales@company.com atau admin@company.co.id untuk info lebih lanjut.',
  replace_str: 'REDACTED@$2',
  test_cases: [
    { id: '1', input: 'test@example.com', expect: 'match' },
    { id: '2', input: 'invalid-email', expect: 'no-match' }
  ],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

let autosaveTimer = null;
let activeTab = 'tab-studio';
let activeSubtab = 'studio-match';
let currentLanguage = 'js';
let selectedFileToTest = null;
let builtinPatternsCache = [];

// DOM Elements
let elPattern, elFlags, elTestInput, elTestBackdrop, elSaveStatus;

document.addEventListener('DOMContentLoaded', async () => {
  // Bind standard TMPT auth requirement
  if (window.TMPT_Auth) {
    await window.TMPT_Auth.init();
    if (!window.TMPT_Auth.isUnlocked()) {
      window.location.href = '/app/auth/login/';
      return;
    }
    window.TMPT_Auth.setupIdleListeners();
  }

  // Load DOM Cache
  elPattern = document.getElementById('regex-pattern');
  elFlags = document.getElementById('regex-flags');
  elTestInput = document.getElementById('test-input');
  elTestBackdrop = document.getElementById('test-backdrop');
  elSaveStatus = document.getElementById('save-status');

  // Load DB & Session
  await initSessionDB();
  await loadSessionsList();
  
  // Apply values to UI
  applySessionToUI();

  // Setup layout integrations
  setupEditorSync(elTestInput, elTestBackdrop);
  setupListeners();
  setupKeyboardShortcuts({
    onSave: async () => {
      triggerSaveStatus('saving');
      await saveCurrentSession();
      triggerSaveStatus('saved');
    },
    onRun: () => {
      runRealtimeRegex();
    },
    onTabChange: (tabId) => {
      switchTab(tabId);
    }
  });

  // Load tables & lists
  await loadEngineMatrix();
  await loadLibraryPatterns();
  loadCheatsheet();
  
  // Initial run
  runRealtimeRegex();
  
  // Insert hamburger and actions into header (compat rule)
  insertHamburgerInHeader();
  insertAppActionsInHeader();
});

// Sync hamburger and actions
document.addEventListener('htmx:afterSwap', (e) => {
  if (e.target.id === 'header-container' || e.target.tagName === 'HEADER') {
    insertHamburgerInHeader();
    insertAppActionsInHeader();
  }
});

function insertAppActionsInHeader() {
  const navList = document.querySelector('header nav ul:last-child');
  if (navList && !document.getElementById('header-app-actions')) {
    const li = document.createElement('li');
    li.id = 'header-app-actions';
    li.style.display = 'inline-flex';
    li.style.alignItems = 'center';
    li.style.gap = '0.5rem';
    
    li.innerHTML = `
      <button id="btn-new-session" aria-label="Sesi Baru" title="Sesi Baru" class="outline" style="padding: 0; margin: 0; border: none; font-size: 1.25rem; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: transparent; cursor: pointer; color: var(--pico-color);">
        ＋
      </button>
      <button id="btn-open-settings" aria-label="Setelan AI" title="Setelan AI" class="outline" style="padding: 0; margin: 0; border: none; font-size: 1.25rem; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: transparent; cursor: pointer; color: var(--pico-color);">
        ⚙️
      </button>
    `;
    
    navList.insertBefore(li, navList.firstChild);
    
    // Bind listeners
    document.getElementById('btn-new-session').addEventListener('click', () => {
      startNewSession();
    });
    
    document.getElementById('btn-open-settings').addEventListener('click', () => {
      const modal = document.getElementById('modal-settings-ai');
      const savedKey = localStorage.getItem('tmpt_regex_ai_key') || '';
      document.getElementById('ai-api-key').value = savedKey;
      modal.showModal();
    });
  }
}

function insertHamburgerInHeader() {
  const logoLink = document.querySelector('header nav ul li a[href="/app/"]');
  if (logoLink && !document.getElementById('btn-sidebar-toggle-header')) {
    const hamburger = document.createElement('a');
    hamburger.id = 'btn-sidebar-toggle-header';
    hamburger.href = '#';
    hamburger.innerHTML = '☰';
    hamburger.title = 'Tampilkan/Sembunyikan Sidebar';
    hamburger.style.cssText = 'padding: 0.2rem 0.5rem; font-size: 1.25rem; color: var(--pico-heading-color) !important; cursor: pointer; margin-right: 0.5rem; width: auto; height: auto; display: inline-flex; align-items: center; justify-content: center; text-decoration: none;';
    
    hamburger.addEventListener('click', (e) => {
      e.preventDefault();
      // In this app, we don't have a large sidebar but we can just toggle the history panel
      const sidebar = document.getElementById('sidebar-panel');
      if (sidebar) {
        sidebar.classList.toggle('collapsed');
      }
    });

    if (logoLink.parentNode) {
      logoLink.parentNode.style.display = 'inline-flex';
      logoLink.parentNode.style.alignItems = 'center';
      logoLink.parentNode.insertBefore(hamburger, logoLink);
    }
  }
}

function setupListeners() {
  // Live inputs
  if (elPattern) {
    elPattern.addEventListener('input', () => {
      currentSession.pattern = elPattern.value;
      runRealtimeRegex();
      triggerAutosave();
    });
  }

  if (elFlags) {
    elFlags.addEventListener('input', () => {
      currentSession.flags = elFlags.value;
      runRealtimeRegex();
      triggerAutosave();
    });
  }

  if (elTestInput) {
    elTestInput.addEventListener('input', () => {
      currentSession.test_string = elTestInput.value;
      runRealtimeRegex();
      triggerAutosave();
    });
  }

  // Collapsible panels
  document.querySelectorAll('.collapsible-card').forEach(card => {
    const header = card.querySelector('.card-header');
    const body = card.querySelector('.card-body-content');
    if (header && body) {
      const chevron = header.querySelector('.chevron-icon');
      header.addEventListener('click', () => {
        body.classList.toggle('collapsed');
        if (chevron) {
          chevron.textContent = body.classList.contains('collapsed') ? '▼' : '▲';
        }
      });
    }
  });

  // Flags dropdown selection
  const flagsDropdown = document.getElementById('flags-dropdown-list');
  const flagsInput = document.getElementById('regex-flags');
  if (flagsDropdown && flagsInput) {
    flagsDropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const activeFlags = [];
        flagsDropdown.querySelectorAll('input[type="checkbox"]:checked').forEach(c => {
          activeFlags.push(c.value);
        });
        const flagsStr = activeFlags.join('');
        flagsInput.value = activeFlags.join(', ');
        currentSession.flags = flagsStr;
        runRealtimeRegex();
        triggerAutosave();
      });
    });
  }

  // Settings modal form submission
  const aiSettingsForm = document.getElementById('form-ai-settings');
  if (aiSettingsForm) {
    aiSettingsForm.addEventListener('submit', () => {
      const key = document.getElementById('ai-api-key').value.trim();
      localStorage.setItem('tmpt_regex_ai_key', key);
      document.getElementById('modal-settings-ai').close();
      window.TMPT_UI?.toast('Kunci API AI berhasil disimpan.', 'success');
    });
  }

  // Tabs switcher
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target.getAttribute('data-tab');
      switchTab(target);
    });
  });

  // Subtabs switcher
  document.querySelectorAll('.btn-subtab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabId = e.target.closest('.tab-content').id;
      const subtab = e.target.getAttribute('data-subtab');
      
      e.target.parentNode.querySelectorAll('.btn-subtab').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');

      switchSubtab(tabId, subtab);
    });
  });

  // Replace live input
  document.getElementById('replace-input').addEventListener('input', (e) => {
    currentSession.replace_str = e.target.value;
    runReplace();
    triggerAutosave();
  });

  // AI Buttons
  document.getElementById('btn-ai-generate').addEventListener('click', async () => {
    const prompt = document.getElementById('ai-prompt-generate').value.trim();
    if (!prompt) return;
    const output = document.getElementById('ai-generate-output');
    output.style.display = 'block';
    output.innerHTML = '<span aria-busy="true">Mencari solusi dari Claude AI...</span>';
    
    try {
      const data = await generateRegex(prompt);
      elPattern.value = data.pattern;
      elFlags.value = data.flags || '';
      currentSession.pattern = data.pattern;
      currentSession.flags = data.flags || '';
      
      output.innerHTML = `
        <article style="margin-top:0.5rem; padding: 0.75rem; border-radius: 6px; background-color: var(--pico-code-background-color);">
          <strong style="color:var(--pico-primary);">Pola Hasil AI:</strong> <code>/${data.pattern}/${data.flags || ''}</code>
          <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">${data.explanation}</p>
          ${data.examples ? `<div style="font-size:0.8rem; margin-top:0.5rem;"><strong>Contoh Cocok:</strong> ${data.examples.join(', ')}</div>` : ''}
        </article>
      `;

      runRealtimeRegex();
      triggerAutosave();
    } catch (err) {
      output.innerHTML = `<span style="color:#ef4444;">Error: ${err.message}</span>`;
    }
  });

  document.getElementById('btn-ai-explain').addEventListener('click', async () => {
    const output = document.getElementById('ai-explain-output');
    output.innerHTML = '<span aria-busy="true">Membuat penjelasan AI...</span>';
    try {
      const response = await explainRegexWithAI(elPattern.value, elFlags.value);
      output.innerHTML = `<div style="white-space: pre-wrap; font-size:0.95rem; line-height:1.6;">${escapeHtml(response)}</div>`;
    } catch (err) {
      output.innerHTML = `<span style="color:#ef4444;">Error: ${err.message}</span>`;
    }
  });

  document.getElementById('btn-ai-fix').addEventListener('click', async () => {
    const output = document.getElementById('ai-fix-output');
    output.innerHTML = '<span aria-busy="true">Menganalisis pola...</span>';
    try {
      const response = await fixRegexWithAI(elPattern.value, elFlags.value);
      output.innerHTML = `<div style="white-space: pre-wrap; font-size:0.95rem; line-height:1.6;">${escapeHtml(response)}</div>`;
    } catch (err) {
      output.innerHTML = `<span style="color:#ef4444;">Error: ${err.message}</span>`;
    }
  });

  document.getElementById('btn-ai-dataset').addEventListener('click', async () => {
    const output = document.getElementById('ai-dataset-output');
    output.innerHTML = '<span aria-busy="true">Menghasilkan dataset uji...</span>';
    try {
      const data = await generateDatasetWithAI(elPattern.value, elFlags.value);
      output.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top:0.5rem;">
          <div>
            <strong style="color:#0ca678;">Cocok (Valid):</strong>
            <ul>${data.matching.map(s => `<li><code>${escapeHtml(s)}</code></li>`).join('')}</ul>
          </div>
          <div>
            <strong style="color:#f03e3e;">Tidak Cocok:</strong>
            <ul>${data.non_matching.map(s => `<li><code>${escapeHtml(s)}</code></li>`).join('')}</ul>
          </div>
        </div>
      `;
    } catch (err) {
      output.innerHTML = `<span style="color:#ef4444;">Error: ${err.message}</span>`;
    }
  });

  // Security Buttons
  document.getElementById('btn-scan-redos').addEventListener('click', () => {
    const container = document.getElementById('redos-scan-results');
    const scan = detectReDoS(elPattern.value);
    
    if (!scan.vulnerable) {
      container.innerHTML = `
        <div class="redos-badge safe">Aman — Tidak terdeteksi kerentanan ReDoS</div>
        <p style="font-size:0.9rem;">Pola regex Anda tampak kokoh dan bebas dari kerentanan backtracking eksponensial standar.</p>
      `;
      return;
    }

    container.innerHTML = `
      <div class="redos-badge ${scan.score.toLowerCase()}">${scan.score.toUpperCase()} — Berpotensi ReDoS</div>
      <div style="display:flex; flex-direction:column; gap:0.5rem;">
        ${scan.findings.map(f => `
          <div style="border-left: 3px solid #ef4444; padding-left: 0.5rem;">
            <strong>${f.name}</strong>
            <p style="margin:0; font-size:0.85rem;" class="secondary">${f.description}</p>
            ${f.exploit ? `<code style="font-size:0.8rem; display:block; margin-top:0.25rem;">Rekomendasi Exploit: ${f.exploit}</code>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  });

  document.getElementById('btn-analyze-perf').addEventListener('click', () => {
    const container = document.getElementById('perf-results-container');
    const result = analyzePerformance(elPattern.value, elFlags.value);
    
    if (!result || !result.success) {
      container.innerHTML = `<span style="color:#ef4444;">Error: ${result ? result.error : 'Pola kosong.'}</span>`;
      return;
    }

    container.innerHTML = `
      <table class="perf-table">
        <thead>
          <tr>
            <th>Ukuran Data</th>
            <th>Rata-rata (ms)</th>
            <th>Total Waktu (ms)</th>
          </tr>
        </thead>
        <tbody>
          ${result.results.map(r => `
            <tr>
              <td>${r.size} karakter</td>
              <td>${r.avgMs} ms</td>
              <td>${r.totalMs} ms</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  });

  // DevOps: Unit Tests
  document.getElementById('btn-add-testcase').addEventListener('click', () => {
    document.getElementById('tc-input-string').value = '';
    document.getElementById('tc-expect').value = 'match';
    document.getElementById('modal-testcase-editor').showModal();
  });

  document.getElementById('form-testcase').addEventListener('submit', () => {
    const input = document.getElementById('tc-input-string').value;
    const expect = document.getElementById('tc-expect').value;

    currentSession.test_cases.push({
      id: crypto.randomUUID(),
      input,
      expect
    });

    document.getElementById('modal-testcase-editor').close();
    renderTestSuiteResults();
    triggerAutosave();
  });

  document.getElementById('btn-run-tests').addEventListener('click', () => {
    runDevOpsTests();
  });

  // DevOps: Benchmark A vs B
  document.getElementById('btn-run-benchmark').addEventListener('click', () => {
    const patternA = document.getElementById('bench-regex-a').value;
    const patternB = document.getElementById('bench-regex-b').value;
    const results = document.getElementById('benchmark-results');
    
    results.innerHTML = '<span aria-busy="true">Menghitung performa...</span>';
    setTimeout(() => {
      const stats = benchmarkRegex(patternA, patternB);
      if (!stats || stats.error) {
        results.innerHTML = `<span style="color:#ef4444;">Error: ${stats ? stats.error : 'Masukkan kedua pola.'}</span>`;
        return;
      }

      results.innerHTML = `
        <div style="background-color: var(--pico-code-background-color); padding: 0.75rem; border-radius: 8px;">
          <strong>Hasil Benchmark (1000 iterasi):</strong>
          <ul style="margin: 0.5rem 0 0 0; padding-left: 1.25rem;">
            <li>Regex A: <strong>${stats.elapsedA} ms</strong></li>
            <li>Regex B: <strong>${stats.elapsedB} ms</strong></li>
            <li style="margin-top:0.5rem; color:var(--pico-primary);">
              🏆 <strong>Regex ${stats.faster}</strong> lebih cepat sekitar <strong>${stats.ratio}x</strong>
            </li>
          </ul>
        </div>
      `;
    }, 50);
  });

  // DevOps: File Testing
  const fileUpload = document.getElementById('file-test-upload');
  fileUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      selectedFileToTest = file;
      document.getElementById('file-test-meta').textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      document.getElementById('btn-run-filetest').removeAttribute('disabled');
    }
  });

  document.getElementById('btn-run-filetest').addEventListener('click', async () => {
    if (!selectedFileToTest) return;
    const output = document.getElementById('filetest-results');
    output.innerHTML = '<span aria-busy="true">Mencocokkan baris file...</span>';

    try {
      const result = await testRegexOnFile(selectedFileToTest, elPattern.value, elFlags.value);
      output.innerHTML = `
        <div style="font-size:0.9rem; margin-bottom: 0.5rem;">
          Total baris: <strong>${result.totalLines}</strong> | Baris cocok: <strong>${result.matchedLines}</strong> (Total: ${result.totalMatches} matches)
        </div>
        <div style="max-height: 180px; overflow-y:auto; border: 1px solid var(--pico-border-color); border-radius: 6px;">
          ${result.previewMatches.map(m => `
            <div style="padding:0.25rem 0.5rem; border-bottom:1px solid var(--pico-border-color); font-size:0.8rem; font-family:var(--pico-font-family-monospace);">
              <span class="secondary">Ln ${m.lineNumber}:</span> ${escapeHtml(m.content)}
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      output.innerHTML = `<span style="color:#ef4444;">Error: ${err.message}</span>`;
    }
  });

  // DevOps: Code Gen
  document.querySelectorAll('.btn-langtab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.parentNode.querySelectorAll('.btn-langtab').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentLanguage = e.target.getAttribute('data-lang');
      runCodeGen();
    });
  });

  // Library pattern search
  document.getElementById('search-patterns').addEventListener('input', (e) => {
    renderLibraryPatternsList(e.target.value);
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  document.querySelectorAll('.tab-content').forEach(content => {
    if (content.id === tabId) content.classList.add('active');
    else content.classList.remove('active');
  });

  activeTab = tabId;
  runTabTriggeredActions();
}

function switchSubtab(tabId, subtab) {
  activeSubtab = subtab;
  
  // Cari semua subtab content di tab yang aktif dan toggle display
  const contentPane = document.getElementById(tabId);
  contentPane.querySelectorAll('.subtab-content').forEach(content => {
    if (content.id === `sub-${subtab}`) {
      content.style.display = 'block';
    } else {
      content.style.display = 'none';
    }
  });

  runTabTriggeredActions();
}

function runTabTriggeredActions() {
  if (activeTab === 'tab-replace') {
    runReplace();
  } else if (activeTab === 'tab-explain') {
    runExplainAST();
  } else if (activeTab === 'tab-devops') {
    renderTestSuiteResults();
  }
}

// Coordinate session apply
function applySessionToUI() {
  elPattern.value = currentSession.pattern;
  elFlags.value = currentSession.flags ? currentSession.flags.split('').join(', ') : '';
  elTestInput.value = currentSession.test_string;
  document.getElementById('replace-input').value = currentSession.replace_str || '';
  
  // Sync checkboxes in dropdown
  const flagsDropdown = document.getElementById('flags-dropdown-list');
  if (flagsDropdown) {
    flagsDropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = currentSession.flags.includes(cb.value);
    });
  }
}

async function startNewSession() {
  currentSession = {
    id: crypto.randomUUID(),
    title: 'Sesi Baru',
    pattern: '',
    flags: 'g',
    test_string: '',
    replace_str: '',
    test_cases: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  applySessionToUI();
  runRealtimeRegex();
  await loadSessionsList();
}

// Autosave pattern
function triggerAutosave() {
  clearTimeout(autosaveTimer);
  triggerSaveStatus('pending');
  
  autosaveTimer = setTimeout(async () => {
    triggerSaveStatus('saving');
    await saveCurrentSession();
    triggerSaveStatus('saved');
    await loadSessionsList();
  }, 1500);
}

function triggerSaveStatus(status) {
  if (status === 'pending') {
    elSaveStatus.textContent = 'Ada perubahan...';
  } else if (status === 'saving') {
    elSaveStatus.textContent = 'Menyimpan...';
  } else {
    elSaveStatus.textContent = 'Tersimpan ✓';
  }
}

async function saveCurrentSession() {
  // Update metadata
  if (!currentSession.pattern) return;
  currentSession.title = currentSession.pattern.slice(0, 20) || 'Sesi Baru';
  await saveSession(currentSession);
  
  // Sync dengan Berkas (compat rule)
  broadcastTMPT('FILE_UPDATED', {
    id: currentSession.id,
    type: 'regex',
    title: currentSession.title,
    app_db: 'tmpt_regex',
    app_link: `/app/dev/regex/?id=${currentSession.id}`
  });
}

async function loadSessionsList() {
  const list = await getAllSessions();
  const container = document.getElementById('sessions-history-list');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = '<span class="secondary" style="font-size:0.8rem;">Belum ada riwayat sesi.</span>';
    return;
  }

  container.innerHTML = list.map(item => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:0.4rem; border-radius:6px; background-color: var(--pico-form-element-background-color);">
      <a href="#" class="btn-load-session" data-id="${item.id}" style="font-family:var(--pico-font-family-monospace); font-size:0.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex-grow:1; text-decoration:none;">
        /${escapeHtml(item.pattern)}/
      </a>
      <a href="#" class="btn-delete-session" data-id="${item.id}" style="color:#ef4444; font-size:0.9rem; text-decoration:none; margin-left:0.5rem;">✕</a>
    </div>
  `).join('');

  // Load session listeners
  container.querySelectorAll('.btn-load-session').forEach(a => {
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = e.target.getAttribute('data-id');
      const session = await getSession(id);
      if (session) {
        currentSession = session;
        applySessionToUI();
        runRealtimeRegex();
        runTabTriggeredActions();
      }
    });
  });

  // Delete session listeners
  container.querySelectorAll('.btn-delete-session').forEach(a => {
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = e.target.getAttribute('data-id');
      await deleteSession(id);
      await loadSessionsList();
      window.TMPT_UI?.toast('Sesi berhasil dihapus.', 'success');
    });
  });
}

// Match logic runners
function runRealtimeRegex() {
  const pattern = elPattern.value;
  const flags = elFlags.value;
  const text = elTestInput.value;

  const errorMsg = document.getElementById('pattern-error-msg');
  errorMsg.style.display = 'none';

  if (!pattern) {
    elTestBackdrop.innerHTML = escapeHtml(text);
    return;
  }

  const start = performance.now();
  try {
    const highlighted = highlightMatches(text, pattern, flags);
    elTestBackdrop.innerHTML = highlighted;

    const details = getMatchDetails(text, pattern, flags);
    const elapsed = performance.now() - start;

    // Update stats summary
    document.getElementById('match-summary-stats').textContent = `${details.length} matches · ${elapsed.toFixed(1)}ms`;

    // Render matches in Studio list
    renderMatchDetails(details);
    
    // Auto sync scroll
    elTestBackdrop.scrollTop = elTestInput.scrollTop;
  } catch (err) {
    errorMsg.style.display = 'block';
    errorMsg.textContent = err.message;
    elTestBackdrop.innerHTML = escapeHtml(text);
  }
}

function renderMatchDetails(details) {
  const container = document.getElementById('match-details-list');
  if (details.length === 0) {
    container.innerHTML = '<p class="secondary" style="font-size: 0.9rem;">Belum ada kecocokan.</p>';
    return;
  }

  container.innerHTML = details.map(d => `
    <div style="border-bottom: 1px solid var(--pico-border-color); padding: 0.5rem 0;">
      <strong style="color: var(--pico-primary);">Kecocokan ${d.index + 1}:</strong> <code>"${escapeHtml(d.fullMatch)}"</code> <span class="secondary" style="font-size:0.8rem;">(Indeks: ${d.start} → ${d.end})</span>
      ${d.groups.length > 0 ? `
        <div style="margin-left: 1rem; margin-top:0.25rem; font-size: 0.85rem;">
          ${d.groups.map(g => `<div>Grup ${g.number}: <code>"${escapeHtml(g.value)}"</code></div>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');
}

function runReplace() {
  const pattern = elPattern.value;
  const flags = elFlags.value;
  const text = elTestInput.value;
  const replaceStr = document.getElementById('replace-input').value;

  const result = applyReplace(pattern, flags, text, replaceStr);
  const container = document.getElementById('replace-result');

  if (!result.success) {
    container.innerHTML = `<span style="color:#ef4444;">Error: ${result.error}</span>`;
  } else {
    container.textContent = result.replaced;
  }
}

function runExplainAST() {
  const pattern = elPattern.value;
  const flags = elFlags.value;
  const container = document.getElementById('explain-list');

  const explanations = explainRegex(pattern, flags);
  if (explanations.length === 0) {
    container.innerHTML = '<p class="secondary" style="font-size: 0.9rem;">Masukkan pola regex valid.</p>';
    return;
  }

  container.innerHTML = explanations.map(exp => `
    <div class="explain-token">
      <span class="explain-token-part">${escapeHtml(exp.token)}</span>
      <div class="explain-token-desc">
        <strong>${exp.type}</strong>
        <p style="margin:0; font-size:0.85rem;" class="secondary">${exp.desc}</p>
      </div>
    </div>
  `).join('');
}

function runVisualGraph() {
  const pattern = elPattern.value;
  const flags = elFlags.value;
  const container = document.getElementById('visual-graph-mermaid');

  const syntax = regexToMermaid(pattern, flags);
  container.removeAttribute('data-processed');
  container.textContent = syntax;

  if (window.mermaid) {
    try {
      window.mermaid.run({ nodes: [container] });
    } catch (err) {
      console.error(err);
    }
  }
}

// DevOps Test suite rendering
function renderTestSuiteResults() {
  const container = document.getElementById('test-suite-results');
  const tcs = currentSession.test_cases || [];

  if (tcs.length === 0) {
    container.innerHTML = '<p class="secondary" style="font-size: 0.9rem;">Belum ada skenario uji yang dibuat.</p>';
    return;
  }

  container.innerHTML = tcs.map((tc, index) => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.4rem; border-bottom: 1px solid var(--pico-border-color); font-size: 0.85rem;">
      <span style="font-family:var(--pico-font-family-monospace);">"${escapeHtml(tc.input)}"</span>
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <span class="secondary">Ekspektasi: ${tc.expect}</span>
        <span id="tc-result-${tc.id}" style="font-weight:bold;">-</span>
        <button class="outline btn-delete-tc" data-id="${tc.id}" style="padding:0.15rem 0.35rem; font-size:0.75rem; margin:0; border-color:#ef4444; color:#ef4444;">Hapus</button>
      </div>
    </div>
  `).join('');

  // Setup delete buttons
  container.querySelectorAll('.btn-delete-tc').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      currentSession.test_cases = currentSession.test_cases.filter(tc => tc.id !== id);
      renderTestSuiteResults();
      triggerAutosave();
    });
  });
}

function runDevOpsTests() {
  const pattern = elPattern.value;
  const flags = elFlags.value;
  const tcs = currentSession.test_cases || [];

  const results = runTestSuite(pattern, flags, tcs);
  results.results.forEach(res => {
    const el = document.getElementById(`tc-result-${res.id}`);
    if (el) {
      if (res.passed) {
        el.textContent = '✅ LULUS';
        el.style.color = '#0ca678';
      } else {
        el.textContent = '❌ GAGAL';
        el.style.color = '#f03e3e';
      }
    }
  });

  window.TMPT_UI?.toast(`Pengujian selesai: ${results.passed} Lulus, ${results.failed} Gagal.`, results.failed > 0 ? 'warning' : 'success');
}

// Code Generation
function runCodeGen() {
  const pattern = elPattern.value;
  const flags = elFlags.value;
  const container = document.getElementById('codegen-output');

  if (currentLanguage === 'sql') {
    container.textContent = regexToSQL(pattern, 'kolom_tabel', 'postgresql');
  } else {
    container.textContent = generateCode(pattern, flags, currentLanguage);
  }
}

// Engine Matrix
async function loadEngineMatrix() {
  const features = await loadEngineCompatibility();
  const container = document.getElementById('engine-compat-rows');
  if (!container) return;

  container.innerHTML = features.map(f => `
    <tr>
      <td>
        <strong>${f.name}</strong><br>
        <small class="secondary">${f.description}</small>
      </td>
      <td>${f.javascript.supported ? '✅' : '❌'} <small class="secondary">${f.javascript.note || ''}</small></td>
      <td>${f.python.supported ? '✅' : '❌'} <small class="secondary">${f.python.note || ''}</small></td>
      <td>${f.go_re2.supported ? '✅' : '❌'} <small class="secondary">${f.go_re2.note || ''}</small></td>
      <td>${f.java.supported ? '✅' : '❌'} <small class="secondary">${f.java.note || ''}</small></td>
      <td>${f.pcre.supported ? '✅' : '❌'} <small class="secondary">${f.pcre.note || ''}</small></td>
    </tr>
  `).join('');
}

// Library & Cheatsheet
async function loadLibraryPatterns() {
  builtinPatternsCache = await loadBuiltInPatterns();
  renderLibraryPatternsList();
}

function renderLibraryPatternsList(query = '') {
  const container = document.getElementById('patterns-list-grid');
  if (!container) return;

  const filtered = filterPatterns(builtinPatternsCache, query);

  if (filtered.length === 0) {
    container.innerHTML = '<span class="secondary" style="font-size:0.85rem;">Pola tidak ditemukan.</span>';
    return;
  }

  container.innerHTML = filtered.map(item => `
    <div class="pattern-item-row" style="padding:0.75rem; border-bottom:1px solid var(--pico-border-color); display:flex; justify-content:space-between; align-items:center;">
      <div style="flex-grow:1; margin-right: 1rem;">
        <strong>${escapeHtml(item.title)}</strong> <span class="secondary" style="font-size:0.75rem; background-color:var(--pico-code-background-color); padding:0.1rem 0.3rem; border-radius:4px;">${item.category}</span>
        <p style="margin: 0.25rem 0 0 0; font-size:0.8rem;" class="secondary">${item.description}</p>
        <code style="font-size:0.75rem; display:block; margin-top:0.25rem;">/${item.pattern}/${item.flags}</code>
      </div>
      <button class="outline btn-select-pattern" data-pattern="${escapeHtml(item.pattern)}" data-flags="${item.flags}" style="padding:0.2rem 0.5rem; font-size:0.8rem; margin:0; width:auto;">Pilih</button>
    </div>
  `).join('');

  container.querySelectorAll('.btn-select-pattern').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const p = e.target.getAttribute('data-pattern');
      const f = e.target.getAttribute('data-flags');
      
      elPattern.value = p;
      elFlags.value = f;
      currentSession.pattern = p;
      currentSession.flags = f;
      
      runRealtimeRegex();
      switchTab('tab-studio');
      window.TMPT_UI?.toast('Pola pustaka berhasil dimuat ke Studio.', 'success');
      triggerAutosave();
    });
  });
}

function loadCheatsheet() {
  const container = document.getElementById('cheatsheet-container');
  if (!container) return;

  const list = getCheatsheetData();
  container.innerHTML = list.map(item => `
    <div class="cheatsheet-item" data-token="${escapeHtml(item.token)}">
      <span>${escapeHtml(item.token)}</span> - ${item.label}
      <div class="secondary" style="font-size:0.75rem; margin-top:0.15rem;">${item.desc}</div>
    </div>
  `).join('');

  container.querySelectorAll('.cheatsheet-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const token = e.currentTarget.getAttribute('data-token');
      insertTokenAtCursor(token);
    });
  });
}

function insertTokenAtCursor(token) {
  const start = elPattern.selectionStart;
  const end = elPattern.selectionEnd;
  const text = elPattern.value;
  const before = text.substring(0, start);
  const after = text.substring(end, text.length);
  
  elPattern.value = before + token + after;
  elPattern.selectionStart = elPattern.selectionEnd = start + token.length;
  elPattern.focus();
  
  currentSession.pattern = elPattern.value;
  runRealtimeRegex();
  triggerAutosave();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
