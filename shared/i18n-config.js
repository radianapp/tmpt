/**
 * i18n Config Module for TMPT
 * Kamus Terjemahan: Indonesia (ID) & English (EN)
 */

const TMPT_I18n_Config = {
    // Shared / Common terms
    common: {
        id: {
            save: "Simpan",
            cancel: "Batal",
            delete: "Hapus",
            close: "Tutup",
            loading: "Memuat...",
            success: "Sukses",
            error: "Kesalahan",
            warning: "Peringatan",
            info: "Informasi",
            back: "Kembali",
            continue: "Lanjutkan",
            search: "Cari...",
            no_data: "Tidak ada data",
            settings: "Pengaturan",
            active: "Aktif"
        },
        en: {
            save: "Save",
            cancel: "Cancel",
            delete: "Delete",
            close: "Close",
            loading: "Loading...",
            success: "Success",
            error: "Error",
            warning: "Warning",
            info: "Info",
            back: "Back",
            continue: "Continue",
            search: "Search...",
            no_data: "No data available",
            settings: "Settings",
            active: "Active"
        }
    },

    // Global App Header
    header: {
        id: {
            search_placeholder: "Cari di TMPT...",
            search_options: "Opsi Pencarian",
            feedback: "Kirim Umpan Balik",
            theme_toggle: "Ganti Tema",
            settings: "Setelan",
            app_launcher: "Aplikasi TMPT",
            profile: "Menu Profil",
            sidebar_toggle: "Buka/Tutup Sidebar",
            title_theme_dark: "Tema: Gelap",
            title_theme_light: "Tema: Terang"
        },
        en: {
            search_placeholder: "Search in TMPT...",
            search_options: "Search Options",
            feedback: "Send Feedback",
            theme_toggle: "Toggle Theme",
            settings: "Settings",
            app_launcher: "TMPT Apps",
            profile: "Profile Menu",
            sidebar_toggle: "Toggle Sidebar",
            title_theme_dark: "Theme: Dark",
            title_theme_light: "Theme: Light"
        }
    },

    // Global Footer
    footer: {
        id: {
            tagline: "Tempat data kamu, bukan tempat data orang lain.",
            platform: "Platform",
            about: "Tentang",
            pricing: "Harga",
            tools: "Tools",
            help: "Bantuan / FAQ",
            legal: "Legal",
            terms: "Syarat Penggunaan",
            privacy: "Kebijakan Privasi",
            community: "Komunitas",
            contact: "Kontak",
            sponsor: "❤️ Sponsor & Donasi"
        },
        en: {
            tagline: "Your data's place, not other people's place.",
            platform: "Platform",
            about: "About",
            pricing: "Pricing",
            tools: "Tools",
            help: "Help / FAQ",
            legal: "Legal",
            terms: "Terms of Service",
            privacy: "Privacy Policy",
            community: "Community",
            contact: "Contact",
            sponsor: "❤️ Sponsor & Donate"
        }
    },

    // Profile Dropdown UI
    profile: {
        id: {
            hello_guest: "Halo, Tamu.",
            hello_user: "Halo, {name}.",
            status_locked: "Tmpt terkunci",
            status_unlocked: "Tmpt terbuka",
            license_free: "Edisi Standar Gratis",
            license_pro: "TMPT PRO ({plan})",
            vault_list: "Daftar Tmpt (Vault):",
            guest_prompt: "Buka Tmpt untuk melihat profil.",
            action_lock: "Kunci Tmpt",
            action_unlock: "Buka Tmpt",
            confirm_switch_title: "Konfirmasi Beralih",
            confirm_switch_message: "Apakah Anda yakin ingin beralih ke Tmpt <strong>\"{name}\"</strong>? Sesi Tmpt yang sedang terbuka saat ini akan otomatis dikunci.",
            pro_required: "Fitur Ganti Tmpt (Multi-Vault) memerlukan akun TMPT Pro!"
        },
        en: {
            hello_guest: "Hello, Guest.",
            hello_user: "Hello, {name}.",
            status_locked: "Tmpt locked",
            status_unlocked: "Tmpt unlocked",
            license_free: "Standard Free Edition",
            license_pro: "TMPT PRO ({plan})",
            vault_list: "Tmpt List (Vaults):",
            guest_prompt: "Open Tmpt to view profile.",
            action_lock: "Lock Tmpt",
            action_unlock: "Open Tmpt",
            confirm_switch_title: "Switch Confirmation",
            confirm_switch_message: "Are you sure you want to switch to Tmpt <strong>\"{name}\"</strong>? Your currently active session will be automatically locked.",
            pro_required: "Switching Tmpt (Multi-Vault) feature requires a TMPT Pro account!"
        }
    },

    // Settings Page UI
    settings: {
        id: {
            title: "Pengaturan",
            search_placeholder: "Cari pengaturan",
            nav_license: "Akun & Lisensi",
            nav_appearance: "Tampilan",
            nav_security: "Keamanan",
            nav_backup: "Backup & Sinkronisasi",
            nav_about: "Tentang TMPT",
            
            section_appearance: "Tampilan",
            row_language: "Bahasa (Language)",
            desc_language: "Pilih bahasa antarmuka aplikasi.",
            row_theme: "Tema Aplikasi (Mode)",
            desc_theme: "Atur tampilan antarmuka ke mode gelap atau terang.",
            row_theme_style: "Gaya Visual (Palet Warna)",
            desc_theme_style: "Pilih skema warna visual yang sesuai untuk Brankas Anda.",
            
            opt_theme_light: "Terang",
            opt_theme_dark: "Gelap",
            
            toast_saved: "Pengaturan disimpan.",
            toast_save_failed: "Gagal menyimpan pengaturan.",

            // Akun & Lisensi
            status_license: "Status Lisensi",
            btn_upgrade_pro: "✨ Upgrade ke Pro",
            desc_free_vault: "Terbatas 1 Tmpt (Vault)",

            // Keamanan
            row_autolock: "Auto-lock Otomatis",
            desc_autolock: "Kunci Brankas secara otomatis setelah tidak aktif beberapa saat.",
            row_change_password: "Ganti Kata Kunci Utama",
            desc_change_password: "Perbarui kata kunci enkripsi Brankas Anda.",
            row_recovery_codes: "Recovery Codes",
            desc_recovery_codes: "Hasilkan kode pemulihan darurat untuk memulihkan Brankas Anda dan mereset Kata Kunci Utama jika Anda lupa.",
            btn_upgrade_pro_edition: "Upgrade ke Pro Edition",

            // Data & Backup
            row_backup_data: "Cadangkan Data",
            desc_backup_data: "Unduh seluruh isi Brankas (termasuk pengaturan) ke file .tmpt terenkripsi.",
            btn_download_backup: "Unduh Backup (.tmpt)",
            row_restore_data: "Pulihkan Data",
            desc_restore_data: "Timpa data saat ini dengan data dari file backup (.tmpt) Anda secara instan.",
            btn_choose_backup: "Pilih File Backup",

            // Google Drive
            section_gdrive: "Google Drive Sync",
            row_connect_gdrive: "Hubungkan Google Drive",
            desc_connect_gdrive: "Hubungkan akun Google Anda untuk mencadangkan data terenkripsi secara otomatis ke awan.",
            btn_connect: "Hubungkan",

            // Pengingat Backup
            section_backup_reminder: "Pengingat Backup",
            row_backup_interval: "Interval Pengingat Backup",
            desc_backup_interval: "TMPT akan mengingatkan Anda untuk mem-backup data secara berkala.",

            // Zona Bahaya
            section_danger_zone: "Zona Bahaya",
            row_danger_zone: "Zona Bahaya",
            desc_danger_zone: "Tindakan ini akan menghapus seluruh data dan pengaturan secara permanen. Anda tidak bisa membatalkan tindakan ini.",
            btn_destroy_vault: "Hapus Seluruh Tmpt",

            // Tentang
            section_about: "Tentang",
            row_version: "Versi Sistem",
            row_codename: "Codename",
            row_last_update: "Pembaruan Terakhir"
        },
        en: {
            title: "Settings",
            search_placeholder: "Search settings",
            nav_license: "Account & License",
            nav_appearance: "Appearance",
            nav_security: "Security",
            nav_backup: "Backup & Sync",
            nav_about: "About TMPT",
            
            section_appearance: "Appearance",
            row_language: "Language (Bahasa)",
            desc_language: "Choose the application interface language.",
            row_theme: "Application Theme (Mode)",
            desc_theme: "Set the interface appearance to dark or light mode.",
            row_theme_style: "Visual Style (Color Palette)",
            desc_theme_style: "Choose a visual color scheme suitable for your Vault.",
            
            opt_theme_light: "Light",
            opt_theme_dark: "Dark",
            
            toast_saved: "Settings saved.",
            toast_save_failed: "Failed to save settings.",

            // Akun & Lisensi
            status_license: "License Status",
            btn_upgrade_pro: "✨ Upgrade to Pro",
            desc_free_vault: "Limited to 1 Tmpt (Vault)",

            // Keamanan
            row_autolock: "Auto-lock Timeout",
            desc_autolock: "Lock the Vault automatically after a period of inactivity.",
            row_change_password: "Change Master Key",
            desc_change_password: "Update your Vault encryption master key.",
            row_recovery_codes: "Recovery Codes",
            desc_recovery_codes: "Generate emergency recovery codes to restore your Vault and reset Master Key if you forget it.",
            btn_upgrade_pro_edition: "Upgrade to Pro Edition",

            // Data & Backup
            row_backup_data: "Backup Data",
            desc_backup_data: "Download all Vault contents (including settings) into an encrypted .tmpt file.",
            btn_download_backup: "Download Backup (.tmpt)",
            row_restore_data: "Restore Data",
            desc_restore_data: "Overwrite current data with data from your backup (.tmpt) file instantly.",
            btn_choose_backup: "Select Backup File",

            // Google Drive
            section_gdrive: "Google Drive Sync",
            row_connect_gdrive: "Connect Google Drive",
            desc_connect_gdrive: "Connect your Google account to automatically backup encrypted data to the cloud.",
            btn_connect: "Connect",

            // Pengingat Backup
            section_backup_reminder: "Backup Reminder",
            row_backup_interval: "Backup Reminder Interval",
            desc_backup_interval: "TMPT will remind you to back up your data regularly.",

            // Zona Bahaya
            section_danger_zone: "Danger Zone",
            row_danger_zone: "Danger Zone",
            desc_danger_zone: "This action will permanently delete all data and settings. You cannot undo this action.",
            btn_destroy_vault: "Destroy Entire Tmpt",

            // Tentang
            section_about: "About",
            row_version: "System Version",
            row_codename: "Codename",
            row_last_update: "Last Updated"
        }
    },

    // UI Feedback & Dialogs
    ui: {
        id: {
            confirm_title: "Konfirmasi Diperlukan",
            prompt_title: "Masukan Diperlukan",
            btn_confirm: "Lanjutkan",
            btn_cancel: "Batal",
            passphrase_copied: "Passphrase dibuat dan disalin ke clipboard!",
            passphrase_copied_failed: "Passphrase otomatis dibuat! (Gagal menyalin ke clipboard)"
        },
        en: {
            confirm_title: "Confirmation Required",
            prompt_title: "Input Required",
            btn_confirm: "Continue",
            btn_cancel: "Cancel",
            passphrase_copied: "Passphrase generated and copied to clipboard!",
            passphrase_copied_failed: "Passphrase automatically generated! (Failed to copy to clipboard)"
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TMPT_I18n_Config;
} else {
    window.TMPT_I18n_Config = TMPT_I18n_Config;
}
