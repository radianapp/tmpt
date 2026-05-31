// app/dev/code/js/python-worker.js
// Web Worker untuk menjalankan Python via Pyodide (WebAssembly)
// Fix: Jangan redirect stdout/stderr via Python class (menyebabkan DataCloneError).
// Gunakan callback stdout/stderr bawaan Pyodide saat loadPyodide().

let pyodide = null;
let isLoading = false;
let isLoaded = false;

// Callback aktif untuk run saat ini (diset sebelum runPython, di-clear sesudahnya)
let _activeId = null;

async function ensurePyodide() {
  if (isLoaded) return pyodide;
  if (isLoading) {
    // Tunggu sampai selesai
    await new Promise((resolve) => {
      const iv = setInterval(() => {
        if (!isLoading) { clearInterval(iv); resolve(); }
      }, 100);
    });
    return pyodide;
  }

  isLoading = true;
  self.postMessage({ type: 'status', message: 'Memuat Python runtime (Pyodide)...' });

  try {
    importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js');

    pyodide = await self.loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/',
      // stdout/stderr dihandle di sini, BUKAN dari Python class
      // agar tidak terkena DataCloneError saat postMessage
      stdout: (text) => {
        self.postMessage({ type: 'stdout', message: text, id: _activeId });
      },
      stderr: (text) => {
        self.postMessage({ type: 'stderr', message: text, id: _activeId });
      }
    });

    // Override input() — stdin tidak tersedia di Web Worker / Pyodide
    // Tanpa ini akan muncul OSError [Errno 29] I/O error yang membingungkan
    pyodide.runPython(`
import builtins as _builtins

def _tmpt_input(prompt=''):
    if prompt:
        print(f"[input prompt: {prompt}]")
    raise EOFError(
        "\\n\\u26a0\\ufe0f  input() tidak tersedia di lingkungan browser (Pyodide).\\n"
        "   Ganti input() dengan nilai langsung, contoh:\\n"
        "   \\n"
        "   # SEBELUM (tidak bisa di browser):\\n"
        "   # nilai = float(input('Masukkan angka: '))\\n"
        "   \\n"
        "   # SESUDAH (gunakan nilai langsung):\\n"
        "   nilai = 36.6"
    )

_builtins.input = _tmpt_input
del _builtins
`);

    isLoading = false;
    isLoaded = true;
    self.postMessage({ type: 'ready' });
    return pyodide;
  } catch (err) {
    isLoading = false;
    self.postMessage({ type: 'error', message: `Gagal memuat Pyodide: ${err.message}`, id: _activeId });
    throw err;
  }
}

self.onmessage = async (event) => {
  const { type, code, id } = event.data;

  if (type === 'run') {
    _activeId = id;
    try {
      const py = await ensurePyodide();

      let result;
      try {
        result = py.runPython(code);
      } catch (pyErr) {
        // Pyodide exception — tampilkan pesan error Python yang bersih
        const msg = pyErr.message || String(pyErr);
        self.postMessage({ type: 'error', message: msg, id });
        self.postMessage({ type: 'done', id });
        _activeId = null;
        return;
      }

      // Jika ada return value (bukan None), tampilkan
      if (result !== undefined && result !== null && String(result) !== 'None') {
        self.postMessage({ type: 'result', message: String(result), id });
      }

      self.postMessage({ type: 'done', id });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message || String(err), id });
      self.postMessage({ type: 'done', id });
    } finally {
      _activeId = null;
    }
  } else if (type === 'preload') {
    try {
      await ensurePyodide();
    } catch (_) { /* error sudah di-report */ }
  } else if (type === 'install') {
    _activeId = id;
    try {
      const py = await ensurePyodide();
      await py.loadPackage('micropip');
      const micropip = py.pyimport('micropip');
      for (const pkg of event.data.packages) {
        self.postMessage({ type: 'stdout', message: `📦 Installing ${pkg}...`, id });
        await micropip.install(pkg);
      }
      self.postMessage({ type: 'install_done', packages: event.data.packages, id });
    } catch (err) {
      self.postMessage({ type: 'error', message: `Gagal install paket: ${err.message}`, id });
      self.postMessage({ type: 'done', id });
    } finally {
      _activeId = null;
    }
  }
};
