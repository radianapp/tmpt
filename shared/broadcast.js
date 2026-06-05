// shared/broadcast.js - TMPT Event Bus
const TMPT_CHANNEL = 'tmpt_office';

export const TMPT_EVENTS = {
  FILE_CREATED:   'FILE_CREATED',    // { id, type, title, app_db }
  FILE_UPDATED:   'FILE_UPDATED',    // { id, type, updated_at }
  FILE_DELETED:   'FILE_DELETED',    // { id, type }
  FORM_SUBMITTED: 'FORM_SUBMITTED',  // { form_id, answers }
  DEADLINE_SET:   'DEADLINE_SET',    // { file_id, deadline, title }
  EVENT_CREATED:  'EVENT_CREATED',   // { event_id, title, start }
  TASK_DONE:      'TASK_DONE',       // { task_id, title }
};

export function broadcastTMPT(type, payload) {
  const channel = new BroadcastChannel(TMPT_CHANNEL);
  channel.postMessage({ type, payload, source_app: getCurrentApp() });
  channel.close();
}

export function listenTMPT(handler) {
  const channel = new BroadcastChannel(TMPT_CHANNEL);
  channel.onmessage = (e) => handler(e.data);
  return channel; // Caller is responsible for closing with channel.close()
}

function getCurrentApp() {
  const path = window.location.pathname;
  if (path.includes('/app/kerja/tulis/')) return 'tulis';
  if (path.includes('/app/kerja/catatan/')) return 'catatan';
  if (path.includes('/app/kerja/hitung/')) return 'hitung';
  if (path.includes('/app/kerja/vault/')) return 'vault';
  if (path.includes('/app/kerja/kalender/')) return 'kalender';
  if (path.includes('/app/kerja/slide/')) return 'slide';
  if (path.includes('/app/dev/markdown/')) return 'markdown';
  if (path.includes('/app/dev/diagram/')) return 'diagram';
  if (path.includes('/app/dev/json/')) return 'json';
  return 'unknown';
}
