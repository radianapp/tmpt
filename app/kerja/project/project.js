// project.js - TMPT Project Main Logic (Client-side, IndexedDB)

let db = null;
let currentProjectId = null;
let activeTab = 'portfolio';
let timerInterval = null;
let timerSeconds = 0;
let activeTrackerTaskId = null;
let activeTrackerStartTime = null;

const STORES = [
    'projects', 'tasks', 'sprints', 'requirements', 'test_cases', 
    'test_runs', 'test_executions', 'bugs', 'wiki', 'members', 
    'time_entries', 'meetings', 'risks', 'decisions', 'change_requests', 'releases'
];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initial State Check
    if (window.TMPT_Auth) {
        await window.TMPT_Auth.init();
        if (!window.TMPT_Auth.isUnlocked()) return; // Auth.js will redirect
    }

    // 2. Open DB
    await initDatabase();

    // 3. Setup Header & Sidebar Listeners
    setupHeaderAndSidebar();

    // 4. Load Project Selector
    await loadProjectSelector();

    // 5. Check URL for project redirect from Berkas
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    if (idParam) {
        const proj = await getById('projects', idParam);
        if (proj) {
            currentProjectId = idParam;
            const selector = document.getElementById('project-selector');
            if (selector) selector.value = idParam;
            await loadProjectMetadata();
            switchTab('dashboard');
        }
    }

    // 6. Render Initial Tab
    await renderActiveTab();

    // 7. Load tracker tasks
    await loadTrackerTasks();
});

// Setup shared header app name and hamburger menu sidebar toggle
let searchQuery = '';

function setupHeaderAndSidebar() {
    // Rename app title and search placeholder
    const checkHeader = setInterval(() => {
        const appHeaderName = document.getElementById('header-app-name');
        const headerSearch = document.getElementById('header-search');
        if (appHeaderName && headerSearch) {
            appHeaderName.textContent = 'Project';
            headerSearch.placeholder = 'Cari proyek atau tugas...';
            
            // Listen to search changes
            headerSearch.addEventListener('input', (e) => {
                searchQuery = e.target.value.toLowerCase().trim();
                renderActiveTab();
            });

            clearInterval(checkHeader);
        }
    }, 100);
    setTimeout(() => clearInterval(checkHeader), 5000);

    // Sidebar Hamburger toggle listener
    document.addEventListener('tmpt:sidebar-toggle', (e) => {
        e.preventDefault();
        const sidebar = document.querySelector('.project-sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
        }
    });
}

function broadcastProjectChange() {
    try {
        const channel = new BroadcastChannel('tmpt_office');
        channel.postMessage({ type: 'FILE_CREATED', payload: {}, source_app: 'project' });
        channel.close();
    } catch(e) {}
}

// --- IndexedDB Core Operations ---
async function initDatabase() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('tmpt_project');
        req.onupgradeneeded = (e) => {
            const database = e.target.result;
            STORES.forEach(storeName => {
                if (!database.objectStoreNames.contains(storeName)) {
                    database.createObjectStore(storeName, { keyPath: 'id' });
                }
            });
        };
        req.onsuccess = async (e) => {
            db = e.target.result;
            await seedInitialData();
            resolve();
        };
        req.onerror = (e) => {
            console.error("IndexedDB Open Error:", e.target.error);
            reject(e.target.error);
        };
    });
}

// Seed initial data if store is empty
async function seedInitialData() {
    // Pastikan semua store sudah tersedia sebelum bertransaksi
    // Ini penting setelah restore backup yang tidak membuat schema
    const missingStores = STORES.filter(s => !db.objectStoreNames.contains(s));
    if (missingStores.length > 0) {
        console.warn('[Project] Store belum tersedia, menutup dan upgrade database...', missingStores);
        db.close();
        // Paksa upgrade dengan menaikkan versi agar onupgradeneeded terpanggil
        await new Promise((resolve, reject) => {
            const currentVersion = db.version;
            const req = indexedDB.open('tmpt_project', currentVersion + 1);
            req.onupgradeneeded = (e) => {
                const database = e.target.result;
                STORES.forEach(storeName => {
                    if (!database.objectStoreNames.contains(storeName)) {
                        database.createObjectStore(storeName, { keyPath: 'id' });
                    }
                });
            };
            req.onsuccess = (e) => {
                db = e.target.result;
                resolve();
            };
            req.onerror = (e) => {
                console.error('[Project] Gagal upgrade database:', e.target.error);
                reject(e.target.error);
            };
        });
    }

    // Sekarang aman untuk bertransaksi
    try {
        const tx = db.transaction(['projects', 'members'], 'readonly');
        const memberStore = tx.objectStore('members');

        const memberCount = await new Promise(r => {
            const req = memberStore.count();
            req.onsuccess = () => r(req.result);
            req.onerror = () => r(0);
        });

        if (memberCount === 0) {
            console.log("Seeding initial local team members...");
            const writeTx = db.transaction(['members'], 'readwrite');
            
            // Members
            const demoMembers = [
                { id: 'm1', name: 'Budi Santoso', role: 'Developer Backend', email: 'budi@tmpt.local', capacity: 40 },
                { id: 'm2', name: 'Siti Rahayu', role: 'Developer Frontend', email: 'siti@tmpt.local', capacity: 40 },
                { id: 'm3', name: 'Andi Pratama', role: 'QA Engineer', email: 'andi@tmpt.local', capacity: 40 },
                { id: 'm4', name: 'Deni Kusuma', role: 'Project Manager / PO', email: 'deni@tmpt.local', capacity: 40 }
            ];
            demoMembers.forEach(m => writeTx.objectStore('members').put(m));
        }
    } catch (err) {
        console.warn('[Project] seedInitialData dilewati karena error:', err.message);
    }
}

async function getAllFromStore(storeName) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function getById(storeName, id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function putToStore(storeName, val) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(val);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function deleteFromStore(storeName, id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// --- Navigation & Core UI Event Handlers ---
window.switchTab = function(tabName) {
    activeTab = tabName;
    document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`nav-${tabName}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Update Primary Action Button
    const primaryBtn = document.getElementById('btn-primary-action');
    if (primaryBtn) {
        if (tabName === 'portfolio') {
            primaryBtn.style.display = 'none';
        } else if (tabName === 'kanban' || tabName === 'dashboard' || tabName === 'timeline' || tabName === 'wbs') {
            primaryBtn.textContent = '+ Tambah Tugas';
            primaryBtn.style.display = 'block';
        } else if (tabName === 'requirements') {
            primaryBtn.textContent = '+ Requirement Baru';
            primaryBtn.style.display = 'block';
        } else if (tabName === 'qa') {
            primaryBtn.textContent = '+ Laporkan Bug / Buat Test Case';
            primaryBtn.style.display = 'block';
        } else if (tabName === 'wiki') {
            primaryBtn.textContent = '+ Halaman Baru';
            primaryBtn.style.display = 'block';
        } else if (tabName === 'resources') {
            primaryBtn.textContent = '+ Tambah Anggota Tim';
            primaryBtn.style.display = 'block';
        } else {
            primaryBtn.style.display = 'none';
        }
    }

    renderActiveTab();
};

window.handleProjectChange = function() {
    const selector = document.getElementById('project-selector');
    if (selector.value === 'all') {
        currentProjectId = null;
        document.getElementById('project-display-name').textContent = "Portofolio Organisasi";
        const badgeContainer = document.getElementById('project-meta-container');
        if (badgeContainer) badgeContainer.innerHTML = '';
        switchTab('portfolio');
    } else {
        currentProjectId = selector.value;
        loadProjectMetadata();
        if (activeTab === 'portfolio') {
            switchTab('dashboard');
        } else {
            renderActiveTab();
        }
    }
    loadTrackerTasks();
};

async function loadProjectSelector() {
    const projects = await getAllFromStore('projects');
    const selector = document.getElementById('project-selector');
    if (!selector) return;

    let html = '<option value="all">Ringkasan Portofolio</option>';
    projects.forEach(p => {
        html += `<option value="${p.id}">${p.key} - ${p.name}</option>`;
    });
    selector.innerHTML = html;

    if (projects.length > 0 && !currentProjectId) {
        // Default to first project
        currentProjectId = projects[0].id;
        selector.value = currentProjectId;
        loadProjectMetadata();
    } else if (currentProjectId) {
        selector.value = currentProjectId;
    } else {
        // Portfolio mode
        currentProjectId = null;
        selector.value = 'all';
        document.getElementById('project-display-name').textContent = "Portofolio Organisasi";
        const badgeContainer = document.getElementById('project-meta-container');
        if (badgeContainer) badgeContainer.innerHTML = '';
    }
}

async function loadProjectMetadata() {
    if (!currentProjectId) {
        const badgeContainer = document.getElementById('project-meta-container');
        if (badgeContainer) badgeContainer.innerHTML = '';
        return;
    }
    const project = await getById('projects', currentProjectId);
    if (!project) return;

    document.getElementById('project-display-name').textContent = project.name;
    const badgeContainer = document.getElementById('project-meta-container');
    badgeContainer.innerHTML = `
        <span class="meta-badge active">Status: ${project.status.toUpperCase()}</span>
        <span class="meta-badge ${project.priority}">Prioritas: ${project.priority.toUpperCase()}</span>
        <span class="meta-badge">PM: ${project.pm || 'Belum Ditunjuk'}</span>
    `;
}

window.deleteCurrentProject = async function(projId) {
    const targetProjId = projId || currentProjectId;
    if (!targetProjId) return;
    const project = await getById('projects', targetProjId);
    if (!project) return;

    const confirmed = await window.TMPT_UI.confirm(`Apakah Anda yakin ingin menghapus proyek "${project.name}" beserta semua tugas, sprint, bug, wiki, dan data terkait secara permanen?`);
    if (!confirmed) return;

    // Delete project itself
    await deleteFromStore('projects', targetProjId);

    // Clean up all related stores where project_id matches targetProjId
    const cleanupStores = ['tasks', 'sprints', 'requirements', 'test_cases', 'test_runs', 'test_executions', 'bugs', 'wiki', 'time_entries', 'meetings', 'risks', 'decisions', 'change_requests', 'releases'];
    
    for (const storeName of cleanupStores) {
        const items = await getAllFromStore(storeName);
        const projectItems = items.filter(item => item.project_id === targetProjId);
        for (const item of projectItems) {
            await deleteFromStore(storeName, item.id);
        }
    }

    if (window.TMPT_UI) window.TMPT_UI.toast(`Proyek "${project.name}" berhasil dihapus.`, "info");
    
    // Reset selection if deleted project is active
    if (currentProjectId === targetProjId) {
        currentProjectId = null;
    }
    
    broadcastProjectChange();
    await loadProjectSelector();
    
    // Switch to portfolio or refresh active tab
    const selector = document.getElementById('project-selector');
    if (!currentProjectId) {
        if (selector) selector.value = 'all';
        handleProjectChange();
    } else {
        if (selector) selector.value = currentProjectId;
        await renderActiveTab();
    }
};

window.handlePrimaryAction = function() {
    if (activeTab === 'kanban' || activeTab === 'dashboard' || activeTab === 'timeline' || activeTab === 'wbs') {
        openNewTaskModal();
    } else if (activeTab === 'requirements') {
        openNewRequirementModal();
    } else if (activeTab === 'qa') {
        openNewQAMenu();
    } else if (activeTab === 'wiki') {
        openNewWikiModal();
    } else if (activeTab === 'resources') {
        openNewMemberModal();
    }
};

// --- Tab Renderers ---
async function renderActiveTab() {
    const container = document.getElementById('project-tab-content');
    if (!container) return;

    if (activeTab !== 'portfolio' && !currentProjectId) {
        container.innerHTML = `
            <div class="empty-state-card" style="text-align: center; padding: 3rem; background: var(--pico-card-background-color); border: 1px solid var(--pico-muted-border-color); border-radius: 16px;">
                <span style="font-size: 3rem;">💼</span>
                <h3>Pilih Proyek Terlebih Dahulu</h3>
                <p class="secondary">Pilih proyek aktif di menu pilihan sebelah kiri atau buat proyek baru untuk mengelola tugas, kanban, dan timeline.</p>
            </div>
        `;
        return;
    }

    updateSaveStatus('Menyimpan...');

    if (activeTab === 'portfolio') {
        await renderPortfolio(container);
    } else if (activeTab === 'dashboard') {
        await renderDashboard(container);
    } else if (activeTab === 'kanban') {
        await renderKanban(container);
    } else if (activeTab === 'timeline') {
        await renderTimeline(container);
    } else if (activeTab === 'wbs') {
        await renderWBS(container);
    } else if (activeTab === 'sprints') {
        await renderSprints(container);
    } else if (activeTab === 'requirements') {
        await renderRequirements(container);
    } else if (activeTab === 'qa') {
        await renderQA(container);
    } else if (activeTab === 'wiki') {
        await renderWiki(container);
    } else if (activeTab === 'resources') {
        await renderResources(container);
    } else if (activeTab === 'releases') {
        await renderReleases(container);
    } else if (activeTab === 'extra') {
        await renderExtra(container);
    }

    setTimeout(() => {
        updateSaveStatus('Tersimpan ✓');
    }, 500);
}

function updateSaveStatus(text) {
    const el = document.getElementById('save-status');
    if (el) el.textContent = text;
}

// --- Modul 1: Portfolio ---
async function renderPortfolio(container) {
    const projects = await getAllFromStore('projects');
    const tasks = await getAllFromStore('tasks');
    
    let totalBudget = 0;
    let totalActual = 0;
    projects.forEach(p => {
        totalBudget += parseFloat(p.budget || 0);
        totalActual += parseFloat(p.actual_cost || 0);
    });

    let html = `
        <div class="dashboard-grid" style="margin-bottom: 1.5rem;">
            <div class="dash-card">
                <h4>Total Proyek</h4>
                <div class="value">${projects.length}</div>
            </div>
            <div class="dash-card">
                <h4>Total Budget</h4>
                <div class="value">Rp ${totalBudget.toLocaleString('id-ID')}</div>
            </div>
            <div class="dash-card">
                <h4>Aktual Terpakai</h4>
                <div class="value">Rp ${totalActual.toLocaleString('id-ID')}</div>
            </div>
            <div class="dash-card">
                <h4>Efisiensi Varians</h4>
                <div class="value" style="color: ${totalBudget >= totalActual ? '#22c55e' : '#ef4444'}">
                    ${totalBudget ? (((totalBudget - totalActual) / totalBudget) * 100).toFixed(1) : 0}%
                </div>
            </div>
        </div>

        <figure>
            <table>
                <thead>
                    <tr>
                        <th>Proyek</th>
                        <th>Status</th>
                        <th>Kemajuan (Progress)</th>
                        <th>Anggaran</th>
                        <th>Project Manager</th>
                        <th>Tindakan</th>
                    </tr>
                </thead>
                <tbody>
    `;

    if (projects.length === 0) {
        html += '<tr><td colspan="6" style="text-align: center;">Belum ada proyek dibuat.</td></tr>';
    } else {
        projects.forEach(p => {
            const pTasks = tasks.filter(t => t.project_id === p.id);
            const doneTasks = pTasks.filter(t => t.status === 'done').length;
            const progress = pTasks.length ? Math.round((doneTasks / pTasks.length) * 100) : 0;

            html += `
                <tr>
                    <td><strong>[${p.key}] ${p.name}</strong></td>
                    <td><span class="meta-badge active">${p.status.toUpperCase()}</span></td>
                    <td>
                        <progress value="${progress}" max="100"></progress>
                        <small style="font-weight: 700; margin-left: 0.5rem;">${progress}%</small>
                    </td>
                    <td>Rp ${(p.budget || 0).toLocaleString('id-ID')}</td>
                    <td>${p.pm || '-'}</td>
                    <td>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <button class="outline" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; margin: 0; display: inline-block; width: auto;" onclick="selectProjectFromPortfolio('${p.id}')">Buka Dasbor</button>
                            <button class="outline" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; margin: 0; border-color: #ef4444; color: #ef4444; display: inline-block; width: auto;" onclick="deleteCurrentProject('${p.id}')">Hapus</button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    html += `
                </tbody>
            </table>
        </figure>
    `;
    container.innerHTML = html;
}

window.selectProjectFromPortfolio = function(projId) {
    const selector = document.getElementById('project-selector');
    if (selector) {
        selector.value = projId;
        handleProjectChange();
    }
};

// --- Modul 2: Project Dashboard ---
async function renderDashboard(container) {
    if (!currentProjectId) {
        container.innerHTML = `<div class="empty-state-card" style="text-align: center; padding: 2rem;"><h3>Pilih proyek terlebih dahulu di sidebar</h3></div>`;
        return;
    }

    const project = await getById('projects', currentProjectId);
    const tasks = await getAllFromStore('tasks');
    const pTasks = tasks.filter(t => t.project_id === currentProjectId);

    const totalTasks = pTasks.length;
    const completedTasks = pTasks.filter(t => t.status === 'done').length;
    const inProgressTasks = pTasks.filter(t => t.status === 'in_progress').length;
    const progress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Actual hours calculated from time entries
    const timeEntries = await getAllFromStore('time_entries');
    let totalActualHours = 0;
    pTasks.forEach(t => {
        const entries = timeEntries.filter(e => e.task_id === t.id);
        entries.forEach(e => {
            if (e.duration) {
                // Duration is in milliseconds
                totalActualHours += (e.duration / 3600000);
            }
        });
    });

    let html = `
        <div class="dashboard-grid">
            <div class="dash-card">
                <h4>Kemajuan Tugas</h4>
                <div class="value">${completedTasks} / ${totalTasks}</div>
                <progress value="${progress}" max="100" style="margin-top: 0.5rem;"></progress>
            </div>
            <div class="dash-card">
                <h4>Estimasi Kerja</h4>
                <div class="value">${pTasks.reduce((sum, t) => sum + (parseFloat(t.estimate_hours) || 0), 0)} jam</div>
            </div>
            <div class="dash-card">
                <h4>Aktual Terlacak</h4>
                <div class="value">${totalActualHours.toFixed(1)} jam</div>
            </div>
            <div class="dash-card">
                <h4>Dalam Proses</h4>
                <div class="value">${inProgressTasks}</div>
            </div>
        </div>

        <div style="margin-top: 1.5rem; display: grid; grid-template-columns: 1fr; gap: 1.5rem;">
            <article style="border-radius: 16px; margin: 0;">
                <h4 style="margin-top: 0;">Detail Proyek</h4>
                <div class="grid">
                    <div>
                        <strong>Mulai:</strong> ${project.start_date || '-'}
                    </div>
                    <div>
                        <strong>Deadline:</strong> ${project.end_date || '-'}
                    </div>
                    <div>
                        <strong>Budget Anggaran:</strong> Rp ${(project.budget || 0).toLocaleString('id-ID')}
                    </div>
                </div>
                <div style="margin-top: 1rem;">
                    <strong>Deskripsi:</strong>
                    <p class="secondary">${project.description || 'Tidak ada deskripsi.'}</p>
                </div>
            </article>
        </div>
    `;
    container.innerHTML = html;
}

// --- Modul 4: Papan Kanban ---
async function renderKanban(container) {
    if (!currentProjectId) return;
    const tasks = await getAllFromStore('tasks');
    let pTasks = tasks.filter(t => t.project_id === currentProjectId);

    if (searchQuery) {
        pTasks = pTasks.filter(t => t.title.toLowerCase().includes(searchQuery) || (t.description && t.description.toLowerCase().includes(searchQuery)));
    }

    const cols = [
        { id: 'backlog', name: 'Backlog', label: '🗂️' },
        { id: 'todo', name: 'Siap Dikerjakan', label: '🎯' },
        { id: 'in_progress', name: 'Dalam Proses', label: '⚡' },
        { id: 'done', name: 'Selesai', label: '✅' }
    ];

    let html = `<div class="kanban-board-container">`;

    cols.forEach(col => {
        const colTasks = pTasks.filter(t => t.status === col.id).sort((a,b) => (a.position || 0) - (b.position || 0));
        html += `
            <div class="kanban-col" data-col-id="${col.id}" ondragover="allowDrop(event)" ondrop="handleDrop(event, '${col.id}')">
                <div class="kanban-col-header">
                    <span>${col.label} ${col.name}</span>
                    <span class="kanban-col-count">${colTasks.length}</span>
                </div>
                <div class="kanban-cards-wrapper">
        `;

        colTasks.forEach(task => {
            html += `
                <div class="kanban-card" draggable="true" ondragstart="handleDragStart(event, '${task.id}')" onclick="openTaskDetailModal('${task.id}')">
                    <div class="kanban-card-title">${task.title}</div>
                    <div class="kanban-card-meta">
                        <span class="kanban-card-badge badge-${task.type}">${task.type.toUpperCase()}</span>
                        <span class="kanban-card-badge badge-${task.priority}">${task.priority.toUpperCase()}</span>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

window.allowDrop = function(ev) {
    ev.preventDefault();
};

window.handleDragStart = function(ev, taskId) {
    ev.dataTransfer.setData("taskId", taskId);
};

window.handleDrop = async function(ev, targetColId) {
    ev.preventDefault();
    const taskId = ev.dataTransfer.getData("taskId");
    if (!taskId) return;

    const task = await getById('tasks', taskId);
    if (task) {
        task.status = targetColId;
        await putToStore('tasks', task);
        await renderActiveTab();
    }
};

// --- Modul 4.2: Timeline (Gantt-Lite) ---
async function renderTimeline(container) {
    if (!currentProjectId) return;
    const tasks = await getAllFromStore('tasks');
    const pTasks = tasks.filter(t => t.project_id === currentProjectId);

    let html = `
        <h4>Timeline Tugas</h4>
        <p class="secondary">Estimasi durasi tugas diatur secara visual.</p>
        <div class="timeline-grid">
            <div class="timeline-row">
                <div class="timeline-cell-name" style="background: var(--pico-form-element-background-color);">Tugas</div>
                <div class="timeline-cell-bars" style="background: var(--pico-form-element-background-color); height: 35px; border-bottom: 2px solid var(--pico-muted-border-color);">
                    <!-- Day segments mock -->
                </div>
            </div>
    `;

    if (pTasks.length === 0) {
        html += `
            <div class="timeline-row">
                <div class="timeline-cell-name" colspan="2" style="text-align: center;">Belum ada tugas.</div>
            </div>
        `;
    } else {
        pTasks.forEach((t, i) => {
            // Mock placement based on task ID length/numbers to generate nice bars
            const startDay = (t.title.length % 5) + 1;
            const duration = Math.max(2, (t.estimate_hours || 4) / 2);
            const widthPct = (duration / 15) * 100;
            const leftPct = (startDay / 15) * 100;

            html += `
                <div class="timeline-row">
                    <div class="timeline-cell-name">${t.title}</div>
                    <div class="timeline-cell-bars">
                        <div class="timeline-bar" style="left: ${leftPct}%; width: ${widthPct}%; background: ${t.status === 'done' ? '#22c55e' : 'var(--pico-primary)'};">
                            ${t.assignee || 'Belum ditugaskan'}
                        </div>
                    </div>
                </div>
            `;
        });
    }

    html += `</div>`;
    container.innerHTML = html;
}

// --- Modul 3: Work Breakdown Structure (WBS) ---
async function renderWBS(container) {
    if (!currentProjectId) return;
    const tasks = await getAllFromStore('tasks');
    const pTasks = tasks.filter(t => t.project_id === currentProjectId);

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h4>Work Breakdown Structure (WBS)</h4>
        </div>
        <div class="wbs-tree">
    `;

    if (pTasks.length === 0) {
        html += '<div style="text-align: center; padding: 1.5rem; background: var(--pico-card-background-color); border: 1px solid var(--pico-muted-border-color); border-radius: 12px;">Belum ada item tugas WBS.</div>';
    } else {
        pTasks.forEach((t, index) => {
            html += `
                <div class="wbs-row">
                    <div class="wbs-indent">
                        <div class="wbs-indent-block"></div>
                    </div>
                    <span class="wbs-toggle">✓</span>
                    <span class="wbs-title">1.${index + 1} ${t.title}</span>
                    <div class="wbs-meta">
                        <span>SP: <strong>${t.story_points || '-'}</strong></span>
                        <span>Estimasi: <strong>${t.estimate_hours || '-'} jam</strong></span>
                        <span class="meta-badge" style="margin:0;">${t.status.toUpperCase()}</span>
                    </div>
                </div>
            `;
        });
    }

    html += `</div>`;
    container.innerHTML = html;
}

// --- Modul 5: Sprint Dashboard & Planning ---
async function renderSprints(container) {
    if (!currentProjectId) return;
    const sprints = await getAllFromStore('sprints');
    const pSprints = sprints.filter(s => s.project_id === currentProjectId);
    const tasks = await getAllFromStore('tasks');
    const pTasks = tasks.filter(t => t.project_id === currentProjectId);

    let html = '';

    // Render Burn Down Chart
    html += `
        <div class="chart-container">
            <h5 style="margin-top: 0;">Burn Down Chart (Sprint Aktif)</h5>
            <svg class="chart-svg" viewBox="0 0 500 250">
                <!-- Grid Lines -->
                <line x1="40" y1="20" x2="40" y2="220" stroke="#e2e8f0" stroke-width="2"/>
                <line x1="40" y1="220" x2="480" y2="220" stroke="#e2e8f0" stroke-width="2"/>
                
                <!-- Ideal burn down line -->
                <line x1="40" y1="40" x2="480" y2="220" class="chart-line-ideal" />
                <text x="440" y="210" fill="#94a3b8" font-size="10" font-weight="700">Ideal</text>
                
                <!-- Actual burn down line -->
                <polyline points="40,40 120,40 200,90 280,90 360,150 480,220" fill="none" class="chart-line-actual"/>
                <text x="320" y="130" fill="var(--pico-primary)" font-size="10" font-weight="700">Aktual</text>

                <!-- Labels -->
                <text x="35" y="45" fill="#94a3b8" font-size="10" font-weight="700" text-anchor="end">40 SP</text>
                <text x="35" y="130" fill="#94a3b8" font-size="10" font-weight="700" text-anchor="end">20 SP</text>
                <text x="35" y="220" fill="#94a3b8" font-size="10" font-weight="700" text-anchor="end">0</text>
                
                <text x="40" y="235" fill="#94a3b8" font-size="10" font-weight="700">Hari 1</text>
                <text x="260" y="235" fill="#94a3b8" font-size="10" font-weight="700">Hari 7</text>
                <text x="460" y="235" fill="#94a3b8" font-size="10" font-weight="700">Hari 14</text>
            </svg>
        </div>
    `;

    // Sprints list
    html += `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h4>Sprint & Backlog</h4>
            <button class="outline" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; margin:0;" onclick="openNewSprintModal()">+ Buat Sprint Baru</button>
        </div>
    `;

    if (pSprints.length === 0) {
        html += '<div style="text-align: center; padding: 1.5rem; background: var(--pico-card-background-color); border: 1px solid var(--pico-muted-border-color); border-radius: 12px;">Belum ada Sprint aktif. Mulai buat Sprint untuk mengatur backlog.</div>';
    } else {
        pSprints.forEach(s => {
            const sprintTasks = pTasks.filter(t => t.sprint_id === s.id);
            const totalPoints = sprintTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);

            html += `
                <article style="border-radius: 16px; margin-bottom: 1rem; padding: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--pico-muted-border-color); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
                        <div>
                            <h5 style="margin: 0;">${s.name}</h5>
                            <small class="secondary">${s.start_date} s/d ${s.end_date} · <strong>Goal:</strong> ${s.goal || '-'}</small>
                        </div>
                        <div>
                            <span class="meta-badge" style="margin-right: 0.5rem;">Kapasitas: ${s.capacity || 0} SP</span>
                            <span class="meta-badge active">${s.status.toUpperCase()}</span>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            `;

            if (sprintTasks.length === 0) {
                html += '<p style="text-align: center; font-size: 0.9rem;" class="secondary">Sprint kosong. Masukkan tugas dari Backlog.</p>';
            } else {
                sprintTasks.forEach(t => {
                    html += `
                        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--pico-form-element-background-color); padding: 0.4rem 0.75rem; border-radius: 8px; border: 1px solid var(--pico-muted-border-color);">
                            <span style="font-size: 0.9rem; font-weight: 700;">${t.title}</span>
                            <div style="display: flex; gap: 0.5rem; align-items: center;">
                                <span class="meta-badge" style="margin:0; font-size: 0.7rem;">${t.story_points || 0} SP</span>
                                <span class="meta-badge" style="margin:0; font-size: 0.7rem;">${t.status.toUpperCase()}</span>
                            </div>
                        </div>
                    `;
                });
            }

            html += `
                    </div>
                </article>
            `;
        });
    }

    container.innerHTML = html;
}

window.openNewSprintModal = function() {
    let modal = document.getElementById('modal-sprint');
    if (!modal) {
        modal = document.createElement('dialog');
        modal.id = 'modal-sprint';
        modal.innerHTML = `
            <article class="modal-premium" style="max-width: 480px; width: 95%;">
                <div class="modal-header">
                    <h3>Buat Sprint Baru</h3>
                    <button type="button" class="btn-close" onclick="document.getElementById('modal-sprint').close()">✕</button>
                </div>
                <form onsubmit="saveSprint(event)">
                    <div style="margin-bottom: 1rem;">
                        <label for="sprint-name-input">Nama Sprint</label>
                        <input type="text" id="sprint-name-input" placeholder="Sprint 2" required>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label for="sprint-goal-input">Goal Sprint</label>
                        <input type="text" id="sprint-goal-input" placeholder="Selesaikan fitur billing">
                    </div>
                    <div class="grid">
                        <div style="margin-bottom: 1rem;">
                            <label for="sprint-start-input">Tanggal Mulai</label>
                            <input type="date" id="sprint-start-input" required>
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label for="sprint-end-input">Tanggal Selesai</label>
                            <input type="date" id="sprint-end-input" required>
                        </div>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label for="sprint-capacity-input">Target Kapasitas (Story Points)</label>
                        <input type="number" id="sprint-capacity-input" placeholder="40">
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem;">
                        <button type="button" class="btn-gray" onclick="document.getElementById('modal-sprint').close()">Batal</button>
                        <button type="submit" class="btn-navy" style="margin: 0;">Buat Sprint</button>
                    </div>
                </form>
            </article>
        `;
        document.body.appendChild(modal);
    }
    modal.showModal();
};

window.saveSprint = async function(e) {
    e.preventDefault();
    const name = document.getElementById('sprint-name-input').value;
    const goal = document.getElementById('sprint-goal-input').value;
    const start = document.getElementById('sprint-start-input').value;
    const end = document.getElementById('sprint-end-input').value;
    const capacity = parseInt(document.getElementById('sprint-capacity-input').value) || 0;

    const newSprint = {
        id: 'sprint_' + Date.now(),
        project_id: currentProjectId,
        name,
        goal,
        status: 'planning',
        start_date: start,
        end_date: end,
        capacity
    };

    await putToStore('sprints', newSprint);
    document.getElementById('modal-sprint').close();
    await renderActiveTab();
    if (window.TMPT_UI) window.TMPT_UI.toast("Sprint baru berhasil dibuat!", "success");
};

// --- Modul 6: Requirements & Traceability ---
async function renderRequirements(container) {
    if (!currentProjectId) return;
    const requirements = await getAllFromStore('requirements');
    const pReqs = requirements.filter(r => r.project_id === currentProjectId);
    const tasks = await getAllFromStore('tasks');
    const testCases = await getAllFromStore('test_cases');

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h4>Requirement Traceability Matrix</h4>
        </div>
        <figure>
            <table class="trace-table">
                <thead>
                    <tr>
                        <th>Requirement</th>
                        <th>Tugas Terkait</th>
                        <th>Test Case QA</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
    `;

    if (pReqs.length === 0) {
        html += '<tr><td colspan="4" style="text-align: center;">Belum ada data requirement.</td></tr>';
    } else {
        pReqs.forEach(r => {
            const reqTasks = tasks.filter(t => t.project_id === currentProjectId && t.title.toLowerCase().includes(r.title.toLowerCase()));
            const reqTests = testCases.filter(tc => tc.requirement_id === r.id);

            const taskText = reqTasks.length ? reqTasks.map(t => t.title).join(', ') : '—';
            const testText = reqTests.length ? reqTests.map(tc => tc.code).join(', ') : '—';
            const statusLabel = reqTests.length ? '<span class="trace-status passed">✅ Passed</span>' : '<span class="trace-status pending">⚠️ No Coverage</span>';

            html += `
                <tr>
                    <td><strong>[${r.code}]</strong> ${r.title}</td>
                    <td>${taskText}</td>
                    <td>${testText}</td>
                    <td>${statusLabel}</td>
                </tr>
            `;
        });
    }

    html += `
                </tbody>
            </table>
        </figure>
    `;
    container.innerHTML = html;
}

window.openNewRequirementModal = function() {
    let modal = document.getElementById('modal-requirement');
    if (!modal) {
        modal = document.createElement('dialog');
        modal.id = 'modal-requirement';
        modal.innerHTML = `
            <article class="modal-premium" style="max-width: 500px; width: 95%;">
                <div class="modal-header">
                    <h3>Tambah Requirement Baru</h3>
                    <button type="button" class="btn-close" onclick="document.getElementById('modal-requirement').close()">✕</button>
                </div>
                <form onsubmit="saveRequirement(event)">
                    <div style="margin-bottom: 1rem;">
                        <label for="req-code-input">Kode Req (misal: REQ-02)</label>
                        <input type="text" id="req-code-input" placeholder="REQ-02" required>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label for="req-title-input">Nama/Judul Requirement</label>
                        <input type="text" id="req-title-input" required>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label for="req-desc-input">Deskripsi</label>
                        <textarea id="req-desc-input" rows="3"></textarea>
                    </div>
                    <div class="grid">
                        <div style="margin-bottom: 1rem;">
                            <label for="req-type-input">Tipe</label>
                            <select id="req-type-input">
                                <option value="business">Bisnis (BRS)</option>
                                <option value="functional" selected>Fungsional (FRS)</option>
                                <option value="non_functional">Non-Fungsional (NFR)</option>
                            </select>
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label for="req-priority-input">Prioritas</label>
                            <select id="req-priority-input">
                                <option value="low">Rendah</option>
                                <option value="medium" selected>Sedang</option>
                                <option value="high">Tinggi</option>
                                <option value="critical">Kritis</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem;">
                        <button type="button" class="btn-gray" onclick="document.getElementById('modal-requirement').close()">Batal</button>
                        <button type="submit" class="btn-navy" style="margin: 0;">Simpan</button>
                    </div>
                </form>
            </article>
        `;
        document.body.appendChild(modal);
    }
    modal.showModal();
};

window.saveRequirement = async function(e) {
    e.preventDefault();
    const code = document.getElementById('req-code-input').value;
    const title = document.getElementById('req-title-input').value;
    const description = document.getElementById('req-desc-input').value;
    const type = document.getElementById('req-type-input').value;
    const priority = document.getElementById('req-priority-input').value;

    const newReq = {
        id: 'req_' + Date.now(),
        project_id: currentProjectId,
        code,
        title,
        description,
        type,
        status: 'draft',
        priority,
        author: 'Deni Kusuma'
    };

    await putToStore('requirements', newReq);
    document.getElementById('modal-requirement').close();
    await renderActiveTab();
    if (window.TMPT_UI) window.TMPT_UI.toast("Requirement berhasil ditambahkan!", "success");
};

// --- Modul 7: QA & Testing ---
async function renderQA(container) {
    if (!currentProjectId) return;
    const testCases = await getAllFromStore('test_cases');
    const pTests = testCases.filter(tc => tc.project_id === currentProjectId);
    const bugs = await getAllFromStore('bugs');
    const pBugs = bugs.filter(b => b.project_id === currentProjectId);

    let html = `
        <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem;">
            <!-- Test Cases -->
            <article style="border-radius: 16px; margin: 0; padding: 1.25rem;">
                <h5 style="margin-top:0;">Daftar Test Cases</h5>
                <table>
                    <thead>
                        <tr>
                            <th>Kode</th>
                            <th>Judul Skenario</th>
                            <th>Prioritas</th>
                            <th>Tipe</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    if (pTests.length === 0) {
        html += '<tr><td colspan="4" style="text-align: center;">Belum ada Test Case.</td></tr>';
    } else {
        pTests.forEach(tc => {
            html += `
                <tr>
                    <td><strong>${tc.code}</strong></td>
                    <td>${tc.title}</td>
                    <td><span class="meta-badge">${tc.priority.toUpperCase()}</span></td>
                    <td>${tc.type.toUpperCase()}</td>
                </tr>
            `;
        });
    }

    html += `
                    </tbody>
                </table>
            </article>

            <!-- Bug Tracker -->
            <article style="border-radius: 16px; margin: 0; padding: 1.25rem;">
                <h5 style="margin-top:0;">Bug Register</h5>
                <table>
                    <thead>
                        <tr>
                            <th>Bug ID</th>
                            <th>Kutu (Bug)</th>
                            <th>Tingkat Dampak</th>
                            <th>Status</th>
                            <th>Penerima</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    if (pBugs.length === 0) {
        html += '<tr><td colspan="5" style="text-align: center;">Tidak ada kutu/bug terlapor.</td></tr>';
    } else {
        pBugs.forEach((b, i) => {
            html += `
                <tr>
                    <td><strong>BUG-${i + 1}</strong></td>
                    <td>${b.title}</td>
                    <td><span class="meta-badge" style="border-color: #ef4444; color: #dc2626;">${b.severity.toUpperCase()}</span></td>
                    <td><span class="meta-badge active">${b.status.toUpperCase()}</span></td>
                    <td>${b.assignee || 'Belum ditugaskan'}</td>
                </tr>
            `;
        });
    }

    html += `
                    </tbody>
                </table>
            </article>
        </div>
    `;
    container.innerHTML = html;
}

window.openNewQAMenu = function() {
    let modal = document.getElementById('modal-qa-select');
    if (!modal) {
        modal = document.createElement('dialog');
        modal.id = 'modal-qa-select';
        modal.innerHTML = `
            <article style="max-width: 400px; width: 95%; border-radius: 16px;">
                <h3 style="margin-top:0;">Tindakan QA</h3>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    <button class="btn-navy" onclick="openNewTestCaseModal()">Buat Test Case</button>
                    <button class="outline secondary" onclick="openNewBugModal()">Laporkan Bug</button>
                </div>
                <div class="modal-footer" style="justify-content: flex-end; margin-top: 1.5rem;">
                    <button class="btn-gray" onclick="document.getElementById('modal-qa-select').close()">Tutup</button>
                </div>
            </article>
        `;
        document.body.appendChild(modal);
    }
    modal.showModal();
};

window.openNewTestCaseModal = function() {
    document.getElementById('modal-qa-select').close();
    let modal = document.getElementById('modal-test-case');
    if (!modal) {
        modal = document.createElement('dialog');
        modal.id = 'modal-test-case';
        modal.innerHTML = `
            <article class="modal-premium" style="max-width: 500px; width: 95%;">
                <div class="modal-header">
                    <h3>Buat Test Case Baru</h3>
                    <button type="button" class="btn-close" onclick="document.getElementById('modal-test-case').close()">✕</button>
                </div>
                <form onsubmit="saveTestCase(event)">
                    <div style="margin-bottom: 1rem;">
                        <label for="tc-code-input">Kode Test (misal: TC-02)</label>
                        <input type="text" id="tc-code-input" placeholder="TC-02" required>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label for="tc-title-input">Judul Test Case</label>
                        <input type="text" id="tc-title-input" required>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label for="tc-pre-input">Prekondisi</label>
                        <input type="text" id="tc-pre-input">
                    </div>
                    <div class="grid">
                        <div style="margin-bottom: 1rem;">
                            <label for="tc-type-input">Tipe</label>
                            <input type="text" id="tc-type-input" placeholder="manual" required>
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label for="tc-priority-input">Prioritas</label>
                            <select id="tc-priority-input">
                                <option value="low">Rendah</option>
                                <option value="medium" selected>Sedang</option>
                                <option value="high">Tinggi</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem;">
                        <button type="button" class="btn-gray" onclick="document.getElementById('modal-test-case').close()">Batal</button>
                        <button type="submit" class="btn-navy" style="margin: 0;">Simpan</button>
                    </div>
                </form>
            </article>
        `;
        document.body.appendChild(modal);
    }
    modal.showModal();
};

window.saveTestCase = async function(e) {
    e.preventDefault();
    const code = document.getElementById('tc-code-input').value;
    const title = document.getElementById('tc-title-input').value;
    const precondition = document.getElementById('tc-pre-input').value;
    const type = document.getElementById('tc-type-input').value;
    const priority = document.getElementById('tc-priority-input').value;

    const newTC = {
        id: 'tc_' + Date.now(),
        project_id: currentProjectId,
        code,
        title,
        precondition,
        steps: [],
        expected: '',
        type,
        priority
    };

    await putToStore('test_cases', newTC);
    document.getElementById('modal-test-case').close();
    await renderActiveTab();
    if (window.TMPT_UI) window.TMPT_UI.toast("Test case berhasil dibuat!", "success");
};

window.openNewBugModal = function() {
    document.getElementById('modal-qa-select').close();
    let modal = document.getElementById('modal-bug');
    if (!modal) {
        modal = document.createElement('dialog');
        modal.id = 'modal-bug';
        modal.innerHTML = `
            <article class="modal-premium" style="max-width: 500px; width: 95%;">
                <div class="modal-header">
                    <h3>Laporkan Bug Baru</h3>
                    <button type="button" class="btn-close" onclick="document.getElementById('modal-bug').close()">✕</button>
                </div>
                <form onsubmit="saveBug(event)">
                    <div style="margin-bottom: 1rem;">
                        <label for="bug-title-input">Judul Bug</label>
                        <input type="text" id="bug-title-input" placeholder="Popup macet saat klik tombol..." required>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label for="bug-desc-input">Deskripsi & Langkah Reproduksi</label>
                        <textarea id="bug-desc-input" rows="3" required></textarea>
                    </div>
                    <div class="grid">
                        <div style="margin-bottom: 1rem;">
                            <label for="bug-severity-input">Tingkat Dampak</label>
                            <select id="bug-severity-input">
                                <option value="trivial">Sangat Rendah (Trivial)</option>
                                <option value="minor">Rendah (Minor)</option>
                                <option value="major" selected>Tinggi (Major)</option>
                                <option value="critical">Kritis (Critical)</option>
                            </select>
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label for="bug-env-input">Lingkungan (Env)</label>
                            <input type="text" id="bug-env-input" placeholder="staging" value="production">
                        </div>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem;">
                        <button type="button" class="btn-gray" onclick="document.getElementById('modal-bug').close()">Batal</button>
                        <button type="submit" class="btn-navy" style="margin: 0;">Laporkan</button>
                    </div>
                </form>
            </article>
        `;
        document.body.appendChild(modal);
    }
    modal.showModal();
};

window.saveBug = async function(e) {
    e.preventDefault();
    const title = document.getElementById('bug-title-input').value;
    const description = document.getElementById('bug-desc-input').value;
    const severity = document.getElementById('bug-severity-input').value;
    const env = document.getElementById('bug-env-input').value;

    const newBug = {
        id: 'bug_' + Date.now(),
        project_id: currentProjectId,
        title,
        description,
        severity,
        status: 'open',
        assignee: '',
        env
    };

    await putToStore('bugs', newBug);
    document.getElementById('modal-bug').close();
    await renderActiveTab();
    if (window.TMPT_UI) window.TMPT_UI.toast("Bug baru berhasil dilaporkan!", "success");
};

// --- Modul 8: Wiki & Documentation ---
async function renderWiki(container) {
    if (!currentProjectId) return;
    const wikiPages = await getAllFromStore('wiki');
    const pPages = wikiPages.filter(w => w.project_id === currentProjectId);

    let html = `
        <div class="project-layout" style="margin-top: 0; min-height: auto;">
            <!-- Sub Sidebar Wiki -->
            <div style="width: 200px; flex-shrink: 0; border-right: 1px solid var(--pico-muted-border-color); padding-right: 1rem;">
                <h6 style="margin-top:0;">Daftar Halaman</h6>
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
    `;

    if (pPages.length === 0) {
        html += '<small class="secondary">Belum ada halaman wiki.</small>';
    } else {
        pPages.forEach(p => {
            html += `<button class="wiki-page-link" onclick="loadWikiPage('${p.id}')">📄 ${p.title}</button>`;
        });
    }

    html += `
                </div>
            </div>
            <!-- Editor / Viewer Halaman -->
            <div style="flex-grow: 1; padding-left: 1rem;" id="wiki-page-viewport">
                <div class="empty-state-card" style="text-align: center; padding: 2rem;">
                    <h3>Pilih halaman di menu sebelah kiri</h3>
                </div>
            </div>
        </div>
    `;
    container.innerHTML = html;
}

window.loadWikiPage = async function(pageId) {
    const page = await getById('wiki', pageId);
    const vp = document.getElementById('wiki-page-viewport');
    if (!page || !vp) return;

    // Simple manual markdown renderer
    const cleanContent = page.content
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
        .replace(/^\- (.*$)/gim, '<li>$1</li>')
        .replace(/\n/g, '<br>');

    vp.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--pico-muted-border-color); padding-bottom: 0.5rem; margin-bottom: 1rem;">
            <h3 style="margin: 0;">${page.title}</h3>
            <button class="outline" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; margin:0;" onclick="editWikiPage('${page.id}')">Sunting Halaman</button>
        </div>
        <div class="markdown-preview" style="line-height: 1.6;">
            ${cleanContent}
        </div>
    `;
};

window.openNewWikiModal = function() {
    let modal = document.getElementById('modal-wiki');
    if (!modal) {
        modal = document.createElement('dialog');
        modal.id = 'modal-wiki';
        modal.innerHTML = `
            <article class="modal-premium" style="max-width: 600px; width: 95%;">
                <div class="modal-header">
                    <h3>Buat Halaman Wiki Baru</h3>
                    <button type="button" class="btn-close" onclick="document.getElementById('modal-wiki').close()">✕</button>
                </div>
                <form onsubmit="saveWikiPage(event)">
                    <input type="hidden" id="wiki-page-id">
                    <div style="margin-bottom: 1rem;">
                        <label for="wiki-title-input">Judul Halaman</label>
                        <input type="text" id="wiki-title-input" required>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label for="wiki-content-input">Isi Halaman (Markdown)</label>
                        <textarea id="wiki-content-input" rows="10" placeholder="# Judul Halaman..."></textarea>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem;">
                        <button type="button" class="btn-gray" onclick="document.getElementById('modal-wiki').close()">Batal</button>
                        <button type="submit" class="btn-navy" style="margin: 0;">Simpan Halaman</button>
                    </div>
                </form>
            </article>
        `;
        document.body.appendChild(modal);
    }
    document.getElementById('wiki-page-id').value = '';
    document.getElementById('wiki-title-input').value = '';
    document.getElementById('wiki-content-input').value = '';
    modal.showModal();
};

window.editWikiPage = async function(pageId) {
    const page = await getById('wiki', pageId);
    if (!page) return;

    window.openNewWikiModal();
    document.getElementById('wiki-page-id').value = page.id;
    document.getElementById('wiki-title-input').value = page.title;
    document.getElementById('wiki-content-input').value = page.content;
};

window.saveWikiPage = async function(e) {
    e.preventDefault();
    const id = document.getElementById('wiki-page-id').value || 'wiki_' + Date.now();
    const title = document.getElementById('wiki-title-input').value;
    const content = document.getElementById('wiki-content-input').value;

    const pageVal = {
        id,
        project_id: currentProjectId,
        parent_id: '',
        title,
        slug: title.toLowerCase().replace(/ /g, '-'),
        content
    };

    await putToStore('wiki', pageVal);
    document.getElementById('modal-wiki').close();
    await renderActiveTab();
    if (window.TMPT_UI) window.TMPT_UI.toast("Halaman wiki berhasil disimpan!", "success");
    loadWikiPage(id);
};

// --- Modul 9: Resources & Tim ---
async function renderResources(container) {
    const allMembers = await getAllFromStore('members');
    const tasks = await getAllFromStore('tasks');

    // Filter members to only show global members OR members assigned specifically to this project
    const members = allMembers.filter(m => !m.project_id || m.project_id === currentProjectId);

    let html = `
        <div style="margin-bottom: 1.5rem;">
            <h5>Profil Anggota Tim & Workload</h5>
            <p class="secondary">Melacak kapasitas kerja aktual berbanding total beban kerja tugas.</p>
        </div>
        <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem;">
    `;

    members.forEach(m => {
        const memberTasks = tasks.filter(t => t.assignee === m.name && t.status !== 'done' && t.project_id === currentProjectId);
        const totalEstimated = memberTasks.reduce((sum, t) => sum + (parseFloat(t.estimate_hours) || 0), 0);
        const workloadPct = Math.min(100, Math.round((totalEstimated / (m.capacity || 40)) * 100));

        html += `
            <article style="border-radius: 12px; margin: 0; padding: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div>
                        <strong style="font-size: 1rem;">${m.name}</strong>
                        <div class="secondary" style="font-size: 0.8rem;">${m.role} · Kapasitas: ${m.capacity || 40} jam/minggu</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="meta-badge ${totalEstimated > (m.capacity || 40) ? 'critical' : 'active'}" style="margin:0;">
                            ${totalEstimated > (m.capacity || 40) ? 'OVERALLOCATED' : 'NORMAL'}
                        </span>
                        <button class="outline" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; margin: 0; display: inline-block; width: auto;" onclick="openEditMemberModal('${m.id}')">Sunting</button>
                        <button class="outline" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; margin: 0; border-color: #ef4444; color: #ef4444; display: inline-block; width: auto;" onclick="deleteMember('${m.id}')">Hapus</button>
                    </div>
                </div>
                <div>
                    <progress value="${workloadPct}" max="100" style="margin-bottom: 0.25rem;"></progress>
                    <small class="secondary">Beban tugas terpakai: <strong>${totalEstimated} jam</strong> dari total ${m.capacity || 40} jam kapasitas.</small>
                </div>
            </article>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

window.openNewMemberModal = function() {
    let modal = document.getElementById('modal-member');
    if (!modal) {
        modal = document.createElement('dialog');
        modal.id = 'modal-member';
        modal.innerHTML = `
            <article class="modal-premium" style="max-width: 450px; width: 95%;">
                <div class="modal-header">
                    <h3 id="modal-member-title">Tambah Anggota Tim Baru</h3>
                    <button type="button" class="btn-close" onclick="document.getElementById('modal-member').close()">✕</button>
                </div>
                <form onsubmit="saveMember(event)">
                    <input type="hidden" id="member-id-input">
                    <div style="margin-bottom: 1rem;">
                        <label for="member-name-input">Nama Lengkap</label>
                        <input type="text" id="member-name-input" required>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label for="member-role-input">Role Pekerjaan</label>
                        <input type="text" id="member-role-input" placeholder="Developer Frontend" required>
                    </div>
                    <div class="grid">
                        <div style="margin-bottom: 1rem;">
                            <label for="member-email-input">Alamat Email</label>
                            <input type="email" id="member-email-input" placeholder="nama@domain.com">
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label for="member-capacity-input">Kapasitas (Jam/Minggu)</label>
                            <input type="number" id="member-capacity-input" value="40" required>
                        </div>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem;">
                        <button type="button" class="btn-gray" onclick="document.getElementById('modal-member').close()">Batal</button>
                        <button type="submit" class="btn-navy" style="margin: 0;">Simpan</button>
                    </div>
                </form>
            </article>
        `;
        document.body.appendChild(modal);
    }
    
    // Reset inputs
    document.getElementById('member-id-input').value = '';
    document.getElementById('member-name-input').value = '';
    document.getElementById('member-role-input').value = '';
    document.getElementById('member-email-input').value = '';
    document.getElementById('member-capacity-input').value = '40';
    document.getElementById('modal-member-title').textContent = "Tambah Anggota Tim Baru";
    
    modal.showModal();
};

window.openEditMemberModal = async function(id) {
    const member = await getById('members', id);
    if (!member) return;

    window.openNewMemberModal();
    
    document.getElementById('member-id-input').value = member.id;
    document.getElementById('member-name-input').value = member.name;
    document.getElementById('member-role-input').value = member.role;
    document.getElementById('member-email-input').value = member.email || '';
    document.getElementById('member-capacity-input').value = member.capacity || 40;
    document.getElementById('modal-member-title').textContent = "Sunting Anggota Tim";
};

window.deleteMember = async function(id) {
    const member = await getById('members', id);
    if (!member) return;

    const confirmed = await window.TMPT_UI.confirm(`Apakah Anda yakin ingin menghapus anggota tim "${member.name}" secara permanen?`);
    if (!confirmed) return;

    await deleteFromStore('members', id);
    await renderActiveTab();
    if (window.TMPT_UI) window.TMPT_UI.toast(`Anggota tim "${member.name}" berhasil dihapus.`, "info");
};

window.saveMember = async function(e) {
    e.preventDefault();
    const id = document.getElementById('member-id-input').value || 'mem_' + Date.now();
    const name = document.getElementById('member-name-input').value;
    const role = document.getElementById('member-role-input').value;
    const email = document.getElementById('member-email-input').value;
    const capacity = parseInt(document.getElementById('member-capacity-input').value) || 40;

    // Check if editing existing member to preserve its project_id, otherwise link it to current project
    const existing = document.getElementById('member-id-input').value ? await getById('members', id) : null;
    const project_id = existing ? existing.project_id : currentProjectId;

    const newMem = {
        id,
        project_id,
        name,
        role,
        email,
        capacity
    };

    await putToStore('members', newMem);
    document.getElementById('modal-member').close();
    await renderActiveTab();
    if (window.TMPT_UI) window.TMPT_UI.toast("Anggota tim berhasil disimpan!", "success");
};

// --- Modul 11: Releases ---
async function renderReleases(container) {
    if (!currentProjectId) return;
    const releases = await getAllFromStore('releases');
    const pReleases = releases.filter(r => r.project_id === currentProjectId);

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h4>Release Register</h4>
            <button class="outline" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; margin:0;" onclick="openNewReleaseModal()">+ Tambah Rilis Baru</button>
        </div>
    `;

    if (pReleases.length === 0) {
        html += '<div style="text-align: center; padding: 1.5rem; background: var(--pico-card-background-color); border: 1px solid var(--pico-muted-border-color); border-radius: 12px;">Belum ada rilis terdaftar.</div>';
    } else {
        pReleases.forEach(r => {
            html += `
                <article style="border-radius: 16px; margin-bottom: 1rem; padding: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--pico-muted-border-color); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
                        <div>
                            <h5 style="margin: 0;">${r.version} — ${r.name || 'Summer Update'}</h5>
                            <small class="secondary">Tanggal Rilis: ${r.release_date || '-'}</small>
                        </div>
                        <span class="meta-badge active">${r.status.toUpperCase()}</span>
                    </div>
                    <div style="font-size: 0.9rem;">
                        <strong>Catatan Rilis (Release Notes):</strong>
                        <p class="secondary" style="white-space: pre-line; background: var(--pico-form-element-background-color); padding: 0.5rem; border-radius: 8px; margin-top:0.25rem;">${r.release_notes || 'Tidak ada catatan rilis.'}</p>
                    </div>
                </article>
            `;
        });
    }

    container.innerHTML = html;
}

window.openNewReleaseModal = function() {
    let modal = document.getElementById('modal-release');
    if (!modal) {
        modal = document.createElement('dialog');
        modal.id = 'modal-release';
        modal.innerHTML = `
            <article class="modal-premium" style="max-width: 500px; width: 95%;">
                <div class="modal-header">
                    <h3>Tambah Rilis Baru</h3>
                    <button type="button" class="btn-close" onclick="document.getElementById('modal-release').close()">✕</button>
                </div>
                <form onsubmit="saveRelease(event)">
                    <div class="grid">
                        <div style="margin-bottom: 1rem;">
                            <label for="rel-ver-input">Versi (misal: v1.0.0)</label>
                            <input type="text" id="rel-ver-input" placeholder="v1.0.0" required>
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label for="rel-name-input">Nama Rilis</label>
                            <input type="text" id="rel-name-input" placeholder="Summer Release">
                        </div>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label for="rel-date-input">Tanggal Rilis</label>
                        <input type="date" id="rel-date-input" required>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label for="rel-notes-input">Catatan Rilis (Markdown)</label>
                        <textarea id="rel-notes-input" rows="4" placeholder="Detail catatan rilis..."></textarea>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem;">
                        <button type="button" class="btn-gray" onclick="document.getElementById('modal-release').close()">Batal</button>
                        <button type="submit" class="btn-navy" style="margin: 0;">Simpan</button>
                    </div>
                </form>
            </article>
        `;
        document.body.appendChild(modal);
    }
    modal.showModal();
};

window.saveRelease = async function(e) {
    e.preventDefault();
    const version = document.getElementById('rel-ver-input').value;
    const name = document.getElementById('rel-name-input').value;
    const release_date = document.getElementById('rel-date-input').value;
    const release_notes = document.getElementById('rel-notes-input').value;

    const newRel = {
        id: 'rel_' + Date.now(),
        project_id: currentProjectId,
        version,
        name,
        status: 'released',
        release_date,
        release_notes
    };

    await putToStore('releases', newRel);
    document.getElementById('modal-release').close();
    await renderActiveTab();
    if (window.TMPT_UI) window.TMPT_UI.toast("Rilis baru berhasil dipublikasikan!", "success");
};

// --- Modul Extra: Risks, Meetings, Decisions ---
async function renderExtra(container) {
    if (!currentProjectId) return;
    const risks = await getAllFromStore('risks');
    const pRisks = risks.filter(r => r.project_id === currentProjectId);
    const meetings = await getAllFromStore('meetings');
    const pMeetings = meetings.filter(m => m.project_id === currentProjectId);

    let html = `
        <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem;">
            <!-- Risk Register -->
            <article style="border-radius: 16px; margin: 0; padding: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                    <h5 style="margin:0;">Risk Register</h5>
                    <button class="outline" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; margin:0;" onclick="openNewRiskModal()">+ Tambah Risiko</button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Kode</th>
                            <th>Risiko</th>
                            <th>Skor Risiko</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    if (pRisks.length === 0) {
        html += '<tr><td colspan="4" style="text-align: center;">Tidak ada risiko tercatat.</td></tr>';
    } else {
        pRisks.forEach(r => {
            const score = parseInt(r.probability) * parseInt(r.impact);
            let riskLevel = 'low';
            if (score >= 12) riskLevel = 'critical';
            else if (score >= 6) riskLevel = 'high';
            else if (score >= 3) riskLevel = 'medium';

            html += `
                <tr>
                    <td><strong>${r.code}</strong></td>
                    <td>${r.title}<br><small class="secondary">${r.mitigation}</small></td>
                    <td><span class="meta-badge ${riskLevel}">Skor: ${score} (${riskLevel.toUpperCase()})</span></td>
                    <td><span class="meta-badge active">${r.status.toUpperCase()}</span></td>
                </tr>
            `;
        });
    }

    html += `
                    </tbody>
                </table>
            </article>

            <!-- MoM Meetings -->
            <article style="border-radius: 16px; margin: 0; padding: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                    <h5 style="margin:0;">Minutes of Meetings (MoM)</h5>
                    <button class="outline" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; margin:0;" onclick="openNewMeetingModal()">+ Tambah MoM</button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Rapat / Agenda</th>
                            <th>Tanggal</th>
                            <th>Durasi</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    if (pMeetings.length === 0) {
        html += '<tr><td colspan="3" style="text-align: center;">Belum ada notulen rapat tercatat.</td></tr>';
    } else {
        pMeetings.forEach(m => {
            html += `
                <tr>
                    <td><strong>${m.title}</strong><br><small class="secondary">${m.agenda}</small></td>
                    <td>${new Date(m.date).toLocaleDateString('id-ID')}</td>
                    <td>${m.duration} Menit</td>
                </tr>
            `;
        });
    }

    html += `
                    </tbody>
                </table>
            </article>
        </div>
    `;
    container.innerHTML = html;
}

window.openNewRiskModal = function() {
    let modal = document.getElementById('modal-risk');
    if (!modal) {
        modal = document.createElement('dialog');
        modal.id = 'modal-risk';
        modal.innerHTML = `
            <article class="modal-premium" style="max-width: 500px; width: 95%;">
                <div class="modal-header">
                    <h3>Tambah Risiko Baru</h3>
                    <button type="button" class="btn-close" onclick="document.getElementById('modal-risk').close()">✕</button>
                </div>
                <form onsubmit="saveRisk(event)">
                    <div style="margin-bottom: 1rem;">
                        <label for="risk-code-input">Kode Risiko (misal: RISK-01)</label>
                        <input type="text" id="risk-code-input" placeholder="RISK-01" required>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label for="risk-title-input">Definisi Risiko</label>
                        <input type="text" id="risk-title-input" required>
                    </div>
                    <div class="grid">
                        <div style="margin-bottom: 1rem;">
                            <label for="risk-prob-input">Probabilitas (1-4)</label>
                            <select id="risk-prob-input">
                                <option value="1">1 (Rendah)</option>
                                <option value="2">2 (Sedang)</option>
                                <option value="3">3 (Tinggi)</option>
                                <option value="4">4 (Sangat Tinggi)</option>
                            </select>
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label for="risk-impact-input">Dampak (1-4)</label>
                            <select id="risk-impact-input">
                                <option value="1">1 (Rendah)</option>
                                <option value="2">2 (Sedang)</option>
                                <option value="3">3 (Tinggi)</option>
                                <option value="4">4 (Sangat Tinggi)</option>
                            </select>
                        </div>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label for="risk-mit-input">Rencana Mitigasi</label>
                        <textarea id="risk-mit-input" rows="3" required></textarea>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem;">
                        <button type="button" class="btn-gray" onclick="document.getElementById('modal-risk').close()">Batal</button>
                        <button type="submit" class="btn-navy" style="margin: 0;">Simpan</button>
                    </div>
                </form>
            </article>
        `;
        document.body.appendChild(modal);
    }
    modal.showModal();
};

window.saveRisk = async function(e) {
    e.preventDefault();
    const code = document.getElementById('risk-code-input').value;
    const title = document.getElementById('risk-title-input').value;
    const probability = parseInt(document.getElementById('risk-prob-input').value);
    const impact = parseInt(document.getElementById('risk-impact-input').value);
    const mitigation = document.getElementById('risk-mit-input').value;

    const newRisk = {
        id: 'risk_' + Date.now(),
        project_id: currentProjectId,
        code,
        title,
        description: '',
        probability,
        impact,
        mitigation,
        status: 'open'
    };

    await putToStore('risks', newRisk);
    document.getElementById('modal-risk').close();
    await renderActiveTab();
    if (window.TMPT_UI) window.TMPT_UI.toast("Risiko berhasil ditambahkan ke daftar!", "success");
};

window.openNewMeetingModal = function() {
    let modal = document.getElementById('modal-meeting');
    if (!modal) {
        modal = document.createElement('dialog');
        modal.id = 'modal-meeting';
        modal.innerHTML = `
            <article class="modal-premium" style="max-width: 500px; width: 95%;">
                <div class="modal-header">
                    <h3>Tambah Notulen Rapat (MoM)</h3>
                    <button type="button" class="btn-close" onclick="document.getElementById('modal-meeting').close()">✕</button>
                </div>
                <form onsubmit="saveMeeting(event)">
                    <div style="margin-bottom: 1rem;">
                        <label for="meet-title-input">Nama Rapat</label>
                        <input type="text" id="meet-title-input" placeholder="Weekly Sync" required>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label for="meet-agenda-input">Agenda Utama</label>
                        <input type="text" id="meet-agenda-input" required>
                    </div>
                    <div class="grid">
                        <div style="margin-bottom: 1rem;">
                            <label for="meet-date-input">Tanggal</label>
                            <input type="datetime-local" id="meet-date-input" required>
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label for="meet-dur-input">Durasi (Menit)</label>
                            <input type="number" id="meet-dur-input" placeholder="30" required>
                        </div>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem;">
                        <button type="button" class="btn-gray" onclick="document.getElementById('modal-meeting').close()">Batal</button>
                        <button type="submit" class="btn-navy" style="margin: 0;">Simpan</button>
                    </div>
                </form>
            </article>
        `;
        document.body.appendChild(modal);
    }
    modal.showModal();
};

window.saveMeeting = async function(e) {
    e.preventDefault();
    const title = document.getElementById('meet-title-input').value;
    const agenda = document.getElementById('meet-agenda-input').value;
    const date = document.getElementById('meet-date-input').value;
    const duration = parseInt(document.getElementById('meet-dur-input').value);

    const newMeet = {
        id: 'meet_' + Date.now(),
        project_id: currentProjectId,
        title,
        agenda,
        minutes: '',
        date,
        duration,
        attendees: []
    };

    await putToStore('meetings', newMeet);
    document.getElementById('modal-meeting').close();
    await renderActiveTab();
    if (window.TMPT_UI) window.TMPT_UI.toast("Notulen rapat berhasil disimpan!", "success");
};

// --- Time Tracker Widget Logic ---
window.toggleTracker = async function() {
    const startBtn = document.getElementById('btn-tracker-start');
    const stopBtn = document.getElementById('btn-tracker-stop');
    const taskSelector = document.getElementById('tracker-task-selector');

    if (!activeTrackerTaskId) {
        // Start tracker
        if (!taskSelector.value) {
            if (window.TMPT_UI) window.TMPT_UI.toast("Silakan pilih tugas terlebih dahulu.", "warning");
            return;
        }
        activeTrackerTaskId = taskSelector.value;
        activeTrackerStartTime = new Date();
        startBtn.textContent = "Berjalan...";
        startBtn.disabled = true;
        stopBtn.disabled = false;
        taskSelector.disabled = true;

        timerSeconds = 0;
        timerInterval = setInterval(() => {
            timerSeconds++;
            const hrs = String(Math.floor(timerSeconds / 3600)).padStart(2, '0');
            const mins = String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, '0');
            const secs = String(timerSeconds % 60).padStart(2, '0');
            document.getElementById('tracker-timer').textContent = `${hrs}:${mins}:${secs}`;
        }, 1000);
    }
};

window.stopTracker = async function() {
    const startBtn = document.getElementById('btn-tracker-start');
    const stopBtn = document.getElementById('btn-tracker-stop');
    const taskSelector = document.getElementById('tracker-task-selector');

    clearInterval(timerInterval);
    const endTime = new Date();
    const durationMs = endTime - activeTrackerStartTime;

    const newEntry = {
        id: 'time_' + Date.now(),
        task_id: activeTrackerTaskId,
        user_id: 'm4', // Mock as logged in PM
        started_at: activeTrackerStartTime.toISOString(),
        ended_at: endTime.toISOString(),
        duration: durationMs,
        description: 'Pencatatan otomatis via TMPT Project tracker'
    };

    await putToStore('time_entries', newEntry);

    // Reset UI
    activeTrackerTaskId = null;
    activeTrackerStartTime = null;
    startBtn.textContent = "Mulai";
    startBtn.disabled = false;
    stopBtn.disabled = true;
    taskSelector.disabled = false;
    document.getElementById('tracker-timer').textContent = "00:00:00";

    await renderActiveTab();
    if (window.TMPT_UI) window.TMPT_UI.toast("Pencatatan waktu berhasil disimpan!", "success");
};

async function loadTrackerTasks() {
    const taskSelector = document.getElementById('tracker-task-selector');
    if (!taskSelector) return;

    const tasks = await getAllFromStore('tasks');
    const pTasks = currentProjectId ? tasks.filter(t => t.project_id === currentProjectId) : tasks;

    let html = '<option value="">-- Pilih Tugas --</option>';
    pTasks.forEach(t => {
        html += `<option value="${t.id}">[${t.number}] ${t.title}</option>`;
    });
    taskSelector.innerHTML = html;
}

// --- Backup & Export ---
window.openExportModal = function() {
    document.getElementById('modal-export').showModal();
};

window.exportProjectData = async function() {
    const data = {};
    for (const store of STORES) {
        data[store] = await getAllFromStore(store);
    }

    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_project_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

window.importProjectData = async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        const tx = db.transaction(STORES, 'readwrite');
        for (const store of STORES) {
            if (data[store] && Array.isArray(data[store])) {
                const s = tx.objectStore(store);
                data[store].forEach(item => s.put(item));
            }
        }

        document.getElementById('modal-export').close();
        await loadProjectSelector();
        await renderActiveTab();
        if (window.TMPT_UI) window.TMPT_UI.toast("Data proyek berhasil diimpor!", "success");
    } catch (err) {
        console.error("Gagal mengimpor data proyek:", err);
        alert("Berkas JSON tidak valid.");
    }
};

// --- Task & Project Modal Helpers ---
window.openNewProjectModal = async function() {
    const members = await getAllFromStore('members');
    const select = document.getElementById('project-pm-input');
    let html = '';
    members.forEach(m => {
        html += `<option value="${m.name}">${m.name}</option>`;
    });
    select.innerHTML = html;

    document.getElementById('modal-project').showModal();
};

window.saveNewProject = async function(e) {
    e.preventDefault();
    const name = document.getElementById('project-name-input').value;
    const key = document.getElementById('project-key-input').value.toUpperCase();
    const priority = document.getElementById('project-priority-input').value;
    const budget = parseFloat(document.getElementById('project-budget-input').value) || 0;
    const pm = document.getElementById('project-pm-input').value;

    const newProj = {
        id: 'proj_' + Date.now(),
        key,
        name,
        description: `Proyek baru ${name}`,
        status: 'planning',
        priority,
        budget,
        pm,
        progress: 0,
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date(Date.now() + 90 * 24 * 3600000).toISOString().slice(0, 10)
    };

    await putToStore('projects', newProj);
    broadcastProjectChange();
    document.getElementById('modal-project').close();
    await loadProjectSelector();
    if (window.TMPT_UI) window.TMPT_UI.toast("Proyek baru berhasil dibuat!", "success");
};

window.openNewTaskModal = async function() {
    const allMembers = await getAllFromStore('members');
    const members = allMembers.filter(m => !m.project_id || m.project_id === currentProjectId);
    const assigneeSelect = document.getElementById('task-assignee-input');
    let html = '<option value="">Belum Ditugaskan</option>';
    members.forEach(m => {
        html += `<option value="${m.name}">${m.name}</option>`;
    });
    assigneeSelect.innerHTML = html;

    const sprints = await getAllFromStore('sprints');
    const pSprints = sprints.filter(s => s.project_id === currentProjectId);
    const sprintSelect = document.getElementById('task-sprint-input');
    let sprintHtml = '<option value="">Backlog Utama</option>';
    pSprints.forEach(s => {
        sprintHtml += `<option value="${s.id}">${s.name}</option>`;
    });
    sprintSelect.innerHTML = sprintHtml;

    // Reset fields
    document.getElementById('task-id').value = '';
    document.getElementById('task-title-input').value = '';
    document.getElementById('task-type-input').value = 'task';
    document.getElementById('task-priority-input').value = 'medium';
    document.getElementById('task-estimate-input').value = '';
    document.getElementById('task-points-input').value = '';
    document.getElementById('task-desc-input').value = '';
    document.getElementById('btn-del-task').style.display = 'none';

    document.getElementById('modal-task-title').textContent = "Tambah Tugas Baru";
    document.getElementById('modal-task').showModal();
};

window.saveTask = async function(e) {
    e.preventDefault();
    if (!currentProjectId) return;

    const id = document.getElementById('task-id').value || 'task_' + Date.now();
    const title = document.getElementById('task-title-input').value;
    const type = document.getElementById('task-type-input').value;
    const priority = document.getElementById('task-priority-input').value;
    const assignee = document.getElementById('task-assignee-input').value;
    const sprint_id = document.getElementById('task-sprint-input').value;
    const estimate = parseFloat(document.getElementById('task-estimate-input').value) || 0;
    const points = parseInt(document.getElementById('task-points-input').value) || 0;
    const description = document.getElementById('task-desc-input').value;

    const tasks = await getAllFromStore('tasks');
    const pTasks = tasks.filter(t => t.project_id === currentProjectId);
    const nextNumber = pTasks.length ? Math.max(...pTasks.map(t => t.number || 0)) + 1 : 1;

    const existingTask = document.getElementById('task-id').value ? await getById('tasks', id) : null;

    const taskVal = {
        id,
        project_id: currentProjectId,
        sprint_id,
        parent_id: '',
        number: existingTask ? existingTask.number : nextNumber,
        title,
        description,
        type,
        status: existingTask ? existingTask.status : 'todo',
        priority,
        assignee,
        estimate_hours: estimate,
        actual_hours: existingTask ? existingTask.actual_hours : 0,
        story_points: points,
        position: existingTask ? existingTask.position : pTasks.length
    };

    await putToStore('tasks', taskVal);
    document.getElementById('modal-task').close();
    await renderActiveTab();
    if (window.TMPT_UI) window.TMPT_UI.toast("Tugas berhasil disimpan!", "success");
};

window.openTaskDetailModal = async function(taskId) {
    const task = await getById('tasks', taskId);
    if (!task) return;

    const project = await getById('projects', task.project_id);

    document.getElementById('detail-task-key').textContent = `${project.key}-${task.number}`;
    document.getElementById('detail-task-title').textContent = task.title;
    document.getElementById('detail-task-desc').textContent = task.description || 'Tidak ada deskripsi.';
    document.getElementById('detail-task-status').textContent = task.status.toUpperCase();
    document.getElementById('detail-task-type').textContent = task.type.toUpperCase();
    document.getElementById('detail-task-priority').textContent = task.priority.toUpperCase();
    document.getElementById('detail-task-assignee').textContent = task.assignee || 'Belum ditugaskan';
    
    let sprintName = 'Backlog Utama';
    if (task.sprint_id) {
        const sprint = await getById('sprints', task.sprint_id);
        if (sprint) sprintName = sprint.name;
    }
    document.getElementById('detail-task-sprint').textContent = sprintName;
    document.getElementById('detail-task-points').textContent = task.story_points || '-';
    document.getElementById('detail-task-estimate').textContent = `${task.estimate_hours || 0} jam`;

    // Time entries logic
    const timeEntries = await getAllFromStore('time_entries');
    const taskEntries = timeEntries.filter(e => e.task_id === taskId);
    
    let totalMs = 0;
    let entriesHtml = '<table style="width:100%; font-size:0.8rem;"><tbody>';
    if (taskEntries.length === 0) {
        entriesHtml += '<tr><td colspan="3">Belum ada catatan waktu.</td></tr>';
    } else {
        taskEntries.forEach(e => {
            totalMs += (e.duration || 0);
            const durationHrs = (e.duration / 3600000).toFixed(2);
            entriesHtml += `
                <tr>
                    <td>${new Date(e.started_at).toLocaleDateString('id-ID')}</td>
                    <td>${e.description}</td>
                    <td><strong>${durationHrs} jam</strong></td>
                </tr>
            `;
        });
    }
    entriesHtml += '</tbody></table>';
    
    document.getElementById('detail-task-actual').textContent = `${(totalMs / 3600000).toFixed(2)} jam`;
    document.getElementById('detail-task-time-log').innerHTML = entriesHtml;

    // Cache current task for editing
    window.currentDetailTaskId = taskId;

    document.getElementById('modal-task-detail').showModal();
};

window.triggerEditTaskFromDetail = async function() {
    document.getElementById('modal-task-detail').close();
    const task = await getById('tasks', window.currentDetailTaskId);
    if (!task) return;

    await openNewTaskModal();

    document.getElementById('task-id').value = task.id;
    document.getElementById('task-title-input').value = task.title;
    document.getElementById('task-type-input').value = task.type;
    document.getElementById('task-priority-input').value = task.priority;
    document.getElementById('task-assignee-input').value = task.assignee;
    document.getElementById('task-sprint-input').value = task.sprint_id;
    document.getElementById('task-estimate-input').value = task.estimate_hours;
    document.getElementById('task-points-input').value = task.story_points;
    document.getElementById('task-desc-input').value = task.description;
    
    document.getElementById('btn-del-task').style.display = 'block';
    document.getElementById('modal-task-title').textContent = "Ubah Rincian Tugas";
};

window.deleteTask = async function() {
    const id = document.getElementById('task-id').value;
    if (!id) return;

    const confirmed = await window.TMPT_UI.confirm("Apakah Anda yakin ingin menghapus tugas ini secara permanen?");
    if (confirmed) {
        await deleteFromStore('tasks', id);
        document.getElementById('modal-task').close();
        await renderActiveTab();
        if (window.TMPT_UI) window.TMPT_UI.toast("Tugas berhasil dihapus.", "info");
    }
};
