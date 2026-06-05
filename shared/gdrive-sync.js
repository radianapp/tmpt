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

    // Step 1: Mulai flow OAuth PKCE
    async connect() {
        try {
            if (window.TMPT_UI) window.TMPT_UI.showLoader("Menghubungkan ke Google Drive...");
            
            // Generate Verifier & Challenge
            const verifier = this._generateRandomString(64);
            sessionStorage.setItem('gdrive_oauth_verifier', verifier);
            
            const challenge = await this._sha256(verifier);
            const state = this._generateRandomString(16);
            sessionStorage.setItem('gdrive_oauth_state', state);

            const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
            authUrl.searchParams.set('client_id', this.CLIENT_ID);
            authUrl.searchParams.set('redirect_uri', this._getRedirectUri());
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('scope', this.SCOPES);
            authUrl.searchParams.set('code_challenge', challenge);
            authUrl.searchParams.set('code_challenge_method', 'S256');
            authUrl.searchParams.set('state', state);
            authUrl.searchParams.set('access_type', 'offline'); // Minta refresh token
            authUrl.searchParams.set('prompt', 'consent');

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

    // Step 2: Handle callback dari redirect Google
    async handleCallback(code, state) {
        try {
            if (window.TMPT_UI) window.TMPT_UI.showLoader("Menyelesaikan autentikasi Google...");

            const savedState = sessionStorage.getItem('gdrive_oauth_state');
            const verifier = sessionStorage.getItem('gdrive_oauth_verifier');

            if (!state || state !== savedState) {
                throw new Error("Verifikasi state CSRF gagal.");
            }

            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: this.CLIENT_ID,
                    code_verifier: verifier,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: this._getRedirectUri()
                })
            });

            if (!response.ok) {
                const errBody = await response.text();
                throw new Error("Gagal menukar kode otorisasi: " + errBody);
            }

            const tokens = await response.json();
            
            // Simpan access token jangka pendek di sessionStorage
            sessionStorage.setItem('gdrive_access_token', tokens.access_token);
            sessionStorage.setItem('gdrive_token_expires_at', Date.now() + (tokens.expires_in * 1000));

            // Simpan refresh token jangka panjang terenkripsi di localStorage
            if (tokens.refresh_token) {
                const key = window.TMPT_Auth.getKey();
                if (!key) throw new Error("Brankas terkunci, tidak dapat mengamankan refresh token.");
                
                const encrypted = await window.TMPT_Crypto.encrypt(tokens.refresh_token, key);
                localStorage.setItem('tmpt_gdrive_refresh_token_enc', encrypted);
            }

            localStorage.setItem('tmpt_gdrive_connected', 'true');
            
            // Ambil informasi email pengguna
            const email = await this._fetchUserEmail(tokens.access_token);
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
        sessionStorage.removeItem('gdrive_access_token');
        sessionStorage.removeItem('gdrive_token_expires_at');
        
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
            
            // 5. Enkripsi backup dengan Kata Kunci Utama
            const key = window.TMPT_Auth.getKey();
            if (!key) throw new Error("Brankas terkunci. Tidak dapat mengenkripsi data.");

            const arrayBuffer = await zipBlob.arrayBuffer();
            const base64Str = await window.TMPT_Backup._arrayBufferToBase64(arrayBuffer);
            const encrypted = await window.TMPT_Crypto.encrypt(base64Str, key);

            const encryptedPayload = JSON.stringify({
                format: "tmpt-encrypted-v2",
                exported_at: new Date().toISOString(),
                payload: encrypted
            }, null, 2);

            const finalBlob = new Blob([encryptedPayload], { type: 'application/json' });
            
            // Peringatan ukuran jika > 50MB
            if (finalBlob.size > 50 * 1024 * 1024) {
                console.warn("[GDrive] Ukuran file cadangan besar: " + (finalBlob.size / 1024 / 1024).toFixed(2) + "MB");
            }

            const date = new Date().toISOString().split('T')[0];
            const filename = `TMPT-Backup-${date}.tmpt`;

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

            const res = await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&orderBy=createdTime desc&fields=files(id,name,createdTime,size)', {
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
        const token = sessionStorage.getItem('gdrive_access_token');
        const expiresAt = sessionStorage.getItem('gdrive_token_expires_at');

        if (token && expiresAt && Date.now() < parseInt(expiresAt) - 60000) {
            return token;
        }

        // Coba refresh token
        const encryptedRefreshToken = localStorage.getItem('tmpt_gdrive_refresh_token_enc');
        if (!encryptedRefreshToken) return null;

        const key = window.TMPT_Auth.getKey();
        if (!key) return null;

        try {
            const refreshToken = await window.TMPT_Crypto.decrypt(encryptedRefreshToken, key);
            
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: this.CLIENT_ID,
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken
                })
            });

            if (!response.ok) throw new Error("Gagal me-refresh token.");
            const tokens = await response.json();

            sessionStorage.setItem('gdrive_access_token', tokens.access_token);
            sessionStorage.setItem('gdrive_token_expires_at', Date.now() + (tokens.expires_in * 1000));
            return tokens.access_token;
        } catch (e) {
            console.error("Gagal merefresh access token Google:", e);
            return null;
        }
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
    }
};

window.GDriveSync = GDriveSync;
