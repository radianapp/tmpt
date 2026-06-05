// app/tools/pomodoro/js/shortcuts.js

export function setupKeyboardShortcuts(actions) {
  window.addEventListener('keydown', (e) => {
    // If user is typing in an input, textarea, or select, don't trigger shortcuts
    const activeEl = document.activeElement;
    if (activeEl && (
      activeEl.tagName === 'INPUT' || 
      activeEl.tagName === 'TEXTAREA' || 
      activeEl.tagName === 'SELECT' ||
      activeEl.isContentEditable
    )) {
      return;
    }

    const key = e.key;
    const ctrl = e.ctrlKey || e.metaKey;

    if (key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      if (actions.toggleTimer) actions.toggleTimer();
    } else if (ctrl && key === 'Enter') {
      e.preventDefault();
      if (actions.startNextSession) actions.startNextSession();
    } else if (key.toLowerCase() === 's') {
      e.preventDefault();
      if (actions.skipSession) actions.skipSession();
    } else if (key.toLowerCase() === 'r') {
      e.preventDefault();
      if (actions.resetTimer) actions.resetTimer();
    } else if (key.toLowerCase() === 'f') {
      e.preventDefault();
      if (actions.toggleFullscreen) actions.toggleFullscreen();
    } else if (key.toLowerCase() === 'm') {
      e.preventDefault();
      if (actions.toggleMute) actions.toggleMute();
    } else if (key === 'Tab') {
      e.preventDefault();
      if (actions.nextModeTab) actions.nextModeTab();
    } else if (ctrl && key.toLowerCase() === 's') {
      e.preventDefault();
      if (actions.showStats) actions.showStats();
    } else if (ctrl && key === ',') {
      e.preventDefault();
      if (actions.showSettings) actions.showSettings();
    } else if (key === '?') {
      e.preventDefault();
      if (actions.toggleCheatsheet) actions.toggleCheatsheet();
    } else if (key === 'Escape' || key === 'Esc') {
      if (actions.exitFullscreen) actions.exitFullscreen();
    }
  });
}
