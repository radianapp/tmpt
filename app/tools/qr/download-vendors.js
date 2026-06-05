const fs = require('fs');
const path = require('path');
const https = require('https');

const vendorDir = path.join(__dirname, 'vendor');
if (!fs.existsSync(vendorDir)) {
  fs.mkdirSync(vendorDir, { recursive: true });
}

const libraries = {
  'qr-code-styling.min.js': 'https://unpkg.com/qr-code-styling@1.5.0/lib/qr-code-styling.js',
  'jsqr.min.js': 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
  'jspdf.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
};

function download(filename, url) {
  return new Promise((resolve, reject) => {
    const dest = path.join(vendorDir, filename);
    const file = fs.createWriteStream(dest);
    console.log(`Downloading ${filename} from ${url}...`);
    
    const request = (targetUrl) => {
      https.get(targetUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          request(response.headers.location);
          return;
        }
        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`Failed to download ${filename}: HTTP ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`Downloaded ${filename} successfully.`);
          resolve();
        });
      }).on('error', (err) => {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(err);
      });
    };
    
    request(url);
  });
}

async function main() {
  // Download external libraries
  for (const [filename, url] of Object.entries(libraries)) {
    try {
      await download(filename, url);
    } catch (err) {
      console.error(`Failed to download ${filename}:`, err);
      process.exit(1);
    }
  }

  // Copy local PapaParse
  try {
    const sourcePapa = path.join(__dirname, '..', '..', 'dev', 'json', 'vendor', 'papaparse.min.js');
    if (fs.existsSync(sourcePapa)) {
      fs.copyFileSync(sourcePapa, path.join(vendorDir, 'papaparse.min.js'));
      console.log('Copied papaparse.min.js from json tool.');
    } else {
      // Fallback download if not found
      await download('papaparse.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js');
    }
  } catch (err) {
    console.error('Failed to copy/download papaparse.min.js:', err);
  }

  // Copy local JSZip
  try {
    const sourceZip = path.join(__dirname, '..', '..', '..', 'shared', 'vendor', 'jszip.min.js');
    if (fs.existsSync(sourceZip)) {
      fs.copyFileSync(sourceZip, path.join(vendorDir, 'jszip.min.js'));
      console.log('Copied jszip.min.js from shared vendor.');
    }
  } catch (err) {
    console.error('Failed to copy jszip.min.js:', err);
  }

  console.log('All vendor libraries loaded successfully!');
}

main();
