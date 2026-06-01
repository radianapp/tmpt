// bin/rebuild-pwa.js
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const swPath = path.join(rootDir, 'sw.js');

// Direktori & file yang akan dipindai untuk dimasukkan ke cache PWA
const scanDirs = ['app', 'shared', 'assets'];
const rootFiles = ['index.html', '404.html', 'manifest.json', 'favicon.png', 'favicon-48.png', 'favicon-512.png'];

// Ekstensi file yang dianggap aset statis
const allowedExtensions = ['.html', '.css', '.js', '.json', '.png', '.svg', '.woff2', '.ttf', '.css.map', '.js.map'];

function getFilesRecursively(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Abaikan folder vendor monaco atau folder besar jika tidak diperlukan
      // Monaco & Pyodide di-lazy load jadi biarkan browser yang men-cache secara dinamis saat di-fetch
      if (file !== 'monaco' && file !== 'pyodide' && file !== 'node_modules' && file !== '.git') {
        getFilesRecursively(filePath, fileList);
      }
    } else {
      const ext = path.extname(file).toLowerCase();
      if (allowedExtensions.includes(ext)) {
        // Konversi ke format path web relative: /dir/subdir/file.ext
        const relativePath = '/' + path.relative(rootDir, filePath).replace(/\\/g, '/');
        fileList.push(relativePath);
      }
    }
  });
  return fileList;
}

console.log('Memulai pemindaian file statis untuk PWA cache...');
let assets = ['/'];

// Pindai folder-folder utama
scanDirs.forEach(dir => {
  const dirPath = path.join(rootDir, dir);
  assets = assets.concat(getFilesRecursively(dirPath));
});

// Tambahkan file di root
rootFiles.forEach(file => {
  const filePath = path.join(rootDir, file);
  if (fs.existsSync(filePath)) {
    assets.push('/' + file);
  }
});

// Urutkan & bersihkan duplikasi
assets = [...new Set(assets)].sort();

console.log(`Ditemukan ${assets.length} file statis untuk di-cache.`);

if (fs.existsSync(swPath)) {
  let swContent = fs.readFileSync(swPath, 'utf8');

  // Tingkatkan cache version otomatis (misal: tmpt-cache-v1.6 -> tmpt-cache-v1.7)
  const cacheNameRegex = /const\s+CACHE_NAME\s+=\s+'(tmpt-cache-v)(\d+(\.\d+)?)'/;
  const match = swContent.match(cacheNameRegex);
  
  if (match) {
    const prefix = match[1];
    const versionNum = parseFloat(match[2]);
    const nextVersion = (versionNum + 0.1).toFixed(1);
    const newCacheName = `${prefix}${nextVersion}`;
    
    console.log(`Meningkatkan versi cache: ${match[0].split('=')[1].trim()} -> '${newCacheName}'`);
    
    // Ganti Cache Name
    swContent = swContent.replace(cacheNameRegex, `const CACHE_NAME = '${newCacheName}'`);
  } else {
    // Fallback jika format berbeda
    const defaultCacheName = `const CACHE_NAME = 'tmpt-cache-${Date.now()}';`;
    swContent = swContent.replace(/const\s+CACHE_NAME\s+=\s+['"][^'"]+['"];/, defaultCacheName);
  }

  // Ganti daftar ASSETS
  const assetsRegex = /const\s+ASSETS\s+=\s+\[[\s\S]*?\];/;
  const newAssetsContent = `const ASSETS = [\n  ${assets.map(a => `'${a}'`).join(',\n  ')}\n];`;
  
  swContent = swContent.replace(assetsRegex, newAssetsContent);
  
  fs.writeFileSync(swPath, swContent, 'utf8');
  console.log('sw.js berhasil diperbarui dengan aset terbaru!');
  
  // Salin ke deploy/dist/sw.js jika ada
  const distSwPath = path.join(rootDir, 'deploy', 'dist', 'sw.js');
  if (fs.existsSync(path.dirname(distSwPath))) {
    fs.writeFileSync(distSwPath, swContent, 'utf8');
    console.log('sw.js disalin ke deploy/dist/sw.js');
  }
} else {
  console.error('File sw.js tidak ditemukan di root!');
}
