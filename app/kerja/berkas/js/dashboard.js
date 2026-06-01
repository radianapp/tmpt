// app/kerja/berkas/js/dashboard.js
import { initBerkasDB, getFiles, getFile, putFile, deleteFileMetadata, getFolders, getFolder, putFolder, deleteFolderMetadata, getTags, putTag, deleteTagMetadata, getSetting, putSetting } from './berkas-db.js';
import { openTmptDB, dbGetAll } from '/shared/db.js';

import { saveFileToOpfs, getFileFromOpfs, removeFileFromOpfs, getOpfsFolderSize } from './opfs.js';
import { selectLocalFolder, verifyPermission, writeLocalFile, deleteLocalFile } from './fsaa.js';
import { generateBackupBundle, restoreBackupBundle } from './backup.js';
import { BerkasSearch } from './search.js';
import { openAppWithContext } from '/shared/app-bridge.js';
import { broadcastTMPT, listenTMPT, TMPT_EVENTS } from '/shared/broadcast.js';

// --- State Management ---
let currentFolderId = 'root'; // 'root' or UUID
let currentViewMode = localStorage.getItem('berkas_view_mode') || 'grid'; // 'grid' | 'list'
let activeFilter = 'all'; // 'all' | 'starred' | 'trash'
let selectedTag = null; // Filter by tag
let selectedFiles = new Set(); // Multi-select
let localFolderHandle = null; // FSAA directory handle
const searchEngine = new BerkasSearch();

// --- Event Bus listeners ---
let broadcastListener = null;

// --- Initialize Dashboard ---
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Check Auth
    if (window.TMPT_Auth) {
      await window.TMPT_Auth.init();
      if (!window.TMPT_Auth.isUnlocked()) {
        window.location.href = '/app/auth/login/?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
        return;
      }

      window.TMPT_Auth.setupIdleListeners();
    }

    await initBerkasDB();
    await loadFsaaSettings();
    if (localFolderHandle) {
      try {
        await syncLocalFolderToOpfs();
      } catch (e) {
        console.error("Auto sync local folder failed on load:", e);
      }
    }
    await syncAllApps();
    await renderSidebar();
    await refreshContent();
    initEventListeners();

    // Listen for broadcast events
    broadcastListener = listenTMPT(async (event) => {
      console.log("[BERKAS] Menerima event bus:", event);
      if (event.type === TMPT_EVENTS.FILE_CREATED || event.type === TMPT_EVENTS.FILE_DELETED || event.type === TMPT_EVENTS.FILE_UPDATED) {
        await syncAllApps();
        await refreshContent();
      }
    });

  } catch (err) {
    console.error("Inisialisasi dasbor Berkas gagal:", err);
    if (window.TMPT_UI) {
      window.TMPT_UI.toast("Gagal memuat Berkas. Silakan coba lagi.", "error");
    }
  }
});

// --- App Synchronization Engine ---
async function syncAllApps() {
  console.log("[BERKAS] Memulai sinkronisasi metadata aplikasi...");
  const berkasFiles = await getFiles();
  const existingAppMap = new Map();
  berkasFiles.forEach(f => {
    if (f.app_id) {
      existingAppMap.set(`${f.type}-${f.app_id}`, f);
    }
  });

  const syncedKeys = new Set();

  // 1. Sync Catat (Catatan & Tugas)
  try {
    let catatNotes = [];
    let catatLists = [];
    const secMode = localStorage.getItem('catat_security_mode') || 'standard';

    if (secMode === 'encrypted' && window.TMPT_Auth && window.TMPT_Auth.isUnlocked()) {
      const key = window.TMPT_Auth.getKey();
      const encNotes = localStorage.getItem('catat_notes_enc');
      const encLists = localStorage.getItem('catat_lists_enc');
      if (encNotes) catatNotes = JSON.parse(await window.TMPT_Crypto.decrypt(encNotes, key));
      if (encLists) catatLists = JSON.parse(await window.TMPT_Crypto.decrypt(encLists, key));
    } else {
      const storedNotes = localStorage.getItem('catat_notes');
      const storedLists = localStorage.getItem('catat_lists');
      if (storedNotes) catatNotes = JSON.parse(storedNotes);
      if (storedLists) catatLists = JSON.parse(storedLists);
    }

    // Sync Notes
    for (const note of catatNotes) {
      if (note.id.startsWith('locked_')) continue;
      const key = `catat_notes-${note.id}`;
      syncedKeys.add(key);
      const existing = existingAppMap.get(key);

      const size = new Blob([note.body || '']).size;
      const updated = note.updated_at || new Date().toISOString();

      if (!existing) {
        await putFile({
          id: crypto.randomUUID(),
          name: note.title || 'Catatan Tanpa Judul',
          type: 'catat_notes',
          app_id: note.id,
          app_db: 'localStorage',
          opfs_path: null,
          folder_id: 'root',
          size_bytes: size,
          created_at: updated,
          updated_at: updated,
          last_opened: updated,
          starred: note.pinned || false,
          tags: note.tags || [],
          trash: note.trashed || false,
          trash_at: null
        });
      } else {
        // Sync metadata updates from app
        if (existing.name !== note.title || existing.size_bytes !== size || existing.starred !== note.pinned || existing.trash !== note.trashed) {
          existing.name = note.title || 'Catatan Tanpa Judul';
          existing.size_bytes = size;
          existing.starred = note.pinned || false;
          existing.trash = note.trashed || false;
          existing.updated_at = updated;
          await putFile(existing);
        }
      }
    }

    // Sync Lists
    for (const list of catatLists) {
      if (list.id.startsWith('locked_')) continue;
      const key = `catat_lists-${list.id}`;
      syncedKeys.add(key);
      const existing = existingAppMap.get(key);

      const size = new Blob([JSON.stringify(list.items || [])]).size;
      const updated = list.updated_at || new Date().toISOString();

      if (!existing) {
        await putFile({
          id: crypto.randomUUID(),
          name: list.name || 'Daftar Tugas Baru',
          type: 'catat_lists',
          app_id: list.id,
          app_db: 'localStorage',
          opfs_path: null,
          folder_id: 'root',
          size_bytes: size,
          created_at: updated,
          updated_at: updated,
          last_opened: updated,
          starred: false,
          tags: [],
          trash: false,
          trash_at: null
        });
      } else {
        if (existing.name !== list.name || existing.size_bytes !== size) {
          existing.name = list.name || 'Daftar Tugas Baru';
          existing.size_bytes = size;
          existing.updated_at = updated;
          await putFile(existing);
        }
      }
    }
  } catch (err) {
    console.error("Gagal sinkronisasi Catat:", err);
  }

  // 2. Sync Hitung (Spreadsheet)
  try {
    let hitungFiles = [];
    const secMode = localStorage.getItem('hitung_security_mode') || 'standard';
    if (secMode === 'encrypted' && window.TMPT_Auth && window.TMPT_Auth.isUnlocked()) {
      const key = window.TMPT_Auth.getKey();
      const encListStr = localStorage.getItem('hitung_file_list_enc');
      if (encListStr) {
        hitungFiles = JSON.parse(await window.TMPT_Crypto.decrypt(JSON.parse(encListStr), key)) || [];
      }
    } else {
      const listStr = localStorage.getItem('hitung_file_list');
      if (listStr) hitungFiles = JSON.parse(listStr) || [];
    }

    for (const sheet of hitungFiles) {
      const key = `hitung-${sheet.id}`;
      syncedKeys.add(key);
      const existing = existingAppMap.get(key);

      const created = sheet.created_at || new Date().toISOString();
      const updated = sheet.modified_at || sheet.created_at || new Date().toISOString();

      if (!existing) {
        await putFile({
          id: crypto.randomUUID(),
          name: sheet.title || 'Lembar Kerja Tanpa Judul',
          type: 'hitung',
          app_id: sheet.id,
          app_db: 'localStorage',
          opfs_path: null,
          folder_id: 'root',
          size_bytes: 512, // Default estimated size for spreadsheet
          created_at: created,
          updated_at: updated,
          last_opened: updated,
          starred: false,
          tags: [],
          trash: false,
          trash_at: null
        });
      } else {
        if (existing.name !== sheet.title) {
          existing.name = sheet.title || 'Lembar Kerja Tanpa Judul';
          existing.updated_at = updated;
          await putFile(existing);
        }
      }
    }
  } catch (err) {
    console.error("Gagal sinkronisasi Hitung:", err);
  }

  // 3. Sync Papan (Drawing Boards)
  try {
    const papanDb = await openTmptDB('tmpt_papan', 1, (database) => {
      if (!database.objectStoreNames.contains('boards')) {
        database.createObjectStore('boards', { keyPath: 'id' });
      }
    });
    const boards = await dbGetAll(papanDb, 'boards') || [];

    for (const board of boards) {
      const key = `papan-${board.id}`;
      syncedKeys.add(key);
      const existing = existingAppMap.get(key);

      const created = board.created_at || new Date().toISOString();
      const updated = board.updated_at || board.created_at || new Date().toISOString();
      
      const size = new Blob([JSON.stringify(board.elements || [])]).size;

      if (!existing) {
        await putFile({
          id: crypto.randomUUID(),
          name: board.title || 'Papan Coretan Tanpa Judul',
          type: 'papan',
          app_id: board.id,
          app_db: 'tmpt_papan',
          opfs_path: null,
          folder_id: 'root',
          size_bytes: size,
          created_at: created,
          updated_at: updated,
          last_opened: updated,
          starred: board.starred || false,
          tags: [],
          trash: board.trash || false,
          trash_at: null
        });
      } else {
        if (existing.name !== board.title || existing.size_bytes !== size || existing.starred !== (board.starred || false) || existing.trash !== (board.trash || false)) {
          existing.name = board.title || 'Papan Coretan Tanpa Judul';
          existing.size_bytes = size;
          existing.starred = board.starred || false;
          existing.trash = board.trash || false;
          existing.updated_at = updated;
          await putFile(existing);
        }
      }
    }
    papanDb.close();
  } catch (err) {
    console.error("Gagal sinkronisasi Papan:", err);
  }

  // 4. Sync Markdown (tmpt_markdown)
  try {
    const markdownDb = await openTmptDB('tmpt_markdown', 1, (database) => {
      if (!database.objectStoreNames.contains('documents')) {
        database.createObjectStore('documents', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('folders')) {
        database.createObjectStore('folders', { keyPath: 'id' });
      }
    });
    const mdDocs = await dbGetAll(markdownDb, 'documents') || [];

    for (const doc of mdDocs) {
      const key = `markdown-${doc.id}`;
      syncedKeys.add(key);
      const existing = existingAppMap.get(key);

      const created = doc.created_at || new Date().toISOString();
      const updated = doc.updated_at || doc.created_at || new Date().toISOString();
      const size = new Blob([doc.content || '']).size;

      if (!existing) {
        await putFile({
          id: crypto.randomUUID(),
          name: doc.title || 'Tanpa Judul',
          type: 'markdown',
          app_id: doc.id,
          app_db: 'tmpt_markdown',
          opfs_path: null,
          folder_id: 'root',
          size_bytes: size,
          created_at: created,
          updated_at: updated,
          last_opened: updated,
          starred: false,
          tags: [],
          trash: doc.trashed || false,
          trash_at: null
        });
      } else {
        if (existing.name !== doc.title || existing.size_bytes !== size || existing.trash !== (doc.trashed || false)) {
          existing.name = doc.title || 'Tanpa Judul';
          existing.size_bytes = size;
          existing.trash = doc.trashed || false;
          existing.updated_at = updated;
          await putFile(existing);
        }
      }
    }
    markdownDb.close();
  } catch (err) {
    console.error("Gagal sinkronisasi Markdown:", err);
  }

  // 5. Clean up deleted metadata of files that no longer exist in original apps
  for (const [key, file] of existingAppMap.entries()) {
    if (file.app_id && !syncedKeys.has(key)) {
      await deleteFileMetadata(file.id);
    }
  }

  // 4. Auto-register unique tags in the tags store
  try {
    const updatedFiles = await getFiles();
    const allTags = new Set();
    updatedFiles.forEach(f => {
      if (f.tags && Array.isArray(f.tags)) {
        f.tags.forEach(t => allTags.add(t.trim().toLowerCase()));
      }
    });

    const currentTags = await getTags();
    const currentTagNames = new Set(currentTags.map(t => t.name.toLowerCase()));

    for (const tagName of allTags) {
      if (tagName && !currentTagNames.has(tagName)) {
        const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        await putTag({
          id: crypto.randomUUID(),
          name: tagName,
          color: randomColor
        });
      }
    }
  } catch (err) {
    console.error("Gagal sinkronisasi tag otomatis:", err);
  }

  console.log("[BERKAS] Sinkronisasi metadata selesai.");
}



// --- Render Sidebar ---
async function renderSidebar() {
  // Folders list
  const folders = await getFolders();
  const folderListEl = document.getElementById('sidebar-folders-list');
  folderListEl.innerHTML = '';

  // Render root-level folders (parent_id is null or root)
  const rootFolders = folders.filter(f => !f.parent_id || f.parent_id === 'root');
  
  if (rootFolders.length === 0) {
    folderListEl.innerHTML = '<li style="font-size: 0.75rem; color: var(--pico-secondary-color); padding: 0.25rem 0.5rem;">Tidak ada folder</li>';
  } else {
    rootFolders.forEach(folder => {
      const li = document.createElement('li');
      li.innerHTML = `
        <a class="folder-tree-item" data-id="${folder.id}">
          <span style="color: ${folder.color || '#3b82f6'};">📁</span>
          <span>${escapeHtml(folder.name)}</span>
        </a>
      `;
      folderListEl.appendChild(li);
    });
  }

  // Tags list
  const tags = await getTags();
  const tagsListEl = document.getElementById('sidebar-tags-list');
  tagsListEl.innerHTML = '';

  if (tags.length === 0) {
    tagsListEl.innerHTML = '<span style="font-size: 0.75rem; color: var(--pico-secondary-color);">Belum ada tag</span>';
  } else {
    tags.forEach(tag => {
      const badge = document.createElement('span');
      badge.className = `tag-badge ${selectedTag === tag.name ? 'selected' : ''}`;
      badge.style.backgroundColor = tag.color || '#6b7280';
      badge.style.color = '#ffffff';
      badge.textContent = `#${tag.name}`;
      badge.dataset.name = tag.name;
      tagsListEl.appendChild(badge);
    });
  }

  // Update Storage Usage Indicator
  await updateStorageDetails();
}

async function updateStorageDetails() {
  const opfsBytes = await getOpfsFolderSize();
  const berkasFiles = await getFiles();
  
  let idbBytes = 0;
  try {
    idbBytes = new Blob([JSON.stringify(berkasFiles)]).size;
  } catch(e){}

  // Check localStorage size for Catat & Hitung
  let catatBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('catat_') || key.startsWith('hitung_')) {
      catatBytes += (localStorage.getItem(key) || '').length;
    }
  }

  const totalBytes = opfsBytes + idbBytes + catatBytes;
  
  // Format sizes
  const formattedTotal = formatBytes(totalBytes);
  const percent = Math.min(100, Math.max(0.1, Math.round((totalBytes / (1024 * 1024 * 1024)) * 100))); // 1 GB estimate quota

  const progressEl = document.getElementById('storage-progress');
  const percentEl = document.getElementById('storage-percent');
  const detailsEl = document.getElementById('storage-details');

  if (progressEl) progressEl.value = percent;
  if (percentEl) percentEl.textContent = `${percent}%`;
  if (detailsEl) detailsEl.textContent = `${formattedTotal} / Estimasi 1 GB`;

  // Warn if > 80%
  if (percent > 80 && progressEl) {
    progressEl.style.accentColor = 'var(--pico-danger-color)';
  } else if (progressEl) {
    progressEl.style.accentColor = '';
  }
}

// --- Refresh Dashboard Content Pane ---
async function refreshContent() {
  selectedFiles.clear();
  updateBulkActionBar();

  const query = document.getElementById('search-input').value;
  const fileType = document.getElementById('filter-type').value;
  const sortByEl = document.getElementById('sort-by').value;
  const [sortBy, sortDir] = sortByEl.split('-');

  // Define Search options
  const searchOptions = {
    starredOnly: activeFilter === 'starred',
    showTrash: activeFilter === 'trash',
    folderId: activeFilter === 'all' && !query && !selectedTag ? currentFolderId : undefined,
    tag: selectedTag,
    type: fileType,
    sortBy: sortBy,
    sortDir: sortDir
  };

  const results = await searchEngine.search(query, searchOptions);
  
  // Folders Rendering
  const foldersGrid = document.getElementById('folders-grid');
  const foldersSection = document.getElementById('folders-section');
  
  if (activeFilter === 'all' && !query && !selectedTag) {
    const allFolders = await getFolders();
    const subFolders = allFolders.filter(f => f.parent_id === currentFolderId);
    
    if (subFolders.length > 0) {
      foldersSection.style.display = 'block';
      foldersGrid.innerHTML = subFolders.map(folder => `
        <div class="folder-card" data-id="${folder.id}">
          <span class="folder-card-icon" style="color: ${folder.color || '#3b82f6'};">📁</span>
          <span class="folder-card-name" title="${escapeHtml(folder.name)}">${escapeHtml(folder.name)}</span>
        </div>
      `).join('');
    } else {
      foldersSection.style.display = 'none';
    }
  } else {
    foldersSection.style.display = 'none';
  }

  // Render Files
  const viewContainer = document.getElementById('files-view-container');
  const filesTitleEl = document.getElementById('files-section-title');

  if (activeFilter === 'trash') {
    filesTitleEl.innerHTML = `Tempat Sampah <button id="btn-empty-trash" class="outline" style="padding: 0.2rem 0.6rem; font-size: 0.8rem; margin: 0 0 0 1rem; display: inline-block; width: auto; color: var(--pico-danger-color); border-color: var(--pico-danger-color); border-radius: 8px;">🗑️ Kosongkan Sampah</button>`;
    setTimeout(() => {
      document.getElementById('btn-empty-trash')?.addEventListener('click', handleEmptyTrash);
    }, 0);
  } else if (activeFilter === 'starred') {
    filesTitleEl.textContent = 'Berkas Berbintang';
  } else if (selectedTag) {
    filesTitleEl.textContent = `Tag: #${selectedTag}`;
  } else {
    filesTitleEl.textContent = 'Berkas';
  }

  if (results.length === 0) {
    viewContainer.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">📂</span>
        <h3>Tidak ada berkas</h3>
        <p class="secondary">Tidak menemukan berkas yang cocok dengan filter atau kata kunci Anda.</p>
      </div>
    `;
    return;
  }

  if (currentViewMode === 'grid') {
    viewContainer.innerHTML = `
      <div class="files-grid">
        ${results.map(file => renderFileCard(file)).join('')}
      </div>
    `;
  } else {
    viewContainer.innerHTML = `
      <div style="overflow-x: auto;">
        <table class="file-list-table">
          <thead>
            <tr>
              <th style="width: 40px;"><input type="checkbox" id="select-all-checkbox"></th>
              <th>Nama</th>
              <th>Tipe</th>
              <th>Ukuran</th>
              <th>Terakhir Diubah</th>
            </tr>
          </thead>
          <tbody>
            ${results.map(file => renderFileListRow(file)).join('')}
          </tbody>
        </table>
      </div>
    `;
    
    // Select all checkbox listener
    document.getElementById('select-all-checkbox')?.addEventListener('change', (e) => {
      const checkboxes = viewContainer.querySelectorAll('.file-row-checkbox');
      checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
        const row = cb.closest('tr');
        const id = cb.dataset.id;
        if (e.target.checked) {
          selectedFiles.add(id);
          row.classList.add('selected');
        } else {
          selectedFiles.delete(id);
          row.classList.remove('selected');
        }
      });
      updateBulkActionBar();
    });
  }

  updateBreadcrumbs();
}

function renderFileCard(file) {
  const isImg = file.type === 'image';
  const previewContent = isImg && file.opfs_path
    ? `<img src="" data-opfs-img="${file.opfs_path}" alt="${escapeHtml(file.name)}" loading="lazy">`
    : getFileTypeEmoji(file.type);
  const starredIcon = file.starred ? '★' : '☆';
  const starColor = file.starred ? '#f59e0b' : 'var(--pico-secondary-color)';
  
  const isSelected = selectedFiles.has(file.id) ? 'selected' : '';
  const localIndicator = (file.opfs_path && localFolderHandle) ? ' <span title="Tersinkronisasi ke Folder Lokal" style="font-size: 0.8rem; opacity: 0.75; vertical-align: middle;">💻</span>' : '';

  // Load preview async if it's an image
  if (isImg && file.opfs_path) {
    setTimeout(() => loadOpfsImageSrc(file.opfs_path), 50);
  }

  return `
    <div class="file-card ${isSelected}" data-id="${file.id}">
      <div class="file-card-preview">
        ${previewContent}
      </div>
      <span class="file-card-star" style="color: ${starColor};" data-id="${file.id}">${starredIcon}</span>
      <div class="file-card-info">
        <span class="file-card-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}${localIndicator}</span>
        <div class="file-card-meta">
          <span class="app-badge badge-${file.type}">${getFileTypeLabel(file.type)}</span>
          <span>${formatBytes(file.size_bytes)}</span>
        </div>
      </div>
    </div>
  `;
}

function renderFileListRow(file) {
  const isSelected = selectedFiles.has(file.id) ? 'selected' : '';
  const dateStr = formatRelativeTime(file.updated_at);
  const starredIcon = file.starred ? '★' : '';
  const localIndicator = (file.opfs_path && localFolderHandle) ? ' <span title="Tersinkronisasi ke Folder Lokal" style="font-size: 0.9rem; filter: opacity(0.85); vertical-align: middle;">💻</span>' : '';

  return `
    <tr class="file-list-row ${isSelected}" data-id="${file.id}">
      <td><input type="checkbox" class="file-row-checkbox" data-id="${file.id}" ${isSelected ? 'checked' : ''}></td>
      <td>
        <span style="font-size: 1.2rem; margin-right: 0.5rem;">${getFileTypeEmoji(file.type)}</span>
        <strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong>${localIndicator}
        <span style="color:#f59e0b; margin-left: 0.25rem;">${starredIcon}</span>
      </td>
      <td><span class="app-badge badge-${file.type}">${getFileTypeLabel(file.type)}</span></td>
      <td>${formatBytes(file.size_bytes)}</td>
      <td>${dateStr}</td>
    </tr>
  `;
}

async function loadOpfsImageSrc(fileName) {
  try {
    const file = await getFileFromOpfs(fileName);
    const url = URL.createObjectURL(file);
    const imgs = document.querySelectorAll(`img[data-opfs-img="${fileName}"]`);
    imgs.forEach(img => {
      img.src = url;
      img.removeAttribute('data-opfs-img');
    });
  } catch (e) {
    console.error(e);
  }
}

// --- Breadcrumbs & Navigation Path ---
async function updateBreadcrumbs() {
  const crumbs = document.getElementById('breadcrumbs-list');
  crumbs.innerHTML = '';

  const rootCrumb = document.createElement('li');
  rootCrumb.innerHTML = `<a href="#" data-folder-id="root">Utama</a>`;
  crumbs.appendChild(rootCrumb);

  if (currentFolderId !== 'root') {
    const path = [];
    let currentId = currentFolderId;
    
    // Traverse parent folders (max 3 levels anyway)
    while (currentId && currentId !== 'root') {
      const folder = await getFolder(currentId);
      if (folder) {
        path.unshift(folder);
        currentId = folder.parent_id;
      } else {
        break;
      }
    }

    path.forEach(folder => {
      const li = document.createElement('li');
      li.innerHTML = `<a href="#" data-folder-id="${folder.id}">${escapeHtml(folder.name)}</a>`;
      crumbs.appendChild(li);
    });
  }
}

// --- UI Actions & Handlers ---
async function handleStarFile(id) {
  const file = await getFile(id);
  if (file) {
    file.starred = !file.starred;
    file.updated_at = new Date().toISOString();
    await putFile(file);
    if (file.type === 'catat_notes') {
      // Sync back pinned state to Catat
      await updateCatatNotePinned(file.app_id, file.starred);
    } else if (file.type === 'papan') {
      await updatePapanBoardStarred(file.app_id, file.starred);
    }
    await refreshContent();
  }
}

async function updateCatatNotePinned(noteId, isPinned) {
  try {
    const secMode = localStorage.getItem('catat_security_mode') || 'standard';
    let notes = [];
    let key = null;
    let encKey = null;

    if (secMode === 'encrypted' && window.TMPT_Auth && window.TMPT_Auth.isUnlocked()) {
      encKey = window.TMPT_Auth.getKey();
      const encNotes = localStorage.getItem('catat_notes_enc');
      if (encNotes) notes = JSON.parse(await window.TMPT_Crypto.decrypt(encNotes, encKey));
    } else {
      const storedNotes = localStorage.getItem('catat_notes');
      if (storedNotes) notes = JSON.parse(storedNotes);
    }

    const noteIndex = notes.findIndex(n => n.id === noteId);
    if (noteIndex > -1) {
      notes[noteIndex].pinned = isPinned;
      notes[noteIndex].updated_at = new Date().toISOString();
      
      const dataStr = JSON.stringify(notes);
      if (secMode === 'encrypted' && encKey) {
        const enc = await window.TMPT_Crypto.encrypt(dataStr, encKey);
        localStorage.setItem('catat_notes_enc', enc);
      } else {
        localStorage.setItem('catat_notes', dataStr);
      }
    }
  } catch(e){
    console.error(e);
  }
}

async function updateCatatNoteTrashed(noteId, isTrashed) {
  try {
    const secMode = localStorage.getItem('catat_security_mode') || 'standard';
    let notes = [];
    let encKey = null;

    if (secMode === 'encrypted' && window.TMPT_Auth && window.TMPT_Auth.isUnlocked()) {
      encKey = window.TMPT_Auth.getKey();
      const encNotes = localStorage.getItem('catat_notes_enc');
      if (encNotes) notes = JSON.parse(await window.TMPT_Crypto.decrypt(encNotes, encKey));
    } else {
      const storedNotes = localStorage.getItem('catat_notes');
      if (storedNotes) notes = JSON.parse(storedNotes);
    }

    const noteIndex = notes.findIndex(n => n.id === noteId);
    if (noteIndex > -1) {
      notes[noteIndex].trashed = isTrashed;
      if (isTrashed) {
        notes[noteIndex].pinned = false;
      }
      notes[noteIndex].updated_at = new Date().toISOString();
      
      const dataStr = JSON.stringify(notes);
      if (secMode === 'encrypted' && encKey) {
        const enc = await window.TMPT_Crypto.encrypt(dataStr, encKey);
        localStorage.setItem('catat_notes_enc', enc);
      } else {
        localStorage.setItem('catat_notes', dataStr);
      }
    }
  } catch (e) {
    console.error("Gagal menyinkronkan status trashed ke Catat:", e);
  }
}

async function updatePapanBoardStarred(boardId, isStarred) {
  try {
    const papanDb = await openTmptDB('tmpt_papan', 1, (database) => {
      if (!database.objectStoreNames.contains('boards')) {
        database.createObjectStore('boards', { keyPath: 'id' });
      }
    });
    const transaction = papanDb.transaction('boards', 'readwrite');
    const store = transaction.objectStore('boards');
    const req = store.get(boardId);
    req.onsuccess = () => {
      const board = req.result;
      if (board) {
        board.starred = isStarred;
        board.updated_at = new Date().toISOString();
        store.put(board);
      }
    };
    transaction.oncomplete = () => {
      papanDb.close();
    };
  } catch (e) {
    console.error("Gagal menyinkronkan status starred ke Papan:", e);
  }
}

async function updatePapanBoardTrashed(boardId, isTrashed) {
  try {
    const papanDb = await openTmptDB('tmpt_papan', 1, (database) => {
      if (!database.objectStoreNames.contains('boards')) {
        database.createObjectStore('boards', { keyPath: 'id' });
      }
    });
    const transaction = papanDb.transaction('boards', 'readwrite');
    const store = transaction.objectStore('boards');
    const req = store.get(boardId);
    req.onsuccess = () => {
      const board = req.result;
      if (board) {
        board.trash = isTrashed;
        if (isTrashed) {
          board.starred = false;
        }
        board.updated_at = new Date().toISOString();
        store.put(board);
      }
    };
    transaction.oncomplete = () => {
      papanDb.close();
    };
  } catch (e) {
    console.error("Gagal menyinkronkan status trashed ke Papan:", e);
  }
}

async function deletePapanBoardRecord(boardId) {
  try {
    const papanDb = await openTmptDB('tmpt_papan', 1, (database) => {
      if (!database.objectStoreNames.contains('boards')) {
        database.createObjectStore('boards', { keyPath: 'id' });
      }
    });
    const transaction = papanDb.transaction('boards', 'readwrite');
    const store = transaction.objectStore('boards');
    store.delete(boardId);
    transaction.oncomplete = () => {
      papanDb.close();
    };
  } catch (e) {
    console.error("Gagal menghapus board dari Papan:", e);
  }
}

async function updateMarkdownDocTrashed(docId, isTrashed) {
  try {
    const markdownDb = await openTmptDB('tmpt_markdown', 1, (database) => {
      if (!database.objectStoreNames.contains('documents')) {
        database.createObjectStore('documents', { keyPath: 'id' });
      }
    });
    const transaction = markdownDb.transaction('documents', 'readwrite');
    const store = transaction.objectStore('documents');
    const req = store.get(docId);
    req.onsuccess = () => {
      const doc = req.result;
      if (doc) {
        doc.trashed = isTrashed;
        doc.updated_at = new Date().toISOString();
        store.put(doc);
      }
    };
    transaction.oncomplete = () => {
      markdownDb.close();
    };
  } catch (e) {
    console.error("Gagal menyinkronkan status trashed ke Markdown:", e);
  }
}

async function deleteMarkdownRecord(docId) {
  try {
    const markdownDb = await openTmptDB('tmpt_markdown', 1, (database) => {
      if (!database.objectStoreNames.contains('documents')) {
        database.createObjectStore('documents', { keyPath: 'id' });
      }
    });
    const transaction = markdownDb.transaction('documents', 'readwrite');
    const store = transaction.objectStore('documents');
    store.delete(docId);
    transaction.oncomplete = () => {
      markdownDb.close();
    };
  } catch (e) {
    console.error("Gagal menghapus record dari Markdown:", e);
  }
}

async function handleRestoreFile(id) {
  const file = await getFile(id);
  if (!file) return;

  file.trash = false;
  file.trash_at = null;
  file.updated_at = new Date().toISOString();
  await putFile(file);

  if (file.type === 'catat_notes') {
    await updateCatatNoteTrashed(file.app_id, false);
  } else if (file.type === 'papan') {
    await updatePapanBoardTrashed(file.app_id, false);
  } else if (file.type === 'markdown') {
    await updateMarkdownDocTrashed(file.app_id, false);
  }

  // Hapus dari registry fsaa_deleted_files jika dipulihkan
  try {
    const deletedList = JSON.parse(await getSetting('fsaa_deleted_files') || '[]');
    const index = deletedList.indexOf(file.name);
    if (index > -1) {
      deletedList.splice(index, 1);
      await putSetting('fsaa_deleted_files', JSON.stringify(deletedList));
    }
  } catch (e) {
    console.error(e);
  }

  if (window.TMPT_UI) window.TMPT_UI.toast(`Berkas "${file.name}" dipulihkan.`, "success");
  await refreshContent();
}

async function handleEmptyTrash() {
  if (window.TMPT_UI) {
    const ok = await window.TMPT_UI.confirm("Apakah Anda yakin ingin mengosongkan semua berkas di Tempat Sampah secara permanen? Tindakan ini tidak dapat dibatalkan.");
    if (!ok) return;
  }

  if (window.TMPT_UI) window.TMPT_UI.setLoading('body', true);
  try {
    const files = await getFiles();
    const trashedFiles = files.filter(f => f.trash);

    for (const file of trashedFiles) {
      // Hapus berkas OPFS jika ada
      if (file.opfs_path) {
        await removeFileFromOpfs(file.opfs_path);
      }

      // Hapus file fisik lokal jika terhubung
      if (localFolderHandle) {
        try {
          await deleteLocalFile(localFolderHandle, file.name);
        } catch (err) {
          console.error("Gagal menghapus file lokal:", err);
        }
      }

      // Catat ke registry fsaa_deleted_files
      try {
        const deletedList = JSON.parse(await getSetting('fsaa_deleted_files') || '[]');
        if (!deletedList.includes(file.name)) {
          deletedList.push(file.name);
          await putSetting('fsaa_deleted_files', JSON.stringify(deletedList));
        }
      } catch (e) {
        console.error(e);
      }

      // Hapus dari penyimpanan asli aplikasi
      if (file.type.startsWith('catat_')) {
        await deleteCatatRecord(file.type, file.app_id);
      } else if (file.type === 'hitung') {
        await deleteHitungRecord(file.app_id);
      } else if (file.type === 'papan') {
        await deletePapanBoardRecord(file.app_id);
      } else if (file.type === 'markdown') {
        await deleteMarkdownRecord(file.app_id);
      }

      await deleteFileMetadata(file.id);
    }

    if (window.TMPT_UI) window.TMPT_UI.toast("Tempat Sampah berhasil dikosongkan.", "success");
  } catch (err) {
    console.error("Gagal mengosongkan sampah:", err);
  } finally {
    if (window.TMPT_UI) window.TMPT_UI.setLoading('body', false);
  }
  await refreshContent();
  await updateStorageDetails();
}

async function handleDeleteFile(id, permanent = false) {
  const file = await getFile(id);
  if (!file) return;

  if (file.trash && !permanent) {
    permanent = true;
  }

  if (permanent) {
    if (window.TMPT_UI) {
      const ok = await window.TMPT_UI.confirm(`Hapus berkas "${file.name}" secara permanen? Data tidak dapat dipulihkan.`);
      if (!ok) return;
    }
    
    if (file.opfs_path) {
      await removeFileFromOpfs(file.opfs_path);
    }

    if (localFolderHandle) {
      try {
        await deleteLocalFile(localFolderHandle, file.name);
      } catch (err) {
        console.error("Gagal menghapus file lokal:", err);
      }
    }

    // Catat ke registry fsaa_deleted_files
    try {
      const deletedList = JSON.parse(await getSetting('fsaa_deleted_files') || '[]');
      if (!deletedList.includes(file.name)) {
        deletedList.push(file.name);
        await putSetting('fsaa_deleted_files', JSON.stringify(deletedList));
      }
    } catch (e) {
      console.error(e);
    }

    if (file.type.startsWith('catat_')) {
      await deleteCatatRecord(file.type, file.app_id);
    } else if (file.type === 'hitung') {
      await deleteHitungRecord(file.app_id);
    } else if (file.type === 'papan') {
      await deletePapanBoardRecord(file.app_id);
    } else if (file.type === 'markdown') {
      await deleteMarkdownRecord(file.app_id);
    }

    await deleteFileMetadata(id);
    if (window.TMPT_UI) window.TMPT_UI.toast("Berkas dihapus permanen.", "success");
  } else {
    file.trash = true;
    file.trash_at = new Date().toISOString();
    await putFile(file);
    if (file.type === 'catat_notes') {
      await updateCatatNoteTrashed(file.app_id, true);
    } else if (file.type === 'papan') {
      await updatePapanBoardTrashed(file.app_id, true);
    } else if (file.type === 'markdown') {
      await updateMarkdownDocTrashed(file.app_id, true);
    }
    if (window.TMPT_UI) window.TMPT_UI.toast("Berkas dipindahkan ke Sampah.", "success");
  }
  await refreshContent();
  await updateStorageDetails();
}

async function deleteCatatRecord(type, id) {
  try {
    const secMode = localStorage.getItem('catat_security_mode') || 'standard';
    let key = type === 'catat_notes' ? 'catat_notes' : 'catat_lists';
    let keyEnc = type === 'catat_notes' ? 'catat_notes_enc' : 'catat_lists_enc';
    let data = [];
    let encKey = null;

    if (secMode === 'encrypted' && window.TMPT_Auth && window.TMPT_Auth.isUnlocked()) {
      encKey = window.TMPT_Auth.getKey();
      const encVal = localStorage.getItem(keyEnc);
      if (encVal) data = JSON.parse(await window.TMPT_Crypto.decrypt(encVal, encKey));
    } else {
      const stored = localStorage.getItem(key);
      if (stored) data = JSON.parse(stored);
    }

    data = data.filter(item => item.id !== id);
    const dataStr = JSON.stringify(data);

    if (secMode === 'encrypted' && encKey) {
      const enc = await window.TMPT_Crypto.encrypt(dataStr, encKey);
      localStorage.setItem(keyEnc, enc);
    } else {
      localStorage.setItem(key, dataStr);
    }
  } catch(e){
    console.error(e);
  }
}

async function deleteHitungRecord(id) {
  try {
    const secMode = localStorage.getItem('hitung_security_mode') || 'standard';
    let hitungFiles = [];
    let encKey = null;

    if (secMode === 'encrypted' && window.TMPT_Auth && window.TMPT_Auth.isUnlocked()) {
      encKey = window.TMPT_Auth.getKey();
      const encListStr = localStorage.getItem('hitung_file_list_enc');
      if (encListStr) {
        hitungFiles = JSON.parse(await window.TMPT_Crypto.decrypt(JSON.parse(encListStr), encKey)) || [];
      }
    } else {
      const listStr = localStorage.getItem('hitung_file_list');
      if (listStr) hitungFiles = JSON.parse(listStr) || [];
    }

    hitungFiles = hitungFiles.filter(sheet => sheet.id !== id);
    const listStr = JSON.stringify(hitungFiles);

    if (secMode === 'encrypted' && encKey) {
      const encList = await window.TMPT_Crypto.encrypt(listStr, encKey);
      localStorage.setItem('hitung_file_list_enc', JSON.stringify(encList));
      localStorage.removeItem(`hitung_file_enc_${id}`);
    } else {
      localStorage.setItem('hitung_file_list', listStr);
      localStorage.removeItem(`hitung_file_${id}`);
    }
  } catch(e){
    console.error(e);
  }
}

async function handleOpenFile(id) {
  const file = await getFile(id);
  if (!file) return;

  if (file.trash) {
    if (window.TMPT_UI) window.TMPT_UI.toast("Pulihkan berkas terlebih dahulu untuk membukanya.", "warning");
    return;
  }

  // File type specific redirect / open
  if (file.type === 'catat_notes' || file.type === 'catat_lists') {
    window.location.href = `/app/kerja/catatan/index.html?id=${file.app_id}`;
  } else if (file.type === 'hitung') {
    window.location.href = `/app/kerja/hitung/index.html?id=${file.app_id}`;
  } else if (file.type === 'papan') {
    window.location.href = `/app/kerja/papan/editor.html?id=${file.app_id}`;
  } else if (file.type === 'markdown') {
    window.location.href = `/app/dev/markdown/?id=${file.app_id}`;
  } else if (file.type === 'pdf' || file.type === 'image') {
    if (file.opfs_path) {
      const blob = await getFileFromOpfs(file.opfs_path);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } else {
      await handlePreviewFile(id);
    }
  } else {
    // Check extension for uploaded files (which have opfs_path)
    if (file.opfs_path) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'xlsx' || ext === 'csv' || ext === 'hitung') {
        window.location.href = `/app/kerja/hitung/index.html?import_opfs=${encodeURIComponent(file.opfs_path)}&name=${encodeURIComponent(file.name)}`;
        return;
      } else if (ext === 'txt' || ext === 'md') {
        window.location.href = `/app/kerja/catatan/index.html?import_opfs=${encodeURIComponent(file.opfs_path)}&name=${encodeURIComponent(file.name)}`;
        return;
      }
    }
    // Trigger download for other binary files
    await handleDownloadFile(id);
  }
}

async function handlePreviewFile(id) {
  const file = await getFile(id);
  if (!file || !file.opfs_path) return;

  try {
    const blob = await getFileFromOpfs(file.opfs_path);
    const url = URL.createObjectURL(blob);
    
    const titleEl = document.getElementById('preview-title');
    const bodyEl = document.getElementById('preview-content-body');
    const dlBtn = document.getElementById('preview-download-btn');

    titleEl.textContent = file.name;
    bodyEl.innerHTML = '';

    if (file.type === 'image') {
      const img = document.createElement('img');
      img.src = url;
      img.style.maxHeight = '100%';
      img.style.maxWidth = '100%';
      img.style.objectFit = 'contain';
      bodyEl.appendChild(img);
    } else if (file.type === 'pdf') {
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      bodyEl.appendChild(iframe);
    }

    dlBtn.onclick = () => {
      triggerBrowserDownload(url, file.name);
    };

    document.getElementById('modal-preview').showModal();
  } catch (err) {
    console.error("Gagal memicu pratinjau:", err);
    if (window.TMPT_UI) window.TMPT_UI.toast("Format berkas tidak didukung atau pratinjau gagal.", "error");
  }
}

async function handleDownloadFile(id) {
  const file = await getFile(id);
  if (!file) return;

  if (file.opfs_path) {
    const blob = await getFileFromOpfs(file.opfs_path);
    const url = URL.createObjectURL(blob);
    triggerBrowserDownload(url, file.name);
  } else if (file.type === 'catat_notes') {
    // Download as markdown / txt
    const blob = new Blob([file.name + "\n\n"], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    triggerBrowserDownload(url, `${file.name}.md`);
  } else {
    if (window.TMPT_UI) window.TMPT_UI.toast("Fitur unduh untuk tipe berkas ini belum didukung.", "warning");
  }
}

function triggerBrowserDownload(url, name) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// --- Bulk Action Bar ---
function updateBulkActionBar() {
  const bar = document.getElementById('bulk-bar');
  
  if (selectedFiles.size > 0) {
    bar.style.display = 'flex';
    
    if (activeFilter === 'trash') {
      bar.innerHTML = `
        <span id="bulk-selected-count">${selectedFiles.size} berkas terpilih</span>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button class="outline" id="bulk-btn-restore" style="padding: 0.25rem 0.5rem; margin: 0; font-size: 0.8rem; border-radius: 6px;">🔄 Pulihkan</button>
          <button class="outline secondary" id="bulk-btn-delete-perm" style="padding: 0.25rem 0.5rem; margin: 0; font-size: 0.8rem; border-radius: 6px; color: var(--pico-danger-color); border-color: var(--pico-danger-color);">🗑️ Hapus Permanen</button>
          <button class="outline secondary" id="bulk-btn-clear" style="padding: 0.25rem 0.5rem; margin: 0; font-size: 0.8rem; border-radius: 6px;">Batal</button>
        </div>
      `;
      document.getElementById('bulk-btn-restore')?.addEventListener('click', async () => {
        for (const id of selectedFiles) {
          await handleRestoreFile(id);
        }
        selectedFiles.clear();
        await refreshContent();
      });
      document.getElementById('bulk-btn-delete-perm')?.addEventListener('click', async () => {
        const ok = await window.TMPT_UI.confirm(`Hapus secara permanen ${selectedFiles.size} berkas terpilih dari Tempat Sampah?`);
        if (!ok) return;
        for (const id of selectedFiles) {
          await handleDeleteFile(id, true);
        }
        selectedFiles.clear();
        await refreshContent();
      });
      document.getElementById('bulk-btn-clear')?.addEventListener('click', () => {
        selectedFiles.clear();
        refreshContent();
      });
    } else {
      bar.innerHTML = `
        <span id="bulk-selected-count">${selectedFiles.size} berkas terpilih</span>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button class="outline" id="bulk-btn-star" style="padding: 0.25rem 0.5rem; margin: 0; font-size: 0.8rem; border-radius: 6px;">⭐ Bintang</button>
          <button class="outline" id="bulk-btn-tag" style="padding: 0.25rem 0.5rem; margin: 0; font-size: 0.8rem; border-radius: 6px;">🏷️ Tag</button>
          <button class="outline" id="bulk-btn-move" style="padding: 0.25rem 0.5rem; margin: 0; font-size: 0.8rem; border-radius: 6px;">📁 Pindahkan</button>
          <button class="outline secondary" id="bulk-btn-delete" style="padding: 0.25rem 0.5rem; margin: 0; font-size: 0.8rem; border-radius: 6px; color: var(--pico-danger-color); border-color: var(--pico-danger-color);">🗑️ Hapus</button>
          <button class="outline secondary" id="bulk-btn-clear" style="padding: 0.25rem 0.5rem; margin: 0; font-size: 0.8rem; border-radius: 6px;">Batal</button>
        </div>
      `;
      document.getElementById('bulk-btn-clear')?.addEventListener('click', () => {
        selectedFiles.clear();
        refreshContent();
      });
      document.getElementById('bulk-btn-star')?.addEventListener('click', async () => {
        for (const id of selectedFiles) {
          const file = await getFile(id);
          if (file) {
            file.starred = true;
            await putFile(file);
          }
        }
        selectedFiles.clear();
        await refreshContent();
      });
      document.getElementById('bulk-btn-delete')?.addEventListener('click', async () => {
        if (window.TMPT_UI) {
          const ok = await window.TMPT_UI.confirm(`Hapus ${selectedFiles.size} berkas terpilih?`);
          if (!ok) return;
        }
        for (const id of selectedFiles) {
          await handleDeleteFile(id);
        }
        selectedFiles.clear();
        await refreshContent();
      });
      document.getElementById('bulk-btn-move')?.addEventListener('click', () => {
        openMoveFileModal(Array.from(selectedFiles));
      });
    }
  } else {
    bar.style.display = 'none';
  }
}

// --- Event Listeners and Routing ---
function initEventListeners() {
  // Sidebar links
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-nav .nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      activeFilter = link.dataset.view;
      selectedTag = null;
      document.querySelectorAll('.tag-badge').forEach(b => b.classList.remove('selected'));
      
      await refreshContent();
    });
  });

  // Sidebar Folder Add
  document.getElementById('sidebar-add-folder')?.addEventListener('click', () => {
    openFolderCrudModal();
  });

  // Breadcrumbs navigation
  document.getElementById('breadcrumbs-list')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const folderId = e.target.dataset.folderId;
    if (folderId) {
      currentFolderId = folderId;
      activeFilter = 'all';
      selectedTag = null;
      document.querySelectorAll('.sidebar-nav .nav-link').forEach(l => l.classList.remove('active'));
      document.querySelector('.sidebar-nav .nav-link[data-view="all"]')?.classList.add('active');
      await refreshContent();
    }
  });

  // Search input & Filter selects
  let debounceTimer;
  document.getElementById('search-input')?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => refreshContent(), 300);
  });
  document.getElementById('filter-type')?.addEventListener('change', () => refreshContent());
  document.getElementById('sort-by')?.addEventListener('change', () => refreshContent());

  // View switchers
  document.getElementById('btn-view-grid')?.addEventListener('click', () => {
    currentViewMode = 'grid';
    localStorage.setItem('berkas_view_mode', 'grid');
    document.getElementById('btn-view-grid').classList.remove('secondary');
    document.getElementById('btn-view-list').classList.add('secondary');
    refreshContent();
  });
  document.getElementById('btn-view-list')?.addEventListener('click', () => {
    currentViewMode = 'list';
    localStorage.setItem('berkas_view_mode', 'list');
    document.getElementById('btn-view-grid').classList.add('secondary');
    document.getElementById('btn-view-list').classList.remove('secondary');
    refreshContent();
  });

  // New menu buttons
  document.getElementById('new-doc-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openAppWithContext('/app/kerja/tulis/editor.html', null, 'berkas', { new: 1, folder_id: currentFolderId });
  });
  document.getElementById('new-slide-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openAppWithContext('/app/kerja/slide/editor.html', null, 'berkas', { new: 1, folder_id: currentFolderId });
  });
  document.getElementById('new-form-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openAppWithContext('/app/kerja/forms/builder.html', null, 'berkas', { new: 1, folder_id: currentFolderId });
  });
  document.getElementById('new-papan-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `/app/kerja/papan/index.html`;
  });
  document.getElementById('new-folder-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('new-dropdown').removeAttribute('open');
    openFolderCrudModal();
  });

  // Upload File picker triggers
  const filePicker = document.getElementById('file-picker-input');
  document.getElementById('upload-file-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('new-dropdown').removeAttribute('open');
    filePicker.click();
  });
  filePicker?.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
      await handleUploadFiles(e.target.files);
    }
  });

  // Sidebar dynamic folder click & tags click delegator
  document.getElementById('sidebar-folders-list')?.addEventListener('click', async (e) => {
    const a = e.target.closest('.folder-tree-item');
    if (a) {
      e.preventDefault();
      currentFolderId = a.dataset.id;
      activeFilter = 'all';
      selectedTag = null;
      await refreshContent();
    }
  });
  document.getElementById('sidebar-tags-list')?.addEventListener('click', async (e) => {
    const badge = e.target.closest('.tag-badge');
    if (badge) {
      if (selectedTag === badge.dataset.name) {
        selectedTag = null;
        badge.classList.remove('selected');
      } else {
        document.querySelectorAll('.tag-badge').forEach(b => b.classList.remove('selected'));
        selectedTag = badge.dataset.name;
        badge.classList.add('selected');
      }
      activeFilter = 'all';
      await refreshContent();
    }
  });

  // Drag and Drop implementation
  const mainPanel = document.querySelector('.berkas-main');
  const overlay = document.getElementById('drag-overlay');

  mainPanel?.addEventListener('dragover', (e) => {
    e.preventDefault();
    overlay.classList.add('active');
  });
  overlay?.addEventListener('dragleave', () => {
    overlay.classList.remove('active');
  });
  overlay?.addEventListener('drop', async (e) => {
    e.preventDefault();
    overlay.classList.remove('active');
    if (e.dataTransfer.files.length > 0) {
      await handleUploadFiles(e.dataTransfer.files);
    }
  });

  // Content click delegator (folders & files cards/rows)
  document.getElementById('files-view-container')?.addEventListener('click', async (e) => {
    const card = e.target.closest('.file-card');
    const row = e.target.closest('.file-list-row');
    const star = e.target.closest('.file-card-star');

    if (star) {
      e.stopPropagation();
      await handleStarFile(star.dataset.id);
      return;
    }

    if (card) {
      const id = card.dataset.id;
      // Handle multi-select with ctrl/shift key
      if (e.ctrlKey || e.metaKey) {
        if (selectedFiles.has(id)) {
          selectedFiles.delete(id);
          card.classList.remove('selected');
        } else {
          selectedFiles.add(id);
          card.classList.add('selected');
        }
        updateBulkActionBar();
      } else {
        await handleOpenFile(id);
      }
    } else if (row) {
      const id = row.dataset.id;
      const cb = row.querySelector('.file-row-checkbox');
      if (e.target.closest('td')?.querySelector('input') || e.ctrlKey) {
        // Toggle selection
        if (selectedFiles.has(id)) {
          selectedFiles.delete(id);
          row.classList.remove('selected');
          if (cb) cb.checked = false;
        } else {
          selectedFiles.add(id);
          row.classList.add('selected');
          if (cb) cb.checked = true;
        }
        updateBulkActionBar();
      } else {
        await handleOpenFile(id);
      }
    }
  });

  // Folders grid click delegator
  document.getElementById('folders-grid')?.addEventListener('click', async (e) => {
    const card = e.target.closest('.folder-card');
    if (card) {
      currentFolderId = card.dataset.id;
      await refreshContent();
    }
  });

  // Context Menu implementation
  const ctxMenu = document.getElementById('berkas-context-menu');
  document.addEventListener('contextmenu', async (e) => {
    const card = e.target.closest('.file-card') || e.target.closest('.file-list-row') || e.target.closest('.folder-card');
    if (card) {
      e.preventDefault();
      const id = card.dataset.id;
      ctxMenu.dataset.targetId = id;
      ctxMenu.dataset.targetKind = card.classList.contains('folder-card') ? 'folder' : 'file';

      // Custom context menu items for folders vs files
      if (ctxMenu.dataset.targetKind === 'folder') {
        document.getElementById('ctx-preview').style.display = 'none';
        document.getElementById('ctx-star').style.display = 'none';
        document.getElementById('ctx-tag').style.display = 'none';
        document.getElementById('ctx-move').style.display = 'none';
        document.getElementById('ctx-duplicate').style.display = 'none';
        document.getElementById('ctx-download').style.display = 'none';
        document.getElementById('ctx-restore').style.display = 'none';
      } else {
        const file = await getFile(id);
        if (file) {
          if (file.trash) {
            document.getElementById('ctx-preview').style.display = 'none';
            document.getElementById('ctx-star').style.display = 'none';
            document.getElementById('ctx-tag').style.display = 'none';
            document.getElementById('ctx-move').style.display = 'none';
            document.getElementById('ctx-duplicate').style.display = 'none';
            document.getElementById('ctx-download').style.display = 'none';
            document.getElementById('ctx-restore').style.display = 'block';
            document.getElementById('ctx-delete').textContent = '🗑️ Hapus Permanen';
          } else {
            document.getElementById('ctx-preview').style.display = 'block';
            document.getElementById('ctx-star').style.display = 'block';
            document.getElementById('ctx-tag').style.display = 'block';
            document.getElementById('ctx-move').style.display = 'block';
            document.getElementById('ctx-duplicate').style.display = 'block';
            document.getElementById('ctx-download').style.display = 'block';
            document.getElementById('ctx-restore').style.display = 'none';
            document.getElementById('ctx-star').textContent = file.starred ? '☆ Hapus Bintang' : '⭐ Tambah Bintang';
            document.getElementById('ctx-delete').textContent = '🗑️ Hapus';
          }
        }
      }

      ctxMenu.style.top = `${e.pageY}px`;
      ctxMenu.style.left = `${e.pageX}px`;
      ctxMenu.style.display = 'block';
    } else {
      ctxMenu.style.display = 'none';
    }
  });

  document.addEventListener('click', () => {
    ctxMenu.style.display = 'none';
  });

  // Context menu actions click
  document.getElementById('ctx-open')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const id = ctxMenu.dataset.targetId;
    if (ctxMenu.dataset.targetKind === 'folder') {
      currentFolderId = id;
      await refreshContent();
    } else {
      await handleOpenFile(id);
    }
  });

  document.getElementById('ctx-preview')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await handlePreviewFile(ctxMenu.dataset.targetId);
  });

  document.getElementById('ctx-rename')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const id = ctxMenu.dataset.targetId;
    if (ctxMenu.dataset.targetKind === 'folder') {
      const folder = await getFolder(id);
      openFolderCrudModal(folder);
    } else {
      const file = await getFile(id);
      if (file) {
        const newName = prompt("Ubah Nama Berkas:", file.name);
        if (newName && newName.trim()) {
          file.name = newName.trim();
          file.updated_at = new Date().toISOString();
          await putFile(file);
          if (localFolderHandle) {
            // Update local file name
            await writeLocalFile(localFolderHandle, file.name, await getFileFromOpfs(file.opfs_path));
          }
          await refreshContent();
        }
      }
    }
  });

  document.getElementById('ctx-star')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await handleStarFile(ctxMenu.dataset.targetId);
  });

  document.getElementById('ctx-tag')?.addEventListener('click', async (e) => {
    e.preventDefault();
    openTagFileModal(ctxMenu.dataset.targetId);
  });

  document.getElementById('ctx-move')?.addEventListener('click', (e) => {
    e.preventDefault();
    openMoveFileModal([ctxMenu.dataset.targetId]);
  });

  document.getElementById('ctx-duplicate')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const id = ctxMenu.dataset.targetId;
    const file = await getFile(id);
    if (file) {
      const newId = crypto.randomUUID();
      const dupFile = {
        ...file,
        id: newId,
        name: `Copy of ${file.name}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        starred: false
      };
      if (file.opfs_path) {
        const blob = await getFileFromOpfs(file.opfs_path);
        const newPath = `dup-${newId}-${file.opfs_path}`;
        await saveFileToOpfs(newPath, blob);
        dupFile.opfs_path = newPath;
      }
      await putFile(dupFile);
      await refreshContent();
    }
  });

  document.getElementById('ctx-download')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await handleDownloadFile(ctxMenu.dataset.targetId);
  });

  document.getElementById('ctx-restore')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await handleRestoreFile(ctxMenu.dataset.targetId);
  });

  document.getElementById('ctx-delete')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await handleDeleteFile(ctxMenu.dataset.targetId);
  });

  // Bulk Actions
  document.getElementById('bulk-btn-clear')?.addEventListener('click', () => {
    selectedFiles.clear();
    refreshContent();
  });
  document.getElementById('bulk-btn-star')?.addEventListener('click', async () => {
    for (const id of selectedFiles) {
      const file = await getFile(id);
      if (file) {
        file.starred = true;
        await putFile(file);
      }
    }
    selectedFiles.clear();
    await refreshContent();
  });
  document.getElementById('bulk-btn-delete')?.addEventListener('click', async () => {
    if (window.TMPT_UI) {
      const ok = await window.TMPT_UI.confirm(`Hapus ${selectedFiles.size} berkas terpilih?`);
      if (!ok) return;
    }
    for (const id of selectedFiles) {
      await handleDeleteFile(id);
    }
    selectedFiles.clear();
    await refreshContent();
  });
  document.getElementById('bulk-btn-move')?.addEventListener('click', () => {
    openMoveFileModal(Array.from(selectedFiles));
  });

  // Backup & Restore Dialog
  document.getElementById('btn-backup-dialog')?.addEventListener('click', () => {
    document.getElementById('modal-backup').showModal();
  });
  document.getElementById('btn-trigger-backup')?.addEventListener('click', async () => {
    const progBar = document.getElementById('backup-progress-bar');
    const percentEl = document.getElementById('backup-progress-percent');
    const statusEl = document.getElementById('backup-progress-status');
    const cont = document.getElementById('backup-progress-container');

    cont.style.display = 'block';

    try {
      const blob = await generateBackupBundle((progress, status) => {
        progBar.value = progress;
        percentEl.textContent = `${progress}%`;
        statusEl.textContent = status;
      });
      const url = URL.createObjectURL(blob);
      triggerBrowserDownload(url, `TMPT-Ecosystem-Backup-${new Date().toISOString().split('T')[0]}.tmpt`);
    } catch (err) {
      console.error(err);
      if (window.TMPT_UI) window.TMPT_UI.toast("Backup gagal: " + err.message, "error");
    } finally {
      setTimeout(() => cont.style.display = 'none', 3000);
    }
  });
  document.getElementById('btn-trigger-restore')?.addEventListener('click', () => {
    document.getElementById('restore-file-input').click();
  });
  document.getElementById('restore-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const mode = document.querySelector('input[name="restore-mode"]:checked').value;
    
    if (mode === 'overwrite' && window.TMPT_UI) {
      const ok = await window.TMPT_UI.confirm("PERHATIAN: Mode Timpa akan menghapus semua data di browser ini secara permanen sebelum melakukan pemulihan. Apakah Anda yakin?");
      if (!ok) return;
    }

    const progBar = document.getElementById('backup-progress-bar');
    const percentEl = document.getElementById('backup-progress-percent');
    const statusEl = document.getElementById('backup-progress-status');
    const cont = document.getElementById('backup-progress-container');

    cont.style.display = 'block';

    try {
      await restoreBackupBundle(file, mode, (progress, status) => {
        progBar.value = progress;
        percentEl.textContent = `${progress}%`;
        statusEl.textContent = status;
      });
      if (window.TMPT_UI) window.TMPT_UI.toast("Ecosystem TMPT berhasil dipulihkan!", "success");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error(err);
      if (window.TMPT_UI) window.TMPT_UI.toast("Gagal melakukan pemulihan: " + err.message, "error");
    } finally {
      setTimeout(() => cont.style.display = 'none', 3000);
    }
  });

  // FSAA Folder Connection Settings
  document.getElementById('btn-local-folder-dialog')?.addEventListener('click', () => {
    document.getElementById('modal-local-folder').showModal();
  });
  document.getElementById('btn-fsaa-connect')?.addEventListener('click', async () => {
    try {
      const savedHandle = await getSetting('fsaa_handle');
      if (savedHandle) {
        // Request permission on the already saved handle (triggered by user click activation)
        const allowed = await verifyPermission(savedHandle, true, true);
        if (allowed) {
          localFolderHandle = savedHandle;
          updateFsaaStatusUI(true);
          if (window.TMPT_UI) window.TMPT_UI.toast("Akses folder lokal diberikan!", "success");
          await syncOpfsToLocalFolder();
          await syncLocalFolderToOpfs();
          await refreshContent();
          return;
        }
      }

      const handle = await selectLocalFolder();
      const allowed = await verifyPermission(handle, true, true);
      if (allowed) {
        localFolderHandle = handle;
        // Save directory handle references in DB
        await putSetting('fsaa_handle', handle);
        updateFsaaStatusUI(true);
        if (window.TMPT_UI) window.TMPT_UI.toast("Berhasil menghubungkan ke folder lokal!", "success");
        // Sync OPFS files to local disk
        await syncOpfsToLocalFolder();
        await syncLocalFolderToOpfs();
        await refreshContent();
      }
    } catch (err) {
      console.error(err);
      if (window.TMPT_UI) window.TMPT_UI.toast("Gagal memilih folder: " + err.message, "error");
    }
  });
  document.getElementById('btn-fsaa-disconnect')?.addEventListener('click', async () => {
    localFolderHandle = null;
    await putSetting('fsaa_handle', null);
    updateFsaaStatusUI(false);
    if (window.TMPT_UI) window.TMPT_UI.toast("Hubungan folder lokal terputus.", "info");
  });
}

// --- Upload handler ---
async function handleUploadFiles(files) {
  if (window.TMPT_UI) window.TMPT_UI.setLoading('body', true);
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 50 * 1024 * 1024) {
        if (window.TMPT_UI) window.TMPT_UI.toast(`File ${file.name} melebihi batas 50MB!`, "error");
        continue;
      }

      const id = crypto.randomUUID();
      const fileName = file.name;
      const fileExt = fileName.split('.').pop().toLowerCase();
      let fileType = 'other';

      if (['pdf'].includes(fileExt)) fileType = 'pdf';
      else if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(fileExt)) fileType = 'image';
      else if (['xlsx', 'csv', 'hitung'].includes(fileExt)) fileType = 'hitung';
      else if (['pptx', 'slide'].includes(fileExt)) fileType = 'slide';
      else if (['txt', 'md'].includes(fileExt)) fileType = 'catat_notes';

      // Save binary blob to OPFS
      const opfsPath = `${id}-${fileName}`;
      await saveFileToOpfs(opfsPath, file);

      // Register file in registry IndexedDB
      const fileRecord = {
        id: id,
        name: fileName,
        type: fileType,
        app_id: null,
        app_db: null,
        opfs_path: opfsPath,
        folder_id: currentFolderId,
        size_bytes: file.size,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_opened: new Date().toISOString(),
        starred: false,
        tags: [],
        trash: false,
        trash_at: null
      };

      await putFile(fileRecord);

      // Bersihkan dari registry fsaa_deleted_files jika ada
      try {
        const deletedList = JSON.parse(await getSetting('fsaa_deleted_files') || '[]');
        const index = deletedList.indexOf(fileName);
        if (index > -1) {
          deletedList.splice(index, 1);
          await putSetting('fsaa_deleted_files', JSON.stringify(deletedList));
        }
      } catch (e) {
        console.error(e);
      }

      // FSAA Mode: Write to local folder if connected
      if (localFolderHandle) {
        await writeLocalFile(localFolderHandle, fileName, file);
      }
    }
    if (window.TMPT_UI) window.TMPT_UI.toast("Berkas berhasil diunggah!", "success");
    await refreshContent();
    await updateStorageDetails();
  } catch (err) {
    console.error("Upload gagal:", err);
    if (window.TMPT_UI) window.TMPT_UI.toast("Gagal mengunggah beberapa berkas.", "error");
  } finally {
    if (window.TMPT_UI) window.TMPT_UI.setLoading('body', false);
  }
}

// Sync OPFS directory to FSAA local disk
async function syncOpfsToLocalFolder() {
  if (!localFolderHandle) return;
  const files = await getFiles();
  for (const file of files) {
    if (file.opfs_path && !file.trash) {
      try {
        const blob = await getFileFromOpfs(file.opfs_path);
        await writeLocalFile(localFolderHandle, file.name, blob);
      } catch (e) {
        console.error(e);
      }
    }
  }
}

// Sync local folder files to OPFS (Bi-directional sync: Folder -> App)
async function syncLocalFolderToOpfs() {
  if (!localFolderHandle) return;
  
  const hasPermission = await verifyPermission(localFolderHandle, true, false);
  if (!hasPermission) return;

  const filesInDb = await getFiles();
  const dbFileNames = new Set(filesInDb.map(f => f.name));

  let deletedList = [];
  try {
    deletedList = JSON.parse(await getSetting('fsaa_deleted_files') || '[]');
  } catch (e) {
    console.error(e);
  }

  try {
    for await (const entry of localFolderHandle.values()) {
      if (entry.kind === 'file') {
        // Jika file lokal terdaftar sebagai file terhapus, hapus dari disk dan skip impor
        if (deletedList.includes(entry.name)) {
          console.log(`[BERKAS] Mendeteksi berkas lokal terhapus: ${entry.name}, menghapus dari disk...`);
          try {
            await deleteLocalFile(localFolderHandle, entry.name);
          } catch (e) {
            console.error("Gagal menghapus file terdaftar terhapus dari disk:", e);
          }
          continue;
        }

        if (!dbFileNames.has(entry.name)) {
          console.log(`[BERKAS] Mendeteksi berkas lokal baru: ${entry.name}, mengimpor...`);
          const file = await entry.getFile();
          
          const id = crypto.randomUUID();
          const fileName = entry.name;
          const fileExt = fileName.split('.').pop().toLowerCase();
          let fileType = 'other';

          if (['pdf'].includes(fileExt)) fileType = 'pdf';
          else if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(fileExt)) fileType = 'image';
          else if (['xlsx', 'csv', 'hitung'].includes(fileExt)) fileType = 'hitung';
          else if (['pptx', 'slide'].includes(fileExt)) fileType = 'slide';
          else if (['txt', 'md'].includes(fileExt)) fileType = 'catat_notes';

          // Save binary blob to OPFS
          const opfsPath = `${id}-${fileName}`;
          await saveFileToOpfs(opfsPath, file);

          // Register in registry IndexedDB
          const fileRecord = {
            id: id,
            name: fileName,
            type: fileType,
            app_id: null,
            app_db: null,
            opfs_path: opfsPath,
            folder_id: currentFolderId,
            size_bytes: file.size,
            created_at: new Date(file.lastModified || Date.now()).toISOString(),
            updated_at: new Date(file.lastModified || Date.now()).toISOString(),
            last_opened: new Date().toISOString(),
            starred: false,
            tags: [],
            trash: false,
            trash_at: null
          };

          await putFile(fileRecord);
        }
      }
    }
  } catch (err) {
    console.error("Gagal sinkronisasi dari folder lokal ke aplikasi:", err);
  }
}

// --- Folder & Tag Modal CRUD helpers ---
function openFolderCrudModal(folder = null) {
  const modal = document.getElementById('modal-folder-crud');
  const title = document.getElementById('folder-crud-title');
  const nameInput = document.getElementById('folder-name-input');
  const idInput = document.getElementById('folder-crud-id');
  const colorInput = document.getElementById('folder-color-input');

  document.querySelectorAll('#folder-color-options .color-dot').forEach(d => d.classList.remove('selected'));

  if (folder) {
    title.textContent = "Ubah Nama Folder";
    nameInput.value = folder.name;
    idInput.value = folder.id;
    colorInput.value = folder.color || '#3b82f6';
    const dot = document.querySelector(`#folder-color-options .color-dot[data-color="${folder.color}"]`);
    if (dot) dot.classList.add('selected');
  } else {
    title.textContent = "Buat Folder Baru";
    nameInput.value = '';
    idInput.value = '';
    colorInput.value = '#3b82f6';
    document.querySelector(`#folder-color-options .color-dot[data-color="#3b82f6"]`).classList.add('selected');
  }

  // Color picker selection listener
  const form = document.getElementById('form-folder-crud');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const id = idInput.value || crypto.randomUUID();
    const name = nameInput.value.trim();
    const color = colorInput.value;

    if (!name) return;

    const newFolder = {
      id: id,
      name: name,
      parent_id: folder ? folder.parent_id : currentFolderId,
      created_at: folder ? folder.created_at : new Date().toISOString(),
      color: color
    };

    await putFolder(newFolder);
    modal.close();
    await renderSidebar();
    await refreshContent();
  };

  document.querySelectorAll('#folder-color-options .color-dot').forEach(dot => {
    dot.onclick = () => {
      document.querySelectorAll('#folder-color-options .color-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
      colorInput.value = dot.dataset.color;
    };
  });

  modal.showModal();
}

async function openMoveFileModal(fileIds) {
  const modal = document.getElementById('modal-move-file');
  const treeEl = document.getElementById('move-folders-tree');
  const confirmBtn = document.getElementById('btn-confirm-move');

  const folders = await getFolders();
  
  // Render folder tree options
  let html = `<div class="folder-option-item selected" data-id="root" style="padding: 0.35rem; cursor:pointer;">📁 Utama (Root)</div>`;
  folders.forEach(f => {
    html += `<div class="folder-option-item" data-id="${f.id}" style="padding: 0.35rem 0.35rem 0.35rem 1rem; cursor:pointer;">📁 ${escapeHtml(f.name)}</div>`;
  });
  treeEl.innerHTML = html;

  let selectedFolderId = 'root';
  treeEl.onclick = (e) => {
    const item = e.target.closest('.folder-option-item');
    if (item) {
      treeEl.querySelectorAll('.folder-option-item').forEach(i => {
        i.style.backgroundColor = 'transparent';
        i.style.fontWeight = 'normal';
      });
      item.style.backgroundColor = 'var(--pico-muted-border-color)';
      item.style.fontWeight = 'bold';
      selectedFolderId = item.dataset.id;
    }
  };

  confirmBtn.onclick = async () => {
    for (const id of fileIds) {
      const file = await getFile(id);
      if (file) {
        file.folder_id = selectedFolderId;
        file.updated_at = new Date().toISOString();
        await putFile(file);
      }
    }
    modal.close();
    await refreshContent();
    if (window.TMPT_UI) window.TMPT_UI.toast("Berkas berhasil dipindahkan.", "success");
  };

  modal.showModal();
}

async function openTagFileModal(fileId) {
  const modal = document.getElementById('modal-tag-file');
  const container = document.getElementById('file-tags-select-container');
  const file = await getFile(fileId);
  if (!file) return;

  const renderTagsOptions = async () => {
    const allTags = await getTags();
    container.innerHTML = '';
    if (allTags.length === 0) {
      container.innerHTML = '<span style="font-size: 0.8rem; color: var(--pico-secondary-color);">Belum ada tag</span>';
      return;
    }
    allTags.forEach(tag => {
      const isChecked = file.tags && file.tags.includes(tag.name);
      const label = document.createElement('label');
      label.style.cssText = "display: flex; align-items: center; gap: 0.25rem; font-size: 0.85rem; font-weight: 500; cursor: pointer; margin: 0;";
      label.innerHTML = `<input type="checkbox" style="margin: 0;" data-name="${tag.name}" ${isChecked ? 'checked' : ''}> #${tag.name}`;
      container.appendChild(label);
    });
  };

  // Add new tag handler
  const nameInput = document.getElementById('tag-name-input');
  document.getElementById('btn-add-new-tag').onclick = async () => {
    const name = nameInput.value.trim().toLowerCase();
    if (!name) return;
    
    // Check duplication
    const allTags = await getTags();
    if (!allTags.some(t => t.name === name)) {
      const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      await putTag({ id: crypto.randomUUID(), name, color: randomColor });
    }
    nameInput.value = '';
    await renderTagsOptions();
    await renderSidebar();
  };

  container.onclick = async (e) => {
    const cb = e.target.closest('input[type="checkbox"]');
    if (cb) {
      const tagName = cb.dataset.name;
      if (!file.tags) file.tags = [];
      if (cb.checked) {
        if (!file.tags.includes(tagName)) file.tags.push(tagName);
      } else {
        file.tags = file.tags.filter(t => t !== tagName);
      }
      file.updated_at = new Date().toISOString();
      await putFile(file);
      await renderSidebar();
      await refreshContent();
    }
  };

  await renderTagsOptions();
  modal.showModal();
}

// --- FSAA Loader & helper ---
async function loadFsaaSettings() {
  const handle = await getSetting('fsaa_handle');
  if (handle) {
    const hasPermission = await verifyPermission(handle, true, false);
    if (hasPermission) {
      localFolderHandle = handle;
      updateFsaaStatusUI(true);
      return;
    } else {
      localFolderHandle = handle; // Keep handle reference so we know which directory is connected
      updateFsaaStatusUI(false, true);
      return;
    }
  }
  updateFsaaStatusUI(false);
}

function updateFsaaStatusUI(connected, needsPermission = false) {
  const statusText = document.getElementById('fsaa-status-text');
  const connectBtn = document.getElementById('btn-fsaa-connect');
  const disconnectBtn = document.getElementById('btn-fsaa-disconnect');

  if (connected && localFolderHandle) {
    statusText.innerHTML = `🟢 Terhubung: <strong>${escapeHtml(localFolderHandle.name)}</strong>`;
    connectBtn.style.display = 'none';
    disconnectBtn.style.display = 'block';
  } else if (needsPermission && localFolderHandle) {
    statusText.innerHTML = `⚠️ Butuh Izin Akses: <strong>${escapeHtml(localFolderHandle.name)}</strong>`;
    connectBtn.style.display = 'block';
    connectBtn.textContent = '🔑 Berikan Akses';
    disconnectBtn.style.display = 'block';
  } else {
    statusText.innerHTML = `🔴 Tidak Terhubung`;
    connectBtn.style.display = 'block';
    connectBtn.textContent = '📁 Hubungkan Folder';
    disconnectBtn.style.display = 'none';
  }
}

// --- General Utility Helpers ---
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  if (!bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

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

function getFileTypeEmoji(type) {
  const emojiMap = {
    document: '📄',
    slide: '🎞',
    form: '📋',
    pdf: '📑',
    image: '🖼',
    catat_notes: '📓',
    catat_lists: '☑️',
    papan: '🎨',
    hitung: '📊',
    markdown: '📝',
    other: '📦'
  };
  return emojiMap[type] || '📦';
}

function getFileTypeLabel(type) {
  const labelMap = {
    document: 'Dokumen',
    slide: 'Slide',
    form: 'Forms',
    pdf: 'PDF',
    image: 'Gambar',
    catat_notes: 'Catatan',
    catat_lists: 'Tugas',
    papan: 'Papan Coretan',
    hitung: 'Spreadsheet',
    markdown: 'Markdown',
    other: 'Lainnya'
  };
  return labelMap[type] || 'Lainnya';
}

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// --- Hamburger Sidebar Toggle ---
window.setupSidebarToggle = function() {
  const nav = document.querySelector('header nav');
  if (!nav) return;

  const firstUl = nav.querySelector('ul');
  if (firstUl && !nav.querySelector('.sidebar-toggle-btn')) {
    const toggleLi = document.createElement('li');
    toggleLi.style.display = 'flex';
    toggleLi.style.alignItems = 'center';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'sidebar-toggle-btn';
    toggleBtn.innerHTML = '☰';
    toggleBtn.setAttribute('aria-label', 'Toggle Sidebar');
    toggleBtn.onclick = () => window.toggleSidebar();
    toggleBtn.style.cssText = "background: transparent; border: none; color: var(--pico-heading-color); font-size: 1.5rem; padding: 0 0.5rem; cursor: pointer; margin: 0; width: auto; line-height: 1; display: flex; align-items: center;";

    toggleLi.appendChild(toggleBtn);
    firstUl.prepend(toggleLi);
  }
};

window.toggleSidebar = function() {
  const sidebar = document.querySelector('.berkas-sidebar');
  if (!sidebar) return;

  if (window.innerWidth > 768) {
    sidebar.classList.toggle('collapsed');
  } else {
    sidebar.classList.toggle('show');
  }
};

// Listen to HTMX after swap to setup search bar
document.body.addEventListener('htmx:afterSwap', (e) => {
  window.setupSidebarToggle();
});

// Also call it on load
setTimeout(window.setupSidebarToggle, 100);

