// app/dev/code/code.js
import { openTmptDB, dbGet, dbPut, dbDelete, dbGetAll } from '/shared/db.js';
const generateId = () => self.crypto.randomUUID();
const toast = (msg, type) => window.TMPT_UI.toast(msg, type);

const DB_NAME = 'tmpt_code';
const DB_VERSION = 2;
const STORE_NAME = 'projects';

let db = null;
let projectsList = [];

document.addEventListener('DOMContentLoaded', async () => {
  await initDB();
  await loadProjects();
  setupEventListeners();
});

async function initDB() {
  try {
    db = await openTmptDB(DB_NAME, DB_VERSION, (dbInstance) => {
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!dbInstance.objectStoreNames.contains('files')) {
        dbInstance.createObjectStore('files', { keyPath: 'id' });
      }
    });
  } catch (err) {
    console.error('Failed to open database:', err);
    toast('Gagal memuat database TMPT Code.', 'error');
  }
}

async function loadProjects() {
  if (!db) return;
  try {
    projectsList = await dbGetAll(db, STORE_NAME);
    renderProjects(projectsList);
  } catch (err) {
    console.error('Error loading projects:', err);
    toast('Gagal memuat daftar proyek.', 'error');
  }
}

function renderProjects(projects) {
  const container = document.getElementById('projects-container');
  const emptyState = document.getElementById('empty-state');
  const section = document.getElementById('projects-section');

  container.innerHTML = '';

  if (projects.length === 0) {
    emptyState.classList.remove('hidden');
    section.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  section.classList.remove('hidden');

  // Sort by last opened
  const sorted = [...projects].sort((a, b) => new Date(b.last_opened || 0) - new Date(a.last_opened || 0));

  sorted.forEach(project => {
    const card = document.createElement('article');
    card.className = 'project-card';
    card.dataset.id = project.id;

    const isLocal = project.type === 'local';
    const isBrowser = project.type === 'browser';
    
    let icon = '📁';
    if (project.type === 'github') icon = '🔌';
    else if (project.type === 'browser') icon = '🌐';

    const dateStr = project.last_opened 
      ? new Date(project.last_opened).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }) 
      : 'Belum pernah dibuka';

    let descText = 'Folder Lokal';
    if (project.type === 'github') {
      descText = `GitHub: ${project.github.owner}/${project.github.repo}`;
    } else if (project.type === 'browser') {
      descText = 'Penyimpanan Browser (Virtual)';
    }

    let branchText = 'n/a';
    if (project.type === 'github') {
      branchText = project.github.branch;
    }

    card.innerHTML = `
      <div class="project-card-header">
        <span class="project-card-icon">${icon}</span>
        <h4 class="project-card-title" title="${project.name}">${project.name}</h4>
        <span class="project-card-type type-${project.type}">${project.type}</span>
      </div>
      <div class="project-card-body">
        <p class="secondary" style="font-size: 0.8rem; margin-bottom: 0;">
          ${descText}
        </p>
        <p class="secondary" style="font-size: 0.75rem; margin-top: 0.25rem;">
          Cabang: ${branchText}
        </p>
      </div>
      <div class="project-card-footer">
        <span>Dibuka: ${dateStr}</span>
        <div class="project-card-actions">
          <button class="outline secondary delete-project-btn" data-id="${project.id}" style="padding: 0.25rem 0.5rem; margin: 0; font-size: 0.75rem;">🗑️</button>
          <button class="primary open-project-btn" data-id="${project.id}" style="padding: 0.25rem 0.5rem; margin: 0; font-size: 0.75rem;">Buka</button>
        </div>
      </div>
    `;

    // Click card to open except when clicking delete button
    card.addEventListener('click', (e) => {
      if (e.target.closest('.delete-project-btn')) {
        e.stopPropagation();
        confirmDeleteProject(project.id, project.name);
      } else {
        openProject(project.id);
      }
    });

    container.appendChild(card);
  });
}

function setupEventListeners() {
  // Search
  document.getElementById('search-projects').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = projectsList.filter(p => p.name.toLowerCase().includes(query));
    renderProjects(filtered);
  });

  // New local project buttons
  const openLocalPicker = async () => {
    try {
      if (!window.showDirectoryPicker) {
        toast('Browser Anda tidak mendukung File System Access API (FSAA). Gunakan Chrome/Edge.', 'error');
        return;
      }
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      
      // Check if project already exists with this name
      const id = generateId();
      const newProject = {
        id,
        name: dirHandle.name,
        type: 'local',
        local_handle: dirHandle,
        last_opened: new Date().toISOString()
      };
      
      await dbPut(db, STORE_NAME, newProject);
      toast(`Folder ${dirHandle.name} berhasil terhubung!`, 'success');
      openProject(id);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error picking directory:', err);
        toast('Gagal menghubungkan folder lokal.', 'error');
      }
    }
  };

  document.getElementById('btn-new-local').addEventListener('click', (e) => {
    e.preventDefault();
    openLocalPicker();
  });
  document.getElementById('btn-empty-local').addEventListener('click', openLocalPicker);

  // New Browser project buttons
  const openBrowserCreator = async () => {
    const name = await window.TMPT_UI.prompt('Masukkan nama proyek virtual:', 'Nama proyek...');
    if (!name) return;

    try {
      const id = generateId();
      const newProject = {
        id,
        name,
        type: 'browser',
        last_opened: new Date().toISOString()
      };

      await dbPut(db, STORE_NAME, newProject);

      // Create a default script file
      const defaultFile = {
        id: `${id}:index.js`,
        projectId: id,
        path: 'index.js',
        name: 'index.js',
        type: 'file',
        content: '// Proyek Virtual TMPT Code\nconsole.log("Hello, World!");\n'
      };
      await dbPut(db, 'files', defaultFile);

      toast(`Proyek virtual "${name}" berhasil dibuat!`, 'success');
      openProject(id);
    } catch (err) {
      console.error(err);
      toast('Gagal membuat proyek virtual.', 'error');
    }
  };

  document.getElementById('btn-new-browser').addEventListener('click', (e) => {
    e.preventDefault();
    openBrowserCreator();
  });
  document.getElementById('btn-empty-browser').addEventListener('click', openBrowserCreator);

  // New GitHub project buttons
  const openGitHubModal = () => {
    const token = localStorage.getItem('tmpt_github_token');
    const modal = document.getElementById('modal-github-project');

    if (token) {
      // Sudah ada token — langsung ke step 2, tapi verifikasi ulang dulu secara diam-diam
      document.getElementById('github-auth-section').classList.add('hidden');
      document.getElementById('github-repo-section').classList.remove('hidden');
      loadGitHubRepos(token);

      // Tampilkan username yang tersimpan (jika ada)
      const savedUser = localStorage.getItem('tmpt_github_user');
      const userDisplay = document.getElementById('github-user-display');
      if (userDisplay && savedUser) userDisplay.textContent = savedUser;
    } else {
      document.getElementById('github-auth-section').classList.remove('hidden');
      document.getElementById('github-repo-section').classList.add('hidden');
    }

    modal.showModal();
  };

  document.getElementById('btn-new-github').addEventListener('click', (e) => {
    e.preventDefault();
    openGitHubModal();
  });
  document.getElementById('btn-empty-github').addEventListener('click', openGitHubModal);

  // Verifikasi PAT
  document.getElementById('btn-github-auth').addEventListener('click', async () => {
    const input = document.getElementById('github-pat-input');
    const token = input ? input.value.trim() : '';
    if (!token) {
      const err = document.getElementById('github-pat-error');
      if (err) { err.textContent = 'Masukkan Personal Access Token terlebih dahulu.'; err.style.display = 'block'; }
      return;
    }
    await verifyAndSavePAT(token);
  });

  // Ganti Token (disconnect)
  const btnDisconnect = document.getElementById('btn-github-disconnect');
  if (btnDisconnect) {
    btnDisconnect.addEventListener('click', () => {
      localStorage.removeItem('tmpt_github_token');
      localStorage.removeItem('tmpt_github_user');
      document.getElementById('github-repo-section').classList.add('hidden');
      document.getElementById('github-auth-section').classList.remove('hidden');
      const patInput = document.getElementById('github-pat-input');
      if (patInput) patInput.value = '';
    });
  }

  // Form submit for GitHub Project
  document.getElementById('form-github-project').addEventListener('submit', async (e) => {
    e.preventDefault();
    const repoSelect = document.getElementById('github-repo-select');
    const branchSelect = document.getElementById('github-branch-select');
    
    const repoFullName = repoSelect.value;
    const branch = branchSelect.value;
    
    if (!repoFullName) return;
    
    const [owner, repo] = repoFullName.split('/');
    const id = generateId();
    
    const newProject = {
      id,
      name: repo,
      type: 'github',
      github: {
        owner,
        repo,
        branch
      },
      last_opened: new Date().toISOString()
    };
    
    await dbPut(db, STORE_NAME, newProject);
    document.getElementById('modal-github-project').close();
    openProject(id);
  });
}

function openProject(id) {
  window.location.href = `./editor.html?id=${id}`;
}

async function confirmDeleteProject(id, name) {
  const modal = document.getElementById('confirm-modal');
  document.getElementById('confirm-message').textContent = `Apakah Anda yakin ingin menghapus koneksi proyek "${name}"? Data file lokal Anda tidak akan terpengaruh.`;
  modal.showModal();
  
  modal._resolve = async (confirmed) => {
    if (confirmed) {
      await dbDelete(db, STORE_NAME, id);
      toast('Proyek berhasil dihapus dari daftar.', 'success');
      await loadProjects();
    }
  };
}

// ── GitHub PAT Auth & API ────────────────────────────────────────────────────

/**
 * Verifikasi PAT dengan memanggil GET /user GitHub API.
 * Jika valid, simpan token dan tampilkan username.
 */
async function verifyAndSavePAT(token) {
  const patError = document.getElementById('github-pat-error');
  const btnAuth = document.getElementById('btn-github-auth');

  patError.style.display = 'none';
  btnAuth.disabled = true;
  btnAuth.textContent = '⏳ Memverifikasi...';

  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) {
      const msg = res.status === 401
        ? 'Token tidak valid atau sudah kadaluarsa. Pastikan scope "repo" dicentang.'
        : `Error GitHub API: ${res.status} ${res.statusText}`;
      patError.textContent = msg;
      patError.style.display = 'block';
      return;
    }

    const user = await res.json();
    localStorage.setItem('tmpt_github_token', token);
    localStorage.setItem('tmpt_github_user', user.login);

    // Tampilkan step 2
    document.getElementById('github-auth-section').classList.add('hidden');
    const repoSection = document.getElementById('github-repo-section');
    repoSection.classList.remove('hidden');

    const userDisplay = document.getElementById('github-user-display');
    if (userDisplay) userDisplay.textContent = user.login;

    toast(`Terhubung sebagai @${user.login}`, 'success');
    await loadGitHubRepos(token);
  } catch (err) {
    patError.textContent = 'Gagal terhubung. Periksa koneksi internet Anda.';
    patError.style.display = 'block';
  } finally {
    btnAuth.disabled = false;
    btnAuth.innerHTML = '🔗 Verifikasi &amp; Lanjut';
  }
}

async function loadGitHubRepos(token) {
  const repoSelect = document.getElementById('github-repo-select');
  repoSelect.innerHTML = '<option value="">Memuat repositori...</option>';

  try {
    const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

    const repos = await res.json();
    repoSelect.innerHTML = '<option value="">Pilih Repositori...</option>';

    repos.forEach(repo => {
      const opt = document.createElement('option');
      opt.value = repo.full_name;
      opt.textContent = `${repo.full_name}${repo.private ? ' 🔒' : ''}`;
      repoSelect.appendChild(opt);
    });

    repoSelect.addEventListener('change', async () => {
      const repoFullName = repoSelect.value;
      if (repoFullName) await loadGitHubBranches(token, repoFullName);
    });
  } catch (err) {
    console.error('Error loading repos:', err);
    toast('Gagal memuat repositori dari GitHub.', 'error');
    repoSelect.innerHTML = '<option value="">Gagal memuat repositori</option>';
  }
}

async function loadGitHubBranches(token, repoFullName) {
  const branchSelect = document.getElementById('github-branch-select');
  branchSelect.innerHTML = '<option value="">Memuat cabang...</option>';

  try {
    const res = await fetch(`https://api.github.com/repos/${repoFullName}/branches`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

    const branches = await res.json();
    branchSelect.innerHTML = '';

    branches.forEach(branch => {
      const opt = document.createElement('option');
      opt.value = branch.name;
      opt.textContent = branch.name;
      if (branch.name === 'main' || branch.name === 'master') opt.selected = true;
      branchSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Error loading branches:', err);
    branchSelect.innerHTML = '<option value="main">main</option><option value="master">master</option>';
  }
}
