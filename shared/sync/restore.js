/**
 * TMPT Restore Module
 * Mengelola restore data dari snapshot lokal (OPFS) atau cloud (Google Drive).
 * Sebelum restore, otomatis membuat backup snapshot terbaru sebagai safety net.
 */

const TMPT_Restore = {

    // === Restore dari Snapshot Lokal (OPFS) ===

    async restoreFromLocal(filename) {
        const confirmed = await this._confirmRestore(
            `Restore dari snapshot lokal: ${this._formatFilename(filename)}`,
            'Semua data saat ini akan digantikan oleh snapshot ini. Lanjutkan?'
        );
        if (!confirmed) return false;

        if (window.TMPT_UI) window.TMPT_UI.showLoader('Membaca snapshot lokal...');

        try {
            const blob = await window.TMPT_SnapshotEngine?.getLocalSnapshotBlob(filename);
            if (!blob) throw new Error('Snapshot tidak ditemukan di penyimpanan lokal.');

            await this._importSnapshotBlob(blob);
            return true;

        } catch(err) {
            console.error('[Restore] Restore lokal gagal:', err);
            if (window.TMPT_UI) {
                window.TMPT_UI.hideLoader();
                window.TMPT_UI.toast('Restore gagal: ' + err.message, 'error');
            }
            return false;
        }
    },

    // === Restore dari Google Drive ===

    async restoreFromCloud(fileId, label = 'snapshot Drive') {
        const confirmed = await this._confirmRestore(
            `Restore dari Google Drive: ${label}`,
            'Semua data saat ini akan digantikan. Backup otomatis dibuat sebelum restore.'
        );
        if (!confirmed) return false;

        if (window.TMPT_UI) window.TMPT_UI.showLoader('Mengunduh dari Google Drive...');

        try {
            const provider = new GDriveSyncProvider();
            const blob     = await provider.download(fileId);

            if (window.TMPT_UI) window.TMPT_UI.showLoader('Mengimpor data...');
            await this._importSnapshotBlob(blob);
            return true;

        } catch(err) {
            console.error('[Restore] Restore cloud gagal:', err);
            if (window.TMPT_UI) {
                window.TMPT_UI.hideLoader();
                window.TMPT_UI.toast('Restore dari Drive gagal: ' + err.message, 'error');
            }
            return false;
        }
    },

    // === Restore dari Snapshot Latest di Drive (First-time setup) ===

    async restoreLatestFromCloud() {
        if (window.TMPT_UI) window.TMPT_UI.showLoader('Mencari data di Google Drive...');

        try {
            const provider = new GDriveSyncProvider();
            const isAuth   = await provider.isAuthenticated();
            if (!isAuth) {
                throw new Error('Belum terhubung ke Google Drive.');
            }

            const latest = await provider.findFileByName('tmpt-latest.tmpt');
            if (!latest) {
                if (window.TMPT_UI) {
                    window.TMPT_UI.hideLoader();
                    window.TMPT_UI.toast('Tidak ada data ditemukan di Google Drive.', 'info');
                }
                return false;
            }

            if (window.TMPT_UI) window.TMPT_UI.showLoader('Mengunduh snapshot terbaru...');
            const blob = await provider.download(latest.id);

            if (window.TMPT_UI) window.TMPT_UI.showLoader('Mengimpor data...');
            await this._importSnapshotBlob(blob, false); // Tidak perlu konfirmasi lagi
            return true;

        } catch(err) {
            console.error('[Restore] Restore latest cloud gagal:', err);
            if (window.TMPT_UI) {
                window.TMPT_UI.hideLoader();
                window.TMPT_UI.toast('Restore gagal: ' + err.message, 'error');
            }
            return false;
        }
    },

    // === Core Import Logic ===

    async _importSnapshotBlob(blob, showSuccess = true) {
        // Snapshot TMPT Sync memiliki format berbeda dari backup.js:
        // /apps/*.json (bukan /databases/*.json)
        // Coba detect format berdasarkan isi ZIP

        try {
            const JSZip = await this._loadJSZip();
            const zip   = await JSZip.loadAsync(blob);

            // Cek manifest
            const manifestFile = zip.file('manifest.json');
            if (!manifestFile) {
                // Fallback: mungkin format backup.js lama
                if (window.TMPT_Backup) {
                    await window.TMPT_Backup.importVault(blob);
                    return;
                }
                throw new Error('Format snapshot tidak valid (manifest.json tidak ditemukan).');
            }

            const manifest = JSON.parse(await manifestFile.async('string'));

            // Detect format dengan memindai berkas secara langsung (JSZip.folder() selalu bernilai true)
            let hasAppsFolder = false;
            let hasDatabasesFolder = false;
            zip.forEach((path) => {
                if (path.startsWith('apps/')) hasAppsFolder = true;
                if (path.startsWith('databases/')) hasDatabasesFolder = true;
            });

            if (hasAppsFolder) {
                // Format lama (apps/)
                await this._importSyncFormat(zip, manifest);
            } else if (hasDatabasesFolder) {
                // Format standar (databases/)
                if (window.TMPT_Backup) {
                    await window.TMPT_Backup.importVault(blob);
                    return;
                }
                await this._importLegacyFormat(zip);
            } else {
                throw new Error('Format snapshot tidak dikenali.');
            }

            if (showSuccess && window.TMPT_UI) {
                window.TMPT_UI.hideLoader();
                window.TMPT_UI.toast('✓ Data berhasil di-restore dari snapshot!', 'success');
            }

            setTimeout(() => {
                if (window.TMPT_Auth?.lock) {
                    window.TMPT_Auth.lock();
                } else {
                    window.location.reload();
                }
            }, 1500);

        } catch(err) {
            throw err; // Re-throw untuk ditangani caller
        }
    },

    async _importSyncFormat(zip, manifest) {
        // 1. LocalStorage
        if (window.TMPT_UI) window.TMPT_UI.showLoader('Memulihkan preferensi...');
        const lsFile = zip.file('localstorage.json');
        if (lsFile) {
            const lsData = JSON.parse(await lsFile.async('string'));
            const SKIP_KEYS = ['tmpt_sync_tokens', 'gdrive_access_token', 'gdrive_token_expires_at',
                               'tmpt_gdrive_connected', 'tmpt_gdrive_email', 'tmpt_gdrive_last_sync',
                               'tmpt_device_id'];

            const PREFIXES = ['tmpt_', 'catat_', 'hitung_', 'slide_', 'tugas_', 'kalender_'];
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!SKIP_KEYS.includes(key) && PREFIXES.some(p => key.startsWith(p))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
            Object.entries(lsData).forEach(([k, v]) => {
                if (!SKIP_KEYS.includes(k)) localStorage.setItem(k, v);
            });
        }

        // 2. IndexedDB dari /apps/*.json
        if (window.TMPT_UI) window.TMPT_UI.showLoader('Memulihkan basis data aplikasi...');
        const appsFolder = zip.folder('apps');
        if (appsFolder) {
            // Gunakan registry terpusat dari shared/database.js
            const OLD_APP_TO_DB = (typeof window !== 'undefined' && window.TMPT_OLD_APP_TO_DB)
                ? window.TMPT_OLD_APP_TO_DB
                : {
                    'tulis': 'tmpt_tulis', 'hitung': 'tmpt_hitung',
                    'slide': 'tmpt_slides', 'forms': 'tmpt_forms',
                    'kalender': 'tmpt_kalender', 'tugas': 'tmpt_tugas',
                    'catatan': 'tmpt_catatan', 'markdown': 'tmpt_markdown',
                    'berkas': 'tmpt_berkas', 'code': 'tmpt_code',
                    'diagram': 'tmpt_diagram', 'vault': 'tmpt_vault',
                    'qr': 'tmpt_qr', 'regex': 'tmpt_regex', 'json': 'tmpt_json',
                    'project': 'tmpt_project', 'pomodoro': 'tmpt_pomodoro',
                    'papan': 'tmpt_papan'
                };

            const appFiles = [];
            appsFolder.forEach((path, entry) => {
                if (!entry.dir && path.endsWith('.json')) appFiles.push(entry);
            });

            for (const appFile of appFiles) {
                try {
                    const rawContent = JSON.parse(await appFile.async('string'));
                    let dbContent = rawContent;

                    if (!rawContent.databaseName) {
                        const shortName = appFile.name.replace(/^apps\//, '').replace('.json', '');
                        const dbName = OLD_APP_TO_DB[shortName] || `tmpt_${shortName}`;
                        dbContent = {
                            databaseName: dbName,
                            version: rawContent.version || 1,
                            stores: rawContent.stores || rawContent
                        };
                    } else {
                        if (!rawContent.databaseName.startsWith('tmpt_')) {
                            dbContent.databaseName = `tmpt_${rawContent.databaseName}`;
                        }
                    }
                    await this._restoreDatabase(dbContent);
                } catch(err) {
                    console.error("Gagal restore file apps/ dalam sync:", appFile.name, err);
                }
            }
        }
    },

    async _importLegacyFormat(zip) {
        const dbFolder = zip.folder('databases');
        if (!dbFolder) return;

        const dbFiles = [];
        dbFolder.forEach((path, entry) => {
            if (!entry.dir) dbFiles.push(entry);
        });

        for (const dbFile of dbFiles) {
            try {
                const content = JSON.parse(await dbFile.async('string'));
                await this._restoreDatabase(content);
            } catch(err) {
                console.error("Gagal restore file databases/ dalam sync:", dbFile.name, err);
            }
        }
    },

    async _restoreDatabase(dbContent) {
        const { databaseName, stores } = dbContent;
        return new Promise((resolve, reject) => {
            // 1. Open tanpa versi untuk cek kondisi saat ini
            const openReq = indexedDB.open(databaseName);
            openReq.onsuccess = (e) => {
                const db = e.target.result;
                const currentVersion = db.version;
                
                // Cari store yang belum ada di database browser
                const missingStores = Object.keys(stores).filter(name => !db.objectStoreNames.contains(name));
                
                if (missingStores.length > 0) {
                    db.close();
                    const upgradeReq = indexedDB.open(databaseName, currentVersion + 1);
                    upgradeReq.onupgradeneeded = (ev) => {
                        const upgradeDb = ev.target.result;
                        missingStores.forEach(storeName => {
                            let keyPath = 'id';
                            if (storeName === 'settings' || storeName === 'config') keyPath = 'key';
                            else if (storeName === 'tags' && databaseName === 'tmpt_tugas') keyPath = 'name';
                            upgradeDb.createObjectStore(storeName, { keyPath });
                        });
                    };
                    upgradeReq.onsuccess = (ev) => {
                        const upgradedDb = ev.target.result;
                        this._writeToStores(upgradedDb, stores).then(resolve).catch(reject);
                    };
                    upgradeReq.onerror = (ev) => reject(ev.target.error);
                } else {
                    this._writeToStores(db, stores).then(resolve).catch(reject);
                }
            };
            openReq.onupgradeneeded = (e) => {
                const db = e.target.result;
                Object.keys(stores).forEach(storeName => {
                    let keyPath = 'id';
                    if (storeName === 'settings' || storeName === 'config') keyPath = 'key';
                    else if (storeName === 'tags' && databaseName === 'tmpt_tugas') keyPath = 'name';
                    db.createObjectStore(storeName, { keyPath });
                });
            };
            openReq.onerror = (e) => reject(e.target.error);
        });
    },

    _writeToStores(db, stores) {
        return new Promise((resolve, reject) => {
            const storeNames = Object.keys(stores).filter(name => db.objectStoreNames.contains(name));
            if (storeNames.length === 0) { db.close(); resolve(); return; }

            const tx = db.transaction(storeNames, 'readwrite');
            storeNames.forEach(storeName => {
                const store = tx.objectStore(storeName);
                store.clear();
                (stores[storeName] || []).forEach(item => {
                    try {
                        const req = store.put(item);
                        req.onerror = (e) => {
                            console.warn(`[Restore] Gagal menulis ke ${storeName}:`, e.target.error, item);
                            e.preventDefault();
                            e.stopPropagation();
                        };
                    } catch(err) {
                        console.warn(`[Restore] Exception put ke ${storeName}:`, err, item);
                    }
                });
            });
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = (err) => { db.close(); reject(tx.error || err); };
        });
    },

    // === UI Helpers ===

    _confirmRestore(title, message) {
        return new Promise(resolve => {
            if (window.TMPT_UI?.confirm) {
                window.TMPT_UI.confirm(message, "KONFIRMASI", title).then(resolve);
                return;
            }
            resolve(window.confirm(`${title}\n\n${message}`));
        });
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

window.TMPT_Restore = TMPT_Restore;
