/**
 * HITUNG — Spreadsheet Templates Module
 * Bahasa Indonesia: Modul Templat Bawaan HITUNG
 * 
 * Menyediakan 6 templat spreadsheet bawaan siap pakai (keuangan pribadi, bisnis, produktivitas)
 * lengkap dengan data, styling dasar, dan formula otomatis terpasang.
 */

const HitungTemplates = {
    getTemplatesList() {
        return [
            { id: 'monthly_budget', name: '📊 Budget Bulanan', desc: 'Rencanakan pengeluaran bulanan dan pantau selisih aktualnya.' },
            { id: 'invoice', name: '🧾 Pembuat Faktur (Invoice)', desc: 'Buat tagihan profesional lengkap dengan kuantitas, harga, pajak, dan diskon.' },
            { id: 'expense_tracker', name: '💸 Pelacak Pengeluaran', desc: 'Catat pengeluaran harian dan hitung total per kategori secara otomatis.' },
            { id: 'household_finance', name: '🏠 Keuangan Rumah Tangga', desc: 'Pantau arus kas pendapatan, pengeluaran, dan tabungan keluarga.' },
            { id: 'project_tracker', name: '📅 Pemantau Proyek (Gantt Mini)', desc: 'Kelola jadwal tugas, progress pengerjaan, dan status target proyek.' },
            { id: 'habit_tracker', name: '🎯 Pelacak Kebiasaan Mingguan', desc: 'Disiplinkan rutinitas harian dengan melacak pencapaian setiap minggu.' }
        ];
    },

    getTemplateData(templateId) {
        const timestamp = new Date().toISOString();
        const baseFile = {
            format: "hitung-v1",
            created_at: timestamp,
            modified_at: timestamp,
            app_version: "1.0.0",
            settings: {
                locale: "id-ID",
                currency: "IDR",
                date_format: "DD/MM/YYYY"
            }
        };

        switch (templateId) {
            case 'monthly_budget':
                return {
                    ...baseFile,
                    metadata: { title: "Budget Bulanan Mei" },
                    sheets: [{
                        id: "sheet_1", name: "Budget Bulanan", rows: 100, cols: 26,
                        merges: ["A1:D1"],
                        cells: {
                            // Judul Template
                            "A1": { value: "BUDGET BULANAN MEI", type: "text", style: { font: { bold: true, size: 16, color: "#ffffff" }, background: "#0F6E56", align: "center" } },
                            "B1": { value: "", type: "text", style: { background: "#0F6E56" } },
                            "C1": { value: "", type: "text", style: { background: "#0F6E56" } },
                            "D1": { value: "", type: "text", style: { background: "#0F6E56" } },
                            
                            // Header kolom
                            "A3": { value: "Kategori Pengeluaran", type: "text", style: { font: { bold: true }, background: "#e8f5e9" } },
                            "B3": { value: "Anggaran (Rencana)", type: "text", style: { font: { bold: true }, background: "#e8f5e9", align: "right" } },
                            "C3": { value: "Aktual (Realisasi)", type: "text", style: { font: { bold: true }, background: "#e8f5e9", align: "right" } },
                            "D3": { value: "Selisih (Rencana - Aktual)", type: "text", style: { font: { bold: true }, background: "#e8f5e9", align: "right" } },

                            // Data Baris 1: Makanan
                            "A4": { value: "Makanan & Groseri", type: "text" },
                            "B4": { value: 1500000, type: "number" },
                            "C4": { value: 1420000, type: "number" },
                            "D4": { formula: "=B4-C4", type: "formula", style: { font: { bold: true } } },

                            // Data Baris 2: Transportasi
                            "A5": { value: "Bensin & Transportasi", type: "text" },
                            "B5": { value: 500000, type: "number" },
                            "C5": { value: 550000, type: "number" },
                            "D5": { formula: "=B5-C5", type: "formula", style: { font: { bold: true } } },

                            // Data Baris 3: Utilitas
                            "A6": { value: "Listrik, Air, & Internet", type: "text" },
                            "B6": { value: 800000, type: "number" },
                            "C6": { value: 780000, type: "number" },
                            "D6": { formula: "=B6-C6", type: "formula", style: { font: { bold: true } } },

                            // Data Baris 4: Hiburan
                            "A7": { value: "Hiburan & Rekreasi", type: "text" },
                            "B7": { value: 400000, type: "number" },
                            "C7": { value: 420000, type: "number" },
                            "D7": { formula: "=B7-C7", type: "formula", style: { font: { bold: true } } },

                            // Data Baris 5: Lain-lain
                            "A8": { value: "Kebutuhan Darurat/Lainnya", type: "text" },
                            "B8": { value: 300000, type: "number" },
                            "C8": { value: 150000, type: "number" },
                            "D8": { formula: "=B8-C8", type: "formula", style: { font: { bold: true } } },

                            // Total Rekapitulasi
                            "A10": { value: "TOTAL", type: "text", style: { font: { bold: true }, background: "#f5f5f5" } },
                            "B10": { formula: "=SUM(B4:B8)", type: "formula", style: { font: { bold: true }, background: "#f5f5f5" } },
                            "C10": { formula: "=SUM(C4:C8)", type: "formula", style: { font: { bold: true }, background: "#f5f5f5" } },
                            "D10": { formula: "=SUM(D4:D8)", type: "formula", style: { font: { bold: true }, background: "#f5f5f5" } }
                        }
                    }]
                };

            case 'invoice':
                return {
                    ...baseFile,
                    metadata: { title: "Invoice Faktur Baru" },
                    sheets: [{
                        id: "sheet_1", name: "Faktur Penjualan", rows: 100, cols: 26,
                        merges: ["A1:E1"],
                        cells: {
                            // Judul & Keterangan
                            "A1": { value: "FAKTUR / INVOICE", type: "text", style: { font: { bold: true, size: 16, color: "#ffffff" }, background: "#1e3a8a" } },
                            "B1": { value: "", type: "text", style: { background: "#1e3a8a" } },
                            "C1": { value: "", type: "text", style: { background: "#1e3a8a" } },
                            "D1": { value: "", type: "text", style: { background: "#1e3a8a" } },
                            "E1": { value: "", type: "text", style: { background: "#1e3a8a" } },
                            
                            "A2": { value: "Nomor Invoice:", type: "text", style: { font: { bold: true } } },
                            "B2": { value: "INV-2026-001", type: "text" },
                            "D2": { value: "Tanggal:", type: "text", style: { font: { bold: true } } },
                            "E2": { value: "26/05/2026", type: "text" },

                            // Header tabel item
                            "A4": { value: "Deskripsi Barang / Jasa", type: "text", style: { font: { bold: true }, background: "#f3f4f6" } },
                            "B4": { value: "Qty", type: "text", style: { font: { bold: true }, background: "#f3f4f6", align: "center" } },
                            "C4": { value: "Harga Satuan", type: "text", style: { font: { bold: true }, background: "#f3f4f6", align: "right" } },
                            "D4": { value: "Total Kotor", type: "text", style: { font: { bold: true }, background: "#f3f4f6", align: "right" } },

                            // Item 1
                            "A5": { value: "Jasa Pembuatan Desain Web Premium", type: "text" },
                            "B5": { value: 1, type: "number" },
                            "C5": { value: 3500000, type: "number" },
                            "D5": { formula: "=B5*C5", type: "formula" },

                            // Item 2
                            "A6": { value: "Lisensi Server & Domain .my.id (1 Tahun)", type: "text" },
                            "B6": { value: 2, type: "number" },
                            "C6": { value: 150000, type: "number" },
                            "D6": { formula: "=B6*C6", type: "formula" },

                            // Item 3
                            "A7": { value: "Optimasi SEO & Copywriting Konten", type: "text" },
                            "B7": { value: 3, type: "number" },
                            "C7": { value: 250000, type: "number" },
                            "D7": { formula: "=B7*C7", type: "formula" },

                            // Subtotal
                            "C9": { value: "Subtotal", type: "text", style: { font: { bold: true } } },
                            "D9": { formula: "=SUM(D5:D7)", type: "formula", style: { font: { bold: true } } },

                            // Potongan/Diskon (Diskon 10% dari Subtotal)
                            "C10": { value: "Diskon (10%)", type: "text", style: { font: { italic: true } } },
                            "D10": { formula: "=DISCOUNT(D9,10)", type: "formula", style: { font: { italic: true } } },

                            // Pajak PPN (PPN 11% dari Subtotal setelah diskon)
                            "C11": { value: "PPN (11%)", type: "text" },
                            "D11": { formula: "=TAX(D9-D10,11)", type: "formula" },

                            // Total Akhir Bersih
                            "C13": { value: "TOTAL AKHIR", type: "text", style: { font: { bold: true }, background: "#e8f5e9" } },
                            "D13": { formula: "=(D9-D10)+D11", type: "formula", style: { font: { bold: true }, background: "#e8f5e9" } }
                        }
                    }]
                };

            case 'expense_tracker':
                return {
                    ...baseFile,
                    metadata: { title: "Pelacak Pengeluaran Harian" },
                    sheets: [{
                        id: "sheet_1", name: "Pengeluaran", rows: 100, cols: 26,
                        merges: ["A1:D1"],
                        cells: {
                            "A1": { value: "PELACAK PENGELUARAN HARIAN", type: "text", style: { font: { bold: true, size: 16, color: "#ffffff" }, background: "#b45309", align: "center" } },
                            "B1": { value: "", type: "text", style: { background: "#b45309" } },
                            "C1": { value: "", type: "text", style: { background: "#b45309" } },
                            "D1": { value: "", type: "text", style: { background: "#b45309" } },
                            
                            "A3": { value: "Tanggal", type: "text", style: { font: { bold: true }, background: "#fef3c7" } },
                            "B3": { value: "Deskripsi", type: "text", style: { font: { bold: true }, background: "#fef3c7" } },
                            "C3": { value: "Kategori", type: "text", style: { font: { bold: true }, background: "#fef3c7" } },
                            "D3": { value: "Jumlah (Rp)", type: "text", style: { font: { bold: true }, background: "#fef3c7", align: "right" } },

                            "A4": { value: "20/05/2026", type: "text" },
                            "B4": { value: "Beli Kopi Arabika Hangat", type: "text" },
                            "C4": { value: "Makanan", type: "text" },
                            "D4": { value: 35000, type: "number" },

                            "A5": { value: "21/05/2026", type: "text" },
                            "B5": { value: "Isi Uang Elektronik (Tol)", type: "text" },
                            "C5": { value: "Transportasi", type: "text" },
                            "D5": { value: 200000, type: "number" },

                            "A6": { value: "22/05/2026", type: "text" },
                            "B6": { value: "Makan Siang Nasi Padang", type: "text" },
                            "C6": { value: "Makanan", type: "text" },
                            "D6": { value: 45000, type: "number" },

                            "A7": { value: "23/05/2026", type: "text" },
                            "B7": { value: "Pembayaran Tagihan Netflix", type: "text" },
                            "C7": { value: "Hiburan", type: "text" },
                            "D7": { value: 186000, type: "number" },

                            "A9": { value: "Total Pengeluaran", type: "text", style: { font: { bold: true }, background: "#f5f5f5" } },
                            "D9": { formula: "=SUM(D4:D7)", type: "formula", style: { font: { bold: true }, background: "#f5f5f5" } }
                        }
                    }]
                };

            case 'household_finance':
                return {
                    ...baseFile,
                    metadata: { title: "Keuangan Rumah Tangga" },
                    sheets: [{
                        id: "sheet_1", name: "Alur Kas", rows: 100, cols: 26,
                        merges: ["A1:C1"],
                        cells: {
                            "A1": { value: "KEUANGAN RUMAH TANGGA", type: "text", style: { font: { bold: true, size: 16, color: "#ffffff" }, background: "#4f46e5", align: "center" } },
                            "B1": { value: "", type: "text", style: { background: "#4f46e5" } },
                            "C1": { value: "", type: "text", style: { background: "#4f46e5" } },
                            
                            "A3": { value: "Deskripsi", type: "text", style: { font: { bold: true }, background: "#e0e7ff" } },
                            "B3": { value: "Arus Kas Masuk (Pendapatan)", type: "text", style: { font: { bold: true }, background: "#e0e7ff", align: "right" } },
                            "C3": { value: "Arus Kas Keluar (Pengeluaran)", type: "text", style: { font: { bold: true }, background: "#e0e7ff", align: "right" } },

                            "A4": { value: "Gaji Utama Bulanan", type: "text" },
                            "B4": { value: 8500000, type: "number" },
                            "C4": { value: 0, type: "number" },

                            "A5": { value: "Bonus Sampingan (Freelance)", type: "text" },
                            "B5": { value: 1500000, type: "number" },
                            "C5": { value: 0, type: "number" },

                            "A6": { value: "Belanja Dapur Mingguan", type: "text" },
                            "B6": { value: 0, type: "number" },
                            "C6": { value: 2000000, type: "number" },

                            "A7": { value: "Uang Sekolah Anak", type: "text" },
                            "B7": { value: 0, type: "number" },
                            "C7": { value: 1200000, type: "number" },

                            "A8": { value: "Angsuran Rumah / Kos", type: "text" },
                            "B8": { value: 0, type: "number" },
                            "C8": { value: 2500000, type: "number" },

                            "A10": { value: "Total Masuk & Keluar", type: "text", style: { font: { bold: true }, background: "#f5f5f5" } },
                            "B10": { formula: "=SUM(B4:B8)", type: "formula", style: { font: { bold: true }, background: "#f5f5f5" } },
                            "C10": { formula: "=SUM(C4:C8)", type: "formula", style: { font: { bold: true }, background: "#f5f5f5" } },

                            "A12": { value: "SISA TABUNGAN BERSIH", type: "text", style: { font: { bold: true }, background: "#d1fae5" } },
                            "B12": { formula: "=B10-C10", type: "formula", style: { font: { bold: true }, background: "#d1fae5" } }
                        }
                    }]
                };

            case 'project_tracker':
                return {
                    ...baseFile,
                    metadata: { title: "Pemantau Proyek" },
                    sheets: [{
                        id: "sheet_1", name: "Jadwal Tugas", rows: 100, cols: 26,
                        merges: ["A1:E1"],
                        cells: {
                            "A1": { value: "PEMANTAU PROYEK & TUGAS", type: "text", style: { font: { bold: true, size: 16, color: "#ffffff" }, background: "#0d9488", align: "center" } },
                            "B1": { value: "", type: "text", style: { background: "#0d9488" } },
                            "C1": { value: "", type: "text", style: { background: "#0d9488" } },
                            "D1": { value: "", type: "text", style: { background: "#0d9488" } },
                            "E1": { value: "", type: "text", style: { background: "#0d9488" } },

                            "A3": { value: "Nama Tugas", type: "text", style: { font: { bold: true }, background: "#ccfbf1" } },
                            "B3": { value: "Tgl Mulai", type: "text", style: { font: { bold: true }, background: "#ccfbf1" } },
                            "C3": { value: "Tgl Target", type: "text", style: { font: { bold: true }, background: "#ccfbf1" } },
                            "D3": { value: "Progress (%)", type: "text", style: { font: { bold: true }, background: "#ccfbf1", align: "center" } },
                            "E3": { value: "Status Utama", type: "text", style: { font: { bold: true }, background: "#ccfbf1" } },

                            "A4": { value: "Analisis Kebutuhan Pengguna", type: "text" },
                            "B4": { value: "10/05/2026", type: "text" },
                            "C4": { value: "15/05/2026", type: "text" },
                            "D4": { value: 100, type: "number" },
                            "E4": { formula: '=IF(D4=100,"Selesai","Dalam Pengerjaan")', type: "formula" },

                            "A5": { value: "Desain Skema UI & Mockup", type: "text" },
                            "B5": { value: "16/05/2026", type: "text" },
                            "C5": { value: "22/05/2026", type: "text" },
                            "D5": { value: 75, type: "number" },
                            "E5": { formula: '=IF(D5=100,"Selesai","Dalam Pengerjaan")', type: "formula" },

                            "A6": { value: "Pengembangan Kode Frontend", type: "text" },
                            "B6": { value: "23/05/2026", type: "text" },
                            "C6": { value: "05/06/2026", type: "text" },
                            "D6": { value: 20, type: "number" },
                            "E6": { formula: '=IF(D6=100,"Selesai","Dalam Pengerjaan")', type: "formula" },

                            "A8": { value: "Rata-rata Progress Keseluruhan", type: "text", style: { font: { bold: true } } },
                            "D8": { formula: "=AVERAGE(D4:D6)", type: "formula", style: { font: { bold: true } } }
                        }
                    }]
                };

            case 'habit_tracker':
                return {
                    ...baseFile,
                    metadata: { title: "Habit Tracker Mingguan" },
                    sheets: [{
                        id: "sheet_1", name: "Kebiasaan", rows: 100, cols: 26,
                        merges: ["A1:I1"],
                        cells: {
                            "A1": { value: "PELACAK KEBIASAAN MINGGUAN", type: "text", style: { font: { bold: true, size: 16, color: "#ffffff" }, background: "#db2777", align: "center" } },
                            "B1": { value: "", type: "text", style: { background: "#db2777" } },
                            "C1": { value: "", type: "text", style: { background: "#db2777" } },
                            "D1": { value: "", type: "text", style: { background: "#db2777" } },
                            "E1": { value: "", type: "text", style: { background: "#db2777" } },
                            "F1": { value: "", type: "text", style: { background: "#db2777" } },
                            "G1": { value: "", type: "text", style: { background: "#db2777" } },
                            "H1": { value: "", type: "text", style: { background: "#db2777" } },
                            "I1": { value: "", type: "text", style: { background: "#db2777" } },

                            "A3": { value: "Kebiasaan Positif", type: "text", style: { font: { bold: true }, background: "#fbcfe8" } },
                            "B3": { value: "Sen", type: "text", style: { font: { bold: true }, background: "#fbcfe8", align: "center" } },
                            "C3": { value: "Sel", type: "text", style: { font: { bold: true }, background: "#fbcfe8", align: "center" } },
                            "D3": { value: "Rab", type: "text", style: { font: { bold: true }, background: "#fbcfe8", align: "center" } },
                            "E3": { value: "Kam", type: "text", style: { font: { bold: true }, background: "#fbcfe8", align: "center" } },
                            "F3": { value: "Jum", type: "text", style: { font: { bold: true }, background: "#fbcfe8", align: "center" } },
                            "G3": { value: "Sab", type: "text", style: { font: { bold: true }, background: "#fbcfe8", align: "center" } },
                            "H3": { value: "Min", type: "text", style: { font: { bold: true }, background: "#fbcfe8", align: "center" } },
                            "I3": { value: "Total Hari", type: "text", style: { font: { bold: true }, background: "#fbcfe8", align: "center" } },

                            "A4": { value: "Olahraga Pagi 20 Menit", type: "text" },
                            "B4": { value: 1, type: "number" },
                            "C4": { value: 1, type: "number" },
                            "D4": { value: 0, type: "number" },
                            "E4": { value: 1, type: "number" },
                            "F4": { value: 0, type: "number" },
                            "G4": { value: 1, type: "number" },
                            "H4": { value: 1, type: "number" },
                            "I4": { formula: "=SUM(B4:H4)", type: "formula" },

                            "A5": { value: "Membaca Buku 10 Halaman", type: "text" },
                            "B5": { value: 1, type: "number" },
                            "C5": { value: 0, type: "number" },
                            "D5": { value: 1, type: "number" },
                            "E5": { value: 1, type: "number" },
                            "F5": { value: 1, type: "number" },
                            "G5": { value: 0, type: "number" },
                            "H5": { value: 0, type: "number" },
                            "I5": { formula: "=SUM(B5:H5)", type: "formula" },

                            "A6": { value: "Tidur Sebelum Jam 23:00", type: "text" },
                            "B6": { value: 0, type: "number" },
                            "C6": { value: 1, type: "number" },
                            "D6": { value: 1, type: "number" },
                            "E6": { value: 0, type: "number" },
                            "F6": { value: 1, type: "number" },
                            "G6": { value: 1, type: "number" },
                            "H6": { value: 1, type: "number" },
                            "I6": { formula: "=SUM(B6:H6)", type: "formula" }
                        }
                    }]
                };

            default:
                return null;
        }
    }
};

window.HitungTemplates = HitungTemplates;
