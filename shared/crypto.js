/**
 * TMPT Crypto Module
 * Uses native Web Crypto API for zero-knowledge encryption.
 * Algorithm: AES-256-GCM
 */

const CryptoModule = {
    PBKDF2_ITERATIONS: 100000,
    AES_KEY_LEN: 256,
    SALT_LEN: 16,
    IV_LEN: 12,

    /**
     * Derive an encryption key
     */
    async deriveKey(password, salt, iterations = this.PBKDF2_ITERATIONS) {
        // Jika salt dalam bentuk Base64, ubah ke Buffer
        const saltBuffer = typeof salt === 'string' ? this.base64ToBuffer(salt) : salt;
        
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
                salt: saltBuffer,
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
     * Encrypt plaintext string -> returns {iv, ciphertext} as Base64
     */
    async encrypt(plaintext, key) {
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(this.IV_LEN));
        const encryptedContent = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            encoder.encode(plaintext)
        );

        return {
            ciphertext: this.bufferToBase64(encryptedContent),
            iv: this.bufferToBase64(iv)
        };
    },

    /**
     * Decrypt data
     * payload: can be {iv, ciphertext} object (Base64) or ciphertext buffer
     * key: CryptoKey
     * iv: optional if payload is object
     */
    async decrypt(payload, key, iv = null) {
        let ciphertextBuffer;
        let ivBuffer;

        // Jika input adalah objek {iv, ciphertext} Base64
        if (payload.iv && payload.ciphertext) {
            ivBuffer = this.base64ToBuffer(payload.iv);
            ciphertextBuffer = this.base64ToBuffer(payload.ciphertext);
        } else {
            // Jika input manual (buffer)
            ciphertextBuffer = payload;
            ivBuffer = iv;
        }

        const decoder = new TextDecoder();
        const decryptedContent = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: ivBuffer },
            key,
            ciphertextBuffer
        );

        return decoder.decode(decryptedContent);
    },

    bufferToBase64(buffer) {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    },

    base64ToBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    },

    generateSalt() {
        return crypto.getRandomValues(new Uint8Array(this.SALT_LEN));
    }
};

window.TMPT_Crypto = CryptoModule;
