// shared/seo-config.js

export const SEO_CONFIG = {
  // ── Landing Page ────────────────────────────────────────────────────────
  'home': {
    title: 'TMPT — Tempat data kamu, bukan tempat data orang lain',
    desc: 'Platform produktivitas 100% offline: editor dokumen, spreadsheet, presentasi, form, kalender. Data tersimpan di browser Anda, bukan server.',
    canonical: 'https://tmpt.my.id/',
    ogImage: '/assets/og/default-og.png',
    schemas: ['organization', 'website'],
    breadcrumbs: [{ name: 'Beranda', url: '/' }]
  },

  // ── PDF Tools ────────────────────────────────────────────────────────────
  'pdf-tools': {
    title: 'Alat PDF Online Gratis — Merge, Split, Compress | TMPT',
    desc: '14 alat PDF gratis: gabung, pisah, kompres, rotate, proteksi, watermark. Proses di browser, file tidak dikirim ke server manapun.',
    canonical: 'https://tmpt.my.id/app/kerja/pdf/',
    ogImage: '/assets/og/pdf-og.png',
    schemas: ['webapplication-pdf', 'faq-pdf'],
    breadcrumbs: [
      { name: 'Beranda', url: '/' },
      { name: 'TMPT Kerja', url: '/app/kerja/' },
      { name: 'PDF Tools', url: '/app/kerja/pdf/' }
    ],
    // Data tambahan untuk generator skema
    webApplication: {
      name: 'TMPT PDF Tools',
      url: 'https://tmpt.my.id/app/kerja/pdf/',
      description: '14 alat PDF gratis: merge, split, compress, rotate, watermark, proteksi.',
      category: 'UtilityApplication',
      subCategory: 'PDF Editor',
      featureList: 'Merge PDF, Split PDF, Compress PDF, Rotate PDF, Watermark, Protect PDF'
    },
    faqs: [
      {
        question: 'Apakah file PDF saya aman saat menggunakan TMPT PDF Tools?',
        answer: 'Ya, 100% aman. Semua pemrosesan PDF dilakukan langsung di browser Anda menggunakan JavaScript. File PDF tidak pernah dikirim ke server manapun.'
      },
      {
        question: 'Berapa ukuran file PDF maksimum yang bisa diproses?',
        answer: 'TMPT PDF Tools mendukung file hingga 100MB per file. Untuk file lebih besar, disarankan menggunakan aplikasi desktop.'
      },
      {
        question: 'Apakah TMPT PDF Tools gratis?',
        answer: 'Ya, semua 14 tools PDF di TMPT sepenuhnya gratis. Tidak ada batasan jumlah file, tidak butuh akun, tidak ada watermark pada output.'
      }
    ]
  },

  // ── Favicon Tools ────────────────────────────────────────────────────────
  'favicon-home': {
    title: 'Generator Favicon Gratis — PNG, Teks, Emoji ke ICO | TMPT',
    desc: 'Buat favicon dari PNG, teks, atau emoji secara gratis. Output: .ico + semua ukuran PNG + webmanifest. Proses di browser.',
    canonical: 'https://tmpt.my.id/app/tools/favicon/',
    ogImage: '/assets/og/favicon-og.png',
    schemas: ['webapplication-favicon', 'faq-favicon'],
    breadcrumbs: [
      { name: 'Beranda', url: '/' },
      { name: 'TMPT Tools', url: '/app/tools/' },
      { name: 'Favicon Generator', url: '/app/tools/favicon/' }
    ],
    webApplication: {
      name: 'TMPT Favicon Generator',
      url: 'https://tmpt.my.id/app/tools/favicon/',
      description: 'Buat favicon dari PNG, teks, atau emoji secara gratis di browser Anda.',
      category: 'UtilityApplication',
      subCategory: 'Favicon Generator',
      featureList: 'PNG to ICO, Text to Favicon, Emoji to Favicon'
    },
    faqs: [
      {
        question: 'Bagaimana cara membuat favicon secara aman?',
        answer: 'Dengan TMPT Favicon Generator, semua konversi gambar ke ICO diproses 100% lokal di browser Anda. Tidak ada data yang diunggah ke internet.'
      },
      {
        question: 'Apakah format .ico mendukung multi-ukuran?',
        answer: 'Ya, file favicon.ico hasil TMPT menggabungkan resolusi 16x16 dan 32x32 dalam satu file tunggal secara otomatis.'
      }
    ]
  },

  // ── Halaman App (noindex) ────────────────────────────────────────────────
  'tulis-editor': {
    title: 'Editor Tulis — TMPT',
    desc: 'Editor dokumen teks offline-first di ekosistem TMPT.',
    noindex: true,
    schemas: []
  },
  
  'code-dashboard': {
    title: 'TMPT Code — Editor Kode & IDE Offline-First Gratis',
    desc: 'IDE dan Code Editor client-side & local-first. Hubungkan dengan folder lokal (FSAA) atau repositori GitHub dengan aman.',
    canonical: 'https://tmpt.my.id/app/dev/code/',
    ogImage: '/assets/og/default-og.png',
    schemas: ['website'],
    breadcrumbs: [
      { name: 'Beranda', url: '/' },
      { name: 'TMPT Dev', url: '/app/dev/' },
      { name: 'TMPT Code', url: '/app/dev/code/' }
    ]
  },
  
  'code-editor': {
    title: 'Editor Kode TMPT Code — TMPT',
    desc: 'Editor kode offline-first di ekosistem TMPT.',
    noindex: true,
    schemas: []
  }
};
