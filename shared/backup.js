/**
 * TMPT Backup Module - Unified & Future-Proof
 * Handles exporting and importing encrypted zip-based backup (.tmpt)
 * Supports all IndexedDB databases (prefix tmpt_*), localStorage, and OPFS.
 */

const BackupModule = {
    // Lazy load JSZip from shared vendor folder
    async _loadJSZip() {
        if (window.JSZip) return window.JSZip;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/shared/vendor/jszip.min.js';
            script.onload = () => resolve(window.JSZip);
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    // Convert ArrayBuffer to Base64 without call stack limitations
    async _arrayBufferToBase64(buffer) {
        return new Promise((resolve) => {
            const blob = new Blob([buffer]);
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                const base64 = dataUrl.split(',')[1];
                resolve(base64);
            };
            reader.readAsDataURL(blob);
        });
    },

    // Get list of all databases starting with tmpt_
    async _getDatabases() {
        const defaultDbs = [
            'tmpt_berkas',
            'tmpt_tulis',
            'tmpt_hitung',
            'tmpt_slide',
            'tmpt_forms',
            'tmpt_kalender',
            'tmpt_tugas',
            'tmpt_catatan',
            'tmpt_vault',
            'tmpt_code',
            'tmpt_diagram',
            'tmpt_markdown',
            'tmpt_json'
        ];

        if (!indexedDB.databases) {
            return defaultDbs.map(name => ({ name }));
        }

        try {
            const dbs = await indexedDB.databases();
            const names = new Set(dbs.map(d => d.name).filter(name => name && name.startsWith('tmpt_')));
            // Ensure default databases are included just in case they haven't been created yet but might exist
            defaultDbs.forEach(name => names.add(name));
            return Array.from(names).map(name => ({ name }));
        } catch (e) {
            console.warn("Gagal mendapatkan daftar database dinamis, menggunakan fallback:", e);
            return defaultDbs.map(name => ({ name }));
        }
    },

    // Get records statistic for database
    async _getDatabaseStats(dbName) {
        return new Promise((resolve) => {
            const req = indexedDB.open(dbName);
            req.onsuccess = (e) => {
                const db = e.target.result;
                const storeNames = Array.from(db.objectStoreNames);
                if (storeNames.length === 0) {
                    db.close();
                    resolve({ name: dbName, totalRecords: 0 });
                    return;
                }

                let completed = 0;
                let totalRecords = 0;
                storeNames.forEach(storeName => {
                    try {
                        const tx = db.transaction(storeName, 'readonly');
                        const store = tx.objectStore(storeName);
                        const countReq = store.count();
                        countReq.onsuccess = () => {
                            totalRecords += countReq.result;
                            completed++;
                            if (completed === storeNames.length) {
                                db.close();
                                resolve({ name: dbName, totalRecords });
                            }
                        };
                        countReq.onerror = () => {
                            completed++;
                            if (completed === storeNames.length) {
                                db.close();
                                resolve({ name: dbName, totalRecords });
                            }
                        };
                    } catch (err) {
                        completed++;
                        if (completed === storeNames.length) {
                            db.close();
                            resolve({ name: dbName, totalRecords });
                        }
                    }
                });
            };
            req.onerror = () => resolve(null);
        });
    },

    // Calculate stats before backup
    async calculateBackupStats() {
        const stats = {
            localStorageSize: 0,
            opfsFilesCount: 0,
            opfsSize: 0,
            databases: []
        };

        // 1. LocalStorage size
        let lsBytes = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('tmpt_') || key.startsWith('catat_') || key.startsWith('hitung_') || key.startsWith('slide_') || key.startsWith('tugas_') || key.startsWith('kalender_')) {
                lsBytes += (key.length + (localStorage.getItem(key) || '').length) * 2;
            }
        }
        stats.localStorageSize = lsBytes;

        // 2. OPFS files size
        try {
            let root;
            try {
                root = await navigator.storage.getDirectory();
            } catch(e) {
                if (window.TMPT_OPFS && window.TMPT_OPFS.getOpfsRoot) root = await window.TMPT_OPFS.getOpfsRoot();
            }
            if (root) {
                for await (const entry of root.values()) {
                    if (entry.kind === 'file') {
                        const file = await entry.getFile();
                        stats.opfsFilesCount++;
                        stats.opfsSize += file.size;
                    }
                }
            }
        } catch (e) {
            console.warn(e);
        }

        // 3. Database records stats
        const dbs = await this._getDatabases();
        for (const dbInfo of dbs) {
            const dbStats = await this._getDatabaseStats(dbInfo.name);
            if (dbStats && dbStats.totalRecords > 0) {
                stats.databases.push(dbStats);
            }
        }

        return stats;
    },

    // Display Stats Confirm Modal
    async showStatsConfirmDialog(stats) {
        return new Promise((resolve) => {
            const dialog = document.createElement('dialog');
            dialog.style.borderRadius = '20px';
            dialog.style.padding = '2rem';
            dialog.style.maxWidth = '550px';
            dialog.style.width = '95%';

            const formatBytes = (bytes) => {
                if (bytes === 0) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            };

            let dbListHtml = stats.databases.map(db => {
                const cleanName = db.name.replace('tmpt_', '').toUpperCase();
                return `<li><strong>Aplikasi ${cleanName}</strong>: ${db.totalRecords} data rekaman</li>`;
            }).join('');

            if (!dbListHtml) dbListHtml = '<li>Tidak ada data aplikasi aktif</li>';

            dialog.innerHTML = `
                <article style="border: none; margin: 0; padding: 0; background: transparent; box-shadow: none; text-align: left;">
                    <h3 style="font-weight: 700; margin-bottom: 0.75rem; font-size: 1.5rem; text-align: center;">📦 Rincian Data Cadangan</h3>
                    <p style="margin-bottom: 1.25rem; font-size: 0.95rem; line-height: 1.5; color: var(--pico-secondary);">
                        Berikut adalah statistik rincian data dalam Brankas TMPT Anda yang siap diekspor ke file <strong>.tmpt</strong> terenkripsi:
                    </p>
                    
                    <div style="background: rgba(0,0,0,0.05); padding: 1.25rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px solid var(--pico-muted-border-color);">
                        <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.95rem; line-height: 1.6;">
                            <li><strong>Pengaturan & Preferensi</strong>: ~${formatBytes(stats.localStorageSize)}</li>
                            <li><strong>File & Dokumen (OPFS)</strong>: ${stats.opfsFilesCount} file (${formatBytes(stats.opfsSize)})</li>
                            ${dbListHtml}
                        </ul>
                    </div>

                    <div class="info-alert" style="margin-bottom: 1rem; border-left: 4px solid #3b82f6; background: rgba(59, 130, 246, 0.05); padding: 0.75rem 1rem; border-radius: 0 10px 10px 0;">
                        <small style="line-height: 1.4; display: block; color: var(--pico-color);">
                            🔒 Berkas cadangan (.tmpt) ini akan otomatis dienkripsi secara penuh dengan <strong>AES-256-GCM</strong> menggunakan Kata Kunci Utama aktif Anda sebelum diunduh.
                        </small>
                    </div>

                    <div class="warning-alert" style="margin-bottom: 1.5rem; border-left: 4px solid #f59e0b; background: rgba(245, 158, 11, 0.05); padding: 0.75rem 1rem; border-radius: 0 10px 10px 0; font-size: 0.85rem; line-height: 1.4;">
                        <p style="margin: 0 0 0.5rem 0;">⚠️ <strong>Catatan Penting:</strong></p>
                        <ul style="margin: 0; padding-left: 1.2rem;">
                            <li><strong>Folder Lokal Fisik</strong> di luar browser tidak dicadangkan dalam file .tmpt. Disarankan untuk mem-backup folder lokal tersebut secara manual di komputer Anda.</li>
                            <li>Batas ukuran rekomendasi ekspor langsung via browser adalah sekitar <strong>100MB s/d 250MB</strong>. Jika ukuran data sangat besar, peramban mungkin memakan waktu lebih lama atau membatasi pengunduhan.</li>
                        </ul>
                    </div>

                    <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                        <button type="button" class="outline secondary" id="btn-backup-cancel" style="margin: 0; border-radius: 8px; padding: 0.5rem 1.5rem; width: auto;">Batal</button>
                        <button type="button" class="btn-navy" id="btn-backup-confirm" style="margin: 0; border-radius: 8px; padding: 0.5rem 1.75rem; width: auto;">Unduh Backup (.tmpt)</button>
                    </div>
                </article>
            `;

            document.body.appendChild(dialog);
            dialog.showModal();

            dialog.querySelector('#btn-backup-cancel').onclick = () => {
                dialog.close();
                dialog.remove();
                resolve(false);
            };

            dialog.querySelector('#btn-backup-confirm').onclick = () => {
                dialog.close();
                dialog.remove();
                resolve(true);
            };
        });
    },

    // Helper to read all stores from a database
    async _exportDatabase(dbName) {
        return new Promise((resolve) => {
            const req = indexedDB.open(dbName);
            req.onsuccess = (e) => {
                const db = e.target.result;
                const storeNames = Array.from(db.objectStoreNames);
                const dbData = {
                    databaseName: dbName,
                    version: db.version,
                    stores: {}
                };

                if (storeNames.length === 0) {
                    db.close();
                    resolve(dbData);
                    return;
                }

                let completed = 0;
                storeNames.forEach(storeName => {
                    try {
                        const tx = db.transaction(storeName, 'readonly');
                        const store = tx.objectStore(storeName);
                        const getAllReq = store.getAll();
                        
                        getAllReq.onsuccess = () => {
                            dbData.stores[storeName] = getAllReq.result.map(item => this._cleanItemForBackup(item));
                            completed++;
                            if (completed === storeNames.length) {
                                db.close();
                                resolve(dbData);
                            }
                        };
                        
                        getAllReq.onerror = () => {
                            completed++;
                            if (completed === storeNames.length) {
                                db.close();
                                resolve(dbData);
                            }
                        };
                    } catch (err) {
                        completed++;
                        if (completed === storeNames.length) {
                            db.close();
                            resolve(dbData);
                        }
                    }
                });
            };
            req.onerror = () => {
                resolve(null);
            };
        });
    },

    // Helper to safely serialize objects with FileSystemHandles
    _cleanItemForBackup(item) {
        if (item === null || item === undefined) return item;
        
        if (typeof item === 'object') {
            if (item.key === 'fsaa_handle') {
                return { key: 'fsaa_handle', value: null, _info: 'Folder Lokal (Hubungkan kembali setelah restore)' };
            }

            const copy = Array.isArray(item) ? [] : {};
            for (const [key, value] of Object.entries(item)) {
                if (value && typeof value === 'object') {
                    if (value.constructor && (value.constructor.name === 'FileSystemDirectoryHandle' || value.constructor.name === 'FileSystemFileHandle')) {
                        copy[key] = { _type: 'FileSystemHandle', name: value.name, kind: value.kind };
                    } else {
                        copy[key] = this._cleanItemForBackup(value);
                    }
                } else {
                    copy[key] = value;
                }
            }
            return copy;
        }
        return item;
    },

    // Export the current vault to a .tmpt file
    async exportVault() {
        try {
            // Calculate statistics
            if (window.TMPT_UI) window.TMPT_UI.showLoader("Menghitung rincian ukuran data...");
            const stats = await this.calculateBackupStats();
            if (window.TMPT_UI) window.TMPT_UI.hideLoader();

            // Confirm with user showing statistics
            const proceed = await this.showStatsConfirmDialog(stats);
            if (!proceed) return;

            if (window.TMPT_UI) window.TMPT_UI.showLoader("Mempersiapkan data backup...");

            const JSZip = await this._loadJSZip();
            const zip = new JSZip();

            // 1. Manifest
            const dbs = await this._getDatabases();
            zip.file('manifest.json', JSON.stringify({
                version: '2.0.0',
                created_at: new Date().toISOString(),
                tmpt_version: '2.0.0',
                databases: dbs.map(d => d.name)
            }, null, 2));

            // 2. LocalStorage Data (Filter all related keys)
            const lStorageData = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('tmpt_') || key.startsWith('catat_') || key.startsWith('hitung_') || key.startsWith('slide_') || key.startsWith('tugas_') || key.startsWith('kalender_')) {
                    lStorageData[key] = localStorage.getItem(key);
                }
            }
            zip.file('localstorage.json', JSON.stringify(lStorageData, null, 2));

            // 3. Export each IndexedDB Database
            const dbFolder = zip.folder('databases');
            for (const dbInfo of dbs) {
                const dbData = await this._exportDatabase(dbInfo.name);
                if (dbData) {
                    dbFolder.file(`${dbInfo.name}.json`, JSON.stringify(dbData, null, 2));
                }
            }

            // 4. OPFS Files (binary data)
            try {
                if (window.TMPT_OPFS && window.TMPT_OPFS.getOpfsRoot) {
                    const root = await window.TMPT_OPFS.getOpfsRoot();
                    const opfsFolder = zip.folder('opfs');
                    for await (const entry of root.values()) {
                        if (entry.kind === 'file') {
                            const file = await entry.getFile();
                            opfsFolder.file(entry.name, file);
                        }
                    }
                } else {
                    const root = await navigator.storage.getDirectory();
                    const opfsFolder = zip.folder('opfs');
                    for await (const entry of root.values()) {
                        if (entry.kind === 'file') {
                            const file = await entry.getFile();
                            opfsFolder.file(entry.name, file);
                        }
                    }
                }
            } catch (err) {
                console.warn("Gagal mengekspor file OPFS:", err);
            }

            // Generate ZIP Blob
            if (window.TMPT_UI) window.TMPT_UI.showLoader("Mengompresi data cadangan...");
            const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

            let finalBlob = zipBlob;
            let isEncrypted = false;

            // Encrypt using Master Password if unlocked
            if (window.TMPT_Auth && window.TMPT_Auth.isUnlocked()) {
                if (window.TMPT_UI) window.TMPT_UI.showLoader("Mengamankan berkas cadangan (Enkripsi)...");
                const key = window.TMPT_Auth.getKey();
                const arrayBuffer = await zipBlob.arrayBuffer();
                
                // Use async FileReader to convert buffer to base64 securely (prevents RangeError maximum call stack)
                const base64Str = await this._arrayBufferToBase64(arrayBuffer);
                const encrypted = await window.TMPT_Crypto.encrypt(base64Str, key);

                const encryptedPayload = JSON.stringify({
                    format: "tmpt-encrypted-v2",
                    exported_at: new Date().toISOString(),
                    payload: encrypted
                }, null, 2);

                finalBlob = new Blob([encryptedPayload], { type: 'application/json' });
                isEncrypted = true;
            }

            // Download File
            const url = URL.createObjectURL(finalBlob);
            let vaultName = "Utama";
            if (window.TMPT_Vault) {
                const meta = window.TMPT_Vault.getMetadata();
                if (meta && meta.name) {
                    vaultName = meta.name;
                }
            }
            const safeVaultName = vaultName.replace(/[^a-zA-Z0-9_-]/g, '_');
            const date = new Date().toISOString().split('T')[0];
            const fileName = `TMTP-Backup-${safeVaultName}-${date}.tmpt`;

            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            if (window.BackupAwareness) {
                window.BackupAwareness.markBackupComplete('manual');
            }

            if (window.TMPT_UI) {
                window.TMPT_UI.hideLoader();
                window.TMPT_UI.toast(isEncrypted ? "Backup terenkripsi berhasil diunduh!" : "Backup berhasil diunduh!", "success");
            }
        } catch (err) {
            console.error("Export failed:", err);
            if (window.TMPT_UI) {
                window.TMPT_UI.hideLoader();
                window.TMPT_UI.toast("Gagal mengekspor backup: " + err.message, "error");
            }
        }
    },

    // Import a vault from a .tmpt file
    async importVault(fileInput) {
        return new Promise(async (resolve, reject) => {
            let file = fileInput;
            if (fileInput && fileInput.files && fileInput.files[0]) {
                file = fileInput.files[0];
            }
            if (!file) {
                return reject("Tidak ada file dipilih.");
            }

            try {
                if (window.TMPT_UI) window.TMPT_UI.showLoader("Membaca berkas cadangan...");
                const fileTextOrBuffer = await file.text();
                let zipData = null;

                // Check if file is encrypted JSON payload
                try {
                    const parsed = JSON.parse(fileTextOrBuffer);
                    if (parsed.format === "tmpt-encrypted-v2" && parsed.payload) {
                        if (!window.TMPT_Auth || !window.TMPT_Auth.isUnlocked()) {
                            throw new Error("Brankas Anda dalam kondisi terkunci. Harap buka kunci Brankas Anda terlebih dahulu untuk mendekripsi file backup ini.");
                        }
                        if (window.TMPT_UI) window.TMPT_UI.showLoader("Mendekripsi berkas cadangan...");
                        const key = window.TMPT_Auth.getKey();
                        const decryptedBase64 = await window.TMPT_Crypto.decrypt(parsed.payload, key);
                        
                        // Convert Base64 back to Uint8Array
                        const binaryString = atob(decryptedBase64);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        zipData = bytes.buffer;
                    }
                } catch (jsonErr) {
                    // Not JSON, treat as raw Zip file
                    zipData = file;
                }

                if (localStorage.getItem('tmpt_vault_v1') && !window._backupConfirmed) {
                    if (window.TMPT_UI) window.TMPT_UI.hideLoader();
                    const confirmed = await window.TMPT_UI.confirm("PERHATIAN: Pemulihan data akan MENIMPA dan MENGHAPUS seluruh isi Brankas, aplikasi, dan file saat ini. Apakah Anda yakin data aktif saat ini sudah di-backup terlebih dahulu?", "KONFIRMASI PEMULIHAN");
                    if (!confirmed) {
                        return resolve(false);
                    }
                }
                window._backupConfirmed = false;

                if (window.TMPT_UI) window.TMPT_UI.showLoader("Mengekstrak file cadangan...");
                const JSZip = await this._loadJSZip();
                const zip = await JSZip.loadAsync(zipData);

                // 1. Verify Manifest
                const manifestFile = zip.file('manifest.json');
                if (!manifestFile) {
                    throw new Error("Berkas cadangan tidak valid (manifest.json tidak ditemukan).");
                }
                const manifest = JSON.parse(await manifestFile.async('string'));
                if (manifest.version !== '2.0.0' && manifest.version !== '1.0') {
                    throw new Error("Versi backup tidak didukung.");
                }

                // 2. Overwrite LocalStorage
                if (window.TMPT_UI) window.TMPT_UI.showLoader("Memulihkan preferensi & pengaturan...");
                const lsFile = zip.file('localstorage.json');
                if (lsFile) {
                    const lsData = JSON.parse(await lsFile.async('string'));
                    // Clear existing TMPT-related keys
                    const keysToRemove = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key.startsWith('tmpt_') || key.startsWith('catat_') || key.startsWith('hitung_') || key.startsWith('slide_') || key.startsWith('tugas_') || key.startsWith('kalender_')) {
                            keysToRemove.push(key);
                        }
                    }
                    keysToRemove.forEach(k => localStorage.removeItem(k));
                    
                    // Put new keys
                    Object.entries(lsData).forEach(([k, v]) => {
                        localStorage.setItem(k, v);
                    });
                }

                // 3. Overwrite IndexedDB Databases
                if (window.TMPT_UI) window.TMPT_UI.showLoader("Memulihkan basis data aplikasi...");
                const dbFolder = zip.folder('databases');
                if (dbFolder) {
                    const dbFiles = [];
                    dbFolder.forEach((relativePath, fileEntry) => {
                        if (!fileEntry.dir) {
                            dbFiles.push(fileEntry);
                        }
                    });

                    for (const dbFile of dbFiles) {
                        const dbContent = JSON.parse(await dbFile.async('string'));
                        await this._restoreDatabase(dbContent);
                    }
                }

                // 4. Overwrite OPFS files
                if (window.TMPT_UI) window.TMPT_UI.showLoader("Memulihkan berkas biner...");
                const opfsFolder = zip.folder('opfs');
                if (opfsFolder) {
                    let root;
                    try {
                        root = await navigator.storage.getDirectory();
                    } catch (e) {
                        // Fallback
                        if (window.TMPT_OPFS && window.TMPT_OPFS.getOpfsRoot) {
                            root = await window.TMPT_OPFS.getOpfsRoot();
                        }
                    }

                    if (root) {
                        // Clear existing OPFS entries
                        for await (const entry of root.values()) {
                            await root.removeEntry(entry.name, { recursive: true });
                        }

                        // Write new entries
                        const promises = [];
                        opfsFolder.forEach((relativePath, fileEntry) => {
                            if (!fileEntry.dir) {
                                promises.push(
                                    fileEntry.async('blob').then(async (blob) => {
                                        const cleanName = relativePath.split('/').pop();
                                        const handle = await root.getFileHandle(cleanName, { create: true });
                                        const writable = await handle.createWritable();
                                        await writable.write(blob);
                                        await writable.close();
                                    })
                                );
                            }
                        });
                        await Promise.all(promises);
                    }
                }

                if (window.TMPT_UI) {
                    window.TMPT_UI.hideLoader();
                    window.TMPT_UI.toast("Seluruh data ekosistem TMPT berhasil dipulihkan!", "success");
                }

                setTimeout(() => {
                    if (window.TMPT_Auth && window.TMPT_Auth.lock) {
                        window.TMPT_Auth.lock();
                    } else {
                        window.location.reload();
                    }
                }, 1500);

                resolve(true);
            } catch (err) {
                console.error("Import failed:", err);
                if (window.TMPT_UI) {
                    window.TMPT_UI.hideLoader();
                    window.TMPT_UI.toast("Gagal memulihkan cadangan: " + err.message, "error");
                }
                reject(err);
            }
        });
    },

    // Helper to reconstruct and write data to an IndexedDB database
    async _restoreDatabase(dbContent) {
        const { databaseName, version, stores } = dbContent;
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(databaseName, version);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                Object.keys(stores).forEach(storeName => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        let keyPath = 'id';
                        if (storeName === 'settings' || storeName === 'config') {
                            keyPath = 'key';
                        } else if (storeName === 'tags' && databaseName === 'tmpt_tugas') {
                            keyPath = 'name';
                        }
                        db.createObjectStore(storeName, { keyPath: keyPath });
                    }
                });
            };
            req.onsuccess = (e) => {
                const db = e.target.result;
                const storeNames = Object.keys(stores);
                if (storeNames.length === 0) {
                    db.close();
                    resolve();
                    return;
                }

                const tx = db.transaction(storeNames, 'readwrite');
                storeNames.forEach(storeName => {
                    const store = tx.objectStore(storeName);
                    store.clear();
                    stores[storeName].forEach(item => {
                        store.put(item);
                    });
                });

                tx.oncomplete = () => {
                    db.close();
                    resolve();
                };

                tx.onerror = (err) => {
                    db.close();
                    reject(tx.error || err);
                };
            };
            req.onerror = (e) => reject(e.target.error);
        });
    }
};

window.TMPT_Backup = BackupModule;
