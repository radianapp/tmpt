/**
 * TMPT Snapshot Engine
 * Membuat snapshot .tmpt dari semua IndexedDB apps dan menyimpannya ke OPFS.
 *
 * Layer 1 (IndexedDB) → Layer 2 (OPFS /tmpt-snapshots/)
 *
 * Trigger:
 *   - Setiap perubahan data + debounce 30 detik
 *   - Force setiap 100 perubahan
 *   - Manual via createSnapshot('manual')
 */

const TMPT_SnapshotEngine = {
    DEBOUNCE_MS:        30_000,   // 30 detik debounce
    MAX_SNAPSHOTS:      10,       // Simpan max 10 snapshot lokal
    FORCE_AFTER_CHANGES: 100,     // Force snapshot setelah 100 perubahan
    SNAPSHOT_DIR:       'tmpt-snapshots',

    // App yang disinkronisasi — VAULT tidak pernah dimasukkan (security policy)
    SYNCABLE_APPS: [
        'tulis', 'hitung', 'slide', 'forms', 'kalender',
        'tugas', 'catatan', 'markdown', 'berkas', 'diagram',
        'code', 'regex', 'json', 'qr',
    ],

    // State
    _debounceTimer:  null,
    _changeCount:    0,
    _lastChecksums:  {},  // { appName: 'sha256:...' }
    _isSnaphotting:  false,
    _listeners:      [],

    // === Public API ===

    /**
     * Dipanggil setiap kali ada perubahan data di app manapun.
     * @param {string} appName — nama app yang berubah
     */
    onDataChanged(appName) {
        this._changeCount++;
        clearTimeout(this._debounceTimer);

        // Force snapshot jika sudah 100 perubahan
        if (this._changeCount >= this.FORCE_AFTER_CHANGES) {
            this.createSnapshot('change_threshold');
            this._changeCount = 0;
            return;
        }

        this._debounceTimer = setTimeout(() => {
            this.createSnapshot('idle_timeout');
        }, this.DEBOUNCE_MS);
    },

    /**
     * Buat snapshot sekarang.
     * @param {string} reason — 'manual' | 'idle_timeout' | 'change_threshold' | 'tab_close'
     * @returns {Promise<{filename: string, blob: Blob}|null>}
     */
    async createSnapshot(reason = 'manual') {
        if (this._isSnaphotting) {
            console.log('[Snapshot] Snapshot sedang berjalan, skip.');
            return null;
        }

        this._isSnaphotting = true;
        this._emit('start', { reason });

        try {
            // 1. Load JSZip
            const JSZip = await this._loadJSZip();

            // 2. Export semua app dari IndexedDB
            const { appsData, changedApps, checksums } = await this._exportAllApps();

            // Jika tidak ada perubahan (semua checksum sama), skip
            if (changedApps.length === 0 && reason !== 'manual') {
                console.log('[Snapshot] Tidak ada perubahan, snapshot diskip.');
                this._isSnaphotting = false;
                this._emit('skipped', { reason: 'no_changes' });
                return null;
            }

            const timestamp = this._formatTimestamp(new Date());
            const filename  = `tmpt-${timestamp}.tmpt`;

            // 3. Buat manifest
            const manifest = {
                format:           'tmpt',
                version:          '2.0.0',
                created_at:       new Date().toISOString(),
                device_id:        this._getDeviceId(),
                device_hint:      this._getDeviceHint(),
                apps_included:    Object.keys(appsData),
                apps_changed:     changedApps,
                snapshot_reason:  reason,
                encrypted:        false,
                tmpt_version:     '2.0.0',
            };

            // 4. tmpt-sync.json
            const syncMeta = {
                sync_id:           crypto.randomUUID(),
                snapshot_at:       new Date().toISOString(),
                device_id:         manifest.device_id,
                changes_since_last: changedApps.length,
                apps_changed:      changedApps,
                apps_unchanged:    Object.keys(appsData).filter(a => !changedApps.includes(a)),
                checksum_per_app:  checksums,
            };

            // 5. Bundle ke ZIP
            const zip = new JSZip();
            zip.file('manifest.json', JSON.stringify(manifest, null, 2));
            zip.file('tmpt-sync.json', JSON.stringify(syncMeta, null, 2));

            // LocalStorage data (settings, preferences)
            const lsData = this._exportLocalStorage();
            zip.file('localstorage.json', JSON.stringify(lsData, null, 2));

            // Apps data
            const appsFolder = zip.folder('apps');
            for (const [appName, data] of Object.entries(appsData)) {
                appsFolder.file(`${appName}.json`, JSON.stringify(data, null, 2));
            }

            // Settings folder
            const settingsFolder = zip.folder('settings');
            settingsFolder.file('global.json', JSON.stringify({
                theme:     localStorage.getItem('tmpt_theme') || 'auto',
                language:  localStorage.getItem('tmpt_language') || 'id',
            }, null, 2));
            settingsFolder.file('sync.json', JSON.stringify({
                last_snapshot_at:  new Date().toISOString(),
                device_id:         manifest.device_id,
            }, null, 2));

            const zipBlob = await zip.generateAsync({
                type:        'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 },
            });

            // 6. Simpan ke OPFS
            await this._saveToOPFS(filename, zipBlob);

            // 7. Update checksum cache
            this._lastChecksums = checksums;

            // 8. Rotasi snapshot lama
            await this._rotateSnapshots();

            // 9. Trigger cloud sync
            if (window.TMPT_CloudSyncEngine) {
                window.TMPT_CloudSyncEngine.scheduleSync(filename, zipBlob);
            }

            this._emit('done', { filename, size: zipBlob.size, changedApps });
            console.log(`[Snapshot] ✓ ${filename} (${(zipBlob.size / 1024).toFixed(1)} KB, apps berubah: ${changedApps.join(', ') || 'none'})`);

            return { filename, blob: zipBlob };

        } catch(err) {
            console.error('[Snapshot] Gagal:', err);
            this._emit('error', { error: err.message });
            return null;
        } finally {
            this._isSnaphotting = false;
        }
    },

    /**
     * Ambil list snapshot dari OPFS, diurutkan terbaru dulu.
     * @returns {Promise<Array<{filename, size, created_at}>>}
     */
    async listLocalSnapshots() {
        try {
            const root        = await navigator.storage.getDirectory();
            const snapshotDir = await root.getDirectoryHandle(this.SNAPSHOT_DIR, { create: false });
            const snapshots   = [];

            for await (const [name, handle] of snapshotDir.entries()) {
                if (!name.endsWith('.tmpt')) continue;
                try {
                    const file = await handle.getFile();
                    snapshots.push({
                        filename:   name,
                        size:       file.size,
                        created_at: this._parseTimestampFromFilename(name) || new Date(file.lastModified),
                        handle,
                    });
                } catch(e) {
                    // Lewati file yang tidak bisa dibaca
                }
            }

            return snapshots.sort((a, b) => b.created_at - a.created_at);
        } catch(e) {
            // Direktori belum ada
            return [];
        }
    },

    /**
     * Ambil blob dari snapshot lokal berdasarkan filename.
     * @returns {Promise<Blob|null>}
     */
    async getLocalSnapshotBlob(filename) {
        try {
            const root        = await navigator.storage.getDirectory();
            const snapshotDir = await root.getDirectoryHandle(this.SNAPSHOT_DIR, { create: false });
            const fileHandle  = await snapshotDir.getFileHandle(filename);
            return await fileHandle.getFile();
        } catch(e) {
            return null;
        }
    },

    /** Apakah ada perubahan yang belum di-snapshot? */
    hasPendingChanges() {
        return this._changeCount > 0 || !!this._debounceTimer;
    },

    /** Snapshot sinkron untuk beforeunload (terbatas — hanya simpan ke OPFS, tidak upload) */
    async createSnapshotBeforeUnload() {
        clearTimeout(this._debounceTimer);
        if (this._changeCount > 0) {
            await this.createSnapshot('tab_close');
        }
    },

    // === Event System ===

    on(event, callback) {
        this._listeners.push({ event, callback });
    },

    _emit(event, data = {}) {
        this._listeners
            .filter(l => l.event === event)
            .forEach(l => {
                try { l.callback(data); } catch(e) {}
            });
    },

    // === Private Helpers ===

    async _exportAllApps() {
        const appsData   = {};
        const changedApps = [];
        const checksums  = {};

        for (const appName of this.SYNCABLE_APPS) {
            try {
                const data     = await this._exportAppDB(`tmpt_${appName}`);
                const checksum = await this._sha256(JSON.stringify(data));

                appsData[appName]  = data;
                checksums[appName] = checksum;

                if (checksum !== this._lastChecksums[appName]) {
                    changedApps.push(appName);
                }
            } catch(e) {
                // App tidak ada atau belum diinisialisasi — skip
            }
        }

        return { appsData, changedApps, checksums };
    },

    async _exportAppDB(dbName) {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(dbName);

            req.onerror = () => reject(new Error(`Tidak bisa buka ${dbName}`));
            req.onsuccess = (e) => {
                const db         = e.target.result;
                const storeNames = Array.from(db.objectStoreNames);
                const dbData     = { databaseName: dbName, version: db.version, stores: {} };

                if (storeNames.length === 0) {
                    db.close();
                    resolve(dbData);
                    return;
                }

                let completed = 0;
                storeNames.forEach(storeName => {
                    try {
                        const tx    = db.transaction(storeName, 'readonly');
                        const store = tx.objectStore(storeName);
                        const req2  = store.getAll();
                        req2.onsuccess = () => {
                            dbData.stores[storeName] = req2.result.map(item => this._cleanItem(item));
                            completed++;
                            if (completed === storeNames.length) { db.close(); resolve(dbData); }
                        };
                        req2.onerror = () => {
                            completed++;
                            if (completed === storeNames.length) { db.close(); resolve(dbData); }
                        };
                    } catch(err) {
                        completed++;
                        if (completed === storeNames.length) { db.close(); resolve(dbData); }
                    }
                });
            };
        });
    },

    _cleanItem(item) {
        if (item === null || item === undefined) return item;
        if (typeof item !== 'object') return item;

        // Strip FileSystemHandle (tidak bisa di-serialize)
        if (item.key === 'fsaa_handle') {
            return { key: 'fsaa_handle', value: null, _info: 'FSAA handle (reconnect setelah restore)' };
        }

        const copy = Array.isArray(item) ? [] : {};
        for (const [k, v] of Object.entries(item)) {
            if (v && typeof v === 'object' &&
                v.constructor && (v.constructor.name === 'FileSystemDirectoryHandle' || v.constructor.name === 'FileSystemFileHandle')) {
                copy[k] = { _type: 'FileSystemHandle', name: v.name, kind: v.kind };
            } else {
                copy[k] = this._cleanItem(v);
            }
        }
        return copy;
    },

    _exportLocalStorage() {
        const data = {};
        const PREFIXES = ['tmpt_', 'catat_', 'hitung_', 'slide_', 'tugas_', 'kalender_'];
        const SKIP_KEYS = ['tmpt_sync_tokens', 'gdrive_access_token', 'gdrive_token_expires_at', 'tmpt_gdrive_connected', 'tmpt_gdrive_email', 'tmpt_gdrive_last_sync'];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (SKIP_KEYS.includes(key)) continue;
            if (PREFIXES.some(p => key.startsWith(p))) {
                data[key] = localStorage.getItem(key);
            }
        }
        return data;
    },

    async _saveToOPFS(filename, blob) {
        const root        = await navigator.storage.getDirectory();
        const snapshotDir = await root.getDirectoryHandle(this.SNAPSHOT_DIR, { create: true });
        const fileHandle  = await snapshotDir.getFileHandle(filename, { create: true });
        const writable    = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
    },

    async _rotateSnapshots() {
        try {
            const root        = await navigator.storage.getDirectory();
            const snapshotDir = await root.getDirectoryHandle(this.SNAPSHOT_DIR, { create: false });
            const entries     = [];

            for await (const [name] of snapshotDir.entries()) {
                if (name.endsWith('.tmpt')) entries.push(name);
            }

            entries.sort(); // Nama file berisi timestamp → sort = urutan kronologis

            while (entries.length > this.MAX_SNAPSHOTS) {
                const oldest = entries.shift();
                try {
                    await snapshotDir.removeEntry(oldest);
                    console.log(`[Snapshot] Hapus snapshot lama: ${oldest}`);
                } catch(e) {}
            }
        } catch(e) {
            // Direktori belum ada — tidak apa-apa
        }
    },

    async _sha256(text) {
        const buf    = new TextEncoder().encode(text);
        const digest = await crypto.subtle.digest('SHA-256', buf);
        return 'sha256:' + Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    _formatTimestamp(date) {
        const pad = n => String(n).padStart(2, '0');
        return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    },

    _parseTimestampFromFilename(filename) {
        // Format: tmpt-20260605_100000.tmpt
        const match = filename.match(/tmpt-(\d{8})_(\d{6})\.tmpt/);
        if (!match) return null;
        const [, date, time] = match;
        const y  = date.slice(0, 4), mo = date.slice(4, 6), d  = date.slice(6, 8);
        const h  = time.slice(0, 2), mi = time.slice(2, 4), s  = time.slice(4, 6);
        return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`);
    },

    _getDeviceId() {
        let id = localStorage.getItem('tmpt_device_id');
        if (!id) {
            id = 'device-' + crypto.randomUUID();
            localStorage.setItem('tmpt_device_id', id);
        }
        return id;
    },

    _getDeviceHint() {
        const ua = navigator.userAgent;
        let browser = 'Browser';
        if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
        else if (ua.includes('Firefox')) browser = 'Firefox';
        else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
        else if (ua.includes('Edg')) browser = 'Edge';

        let os = 'OS';
        if (ua.includes('Windows')) os = 'Windows';
        else if (ua.includes('Mac')) os = 'macOS';
        else if (ua.includes('Linux')) os = 'Linux';
        else if (ua.includes('Android')) os = 'Android';
        else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

        return `${browser} / ${os}`;
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

// Setup beforeunload handler
window.addEventListener('beforeunload', () => {
    if (window.TMPT_SnapshotEngine && window.TMPT_SnapshotEngine.hasPendingChanges()) {
        window.TMPT_SnapshotEngine.createSnapshotBeforeUnload();
    }
});

// Dengarkan BroadcastChannel untuk trigger dari app lain
try {
    const bc = new BroadcastChannel('tmpt_office');
    bc.addEventListener('message', (e) => {
        const type = e?.data?.type;
        if (['FILE_CREATED', 'FILE_UPDATED', 'FILE_DELETED', 'FORM_SUBMITTED',
             'TASK_DONE', 'EVENT_CREATED', 'DATA_CHANGED'].includes(type)) {
            if (window.TMPT_SnapshotEngine) {
                window.TMPT_SnapshotEngine.onDataChanged(e?.data?.payload?.app || 'unknown');
            }
        }
    });
} catch(e) {}

window.TMPT_SnapshotEngine = TMPT_SnapshotEngine;
