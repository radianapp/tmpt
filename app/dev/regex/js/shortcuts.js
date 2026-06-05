// app/dev/regex/js/shortcuts.js

export function setupKeyboardShortcuts(callbacks) {
  document.addEventListener('keydown', (e) => {
    // Ctrl + S: Simpan manual
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (typeof callbacks.onSave === 'function') {
        callbacks.onSave();
      }
    }

    // Ctrl + Enter: Run/Proses Manual jika diperlukan
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (typeof callbacks.onRun === 'function') {
        callbacks.onRun();
      }
    }

    // Ctrl + 1 s/d Ctrl + 5: Tukar tab
    if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '5') {
      e.preventDefault();
      const tabIndices = ['tab-studio', 'tab-ai', 'tab-security', 'tab-devops', 'tab-library'];
      const targetTab = tabIndices[parseInt(e.key) - 1];
      if (targetTab && typeof callbacks.onTabChange === 'function') {
        callbacks.onTabChange(targetTab);
      }
    }
  });
}
