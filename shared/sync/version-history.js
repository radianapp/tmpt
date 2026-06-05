/**
 * TMPT Version History
 * Menampilkan daftar snapshot lokal (OPFS) dan cloud (Google Drive)
 * dalam sebuah modal picker untuk restore.
 */

const TMPT_VersionHistory = {

    _modal: null,

    /**
     * Tampilkan modal version history.
     */
    async show() {
        this._removeModal();
        this._modal = this._buildModal();
        document.body.appendChild(this._modal);
        this._modal.showModal();

        // Load data
        this._loadLocalSnapshots();
        this._loadCloudSnapshots();
    },

    // === Modal Builder ===

    _buildModal() {
        const dialog = document.createElement('dialog');
        dialog.id    = 'tmpt-version-history-modal';
        dialog.style.cssText = 'border-radius: 20px; padding: 0; max-width: 700px; width: 95%; max-height: 90vh; overflow: hidden; border: 1px solid var(--pico-muted-border-color);';

        dialog.innerHTML = `
            <article style="margin: 0; padding: 0; border: none; box-shadow: none; border-radius: 20px; overflow: hidden; max-height: 90vh; display: flex; flex-direction: column;">
                <!-- Header -->
                <header style="display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--pico-muted-border-color); background: var(--pico-card-background-color); flex-shrink: 0;">
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--pico-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
                        <strong style="font-size: 1.05rem;">Riwayat Versi TMPT</strong>
                    </div>
                    <button id="btn-vh-close" aria-label="Tutup" style="background: transparent; border: none; cursor: pointer; padding: 0.25rem; color: var(--pico-muted-color); display: flex; align-items: center; border-radius: 50%; width: 32px; height: 32px; justify-content: center;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </header>

                <!-- Warning -->
                <div style="padding: 0.75rem 1.5rem; background: rgba(245,158,11,0.07); border-bottom: 1px solid rgba(245,158,11,0.2); flex-shrink: 0;">
                    <small style="color: #d97706;">
                        ⚠️ Restore akan <strong>menggantikan semua data saat ini</strong>. Snapshot keamanan dibuat otomatis sebelum restore.
                    </small>
                </div>

                <!-- Content -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; flex: 1; overflow: hidden; min-height: 0;">

                    <!-- Panel Lokal -->
                    <div style="display: flex; flex-direction: column; border-right: 1px solid var(--pico-muted-border-color); overflow: hidden;">
                        <div style="padding: 0.85rem 1.25rem; border-bottom: 1px solid var(--pico-muted-border-color); background: var(--pico-card-sectioning-background-color); flex-shrink: 0;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--pico-muted-color);">
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
                                Perangkat Ini
                            </div>
                        </div>
                        <div id="vh-local-list" style="flex: 1; overflow-y: auto; padding: 0.5rem;">
                            <div style="text-align: center; padding: 2rem; color: var(--pico-muted-color);">
                                <span aria-busy="true"></span>
                                <div style="margin-top: 0.5rem; font-size: 0.85rem;">Memuat snapshot lokal...</div>
                            </div>
                        </div>
                    </div>

                    <!-- Panel Cloud -->
                    <div style="display: flex; flex-direction: column; overflow: hidden;">
                        <div style="padding: 0.85rem 1.25rem; border-bottom: 1px solid var(--pico-muted-border-color); background: var(--pico-card-sectioning-background-color); flex-shrink: 0;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--pico-muted-color);">
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
                                Google Drive
                            </div>
                        </div>
                        <div id="vh-cloud-list" style="flex: 1; overflow-y: auto; padding: 0.5rem;">
                            <div style="text-align: center; padding: 2rem; color: var(--pico-muted-color);">
                                <span aria-busy="true"></span>
                                <div style="margin-top: 0.5rem; font-size: 0.85rem;">Memuat snapshot cloud...</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <footer style="padding: 1rem 1.5rem; border-top: 1px solid var(--pico-muted-border-color); display: flex; justify-content: flex-end; gap: 0.75rem; flex-shrink: 0; background: var(--pico-card-background-color);">
                    <button id="btn-vh-cancel" class="outline secondary" style="margin: 0; border-radius: 10px; padding: 0.5rem 1.25rem; width: auto;">Tutup</button>
                </footer>
            </article>
        `;

        dialog.querySelector('#btn-vh-close').onclick   = () => this._removeModal();
        dialog.querySelector('#btn-vh-cancel').onclick  = () => this._removeModal();
        dialog.addEventListener('click', (e) => { if (e.target === dialog) this._removeModal(); });

        return dialog;
    },

    // === Load Data ===

    async _loadLocalSnapshots() {
        const container = document.getElementById('vh-local-list');
        if (!container) return;

        try {
            const snapshots = await window.TMPT_SnapshotEngine?.listLocalSnapshots() || [];

            if (snapshots.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: var(--pico-muted-color);">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">📭</div>
                        <div style="font-size: 0.85rem;">Belum ada snapshot lokal.</div>
                        <div style="font-size: 0.75rem; margin-top: 0.25rem;">Snapshot dibuat otomatis saat Anda mengedit.</div>
                    </div>`;
                return;
            }

            container.innerHTML = snapshots.map((s, i) => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0.75rem; border-radius: 10px; margin-bottom: 0.35rem; background: var(--pico-card-sectioning-background-color); gap: 0.5rem;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 0.4rem;">
                            ${i === 0 ? '<span style="font-size: 0.65rem; background: #10b981; color: white; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 700; flex-shrink: 0;">TERBARU</span>' : ''}
                            <span style="font-size: 0.8rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this._formatDate(s.created_at)}</span>
                        </div>
                        <div style="font-size: 0.72rem; color: var(--pico-muted-color); margin-top: 0.15rem;">${this._formatSize(s.size)}</div>
                    </div>
                    <button
                        class="outline secondary"
                        style="margin: 0; padding: 0.3rem 0.65rem; font-size: 0.72rem; border-radius: 8px; white-space: nowrap; flex-shrink: 0; width: auto;"
                        onclick="TMPT_VersionHistory._doLocalRestore('${s.filename}')"
                        aria-label="Restore snapshot ${this._formatDate(s.created_at)}">
                        Restore
                    </button>
                </div>
            `).join('');

        } catch(err) {
            container.innerHTML = `<div style="padding: 1rem; color: #ef4444; font-size: 0.85rem;">Gagal memuat snapshot: ${err.message}</div>`;
        }
    },

    async _loadCloudSnapshots() {
        const container = document.getElementById('vh-cloud-list');
        if (!container) return;

        const isConnected = window.TMPT_TokenManager?.isConnected();
        if (!isConnected) {
            container.innerHTML = `
                <div style="text-align: center; padding: 1.5rem 1rem; color: var(--pico-muted-color);">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">☁️</div>
                    <div style="font-size: 0.85rem; margin-bottom: 1rem;">Google Drive belum terhubung.</div>
                    <button onclick="TMPT_TokenManager.initiateAuth()" style="font-size: 0.8rem; padding: 0.35rem 0.75rem; border-radius: 8px; margin: 0; width: auto;">
                        Hubungkan Drive
                    </button>
                </div>`;
            return;
        }

        try {
            const provider  = new GDriveSyncProvider();
            const allFiles  = await provider.listFiles();
            const snapshots = allFiles
                .filter(f => f.name.startsWith('tmpt-') && f.name.endsWith('.tmpt') && f.name !== 'tmpt-latest.tmpt')
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            const latestFile = allFiles.find(f => f.name === 'tmpt-latest.tmpt');

            if (snapshots.length === 0 && !latestFile) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: var(--pico-muted-color);">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">📭</div>
                        <div style="font-size: 0.85rem;">Belum ada snapshot di Drive.</div>
                    </div>`;
                return;
            }

            const email = window.TMPT_TokenManager.getEmail();
            const items = [];

            if (latestFile) {
                items.push(`
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0.75rem; border-radius: 10px; margin-bottom: 0.35rem; background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2); gap: 0.5rem;">
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 0.4rem;">
                                <span style="font-size: 0.65rem; background: #3b82f6; color: white; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 700; flex-shrink: 0;">TERBARU</span>
                                <span style="font-size: 0.8rem; font-weight: 600;">${this._formatDate(latestFile.modifiedAt || latestFile.createdAt)}</span>
                            </div>
                            <div style="font-size: 0.72rem; color: var(--pico-muted-color); margin-top: 0.15rem;">${this._formatSize(latestFile.size)} · ${email || 'Drive'}</div>
                        </div>
                        <button
                            class="outline secondary"
                            style="margin: 0; padding: 0.3rem 0.65rem; font-size: 0.72rem; border-radius: 8px; white-space: nowrap; flex-shrink: 0; width: auto;"
                            onclick="TMPT_VersionHistory._doCloudRestore('${latestFile.id}', 'Versi Terbaru (Cloud)')"
                            aria-label="Restore versi terbaru dari Drive">
                            Restore
                        </button>
                    </div>`);
            }

            snapshots.slice(0, 9).forEach(s => {
                items.push(`
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0.75rem; border-radius: 10px; margin-bottom: 0.35rem; background: var(--pico-card-sectioning-background-color); gap: 0.5rem;">
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 0.8rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this._formatDate(s.createdAt)}</div>
                            <div style="font-size: 0.72rem; color: var(--pico-muted-color); margin-top: 0.15rem;">${this._formatSize(s.size)}</div>
                        </div>
                        <button
                            class="outline secondary"
                            style="margin: 0; padding: 0.3rem 0.65rem; font-size: 0.72rem; border-radius: 8px; white-space: nowrap; flex-shrink: 0; width: auto;"
                            onclick="TMPT_VersionHistory._doCloudRestore('${s.id}', '${this._formatDate(s.createdAt)}')"
                            aria-label="Restore dari ${this._formatDate(s.createdAt)}">
                            Restore
                        </button>
                    </div>`);
            });

            container.innerHTML = items.join('');

        } catch(err) {
            container.innerHTML = `<div style="padding: 1rem; color: #ef4444; font-size: 0.85rem;">Gagal memuat Drive: ${err.message}</div>`;
        }
    },

    // === Actions ===

    async _doLocalRestore(filename) {
        this._removeModal();
        await window.TMPT_Restore?.restoreFromLocal(filename);
    },

    async _doCloudRestore(fileId, label) {
        this._removeModal();
        await window.TMPT_Restore?.restoreFromCloud(fileId, label);
    },

    // === Helpers ===

    _removeModal() {
        if (this._modal) {
            this._modal.close();
            this._modal.remove();
            this._modal = null;
        }
    },

    _formatDate(isoOrDate) {
        try {
            return new Intl.DateTimeFormat('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            }).format(new Date(isoOrDate));
        } catch(e) {
            return String(isoOrDate);
        }
    },

    _formatSize(bytes) {
        if (!bytes || bytes === 0) return '—';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    },
};

window.TMPT_VersionHistory = TMPT_VersionHistory;
