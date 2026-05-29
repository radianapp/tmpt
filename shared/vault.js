/**
 * TMPT Vault Module
 * Handles storage and retrieval of the encrypted vault data.
 */

const VaultModule = {
    DEFAULT_KEY: 'tmpt_vault_v1',
    ACTIVE_VAULT_SETTING: 'tmpt_active_vault_id',

    get STORAGE_KEY() {
        return localStorage.getItem(this.ACTIVE_VAULT_SETTING) || this.DEFAULT_KEY;
    },

    set STORAGE_KEY(key) {
        localStorage.setItem(this.ACTIVE_VAULT_SETTING, key);
    },

    /**
     * List all available vaults in localStorage
     */
    listVaults() {
        const vaults = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('tmpt_vault_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    vaults.push({
                        id: key,
                        name: data.name || (key === this.DEFAULT_KEY ? 'Utama' : key.replace('tmpt_vault_', 'Tmpt ')),
                        isActive: key === this.STORAGE_KEY
                    });
                } catch(e) {}
            }
        }
        return vaults.sort((a, b) => a.id.localeCompare(b.id));
    },

    /**
     * Switch the active vault and redirect to login
     */
    switchVault(vaultId) {
        if (localStorage.getItem(vaultId) !== null) {
            this.STORAGE_KEY = vaultId;
            sessionStorage.clear();
            window.location.href = '/app/auth/login/';
            return true;
        }
        return false;
    },

    /**
     * Check if the active vault exists
     */
    exists() {
        return localStorage.getItem(this.STORAGE_KEY) !== null;
    },

    /**
     * Get the vault metadata (salts, iterations, hint, name)
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
        // Ensure name is preserved if it exists
        const existing = this.getMetadata();
        if (existing && existing.name && !vaultData.name) {
            vaultData.name = existing.name;
        }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(vaultData));
    },

    /**
     * Create a completely new vault with a specific ID and Name
     */
    async createNewVault(name, vaultData) {
        const timestamp = Date.now();
        const vaultId = `tmpt_vault_${timestamp}`;
        vaultData.name = name;
        localStorage.setItem(vaultId, JSON.stringify(vaultData));
        this.STORAGE_KEY = vaultId;
        return vaultId;
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
     * Delete the currently active vault
     */
    destroy() {
        localStorage.removeItem(this.STORAGE_KEY);
        
        // If there are other vaults, switch to one of them
        const remainingVaults = this.listVaults();
        if (remainingVaults.length > 0) {
            this.STORAGE_KEY = remainingVaults[0].id;
        } else {
            localStorage.removeItem(this.ACTIVE_VAULT_SETTING);
        }
        
        sessionStorage.clear();
        window.location.href = '/';
    }
};

window.TMPT_Vault = VaultModule;
