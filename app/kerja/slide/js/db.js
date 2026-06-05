// app/kerja/slide/js/db.js
import { openTmptDB, dbGet, dbPut, dbDelete, dbGetAll } from '/shared/db.js';

const DB_NAME = 'tmpt_slides';
const DB_VERSION = 2;

let db = null;

export async function initSlidesDB() {
  if (db) return db;
  db = await openTmptDB(DB_NAME, DB_VERSION, (database) => {
    if (!database.objectStoreNames.contains('presentations')) {
      const store = database.createObjectStore('presentations', { keyPath: 'id' });
      store.createIndex('by_updated', 'updated_at', { unique: false });
    }
    if (!database.objectStoreNames.contains('slide_settings')) {
      database.createObjectStore('slide_settings', { keyPath: 'key' });
    }
  });
  return db;
}

export async function getPresentations() {
  const database = await initSlidesDB();
  return dbGetAll(database, 'presentations');
}

export async function getPresentation(id) {
  const database = await initSlidesDB();
  return dbGet(database, 'presentations', id);
}

export async function putPresentation(presentation) {
  const database = await initSlidesDB();
  return dbPut(database, 'presentations', presentation);
}

export async function deletePresentation(id) {
  const database = await initSlidesDB();
  return dbDelete(database, 'presentations', id);
}

export async function getSetting(key) {
  const database = await initSlidesDB();
  const res = await dbGet(database, 'slide_settings', key);
  return res ? res.value : null;
}

export async function putSetting(key, value) {
  const database = await initSlidesDB();
  return dbPut(database, 'slide_settings', { key, value });
}
