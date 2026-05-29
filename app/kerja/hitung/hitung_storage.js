/**
 * HITUNG — Storage Module
 * Bahasa Indonesia: Modul Penyimpanan & Enkripsi Berkas HITUNG
 * 
 * Mengelola penyimpanan lokal (standar), penyimpanan terenkripsi Brankas (Pro),
 * pencadangan otomatis draft aktif, serta enkripsi/dekripsi berkas mandiri (.hitung).
 */

const HitungStorage = {
    // Mode Keamanan: 'standard' | 'encrypted'
    getSecurityMode() {
        // Mode terenkripsi membutuhkan lisensi Pro dan Brankas aktif terbuka
        const storedMode = localStorage.getItem('hitung_security_mode') || 'standard';
        if (storedMode === 'encrypted') {
            if (window.TMPT_License && window.TMPT_License.isPro() && window.TMPT_Auth && window.TMPT_Auth.isUnlocked()) {
                return 'encrypted';
            }
            // Fallback ke standar jika tidak lagi memenuhi syarat Pro/Unlock
            return 'standard';
        }
        return 'standard';
    },

    setSecurityMode(mode) {
        if (mode === 'encrypted') {
            if (!window.TMPT_License || !window.TMPT_License.isPro()) {
                throw new Error("Fitur Enkripsi Brankas memerlukan lisensi TMPT Pro.");
            }
            if (!window.TMPT_Auth || !window.TMPT_Auth.isUnlocked()) {
                throw new Error("Silakan buka kunci Brankas Anda terlebih dahulu.");
            }
        }
        localStorage.setItem('hitung_security_mode', mode);
    },

    /**
     * Memperoleh daftar metadata seluruh lembar kerja
     * @returns {Array} List of { id, title, created_at, modified_at }
     */
    getFiles() {
        const mode = this.getSecurityMode();
        if (mode === 'encrypted') {
            const encListStr = localStorage.getItem('hitung_file_list_enc');
            if (!encListStr) return [];
            try {
                // Dekripsi menggunakan kunci Brankas aktif
                const key = window.TMPT_Auth.getKey();
                const decrypted = this._decryptSync(encListStr, key); // Akan diganti async di pemanggil
                return JSON.parse(decrypted) || [];
            } catch (e) {
                console.error("Gagal mendekripsi daftar berkas terenkripsi:", e);
                return [];
            }
        } else {
            const listStr = localStorage.getItem('hitung_file_list');
            if (!listStr) return [];
            try {
                return JSON.parse(listStr) || [];
            } catch (e) {
                return [];
            }
        }
    },

    /**
     * Memperoleh daftar berkas secara Asynchronous (Direkomendasikan)
     */
    async getFilesAsync() {
        const mode = this.getSecurityMode();
        if (mode === 'encrypted') {
            const encListStr = localStorage.getItem('hitung_file_list_enc');
            if (!encListStr) return [];
            try {
                const key = window.TMPT_Auth.getKey();
                const encObj = JSON.parse(encListStr);
                const decrypted = await window.TMPT_Crypto.decrypt(encObj, key);
                return JSON.parse(decrypted) || [];
            } catch (e) {
                console.error("Gagal mendekripsi daftar berkas terenkripsi:", e);
                return [];
            }
        } else {
            const listStr = localStorage.getItem('hitung_file_list');
            if (!listStr) return [];
            try {
                return JSON.parse(listStr) || [];
            } catch (e) {
                return [];
            }
        }
    },

    /**
     * Memuat isi berkas lembar kerja secara async
     * @param {string} fileId
     * @returns {Object|null} Native HitungFile JSON
     */
    async loadFile(fileId) {
        const mode = this.getSecurityMode();
        if (mode === 'encrypted') {
            const encDataStr = localStorage.getItem(`hitung_file_enc_${fileId}`);
            if (!encDataStr) return null;
            try {
                const key = window.TMPT_Auth.getKey();
                const encObj = JSON.parse(encDataStr);
                const decrypted = await window.TMPT_Crypto.decrypt(encObj, key);
                return JSON.parse(decrypted);
            } catch (e) {
                console.error("Gagal mendekripsi berkas:", e);
                throw new Error("Gagal membuka berkas terenkripsi. Kunci tidak valid atau data rusak.");
            }
        } else {
            const dataStr = localStorage.getItem(`hitung_file_${fileId}`);
            if (!dataStr) return null;
            try {
                return JSON.parse(dataStr);
            } catch (e) {
                return null;
            }
        }
    },

    /**
     * Menyimpan berkas lembar kerja baru atau memperbarui yang lama
     * @param {string} fileId
     * @param {Object} fileData - Native HitungFile JSON
     */
    async saveFile(fileId, fileData) {
        const mode = this.getSecurityMode();
        const timestamp = new Date().toISOString();
        
        fileData.modified_at = timestamp;
        if (!fileData.created_at) {
            fileData.created_at = timestamp;
        }

        // Ambil daftar file untuk di-update metadatanya
        const files = await this.getFilesAsync();
        const fileIndex = files.findIndex(f => f.id === fileId);
        
        const fileMeta = {
            id: fileId,
            title: fileData.metadata.title || "Lembar Kerja Tanpa Judul",
            created_at: fileData.created_at,
            modified_at: fileData.modified_at
        };

        if (fileIndex > -1) {
            files[fileIndex] = fileMeta;
        } else {
            files.push(fileMeta);
        }

        // Urutkan berdasarkan waktu modifikasi terbaru
        files.sort((a, b) => new Date(b.modified_at) - new Date(a.modified_at));

        const dataStr = JSON.stringify(fileData);
        const listStr = JSON.stringify(files);

        if (mode === 'encrypted') {
            const key = window.TMPT_Auth.getKey();
            // Enkripsi isi berkas
            const encFile = await window.TMPT_Crypto.encrypt(dataStr, key);
            localStorage.setItem(`hitung_file_enc_${fileId}`, JSON.stringify(encFile));
            
            // Enkripsi daftar berkas
            const encList = await window.TMPT_Crypto.encrypt(listStr, key);
            localStorage.setItem('hitung_file_list_enc', JSON.stringify(encList));

            // Bersihkan sisa-sisa berkas unencrypted jika ada transisi sebelumnya
            localStorage.removeItem(`hitung_file_${fileId}`);
            localStorage.removeItem('hitung_file_list');
        } else {
            // Simpan unencrypted
            localStorage.setItem(`hitung_file_${fileId}`, dataStr);
            localStorage.setItem('hitung_file_list', listStr);

            // Bersihkan sisa-sisa berkas encrypted jika ada transisi sebelumnya
            localStorage.removeItem(`hitung_file_enc_${fileId}`);
            localStorage.removeItem('hitung_file_list_enc');
        }
    },

    /**
     * Menghapus berkas lembar kerja
     */
    async deleteFile(fileId) {
        const mode = this.getSecurityMode();
        const files = await this.getFilesAsync();
        const updatedFiles = files.filter(f => f.id !== fileId);
        const listStr = JSON.stringify(updatedFiles);

        if (mode === 'encrypted') {
            const key = window.TMPT_Auth.getKey();
            const encList = await window.TMPT_Crypto.encrypt(listStr, key);
            localStorage.setItem('hitung_file_list_enc', JSON.stringify(encList));
            localStorage.removeItem(`hitung_file_enc_${fileId}`);
        } else {
            localStorage.setItem('hitung_file_list', listStr);
            localStorage.removeItem(`hitung_file_${fileId}`);
        }
    },

    // === DRAFT AUTO-SAVE ===
    saveActiveDraft(fileData) {
        try {
            fileData.modified_at = new Date().toISOString();
            localStorage.setItem('hitung_active_draft', JSON.stringify(fileData));
        } catch (e) {
            console.error("Gagal menyimpan draft otomatis:", e);
        }
    },

    getActiveDraft() {
        const raw = localStorage.getItem('hitung_active_draft');
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    },

    clearActiveDraft() {
        localStorage.removeItem('hitung_active_draft');
    },

    // === ENKRIPSI STANDALONE (MANDIRI DENGAN PASSWORD KUSTOM) ===
    
    /**
     * Mengenkripsi data lembar kerja dengan password kustom untuk diunduh
     * @param {Object} fileData - Native HitungFile JSON
     * @param {string} password
     * @returns {Object} Encrypted file structure
     */
    async encryptFileWithPassword(fileData, password) {
        const plaintext = JSON.stringify(fileData);
        
        // 1. Generate salt acak (16 bytes)
        const salt = window.TMPT_Crypto.generateSalt();
        const saltB64 = window.TMPT_Crypto.bufferToBase64(salt);

        // 2. Turunkan kunci enkripsi dari password + salt
        const key = await window.TMPT_Crypto.deriveKey(password, salt);

        // 3. Enkripsi plaintext menggunakan kunci
        const encrypted = await window.TMPT_Crypto.encrypt(plaintext, key);

        // 4. Susun struktur berkas .hitung terenkripsi
        return {
            format: "hitung-v1-encrypted",
            salt: saltB64,
            iv: encrypted.iv,
            iterations: window.TMPT_Crypto.PBKDF2_ITERATIONS,
            ciphertext: encrypted.ciphertext
        };
    },

    /**
     * Mendekripsi data berkas .hitung terenkripsi menggunakan password kustom
     * @param {Object} encryptedData - Objek berkas terenkripsi
     * @param {string} password
     * @returns {Object} Native HitungFile JSON
     */
    async decryptFileWithPassword(encryptedData, password) {
        if (encryptedData.format !== "hitung-v1-encrypted") {
            throw new Error("Format berkas terenkripsi tidak cocok.");
        }

        try {
            // 1. Ambil salt & iv
            const salt = window.TMPT_Crypto.base64ToBuffer(encryptedData.salt);
            
            // 2. Turunkan kunci dari password + salt
            const key = await window.TMPT_Crypto.deriveKey(password, salt, encryptedData.iterations);
            
            // 3. Dekripsi ciphertext
            const decrypted = await window.TMPT_Crypto.decrypt({
                iv: encryptedData.iv,
                ciphertext: encryptedData.ciphertext
            }, key);

            return JSON.parse(decrypted);
        } catch (e) {
            console.error("Gagal melakukan dekripsi berkas mandiri:", e);
            throw new Error("Password salah atau data berkas rusak.");
        }
    }
};

window.HitungStorage = HitungStorage;
