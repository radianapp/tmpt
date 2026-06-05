const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const vendorDir = path.join(__dirname, 'vendor');

if (!fs.existsSync(vendorDir)) {
  fs.mkdirSync(vendorDir, { recursive: true });
}

// Libraries that have reliable UMD browser builds on CDNs
const libraries = {
  'jsonrepair.min.js': 'https://cdn.jsdelivr.net/npm/jsonrepair@3.8.0/lib/umd/jsonrepair.min.js',
  'jsonpath-plus.min.js': 'https://cdn.jsdelivr.net/npm/jsonpath-plus@10.2.0/dist/index-browser-umd.cjs',
  'jmespath.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/jmespath/0.16.0/jmespath.min.js',
  'js-yaml.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js',
  'fast-xml-parser.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/fast-xml-parser/4.4.0/fxparser.min.js',
  'papaparse.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js',
  'jsonata.min.js': 'https://cdn.jsdelivr.net/npm/jsonata@2.0.5/jsonata.min.js',
  'faker.min.js': 'https://cdn.jsdelivr.net/npm/faker@5.5.3/dist/faker.min.js',
  'xlsx.min.js': 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
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

async function bundleLibraries() {
  const tempDir = path.join(__dirname, 'build_temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  try {
    console.log('--- Bundling Ajv & Smol-TOML ---');
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'temp-build',
      private: true
    }));

    console.log('Installing Ajv and Smol-TOML packages...');
    execSync('npm install ajv@8.12.0 ajv-formats@2.1.1 smol-toml@1.3.0 --no-audit --no-fund', { cwd: tempDir, stdio: 'inherit' });

    console.log('Writing bundling entries...');
    fs.writeFileSync(path.join(tempDir, 'ajv-entry.js'), `
      const Ajv = require('ajv').default;
      const Ajv2020 = require('ajv/dist/2020').default;
      const ajvFormats = require('ajv-formats').default;
      window.Ajv = Ajv;
      window.Ajv2020 = Ajv2020;
      window.ajvFormats = ajvFormats;
    `);

    fs.writeFileSync(path.join(tempDir, 'toml-entry.js'), `
      const TOML = require('smol-toml');
      window.TOML = TOML;
    `);

    console.log('Running esbuild bundling...');
    execSync(`npx esbuild "${path.join(tempDir, 'ajv-entry.js')}" --bundle --minify --outfile="${path.join(vendorDir, 'ajv.min.js')}"`, { stdio: 'inherit' });
    execSync(`npx esbuild "${path.join(tempDir, 'toml-entry.js')}" --bundle --minify --outfile="${path.join(vendorDir, 'smol-toml.min.js')}"`, { stdio: 'inherit' });
    
    // Write placeholder file for ajv-formats.min.js
    fs.writeFileSync(path.join(vendorDir, 'ajv-formats.min.js'), '// Bundled inside ajv.min.js\n');
    console.log('Bundling successful!');
  } catch (err) {
    console.error('Error during bundling:', err);
    throw err;
  } finally {
    console.log('Cleaning up temporary folder...');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

async function main() {
  for (const [filename, url] of Object.entries(libraries)) {
    try {
      await download(filename, url);
    } catch (err) {
      console.error(`Failed to download ${filename}:`, err);
      process.exit(1);
    }
  }
  
  try {
    await bundleLibraries();
  } catch (err) {
    console.error('Bundling failed:', err);
    process.exit(1);
  }
  
  console.log('All vendor libraries loaded successfully!');
}

main();

