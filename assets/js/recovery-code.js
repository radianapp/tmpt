/**
 * TMPT Recovery Code Generator & Verifier (100% Client-Side)
 * Allows zero-knowledge password reset using pre-generated recovery codes.
 */

const RecoveryModule = {
    /**
     * Generate 12-char memorable code (e.g., A7K2-M9X4-P3Q9)
     */
    _generateRandomCode() {
        // Exclude confusing characters: O, 0, I, 1
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 12; i++) {
            if (i > 0 && i % 4 === 0) {
                code += '-';
            }
            const randIndex = crypto.getRandomValues(new Uint32Array(1))[0] % chars.length;
            code += chars[randIndex];
        }
        return code;
    },

    /**
     * Compute SHA-256 hash and return both hex representation and raw buffer
     */
    async _sha256(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text.toUpperCase().trim());
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return { hashHex, hashBuffer };
    },

    /**
     * Generate 8 new recovery codes and encrypt the current active master key with them
     */
    async generateRecoveryCodes(activeKey) {
        if (!activeKey) {
            throw new Error("Brankas harus dibuka terlebih dahulu untuk menghasilkan recovery codes.");
        }

        // Export active master key to raw buffer so we can encrypt it
        const rawMasterKey = await crypto.subtle.exportKey("raw", activeKey);

        const codes = [];
        const recoveryHashes = [];

        for (let i = 0; i < 8; i++) {
            const code = this._generateRandomCode();
            codes.push(code);

            // Compute SHA-256 hash of the code
            const { hashHex, hashBuffer } = await this._sha256(code);

            // Import the code hash as a temporary AES-GCM key to encrypt the master key
            const recoveryCodeKey = await crypto.subtle.importKey(
                "raw",
                hashBuffer,
                { name: "AES-GCM" },
                false,
                ["encrypt"]
            );

            // Encrypt the master key raw bytes
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encryptedBytes = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                recoveryCodeKey,
                rawMasterKey
            );

            recoveryHashes.push({
                hash: hashHex,
                encrypted_key: {
                    ciphertext: window.TMPT_Crypto.bufferToBase64(encryptedBytes),
                    iv: window.TMPT_Crypto.bufferToBase64(iv)
                }
            });
        }

        return {
            codes,
            recoveryHashes
        };
    },

    /**
     * Verify a recovery code and decrypt the master key associated with it
     */
    async recoverMasterKey(recoveryCode, recoveryHashes) {
        if (!recoveryCode || !recoveryHashes || !Array.isArray(recoveryHashes)) {
            throw new Error("Kode pemulihan atau data pemulihan tidak valid.");
        }

        // Compute hash of the input code
        const { hashHex, hashBuffer } = await this._sha256(recoveryCode);

        // Find the hash in metadata
        const matched = recoveryHashes.find(h => h.hash === hashHex);
        if (!matched) {
            throw new Error("Kode pemulihan salah atau sudah pernah digunakan.");
        }

        try {
            // Import the code hash as a temporary AES-GCM key to decrypt the master key
            const recoveryCodeKey = await crypto.subtle.importKey(
                "raw",
                hashBuffer,
                { name: "AES-GCM" },
                false,
                ["decrypt"]
            );

            const ivBuffer = window.TMPT_Crypto.base64ToBuffer(matched.encrypted_key.iv);
            const ciphertextBuffer = window.TMPT_Crypto.base64ToBuffer(matched.encrypted_key.ciphertext);

            // Decrypt the raw master key buffer
            const rawMasterKeyBuffer = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: ivBuffer },
                recoveryCodeKey,
                ciphertextBuffer
            );

            // Import the raw master key back to CryptoKey
            const recoveredKey = await crypto.subtle.importKey(
                "raw",
                rawMasterKeyBuffer,
                { name: "AES-GCM" },
                true,
                ["encrypt", "decrypt"]
            );

            return {
                success: true,
                key: recoveredKey,
                matchedHash: hashHex
            };

        } catch (err) {
            console.error("[RECOVERY] Decryption failed:", err);
            throw new Error("Gagal memulihkan kunci. Data kemungkinan rusak.");
        }
    }
};

window.TMPT_Recovery = RecoveryModule;
