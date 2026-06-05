/**
 * TMPT Base64 - Character Encoding Detector
 */

function analyzeUTF8(uint8Array) {
    let validUTF8 = true;
    let confidence = 50;
    
    // Check if it has standard UTF-8 sequence patterns
    let i = 0;
    const len = uint8Array.length;
    while (i < len) {
        const b = uint8Array[i];
        if (b <= 0x7F) {
            i++;
        } else if ((b & 0xE0) === 0xC0) {
            if (i + 1 >= len || (uint8Array[i+1] & 0xC0) !== 0x80) { validUTF8 = false; break; }
            i += 2;
            confidence = 85;
        } else if ((b & 0xF0) === 0xE0) {
            if (i + 2 >= len || (uint8Array[i+1] & 0xC0) !== 0x80 || (uint8Array[i+2] & 0xC0) !== 0x80) { validUTF8 = false; break; }
            i += 3;
            confidence = 90;
        } else if ((b & 0xF8) === 0xF0) {
            if (i + 3 >= len || (uint8Array[i+1] & 0xC0) !== 0x80 || (uint8Array[i+2] & 0xC0) !== 0x80 || (uint8Array[i+3] & 0xC0) !== 0x80) { validUTF8 = false; break; }
            i += 4;
            confidence = 95;
        } else {
            validUTF8 = false;
            break;
        }
    }
    
    return {
        charset: 'UTF-8',
        confidence: validUTF8 ? confidence : 0,
        note: validUTF8 ? 'Rangkaian byte UTF-8 valid' : 'Mengandung byte non-UTF-8'
    };
}

function analyzeISO88591(uint8Array) {
    // ISO-8859-1 allows all bytes, but control characters between 0x7F and 0x9F are not used (unlike Windows-1252)
    let hasWindowsSpecific = false;
    for (let i = 0; i < uint8Array.length; i++) {
        const b = uint8Array[i];
        if (b >= 0x80 && b <= 0x9F) {
            hasWindowsSpecific = true;
        }
    }
    return {
        charset: 'ISO-8859-1',
        confidence: hasWindowsSpecific ? 40 : 75,
        note: hasWindowsSpecific ? 'Ada karakter kontrol Windows-1252' : 'Struktur byte sesuai ISO-8859-1'
    };
}

function analyzeWindows1252(uint8Array) {
    let hasSpecials = false;
    for (let i = 0; i < uint8Array.length; i++) {
        const b = uint8Array[i];
        if (b >= 0x80 && b <= 0x9F) {
            hasSpecials = true;
        }
    }
    return {
        charset: 'Windows-1252',
        confidence: hasSpecials ? 80 : 60,
        note: hasSpecials ? 'Karakter cetak Windows-1252 terdeteksi' : 'Kompatibel dengan Windows-1252'
    };
}

export function detectEncoding(uint8Array) {
    if (!uint8Array || uint8Array.length === 0) {
        return [{ charset: 'Tidak ada data', confidence: 0, note: '-' }];
    }
    
    // Cek BOM
    if (uint8Array[0] === 0xEF && uint8Array[1] === 0xBB && uint8Array[2] === 0xBF) {
        return [{ charset: 'UTF-8', confidence: 100, note: 'BOM UTF-8 terdeteksi' }];
    }
    if (uint8Array[0] === 0xFF && uint8Array[1] === 0xFE) {
        return [{ charset: 'UTF-16 LE', confidence: 100, note: 'BOM UTF-16 LE terdeteksi' }];
    }
    if (uint8Array[0] === 0xFE && uint8Array[1] === 0xFF) {
        return [{ charset: 'UTF-16 BE', confidence: 100, note: 'BOM UTF-16 BE terdeteksi' }];
    }

    const candidates = [
        analyzeUTF8(uint8Array),
        analyzeISO88591(uint8Array),
        analyzeWindows1252(uint8Array),
    ];
    return candidates.sort((a, b) => b.confidence - a.confidence);
}
