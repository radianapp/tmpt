// app/dev/regex/js/session-manager.js
import { openTmptDB, dbGet, dbPut, dbDelete, dbGetAll } from '/shared/db.js';

let db = null;

export async function initSessionDB() {
  if (db) return db;
  db = await openTmptDB('tmpt_regex', 1, (database) => {
    if (!database.objectStoreNames.contains('sessions')) {
      database.createObjectStore('sessions', { keyPath: 'id' });
    }
  });
  return db;
}

export async function saveSession(session) {
  const database = await initSessionDB();
  session.updated_at = new Date().toISOString();
  await dbPut(database, 'sessions', session);
  return session;
}

export async function getSession(id) {
  const database = await initSessionDB();
  return await dbGet(database, 'sessions', id);
}

export async function deleteSession(id) {
  const database = await initSessionDB();
  return await dbDelete(database, 'sessions', id);
}

export async function getAllSessions() {
  const database = await initSessionDB();
  const sessions = await dbGetAll(database, 'sessions');
  return sessions.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}
