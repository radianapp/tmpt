// app/tools/pomodoro/js/settings.js

const SETTINGS_KEY = 'tmpt_pomodoro_settings';

export const DEFAULT_SETTINGS = {
  // Durations (minutes)
  work_duration: 25,
  short_break_duration: 5,
  long_break_duration: 30,
  long_break_after: 4, // 4 pomodoros per cycle
  
  // Work Mode Presets
  work_mode: 'classic', // 'classic' | 'deep' | 'sprint' | 'study' | 'custom'

  // Auto progression
  auto_start_break: true,
  auto_start_work: false,
  
  // Sound Settings
  show_notifications: true,
  notification_sound: 'bell',
  notification_volume: 60,

  // Ambient Sounds
  ambient_enabled: false,
  ambient_sound: 'none',
  ambient_volume: 50,

  // Ticking Sound
  tick_enabled: false,
  tick_sound: 'clock',
  tick_volume: 20,

  // Daily/Weekly Goals
  daily_goal: 8,
  weekly_goal: 40,

  // Appearance
  theme: 'auto', // 'light' | 'dark' | 'auto'
  accent_color: '#e74c3c',
  show_progress_ring: true,
  fullscreen_focus: false,

  // Integration Settings
  sync_to_kalender: true,
  show_task_sidebar: true
};

export const WORK_MODES = {
  classic: { work: 25, short: 5, long: 30, after: 4, label: 'Pomodoro Klasik' },
  deep: { work: 90, short: 20, long: 30, after: 2, label: 'Deep Work' },
  sprint: { work: 15, short: 3, long: 15, after: 4, label: 'Sprint' },
  study: { work: 50, short: 10, long: 30, after: 3, label: 'Studi Ujian' },
  custom: { work: 25, short: 5, long: 30, after: 4, label: 'Custom (Kustom)' }
};

export function loadSettings() {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (!stored) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  
  // Dispatch event so other components or global scripts know settings changed
  window.dispatchEvent(new CustomEvent('pomodoroSettingsChanged', { detail: settings }));
}
