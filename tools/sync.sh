#!/bin/bash
# Git Sync Script for TMPT Vault (Bash)
# Salin skrip ini ke dalam folder repositori private Anda

echo -e "\033[1;36mMemulai sinkronisasi otomatis vault...\033[0m"

# Pastikan git terinstal
if ! command -v git &> /dev/null; then
    echo -e "\033[1;31mERROR: Git tidak ditemukan! Pastikan Git sudah diinstal di sistem Anda.\033[0m"
    exit 1
fi

# Cek apakah ada perubahan status
if [[ -z $(git status --porcelain) ]]; then
    echo -e "\033[1;32mTidak ada perubahan yang perlu disinkronkan. Semua up-to-date!\033[0m"
else
    echo "Menambahkan perubahan file ke Git..."
    git add .

    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    COMMIT_MSG="Backup otomatis: $TIMESTAMP"
    
    echo "Membuat commit: '$COMMIT_MSG'..."
    git commit -m "$COMMIT_MSG"

    echo "Melakukan push ke repositori awan..."
    git push origin HEAD

    if [ $? -eq 0 ]; then
        echo -e "\033[1;32mSinkronisasi berhasil diselesaikan!\033[0m"
    else
        echo -e "\033[1;31mERROR: Gagal melakukan push. Periksa koneksi internet atau hak akses repositori Anda.\033[0m"
    fi
fi
