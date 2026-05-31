// app/kerja/berkas/js/berkas-db.js
import { openTmptDB, dbGet, dbPut, dbDelete, dbGetAll, dbGetAllByIndex } from '/shared/db.js';

const DB_NAME = 'tmpt_berkas';
const DB_VERSION = 1;

let db = null;

export async function initBerkasDB() {
  if (db) return db;
  db = await openTmptDB(DB_NAME, DB_VERSION, (database) => {
    // Store: files
    if (!database.objectStoreNames.contains('files')) {
      const fileStore = database.createObjectStore('files', { keyPath: 'id' });
      fileStore.createIndex('by_name', 'name', { unique: false });
      fileStore.createIndex('by_type', 'type', { unique: false });
      fileStore.createIndex('by_folder', 'folder_id', { unique: false });
      fileStore.createIndex('by_starred', 'starred', { unique: false });
      fileStore.createIndex('by_trash', 'trash', { unique: false });
      fileStore.createIndex('by_updated', 'updated_at', { unique: false });
    }
    // Store: folders
    if (!database.objectStoreNames.contains('folders')) {
      const folderStore = database.createObjectStore('folders', { keyPath: 'id' });
      folderStore.createIndex('by_parent', 'parent_id', { unique: false });
    }
    // Store: tags
    if (!database.objectStoreNames.contains('tags')) {
      database.createObjectStore('tags', { keyPath: 'id' });
    }
    // Store: settings
    if (!database.objectStoreNames.contains('settings')) {
      database.createObjectStore('settings', { keyPath: 'key' });
    }
  });
  return db;
}

export async function getFiles() {
  const database = await initBerkasDB();
  return dbGetAll(database, 'files');
}

export async function getFile(id) {
  const database = await initBerkasDB();
  return dbGet(database, 'files', id);
}

export async function putFile(file) {
  const database = await initBerkasDB();
  return dbPut(database, 'files', file);
}

export async function deleteFileMetadata(id) {
  const database = await initBerkasDB();
  return dbDelete(database, 'files', id);
}

export async function getFolders() {
  const database = await initBerkasDB();
  return dbGetAll(database, 'folders');
}

export async function getFolder(id) {
  const database = await initBerkasDB();
  return dbGet(database, 'folders', id);
}

export async function putFolder(folder) {
  const database = await initBerkasDB();
  return dbPut(database, 'folders', folder);
}

export async function deleteFolderMetadata(id) {
  const database = await initBerkasDB();
  return dbDelete(database, 'folders', id);
}

export async function getTags() {
  const database = await initBerkasDB();
  return dbGetAll(database, 'tags');
}

export async function putTag(tag) {
  const database = await initBerkasDB();
  return dbPut(database, 'tags', tag);
}

export async function deleteTagMetadata(id) {
  const database = await initBerkasDB();
  return dbDelete(database, 'tags', id);
}

export async function getSetting(key) {
  const database = await initBerkasDB();
  const res = await dbGet(database, 'settings', key);
  return res ? res.value : null;
}

export async function putSetting(key, value) {
  const database = await initBerkasDB();
  return dbPut(database, 'settings', { key, value });
}
