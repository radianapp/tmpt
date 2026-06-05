/**
 * TMPT Dashboard Script
 * Manages apps registry loading, filtering, search, and sidebar actions.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initial State Variables
    let appsData = null;
    const urlParams = new URLSearchParams(window.location.search);
    let activeFilter = urlParams.get('filter') || 'all'; // 'all', 'kerja', 'dev', 'tools'
    let searchQuery = '';

    const dashboardContent = document.getElementById('dashboard-content');
    const searchInput = document.getElementById('dashboard-search');
    const sidebar = document.getElementById('dashboard-sidebar');
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    // Sesuaikan status aktif menu sidebar berdasarkan filter awal
    const filterLinksInit = document.querySelectorAll('.sidebar-link[data-filter]');
    filterLinksInit.forEach(link => {
        if (link.getAttribute('data-filter') === activeFilter) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // 2. Fetch Apps Registry
    try {
        const response = await fetch('/shared/apps.json');
        appsData = await response.json();
    } catch (e) {
        console.error("Gagal memuat konfigurasi apps.json", e);
        // Fallback default
        appsData = {
            "kerja": [
                { "name": "Berkas", "url": "/app/kerja/berkas/", "icon": "📁", "desc": "Pusat Semua File TMPT", "isEnabled": true },
                { "name": "Brankas", "url": "/app/kerja/vault/", "icon": "🔐", "desc": "Simpan Kredensial dengan Aman", "isEnabled": true }
            ],
            "dev": [
                { "name": "Code", "url": "/app/dev/code/", "icon": "💻", "desc": "Editor Kode Ringan & Cepat", "isEnabled": true }
            ],
            "tools": []
        };
    }

    // Color gradient mapping for app icons (premium style matching mockup)
    const iconColors = {
        "Berkas": "linear-gradient(135deg, #fef08a 0%, #fde047 100%)", // folder yellow
        "Brankas": "linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)", // safe silver
        "Catatan": "linear-gradient(135deg, #fef9c3 0%, #fef08a 100%)", // note paper
        "Forms": "linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)", // blue form
        "Hitung": "linear-gradient(135deg, #dcfce7 0%, #86efac 100%)", // green sheet
        "Kalender": "linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)", // pink calendar
        "Code": "linear-gradient(135deg, #eff6ff 0%, #bfdbfe 100%)", // code blue
        "Diagram": "linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)", // orange chart
        "Favicon Generator": "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)", // star blue
        "JSON": "linear-gradient(135deg, #fee2e2 0%, #fca5a5 100%)", // red json doc
        "Kalkulator": "linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%)",
        "Konversi": "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
        "Notes Encryptor": "linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)",
        "Password Checker": "linear-gradient(135deg, #eff6ff 0%, #bfdbfe 100%)",
        "Password Generator": "linear-gradient(135deg, #fef9c3 0%, #fef08a 100%)",
        "QR Tools": "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)",
        "Base64 Tools": "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)"
    };

    // 3. Render Dashboard Grid Function
    function renderDashboard() {
        if (!dashboardContent || !appsData) return;

        let html = '';
        let totalRendered = 0;
        const favorites = JSON.parse(localStorage.getItem('tmpt_favorite_apps') || '[]');

        // Onboarding banner backup warning
        const onboardingShown = localStorage.getItem('tmpt_onboarding_backup_shown') === 'true';
        if (!onboardingShown) {
            html += `
                <article id="backup-onboarding-banner" class="category-section" style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(245, 158, 11, 0.05) 100%); border-radius: 20px; padding: 1.5rem; margin-bottom: 2rem; border: 1px solid rgba(239, 68, 68, 0.2); position: relative;">
                    <button onclick="document.getElementById('backup-onboarding-banner').remove(); localStorage.setItem('tmpt_onboarding_backup_shown', 'true');" style="position: absolute; top: 1rem; right: 1rem; background: transparent; border: none; font-size: 1.25rem; cursor: pointer; padding: 0; line-height: 1; width: auto; height: auto; color: var(--pico-muted-color);" title="Tutup Onboarding">&times;</button>
                    <div style="display: flex; gap: 1rem; align-items: flex-start;">
                        <span style="font-size: 2rem; line-height: 1;">💡</span>
                        <div>
                            <h3 style="margin-top: 0; margin-bottom: 0.5rem; font-size: 1.15rem; font-weight: 800; color: var(--pico-h3-color);">Penting: Data Anda Tersimpan di Browser Ini</h3>
                            <p class="secondary" style="font-size: 0.9rem; line-height: 1.5; margin-bottom: 1rem; color: var(--pico-color);">
                                TMPT menyimpan semua data Anda secara lokal di browser Anda sendiri. Data Anda <strong>TIDAK dikirim ke server manapun</strong> — 100% privat. 
                                Namun, data dapat hilang secara permanen jika browser di-reset, cache dihapus, atau Anda berganti perangkat.
                            </p>
                            <div style="display: flex; gap: 0.75rem;">
                                <a href="/app/auth/settings/#section-backup" role="button" class="btn-navy" style="font-size: 0.8rem; padding: 0.4rem 0.85rem; border-radius: 8px; text-decoration: none;">☁️ Aktifkan Google Drive Sync</a>
                                <button class="outline secondary" style="font-size: 0.8rem; padding: 0.4rem 0.85rem; border-radius: 8px; margin-bottom: 0;" onclick="(async()=>{ if(!window.BackupAwareness){ try { const s=document.createElement('script'); s.src='/shared/backup-awareness.js'; await new Promise((r,j)=>{s.onload=r;s.onerror=j;document.head.appendChild(s);}); } catch(e){ alert('Gagal memuat modul backup. Silakan periksa koneksi Anda.'); return; } } if(window.BackupAwareness){ window.BackupAwareness.triggerBackup(); } document.getElementById('backup-onboarding-banner').remove(); localStorage.setItem('tmpt_onboarding_backup_shown', 'true'); })()">💾 Pelajari Cara Backup</button>
                            </div>
                        </div>
                    </div>
                </article>
            `;
        }

        const categories = {
            "kerja": {
                title: "TMPT Kerja",
                subtitle: "Aplikasi produktivitas modern untuk dokumen dan tugas."
            },
            "dev": {
                title: "TMPT Dev",
                subtitle: "Workspace untuk Developer dengan fokus pada kecepatan."
            },
            "tools": {
                title: "TMPT Tools",
                subtitle: "Utilitas Cepat Harian untuk efisiensi kerja."
            }
        };

        const renderCardHtml = (app) => {
            const isEnabled = app.isEnabled !== false;
            const bgIcon = iconColors[app.name] || "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)";
            const isFavorited = favorites.includes(app.name);
            const starText = isFavorited ? '★' : '☆';
            const starColor = isFavorited ? '#f59e0b' : 'var(--pico-muted-color)';
            
            if (isEnabled) {
                return `
                    <a href="${app.url}" class="premium-app-card clickable-card" style="position: relative;">
                        <button class="fav-toggle-btn" data-name="${app.name}" style="position: absolute; top: 1rem; right: 1rem; background: transparent; border: none; font-size: 1.35rem; color: ${starColor}; cursor: pointer; padding: 0; line-height: 1; z-index: 10; width: auto; height: auto;" title="Tandai Favorit">
                            ${starText}
                        </button>
                        <div class="card-header-row">
                            <div class="app-icon-badge" style="background: ${bgIcon};">
                                ${app.icon}
                            </div>
                            <h3>${app.name}</h3>
                        </div>
                        <p class="card-desc">${app.desc || ''}</p>
                    </a>
                `;
            } else {
                return `
                    <div class="premium-app-card disabled-card" style="position: relative;">
                        <div class="card-header-row">
                            <div class="app-icon-badge" style="background: ${bgIcon}; filter: grayscale(1); opacity: 0.65;">
                                ${app.icon}
                            </div>
                            <h3>${app.name}</h3>
                        </div>
                        <p class="card-desc">${app.desc || ''}</p>
                        <div class="card-soon-badge">Coming Soon</div>
                    </div>
                `;
            }
        };

        // Render Favorite section first if activeFilter is 'all'
        if (activeFilter === 'all' && favorites.length > 0 && !searchQuery) {
            let favCards = '';
            Object.keys(categories).forEach(cat => {
                const apps = appsData[cat] || [];
                apps.forEach(app => {
                    if (favorites.includes(app.name)) {
                        favCards += renderCardHtml(app);
                        totalRendered++;
                    }
                });
            });

            if (favCards) {
                html += `
                    <section class="category-section" id="section-favorites-all" style="margin-bottom: 2.5rem; background: linear-gradient(135deg, rgba(245, 158, 11, 0.03) 0%, rgba(217, 119, 6, 0.03) 100%); padding: 1.5rem; border-radius: 24px; border: 1px solid rgba(245, 158, 11, 0.15);">
                        <h2 class="category-title" style="color: #d97706; display: flex; align-items: center; gap: 0.5rem;">⭐ Favorit Anda</h2>
                        <p class="category-subtitle">Aplikasi utama Anda yang ditandai untuk akses instan.</p>
                        <div class="apps-grid">
                            ${favCards}
                        </div>
                    </section>
                `;
            }
        }

        // Render specific filter or categories
        if (activeFilter === 'favorite') {
            html += `
                <section class="category-section" id="section-favorite-only">
                    <h2 class="category-title" style="color: #d97706; display: flex; align-items: center; gap: 0.5rem;">⭐ Aplikasi Favorit Anda</h2>
                    <p class="category-subtitle">Aplikasi yang Anda tandai sebagai favorit.</p>
                    <div class="apps-grid">
            `;
            let hasFavs = false;
            Object.keys(categories).forEach(cat => {
                const apps = appsData[cat] || [];
                apps.forEach(app => {
                    if (favorites.includes(app.name)) {
                        const isMatched = app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                          (app.desc && app.desc.toLowerCase().includes(searchQuery.toLowerCase()));
                        if (isMatched) {
                            html += renderCardHtml(app);
                            totalRendered++;
                            hasFavs = true;
                        }
                    }
                });
            });
            html += `
                    </div>
                </section>
            `;
            if (!hasFavs) {
                html = `
                    <div class="empty-state-card" style="margin-top: 2rem;">
                        <span style="font-size: 3rem;">⭐</span>
                        <h3>Belum Ada Aplikasi Favorit</h3>
                        <p class="secondary">Tandai bintang (★) pada kartu aplikasi di Dashboard untuk menambahkannya ke daftar favorit.</p>
                    </div>
                `;
            }
        } else {
            Object.keys(categories).forEach(cat => {
                if (activeFilter !== 'all' && activeFilter !== cat) return;

                const apps = appsData[cat] || [];
                const filteredApps = apps.filter(app => {
                    const query = searchQuery.toLowerCase();
                    return app.name.toLowerCase().includes(query) || 
                           (app.desc && app.desc.toLowerCase().includes(query));
                });

                if (filteredApps.length === 0) return;
                totalRendered += filteredApps.length;

                html += `
                    <section class="category-section" id="section-${cat}">
                        <h2 class="category-title">${categories[cat].title}</h2>
                        <p class="category-subtitle">${categories[cat].subtitle}</p>
                        <div class="apps-grid">
                `;

                filteredApps.forEach(app => {
                    html += renderCardHtml(app);
                });

                html += `
                        </div>
                    </section>
                `;
            });
        }

        if (totalRendered === 0 && searchQuery) {
            html = `
                <div class="empty-state-card" style="margin-top: 2rem;">
                    <svg class="folder-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <h3>Aplikasi Tidak Ditemukan</h3>
                    <p class="secondary">Tidak ada aplikasi yang cocok dengan kata kunci "${searchQuery}".</p>
                </div>
            `;
        }

        dashboardContent.innerHTML = html;

        // Bind Favorite Star click events
        document.querySelectorAll('.fav-toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const name = btn.dataset.name;
                let favs = JSON.parse(localStorage.getItem('tmpt_favorite_apps') || '[]');
                if (favs.includes(name)) {
                    favs = favs.filter(n => n !== name);
                } else {
                    favs.push(name);
                }
                localStorage.setItem('tmpt_favorite_apps', JSON.stringify(favs));
                renderDashboard();
                if (window.TMPT_UI && typeof window.TMPT_UI.initAppLauncher === 'function') {
                    window.TMPT_UI.initAppLauncher();
                }
            });
        });
    }

    // 4. Sidebar Category Filter Listeners
    const filterLinks = document.querySelectorAll('.sidebar-link[data-filter]');
    filterLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active from all filter links
            filterLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            activeFilter = link.getAttribute('data-filter');
            renderDashboard();

            // Mobile side panel close
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    });

    // 5. Search Filtering (using shared header search input)
    document.addEventListener('input', (e) => {
        if (e.target && e.target.id === 'header-search') {
            searchQuery = e.target.value;
            renderDashboard();
        }
    });

    // 6. Sidebar Toggle via Hamburger Menu in Shared Header
    document.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('#header-sidebar-toggle');
        if (toggleBtn) {
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                sidebar.classList.toggle('open');
                overlay.classList.toggle('active');
            } else {
                const mainPanel = document.querySelector('.dashboard-main');
                const isCollapsedNow = sidebar.classList.toggle('collapsed');
                if (mainPanel) mainPanel.classList.toggle('collapsed');
                localStorage.setItem('tmpt_sidebar_collapsed', isCollapsedNow ? 'true' : 'false');
            }
        }
    });

    overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    });

    function updateHeaderAppName() {
        const nameEl = document.getElementById('header-app-name');
        if (nameEl) {
            if (window.location.pathname.includes('/auth/settings/')) {
                nameEl.textContent = "Pengaturan";
            } else {
                nameEl.textContent = "Dashboard";
            }
        }
    }
    
    // Call it immediately and also listen to HTMX load swaps
    updateHeaderAppName();
    document.addEventListener('htmx:afterSwap', () => {
        updateHeaderAppName();
    });

    // 7. Security Status and Auth Integration
    async function updateSecurityStatus() {
        const isUnlocked = window.TMPT_Auth && window.TMPT_Auth.isUnlocked();
        const lockSwitch = document.getElementById('lock-switch');
        const lockText = document.getElementById('status-lock-text');
        const usernameEl = document.getElementById('sidebar-username');
        const avatarInitialEl = document.getElementById('sidebar-avatar-initial');
        const statusDotEl = document.querySelector('.status-dot');

        if (isUnlocked) {
            const meta = window.TMPT_Vault ? window.TMPT_Vault.getMetadata() : null;
            const vaultName = (meta && meta.name) || "Utama";
            
            if (lockSwitch) lockSwitch.checked = true;
            if (lockText) lockText.textContent = "Terbuka";
            if (usernameEl) usernameEl.textContent = vaultName;
            if (avatarInitialEl) avatarInitialEl.textContent = vaultName.charAt(0);
            if (statusDotEl) statusDotEl.style.backgroundColor = '#22c55e'; // Green
        } else {
            if (lockSwitch) lockSwitch.checked = false;
            if (lockText) lockText.textContent = "Terkunci";
            if (usernameEl) usernameEl.textContent = "Tamu";
            if (avatarInitialEl) avatarInitialEl.textContent = "T";
            if (statusDotEl) statusDotEl.style.backgroundColor = '#ef4444'; // Red
        }
    }

    // Auth Switch Toggle
    const lockSwitch = document.getElementById('lock-switch');
    if (lockSwitch) {
        lockSwitch.addEventListener('change', () => {
            const isUnlocked = window.TMPT_Auth && window.TMPT_Auth.isUnlocked();
            if (isUnlocked) {
                // Lock the session
                if (window.TMPT_Auth.lock) {
                    window.TMPT_Auth.lock();
                } else if (window.TMPT_lockVault) {
                    window.TMPT_lockVault();
                }
            } else {
                // Redirect to login page
                window.location.href = '/app/auth/login/';
            }
        });
    }

    // Listen to theme switch triggers to update theme toggle button icons
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            if (window.TMPT_UI && window.TMPT_UI.toggleTheme) {
                window.TMPT_UI.toggleTheme();
                updateThemeToggleIcon();
            }
        });
    }

    function updateThemeToggleIcon() {
        const theme = localStorage.getItem('tmpt_theme') || 'light';
        const themeBtn = document.getElementById('theme-btn');
        if (!themeBtn) return;

        const sunSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7"></path>
            </svg>
        `;
        const moonSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"></path>
            </svg>
        `;
        themeBtn.innerHTML = theme === 'dark' ? sunSvg : moonSvg;
    }



    const userProfileDiv = document.querySelector('.user-profile');
    if (userProfileDiv) {
        userProfileDiv.addEventListener('click', () => {
            const headerProfileBtn = document.querySelector('.tmpt-profile-dropdown button');
            if (headerProfileBtn) {
                headerProfileBtn.click();
            } else {
                window.location.href = '/app/auth/settings/';
            }
        });
    }

    // 8. Desktop Sidebar Collapse/Expand Toggle
    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    const mainPanel = document.querySelector('.dashboard-main');
    
    // Memuat preferensi collapse sidebar dari localStorage
    const isCollapsedSaved = localStorage.getItem('tmpt_sidebar_collapsed') === 'true';
    if (isCollapsedSaved && sidebar && mainPanel) {
        sidebar.classList.add('collapsed');
        mainPanel.classList.add('collapsed');
    }

    if (collapseBtn && sidebar && mainPanel) {
        collapseBtn.addEventListener('click', () => {
            const isCollapsedNow = sidebar.classList.toggle('collapsed');
            mainPanel.classList.toggle('collapsed');
            localStorage.setItem('tmpt_sidebar_collapsed', isCollapsedNow ? 'true' : 'false');
        });
    }

    // 9. Run Init Functions
    renderDashboard();
    
    // Auth init check
    if (window.TMPT_Auth) {
        await window.TMPT_Auth.init();
        updateSecurityStatus();
    }
    updateThemeToggleIcon();
});
