// app/dev/json/js/workers/json-worker.js

self.onmessage = async ({ data: { text, operation, options } }) => {
  try {
    switch (operation) {
      case 'validate': {
        try {
          JSON.parse(text);
          self.postMessage({ success: true, valid: true });
        } catch (err) {
          self.postMessage({ success: true, valid: false, error: err.message });
        }
        break;
      }
      case 'format': {
        const parsed = JSON.parse(text);
        const formatted = JSON.stringify(parsed, null, options.indent || 2);
        self.postMessage({ success: true, result: formatted });
        break;
      }
      case 'minify': {
        const parsed = JSON.parse(text);
        const minified = JSON.stringify(parsed);
        self.postMessage({ success: true, result: minified });
        break;
      }
      default:
        self.postMessage({ success: false, error: 'Operasi tidak dikenal.' });
    }
  } catch (err) {
    self.postMessage({ success: false, error: err.message });
  }
};
