// app/dev/json/js/session-manager.js
import { openTmptDB, dbGet, dbPut, dbDelete, dbGetAll } from '/shared/db.js';
import { broadcastTMPT, TMPT_EVENTS } from '/shared/broadcast.js';

const DB_NAME = 'tmpt_json';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

let db = null;

export async function initSessionDB() {
  if (db) return db;
  db = await openTmptDB(DB_NAME, DB_VERSION, (dbInstance) => {
    if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
      dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  });
  return db;
}

export async function getAllSessions() {
  const database = await initSessionDB();
  const sessions = await dbGetAll(database, STORE_NAME);
  // Sort by updated_at descending
  return sessions.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

export async function getSession(id) {
  const database = await initSessionDB();
  return dbGet(database, STORE_NAME, id);
}

export async function saveSession(session) {
  const database = await initSessionDB();
  session.updated_at = new Date().toISOString();
  
  // Try to parse JSON to set valid status
  try {
    if (session.content && session.content.trim()) {
      session.parsed = JSON.parse(session.content);
      session.is_valid = true;
    } else {
      session.parsed = null;
      session.is_valid = true; // Empty content is considered valid/new
    }
  } catch (e) {
    session.parsed = null;
    session.is_valid = false;
  }
  
  await dbPut(database, STORE_NAME, session);
  
  // Notify Berkas about update
  try {
    broadcastTMPT(TMPT_EVENTS.FILE_UPDATED, {
      id: session.id,
      type: 'json',
      title: session.title,
      app_db: DB_NAME,
      updated_at: session.updated_at
    });
  } catch(e) {
    console.warn("Failed to broadcast file update:", e);
  }
  
  return session;
}

export async function createNewSession(title = 'Untitled.json', content = '') {
  const database = await initSessionDB();
  const id = self.crypto.randomUUID();
  const now = new Date().toISOString();
  
  const newSession = {
    id,
    title,
    content,
    parsed: null,
    is_valid: true,
    view_mode: 'text',
    active_tool: 'none',
    created_at: now,
    updated_at: now,
    bookmarks: [],
    version: 1
  };
  
  if (content.trim()) {
    try {
      newSession.parsed = JSON.parse(content);
      newSession.is_valid = true;
    } catch (e) {
      newSession.is_valid = false;
    }
  }
  
  await dbPut(database, STORE_NAME, newSession);
  
  // Notify Berkas about new file
  try {
    broadcastTMPT(TMPT_EVENTS.FILE_CREATED, {
      id: newSession.id,
      type: 'json',
      title: newSession.title,
      app_db: DB_NAME
    });
  } catch(e) {
    console.warn("Failed to broadcast file creation:", e);
  }
  
  return newSession;
}

export async function deleteSessionRecord(id) {
  const database = await initSessionDB();
  await dbDelete(database, STORE_NAME, id);
  
  // Notify Berkas about deletion
  try {
    broadcastTMPT(TMPT_EVENTS.FILE_DELETED, {
      id: id,
      type: 'json'
    });
  } catch(e) {
    console.warn("Failed to broadcast file deletion:", e);
  }
}
