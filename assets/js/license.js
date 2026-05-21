/**
 * TMPT Pro License Verification Module (100% Client-Side)
 * Verifies signed cryptographic license keys using native Web Crypto API (Ed25519)
 */

const LicenseModule = {
    // Embedded Public Key (Safe to expose)
    PUBLIC_KEY_JWK: {
        kty: "OKP",
        crv: "Ed25519",
        x: "o7LXNyqcXCVNGSBx_sLZpQS6ZZQz5paO2L7m1LGW6So",
        key_ops: ["verify"],
        ext: true
    },

    // Cache to avoid parsing/verifying signature on every page load
    _cachedStatus: null,

    /**
     * Decode a base64url string to an ArrayBuffer
     */
    _base64urlToBuffer(b64url) {
        // Pad with '=' if necessary
        let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) {
            b64 += '=';
        }
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    },

    /**
     * Decode base64url string to UTF-8 text
     */
    _base64urlToString(b64url) {
        let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) {
            b64 += '=';
        }
        return decodeURIComponent(atob(b64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    },

    /**
     * Verify a license key signature and decode the payload
     */
    async verifyLicenseKey(licenseKey) {
        if (!licenseKey || !licenseKey.startsWith("TMPT-PRO.")) {
            throw new Error("Format lisensi tidak valid.");
        }

        const parts = licenseKey.split(".");
        if (parts.length !== 3) {
            throw new Error("Format lisensi rusak.");
        }

        const payloadB64 = parts[1];
        const signatureB64 = parts[2];

        try {
            // Import public key
            const publicKey = await crypto.subtle.importKey(
                "jwk",
                this.PUBLIC_KEY_JWK,
                { name: "Ed25519" },
                true,
                ["verify"]
            );

            // Convert payload and signature
            const encoder = new TextEncoder();
            const payloadStr = this._base64urlToString(payloadB64);
            const payloadBytes = encoder.encode(payloadStr);
            const signatureBuffer = this._base64urlToBuffer(signatureB64);

            // Verify signature
            const isValid = await crypto.subtle.verify(
                { name: "Ed25519" },
                publicKey,
                signatureBuffer,
                payloadBytes
            );

            if (!isValid) {
                throw new Error("Tanda tangan lisensi tidak valid (Signature mismatch).");
            }

            const payloadObj = JSON.parse(payloadStr);
            
            // Check expiry
            const expiryDate = new Date(payloadObj.expires);
            if (expiryDate < new Date()) {
                throw new Error("Masa aktif lisensi telah berakhir.");
            }

            return {
                valid: true,
                email: payloadObj.email,
                plan: payloadObj.plan,
                expires: payloadObj.expires,
                trial: false
            };

        } catch (err) {
            console.error("[LICENSE] Key verification failed:", err);
            throw new Error(err.message || "Gagal memverifikasi lisensi.");
        }
    },

    /**
     * Check if Pro features are unlocked (License Key OR Active Trial)
     */
    isPro() {
        const status = this.getProStatus();
        return status.isPro;
    },

    /**
     * Get detailed status of the subscription / trial
     */
    getProStatus() {
        if (this._cachedStatus) {
            return this._cachedStatus;
        }

        const res = {
            isPro: false,
            type: null, // 'license' | 'trial'
            plan: null, // 'monthly' | 'yearly' | 'lifetime' | 'trial'
            email: null,
            expiresAt: null,
            daysRemaining: null
        };

        // 1. Cek License Key persisten di localStorage
        const storedKey = localStorage.getItem('tmpt_pro_license');
        if (storedKey) {
            try {
                // Parse payload lokal (verifikasi full async dipicu berkala/saat input)
                const parts = storedKey.split(".");
                if (parts.length === 3) {
                    const payloadStr = this._base64urlToString(parts[1]);
                    const payload = JSON.parse(payloadStr);
                    const expiry = new Date(payload.expires);
                    
                    if (expiry > new Date()) {
                        res.isPro = true;
                        res.type = 'license';
                        res.plan = payload.plan;
                        res.email = payload.email;
                        res.expiresAt = payload.expires;
                        res.daysRemaining = Math.max(0, Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24)));
                        this._cachedStatus = res;
                        return res;
                    }
                }
            } catch (e) {
                console.error("[LICENSE] Failed parsing stored license key:", e);
            }
        }

        // 2. Cek Trial status
        const trialExpiryStr = localStorage.getItem('tmpt_pro_trial_expiry');
        if (trialExpiryStr) {
            const expiry = new Date(trialExpiryStr);
            if (expiry > new Date()) {
                res.isPro = true;
                res.type = 'trial';
                res.plan = 'trial';
                res.expiresAt = trialExpiryStr;
                res.daysRemaining = Math.max(0, Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24)));
                this._cachedStatus = res;
                return res;
            }
        }

        this._cachedStatus = res;
        return res;
    },

    /**
     * Activate a purchased license key
     */
    async activateLicense(licenseKey) {
        // Bersihkan cache status
        this._cachedStatus = null;

        try {
            const result = await this.verifyLicenseKey(licenseKey);
            if (result.valid) {
                localStorage.setItem('tmpt_pro_license', licenseKey);
                // Matikan status trial jika ada
                localStorage.removeItem('tmpt_pro_trial_expiry');
                localStorage.removeItem('tmpt_pro_trial_start');
                return result;
            }
            throw new Error("Kunci lisensi tidak valid.");
        } catch (err) {
            throw err;
        }
    },

    /**
     * Start the 14-day Free Trial (Client-side localized)
     */
    activateTrial() {
        this._cachedStatus = null;
        
        if (localStorage.getItem('tmpt_pro_trial_expiry')) {
            throw new Error("Anda sudah pernah mengaktifkan Free Trial di perangkat ini.");
        }

        const now = new Date();
        const expiry = new Date();
        expiry.setDate(now.getDate() + 14); // 14 hari

        localStorage.setItem('tmpt_pro_trial_start', now.toISOString());
        localStorage.setItem('tmpt_pro_trial_expiry', expiry.toISOString());

        return {
            valid: true,
            plan: 'trial',
            expires: expiry.toISOString()
        };
    },

    /**
     * Deactivate / Log out License (Kembali ke versi free)
     */
    deactivate() {
        this._cachedStatus = null;
        localStorage.removeItem('tmpt_pro_license');
        localStorage.removeItem('tmpt_pro_trial_expiry');
        localStorage.removeItem('tmpt_pro_trial_start');
    }
};

window.TMPT_License = LicenseModule;
