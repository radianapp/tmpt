// app/dev/code/js/runner.js

// === Markdown Support ===
let _markedLoaded = false;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function ensureMarked() {
  if (typeof marked !== 'undefined') return;
  // Lazy load marked.js dari CDN
  await loadScript('https://cdn.jsdelivr.net/npm/marked@13.0.0/marked.min.js');
  // Konfigurasi marked: aman, tidak sanitize (kita render di iframe)
  marked.setOptions({ breaks: true, gfm: true });
}

/**
 * Render konten Markdown ke dalam iframe sebagai HTML preview.
 */
export async function renderMarkdownPreview(iframeElement) {
  // Konten markdown diambil dari parameter kedua (dioper dari editor-init.js)
  const markdownContent = iframeElement._markdownContent || '';
  await ensureMarked();

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const bgColor   = isDark ? '#1e1e1e' : '#ffffff';
  const textColor = isDark ? '#d4d4d4' : '#1a1a1a';
  const codeBg    = isDark ? '#2d2d2d' : '#f5f5f5';
  const borderColor = isDark ? '#444' : '#e1e4e8';

  const html = marked.parse(markdownContent);

  iframeElement.srcdoc = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 15px; line-height: 1.7;
      background: ${bgColor}; color: ${textColor};
      padding: 1.5rem 2rem; max-width: 820px; margin: 0 auto;
    }
    h1,h2,h3,h4,h5,h6 { margin: 1.5rem 0 0.5rem; font-weight: 700; line-height: 1.3; }
    h1 { font-size: 2rem; border-bottom: 2px solid ${borderColor}; padding-bottom: 0.4rem; }
    h2 { font-size: 1.5rem; border-bottom: 1px solid ${borderColor}; padding-bottom: 0.3rem; }
    p  { margin: 0.75rem 0; }
    a  { color: #3b82f6; }
    code {
      background: ${codeBg}; padding: 0.15rem 0.4rem;
      border-radius: 4px; font-family: 'Consolas','Courier New',monospace;
      font-size: 0.88em;
    }
    pre {
      background: ${codeBg}; border-radius: 8px; padding: 1rem;
      overflow-x: auto; margin: 1rem 0;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 4px solid #3b82f6; padding: 0.5rem 1rem;
      margin: 1rem 0; opacity: 0.85;
      background: ${isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.05)'};
      border-radius: 0 6px 6px 0;
    }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid ${borderColor}; padding: 0.5rem 0.75rem; text-align: left; }
    th { background: ${isDark ? '#2d2d2d' : '#f6f8fa'}; font-weight: 600; }
    tr:nth-child(even) { background: ${isDark ? '#252525' : '#fafafa'}; }
    img { max-width: 100%; border-radius: 6px; }
    ul, ol { padding-left: 1.5rem; margin: 0.75rem 0; }
    li { margin: 0.3rem 0; }
    hr { border: none; border-top: 1px solid ${borderColor}; margin: 1.5rem 0; }
  </style>
</head>
<body>${html}</body>
</html>`;
}

// === Python Worker Singleton ===
let _pythonWorker = null;
let _pythonWorkerReady = false;
let _pythonPendingCallbacks = new Map();
let _runIdCounter = 0;

/**
 * Dapatkan atau buat Python Worker.
 * Worker hanya dibuat sekali (singleton) agar Pyodide tidak perlu reload.
 */
function getPythonWorker() {
  if (!_pythonWorker) {
    _pythonWorker = new Worker(new URL('./python-worker.js?v=' + Date.now(), import.meta.url), { type: 'classic' });

    _pythonWorker.onmessage = (event) => {
      const { type, message, id } = event.data;

      if (type === 'ready') {
        _pythonWorkerReady = true;
        return;
      }

      const cb = id ? _pythonPendingCallbacks.get(id) : null;

      if (type === 'stdout') {
        if (cb) cb.onLog(message, 'log');
      } else if (type === 'stderr') {
        if (cb) cb.onLog(message, 'warn');
      } else if (type === 'result') {
        if (cb) cb.onLog(`→ ${message}`, 'log');
      } else if (type === 'error') {
        if (cb) cb.onError(message);
      } else if (type === 'status') {
        if (cb) cb.onLog(message, 'info');
      } else if (type === 'done') {
        if (cb) {
          cb.onDone();
          _pythonPendingCallbacks.delete(id);
        }
      } else if (type === 'install_done') {
        if (cb) {
          cb.onLog(`✅ Paket berhasil diinstall: ${event.data.packages.join(', ')}`, 'log');
          cb.onDone();
          _pythonPendingCallbacks.delete(id);
        }
      }
    };

    _pythonWorker.onerror = (err) => {
      console.error('Python Worker error:', err);
    };
  }
  return _pythonWorker;
}

/**
 * Pre-load Pyodide di background agar siap saat dibutuhkan.
 */
export function preloadPythonRuntime() {
  const worker = getPythonWorker();
  if (!_pythonWorkerReady) {
    worker.postMessage({ type: 'preload' });
  }
}

/**
 * Jalankan kode Python dalam Worker Pyodide.
 * @param {string} code - Kode Python yang akan dijalankan
 * @param {function} onLog - Callback untuk output (message, type)
 * @param {function} onError - Callback untuk error (message)
 * @param {string[]} inputValues - Nilai pre-filled untuk setiap input() call
 * @returns {Promise<void>}
 */
export function runPython(code, onLog, onError, inputValues = []) {
  return new Promise((resolve) => {
    const worker = getPythonWorker();
    const runId = `py_${++_runIdCounter}_${Date.now()}`;

    _pythonPendingCallbacks.set(runId, {
      onLog,
      onError,
      onDone: resolve
    });

    worker.postMessage({ type: 'run', code, id: runId, inputValues });
  });
}

/**
 * Install paket Python menggunakan micropip.
 * @param {string[]} packages - Daftar nama paket
 * @param {function} onLog - Callback output
 * @param {function} onError - Callback error
 * @returns {Promise<void>}
 */
export function installPythonPackages(packages, onLog, onError) {
  return new Promise((resolve) => {
    const worker = getPythonWorker();
    const runId = `pip_${++_runIdCounter}_${Date.now()}`;

    _pythonPendingCallbacks.set(runId, {
      onLog,
      onError,
      onDone: resolve
    });

    onLog(`📦 Menginstall paket: ${packages.join(', ')}...`, 'info');
    worker.postMessage({ type: 'install', packages, id: runId });
  });
}

/**
 * Execute JavaScript code inside a sandboxed iframe and capture console logs.
 */
export function runJavaScript(code, onLog, onError) {
  // Create a sandboxed iframe
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.setAttribute('sandbox', 'allow-scripts');

  // Safe Base64 encoding to prevent premature script tag closing
  const base64Code = btoa(unescape(encodeURIComponent(code)));

  // Custom srcdoc script that intercepts console.log, console.error, etc.
  iframe.srcdoc = `
    <!DOCTYPE html>
    <html>
    <head>
      <script>
        const _log = console.log;
        const _error = console.error;
        const _warn = console.warn;
        const _info = console.info;

        function sendToParent(type, args) {
          const formatted = args.map(arg => {
            if (typeof arg === 'object') {
              try { return JSON.stringify(arg, null, 2); } catch(e) { return String(arg); }
            }
            return String(arg);
          }).join(' ');
          window.parent.postMessage({ type, message: formatted }, '*');
        }

        console.log = (...args) => { _log(...args); sendToParent('log', args); };
        console.error = (...args) => { _error(...args); sendToParent('error', args); };
        console.warn = (...args) => { _warn(...args); sendToParent('warn', args); };
        console.info = (...args) => { _info(...args); sendToParent('info', args); };

        window.addEventListener('error', (event) => {
          window.parent.postMessage({ type: 'error', message: event.message + ' (Baris ' + event.lineno + ')' }, '*');
        });
        window.addEventListener('unhandledrejection', (event) => {
          window.parent.postMessage({ type: 'error', message: 'Unhandled Promise Rejection: ' + event.reason }, '*');
        });
      <\/script>
    </head>
    <body>
      <script>
        try {
          const codeToRun = decodeURIComponent(escape(atob("${base64Code}")));
          (new Function(codeToRun))();
        } catch(err) {
          window.parent.postMessage({ type: 'error', message: err.name + ': ' + err.message }, '*');
        }
      <\/script>
    </body>
    </html>
  `;

  // Message handler
  const messageListener = (event) => {
    if (event.source !== iframe.contentWindow) return;

    const { type, message } = event.data;
    if (type === 'log') onLog(message, 'log');
    else if (type === 'warn') onLog(message, 'warn');
    else if (type === 'info') onLog(message, 'info');
    else if (type === 'error') onError(message);
  };

  window.addEventListener('message', messageListener);
  document.body.appendChild(iframe);

  // Clean up iframe after 10 seconds
  setTimeout(() => {
    window.removeEventListener('message', messageListener);
    iframe.remove();
  }, 10000);
}

export async function renderHtmlPreview(iframeElement, htmlCode, getFileContent) {
  if (!iframeElement) return;

  let processedHtml = htmlCode;

  if (getFileContent) {
    // 1. Inline relative scripts: <script src="..."></script>
    const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi;
    let match;
    const scriptReplacements = [];
    while ((match = scriptRegex.exec(htmlCode)) !== null) {
      const fullTag = match[0];
      const srcPath = match[1];

      if (!srcPath.startsWith('http://') && !srcPath.startsWith('https://') && !srcPath.startsWith('//') && !srcPath.startsWith('/')) {
        scriptReplacements.push({ fullTag, srcPath });
      }
    }

    for (const { fullTag, srcPath } of scriptReplacements) {
      try {
        const content = await getFileContent(srcPath);
        if (content !== null) {
          processedHtml = processedHtml.replace(fullTag, `<script>${content}<\/script>`);
        }
      } catch (err) {
        console.warn(`Failed to inline script ${srcPath}:`, err);
      }
    }

    // 2. Inline relative stylesheets: <link rel="stylesheet" href="...">
    const styleRegex = /<link\s+[^>]*rel=["']stylesheet["']\s+[^>]*href=["']([^"']+)["'][^>]*\/?>|<link\s+[^>]*href=["']([^"']+)["']\s+[^>]*rel=["']stylesheet["'][^>]*\/?>/gi;
    const styleReplacements = [];
    while ((match = styleRegex.exec(htmlCode)) !== null) {
      const fullTag = match[0];
      const hrefPath = match[1] || match[2];

      if (hrefPath && !hrefPath.startsWith('http://') && !hrefPath.startsWith('https://') && !hrefPath.startsWith('//') && !hrefPath.startsWith('/')) {
        styleReplacements.push({ fullTag, hrefPath });
      }
    }

    for (const { fullTag, hrefPath } of styleReplacements) {
      try {
        const content = await getFileContent(hrefPath);
        if (content !== null) {
          processedHtml = processedHtml.replace(fullTag, `<style>${content}</style>`);
        }
      } catch (err) {
        console.warn(`Failed to inline stylesheet ${hrefPath}:`, err);
      }
    }
  }

  // Inject HTML code into the iframe srcdoc
  iframeElement.srcdoc = processedHtml;
}
