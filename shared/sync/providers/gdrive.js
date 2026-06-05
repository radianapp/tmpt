/**
 * TMPT Sync Provider — Google Drive (appDataFolder)
 * Implementasi upload/download ke folder tersembunyi Google Drive.
 * Menggunakan TMPT_TokenManager untuk akses token yang valid.
 */

class GDriveSyncProvider extends SyncProviderBase {
    get name() { return 'gdrive'; }

    get _baseUrl() { return 'https://www.googleapis.com'; }


    // Dapatkan valid access token via TokenManager
    async _getToken() {
        if (!window.TMPT_TokenManager) {
            throw new Error('TokenManager tidak dimuat.');
        }
        const token = await window.TMPT_TokenManager.getValidAccessTokenWithFallback();
        if (!token) {
            throw new Error('Token Google Drive tidak valid atau belum terhubung.');
        }
        return token;
    }

    async isAuthenticated() {
        try {
            const token = await window.TMPT_TokenManager.getValidAccessTokenWithFallback();
            return !!token;
        } catch(e) {
            return false;
        }
    }

    async authenticate() {
        await window.TMPT_TokenManager.initiateAuth();
    }

    async disconnect() {
        window.TMPT_TokenManager.disconnect();
    }

    /**
     * Upload file baru ke appDataFolder.
     * @returns {Promise<{id: string, name: string}>}
     */
    async upload(filename, blob) {
        const token = await this._getToken();

        const metadata = JSON.stringify({
            name:    filename,
            parents: ['appDataFolder'],
        });

        const form = new FormData();
        form.append('metadata', new Blob([metadata], { type: 'application/json' }));
        form.append('file', blob);

        const res = await fetch(
            `${this._baseUrl}/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime`,
            {
                method:  'POST',
                headers: { Authorization: `Bearer ${token}` },
                body:    form,
            }
        );

        if (!res.ok) {
            const body = await res.text();
            throw new Error(`Drive upload gagal (${res.status}): ${body}`);
        }

        return await res.json();
    }

    /**
     * Update konten file yang sudah ada di Drive.
     */
    async update(fileId, blob) {
        const token = await this._getToken();

        const res = await fetch(
            `${this._baseUrl}/upload/drive/v3/files/${fileId}?uploadType=media`,
            {
                method:  'PATCH',
                headers: {
                    Authorization:  `Bearer ${token}`,
                    'Content-Type': 'application/zip',
                },
                body: blob,
            }
        );

        if (!res.ok) {
            const body = await res.text();
            throw new Error(`Drive update gagal (${res.status}): ${body}`);
        }
    }

    /**
     * Download konten file dari Drive.
     * @returns {Promise<Blob>}
     */
    async download(fileId) {
        const token = await this._getToken();

        const res = await fetch(
            `${this._baseUrl}/drive/v3/files/${fileId}?alt=media`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!res.ok) {
            throw new Error(`Drive download gagal (${res.status})`);
        }

        return await res.blob();
    }

    /**
     * List semua file di appDataFolder milik TMPT.
     * @returns {Promise<Array<{id, name, size, createdAt}>>}
     */
    async listFiles(nameFilter = null) {
        const token = await this._getToken();

        let query = 'spaces=appDataFolder&orderBy=createdTime desc&fields=files(id,name,size,createdTime,modifiedTime)';
        if (nameFilter) {
            query += `&q=name contains '${nameFilter}'`;
        }

        const res = await fetch(
            `${this._baseUrl}/drive/v3/files?${query}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!res.ok) {
            throw new Error(`Drive listFiles gagal (${res.status})`);
        }

        const data = await res.json();
        return (data.files || []).map(f => ({
            id:         f.id,
            name:       f.name,
            size:       parseInt(f.size || 0),
            createdAt:  f.createdTime,
            modifiedAt: f.modifiedTime,
        }));
    }

    /**
     * Cari file berdasarkan nama exact.
     * @returns {Promise<{id, name, size, createdAt}|null>}
     */
    async findFileByName(filename) {
        const token = await this._getToken();

        const res = await fetch(
            `${this._baseUrl}/drive/v3/files?spaces=appDataFolder&q=name='${encodeURIComponent(filename)}'&fields=files(id,name,size,createdTime)`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!res.ok) return null;

        const data = await res.json();
        const files = data.files || [];
        if (files.length === 0) return null;

        return {
            id:        files[0].id,
            name:      files[0].name,
            size:      parseInt(files[0].size || 0),
            createdAt: files[0].createdTime,
        };
    }

    /**
     * Hapus file dari Drive.
     */
    async deleteFile(fileId) {
        const token = await this._getToken();

        const res = await fetch(
            `${this._baseUrl}/drive/v3/files/${fileId}`,
            {
                method:  'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            }
        );

        if (!res.ok && res.status !== 404) {
            throw new Error(`Drive deleteFile gagal (${res.status})`);
        }
    }

    /**
     * Upload atau update file (upsert).
     * Jika file dengan nama tersebut sudah ada → update, jika tidak → create baru.
     */
    async upsert(filename, blob) {
        const existing = await this.findFileByName(filename);
        if (existing) {
            await this.update(existing.id, blob);
            return existing;
        } else {
            return await this.upload(filename, blob);
        }
    }

    /**
     * Rotasi: hapus file terlama jika melebihi maxCount.
     * @param {string} prefix — prefix nama file (misal 'tmpt-')
     * @param {number} maxCount
     */
    async rotate(prefix, maxCount) {
        const allFiles = await this.listFiles();
        const filtered = allFiles
            .filter(f => f.name.startsWith(prefix) && f.name !== `${prefix}latest.tmpt`)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); // terlama duluan

        while (filtered.length > maxCount) {
            const oldest = filtered.shift();
            try {
                await this.deleteFile(oldest.id);
                console.log(`[GDrive] Hapus snapshot lama: ${oldest.name}`);
            } catch(e) {
                console.warn(`[GDrive] Gagal hapus ${oldest.name}:`, e);
            }
        }
    }
};

window.GDriveSyncProvider = GDriveSyncProvider;
