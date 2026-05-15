/**
 * TMPT Crypto Module
 * Uses native Web Crypto API for zero-knowledge encryption.
 * Algorithm: AES-256-GCM
 * Key Derivation: PBKDF2 with SHA-256
 */

const CryptoModule = {
    // Config
    PBKDF2_ITERATIONS: 100000,
    AES_KEY_LEN: 256,
    SALT_LEN: 16,
    IV_LEN: 12,

    /**
     * Derive an encryption key from a password and salt
     */
    async deriveKey(password, salt, iterations = this.PBKDF2_ITERATIONS) {
        const encoder = new TextEncoder();
        const baseKey = await crypto.subtle.importKey(
            "raw",
            encoder.encode(password),
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        return await crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: iterations,
                hash: "SHA-256"
            },
            baseKey,
            { name: "AES-GCM", length: this.AES_KEY_LEN },
            true,
            ["encrypt", "decrypt"]
        );
    },

    /**
     * Encrypt plaintext string
     */
    async encrypt(plaintext, key) {
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(this.IV_LEN));
        const encryptedContent = await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            encoder.encode(plaintext)
        );

        return {
            ciphertext: encryptedContent,
            iv: iv
        };
    },

    /**
     * Decrypt ArrayBuffer
     */
    async decrypt(ciphertext, key, iv) {
        const decoder = new TextDecoder();
        const decryptedContent = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            ciphertext
        );

        return decoder.decode(decryptedContent);
    },

    /**
     * Helper to convert ArrayBuffer to Base64
     */
    bufferToBase64(buffer) {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    },

    /**
     * Helper to convert Base64 to ArrayBuffer
     */
    base64ToBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    },

    /**
     * Generate random salt
     */
    generateSalt() {
        return crypto.getRandomValues(new Uint8Array(this.SALT_LEN));
    }
};

// Export for use in other scripts
window.TMPT_Crypto = CryptoModule;
