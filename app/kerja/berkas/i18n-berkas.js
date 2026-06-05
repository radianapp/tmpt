/**
 * i18n Dictionary for Berkas App
 * Terjemahan lokal khusus untuk Aplikasi Berkas
 */

const Berkas_I18n_Config = {
    berkas: {
        id: {
            title: "Berkas",
            btn_new: "➕ Baru",
            new_doc: "📄 Dokumen Baru",
            new_slide: "🎞 Presentasi Baru",
            new_form: "📋 Formulir Baru",
            new_papan: "🎨 Papan Coretan Baru",
            new_folder: "📁 Folder Baru",
            upload_file: "📤 Unggah File",
            
            nav_shortcut: "Pintasan",
            nav_all_files: "🕐 Semua Berkas",
            nav_starred: "⭐ Berbintang",
            nav_trash: "🗑️ Sampah",
            nav_my_folders: "Folder Saya",
            nav_tags: "Tag",
            
            storage_title: "Penyimpanan Lokal",
            storage_details_tmpl: "{used} / Estimasi {total}",
            btn_backup: "Backup/Restore",
            btn_local_folder: "Folder Lokal",
            
            breadcrumb_root: "Utama",
            search_placeholder: "Cari berkas...",
            
            filter_type: "Filter Tipe Berkas",
            opt_filter_all: "Semua Tipe",
            opt_filter_doc: "Dokumen",
            opt_filter_slide: "Presentasi",
            opt_filter_form: "Formulir",
            opt_filter_catat_notes: "Catatan",
            opt_filter_catat_lists: "Tugas",
            opt_filter_pdf: "PDF",
            opt_filter_image: "Gambar",
            opt_filter_other: "Lainnya",
            
            view_grid: "Tampilan Grid",
            view_list: "Tampilan List",
            
            sort_by: "Urutkan",
            opt_sort_newest: "Terakhir Diubah (Terbaru)",
            opt_sort_oldest: "Terakhir Diubah (Terlama)",
            opt_sort_name_asc: "Nama (A-Z)",
            opt_sort_name_desc: "Nama (Z-A)",
            opt_sort_size_desc: "Ukuran (Terbesar)",
            
            bulk_selected: "{count} terpilih",
            bulk_star: "⭐ Bintang",
            bulk_tag: "🏷️ Tag",
            bulk_move: "📁 Pindahkan",
            bulk_delete: "🗑️ Hapus",
            bulk_clear: "Batal",
            
            drag_overlay_msg: "📤 Lepaskan berkas di sini untuk mengunggah",
            section_folders: "Folder",
            section_files: "Berkas",
            
            preview_title: "Pratinjau Berkas",
            btn_close: "Tutup",
            btn_download: "Unduh Berkas",
            
            backup_modal_title: "Backup & Pemulihan Ekosistem",
            backup_modal_desc: "Unduh semua data lokal Anda (termasuk Catatan, Hitung, serta berkas biner di OPFS) dalam satu paket `.tmpt` terkompresi, atau pulihkan data Anda dari backup sebelumnya.",
            backup_download_title: "Unduh Backup (.tmpt)",
            backup_download_desc: "Bundel seluruh data lokal di browser Anda",
            btn_download_backup: "Unduh Backup",
            backup_restore_title: "Pulihkan dari Backup",
            backup_restore_desc: "Unggah file .tmpt untuk mengembalikan data Anda.",
            opt_restore_merge: "Gabungkan",
            opt_restore_overwrite: "Timpa Semua",
            btn_select_tmpt: "Pilih Berkas .tmpt",
            backup_processing: "Memproses...",
            
            fsaa_title: "Folder Lokal (FSAA Mode)",
            fsaa_desc: "Hubungkan TMPT ke folder di komputer Anda. Dokumen yang dibuat akan otomatis tersimpan sebagai file nyata di penyimpanan komputer Anda. (Hanya didukung di Chrome / Edge)",
            fsaa_status_title: "Status Hubungan:",
            fsaa_status_disconnected: "🔴 Tidak Terhubung",
            fsaa_status_connected: "🟢 Terhubung",
            btn_fsaa_disconnect: "Putus Hubungan",
            btn_fsaa_connect: "Pilih Folder Lokal...",
            
            folder_new_title: "Buat Folder Baru",
            folder_rename_title: "Ubah Nama Folder",
            folder_name_label: "Nama Folder",
            folder_name_placeholder: "Masukkan nama folder...",
            folder_color_label: "Warna Folder",
            btn_save: "Simpan",
            
            move_title: "Pindahkan ke Folder",
            move_desc: "Pilih folder tujuan untuk memindahkan berkas terpilih.",
            btn_move_confirm: "Pindahkan Ke Sini",
            
            tag_title: "Tambahkan Tag",
            tag_name_label: "Nama Tag Baru (atau pilih di bawah)",
            tag_name_placeholder: "Nama tag...",
            tag_list_label: "Daftar Tag Berkas",
            
            ctx_open: "📂 Buka",
            ctx_preview: "👁️ Pratinjau",
            ctx_rename: "✏️ Rename",
            ctx_star_add: "⭐ Tambah Bintang",
            ctx_star_remove: "⭐ Hapus Bintang",
            ctx_tag: "🏷️ Kelola Tag",
            ctx_move: "📁 Pindahkan ke Folder",
            ctx_duplicate: "📋 Duplikat",
            ctx_download: "📥 Export / Unduh",
            ctx_restore: "🔄 Pulihkan",
            ctx_delete: "🗑️ Hapus"
        },
        en: {
            title: "Files",
            btn_new: "➕ New",
            new_doc: "📄 New Document",
            new_slide: "🎞 New Presentation",
            new_form: "📋 New Form",
            new_papan: "🎨 New Whiteboard",
            new_folder: "📁 New Folder",
            upload_file: "📤 Upload File",
            
            nav_shortcut: "Shortcuts",
            nav_all_files: "🕐 All Files",
            nav_starred: "⭐ Starred",
            nav_trash: "🗑️ Trash",
            nav_my_folders: "My Folders",
            nav_tags: "Tags",
            
            storage_title: "Local Storage",
            storage_details_tmpl: "{used} / Est. {total}",
            btn_backup: "Backup/Restore",
            btn_local_folder: "Local Folder",
            
            breadcrumb_root: "Home",
            search_placeholder: "Search files...",
            
            filter_type: "Filter File Type",
            opt_filter_all: "All Types",
            opt_filter_doc: "Documents",
            opt_filter_slide: "Presentations",
            opt_filter_form: "Forms",
            opt_filter_catat_notes: "Notes",
            opt_filter_catat_lists: "Tasks",
            opt_filter_pdf: "PDF",
            opt_filter_image: "Images",
            opt_filter_other: "Others",
            
            view_grid: "Grid View",
            view_list: "List View",
            
            sort_by: "Sort By",
            opt_sort_newest: "Last Modified (Newest)",
            opt_sort_oldest: "Last Modified (Oldest)",
            opt_sort_name_asc: "Name (A-Z)",
            opt_sort_name_desc: "Name (Z-A)",
            opt_sort_size_desc: "Size (Largest)",
            
            bulk_selected: "{count} selected",
            bulk_star: "⭐ Star",
            bulk_tag: "🏷️ Tag",
            bulk_move: "📁 Move",
            bulk_delete: "🗑️ Delete",
            bulk_clear: "Cancel",
            
            drag_overlay_msg: "📤 Drop files here to upload",
            section_folders: "Folders",
            section_files: "Files",
            
            preview_title: "File Preview",
            btn_close: "Close",
            btn_download: "Download File",
            
            backup_modal_title: "System Backup & Recovery",
            backup_modal_desc: "Download all your local data (including Notes, Sheets, and binary files in OPFS) in a single compressed `.tmpt` package, or restore your data from a previous backup.",
            backup_download_title: "Download Backup (.tmpt)",
            backup_download_desc: "Bundle all local browser data",
            btn_download_backup: "Download Backup",
            backup_restore_title: "Restore from Backup",
            backup_restore_desc: "Upload .tmpt file to restore your data.",
            opt_restore_merge: "Merge",
            opt_restore_overwrite: "Overwrite All",
            btn_select_tmpt: "Choose .tmpt File",
            backup_processing: "Processing...",
            
            fsaa_title: "Local Folder (FSAA Mode)",
            fsaa_desc: "Connect TMPT to a folder on your computer. Documents created will be automatically saved as real files on your computer storage. (Only supported in Chrome / Edge)",
            fsaa_status_title: "Connection Status:",
            fsaa_status_disconnected: "🔴 Disconnected",
            fsaa_status_connected: "🟢 Connected",
            btn_fsaa_disconnect: "Disconnect",
            btn_fsaa_connect: "Select Local Folder...",
            
            folder_new_title: "Create New Folder",
            folder_rename_title: "Rename Folder",
            folder_name_label: "Folder Name",
            folder_name_placeholder: "Enter folder name...",
            folder_color_label: "Folder Color",
            btn_save: "Save",
            
            move_title: "Move to Folder",
            move_desc: "Select target folder to move selected files.",
            btn_move_confirm: "Move Here",
            
            tag_title: "Add Tag",
            tag_name_label: "New Tag Name (or choose below)",
            tag_name_placeholder: "Tag name...",
            tag_list_label: "File Tag List",
            
            ctx_open: "📂 Open",
            ctx_preview: "👁️ Preview",
            ctx_rename: "✏️ Rename",
            ctx_star_add: "⭐ Add Star",
            ctx_star_remove: "⭐ Remove Star",
            ctx_tag: "🏷️ Manage Tags",
            ctx_move: "📁 Move to Folder",
            ctx_duplicate: "📋 Duplicate",
            ctx_download: "📥 Export / Download",
            ctx_restore: "🔄 Restore",
            ctx_delete: "🗑️ Delete"
        }
    }
};

// Merge dengan config i18n global jika tersedia
if (window.TMPT_I18n_Config) {
    window.TMPT_I18n_Config = { ...window.TMPT_I18n_Config, ...Berkas_I18n_Config };
} else {
    window.Berkas_I18n_Config = Berkas_I18n_Config;
}

// Picu ulang translasi secara instan setelah library terjemahan lokal ini dimuat
if (window.TMPT_I18n) {
    window.TMPT_I18n.applyTranslations();
}

