// app/kerja/tulis/js/db.js
import { openTmptDB, dbGet, dbPut, dbDelete, dbGetAll } from '/shared/db.js';

const DB_NAME = 'tmpt_tulis';
const DB_VERSION = 1;

let db = null;

export async function initTulisDB() {
  if (db) return db;
  db = await openTmptDB(DB_NAME, DB_VERSION, (database) => {
    if (!database.objectStoreNames.contains('documents')) {
      const store = database.createObjectStore('documents', { keyPath: 'id' });
      store.createIndex('by_updated', 'updated_at', { unique: false });
    }
    if (!database.objectStoreNames.contains('document_meta')) {
      database.createObjectStore('document_meta', { keyPath: 'id' });
    }
  });
  return db;
}

export async function getDocuments() {
  const database = await initTulisDB();
  return dbGetAll(database, 'documents');
}

export async function getDocument(id) {
  const database = await initTulisDB();
  return dbGet(database, 'documents', id);
}

export async function putDocument(doc) {
  const database = await initTulisDB();
  return dbPut(database, 'documents', doc);
}

export async function deleteDocument(id) {
  const database = await initTulisDB();
  // Delete document
  await dbDelete(database, 'documents', id);
  // Delete meta if exists
  try {
    await dbDelete(database, 'document_meta', id);
  } catch (e) {
    // Ignore error if store doesn't exist or is empty
  }
}

export async function getDocumentMeta(id) {
  const database = await initTulisDB();
  return dbGet(database, 'document_meta', id);
}

export async function putDocumentMeta(id, meta) {
  const database = await initTulisDB();
  return dbPut(database, 'document_meta', { id, ...meta });
}
