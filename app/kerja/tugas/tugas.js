// app/kerja/tugas/tugas.js
import { openTmptDB, dbGet, dbGetAll, dbPut, dbDelete, DB_VERSIONS } from '/shared/db.js';
import { listenTMPT, broadcastTMPT, TMPT_EVENTS } from '/shared/broadcast.js';

const generateId = () => crypto.randomUUID();

// Local wrappers for UI functions which are exposed on window.TMPT_UI
const toast = (msg, type) => window.TMPT_UI ? window.TMPT_UI.toast(msg, type) : console.log(msg);
const confirm = (msg, opts) => {
  if (window.TMPT_UI) {
    // If it's a simple confirm without required text confirmation, just pass the message
    return window.TMPT_UI.confirm(msg);
  }
  return Promise.resolve(window.confirm(msg));
};
const prompt = (msg, placeholder) => window.TMPT_UI ? window.TMPT_UI.prompt(msg, placeholder) : Promise.resolve(window.prompt(msg, placeholder));

// ── CONSTANTS ────────────────────────────────────────────────────────────────
const DB_NAME = 'tmpt_tugas';
const DB_VERSION = 2;

// ── STATE ────────────────────────────────────────────────────────────────────
let db = null;
let currentFilter = 'inbox'; // 'inbox', 'today', 'starred', 'recurring', 'done', or custom list UUID
let currentView = 'list'; // 'list' or 'kanban'
let allTasks = [];
let allLists = [];
let allTags = [];
let activeTaskId = null;
let autosaveTimer = null;

// ── INITIALIZATION ───────────────────────────────────────────────────────────
async function init() {
  await initDB();
  await checkDefaultLists();
  await loadData();
  setupEventListeners();
  setupBroadcastListener();
  setupKeyboardShortcuts();
  checkAndRequestNotifications();
  scheduleReminders();
  renderSidebar();
  renderActiveView();

  // Tombol opsi daftar selalu tampil
  const listOptionsBtn = document.getElementById('btn-list-options');
  if (listOptionsBtn) {
    listOptionsBtn.style.display = 'inline-block';
  }
}

async function initDB() {
  db = await openTmptDB(DB_NAME, DB_VERSION, (database) => {
    if (!database.objectStoreNames.contains('tasks')) {
      const taskStore = database.createObjectStore('tasks', { keyPath: 'id' });
      taskStore.createIndex('by_list', 'list_id', { unique: false });
      taskStore.createIndex('by_status', 'status', { unique: false });
      taskStore.createIndex('by_due', 'due_date', { unique: false });
      taskStore.createIndex('by_priority', 'priority', { unique: false });
      taskStore.createIndex('by_parent', 'parent_id', { unique: false });
      taskStore.createIndex('by_updated', 'updated_at', { unique: false });
      taskStore.createIndex('by_starred', 'starred', { unique: false });
    }
    if (!database.objectStoreNames.contains('lists')) {
      const listStore = database.createObjectStore('lists', { keyPath: 'id' });
      listStore.createIndex('by_order', 'order', { unique: false });
    }
    if (!database.objectStoreNames.contains('boards')) {
      database.createObjectStore('boards', { keyPath: 'id' });
    }
    if (!database.objectStoreNames.contains('tags')) {
      database.createObjectStore('tags', { keyPath: 'name' });
    }
  });
}

async function checkDefaultLists() {
  const lists = await dbGetAll(db, 'lists');
  if (lists.length === 0) {
    const defaultLists = [
      { id: 'inbox', name: 'Inbox', color: '#2563eb', icon: '📥', order: 0, is_inbox: true, is_default: false, created_at: new Date().toISOString() },
      { id: 'mytasks', name: 'Tugas Saya', color: '#16a34a', icon: '📋', order: 1, is_inbox: false, is_default: true, created_at: new Date().toISOString() }
    ];
    for (const list of defaultLists) {
      await dbPut(db, 'lists', list);
    }
  }
}

async function loadData() {
  allTasks = await dbGetAll(db, 'tasks');
  allLists = await dbGetAll(db, 'lists');
  allLists.sort((a, b) => a.order - b.order);
  allTags = await dbGetAll(db, 'tags');
}

// ── SIDEBAR RENDERING ────────────────────────────────────────────────────────
function renderSidebar() {
  // Update counts
  const inboxCount = allTasks.filter(t => t.list_id === 'inbox' && t.status !== 'done').length;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCount = allTasks.filter(t => t.due_date === todayStr && t.status !== 'done').length;
  const starredCount = allTasks.filter(t => t.starred && t.status !== 'done').length;
  const recurringCount = allTasks.filter(t => t.repeat && t.repeat !== 'none' && t.status !== 'done').length;

  document.getElementById('badge-inbox').textContent = inboxCount;
  document.getElementById('badge-today').textContent = todayCount;
  document.getElementById('badge-starred').textContent = starredCount;
  document.getElementById('badge-recurring').textContent = recurringCount;

  // Render Custom Lists
  const listContainer = document.getElementById('custom-lists-container');
  listContainer.innerHTML = '';
  
  allLists.forEach(list => {
    // skip virtual lists in custom lists
    if (list.id === 'inbox') return;

    const count = allTasks.filter(t => t.list_id === list.id && t.status !== 'done').length;
    const li = document.createElement('li');
    li.innerHTML = `
      <a href="#" class="nav-item ${currentFilter === list.id ? 'active' : ''}" data-filter="${list.id}">
        <span class="nav-icon" style="color: ${list.color || 'inherit'}">${list.icon === '📋' ? '☑️' : (list.icon || '☑️')}</span>
        <span class="nav-label">${escapeHtml(list.name)}</span>
        <span class="badge">${count}</span>
        <span class="sidebar-opt-btn" data-filter="${list.id}">⋮</span>
      </a>
    `;

    const a = li.querySelector('a');
    a.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-delete-list-icon')) return;
      e.preventDefault();
      setFilter(list.id);
    });

    a.addEventListener('mouseenter', () => {
      const btn = li.querySelector('.btn-delete-list-icon');
      if (btn && !list.is_default) {
        btn.style.display = 'inline';
      }
    });
    a.addEventListener('mouseleave', () => {
      const btn = li.querySelector('.btn-delete-list-icon');
      if (btn && !list.is_default) {
        btn.style.display = 'none';
      }
    });

    const deleteBtn = li.querySelector('.btn-delete-list-icon');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        const ok = await confirm(`Hapus daftar "${list.name}" beserta seluruh tugas di dalamnya?`, { danger: true });
        if (ok) {
          await deleteList(list.id);
        }
      });
    }

    listContainer.appendChild(li);
  });

  // Render Tags Cloud
  const tagsContainer = document.getElementById('sidebar-tags-container');
  tagsContainer.innerHTML = '';
  
  // Aggregate tags from active tasks
  const tagCounts = {};
  allTasks.forEach(t => {
    if (t.tags && t.status !== 'done') {
      t.tags.forEach(tag => {
        const cleanTag = tag.trim().toLowerCase();
        if (cleanTag) {
          tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
        }
      });
    }
  });

  Object.entries(tagCounts).forEach(([tag, count]) => {
    const span = document.createElement('span');
    span.className = `tag-badge ${currentFilter === `tag:${tag}` ? 'active' : ''}`;
    span.textContent = `#${tag} (${count})`;
    span.addEventListener('click', () => {
      if (currentFilter === `tag:${tag}`) {
        setFilter('inbox');
      } else {
        setFilter(`tag:${tag}`);
      }
    });
    tagsContainer.appendChild(span);
  });
}

async function deleteList(listId) {
  // delete tasks in list
  const tasksInList = allTasks.filter(t => t.list_id === listId);
  for (const t of tasksInList) {
    await dbDelete(db, 'tasks', t.id);
  }
  await dbDelete(db, 'lists', listId);
  toast('Daftar telah dihapus.', 'success');
  if (currentFilter === listId) {
    currentFilter = 'inbox';
  }
  await loadData();
  renderSidebar();
  renderActiveView();
}

function setFilter(filter) {
  currentFilter = filter;
  
  // Update UI active state
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-filter') === filter) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update Title
  const titleEl = document.getElementById('current-view-title');
  if (filter === 'inbox') titleEl.textContent = 'Inbox';
  else if (filter === 'today') titleEl.textContent = 'Hari Ini';
  else if (filter === 'starred') titleEl.textContent = 'Berbintang';
  else if (filter === 'recurring') titleEl.textContent = 'Berulang';
  else if (filter === 'done') titleEl.textContent = 'Selesai';
  else if (filter.startsWith('tag:')) titleEl.textContent = `Label: ${filter.replace('tag:', '')}`;
  else {
    const list = allLists.find(l => l.id === filter);
    titleEl.textContent = list ? list.name : 'Daftar';
  }

  renderSidebar();
  renderActiveView();

  // Tombol opsi daftar selalu aktif
  const listOptionsBtn = document.getElementById('btn-list-options');
  if (listOptionsBtn) {
    listOptionsBtn.style.display = 'inline-block';
  }
}

// ── TASKS RENDERING ──────────────────────────────────────────────────────────
function getFilteredTasks(forceIncludeDone = false) {
  let list = [];
  const todayStr = new Date().toISOString().split('T')[0];

  if (currentFilter === 'inbox') {
    list = allTasks.filter(t => t.list_id === 'inbox' && (forceIncludeDone || t.status !== 'done'));
  } else if (currentFilter === 'today') {
    list = allTasks.filter(t => t.due_date === todayStr && (forceIncludeDone || t.status !== 'done'));
  } else if (currentFilter === 'starred') {
    list = allTasks.filter(t => t.starred && (forceIncludeDone || t.status !== 'done'));
  } else if (currentFilter === 'recurring') {
    list = allTasks.filter(t => t.repeat && t.repeat !== 'none' && (forceIncludeDone || t.status !== 'done'));
  } else if (currentFilter === 'done') {
    list = allTasks.filter(t => t.status === 'done');
  } else if (currentFilter.startsWith('tag:')) {
    const tag = currentFilter.replace('tag:', '').toLowerCase();
    list = allTasks.filter(t => (forceIncludeDone || t.status !== 'done') && t.tags && t.tags.some(tg => tg.trim().toLowerCase() === tag));
  } else {
    // custom list id
    list = allTasks.filter(t => t.list_id === currentFilter && (forceIncludeDone || t.status !== 'done'));
  }

  // Handle Search Input
  const query = document.getElementById('search-input').value.toLowerCase().trim();
  if (query) {
    list = list.filter(t => 
      t.title.toLowerCase().includes(query) || 
      (t.description && t.description.toLowerCase().includes(query))
    );
  }

  // Handle sorting
  const sortBy = document.getElementById('sort-select').value;
  if (sortBy === 'due_date') {
    list.sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
  } else if (sortBy === 'priority') {
    const priorityMap = { urgent: 4, high: 3, medium: 2, low: 1, none: 0 };
    list.sort((a, b) => (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0));
  } else if (sortBy === 'created_at') {
    list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } else if (sortBy === 'alphabetical') {
    list.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    // manual ordering index
    list.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  return list;
}

function renderActiveView() {
  if (currentView === 'list') {
    document.getElementById('list-view-container').classList.remove('hidden');
    document.getElementById('kanban-view-container').classList.add('hidden');
    renderListView();
  } else {
    document.getElementById('list-view-container').classList.add('hidden');
    document.getElementById('kanban-view-container').classList.remove('hidden');
    renderKanbanView();
  }
}

function renderListView() {
  const filtered = getFilteredTasks();
  
  // Split into active and completed if we are in generic list filter
  const activeTasks = filtered.filter(t => t.status !== 'done');
  const completedTasks = currentFilter === 'done' ? filtered : allTasks.filter(t => t.status === 'done' && (currentFilter === 'inbox' || currentFilter === t.list_id));

  // Active Tasks Container
  const activeListEl = document.getElementById('active-tasks-list');
  activeListEl.innerHTML = '';
  
  if (activeTasks.length === 0) {
    activeListEl.innerHTML = `
      <div class="tmpt-empty-state" style="padding: 2rem 0; text-align: center;">
        <span style="font-size: 2rem;">📝</span>
        <h4 style="margin: 0.5rem 0;">Tidak ada tugas aktif</h4>
        <p class="secondary" style="font-size: 0.85rem; margin: 0;">Nikmati waktu senggang Anda, atau tambahkan tugas baru.</p>
      </div>
    `;
  } else {
    activeTasks.forEach(task => {
      activeListEl.appendChild(createTaskItemElement(task));
    });
  }

  // Completed Tasks Container
  const completedCountEl = document.getElementById('completed-count');
  completedCountEl.textContent = completedTasks.length;
  const completedListEl = document.getElementById('completed-tasks-list');
  completedListEl.innerHTML = '';
  
  completedTasks.forEach(task => {
    completedListEl.appendChild(createTaskItemElement(task));
  });

  initSortableList();
}

function createTaskItemElement(task) {
  const item = document.createElement('div');
  item.className = 'task-item-container';
  item.style.display = 'flex';
  item.style.flexDirection = 'column';
  item.style.gap = '0.25rem';
  item.style.border = '1px solid var(--pico-muted-border-color)';
  item.style.borderRadius = '12px';
  item.style.padding = '0.75rem 1rem';
  item.style.backgroundColor = 'var(--pico-card-background-color)';
  item.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
  item.style.cursor = 'pointer';
  item.setAttribute('data-id', task.id);

  if (task.status === 'done') {
    item.style.opacity = '0.6';
  }

  const priorityLabels = { urgent: 'Urgent', high: 'Tinggi', medium: 'Sedang', low: 'Rendah', none: '' };
  const priorityClass = task.priority ? `priority-${task.priority}` : '';
  const priorityBadge = task.priority && task.priority !== 'none' ? `<span class="task-priority-badge ${priorityClass}">${priorityLabels[task.priority]}</span>` : '';

  let dueHtml = '';
  if (task.due_date) {
    const todayStr = new Date().toISOString().split('T')[0];
    const isOverdue = task.due_date < todayStr && task.status !== 'done';
    const cleanDate = formatDate(task.due_date);
    dueHtml = `<span class="task-due-badge ${isOverdue ? 'overdue' : ''}">📅 ${cleanDate} ${task.due_time || ''}</span>`;
  }

  let srcBadge = '';
  if (task.source) {
    const icons = { tulis: '📄 Tulis', catatan: '📓 Catat', forms: '📋 Form', papan: '🎨 Papan', kalender: '📅 Kalender' };
    srcBadge = `<span class="badge" style="font-size:0.65rem; padding: 0.1rem 0.35rem;">${icons[task.source.app] || task.source.app}</span>`;
  }

  const mainRow = document.createElement('div');
  mainRow.className = 'task-item-main-row';
  mainRow.style.display = 'flex';
  mainRow.style.alignItems = 'center';
  mainRow.style.gap = '0.75rem';
  mainRow.style.width = '100%';

  mainRow.innerHTML = `
    <span class="drag-handle" style="cursor: grab; color: var(--pico-muted-color); font-size: 1.1rem; user-select: none;">⋮⋮</span>
    <input type="checkbox" class="task-checkbox" ${task.status === 'done' ? 'checked' : ''} style="width: 20px; height: 20px; margin: 0 !important; cursor: pointer;">
    <div class="task-content-wrapper" style="flex-grow: 1; display: flex; flex-direction: column; gap: 0.15rem;">
      <div class="task-title-row" style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
        <span class="task-title-text" style="font-weight: 600; font-size: 0.95rem; ${task.status === 'done' ? 'text-decoration: line-through; color: var(--pico-muted-color);' : 'color: var(--pico-color);'}">${escapeHtml(task.title)}</span>
        ${srcBadge}
      </div>
      <div class="task-meta-row" style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; font-size: 0.75rem; color: var(--pico-muted-color);">
        ${priorityBadge}
        ${dueHtml}
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 0.25rem;">
      <button class="star-btn ${task.starred ? 'starred' : ''}" aria-label="Bintang" style="background: transparent; border: none; padding: 0.25rem; margin: 0; font-size: 1.25rem; cursor: pointer; line-height: 1; width: auto; color: ${task.starred ? '#f59e0b' : 'var(--pico-muted-color)'};">${task.starred ? '★' : '☆'}</button>
      <button class="delete-inline-btn" aria-label="Hapus" style="background: transparent; border: none; padding: 0.25rem; margin: 0; font-size: 1.1rem; cursor: pointer; line-height: 1; width: auto; color: var(--pico-muted-color); opacity: 0.6; transition: opacity 0.2s;">🗑️</button>
    </div>
  `;

  item.appendChild(mainRow);

  // Nested subtasks list
  if (task.subtasks && task.subtasks.length > 0) {
    const subList = document.createElement('div');
    subList.style.display = 'flex';
    subList.style.flexDirection = 'column';
    subList.style.gap = '0.35rem';
    subList.style.paddingLeft = '2.8rem';
    subList.style.marginTop = '0.25rem';
    subList.style.borderTop = '1px solid rgba(0,0,0,0.02)';
    subList.style.paddingTop = '0.25rem';

    task.subtasks.forEach((sub) => {
      const subDiv = document.createElement('div');
      subDiv.style.display = 'flex';
      subDiv.style.alignItems = 'center';
      subDiv.style.gap = '0.5rem';
      subDiv.innerHTML = `
        <input type="checkbox" ${sub.completed ? 'checked' : ''} style="width: 15px; height: 15px; margin: 0 !important; cursor: pointer;">
        <span style="font-size: 0.85rem; ${sub.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${escapeHtml(sub.title)}</span>
      `;

      subDiv.querySelector('input').addEventListener('click', async (e) => {
        e.stopPropagation();
        sub.completed = e.target.checked;
        await dbPut(db, 'tasks', task);
        await loadData();
        renderListView();
      });

      subList.appendChild(subDiv);
    });
    item.appendChild(subList);
  }

  // Hover effect and click animation
  item.addEventListener('mouseenter', () => {
    item.style.transform = 'translateY(-2px)';
    item.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
    item.style.borderColor = '#0F6E56';
  });
  item.addEventListener('mouseleave', () => {
    item.style.transform = 'none';
    item.style.boxShadow = 'none';
    item.style.borderColor = 'var(--pico-muted-border-color)';
  });

  mainRow.querySelector('.task-checkbox').addEventListener('click', async (e) => {
    e.stopPropagation();
    task.status = e.target.checked ? 'done' : 'todo';
    task.completed_at = task.status === 'done' ? new Date().toISOString() : null;
    
    if (task.status === 'done' && task.repeat && task.repeat !== 'none') {
      await handleRecurringCreation(task);
    }
    
    await dbPut(db, 'tasks', task);
    broadcastTMPT(TMPT_EVENTS.TASK_DONE, { task_id: task.id, title: task.title });
    
    await loadData();
    renderSidebar();
    renderActiveView();
    toast(task.status === 'done' ? 'Tugas diselesaikan!' : 'Tugas dikembalikan ke antrean.', 'success');
  });

  mainRow.querySelector('.star-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    task.starred = !task.starred;
    await dbPut(db, 'tasks', task);
    await loadData();
    renderSidebar();
    renderActiveView();
  });

  mainRow.querySelector('.delete-inline-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    await dbDelete(db, 'tasks', task.id);
    toast('Tugas dihapus.', 'success');
    await loadData();
    renderSidebar();
    renderActiveView();
  });

  item.addEventListener('click', (e) => {
    if (e.target.closest('.task-checkbox') || e.target.closest('.star-btn') || e.target.closest('.delete-inline-btn') || e.target.closest('.drag-handle') || e.target.closest('input[type="checkbox"]')) return;
    openTaskDetail(task.id);
  });

  return item;
}

// Recurring Calculation helper
async function handleRecurringCreation(task) {
  const currentDue = task.due_date || new Date().toISOString().split('T')[0];
  const dateObj = new Date(currentDue);
  
  if (task.repeat === 'daily') {
    dateObj.setDate(dateObj.getDate() + 1);
  } else if (task.repeat === 'weekly') {
    dateObj.setDate(dateObj.getDate() + 7);
  } else if (task.repeat === 'monthly') {
    dateObj.setMonth(dateObj.getMonth() + 1);
  } else if (task.repeat === 'yearly') {
    dateObj.setFullYear(dateObj.getFullYear() + 1);
  }

  const nextDue = dateObj.toISOString().split('T')[0];
  
  // Clone task for next recurrence
  const cloned = {
    ...task,
    id: generateId(),
    status: 'todo',
    due_date: nextDue,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  await dbPut(db, 'tasks', cloned);
}

// ── DRAG AND DROP LISTS / KANBAN ─────────────────────────────────────────────
let listSortableInstance = null;
function initSortableList() {
  if (listSortableInstance) {
    listSortableInstance.destroy();
  }
  const el = document.getElementById('active-tasks-list');
  if (!el || typeof Sortable === 'undefined') return;

  listSortableInstance = new Sortable(el, {
    handle: '.drag-handle',
    animation: 150,
    onEnd: async () => {
      const items = el.querySelectorAll('.task-item');
      items.forEach((item, index) => {
        const id = item.getAttribute('data-id');
        const task = allTasks.find(t => t.id === id);
        if (task) {
          task.order = index;
          dbPut(db, 'tasks', task);
        }
      });
      await loadData();
      toast('Urutan tugas disimpan.', 'success');
    }
  });
}

function renderKanbanView() {
  const filtered = getFilteredTasks(true);
  const todoCards = document.getElementById('kanban-cards-todo');
  const progressCards = document.getElementById('kanban-cards-inprogress');
  const doneCards = document.getElementById('kanban-cards-done');

  todoCards.innerHTML = '';
  progressCards.innerHTML = '';
  doneCards.innerHTML = '';

  const todoTasks = filtered.filter(t => t.status === 'todo');
  const progressTasks = filtered.filter(t => t.status === 'in_progress');
  const doneTasks = filtered.filter(t => t.status === 'done');

  document.getElementById('badge-kanban-todo').textContent = todoTasks.length;
  document.getElementById('badge-kanban-inprogress').textContent = progressTasks.length;
  document.getElementById('badge-kanban-done').textContent = doneTasks.length;

  todoTasks.forEach(t => todoCards.appendChild(createKanbanCard(t)));
  progressTasks.forEach(t => progressCards.appendChild(createKanbanCard(t)));
  doneTasks.forEach(t => doneCards.appendChild(createKanbanCard(t)));

  initKanbanSortable();
}

function createKanbanCard(task) {
  const card = document.createElement('div');
  card.className = 'kanban-card';
  card.setAttribute('data-id', task.id);

  const priorityLabels = { urgent: '🔴 Urgent', high: '🟠 Tinggi', medium: '🟡 Sedang', low: '🟢 Rendah', none: '' };
  const priorityHtml = task.priority && task.priority !== 'none' ? `<span style="font-size:0.7rem; font-weight:700;">${priorityLabels[task.priority]}</span>` : '';

  let dueHtml = '';
  if (task.due_date) {
    dueHtml = `<span style="font-size:0.7rem;">📅 ${formatDate(task.due_date)}</span>`;
  }

  card.innerHTML = `
    <div class="kanban-card-title">${escapeHtml(task.title)}</div>
    <div class="kanban-card-meta">
      ${priorityHtml}
      ${dueHtml}
    </div>
  `;

  card.addEventListener('click', () => {
    openTaskDetail(task.id);
  });

  return card;
}

let kanbanTodoSortable = null;
let kanbanProgressSortable = null;
let kanbanDoneSortable = null;

function initKanbanSortable() {
  if (typeof Sortable === 'undefined') return;

  const config = {
    group: 'kanban-board',
    animation: 150,
    onEnd: async (evt) => {
      const id = evt.item.getAttribute('data-id');
      const targetCol = evt.to.id; // kanban-cards-todo, kanban-cards-inprogress, kanban-cards-done
      let newStatus = 'todo';
      if (targetCol === 'kanban-cards-inprogress') newStatus = 'in_progress';
      else if (targetCol === 'kanban-cards-done') newStatus = 'done';

      const task = allTasks.find(t => t.id === id);
      if (task && task.status !== newStatus) {
        task.status = newStatus;
        task.completed_at = newStatus === 'done' ? new Date().toISOString() : null;
        task.updated_at = new Date().toISOString();
        
        if (newStatus === 'done' && task.repeat && task.repeat !== 'none') {
          await handleRecurringCreation(task);
        }

        await dbPut(db, 'tasks', task);
        await loadData();
        renderSidebar();
        renderActiveView();
        toast(`Tugas dipindahkan ke status: ${newStatus}`, 'success');
      }
    }
  };

  if (kanbanTodoSortable) kanbanTodoSortable.destroy();
  if (kanbanProgressSortable) kanbanProgressSortable.destroy();
  if (kanbanDoneSortable) kanbanDoneSortable.destroy();

  kanbanTodoSortable = new Sortable(document.getElementById('kanban-cards-todo'), config);
  kanbanProgressSortable = new Sortable(document.getElementById('kanban-cards-inprogress'), config);
  kanbanDoneSortable = new Sortable(document.getElementById('kanban-cards-done'), config);
}

// ── TASK EDIT / DETAIL PANEL ───────────────────────────────────────────────
async function openTaskDetail(id) {
  activeTaskId = id;
  const task = allTasks.find(t => t.id === id);
  if (!task) return;

  const modal = document.getElementById('task-editor-modal');
  
  // Title & Completed & Star
  document.getElementById('modal-task-completed').checked = task.status === 'done';
  document.getElementById('modal-task-title').value = task.title;
  
  const starBtn = document.getElementById('modal-task-star');
  starBtn.textContent = task.starred ? '★' : '☆';
  starBtn.className = `star-btn ${task.starred ? 'starred' : ''}`;

  // Attributes
  document.getElementById('modal-task-description').value = task.description || '';
  document.getElementById('modal-task-priority').value = task.priority || 'none';
  document.getElementById('modal-task-due-date').value = task.due_date || '';
  document.getElementById('modal-task-due-time').value = task.due_time || '';
  document.getElementById('modal-task-repeat').value = task.repeat || 'none';
  document.getElementById('modal-task-tags').value = task.tags ? task.tags.join(', ') : '';

  // Dropdown list populator
  const listSelect = document.getElementById('modal-task-list');
  listSelect.innerHTML = '';
  allLists.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = `${l.icon || '📋'} ${l.name}`;
    listSelect.appendChild(opt);
  });
  listSelect.value = task.list_id || 'mytasks';

  // Subtasks
  renderSubtasks(task);

  // Linked files dropdown & list
  await loadFilesForLinking();
  renderLinkedFiles(task);

  // Source info
  const sourceInfoEl = document.getElementById('modal-source-info');
  if (task.source) {
    sourceInfoEl.classList.remove('hidden');
    sourceInfoEl.innerHTML = `
      <strong>📌 Sumber Asal:</strong><br>
      Dari ${task.source.app} (${task.source.excerpt ? `"${task.source.excerpt}"` : 'Tautan Native'})<br>
      <a href="${task.source.url}" target="_blank" style="font-weight:600; text-decoration:underline;">Buka Aplikasi Asal ↗</a>
    `;
  } else {
    sourceInfoEl.classList.add('hidden');
  }

  modal.showModal();
}

function renderSubtasks(task) {
  const container = document.getElementById('subtasks-list-container');
  container.innerHTML = '';

  const subtasks = task.subtasks || [];
  const done = subtasks.filter(s => s.completed).length;

  document.getElementById('subtasks-progress').textContent = `${done}/${subtasks.length} selesai`;
  const progressbar = document.getElementById('subtasks-progressbar');
  progressbar.max = subtasks.length || 100;
  progressbar.value = done;

  subtasks.forEach((sub, idx) => {
    const div = document.createElement('div');
    div.className = `subtask-item ${sub.completed ? 'completed' : ''}`;
    div.innerHTML = `
      <input type="checkbox" ${sub.completed ? 'checked' : ''} style="margin:0;">
      <span class="subtask-title">${escapeHtml(sub.title)}</span>
      <span class="btn-remove-subtask" style="cursor:pointer; color:var(--pico-danger-color);">✕</span>
    `;

    div.querySelector('input').addEventListener('change', async (e) => {
      sub.completed = e.target.checked;
      await saveActiveTask();
      renderSubtasks(task);
    });

    div.querySelector('.btn-remove-subtask').addEventListener('click', async () => {
      task.subtasks.splice(idx, 1);
      await saveActiveTask();
      renderSubtasks(task);
    });

    container.appendChild(div);
  });
}

async function loadFilesForLinking() {
  const select = document.getElementById('modal-link-doc-select');
  select.innerHTML = '<option value="">Pilih Berkas...</option>';
  try {
    const req = indexedDB.open('tmpt_berkas');
    req.onsuccess = (e) => {
      const dbBerkas = e.target.result;
      if (!dbBerkas.objectStoreNames.contains('files')) return;
      const tx = dbBerkas.transaction('files', 'readonly');
      const store = tx.objectStore('files');
      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        const files = getAllReq.result || [];
        files.forEach(f => {
          if (!f.trash) {
            const opt = document.createElement('option');
            opt.value = JSON.stringify({ id: f.id, name: f.name, type: f.type });
            const icons = { document: '📄', spreadsheet: '📊', form: '📋', folder: '📁' };
            opt.textContent = `${icons[f.type] || '📁'} ${f.name}`;
            select.appendChild(opt);
          }
        });
      };
    };
  } catch (err) {
    console.warn('Berkas database not ready.');
  }
}

function renderLinkedFiles(task) {
  const container = document.getElementById('modal-linked-files-list');
  container.innerHTML = '';
  const links = task.tmpt_links || [];

  links.forEach((link, idx) => {
    const chip = document.createElement('div');
    chip.style = 'display: inline-flex; align-items: center; gap: 0.35rem; background: var(--pico-card-sectioning-background-color); border: 1px solid var(--pico-muted-border-color); border-radius: 6px; padding: 0.2rem 0.5rem; font-size: 0.75rem;';
    const icons = { document: '📄', spreadsheet: '📊', form: '📋', folder: '📁' };
    chip.innerHTML = `
      <span>${icons[link.type] || '📄'} ${escapeHtml(link.name)}</span>
      <span class="btn-remove-link" style="cursor:pointer; color:var(--pico-danger-color); font-weight:700; margin-left:0.25rem;">✕</span>
    `;

    chip.querySelector('.btn-remove-link').addEventListener('click', async () => {
      task.tmpt_links.splice(idx, 1);
      await saveActiveTask();
      renderLinkedFiles(task);
    });

    container.appendChild(chip);
  });
}

// ── AUTOSAVE & SAVE ACTIVE TASK ──────────────────────────────────────────────
function triggerAutosave() {
  clearTimeout(autosaveTimer);
  const statusEl = document.getElementById('save-status');
  statusEl.textContent = 'Ada perubahan...';
  autosaveTimer = setTimeout(async () => {
    statusEl.textContent = 'Menyimpan...';
    await saveActiveTask();
    statusEl.textContent = 'Tersimpan ✓';
  }, 2000);
}

async function saveActiveTask() {
  if (!activeTaskId) return;
  const task = allTasks.find(t => t.id === activeTaskId);
  if (!task) return;

  task.completed_at = document.getElementById('modal-task-completed').checked ? new Date().toISOString() : null;
  task.status = document.getElementById('modal-task-completed').checked ? 'done' : 'todo';
  task.title = document.getElementById('modal-task-title').value.trim() || 'Tugas Tanpa Judul';
  task.description = document.getElementById('modal-task-description').value;
  task.list_id = document.getElementById('modal-task-list').value;
  task.priority = document.getElementById('modal-task-priority').value;
  task.due_date = document.getElementById('modal-task-due-date').value || null;
  task.due_time = document.getElementById('modal-task-due-time').value || null;
  task.repeat = document.getElementById('modal-task-repeat').value;
  
  const tagsVal = document.getElementById('modal-task-tags').value;
  task.tags = tagsVal ? tagsVal.split(',').map(s => s.trim()).filter(s => s) : [];

  task.updated_at = new Date().toISOString();

  await dbPut(db, 'tasks', task);
  await loadData();
  renderSidebar();
  renderActiveView();
}

// ── TASK CREATION / CREATING LISTS ───────────────────────────────────────────
async function createQuickTask(title, listId = 'inbox') {
  if (!title.trim()) return;
  
  const task = {
    id: generateId(),
    title: title.trim(),
    description: '',
    status: 'todo',
    priority: 'none',
    list_id: listId,
    parent_id: null,
    order: allTasks.length,
    starred: false,
    tags: [],
    due_date: null,
    due_time: null,
    repeat: 'none',
    reminders: [30],
    tmpt_links: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null
  };

  await dbPut(db, 'tasks', task);
  await loadData();
  renderSidebar();
  renderActiveView();
  toast('Tugas baru ditambahkan.', 'success');
}

// ── EVENT LISTENERS SETUP ────────────────────────────────────────────────────
function setupEventListeners() {
  // Sidebar Nav Items (Inbox, Today, etc)
  document.querySelectorAll('.tugas-sidebar .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const filter = item.getAttribute('data-filter');
      setFilter(filter);
    });
  });

  document.getElementById('btn-add-list-alt').addEventListener('click', async (e) => {
    e.preventDefault();
    const name = await prompt('Masukkan nama daftar tugas baru:', 'Nama daftar...');
    if (name && name.trim()) {
      const list = {
        id: generateId(),
        name: name.trim(),
        color: '#2563eb',
        icon: '📋',
        order: allLists.length,
        is_inbox: false,
        is_default: false,
        created_at: new Date().toISOString()
      };
      await dbPut(db, 'lists', list);
      await loadData();
      renderSidebar();
      toast(`Daftar "${name}" dibuat.`, 'success');
    }
  });

  // Helper to open options for a specific filter/list
  const openListOptions = (filterId) => {
    const isVirtual = (filterId === 'inbox' || filterId === 'today' || filterId === 'starred' || filterId === 'recurring' || filterId === 'done' || filterId.startsWith('tag:'));
    
    let title = 'Opsi Daftar';
    let isDefaultList = false;

    if (isVirtual) {
      if (filterId === 'inbox') title = 'Opsi: Inbox';
      else if (filterId === 'today') title = 'Opsi: Hari Ini';
      else if (filterId === 'starred') title = 'Opsi: Berbintang';
      else if (filterId === 'recurring') title = 'Opsi: Berulang';
      else if (filterId === 'done') title = 'Opsi: Selesai';
      else if (filterId.startsWith('tag:')) title = `Opsi Label: ${filterId.replace('tag:', '')}`;
    } else {
      const list = allLists.find(l => l.id === filterId);
      if (list) {
        title = `Opsi: ${list.name}`;
        isDefaultList = !!list.is_default;
      }
    }

    const modal = document.getElementById('list-actions-modal');
    modal.setAttribute('data-target-filter', filterId);
    document.getElementById('list-actions-title').textContent = title;
    
    // Hide/show option buttons dynamically
    const btnRename = document.getElementById('btn-opt-rename-list');
    const btnMove = document.getElementById('btn-opt-move-tasks');
    const btnDelete = document.getElementById('btn-opt-delete-list');
    const btnClear = document.getElementById('btn-opt-clear-completed');

    if (isVirtual) {
      if (btnRename) btnRename.style.display = 'none';
      if (btnMove) btnMove.style.display = 'none';
      if (btnDelete) btnDelete.style.display = 'none';
    } else {
      if (btnRename) btnRename.style.display = isDefaultList ? 'none' : 'block';
      if (btnMove) btnMove.style.display = 'block';
      if (btnDelete) btnDelete.style.display = isDefaultList ? 'none' : 'block';
    }
    if (btnClear) btnClear.style.display = 'block';

    modal.showModal();
  };

  // Event delegation for sidebar option buttons
  document.addEventListener('click', (e) => {
    const optBtn = e.target.closest('.sidebar-opt-btn');
    if (optBtn) {
      e.stopPropagation();
      e.preventDefault();
      const filterId = optBtn.getAttribute('data-filter');
      openListOptions(filterId);
    }
  });

  // Top List Options Dialog Hook (kept for fallback compatibility, now triggers active filter options)
  document.getElementById('btn-list-options').addEventListener('click', () => {
    openListOptions(currentFilter);
  });

  // Action: Clear Completed Tasks Option
  document.getElementById('btn-opt-clear-completed').addEventListener('click', async () => {
    const modal = document.getElementById('list-actions-modal');
    const targetFilter = modal.getAttribute('data-target-filter') || currentFilter;
    modal.close();
    
    let tasksToClear = [];
    if (targetFilter === 'inbox') {
      tasksToClear = allTasks.filter(t => t.list_id === 'inbox' && t.status === 'done');
    } else if (targetFilter === 'today') {
      const todayStr = new Date().toISOString().split('T')[0];
      tasksToClear = allTasks.filter(t => t.due_date === todayStr && t.status === 'done');
    } else if (targetFilter === 'starred') {
      tasksToClear = allTasks.filter(t => t.starred && t.status === 'done');
    } else if (targetFilter === 'recurring') {
      tasksToClear = allTasks.filter(t => t.repeat && t.repeat !== 'none' && t.status === 'done');
    } else if (targetFilter === 'done') {
      tasksToClear = allTasks.filter(t => t.status === 'done');
    } else if (targetFilter.startsWith('tag:')) {
      const tag = targetFilter.replace('tag:', '').toLowerCase();
      tasksToClear = allTasks.filter(t => t.status === 'done' && t.tags && t.tags.some(tg => tg.trim().toLowerCase() === tag));
    } else {
      tasksToClear = allTasks.filter(t => t.list_id === targetFilter && t.status === 'done');
    }

    if (tasksToClear.length === 0) {
      toast('Tidak ada tugas selesai untuk dihapus.', 'info');
      return;
    }

    for (const task of tasksToClear) {
      await dbDelete(db, 'tasks', task.id);
    }

    await loadData();
    renderSidebar();
    renderActiveView();
    toast(`${tasksToClear.length} tugas selesai telah dihapus.`, 'success');
  });

  // Action: Rename List Option
  document.getElementById('btn-opt-rename-list').addEventListener('click', () => {
    const modal = document.getElementById('list-actions-modal');
    const targetFilter = modal.getAttribute('data-target-filter') || currentFilter;
    modal.close();
    
    const list = allLists.find(l => l.id === targetFilter);
    if (!list) return;

    document.getElementById('list-new-name-input').value = list.name;
    document.getElementById('list-rename-modal').showModal();
  });

  document.getElementById('btn-submit-rename-list').addEventListener('click', async () => {
    const modal = document.getElementById('list-actions-modal');
    const targetFilter = modal.getAttribute('data-target-filter') || currentFilter;
    
    const list = allLists.find(l => l.id === targetFilter);
    if (!list) return;

    const newName = document.getElementById('list-new-name-input').value.trim();
    if (newName) {
      list.name = newName;
      await dbPut(db, 'lists', list);
      await loadData();
      if (currentFilter === targetFilter) {
        setFilter(list.id);
      } else {
        renderSidebar();
      }
      document.getElementById('list-rename-modal').close();
      toast('Nama daftar berhasil diubah.', 'success');
    } else {
      toast('Nama daftar tidak boleh kosong.', 'error');
    }
  });

  // Action: Move Tasks Option
  document.getElementById('btn-opt-move-tasks').addEventListener('click', () => {
    const modal = document.getElementById('list-actions-modal');
    const targetFilter = modal.getAttribute('data-target-filter') || currentFilter;
    modal.close();
    
    const list = allLists.find(l => l.id === targetFilter);
    if (!list) return;

    // Populate target list select
    const select = document.getElementById('list-target-select');
    select.innerHTML = '';
    allLists.forEach(l => {
      if (l.id !== targetFilter) {
        const opt = document.createElement('option');
        opt.value = l.id;
        opt.textContent = `${l.icon || '📋'} ${l.name}`;
        select.appendChild(opt);
      }
    });

    if (select.children.length === 0) {
      toast('Tidak ada daftar tujuan lainnya.', 'warning');
      return;
    }

    document.getElementById('move-tasks-modal-desc').textContent = `Pindahkan seluruh tugas dari daftar "${list.name}" ke daftar tujuan di bawah ini:`;
    document.getElementById('list-move-tasks-modal').showModal();
  });

  document.getElementById('btn-submit-move-tasks').addEventListener('click', async () => {
    const modal = document.getElementById('list-actions-modal');
    const targetFilter = modal.getAttribute('data-target-filter') || currentFilter;
    
    const targetListId = document.getElementById('list-target-select').value;
    if (!targetListId) return;

    let moveCount = 0;
    allTasks.forEach(task => {
      if (task.list_id === targetFilter) {
        task.list_id = targetListId;
        dbPut(db, 'tasks', task);
        moveCount++;
      }
    });

    if (moveCount > 0) {
      await loadData();
      renderSidebar();
      renderActiveView();
      toast(`${moveCount} tugas berhasil dipindahkan.`, 'success');
    } else {
      toast('Tidak ada tugas untuk dipindahkan.', 'info');
    }
    document.getElementById('list-move-tasks-modal').close();
  });

  // Action: Delete List Option
  document.getElementById('btn-opt-delete-list').addEventListener('click', async () => {
    const modal = document.getElementById('list-actions-modal');
    const targetFilter = modal.getAttribute('data-target-filter') || currentFilter;
    modal.close();
    
    const list = allLists.find(l => l.id === targetFilter);
    if (!list) return;

    const ok = await confirm(`Hapus daftar "${list.name}" beserta seluruh tugas di dalamnya?`, { danger: true });
    if (ok) {
      await deleteList(list.id);
    }
  });

  // Top Search
  document.getElementById('search-input').addEventListener('input', () => {
    renderActiveView();
  });

  // Top Sort Select
  document.getElementById('sort-select').addEventListener('change', () => {
    renderActiveView();
  });

  // Toggle View
  document.getElementById('btn-view-list').addEventListener('click', () => {
    currentView = 'list';
    document.getElementById('btn-view-list').className = 'primary';
    document.getElementById('btn-view-kanban').className = 'outline secondary';
    renderActiveView();
  });

  document.getElementById('btn-view-kanban').addEventListener('click', () => {
    currentView = 'kanban';
    document.getElementById('btn-view-list').className = 'outline secondary';
    document.getElementById('btn-view-kanban').className = 'primary';
    renderActiveView();
  });

  // Inline Quick Add Input
  document.getElementById('inline-add-input').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const val = e.target.value;
      if (val.trim()) {
        const targetList = (currentFilter === 'today' || currentFilter === 'starred' || currentFilter === 'recurring' || currentFilter === 'done' || currentFilter.startsWith('tag:')) ? 'inbox' : currentFilter;
        await createQuickTask(val, targetList);
        e.target.value = '';
      }
    }
  });

  // Top Toolbar Add Task
  document.getElementById('btn-quick-add').addEventListener('click', async () => {
    const title = await prompt('Judul Tugas Baru:', 'Judul tugas...');
    if (title && title.trim()) {
      const targetList = (currentFilter === 'today' || currentFilter === 'starred' || currentFilter === 'recurring' || currentFilter === 'done' || currentFilter.startsWith('tag:')) ? 'inbox' : currentFilter;
      createQuickTask(title, targetList);
    }
  });

  // Modal Editor Handlers
  document.getElementById('btn-save-task').addEventListener('click', () => {
    document.getElementById('task-editor-modal').close();
  });

  document.getElementById('modal-task-completed').addEventListener('change', triggerAutosave);
  document.getElementById('modal-task-title').addEventListener('input', triggerAutosave);
  document.getElementById('modal-task-description').addEventListener('input', triggerAutosave);
  document.getElementById('modal-task-priority').addEventListener('change', triggerAutosave);
  document.getElementById('modal-task-due-date').addEventListener('change', triggerAutosave);
  document.getElementById('modal-task-due-time').addEventListener('change', triggerAutosave);
  document.getElementById('modal-task-repeat').addEventListener('change', triggerAutosave);
  document.getElementById('modal-task-tags').addEventListener('input', triggerAutosave);
  document.getElementById('modal-task-list').addEventListener('change', triggerAutosave);

  document.getElementById('modal-task-star').addEventListener('click', async () => {
    const starBtn = document.getElementById('modal-task-star');
    const task = allTasks.find(t => t.id === activeTaskId);
    if (task) {
      task.starred = !task.starred;
      starBtn.textContent = task.starred ? '★' : '☆';
      starBtn.className = `star-btn ${task.starred ? 'starred' : ''}`;
      triggerAutosave();
    }
  });

  // Modal Subtasks add
  document.getElementById('btn-add-subtask').addEventListener('click', async () => {
    const input = document.getElementById('new-subtask-input');
    const val = input.value.trim();
    if (val && activeTaskId) {
      const task = allTasks.find(t => t.id === activeTaskId);
      if (task) {
        if (!task.subtasks) task.subtasks = [];
        task.subtasks.push({ title: val, completed: false });
        input.value = '';
        await saveActiveTask();
        renderSubtasks(task);
      }
    }
  });

  // Modal link file
  document.getElementById('btn-modal-add-link').addEventListener('click', async () => {
    const select = document.getElementById('modal-link-doc-select');
    const val = select.value;
    if (val && activeTaskId) {
      const fileData = JSON.parse(val);
      const task = allTasks.find(t => t.id === activeTaskId);
      if (task) {
        if (!task.tmpt_links) task.tmpt_links = [];
        // prevent duplicate
        if (!task.tmpt_links.some(l => l.id === fileData.id)) {
          task.tmpt_links.push({ id: fileData.id, name: fileData.name, type: fileData.type });
          await saveActiveTask();
          renderLinkedFiles(task);
        }
      }
    }
  });

  // Block calendar time
  document.getElementById('btn-block-calendar').addEventListener('click', async () => {
    if (!activeTaskId) return;
    const task = allTasks.find(t => t.id === activeTaskId);
    if (!task) return;

    if (!task.due_date) {
      toast('Tentukan tanggal tenggat terlebih dahulu sebelum memblokir waktu di Kalender.', 'warning');
      return;
    }

    try {
      const req = indexedDB.open('tmpt_kalender');
      req.onsuccess = async (e) => {
        const dbKalender = e.target.result;
        if (!dbKalender.objectStoreNames.contains('events')) {
          toast('Modul Kalender belum terinstalasi.', 'error');
          return;
        }

        const tx = dbKalender.transaction('events', 'readwrite');
        const store = tx.objectStore('events');
        
        const eventId = task.calendar_event_id || generateId();
        const startDateTime = task.due_time ? `${task.due_date}T${task.due_time}` : `${task.due_date}T09:00:00`;
        const endDateTime = task.due_time ? `${task.due_date}T${String(Number(task.due_time.split(':')[0])+1).padStart(2, '0')}:${task.due_time.split(':')[1]}` : `${task.due_date}T10:00:00`;

        const event = {
          id: eventId,
          calendar_id: 'kerja',
          title: `🔲 Tugas: ${task.title}`,
          start: startDateTime,
          end: endDateTime,
          all_day: !task.due_time,
          description: task.description || 'Dibuat dari TMPT Tugas',
          location: '',
          rrule: task.repeat || 'none',
          source_app: 'tugas',
          source_id: task.id,
          tmpt_links: task.tmpt_links || []
        };

        const putReq = store.put(event);
        putReq.onsuccess = async () => {
          task.calendar_event_id = eventId;
          await dbPut(db, 'tasks', task);
          await loadData();
          broadcastTMPT(TMPT_EVENTS.EVENT_CREATED, { event_id: eventId });
          toast('Waktu berhasil diblokir di Kalender!', 'success');
        };
      };
    } catch (err) {
      console.error(err);
      toast('Gagal menyinkronkan ke Kalender.', 'error');
    }
  });

  // Modal Delete Task
  document.getElementById('btn-delete-task').addEventListener('click', async () => {
    if (activeTaskId) {
      await dbDelete(db, 'tasks', activeTaskId);
      document.getElementById('task-editor-modal').close();
      toast('Tugas dihapus.', 'success');
      await loadData();
      renderSidebar();
      renderActiveView();
    }
  });

  // Kanban add cards triggers
  document.querySelectorAll('.btn-add-card').forEach(btn => {
    btn.addEventListener('click', async () => {
      const status = btn.getAttribute('data-status');
      const title = await prompt('Judul Tugas Kanban Baru:', 'Judul tugas...');
      if (title && title.trim()) {
        const targetList = (currentFilter === 'today' || currentFilter === 'starred' || currentFilter === 'recurring' || currentFilter === 'done' || currentFilter.startsWith('tag:')) ? 'inbox' : currentFilter;
        createKanbanTask(title, status, targetList);
      }
    });
  });

  // Export / Import Dialogs
  document.getElementById('btn-show-help').addEventListener('click', () => {
    document.getElementById('help-modal').showModal();
  });

  document.getElementById('btn-export').addEventListener('click', () => {
    exportData();
  });

  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-modal').showModal();
  });

  document.getElementById('import-form').addEventListener('submit', async (e) => {
    const input = document.getElementById('import-file');
    const file = input.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const raw = evt.target.result;
          if (file.name.endsWith('.json')) {
            const data = JSON.parse(raw);
            if (Array.isArray(data)) {
              for (const t of data) {
                if (t.id && t.title) {
                  await dbPut(db, 'tasks', t);
                }
              }
            }
          } else if (file.name.endsWith('.csv')) {
            const lines = raw.split('\n');
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(',');
              if (cols[0]) {
                await createQuickTask(cols[0].replace(/"/g, ''));
              }
            }
          } else if (file.name.endsWith('.md')) {
            const lines = raw.split('\n');
            for (const line of lines) {
              const match = line.match(/^\s*[-*+]\s+\[\s\]\s+(.+)/);
              if (match) {
                await createQuickTask(match[1].trim());
              }
            }
          }
          toast('Data berhasil diimpor.', 'success');
          document.getElementById('import-modal').close();
          await loadData();
          renderSidebar();
          renderActiveView();
        } catch (err) {
          toast('Gagal mem-parsing berkas impor.', 'error');
        }
      };
      reader.readAsText(file);
    }
  });

  // Hamburger Sidebar Toggle Hook
  const setupHamburgerToggle = () => {
    const hamburger = document.getElementById('header-hamburger-container');
    if (hamburger) {
      hamburger.style.display = 'block';
    }
  };

  document.addEventListener('DOMContentLoaded', setupHamburgerToggle);
  document.addEventListener('htmx:afterOnLoad', (e) => {
    if (e.detail.target.id === 'header-container') {
      setupHamburgerToggle();
    }
  });

  document.addEventListener('tmpt:sidebar-toggle', (e) => {
    e.preventDefault();
    document.body.classList.toggle('sidebar-collapsed');
  });
}

async function createKanbanTask(title, status, listId) {
  if (!title.trim()) return;
  const task = {
    id: generateId(),
    title: title.trim(),
    description: '',
    status: status,
    priority: 'none',
    list_id: listId,
    parent_id: null,
    order: allTasks.length,
    starred: false,
    tags: [],
    due_date: null,
    due_time: null,
    repeat: 'none',
    reminders: [30],
    tmpt_links: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null
  };
  await dbPut(db, 'tasks', task);
  await loadData();
  renderSidebar();
  renderActiveView();
  toast('Tugas baru ditambahkan.', 'success');
}

// ── BROADCAST RECEIVER ───────────────────────────────────────────────────────
function setupBroadcastListener() {
  listenTMPT(async (data) => {
    const { type, payload } = data;
    if (type === TMPT_EVENTS.FORM_SUBMITTED) {
      // Auto task from form response
      const formTitle = payload.form_title || 'Tanggapan Form';
      await createQuickTask(`Tindak Lanjut: Tanggapan dari ${formTitle}`, 'inbox');
    } else if (type === TMPT_EVENTS.DEADLINE_SET) {
      // Auto task from document deadline
      const taskTitle = `Tenggat Waktu: ${payload.title || 'Dokumen'}`;
      const task = {
        id: generateId(),
        title: taskTitle,
        description: `Dibuat otomatis untuk melacak deadline berkas TMPT.`,
        status: 'todo',
        priority: 'high',
        list_id: 'inbox',
        parent_id: null,
        order: allTasks.length,
        starred: false,
        tags: ['deadline'],
        due_date: payload.deadline,
        due_time: null,
        repeat: 'none',
        reminders: [1440],
        tmpt_links: [{ id: payload.file_id, name: payload.title, type: payload.app || 'document' }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null
      };
      await dbPut(db, 'tasks', task);
      await loadData();
      renderSidebar();
      renderActiveView();
      toast('Tugas baru dibuat dari deadline dokumen.', 'info');
    }
  });
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────────────────────
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', async (e) => {
    // Esc closes active dialog
    if (e.key === 'Escape') {
      const modal = document.querySelector('dialog[open]');
      if (modal) modal.close();
    }

    // Don't trigger if user typing in input/textarea
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT') {
      return;
    }

    if (e.key === 'q' || e.key === 'Q') {
      e.preventDefault();
      const val = await prompt('Tambah tugas cepat ke list aktif:', 'Judul tugas...');
      if (val && val.trim()) {
        const targetList = (currentFilter === 'today' || currentFilter === 'starred' || currentFilter === 'recurring' || currentFilter === 'done' || currentFilter.startsWith('tag:')) ? 'inbox' : currentFilter;
        createQuickTask(val, targetList);
      }
    }
  });

  // Global search trigger Ctrl+Shift+T
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
      e.preventDefault();
      const search = document.getElementById('search-input');
      if (search) search.focus();
    }
  });
}

// ── NOTIFICATIONS & REMINDER ENGINE ──────────────────────────────────────────
async function checkAndRequestNotifications() {
  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }
}

function scheduleReminders() {
  // Check every 60 seconds
  setInterval(async () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const currentHour = String(now.getHours()).padStart(2, '0');
      const currentMin = String(now.getMinutes()).padStart(2, '0');
      const timeStr = `${currentHour}:${currentMin}`;

      allTasks.forEach(task => {
        if (task.status !== 'done' && task.due_date === todayStr && task.due_time === timeStr) {
          // Fire alert
          new Notification(`Pengingat: ${task.title}`, {
            body: `Tenggat tugas Anda saat ini: ${timeStr}`,
            icon: '/assets/img/logo.svg?v=2'
          });
        }
      });
    }
  }, 60000);
}

// ── EXPORT ENGINE ────────────────────────────────────────────────────────────
function exportData() {
  const payload = JSON.stringify(allTasks, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `TMPT-Tugas-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Data tugas diekspor.', 'success');
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${parts[2]} ${months[parseInt(parts[1])-1]} ${parts[0]}`;
  }
  return dateStr;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── INITIAL LAUNCH ───────────────────────────────────────────────────────────
init();
