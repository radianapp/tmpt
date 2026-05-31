// app/dev/code/js/editor-init.js
import { openTmptDB, dbGet, dbPut, dbGetAll } from '/shared/db.js';
const toast = (msg, type) => window.TMPT_UI.toast(msg, type);
import { verifyPermission, readDirectoryRecursive, readFileContent, writeFileContent, createLocalFile, createLocalDirectory } from './fsaa.js';
import { fetchGitHubRepoContents, fetchGitHubFileContent, commitGitHubFileContent } from './github.js';
import { runJavaScript, renderHtmlPreview, renderMarkdownPreview, runPython, installPythonPackages, preloadPythonRuntime } from './runner.js';

const DB_NAME = 'tmpt_code';
const DB_VERSION = 2;
const STORE_NAME = 'projects';

let db = null;
let project = null;
let editorInstance = null;
let fileTree = [];
let activeFile = null; // { path, name, content, handle (local), sha (github), type: 'local'|'github' }
let openTabs = []; // List of open files
let autosaveTimer = null;

// DOM Elements
const projectNameDisplay = document.getElementById('project-name-display');
const branchDisplay = document.getElementById('branch-display');
const saveStatus = document.getElementById('save-status');
const btnRunCode = document.getElementById('btn-run-code');
const btnTogglePreview = document.getElementById('btn-toggle-preview');
const fileTreeContainer = document.getElementById('file-tree-container');
const tabsContainer = document.getElementById('tabs-container');
const rightPanel = document.getElementById('right-panel');
const btnCloseRightPanel = document.getElementById('btn-close-right-panel');
const tabConsole = document.getElementById('tab-console');
const tabPreview = document.getElementById('tab-preview');
const consoleLogsContent = document.getElementById('console-logs-content');
const previewIframeContent = document.getElementById('preview-iframe-content');
const htmlPreviewFrame = document.getElementById('html-preview-frame');
const btnNewFile = document.getElementById('btn-new-file');
const btnNewDir = document.getElementById('btn-new-dir');

document.addEventListener('DOMContentLoaded', async () => {
  await initDB();
  await loadProject();
  setupUIEventListeners();
  // Pre-load Pyodide di background agar Python siap lebih cepat
  setTimeout(() => preloadPythonRuntime(), 3000);
});

async function initDB() {
  db = await openTmptDB(DB_NAME, DB_VERSION, (dbInstance) => {
    if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
      dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
    if (!dbInstance.objectStoreNames.contains('files')) {
      dbInstance.createObjectStore('files', { keyPath: 'id' });
    }
  });
}

async function loadProject() {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('id');
  
  if (!projectId) {
    window.location.href = './index.html';
    return;
  }

  project = await dbGet(db, STORE_NAME, projectId);
  if (!project) {
    toast('Proyek tidak ditemukan.', 'error');
    setTimeout(() => { window.location.href = './index.html'; }, 1500);
    return;
  }

  // Update project metadata
  project.last_opened = new Date().toISOString();
  await dbPut(db, STORE_NAME, project);

  projectNameDisplay.textContent = project.name;
  if (project.type === 'github') {
    branchDisplay.textContent = `(${project.github.branch})`;
  } else if (project.type === 'browser') {
    branchDisplay.textContent = '(Simpan di Browser)';
  } else {
    branchDisplay.textContent = '(Folder Lokal)';
  }

  // Load File Tree
  await refreshFileTree();

  // Lazy Load Monaco Editor
  initMonaco();
}

async function refreshFileTree() {
  if (project.type === 'local') {
    const dirHandle = project.local_handle;
    const hasPermission = await verifyPermission(dirHandle, true);
    if (!hasPermission) {
      toast('Izin ditolak untuk folder lokal.', 'error');
      fileTreeContainer.innerHTML = '<p class="secondary" style="padding: 1rem;">Butuh akses folder. <a href="#" id="btn-retry-permission">Buka Ulang</a></p>';
      document.getElementById('btn-retry-permission').onclick = async (e) => {
        e.preventDefault();
        await refreshFileTree();
      };
      return;
    }
    fileTree = await readDirectoryRecursive(dirHandle);
    renderFileTree(fileTree, fileTreeContainer);
  } else if (project.type === 'github') {
    const token = localStorage.getItem('tmpt_github_token');
    if (!token) {
      toast('Token GitHub tidak ditemukan. Hubungkan kembali.', 'error');
      return;
    }
    fileTree = await fetchGitHubRepoContents(token, project.github.owner, project.github.repo, project.github.branch);
    renderFileTree(fileTree, fileTreeContainer);
  } else if (project.type === 'browser') {
    try {
      const allFiles = await dbGetAll(db, 'files');
      const projectFiles = allFiles.filter(f => f.projectId === project.id);
      fileTree = buildBrowserTree(projectFiles);
      renderFileTree(fileTree, fileTreeContainer);
    } catch (err) {
      console.error(err);
      toast('Gagal memuat file browser virtual.', 'error');
    }
  }
}

function buildBrowserTree(files) {
  const root = [];
  const map = {};

  files.forEach(file => {
    const parts = file.path.split('/');
    const name = file.name;
    const isDir = file.type === 'directory';

    const node = {
      type: file.type,
      name: name,
      path: file.path,
      id: file.id
    };

    if (isDir) {
      node.children = [];
    }

    map[file.path] = node;

    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, parts.length - 1).join('/');
      const parent = map[parentPath];
      if (parent && parent.children) {
        parent.children.push(node);
      }
    }
  });

  const sortNodes = (nodes) => {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    }).map(n => {
      if (n.children) {
        n.children = sortNodes(n.children);
      }
      return n;
    });
  };

  return sortNodes(root);
}

function renderFileTree(nodes, container, depth = 0) {
  if (depth === 0) container.innerHTML = '';

  nodes.forEach(node => {
    const nodeEl = document.createElement('div');
    nodeEl.className = 'tree-node';
    
    const row = document.createElement('div');
    row.className = 'tree-node-row';
    if (activeFile && activeFile.path === node.path) {
      row.classList.add('active');
    }

    const isDir = node.type === 'directory';
    row.innerHTML = `
      <span class="node-icon">${isDir ? '📁' : '📄'}</span>
      <span class="node-label" title="${node.name}">${node.name}</span>
    `;

    row.addEventListener('click', async (e) => {
      e.stopPropagation();
      document.querySelectorAll('.tree-node-row').forEach(r => r.classList.remove('active'));
      row.classList.add('active');

      if (isDir) {
        // Toggle directory sub-tree visibility if children container exists
        const subContainer = nodeEl.querySelector('.sub-tree');
        if (subContainer) {
          subContainer.classList.toggle('hidden');
          row.querySelector('.node-icon').textContent = subContainer.classList.contains('hidden') ? '📁' : '📂';
        }
      } else {
        await selectFile(node);
      }
    });

    nodeEl.appendChild(row);

    if (isDir && node.children) {
      const subTreeContainer = document.createElement('div');
      subTreeContainer.className = 'sub-tree';
      subTreeContainer.style.paddingLeft = '0.5rem';
      renderFileTree(node.children, subTreeContainer, depth + 1);
      nodeEl.appendChild(subTreeContainer);
    }

    container.appendChild(nodeEl);
  });
}

async function selectFile(node) {
  let fileData = openTabs.find(tab => tab.path === node.path);
  
  if (!fileData) {
    // Open new tab, loading content
    showStatus('Memuat file...', 'pending');
    try {
      if (project.type === 'local') {
        const content = await readFileContent(node.handle);
        fileData = {
          path: node.path,
          name: node.name,
          content,
          handle: node.handle,
          type: 'local'
        };
      } else if (project.type === 'github') {
        const token = localStorage.getItem('tmpt_github_token');
        const { content, sha } = await fetchGitHubFileContent(token, project.github.owner, project.github.repo, node.path, project.github.branch);
        fileData = {
          path: node.path,
          name: node.name,
          content,
          sha,
          type: 'github'
        };
      } else if (project.type === 'browser') {
        const fileRecord = await dbGet(db, 'files', `${project.id}:${node.path}`);
        fileData = {
          path: node.path,
          name: node.name,
          content: fileRecord ? fileRecord.content : '',
          id: `${project.id}:${node.path}`,
          type: 'browser'
        };
      }
      openTabs.push(fileData);
    } catch (err) {
      console.error(err);
      toast('Gagal membuka file.', 'error');
      showStatus('Tersimpan ✓', 'saved');
      return;
    }
  }

  activeFile = fileData;
  renderTabs();
  
  if (editorInstance) {
    editorInstance.setValue(activeFile.content);
    // Update language mode based on extension
    const ext = activeFile.name.split('.').pop().toLowerCase();
    const mode = getLanguageMode(ext);
    monaco.editor.setModelLanguage(editorInstance.getModel(), mode);
    document.getElementById('editor-lang-indicator').textContent = mode.toUpperCase();
  }
  
  showStatus('Tersimpan ✓', 'saved');
}

function renderTabs() {
  tabsContainer.innerHTML = '';
  openTabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = 'editor-tab';
    if (activeFile && activeFile.path === tab.path) {
      tabEl.classList.add('active');
    }
    
    tabEl.innerHTML = `
      <span class="tab-title">${tab.name}</span>
      <span class="tab-close" data-path="${tab.path}">×</span>
    `;
    
    tabEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-close')) {
        e.stopPropagation();
        closeTab(tab.path);
      } else {
        selectFile({ path: tab.path, name: tab.name, handle: tab.handle });
      }
    });
    
    tabsContainer.appendChild(tabEl);
  });
}

function closeTab(path) {
  const index = openTabs.findIndex(t => t.path === path);
  if (index === -1) return;
  
  openTabs.splice(index, 1);
  if (activeFile && activeFile.path === path) {
    activeFile = openTabs.length > 0 ? openTabs[openTabs.length - 1] : null;
    if (activeFile) {
      selectFile({ path: activeFile.path, name: activeFile.name, handle: activeFile.handle });
    } else {
      if (editorInstance) editorInstance.setValue('');
      document.getElementById('editor-lang-indicator').textContent = 'Plain Text';
    }
  }
  renderTabs();
}

function getLanguageMode(extension) {
  const map = {
    'js': 'javascript',
    'ts': 'typescript',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'py': 'python',
    'md': 'markdown',
    'sh': 'shell',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml'
  };
  return map[extension] || 'plaintext';
}

function initMonaco() {
  // Monaco is loaded using AMD loader.js
  require.config({ paths: { 'vs': './vendor/monaco/vs' } });
  
  require(['vs/editor/editor.main'], function() {
    // Custom theme setup
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    editorInstance = monaco.editor.create(document.getElementById('monaco-editor-host'), {
      value: '',
      language: 'plaintext',
      theme: isDark ? 'vs-dark' : 'vs',
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 14
    });

    // Cursor position status bar tracker
    editorInstance.onDidChangeCursorPosition((e) => {
      document.getElementById('editor-position-indicator').textContent = `Baris ${e.position.lineNumber}, Kolom ${e.position.column}`;
    });

    // Content change handler for autosave
    editorInstance.onDidChangeModelContent(() => {
      if (activeFile) {
        activeFile.content = editorInstance.getValue();
        triggerAutosave();
      }
    });

    // Listen to global theme change
    const observer = new MutationObserver(() => {
      const isDarkNow = document.documentElement.getAttribute('data-theme') === 'dark';
      monaco.editor.setTheme(isDarkNow ? 'vs-dark' : 'vs');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  });
}

function triggerAutosave() {
  clearTimeout(autosaveTimer);
  showStatus('Ada perubahan...', 'pending');

  autosaveTimer = setTimeout(async () => {
    showStatus('Menyimpan...', 'saving');
    try {
      if (activeFile.type === 'local') {
        await writeFileContent(activeFile.handle, activeFile.content);
        showStatus('Tersimpan ✓', 'saved');
      } else if (activeFile.type === 'github') {
        const token = localStorage.getItem('tmpt_github_token');
        const newSha = await commitGitHubFileContent(
          token,
          project.github.owner,
          project.github.repo,
          activeFile.path,
          activeFile.content,
          activeFile.sha,
          project.github.branch
        );
        activeFile.sha = newSha; // Update internal file sha
        showStatus('Tersimpan ✓', 'saved');
      } else if (activeFile.type === 'browser') {
        const fileRecord = {
          id: activeFile.id,
          projectId: project.id,
          path: activeFile.path,
          name: activeFile.name,
          type: 'file',
          content: activeFile.content
        };
        await dbPut(db, 'files', fileRecord);
        showStatus('Tersimpan ✓', 'saved');
      }
    } catch (err) {
      console.error(err);
      showStatus('Gagal menyimpan ⚠️', 'error');
      toast('Autosave gagal: ' + err.message, 'error');
    }
  }, 2000);
}

function showStatus(text, status) {
  saveStatus.textContent = text;
  saveStatus.className = ''; // clear class
  saveStatus.classList.add(`save-status-${status}`);
}

function logToConsole(message, type = 'log') {
  const line = document.createElement('div');
  line.className = `console-line console-line-${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  consoleLogsContent.appendChild(line);
  consoleLogsContent.scrollTop = consoleLogsContent.scrollHeight;
}

async function getProjectFileContent(relativePath) {
  const normPath = relativePath.replace(/^\.\//, '').replace(/^\//, '');
  
  if (project.type === 'local') {
    try {
      const findHandle = (nodes, path) => {
        for (const node of nodes) {
          if (node.path === path) return node.handle;
          if (node.children) {
            const found = findHandle(node.children, path);
            if (found) return found;
          }
        }
        return null;
      };
      
      const fileHandle = findHandle(fileTree, normPath);
      if (fileHandle) {
        return await readFileContent(fileHandle);
      }
    } catch (e) {
      console.error(e);
    }
  } else if (project.type === 'browser') {
    const fileRecord = await dbGet(db, 'files', `${project.id}:${normPath}`);
    if (fileRecord) {
      return fileRecord.content;
    }
  } else if (project.type === 'github') {
    const tab = openTabs.find(t => t.path === normPath);
    if (tab) return tab.content;
    
    try {
      const token = localStorage.getItem('tmpt_github_token');
      const { content } = await fetchGitHubFileContent(token, project.github.owner, project.github.repo, normPath, project.github.branch);
      return content;
    } catch (e) {
      console.error(e);
    }
  }
  return null;
}

function setupUIEventListeners() {
  // ── Sidebar Collapse/Expand ──────────────────────────────────────────────
  const sidebar = document.getElementById('editor-sidebar');
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const btnShowSidebar = document.getElementById('btn-show-sidebar');

  function setSidebarCollapsed(collapsed) {
    if (collapsed) {
      sidebar.classList.add('sidebar-collapsed');
      btnShowSidebar.classList.remove('hidden');
      if (btnToggleSidebar) btnToggleSidebar.setAttribute('aria-label', 'Tampilkan Sidebar');
    } else {
      sidebar.classList.remove('sidebar-collapsed');
      btnShowSidebar.classList.add('hidden');
      if (btnToggleSidebar) btnToggleSidebar.setAttribute('aria-label', 'Sembunyikan Sidebar');
    }
    localStorage.setItem('tmpt_code_sidebar_collapsed', collapsed ? '1' : '0');
  }

  // Restore state dari localStorage
  const savedCollapsed = localStorage.getItem('tmpt_code_sidebar_collapsed') === '1';
  setSidebarCollapsed(savedCollapsed);

  if (btnToggleSidebar) {
    btnToggleSidebar.addEventListener('click', () => {
      setSidebarCollapsed(!sidebar.classList.contains('sidebar-collapsed'));
    });
  }

  if (btnShowSidebar) {
    btnShowSidebar.addEventListener('click', () => {
      setSidebarCollapsed(false);
    });
  }

  // ── Panel Right toggles ──────────────────────────────────────────────────
  btnTogglePreview.addEventListener('click', () => {
    rightPanel.classList.toggle('collapsed');
  });

  btnCloseRightPanel.addEventListener('click', () => {
    rightPanel.classList.add('collapsed');
  });

  // Switch tabs in Right Panel
  tabConsole.addEventListener('click', () => {
    tabConsole.classList.add('active');
    tabPreview.classList.remove('active');
    consoleLogsContent.classList.remove('hidden');
    previewIframeContent.classList.add('hidden');
  });

  tabPreview.addEventListener('click', async () => {
    tabPreview.classList.add('active');
    tabConsole.classList.remove('active');
    consoleLogsContent.classList.add('hidden');
    previewIframeContent.classList.remove('hidden');
    
    // Auto render preview if active file is html
    if (activeFile && activeFile.name.endsWith('.html')) {
      await renderHtmlPreview(htmlPreviewFrame, activeFile.content, getProjectFileContent);
    }
  });

  // Run code execution button
  btnRunCode.addEventListener('click', async () => {
    if (!activeFile) {
      toast('Buka file terlebih dahulu untuk menjalankan.', 'info');
      return;
    }

    rightPanel.classList.remove('collapsed');
    tabConsole.click();

    const ext = activeFile.name.split('.').pop().toLowerCase();

    if (ext === 'js') {
      // Run JavaScript
      logToConsole(`▶ Mengeksekusi ${activeFile.name} (JavaScript)...`, 'info');
      runJavaScript(activeFile.content, (msg, type) => {
        logToConsole(msg, type);
      }, (errMsg) => {
        logToConsole(errMsg, 'error');
      });
    } else if (ext === 'html') {
      // HTML preview — switch tab ke preview
      tabPreview.click();
      logToConsole(`🖼️ Merender ${activeFile.name} ke Pratinjau...`, 'info');
      await renderHtmlPreview(htmlPreviewFrame, activeFile.content, getProjectFileContent);
    } else if (ext === 'py') {
      // Run Python via Pyodide
      logToConsole(`🐍 Mengeksekusi ${activeFile.name} (Python via Pyodide)...`, 'info');
      logToConsole('⏳ Memuat Python runtime (mungkin butuh waktu pertama kali)...', 'info');
      btnRunCode.disabled = true;
      btnRunCode.textContent = '⏳ Python Loading...';

      try {
        await runPython(
          activeFile.content,
          (msg, type) => logToConsole(msg, type),
          (errMsg) => logToConsole(errMsg, 'error')
        );
        logToConsole('✅ Selesai.', 'info');
      } finally {
        btnRunCode.disabled = false;
        btnRunCode.textContent = '▶ Jalankan';
      }
    } else if (ext === 'md') {
      // Markdown preview
      tabPreview.click();
      rightPanel.classList.remove('collapsed');
      logToConsole(`📄 Merender ${activeFile.name} sebagai Markdown...`, 'info');
      htmlPreviewFrame._markdownContent = activeFile.content;
      await renderMarkdownPreview(htmlPreviewFrame);
    } else {
      toast(`Eksekusi tidak didukung untuk file .${ext}. Gunakan .js, .py, .html, atau .md.`, 'info');
    }
  });

  // Pip install panel (untuk Python)
  const btnPipInstall = document.getElementById('btn-pip-install');
  if (btnPipInstall) {
    btnPipInstall.addEventListener('click', async () => {
      const pkgInput = document.getElementById('pip-package-input');
      const packages = pkgInput ? pkgInput.value.trim().split(/[\s,]+/).filter(Boolean) : [];

      if (packages.length === 0) {
        toast('Masukkan nama paket yang ingin diinstall.', 'info');
        return;
      }

      rightPanel.classList.remove('collapsed');
      tabConsole.click();
      btnPipInstall.disabled = true;

      try {
        await installPythonPackages(
          packages,
          (msg, type) => logToConsole(msg, type),
          (errMsg) => logToConsole(errMsg, 'error')
        );
      } finally {
        btnPipInstall.disabled = false;
        if (pkgInput) pkgInput.value = '';
      }
    });
  }

  // Create new File/Folder
  btnNewFile.addEventListener('click', async () => {
    if (project.type !== 'local' && project.type !== 'browser') {
      toast('Membuat file baru hanya didukung untuk proyek lokal atau virtual.', 'info');
      return;
    }
    
    const fileName = await window.TMPT_UI.prompt('Masukkan nama file baru (contoh: app.js):', 'app.js');
    if (!fileName) return;

    try {
      if (project.type === 'local') {
        const handle = await createLocalFile(project.local_handle, fileName);
        toast(`File ${fileName} berhasil dibuat!`, 'success');
        await refreshFileTree();
        await selectFile({ path: fileName, name: fileName, handle: handle });
      } else if (project.type === 'browser') {
        const id = `${project.id}:${fileName}`;
        const newFile = {
          id,
          projectId: project.id,
          path: fileName,
          name: fileName,
          type: 'file',
          content: ''
        };
        await dbPut(db, 'files', newFile);
        toast(`File ${fileName} berhasil dibuat!`, 'success');
        await refreshFileTree();
        await selectFile({ path: fileName, name: fileName });
      }
    } catch (err) {
      console.error(err);
      toast('Gagal membuat file.', 'error');
    }
  });

  btnNewDir.addEventListener('click', async () => {
    if (project.type !== 'local' && project.type !== 'browser') {
      toast('Membuat folder baru hanya didukung untuk proyek lokal atau virtual.', 'info');
      return;
    }
    
    const dirName = await window.TMPT_UI.prompt('Masukkan nama folder baru:', 'Folder baru...');
    if (!dirName) return;

    try {
      if (project.type === 'local') {
        await createLocalDirectory(project.local_handle, dirName);
        toast(`Folder ${dirName} berhasil dibuat!`, 'success');
        await refreshFileTree();
      } else if (project.type === 'browser') {
        const id = `${project.id}:${dirName}`;
        const newDir = {
          id,
          projectId: project.id,
          path: dirName,
          name: dirName,
          type: 'directory'
        };
        await dbPut(db, 'files', newDir);
        toast(`Folder ${dirName} berhasil dibuat!`, 'success');
        await refreshFileTree();
      }
    } catch (err) {
      console.error(err);
      toast('Gagal membuat folder.', 'error');
    }
  });

  // Setup export panel untuk project browser
  setupExportPanel();
}

// ── Export Browser Project ────────────────────────────────────────────────────

function setupExportPanel() {
  if (!project || project.type !== 'browser') return;

  const btnExport = document.getElementById('btn-export-project');
  if (!btnExport) return;

  btnExport.classList.remove('hidden');

  btnExport.addEventListener('click', () => {
    document.getElementById('modal-export').showModal();
  });

  document.getElementById('btn-do-export-zip').addEventListener('click', async () => {
    document.getElementById('modal-export').close();
    await exportBrowserProjectAsZip();
  });

  document.getElementById('btn-do-push-github').addEventListener('click', async () => {
    document.getElementById('modal-export').close();
    await pushBrowserProjectToGitHub();
  });
}

async function getBrowserProjectFiles() {
  const allFiles = await dbGetAll(db, 'files');
  return allFiles.filter(f => f.projectId === project.id && f.type === 'file');
}

/**
 * Lazy load JSZip dari CDN dan kembalikan class-nya via window.JSZip.
 * ES Module tidak bisa akses globals yang di-inject secara runtime sebagai bare identifier —
 * harus lewat window.JSZip secara eksplisit.
 */
async function loadJSZip() {
  if (window.JSZip) return window.JSZip;

  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Gagal memuat JSZip dari CDN. Periksa koneksi internet.'));
    document.head.appendChild(s);
  });

  if (!window.JSZip) throw new Error('JSZip tidak tersedia setelah dimuat.');
  return window.JSZip;
}

async function exportBrowserProjectAsZip() {
  toast('Menyiapkan ZIP...', 'info');
  try {
    const JSZip = await loadJSZip();

    const files = await getBrowserProjectFiles();
    if (files.length === 0) {
      toast('Proyek kosong — tidak ada file untuk didownload.', 'warning');
      return;
    }

    const zip = new JSZip();
    const folder = zip.folder(project.name);
    files.forEach(f => folder.file(f.path, f.content || ''));

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`✅ ${project.name}.zip (${files.length} file) berhasil didownload!`, 'success');
  } catch (err) {
    console.error(err);
    toast('Gagal membuat ZIP: ' + err.message, 'error');
  }
}

async function pushBrowserProjectToGitHub() {
  const token = localStorage.getItem('tmpt_github_token');
  if (!token) {
    toast('Hubungkan GitHub terlebih dahulu dari halaman Dashboard.', 'error');
    return;
  }

  const repoName = await window.TMPT_UI.prompt(
    `Nama repositori GitHub baru untuk proyek "${project.name}":`,
    project.name.toLowerCase().replace(/\s+/g, '-')
  );
  if (!repoName) return;

  toast('Membuat repositori GitHub...', 'info');

  try {
    // 1. Dapatkan info user
    const userRes = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!userRes.ok) throw new Error('Gagal mengambil info user GitHub.');
    const user = await userRes.json();

    // 2. Buat repo baru
    const createRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: repoName,
        description: `Proyek TMPT Code: ${project.name}`,
        private: false,
        auto_init: false
      })
    });

    if (!createRes.ok) {
      const errData = await createRes.json();
      throw new Error(errData.message || `Gagal membuat repo: ${createRes.status}`);
    }

    const repo = await createRes.json();
    toast(`Repo ${repo.full_name} dibuat. Mengupload file...`, 'info');

    // 3. Upload setiap file via Contents API
    const files = await getBrowserProjectFiles();
    for (const file of files) {
      const content = btoa(unescape(encodeURIComponent(file.content || '')));
      const putRes = await fetch(`https://api.github.com/repos/${repo.full_name}/contents/${file.path}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Add ${file.path} via TMPT Code`,
          content
        })
      });
      if (!putRes.ok) {
        console.warn(`Gagal upload ${file.path}:`, await putRes.text());
      }
    }

    toast(`✅ ${files.length} file berhasil di-push ke ${repo.full_name}!`, 'success');

    // Buka repo di tab baru
    setTimeout(() => window.open(repo.html_url, '_blank'), 1000);
  } catch (err) {
    console.error(err);
    toast('Gagal push ke GitHub: ' + err.message, 'error');
  }
}
