/* app/tools/kalkulator/js/kalkulator-core.js */

export const CALCULATORS = [
  // Tier 1 — Mass Market (Math)
  { slug: 'standard', name: 'Kalkulator Standar', desc: 'Kalkulator dasar Windows dengan memori, persen, kuadrat, dan akar.', category: 'math', icon: '🧮', tier: 1 },
  { slug: 'scientific', name: 'Kalkulator Ilmiah', desc: 'Kalkulator sains dengan fungsi trigonometri, logaritma, dan riwayat.', category: 'math', icon: '🧪', tier: 1 },
  { slug: 'percentage', name: 'Kalkulator Persentase', desc: 'Hitung persentase, perubahan persen, dan porsi nilai dengan cepat.', category: 'math', icon: '📈', tier: 1 },
  { slug: 'statistics', name: 'Kalkulator Statistika Dasar', desc: 'Hitung Mean, Median, Standar Deviasi, Varians, dan Kuartil.', category: 'math', icon: '📊', tier: 1 },
  // Tier 1 — Mass Market (Date)
  { slug: 'age', name: 'Kalkulator Usia', desc: 'Ketahui usia Anda dalam tahun, bulan, hari, serta hari lahir Anda.', category: 'date', icon: '📅', tier: 1 },
  { slug: 'date-difference', name: 'Selisih Tanggal', desc: 'Hitung jumlah hari, minggu, atau bulan di antara dua tanggal.', category: 'date', icon: '⏳', tier: 1 },
  { slug: 'countdown', name: 'Penghitung Waktu Mundur', desc: 'Timer mundur untuk acara penting dengan tautan yang bisa dibagikan.', category: 'date', icon: '⏰', tier: 1 },
  // Tier 1 — Mass Market (Finance)
  { slug: 'loan', name: 'Kalkulator Pinjaman (EMI)', desc: 'Hitung cicilan bulanan, bunga total, dan tabel amortisasi pinjaman.', category: 'finance', icon: '💵', tier: 1 },
  { slug: 'compound-interest', name: 'Bunga Majemuk', desc: 'Simulasikan pertumbuhan investasi Anda dengan bunga berbunga.', category: 'finance', icon: '💰', tier: 1 },
  { slug: 'roi', name: 'Kalkulator ROI', desc: 'Hitung Return on Investment (ROI) investasi nominal Anda.', category: 'finance', icon: '📈', tier: 1 },
  { slug: 'tax', name: 'Kalkulator Pajak (PPh 21)', desc: 'Hitung estimasi pajak penghasilan karyawan PPh 21 Indonesia terbaru.', category: 'finance', icon: '🏢', tier: 1 },
  // Tier 1 — Mass Market (Health)
  { slug: 'bmi', name: 'Kalkulator BMI', desc: 'Hitung Body Mass Index (Indeks Massa Tubuh) dan berat badan ideal Anda.', category: 'health', icon: '⚖️', tier: 1 },
  { slug: 'bmr-calorie', name: 'Kalkulator BMR & Kalori', desc: 'Hitung kebutuhan kalori harian berdasarkan tingkat aktivitas.', category: 'health', icon: '🔥', tier: 1 },
  { slug: 'converter', name: 'Konverter Satuan & Kurs', desc: 'Konversi mata uang global, volume, panjang, berat, suhu, dan kecepatan bawaan Windows.', category: 'utility', icon: '🔄', tier: 1 },
  // Tier 3 — Developer Tools
  { slug: 'programmer', name: 'Kalkulator Programmer', desc: 'Kalkulator pemrograman dengan konversi HEX, DEC, OCT, BIN, dan operasi bitwise.', category: 'dev', icon: '💻', tier: 3 },
  // Tier 3 — Developer Tools
  { slug: 'json-formatter', name: 'JSON Formatter & Validator', desc: 'Rapi, validasikan, dan percantik format JSON Anda.', category: 'dev', icon: '⚙️', tier: 3 },
  { slug: 'json-minifier', name: 'JSON Minifier', desc: 'Kompres JSON menjadi satu baris tanpa whitespace.', category: 'dev', icon: '🗜️', tier: 3 },
  { slug: 'base64', name: 'Base64 Encoder/Decoder', desc: 'Ubah teks atau file dari dan ke format Base64 secara instan.', category: 'dev', icon: '🔑', tier: 3 },
  { slug: 'url-encode', name: 'URL Encoder/Decoder', desc: 'Encode dan decode parameter URL atau kueri dengan aman.', category: 'dev', icon: '🔗', tier: 3 },
  { slug: 'hash-generator', name: 'Hash Generator', desc: 'Generate checksum MD5, SHA-1, SHA-256, SHA-512 dari teks atau berkas.', category: 'dev', icon: '🔒', tier: 3 },
  { slug: 'unix-timestamp', name: 'Unix Timestamp Converter', desc: 'Konversi Unix Epoch time ke tanggal manusia dan sebaliknya.', category: 'dev', icon: '⏱️', tier: 3 },
  { slug: 'uuid', name: 'UUID/NanoID Generator', desc: 'Generate UUID v4, v7, dan NanoID unik secara massal.', category: 'dev', icon: '🆔', tier: 3 },
  { slug: 'cron', name: 'Cron Expression Calculator', desc: 'Terjemahkan cron syntax ke bahasa manusia dan build ekspresi visual.', category: 'dev', icon: '📅', tier: 3 },
  { slug: 'regex', name: 'Regex Tester', desc: 'Uji pattern ekspresi reguler (Regex) Anda secara real-time.', category: 'dev', icon: '🔍', tier: 3 },
  // Tier 2 — Professional Statistics
  { slug: 'sample-size', name: 'Kalkulator Ukuran Sampel', desc: 'Tentukan jumlah sampel minimum untuk survei atau penelitian.', category: 'stats', icon: '📐', tier: 2 },
  { slug: 'margin-of-error', name: 'Kalkulator Margin of Error', desc: 'Hitung batas kesalahan dari ukuran sampel dan tingkat kepercayaan.', category: 'stats', icon: '🎯', tier: 2 },
  { slug: 'confidence-interval', name: 'Confidence Interval', desc: 'Estimasi rentang nilai kepercayaan dari mean sampel Anda.', category: 'stats', icon: '📊', tier: 2 },
  { slug: 'ab-test', name: 'Kalkulator Uji A/B', desc: 'Uji signifikansi statistik konversi varian A vs B.', category: 'stats', icon: '⚖️', tier: 2 },
  { slug: 'conversion-rate', name: 'Kalkulator Tingkat Konversi', desc: 'Hitung persentase konversi dari total pengunjung/impresi.', category: 'stats', icon: '📈', tier: 2 },
  // Tier 4 — AI Era Tools
  { slug: 'openai-cost', name: 'LLM Cost Calculator', desc: 'Estimasi biaya API LLM (GPT-4o, Claude, Gemini, dll) per request.', category: 'ai', icon: '🤖', tier: 4 },
  { slug: 'llm-comparator', name: 'Multi-Provider LLM Comparator', desc: 'Bandingkan efisiensi biaya antar provider LLM.', category: 'ai', icon: '⚖️', tier: 4 },
  { slug: 'token-counter', name: 'Kalkulator Token', desc: 'Hitung jumlah token teks Anda berdasarkan Tiktoken.', category: 'ai', icon: '🪙', tier: 4 }
];

export const CATEGORY_NAMES = {
  math: 'Matematika & Angka',
  date: 'Waktu & Kalender',
  finance: 'Keuangan & Finansial',
  health: 'Kesehatan & BMI',
  utility: 'Utilitas & Konversi',
  dev: 'Developer Tools',
  stats: 'Statistika & Analisis',
  ai: 'Kecerdasan Buatan (AI Era)'
};

// --- LocalStorage Helpers ---
export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('tmpt_calc_history') || '[]');
  } catch (e) {
    return [];
  }
}

export function saveHistoryEntry(slug, calcName, inputs, results) {
  let history = getHistory();
  const entry = {
    id: Date.now().toString(),
    slug,
    calcName,
    inputs,
    results,
    timestamp: new Date().toISOString()
  };
  history.unshift(entry);
  if (history.length > 100) history = history.slice(0, 100);
  localStorage.setItem('tmpt_calc_history', JSON.stringify(history));
}

export function getBookmarks() {
  try {
    return JSON.parse(localStorage.getItem('tmpt_calc_bookmarks') || '[]');
  } catch (e) {
    return [];
  }
}

export function toggleBookmark(slug) {
  let bookmarks = getBookmarks();
  const index = bookmarks.indexOf(slug);
  if (index === -1) {
    bookmarks.push(slug);
  } else {
    bookmarks.splice(index, 1);
  }
  localStorage.setItem('tmpt_calc_bookmarks', JSON.stringify(bookmarks));
  return bookmarks.includes(slug);
}

// --- Query Parameter populate ---
export function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const params = {};
  for (const [key, value] of urlParams.entries()) {
    params[key] = value;
  }
  return params;
}

export function setUrlParams(params) {
  const url = new URL(window.location.href);
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      url.searchParams.set(key, params[key]);
    } else {
      url.searchParams.delete(key);
    }
  });
  window.history.replaceState({}, '', url.toString());
}

// Expose toast helper globally if not already present
if (!window.toast) {
  window.toast = function(message, type = 'info') {
    if (window.TMPT_UI && typeof window.TMPT_UI.toast === 'function') {
      window.TMPT_UI.toast(message, type);
    } else {
      let container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
      }
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  };
}

export function copyShareUrl(params) {
  const url = new URL(window.location.href);
  Object.keys(params).forEach(key => {
    url.searchParams.set(key, params[key]);
  });
  navigator.clipboard.writeText(url.toString()).then(() => {
    window.toast('Tautan berhasil disalin ke papan klip!', 'success');
  });
}

// --- Render Layout components ---
export function initSharedLayout(pageKey) {
  // Load Header and Footer via HTMX dynamic swaps or programmatic injection if HTMX fails
  // But wait, the standard tmpt project has:
  // <div id="header-container" hx-get="/shared/header.html" hx-trigger="load" hx-swap="outerHTML"></div>
  // which works with HTMX!
  
  // Custom SEO dynamic injection
  document.addEventListener('DOMContentLoaded', () => {
    // Inject custom CSS if needed
    // And add search listener
    setupGlobalSearch();
  });
}

function setupGlobalSearch() {
  // Create search keyboard listener Ctrl+K or /
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.key === 'k') || e.key === '/') {
      const searchInput = document.querySelector('.calc-search-input');
      if (searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
    }
  });
}
