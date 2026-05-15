/**
 * TMPT Vault Module
 * Handles storage and retrieval of the encrypted vault data.
 */

const VaultModule = {
    STORAGE_KEY: 'tmpt_vault_v1',

    /**
     * Check if a vault exists
     */
    exists() {
        return localStorage.getItem(this.STORAGE_KEY) !== null;
    },

    /**
     * Get the vault metadata (salts, iterations, hint)
     */
    getMetadata() {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (!raw) return null;
        try {
            const data = JSON.parse(raw);
            return {
                salt_auth: data.salt_auth,
                salt_enc: data.salt_enc,
                iterations: data.iterations,
                hint: data.hint
            };
        } catch (e) {
            console.error("Failed to parse vault metadata", e);
            return null;
        }
    },

    /**
     * Save a new vault or update existing
     */
    async save(vaultData) {
        // vaultData should have: salt_auth, salt_enc, iterations, hint, payload { iv, ciphertext }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(vaultData));
    },

    /**
     * Load the encrypted payload
     */
    getPayload() {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (!raw) return null;
        try {
            const data = JSON.parse(raw);
            return data.payload;
        } catch (e) {
            return null;
        }
    },

    /**
     * Delete the entire vault (Nuclear option)
     */
    destroy() {
        localStorage.removeItem(this.STORAGE_KEY);
        sessionStorage.clear();
    }
};

window.TMPT_Vault = VaultModule;
