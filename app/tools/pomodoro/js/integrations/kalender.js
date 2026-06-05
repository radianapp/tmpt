// app/tools/pomodoro/js/integrations/kalender.js

import { openTmptDB, dbPut } from '/shared/db.js';
import { broadcastTMPT, TMPT_EVENTS } from '/shared/broadcast.js';

const KALENDER_DB_NAME = 'tmpt_kalender';
const KALENDER_DB_VERSION = 2;

export async function logSessionToKalender(session) {
  try {
    const db = await openTmptDB(KALENDER_DB_NAME, KALENDER_DB_VERSION, (db) => {
      if (!db.objectStoreNames.contains('events')) {
        db.createObjectStore('events', { keyPath: 'id' });
      }
    });

    const startTime = new Date(session.started_at);
    const endTime = new Date(session.ended_at || new Date());

    const event = {
      id: crypto.randomUUID(),
      calendar_id: 'focus', // Focus Time special calendar
      title: session.task_title ? `🍅 ${session.task_title}` : '🍅 Sesi Fokus',
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      all_day: false,
      color: '#e74c3c', // Red tomato color
      description: `Pomodoro #${session.pomodoro_number} · ${session.actual_min} menit fokus`,
      read_only: true,
      source: 'pomodoro'
    };

    await dbPut(db, 'events', event);
    
    // Broadcast calendar event creation
    broadcastTMPT(TMPT_EVENTS.EVENT_CREATED, { event_id: event.id });
  } catch (err) {
    console.warn('Could not log event to kalender database (tmpt_kalender):', err);
  }
}
