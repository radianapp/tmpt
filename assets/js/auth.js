/**
 * TMPT Auth Module
 * Handles session state, locking/unlocking the vault.
 */

const AuthModule = {
    // The active encryption key (not persisted to disk)
    _activeKey: null,
    
    /**
     * Initialize the session from sessionStorage
     */
    async init() {
        // We can't easily store CryptoKey in sessionStorage
        // If we want to persist across reloads, we'd need to store it encrypted or as raw bytes
        // For now, let's follow the rule: keys only live in RAM.
        // This means reload = relock.
    },

    /**
     * Unlock the vault with a master password
     */
    async unlock(password) {
        if (!window.TMPT_Vault.exists()) {
            throw new Error("Vault tidak ditemukan. Silakan buat vault baru.");
        }

        const meta = window.TMPT_Vault.getMetadata();
        const saltEnc = window.TMPT_Crypto.base64ToBuffer(meta.salt_enc);
        
        // Derive key
        const key = await window.TMPT_Crypto.deriveKey(password, saltEnc, meta.iterations);
        
        // Test key by trying to decrypt the payload
        const payload = window.TMPT_Vault.getPayload();
        try {
            const iv = window.TMPT_Crypto.base64ToBuffer(payload.iv);
            const ciphertext = window.TMPT_Crypto.base64ToBuffer(payload.ciphertext);
            
            // Decrypt dummy check or actual data
            await window.TMPT_Crypto.decrypt(ciphertext, key, iv);
            
            // Success! Store key in RAM
            this._activeKey = key;
            sessionStorage.setItem('tmpt_is_unlocked', 'true');
            return true;
        } catch (e) {
            console.error("Unlock failed", e);
            throw new Error("Password salah.");
        }
    },

    /**
     * Lock the vault
     */
    lock() {
        this._activeKey = null;
        sessionStorage.removeItem('tmpt_is_unlocked');
        window.location.href = '/login';
    },

    /**
     * Check if the vault is currently unlocked
     */
    isUnlocked() {
        return this._activeKey !== null && sessionStorage.getItem('tmpt_is_unlocked') === 'true';
    },

    /**
     * Get the active key (only available while unlocked)
     */
    getKey() {
        if (!this.isUnlocked()) throw new Error("Vault terkunci.");
        return this._activeKey;
    },

    /**
     * Middleware-like check for protected pages
     */
    requireAuth() {
        if (!this.isUnlocked()) {
            window.location.href = '/login';
        }
    }
};

window.TMPT_Auth = AuthModule;
