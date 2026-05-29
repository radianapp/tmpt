describe('CryptoModule (Browser Native)', () => {
    it('harus terdefinisi di window scope', () => {
        expect(window.TMPT_Crypto).toBeDefined();
    });

    it('harus menghasilkan salt dengan panjang 16 bytes', () => {
        const TMPT_Crypto = window.TMPT_Crypto;
        const salt = TMPT_Crypto.generateSalt();
        expect(salt instanceof Uint8Array).toBe(true);
        expect(salt.length).toBe(16);
    });

    it('harus dapat melakukan derive key dari password', async () => {
        const TMPT_Crypto = window.TMPT_Crypto;
        const salt = TMPT_Crypto.generateSalt();
        const key = await TMPT_Crypto.deriveKey('sandi123', salt);
        expect(key).toBeDefined();
        expect(key.type).toBe('secret');
        expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('harus dapat mengenkripsi dan mendekripsi pesan dengan benar di browser', async () => {
        const TMPT_Crypto = window.TMPT_Crypto;
        const salt = TMPT_Crypto.generateSalt();
        const key = await TMPT_Crypto.deriveKey('password-browser', salt);

        const plaintext = 'Menguji enkripsi AES-GCM di level browser secara langsung.';
        const encrypted = await TMPT_Crypto.encrypt(plaintext, key);

        expect(encrypted.iv).toBeDefined();
        expect(encrypted.ciphertext).toBeDefined();

        const decrypted = await TMPT_Crypto.decrypt(encrypted, key);
        expect(decrypted).toBe(plaintext);
    });

    it('harus gagal mendekripsi jika menggunakan key salah', async () => {
        const TMPT_Crypto = window.TMPT_Crypto;
        const salt = TMPT_Crypto.generateSalt();
        const keyCorrect = await TMPT_Crypto.deriveKey('password-benar', salt);
        const keyWrong = await TMPT_Crypto.deriveKey('password-salah', salt);

        const plaintext = 'Pesan super rahasia.';
        const encrypted = await TMPT_Crypto.encrypt(plaintext, keyCorrect);

        let errorThrown = false;
        try {
            await TMPT_Crypto.decrypt(encrypted, keyWrong);
        } catch (e) {
            errorThrown = true;
        }
        expect(errorThrown).toBe(true);
    });
});
