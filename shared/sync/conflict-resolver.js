/**
 * TMPT Conflict Resolver
 * Mendeteksi dan menyelesaikan konflik antara snapshot lokal dan cloud.
 * v1.0: Timestamp-based (keep latest). Additive merge untuk tugas/forms di v1.1.
 */

const TMPT_ConflictResolver = {

    /**
     * Resolusi konflik antara snapshot lokal dan cloud.
     * @param {Blob} localBlob  — snapshot lokal terbaru
     * @param {Blob} cloudBlob  — snapshot dari Google Drive
     * @returns {Promise<Blob>} — blob yang menang (atau merged)
     */
    async resolve(localBlob, cloudBlob) {
        try {
            const localMeta = await this._readSyncMeta(localBlob);
            const cloudMeta = await this._readSyncMeta(cloudBlob);

            if (!localMeta || !cloudMeta) {
                // Tidak bisa baca meta → keep cloud (lebih aman untuk device baru)
                console.warn('[ConflictResolver] Tidak bisa baca sync meta, pakai cloud.');
                return cloudBlob;
            }

            const localTime = new Date(localMeta.snapshot_at);
            const cloudTime = new Date(cloudMeta.snapshot_at);
            const diffMs    = Math.abs(localTime - cloudTime);

            // Jika selisih < 1 menit → kemungkinan bukan konflik nyata
            if (diffMs < 60_000) {
                console.log('[ConflictResolver] Selisih < 1 menit, tidak ada konflik nyata.');
                return localTime >= cloudTime ? localBlob : cloudBlob;
            }

            // Deteksi konflik per-app
            const conflicts = [];
            const allApps   = new Set([
                ...Object.keys(localMeta.checksum_per_app || {}),
                ...Object.keys(cloudMeta.checksum_per_app || {}),
            ]);

            for (const appName of allApps) {
                const localCs = localMeta.checksum_per_app?.[appName];
                const cloudCs = cloudMeta.checksum_per_app?.[appName];

                if (localCs !== cloudCs) {
                    conflicts.push({
                        app:      appName,
                        localAt:  localMeta.snapshot_at,
                        cloudAt:  cloudMeta.snapshot_at,
                        strategy: this._inferStrategy(appName, localTime, cloudTime),
                    });
                }
            }

            if (conflicts.length === 0) {
                // Checksum sama di semua app → tidak ada konflik
                return localTime >= cloudTime ? localBlob : cloudBlob;
            }

            console.log(`[ConflictResolver] ${conflicts.length} konflik terdeteksi:`,
                conflicts.map(c => `${c.app}(${c.strategy})`).join(', '));

            // v1.0: Semua strategy adalah timestamp-based
            // Jika mayoritas app lebih baru di cloud → pakai cloud, sebaliknya local
            const localWins = conflicts.filter(c => c.strategy === 'keep_local').length;
            const cloudWins = conflicts.filter(c => c.strategy === 'keep_cloud').length;

            if (cloudWins >= localWins) {
                console.log('[ConflictResolver] Cloud menang (lebih baru atau sama).');
                return cloudBlob;
            } else {
                console.log('[ConflictResolver] Local menang (lebih baru).');
                return localBlob;
            }

        } catch(err) {
            console.error('[ConflictResolver] Error:', err);
            return cloudBlob; // Default: pakai cloud
        }
    },

    _inferStrategy(appName, localTime, cloudTime) {
        if (localTime > cloudTime) return 'keep_local';
        return 'keep_cloud';
    },

    async _readSyncMeta(blob) {
        try {
            const JSZip = await this._loadJSZip();
            const zip   = await JSZip.loadAsync(blob);
            const file  = zip.file('tmpt-sync.json');
            if (!file) return null;
            return JSON.parse(await file.async('string'));
        } catch(e) {
            return null;
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

window.TMPT_ConflictResolver = TMPT_ConflictResolver;
