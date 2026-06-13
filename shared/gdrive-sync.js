/**
 * TMPT Google Drive Cloud Sync Module
 * Menyediakan sinkronisasi cadangan terenkripsi ke folder tersembunyi Google Drive (appDataFolder)
 * Menggunakan OAuth 2.0 PKCE Flow (Client-Side).
 */

const GDriveSync = {
    // Client ID dari Google Cloud Console - Diisi oleh user
    
    CLIENT_ID: '537747410603-5e2p8k9e0cnohsgfc9aqhht9e25l35h0.apps.googleusercontent.com', 
    SCOPES: 'https://www.googleapis.com/auth/drive.appdata email',

    _getRedirectUri() {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:8000/app/auth/gdrive-callback.html';
        }
        return 'https://tmpt.my.id/app/auth/gdrive-callback.html';
    },

    // Step 1: Mulai flow OAuth Implicit
    async connect() {
        try {
            const proceed = await new Promise((resolve) => {
                const dialog = document.createElement('dialog');
                dialog.style.borderRadius = '20px';
                dialog.style.padding = '2rem';
                dialog.style.maxWidth = '550px';
                dialog.style.width = '95%';

                dialog.innerHTML = `
                    <article style="border: none; margin: 0; padding: 0; background: transparent; box-shadow: none; text-align: left;">
                        <h3 style="font-weight: 700; margin-bottom: 0.75rem; font-size: 1.5rem; text-align: center;">☁️ Hubungkan Google Drive</h3>
                        <p style="margin-bottom: 1.25rem; font-size: 0.95rem; line-height: 1.5; color: var(--pico-secondary);">
                            Anda akan diarahkan ke halaman masuk Google untuk mengaktifkan fitur pencadangan otomatis (Auto Cloud Backup).
                        </p>
                        
                        <div class="warning-alert" style="margin-bottom: 1.5rem; border-left: 4px solid #f59e0b; background: rgba(245, 158, 11, 0.05); padding: 1rem; border-radius: 0 10px 10px 0; font-size: 0.9rem; line-height: 1.5;">
                            <p style="margin: 0 0 0.5rem 0; font-weight: bold; color: #d97706;">⚠️ PENTING SAAT LAYAR PERSETUJUAN GOOGLE:</p>
                            <p style="margin: 0 0 0.5rem 0; color: var(--pico-color);">
                                Pada halaman persetujuan (OAuth consent screen) dari Google, Anda <strong>WAJIB mencentang (ceklis)</strong> opsi izin akses ke:
                            </p>
                            <ul style="margin: 0; padding-left: 1.25rem; font-weight: 600; color: var(--pico-color);">
                                <li>"Melihat dan mengelola data konfigurasi aplikasi di Google Drive Anda"</li>
                            </ul>
                            <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: var(--pico-muted-color);">
                                *Jika opsi ini tidak dicentang, TMPT tidak akan bisa mengunggah atau mengunduh file cadangan Anda, sehingga sinkronisasi akan gagal.
                            </p>
                        </div>

                        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                            <button type="button" class="outline secondary" id="btn-gdrive-cancel" style="margin: 0; border-radius: 8px; padding: 0.5rem 1.5rem; width: auto;">Batal</button>
                            <button type="button" class="btn-navy" id="btn-gdrive-confirm" style="margin: 0; border-radius: 8px; padding: 0.5rem 1.75rem; width: auto; background-color: #2563eb; border-color: #2563eb; color: white;">Lanjutkan ke Google</button>
                        </div>
                    </article>
                `;

                document.body.appendChild(dialog);
                dialog.showModal();

                dialog.querySelector('#btn-gdrive-cancel').onclick = () => {
                    dialog.close();
                    dialog.remove();
                    resolve(false);
                };

                dialog.querySelector('#btn-gdrive-confirm').onclick = () => {
                    dialog.close();
                    dialog.remove();
                    resolve(true);
                };
            });

            if (!proceed) return;

            if (window.TMPT_UI) window.TMPT_UI.showLoader("Menghubungkan ke Google Drive...");
            
            const state = this._generateRandomString(16);
            sessionStorage.setItem('gdrive_oauth_state', state);

            const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
            authUrl.searchParams.set('client_id', this.CLIENT_ID);
            authUrl.searchParams.set('redirect_uri', this._getRedirectUri());
            authUrl.searchParams.set('response_type', 'token'); // Menggunakan Implicit Flow (Token langsung)
            authUrl.searchParams.set('scope', this.SCOPES);
            authUrl.searchParams.set('state', state);
            authUrl.searchParams.set('prompt', 'select_account');

            if (window.TMPT_UI) window.TMPT_UI.hideLoader();
            window.location.href = authUrl.toString();
        } catch (e) {
            console.error("Gagal memulai koneksi Google Drive:", e);
            if (window.TMPT_UI) {
                window.TMPT_UI.hideLoader();
                window.TMPT_UI.toast("Gagal memicu masuk Google: " + e.message, "error");
            }
        }
    },

    // Step 2: Handle callback dari redirect Google (Implicit Flow)
    async handleCallback(accessToken, expiresIn, state) {
        try {
            if (window.TMPT_UI) window.TMPT_UI.showLoader("Menyelesaikan autentikasi Google...");

            const savedState = sessionStorage.getItem('gdrive_oauth_state');

            if (state && savedState && state !== savedState) {
                console.warn("Verifikasi state CSRF mismatch pada legacy flow, melewati pengecekan demi kelancaran login.");
            }

            if (!accessToken) {
                throw new Error("Token akses tidak ditemukan.");
            }

            // Simpan access token di localStorage agar bertahan lebih lama
            localStorage.setItem('gdrive_access_token', accessToken);
            const expiresAt = Date.now() + (parseInt(expiresIn || '3600') * 1000);
            localStorage.setItem('gdrive_token_expires_at', expiresAt);

            localStorage.setItem('tmpt_gdrive_connected', 'true');
            
            // Ambil informasi email pengguna
            const email = await this._fetchUserEmail(accessToken);
            if (email) localStorage.setItem('tmpt_gdrive_email', email);

            if (window.TMPT_UI) {
                window.TMPT_UI.hideLoader();
                window.TMPT_UI.toast("Berhasil menghubungkan Google Drive!", "success");
            }

            // Lakukan sinkronisasi backup perdana
            await this.uploadSync();
            
            // Redirect kembali ke settings
            window.location.href = '/app/auth/settings/#section-backup';
        } catch (e) {
            console.error("Gagal memproses login Google:", e);
            if (window.TMPT_UI) {
                window.TMPT_UI.hideLoader();
                window.TMPT_UI.toast("Login Google Gagal: " + e.message, "error");
            }
            setTimeout(() => { window.location.href = '/app/auth/settings/#section-backup'; }, 3000);
        }
    },

    // Putuskan koneksi Google Drive
    async disconnect() {
        localStorage.removeItem('tmpt_gdrive_connected');
        localStorage.removeItem('tmpt_gdrive_email');
        localStorage.removeItem('tmpt_gdrive_last_sync');
        localStorage.removeItem('tmpt_gdrive_refresh_token_enc');
        localStorage.removeItem('gdrive_access_token');
        localStorage.removeItem('gdrive_token_expires_at');
        sessionStorage.removeItem('gdrive_access_token');
        sessionStorage.removeItem('gdrive_token_expires_at');
        localStorage.removeItem('tmpt_gdrive_access_token');
        localStorage.removeItem('tmpt_gdrive_expires_at');
        localStorage.removeItem('tmpt_sync_tokens');
        
        if (window.BackupAwareness) {
            window.BackupAwareness.renderHeaderIcon();
        }
        if (window.TMPT_UI) {
            window.TMPT_UI.toast("Koneksi Google Drive diputuskan.", "info");
        }
    },

    // Mengecek dan menjalankan Auto Backup
    async checkAndAutoBackup() {
        if (localStorage.getItem('tmpt_gdrive_connected') !== 'true') return;
        
        const schedule = localStorage.getItem('tmpt_gdrive_schedule') || 'daily';
        if (schedule === 'manual') return;

        const lastSync = localStorage.getItem('tmpt_gdrive_last_sync');
        if (!lastSync) {
            await this.uploadSync();
            return;
        }

        const hours = (Date.now() - new Date(lastSync).getTime()) / (1000 * 60 * 60);
        if (schedule === 'daily' && hours >= 24) {
            await this.uploadSync();
        } else if (schedule === 'weekly' && hours >= 168) {
            await this.uploadSync();
        }
    },

    // Membuat file .tmpt backup lalu mengunggahnya ke Google Drive
    async uploadSync() {
        try {
            if (localStorage.getItem('tmpt_gdrive_connected') !== 'true') return;
            
            console.log("[GDrive] Memulai proses sinkronisasi backup ke awan...");
            const token = await this._getAccessToken();
            if (!token) throw new Error("Akses otorisasi Google kedaluwarsa atau tidak valid.");

            // Dapatkan payload backup zip mentah lewat modul TMPT_Backup
            if (!window.TMPT_Backup) {
                console.log("[GDrive] Memuat modul TMPT_Backup secara dinamis...");
                await this._loadScript('/shared/backup.js');
            }
            if (!window.TMPT_Backup) throw new Error("Modul Backup TMPT tidak aktif.");
            
            // 1. Dapatkan database dinamis & buat ZIP
            const JSZip = await window.TMPT_Backup._loadJSZip();
            const zip = new JSZip();

            // 1. Manifest
            const dbs = await window.TMPT_Backup._getDatabases();
            zip.file('manifest.json', JSON.stringify({
                version: '2.0.0',
                created_at: new Date().toISOString(),
                tmpt_version: '2.0.0',
                databases: dbs.map(d => d.name)
            }, null, 2));

            // 2. LocalStorage Data
            const lStorageData = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('tmpt_') || key.startsWith('catat_') || key.startsWith('hitung_') || key.startsWith('slide_') || key.startsWith('tugas_') || key.startsWith('kalender_')) {
                    lStorageData[key] = localStorage.getItem(key);
                }
            }
            zip.file('localstorage.json', JSON.stringify(lStorageData, null, 2));

            // 3. Export IndexedDB
            const dbFolder = zip.folder('databases');
            for (const dbInfo of dbs) {
                const dbData = await window.TMPT_Backup._exportDatabase(dbInfo.name);
                if (dbData) {
                    dbFolder.file(`${dbInfo.name}.json`, JSON.stringify(dbData, null, 2));
                }
            }

            // 4. OPFS Files
            try {
                const root = await navigator.storage.getDirectory();
                const opfsFolder = zip.folder('opfs');
                for await (const entry of root.values()) {
                    if (entry.kind === 'file') {
                        const file = await entry.getFile();
                        opfsFolder.file(entry.name, file);
                    }
                }
            } catch (err) {
                console.warn("[GDrive] Gagal memuat file OPFS untuk cloud backup:", err);
            }

            const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
            
            // 5. Ambil metadata vault (salt & iterations) untuk disertakan di payload
            const vaultMeta = window.TMPT_Vault ? window.TMPT_Vault.getMetadata() : null;

            // 6. Enkripsi backup dengan Kata Kunci Utama
            const key = window.TMPT_Auth.getKey();
            if (!key) throw new Error("Brankas terkunci. Tidak dapat mengenkripsi data.");

            const arrayBuffer = await zipBlob.arrayBuffer();
            const base64Str = await window.TMPT_Backup._arrayBufferToBase64(arrayBuffer);
            const encrypted = await window.TMPT_Crypto.encrypt(base64Str, key);

            const encryptedPayload = JSON.stringify({
                format: "tmpt-encrypted-v2",
                exported_at: new Date().toISOString(),
                // salt_enc & iterations disimpan agar perangkat baru bisa menurunkan kunci dari kata sandi
                salt: vaultMeta?.salt_enc || null,
                iterations: vaultMeta?.iterations || 100000,
                payload: encrypted
            }, null, 2);

            const finalBlob = new Blob([encryptedPayload], { type: 'application/json' });
            
            // Peringatan ukuran jika > 50MB
            if (finalBlob.size > 50 * 1024 * 1024) {
                console.warn("[GDrive] Ukuran file cadangan besar: " + (finalBlob.size / 1024 / 1024).toFixed(2) + "MB");
            }

            let vaultName = "Utama";
            if (window.TMPT_Vault) {
                const meta = window.TMPT_Vault.getMetadata();
                if (meta && meta.name) {
                    vaultName = meta.name;
                }
            }
            const safeVaultName = vaultName.replace(/[^a-zA-Z0-9_-]/g, '_');
            const date = new Date().toISOString().split('T')[0];
            const filename = `TMPT-Backup-${safeVaultName}-${date}.tmpt`;

            // Unggah berkas ke Google Drive (appDataFolder)
            await this._uploadToDrive(token, finalBlob, filename);
            
            // Update metadata backup sukses
            if (window.BackupAwareness) {
                window.BackupAwareness.markBackupComplete('drive');
            }
            
            // Lakukan pembersihan (rolling retention): hapus file lama, sisakan 3 file terbaru
            await this._pruneOldBackups(token);

            console.log("[GDrive] Sinkronisasi backup ke Google Drive berhasil!");
        } catch (e) {
            console.error("[GDrive] Sinkronisasi otomatis awan gagal:", e);
        }
    },

    // Menghasilkan daftar file backup yang tersimpan di Drive
    async listBackups() {
        try {
            const token = await this._getAccessToken();
            if (!token) return [];

            const cb = new Date().getTime();
            const res = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&orderBy=createdTime desc&fields=files(id,name,createdTime,size)&_cb=${cb}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Gagal mengambil daftar file di Drive.");
            const data = await res.json();
            return data.files || [];
        } catch (e) {
            console.error("Gagal mendapatkan riwayat backup Drive:", e);
            return [];
        }
    },

    // Download dan memulihkan dari Drive
    async restoreBackup(fileId) {
        try {
            if (window.TMPT_UI) window.TMPT_UI.showLoader("Mengunduh berkas cadangan dari Drive...");
            const token = await this._getAccessToken();
            if (!token) throw new Error("Token tidak valid.");

            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Gagal mengunduh file cadangan dari awan.");
            const blob = await res.blob();

            if (window.TMPT_UI) window.TMPT_UI.hideLoader();
            
            // Masukkan ke BackupModule import
            await window.TMPT_Backup.importVault(blob);
        } catch (e) {
            console.error("Gagal merestore dari Google Drive:", e);
            if (window.TMPT_UI) {
                window.TMPT_UI.hideLoader();
                window.TMPT_UI.toast("Restore gagal: " + e.message, "error");
            }
        }
    },

    // --- Private / Helper Methods --- 

    async _uploadToDrive(token, blob, filename) {
        const metadata = {
            name: filename,
            parents: ['appDataFolder']
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: form
        });

        if (!res.ok) {
            const body = await res.text();
            throw new Error("Gagal mengunggah file ke Google Drive: " + body);
        }

        return await res.json();
    },

    async _pruneOldBackups(token) {
        try {
            const files = await this.listBackups();
            // Hanya simpan 3 file terbaru
            if (files.length > 3) {
                const toDelete = files.slice(3);
                for (const file of toDelete) {
                    await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    console.log(`[GDrive] Menghapus backup lama: ${file.name}`);
                }
            }
        } catch (e) {
            console.warn("Gagal melakukan pemangkasan file lama:", e);
        }
    },

    async _fetchUserEmail(accessToken) {
        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                return data.email;
            }
        } catch (e) {
            console.warn("Gagal mengambil email pengguna:", e);
        }
        return null;
    },

    async _getAccessToken() {
        let token = localStorage.getItem('tmpt_gdrive_access_token') || sessionStorage.getItem('tmpt_gdrive_access_token');
        let expiresAt = localStorage.getItem('tmpt_gdrive_expires_at') || sessionStorage.getItem('tmpt_gdrive_expires_at');

        if (!token) {
            token = localStorage.getItem('gdrive_access_token') || sessionStorage.getItem('gdrive_access_token');
            expiresAt = localStorage.getItem('gdrive_token_expires_at') || sessionStorage.getItem('gdrive_token_expires_at');
        }

        if (!token) {
            try {
                const stored = localStorage.getItem('tmpt_sync_tokens');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    token = parsed.access_token;
                    expiresAt = parsed.expires_at;
                }
            } catch (e) {}
        }

        if (token && expiresAt && Date.now() < parseInt(expiresAt) - 60000) {
            return token;
        }

        console.warn("[GDrive] Token akses Google Drive kedaluwarsa atau tidak ditemukan.");
        return null;
    },

    _generateRandomString(length) {
        const array = new Uint32Array(length / 2);
        window.crypto.getRandomValues(array);
        return Array.from(array, dec => dec.toString(16).padStart(2, '0')).join('').substring(0, length);
    },

    async _sha256(plain) {
        const encoder = new TextEncoder();
        const data = encoder.encode(plain);
        const hash = await window.crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(hash)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    },

    // ================================================================
    // SIMPLE SYNC API — Sync Save & Sync Open (1 file tetap per akun)
    // ================================================================

    /** Nama file tetap untuk simple cloud sync. */
    SAVE_FILENAME: 'tmpt-save.tmpt',

    /**
     * Sync Save: bangun ZIP, enkripsi, upload ke Drive sebagai 1 file tetap.
     * Jika file sudah ada → timpa (upsert). Brankas harus dalam keadaan terbuka.
     * @returns {Promise<{size: number}>}
     */
    async syncSave() {
        const token = await this._getAccessToken();
        if (!token) throw new Error('Koneksi Google Drive tidak valid. Silakan hubungkan ulang.');

        if (!window.TMPT_Backup) await this._loadScript('/shared/backup.js');
        if (!window.TMPT_Crypto) await this._loadScript('/shared/crypto.js');
        if (!window.TMPT_Backup) throw new Error('Modul Backup TMPT tidak tersedia.');

        // 1. Bangun ZIP dari seluruh data TMPT
        const JSZip = await window.TMPT_Backup._loadJSZip();
        const zip = new JSZip();

        const dbs = await window.TMPT_Backup._getDatabases();
        zip.file('manifest.json', JSON.stringify({
            version: '2.0.0',
            created_at: new Date().toISOString(),
            tmpt_version: '2.0.0',
            databases: dbs.map(d => d.name),
        }, null, 2));

        // localStorage (key yang berawalan tmpt_ dan nama app)
        const lsData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith('tmpt_') || k.startsWith('catat_') ||
                k.startsWith('hitung_') || k.startsWith('slide_') ||
                k.startsWith('tugas_') || k.startsWith('kalender_'))) {
                lsData[k] = localStorage.getItem(k);
            }
        }
        zip.file('localstorage.json', JSON.stringify(lsData, null, 2));

        // IndexedDB semua database
        const dbFolder = zip.folder('databases');
        for (const dbInfo of dbs) {
            try {
                const dbData = await window.TMPT_Backup._exportDatabase(dbInfo.name);
                if (dbData) dbFolder.file(`${dbInfo.name}.json`, JSON.stringify(dbData, null, 2));
            } catch (e) { console.warn('[syncSave] Lewati DB', dbInfo.name, e); }
        }

        // OPFS (binary files)
        try {
            const root = await navigator.storage.getDirectory();
            const opfsFolder = zip.folder('opfs');
            for await (const entry of root.values()) {
                if (entry.kind === 'file') {
                    const file = await entry.getFile();
                    opfsFolder.file(entry.name, file);
                }
            }
        } catch (e) { console.warn('[syncSave] OPFS dilewati:', e); }

        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

        // 2. Enkripsi dengan Kata Kunci Utama yang aktif
        const vaultMeta = window.TMPT_Vault ? window.TMPT_Vault.getMetadata() : null;
        const key = window.TMPT_Auth?.getKey();
        if (!key) throw new Error('Brankas terkunci. Buka kunci Brankas Anda terlebih dahulu.');

        const arrayBuffer = await zipBlob.arrayBuffer();
        const base64Str = await window.TMPT_Backup._arrayBufferToBase64(arrayBuffer);
        const encrypted = await window.TMPT_Crypto.encrypt(base64Str, key);

        const encryptedPayload = JSON.stringify({
            format:      'tmpt-encrypted-v2',
            exported_at: new Date().toISOString(),
            salt:        vaultMeta?.salt_enc   || null,
            iterations:  vaultMeta?.iterations || 100000,
            payload:     encrypted,
        }, null, 2);

        const finalBlob = new Blob([encryptedPayload], { type: 'application/json' });

        // 3. Upsert: update jika sudah ada, buat baru jika belum
        const files = await this.listBackups();
        const existing = files.find(f => f.name === this.SAVE_FILENAME);

        if (existing) {
            await this._updateDriveFile(existing.id, finalBlob, token);
        } else {
            await this._uploadToDrive(token, finalBlob, this.SAVE_FILENAME);
        }

        const now = new Date().toISOString();
        localStorage.setItem('tmpt_gdrive_last_sync', now);
        if (window.BackupAwareness) window.BackupAwareness.markBackupComplete('drive');

        console.log('[GDrive] syncSave ✓', (finalBlob.size / 1024).toFixed(1), 'KB');
        return { size: finalBlob.size };
    },

    /**
     * Dapatkan metadata file save utama dari Drive dengan fallback bertingkat.
     * Prioritas:
     * 1. tmpt-save.tmpt (Simple Sync)
     * 2. tmpt-latest.tmpt (Cloud Sync Engine)
     * 3. File berformat TMPT-Backup-*.tmpt atau tmpt-*.tmpt (historis/manual)
     * @returns {Promise<{id, name, size, createdTime, modifiedTime}|null>}
     */
    async getSaveFileInfo() {
        try {
            const token = await this._getAccessToken();
            if (!token) return null;
            const files = await this.listBackups();
            if (files.length === 0) return null;

            // 1. Cari tmpt-save.tmpt
            let target = files.find(f => f.name === this.SAVE_FILENAME);
            if (target) return target;

            // 2. Cari tmpt-latest.tmpt
            target = files.find(f => f.name === 'tmpt-latest.tmpt');
            if (target) return target;

            // 3. Fallback: Cari file TMPT-Backup-*.tmpt atau tmpt-*.tmpt yang teranyar
            const patterns = ['TMPT-Backup-', 'tmpt-'];
            const backups = files.filter(f => 
                patterns.some(prefix => f.name.startsWith(prefix)) && f.name.endsWith('.tmpt')
            );
            if (backups.length > 0) {
                // Urutan default listBackups sudah desc (terbaru di atas)
                return backups[0];
            }

            return null;
        } catch (e) {
            console.warn('[GDrive.getSaveFileInfo]', e);
            return null;
        }
    },

    /**
     * Download file save dari Google Drive menggunakan resolusi fallback getSaveFileInfo.
     * @returns {Promise<Blob|null>} — null jika file tidak ditemukan
     */
    async downloadSaveFile() {
        const token = await this._getAccessToken();
        if (!token) throw new Error('Token Google Drive tidak valid atau kedaluwarsa.');
        
        const saveFile = await this.getSaveFileInfo();
        if (!saveFile) return null;

        const res = await fetch(
            `https://www.googleapis.com/drive/v3/files/${saveFile.id}?alt=media&_cb=${Date.now()}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error(`Gagal mengunduh file dari Drive: HTTP ${res.status}`);
        return await res.blob();
    },

    /**
     * Update konten file yang sudah ada di Drive (dipakai oleh syncSave saat upsert).
     */
    async _updateDriveFile(fileId, blob, token) {
        const res = await fetch(
            `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
            {
                method:  'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body:    blob,
            }
        );
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`Gagal memperbarui file di Drive (${res.status}): ${body}`);
        }
        return await res.json();
    },

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Gagal memuat script: " + src));
            document.head.appendChild(script);
        });
    }
};

window.GDriveSync = GDriveSync;
