/**
 * TMPT Favicon - Core Engine
 * 100% Client-Side Canvas Operations, ICO Generator, and ZIP Bundler
 */

// Sizes definitions
export const FAVICON_SIZES = [
  { name: 'favicon-16x16.png', width: 16, height: 16, type: 'image/png' },
  { name: 'favicon-32x32.png', width: 32, height: 32, type: 'image/png' },
  { name: 'favicon-48x48.png', width: 48, height: 48, type: 'image/png' },
  { name: 'apple-touch-icon.png', width: 180, height: 180, type: 'image/png' },
  { name: 'android-chrome-192x192.png', width: 192, height: 192, type: 'image/png' },
  { name: 'android-chrome-512x512.png', width: 512, height: 512, type: 'image/png' }
];

export const ICO_SIZES = [16, 32, 48];

/**
 * Creates high-quality resized canvas using multi-step scaling
 */
export function resizeCanvas(sourceCanvas, targetWidth, targetHeight, fitMode = 'contain', background = 'transparent') {
  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = targetWidth;
  targetCanvas.height = targetHeight;
  const ctx = targetCanvas.getContext('2d');
  
  if (!ctx) return targetCanvas;

  // Handle background color
  if (background !== 'transparent') {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  const srcWidth = sourceCanvas.width;
  const srcHeight = sourceCanvas.height;

  let drawWidth = targetWidth;
  let drawHeight = targetHeight;
  let drawX = 0;
  let drawY = 0;

  if (fitMode === 'contain') {
    const scale = Math.min(targetWidth / srcWidth, targetHeight / srcHeight);
    drawWidth = srcWidth * scale;
    drawHeight = srcHeight * scale;
    drawX = (targetWidth - drawWidth) / 2;
    drawY = (targetHeight - drawHeight) / 2;
  } else if (fitMode === 'cover') {
    const scale = Math.max(targetWidth / srcWidth, targetHeight / srcHeight);
    drawWidth = srcWidth * scale;
    drawHeight = srcHeight * scale;
    drawX = (targetWidth - drawWidth) / 2;
    drawY = (targetHeight - drawHeight) / 2;
  }

  // Draw with Bilinear / Image Smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, drawX, drawY, drawWidth, drawHeight);

  return targetCanvas;
}

/**
 * Converts canvas to PNG Blob
 */
export function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}

/**
 * Assemblies multiple PNG images into a single valid binary ICO file
 * @param {Array<{width, height, blob}>} images - array of image objects with width, height and blob
 * @returns {Promise<Blob>} - Combined ICO file
 */
export async function createIcoBlob(images) {
  const entriesCount = images.length;
  
  // Load array buffers for all PNG blobs
  const imageDataList = [];
  let totalImageDataBytes = 0;
  
  for (const img of images) {
    const buffer = await img.blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    imageDataList.push({
      width: img.width,
      height: img.height,
      bytes: bytes,
      size: bytes.length
    });
    totalImageDataBytes += bytes.length;
  }

  // Calculate sizes
  const headerSize = 6;
  const entrySize = 16;
  const totalEntriesSize = entriesCount * entrySize;
  const totalIcoSize = headerSize + totalEntriesSize + totalImageDataBytes;

  const icoBuffer = new ArrayBuffer(totalIcoSize);
  const view = new DataView(icoBuffer);
  const uint8View = new Uint8Array(icoBuffer);

  // 1. Write ICONDIR Header
  view.setUint16(0, 0, true); // Reserved = 0
  view.setUint16(2, 1, true); // Type = 1 (icon)
  view.setUint16(4, entriesCount, true); // Images count

  // 2. Write ICONDIRENTRY Table
  let currentOffset = headerSize + totalEntriesSize;
  let entryOffset = headerSize;

  for (const img of imageDataList) {
    // Width and height (0 means 256)
    view.setUint8(entryOffset, img.width >= 256 ? 0 : img.width);
    view.setUint8(entryOffset + 1, img.height >= 256 ? 0 : img.height);
    view.setUint8(entryOffset + 2, 0); // Palette color count (0 for >=8bpp)
    view.setUint8(entryOffset + 3, 0); // Reserved
    view.setUint16(entryOffset + 4, 1, true); // Color Planes = 1
    view.setUint16(entryOffset + 6, 32, true); // Bits per pixel = 32
    view.setUint32(entryOffset + 8, img.size, true); // Bytes in resource
    view.setUint32(entryOffset + 12, currentOffset, true); // Image offset

    // 3. Write raw PNG data
    uint8View.set(img.bytes, currentOffset);

    // Advance offsets
    currentOffset += img.size;
    entryOffset += entrySize;
  }

  return new Blob([icoBuffer], { type: 'image/x-icon' });
}

/**
 * Generates site.webmanifest JSON
 */
export function generateWebmanifest(appName = 'TMPT App', appShortName = 'TMPT') {
  return JSON.stringify({
    name: appName,
    short_name: appShortName,
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ],
    theme_color: '#0f172a',
    background_color: '#0f172a',
    display: 'standalone'
  }, null, 2);
}

/**
 * Generates installation HTML snippet
 */
export function generateInstallSnippet() {
  return `<!-- Tempatkan kode berikut di dalam tag <head> website Anda -->
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="shortcut icon" href="/favicon.ico">
`;
}

/**
 * Generates the full ZIP package containing all favicons, manifest, and snippet
 * @param {HTMLCanvasElement} sourceCanvas - Original high-res source canvas
 * @param {string} fitMode - cover | contain | fill
 * @param {string} background - transparent | CSS color string
 * @param {string} appName - Name of the application
 * @param {string} appShortName - Short name of the application
 * @returns {Promise<Blob>} - ZIP File blob
 */
export async function generateFaviconZip(sourceCanvas, fitMode = 'contain', background = 'transparent', appName = 'TMPT App', appShortName = 'TMPT') {
  if (typeof window.JSZip === 'undefined') {
    throw new Error('JSZip belum dimuat. Pastikan shared/vendor/jszip.min.js dimuat.');
  }

  const zip = new window.JSZip();

  // 1. Generate PNG sizes
  const icoImages = [];
  
  for (const size of FAVICON_SIZES) {
    const resized = resizeCanvas(sourceCanvas, size.width, size.height, fitMode, background);
    const blob = await canvasToBlob(resized);
    zip.file(size.name, blob);

    // Keep 16, 32, 48 sizes for the ICO file
    if (ICO_SIZES.includes(size.width)) {
      icoImages.push({ width: size.width, height: size.height, blob: blob });
    }
  }

  // 2. Generate ICO file and add to ZIP
  const icoBlob = await createIcoBlob(icoImages);
  zip.file('favicon.ico', icoBlob);

  // 3. Add Webmanifest
  const manifest = generateWebmanifest(appName, appShortName);
  zip.file('site.webmanifest', manifest);

  // 4. Add HTML Snippet
  const snippet = generateInstallSnippet();
  zip.file('install-snippet.html', snippet);

  // 5. Generate final zip blob
  return zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}
