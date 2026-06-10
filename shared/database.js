/**
 * TMPT Database Registry
 * File ini berisi daftar resmi nama-nama database IndexedDB yang digunakan di seluruh ekosistem TMPT.
 * Gunakan file ini secara konsisten di semua modul (backup, restore, settings, dll) untuk menghindari hardcode.
 */

const TMPT_DATABASES = [
    'tmpt_berkas',
    'tmpt_tulis',
    'tmpt_hitung',
    'tmpt_slides',
    'tmpt_forms',
    'tmpt_kalender',
    'tmpt_tugas',
    'tmpt_catatan',
    'tmpt_vault',
    'tmpt_code',
    'tmpt_diagram',
    'tmpt_markdown',
    'tmpt_json',
    'tmpt_project',
    'tmpt_pomodoro',
    'tmpt_regex',
    'tmpt_papan'
];

const TMPT_OLD_APP_TO_DB = {
    'tulis': 'tmpt_tulis',
    'hitung': 'tmpt_hitung',
    'slide': 'tmpt_slides',
    'forms': 'tmpt_forms',
    'kalender': 'tmpt_kalender',
    'tugas': 'tmpt_tugas',
    'catatan': 'tmpt_catatan',
    'markdown': 'tmpt_markdown',
    'berkas': 'tmpt_berkas',
    'code': 'tmpt_code',
    'diagram': 'tmpt_diagram',
    'vault': 'tmpt_vault',
    'qr': 'tmpt_qr',
    'regex': 'tmpt_regex',
    'json': 'tmpt_json',
    'project': 'tmpt_project',
    'pomodoro': 'tmpt_pomodoro',
    'papan': 'tmpt_papan'
};

// Export untuk ES Module dan global fallback untuk vanilla script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TMPT_DATABASES, TMPT_OLD_APP_TO_DB };
} else {
    window.TMPT_DATABASES = TMPT_DATABASES;
    window.TMPT_OLD_APP_TO_DB = TMPT_OLD_APP_TO_DB;
}

