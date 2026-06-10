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
                    <div style="display: flex; gap: 0.35rem; flex-shrink: 0;">
                        <button
                            class="outline secondary"
                            style="margin: 0; padding: 0.3rem 0.65rem; font-size: 0.72rem; border-radius: 8px; white-space: nowrap; width: auto;"
                            onclick="TMPT_VersionHistory._showListDataLocal('${s.filename}')"
                            aria-label="List data snapshot lokal ${this._formatDate(s.created_at)}">
                            List Data
                        </button>
                        <button
                            class="outline secondary"
                            style="margin: 0; padding: 0.3rem 0.65rem; font-size: 0.72rem; border-radius: 8px; white-space: nowrap; width: auto;"
                            onclick="TMPT_VersionHistory._doLocalRestore('${s.filename}')"
                            aria-label="Restore snapshot ${this._formatDate(s.created_at)}">
                            Restore
                        </button>
                    </div>
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
                const latestLabel = this._formatDate(latestFile.modifiedAt || latestFile.createdAt);
                items.push(`
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0.75rem; border-radius: 10px; margin-bottom: 0.35rem; background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2); gap: 0.5rem;">
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 0.4rem;">
                                <span style="font-size: 0.65rem; background: #3b82f6; color: white; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 700; flex-shrink: 0;">TERBARU</span>
                                <span style="font-size: 0.8rem; font-weight: 600;">${latestLabel}</span>
                            </div>
                            <div style="font-size: 0.72rem; color: var(--pico-muted-color); margin-top: 0.15rem;">${this._formatSize(latestFile.size)} · ${email || 'Drive'}</div>
                        </div>
                        <div style="display: flex; gap: 0.35rem; flex-shrink: 0;">
                            <button
                                class="outline secondary"
                                style="margin: 0; padding: 0.3rem 0.65rem; font-size: 0.72rem; border-radius: 8px; white-space: nowrap; width: auto;"
                                onclick="TMPT_VersionHistory._showListDataCloud('${latestFile.id}', 'Versi Terbaru (Cloud)')"
                                aria-label="List data versi terbaru dari Drive">
                                List Data
                            </button>
                            <button
                                class="outline secondary"
                                style="margin: 0; padding: 0.3rem 0.65rem; font-size: 0.72rem; border-radius: 8px; white-space: nowrap; width: auto;"
                                onclick="TMPT_VersionHistory._doCloudRestore('${latestFile.id}', 'Versi Terbaru (Cloud)')"
                                aria-label="Restore versi terbaru dari Drive">
                                Restore
                            </button>
                        </div>
                    </div>`);
            }

            snapshots.slice(0, 9).forEach(s => {
                const label = this._formatDate(s.createdAt);
                items.push(`
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0.75rem; border-radius: 10px; margin-bottom: 0.35rem; background: var(--pico-card-sectioning-background-color); gap: 0.5rem;">
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 0.8rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${label}</div>
                            <div style="font-size: 0.72rem; color: var(--pico-muted-color); margin-top: 0.15rem;">${this._formatSize(s.size)}</div>
                        </div>
                        <div style="display: flex; gap: 0.35rem; flex-shrink: 0;">
                            <button
                                class="outline secondary"
                                style="margin: 0; padding: 0.3rem 0.65rem; font-size: 0.72rem; border-radius: 8px; white-space: nowrap; width: auto;"
                                onclick="TMPT_VersionHistory._showListDataCloud('${s.id}', '${label}')"
                                aria-label="List data snapshot dari ${label}">
                                List Data
                            </button>
                            <button
                                class="outline secondary"
                                style="margin: 0; padding: 0.3rem 0.65rem; font-size: 0.72rem; border-radius: 8px; white-space: nowrap; width: auto;"
                                onclick="TMPT_VersionHistory._doCloudRestore('${s.id}', '${label}')"
                                aria-label="Restore dari ${label}">
                                Restore
                            </button>
                        </div>
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

    async _showListDataLocal(filename) {
        if (window.TMPT_UI) window.TMPT_UI.showLoader('Membaca snapshot lokal...');
        try {
            const blob = await window.TMPT_SnapshotEngine?.getLocalSnapshotBlob(filename);
            if (!blob) throw new Error('Snapshot tidak ditemukan di penyimpanan lokal.');
            const details = await this._getBackupDetails(blob);
            if (window.TMPT_UI) window.TMPT_UI.hideLoader();
            this._showDetailsModal(`Snapshot Lokal: ${this._formatFilename(filename)}`, details);
        } catch(err) {
            console.error(err);
            if (window.TMPT_UI) {
                window.TMPT_UI.hideLoader();
                window.TMPT_UI.toast('Gagal melihat isi snapshot: ' + err.message, 'error');
            }
        }
    },

    async _showListDataCloud(fileId, label) {
        if (window.TMPT_UI) window.TMPT_UI.showLoader('Mengunduh snapshot dari Google Drive...');
        try {
            const provider = new GDriveSyncProvider();
            const blob     = await provider.download(fileId);
            if (window.TMPT_UI) window.TMPT_UI.showLoader('Mengekstrak rincian data...');
            const details = await this._getBackupDetails(blob);
            if (window.TMPT_UI) window.TMPT_UI.hideLoader();
            this._showDetailsModal(`Snapshot Cloud: ${label}`, details);
        } catch(err) {
            console.error(err);
            if (window.TMPT_UI) {
                window.TMPT_UI.hideLoader();
                window.TMPT_UI.toast('Gagal melihat isi snapshot: ' + err.message, 'error');
            }
        }
    },

    async _getBackupDetails(blob) {
        let zipData = null;
        try {
            const text = await blob.text();
            const parsed = JSON.parse(text);
            if (parsed.format === "tmpt-encrypted-v2" && parsed.payload) {
                const key = window.TMPT_Auth?.getKey();
                if (!key) {
                    throw new Error("Brankas Anda dalam kondisi terkunci. Harap buka kunci Brankas Anda terlebih dahulu untuk mendekripsi file backup.");
                }
                const decryptedBase64 = await window.TMPT_Crypto.decrypt(parsed.payload, key);
                const binaryString = atob(decryptedBase64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                zipData = bytes.buffer;
            } else {
                zipData = blob;
            }
        } catch (jsonErr) {
            zipData = blob;
        }

        const JSZip = await this._loadJSZip();
        const zip = await JSZip.loadAsync(zipData);

        const details = {
            databases: [],
            opfsFiles: [],
            localStorageCount: 0
        };

        let lsData = {};
        const lsFile = zip.file('localstorage.json');
        if (lsFile) {
            try {
                lsData = JSON.parse(await lsFile.async('string'));
                details.localStorageCount = Object.keys(lsData).length;
            } catch(e) {}
        }

        const dbFiles = [];
        const opfsFiles = [];

        zip.forEach((path, entry) => {
            if (entry.dir) return;
            if (path.startsWith('databases/') && path.endsWith('.json')) {
                dbFiles.push({ entry, folder: 'databases/' });
            } else if (path.startsWith('apps/') && path.endsWith('.json')) {
                dbFiles.push({ entry, folder: 'apps/' });
            } else if (path.startsWith('opfs/')) {
                opfsFiles.push(entry);
            }
        });

        for (const { entry, folder } of dbFiles) {
            try {
                const content = JSON.parse(await entry.async('string'));
                const dbName = content.databaseName || entry.name.split('/').pop().replace('.json', '');
                let totalRecords = 0;
                let stores = [];

                if (dbName === 'tmpt_hitung') {
                    let count = 0;
                    Object.keys(lsData).forEach(key => {
                        if ((key.startsWith('hitung_file_') || key.startsWith('hitung_file_enc_')) && key !== 'hitung_file_list' && key !== 'hitung_file_list_enc') {
                            count++;
                        }
                    });
                    totalRecords = count;
                    stores = [{ name: 'lembar kerja', count }];
                } else if (dbName === 'tmpt_catatan') {
                    let count = 0;
                    if (lsData['catat_notes_enc'] || lsData['catat_lists_enc']) {
                        if (window.TMPT_Auth && window.TMPT_Auth.isUnlocked()) {
                            try {
                                const key = window.TMPT_Auth.getKey();
                                const encNotes = lsData['catat_notes_enc'];
                                const encLists = lsData['catat_lists_enc'];
                                if (encNotes) {
                                    const dec = await window.TMPT_Crypto.decrypt(JSON.parse(encNotes), key);
                                    count += JSON.parse(dec).length;
                                }
                                if (encLists) {
                                    const dec = await window.TMPT_Crypto.decrypt(JSON.parse(encLists), key);
                                    count += JSON.parse(dec).length;
                                }
                            } catch(e) {
                                count = -1;
                            }
                        } else {
                            count = -1;
                        }
                    } else {
                        const notes = lsData['catat_notes'];
                        const lists = lsData['catat_lists'];
                        if (notes) { try { count += JSON.parse(notes).length; } catch(e){} }
                        if (lists) { try { count += JSON.parse(lists).length; } catch(e){} }
                    }
                    totalRecords = count;
                    stores = count === -1 ? [{ name: 'terenkripsi', count: '?' }] : [{ name: 'catatan/tugas', count }];
                } else if (dbName === 'tmpt_vault') {
                    let count = 0;
                    const activeVaultKey = lsData['tmpt_active_vault_id'] || 'tmpt_vault_v1';
                    const vaultRaw = lsData[activeVaultKey];
                    if (vaultRaw) {
                        try {
                            const vaultData = JSON.parse(vaultRaw);
                            if (vaultData.payload) {
                                if (window.TMPT_Auth && window.TMPT_Auth.isUnlocked()) {
                                    const key = window.TMPT_Auth.getKey();
                                    const dec = await window.TMPT_Crypto.decrypt(vaultData.payload, key);
                                    const items = JSON.parse(dec);
                                    count = Array.isArray(items) ? items.length : 0;
                                } else {
                                    count = -1;
                                }
                            }
                        } catch(e) {
                            count = -1;
                        }
                    }
                    totalRecords = count;
                    stores = count === -1 ? [{ name: 'terenkripsi', count: '?' }] : [{ name: 'item', count }];
                } else {
                    if (content.stores) {
                        Object.entries(content.stores).forEach(([storeName, items]) => {
                            const count = Array.isArray(items) ? items.length : 0;
                            totalRecords += count;
                            stores.push({ name: storeName, count });
                        });
                    }
                }

                details.databases.push({
                    name: dbName,
                    totalRecords,
                    stores,
                    folder
                });
            } catch(e) {
                console.warn("Gagal parse database file:", entry.name, e);
            }
        }

        for (const file of opfsFiles) {
            const name = file.name.split('/').pop();
            const size = file._data?.uncompressedSize || 0;
            details.opfsFiles.push({ name, size });
        }

        return details;
    },

    _showDetailsModal(label, details) {
        const dialog = document.createElement('dialog');
        dialog.style.cssText = 'border-radius: 20px; padding: 0; max-width: 550px; width: 95%; max-height: 80vh; overflow: hidden; border: 1px solid var(--pico-muted-border-color); z-index: 10000;';

        const formatBytes = (bytes) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        const dbHtml = details.databases.map(db => {
            const cleanName = db.name.replace('tmpt_', '');
            
            // Pemetaan nama aplikasi ramah pengguna
            const appNames = {
                'berkas': 'BERKAS',
                'tulis': 'TULIS',
                'hitung': 'HITUNG',
                'slide': 'SLIDE',
                'forms': 'FORMS',
                'kalender': 'KALENDER',
                'tugas': 'TUGAS',
                'catatan': 'CATATAN',
                'markdown': 'MARKDOWN',
                'vault': 'VAULT (BRANKAS)',
                'code': 'CODE',
                'diagram': 'DIAGRAM',
                'project': 'PROJECT',
                'pomodoro': 'POMODORO',
                'json': 'JSON/YAML FORMATTER'
            };
            const displayName = appNames[cleanName] || cleanName.toUpperCase();

            return `
                <div style="padding: 0.5rem 0; border-bottom: 1px solid var(--pico-muted-border-color);">
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; align-items: center;">
                        <span>📂 Aplikasi ${displayName}</span>
                        <span>${db.totalRecords} data</span>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--pico-muted-color); padding-left: 1rem; margin-top: 0.15rem;">
                        ${db.stores.map(s => `${s.name}: ${s.count}`).join(', ') || 'tidak ada tabel data'}
                    </div>
                </div>
            `;
        }).join('') || '<div style="color: var(--pico-muted-color); font-size: 0.85rem;">Tidak ada database aplikasi.</div>';

        const opfsHtml = details.opfsFiles.map(f => `
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; padding: 0.25rem 0;">
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 0.5rem;">📄 ${f.name}</span>
                <span style="color: var(--pico-muted-color); flex-shrink: 0;">${formatBytes(f.size)}</span>
            </div>
        `).join('') || '<div style="color: var(--pico-muted-color); font-size: 0.85rem;">Tidak ada file biner (OPFS).</div>';

        dialog.innerHTML = `
            <article style="margin: 0; padding: 0; border: none; box-shadow: none; border-radius: 20px; overflow: hidden; display: flex; flex-direction: column; max-height: 80vh;">
                <header style="display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--pico-muted-border-color); background: var(--pico-card-background-color); flex-shrink: 0;">
                    <div>
                        <strong style="font-size: 1rem;">Isi Data Cadangan</strong>
                        <div style="font-size: 0.75rem; color: var(--pico-muted-color); font-weight: normal; margin-top: 0.15rem;">${label}</div>
                    </div>
                    <button id="btn-det-close" aria-label="Tutup" style="background: transparent; border: none; cursor: pointer; padding: 0.25rem; color: var(--pico-muted-color); display: flex; align-items: center; border-radius: 50%; width: 32px; height: 32px; justify-content: center;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </header>

                <div style="flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem;">
                    
                    <div>
                        <div style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--pico-muted-color); margin-bottom: 0.5rem; border-bottom: 1.5px solid var(--pico-muted-border-color); padding-bottom: 0.25rem;">
                            Basis Data Aplikasi
                        </div>
                        ${dbHtml}
                    </div>

                    <div>
                        <div style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--pico-muted-color); margin-bottom: 0.5rem; border-bottom: 1.5px solid var(--pico-muted-border-color); padding-bottom: 0.25rem;">
                            File Dokumen (OPFS)
                        </div>
                        <div style="max-height: 150px; overflow-y: auto; background: var(--pico-card-sectioning-background-color); padding: 0.5rem 0.75rem; border-radius: 8px;">
                            ${opfsHtml}
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; font-size: 0.8rem; background: var(--pico-card-sectioning-background-color); padding: 0.6rem 0.75rem; border-radius: 8px;">
                        <strong>Pengaturan & Preferensi</strong>
                        <span style="color: var(--pico-muted-color);">${details.localStorageCount} entri</span>
                    </div>

                </div>

                <footer style="padding: 1rem 1.5rem; border-top: 1px solid var(--pico-muted-border-color); display: flex; justify-content: flex-end; flex-shrink: 0; background: var(--pico-card-background-color);">
                    <button id="btn-det-ok" style="margin: 0; border-radius: 10px; padding: 0.5rem 1.5rem; width: auto;">Tutup</button>
                </footer>
            </article>
        `;

        document.body.appendChild(dialog);
        dialog.showModal();

        const close = () => { dialog.close(); dialog.remove(); };
        dialog.querySelector('#btn-det-close').onclick = close;
        dialog.querySelector('#btn-det-ok').onclick = close;
        dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
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

    _formatFilename(filename) {
        // tmpt-20260605_100000.tmpt → 5 Jun 2026, 10:00
        const match = filename.match(/tmpt-(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/);
        if (!match) return filename;
        const [, y, mo, d, h, mi] = match;
        try {
            return new Intl.DateTimeFormat('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            }).format(new Date(`${y}-${mo}-${d}T${h}:${mi}:00`));
        } catch(e) {
            return filename;
        }
    },

    async _loadJSZip() {
        if (window.JSZip) return window.JSZip;
        return new Promise((resolve, reject) => {
            const script  = document.createElement('script');
            script.src    = '/shared/vendor/jszip.min.js';
            script.onload = () => resolve(window.JSZip);
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },
};

window.TMPT_VersionHistory = TMPT_VersionHistory;

