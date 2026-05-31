// app/kerja/berkas/js/backup.js
// Handles ZIP-based backup (.tmpt) and restore using JSZip
import { getFiles, getFolders, getTags, initBerkasDB } from './berkas-db.js';
import { getOpfsRoot } from '/shared/opfs.js';

// Lazy load JSZip from shared vendor folder
async function loadJSZip() {
  if (window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/shared/vendor/jszip.min.js';
    script.onload = () => resolve(window.JSZip);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Helper to open other IndexedDB databases and get all data
async function getIndexedDbData(dbName, storeNames) {
  return new Promise((resolve) => {
    const req = indexedDB.open(dbName);
    req.onsuccess = (e) => {
      const db = e.target.result;
      const data = {};
      const promises = storeNames.map(storeName => {
        return new Promise((res) => {
          if (!db.objectStoreNames.contains(storeName)) {
            res();
            return;
          }
          try {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const getReq = store.getAll();
            getReq.onsuccess = () => {
              data[storeName] = getReq.result;
              res();
            };
            getReq.onerror = () => res();
          } catch (err) {
            res();
          }
        });
      });
      Promise.all(promises).then(() => {
        db.close();
        resolve(data);
      });
    };
    req.onerror = () => {
      resolve(null);
    };
  });
}

// Helper to write to another IndexedDB database
async function restoreIndexedDbData(dbName, storeName, items) {
  if (!items || items.length === 0) return;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName);
    req.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        resolve();
        return;
      }
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      items.forEach(item => store.put(item));
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = (err) => {
        db.close();
        reject(tx.error || err);
      };
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function generateBackupBundle(progressCallback) {
  const JSZip = await loadJSZip();
  const zip = new JSZip();

  if (progressCallback) progressCallback(5, "Mempersiapkan manifest...");

  // 1. Manifest
  zip.file('manifest.json', JSON.stringify({
    version: '1.0',
    created_at: new Date().toISOString(),
    tmpt_version: '2.0.0',
    contents: ['berkas', 'catat', 'hitung', 'opfs']
  }, null, 2));

  if (progressCallback) progressCallback(15, "Membaca registry Berkas...");

  // 2. Berkas registry
  const files = await getFiles();
  const folders = await getFolders();
  const tags = await getTags();
  zip.file('berkas/files.json', JSON.stringify(files, null, 2));
  zip.file('berkas/folders.json', JSON.stringify(folders, null, 2));
  zip.file('berkas/tags.json', JSON.stringify(tags, null, 2));

  if (progressCallback) progressCallback(30, "Membaca data Catat & Hitung...");

  // 3. LocalStorage data for Catat & Hitung
  const lStorageData = {};
  const catatKeys = ['catat_security_mode', 'catat_notes', 'catat_lists', 'catat_notes_enc', 'catat_lists_enc'];
  catatKeys.forEach(k => {
    const val = localStorage.getItem(k);
    if (val !== null) lStorageData[k] = val;
  });

  const hitungKeys = ['hitung_security_mode', 'hitung_file_list', 'hitung_file_list_enc'];
  hitungKeys.forEach(k => {
    const val = localStorage.getItem(k);
    if (val !== null) lStorageData[k] = val;
  });

  // Also catch hitung_file_* and hitung_file_enc_* from localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('hitung_file_') || key.startsWith('hitung_file_enc_')) {
      lStorageData[key] = localStorage.getItem(key);
    }
  }
  zip.file('localstorage.json', JSON.stringify(lStorageData, null, 2));

  if (progressCallback) progressCallback(60, "Membaca file biner OPFS...");

  // 4. Binary files from OPFS
  try {
    const root = await getOpfsRoot();
    const folder = zip.folder('berkas_files');
    for await (const entry of root.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        folder.file(entry.name, file);
      }
    }
  } catch (err) {
    console.error("Gagal membaca OPFS untuk backup:", err);
  }

  if (progressCallback) progressCallback(85, "Mengompresi berkas backup...");

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }, (metadata) => {
    if (progressCallback) progressCallback(85 + Math.floor(metadata.percent * 0.14), `Mengompresi: ${Math.round(metadata.percent)}%`);
  });

  // Check if we should encrypt the backup using the active vault key
  if (window.TMPT_Auth && window.TMPT_Auth.isUnlocked()) {
    if (progressCallback) progressCallback(95, "Mengamankan berkas cadangan (Enkripsi)...");
    try {
      const key = window.TMPT_Auth.getKey();
      const arrayBuffer = await blob.arrayBuffer();
      const encrypted = await window.TMPT_Crypto.encrypt(arrayBuffer, key);
      
      const encryptedPayload = JSON.stringify({
        format: "tmpt-encrypted-v1",
        exported_at: new Date().toISOString(),
        encrypted_data: encrypted
      });
      
      if (progressCallback) progressCallback(100, "Selesai.");
      return new Blob([encryptedPayload], { type: "application/json" });
    } catch (e) {
      console.error("Gagal mengenkripsi file backup:", e);
    }
  }

  if (progressCallback) progressCallback(100, "Selesai.");
  return blob;
}

export async function restoreBackupBundle(file, mode = 'merge', progressCallback) {
  if (progressCallback) progressCallback(5, "Membaca berkas backup...");

  let zipData = file;

  // Check if the backup is encrypted
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (payload.format === "tmpt-encrypted-v1") {
      if (progressCallback) progressCallback(10, "Mendekripsi berkas cadangan...");
      if (!window.TMPT_Auth || !window.TMPT_Auth.isUnlocked()) {
        throw new Error("Brankas Anda dalam kondisi terkunci. Harap buka kunci Brankas Anda terlebih dahulu untuk mendekripsi file backup ini.");
      }
      const key = window.TMPT_Auth.getKey();
      const decrypted = await window.TMPT_Crypto.decrypt(payload.encrypted_data, key);
      zipData = decrypted; // ArrayBuffer of decrypted zip
    }
  } catch (e) {
    if (e instanceof SyntaxError) {
      // It is not a JSON, so it's a raw unencrypted zip file
      zipData = file;
    } else {
      throw e;
    }
  }

  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(zipData);

  if (progressCallback) progressCallback(15, "Membaca berkas cadangan...");

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new Error('File backup tidak valid (manifest.json tidak ditemukan).');

  const manifest = JSON.parse(await manifestFile.async('string'));
  if (manifest.version !== '1.0') throw new Error('Versi backup tidak didukung.');

  if (mode === 'overwrite') {
    if (progressCallback) progressCallback(20, "Membersihkan data lama...");
    
    // Clear registry IndexedDB
    const berkasDB = await initBerkasDB();
    const txF = berkasDB.transaction('files', 'readwrite'); txF.objectStore('files').clear();
    const txFold = berkasDB.transaction('folders', 'readwrite'); txFold.objectStore('folders').clear();
    const txT = berkasDB.transaction('tags', 'readwrite'); txT.objectStore('tags').clear();
    
    // Clear LocalStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('catat_') || key.startsWith('hitung_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Clear OPFS files
    try {
      const root = await getOpfsRoot();
      for await (const entry of root.values()) {
        if (entry.kind === 'file') {
          await root.removeEntry(entry.name);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (progressCallback) progressCallback(40, "Memulihkan registry Berkas...");

  // Restore Berkas files metadata
  const filesJson = zip.file('berkas/files.json');
  if (filesJson) {
    const files = JSON.parse(await filesJson.async('string'));
    const berkasDB = await initBerkasDB();
    const tx = berkasDB.transaction('files', 'readwrite');
    const store = tx.objectStore('files');
    files.forEach(f => store.put(f));
  }

  const foldersJson = zip.file('berkas/folders.json');
  if (foldersJson) {
    const folders = JSON.parse(await foldersJson.async('string'));
    const berkasDB = await initBerkasDB();
    const tx = berkasDB.transaction('folders', 'readwrite');
    const store = tx.objectStore('folders');
    folders.forEach(f => store.put(f));
  }

  const tagsJson = zip.file('berkas/tags.json');
  if (tagsJson) {
    const tags = JSON.parse(await tagsJson.async('string'));
    const berkasDB = await initBerkasDB();
    const tx = berkasDB.transaction('tags', 'readwrite');
    const store = tx.objectStore('tags');
    tags.forEach(t => store.put(t));
  }

  if (progressCallback) progressCallback(65, "Memulihkan data LocalStorage...");

  // Restore LocalStorage
  const lsJsonFile = zip.file('localstorage.json');
  if (lsJsonFile) {
    const lsData = JSON.parse(await lsJsonFile.async('string'));
    Object.entries(lsData).forEach(([k, v]) => {
      localStorage.setItem(k, v);
    });
  }

  if (progressCallback) progressCallback(80, "Memulihkan file biner OPFS...");

  // Restore OPFS
  const opfsFolder = zip.folder('berkas_files');
  if (opfsFolder) {
    const root = await getOpfsRoot();
    const promises = [];
    opfsFolder.forEach((relativePath, fileEntry) => {
      if (!fileEntry.dir) {
        promises.push(
          fileEntry.async('blob').then(async (blob) => {
            const handle = await root.getFileHandle(fileEntry.name, { create: true });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
          })
        );
      }
    });
    await Promise.all(promises);
  }

  if (progressCallback) progressCallback(100, "Pemulihan selesai.");
  return true;
}
