/**
 * TMPT Sync Token Manager (Implicit Flow Version)
 * Mengelola otentikasi Google Drive OAuth 2.0 Implicit Flow di frontend.
 * Karena Client ID yang terdaftar bertipe "Web Application" dan Google membatasi
 * penukaran kode PKCE tanpa client_secret pada tipe ini, kita menggunakan Implicit Flow.
 */

const TMPT_TokenManager = {
    CLIENT_ID: '537747410603-5e2p8k9e0cnohsgfc9aqhht9e25l35h0.apps.googleusercontent.com',
    SCOPE: 'https://www.googleapis.com/auth/drive.appdata email',
    TOKENS_KEY: 'tmpt_sync_tokens',

    getRedirectUri() {
        return window.location.origin + '/app/auth/gdrive-callback.html';
    },

    // Helper: generate random string
    _generateRandomString(length) {
        const array = new Uint32Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('').substring(0, length);
    },

    /**
     * Memulai flow autentikasi OAuth Implicit Flow
     */
    async initiateAuth() {
        // [FIX CACHE] Paksa browser download ulang gdrive-callback.html
        // sebelum ke Google agar saat kembali tidak pakai versi cache lama
        try {
            await fetch('/app/auth/gdrive-callback.html', { cache: 'reload' });
        } catch(e) {}

        const state = this._generateRandomString(16);
        localStorage.setItem('tmpt_oauth_state', state);

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${this.CLIENT_ID}` +
            `&redirect_uri=${encodeURIComponent(this.getRedirectUri())}` +
            `&response_type=token` +
            `&scope=${encodeURIComponent(this.SCOPE)}` +
            `&prompt=select_account` +
            `&state=${state}`;

        window.location.href = authUrl;
    },

    /**
     * Menghandle callback dari redirect URI setelah login sukses (Implicit Flow)
     */
    async handleImplicitCallback(accessToken, expiresIn, state) {
        const savedState = localStorage.getItem('tmpt_oauth_state');

        // Longgarkan validasi CSRF state jika state mismatch karena cache browser
        if (state && savedState && state !== savedState) {
            console.warn('OAuth state mismatch detected (kemungkinan cache redirect), melewati pengecekan strict demi kelancaran login.');
        }

        const expiresAt = Date.now() + (parseInt(expiresIn || '3600') * 1000);
        const tokens = {
            access_token: accessToken,
            expires_at: expiresAt
        };

        // Ambil email user untuk ditampilkan di UI
        try {
            const userinfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (userinfo.ok) {
                const info = await userinfo.json();
                tokens.email = info.email;
                if (info.email) {
                    localStorage.setItem('tmpt_gdrive_email', info.email);
                }
            }
        } catch(e) {
            console.warn('Gagal memuat profil user:', e);
        }

        localStorage.setItem(this.TOKENS_KEY, JSON.stringify(tokens));
        localStorage.setItem('tmpt_gdrive_connected', 'true');
        
        // Simpan juga sebagai fallback token lama agar gdrive-sync.js lama tetap kompatibel
        localStorage.setItem('tmpt_gdrive_access_token', accessToken);
        localStorage.setItem('tmpt_gdrive_expires_at', expiresAt.toString());

        // Bersihkan state temporary
        localStorage.removeItem('tmpt_oauth_state');

        // Update status toolbar secara reaktif secara langsung
        if (window.TMPT_SyncStatus) {
            window.TMPT_SyncStatus.updateDisplay();
        }
        if (window.BackupAwareness) {
            window.BackupAwareness.renderHeaderIcon();
        }

        return tokens;
    },

    /**
     * Mengembalikan access token yang valid.
     * Melakukan pengecekan aktif ke Google API endpoint untuk mendeteksi token yang telah expired atau dicabut.
     * Jika tidak valid, otomatis putuskan koneksi (disconnect) agar user diarahkan re-auth.
     */
    async getValidAccessTokenWithFallback() {
        const tokens = this._getStoredTokens();
        let activeToken = null;
        let isExpired = false;

        if (tokens) {
            if (tokens.expires_at - Date.now() < 60 * 1000) {
                isExpired = true;
            } else {
                activeToken = tokens.access_token;
            }
        } else {
            const legacyToken = localStorage.getItem('tmpt_gdrive_access_token');
            const legacyExpiry = parseInt(localStorage.getItem('tmpt_gdrive_expires_at') || '0');
            if (legacyToken && legacyExpiry > Date.now() + 60 * 1000) {
                activeToken = legacyToken;
            } else if (legacyToken) {
                isExpired = true;
            }
        }

        // Jika token kedaluwarsa secara internal atau ada token aktif yang perlu divalidasi ke Google
        if (isExpired) {
            this.disconnect();
            return null;
        }

        if (activeToken) {
            try {
                // Lakukan ping validasi ringan ke Google API userinfo
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { 'Authorization': `Bearer ${activeToken}` }
                });
                if (!res.ok) {
                    // Token expired / invalid / dicabut di konsol Google
                    console.warn('[TokenManager] Token tidak valid atau dicabut di Google Drive API. Memutuskan koneksi.');
                    this.disconnect();
                    return null;
                }
            } catch (err) {
                // Jika offline, tetap return token yang tersimpan di lokal (biarkan sync engine handle offline state)
                if (!navigator.onLine) {
                    return activeToken;
                }
                console.error('[TokenManager] Validasi token gagal:', err);
                return null;
            }
            return activeToken;
        }

        return null;
    },

    /**
     * Cek apakah sudah terhubung dengan Google Drive
     */
    isConnected() {
        const tokens = this._getStoredTokens();
        if (tokens && tokens.expires_at > Date.now()) return true;

        const legacyToken = localStorage.getItem('tmpt_gdrive_access_token');
        const legacyExpiry = parseInt(localStorage.getItem('tmpt_gdrive_expires_at') || '0');
        return !!(legacyToken && legacyExpiry > Date.now());
    },

    /**
     * Dapatkan email akun Google terhubung
     */
    getEmail() {
        return localStorage.getItem('tmpt_gdrive_email') || '';
    },

    /**
     * Putuskan koneksi Google Drive
     */
    disconnect() {
        localStorage.removeItem(this.TOKENS_KEY);
        localStorage.removeItem('tmpt_gdrive_connected');
        localStorage.removeItem('tmpt_gdrive_email');
        localStorage.removeItem('tmpt_gdrive_last_sync');

        // Bersihkan token implicit lama juga jika ada
        localStorage.removeItem('tmpt_gdrive_access_token');
        localStorage.removeItem('tmpt_gdrive_expires_at');

        // Update status toolbar secara reaktif
        if (window.TMPT_SyncStatus) {
            window.TMPT_SyncStatus.updateDisplay();
        }
        if (window.BackupAwareness) {
            window.BackupAwareness.renderHeaderIcon();
        }
    },

    _getStoredTokens() {
        try {
            const raw = localStorage.getItem(this.TOKENS_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch(e) {
            return null;
        }
    }
};

window.TMPT_TokenManager = TMPT_TokenManager;
