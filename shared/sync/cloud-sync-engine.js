/**
 * TMPT Cloud Sync Engine
 * Upload snapshot dari OPFS (Layer 2) ke Google Drive (Layer 3).
 *
 * Fitur:
 *  - Upload queue dengan mutex (satu upload sekaligus)
 *  - Retry otomatis saat online kembali
 *  - Rolling retention: max 10 snapshot di Drive
 *  - Status events untuk UI
 *  - Cek checksum sebelum upload (skip jika tidak berubah)
 */

const TMPT_CloudSyncEngine = {
    MAX_CLOUD_SNAPSHOTS:  10,
    LATEST_FILENAME:      'tmpt-latest.tmpt',
    META_FILENAME:        'tmpt-meta.json',
    UNSYNCED_KEY:         'tmpt_unsynced_snapshots',   // localStorage key

    // State
    _provider:      null,
    _isSyncing:     false,
    _syncQueue:     [],   // [{filename, blob}]
    _lastSyncAt:    null,
    _lastChecksum:  null,
    _listeners:     [],
    _status:        'not_setup',  // 'not_setup'|'syncing'|'synced'|'offline'|'error'|'disabled'

    // === Initialization ===

    init(provider = null) {
        this._provider = provider || (window.GDriveSyncProvider ? new GDriveSyncProvider() : null);

        // Dengarkan event online/offline
        window.addEventListener('online',  () => this._onOnline());
        window.addEventListener('offline', () => this._setStatus('offline'));

        // Saat startup, cek apakah ada unsynced snapshot yang perlu di-retry
        this._retryUnsyncedOnStartup();
    },

    // === Public API ===

    /**
     * Jadwalkan upload snapshot (dipanggil oleh SnapshotEngine).
     * @param {string} filename
     * @param {Blob}   blob
     */
    scheduleSync(filename, blob) {
        if (!this._provider) return;
        if (this._status === 'disabled') return;

        // Simpan ke unsynced list (untuk retry saat restart)
        this._markUnsynced(filename);

        // Tambah ke queue — jika sudah ada yang lebih lama di queue, buang (sudah outdated)
        this._syncQueue = [{ filename, blob }];

        if (!this._isSyncing) {
            this._processQueue();
        }
    },

    /**
     * Sync manual sekarang — ambil snapshot terbaru dari OPFS lalu upload.
     */
    async syncNow() {
        if (!this._provider) {
            this._setStatus('not_setup');
            return false;
        }

        // Cek apakah terhubung
        const isAuth = await this._provider.isAuthenticated();
        if (!isAuth) {
            this._setStatus('not_setup');
            return false;
        }

        // Buat snapshot baru lalu sync
        if (window.TMPT_SnapshotEngine) {
            const result = await window.TMPT_SnapshotEngine.createSnapshot('manual');
            if (result) return true;
        }

        // Fallback: cari snapshot terbaru dari OPFS
        const snapshots = await window.TMPT_SnapshotEngine?.listLocalSnapshots() || [];
        if (snapshots.length === 0) {
            if (window.TMPT_UI) window.TMPT_UI.toast('Tidak ada data untuk disinkronkan.', 'info');
            return false;
        }

        const latest = snapshots[0];
        const blob   = await window.TMPT_SnapshotEngine.getLocalSnapshotBlob(latest.filename);
        if (blob) {
            this.scheduleSync(latest.filename, blob);
            return true;
        }

        return false;
    },

    getStatus() { return this._status; },
    getLastSyncAt() { return this._lastSyncAt; },

    // === Queue Processing ===

    async _processQueue() {
        if (this._isSyncing || this._syncQueue.length === 0) return;

        // Cek koneksi internet
        if (!navigator.onLine) {
            this._setStatus('offline');
            return;
        }

        const { filename, blob } = this._syncQueue.pop();
        this._syncQueue = []; // Buang yang lebih lama

        this._isSyncing = true;
        this._setStatus('syncing');

        try {
            await this._uploadSnapshot(filename, blob);

            this._lastSyncAt = new Date();
            this._markSynced(filename);
            this._setStatus('synced', { at: this._lastSyncAt });

            // Simpan ke localStorage untuk display
            localStorage.setItem('tmpt_gdrive_last_sync', this._lastSyncAt.toISOString());

            // Update BackupAwareness jika ada
            if (window.BackupAwareness) {
                window.BackupAwareness.markBackupComplete('drive');
            }

        } catch(err) {
            console.error('[CloudSync] Upload gagal:', err);
            this._setStatus('error', { message: err.message });

            // Simpan ke sync history
            this._appendSyncHistory({ success: false, error: err.message, at: new Date().toISOString() });

        } finally {
            this._isSyncing = false;

            // Proses queue berikutnya jika ada
            if (this._syncQueue.length > 0) {
                setTimeout(() => this._processQueue(), 1000);
            }
        }
    },

    async _uploadSnapshot(filename, blob) {
        // 1. Cek checksum — skip jika sama dengan upload terakhir
        const blobBuffer = await blob.arrayBuffer();
        const checksum   = await this._sha256Buffer(blobBuffer);

        if (checksum === this._lastChecksum) {
            console.log('[CloudSync] Checksum sama, upload diskip.');
            return;
        }

        // 2. Upload snapshot dengan timestamp
        await this._provider.upsert(filename, blob);

        // 3. Update pointer latest
        await this._provider.upsert(this.LATEST_FILENAME, blob);

        // 4. Update metadata
        await this._updateMeta(filename, checksum, blob.size);

        // 5. Rotasi snapshot lama di Drive
        await this._provider.rotate('tmpt-', this.MAX_CLOUD_SNAPSHOTS);

        // 6. Update checksum cache
        this._lastChecksum = checksum;

        // 7. Append ke sync history
        this._appendSyncHistory({
            success:  true,
            filename,
            size:     blob.size,
            at:       new Date().toISOString(),
        });

        console.log(`[CloudSync] ✓ Upload berhasil: ${filename} (${(blob.size / 1024).toFixed(1)} KB)`);
    },

    async _updateMeta(filename, checksum, size) {
        const meta = {
            last_sync_at:  new Date().toISOString(),
            last_filename: filename,
            last_checksum: checksum,
            last_size:     size,
            device_id:     localStorage.getItem('tmpt_device_id') || 'unknown',
        };
        const metaBlob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' });
        await this._provider.upsert(this.META_FILENAME, metaBlob);
    },

    // === Retry Logic ===

    async _onOnline() {
        console.log('[CloudSync] Kembali online, retry sync...');
        this._setStatus('syncing');

        // Cek apakah ada queue yang tertunda
        if (this._syncQueue.length > 0) {
            this._processQueue();
            return;
        }

        // Cek unsynced snapshots dari sebelum offline
        await this._retryUnsyncedOnStartup();
    },

    async _retryUnsyncedOnStartup() {
        const unsynced = this._getUnsyncedList();
        if (unsynced.length === 0) return;

        const isAuth = await this._provider?.isAuthenticated();
        if (!isAuth) return;

        // Upload snapshot yang belum tersinkron
        const latest = unsynced[unsynced.length - 1]; // Yang paling baru
        if (window.TMPT_SnapshotEngine) {
            const blob = await window.TMPT_SnapshotEngine.getLocalSnapshotBlob(latest);
            if (blob) {
                console.log(`[CloudSync] Retry upload unsynced snapshot: ${latest}`);
                this.scheduleSync(latest, blob);
            }
        }
    },

    // === Unsynced Tracking ===

    _markUnsynced(filename) {
        const list = this._getUnsyncedList();
        if (!list.includes(filename)) {
            list.push(filename);
            localStorage.setItem(this.UNSYNCED_KEY, JSON.stringify(list));
        }
    },

    _markSynced(filename) {
        const list = this._getUnsyncedList().filter(f => f !== filename);
        localStorage.setItem(this.UNSYNCED_KEY, JSON.stringify(list));
    },

    _getUnsyncedList() {
        try {
            return JSON.parse(localStorage.getItem(this.UNSYNCED_KEY) || '[]');
        } catch(e) {
            return [];
        }
    },

    // === Sync History ===

    _appendSyncHistory(entry) {
        try {
            const key     = 'tmpt_sync_history';
            const history = JSON.parse(localStorage.getItem(key) || '[]');
            history.unshift(entry);
            // Simpan 20 entry terakhir
            localStorage.setItem(key, JSON.stringify(history.slice(0, 20)));
        } catch(e) {}
    },

    getSyncHistory() {
        try {
            return JSON.parse(localStorage.getItem('tmpt_sync_history') || '[]');
        } catch(e) {
            return [];
        }
    },

    // === Events ===

    on(event, callback) {
        this._listeners.push({ event, callback });
    },

    _setStatus(status, data = {}) {
        this._status = status;
        this._emit('status', { status, ...data });
        // Update BackupAwareness icon
        if (window.BackupAwareness) {
            window.BackupAwareness.renderHeaderIcon();
        }
        // Update SyncStatus widget jika ada
        if (window.TMPT_SyncStatus) {
            window.TMPT_SyncStatus.updateDisplay();
        }
    },

    _emit(event, data = {}) {
        this._listeners
            .filter(l => l.event === event)
            .forEach(l => { try { l.callback(data); } catch(e) {} });
    },

    // === Helpers ===

    async _sha256Buffer(buffer) {
        const digest = await crypto.subtle.digest('SHA-256', buffer);
        return 'sha256:' + Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    },
};

window.TMPT_CloudSyncEngine = TMPT_CloudSyncEngine;
