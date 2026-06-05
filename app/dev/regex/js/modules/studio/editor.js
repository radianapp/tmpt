// app/dev/regex/js/modules/studio/editor.js

export function setupEditorSync(textarea, backdrop) {
  if (!textarea || !backdrop) return;

  function syncScroll() {
    backdrop.scrollTop = textarea.scrollTop;
    backdrop.scrollLeft = textarea.scrollLeft;
  }

  textarea.addEventListener('scroll', syncScroll);
  textarea.addEventListener('input', syncScroll);

  // Initial sync
  syncScroll();
}
