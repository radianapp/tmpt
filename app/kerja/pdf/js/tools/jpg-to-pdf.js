/**
 * T12 — JPG/PNG to PDF
 * Konversi gambar menjadi PDF dengan opsi kompresi.
 */
import { loadPdfLib, setupDropZone, readFileAsArrayBuffer, formatFileSize,
         downloadBytes, showProgress, hideProgress, setProgress,
         showResult, hideResult, toast, showLoader, hideLoader, applyTheme, loadAppHeader } from '../pdf-core.js';

applyTheme();
loadAppHeader();

const state = { files: [] };

setupDropZone('drop-zone', handleFiles, { accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp', multiple: true });
document.getElementById('btn-apply').addEventListener('click', runConvert);

// Inisialisasi UI Kompresi
const compressEnable = document.getElementById('compress-enable');
const compressControls = document.getElementById('compress-controls');
const qualitySlider = document.getElementById('compress-quality');
const qualityLabel = document.getElementById('quality-label');

compressEnable.addEventListener('change', () => {
  compressControls.style.display = compressEnable.checked ? 'block' : 'none';
});

qualitySlider.addEventListener('input', () => {
  qualityLabel.textContent = qualitySlider.value + '%';
});

document.querySelectorAll('.compress-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    qualitySlider.value = btn.dataset.q;
    qualityLabel.textContent = btn.dataset.q + '%';
  });
});

function handleFiles(fileList) {
  for (const f of fileList) {
    if (!f.type.startsWith('image/')) { toast(`${f.name} bukan gambar.`, 'warning'); continue; }
    state.files.push(f);
  }
  renderList();
}

function renderList() {
  const list = document.getElementById('file-list');
  const opts = document.getElementById('tool-controls');
  const bar  = document.getElementById('action-bar');

  if (state.files.length === 0) {
    list.innerHTML = '';
    opts.hidden = true; bar.hidden = true; hideResult(); return;
  }
  opts.hidden = false; bar.hidden = false; hideResult();

  list.innerHTML = '';
  state.files.forEach((f, i) => {
    const li = document.createElement('li');
    li.className = 'pdf-file-item';
    const img = document.createElement('img');
    img.style.cssText = 'width:36px;height:36px;object-fit:cover;border-radius:4px;';
    img.alt = f.name;
    const url = URL.createObjectURL(f);
    img.src = url;
    li.innerHTML = `
      <span class="file-name">${f.name}</span>
      <span class="file-size">${formatFileSize(f.size)}</span>
      <button class="file-rm" aria-label="Hapus ${f.name}" data-i="${i}">✕</button>`;
    li.insertBefore(img, li.firstChild);
    list.appendChild(li);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });

  list.querySelectorAll('.file-rm').forEach(btn => {
    btn.addEventListener('click', e => {
      state.files.splice(Number(e.currentTarget.dataset.i), 1);
      renderList();
    });
  });
}

function compressImage(file, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; // Latar belakang putih untuk transparansi PNG
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Gagal mengompresi gambar.')); return; }
        blob.arrayBuffer().then(resolve).catch(reject);
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Gagal memuat gambar: ${file.name}`)); };
    img.src = url;
  });
}

async function runConvert() {
  if (state.files.length === 0) { toast('Tambahkan gambar terlebih dahulu.', 'warning'); return; }

  showLoader('Memuat pdf-lib...');
  const PDFLib = await loadPdfLib();
  hideLoader();
  showProgress('Mengonversi gambar...');

  try {
    const doc  = await PDFLib.PDFDocument.create();
    const size = document.getElementById('page-size').value;
    const margin = Number(document.getElementById('page-margin').value) || 0;
    const doCompress = compressEnable.checked;
    const quality = Number(qualitySlider.value) / 100;

    const pageSizes = {
      a4:      [595.28, 841.89],
      letter:  [612, 792],
      fit:     null,
    };

    for (let i = 0; i < state.files.length; i++) {
      setProgress(Math.round(((i + 1) / state.files.length) * 90), `Gambar ${i + 1} dari ${state.files.length}...`);
      const f   = state.files[i];
      
      let buf;
      let isJpg = true;
      if (doCompress) {
        buf = await compressImage(f, quality);
        isJpg = true;
      } else {
        buf = await readFileAsArrayBuffer(f);
        isJpg = (f.type !== 'image/png');
      }

      let img;
      if (!isJpg) img = await doc.embedPng(buf);
      else img = await doc.embedJpg(buf);

      let [W, H] = pageSizes[size] ?? [img.width + margin * 2, img.height + margin * 2];
      if (size === 'fit') { W = img.width + margin * 2; H = img.height + margin * 2; }

      const page = doc.addPage([W, H]);
      const scale = Math.min((W - margin * 2) / img.width, (H - margin * 2) / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h });
    }

    setProgress(95, 'Menyimpan...');
    const bytes = await doc.save();
    hideProgress();

    const outputName = document.getElementById('output-name').value.trim() || 'images';
    downloadBytes(bytes, outputName.endsWith('.pdf') ? outputName : outputName + '.pdf');
    showResult({
      icon: '✅', title: `${state.files.length} gambar dikonversi!`,
      meta: formatFileSize(bytes.byteLength),
      filename: outputName.endsWith('.pdf') ? outputName : outputName + '.pdf',
      bytes,
      onReset: () => { state.files = []; renderList(); document.getElementById('drop-zone').hidden = false; hideResult(); },
    });
    toast('Berhasil!', 'success');
  } catch (err) {
    hideProgress(); console.error(err);
    toast('Gagal: ' + err.message, 'error');
  }
}
