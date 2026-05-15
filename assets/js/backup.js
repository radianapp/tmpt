/**
 * TMPT Backup Module
 * Handles exporting and importing the encrypted vault file (.tmpt)
 */

const BackupModule = {
    /**
     * Export the current vault to a .tmpt file
     */
    async exportVault() {
        try {
            const vaultData = localStorage.getItem('tmpt_vault_v1');
            if (!vaultData) {
                window.TMPT_UI.toast("Brankas tidak ditemukan untuk di-backup.", "error");
                return;
            }

            // Buat Blob dari data JSON (yang sudah terenkripsi)
            const blob = new Blob([vaultData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // Format nama file: TMPT-Backup-YYYY-MM-DD.tmpt
            const date = new Date().toISOString().split('T')[0];
            const fileName = `TMPT-Backup-${date}.tmpt`;

            // Trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            window.TMPT_UI.toast("Backup berhasil diunduh!", "success");
        } catch (err) {
            console.error("Export failed:", err);
            window.TMPT_UI.toast("Gagal mengekspor backup.", "error");
        }
    },

    /**
     * Import a vault from a .tmpt file
     */
    async importVault(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                console.error("[BACKUP] No file selected.");
                return reject("Tidak ada file dipilih.");
            }
            
            console.log("[BACKUP] Starting import for file:", file.name);
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const content = e.target.result;
                    const parsed = JSON.parse(content);

                    console.log("[BACKUP] File parsed successfully. Validating structure...");
                    if (!parsed.salt_enc || !parsed.payload) {
                        throw new Error("Format file .tmpt tidak valid (Missing keys).");
                    }

                    if (localStorage.getItem('tmpt_vault_v1')) {
                        console.log("[BACKUP] Existing vault found, asking for confirmation...");
                        const confirmed = await window.TMPT_UI.confirm("Mengimpor data akan MENGHAPUS Brankas yang ada sekarang. Lanjutkan?");
                        if (!confirmed) {
                            console.log("[BACKUP] Import cancelled by user.");
                            return resolve(false);
                        }
                    }

                    console.log("[BACKUP] Confirmation received. Overwriting localStorage...");
                    localStorage.setItem('tmpt_vault_v1', content);
                    
                    window.TMPT_UI.toast("Brankas berhasil dipulihkan!", "success");
                    
                    setTimeout(() => {
                        console.log("[BACKUP] Redirecting to lock...");
                        window.TMPT_Auth.lock();
                    }, 1500);

                    resolve(true);
                } catch (err) {
                    console.error("[BACKUP] Import failed:", err);
                    window.TMPT_UI.toast("Gagal mengimpor: " + err.message, "error");
                    reject(err);
                }
            };
            reader.readAsText(file);
        });
    }
};

window.TMPT_Backup = BackupModule;
