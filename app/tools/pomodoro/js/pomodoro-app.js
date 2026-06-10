// app/tools/pomodoro/js/pomodoro-app.js

import { loadSettings, saveSettings, WORK_MODES } from './settings.js';
import { AudioManager } from './audio.js';
import { AmbientPlayer } from './ambient.js';
import { saveSession, getSessionsByDate, getUnlockedAchievements } from './sessions.js';
import { checkAchievements, getCurrentStreak, getBestStreak, ACHIEVEMENTS } from './goals.js';
import { setupNotifications, notifySessionComplete } from './notifications.js';
import { loadActiveTasks, logFocusToTask, toggleTaskComplete } from './integrations/tugas.js';
import { logSessionToKalender } from './integrations/kalender.js';
import { setupKeyboardShortcuts } from './shortcuts.js';
import { calculateStatsSummary, getWeeklyStatsData, renderWeeklyChart } from './stats.js';
import { generateMarkdownReport, generateCSVExport, generateJSONExport, triggerDownload } from './report.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Update header app name when shared header is loaded
  const checkHeader = setInterval(() => {
    const appHeaderName = document.getElementById('header-app-name');
    if (appHeaderName) {
      appHeaderName.textContent = 'Pomodoro';
      clearInterval(checkHeader);
    }
  }, 100);
  setTimeout(() => clearInterval(checkHeader), 5000);

  // Load state and settings
  let settings = loadSettings();
  let currentMode = 'work'; // 'work' | 'short' | 'long'
  let timerState = 'idle'; // 'idle' | 'running' | 'paused'
  let secondsRemaining = settings.work_duration * 60;
  let totalSeconds = settings.work_duration * 60;
  
  let currentSession = null;
  let activeTaskId = null;
  let activeTaskTitle = '';
  
  // Track stats for current session
  let pomodorosCompletedToday = 0;
  let currentSessionNumber = 1;
  let currentCycleNumber = 1;
  let currentInterruptionsCount = 0;
  let sessionStartTime = null;

  // Initialize audio managers
  const audioManager = new AudioManager();
  const ambientPlayer = new AmbientPlayer();

  // Connect Web Worker timer
  const timerWorker = new Worker('./js/timer-worker.js');

  // Load UI Elements
  const timerDisplay = document.getElementById('timer-display');
  const timerModeLabel = document.getElementById('timer-mode-label');
  const btnToggle = document.getElementById('btn-timer-toggle');
  const btnSkip = document.getElementById('btn-timer-skip');
  const btnReset = document.getElementById('btn-timer-reset');
  const progressRing = document.getElementById('progress-ring');
  
  const labelSessionNumber = document.getElementById('session-number');
  const labelCycleNumber = document.getElementById('cycle-number');
  const labelTodayCount = document.getElementById('today-pomodoros-count');
  const labelGoalCount = document.getElementById('today-goal-count');

  // Fullscreen Elements
  const fullscreenOverlay = document.getElementById('fullscreen-overlay');
  const fullscreenTimerDisplay = document.getElementById('fullscreen-timer-display');
  const fullscreenTaskLabel = document.getElementById('fullscreen-task-label');
  const fullscreenBtnToggle = document.getElementById('fullscreen-btn-toggle');
  const fullscreenBtnSkip = document.getElementById('fullscreen-btn-skip');
  const fullscreenBtnExit = document.getElementById('fullscreen-btn-exit');

  // Integrations/Tasks Elements
  const taskSidebar = document.getElementById('task-sidebar');
  const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
  const sidebarTasksContainer = document.getElementById('sidebar-tasks-container');
  const quickTaskInput = document.getElementById('quick-task-input');
  const addQuickTaskBtn = document.getElementById('add-quick-task-btn');
  const activeTaskBanner = document.getElementById('active-task-banner');
  const activeTaskTitleEl = document.getElementById('active-task-title');
  const activeTaskStatsEl = document.getElementById('active-task-pomodoro-stats');
  const btnCompleteActiveTask = document.getElementById('btn-complete-active-task');

  // Sound Elements
  const ambientSoundSelect = document.getElementById('ambient-sound-select');
  const ambientVolumeSlider = document.getElementById('ambient-volume-slider');
  const tickSoundSelect = document.getElementById('tick-sound-select');
  const tickVolumeSlider = document.getElementById('tick-volume-slider');

  // Stats Display Elements
  const statsFocusCount = document.getElementById('stats-focus-count');
  const statsFocusMinutes = document.getElementById('stats-focus-minutes');
  const statsFocusScore = document.getElementById('stats-focus-score');
  const statsStreak = document.getElementById('stats-focus-streak') || document.getElementById('stats-streak');
  const goalDailyCompleted = document.getElementById('goal-daily-completed');
  const goalDailyTarget = document.getElementById('goal-daily-target');
  const goalDailyProgress = document.getElementById('goal-daily-progress');
  const goalWeeklyCompleted = document.getElementById('goal-weekly-completed');
  const goalWeeklyTarget = document.getElementById('goal-weekly-target');
  const goalWeeklyProgress = document.getElementById('goal-weekly-progress');

  // Navigation tab sections
  const sections = {
    stats: document.getElementById('section-stats'),
    achievements: document.getElementById('section-achievements'),
    settings: document.getElementById('section-settings')
  };

  // ----------------------------------------------------
  // Init Functions
  // ----------------------------------------------------
  async function init() {
    applySettingsToUI();
    await updateTodayCounts();
    await refreshStats();
    await refreshAchievements();
    await refreshTasksList();
    setupEventListeners();
    initTheme();
    resetTimer();
  }

  function initTheme() {
    const savedTheme = localStorage.getItem('tmpt_theme') || 'auto';
    applyTheme(savedTheme);
  }

  function applyTheme(theme) {
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  // Handle ticking sound every second if active
  let tickerInterval = null;
  function startTicker() {
    if (tickerInterval) clearInterval(tickerInterval);
    tickerInterval = setInterval(() => {
      if (timerState === 'running' && settings.tick_enabled && settings.tick_sound !== 'none') {
        audioManager.playTick(settings.tick_sound, settings.tick_volume);
      }
    }, 1000);
  }

  function stopTicker() {
    if (tickerInterval) {
      clearInterval(tickerInterval);
      tickerInterval = null;
    }
  }

  // Update visual progress ring SVG
  function updateTimerRing() {
    const percent = secondsRemaining / totalSeconds;
    const radius = 90;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * percent;
    progressRing.style.strokeDashoffset = circumference - offset;
  }

  // Update digital displays
  function updateTimerDisplay() {
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    
    // Set text
    timerDisplay.textContent = timeStr;
    fullscreenTimerDisplay.textContent = timeStr;
    
    // Update browser tab title
    const modeEmoji = currentMode === 'work' ? '🍅' : '☕';
    const modeName = currentMode === 'work' ? 'Fokus' : 'Rehat';
    document.title = `(${timeStr}) ${modeEmoji} ${modeName} — TMPT Pomodoro`;
    
    updateTimerRing();
  }

  // Load duration config based on current mode
  function getModeDuration() {
    if (currentMode === 'work') return settings.work_duration;
    if (currentMode === 'short') return settings.short_break_duration;
    if (currentMode === 'long') return settings.long_break_duration;
    return 25;
  }

  // Reset/Set timer back to mode start
  function resetTimer() {
    timerState = 'idle';
    stopTicker();
    const duration = getModeDuration();
    secondsRemaining = duration * 60;
    totalSeconds = duration * 60;
    
    btnToggle.textContent = 'MULAI';
    btnToggle.className = 'btn-start';
    fullscreenBtnToggle.textContent = 'MULAI';
    fullscreenBtnToggle.className = 'btn-start';
    
    updateTimerDisplay();
  }

  // Mode Switch Tab
  function setMode(mode) {
    currentMode = mode;
    
    // Update theme styling / active ring color based on mode
    let accentColor = 'var(--pomodoro-red)';
    if (mode === 'short') accentColor = 'var(--break-green)';
    if (mode === 'long') accentColor = 'var(--long-break-blue)';
    document.documentElement.style.setProperty('--accent', accentColor);
    document.documentElement.style.setProperty('--ring-active', accentColor);

    // Update active class on tab buttons
    document.querySelectorAll('.session-tab').forEach(btn => {
      if (btn.dataset.mode === mode) {
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      }
    });

    const modeLabels = {
      work: 'Fokus',
      short: 'Rehat Pendek',
      long: 'Rehat Panjang'
    };
    timerModeLabel.textContent = modeLabels[mode];

    resetTimer();
  }

  // ----------------------------------------------------
  // Timer State Controls
  // ----------------------------------------------------
  function toggleTimer() {
    // Lazy AudioContext initialization
    audioManager.getContext();
    
    if (timerState === 'idle') {
      // Start session
      timerState = 'running';
      sessionStartTime = new Date().toISOString();
      currentInterruptionsCount = 0;
      
      btnToggle.textContent = 'JEDA';
      btnToggle.className = 'outline secondary';
      fullscreenBtnToggle.textContent = 'JEDA';
      fullscreenBtnToggle.className = 'outline secondary';
      
      timerWorker.postMessage({ type: 'START', seconds: secondsRemaining });
      startTicker();
      
      // Start Ambient Play if enabled
      if (settings.ambient_enabled && settings.ambient_sound !== 'none') {
        ambientPlayer.play(settings.ambient_sound, settings.ambient_volume);
      }
      
      // Check for fullscreen preference
      if (settings.fullscreen_focus && currentMode === 'work') {
        enterFullscreenFocus();
      }
    } else if (timerState === 'running') {
      // Pause session
      timerState = 'paused';
      currentInterruptionsCount++;
      
      btnToggle.textContent = 'LANJUT';
      btnToggle.className = 'btn-start';
      fullscreenBtnToggle.textContent = 'LANJUT';
      fullscreenBtnToggle.className = 'btn-start';
      
      timerWorker.postMessage({ type: 'PAUSE' });
      stopTicker();
      ambientPlayer.stop();
    } else if (timerState === 'paused') {
      // Resume session
      timerState = 'running';
      
      btnToggle.textContent = 'JEDA';
      btnToggle.className = 'outline secondary';
      fullscreenBtnToggle.textContent = 'JEDA';
      fullscreenBtnToggle.className = 'outline secondary';
      
      timerWorker.postMessage({ type: 'RESUME' });
      startTicker();
      
      if (settings.ambient_enabled && settings.ambient_sound !== 'none') {
        ambientPlayer.play(settings.ambient_sound, settings.ambient_volume);
      }
    }
  }

  // Skip the current session
  async function skipSession() {
    if (timerState === 'running' || timerState === 'paused') {
      timerWorker.postMessage({ type: 'PAUSE' });
      stopTicker();
      ambientPlayer.stop();
      
      // Log skipped session
      if (currentMode === 'work') {
        const actualMins = Math.floor((totalSeconds - secondsRemaining) / 60);
        await saveSessionEntry('skipped', actualMins);
      }
    }
    
    // Autoprogression or manual progression logic
    transitionToNextMode();
  }

  // Handle timer worker message
  timerWorker.onmessage = async ({ data }) => {
    if (data.type === 'TICK') {
      secondsRemaining = data.remaining;
      updateTimerDisplay();
    } else if (data.type === 'COMPLETE') {
      await onTimerComplete();
    } else if (data.type === 'RESET') {
      secondsRemaining = data.remaining;
      updateTimerDisplay();
    }
  };

  async function onTimerComplete() {
    stopTicker();
    ambientPlayer.stop();
    timerState = 'idle';

    const actualMins = Math.floor(totalSeconds / 60);
    
    // Play Alarm synthesis
    if (settings.notification_sound !== 'none') {
      audioManager.playNotification(settings.notification_sound, settings.notification_volume);
    }

    // Trigger desktop notification
    if (settings.show_notifications) {
      notifySessionComplete(currentMode);
    }

    if (currentMode === 'work') {
      const session = await saveSessionEntry('completed', actualMins);
      
      // Update task progress in TMPT Tugas
      if (activeTaskId) {
        await logFocusToTask(activeTaskId, actualMins);
        await refreshTasksList();
        updateActiveTaskBanner();
      }

      // Sync focus session to TMPT Kalender
      if (settings.sync_to_kalender) {
        await logSessionToKalender(session);
      }

      // Check accomplishments and show feedback toast
      const newUnlocked = await checkAchievements(settings);
      if (newUnlocked && newUnlocked.length > 0) {
        newUnlocked.forEach(ach => {
          showToast(`🏆 Penghargaan dibuka: ${ach.title} — ${ach.desc}`, 'success');
        });
      }

      await updateTodayCounts();
      await refreshStats();
      await refreshAchievements();
      
      // Advance work numbers
      currentSessionNumber++;
      if (currentSessionNumber > settings.long_break_after) {
        currentSessionNumber = 1;
        currentCycleNumber++;
      }
    }

    // Auto progression check
    if (currentMode === 'work') {
      setMode(currentSessionNumber === 1 ? 'long' : 'short');
      if (settings.auto_start_break) {
        setTimeout(toggleTimer, 1000);
      }
    } else { // It was a break
      setMode('work');
      if (settings.auto_start_work) {
        setTimeout(toggleTimer, 1000);
      }
    }
  }

  function transitionToNextMode() {
    timerState = 'idle';
    if (currentMode === 'work') {
      // Switch to break
      const isLongBreak = (pomodorosCompletedToday + 1) % settings.long_break_after === 0;
      setMode(isLongBreak ? 'long' : 'short');
    } else {
      setMode('work');
    }
  }

  async function saveSessionEntry(status, actualMins) {
    const today = new Date().toISOString().slice(0, 10);
    const session = {
      id: crypto.randomUUID(),
      type: currentMode,
      status: status,
      duration_min: Math.round(totalSeconds / 60),
      actual_min: actualMins,
      task_id: activeTaskId,
      task_title: activeTaskTitle,
      pomodoro_number: currentSessionNumber,
      cycle_number: currentCycleNumber,
      interruptions: currentInterruptionsCount,
      started_at: sessionStartTime,
      ended_at: new Date().toISOString(),
      date: today
    };

    await saveSession(session);
    return session;
  }

  // ----------------------------------------------------
  // Statistics and UI Updates
  // ----------------------------------------------------
  async function updateTodayCounts() {
    const today = new Date().toISOString().slice(0, 10);
    const sessions = await getSessionsByDate(today);
    pomodorosCompletedToday = sessions.filter(s => s.type === 'work' && s.status === 'completed').length;
    
    labelSessionNumber.textContent = currentSessionNumber;
    labelCycleNumber.textContent = currentCycleNumber;
    labelTodayCount.textContent = pomodorosCompletedToday;
    labelGoalCount.textContent = settings.daily_goal;
  }

  async function refreshStats() {
    const summary = await calculateStatsSummary();
    const streak = await getCurrentStreak(settings.daily_goal);
    
    statsFocusCount.textContent = `${summary.total_completed} 🍅`;
    statsFocusMinutes.textContent = `${summary.total_focus_min}m`;
    statsFocusScore.textContent = summary.avg_focus_score;
    statsStreak.textContent = `${streak} Hari`;

    // Update goals progress
    goalDailyCompleted.textContent = pomodorosCompletedToday;
    goalDailyTarget.textContent = settings.daily_goal;
    const dailyPct = Math.min(100, Math.round((pomodorosCompletedToday / settings.daily_goal) * 100));
    goalDailyProgress.value = dailyPct;

    // Weekly stats
    const weeklyData = await getWeeklyStatsData();
    const totalWeeklyCompleted = weeklyData.reduce((sum, d) => sum + d.value, 0);
    goalWeeklyCompleted.textContent = totalWeeklyCompleted;
    goalWeeklyTarget.textContent = settings.weekly_goal;
    const weeklyPct = Math.min(100, Math.round((totalWeeklyCompleted / settings.weekly_goal) * 100));
    goalWeeklyProgress.value = weeklyPct;

    // Render SVG Chart
    const weeklyChartContainer = document.getElementById('weekly-chart-container');
    weeklyChartContainer.innerHTML = renderWeeklyChart(weeklyData);
  }

  async function refreshAchievements() {
    const unlocked = await getUnlockedAchievements();
    const unlockedIds = new Set(unlocked.map(a => a.id));
    const container = document.getElementById('achievements-list-container');
    
    container.innerHTML = ACHIEVEMENTS.map(ach => {
      const isUnlocked = unlockedIds.has(ach.id);
      const cardClass = isUnlocked ? 'achievement-card unlocked' : 'achievement-card';
      return `
        <div class="${cardClass}">
          <div class="achievement-icon">${ach.icon}</div>
          <div class="achievement-details">
            <h4>${ach.title}</h4>
            <p>${ach.desc}</p>
          </div>
        </div>
      `;
    }).join('');
  }

  // ----------------------------------------------------
  // Integrations / Tasks
  // ----------------------------------------------------
  async function refreshTasksList() {
    const container = sidebarTasksContainer;
    const tasks = await loadActiveTasks();

    if (tasks.length === 0) {
      container.innerHTML = '<p class="secondary" style="text-align: center; font-size: 0.8rem; padding: 1rem 0;">Belum ada tugas aktif.</p>';
      return;
    }

    container.innerHTML = tasks.map(task => {
      const count = task.metadata?.total_pomodoros || 0;
      const isActive = task.id === activeTaskId;
      const activeClass = isActive ? 'active' : '';
      
      return `
        <div class="sidebar-task-item ${activeClass}" data-id="${task.id}" data-title="${task.title}">
          <input type="checkbox" class="checkbox" data-id="${task.id}" title="Tandai selesai">
          <div class="title" title="${task.title}">${task.title}</div>
          <div class="meta">${count} 🍅</div>
        </div>
      `;
    }).join('');

    // Bind item click to select active task
    document.querySelectorAll('.sidebar-task-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Prevent click trigger if click on checkbox
        if (e.target.classList.contains('checkbox')) return;
        
        const id = item.dataset.id;
        const title = item.dataset.title;
        selectActiveTask(id, title);
      });
    });

    // Bind checkbox change to complete task
    document.querySelectorAll('.sidebar-task-item .checkbox').forEach(box => {
      box.addEventListener('change', async (e) => {
        const id = box.dataset.id;
        box.disabled = true;
        await toggleTaskComplete(id);
        
        // If the completed task was active, deselect it
        if (id === activeTaskId) {
          deselectActiveTask();
        }

        await refreshTasksList();
        showToast('Status tugas diperbarui!', 'success');
      });
    });
  }

  function selectActiveTask(id, title) {
    activeTaskId = id;
    activeTaskTitle = title;
    
    // Highlight active element in sidebar
    document.querySelectorAll('.sidebar-task-item').forEach(item => {
      if (item.dataset.id === id) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    updateActiveTaskBanner();
  }

  function deselectActiveTask() {
    activeTaskId = null;
    activeTaskTitle = '';
    activeTaskBanner.style.display = 'none';
    
    document.querySelectorAll('.sidebar-task-item').forEach(item => {
      item.classList.remove('active');
    });
  }

  async function updateActiveTaskBanner() {
    if (!activeTaskId) {
      activeTaskBanner.style.display = 'none';
      return;
    }

    const tasks = await loadActiveTasks();
    const activeTask = tasks.find(t => t.id === activeTaskId);
    if (!activeTask) {
      deselectActiveTask();
      return;
    }

    activeTaskTitleEl.textContent = activeTask.title;
    const poms = activeTask.metadata?.total_pomodoros || 0;
    activeTaskStatsEl.textContent = `(${poms} 🍅 fokus)`;
    activeTaskBanner.style.display = 'flex';
  }

  // Add a quick task
  async function addQuickTask() {
    const val = quickTaskInput.value.trim();
    if (!val) return;

    try {
      const tugasDB = await openTmptDB('tmpt_tugas', 1, (db) => {
        if (!db.objectStoreNames.contains('tasks')) {
          db.createObjectStore('tasks', { keyPath: 'id' });
        }
      });

      const newTask = {
        id: crypto.randomUUID(),
        title: val,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          total_pomodoros: 0,
          total_focus_min: 0
        }
      };

      const tx = tugasDB.transaction('tasks', 'readwrite');
      await tx.objectStore('tasks').put(newTask);
      
      quickTaskInput.value = '';
      await refreshTasksList();
      selectActiveTask(newTask.id, newTask.title);
      showToast('Tugas cepat berhasil ditambahkan!', 'success');
    } catch (e) {
      console.warn('Failed to add quick task:', e);
    }
  }

  // ----------------------------------------------------
  // Fullscreen Focus Mode
  // ----------------------------------------------------
  function enterFullscreenFocus() {
    fullscreenTaskLabel.textContent = activeTaskTitle ? `Sedang Mengerjakan: ${activeTaskTitle}` : 'Fokus Kerja';
    fullscreenOverlay.classList.add('active');
    
    // Try browser requestFullscreen
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
    } catch (e) {}
  }

  function exitFullscreenFocus() {
    fullscreenOverlay.classList.remove('active');
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    } catch (e) {}
  }

  // ----------------------------------------------------
  // Settings Panel Config
  // ----------------------------------------------------
  function applySettingsToUI() {
    // Apply work preset selectors
    const presetSelect = document.getElementById('setting-work-preset');
    presetSelect.value = settings.work_mode;

    // Apply values to input fields
    document.getElementById('setting-work-duration').value = settings.work_duration;
    document.getElementById('setting-short-duration').value = settings.short_break_duration;
    document.getElementById('setting-long-duration').value = settings.long_break_duration;
    document.getElementById('setting-long-after').value = settings.long_break_after;
    document.getElementById('setting-daily-goal').value = settings.daily_goal;

    // Apply values to sound pane
    document.getElementById('setting-show-notifications').checked = settings.show_notifications;
    document.getElementById('setting-notif-sound').value = settings.notification_sound;
    document.getElementById('setting-notif-volume').value = settings.notification_volume;
    document.getElementById('setting-auto-break').checked = settings.auto_start_break;
    document.getElementById('setting-auto-work').checked = settings.auto_start_work;

    // Apply integrations
    document.getElementById('setting-sync-calendar').checked = settings.sync_to_kalender;
    document.getElementById('setting-show-sidebar').checked = settings.show_task_sidebar;

    // Apply sound sliders
    ambientSoundSelect.value = settings.ambient_sound;
    ambientVolumeSlider.value = settings.ambient_volume;
    tickSoundSelect.value = settings.tick_sound;
    tickVolumeSlider.value = settings.tick_volume;

    // Sidebar view setting
    if (settings.show_task_sidebar) {
      taskSidebar.classList.add('active');
      toggleSidebarBtn.textContent = '✕ Tutup Sidebar';
    } else {
      taskSidebar.classList.remove('active');
      toggleSidebarBtn.textContent = '📋 Sidebar Tugas';
    }
  }

  async function saveSettingsFromUI() {
    const saveStatus = document.getElementById('save-status');
    saveStatus.textContent = 'Menyimpan...';
    saveStatus.className = 'saving';

    const presetSelect = document.getElementById('setting-work-preset');

    settings.work_mode = presetSelect.value;
    settings.work_duration = parseInt(document.getElementById('setting-work-duration').value) || 25;
    settings.short_break_duration = parseInt(document.getElementById('setting-short-duration').value) || 5;
    settings.long_break_duration = parseInt(document.getElementById('setting-long-duration').value) || 30;
    settings.long_break_after = parseInt(document.getElementById('setting-long-after').value) || 4;
    settings.daily_goal = parseInt(document.getElementById('setting-daily-goal').value) || 8;

    settings.show_notifications = document.getElementById('setting-show-notifications').checked;
    settings.notification_sound = document.getElementById('setting-notif-sound').value;
    settings.notification_volume = parseInt(document.getElementById('setting-notif-volume').value) || 60;
    settings.auto_start_break = document.getElementById('setting-auto-break').checked;
    settings.auto_start_work = document.getElementById('setting-auto-work').checked;

    settings.sync_to_kalender = document.getElementById('setting-sync-calendar').checked;
    settings.show_task_sidebar = document.getElementById('setting-show-sidebar').checked;

    // Audio settings in slider
    settings.ambient_sound = ambientSoundSelect.value;
    settings.ambient_volume = parseInt(ambientVolumeSlider.value);
    settings.tick_sound = tickSoundSelect.value;
    settings.tick_volume = parseInt(tickVolumeSlider.value);

    saveSettings(settings);
    
    // Desktop notifications setup request if checked
    if (settings.show_notifications) {
      await setupNotifications();
    }

    setTimeout(async () => {
      saveStatus.textContent = 'Tersimpan ✓';
      saveStatus.className = 'saved';
      
      // Update UI displays
      applySettingsToUI();
      await updateTodayCounts();
      await refreshStats();
      resetTimer();

      setTimeout(() => {
        saveStatus.textContent = '';
        saveStatus.className = '';
      }, 2000);
    }, 500);
  }

  // ----------------------------------------------------
  // Bind Event Listeners
  // ----------------------------------------------------
  function setupEventListeners() {
    // Timer Buttons
    btnToggle.addEventListener('click', toggleTimer);
    btnSkip.addEventListener('click', skipSession);
    btnReset.addEventListener('click', resetTimer);

    // Fullscreen Controls
    fullscreenBtnToggle.addEventListener('click', toggleTimer);
    fullscreenBtnSkip.addEventListener('click', skipSession);
    fullscreenBtnExit.addEventListener('click', exitFullscreenFocus);
    fullscreenOverlay.addEventListener('dblclick', exitFullscreenFocus);

    // Sidebar Toggle
    toggleSidebarBtn.addEventListener('click', () => {
      const active = taskSidebar.classList.toggle('active');
      toggleSidebarBtn.textContent = active ? '✕ Tutup Sidebar' : '📋 Sidebar Tugas';
      settings.show_task_sidebar = active;
      saveSettings(settings);
    });

    document.addEventListener('tmpt:sidebar-toggle', (e) => {
      e.preventDefault();
      const active = taskSidebar.classList.toggle('active');
      toggleSidebarBtn.textContent = active ? '✕ Tutup Sidebar' : '📋 Sidebar Tugas';
      settings.show_task_sidebar = active;
      saveSettings(settings);
    });

    // Preset selection change
    document.getElementById('setting-work-preset').addEventListener('change', (e) => {
      const val = e.target.value;
      if (val !== 'custom' && WORK_MODES[val]) {
        const mode = WORK_MODES[val];
        document.getElementById('setting-work-duration').value = mode.work;
        document.getElementById('setting-short-duration').value = mode.short;
        document.getElementById('setting-long-duration').value = mode.long;
        document.getElementById('setting-long-after').value = mode.after;
      }
    });

    // Sound adjustments real-time
    ambientSoundSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      settings.ambient_enabled = val !== 'none';
      settings.ambient_sound = val;
      saveSettings(settings);
      
      if (timerState === 'running' && val !== 'none') {
        ambientPlayer.play(val, settings.ambient_volume);
      } else {
        ambientPlayer.stop();
      }
    });

    ambientVolumeSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      settings.ambient_volume = val;
      ambientPlayer.setVolume(val);
      saveSettings(settings);
    });

    tickSoundSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      settings.tick_enabled = val !== 'none';
      settings.tick_sound = val;
      saveSettings(settings);
    });

    tickVolumeSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      settings.tick_volume = val;
      saveSettings(settings);
    });

    // Save Settings
    document.getElementById('btn-save-settings').addEventListener('click', saveSettingsFromUI);

    // Session tabs manual switch
    document.querySelectorAll('.session-tab').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (timerState === 'running' || timerState === 'paused') {
          let ok = false;
          if (window.TMPT_UI && typeof window.TMPT_UI.confirm === 'function') {
            ok = await window.TMPT_UI.confirm('Sesi timer sedang berjalan. Apakah Anda ingin menghentikannya?');
          } else {
            ok = confirm('Sesi timer sedang berjalan. Apakah Anda ingin menghentikannya?');
          }
          if (ok) {
            timerWorker.postMessage({ type: 'PAUSE' });
            stopTicker();
            ambientPlayer.stop();
            setMode(btn.dataset.mode);
          }
        } else {
          setMode(btn.dataset.mode);
        }
      });
    });

    // Fullscreen trigger button
    document.getElementById('fullscreen-focus-btn').addEventListener('click', enterFullscreenFocus);

    // Active Task complete button
    btnCompleteActiveTask.addEventListener('click', async () => {
      if (activeTaskId) {
        await toggleTaskComplete(activeTaskId);
        deselectActiveTask();
        await refreshTasksList();
        showToast('Tugas diselesaikan!', 'success');
      }
    });

    // Quick Task add
    addQuickTaskBtn.addEventListener('click', addQuickTask);
    quickTaskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        addQuickTask();
      }
    });

    // Settings Navigation pane toggler
    document.querySelectorAll('.settings-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.settings-section-pane').forEach(p => p.classList.remove('active'));
        const paneId = btn.dataset.target;
        document.getElementById(paneId).classList.add('active');
      });
    });

    // Export Buttons
    document.getElementById('btn-export-md').addEventListener('click', async () => {
      const summary = await calculateStatsSummary();
      const sessions = await getSessionsByDate(new Date().toISOString().slice(0,10));
      const content = generateMarkdownReport(sessions, summary, 'weekly');
      triggerDownload(content, `pomodoro_report_${new Date().toISOString().slice(0,10)}.md`, 'text/markdown');
    });

    document.getElementById('btn-export-csv').addEventListener('click', async () => {
      const today = new Date().toISOString().slice(0,10);
      const sessions = await getSessionsByDate(today);
      const content = generateCSVExport(sessions);
      triggerDownload(content, `pomodoro_export_${today}.csv`, 'text/csv');
    });

    document.getElementById('btn-export-json').addEventListener('click', async () => {
      const today = new Date().toISOString().slice(0,10);
      const sessions = await getSessionsByDate(today);
      const summary = await calculateStatsSummary();
      const content = generateJSONExport(sessions, summary);
      triggerDownload(content, `pomodoro_data_${today}.json`, 'application/json');
    });

    // Nav Tabs Navigation
    document.getElementById('nav-tab-stats').addEventListener('click', (e) => switchNavTab(e.target, 'stats'));
    document.getElementById('nav-tab-achievements').addEventListener('click', (e) => switchNavTab(e.target, 'achievements'));
    document.getElementById('nav-tab-settings').addEventListener('click', (e) => switchNavTab(e.target, 'settings'));

    // Handle cross-app broadcasts
    window.addEventListener('message', async (e) => {
      if (e.data && e.data.type === 'TASK_SELECTED_FOR_POMODORO') {
        const { id, title } = e.data.payload;
        selectActiveTask(id, title);
      }
    });

    // Keyboard Shortcuts Actions Setup
    setupKeyboardShortcuts({
      toggleTimer: toggleTimer,
      startNextSession: skipSession,
      skipSession: skipSession,
      resetTimer: resetTimer,
      toggleFullscreen: () => {
        if (fullscreenOverlay.classList.contains('active')) {
          exitFullscreenFocus();
        } else {
          enterFullscreenFocus();
        }
      },
      exitFullscreen: exitFullscreenFocus,
      toggleMute: () => {
        // Mute / Unmute ambient sound
        if (settings.ambient_enabled) {
          ambientPlayer.stop();
          settings.ambient_enabled = false;
        } else {
          settings.ambient_enabled = true;
          ambientPlayer.play(settings.ambient_sound, settings.ambient_volume);
        }
        saveSettings(settings);
        applySettingsToUI();
      },
      nextModeTab: () => {
        const modes = ['work', 'short', 'long'];
        const nextIdx = (modes.indexOf(currentMode) + 1) % modes.length;
        setMode(modes[nextIdx]);
      },
      showStats: () => {
        switchNavTab(document.getElementById('nav-tab-stats'), 'stats');
      },
      showSettings: () => {
        switchNavTab(document.getElementById('nav-tab-settings'), 'settings');
      },
      toggleCheatsheet: () => {
        showToast('Pintasan Keyboard:\n- Space: Mulai/Jeda\n- Ctrl+Enter: Lewati Sesi\n- R: Reset Timer\n- F: Fullscreen Focus\n- M: Mute/Unmute Latar\n- Tab: Ganti Mode', 'info', 5000);
      }
    });
  }

  function switchNavTab(tabBtn, targetKey) {
    document.querySelectorAll('nav ul button').forEach(b => b.classList.remove('active-nav-tab'));
    tabBtn.classList.add('active-nav-tab');

    Object.keys(sections).forEach(key => {
      if (key === targetKey) {
        sections[key].style.display = 'block';
      } else {
        sections[key].style.display = 'none';
      }
    });
  }

  // Toast notifications UI helper
  function showToast(message, type = 'info', duration = 3000) {
    if (window.TMPT_UI && typeof window.TMPT_UI.toast === 'function') {
      window.TMPT_UI.toast(message, type);
      return;
    }
    
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Style toast inline simply if shared assets style unavailable
    toast.style.padding = '0.75rem 1.25rem';
    toast.style.borderRadius = '8px';
    toast.style.backgroundColor = type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : '#3498db';
    toast.style.color = '#fff';
    toast.style.marginBottom = '0.5rem';
    toast.style.fontSize = '0.9rem';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    toast.style.display = 'flex';
    toast.style.justifyContent = 'space-between';
    toast.style.animation = 'fadeIn 0.3s';

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s';
      setTimeout(() => toast.remove(), 500);
    }, duration);
  }

  // Run initial setup
  await init();
});
