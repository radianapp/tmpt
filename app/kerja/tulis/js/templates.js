// app/kerja/tulis/js/templates.js

export const TEMPLATES = {
  blank: {
    name: 'Kosong',
    desc: 'Halaman kosong untuk mulai menulis dari awal.',
    icon: '➕',
    content: {
      ops: [
        { insert: '\n' }
      ]
    }
  },
  letter: {
    name: 'Surat',
    desc: 'Format surat formal/resmi umum.',
    icon: '✉️',
    content: {
      ops: [
        { insert: 'KOP SURAT / NAMA PENGIRIM', attributes: { bold: true } },
        { insert: '\nAlamat Pengirim | Telepon | Email\n' },
        { insert: '────────────────────────────────────────────────────────────────', attributes: { color: '#888888' } },
        { insert: '\n\nTanggal: 2 Juni 2026\n\nKepada Yth.\nNama Penerima\nNama Organisasi/Perusahaan\nAlamat Penerima\n\nHal: Surat Pemberitahuan\n\nDengan hormat,\n\nMelalui surat ini kami ingin menyampaikan informasi mengenai rencana pelaksanaan proyek baru. Detail pengerjaan akan kami koordinasikan lebih lanjut.\n\nDemikian surat pemberitahuan ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.\n\n\nHormat kami,\n\n\n\n( Nama Pengirim )\nJabatan Pengirim\n' }
      ]
    }
  },
  report: {
    name: 'Laporan',
    desc: 'Laporan kerja atau kegiatan terstruktur.',
    icon: '📊',
    content: {
      ops: [
        { insert: 'LAPORAN KEGIATAN TAHUNAN', attributes: { header: 1 } },
        { insert: 'Nama Proyek: Modernisasi Platform TMPT\nTanggal Laporan: Juni 2026\nDipersiapkan Oleh: Tim Pengembang TMPT\n\n' },
        { insert: '1. Latar Belakang', attributes: { header: 2 } },
        { insert: 'Laporan ini disusun untuk memberikan rangkuman menyeluruh mengenai aktivitas pengembangan platform produktivitas yang aman, lokal, dan privat selama satu tahun terakhir.\n\n' },
        { insert: '2. Realisasi Program Kerja', attributes: { header: 2 } },
        { insert: 'Kami telah merilis beberapa aplikasi kerja baru seperti TMPT Slides, TMPT Forms, dan TMPT PDF Tools dengan umpan balik yang sangat baik dari pengguna.\n\n' },
        { insert: '3. Hambatan dan Solusi', attributes: { header: 2 } },
        { insert: 'Hambatan utama adalah keterbatasan penyimpanan data lokal di beberapa jenis browser, yang berhasil kami atasi dengan pemanfaatan IndexedDB dan OPFS secara efisien.\n\n' },
        { insert: '4. Kesimpulan dan Tindak Lanjut', attributes: { header: 2 } },
        { insert: 'Secara umum, semua target telah tercapai 100%. Langkah berikutnya adalah optimalisasi performa editor teks kaya dan penambahan integrasi antar-aplikasi.\n' }
      ]
    }
  },
  proposal: {
    name: 'Proposal',
    desc: 'Proposal proyek atau rencana kegiatan.',
    icon: '💡',
    content: {
      ops: [
        { insert: 'PROPOSAL PENGAJUAN KERJASAMA', attributes: { header: 1 } },
        { insert: 'Judul Proyek: Implementasi TMPT Office Suite\nInstansi/Mitra: PT Solusi Teknologi Digital\nTanggal Pengajuan: 2 Juni 2026\n\n' },
        { insert: 'A. Ringkasan Eksekutif', attributes: { header: 2 } },
        { insert: 'Proposal ini diajukan untuk menawarkan solusi platform produktivitas modern yang mengutamakan privasi dan kedaulatan data pengguna.\n\n' },
        { insert: 'B. Maksud & Tujuan', attributes: { header: 2 } },
        { insert: 'Membangun aplikasi pengolah dokumen berbasis web (TMPT Tulis) yang berjalan sepenuhnya offline dan menyimpan data lokal di sisi klien.\n\n' },
        { insert: 'C. Rencana Anggaran Biaya', attributes: { header: 2 } },
        { insert: 'Rincian anggaran untuk pengembangan awal adalah sebagai berikut:\n' },
        { insert: '•' }, { insert: ' Lisensi dan Perangkat Pengembangan: Rp 0 (Menggunakan FOSS)' }, { insert: '\n' },
        { insert: '•' }, { insert: ' Infrastruktur/Hosting: Rp 0 (GitHub Pages)' }, { insert: '\n' },
        { insert: '•' }, { insert: ' Jasa Integrasi Sistem: Rp 15.000.000' }, { insert: '\n\n' },
        { insert: 'D. Penutup', attributes: { header: 2 } },
        { insert: 'Kami berharap usulan ini dapat diterima dengan baik untuk memulai kerja sama yang saling menguntungkan.\n' }
      ]
    }
  },
  meeting: {
    name: 'Notulen Rapat',
    desc: 'Catatan hasil rapat & tindak lanjut.',
    icon: '📝',
    content: {
      ops: [
        { insert: 'NOTULEN RAPAT MINGGUAN TIM', attributes: { header: 1 } },
        { insert: 'Hari/Tanggal: Selasa, 2 Juni 2026\nWaktu: 10:00 - 11:30 WIB\nLokasi: Ruang Rapat Virtual 1\nPimpinan Rapat: Project Manager\nPeserta Rapat: Tim Pengembang, Tim QA, Tim Product Owner\n\n' },
        { insert: 'Agenda Rapat:', attributes: { bold: true } },
        { insert: '\n1. Evaluasi peluncuran TMPT Slides\n2. Pembahasan PRD TMPT Tulis (Documents)\n3. Pembagian tugas pengembangan fitur\n\n' },
        { insert: 'Keputusan Utama:', attributes: { bold: true } },
        { insert: '\n' },
        { insert: '•' }, { insert: ' PRD TMPT Tulis disetujui untuk diimplementasikan menggunakan Quill.js.' }, { insert: '\n' },
        { insert: '•' }, { insert: ' Target penyelesaian MVP TMPT Tulis ditetapkan pada minggu ini.' }, { insert: '\n\n' },
        { insert: 'Tindak Lanjut & Pembagian Tugas:', attributes: { bold: true } },
        { insert: '\n' },
        { insert: '1.' }, { insert: ' Developer: Membuat inisialisasi IndexedDB dan editor (Deadline: Besok)' }, { insert: '\n' },
        { insert: '2.' }, { insert: ' QA: Mempersiapkan rencana pengujian integrasi (Deadline: Lusa)' }, { insert: '\n' }
      ]
    }
  }
};
