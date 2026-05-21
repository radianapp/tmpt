# Git Sync Script for TMPT Vault (PowerShell)
# Salin skrip ini ke dalam folder repositori private Anda

$ErrorActionPreference = "Stop"

Write-Host "Memulai sinkronisasi otomatis vault..." -ForegroundColor Cyan

# Pastikan git terinstal dan dapat diakses
if (-not (Get-Command "git" -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Git tidak ditemukan! Pastikan Git sudah diinstal di sistem Anda." -ForegroundColor Red
    Pause
    exit
}

# Cek apakah ada perubahan status
$gitStatus = git status --porcelain

if ([string]::IsNullOrWhiteSpace($gitStatus)) {
    Write-Host "Tidak ada perubahan yang perlu disinkronkan. Semua up-to-date!" -ForegroundColor Green
} else {
    Write-Host "Menambahkan perubahan file ke Git..."
    git add .

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $commitMsg = "Backup otomatis: $timestamp"
    
    Write-Host "Membuat commit: '$commitMsg'..."
    git commit -m $commitMsg

    Write-Host "Melakukan push ke repositori awan..."
    git push origin HEAD

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Sinkronisasi berhasil diselesaikan!" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Gagal melakukan push. Periksa koneksi internet atau hak akses repositori Anda." -ForegroundColor Red
    }
}

Write-Host "Tekan tombol apa saja untuk keluar..."
$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null
