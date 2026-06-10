// app/dev/json/js/json-app.js
import { getAllSessions, getSession, saveSession, createNewSession, deleteSessionRecord } from './session-manager.js';
import * as tools from './tools.js';

// Global variables
let editor = null;
let currentSession = null;
let sessionsList = [];
let viewMode = 'text'; // 'text' | 'tree' | 'table' | 'split'
let activeTool = 'none'; // 'none' | 'validate' | 'diff' | 'query' | 'transform' | 'convert' | 'api' | 'security' | 'generator'
let autosaveTimer = null;

// Monaco Editor setup
function updateMonacoTheme() {
  if (typeof monaco !== 'undefined' && editor) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs');
  }
}

function initMonaco() {
  return new Promise((resolve) => {
    require.config({ paths: { 'vs': '/app/dev/code/vendor/monaco/vs' } });
    require(['vs/editor/editor.main'], function() {
      // Create Monaco instance
      const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'vs-dark' : 'vs';
      editor = monaco.editor.create(document.getElementById('monaco-editor-host'), {
        value: '',
        language: 'json',
        theme: currentTheme,
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        formatOnPaste: true,
        wordWrap: 'on'
      });

      // Observer untuk sinkronisasi tema dengan Monaco secara realtime
      const themeObserver = new MutationObserver(() => {
        updateMonacoTheme();
      });
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

      // Handle content change events
      editor.onDidChangeModelContent(() => {
        if (currentSession) {
          currentSession.content = editor.getValue();
          triggerAutosave();
          updateStatusBar();
        }
      });

      // Track cursor position
      editor.onDidChangeCursorPosition((e) => {
        document.getElementById('stat-cursor').textContent = `Baris ${e.position.lineNumber}, Kolom ${e.position.column}`;
      });

      resolve();
    });
  });
}

// ── Autosave debouncer ──
function triggerAutosave() {
  clearTimeout(autosaveTimer);
  document.getElementById('save-status').textContent = 'Ada perubahan...';
  autosaveTimer = setTimeout(async () => {
    if (currentSession) {
      document.getElementById('save-status').textContent = 'Menyimpan...';
      await saveSession(currentSession);
      document.getElementById('save-status').textContent = 'Tersimpan ✓';
      // Sync history log
      addToHistoryLog('Sesi Disimpan');
    }
  }, 2000);
}

// ── Tab Management ──
async function loadSessions(selectedId = null) {
  sessionsList = await getAllSessions();
  
  if (sessionsList.length === 0) {
    // Create first default session
    const defaultSession = await createNewSession('Untitled.json', '{\n  "status": "success",\n  "message": "Selamat datang di TMPT JSON Visual Data Studio!"\n}');
    sessionsList.unshift(defaultSession);
  }

  renderSidebarSessions();
  renderTabHeaders();

  // Pick active session
  let sessionToActivate = sessionsList[0];
  if (selectedId) {
    sessionToActivate = sessionsList.find(s => s.id === selectedId) || sessionsList[0];
  }
  await activateSession(sessionToActivate.id);
}

function renderSidebarSessions() {
  const container = document.getElementById('sessions-list');
  container.innerHTML = '';
  sessionsList.forEach(session => {
    const item = document.createElement('div');
    item.className = `session-item ${currentSession && currentSession.id === session.id ? 'active' : ''}`;
    item.dataset.id = session.id;
    
    const title = document.createElement('span');
    title.className = 'session-item-title';
    title.textContent = session.title;
    title.addEventListener('click', () => activateSession(session.id));

    const closeBtn = document.createElement('button');
    closeBtn.className = 'session-item-close';
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSession(session.id);
    });

    item.appendChild(title);
    item.appendChild(closeBtn);
    container.appendChild(item);
  });
}

function renderTabHeaders() {
  const container = document.getElementById('tabs-headers');
  container.innerHTML = '';
  sessionsList.forEach(session => {
    const tab = document.createElement('div');
    tab.className = `session-tab ${currentSession && currentSession.id === session.id ? 'active' : ''}`;
    tab.dataset.id = session.id;
    
    const title = document.createElement('span');
    title.textContent = session.title;
    title.addEventListener('click', () => activateSession(session.id));

    const closeBtn = document.createElement('span');
    closeBtn.className = 'session-tab-close';
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSession(session.id);
    });

    tab.appendChild(title);
    tab.appendChild(closeBtn);
    container.appendChild(tab);
  });
}

async function activateSession(id) {
  if (currentSession && autosaveTimer) {
    clearTimeout(autosaveTimer);
    await saveSession(currentSession);
  }

  currentSession = await getSession(id);
  if (!currentSession) return;

  // Set editor value
  if (editor) {
    editor.setValue(currentSession.content || '');
  }

  // Update tabs visual style
  document.querySelectorAll('.session-tab, .session-item').forEach(el => {
    if (el.dataset.id === id) el.classList.add('active');
    else el.classList.remove('active');
  });

  // Load view mode preference
  setViewMode(currentSession.view_mode || 'text');
  
  // Close active tool panel if session doesn't use it
  if (currentSession.active_tool && currentSession.active_tool !== 'none') {
    openToolPanel(currentSession.active_tool);
  } else {
    closeToolPanel();
  }

  updateStatusBar();
  addToHistoryLog('Sesi Aktif: ' + currentSession.title);
}

async function closeSession(id) {
  const nextSession = sessionsList.find(s => s.id !== id);
  await deleteSessionRecord(id);
  
  sessionsList = sessionsList.filter(s => s.id !== id);
  if (sessionsList.length === 0) {
    const fresh = await createNewSession();
    sessionsList.unshift(fresh);
    await activateSession(fresh.id);
  } else if (currentSession && currentSession.id === id) {
    await activateSession(nextSession.id);
  } else {
    await loadSessions(currentSession ? currentSession.id : null);
  }
}

// ── View Mode Switching ──
function setViewMode(mode) {
  viewMode = mode;
  if (currentSession) {
    currentSession.view_mode = mode;
    saveSession(currentSession);
  }

  // Highlight button
  document.querySelectorAll('.view-mode-btn').forEach(btn => {
    if (btn.dataset.mode === mode) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  // Hide all panels
  document.querySelectorAll('.content-view-panel').forEach(p => p.classList.add('hidden'));

  if (mode === 'text') {
    document.getElementById('view-text').classList.remove('hidden');
  } else if (mode === 'tree') {
    document.getElementById('view-tree').classList.remove('hidden');
    renderInteractiveTree();
  } else if (mode === 'table') {
    document.getElementById('view-table').classList.remove('hidden');
    renderTableSpreadsheet();
  } else if (mode === 'split') {
    const viewSplit = document.getElementById('view-split');
    viewSplit.classList.remove('hidden');
    
    // Mount editor on left of split, visual on right of split
    const splitEditor = document.getElementById('split-editor-host');
    const splitVisual = document.getElementById('split-visual-host');
    
    splitEditor.innerHTML = '';
    splitVisual.innerHTML = '';
    
    splitEditor.appendChild(document.getElementById('monaco-editor-host'));
    
    // Add custom visual renderer container
    const visualContainer = document.createElement('div');
    visualContainer.className = 'tree-interactive-container';
    visualContainer.style.padding = '1rem';
    splitVisual.appendChild(visualContainer);
    
    try {
      const parsed = JSON.parse(editor.getValue());
      visualContainer.appendChild(renderNode('$', 'root', parsed, 0));
    } catch(e) {
      visualContainer.textContent = 'JSON tidak valid untuk pratinjau split visual.';
    }
  }

  // Return editor to its original place if not in split mode
  if (mode !== 'split') {
    document.getElementById('view-text').appendChild(document.getElementById('monaco-editor-host'));
  }
}

// ── Interactive Tree View Rendering ──
function renderInteractiveTree() {
  const container = document.getElementById('tree-root-host');
  container.innerHTML = '';
  try {
    const parsed = JSON.parse(editor.getValue() || '{}');
    container.appendChild(renderNode('$', 'root', parsed, 0));
  } catch(e) {
    container.textContent = 'JSON tidak valid. Gunakan "Repair" atau perbaiki kesalahan di editor teks.';
  }
}

function renderNode(path, key, value, depth) {
  const type = value === null ? 'null' : (Array.isArray(value) ? 'array' : typeof value);
  const el = document.createElement('div');
  el.className = `tree-node depth-${depth}`;
  el.dataset.path = path;

  if (type === 'object' || type === 'array') {
    const isArray = type === 'array';
    const count = isArray ? value.length : Object.keys(value).length;
    const summary = isArray ? `[${count} item]` : `{${count} kunci}`;

    const toggle = document.createElement('span');
    toggle.className = 'toggle';
    toggle.textContent = '▾';
    
    const keyEl = document.createElement('span');
    keyEl.className = 'key';
    keyEl.textContent = `${key}`;

    const summaryEl = document.createElement('span');
    summaryEl.className = `summary type-${type}`;
    summaryEl.textContent = summary;

    el.appendChild(toggle);
    el.appendChild(keyEl);
    el.appendChild(document.createTextNode(': '));
    el.appendChild(summaryEl);

    const children = document.createElement('div');
    children.className = 'tree-children';

    const entries = isArray ? value.map((v, i) => [i, v]) : Object.entries(value);
    entries.forEach(([k, v]) => {
      children.appendChild(renderNode(`${path}${isArray ? `[${k}]` : `.${k}`}`, k, v, depth + 1));
    });

    el.appendChild(children);
    toggle.addEventListener('click', () => {
      children.classList.toggle('collapsed');
      toggle.textContent = children.classList.contains('collapsed') ? '▸' : '▾';
    });
  } else {
    const keyEl = document.createElement('span');
    keyEl.className = 'key';
    keyEl.textContent = `${key}`;

    const valueEl = document.createElement('span');
    valueEl.className = `value type-${type}`;
    valueEl.contentEditable = 'true';
    
    if (type === 'string') valueEl.textContent = `"${value}"`;
    else if (type === 'null') valueEl.textContent = 'null';
    else valueEl.textContent = String(value);

    el.appendChild(keyEl);
    el.appendChild(document.createTextNode(': '));
    el.appendChild(valueEl);

    // Save node inline changes
    valueEl.addEventListener('blur', () => {
      try {
        let newVal = valueEl.textContent.trim();
        if (type === 'string') {
          if (newVal.startsWith('"') && newVal.endsWith('"')) newVal = newVal.slice(1, -1);
        } else if (type === 'number') {
          newVal = Number(newVal);
        } else if (type === 'boolean') {
          newVal = newVal === 'true';
        } else if (type === 'null') {
          newVal = null;
        }
        updateJSONNodeByPath(path, newVal);
      } catch(e) {
        console.error(e);
      }
    });
  }

  // Hover details for breadcrumbs
  el.addEventListener('mouseover', (e) => {
    e.stopPropagation();
    document.getElementById('tree-breadcrumb').textContent = path;
  });

  return el;
}

function updateJSONNodeByPath(path, val) {
  try {
    const root = JSON.parse(editor.getValue());
    
    // Evaluate path expression to update property
    if (path === '$') {
      editor.setValue(JSON.stringify(val, null, 2));
    } else {
      // Evaluate direct path assignments safely
      const assignments = path.replace(/^\$/, 'root');
      const setFunc = new Function('root', 'val', `${assignments} = val; return root;`);
      const updated = setFunc(root, val);
      editor.setValue(JSON.stringify(updated, null, 2));
    }
  } catch(e) {
    console.error(e);
  }
}

// ── Table Spreadsheet View Rendering ──
function renderTableSpreadsheet() {
  const container = document.getElementById('table-view-host');
  container.innerHTML = '';
  try {
    const parsed = JSON.parse(editor.getValue());
    const dataArray = Array.isArray(parsed) ? parsed : (typeof parsed === 'object' ? [parsed] : []);
    
    if (dataArray.length === 0) {
      container.innerHTML = '<div style="padding:1rem;">Tabel kosong atau tipe data bukan Array/Objek.</div>';
      return;
    }

    const columns = Array.from(new Set(dataArray.flatMap(Object.keys)));
    const table = document.createElement('table');
    
    // Header
    const trHead = document.createElement('tr');
    trHead.innerHTML = `<th>#</th>` + columns.map(c => `<th>${c}</th>`).join('');
    table.appendChild(trHead);

    // Rows
    dataArray.forEach((row, index) => {
      const tr = document.createElement('tr');
      const cells = columns.map(col => {
        const val = row[col];
        const valStr = val === null || val === undefined ? '' : (typeof val === 'object' ? JSON.stringify(val) : String(val));
        return `<td contenteditable="true" data-row="${index}" data-col="${col}">${valStr}</td>`;
      }).join('');
      tr.innerHTML = `<td>${index + 1}</td>` + cells;
      table.appendChild(tr);
    });

    container.appendChild(table);

    // Dynamic Cell edits
    table.addEventListener('blur', (e) => {
      const td = e.target.closest('td[contenteditable="true"]');
      if (td) {
        const rowIdx = parseInt(td.dataset.row);
        const colName = td.dataset.col;
        const text = td.textContent;
        
        let typedVal = text;
        try {
          typedVal = JSON.parse(text); // Try parse number, boolean, array, object
        } catch(e){}

        dataArray[rowIdx][colName] = typedVal;
        editor.setValue(JSON.stringify(Array.isArray(parsed) ? dataArray : dataArray[0], null, 2));
      }
    }, true);

  } catch(e) {
    container.innerHTML = `<div style="padding:1rem;">Gagal memuat tabel spreadsheet: ${e.message}</div>`;
  }
}

// ── Tool Panel Right Sidebar ──
function openToolPanel(toolName) {
  activeTool = toolName;
  if (currentSession) {
    currentSession.active_tool = toolName;
    saveSession(currentSession);
  }

  // Highlight toolbar button
  document.querySelectorAll('.toolbar-btn').forEach(btn => {
    if (btn.id === `tool-${toolName}`) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  // Hide all tool panel content
  document.querySelectorAll('.tool-content').forEach(el => el.classList.remove('active'));
  
  // Show target tool panel content
  const target = document.getElementById(`tool-content-${toolName}`);
  if (target) {
    target.classList.add('active');
    document.getElementById('active-tool-title').textContent = toolName.toUpperCase();
    document.getElementById('tool-panel-right').classList.remove('collapsed');
  }
}

function closeToolPanel() {
  activeTool = 'none';
  if (currentSession) {
    currentSession.active_tool = 'none';
    saveSession(currentSession);
  }

  document.querySelectorAll('.toolbar-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById('tool-panel-right').classList.add('collapsed');
}

// ── Status Bar Updates ──
async function updateStatusBar() {
  const content = editor ? editor.getValue() : '';
  const size = new Blob([content]).size;
  const lineCount = content.split('\n').length;
  
  const validateResult = await tools.validateJSON(content);
  
  const validEl = document.getElementById('stat-valid');
  if (validateResult.valid) {
    validEl.textContent = 'JSON Valid';
    validEl.style.color = '#10b981';
  } else {
    validEl.textContent = `JSON Error (Baris ${validateResult.error.line}, Kolom ${validateResult.error.column})`;
    validEl.style.color = '#ef4444';
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  document.getElementById('stat-size').textContent = formatBytes(size);
  document.getElementById('stat-lines').textContent = `${lineCount} baris`;
}

// ── History & Audit Log ──
function addToHistoryLog(action) {
  const list = document.getElementById('history-list');
  const item = document.createElement('div');
  item.className = 'history-item';
  
  const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  item.innerHTML = `<span>${action}</span><span class="secondary">${time}</span>`;
  
  list.insertBefore(item, list.firstChild);
  if (list.children.length > 5) {
    list.lastChild.remove();
  }
}

// ── Wire up Tool actions ──
function setupToolEventListeners() {
  // Validate schema
  document.getElementById('btn-run-schema-validation').addEventListener('click', async () => {
    const dataText = editor.getValue();
    const schemaText = document.getElementById('schema-editor-input').value;
    const draft = document.getElementById('validation-schema-select').value;
    
    document.getElementById('validate-results').textContent = 'Memvalidasi...';
    const result = await tools.validateWithSchema(dataText, schemaText, draft);
    
    const resultsBox = document.getElementById('validate-results');
    if (result.valid) {
      resultsBox.innerHTML = '<span style="color:#10b981; font-weight:700;">✅ Valid! Data sesuai dengan schema.</span>';
    } else if (result.error) {
      resultsBox.innerHTML = `<span style="color:#ef4444; font-weight:700;">❌ Kesalahan Validasi:</span><br>${result.error}`;
    } else {
      const errList = result.errors.map(e => `• <b>${e.path}</b>: ${e.message} (${e.keyword})`).join('<br>');
      resultsBox.innerHTML = `<span style="color:#ef4444; font-weight:700;">❌ Ditemukan kesalahan schema:</span><br>${errList}`;
    }
  });

  // Query engine
  document.getElementById('btn-run-query').addEventListener('click', async () => {
    try {
      const data = JSON.parse(editor.getValue());
      const expression = document.getElementById('query-expression-input').value;
      const engine = document.getElementById('query-engine-select').value;
      
      const res = await tools.runQuery(data, expression, engine);
      const output = document.getElementById('query-results');
      if (res.success) {
        output.textContent = JSON.stringify(res.result, null, 2);
      } else {
        output.textContent = 'Error: ' + res.error;
      }
    } catch(e) {
      document.getElementById('query-results').textContent = 'JSON tidak valid untuk kueri.';
    }
  });

  // Transform engine
  document.getElementById('btn-run-transform').addEventListener('click', async () => {
    try {
      const data = JSON.parse(editor.getValue());
      const expr = document.getElementById('transform-expr-input').value;
      
      const res = await tools.runTransform(data, expr);
      const output = document.getElementById('transform-results');
      if (res.success) {
        output.textContent = JSON.stringify(res.result, null, 2);
      } else {
        output.textContent = 'Error: ' + res.error;
      }
    } catch(e) {
      document.getElementById('transform-results').textContent = 'JSON tidak valid untuk transformasi.';
    }
  });

  // Conversions
  document.getElementById('convert-format-select').addEventListener('change', (e) => {
    const val = e.target.value;
    document.getElementById('csv-options-box').classList.add('hidden');
    document.getElementById('sql-options-box').classList.add('hidden');

    if (val === 'csv') document.getElementById('csv-options-box').classList.remove('hidden');
    else if (val === 'sql') document.getElementById('sql-options-box').classList.remove('hidden');
  });

  document.getElementById('btn-convert-to-json').addEventListener('click', async () => {
    const sourceText = document.getElementById('convert-results').textContent || '';
    const format = document.getElementById('convert-format-select').value;
    let res;

    if (format === 'yaml') res = await tools.yamlToJSON(sourceText);
    else if (format === 'xml') res = await tools.xmlToJSON(sourceText);
    else if (format === 'csv') res = await tools.csvToJSON(sourceText);
    else if (format === 'toml') res = await tools.tomlToJSON(sourceText);

    if (res && res.success) {
      editor.setValue(JSON.stringify(res.data, null, 2));
      document.getElementById('convert-results').textContent = 'Berhasil diimpor ke Editor Kiri!';
    } else {
      document.getElementById('convert-results').textContent = 'Gagal konversi ke JSON: ' + (res?.error || 'Format tidak didukung');
    }
  });

  document.getElementById('btn-convert-from-json').addEventListener('click', async () => {
    try {
      const data = JSON.parse(editor.getValue());
      const format = document.getElementById('convert-format-select').value;
      let res = { success: false };

      if (format === 'yaml') res = await tools.jsonToYAML(data);
      else if (format === 'xml') res = await tools.jsonToXML(data);
      else if (format === 'csv') res = await tools.jsonToCSV(data);
      else if (format === 'toml') res = await tools.jsonToTOML(data);
      else if (format === 'sql') {
        const tbl = document.getElementById('sql-table-name').value || 'users';
        res = { success: true, data: tools.jsonToSQLInsert(data, tbl) };
      }

      if (res.success) {
        document.getElementById('convert-results').textContent = res.data;
      } else {
        document.getElementById('convert-results').textContent = 'Gagal konversi dari JSON: ' + res.error;
      }
    } catch(e) {
      document.getElementById('convert-results').textContent = 'JSON tidak valid untuk konversi.';
    }
  });

  // REST API Tester
  document.getElementById('btn-api-send').addEventListener('click', async () => {
    const request = {
      method: document.getElementById('api-method').value,
      url: document.getElementById('api-url').value,
      headers: document.getElementById('api-headers-json').value,
      body: editor.getValue(),
      auth: {
        type: document.getElementById('api-auth-type').value,
        token: document.getElementById('api-auth-token').value,
        username: document.getElementById('api-auth-user').value,
        password: document.getElementById('api-auth-pass').value
      }
    };

    const resultsBox = document.getElementById('api-results');
    resultsBox.textContent = 'Mengirim request ke API...';

    const res = await tools.sendRESTRequest(request);
    if (res.success) {
      const statHeader = `<div class="api-response-header"><span>Status: ${res.status} ${res.statusText}</span><span>Waktu: ${res.duration}ms</span></div>`;
      const bodyFormatted = res.json ? JSON.stringify(res.json, null, 2) : res.body;
      resultsBox.innerHTML = statHeader + `<pre style="font-size:0.75rem; margin:0; overflow:auto;"><code>${escapeHtml(bodyFormatted)}</code></pre>`;
    } else {
      resultsBox.textContent = 'Gagal Hit API: ' + res.error;
    }
  });

  document.getElementById('api-auth-type').addEventListener('change', (e) => {
    const val = e.target.value;
    document.getElementById('api-auth-bearer-box').classList.add('hidden');
    document.getElementById('api-auth-basic-box').classList.add('hidden');
    if (val === 'bearer') document.getElementById('api-auth-bearer-box').classList.remove('hidden');
    else if (val === 'basic') document.getElementById('api-auth-basic-box').classList.remove('hidden');
  });

  // Security scan
  document.getElementById('btn-run-security-scan').addEventListener('click', () => {
    const content = editor.getValue();
    const findings = tools.scanJSONSecurity(content);
    const box = document.getElementById('security-results');
    
    if (findings.length === 0) {
      box.innerHTML = '<span style="color:#10b981; font-weight:700;">✅ Aman. Tidak ada data kredensial/PII terdeteksi.</span>';
    } else {
      const list = findings.map(f => `• [Baris ${f.line}] <b>[${f.severity.toUpperCase()}] ${f.type}</b>: ${escapeHtml(f.excerpt)}`).join('<br>');
      box.innerHTML = `<span style="color:#ef4444; font-weight:700;">⚠️ Temuan Keamanan PII:</span><br>${list}`;
    }
  });

  document.getElementById('btn-run-security-mask').addEventListener('click', () => {
    const content = editor.getValue();
    const masked = tools.maskPIIFields(content);
    editor.setValue(masked);
    document.getElementById('security-results').innerHTML = '<span style="color:#3b82f6;">Data kredensial dan PII berhasil di-masking.</span>';
  });

  // Generator
  document.getElementById('btn-run-generate').addEventListener('click', async () => {
    const template = document.getElementById('gen-template').value;
    const count = parseInt(document.getElementById('gen-count').value) || 10;
    const box = document.getElementById('generator-results');
    
    const generateData = async () => {
      box.textContent = 'Sedang membuat dummy data...';
      try {
        const res = await tools.generateDummyData(template, count);
        editor.setValue(JSON.stringify(res, null, 2));
        box.textContent = `Berhasil membuat ${count} baris dummy data!`;
      } catch(err) {
        box.textContent = 'Gagal generate: ' + err.message;
      }
    };

    const currentVal = editor.getValue();
    if (currentVal && currentVal.trim() !== '') {
      const modal = document.getElementById('modal-confirm-overwrite');
      modal.showModal();
      
      const yesBtn = document.getElementById('btn-confirm-overwrite-yes');
      yesBtn.onclick = () => {
        modal.close();
        generateData();
      };
    } else {
      generateData();
    }
  });

  // Diff selector & confirm
  document.getElementById('btn-select-diff-b').addEventListener('click', () => {
    const modal = document.getElementById('modal-select-session');
    const optionsBox = document.getElementById('modal-session-options');
    optionsBox.innerHTML = '';
    
    sessionsList.forEach(s => {
      if (s.id === currentSession.id) return;
      const btn = document.createElement('button');
      btn.className = 'outline secondary btn-sm';
      btn.textContent = s.title;
      btn.onclick = () => {
        document.getElementById('diff-b-name').textContent = `Sesi B: ${s.title}`;
        document.getElementById('diff-b-name').dataset.id = s.id;
        modal.close();
      };
      optionsBox.appendChild(btn);
    });

    if (optionsBox.children.length === 0) {
      optionsBox.innerHTML = '<span class="secondary" style="font-size:0.8rem;">Buat sesi baru terlebih dahulu untuk membandingkan.</span>';
    }

    modal.showModal();
  });

  document.getElementById('btn-run-diff').addEventListener('click', async () => {
    const otherId = document.getElementById('diff-b-name').dataset.id;
    if (!otherId) {
      window.TMPT_UI.toast('Pilih sesi pembanding B terlebih dahulu.', 'error');
      return;
    }

    try {
      const a = JSON.parse(editor.getValue());
      const other = await getSession(otherId);
      const b = JSON.parse(other.content);
      
      const ignoreOrder = document.getElementById('diff-opt-order').checked;
      const ignoreCase = document.getElementById('diff-opt-case').checked;

      const findings = tools.diffJSON(a, b, { ignoreOrder, ignoreCase });
      const resultsBox = document.getElementById('diff-results');

      if (findings.length === 0) {
        resultsBox.innerHTML = '<span style="color:#10b981; font-weight:700;">✅ Tidak ada perbedaan semantik ditemukan!</span>';
      } else {
        const list = findings.map(f => {
          if (f.type === 'changed') return `• 🟡 <b>${f.path}</b>: ${JSON.stringify(f.old)} → ${JSON.stringify(f.new)}`;
          if (f.type === 'added') return `• 🟢 <b>${f.path}</b>: Ditambahkan nilai ${JSON.stringify(f.value)}`;
          if (f.type === 'removed') return `• 🔴 <b>${f.path}</b>: Dihapus`;
          if (f.type === 'type_change') return `• 🔵 <b>${f.path}</b>: Tipe berubah (${f.from} → ${f.to})`;
          return '';
        }).join('<br>');
        resultsBox.innerHTML = `<span style="font-weight:700;">Perbedaan Semantik (${findings.length}):</span><br>${list}`;
      }
    } catch(e) {
      document.getElementById('diff-results').textContent = 'Salah satu JSON tidak valid untuk dibandingkan.';
    }
  });
}

// ── General Page setup ──
async function setupPage() {
  await initMonaco();
  setupToolEventListeners();
  
  // Connect toolbar actions
  const toolBtns = ['format', 'minify', 'repair', 'validate', 'diff', 'query', 'transform', 'convert', 'api', 'security', 'generator'];
  toolBtns.forEach(t => {
    document.getElementById(`tool-${t}`).addEventListener('click', () => {
      if (activeTool === t) closeToolPanel();
      else openToolPanel(t);
    });
  });

  document.getElementById('btn-close-tool-panel').addEventListener('click', closeToolPanel);
  
  // Show hamburger on shared app-header when loaded
  const showHeaderHamburger = () => {
    const headerHamburger = document.getElementById('header-hamburger-container');
    if (headerHamburger) {
      headerHamburger.style.display = 'block';
    }
  };

  // Run immediately and after HTMX swaps
  showHeaderHamburger();
  document.body.addEventListener('htmx:afterOnLoad', showHeaderHamburger);

  document.addEventListener('tmpt:sidebar-toggle', (e) => {
    e.preventDefault();
    const sidebar = document.getElementById('sidebar-panel');
    if (sidebar) {
      sidebar.classList.toggle('collapsed');
    }
  });

  document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
    document.getElementById('sidebar-panel').classList.add('collapsed');
  });

  document.getElementById('btn-new-session').addEventListener('click', async () => {
    const title = await window.TMPT_UI.prompt('Masukkan nama sesi baru:', 'Untitled.json');
    if (title) {
      const s = await createNewSession(title.endsWith('.json') ? title : title + '.json');
      sessionsList.unshift(s);
      renderSidebarSessions();
      renderTabHeaders();
      await activateSession(s.id);
    }
  });

  // Format click action from toolbar
  document.getElementById('tool-format').addEventListener('click', async () => {
    try {
      const val = editor.getValue();
      const formatted = tools.formatJSON(val, { indent: 2 });
      editor.setValue(formatted);
      addToHistoryLog('JSON Diformat');
    } catch(e) {
      window.TMPT_UI.toast('Format gagal: JSON tidak valid', 'error');
    }
  });

  document.getElementById('tool-minify').addEventListener('click', async () => {
    try {
      const val = editor.getValue();
      const minified = tools.minifyJSON(val);
      editor.setValue(minified);
      addToHistoryLog('JSON Diminify');
    } catch(e) {
      window.TMPT_UI.toast('Minify gagal: JSON tidak valid', 'error');
    }
  });

  document.getElementById('tool-repair').addEventListener('click', async () => {
    const val = editor.getValue();
    const res = await tools.repairJSON(val);
    if (res.success) {
      editor.setValue(res.repaired);
      window.TMPT_UI.toast('JSON Berhasil Diperbaiki!', 'success');
      addToHistoryLog('JSON Diperbaiki');
    } else {
      window.TMPT_UI.toast('Perbaikan gagal: ' + res.error, 'error');
    }
  });

  // View toggles
  document.querySelectorAll('.view-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setViewMode(btn.dataset.mode));
  });

  // Import button
  const fileUploader = document.getElementById('file-uploader');
  document.getElementById('btn-import-file').addEventListener('click', () => fileUploader.click());
  fileUploader.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      const text = await file.text();
      const s = await createNewSession(file.name, text);
      sessionsList.unshift(s);
      renderSidebarSessions();
      renderTabHeaders();
      await activateSession(s.id);
    }
  });

  // Export buttons
  document.querySelectorAll('.export-opt').forEach(opt => {
    opt.addEventListener('click', async (e) => {
      e.preventDefault();
      const type = opt.dataset.type;
      const content = editor.getValue();
      
      let finalContent = content;
      let filename = currentSession.title;
      
      try {
        if (type === 'yaml') {
          const res = await tools.jsonToYAML(JSON.parse(content));
          if (res.success) finalContent = res.data;
          filename = filename.replace(/\.json$/, '') + '.yaml';
        } else if (type === 'xml') {
          const res = await tools.jsonToXML(JSON.parse(content));
          if (res.success) finalContent = res.data;
          filename = filename.replace(/\.json$/, '') + '.xml';
        } else if (type === 'csv') {
          const res = await tools.jsonToCSV(JSON.parse(content));
          if (res.success) finalContent = res.data;
          filename = filename.replace(/\.json$/, '') + '.csv';
        } else if (type === 'toml') {
          const res = await tools.jsonToTOML(JSON.parse(content));
          if (res.success) finalContent = res.data;
          filename = filename.replace(/\.json$/, '') + '.toml';
        } else if (type === 'sql') {
          finalContent = tools.jsonToSQLInsert(JSON.parse(content));
          filename = filename.replace(/\.json$/, '') + '.sql';
        }
      } catch (err) {
        window.TMPT_UI.toast('Ekspor gagal: Format JSON tidak valid', 'error');
        return;
      }

      const blob = new Blob([finalContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    });
  });

  // Open direct sessions from URL context passing
  const params = new URLSearchParams(window.location.search);
  const targetSessionId = params.get('id');
  const importOpfsPath = params.get('import_opfs');
  const importName = params.get('name');

  if (importOpfsPath) {
    try {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(importOpfsPath);
      const file = await handle.getFile();
      const text = await file.text();
      const session = await createNewSession(importName || 'Imported.json', text);
      await loadSessions(session.id);
    } catch(e) {
      console.error(e);
      await loadSessions();
    }
  } else {
    await loadSessions(targetSessionId);
  }
}

function escapeHtml(string) {
  return String(string).replace(/[&<>"']/g, function(s) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[s];
  });
}

// Start app
document.addEventListener('DOMContentLoaded', setupPage);
