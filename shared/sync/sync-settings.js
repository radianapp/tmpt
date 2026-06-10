/**
 * TMPT Sync Settings Panel
 * Panel pengaturan sinkronisasi yang bisa di-embed di halaman Settings.
 * Mengelola koneksi Google Drive, jadwal sync, dan opsi lainnya.
 */

const TMPT_SyncSettings = {

    DEFAULTS: {
        enabled:           true,
        provider:          'gdrive',
        auto_sync:         true,
        sync_interval_min: 30,
        max_local_snapshots: 10,
        max_cloud_snapshots: 10,
        encrypt_backup:    false,
        include_berkas_files: true,  // True by default untuk sinkronisasi file berkas
        sync_on_tab_close: true,
        notify_on_error:   true,
    },

    SETTINGS_KEY: 'tmpt_sync_settings',

    // === Settings CRUD ===

    getSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.SETTINGS_KEY) || '{}');
            return { ...this.DEFAULTS, ...saved };
        } catch(e) {
            return { ...this.DEFAULTS };
        }
    },

    saveSettings(settings) {
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify({ ...this.getSettings(), ...settings }));
        this._applySettings();
    },

    _applySettings() {
        const s = this.getSettings();

        // Terapkan ke SnapshotEngine
        if (window.TMPT_SnapshotEngine) {
            window.TMPT_SnapshotEngine.MAX_SNAPSHOTS = s.max_local_snapshots;
        }

        // Terapkan ke CloudSyncEngine
        if (window.TMPT_CloudSyncEngine) {
            window.TMPT_CloudSyncEngine.MAX_CLOUD_SNAPSHOTS = s.max_cloud_snapshots;
            if (!s.enabled || s.provider === 'none') {
                window.TMPT_CloudSyncEngine._setStatus('disabled');
            }
        }
    },

    // === Render Panel ===

    /**
     * Render settings panel ke dalam container element.
     * @param {string|HTMLElement} containerSelector — CSS selector atau element
     */
    renderPanel(containerSelector) {
        const container = typeof containerSelector === 'string'
            ? document.querySelector(containerSelector)
            : containerSelector;

        if (!container) return;

        const s          = this.getSettings();
        const isConnected = window.TMPT_TokenManager?.isConnected()
            || localStorage.getItem('tmpt_gdrive_connected') === 'true';
        const email      = localStorage.getItem('tmpt_gdrive_email');
        const lastSync   = localStorage.getItem('tmpt_gdrive_last_sync');

        container.innerHTML = `
            <div id="tmpt-sync-settings-panel">
                <style>
                    #tmpt-sync-settings-panel .sync-toggle-row {
                        display: flex; justify-content: space-between; align-items: center;
                        padding: 0.65rem 0; border-bottom: 1px solid var(--pico-muted-border-color);
                    }
                    #tmpt-sync-settings-panel .sync-toggle-row:last-child { border-bottom: none; }
                    #tmpt-sync-settings-panel .sync-section-title {
                        font-size: 0.7rem; font-weight: 800; text-transform: uppercase;
                        letter-spacing: 0.06em; color: var(--pico-muted-color); margin: 1.25rem 0 0.5rem;
                    }
                    #tmpt-sync-settings-panel .sync-card {
                        background: var(--pico-card-sectioning-background-color);
                        border: 1px solid var(--pico-muted-border-color);
                        border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 0.75rem;
                    }
                </style>

                <!-- Status Koneksi -->
                <div class="sync-card" style="margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 40px; height: 40px; background: ${isConnected ? 'rgba(16,185,129,0.1)' : 'var(--pico-card-background-color)'}; border: 1px solid ${isConnected ? '#10b981' : 'var(--pico-muted-border-color)'}; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                                ${isConnected ? '☁️' : '🔌'}
                            </div>
                            <div>
                                <div style="font-weight: 700; font-size: 0.9rem;">Google Drive</div>
                                <div style="font-size: 0.8rem; color: ${isConnected ? '#10b981' : 'var(--pico-muted-color)'};">
                                    ${isConnected ? `✓ Terhubung${email ? ` — ${email}` : ''}` : 'Belum terhubung'}
                                </div>
                                ${lastSync ? `<div style="font-size: 0.72rem; color: var(--pico-muted-color);">Terakhir: ${this._formatDate(lastSync)}</div>` : ''}
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            ${isConnected ? `
                                <button
                                    onclick="TMPT_SyncSettings.triggerSyncNow(this)"
                                    style="font-size: 0.8rem; padding: 0.4rem 0.75rem; margin: 0; border-radius: 8px; width: auto;"
                                    aria-label="Sync sekarang">
                                    🔄 Sync Sekarang
                                </button>
                                <button
                                    class="outline secondary"
                                    onclick="TMPT_SyncSettings.disconnect()"
                                    style="font-size: 0.8rem; padding: 0.4rem 0.75rem; margin: 0; border-radius: 8px; width: auto;"
                                    aria-label="Putuskan Google Drive">
                                    Putuskan
                                </button>
                            ` : `
                                <button
                                    onclick="TMPT_TokenManager.initiateAuth()"
                                    style="font-size: 0.8rem; padding: 0.4rem 0.75rem; margin: 0; border-radius: 8px; width: auto;"
                                    aria-label="Hubungkan Google Drive">
                                    Hubungkan Google Drive →
                                </button>
                            `}
                        </div>
                    </div>
                </div>

                <!-- Jadwal Sync -->
                <div class="sync-section-title">Jadwal Sinkronisasi</div>
                <div class="sync-card">
                    <div class="sync-toggle-row">
                        <div style="flex: 1; min-width: 0; padding-right: 1rem;">
                            <div style="font-size: 0.9rem; font-weight: 600;">Sinkronisasi Otomatis</div>
                            <div style="font-size: 0.78rem; color: var(--pico-muted-color);">Snapshot + upload otomatis setelah ada perubahan</div>
                        </div>
                        <div style="flex-shrink: 0; display: flex; align-items: center;">
                            <input type="checkbox" role="switch" id="sync-toggle-auto" ${s.auto_sync ? 'checked' : ''} onchange="TMPT_SyncSettings.saveSettings({ auto_sync: this.checked })" aria-label="Toggle sinkronisasi otomatis" style="margin: 0;">
                        </div>
                    </div>
                    <div style="padding: 0.65rem 0;">
                        <div style="font-size: 0.9rem; font-weight: 600; margin-bottom: 0.5rem;">Interval Snapshot</div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            ${[
                                { label: '5 menit',    val: 5  },
                                { label: '30 menit',   val: 30 },
                                { label: '1 jam',      val: 60 },
                                { label: 'Manual saja', val: 0  },
                            ].map(opt => `
                                <button
                                    class="${s.sync_interval_min === opt.val ? 'btn-navy' : 'outline secondary'}"
                                    onclick="TMPT_SyncSettings.setInterval(${opt.val}, this)"
                                    style="font-size: 0.78rem; padding: 0.3rem 0.65rem; margin: 0; border-radius: 8px; width: auto;"
                                    aria-label="Set interval ${opt.label}">
                                    ${opt.label}
                                </button>`).join('')}
                        </div>
                    </div>
                </div>

                <!-- Konten yang Disinkronkan -->
                <div class="sync-section-title">Konten yang Disinkronkan</div>
                <div class="sync-card">
                    <div class="sync-toggle-row">
                        <div style="flex: 1; min-width: 0; padding-right: 1rem;">
                            <div style="font-size: 0.87rem; font-weight: 600;">✅ Dokumen & Aplikasi</div>
                            <div style="font-size: 0.75rem; color: var(--pico-muted-color);">Tulis, Hitung, Slide, Forms, Kalender, Tugas, Catatan</div>
                        </div>
                        <span style="font-size: 0.72rem; color: #10b981; font-weight: 700; flex-shrink: 0;">Selalu</span>
                    </div>
                    <div class="sync-toggle-row">
                        <div style="flex: 1; min-width: 0; padding-right: 1rem;">
                            <div style="font-size: 0.87rem; font-weight: 600;">File Berkas (PDF, Gambar)</div>
                            <div style="font-size: 0.75rem; color: var(--pico-muted-color);">Binary files dari TMPT Berkas (bisa besar)</div>
                        </div>
                        <div style="flex-shrink: 0; display: flex; align-items: center;">
                            <input type="checkbox" role="switch" id="sync-toggle-berkas" ${s.include_berkas_files ? 'checked' : ''} onchange="TMPT_SyncSettings.saveSettings({ include_berkas_files: this.checked })" aria-label="Toggle sync file berkas" style="margin: 0;">
                        </div>
                    </div>
                    <div class="sync-toggle-row" style="border-bottom: none;">
                        <div style="flex: 1; min-width: 0; padding-right: 1rem;">
                            <div style="font-size: 0.87rem; font-weight: 600;">🔒 Vault / Brankas</div>
                            <div style="font-size: 0.75rem; color: #10b981;">Tersinkronisasi (dienkripsi aman)</div>
                        </div>
                    </div>
                </div>

                <!-- Penyimpanan -->
                <div class="sync-section-title">Penyimpanan</div>
                <div class="sync-card">
                    <div id="sync-storage-info" style="font-size: 0.85rem; color: var(--pico-muted-color);">
                        Memuat info penyimpanan...
                    </div>
                    <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap;">
                        <button
                            class="outline secondary"
                            onclick="TMPT_VersionHistory.show()"
                            style="font-size: 0.78rem; padding: 0.35rem 0.65rem; margin: 0; border-radius: 8px; width: auto;"
                            aria-label="Lihat riwayat versi">
                            📦 Riwayat Versi
                        </button>
                        <button
                            class="outline secondary"
                            onclick="TMPT_SyncSettings.clearLocalSnapshots(this)"
                            style="font-size: 0.78rem; padding: 0.35rem 0.65rem; margin: 0; border-radius: 8px; width: auto; color: #ef4444; border-color: #ef4444;"
                            aria-label="Hapus snapshot lokal">
                            🗑 Hapus Snapshot Lokal
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Load storage info async
        this._loadStorageInfo();
    },

    // === Actions ===

    async triggerSyncNow(btn) {
        if (btn) { btn.disabled = true; btn.textContent = 'Menyinkron...'; }
        try {
            const success = await window.TMPT_CloudSyncEngine?.syncNow();
            if (success && window.TMPT_UI) {
                window.TMPT_UI.toast('Sinkronisasi berhasil! ✓', 'success');
            }
        } catch(e) {
            if (window.TMPT_UI) window.TMPT_UI.toast('Sync gagal: ' + e.message, 'error');
        } finally {
            if (btn) {
                btn.disabled    = false;
                btn.textContent = '🔄 Sync Sekarang';
            }
        }
    },

    disconnect() {
        window.TMPT_TokenManager?.disconnect();
        if (window.TMPT_UI) {
            window.TMPT_UI.toast('Koneksi Google Drive diputuskan.', 'info');
        }
        // Re-render
        const panel = document.getElementById('tmpt-sync-settings-panel');
        if (panel) this.renderPanel(panel.parentElement);
    },

    setInterval(minutes, btn) {
        this.saveSettings({ sync_interval_min: minutes });

        // Update debounce di SnapshotEngine
        if (window.TMPT_SnapshotEngine && minutes > 0) {
            window.TMPT_SnapshotEngine.DEBOUNCE_MS = minutes * 60 * 1000;
        }

        // Update UI — reset semua button ke outline, aktifkan yang diklik
        if (btn) {
            const parent = btn.closest('.sync-card');
            if (parent) {
                parent.querySelectorAll('button').forEach(b => {
                    b.className = 'outline secondary';
                    b.style.cssText = 'font-size: 0.78rem; padding: 0.3rem 0.65rem; margin: 0; border-radius: 8px; width: auto;';
                });
            }
            btn.className = 'btn-navy';
        }
    },

    async clearLocalSnapshots(btn) {
        const confirmed = await (window.TMPT_UI?.confirm
            ? window.TMPT_UI.confirm('Hapus semua snapshot lokal dari perangkat ini?', 'Konfirmasi')
            : Promise.resolve(window.confirm('Hapus semua snapshot lokal dari perangkat ini?')));

        if (!confirmed) return;

        try {
            const root = await navigator.storage.getDirectory();
            try {
                await root.removeEntry('tmpt-snapshots', { recursive: true });
            } catch(e) { /* Mungkin belum ada */ }

            if (window.TMPT_UI) window.TMPT_UI.toast('Snapshot lokal berhasil dihapus.', 'success');
            this._loadStorageInfo();
        } catch(err) {
            if (window.TMPT_UI) window.TMPT_UI.toast('Gagal hapus snapshot: ' + err.message, 'error');
        }
    },

    async _loadStorageInfo() {
        const el = document.getElementById('sync-storage-info');
        if (!el) return;

        try {
            // Snapshot lokal
            const snapshots = await window.TMPT_SnapshotEngine?.listLocalSnapshots() || [];
            const localSize = snapshots.reduce((sum, s) => sum + (s.size || 0), 0);

            // Storage estimate
            let storageText = '';
            if (navigator.storage?.estimate) {
                const { usage, quota } = await navigator.storage.estimate();
                const usePct = ((usage / quota) * 100).toFixed(0);
                storageText = `Browser storage: ${this._formatSize(usage)} / ${this._formatSize(quota)} (${usePct}%)`;
            }

            el.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <div>
                        <div style="font-size: 0.72rem; color: var(--pico-muted-color);">Snapshot Lokal</div>
                        <div style="font-weight: 700;">${snapshots.length} snapshot · ${this._formatSize(localSize)}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.72rem; color: var(--pico-muted-color);">Max Tersimpan</div>
                        <div style="font-weight: 700;">${window.TMPT_SnapshotEngine?.MAX_SNAPSHOTS || 10} snapshot</div>
                    </div>
                </div>
                ${storageText ? `<div style="font-size: 0.72rem; color: var(--pico-muted-color);">${storageText}</div>` : ''}
            `;
        } catch(e) {
            el.textContent = 'Gagal memuat info penyimpanan.';
        }
    },

    // === Helpers ===

    _formatDate(isoStr) {
        try {
            return new Intl.DateTimeFormat('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            }).format(new Date(isoStr));
        } catch(e) { return isoStr; }
    },

    _formatSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    },
};

window.TMPT_SyncSettings = TMPT_SyncSettings;
