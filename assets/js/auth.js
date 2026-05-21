/**
 * TMPT Auth Module
 * Handles session state, locking/unlocking, and key management.
 */

const AuthModule = {
    _activeKey: null,

    /**
     * Check if the vault is currently unlocked in this session
     */
    isUnlocked() {
        return this._activeKey !== null;
    },

    /**
     * Get the active CryptoKey
     */
    getKey() {
        if (!this.isUnlocked()) return null;
        return this._activeKey;
    },

    /**
     * Initialize the auth state from sessionStorage
     */
    async init() {
        console.log("[BRANKAS] Inisialisasi Auth...");
        const storedKey = sessionStorage.getItem('tmpt_vault_key');
        const isUnlocked = sessionStorage.getItem('tmpt_is_unlocked') === 'true';
        
        if (storedKey && isUnlocked) {
            try {
                const keyBuffer = window.TMPT_Crypto.base64ToBuffer(storedKey);
                this._activeKey = await crypto.subtle.importKey(
                    "raw",
                    keyBuffer,
                    { name: "AES-GCM" },
                    true,
                    ["encrypt", "decrypt"]
                );
                console.log("[BRANKAS] Auth Init Selesai. Unlocked: true");
                return true;
            } catch (e) {
                console.error("Failed to restore session key", e);
                this.lock();
            }
        }
        console.log("[BRANKAS] Auth Init Selesai. Unlocked: false");
        return false;
    },

    /**
     * Unlock the vault with a master password
     */
    async unlock(password) {
        if (!window.TMPT_Vault.exists()) {
            throw new Error("Vault tidak ditemukan. Silakan buat vault baru.");
        }

        const meta = window.TMPT_Vault.getMetadata();
        if (!meta || typeof meta !== 'object' || !meta.salt_enc) {
            throw new Error("Data Brankas rusak atau format tidak valid. Silakan gunakan fitur Pulihkan Data (Import) dari file backup.");
        }
        const saltEnc = window.TMPT_Crypto.base64ToBuffer(meta.salt_enc);
        
        // 1. Derive key from password
        const key = await window.TMPT_Crypto.deriveKey(password, saltEnc, meta.iterations);
        
        // 2. Test key by trying to decrypt the payload
        const payload = window.TMPT_Vault.getPayload();
        
        try {
            // Gunakan payload_verify jika ada, atau payload biasa untuk tes
            const testPayload = meta.payload_verify || payload;
            if (!testPayload) throw new Error("Brankas kosong atau rusak.");

            await window.TMPT_Crypto.decrypt(testPayload, key);
            
            // 3. Success! Store key in RAM
            this._activeKey = key;
            
            // 4. Export key to store in sessionStorage (survives refresh)
            const exportedBuffer = await crypto.subtle.exportKey("raw", key);
            sessionStorage.setItem('tmpt_vault_key', window.TMPT_Crypto.bufferToBase64(exportedBuffer));
            sessionStorage.setItem('tmpt_is_unlocked', 'true');
            
            return true;
        } catch (decErr) {
            console.error("[AUTH] Unlock failed:", decErr);
            
            // Pesan error spesifik untuk file yang dimodifikasi
            if (decErr.name === 'InvalidCharacterError' || (decErr.message && decErr.message.includes('atob'))) {
                throw new Error("File Brankas rusak atau telah dimodifikasi (Karakter Ilegal).");
            }
            
            // OperationError biasanya berarti password salah (MAC mismatch)
            if (decErr.name === 'OperationError') {
                throw new Error("Password Salah atau File Brankas mungkin telah dimodifikasi.");
            }
            
            throw new Error("Password salah atau data tidak valid.");
        }
    },

    /**
     * Lock the vault
     */
    lock() {
        this._activeKey = null;
        sessionStorage.removeItem('tmpt_is_unlocked');
        sessionStorage.removeItem('tmpt_vault_key');
        window.location.href = '/login';
    },

    /**
     * Helper: Require authentication to access a page
     */
    requireAuth() {
        if (!this.isUnlocked()) {
            window.location.href = '/login';
        }
    },

    /**
     * Auto-lock on idle (Fase 4 sneak peek)
     */
    setupIdleListeners() {
        let timeout;
        const resetTimer = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => this.lock(), 15 * 60 * 1000); // 15 menit
        };
        window.onload = resetTimer;
        window.onmousemove = resetTimer;
        window.onmousedown = resetTimer; 
        window.ontouchstart = resetTimer;
        window.onclick = resetTimer;
        window.onkeydown = resetTimer;
    }
};

window.TMPT_Auth = AuthModule;
