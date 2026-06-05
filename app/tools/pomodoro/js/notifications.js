// app/tools/pomodoro/js/notifications.js

export async function setupNotifications() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return Notification.permission === 'granted';
}

export function notifySessionComplete(sessionType) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const messages = {
    work: { title: '🍅 Sesi Fokus Selesai!', body: 'Kerja bagus! Saatnya istirahat sejenak.' },
    short_break: { title: '☕ Istirahat Singkat Selesai!', body: 'Mari kembali fokus untuk sesi berikutnya.' },
    long_break: { title: '🛋️ Istirahat Panjang Selesai!', body: 'Siklus istirahat Anda selesai. Siap memulai fokus?' },
  };

  const { title, body } = messages[sessionType] || { title: '⏱️ Timer Selesai!', body: 'Sesi timer Anda telah berakhir.' };

  try {
    const notification = new Notification(title, {
      body,
      icon: '/assets/img/icon-192.png',
      tag: 'pomodoro-session',
      silent: true // Audio is handled separately by AudioManager
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (err) {
    console.warn('Failed to display browser notification:', err);
  }
}
