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
            const vaultDataStr = localStorage.getItem('tmpt_vault_v1');
            if (!vaultDataStr) {
                window.TMPT_UI.toast("Brankas tidak ditemukan untuk di-backup.", "error");
                return;
            }

            const vaultObj = JSON.parse(vaultDataStr);

            // Bundel seluruh ekosistem TMPT (Brankas + Catat)
            const bundle = {
                app: "TMPT-Ecosystem",
                version: 2,
                exported_at: new Date().toISOString(),
                vault_v1: vaultObj,
                catat: {
                    security_mode: localStorage.getItem('catat_security_mode') || 'standard',
                    notes: localStorage.getItem('catat_notes') || null,
                    lists: localStorage.getItem('catat_lists') || null,
                    notes_enc: localStorage.getItem('catat_notes_enc') || null,
                    lists_enc: localStorage.getItem('catat_lists_enc') || null
                }
            };

            const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const date = new Date().toISOString().split('T')[0];
            const fileName = `TMPT-Backup-${date}.tmpt`;

            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            window.TMPT_UI.toast("Backup ekosistem berhasil diunduh!", "success");
        } catch (err) {
            console.error("Export failed:", err);
            window.TMPT_UI.toast("Gagal mengekspor backup.", "error");
        }
    },

    /**
     * Import a vault from a .tmpt file
     */
    async importVault(fileInput) {
        return new Promise((resolve, reject) => {
            let file = fileInput;
            if (fileInput && fileInput.files && fileInput.files[0]) {
                file = fileInput.files[0];
            }
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
                    
                    let isV2 = parsed.version === 2 && parsed.vault_v1;
                    let targetVaultObj = isV2 ? parsed.vault_v1 : parsed;

                    if (!targetVaultObj.salt_enc || !targetVaultObj.payload) {
                        throw new Error("Format file .tmpt tidak valid (Missing keys).");
                    }

                    if (localStorage.getItem('tmpt_vault_v1') && !window._backupConfirmed) {
                        console.log("[BACKUP] Existing vault found, asking for confirmation...");
                        const confirmed = await window.TMPT_UI.confirm("PERHATIAN: Pemulihan data akan MENIMPA dan MENGHAPUS seluruh isi Brankas dan Catatan saat ini. Apakah Anda yakin data aktif saat ini sudah di-backup terlebih dahulu?", "KONFIRMASI PEMULIHAN");
                        if (!confirmed) {
                            console.log("[BACKUP] Import cancelled by user.");
                            return resolve(false);
                        }
                    }
                    window._backupConfirmed = false;

                    console.log("[BACKUP] Confirmation received. Overwriting localStorage...");
                    localStorage.setItem('tmpt_vault_v1', JSON.stringify(targetVaultObj));
                    
                    if (isV2 && parsed.catat) {
                        if (parsed.catat.security_mode) localStorage.setItem('catat_security_mode', parsed.catat.security_mode);
                        if (parsed.catat.notes) localStorage.setItem('catat_notes', parsed.catat.notes);
                        else localStorage.removeItem('catat_notes');
                        if (parsed.catat.lists) localStorage.setItem('catat_lists', parsed.catat.lists);
                        else localStorage.removeItem('catat_lists');
                        if (parsed.catat.notes_enc) localStorage.setItem('catat_notes_enc', parsed.catat.notes_enc);
                        else localStorage.removeItem('catat_notes_enc');
                        if (parsed.catat.lists_enc) localStorage.setItem('catat_lists_enc', parsed.catat.lists_enc);
                        else localStorage.removeItem('catat_lists_enc');
                        console.log("[BACKUP] Data Catatan dan Daftar Tugas ikut dipulihkan.");
                    }
                    
                    window.TMPT_UI.toast("Brankas dan Catatan berhasil dipulihkan!", "success");
                    
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
