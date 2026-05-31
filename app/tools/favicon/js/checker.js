// TMPT Favicon Checker JS
// Menggunakan teknik Image loader to check favicon presence on default paths
// Tanpa CORS proxy untuk menjaga privasi pengguna

const FAVICON_SPECS = [
  {
    name: 'favicon.ico',
    path: '/favicon.ico',
    desc: 'Wajib untuk semua browser lama/modern (format multi-resolusi: 16x16, 32x32, 48x48)'
  },
  {
    name: 'favicon-16x16.png',
    path: '/favicon-16x16.png',
    desc: 'PNG resolusi rendah untuk tab browser modern'
  },
  {
    name: 'favicon-32x32.png',
    path: '/favicon-32x32.png',
    desc: 'PNG resolusi menengah untuk layar Retina/HiDPI'
  },
  {
    name: 'favicon-48x48.png',
    path: '/favicon-48x48.png',
    desc: 'PNG resolusi standar untuk pintasan browser desktop'
  },
  {
    name: 'apple-touch-icon.png',
    path: '/apple-touch-icon.png',
    desc: 'Ikon Apple Touch untuk bookmark iOS Safari (180x180)'
  },
  {
    name: 'android-chrome-192x192.png',
    path: '/android-chrome-192x192.png',
    desc: 'Ikon Web App Android / Google Chrome (192x192)'
  },
  {
    name: 'android-chrome-512x512.png',
    path: '/android-chrome-512x512.png',
    desc: 'Ikon splash screen Web App Android (512x512)'
  },
  {
    name: 'site.webmanifest',
    path: '/site.webmanifest',
    desc: 'Manifest web app PWA untuk mendefinisikan ikon (format JSON)',
    isManifest: true
  }
];

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('url-input');
  const btnCheck = document.getElementById('btn-check');
  const resultsSection = document.getElementById('results-section');
  const errorSection = document.getElementById('error-section');
  const errorMessage = document.getElementById('error-message');
  const loadingSection = document.getElementById('loading-section');
  const loadingDomain = document.getElementById('loading-domain');
  
  const resultDomain = document.getElementById('result-domain');
  const scoreBar = document.getElementById('score-bar');
  const scoreText = document.getElementById('score-text');
  const scoreBadge = document.getElementById('score-badge');
  const foundGrid = document.getElementById('found-grid');
  const missingSection = document.getElementById('missing-section');
  const missingList = document.getElementById('missing-list');
  const missingRecommendation = document.getElementById('missing-recommendation');
  const quickAction = document.getElementById('quick-action');

  btnCheck.addEventListener('click', performCheck);
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performCheck();
  });

  async function performCheck() {
    let rawUrl = urlInput.value.trim();
    if (!rawUrl) {
      alert('Silakan masukkan URL website terlebih dahulu.');
      return;
    }

    // Pastikan diawali dengan http/https
    if (!/^https?:\/\//i.test(rawUrl)) {
      rawUrl = 'https://' + rawUrl;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch (e) {
      alert('Format URL tidak valid.');
      return;
    }

    const domainUrl = parsedUrl.origin;
    
    // Tampilkan loading state
    loadingDomain.textContent = parsedUrl.hostname;
    loadingSection.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    errorSection.classList.add('hidden');
    
    let foundCount = 0;
    const checkResults = [];

    // Lakukan pengecekan pararel menggunakan Promises
    const checkPromises = FAVICON_SPECS.map(async (spec) => {
      const targetUrl = domainUrl + spec.path;
      
      if (spec.isManifest) {
        // Untuk manifest, karena tidak bisa dimuat via Image(), kita coba fetch
        // Jika gagal karena CORS, kita anggap "Kemungkinan Ada" atau jika status 200 "Ada"
        try {
          const res = await fetch(targetUrl, { mode: 'no-cors' });
          // no-cors akan menghasilkan response type opaque, tetapi statusnya 0 atau tidak error
          // Jika tidak memicu throw, berarti file webmanifest dapat diakses atau ada
          checkResults.push({ ...spec, found: true, url: targetUrl });
          foundCount++;
        } catch (err) {
          checkResults.push({ ...spec, found: false, url: targetUrl });
        }
      } else {
        // Untuk gambar, gunakan Image loader
        const found = await testImage(targetUrl);
        if (found) {
          foundCount++;
        }
        checkResults.push({ ...spec, found, url: targetUrl });
      }
    });

    await Promise.all(checkPromises);

    // Sembunyikan loading
    loadingSection.classList.add('hidden');
    
    // Tampilkan hasil
    resultDomain.textContent = `Hasil Analisis untuk: ${parsedUrl.hostname}`;
    scoreBar.value = foundCount;
    scoreText.textContent = foundCount;
    
    // Tentukan badge penilaian
    if (foundCount === 8) {
      scoreBadge.textContent = 'Sempurna';
      scoreBadge.className = 'outline contrast';
      scoreBadge.style.backgroundColor = '#10b981';
      scoreBadge.style.color = '#ffffff';
    } else if (foundCount >= 5) {
      scoreBadge.textContent = 'Bagus';
      scoreBadge.className = 'outline';
      scoreBadge.style.backgroundColor = '#3b82f6';
      scoreBadge.style.color = '#ffffff';
    } else if (foundCount >= 2) {
      scoreBadge.textContent = 'Kurang Lengkap';
      scoreBadge.className = 'outline';
      scoreBadge.style.backgroundColor = '#f59e0b';
      scoreBadge.style.color = '#ffffff';
    } else {
      scoreBadge.textContent = 'Sangat Kurang';
      scoreBadge.className = 'outline';
      scoreBadge.style.backgroundColor = '#ef4444';
      scoreBadge.style.color = '#ffffff';
    }

    // Render found grid
    foundGrid.innerHTML = '';
    const missing = [];

    checkResults.forEach(res => {
      if (res.found) {
        const card = document.createElement('article');
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'center';
        card.style.padding = '1rem';
        card.style.textAlign = 'center';
        card.style.marginBottom = '0';
        
        let previewHtml = '';
        if (res.isManifest) {
          previewHtml = `<span style="font-size: 2rem;">📄</span>`;
        } else {
          previewHtml = `<img src="${res.url}" alt="${res.name}" style="max-height: 48px; object-fit: contain; margin-bottom: 0.5rem; background: #f8fafc; padding: 4px; border-radius: 4px; border: 1px dashed var(--pico-border-color);" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22><rect width=%2248%22 height=%2248%22 fill=%22%23e2e8f0%22/><text x=%2250%%22 y=%2255%%22 font-family=%22sans-serif%22 font-size=%2210%22 fill=%22%2364748b%22 text-anchor=%22middle%22>Blocked</text></svg>'"/>`;
        }

        card.innerHTML = `
          ${previewHtml}
          <strong style="font-size: 0.85rem; word-break: break-all;">${res.name}</strong>
          <span style="font-size: 0.75rem; color: #10b981;">✓ Terdeteksi</span>
        `;
        foundGrid.appendChild(card);
      } else {
        missing.push(res);
      }
    });

    if (foundCount === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'secondary';
      emptyMsg.textContent = 'Tidak ada favicon standar yang terdeteksi di root direktori.';
      foundGrid.appendChild(emptyMsg);
    }

    // Render missing list
    missingList.innerHTML = '';
    if (missing.length > 0) {
      missingSection.classList.remove('hidden');
      missing.forEach(res => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${res.name}</strong> — ${res.desc}`;
        missingList.appendChild(li);
      });
      
      missingRecommendation.innerHTML = `
        <strong>Rekomendasi Perbaikan:</strong><br/>
        Buat dan pasang file-file di atas pada root folder website Anda. 
        Anda dapat menggunakan alat <strong>Konverter</strong> untuk merubah logo gambar menjadi paket favicon lengkap 
        atau <strong>Pembuat Logo</strong> untuk mendesain dari awal.
      `;
    } else {
      missingSection.classList.add('hidden');
    }

    quickAction.classList.remove('hidden');
    resultsSection.classList.remove('hidden');
  }

  function testImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      // Tambahkan timestamp untuk menghindari cache jika diperlukan,
      // tetapi untuk URL favicon sebaiknya biarkan cache alami browser
      img.src = url;
    });
  }
});
