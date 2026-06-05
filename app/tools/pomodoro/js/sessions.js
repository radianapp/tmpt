// app/tools/pomodoro/js/sessions.js

import { openTmptDB, dbGet, dbPut, dbDelete, dbGetAll, dbGetAllByIndex } from '/shared/db.js';

const DB_NAME = 'tmpt_pomodoro';
const DB_VERSION = 2;

let dbInstance = null;

export async function getPomodoroDB() {
  if (dbInstance) return dbInstance;
  dbInstance = await openTmptDB(DB_NAME, DB_VERSION, (db) => {
    // Create stores if they don't exist
    if (!db.objectStoreNames.contains('sessions')) {
      const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
      sessionStore.createIndex('by_date', 'date', { unique: false });
      sessionStore.createIndex('by_task', 'task_id', { unique: false });
    }
    if (!db.objectStoreNames.contains('stats')) {
      db.createObjectStore('stats', { keyPath: 'date' });
    }
    if (!db.objectStoreNames.contains('achievements')) {
      db.createObjectStore('achievements', { keyPath: 'id' });
    }
  });
  return dbInstance;
}

export async function saveSession(session) {
  const db = await getPomodoroDB();
  await dbPut(db, 'sessions', session);
}

export async function deleteSession(id) {
  const db = await getPomodoroDB();
  await dbDelete(db, 'sessions', id);
}

export async function getSessionsByDate(date) {
  const db = await getPomodoroDB();
  return await dbGetAllByIndex(db, 'sessions', 'by_date', date);
}

export async function getAllSessions() {
  const db = await getPomodoroDB();
  return await dbGetAll(db, 'sessions');
}

export async function saveDailyStats(stats) {
  const db = await getPomodoroDB();
  await dbPut(db, 'stats', stats);
}

export async function getDailyStatsFromDB(date) {
  const db = await getPomodoroDB();
  return await dbGet(db, 'stats', date);
}

export async function saveAchievement(achievement) {
  const db = await getPomodoroDB();
  await dbPut(db, 'achievements', achievement);
}

export async function getUnlockedAchievements() {
  const db = await getPomodoroDB();
  return await dbGetAll(db, 'achievements');
}
