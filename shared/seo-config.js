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

  'project-dashboard': {
    title: 'TMPT Project — Manajemen Proyek Kolaboratif &amp; Agile Tim Offline',
    desc: 'Platform manajemen proyek, Scrum/Kanban board, WBS, Wiki, dan pelacakan waktu kerja (Time Tracking) local-first dan privat.',
    canonical: 'https://tmpt.my.id/app/kerja/project/',
    ogImage: '/assets/og/default-og.png',
    schemas: ['website'],
    breadcrumbs: [
      { name: 'Beranda', url: '/' },
      { name: 'TMPT Kerja', url: '/app/kerja/' },
      { name: 'TMPT Project', url: '/app/kerja/project/' }
    ]
  },

  'tulis-dashboard': {
    title: 'TMPT Tulis — Pembuat Dokumen Offline & Privat',
    desc: 'Tulis dan sunting dokumen secara lokal dan privat. Data Anda tidak pernah dikirim ke server. Bebas dari gangguan iklan dan pelacakan.',
    canonical: 'https://tmpt.my.id/app/kerja/tulis/',
    ogImage: '/assets/og/default-og.png',
    schemas: ['website'],
    breadcrumbs: [
      { name: 'Beranda', url: '/' },
      { name: 'TMPT Kerja', url: '/app/kerja/' },
      { name: 'TMPT Tulis', url: '/app/kerja/tulis/' }
    ]
  },

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
  },
  'markdown-editor': {
    title: 'TMPT Markdown — Editor Markdown Teknis & Offline',
    desc: 'Editor Markdown offline-first dengan live preview, KaTeX, Mermaid, dan penyimpanan lokal yang aman.',
    canonical: 'https://tmpt.my.id/app/dev/markdown/',
    ogImage: '/assets/og/default-og.png',
    schemas: ['website'],
    breadcrumbs: [
      { name: 'Beranda', url: '/' },
      { name: 'TMPT Dev', url: '/app/dev/' },
      { name: 'TMPT Markdown', url: '/app/dev/markdown/' }
    ]
  },
  'forms-dashboard': {
    title: 'TMPT Forms — Pembuat Formulir Mandiri & Privat',
    desc: 'Buat formulir survei, pendaftaran, dan kuesioner dengan aman secara lokal. Data dan respons tersimpan sepenuhnya di browser Anda.',
    canonical: 'https://tmpt.my.id/app/kerja/forms/',
    ogImage: '/assets/og/default-og.png',
    schemas: ['website'],
    breadcrumbs: [
      { name: 'Beranda', url: '/' },
      { name: 'TMPT Kerja', url: '/app/kerja/' },
      { name: 'TMPT Forms', url: '/app/kerja/forms/' }
    ]
  },
  'forms-builder': {
    title: 'Editor TMPT Forms — TMPT',
    desc: 'Editor pembuat formulir offline-first di ekosistem TMPT.',
    noindex: true,
    schemas: []
  },
  'forms-respond': {
    title: 'Formulir — TMPT',
    desc: 'Halaman pengisian formulir di ekosistem TMPT.',
    noindex: true,
    schemas: []
  },
  'forms-responses': {
    title: 'Tanggapan Formulir — TMPT',
    desc: 'Halaman analisis tanggapan formulir di ekosistem TMPT.',
    noindex: true,
    schemas: []
  },
  'slides-dashboard': {
    title: 'TMPT Slides — Pembuat Presentasi Offline & Privat',
    desc: 'Buat, edit, dan tampilkan presentasi slide secara lokal dan privat. Data Anda tidak pernah dikirim ke server.',
    canonical: 'https://tmpt.my.id/app/kerja/slide/',
    ogImage: '/assets/og/default-og.png',
    schemas: ['website'],
    breadcrumbs: [
      { name: 'Beranda', url: '/' },
      { name: 'TMPT Kerja', url: '/app/kerja/' },
      { name: 'TMPT Slides', url: '/app/kerja/slide/' }
    ]
  },
  'slides-editor': {
    title: 'Editor TMPT Slides — TMPT',
    desc: 'Editor presentasi offline-first di ekosistem TMPT.',
    noindex: true,
    schemas: []
  },
  'slides-present': {
    title: 'Presentasi — TMPT',
    desc: 'Mode Presentasi offline-first di ekosistem TMPT.',
    noindex: true,
    schemas: []
  },
  'diagram-dashboard': {
    title: 'TMPT Diagram — Visualisasikan Arsitektur & Database',
    desc: 'Platform visual diagram arsitektur sistem, flowchart, ER diagram, dan diagram as code (Mermaid) yang offline-first dan privat.',
    canonical: 'https://tmpt.my.id/app/dev/diagram/',
    ogImage: '/assets/og/default-og.png',
    schemas: ['website'],
    breadcrumbs: [
      { name: 'Beranda', url: '/' },
      { name: 'TMPT Dev', url: '/app/dev/' },
      { name: 'TMPT Diagram', url: '/app/dev/diagram/' }
    ]
  },
  'diagram-editor': {
    title: 'Editor TMPT Diagram — TMPT',
    desc: 'Editor diagram offline-first (Draw, Code, Data, Arch) di ekosistem TMPT.',
    noindex: true,
    schemas: []
  },
  'json-studio': {
    title: 'TMPT JSON — Visual Data Studio & Offline REST Client',
    desc: 'Visual Data Studio all-in-one untuk JSON, YAML, XML, CSV, TOML, dan SQL dengan REST API Tester, validasi schema, dan PII security scan offline.',
    canonical: 'https://tmpt.my.id/app/dev/json/',
    ogImage: '/assets/og/default-og.png',
    schemas: ['website'],
    breadcrumbs: [
      { name: 'Beranda', url: '/' },
      { name: 'TMPT Dev', url: '/app/dev/' },
      { name: 'TMPT JSON', url: '/app/dev/json/' }
    ]
  },
  'regex-studio': {
    title: 'TMPT Regex — Regex Studio & ReDoS Security Scanner Offline',
    desc: 'Regex Studio & Tester offline-first lengkap dengan Visual Graph (flowchart), ReDoS Security Scanner, Unit Test Runner, Benchmark, dan Code Generator.',
    canonical: 'https://tmpt.my.id/app/dev/regex/',
    ogImage: '/assets/og/default-og.png',
    schemas: ['website'],
    breadcrumbs: [
      { name: 'Beranda', url: '/' },
      { name: 'TMPT Dev', url: '/app/dev/' },
      { name: 'TMPT Regex', url: '/app/dev/regex/' }
    ]
  },
  'kalkulator-home': {
    title: 'Kalkulator Online Lengkap & Cepat — Finansial, Sains, Developer | TMPT',
    desc: 'Platform kalkulator online gratis terpadu. Hitung pinjaman, bunga, pajak, BMI, statistik, token LLM, formatter JSON, regex, dan UUID offline-first.',
    canonical: 'https://tmpt.my.id/app/tools/kalkulator/',
    ogImage: '/assets/og/default-og.png',
    schemas: ['webapplication-kalkulator', 'faq-kalkulator'],
    breadcrumbs: [
      { name: 'Beranda', url: '/' },
      { name: 'TMPT Tools', url: '/app/tools/' },
      { name: 'Kalkulator', url: '/app/tools/kalkulator/' }
    ],
    webApplication: {
      name: 'TMPT Kalkulator',
      url: 'https://tmpt.my.id/app/tools/kalkulator/',
      description: 'Platform kalkulator offline-first terintegrasi untuk pengguna umum, profesional, developer, dan AI practitioner.',
      category: 'UtilityApplication',
      subCategory: 'Calculator Platform',
      featureList: 'Loan Calculator, BMI, JSON Formatter, LLM Cost, Base64, Cron Calculator, UUID Generator'
    },
    faqs: [
      {
        question: 'Apakah kalkulator di TMPT berjalan offline?',
        answer: 'Ya, seluruh kalkulasi dilakukan secara client-side di browser Anda. Tidak ada data input atau hasil yang dikirim ke server.'
      },
      {
        question: 'Bagaimana cara membagikan hasil kalkulasi?',
        answer: 'Setiap kalkulator menyediakan tombol "Salin Tautan" yang mengemas seluruh input Anda ke dalam parameter URL sehingga bisa dibuka langsung oleh orang lain.'
      }
    ]
  },
  'tools-pomodoro': {
    title: 'TMPT Pomodoro — Focus Timer & Productivity Tracker Offline',
    desc: 'Tingkatkan produktivitas Anda menggunakan teknik Pomodoro secara 100% offline dan privat. Terintegrasi dengan TMPT Tugas dan TMPT Kalender.',
    canonical: 'https://tmpt.my.id/app/tools/pomodoro/',
    ogImage: '/assets/og/default-og.png',
    schemas: ['website'],
    breadcrumbs: [
      { name: 'Beranda', url: '/' },
      { name: 'TMPT Tools', url: '/app/tools/' },
      { name: 'Pomodoro', url: '/app/tools/pomodoro/' }
    ]
  },
  'tools-qr': {
    title: 'TMPT QR — Generator &amp; Scanner QR Code Offline &amp; Kustom Logo',
    desc: 'Buat dan pindai (scan) QR Code 100% offline dan privat. Kustomisasi desain dengan warna, gradasi, logo tengah, dan bingkai CTA secara gratis.',
    canonical: 'https://tmpt.my.id/app/tools/qr/',
    ogImage: '/assets/og/default-og.png',
    schemas: ['website'],
    breadcrumbs: [
      { name: 'Beranda', url: '/' },
      { name: 'TMPT Tools', url: '/app/tools/' },
      { name: 'QR Tools', url: '/app/tools/qr/' }
    ]
  },
  'tools-base64': {
    title: 'Base64 Encoder & Decoder Online — TMPT Tools',
    desc: 'Encode dan decode Base64 gratis dan 100% private. 29 tools: teks, gambar, audio, video, PDF, HEX, Basic Auth, gzip check, validate, repair, dan lebih. Semua berjalan di browser — data tidak pernah dikirim ke server.',
    canonical: 'https://tmpt.my.id/app/tools/base64/',
    ogImage: '/assets/og/default-og.png',
    schemas: ['website'],
    breadcrumbs: [
      { name: 'Beranda', url: '/' },
      { name: 'TMPT Tools', url: '/app/tools/' },
      { name: 'Base64 Tools', url: '/app/tools/base64/' }
    ]
  }
};
