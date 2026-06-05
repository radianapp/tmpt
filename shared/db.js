// shared/db.js - Reusable IndexedDB wrapper for TMPT

export const DB_VERSIONS = {
  'tmpt_berkas': 2,
  'tmpt_tulis': 2,
  'tmpt_slides': 2,
  'tmpt_forms': 2,
  'tmpt_kalender': 2,
  'tmpt_tugas': 2,
  'tmpt_vault': 1,
  'tmpt_code': 2,
  'tmpt_diagram': 2,
  'tmpt_markdown': 2,
  'tmpt_json': 2,
  'tmpt_papan': 2,
  'tmpt_regex': 2,
  'tmpt_pomodoro': 2,
  'tmpt_qr': 2
};

export async function openTmptDB(dbName, version, upgradeCallback) {
  const finalVersion = DB_VERSIONS[dbName] || version || 1;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, finalVersion);
    req.onupgradeneeded = (e) => upgradeCallback(e.target.result);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function dbGet(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbPut(db, storeName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbDelete(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGetAllByIndex(db, storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = index.getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
