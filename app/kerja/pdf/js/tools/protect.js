/**
 * T10 — Protect PDF
 * Enkripsi PDF dengan password menggunakan AES-256.
 */
import { loadPdfLib, setupDropZone, readFileAsArrayBuffer, validatePdfFile,
         formatFileSize, downloadBytes, showProgress, hideProgress, setProgress,
         showResult, hideResult, toast, showLoader, hideLoader, applyTheme, loadAppHeader } from '../pdf-core.js';

import { encryptPDF } from '../../vendor/pdf-encrypt.js';

applyTheme();
loadAppHeader();

const state = { file: null, buffer: null };

setupDropZone('drop-zone', handleFile, { accept: '.pdf', multiple: false });
document.getElementById('btn-apply').addEventListener('click', runProtect);
document.getElementById('toggle-pw').addEventListener('click', () => {
  const inp = document.getElementById('user-password');
  inp.type  = inp.type === 'password' ? 'text' : 'password';
});

// ── Passphrase Generator ──────────────────────────────────────────────────────
document.getElementById('btn-gen-passphrase')?.addEventListener('click', async () => {
  const gen = window.TMPT_Generator;
  if (!gen) { toast('Generator belum siap, coba lagi.', 'error'); return; }

  const passphrase = gen.generateMemorable(4, '-', true, true);
  const inp = document.getElementById('user-password');
  inp.value = passphrase;

  // Reveal so user can see / note it down
  inp.type = 'text';

  try {
    await navigator.clipboard.writeText(passphrase);
    toast('Passphrase dibuat & disalin ke clipboard! Simpan di tempat aman.', 'success');
  } catch {
    toast('Passphrase dibuat! Salin secara manual dari kolom di atas.', 'success');
  }
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

async function runProtect() {
  const pw = document.getElementById('user-password').value;
  if (!pw) { toast('Masukkan kata kunci terlebih dahulu.', 'warning'); return; }

  showLoader('Memuat pdf-lib...');
  const PDFLib = await loadPdfLib();
  hideLoader();
  showProgress('Mengenkripsi PDF...');

  try {
    setProgress(30, 'Mengenkripsi...');
    const ownerPassword = document.getElementById('owner-password').value || pw + '_owner';
    
    // Gunakan pustaka enkripsi client-side kita
    const bytes = await encryptPDF(new Uint8Array(state.buffer), pw, {
      ownerPassword: ownerPassword,
      algorithm: 'AES-256',
      allowPrinting: false,
      allowModifying: false,
      allowCopying: false,
      allowAnnotating: false,
      allowFillingForms: false,
      allowExtraction: false,
      allowAssembly: false,
      allowHighQualityPrint: false,
    });

    setProgress(100, 'Selesai');
    hideProgress();
    const name = state.file.name.replace('.pdf', '') + '_protected.pdf';
    downloadBytes(bytes, name);
    showResult({
      icon: '🔒', title: 'PDF berhasil dienkripsi!',
      meta: formatFileSize(bytes.byteLength),
      filename: name, bytes,
      onReset: () => {
        state.file = null; state.buffer = null;
        document.getElementById('drop-zone').hidden = false;
        document.getElementById('tool-controls').hidden = true;
        document.getElementById('action-bar').hidden = true;
        document.getElementById('user-password').value = '';
        document.getElementById('owner-password').value = '';
        hideResult();
      },
    });
    toast('PDF berhasil diproteksi!', 'success');
  } catch (err) {
    hideProgress(); console.error(err);
    toast('Gagal mengenkripsi: ' + err.message, 'error');
  }
}
