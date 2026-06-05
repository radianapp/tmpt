// app/tools/pomodoro/js/integrations/tugas.js

import { openTmptDB, dbGet, dbPut, dbGetAll } from '/shared/db.js';
import { broadcastTMPT, TMPT_EVENTS } from '/shared/broadcast.js';

const TUGAS_DB_NAME = 'tmpt_tugas';
const TUGAS_DB_VERSION = 2;

export async function loadActiveTasks() {
  try {
    const db = await openTmptDB(TUGAS_DB_NAME, TUGAS_DB_VERSION, (db) => {
      if (!db.objectStoreNames.contains('tasks')) {
        db.createObjectStore('tasks', { keyPath: 'id' });
      }
    });

    const allTasks = await dbGetAll(db, 'tasks');
    // Filter active tasks (not done, not archived, no parent_id for top level)
    return allTasks.filter(task => 
      task.status !== 'done' && 
      task.status !== 'archived' && 
      !task.parent_id
    );
  } catch (err) {
    console.warn('Could not read tasks database (tmpt_tugas):', err);
    return [];
  }
}

export async function logFocusToTask(taskId, minutes) {
  if (!taskId) return;
  try {
    const db = await openTmptDB(TUGAS_DB_NAME, TUGAS_DB_VERSION, (db) => {
      if (!db.objectStoreNames.contains('tasks')) {
        db.createObjectStore('tasks', { keyPath: 'id' });
      }
    });

    const task = await dbGet(db, 'tasks', taskId);
    if (!task) return;

    task.metadata = task.metadata || {};
    task.metadata.total_pomodoros = (task.metadata.total_pomodoros || 0) + 1;
    task.metadata.total_focus_min = (task.metadata.total_focus_min || 0) + minutes;
    task.updated_at = new Date().toISOString();

    await dbPut(db, 'tasks', task);

    // Broadcast file updated event to the rest of the workspace
    broadcastTMPT(TMPT_EVENTS.FILE_UPDATED, {
      id: taskId,
      type: 'task',
      updated_at: task.updated_at
    });
  } catch (err) {
    console.warn('Could not log focus time to tasks database (tmpt_tugas):', err);
  }
}

export async function toggleTaskComplete(taskId) {
  if (!taskId) return;
  try {
    const db = await openTmptDB(TUGAS_DB_NAME, TUGAS_DB_VERSION, (db) => {
      if (!db.objectStoreNames.contains('tasks')) {
        db.createObjectStore('tasks', { keyPath: 'id' });
      }
    });

    const task = await dbGet(db, 'tasks', taskId);
    if (!task) return;

    task.status = task.status === 'done' ? 'pending' : 'done';
    task.completed_at = task.status === 'done' ? new Date().toISOString() : null;
    task.updated_at = new Date().toISOString();

    await dbPut(db, 'tasks', task);

    broadcastTMPT(TMPT_EVENTS.FILE_UPDATED, {
      id: taskId,
      type: 'task',
      updated_at: task.updated_at
    });
  } catch (err) {
    console.warn('Could not toggle task status in tmpt_tugas database:', err);
  }
}
