// History management via IndexedDB 'tmpt_qr'
import { openTmptDB } from '/shared/db.js';

const DB_NAME = 'tmpt_qr';
const STORE_NAME = 'qrcodes';
const DB_VERSION = 2;

let dbInstance = null;

async function getDB() {
  if (dbInstance) return dbInstance;

  dbInstance = await openTmptDB(DB_NAME, DB_VERSION, (db) => {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  });
  return dbInstance;
}

export async function saveQRToHistory(qrData, previewCanvas) {
  const db = await getDB();
  
  // Create small thumbnail (150x150)
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = 150;
  thumbCanvas.height = 150;
  const tCtx = thumbCanvas.getContext('2d');
  tCtx.drawImage(previewCanvas, 0, 0, 150, 150);
  const thumbnail = thumbCanvas.toDataURL('image/png');

  const record = {
    ...qrData,
    thumbnail,
    updated_at: new Date().toISOString(),
    created_at: qrData.created_at || new Date().toISOString(),
    scan_count: qrData.scan_count || 0,
    is_favorite: qrData.is_favorite || false
  };

  await dbPut(db, STORE_NAME, record);
  await enforceHistoryLimit(db);

  // Broadcast to other apps / file registry
  try {
    const channel = new BroadcastChannel('tmpt_office');
    channel.postMessage({
      type: 'FILE_UPDATED',
      payload: {
        id: record.id,
        type: 'qr',
        title: record.title,
        app_link: `/app/tools/qr/generator.html?id=${record.id}`,
        metadata: {
          qr_type: record.type,
          thumbnail: record.thumbnail
        }
      },
      source_app: 'qr'
    });
    channel.close();
  } catch (e) {
    console.error('Failed to broadcast event:', e);
  }

  return record;
}

export async function getQRFromHistory(id) {
  const db = await getDB();
  return await dbGet(db, STORE_NAME, id);
}

export async function getAllQRHistory() {
  const db = await getDB();
  const all = await dbGetAll(db, STORE_NAME);
  // Sort descending by updated_at
  return all.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function deleteQRFromHistory(id) {
  const db = await getDB();
  await dbDelete(db, STORE_NAME, id);

  try {
    const channel = new BroadcastChannel('tmpt_office');
    channel.postMessage({
      type: 'FILE_DELETED',
      payload: { id, type: 'qr' },
      source_app: 'qr'
    });
    channel.close();
  } catch (e) {
    console.error('Failed to broadcast delete:', e);
  }
}

export async function toggleFavoriteQR(id) {
  const qr = await getQRFromHistory(id);
  if (qr) {
    qr.is_favorite = !qr.is_favorite;
    qr.updated_at = new Date().toISOString();
    const db = await getDB();
    await dbPut(db, STORE_NAME, qr);
    return qr;
  }
  return null;
}

async function enforceHistoryLimit(db) {
  const all = await dbGetAll(db, STORE_NAME);
  if (all.length > 200) {
    const nonFavorites = all.filter(q => !q.is_favorite);
    // Sort oldest first
    nonFavorites.sort((a, b) => a.created_at.localeCompare(b.created_at));
    
    const countToRemove = all.length - 200;
    const oldestToRemove = nonFavorites.slice(0, countToRemove);

    for (const q of oldestToRemove) {
      await dbDelete(db, STORE_NAME, q.id);
    }
  }
}

// Helper methods reproducing core functionalities of db.js
async function dbGet(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function dbPut(db, storeName, value) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(value);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

async function dbDelete(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

async function dbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}
