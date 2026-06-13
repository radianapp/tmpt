/**
 * TMPT Backup Awareness & Cloud Sync Widget
 * Mengelola status backup/sync dan menampilkan widget di header.
 *
 * Redesign v2: Fokus pada Cloud Sync (Sync Save / Sync Open).
 * Jika Drive terhubung → tampil tombol Sync Save & Sync Open.
 * Jika belum → tampil CTA untuk menghubungkan Drive + opsi backup manual.
 */

const BackupAwareness = {
    // Batas hari untuk menentukan level status (digunakan ketika Drive TIDAK terhubung)
    SAFE_DAYS: 3,
    WARN_DAYS: 7,

    /**
     * Mendapatkan status backup saat ini (manual backup, bukan Drive).
     * @returns {{level: string, lastBackup: string|null, days: number|null, source: string}}
     */
    getStatus() {
        const lastBackup    = localStorage.getItem('tmpt_last_backup_at');
        const driveSync     = localStorage.getItem('tmpt_gdrive_last_sync');
        const driveConnected = localStorage.getItem('tmpt_gdrive_connected') === 'true';

        if (driveConnected && driveSync) {
            const hoursSinceSync = this._hoursSince(driveSync);
            return {
                level:      hoursSinceSync <= 24 ? 'protected' : 'warn',
                lastBackup: driveSync,
                days:       Math.floor(hoursSinceSync / 24),
                source:     'drive',
            };
        }

        if (!lastBackup) return { level: 'critical', lastBackup: null, days: null, source: 'none' };

        const days = this._daysSince(lastBackup);
        if (days <= this.SAFE_DAYS)  return { level: 'safe',     lastBackup, days, source: 'manual' };
        if (days <= this.WARN_DAYS)  return { level: 'warn',     lastBackup, days, source: 'manual' };
        return                               { level: 'critical', lastBackup, days, source: 'manual' };
    },

    /** Dipanggil setiap kali ada perubahan data. */
    markDataChanged() {
        localStorage.setItem('tmpt_data_changed_at', new Date().toISOString());
        this.renderHeaderIcon();
    },

    /** Dipanggil setelah backup/sync berhasil. */
    markBackupComplete(source = 'manual') {
        const now = new Date().toISOString();
        localStorage.setItem('tmpt_last_backup_at', now);
        if (source === 'drive') localStorage.setItem('tmpt_gdrive_last_sync', now);
        this.renderHeaderIcon();
    },

    // =========================================================
    // Render Header Icon — Redesign v2: Sync Widget
    // =========================================================

    /**
     * Render widget Cloud Sync di area #header-backup-status-container.
     * Dua mode:
     *  - Drive terhubung   → tombol Sync Save + Sync Open
     *  - Drive belum dihub → ikon warning + CTA hubungkan / backup manual
     */
    renderHeaderIcon() {
        const container = document.getElementById('header-backup-status-container');
        if (!container) return;

        const driveConnected  = localStorage.getItem('tmpt_gdrive_connected') === 'true';
        const lastSync        = localStorage.getItem('tmpt_gdrive_last_sync');
        const email           = localStorage.getItem('tmpt_gdrive_email') || '';

        if (driveConnected) {
            this._renderConnectedWidget(container, lastSync, email);
        } else {
            this._renderNotConnectedWidget(container);
        }
    },

    /** Widget ketika Google Drive terhubung. */
    _renderConnectedWidget(container, lastSync, email) {
        const timeAgoStr  = lastSync ? this._timeAgo(lastSync) : 'Belum pernah';
        const fullDateStr = lastSync
            ? new Intl.DateTimeFormat('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              }).format(new Date(lastSync))
            : null;

        container.innerHTML = `
            <button id="header-sync-btn"
                aria-label="Cloud Sync — Terakhir: ${fullDateStr || 'Belum pernah'}"
                title="Cloud Sync — Terakhir: ${fullDateStr || 'Belum pernah'}"
                style="padding: 0 0.6rem; display: flex; align-items: center; gap: 0.3rem; height: 40px;
                       border-radius: 20px; background: transparent !important; border: none !important;
                       cursor: pointer; color: #10b981;"
                onmouseover="this.style.backgroundColor='var(--pico-card-sectioning-background-color)'"
                onmouseout="this.style.backgroundColor='transparent'"
                onclick="window.location.href='/app/auth/settings/#section-sync'">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                     fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-12"/>
                    <path d="M9 12l2 2l4-4"/>
                </svg>
                <span id="sync-time-label" style="font-size: 0.72rem; font-weight: 700;
                      color: var(--pico-muted-color); white-space: nowrap;">${timeAgoStr}</span>
            </button>
        `;
    },

    /** Widget ketika Drive belum terhubung. */
    _renderNotConnectedWidget(container) {
        const status   = this.getStatus();
        const isUrgent = status.level === 'critical';
        const iconColor = isUrgent ? '#ef4444' : '#f59e0b';

        container.innerHTML = `
            <button id="header-sync-btn"
                aria-label="Cloud Sync — Belum terhubung"
                title="Data belum disinkronkan ke cloud"
                style="padding: 0; display: flex; align-items: center; justify-content: center;
                       width: 40px; height: 40px; border-radius: 50%;
                       background: transparent !important; border: none !important;
                       cursor: pointer; position: relative;"
                onmouseover="this.style.backgroundColor='var(--pico-card-sectioning-background-color)'"
                onmouseout="this.style.backgroundColor='transparent'"
                onclick="window.location.href='/app/auth/settings/#section-sync'">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
                     fill="none" stroke="${iconColor}" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
                    <line x1="12" y1="13" x2="12" y2="17"/>
                    <line x1="12" y1="9" x2="12.01" y2="9"/>
                </svg>
                ${isUrgent ? `<span style="position: absolute; top: 5px; right: 5px;
                    width: 8px; height: 8px; background: #ef4444; border-radius: 50%;
                    border: 1.5px solid var(--pico-card-background-color);"></span>` : ''}
            </button>

            <div id="header-sync-dropdown"
                 style="display: none; position: absolute; top: 50px; right: 0;
                        background: var(--pico-card-background-color);
                        border: 1px solid var(--pico-muted-border-color);
                        box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                        border-radius: 16px; width: 300px; padding: 1.25rem;
                        z-index: 100900; text-align: left;">

                <div style="font-size: 0.82rem; font-weight: 800; margin-bottom: 0.4rem;
                             color: var(--pico-heading-color);">
                    💾 Data Belum di Cloud
                </div>
                <div style="font-size: 0.78rem; color: var(--pico-muted-color);
                             margin-bottom: 1rem; line-height: 1.55;">
                    Data Anda hanya tersimpan di browser ini.<br>
                    Hubungkan Google Drive untuk sync antar perangkat.
                </div>

                <a href="/app/auth/multidevice/" role="button"
                   style="width: 100%; text-align: center; margin-bottom: 0.5rem;
                          border-radius: 8px; font-size: 0.83rem; font-weight: 700;
                          text-decoration: none; display: block; padding: 0.55rem;">
                    ☁️ Hubungkan Google Drive
                </a>
                <button onclick="BackupAwareness.triggerBackup(); document.getElementById('header-sync-dropdown').style.display='none';"
                    class="outline secondary"
                    style="width: 100%; border-radius: 8px; font-size: 0.82rem; margin: 0; padding: 0.55rem;">
                    💾 Backup Manual (.tmpt)
                </button>
            </div>
        `;
    },

    // =========================================================
    // Aksi Sync Save (dari header dropdown)
    // =========================================================

    /**
     * Lakukan Sync Save langsung dari header.
     * Brankas harus terbuka. Menampilkan toast progress.
     */
    async doSyncSave() {
        const dropdown = document.getElementById('header-sync-dropdown');
        if (dropdown) dropdown.style.display = 'none';

        if (!window.TMPT_Auth || !window.TMPT_Auth.isUnlocked()) {
            window.TMPT_UI?.toast('Buka kunci Brankas Anda terlebih dahulu untuk melakukan Sync Save.', 'warning');
            return;
        }

        if (!window.TMPT_Backup) await this._loadScript('/shared/backup.js');
        if (!window.GDriveSync)  await this._loadScript('/shared/gdrive-sync.js');

        const btn = document.getElementById('header-btn-sync-save');
        const origText = btn ? btn.innerHTML : null;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                style="animation: spin-icon 0.8s linear infinite;">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg> Menyimpan...`;
        }

        try {
            const result = await window.GDriveSync.syncSave();
            window.TMPT_UI?.toast(`✓ Data berhasil disimpan ke Google Drive! (${(result.size / 1024).toFixed(0)} KB)`, 'success');
            this.renderHeaderIcon();
        } catch (e) {
            console.error('[BackupAwareness.doSyncSave]', e);
            window.TMPT_UI?.toast('Sync Save gagal: ' + e.message, 'error');
            if (btn && origText) { btn.disabled = false; btn.innerHTML = origText; }
        }
    },

    // =========================================================
    // Toggle Dropdown
    // =========================================================

    toggleSyncDropdown(e) {
        if (e) e.stopPropagation();
        const dropdown = document.getElementById('header-sync-dropdown');
        if (!dropdown) return;
        const isVisible = dropdown.style.display !== 'none';
        // Tutup dropdown lain yang mungkin terbuka
        document.querySelectorAll('#tmpt-app-launcher-menu, #tmpt-profile-menu').forEach(m => {
            m.style.display = 'none';
        });
        dropdown.style.display = isVisible ? 'none' : 'block';
    },

    // =========================================================
    // Reminder (hanya jika Drive TIDAK terhubung)
    // =========================================================

    maybeShowReminder() {
        const driveConnected = localStorage.getItem('tmpt_gdrive_connected') === 'true';
        if (driveConnected) return; // Drive aktif, tidak perlu reminder

        const lastBackup = localStorage.getItem('tmpt_last_backup_at');
        const snooze     = localStorage.getItem('tmpt_backup_reminder_snooze_until');
        if (snooze && new Date(snooze) > new Date()) return;

        const limitDays = parseInt(localStorage.getItem('tmpt_backup_reminder_interval_days') || '7');
        let shouldShow = false;
        let daysStr    = '';

        if (!lastBackup) {
            shouldShow = true;
            daysStr    = 'Anda belum pernah mem-backup data Anda!';
        } else {
            const days = this._daysSince(lastBackup);
            if (days >= limitDays) {
                shouldShow = true;
                daysStr    = `Sudah ${days} hari sejak backup terakhir Anda.`;
            }
        }

        if (shouldShow && window.TMPT_UI) {
            let container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                document.body.appendChild(container);
            }
            const alertBox = document.createElement('div');
            alertBox.className = 'toast toast-warning';
            alertBox.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; min-width: 320px; border-left: 5px solid #ef4444;';
            alertBox.innerHTML = `
                <div style="font-weight: 700; color: #ffffff;">💾 Amankan Data TMPT Anda</div>
                <div style="font-size: 0.85rem; color: rgba(255,255,255,0.85);">${daysStr} Data hanya tersimpan di peramban ini.</div>
                <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                    <a href="/app/auth/multidevice/" role="button"
                       style="font-size: 0.75rem; padding: 0.25rem 0.5rem; margin: 0; width: auto;
                              border-radius: 6px; text-decoration: none; display: inline-block;
                              background: #0f172a; border-color: #0f172a; color: #ffffff;"
                       onclick="this.closest('.toast').remove();">☁️ Hubungkan Drive</a>
                    <button class="outline" onclick="BackupAwareness.snoozeReminder(); this.closest('.toast').remove();"
                        style="font-size: 0.75rem; padding: 0.25rem 0.5rem; margin: 0; width: auto;
                               border-radius: 6px; border-color: rgba(255,255,255,0.4); color: #fff; background: transparent;">
                        Nanti
                    </button>
                </div>
            `;
            container.appendChild(alertBox);
            setTimeout(() => {
                alertBox.style.opacity = '0';
                setTimeout(() => alertBox.remove(), 300);
            }, 10000);
        }
    },

    snoozeReminder() {
        const until = new Date();
        until.setDate(until.getDate() + 3);
        localStorage.setItem('tmpt_backup_reminder_snooze_until', until.toISOString());
    },

    async triggerBackup() {
        if (!window.TMPT_Backup) await this._loadScript('/shared/backup.js');
        if (window.TMPT_Backup) await window.TMPT_Backup.exportVault();
    },

    async getUnsavedStats() {
        if (!window.TMPT_Backup) return null;
        try { return await window.TMPT_Backup.calculateBackupStats(); } catch (e) { return null; }
    },

    // =========================================================
    // Helpers
    // =========================================================

    _daysSince(iso)  { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); },
    _hoursSince(iso) { return (Date.now() - new Date(iso).getTime()) / 3600000; },

    _timeAgo(iso) {
        const diff    = Date.now() - new Date(iso).getTime();
        const minutes = Math.floor(diff / 60000);
        const hours   = Math.floor(diff / 3600000);
        const days    = Math.floor(diff / 86400000);
        if (minutes < 2)  return 'Baru saja';
        if (minutes < 60) return `${minutes} mnt lalu`;
        if (hours < 24)   return `${hours} jam lalu`;
        if (days === 1)   return 'Kemarin';
        return `${days} hari lalu`;
    },

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },
};

window.BackupAwareness = BackupAwareness;

// Tutup dropdown saat klik di luar
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('header-sync-dropdown');
    if (dropdown && dropdown.style.display !== 'none' &&
        !e.target.closest('#header-backup-status-container')) {
        dropdown.style.display = 'none';
    }
});
