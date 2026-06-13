/**
 * TMPT Sync Status Widget
 * Menampilkan status sinkronisasi di header dan panel dropdown.
 * Menggantikan/melengkapi backup-awareness.js dengan status sync yang lebih kaya.
 *
 * States: synced | syncing | snapshotting | offline | error | not_setup | disabled
 */

const TMPT_SyncStatus = {

    // Config
    _containerId: 'header-backup-status-container',
    _dropdownId:  'header-sync-status-dropdown',

    // === Init ===

    init() {
        this.updateDisplay();

        // Dengarkan status perubahan dari CloudSyncEngine
        if (window.TMPT_CloudSyncEngine) {
            window.TMPT_CloudSyncEngine.on('status', () => this.updateDisplay());
        }

        // Dengarkan snapshot events
        if (window.TMPT_SnapshotEngine) {
            window.TMPT_SnapshotEngine.on('start', () => this._setDisplay('snapshotting'));
            window.TMPT_SnapshotEngine.on('done',  () => this.updateDisplay());
            window.TMPT_SnapshotEngine.on('error', () => this._setDisplay('error'));
        }

        // Offline/online events
        window.addEventListener('offline', () => this._setDisplay('offline'));
        window.addEventListener('online',  () => this.updateDisplay());

        // Tutup dropdown saat klik luar
        document.addEventListener('click', (e) => {
            const dropdown  = document.getElementById(this._dropdownId);
            const container = document.getElementById(this._containerId);
            if (dropdown && dropdown.style.display !== 'none' && container && !container.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    },

    // === State Resolution ===

    _resolveState() {
        if (!navigator.onLine) return 'offline';

        const isConnected = localStorage.getItem('tmpt_gdrive_connected') === 'true'
            || window.TMPT_TokenManager?.isConnected();

        if (!isConnected) return 'not_setup';

        const engineStatus = window.TMPT_CloudSyncEngine?.getStatus();
        if (engineStatus === 'syncing')     return 'syncing';
        if (engineStatus === 'snapshotting') return 'snapshotting';
        if (engineStatus === 'error')       return 'error';
        if (engineStatus === 'disabled')    return 'disabled';

        const lastSync = localStorage.getItem('tmpt_gdrive_last_sync');
        if (lastSync) return 'synced';

        return 'not_setup';
    },

    _setDisplay(state) {
        this._currentState = state;
        this.updateDisplay();
    },

    updateDisplay() {
        const state = this._resolveState();
        const lastSync = localStorage.getItem('tmpt_gdrive_last_sync');
        const email = localStorage.getItem('tmpt_gdrive_email');

        const visuals = this._getStateVisuals(state, lastSync);
        const container = document.getElementById(this._containerId);
        const dropdown = document.getElementById(this._dropdownId);

        if (container) {
            container.innerHTML = `<div title="${visuals.tooltip}" style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; color: ${visuals.color};" onclick="window.location.href='/app/auth/settings/#section-sync'">${visuals.icon} <span style="font-size: 0.8rem; font-weight: 500;">${visuals.label}</span></div>`;
        }

        if (dropdown) {
            dropdown.innerHTML = this._buildDropdownContent(state, lastSync, email);
        }
    },

    _getStateVisuals(state, lastSync) {
        const lastSyncStr = lastSync
            ? new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(lastSync))
            : null;

        const states = {
            synced: {
                icon:    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-12"/><path d="M9 15l2 2l4 -4"/></svg>`,
                color:   '#10b981',
                label:   lastSyncStr ? `✓ ${lastSyncStr}` : '✓ Tersinkron',
                tooltip: lastSyncStr ? `Tersinkron ✓ ${lastSyncStr}` : 'Data tersinkron ke Google Drive',
            },
            syncing: {
                icon:    `<svg class="sync-spinning" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
                color:   '#3b82f6',
                label:   'Menyinkron...',
                tooltip: 'Sedang mengunggah ke Google Drive...',
            },
            snapshotting: {
                icon:    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2z"/><circle cx="12" cy="14" r="2"/><polyline points="14 4 14 8 8 8 8 4"/></svg>`,
                color:   '#8b5cf6',
                label:   'Menyimpan...',
                tooltip: 'Membuat snapshot data lokal...',
            },
            offline: {
                icon:    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17 -2.69"/><path d="M19 12.859a10 10 0 0 0 -2.007 -1.523"/><path d="M2 8.82a15 15 0 0 1 4.177 -2.657"/><path d="M22 8.82a15 15 0 0 0 -11.288 -3.764"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`,
                color:   '#f59e0b',
                label:   'Offline',
                tooltip: 'Tidak ada koneksi internet — sync akan dilanjutkan saat online',
            },
            error: {
                icon:    `<svg class="sync-pulse" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
                color:   '#ef4444',
                label:   'Sync gagal',
                tooltip: 'Sinkronisasi gagal — klik untuk detail dan retry',
            },
            not_setup: {
                icon:    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`,
                color:   'var(--pico-muted-color)',
                label:   '',
                tooltip: 'Cloud Sync belum aktif — klik untuk mengaktifkan',
            },
            disabled: {
                icon:    '',
                color:   'transparent',
                label:   '',
                tooltip: '',
            },
        };

        return states[state] || states.not_setup;
    },

    _buildDropdownContent(state, lastSync, email) {
        const history = window.TMPT_CloudSyncEngine?.getSyncHistory() || [];

        const lastSyncFull = lastSync
            ? new Intl.DateTimeFormat('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              }).format(new Date(lastSync))
            : null;

        const isConnected = window.TMPT_TokenManager?.isConnected()
            || localStorage.getItem('tmpt_gdrive_connected') === 'true';

        let statusBadge = '';
        if (state === 'synced')       statusBadge = `<span style="background: #d1fae5; color: #065f46; font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 6px;">✓ Tersinkron</span>`;
        else if (state === 'syncing') statusBadge = `<span style="background: #dbeafe; color: #1e40af; font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 6px;">🔄 Menyinkron...</span>`;
        else if (state === 'offline') statusBadge = `<span style="background: #fef3c7; color: #92400e; font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 6px;">📴 Offline</span>`;
        else if (state === 'error')   statusBadge = `<span style="background: #fee2e2; color: #991b1b; font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 6px;">⚠️ Sync Gagal</span>`;
        else                          statusBadge = `<span style="background: var(--pico-card-sectioning-background-color); color: var(--pico-muted-color); font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 6px;">☁️ Belum Aktif</span>`;

        const historyHtml = history.length > 0
            ? history.slice(0, 5).map(h => `
                <div class="sync-history-item" style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; padding: 0.35rem 0;">
                    <span style="color: ${h.success ? '#10b981' : '#ef4444'};">${h.success ? '✓' : '✗'}</span>
                    <span style="flex: 1; color: var(--pico-color);">${this._formatHistoryTime(h.at)}</span>
                    ${h.success ? `<span style="color: var(--pico-muted-color);">${this._formatSize(h.size)}</span>` : `<span style="color: #ef4444; font-size: 0.7rem;">Gagal</span>`}
                </div>`).join('')
            : `<div style="font-size: 0.8rem; color: var(--pico-muted-color); text-align: center; padding: 0.5rem;">Belum ada riwayat sync.</div>`;

        return `
            <!-- Header Dropdown -->
            <div style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--pico-muted-border-color);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <strong style="font-size: 0.9rem;">☁️ TMPT Sync</strong>
                    ${statusBadge}
                </div>
                ${isConnected && email ? `<div style="font-size: 0.75rem; color: var(--pico-muted-color);">Terhubung: ${email}</div>` : ''}
                ${lastSyncFull ? `<div style="font-size: 0.75rem; color: var(--pico-muted-color); margin-top: 0.2rem;">Terakhir: ${lastSyncFull}</div>` : ''}
            </div>

            <!-- Action Buttons -->
            <div style="padding: 0.75rem 1.25rem; display: flex; gap: 0.5rem; flex-wrap: wrap; border-bottom: 1px solid var(--pico-muted-border-color);">
                ${isConnected ? `
                    <button
                        onclick="TMPT_SyncStatus.triggerSyncNow(this)"
                        style="font-size: 0.75rem; padding: 0.35rem 0.65rem; margin: 0; border-radius: 8px; width: auto; flex: 1;"
                        aria-label="Sync sekarang">
                        🔄 Sync Sekarang
                    </button>
                    <button
                        class="outline secondary"
                        onclick="TMPT_VersionHistory.show(); TMPT_SyncStatus.closeDropdown();"
                        style="font-size: 0.75rem; padding: 0.35rem 0.65rem; margin: 0; border-radius: 8px; width: auto; flex: 1;"
                        aria-label="Riwayat versi">
                        📦 Riwayat Versi
                    </button>
                ` : `
                    <button
                        onclick="TMPT_TokenManager.initiateAuth()"
                        style="font-size: 0.75rem; padding: 0.35rem 0.65rem; margin: 0; border-radius: 8px; width: auto; flex: 1;"
                        aria-label="Hubungkan Google Drive">
                        ☁️ Aktifkan Sync
                    </button>
                `}
                <a
                    href="/app/auth/settings/#section-sync"
                    onclick="TMPT_SyncStatus.closeDropdown();"
                    class="outline secondary"
                    role="button"
                    style="font-size: 0.75rem; padding: 0.35rem 0.65rem; margin: 0; border-radius: 8px; width: auto; flex: 0; text-decoration: none; display: flex; align-items: center; justify-content: center;"
                    aria-label="Pengaturan sync">
                    ⚙️
                </a>
            </div>

            <!-- Sync History -->
            <div style="padding: 0.75rem 1.25rem;">
                <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--pico-muted-color); margin-bottom: 0.4rem;">Riwayat Sync</div>
                ${historyHtml}
            </div>
        `;
    },

    // === User Actions ===

    toggleDropdown(event) {
        if (event) event.stopPropagation();
        const dropdown = document.getElementById(this._dropdownId);
        if (!dropdown) return;

        // Tutup dropdown lain
        document.querySelectorAll('#tmpt-app-launcher-menu, #tmpt-profile-menu, #header-backup-dropdown').forEach(m => {
            m.style.display = 'none';
        });

        const isVisible = dropdown.style.display !== 'none';
        dropdown.style.display = isVisible ? 'none' : 'block';

        if (!isVisible) {
            // Refresh content
            this.updateDisplay();
        }
    },

    closeDropdown() {
        const dropdown = document.getElementById(this._dropdownId);
        if (dropdown) dropdown.style.display = 'none';
    },

    async triggerSyncNow(btn) {
        if (btn) { btn.disabled = true; btn.textContent = 'Menyinkron...'; }
        try {
            await window.TMPT_CloudSyncEngine?.syncNow();
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '🔄 Sync Sekarang'; }
        }
    },

    // === Helpers ===

    _formatHistoryTime(isoStr) {
        if (!isoStr) return '—';
        try {
            return new Intl.DateTimeFormat('id-ID', {
                day: 'numeric', month: 'short',
                hour: '2-digit', minute: '2-digit',
            }).format(new Date(isoStr));
        } catch(e) { return isoStr; }
    },

    _formatSize(bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    },
};

window.TMPT_SyncStatus = TMPT_SyncStatus;
