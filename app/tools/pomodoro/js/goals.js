// app/tools/pomodoro/js/goals.js

import { getUnlockedAchievements, saveAchievement, getAllSessions, getSessionsByDate } from './sessions.js';

export const ACHIEVEMENTS = [
  { id: 'first_pomodoro',  title: 'Mulai!',         desc: 'Selesaikan pomodoro pertama',  icon: '🌱' },
  { id: 'streak_3',        title: 'Konsisten',       desc: '3 hari berturut-turut',         icon: '🔥' },
  { id: 'streak_7',        title: 'Seminggu Penuh',  desc: '7 hari berturut-turut',         icon: '🏆' },
  { id: 'streak_30',       title: 'Bulan Fokus',     desc: '30 hari berturut-turut',        icon: '🌟' },
  { id: '100_pomodoros',   title: 'Centenarian',     desc: '100 pomodoro total',            icon: '💯' },
  { id: '50_hours',        title: '50 Jam Fokus',    desc: '50 jam total waktu fokus',      icon: '⏰' },
  { id: 'deep_work',       title: 'Deep Worker',     desc: 'Selesaikan sesi Deep Work 90m', icon: '🧠' },
  { id: 'early_bird',      title: 'Early Bird',      desc: 'Selesaikan pomodoro sebelum jam 9 pagi', icon: '🐦' },
  { id: 'night_owl',       title: 'Night Owl',       desc: 'Selesaikan pomodoro setelah jam 9 malam',icon: '🦉' },
  { id: 'perfect_day',     title: 'Perfect Day',     desc: 'Capai daily goal tanpa interupsi',icon:'⭐'},
];

export async function checkAchievements(settings) {
  const sessions = await getAllSessions();
  const workSessions = sessions.filter(s => s.type === 'work' && s.status === 'completed');
  const unlocked = await getUnlockedAchievements();
  const unlockedIds = new Set(unlocked.map(a => a.id));
  
  const toUnlock = [];

  // Helper function to unlock
  const unlock = (id) => {
    if (!unlockedIds.has(id)) {
      toUnlock.push(id);
    }
  };

  // 1. first_pomodoro
  if (workSessions.length >= 1) {
    unlock('first_pomodoro');
  }

  // 2. 100_pomodoros
  if (workSessions.length >= 100) {
    unlock('100_pomodoros');
  }

  // 3. 50_hours (3000 minutes)
  const totalMinutes = workSessions.reduce((sum, s) => sum + s.actual_min, 0);
  if (totalMinutes >= 3000) {
    unlock('50_hours');
  }

  // 4. deep_work
  const hasDeepWork = workSessions.some(s => s.duration_min >= 90);
  if (hasDeepWork) {
    unlock('deep_work');
  }

  // 5. early_bird (started before 9am)
  const hasEarlyBird = workSessions.some(s => {
    const hours = new Date(s.started_at).getHours();
    return hours < 9;
  });
  if (hasEarlyBird) {
    unlock('early_bird');
  }

  // 6. night_owl (started after 9pm / 21:00)
  const hasNightOwl = workSessions.some(s => {
    const hours = new Date(s.started_at).getHours();
    return hours >= 21;
  });
  if (hasNightOwl) {
    unlock('night_owl');
  }

  // 7. Streak achievements
  const streak = await getCurrentStreak(settings.daily_goal || 8);
  if (streak >= 3) unlock('streak_3');
  if (streak >= 7) unlock('streak_7');
  if (streak >= 30) unlock('streak_30');

  // 8. perfect_day (daily goal achieved with 0 interruptions on all sessions today)
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = await getSessionsByDate(today);
  const todayCompletedWork = todaySessions.filter(s => s.type === 'work' && s.status === 'completed');
  if (todayCompletedWork.length >= (settings.daily_goal || 8)) {
    const hasInterruptions = todayCompletedWork.some(s => s.interruptions > 0);
    if (!hasInterruptions) {
      unlock('perfect_day');
    }
  }

  // Save new achievements and return them for feedback UI
  const newlyUnlocked = [];
  for (const id of toUnlock) {
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (ach) {
      await saveAchievement({ id, unlocked_at: new Date().toISOString() });
      newlyUnlocked.push(ach);
    }
  }

  return newlyUnlocked;
}

export async function getCurrentStreak(dailyGoal = 8) {
  const sessions = await getAllSessions();
  const workSessions = sessions.filter(s => s.type === 'work' && s.status === 'completed');
  
  if (workSessions.length === 0) return 0;

  // Group by date
  const dateCounts = {};
  workSessions.forEach(s => {
    dateCounts[s.date] = (dateCounts[s.date] || 0) + 1;
  });

  let streak = 0;
  let checkDate = new Date();
  
  // If today doesn't have the target yet, start checking from yesterday
  const todayStr = checkDate.toISOString().slice(0, 10);
  if ((dateCounts[todayStr] || 0) < dailyGoal) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dateStr = checkDate.toISOString().slice(0, 10);
    if ((dateCounts[dateStr] || 0) >= dailyGoal) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export async function getBestStreak(dailyGoal = 8) {
  const sessions = await getAllSessions();
  const workSessions = sessions.filter(s => s.type === 'work' && s.status === 'completed');
  
  if (workSessions.length === 0) return 0;

  const dateCounts = {};
  workSessions.forEach(s => {
    dateCounts[s.date] = (dateCounts[s.date] || 0) + 1;
  });

  const sortedDates = Object.keys(dateCounts).sort();
  if (sortedDates.length === 0) return 0;

  let bestStreak = 0;
  let currentStreak = 0;
  let prevDate = null;

  sortedDates.forEach(dateStr => {
    const count = dateCounts[dateStr];
    if (count >= dailyGoal) {
      if (!prevDate) {
        currentStreak = 1;
      } else {
        const prev = new Date(prevDate);
        const curr = new Date(dateStr);
        const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak++;
        } else if (diffDays > 1) {
          currentStreak = 1;
        }
      }
      prevDate = dateStr;
      if (currentStreak > bestStreak) {
        bestStreak = currentStreak;
      }
    }
  });

  return bestStreak;
}
