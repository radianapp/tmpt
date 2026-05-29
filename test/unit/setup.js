import { vi } from 'vitest';
import { webcrypto } from 'node:crypto';

// Setup global window object if missing
if (typeof window === 'undefined') {
  globalThis.window = globalThis;
} else {
  globalThis.window = window;
}

// Setup Web Crypto API globally
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

if (globalThis.window && !globalThis.window.crypto) {
  Object.defineProperty(globalThis.window, 'crypto', {
    value: globalThis.crypto,
    writable: true
  });
}
