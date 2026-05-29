import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('CryptoModule (Unit Test)', () => {
  beforeAll(() => {
    const cryptoPath = path.resolve(__dirname, '../../shared/crypto.js');
    const cryptoCode = fs.readFileSync(cryptoPath, 'utf8');
    
    // Create a secure sandbox context representing the browser environment
    const context = {
      window: {},
      crypto: globalThis.crypto,
      TextEncoder: globalThis.TextEncoder,
      TextDecoder: globalThis.TextDecoder,
      atob: globalThis.atob,
      btoa: globalThis.btoa,
      Uint8Array: globalThis.Uint8Array
    };
    context.window.crypto = context.crypto;
    
    vm.createContext(context);
    vm.runInContext(cryptoCode, context);
    
    // Expose back to globalThis for tests
    globalThis.TMPT_Crypto = context.window.TMPT_Crypto;
  });

  it('harus terdefinisi di global scope setelah dievaluasi', () => {
    expect(globalThis.TMPT_Crypto).toBeDefined();
  });

  it('harus dapat menghasilkan salt dengan panjang 16 bytes', () => {
    const TMPT_Crypto = globalThis.TMPT_Crypto;
    const salt = TMPT_Crypto.generateSalt();
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.length).toBe(16);
  });

  it('harus dapat melakukan derive key dari password', async () => {
    const TMPT_Crypto = globalThis.TMPT_Crypto;
    const salt = TMPT_Crypto.generateSalt();
    const key = await TMPT_Crypto.deriveKey('katakunci123', salt);
    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
    expect(key.algorithm.name).toBe('AES-GCM');
  });

  it('harus dapat mengenkripsi dan mendekripsi pesan dengan benar', async () => {
    const TMPT_Crypto = globalThis.TMPT_Crypto;
    const salt = TMPT_Crypto.generateSalt();
    const key = await TMPT_Crypto.deriveKey('password-rahasia', salt);

    const plaintext = 'Data rahasia ini hanya bisa dibaca oleh pemilik Tmpt.';
    const encrypted = await TMPT_Crypto.encrypt(plaintext, key);

    expect(encrypted.iv).toBeDefined();
    expect(encrypted.ciphertext).toBeDefined();

    const decrypted = await TMPT_Crypto.decrypt(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it('harus gagal mendekripsi dengan key yang salah (password berbeda)', async () => {
    const TMPT_Crypto = globalThis.TMPT_Crypto;
    const salt = TMPT_Crypto.generateSalt();
    const keyCorrect = await TMPT_Crypto.deriveKey('password-benar', salt);
    const keyWrong = await TMPT_Crypto.deriveKey('password-salah', salt);

    const plaintext = 'Data sangat rahasia.';
    const encrypted = await TMPT_Crypto.encrypt(plaintext, keyCorrect);

    await expect(TMPT_Crypto.decrypt(encrypted, keyWrong)).rejects.toThrow();
  });
});
