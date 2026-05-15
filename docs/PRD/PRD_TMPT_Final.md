# PRD Final — TMPT Platform & BRANKAS

**Versi:** 1.0  
**Tanggal:** 14 Mei 2026  
**Domain:** tmpt.my.id  
**Status:** Final Draft — siap implementasi

---

## 1. Visi & Ringkasan

**TMPT** (dibaca "tempat") adalah platform web statis — di-host di GitHub Pages — yang menjadi *wadah* dari beberapa aplikasi/tools produktivitas berbasis browser. Semua data disimpan secara lokal di browser pengguna, terenkripsi, tanpa server, tanpa database, tanpa kirim data ke mana pun.

Tagline: **"Tempat data kamu, bukan tempat data orang lain."**

TMPT bukan satu aplikasi — melainkan sebuah platform yang menaungi beberapa apps. Aplikasi pertama yang dibangun adalah **BRANKAS**.

---

## 2. Penamaan & Brand

### Platform
| | |
|---|---|
| Nama | TMPT |
| Plesetan | "Tempat" — wadah/kontainer untuk data |
| Domain | tmpt.my.id |
| Tagline | Tempat data kamu, bukan tempat data orang lain |

### Pola Penamaan Aplikasi
Semua app di bawah TMPT menggunakan nama kata benda bahasa Indonesia yang pendek, ikonik, dan mewakili fungsinya:

| Nama App | Fungsi | Status |
|---|---|---|
| **BRANKAS** | Personal credential & info manager | v1.0 — dikerjakan pertama |
| **DAFTAR** | To-do & list manager | v2.0 — roadmap |
| **CATAT** | Secure notes | v2.0 — roadmap |
| **TAGIH** | Invoice & subscription tracker | v3.0 — roadmap |
| **LACAK** | Personal expense tracker | v3.0 — roadmap |

---

## 3. Tech Stack

| Layer | Pilihan | Keterangan |
|---|---|---|
| Hosting | GitHub Pages | Free, HTTPS otomatis, CDN |
| CSS | PicoCSS (picocss.com) | Semantic, minimal, classless-friendly |
| Interactivity | HTMX + Vanilla JS | No framework, no build step |
| Kriptografi | Web Crypto API (native) | Built-in browser, no library needed |
| State | `localStorage` + `sessionStorage` | Semua data di browser |
| Icons | Tabler Icons (SVG sprite) | MIT, 5800+ icon |
| Build | None (atau Vite jika dibutuhkan) | Semua file bisa dirun langsung |

**Tidak ada:** Node.js server, database, REST API, user accounts di server.

---

## 4. Information Architecture

### 4.1 Semua Halaman

#### Public (tanpa login)
| Path | Halaman | Keterangan |
|---|---|---|
| `/` | Landing Page | Hero, fitur, daftar apps, CTA, footer |
| `/about` | About | Tentang TMPT, filosofi, tim |
| `/pricing` | Pricing | Free vs Pro, tabel perbandingan |
| `/faq` | FAQ | Pertanyaan umum, khususnya soal keamanan & privasi |
| `/help` | Help Center | Dokumentasi penggunaan, per-app |
| `/contact` | Contact | Form kontak (via Formspree atau mailto) |
| `/terms` | Terms of Service | Syarat penggunaan |
| `/privacy` | Privacy Policy | Kebijakan privasi (singkat: kami tidak simpan apapun) |
| `/tools/` | Tools Hub | Daftar tools standalone tanpa login |
| `/tools/password-gen` | Password Generator | |
| `/tools/uuid` | UUID Generator | |
| `/tools/jwt` | JWT Decoder | |
| `/tools/totp` | TOTP / 2FA Code | |
| `/tools/hash` | Hash Generator | MD5, SHA-1, SHA-256 |
| `/tools/base64` | Base64 Encode/Decode | |
| `/tools/json` | JSON Formatter | |
| `/tools/epoch` | Epoch Converter | |
| `/tools/diff` | Diff Checker | |
| `/tools/regex` | Regex Tester | |
| `/tools/url-encode` | URL Encoder/Decoder | |
| `/tools/color` | Color Picker & Converter | |

#### Auth (transisi)
| Path | Halaman | Keterangan |
|---|---|---|
| `/setup` | Buat Vault Baru | Pengganti "Register" — buat master password |
| `/login` | Buka Vault | Pengganti "Sign In" — input master password |

**Tidak ada:** `/register`, `/forgot-password` (lihat bagian 5 untuk penjelasan).

#### Post-Login — Platform
| Path | Halaman | Keterangan |
|---|---|---|
| `/dashboard` | Dashboard TMPT | Tiles semua apps + notifikasi backup |
| `/settings` | Global Settings | Master password, tema, bahasa |
| `/settings/backup` | Backup & Restore | Export/import full TMPT |
| `/settings/account` | Akun Vault | Ganti master password, reset vault |

#### Post-Login — BRANKAS
| Path | Halaman | Keterangan |
|---|---|---|
| `/brankas` | Dashboard BRANKAS | Ringkasan, quick-add, recent |
| `/brankas/credentials` | Daftar Credential | Grid/list semua credential |
| `/brankas/credentials/new` | Tambah Credential | Form sesuai kategori |
| `/brankas/credentials/:id` | Detail Credential | Lihat + edit + copy field |
| `/brankas/records` | Daftar Info Penting | KTP, PLN, BPJS, dll |
| `/brankas/records/new` | Tambah Info Penting | Form sesuai kategori |
| `/brankas/records/:id` | Detail Info Penting | Lihat + edit |
| `/brankas/settings` | Settings BRANKAS | Preferensi per-app |
| `/brankas/backup` | Backup BRANKAS | Export/import hanya data BRANKAS |

---

### 4.2 Konten per Halaman Utama

#### Landing Page (`/`)
```
[HEADER]
  Logo TMPT + Navigasi (About, Pricing, Tools, FAQ)
  CTA kanan: [Buka Vault] [Buat Vault Baru]

[HERO]
  Headline: "Tempat aman untuk semua data penting kamu"
  Sub: "Tersimpan di browser-mu sendiri. Terenkripsi. Tanpa server."
  CTA: [Mulai Gratis] [Lihat cara kerjanya ↓]

[TRUST STRIP]
  Icons: 🔒 Zero Knowledge | ☁ Offline-ready | 🇮🇩 Buatan Indonesia | MIT License

[FITUR UTAMA]
  3 kolom: Aman & Privat | Semua di Satu Tempat | Tools Gratis

[APPS SHOWCASE]
  Card BRANKAS (available) + Card placeholder apps (coming soon)

[HOW IT WORKS]
  3 langkah: Buat vault → Simpan data → Akses kapan saja

[TESTIMONIAL / SOCIAL PROOF]
  (kosong dulu, isi setelah ada user)

[CTA SECTION]
  "Mulai sekarang. Gratis. Selamanya."
  [Buat Vault Baru]

[FOOTER]
  Links: About, Pricing, Tools, Help, Terms, Privacy, Contact
  "Open source di GitHub" | "© 2026 TMPT"
```

#### Dashboard TMPT (`/dashboard`)
```
[HEADER APP]
  Logo TMPT | Nav: Dashboard, Tools | Avatar/lock icon

[GREETING]
  "Selamat datang" + tanggal + notifikasi backup reminder

[APP TILES]
  Card BRANKAS: status (X credential, Y records), tombol "Buka"
  Card DAFTAR: "Coming soon"
  Card TOOLS: shortcut ke tools hub

[ACTIVITY / TIPS]
  Terakhir diubah: "brankas · 2 jam lalu"
  Backup reminder: "Terakhir backup: 7 hari lalu — saatnya backup!"
```

---

## 5. Autentikasi — Desain Lengkap

### 5.1 Mengapa tidak ada "Register" tradisional

Di TMPT tidak ada akun di server. Yang ada adalah **vault lokal** — sebuah file terenkripsi di `localStorage` browser pengguna. Proses "mendaftar" setara dengan "membuat vault baru".

| Istilah Umum | Istilah TMPT | Penjelasan |
|---|---|---|
| Register / Daftar | Buat Vault Baru | Membuat master password & vault kosong |
| Sign In / Masuk | Buka Vault | Memasukkan master password untuk unlock |
| Sign Out / Keluar | Kunci Vault | Lock session, kunci tetap di memori tapi data dikunci |
| Delete Account | Hapus Vault | Hapus semua data dari localStorage |

### 5.2 Mengapa tidak ada "Forgot Password"

Ini bukan keterbatasan — ini **fitur keamanan**.

Jika ada mekanisme recovery password, berarti ada pihak ketiga yang bisa mengakses datamu. TMPT menggunakan arsitektur zero-knowledge: master password tidak pernah dikirim ke server, tidak pernah disimpan dalam bentuk plaintext, bahkan Encryption Key tidak pernah disimpan ke disk — hanya ada di RAM selama vault terbuka.

**Konsekuensi yang perlu dikomunikasikan ke pengguna:**
- Jika lupa master password dan tidak punya backup → data tidak bisa dipulihkan
- Ini seperti kehilangan kunci brankas fisik yang tidak punya duplikat

**Mitigasi yang disediakan TMPT:**
1. **Password hint** — teks bebas (bukan password itu sendiri) yang ditampilkan di halaman login. Contoh: "Nama kucing + tahun lahir". Disimpan plaintext, bukan rahasia.
2. **Backup rutin** — file `.tmpt` / `.brankas` dienkripsi dengan master password yang sama. Backup memungkinkan data dipindah ke device lain, tapi tetap butuh master password.
3. **Recovery code (v2.0)** — string 24 karakter yang di-generate saat setup. Disimpan pengguna (print/tulis). Bisa dipakai untuk *membuat ulang* vault dengan master password baru — tapi data lama tetap hilang.

### 5.3 Flow: Kunjungan Pertama

```
1. Buka tmpt.my.id
2. Klik "Buat Vault Baru"
3. Halaman /setup:
   - Input: Master Password (min 12 karakter, strength meter)
   - Input: Konfirmasi master password
   - Input opsional: Password hint (teks bebas)
   - Checkbox: "Saya mengerti bahwa lupa password = data tidak bisa dipulihkan"
4. Submit → derivasi kunci (PBKDF2, 100k iterasi)
5. Vault kosong dibuat → redirect ke /dashboard
6. Onboarding modal: "Vault kamu sudah siap. Mau mulai dengan BRANKAS?"
```

### 5.4 Flow: Login Harian

```
1. Buka tmpt.my.id (atau /login)
2. Vault terdeteksi di localStorage → tampil form login
3. Input: Master Password
4. [Opsional] Tampilkan password hint (toggle)
5. Submit → PBKDF2 derivasi → coba dekripsi data
6. Berhasil → sessionStorage diisi, redirect ke /dashboard
7. Gagal → delay 2 detik + pesan "Password salah" (tanpa info lebih)
   → Setelah 5 percobaan gagal: delay 30 detik (soft brute-force protection)
```

### 5.5 Auto-lock

- Kunci otomatis setelah idle 15 menit (default, bisa diubah di Settings)
- Kunci otomatis saat tab di-minimize / browser di-close
- Saat kunci: Encryption Key di-null dari memori, sessionStorage di-clear
- Untuk membuka lagi: cukup input master password, tanpa reload halaman

---

## 6. BRANKAS — Spesifikasi Aplikasi

**BRANKAS** adalah aplikasi pertama di platform TMPT. Namanya terinspirasi dari kata Indonesia untuk "brankas" — kotak besi kuat tempat menyimpan barang berharga.

Fungsi: menyimpan credential (password, API key, token, akun login) dan informasi penting pribadi (nomor KTP, PLN, BPJS, dll) secara aman dan terenkripsi.

### 6.1 Dashboard BRANKAS (`/brankas`)

```
[HEADER APP — shared component]
  Logo BRANKAS | Breadcrumb: TMPT > BRANKAS

[SUMMARY CARDS]
  "12 Credential" | "8 Info Penting" | "Terakhir diubah: 2j lalu"

[QUICK ADD]
  [+ Tambah Credential] [+ Tambah Info Penting]

[RECENT]
  5 item terakhir diubah (nama, kategori, waktu)

[EXPIRY ALERTS]
  Item yang akan kadaluarsa dalam 30 hari (domain SSL, langganan, dll)
```

### 6.2 Modul Credential

**Kategori & Fields:**

| Kategori | Fields Utama |
|---|---|
| Email & Google | Email, Password, Recovery phone, 2FA backup codes |
| Hosting & VPS | Provider, URL/IP, Username, Password, SSH key note |
| Database | Host, Port, DB name, Username, Password |
| Domain & DNS | Registrar, Username, Password, Domain list, Expire date |
| API & Token | Service, API key, Secret, Scope, Expire date |
| Git & DevOps | Platform, Username, PAT token, Organization |
| Media Sosial | Platform, Username, Password, Email terdaftar |
| Keuangan | Bank/e-wallet, Nomor akun, Username, PIN hint |
| Langganan | Layanan, Email, Password, Tanggal renewal, Harga |
| Custom | Nama bebas + key-value pairs tidak terbatas |

**Fitur per Credential:**
- Quick copy tiap field (auto-clear clipboard 30 detik)
- Reveal/hide untuk field sensitif
- Password strength indicator
- Tag & kategori custom
- Catatan bebas (terenkripsi)
- Tanggal dibuat & diubah
- Expire date + notifikasi dashboard

### 6.3 Modul Info Penting

| Kategori | Fields Utama |
|---|---|
| Identitas | NIK (KTP), No. KK, Nama lengkap, NPWP, Passport no., No. SIM |
| BPJS | No. BPJS Kesehatan, No. BPJS Ketenagakerjaan, kelas |
| Kendaraan | Plat nomor, No. rangka, No. mesin, Tanggal STNK, Tanggal KIR |
| Utilitas | No. pelanggan PLN, ID pelanggan PDAM, No. meter |
| Komunikasi | No. HP per SIM, provider, masa aktif |
| Properti | No. sertifikat, No. IMB, SPPT PBB, Nama notaris |
| Kode Penting | PIN ATM hint, kode brankas, PIN akses gedung |
| Custom Record | Field bebas |

---

## 7. Backup & Restore

### 7.1 Dua Level Backup

TMPT menyediakan backup di dua level yang terpisah:

#### Level 1 — Full TMPT Backup
- Berisi: semua data dari semua app (BRANKAS + app lain di masa depan)
- Format file: `tmpt-backup-YYYY-MM-DD.tmpt`
- Lokasi: `/settings/backup`
- Dienkripsi dengan master password yang sama

#### Level 2 — Per-App Backup
- Berisi: hanya data satu app
- Format file: `brankas-YYYY-MM-DD.brankas`
- Lokasi: `/brankas/backup`
- Dienkripsi dengan master password yang sama
- Berguna untuk: migrasi sebagian, berbagi konfigurasi (tapi data tetap rahasia karena terenkripsi)

### 7.2 Tiga Tujuan Backup

| Tujuan | Cara | Keterangan |
|---|---|---|
| **Local disk** | Download file via browser | Paling simpel, offline |
| **Google Drive** | Google Picker API + Drive API | Butuh login Google, upload file ke folder pilihan |
| **GitHub Gist (private)** | GitHub API via Personal Access Token | Untuk developer; gist private dienkripsi |

Backup ke cloud (Google Drive, GitHub) bersifat **manual trigger** — pengguna yang klik "Backup Sekarang". Tidak ada auto-sync ke server manapun di v1.0.

> Di v2.0 Pro: bisa aktifkan auto-backup ke Google Drive setiap X hari.

### 7.3 Format File Backup

```json
{
  "format": "tmpt-vault-v1",
  "app": "brankas",
  "created_at": "2026-05-14T10:00:00Z",
  "hint": "hint password opsional (plaintext)",
  "salt_auth": "base64...",
  "salt_enc": "base64...",
  "iterations": 100000,
  "data": {
    "iv": "base64...",
    "ciphertext": "base64...",
    "auth_tag": "base64..."
  }
}
```

File berukuran kecil (biasanya < 100KB untuk ratusan entries). Tidak terbaca tanpa master password.

### 7.4 Flow Restore

```
1. Buka /settings/backup (atau /brankas/backup untuk per-app)
2. Klik "Restore dari file"
3. Upload file .tmpt atau .brankas
4. Validasi format & versi file
5. Input master password (yang dipakai saat backup dibuat)
6. Sistem mencoba dekripsi → jika gagal: "Password salah atau file rusak"
7. Jika berhasil: tampil preview (berapa entries, tanggal backup)
8. Pilih mode:
   a. MERGE — gabungkan dengan data yang sudah ada (skip duplikat berdasarkan ID)
   b. REPLACE — hapus semua data saat ini, ganti dengan data dari backup
9. Konfirmasi → restore selesai
```

**Cross-device restore:**
Ini adalah cara utama untuk pindah device. Export dari device lama → upload ke device baru → input master password → done. Master password harus sama.

**Ganti master password saat restore:**
Jika ingin ganti master password sekalian saat restore, fitur ini ada di `/settings/account` → "Ganti Master Password" (akan re-enkripsi semua data dengan password baru).

---

## 8. Settings

### 8.1 Global Settings (`/settings`)

| Kategori | Opsi |
|---|---|
| Keamanan | Auto-lock timer (5/15/30/60 menit / tidak pernah) |
| Keamanan | PIN shortcut (6 digit, opsional) |
| Keamanan | Ganti master password |
| Tampilan | Tema (terang / gelap / ikuti sistem) |
| Bahasa | Indonesia / English |
| Notifikasi | Reminder backup (setiap 7/14/30 hari / nonaktif) |
| Notifikasi | Notifikasi credential kadaluarsa |
| Berbahaya | Hapus semua data vault |

### 8.2 Settings per App — BRANKAS (`/brankas/settings`)

| Kategori | Opsi |
|---|---|
| Tampilan | Default view (grid / list) |
| Tampilan | Sort default (nama / tanggal / kategori) |
| Clipboard | Auto-clear delay (15 / 30 / 60 detik) |
| Keamanan | Sembunyikan nilai sensitif saat pertama buka |
| Backup | Preferensi backup (local / Google Drive / GitHub) |
| Backup | Jadwal reminder backup per-app |
| Data | Export sebagai CSV (terenkripsi saat import, plaintext saat export — peringatan!) |
| Berbahaya | Hapus semua data BRANKAS saja |

---

## 9. Monetisasi

### 9.1 Model: Open Source + Freemium Hosted

TMPT akan di-publish sebagai open source (MIT License) di GitHub. Pengguna bisa self-host secara gratis. Versi hosted di `tmpt.my.id` menawarkan tier berbayar untuk fitur premium.

Pendekatan ini membangun kepercayaan (code bisa diaudit) sekaligus memberi jalur revenue dari convenience features.

### 9.2 Tabel Tier

| Fitur | Free | Pro | Catatan |
|---|---|---|---|
| BRANKAS (semua fitur) | ✓ | ✓ | Unlimited entries |
| Semua tools standalone | ✓ | ✓ | Selalu gratis |
| Backup ke local disk | ✓ | ✓ | |
| Backup ke Google Drive (manual) | ✓ | ✓ | |
| Auto-backup terjadwal ke Google Drive | ✗ | ✓ | Pro only |
| Multiple vaults | ✗ | ✓ | Pisah personal vs kerja |
| Akses app baru (DAFTAR, CATAT, dll) | Beta | ✓ | Pro dapat akses lebih awal |
| Priority support | ✗ | ✓ | |
| Custom export template | ✗ | ✓ | |
| Harga | Gratis | Rp 29.000/bulan atau Rp 249.000/tahun | |

**Catatan implementasi Pro tier:**
Karena tidak ada backend, validasi Pro dilakukan via license key yang diverifikasi dengan Cloudflare Worker ringan (hanya validasi key — tidak menyentuh data vault). Key disimpan di `localStorage` dan di-check saat fitur Pro diakses. Ini bukan sistem yang 100% aman dari abuse, tapi cukup untuk mencegah casual circumvention.

### 9.3 Revenue Streams Tambahan

| Stream | Keterangan | Estimasi |
|---|---|---|
| Donasi (Saweria, Ko-fi) | "Kalau TMPT berguna, belikan kopi" | Rp 500rb–2jt/bulan di fase awal |
| Affiliate | Rekomendasi VPS/hosting di kategori BRANKAS | 5–10% komisi per signup |
| White-label | Custom domain + logo untuk perusahaan | Rp 500rb/bulan per tenant |
| Self-host support | Jasa setup untuk non-teknis | One-time fee |

### 9.4 Proyeksi Bisnis

**Phase 1 (0–6 bulan): Validasi**
- Target: 500 pengguna aktif (vault terbuat)
- Revenue: donasi + organic
- Fokus: polish UX, zero bugs, bangun trust

**Phase 2 (6–18 bulan): Monetisasi**
- Target: 2.000 pengguna, 200 Pro users
- Revenue: 200 × Rp 249.000/tahun = **Rp 49,8 juta/tahun**
- Tambah: DAFTAR app, auto-backup feature

**Phase 3 (18+ bulan): Scale**
- Target: 10.000 pengguna, 1.000 Pro users
- Revenue: **~Rp 249 juta/tahun**
- Tambah: Team tier (butuh minimal backend), API access

### 9.5 Strategi GTM (Go-To-Market)

**Target utama:** Developer, IT professional, freelancer Indonesia yang mengelola banyak akun dan credential.

**Channel:**
1. Twitter/X tech Indonesia — demo gif BRANKAS "simpan credential tanpa khawatir bocor"
2. GitHub — README + demo, star repo = social proof
3. Dicoding community
4. Dev.to / Medium — artikel "Password manager buatan sendiri dengan 0 database"
5. SEO — target keyword: "password manager Indonesia", "simpan password aman", "alternatif bitwarden Indonesia"

**Differensiator vs kompetitor:**
| | TMPT BRANKAS | Bitwarden | LastPass | Keepass |
|---|---|---|---|---|
| Harga | Gratis | Gratis/berbayar | Berbayar | Gratis |
| Data ke server | Tidak | Ya (encrypted) | Ya (encrypted) | Tidak |
| Bahasa Indonesia | ✓ | ✗ | ✗ | ✗ |
| Tools bundled | ✓ | ✗ | ✗ | ✗ |
| Setup complexity | Sangat mudah | Mudah | Mudah | Teknis |
| Open source | ✓ | ✓ | ✗ | ✓ |

---

## 10. Halaman Standar

### About (`/about`)
- Filosofi: privacy-first, zero-knowledge, open source
- Mengapa TMPT dibuat (backstory singkat)
- Tech stack overview (untuk membangun kepercayaan dari developer)
- "Dibuat oleh [Dasa/KK] di Indonesia"

### FAQ (`/faq`)
Pertanyaan yang akan paling sering ditanya:
1. "Apakah data saya aman?" → penjelasan AES-256-GCM + zero knowledge
2. "Apa yang terjadi jika saya lupa master password?" → jawaban jujur
3. "Bagaimana jika browser saya crash atau clear data?" → pentingnya backup
4. "Apakah TMPT bisa digunakan offline?" → ya, setelah load pertama
5. "Bedanya TMPT dengan Bitwarden?" → local-first, no account needed
6. "Apakah TMPT menyimpan data saya di server?" → tidak sama sekali

### Help (`/help`)
- Getting started guide (5 langkah)
- Video walkthrough (Loom embed, opsional)
- Panduan per fitur: BRANKAS, Tools, Backup
- Troubleshooting: "Vault tidak bisa dibuka", "File backup corrupt"

### Contact (`/contact`)
- Form sederhana (via Formspree — free tier, tidak butuh backend)
- Email: hello@tmpt.my.id
- Twitter/X: @tmpt_id
- GitHub Issues untuk bug report

---

## 11. Shared Components

Berikut komponen yang di-share lintas halaman (lihat arsitektur di PRD sebelumnya):

| File | Fungsi |
|---|---|
| `/shared/header.html` | Nav utama (logo, links, lock icon, auth state) |
| `/shared/footer.html` | Footer standar (links, copyright) |
| `/shared/app-header.html` | Header dalam app (breadcrumb, user menu) |
| `/shared/crypto.js` | PBKDF2, AES-256-GCM encrypt/decrypt |
| `/shared/auth.js` | Session management, requireAuth(), lock/unlock |
| `/shared/vault.js` | CRUD operation untuk data vault |
| `/shared/backup.js` | Export/import logic, Google Drive API |
| `/shared/ui.js` | Toast notifications, modal, loading states |
| `/assets/css/app.css` | Override PicoCSS, design tokens TMPT |
| `/shared/icons.svg` | Tabler Icons sprite |

---

## 12. Roadmap

### v1.0 — MVP (sekarang)
- [x] PRD selesai
- [ ] Setup project: GitHub repo, domain, GitHub Pages
- [ ] Shared: crypto.js, auth.js, vault.js, header
- [ ] Landing page selesai
- [ ] Halaman standar (About, FAQ, Help, Terms, Privacy, Contact)
- [ ] Auth: setup vault, login, auto-lock
- [ ] BRANKAS: credentials CRUD + records CRUD
- [ ] Backup: local disk export/import
- [ ] Settings: global + brankas
- [ ] Tools: password-gen, uuid, jwt, totp, hash, base64, json

### v1.1 — Polish
- [ ] Backup ke Google Drive (manual)
- [ ] Backup ke GitHub Gist
- [ ] TOTP / 2FA generator dalam BRANKAS
- [ ] Password strength checker
- [ ] Expire date alerts
- [ ] Import dari Bitwarden JSON
- [ ] PWA / Service Worker (offline penuh)

### v1.2 — Pro Tier
- [ ] License key system (Cloudflare Worker)
- [ ] Multiple vaults
- [ ] Auto-backup terjadwal ke Google Drive
- [ ] Custom export template

### v2.0 — Platform Expansion
- [ ] App DAFTAR (to-do & list manager)
- [ ] App CATAT (secure notes)
- [ ] Recovery code system
- [ ] Team/shared vault (butuh minimal backend)
