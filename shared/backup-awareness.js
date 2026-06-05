/**
 * TMPT Backup Awareness System
 * Mengelola state, reminder, banner onboarding, dan visualisasi status backup data lokal.
 */

const BackupAwareness = {
    // Batas hari untuk menentukan level status
    SAFE_DAYS: 3,       // <= 3 hari = aman (hijau)
    WARN_DAYS: 7,       // 3-7 hari = perhatian (kuning)
    // > 7 hari atau null = kritis (merah)

    // Mendapatkan status backup saat ini
    getStatus() {
        const lastBackup = localStorage.getItem('tmpt_last_backup_at');
        const driveSync = localStorage.getItem('tmpt_gdrive_last_sync');
        const driveConnected = localStorage.getItem('tmpt_gdrive_connected') === 'true';

        // Jika Google Drive Sync aktif dan berhasil sync kurang dari 1 hari yang lalu
        if (driveConnected && driveSync) {
            const hoursSinceSync = this._hoursSince(driveSync);
            if (hoursSinceSync <= 24) {
                return { level: 'protected', lastBackup: driveSync, days: 0, source: 'drive' };
            } else {
                return { level: 'warn', lastBackup: driveSync, days: Math.floor(hoursSinceSync / 24), source: 'drive' };
            }
        }

        if (!lastBackup) {
            return { level: 'critical', lastBackup: null, days: null, source: 'none' };
        }

        const days = this._daysSince(lastBackup);
        if (days <= this.SAFE_DAYS) {
            return { level: 'safe', lastBackup, days, source: 'manual' };
        } else if (days <= this.WARN_DAYS) {
            return { level: 'warn', lastBackup, days, source: 'manual' };
        } else {
            return { level: 'critical', lastBackup, days, source: 'manual' };
        }
    },

    // Dipanggil setiap kali ada perubahan data (IndexedDB write)
    markDataChanged() {
        localStorage.setItem('tmpt_data_changed_at', new Date().toISOString());
        // Memicu render ikon jika elemen sudah ada
        this.renderHeaderIcon();
    },

    // Dipanggil setelah backup berhasil diunduh/diunggah
    markBackupComplete(source = 'manual') {
        const now = new Date().toISOString();
        localStorage.setItem('tmpt_last_backup_at', now);
        if (source === 'drive') {
            localStorage.setItem('tmpt_gdrive_last_sync', now);
        }
        this.renderHeaderIcon();
    },

    // Mendapatkan statistik jumlah rekaman data yang belum dibackup (estimasi perubahan baru)
    async getUnsavedStats() {
        if (!window.TMPT_Backup) return null;
        try {
            return await window.TMPT_Backup.calculateBackupStats();
        } catch (e) {
            console.error("Gagal memuat statistik backup", e);
            return null;
        }
    },

    // Render ikon status di header
    renderHeaderIcon() {
        const container = document.getElementById('header-backup-status-container');
        if (!container) return;

        const status = this.getStatus();
        const driveConnected = localStorage.getItem('tmpt_gdrive_connected') === 'true';
        let iconHtml = '';
        let tooltipText = '';
        let colorClass = '';

        const formatter = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const lastBackupStr = status.lastBackup ? formatter.format(new Date(status.lastBackup)) : 'Belum pernah';

        switch (status.level) {
            case 'protected':
                iconHtml = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" stroke-width="2" stroke="#10b981" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-12" />
                        <path d="M9 12l2 2l4 -4" />
                    </svg>
                `;
                tooltipText = `Aman: Google Drive Sinkronisasi Otomatis Aktif. Terakhir disinkronkan: ${lastBackupStr}.`;
                colorClass = 'safe';
                break;
            case 'safe':
                iconHtml = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" stroke-width="2" stroke="#10b981" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2z" />
                        <circle cx="12" cy="14" r="2" />
                        <polyline points="14 4 14 8 8 8 8 4" />
                    </svg>
                `;
                tooltipText = `Aman: Backup terakhir ${status.days} hari yang lalu (${lastBackupStr}).`;
                colorClass = 'safe';
                break;
            case 'warn':
                iconHtml = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" stroke-width="2" stroke="#f59e0b" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2z" />
                        <circle cx="12" cy="14" r="2" />
                        <polyline points="14 4 14 8 8 8 8 4" />
                        <circle cx="12" cy="14" r="6" stroke="#f59e0b" stroke-dasharray="3 3" />
                    </svg>
                `;
                tooltipText = `Perhatian: Backup terakhir ${status.days} hari yang lalu. Disarankan untuk mem-backup data Anda.`;
                colorClass = 'warn';
                break;
            case 'critical':
            default:
                iconHtml = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="pulse-icon" width="22" height="22" viewBox="0 0 24 24" stroke-width="2" stroke="#ef4444" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2z" />
                        <circle cx="12" cy="14" r="2" />
                        <polyline points="14 4 14 8 8 8 8 4" />
                    </svg>
                    <span class="badge-dot" style="position: absolute; top: 2px; right: 2px; height: 8px; width: 8px; background-color: #ef4444; border-radius: 50%; display: inline-block;"></span>
                `;
                tooltipText = status.lastBackup 
                    ? `Kritis: Sudah ${status.days} hari sejak backup terakhir. Data Anda berisiko hilang!` 
                    : 'Kritis: Anda belum pernah mencadangkan data Anda! Data hanya tersimpan di peramban ini.';
                colorClass = 'critical';
                break;
        }

        container.innerHTML = `
            <button id="header-backup-btn" aria-label="Status Pencadangan" title="${tooltipText}" style="padding: 0; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; background: transparent !important; border: none !important; cursor: pointer; position: relative; color: var(--pico-heading-color);" onmouseover="this.style.backgroundColor='var(--pico-card-sectioning-background-color)'" onmouseout="this.style.backgroundColor='transparent'" onclick="BackupAwareness.toggleStatusDropdown(event)">
                ${iconHtml}
            </button>
            <div id="header-backup-dropdown" style="display: none; position: absolute; top: 50px; right: 0; background: var(--pico-card-background-color); border: 1px solid var(--pico-muted-border-color); box-shadow: 0 8px 32px rgba(0,0,0,0.15); border-radius: 16px; width: 340px; padding: 1.25rem; z-index: 100900; text-align: left;">
                <h4 style="font-size: 0.95rem; font-weight: 800; margin-top: 0; margin-bottom: 0.75rem; border-bottom: 1px solid var(--pico-muted-border-color); padding-bottom: 0.5rem; color: var(--pico-h1-color);">💾 Status Backup TMPT</h4>
                <div style="font-size: 0.85rem; margin-bottom: 1rem; line-height: 1.4;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <span class="status-indicator-dot ${colorClass}"></span>
                        <strong class="${colorClass}-text">${status.level === 'protected' ? 'Terlindungi' : status.level === 'safe' ? 'Aman' : status.level === 'warn' ? 'Perlu Backup' : 'Risiko Tinggi'}</strong>
                    </div>
                    <div style="color: var(--pico-secondary-color); margin-bottom: 0.5rem;">
                        Terakhir dicadangkan: <br><strong>${status.lastBackup ? lastBackupStr : 'Belum pernah'}</strong>
                    </div>
                    <div id="backup-dropdown-unsaved-info" style="font-size: 0.8rem; background: var(--pico-card-sectioning-background-color); padding: 0.5rem 0.75rem; border-radius: 8px; margin-top: 0.5rem;">
                        Memuat rincian perubahan baru...
                    </div>
                </div>
                
                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
                    <button class="btn-navy" style="flex: 1; font-size: 0.8rem; padding: 0.4rem 0.5rem; margin-bottom: 0; border-radius: 8px;" onclick="BackupAwareness.triggerBackup()">📥 Backup Sekarang</button>
                    <a href="/app/auth/settings/#section-backup" role="button" class="outline secondary" style="flex: 1; font-size: 0.8rem; padding: 0.4rem 0.5rem; margin-bottom: 0; border-radius: 8px; text-align: center; text-decoration: none;">⚙️ Setelan Sync</a>
                </div>
                <div id="dropdown-gdrive-sync-status" style="font-size: 0.75rem; text-align: center; color: var(--pico-secondary-color); border-top: 1px solid var(--pico-muted-border-color); padding-top: 0.5rem; margin-top: 0.5rem;">
                    Google Drive Sync: <strong>${driveConnected ? 'Aktif' : 'Belum Terhubung'}</strong>
                </div>
            </div>
        `;

        // Update detail data belum dibackup
        this._updateUnsavedInfo();
    },

    async _updateUnsavedInfo() {
        const infoEl = document.getElementById('backup-dropdown-unsaved-info');
        if (!infoEl) return;

        const stats = await this.getUnsavedStats();
        if (!stats) {
            infoEl.innerHTML = `⚠️ Gagal menghitung data aktif.`;
            return;
        }

        const appCount = stats.databases.length;
        if (appCount === 0 && stats.opfsFilesCount === 0) {
            infoEl.innerHTML = `Tidak ada data baru sejak backup terakhir.`;
            return;
        }

        let summaryHtml = `<div style="font-weight: 700; margin-bottom: 0.25rem;">Data dalam Brankas Anda:</div>`;
        stats.databases.forEach(db => {
            const cleanName = db.name.replace('tmpt_', '').toUpperCase();
            summaryHtml += `• ${cleanName}: ${db.totalRecords} data rekaman<br>`;
        });
        if (stats.opfsFilesCount > 0) {
            summaryHtml += `• File OPFS: ${stats.opfsFilesCount} berkas<br>`;
        }
        infoEl.innerHTML = summaryHtml;
    },

    toggleStatusDropdown(e) {
        if (e) e.stopPropagation();
        const dropdown = document.getElementById('header-backup-dropdown');
        if (!dropdown) return;

        const isVisible = dropdown.style.display !== 'none';
        
        // Tutup dropdown lain
        document.querySelectorAll('#tmpt-app-launcher-menu, #tmpt-profile-menu').forEach(menu => {
            menu.style.display = 'none';
        });

        dropdown.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            this._updateUnsavedInfo();
        }
    },

    // Toast reminder otomatis jika backup telah lewat batas pengingat
    maybeShowReminder() {
        const lastBackup = localStorage.getItem('tmpt_last_backup_at');
        const snooze = localStorage.getItem('tmpt_backup_reminder_snooze_until');
        const driveConnected = localStorage.getItem('tmpt_gdrive_connected') === 'true';

        // Jika Drive auto-sync aktif, tidak perlu memunculkan alert manual backup
        if (driveConnected) return;

        if (snooze && new Date(snooze) > new Date()) return;

        const limitDays = parseInt(localStorage.getItem('tmpt_backup_reminder_interval_days') || '7');
        
        let shouldShow = false;
        let daysStr = '';

        if (!lastBackup) {
            shouldShow = true;
            daysStr = 'Anda belum pernah mem-backup data Anda!';
        } else {
            const days = this._daysSince(lastBackup);
            if (days >= limitDays) {
                shouldShow = true;
                daysStr = `Sudah ${days} hari sejak backup terakhir Anda.`;
            }
        }

        if (shouldShow && window.TMPT_UI) {
            // Tampilkan toast kustom non-intrusif
            let container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                document.body.appendChild(container);
            }

            const alertBox = document.createElement('div');
            alertBox.className = `toast toast-warning`;
            alertBox.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                padding: 1rem;
                min-width: 320px;
                border-left: 5px solid #ef4444;
            `;
            alertBox.innerHTML = `
                <div style="font-weight: 700;">💾 Amankan Data TMPT Anda</div>
                <div style="font-size: 0.85rem; color: var(--pico-color);">${daysStr} Data hanya tersimpan di peramban komputer ini.</div>
                <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem;">
                    <button class="btn-navy" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; margin: 0; width: auto; border-radius: 6px;" onclick="BackupAwareness.triggerBackup(); this.closest('.toast').remove();">Backup Sekarang</button>
                    <button class="outline secondary" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; margin: 0; width: auto; border-radius: 6px;" onclick="BackupAwareness.snoozeReminder(); this.closest('.toast').remove();">Nanti</button>
                </div>
            `;
            container.appendChild(alertBox);
            
            // Hapus otomatis setelah 10 detik
            setTimeout(() => {
                if (alertBox) {
                    alertBox.style.opacity = '0';
                    setTimeout(() => alertBox.remove(), 300);
                }
            }, 10000);
        }
    },

    snoozeReminder() {
        const snoozeUntil = new Date();
        snoozeUntil.setDate(snoozeUntil.getDate() + 3); // Snooze selama 3 hari
        localStorage.setItem('tmpt_backup_reminder_snooze_until', snoozeUntil.toISOString());
    },

    _daysSince(isoString) {
        return Math.floor((Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60 * 24));
    },

    _hoursSince(isoString) {
        return (Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60);
    },

    async triggerBackup() {
        if (!window.TMPT_Backup) {
            await this._loadScript('/shared/backup.js');
        }
        if (window.TMPT_Backup) {
            await window.TMPT_Backup.exportVault();
        }
    },

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
};

window.BackupAwareness = BackupAwareness;

// Tutup dropdown status backup saat klik luar
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('header-backup-dropdown');
    if (dropdown && dropdown.style.display !== 'none' && !e.target.closest('#header-backup-status-container')) {
        dropdown.style.display = 'none';
    }
});
