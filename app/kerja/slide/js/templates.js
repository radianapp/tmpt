// app/kerja/slide/js/templates.js

export const TEMPLATES = {
  blank: {
    title: 'Presentasi Kosong',
    theme_id: 'blank',
    slides: [
      {
        id: 'slide-1',
        background: { type: 'color', color: '#ffffff' },
        transition: { type: 'none', duration: 300 },
        notes: '',
        elements: [
          {
            id: 'el-title',
            type: 'text',
            x: 80,
            y: 200,
            width: 800,
            height: 100,
            rotation: 0,
            zIndex: 1,
            opacity: 1,
            content: 'Klik untuk Mengubah Judul',
            fontFamily: 'Arial, sans-serif',
            fontSize: 48,
            fontWeight: 'bold',
            color: '#333333',
            textAlign: 'center',
            backgroundColor: 'transparent'
          }
        ]
      }
    ]
  },
  minimalist: {
    title: 'Presentasi Minimalis',
    theme_id: 'minimalist',
    slides: [
      {
        id: 'slide-m1',
        background: { type: 'color', color: '#f9f9f9' },
        transition: { type: 'fade', duration: 300 },
        notes: 'Cover slide',
        elements: [
          {
            id: 'el-m1-t1',
            type: 'text',
            x: 80,
            y: 180,
            width: 800,
            height: 100,
            rotation: 0,
            zIndex: 1,
            opacity: 1,
            content: 'IDE & GAYA MINIMALIS',
            fontFamily: 'Helvetica, sans-serif',
            fontSize: 44,
            fontWeight: 'bold',
            color: '#111111',
            textAlign: 'left',
            backgroundColor: 'transparent'
          },
          {
            id: 'el-m1-t2',
            type: 'text',
            x: 80,
            y: 300,
            width: 800,
            height: 60,
            rotation: 0,
            zIndex: 2,
            opacity: 0.7,
            content: 'Bagaimana kesederhanaan menyampaikan lebih banyak makna',
            fontFamily: 'Helvetica, sans-serif',
            fontSize: 20,
            fontWeight: 'normal',
            color: '#555555',
            textAlign: 'left',
            backgroundColor: 'transparent'
          }
        ]
      },
      {
        id: 'slide-m2',
        background: { type: 'color', color: '#ffffff' },
        transition: { type: 'fade', duration: 300 },
        notes: 'Agenda',
        elements: [
          {
            id: 'el-m2-t1',
            type: 'text',
            x: 80,
            y: 60,
            width: 800,
            height: 60,
            rotation: 0,
            zIndex: 1,
            opacity: 1,
            content: 'Agenda Pembahasan',
            fontFamily: 'Helvetica, sans-serif',
            fontSize: 32,
            fontWeight: 'bold',
            color: '#111111',
            textAlign: 'left',
            backgroundColor: 'transparent'
          },
          {
            id: 'el-m2-t2',
            type: 'text',
            x: 80,
            y: 160,
            width: 800,
            height: 300,
            rotation: 0,
            zIndex: 2,
            opacity: 1,
            content: '1. Pengantar Minimalisme\n2. Penerapan Praktis Sehari-hari\n3. Studi Kasus Keberhasilan Desain\n4. Kesimpulan & Sesi Tanya Jawab',
            fontFamily: 'Helvetica, sans-serif',
            fontSize: 22,
            fontWeight: 'normal',
            color: '#333333',
            textAlign: 'left',
            lineHeight: 2.0,
            backgroundColor: 'transparent'
          }
        ]
      }
    ]
  },
  corporate: {
    title: 'Presentasi Korporat',
    theme_id: 'corporate',
    slides: [
      {
        id: 'slide-c1',
        background: { type: 'color', color: '#0f172a' },
        transition: { type: 'fade', duration: 300 },
        notes: 'Selamat datang di laporan bisnis korporasi',
        elements: [
          {
            id: 'el-c1-t1',
            type: 'text',
            x: 80,
            y: 180,
            width: 800,
            height: 120,
            rotation: 0,
            zIndex: 1,
            opacity: 1,
            content: 'Laporan Perkembangan Bisnis Tahunan',
            fontFamily: 'Georgia, serif',
            fontSize: 40,
            fontWeight: 'bold',
            color: '#ffffff',
            textAlign: 'center',
            backgroundColor: 'transparent'
          },
          {
            id: 'el-c1-s1',
            type: 'shape',
            shapeType: 'rectangle',
            x: 380,
            y: 330,
            width: 200,
            height: 6,
            rotation: 0,
            zIndex: 2,
            opacity: 1,
            fill: '#3b82f6',
            stroke: { color: 'transparent', width: 0 }
          }
        ]
      }
    ]
  },
  education: {
    title: 'Presentasi Edukasi',
    theme_id: 'education',
    slides: [
      {
        id: 'slide-e1',
        background: { type: 'color', color: '#eff6ff' },
        transition: { type: 'zoom', duration: 300 },
        notes: 'Judul Pelajaran',
        elements: [
          {
            id: 'el-e1-t1',
            type: 'text',
            x: 80,
            y: 180,
            width: 800,
            height: 120,
            rotation: 0,
            zIndex: 1,
            opacity: 1,
            content: 'Mengenal Tata Surya Kita 🪐',
            fontFamily: 'Comic Sans MS, cursive',
            fontSize: 44,
            fontWeight: 'bold',
            color: '#1e3a8a',
            textAlign: 'center',
            backgroundColor: 'transparent'
          }
        ]
      }
    ]
  },
  pitch: {
    title: 'Pitch Deck Startup',
    theme_id: 'pitch',
    slides: [
      {
        id: 'slide-p1',
        background: { type: 'color', color: '#090d16' },
        transition: { type: 'slide-left', duration: 300 },
        notes: 'Slide pitch pertama',
        elements: [
          {
            id: 'el-p1-t1',
            type: 'text',
            x: 80,
            y: 180,
            width: 800,
            height: 100,
            rotation: 0,
            zIndex: 1,
            opacity: 1,
            content: 'TMPT: Masa Depan Produktivitas Privat',
            fontFamily: 'Verdana, sans-serif',
            fontSize: 38,
            fontWeight: 'bold',
            color: '#f8fafc',
            textAlign: 'left',
            backgroundColor: 'transparent'
          },
          {
            id: 'el-p1-t2',
            type: 'text',
            x: 80,
            y: 290,
            width: 800,
            height: 60,
            rotation: 0,
            zIndex: 2,
            opacity: 0.8,
            content: 'Zero Server, 100% Offline, Zero Cloud Exposure.',
            fontFamily: 'Verdana, sans-serif',
            fontSize: 20,
            fontWeight: 'normal',
            color: '#38bdf8',
            textAlign: 'left',
            backgroundColor: 'transparent'
          }
        ]
      }
    ]
  },
  report: {
    title: 'Laporan Proyek',
    theme_id: 'report',
    slides: [
      {
        id: 'slide-r1',
        background: { type: 'color', color: '#f1f5f9' },
        transition: { type: 'fade', duration: 300 },
        notes: 'Laporan ringkasan proyek',
        elements: [
          {
            id: 'el-r1-t1',
            type: 'text',
            x: 80,
            y: 160,
            width: 800,
            height: 80,
            rotation: 0,
            zIndex: 1,
            opacity: 1,
            content: 'Laporan Proyek Akhir Kuartal',
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: 36,
            fontWeight: 'bold',
            color: '#334155',
            textAlign: 'center',
            backgroundColor: 'transparent'
          }
        ]
      }
    ]
  }
};
