# TASKS - TMPT Platform & BRANKAS

## Fase 1: Foundation & Shared Components (MVP)
- [x] Setup struktur direktori (`assets/`, `shared/`)
- [x] Implementasi `assets/css/app.css` (Style base & PicoCSS override)
- [x] Implementasi `assets/js/crypto.js` (Web Crypto API logic)
- [x] Implementasi `assets/js/auth.js` (Session management)
- [x] Implementasi `assets/js/vault.js` (Local data storage)
- [x] Implementasi `assets/js/ui.js` (UI helpers & toasts)
- [x] Pembuatan shared components:
    - [x] `shared/header.html`
    - [x] `shared/footer.html`
    - [x] `shared/app-header.html`
- [x] Pembuatan `index.html` (Landing Page awal)

## Fase 2: Auth & Platform Core
- [x] Halaman `/setup` (Buat Vault Baru)
- [x] Halaman `/login` (Buka Vault)
- [x] Dashboard TMPT (`/dashboard`)
- [x] Global Settings (`/settings`)
- [x] Mekanisme Auto-lock

## Fase 3: BRANKAS App
- [x] Dashboard BRANKAS (`/brankas`)
- [x] Credential CRUD
- [x] Records CRUD
- [x] BRANKAS Settings (Terintegrasi dengan `/settings`)

## Fase 4: Backup & Tools
- [x] Backup/Restore (Local file `.tmpt`)
- [x] Standalone Tools (Password generator)
- [x] Dokumentasi & Sinkronisasi Git Versioning (Skrip & Panduan manual)
- [x] Halaman standar (About, FAQ, Help, Harga, Privacy, Contact, Sponsor)

## Fase 5: Ekosistem Aplikasi Produktivitas Klien Lokal
- [x] Pembangunan Modul Catatan & Daftar Tugas Gabungan "CATAT" (`/catat`)
    - [x] Editor catatan lokal dengan warna & label
    - [x] Manajemen Daftar Tugas (To-Do Lists) terintegrasi dengan progress bar
    - [x] Zero-knowledge state isolation & ekspor-impor JSON terpadu
- [x] Antarmuka Pengalih Brankas (Multi-Vault Switcher)

## Fase 6: Ekosistem Aplikasi Mobile (Android & iOS)
- [x] Inisialisasi dependensi & konfigurasi Capacitor
- [x] Integrasi skrip pembangun aset (`build.js`)
- [x] Pembuatan project native Android (`android/`)
- [x] Pembuatan project native iOS (`ios/`)
- [x] Pembuatan dokumentasi panduan mobile (`docs/mobile-apps.md`)

## Fase 7: Automasi Lisensi & Pricing
- [x] Integrasi n8n dengan Saweria Webhook
- [x] Validasi JWK privat key Ed25519 di n8n
- [x] Sistem Konfigurasi Harga Terpusat (`pricing.json`)
- [x] Pembaruan Frontend Dinamis (`harga/` & `pro/`)
- [x] Dokumentasi Kebijakan & Pengaturan Harga
- [x] Integrasi n8n dengan Midtrans Webhook (Uji Coba Sandbox & Produksi)
- [x] Implementasi Halaman Aktivasi `/pro/` dengan Snap SDK & Peningkatan UX Status Redirect

## Fase 8: Migrasi Struktur Rules v2
- [x] Migrasi pustaka CDN ke lokal (PicoCSS & HTMX)
- [x] Restrukturisasi folder `/shared/` dan pemindahan aset JS/CSS
- [x] Pembuatan modul bersama (`db.js`, `opfs.js`, `broadcast.js`, `app-bridge.js`)
- [x] Restrukturisasi folder aplikasi (`/app/tools/vault/`, `/app/kerja/catatan/`, `/app/kerja/hitung/`, `/app/`, `/app/tools/`)
- [x] Perbaikan terminologi "Master Password" menjadi "Kata Kunci Utama"
- [x] Standardisasi template HTML (data-theme & toast-container)

## Fase 9: PDF Tools (MVP)
- [x] Setup folder `/app/kerja/pdf/` dan download library (`pdf-lib.min.js`, `pdf.min.js`, `pdf.worker.min.js`, `jszip.min.js`, `sortable.min.js`) ke vendor lokal
- [x] Implementasi `app/kerja/pdf/index.html` (Dashboard PDF Tools dengan 14 alat pengolah)
- [x] Implementasi core utilities `app/kerja/pdf/js/pdf-core.js` (file drop zone, helper, global progress/loader)
- [x] Implementasi core previewer `app/kerja/pdf/js/pdf-preview.js` (thumbnail renderer via PDF.js)
- [x] Implementasi halaman & logika pemrosesan per tool:
    - [x] T01 — Merge PDF (`merge.html` & `js/tools/merge.js`)
    - [x] T02 — Split PDF (`split.html` & `js/tools/split.js`)
    - [x] T04 — Rotate PDF (`rotate.html` & `js/tools/rotate.js`)
    - [x] T05 — Remove Pages (`remove-pages.html` & `js/tools/remove-pages.js`)
    - [x] T06 — Extract Pages (`extract-pages.html` & `js/tools/extract-pages.js`)
    - [x] T07 — Organize PDF (Reorder) (`organize.html` & `js/tools/organize.js`)
    - [x] T08 — Add Page Numbers (`page-numbers.html` & `js/tools/page-numbers.js`)
    - [x] T09 — Add Watermark (`watermark.html` & `js/tools/watermark.js`)
    - [x] T10 — Protect PDF (`protect.html` & `js/tools/protect.js`)
    - [x] T11 — Unlock PDF (`unlock.html` & `js/tools/unlock.js`)
    - [x] T12 — JPG/PNG to PDF (`jpg-to-pdf.html` & `js/tools/jpg-to-pdf.js`)
    - [x] T13 — PDF to JPG (`pdf-to-jpg.html` & `js/tools/pdf-to-jpg.js`)
    - [x] T14 — Sign PDF (Simple) (`sign.html` & `js/tools/sign.js`)
    - [x] T03 — Compress PDF (`compress.html` & `js/tools/compress.js`)
- [x] Integrasi link PDF Tools ke App Launcher dan update `shared/apps.json`

## Fase 10: SEO Foundation System
- [x] Implementasi Core SEO Module (`shared/seo.js`)
- [x] Implementasi Konfigurasi SEO (`shared/seo-config.js`)
- [x] Implementasi Schema Generator (`shared/seo-schemas.js`)
- [x] Pembuatan `robots.txt`
- [x] Pembuatan Sitemap XML (`sitemap.xml`, `sitemap-core.xml`, `sitemap-kerja.xml`, `sitemap-dev.xml`, `sitemap-tools.xml`)
- [x] Integrasi SEO pada Landing Page (`index.html`) dan validasi meta tag dinamis
