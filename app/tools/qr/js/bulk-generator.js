// Bulk QR Generator Module using PapaParse, JSZip, and local qr-generator engine
import { createQR } from './qr-generator.js';

export async function parseCSV(csvFile) {
  return new Promise((resolve, reject) => {
    window.Papa.parse(csvFile, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (err) => reject(err)
    });
  });
}

// Convert a QRCodeStyling object to a Blob
export async function qrToBlob(qr, format = 'png') {
  return new Promise(async (resolve) => {
    const rawContainer = document.createElement('div');
    rawContainer.style.display = 'none';
    document.body.appendChild(rawContainer);
    
    await qr.append(rawContainer);
    // Give rendering a small moment
    await new Promise(r => setTimeout(r, 100));

    const canvas = rawContainer.querySelector('canvas');
    if (canvas) {
      canvas.toBlob((blob) => {
        document.body.removeChild(rawContainer);
        resolve(blob);
      }, `image/${format === 'jpg' ? 'jpeg' : format}`);
    } else {
      document.body.removeChild(rawContainer);
      resolve(null);
    }
  });
}

export async function generateBulkQR(rows, designConfig, onProgress) {
  if (rows.length > 500) {
    throw new Error('Maksimum 500 QR per batch.');
  }

  // Detect which column to use for QR content
  const firstRow = rows[0];
  const keys = Object.keys(firstRow);
  const contentCol = keys.find(k =>
    ['content', 'url', 'data', 'link', 'text'].includes(k.toLowerCase())
  );

  if (!contentCol) {
    throw new Error(`Kolom "content" tidak ditemukan. Kolom tersedia: ${keys.join(', ')}`);
  }

  const results = [];
  const format = designConfig.format || 'png';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const content = String(row[contentCol] || '').trim();
    if (!content) continue;

    const title = row.title || row.name || '';
    const filename = (row.filename || title || `qr_${String(i + 1).padStart(4, '0')}`).replace(/[^a-z0-9_-]/gi, '_');

    const qr = createQR(content, designConfig);
    const blob = await qrToBlob(qr, format);
    
    if (blob) {
      results.push({ filename, blob, row });
    }

    if (onProgress) {
      onProgress(i + 1, rows.length);
    }

    // Yield execution to keep browser UI responsive
    await new Promise(r => setTimeout(r, 10));
  }

  return results;
}

export async function buildZIP(results, format = 'png') {
  const zip = new window.JSZip();
  const folder = zip.folder('qr_codes');

  results.forEach(({ filename, blob }) => {
    folder.file(`${filename}.${format}`, blob);
  });

  // Generate a CSV summary inside the ZIP
  if (results.length > 0) {
    const headers = Object.keys(results[0].row);
    const csvLines = [headers.join(',')];
    
    results.forEach(({ row }) => {
      const line = headers.map(h => {
        let val = String(row[h] || '');
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csvLines.push(line.join(','));
    });

    zip.file('summary.csv', csvLines.join('\n'));
  }

  return await zip.generateAsync({ type: 'blob' });
}
