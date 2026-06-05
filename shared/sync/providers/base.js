/**
 * TMPT Sync Provider — Abstract Base Class
 * Semua provider cloud (GDrive, Dropbox, OneDrive, WebDAV) harus implement interface ini.
 */

class SyncProviderBase {
    /** @returns {string} Nama provider */
    get name() { throw new Error('Not implemented'); }

    /**
     * Upload file ke cloud.
     * @param {string} filename — nama file di cloud
     * @param {Blob}   blob     — konten file
     * @returns {Promise<{id: string}>}
     */
    async upload(filename, blob) { throw new Error('Not implemented'); }

    /**
     * Update file yang sudah ada di cloud.
     * @param {string} fileId — ID file di cloud
     * @param {Blob}   blob   — konten baru
     */
    async update(fileId, blob) { throw new Error('Not implemented'); }

    /**
     * Download file dari cloud.
     * @param {string} fileId — ID file di cloud
     * @returns {Promise<Blob>}
     */
    async download(fileId) { throw new Error('Not implemented'); }

    /**
     * List semua file di folder app cloud.
     * @returns {Promise<Array<{id, name, size, createdAt}>>}
     */
    async listFiles() { throw new Error('Not implemented'); }

    /**
     * Hapus file dari cloud.
     * @param {string} fileId
     */
    async deleteFile(fileId) { throw new Error('Not implemented'); }

    /**
     * Cek apakah user sudah terautentikasi.
     * @returns {Promise<boolean>}
     */
    async isAuthenticated() { throw new Error('Not implemented'); }

    /**
     * Mulai flow autentikasi.
     */
    async authenticate() { throw new Error('Not implemented'); }

    /**
     * Putuskan koneksi / logout.
     */
    async disconnect() { throw new Error('Not implemented'); }
}

window.SyncProviderBase = SyncProviderBase;
