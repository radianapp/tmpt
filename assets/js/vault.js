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
            return JSON.parse(raw);
        } catch (e) {
            console.error("Failed to parse vault metadata", e);
            return null;
        }
    },

    /**
     * Save a new vault or update existing
     */
    async save(vaultData) {
        console.log("[VAULT] Saving full vault data...");
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(vaultData));
    },

    /**
     * Load the encrypted payload ( {iv, ciphertext} )
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
     * Update ONLY the encrypted payload in the existing vault
     */
    updatePayload(encryptedPayload) {
        console.log("[VAULT] Updating payload...");
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (!raw) {
            console.error("[VAULT] Update failed: No vault found in localStorage");
            return false;
        }
        try {
            const data = JSON.parse(raw);
            data.payload = encryptedPayload;
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            console.log("[VAULT] Payload updated successfully!");
            return true;
        } catch (e) {
            console.error("[VAULT] Update failed:", e);
            return false;
        }
    },

    /**
     * Delete the entire vault (Nuclear option)
     */
    destroy() {
        localStorage.removeItem(this.STORAGE_KEY);
        sessionStorage.clear();
        window.location.href = '/';
    }
};

window.TMPT_Vault = VaultModule;
