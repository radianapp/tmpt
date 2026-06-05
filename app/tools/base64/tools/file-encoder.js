/**
 * TMPT Base64 - File Encoder
 */

export const MAGIC_BYTES = {
    'FFD8FF':   { mime: 'image/jpeg',      ext: 'jpg'  },
    '89504E47': { mime: 'image/png',        ext: 'png'  },
    '47494638': { mime: 'image/gif',        ext: 'gif'  },
    '25504446': { mime: 'application/pdf',  ext: 'pdf'  },
    '504B0304': { mime: 'application/zip',  ext: 'zip'  },
    '1F8B08':   { mime: 'application/gzip', ext: 'gz'   },
    '52494646': { mime: 'audio/wav',         ext: 'wav'  },
    '494433':   { mime: 'audio/mp3',         ext: 'mp3'  },
    '664C6143': { mime: 'audio/flac',        ext: 'flac' },
};

export function detectMimeFromBytes(uint8Array) {
    const hex = Array.from(uint8Array.slice(0, 8))
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join('');

    for (const [signature, info] of Object.entries(MAGIC_BYTES)) {
        if (hex.startsWith(signature)) return info;
    }
    return { mime: 'application/octet-stream', ext: 'bin' };
}

export async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUri = e.target.result;
            const base64 = dataUri.split(',')[1];
            resolve({
                base64,
                dataUri,
                mimeType: file.type || 'application/octet-stream',
                fileName: file.name,
                fileSize: file.size,
                base64Size: Math.ceil(file.size * 4 / 3),
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
