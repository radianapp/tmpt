import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('BackupAwareness (Unit Test)', () => {
  let context;

  beforeAll(() => {
    const backupAwarenessPath = path.resolve(__dirname, '../../shared/backup-awareness.js');
    const code = fs.readFileSync(backupAwarenessPath, 'utf8');
    
    // Mock localStorage
    const mockLocalStorage = {
      store: {},
      getItem(key) {
        return this.store[key] || null;
      },
      setItem(key, value) {
        this.store[key] = value.toString();
      },
      removeItem(key) {
        delete this.store[key];
      },
      clear() {
        this.store = {};
      }
    };

    context = {
      window: {},
      localStorage: mockLocalStorage,
      document: {
        getElementById: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {}
      },
      console: console,
      Intl: globalThis.Intl,
      Date: globalThis.Date,
      Math: globalThis.Math
    };
    
    vm.createContext(context);
    vm.runInContext(code, context);
  });

  beforeEach(() => {
    context.localStorage.clear();
  });

  it('harus terdefinisi di global scope', () => {
    expect(context.window.BackupAwareness).toBeDefined();
  });

  it('harus berstatus critical jika belum pernah backup', () => {
    const status = context.window.BackupAwareness.getStatus();
    expect(status.level).toBe('critical');
    expect(status.lastBackup).toBeNull();
  });

  it('harus berstatus safe jika baru saja backup', () => {
    const now = new Date().toISOString();
    context.localStorage.setItem('tmpt_last_backup_at', now);
    
    const status = context.window.BackupAwareness.getStatus();
    expect(status.level).toBe('safe');
    expect(status.days).toBe(0);
  });

  it('harus berstatus warn jika backup terakhir antara 4-7 hari', () => {
    const date = new Date();
    date.setDate(date.getDate() - 5);
    context.localStorage.setItem('tmpt_last_backup_at', date.toISOString());
    
    const status = context.window.BackupAwareness.getStatus();
    expect(status.level).toBe('warn');
    expect(status.days).toBe(5);
  });

  it('harus berstatus critical jika backup terakhir > 7 hari', () => {
    const date = new Date();
    date.setDate(date.getDate() - 10);
    context.localStorage.setItem('tmpt_last_backup_at', date.toISOString());
    
    const status = context.window.BackupAwareness.getStatus();
    expect(status.level).toBe('critical');
    expect(status.days).toBe(10);
  });

  it('harus berstatus protected jika Google Drive terhubung dan disinkronkan < 24 jam lalu', () => {
    context.localStorage.setItem('tmpt_gdrive_connected', 'true');
    const now = new Date().toISOString();
    context.localStorage.setItem('tmpt_gdrive_last_sync', now);

    const status = context.window.BackupAwareness.getStatus();
    expect(status.level).toBe('protected');
    expect(status.source).toBe('drive');
  });
});
