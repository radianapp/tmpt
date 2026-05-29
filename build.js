const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'deploy','dist');

// Bersihkan direktori dist jika sudah ada
if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });

const itemsToCopy = [
    'app',
    'assets',
    'shared',
    'index.html',
    '404.html',
    'favicon.png',
    'favicon-48.png',
    'favicon-512.png',
    'manifest.json',
    'sw.js'
];

console.log('Memulai proses build ke direktori deploy/dist...');

itemsToCopy.forEach(item => {
    const srcPath = path.join(__dirname, item);
    const destPath = path.join(targetDir, item);

    if (fs.existsSync(srcPath)) {
        const stats = fs.statSync(srcPath);
        if (stats.isDirectory()) {
            fs.cpSync(srcPath, destPath, { recursive: true });
            console.log(`Berhasil menyalin direktori: ${item}`);
        } else {
            fs.copyFileSync(srcPath, destPath);
            console.log(`Berhasil menyalin file: ${item}`);
        }
    } else {
        console.warn(`Peringatan: Item ${item} tidak ditemukan, dilewati.`);
    }
});

console.log('Proses build selesai! Folder dist siap digunakan oleh Capacitor.');
