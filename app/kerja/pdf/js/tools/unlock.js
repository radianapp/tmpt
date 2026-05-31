/**
 * T11 — Unlock PDF
 * Hapus password dari PDF yang terproteksi.
 */
import { loadPdfLib, setupDropZone, readFileAsArrayBuffer, validatePdfFile,
         formatFileSize, downloadBytes, showProgress, hideProgress, setProgress,
         showResult, hideResult, toast, showLoader, hideLoader, applyTheme, loadAppHeader } from '../pdf-core.js';

import { decryptPDF } from '../../vendor/pdf-decrypt.js';

applyTheme();
loadAppHeader();

const state = { file: null, buffer: null };

setupDropZone('drop-zone', handleFile, { accept: '.pdf', multiple: false });
document.getElementById('btn-apply').addEventListener('click', runUnlock);
document.getElementById('toggle-pw').addEventListener('click', () => {
  const inp = document.getElementById('password');
  inp.type  = inp.type === 'password' ? 'text' : 'password';
});

async function handleFile(fileList) {
  const f = fileList[0];
  try { validatePdfFile(f); } catch (e) { toast(e.message, 'error'); return; }
  state.file = f;
  state.buffer = await readFileAsArrayBuffer(f);
  document.getElementById('drop-zone').hidden = true;
  document.getElementById('file-info').textContent = `${f.name} • ${formatFileSize(f.size)}`;
  document.getElementById('tool-controls').hidden = false;
  document.getElementById('action-bar').hidden = false;
  hideResult();
}

async function runUnlock() {
  const pw = document.getElementById('password').value;

  showLoader('Memuat pdf-lib...');
  const PDFLib = await loadPdfLib();
  hideLoader();
  showProgress('Membuka kunci PDF...');

  try {
    setProgress(50, 'Mendekripsi berkas...');
    const bytes = await decryptPDF(new Uint8Array(state.buffer), pw);
    hideProgress();
    const name = state.file.name.replace('.pdf', '') + '_unlocked.pdf';
    downloadBytes(bytes, name);
    showResult({
      icon: '🔓', title: 'PDF berhasil dibuka kuncinya!',
      meta: formatFileSize(bytes.byteLength),
      filename: name, bytes,
      onReset: () => {
        state.file = null; state.buffer = null;
        document.getElementById('drop-zone').hidden = false;
        document.getElementById('tool-controls').hidden = true;
        document.getElementById('action-bar').hidden = true;
        document.getElementById('password').value = '';
        hideResult();
      },
    });
    toast('Berhasil!', 'success');
  } catch (err) {
    hideProgress(); console.error(err);
    const msg = err.message?.includes('password') || err.message?.includes('encrypt')
      ? 'Kata kunci salah atau PDF tidak terenkripsi dengan cara ini.'
      : 'Gagal membuka kunci: ' + err.message;
    toast(msg, 'error');
  }
}
